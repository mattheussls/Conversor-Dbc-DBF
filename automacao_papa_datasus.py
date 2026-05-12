from __future__ import annotations

import csv
import logging
import re
from dataclasses import dataclass
from datetime import datetime
from ftplib import FTP
from pathlib import Path
from typing import Callable, Iterable

import pandas as pd
from dbfread import DBF

from converter import ConversionError, convert_dbc_to_dbf


# =============================================================================
# CONFIGURACAO - ajuste aqui para o ambiente de producao
# =============================================================================

# FTP do DATASUS. O PAPA fica no grupo SIASUS, pasta Dados.
FTP_HOST = "ftp.datasus.gov.br"
FTP_DIR = "/dissemin/publicos/SIASUS/200801_/Dados"

# Credenciais do FTP.
# O DATASUS costuma aceitar acesso anonimo. Se houver credenciais internas,
# preencha FTP_USER e FTP_PASSWORD.
FTP_USER = "anonymous"
FTP_PASSWORD = ""

# Arquivos de interesse. Para 2026, os nomes atuais seguem PAPA2601.dbc,
# PAPA2602.dbc, PAPA2603.dbc, e assim por diante.
REMOTE_PATTERN = re.compile(r"^PAPA26(?P<mes>\d{2})\.dbc$", re.IGNORECASE)

# Pasta local de trabalho. DBC e DBF ficam aqui durante o processamento.
WORK_DIR = Path("dados_papa_work")

# Pasta local onde a versao web guarda os CSVs gerados para download.
WEB_OUTPUT_DIR = Path("dados_papa_saida")

# Filtro de Belem/PA. Codigo IBGE do municipio: 150140.
# PA_UFMUN = municipio do estabelecimento/unidade.
# PA_MUNPCN = municipio do paciente. Troque FILTER_COLUMN se a regra de negocio
# precisar filtrar pelo municipio do paciente.
FILTER_COLUMN = "PA_UFMUN"
MUNICIPIO_CODIGO = "150140"
MUNICIPIO_NOME = "BELEM"

# Estrutura final baseada no CSV limpo fornecido como exemplo.
OUTPUT_COLUMNS = [
    "PA_CODUNI",
    "PA_CNPJMNT",
    "PA_PROC_ID",
    "PA_QTDPRO",
    "PA_QTDAPR",
    "PA_VALPRO",
    "PA_VALAPR",
]

CSV_SEPARATOR = ";"
CSV_ENCODING = "utf-8-sig"
DBF_ENCODING = "latin1"
CSV_LINE_TERMINATOR = "\n"

# Tamanho dos blocos na leitura do DBF. Mantem o uso de memoria controlado.
CHUNK_SIZE = 50_000

# Se True, o script para quando encontrar buraco na sequencia mensal.
# Exemplo: existe PAPA2601 e PAPA2603, mas falta PAPA2602.
FAIL_ON_MISSING_MONTHS = True

# Mantem a ordem original dos registros filtrados no DBF. Se quiser uma ordem
# fixa independente do arquivo de origem, altere para True.
SORT_OUTPUT_ROWS = False


# =============================================================================
# FIM DA CONFIGURACAO
# =============================================================================


@dataclass(frozen=True)
class RemoteFile:
    name: str
    month: int

    @property
    def stem(self) -> str:
        return Path(self.name).stem.upper()

    def to_dict(self) -> dict:
        return {"name": self.name, "month": self.month, "stem": self.stem}


ProgressCallback = Callable[[str, str], None]


def notify(progress_callback: ProgressCallback | None, event: str, message: str) -> None:
    if progress_callback:
        progress_callback(event, message)


def setup_logging() -> None:
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    log_file = WORK_DIR / "automacao_papa.log"
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s",
        handlers=[logging.FileHandler(log_file, encoding="utf-8"), logging.StreamHandler()],
    )


def connect_ftp() -> FTP:
    logging.info("Conectando ao FTP %s", FTP_HOST)
    ftp = FTP(FTP_HOST, timeout=60)
    ftp.login(user=FTP_USER, passwd=FTP_PASSWORD)
    ftp.cwd(FTP_DIR)
    return ftp


def list_papa_files(ftp: FTP) -> list[RemoteFile]:
    logging.info("Listando arquivos em %s", FTP_DIR)
    files: list[RemoteFile] = []
    for name in ftp.nlst():
        match = REMOTE_PATTERN.match(Path(name).name)
        if match:
            files.append(RemoteFile(name=Path(name).name, month=int(match.group("mes"))))

    files.sort(key=lambda item: item.month)
    if not files:
        raise RuntimeError("Nenhum arquivo PAPA26*.dbc encontrado no FTP.")

    validate_month_sequence(files)
    logging.info("Arquivos encontrados: %s", ", ".join(item.name for item in files))
    return files


