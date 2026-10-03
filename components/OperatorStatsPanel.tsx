"use client";
import { useState } from "react";
import type { OperatorStat } from "@/lib/operators";
type OperatorStatsPanelProps = {
    stats: OperatorStat[];
};
const minimumLevel = 1;
const maximumLevel = 100;
function clampLevel(level: number) {
    return Math.min(Math.max(level, minimumLevel), maximumLevel);
}
function getStatValue(stat: OperatorStat, level: number) {
    const internalValue = stat.baseValue + stat.perLevelValue * (level - minimumLevel);
    const percentValue = internalValue / 100;
    return `${percentValue.toLocaleString("ko-KR", {
        maximumFractionDigits: 2,
    })}%`;
}
export default function OperatorStatsPanel({ stats, }: OperatorStatsPanelProps) {
    const [level, setLevel] = useState(maximumLevel);
    function changeLevel(value: string) {
        const nextLevel = Number(value);
        if (!Number.isFinite(nextLevel)) {
            return;
        }
        setLevel(clampLevel(Math.round(nextLevel)));
    }
    return (<section className="rounded-md border border-[#343844] bg-[#171a21] p-5">
      <div className="border-b border-[#343844] pb-3">
        <h2 className="text-xl font-black text-white">
          <span className="mr-2 text-white">■</span>
          작전 능력
        </h2>

        <label className="mt-3 flex w-fit items-center gap-2 text-sm font-bold text-[#9ca3af]">
          <input type="number" min={minimumLevel} max={maximumLevel} value={level} onChange={(event) => changeLevel(event.target.value)} className="h-9 w-20 border border-[#4b5160] bg-[#0b0d12] px-2 text-center font-black text-white outline-none transition focus:border-[#9ca3af]" aria-label="작전 능력 기준 레벨"/>
          레벨 기준
        </label>
      </div>

      {stats.length > 0 ? (<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((stat) => (<div key={stat.label} className="border border-[#343844] bg-[#0b0d12] p-3">
              <p className="text-xs font-bold text-[#9ca3af]">{stat.label}</p>
              <p className="mt-1 text-lg font-black text-white">
                {getStatValue(stat, level)}
              </p>
            </div>))}
        </div>) : (<div className="mt-4 border border-[#343844] bg-[#0b0d12] px-4 py-8 text-center text-sm font-semibold text-[#9ca3af]">
          능력치 데이터가 없습니다.
        </div>)}
    </section>);
}
