import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Upload, File, Download, X } from "lucide-react";
import { useState } from "react";

export function FileUploader() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [converting, setConverting] = useState(false);
  const [converted, setConverted] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.dbc')) {
      setUploadedFile(file);
      setConverted(false);
    }
  };

  const handleConvert = () => {
    setConverting(true);
    setTimeout(() => {
      setConverting(false);
      setConverted(true);
    }, 2000);
  };

  const handleDownload = () => {
    console.log("Downloading DBF file");
  };

  const handleRemove = () => {
    setUploadedFile(null);
    setConverted(false);
  };

  return (
    <Card className="border-[#E5E7EB] shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-[18px] font-semibold text-[#111827]">Conversão Manual</CardTitle>
        <p className="text-[13px] text-[#6B7280] mt-1.5">
          Envie um arquivo .dbc local para conversão em DBF
        </p>
      </CardHeader>
      <CardContent>
        {!uploadedFile ? (
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#D1D5DB] rounded-lg p-12 cursor-pointer hover:bg-[#F9FAFB] hover:border-[#9CA3AF] transition-all duration-200">
            <input
              type="file"
              className="hidden"
              accept=".dbc"
              onChange={handleFileSelect}
            />
            <div className="p-3.5 bg-[#0D4D4D]/8 rounded-xl mb-4">
              <Upload className="w-7 h-7 text-[#0D4D4D]" strokeWidth={2.5} />
            </div>
            <p className="font-semibold text-[14px] text-[#111827] mb-1">Arraste um arquivo .dbc aqui</p>
            <p className="text-[13px] text-[#6B7280]">ou clique para selecionar</p>
          </label>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-[#E5E7EB] rounded-lg bg-[#F9FAFB] shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white rounded-lg border border-[#E5E7EB]">
                  <File className="w-5 h-5 text-[#0D4D4D]" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="font-semibold text-[14px] text-[#111827]">{uploadedFile.name}</p>
                  <p className="text-[13px] text-[#6B7280] mt-0.5">
                    {(uploadedFile.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleRemove} className="hover:bg-white">
                <X className="w-4 h-4" strokeWidth={2.5} />
              </Button>
            </div>

            {!converted ? (
              <Button
                onClick={handleConvert}
                disabled={converting}
                className="w-full bg-[#0D4D4D] hover:bg-[#1F2937] h-11 shadow-md hover:shadow-lg transition-all duration-200 font-semibold text-[14px]"
              >
                {converting ? "Convertendo..." : "Converter para DBF"}
              </Button>
            ) : (
              <Button
                onClick={handleDownload}
                className="w-full bg-[#16A34A] hover:bg-[#15803D] h-11 shadow-md hover:shadow-lg transition-all duration-200 font-semibold text-[14px]"
              >
                <Download className="w-4 h-4 mr-2" strokeWidth={2.5} />
                Baixar DBF
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
