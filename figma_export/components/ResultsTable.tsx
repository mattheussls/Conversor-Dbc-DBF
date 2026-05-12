import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Download, Package, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProcessedFile {
  id: string;
  sourceFile: string;
  csvFile: string;
  rows: number;
  timestamp: Date;
}

interface ResultsTableProps {
  results: ProcessedFile[];
}

export function ResultsTable({ results }: ResultsTableProps) {
  const handleDownload = (filename: string) => {
    console.log(`Downloading ${filename}`);
  };

  const handleDownloadAll = () => {
    console.log("Downloading all files as ZIP");
  };

  if (results.length === 0) {
    return (
      <Card className="border-[#E5E7EB] shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-[18px] font-semibold text-[#111827]">Resultados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] mb-4">
              <FileText className="w-8 h-8 text-[#9CA3AF]" strokeWidth={2} />
            </div>
            <h3 className="text-[15px] font-semibold text-[#111827] mb-2">Nenhum resultado ainda</h3>
            <p className="text-[13px] text-[#6B7280] max-w-md leading-relaxed">
              Selecione os arquivos do DATASUS e clique em "Gerar CSV" para começar o processamento.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#E5E7EB] shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-[18px] font-semibold text-[#111827]">Resultados</CardTitle>
            <p className="text-[13px] text-[#6B7280] mt-1.5 font-medium">
              {results.length} arquivo{results.length !== 1 ? 's' : ''} processado{results.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button
            onClick={handleDownloadAll}
            variant="outline"
            className="text-[13px] font-medium border-[#E5E7EB] hover:bg-[#F9FAFB] hover:border-[#D1D5DB] shadow-sm"
          >
            <Package className="w-3.5 h-3.5 mr-1.5" strokeWidth={2.5} />
            Baixar todos em ZIP
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F9FAFB] hover:bg-[#F9FAFB] border-b border-[#E5E7EB]">
                <TableHead className="text-[12px] font-semibold text-[#6B7280] uppercase tracking-wide">Arquivo de Origem</TableHead>
                <TableHead className="text-[12px] font-semibold text-[#6B7280] uppercase tracking-wide">CSV Gerado</TableHead>
                <TableHead className="text-right text-[12px] font-semibold text-[#6B7280] uppercase tracking-wide">Linhas</TableHead>
                <TableHead className="text-[12px] font-semibold text-[#6B7280] uppercase tracking-wide">Data/Hora</TableHead>
                <TableHead className="text-right text-[12px] font-semibold text-[#6B7280] uppercase tracking-wide">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((result) => (
                <TableRow key={result.id} className="hover:bg-[#F9FAFB] transition-colors border-b border-[#F3F4F6] last:border-0">
                  <TableCell className="font-semibold text-[14px] text-[#111827]">{result.sourceFile}</TableCell>
                  <TableCell className="text-[13px] text-[#6B7280] font-medium">{result.csvFile}</TableCell>
                  <TableCell className="text-right font-mono text-[14px] font-semibold text-[#111827]">{result.rows.toLocaleString('pt-BR')}</TableCell>
                  <TableCell className="text-[13px] text-[#6B7280]">
                    {format(result.timestamp, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      onClick={() => handleDownload(result.csvFile)}
                      className="bg-[#16A34A] hover:bg-[#15803D] shadow-sm hover:shadow-md transition-all duration-150 text-[13px] font-semibold h-8"
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5" strokeWidth={2.5} />
                      Baixar CSV
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