def list_available_papa_files() -> list[RemoteFile]:
    setup_logging()
    with connect_ftp() as ftp:
        return list_papa_files(ftp)


def validate_month_sequence(files: list[RemoteFile]) -> None:
    months = [item.month for item in files]
    expected = list(range(min(months), max(months) + 1))
    missing = sorted(set(expected) - set(months))
    if missing:
        message = f"Faltam arquivos na sequencia mensal: {', '.join(f'PAPA26{m:02d}.dbc' for m in missing)}"
        if FAIL_ON_MISSING_MONTHS:
            raise RuntimeError(message)
        logging.warning(message)


def download_file(ftp: FTP, remote: RemoteFile, destination: Path) -> Path:
    destination.mkdir(parents=True, exist_ok=True)
    local_path = destination / remote.name

    if local_path.exists() and local_path.stat().st_size > 0:
        logging.info("DBC ja existe localmente, pulando download: %s", local_path)
        return local_path

    tmp_path = local_path.with_suffix(".dbc.download")
    logging.info("Baixando %s", remote.name)
    with tmp_path.open("wb") as file_handle:
        ftp.retrbinary(f"RETR {remote.name}", file_handle.write, blocksize=1024 * 512)

    tmp_path.replace(local_path)
    logging.info("Download concluido: %s (%s bytes)", local_path, local_path.stat().st_size)
    return local_path


def ensure_dbf(dbc_path: Path) -> Path:
    dbf_path = dbc_path.with_suffix(".dbf")
    if dbf_path.exists() and dbf_path.stat().st_size > 0:
        logging.info("DBF ja existe localmente, pulando conversao: %s", dbf_path)
        return dbf_path

    logging.info("Convertendo DBC para DBF: %s", dbc_path.name)
    try:
        result = convert_dbc_to_dbf(dbc_path, dbf_path)
    except ConversionError as exc:
        raise RuntimeError(f"Falha ao converter {dbc_path.name}: {exc}") from exc

    logging.info("Conversao concluida: %s (%s bytes)", result, result.stat().st_size)
    return result


def iter_chunks(records: Iterable[dict], chunk_size: int) -> Iterable[pd.DataFrame]:
    chunk: list[dict] = []
    for record in records:
        chunk.append(record)
        if len(chunk) >= chunk_size:
            yield pd.DataFrame.from_records(chunk)
            chunk.clear()
    if chunk:
        yield pd.DataFrame.from_records(chunk)


def clean_and_filter_chunk(df: pd.DataFrame) -> pd.DataFrame:
    required = [FILTER_COLUMN, *OUTPUT_COLUMNS]
    missing = [column for column in required if column not in df.columns]
    if missing:
        raise RuntimeError(f"Colunas ausentes no DBF: {', '.join(missing)}")

    df[FILTER_COLUMN] = df[FILTER_COLUMN].astype(str).str.strip()
    filtered = df.loc[df[FILTER_COLUMN] == MUNICIPIO_CODIGO, OUTPUT_COLUMNS].copy()

    if filtered.empty:
        return filtered

    text_columns = ["PA_CODUNI", "PA_CNPJMNT", "PA_PROC_ID"]
    for column in text_columns:
        filtered[column] = filtered[column].astype(str).str.strip()

    integer_columns = ["PA_QTDPRO", "PA_QTDAPR"]
    for column in integer_columns:
        filtered[column] = pd.to_numeric(filtered[column], errors="coerce").fillna(0).astype("int64")

    value_columns = ["PA_VALPRO", "PA_VALAPR"]
    for column in value_columns:
        filtered[column] = pd.to_numeric(filtered[column], errors="coerce").fillna(0).round(2)

    return filtered


