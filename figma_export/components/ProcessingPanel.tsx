import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Alert, AlertDescription } from "./ui/alert";
import { Download, CheckCircle2, AlertCircle, Loader2, PlayCircle } from "lucide-react";
import { useState } from "react";

interface ProcessingPanelProps {
  selectedCount: number;
  onProcess: () => void;
}

type ProcessingStatus = "idle" | "processing" | "success" | "error";

interface ProcessingStep {
  id: number;
  message: string;
  status: "pending" | "active" | "completed" | "error";
}

export function ProcessingPanel({ selectedCount, onProcess }: ProcessingPanelProps) {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [steps, setSteps] = useState<ProcessingStep[]>([]);

  const handleProcess = () => {
    if (selectedCount === 0) return;

    setStatus("processing");
    setProgress(0);

    const processingSteps: ProcessingStep[] = [
      { id: 1, message: "Conectando ao DATASUS", status: "pending" },
      { id: 2, message: "Baixando PAPA2601.dbc", status: "pending" },
      { id: 3, message: "Convertendo DBC para DBF", status: "pending" },
      { id: 4, message: "Filtrando dados de Belém", status: "pending" },
      { id: 5, message: "CSV pronto para download", status: "pending" },
    ];

    setSteps(processingSteps);

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;

      if (currentStep <= processingSteps.length) {
        setSteps(prev => prev.map((step, idx) => ({
          ...step,
          status: idx < currentStep - 1 ? "completed" : idx === currentStep - 1 ? "active" : "pending"
        })));
        setProgress((currentStep / processingSteps.length) * 100);
      }

      if (currentStep > processingSteps.length) {
        clearInterval(interval);
        setSteps(prev => prev.map(step => ({ ...step, status: "completed" })));
        setStatus("success");
        setProgress(100);
        onProcess();
      }
    }, 1200);
  };

  const getStepIcon = (stepStatus: ProcessingStep["status"]) => {
    switch (stepStatus) {
      case "completed":
        return <CheckCircle2 className="w-5 h-5 text-[#16A34A]" strokeWidth={2.5} />;
      case "active":
        return <Loader2 className="w-5 h-5 text-[#0D4D4D] animate-spin" strokeWidth={2.5} />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-destructive" strokeWidth={2.5} />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-[#D1D5DB]" />;
    }
  };

  return (
    <Card className="border-[#E5E7EB] shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-[18px] font-semibold text-[#111827]">Processamento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={handleProcess}
          disabled={selectedCount === 0 || status === "processing"}
          className="w-full bg-[#16A34A] hover:bg-[#15803D] h-12 shadow-md hover:shadow-lg transition-all duration-200 font-semibold text-[15px] disabled:bg-[#D1D5DB] disabled:text-[#9CA3AF] disabled:shadow-none"
          size="lg"
        >
          {status === "processing" ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" strokeWidth={2.5} />
              Processando {selectedCount} arquivo{selectedCount !== 1 ? 's' : ''}...
            </>
          ) : (
            <>
              <PlayCircle className="w-5 h-5 mr-2" strokeWidth={2.5} />
              Gerar CSV {selectedCount > 0 ? `(${selectedCount})` : ''}
            </>
          )}
        </Button>

        {status === "idle" && selectedCount === 0 && (
          <div className="p-6 bg-[#F9FAFB] rounded-lg border border-dashed border-[#D1D5DB]">
            <div className="text-center space-y-2">
              <div className="flex justify-center mb-3">
                <div className="p-2.5 bg-white rounded-lg border border-[#E5E7EB]">
                  <PlayCircle className="w-6 h-6 text-[#9CA3AF]" strokeWidth={2} />
                </div>
              </div>
              <p className="text-[13px] font-medium text-[#6B7280]">
                Selecione arquivos para iniciar o processamento
              </p>
              <div className="pt-2 space-y-1.5 opacity-60">
                <div className="h-1.5 bg-[#E5E7EB] rounded-full w-full" />
                <div className="h-1.5 bg-[#E5E7EB] rounded-full w-4/5 mx-auto" />
                <div className="h-1.5 bg-[#E5E7EB] rounded-full w-3/5 mx-auto" />
              </div>
            </div>
          </div>
        )}

        {status === "processing" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-[13px] font-medium text-[#6B7280] mb-1.5">
                <span>Progresso</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <div className="space-y-2.5 p-4 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
              {steps.map((step) => (
                <div key={step.id} className="flex items-center gap-3">
                  {getStepIcon(step.status)}
                  <span className={`text-[13px] ${step.status === "active" ? "font-semibold text-[#111827]" : "text-[#6B7280]"}`}>
                    {step.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {status === "success" && (
          <Alert className="bg-[#16A34A]/10 border-[#16A34A]/30 shadow-sm">
            <CheckCircle2 className="h-4 w-4 text-[#16A34A]" strokeWidth={2.5} />
            <AlertDescription className="text-[#15803D] text-[13px] font-medium">
              Processamento concluído com sucesso! Os arquivos CSV estão prontos para download.
            </AlertDescription>
          </Alert>
        )}

        {status === "error" && (
          <Alert variant="destructive" className="shadow-sm">
            <AlertCircle className="h-4 w-4" strokeWidth={2.5} />
            <AlertDescription className="text-[13px] font-medium">
              Erro ao processar os arquivos. Verifique a conexão e tente novamente.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
