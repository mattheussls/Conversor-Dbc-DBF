from __future__ import annotations

import shutil
import sys
import tempfile
import zipfile
from concurrent.futures import Future, ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from threading import Lock
from typing import Any

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from converter import ConversionError, convert_dbc_to_dbf  # noqa: E402
from automacao_papa_datasus import WEB_OUTPUT_DIR, list_available_papa_files, process_selected_months  # noqa: E402


app = FastAPI(title="Conversor DBC para DBF", version="1.0.0")
executor = ThreadPoolExecutor(max_workers=1)
job_lock = Lock()
automation_future: Future | None = None
automation_job: dict[str, Any] = {
    "status": "idle",
    "started_at": None,
    "finished_at": None,
    "message": "Automacao ainda nao iniciada.",
    "events": [],
    "results": [],
    "available_files": [],
    "zip_download_url": None,
}


class AutomationStartRequest(BaseModel):
    months: list[int]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def add_automation_event(event: str, message: str) -> None:
    with job_lock:
        automation_job["message"] = message
        automation_job["events"].append(
            {
                "event": event,
                "message": message,
                "created_at": datetime.now().isoformat(timespec="seconds"),
            }
        )
        automation_job["events"] = automation_job["events"][-80:]


def run_automation_job() -> None:
    months = automation_job.get("selected_months", [])
    output_dir = Path(str(automation_job.get("output_dir", "")))
    try:
        results = process_selected_months(months=months, output_dir=output_dir, progress_callback=add_automation_event)
        zip_path = create_results_zip(output_dir, results)
        with job_lock:
            automation_job["status"] = "success"
            automation_job["finished_at"] = datetime.now().isoformat(timespec="seconds")
            automation_job["message"] = "Automacao concluida com sucesso."
            automation_job["results"] = sanitize_results(results)
            automation_job["zip_download_url"] = f"/api/automation/download/{zip_path.name}"
    except Exception as exc:  # noqa: BLE001
        with job_lock:
            automation_job["status"] = "error"
            automation_job["finished_at"] = datetime.now().isoformat(timespec="seconds")
            automation_job["message"] = str(exc)
        add_automation_event("error", str(exc))


@app.get("/api/papa/files")
def papa_files() -> list[dict[str, Any]]:
    try:
        return [remote.to_dict() for remote in list_available_papa_files()]
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Nao foi possivel consultar o DATASUS: {exc}") from exc


@app.post("/api/automation/start")
def start_automation(payload: AutomationStartRequest) -> dict[str, Any]:
    global automation_future
    months = sorted(set(payload.months))
    if not months:
        raise HTTPException(status_code=400, detail="Selecione pelo menos um PAPA para processar.")
    if any(month < 1 or month > 12 for month in months):
        raise HTTPException(status_code=400, detail="Mes invalido na selecao.")

    with job_lock:
        if automation_future and not automation_future.done():
            return public_job_response()

        job_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = WEB_OUTPUT_DIR / job_id
        automation_job.update(
            {
                "status": "running",
                "started_at": datetime.now().isoformat(timespec="seconds"),
                "finished_at": None,
                "message": "Automacao iniciada.",
                "events": [],
                "results": [],
                "zip_download_url": None,
                "selected_months": months,
                "output_dir": str(output_dir),
            }
        )
        automation_future = executor.submit(run_automation_job)
        return public_job_response()


@app.get("/api/automation/status")
def automation_status() -> dict[str, Any]:
    with job_lock:
        return public_job_response()


def public_job_response() -> dict[str, Any]:
    response = dict(automation_job)
    response.pop("output_dir", None)
    return response


def sanitize_results(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    safe_results = []
    for item in results:
        safe_results.append(
            {
                "arquivo_origem": item.get("arquivo_origem"),
                "arquivo_csv": Path(str(item.get("csv_destino", ""))).name,
                "linhas_belem": item.get("linhas_belem"),
                "status": item.get("status"),
                "processado_em": item.get("processado_em"),
                "download_url": f"/api/automation/download/{Path(str(item.get('csv_destino', ''))).name}",
            }
        )
    return safe_results


def create_results_zip(output_dir: Path, results: list[dict[str, Any]]) -> Path:
    zip_path = output_dir / "csv_papa_belem.zip"
    csv_paths = [Path(str(item["csv_destino"])) for item in results if item.get("csv_destino")]
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for csv_path in csv_paths:
            if csv_path.exists():
                archive.write(csv_path, arcname=csv_path.name)
    return zip_path


def resolve_download_file(filename: str) -> Path:
    safe_name = Path(filename).name
    output_dir = Path(str(automation_job.get("output_dir", ""))).resolve()
    candidate = (output_dir / safe_name).resolve()
    if output_dir not in candidate.parents and candidate != output_dir:
        raise HTTPException(status_code=400, detail="Arquivo invalido.")
    if not candidate.exists() or not candidate.is_file():
        raise HTTPException(status_code=404, detail="Arquivo nao encontrado.")
    return candidate


@app.get("/api/automation/download/{filename}")
def download_automation_file(filename: str) -> FileResponse:
    file_path = resolve_download_file(filename)
    media_type = "application/zip" if file_path.suffix.lower() == ".zip" else "text/csv"
    return FileResponse(path=file_path, filename=file_path.name, media_type=media_type)


@app.post("/api/convert")
async def convert_file(background_tasks: BackgroundTasks, file: UploadFile = File(...)) -> FileResponse:
    filename = Path(file.filename or "").name
    if not filename.lower().endswith(".dbc"):
        raise HTTPException(status_code=400, detail="Envie um arquivo com extensao .dbc.")

    work_dir = Path(tempfile.mkdtemp(prefix="dbc-converter-"))
    input_path = work_dir / filename
    output_path = input_path.with_suffix(".dbf")

    try:
        with input_path.open("wb") as destination:
            shutil.copyfileobj(file.file, destination)

        result = convert_dbc_to_dbf(input_path, output_path)
    except ConversionError as exc:
        shutil.rmtree(work_dir, ignore_errors=True)
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        shutil.rmtree(work_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Erro inesperado na conversao: {exc}") from exc
    finally:
        await file.close()

    background_tasks.add_task(shutil.rmtree, work_dir, ignore_errors=True)
    return FileResponse(
        path=result,
        filename=result.name,
        media_type="application/octet-stream",
        background=background_tasks,
    )
