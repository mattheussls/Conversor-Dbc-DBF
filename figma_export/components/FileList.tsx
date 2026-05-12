import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Badge } from "./ui/badge";
import { RefreshCw, CheckSquare, XSquare } from "lucide-react";
import { useState } from "react";

interface DatasusFile {
  id: string;
  filename: string;
  month: string;
  year: string;
  status: "available" | "processing" | "completed";
}

interface FileListProps {
  onSelectionChange: (selectedFiles: string[]) => void;
  selectedFiles: string[];
}

const MOCK_FILES: DatasusFile[] = [
  { id: "1", filename: "PAPA2601.dbc", month: "Janeiro", year: "2026", status: "available" },
  { id: "2", filename: "PAPA2602.dbc", month: "Fevereiro", year: "2026", status: "available" },
  { id: "3", filename: "PAPA2603.dbc", month: "Março", year: "2026", status: "available" },
  { id: "4", filename: "PAPA2604.dbc", month: "Abril", year: "2026", status: "available" },
  { id: "5", filename: "PAPA2605.dbc", month: "Maio", year: "2026", status: "available" },
];

export function FileList({ onSelectionChange, selectedFiles }: FileListProps) {
  const [files] = useState<DatasusFile[]>(MOCK_FILES);
  const [refreshing, setRefreshing] = useState(false);

  const handleSelectAll = () => {
    onSelectionChange(files.map(f => f.id));
  };

  const handleClearSelection = () => {
    onSelectionChange([]);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const toggleFile = (fileId: string) => {
    if (selectedFiles.includes(fileId)) {
      onSelectionChange(selectedFiles.filter(id => id !== fileId));
    } else {
      onSelectionChange([...selectedFiles, fileId]);
    }
  };

  const getStatusBadge = (status: DatasusFile["status"]) => {
    const variants = {
      available: { label: "Disponível", className: "bg-[#16A34A] hover:bg-[#16A34A] text-white shadow-sm" },
      processing: { label: "Processando", className: "bg-[#0D4D4D] hover:bg-[#0D4D4D] text-white shadow-sm" },
      completed: { label: "Concluído", className: "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#F3F4F6] border border-[#E5E7EB]" },
    };
    const variant = variants[status];
    return <Badge className={`${variant.className} px-3 py-1 text-[12px] font-semibold`}>{variant.label}</Badge>;
  };

  return (
    <Card className="border-[#E5E7EB] shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-[18px] font-semibold text-[#111827]">Arquivos Disponíveis</CardTitle>
            <p className="text-[13px] text-[#6B7280] mt-1.5 font-medium">
              {selectedFiles.length} arquivo{selectedFiles.length !== 1 ? 's' : ''} selecionado{selectedFiles.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSelectAll} className="text-[13px] font-medium border-[#E5E7EB] hover:bg-[#F9FAFB] hover:border-[#D1D5DB]">
              <CheckSquare className="w-3.5 h-3.5 mr-1.5" strokeWidth={2.5} />
              Selecionar todos
            </Button>
            <Button variant="outline" size="sm" onClick={handleClearSelection} className="text-[13px] font-medium border-[#E5E7EB] hover:bg-[#F9FAFB] hover:border-[#D1D5DB]">
              <XSquare className="w-3.5 h-3.5 mr-1.5" strokeWidth={2.5} />
              Limpar seleção
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="text-[13px] font-medium border-[#E5E7EB] hover:bg-[#F9FAFB] hover:border-[#D1D5DB]">
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} strokeWidth={2.5} />
              Atualizar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className={`flex items-center justify-between px-4 py-3.5 border rounded-lg transition-all duration-150 cursor-pointer ${
                selectedFiles.includes(file.id)
                  ? 'bg-[#16A34A]/5 border-[#16A34A]/30 hover:border-[#16A34A]/50 shadow-sm'
                  : 'border-[#E5E7EB] hover:bg-[#F9FAFB] hover:border-[#D1D5DB] hover:shadow-sm'
              }`}
              onClick={() => toggleFile(file.id)}
            >
              <div className="flex items-center gap-3.5">
                <Checkbox
                  checked={selectedFiles.includes(file.id)}
                  onCheckedChange={() => toggleFile(file.id)}
                  className="data-[state=checked]:bg-[#16A34A] data-[state=checked]:border-[#16A34A]"
                />
                <div>
                  <p className="font-semibold text-[14px] text-[#111827]">{file.filename}</p>
                  <p className="text-[13px] text-[#6B7280] mt-0.5">
                    {file.month} {file.year}
                  </p>
                </div>
              </div>
              {getStatusBadge(file.status)}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
