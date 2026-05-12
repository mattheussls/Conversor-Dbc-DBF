import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertCircle,
  CheckCircle,
  CheckCircle2,
  CheckSquare,
  Database,
  Download,
  File,
  FileText,
  Loader2,
  Package,
  PlayCircle,
  RefreshCw,
  Upload,
  X,
  XSquare,
} from "lucide-react";
import "./styles.css";

type ManualStatus = "idle" | "ready" | "loading" | "success" | "error";
type AutomationStatus = "idle" | "running" | "success" | "error";

type AutomationEvent = {
  event: string;
  message: string;
  created_at: string;
};

type AutomationResult = {
  arquivo_origem: string;
  arquivo_csv: string;
  linhas_belem: number | "";
  status?: string;
  processado_em: string;
  download_url: string;
};

type PapaFile = {
  name: string;
  month: number;
  stem: string;
};

type AutomationJob = {
  status: AutomationStatus;
  started_at: string | null;
  finished_at: string | null;
  message: string;
  events: AutomationEvent[];
  results: AutomationResult[];
  zip_download_url: string | null;
};

const CONVERT_API_URL = "/api/convert";
const PAPA_FILES_URL = "/api/papa/files";
const AUTOMATION_START_URL = "/api/automation/start";
const AUTOMATION_STATUS_URL = "/api/automation/status";

const emptyJob: AutomationJob = {
  status: "idle",
  started_at: null,
  finished_at: null,
  message: "Automacao ainda nao iniciada.",
  events: [],
  results: [],
  zip_download_url: null,
};