def dbf_to_filtered_csv(dbf_path: Path, output_csv: Path) -> int:
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    temp_csv = output_csv.with_suffix(".csv.tmp")
    if temp_csv.exists():
        temp_csv.unlink()

    logging.info("Filtrando Belem e gerando CSV: %s", output_csv)
    dbf = DBF(dbf_path, encoding=DBF_ENCODING, load=False, char_decode_errors="ignore")

    total_rows = 0
    wrote_header = False
    buffered_frames: list[pd.DataFrame] = []
    for chunk_df in iter_chunks(dbf, CHUNK_SIZE):
        cleaned = clean_and_filter_chunk(chunk_df)
        if cleaned.empty:
            continue

        if SORT_OUTPUT_ROWS:
            buffered_frames.append(cleaned)
            total_rows += len(cleaned)
            continue

        cleaned.to_csv(
            temp_csv,
            mode="a",
            header=not wrote_header,
            index=False,
            sep=CSV_SEPARATOR,
            encoding=CSV_ENCODING,
            quoting=csv.QUOTE_MINIMAL,
            float_format="%.2f",
            lineterminator=CSV_LINE_TERMINATOR,
        )
        wrote_header = True
        total_rows += len(cleaned)

    if SORT_OUTPUT_ROWS and buffered_frames:
        sorted_df = pd.concat(buffered_frames, ignore_index=True).sort_values(OUTPUT_COLUMNS, kind="mergesort")
        sorted_df.to_csv(
            temp_csv,
            index=False,
            sep=CSV_SEPARATOR,
            encoding=CSV_ENCODING,
            quoting=csv.QUOTE_MINIMAL,
            float_format="%.2f",
            lineterminator=CSV_LINE_TERMINATOR,
        )
        wrote_header = True

    if not wrote_header:
        pd.DataFrame(columns=OUTPUT_COLUMNS).to_csv(
            temp_csv,
            index=False,
            sep=CSV_SEPARATOR,
            encoding=CSV_ENCODING,
            lineterminator=CSV_LINE_TERMINATOR,
        )

    temp_csv.replace(output_csv)
    logging.info("CSV gerado com %s linha(s): %s", total_rows, output_csv)
    return total_rows


def write_manifest(rows: list[dict], output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = output_dir / f"manifesto_papa_{datetime.now():%Y%m%d_%H%M%S}.csv"
    pd.DataFrame(rows).to_csv(manifest_path, index=False, sep=CSV_SEPARATOR, encoding=CSV_ENCODING)
    logging.info("Manifesto gerado: %s", manifest_path)
    return manifest_path


def process_files(
    selected_files: list[RemoteFile],
    output_dir: Path,
    progress_callback: ProgressCallback | None = None,
) -> list[dict]:
    setup_logging()
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    manifest_rows: list[dict] = []
    notify(progress_callback, "start", "Iniciando processamento PAPA DATASUS.")
    with connect_ftp() as ftp:
        notify(progress_callback, "ftp", f"Conectado ao FTP {FTP_HOST}.")
        notify(
            progress_callback,
            "files",
            "Arquivos selecionados: " + ", ".join(remote.name for remote in selected_files),
        )

        for remote in selected_files:
            notify(progress_callback, "download", f"Baixando {remote.name}.")
            dbc_path = download_file(ftp, remote, WORK_DIR)
            notify(progress_callback, "convert", f"Convertendo {remote.name} para DBF.")
            dbf_path = ensure_dbf(dbc_path)
            output_csv = output_dir / f"{MUNICIPIO_NOME}_{remote.stem}.csv"
            notify(progress_callback, "filter", f"Filtrando Belem e gerando {output_csv.name}.")
            rows = dbf_to_filtered_csv(dbf_path, output_csv)
            row = {
                "arquivo_origem": remote.name,
                "dbc_local": str(dbc_path),
                "dbf_local": str(dbf_path),
                "csv_destino": str(output_csv),
                "linhas_belem": rows,
                "status": "gerado",
                "processado_em": datetime.now().isoformat(timespec="seconds"),
            }
            manifest_rows.append(row)
            notify(progress_callback, "done_file", f"{output_csv.name} gerado com {rows} linha(s).")

    write_manifest(manifest_rows, output_dir)
    logging.info("Processamento finalizado. Arquivos processados: %s", len(manifest_rows))
    notify(progress_callback, "finish", f"Processamento finalizado: {len(manifest_rows)} arquivo(s).")
    return manifest_rows


def process_selected_months(
    months: list[int],
    output_dir: Path,
    progress_callback: ProgressCallback | None = None,
) -> list[dict]:
    available = list_available_papa_files()
    selected_months = set(months)
    selected_files = [remote for remote in available if remote.month in selected_months]

    missing = sorted(selected_months - {remote.month for remote in selected_files})
    if missing:
        raise RuntimeError(f"Mes(es) indisponivel(is) no DATASUS: {', '.join(f'{month:02d}' for month in missing)}")
    if not selected_files:
        raise RuntimeError("Selecione pelo menos um arquivo PAPA para processar.")

    return process_files(selected_files, output_dir, progress_callback)


def process_all(progress_callback: ProgressCallback | None = None) -> list[dict]:
    output_dir = WEB_OUTPUT_DIR / datetime.now().strftime("%Y%m%d_%H%M%S")
    available = list_available_papa_files()
    return process_files(available, output_dir, progress_callback)


def main() -> int:
    try:
        process_all()
    except Exception as exc:  # noqa: BLE001
        logging.exception("Processamento interrompido: %s", exc)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
