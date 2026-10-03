"use client";
import { useState } from "react";
type EquipmentMainStatPanelProps = {
    label: string;
    values: string[];
};
export default function EquipmentMainStatPanel({ label, values, }: EquipmentMainStatPanelProps) {
    const maximumEnhanceLevel = Math.max(values.length - 1, 0);
    const [enhanceLevel, setEnhanceLevel] = useState(maximumEnhanceLevel);
    function changeEnhanceLevel(value: string) {
        const nextLevel = Number(value);
        if (!Number.isFinite(nextLevel)) {
            return;
        }
        setEnhanceLevel(Math.min(Math.max(Math.round(nextLevel), 0), maximumEnhanceLevel));
    }
    return (<div className="mt-4 border border-[#343844] bg-[#171a21] px-4 py-4">
      <div className="flex min-h-9 items-center justify-between gap-4">
        <span className="font-black text-white">{label}</span>
        <span className="text-xl font-black text-white">
          {values[enhanceLevel] ?? "-"}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4 border-t border-[#343844] pt-4">
        <span className="text-sm font-bold text-[#9ca3af]">강화 단계</span>
        <label className="flex items-center gap-2 text-sm font-bold text-[#9ca3af]">
          <input type="number" min={0} max={maximumEnhanceLevel} value={enhanceLevel} onChange={(event) => changeEnhanceLevel(event.target.value)} className="h-9 w-16 border border-[#4b5563] bg-[#0b0d12] px-2 text-center font-black text-white outline-none transition focus:border-white" aria-label="장비 주 능력치 강화 단계"/>
          강 기준
        </label>
      </div>
    </div>);
}