const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function App() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [manualStatus, setManualStatus] = useState<ManualStatus>("idle");
  const [manualMessage, setManualMessage] = useState("Selecione um arquivo .dbc para iniciar.");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState<string>("");
  const [automation, setAutomation] = useState<AutomationJob>(emptyJob);
  const [papaFiles, setPapaFiles] = useState<PapaFile[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [filesMessage, setFilesMessage] = useState("Consultando arquivos disponiveis no DATASUS...");
  const [isConnected, setIsConnected] = useState(false);

  const automationRunning = automation.status === "running";
  const lastProcessedCount = automation.results.length > 0 ? Math.min(automation.results.length, 3) : 0;
  const totalCsvsGenerated = automation.results.length;
  const progressValue = automationRunning ? Math.min(92, Math.max(12, automation.events.length * 14)) : automation.status === "success" ? 100 : 0;

  const outputName = useMemo(() => {
    if (!file) return "";
    return file.name.replace(/\.dbc$/i, ".dbf");
  }, [file]);

  useEffect(() => {
    loadPapaFiles();
    refreshAutomationStatus();
  }, []);

  useEffect(() => {
    if (automation.status !== "running") return;
    const timer = window.setInterval(refreshAutomationStatus, 2500);
    return () => window.clearInterval(timer);
  }, [automation.status]);

  async function loadPapaFiles() {
    setFilesMessage("Consultando arquivos disponiveis no DATASUS...");
    try {
      const response = await fetch(PAPA_FILES_URL);
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.detail || "Nao foi possivel consultar os PAPA disponiveis.");
      }
      const files: PapaFile[] = await response.json();
      setPapaFiles(files);
      setSelectedMonths(files.map((item) => item.month));
      setIsConnected(true);
      setFilesMessage(files.length ? `${files.length} arquivo(s) disponivel(is).` : "Nenhum PAPA encontrado.");
    } catch (error) {
      setIsConnected(false);
      setFilesMessage(error instanceof Error ? error.message : "Erro ao consultar o DATASUS.");
    }
  }

  async function refreshAutomationStatus() {
    try {
      const response = await fetch(AUTOMATION_STATUS_URL);
      if (response.ok) setAutomation(await response.json());
    } catch {
      setAutomation((current) => ({
        ...current,
        status: "error",
        message: "Nao foi possivel consultar o status da automacao.",
      }));
    }
  }

  function toggleMonth(month: number) {
    setSelectedMonths((current) =>
      current.includes(month) ? current.filter((item) => item !== month) : [...current, month].sort((a, b) => a - b),
    );
  }

  async function startAutomation() {
    try {
      const response = await fetch(AUTOMATION_START_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ months: selectedMonths }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.detail || "Nao foi possivel iniciar a automacao.");
      }
      setAutomation(await response.json());
    } catch (error) {
      setAutomation((current) => ({
        ...current,
        status: "error",
        message: error instanceof Error ? error.message : "Erro inesperado ao iniciar a automacao.",
      }));
    }
  }

  function selectFile(selected: File | undefined) {
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith(".dbc")) {
      setManualStatus("error");
      setManualMessage("O arquivo precisa ter extensao .dbc.");
      setFile(null);
      return;
    }
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setFile(selected);
    setManualStatus("ready");
    setManualMessage("Arquivo pronto para conversao.");
    setDownloadUrl(null);
    setDownloadName("");
  }

  function resetManual() {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setFile(null);
    setManualStatus("idle");
    setManualMessage("Selecione um arquivo .dbc para iniciar.");
    setDownloadUrl(null);
    setDownloadName("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function convertManualFile() {
    if (!file || manualStatus === "loading") return;
    setManualStatus("loading");
    setManualMessage("Convertendo arquivo. Aguarde alguns instantes...");

    const data = new FormData();
    data.append("file", file);

    try {
      const response = await fetch(CONVERT_API_URL, { method: "POST", body: data });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.detail || "Nao foi possivel converter este arquivo.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setDownloadName(outputName);
      setManualStatus("success");
      setManualMessage("Conversao concluida. O DBF esta pronto para baixar.");
    } catch (error) {
      setManualStatus("error");
      setManualMessage(error instanceof Error ? error.message : "Erro inesperado na conversao.");
    }
  }

  return (
    <div className="app-page">
      <Header isConnected={isConnected} />

      <main className="app-main">
        <section className="metrics-grid" aria-label="Resumo">
          <MetricsCard title="Arquivos Disponiveis" value={papaFiles.length} icon={Database} color="#0D4D4D" />
          <MetricsCard title="Ultimos Processamentos" value={lastProcessedCount} icon={FileText} color="#1E40AF" />
          <MetricsCard title="Total de CSVs Gerados" value={totalCsvsGenerated} icon={CheckCircle} color="#16A34A" />
        </section>

        <section className="work-grid">
          <FileList
            files={papaFiles}
            selectedMonths={selectedMonths}
            onToggleMonth={toggleMonth}
            onSelectAll={() => setSelectedMonths(papaFiles.map((item) => item.month))}
            onClear={() => setSelectedMonths([])}
            onRefresh={loadPapaFiles}
            refreshing={filesMessage.startsWith("Consultando")}
          />

          <ProcessingPanel
            selectedCount={selectedMonths.length}
            status={automation.status}
            message={automation.message}
            progress={progressValue}
            events={automation.events}
            onProcess={startAutomation}
          />
        </section>

        <ResultsTable results={automation.results} zipDownloadUrl={automation.zip_download_url} />

        <FileUploader
          inputRef={inputRef}
          file={file}
          status={manualStatus}
          message={manualMessage}
          downloadUrl={downloadUrl}
          downloadName={downloadName}
          onFileSelect={selectFile}
          onConvert={convertManualFile}
          onRemove={resetManual}
        />
      </main>
    </div>
  );
}

function Header({ isConnected }: { isConnected: boolean }) {
  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="brand">
          <div className="brand-icon">
            <Activity size={28} strokeWidth={2.5} />
          </div>
          <div>
            <h1>Conversor DATASUS PAPA</h1>
            <p>Converta e trate arquivos PAPA do DATASUS para CSV</p>
          </div>
        </div>
        <div className="connection">
          <span>Status DATASUS</span>
          <strong className={isConnected ? "connected" : "disconnected"}>
            <i />
            {isConnected ? "Conectado" : "Desconectado"}
          </strong>
        </div>
      </div>
    </header>
  );
}

