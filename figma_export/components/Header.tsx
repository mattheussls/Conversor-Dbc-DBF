import { Activity } from "lucide-react";
import { Badge } from "./ui/badge";

interface HeaderProps {
  isConnected: boolean;
}

export function Header({ isConnected }: HeaderProps) {
  return (
    <div className="border-b bg-white px-6 py-6 shadow-sm">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#0D4D4D]/8">
              <Activity className="w-6 h-6 text-[#0D4D4D]" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-[22px] font-semibold text-[#0D4D4D] leading-none mb-1.5">
                Conversor DATASUS PAPA
              </h1>
              <p className="text-[13px] text-[#6B7280] leading-none">
                Converta e trate arquivos PAPA do DATASUS para CSV
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-[13px] font-medium text-[#6B7280]">Status DATASUS</span>
            <Badge
              variant={isConnected ? "default" : "destructive"}
              className={`${isConnected ? "bg-[#16A34A] hover:bg-[#16A34A] shadow-sm" : ""} px-3 py-1 font-medium`}
            >
              <div className={`w-1.5 h-1.5 rounded-full mr-2 ${isConnected ? "bg-white" : ""}`} />
              {isConnected ? "Conectado" : "Desconectado"}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
