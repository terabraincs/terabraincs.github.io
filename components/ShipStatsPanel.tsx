"use client";
import { useEffect, useRef, useState } from "react";
import { getShipStatValue } from "@/lib/shipStats";
import type { ShipLimitBreakLevel, ShipStage, ShipStat } from "@/lib/ships";
import styles from "./ShipStatsPanel.module.css";
type ShipStatsPanelProps = {
    stats: ShipStat[];
    stages: ShipStage[];
    maxLevel: number;
    limitBreakLevels: ShipLimitBreakLevel[];
};
const minimumLevel = 1;
function clamp(value: number, minimum: number, maximum: number) {
    return Math.min(Math.max(Math.round(value), minimum), maximum);
}
function getSliderMarkerPosition(value: number, minimum: number, maximum: number) {
    const ratio = (value - minimum) / (maximum - minimum);
    const pixelOffset = 10 - ratio * 20;
    return `calc(${ratio * 100}% ${pixelOffset >= 0 ? "+" : "-"} ${Math.abs(pixelOffset)}px)`;
}
export default function ShipStatsPanel({ stats, stages, maxLevel, limitBreakLevels, }: ShipStatsPanelProps) {
    const sortedStages = [...stages].sort((first, second) => first.stage - second.stage);
    const minimumStage = sortedStages[0]?.stage ?? 1;
    const maximumStage = sortedStages.at(-1)?.stage ?? 1;
    const defaultLevel = Math.min(100, maxLevel);
    const maximumLimitBreakGrade = Math.max(0, ...limitBreakLevels.map((item) => item.grade));
    const [level, setLevel] = useState(defaultLevel);
    const [stage, setStage] = useState(maximumStage);
    const [limitBreakGrade, setLimitBreakGrade] = useState(0);
    const [isConditionOpen, setIsConditionOpen] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);
    const baseMaximumLevel = Number(sortedStages.find((item) => item.stage === stage)?.maxLevel) || maxLevel;
    const maximumLevel = limitBreakLevels.find((item) => item.grade === limitBreakGrade)?.maxLevel ??
        baseMaximumLevel;
    useEffect(() => {
        if (!isConditionOpen) {
            return;
        }
        const previousFocus = document.activeElement as HTMLElement | null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        dialogRef.current?.querySelector<HTMLInputElement>('input[type="number"]')?.focus();
        return () => {
            document.body.style.overflow = previousOverflow;
            previousFocus?.focus();
        };
    }, [isConditionOpen]);
    function changeLevel(value: string) {
        const nextLevel = Number(value);
        if (Number.isFinite(nextLevel)) {
            setLevel(clamp(nextLevel, minimumLevel, maximumLevel));
        }
    }
    function changeStage(value: string) {
        const nextStage = Number(value);
        if (!Number.isFinite(nextStage)) {
            return;
        }
        const nextStageInfo = sortedStages.find((item) => item.stage === clamp(nextStage, minimumStage, maximumStage));
        if (!nextStageInfo) {
            return;
        }
        setStage(nextStageInfo.stage);
        if (nextStageInfo.stage < maximumStage) {
            setLimitBreakGrade(0);
            setLevel((currentLevel) => clamp(currentLevel, minimumLevel, Number(nextStageInfo.maxLevel) || maxLevel));
        }
    }
    function changeLimitBreak(value: string) {
        const nextGradeValue = Number(value);
        if (!Number.isFinite(nextGradeValue)) {
            return;
        }
        const nextGrade = clamp(nextGradeValue, 0, maximumLimitBreakGrade);
        const nextMaximumLevel = limitBreakLevels.find((item) => item.grade === nextGrade)?.maxLevel ??
            baseMaximumLevel;
        setLimitBreakGrade(nextGrade);
        if (nextGrade > 0) {
            setStage(maximumStage);
        }
        setLevel((currentLevel) => clamp(currentLevel, minimumLevel, nextMaximumLevel));
    }
    function resetConditions() {
        setStage(maximumStage);
        setLimitBreakGrade(0);
        setLevel(defaultLevel);
    }
    return (<section id="ship-stats" className="rounded-md border border-[#343844] bg-[#171a21] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#343844] pb-3">
        <h2 className="text-xl font-black text-white">
          <span className="mr-2 text-white">■</span>
          작전 능력
        </h2>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-x-4 gap-y-3">
          <p className="text-sm font-bold text-[#9ca3af]" aria-label="현재 함선 능력치 조건">
            개장 {stage}단계 · 이식 개장 {limitBreakGrade}단계 · {level}레벨
          </p>
          <button type="button" onClick={() => setIsConditionOpen(true)} className="min-h-11 border border-[#5b6270] bg-[#222631] px-5 py-2 text-sm font-black text-[#e5e7eb] transition hover:border-[#9ca3af] hover:bg-[#2d333d] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#6b7280]">
            조건 설정
          </button>
        </div>
      </div>

      {isConditionOpen ? (<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="ship-stat-condition-title" onKeyDown={(event) => {
                if (event.key === "Escape") {
                    setIsConditionOpen(false);
                }
                if (event.key === "Tab") {
                    const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button, input:not(:disabled)');
                    const first = controls?.[0];
                    const last = controls?.[controls.length - 1];
                    if (event.shiftKey && document.activeElement === first) {
                        event.preventDefault();
                        last?.focus();
                    }
                    else if (!event.shiftKey && document.activeElement === last) {
                        event.preventDefault();
                        first?.focus();
                    }
                }
            }}>
          <div ref={dialogRef} className={`${styles.conditionPanel} max-h-[90vh] w-full max-w-xl overflow-y-auto border border-[#4b5563] bg-[linear-gradient(90deg,#151515_0%,#303030_100%)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.6)]`}>
            <div className="flex items-center justify-between gap-4 border-b border-[#4b5563] pb-4">
              <h3 id="ship-stat-condition-title" className="text-2xl font-black text-[#e5e7eb]">
                능력치 조건
              </h3>
              <button type="button" onClick={() => setIsConditionOpen(false)} className="border border-[#4b5563] px-3 py-1 text-sm font-bold text-[#9ca3af] transition hover:border-[#9ca3af] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#6b7280]">
                닫기
              </button>
            </div>

            <div className="mt-5 space-y-6">
              <section>
                <div className="mb-3 flex items-center justify-between gap-4">
                  <h4 className="flex items-center gap-2 text-base font-black text-[#e5e7eb]">
                    <span className="h-4 w-[5px] bg-white shadow-[0_0_10px_rgba(255,255,255,0.75)]"/>
                    레벨
                  </h4>
                  <label className="flex items-center gap-2 text-sm font-bold text-[#9ca3af]">
                    <input type="number" min={minimumLevel} max={maximumLevel} value={level} onChange={(event) => changeLevel(event.target.value)} className="h-10 w-20 border border-[#4b5563] bg-[#111318] px-2 text-center font-black text-white outline-none transition focus:border-[#9ca3af]" aria-label="함선 능력치 기준 레벨"/>
                    레벨
                  </label>
                </div>
                <div className="relative py-2">
                  <input type="range" min={minimumLevel} max={maximumLevel} value={level} onChange={(event) => changeLevel(event.target.value)} className={`${styles.slider} block w-full`} aria-label="함선 능력치 기준 레벨 슬라이더"/>
                  {maximumLevel > 100 ? (<div className="pointer-events-none absolute top-1/2 z-10 h-5 w-[3px] -translate-x-1/2 -translate-y-1/2 bg-[#e5e7eb] shadow-[0_0_6px_rgba(229,231,235,0.65)]" style={{ left: getSliderMarkerPosition(100, minimumLevel, maximumLevel) }}/>) : null}
                </div>
                <div className="mt-2 flex justify-between text-xs font-bold text-[#9ca3af]">
                  <span>{minimumLevel}</span>
                  <span>{maximumLevel}</span>
                </div>
              </section>

              <section className="border-t border-[#4b5563] pt-5">
                <h4 className="mb-3 flex items-center gap-2 text-base font-black text-[#e5e7eb]">
                  <span className="h-4 w-[5px] bg-white shadow-[0_0_10px_rgba(255,255,255,0.75)]"/>
                  개장 조건
                </h4>
                <div className="grid border border-[#4b5563] bg-[#111318] sm:grid-cols-2">
                  <div className="border-b border-[#4b5563] p-4 sm:border-r sm:border-b-0">
                    <StageControl label="개장" minimum={minimumStage} maximum={maximumStage} value={stage} onChange={changeStage}/>
                  </div>
                  <div className="p-4">
                    <StageControl label="이식 개장" minimum={0} maximum={maximumLimitBreakGrade} value={limitBreakGrade} onChange={changeLimitBreak} disabled={maximumLimitBreakGrade === 0}/>
                    {maximumLimitBreakGrade === 0 ? (<p className="mt-3 text-xs font-bold text-[#9ca3af]">이식 개장 불가</p>) : null}
                  </div>
                </div>
              </section>
            </div>

            <div className="mt-6 flex flex-col gap-2 border-t border-[#4b5563] pt-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={resetConditions} className="min-h-12 min-w-28 border border-[#5b6270] bg-[#181b22] px-6 py-3 text-base font-black text-[#d1d5db] transition hover:border-[#9ca3af] hover:bg-[#222631] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#6b7280]">
                초기화
              </button>
              <button type="button" onClick={() => setIsConditionOpen(false)} className="min-h-12 min-w-28 border border-[#6b7280] bg-[#2d333d] px-6 py-3 text-base font-black text-white transition hover:border-[#d1d5db] hover:bg-[#3f4754] focus:outline-none focus:ring-2 focus:ring-[#9ca3af]">
                확인
              </button>
            </div>
          </div>
        </div>) : null}

      {stats.length > 0 ? (<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" data-ship-stat-values>
          {stats.map((stat) => (<div key={stat.label} className="border border-[#343844] bg-[#0b0d12] p-3">
              <p className="text-xs font-bold text-[#9ca3af]">{stat.label}</p>
              <p className="mt-1 text-lg font-black text-white">
                {getShipStatValue(stat, level, limitBreakGrade).toLocaleString("ko-KR")}
              </p>
            </div>))}
        </div>) : (<div className="mt-4 border border-[#343844] bg-[#0b0d12] px-4 py-8 text-center text-sm font-semibold text-[#9ca3af]">
          능력치 데이터가 없습니다.
        </div>)}
    </section>);
}
function StageControl({ label, minimum, maximum, value, onChange, disabled = false, }: {
    label: string;
    minimum: number;
    maximum: number;
    value: number;
    onChange: (value: string) => void;
    disabled?: boolean;
}) {
    return (<div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="whitespace-nowrap font-black text-[#d1d5db]">{label}</span>
        <label className="flex items-center gap-2 text-sm font-bold text-[#9ca3af]">
          <input type="number" min={minimum} max={maximum} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="h-10 w-16 border border-[#4b5563] bg-[#181b22] px-2 text-center font-black text-white outline-none transition focus:border-[#9ca3af] disabled:opacity-50" aria-label={`함선 ${label} 단계`}/>
          단계
        </label>
      </div>
      <input type="range" min={minimum} max={maximum} step={1} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className={`${styles.slider} w-full disabled:opacity-50`} aria-label={`함선 ${label} 단계 슬라이더`}/>
      <div className="mt-2 flex justify-between text-xs font-bold text-[#9ca3af]">
        <span>{minimum}단계</span>
        <span>{maximum}단계</span>
      </div>
    </div>);
}