function MetricsCard({ title, value, icon: Icon, color }: { title: string; value: number | string; icon: React.ElementType; color: string }) {
  return (
    <article className="metric-card">
      <div className="metric-card-head">
        <p>{title}</p>
        <div className="metric-icon" style={{ backgroundColor: `${color}12` }}>
          <Icon size={24} color={color} strokeWidth={2.5} />
        </div>
      </div>
      <strong style={{ color }}>{value}</strong>
    </article>
  );
}

function FileList({
  files,
  selectedMonths,
  onToggleMonth,
  onSelectAll,
  onClear,
  onRefresh,
  refreshing,
}: {
  files: PapaFile[];
  selectedMonths: number[];
  onToggleMonth: (month: number) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <section className="card file-list-card">
      <div className="card-header file-list-header">
        <div>
          <h2>Arquivos Disponiveis</h2>
          <p>
            {selectedMonths.length} arquivo{selectedMonths.length !== 1 ? "s" : ""} selecionado{selectedMonths.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="toolbar">
          <button type="button" className="outline-button" onClick={onSelectAll}>
            <CheckSquare size={16} />
            Selecionar todos
          </button>
          <button type="button" className="outline-button" onClick={onClear}>
            <XSquare size={16} />
            Limpar selecao
          </button>
          <button type="button" className="outline-button" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? "spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="file-list">
        {files.map((file) => {
          const selected = selectedMonths.includes(file.month);
          return (
            <label className={`file-row ${selected ? "selected" : ""}`} key={file.name}>
              <span className="file-info">
                <input type="checkbox" checked={selected} onChange={() => onToggleMonth(file.month)} />
                <span>
                  <strong>{file.name}</strong>
                  <small>
                    {monthNames[file.month - 1] || `Mes ${file.month}`} 2026
                  </small>
                </span>
              </span>
              <span className="status-badge">Disponivel</span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

function ProcessingPanel({
  selectedCount,
  status,
  message,
  progress,
  events,
  onProcess,
}: {
  selectedCount: number;
  status: AutomationStatus;
  message: string;
  progress: number;
  events: AutomationEvent[];
  onProcess: () => void;
}) {
  const processing = status === "running";
  const success = status === "success";
  const error = status === "error";

  return (
    <section className="card processing-card">
      <div className="card-header">
        <h2>Processamento</h2>
      </div>

      <button className="generate-button" type="button" disabled={selectedCount === 0 || processing} onClick={onProcess}>
        {processing ? <Loader2 className="spin" size={22} /> : <PlayCircle size={22} />}
        {processing ? `Processando ${selectedCount} arquivo${selectedCount !== 1 ? "s" : ""}...` : `Gerar CSV${selectedCount > 0 ? ` (${selectedCount})` : ""}`}
      </button>

      {status === "idle" && selectedCount === 0 && (
        <div className="processing-empty">
          <div className="empty-icon">
            <PlayCircle size={28} />
          </div>
          <p>Selecione arquivos para iniciar o processamento</p>
          <div className="skeleton-lines">
            <span />
            <span />
            <span />
          </div>
        </div>
      )}

      {(processing || success || error) && (
        <div className="processing-state">
          <div className="progress-caption">
            <span>{error ? "Erro" : success ? "Concluido" : "Progresso"}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="progress-track">
            <i style={{ width: `${progress}%` }} />
          </div>

          <div className="timeline">
            {events.length === 0 ? (
              <TimelineItem message={message} state={processing ? "active" : error ? "error" : "pending"} />
            ) : (
              events.slice(-6).map((event, index) => (
                <TimelineItem
                  key={`${event.created_at}-${event.message}`}
                  message={event.message}
                  state={error && index === events.length - 1 ? "error" : index === events.slice(-6).length - 1 && processing ? "active" : "done"}
                />
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function TimelineItem({ message, state }: { message: string; state: "pending" | "active" | "done" | "error" }) {
  return (
    <div className={`timeline-item ${state}`}>
      {state === "done" && <CheckCircle2 size={20} />}
      {state === "active" && <Loader2 className="spin" size={20} />}
      {state === "error" && <AlertCircle size={20} />}
      {state === "pending" && <i />}
      <span>{message}</span>
    </div>
  );
}

function ResultsTable({ results, zipDownloadUrl }: { results: AutomationResult[]; zipDownloadUrl: string | null }) {
  if (results.length === 0) {
    return (
      <section className="card results-card">
        <div className="card-header">
          <h2>Resultados</h2>
        </div>
        <div className="results-empty">
          <div className="empty-icon">
            <FileText size={34} />
          </div>
          <h3>Nenhum resultado ainda</h3>
          <p>Selecione os arquivos do DATASUS e clique em "Gerar CSV" para comecar o processamento.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="card results-card">
      <div className="card-header results-header">
        <div>
          <h2>Resultados</h2>
          <p>
            {results.length} arquivo{results.length !== 1 ? "s" : ""} processado{results.length !== 1 ? "s" : ""}
          </p>
        </div>
        {zipDownloadUrl && (
          <a className="outline-button download-all" href={zipDownloadUrl}>
            <Package size={16} />
            Baixar todos em ZIP
          </a>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Arquivo de Origem</th>
              <th>CSV Gerado</th>
              <th className="right">Linhas</th>
              <th>Data/Hora</th>
              <th className="right">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr key={result.arquivo_origem}>
                <td>{result.arquivo_origem}</td>
                <td className="muted">{result.arquivo_csv}</td>
                <td className="right mono">{typeof result.linhas_belem === "number" ? result.linhas_belem.toLocaleString("pt-BR") : "-"}</td>
                <td className="muted">{formatDate(result.processado_em)}</td>
                <td className="right">
                  <a className="download-csv" href={result.download_url}>
                    <Download size={16} />
                    Baixar CSV
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FileUploader({
  inputRef,
  file,
  status,
  message,
  downloadUrl,
  downloadName,
  onFileSelect,
  onConvert,
  onRemove,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  file: File | null;
  status: ManualStatus;
  message: string;
  downloadUrl: string | null;
  downloadName: string;
  onFileSelect: (file: File | undefined) => void;
  onConvert: () => void;
  onRemove: () => void;
}) {
  return (
    <section className="card uploader-card">
      <div className="card-header uploader-header">
        <h2>Conversao Manual</h2>
        <p>Envie um arquivo .dbc local para conversao em DBF</p>
      </div>

      {!file ? (
        <label
          className="upload-zone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            onFileSelect(event.dataTransfer.files[0]);
          }}
        >
          <input ref={inputRef} type="file" accept=".dbc" onChange={(event) => onFileSelect(event.target.files?.[0])} />
          <span className="upload-icon">
            <Upload size={30} />
          </span>
          <strong>Arraste um arquivo .dbc aqui</strong>
          <small>ou clique para selecionar</small>
        </label>
      ) : (
        <div className="manual-selected">
          <div className="selected-file">
            <span className="selected-file-icon">
              <File size={22} />
            </span>
            <span>
              <strong>{file.name}</strong>
              <small>{formatBytes(file.size)}</small>
            </span>
            <button type="button" onClick={onRemove} aria-label="Remover arquivo">
              <X size={18} />
            </button>
          </div>

          <p className={`manual-message ${status}`}>{message}</p>

          {downloadUrl ? (
            <a className="manual-action success" href={downloadUrl} download={downloadName}>
              <Download size={18} />
              Baixar DBF
            </a>
          ) : (
            <button className="manual-action" type="button" disabled={status === "loading"} onClick={onConvert}>
              {status === "loading" && <Loader2 className="spin" size={18} />}
              {status === "loading" ? "Convertendo..." : "Converter para DBF"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
