import { Card, CardContent } from "./ui/card";
import { LucideIcon } from "lucide-react";

interface MetricsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
}

export function MetricsCard({ title, value, icon: Icon, color }: MetricsCardProps) {
  return (
    <Card className="border-[#E5E7EB] shadow-sm hover:shadow-md transition-all duration-200 hover:border-[#D1D5DB]">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <p className="text-[13px] font-medium text-[#6B7280] uppercase tracking-wide">
            {title}
          </p>
          <div className="p-2.5 rounded-lg" style={{ backgroundColor: `${color}12` }}>
            <Icon className="w-5 h-5" style={{ color }} strokeWidth={2.5} />
          </div>
        </div>
        <div className="mt-2">
          <p className="text-[42px] font-semibold leading-none tracking-tight" style={{ color }}>
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
