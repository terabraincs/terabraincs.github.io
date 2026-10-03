"use client";
import { deploymentUrl } from "@/lib/deployment";
import { useState } from "react";
import Image from "@/components/DeploymentImage";
import type { ShipSkillStage } from "@/lib/ships";
type ShipSkillPanelProps = {
    skillStages: ShipSkillStage[];
};
const skillTimeIconPath = deploymentUrl("/ui/AB_UI_NKM_UI_LEADER_BOARD_TIME_ICON.png");
export default function ShipSkillPanel({ skillStages }: ShipSkillPanelProps) {
    const sortedStages = [...skillStages].sort((first, second) => first.stage - second.stage);
    const defaultStage = sortedStages.at(-1)?.stage ?? 1;
    const [stage, setStage] = useState(defaultStage);
    const selectedStage = sortedStages.find((stageInfo) => stageInfo.stage === stage) ??
        sortedStages.at(-1);
    if (!selectedStage) {
        return (<div className="mt-4 border border-[#343844] bg-[#0b0d12] px-4 py-8 text-center text-sm font-semibold text-[#9ca3af]">
        스킬 데이터가 없습니다.
      </div>);
    }
    return (<div className="mt-4">
      <div className="border border-[#343844] bg-[#111318] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-black text-[#e5e7eb]">업그레이드 단계</p>
          <span className="text-sm font-bold text-[#9ca3af]">
            {selectedStage.stage}단계 기준
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6" role="group" aria-label="함선 스킬 업그레이드 단계">
          {sortedStages.map((stageInfo) => {
            const isSelected = stageInfo.stage === selectedStage.stage;
            return (<button key={stageInfo.stage} type="button" onClick={() => setStage(stageInfo.stage)} aria-pressed={isSelected} className={`h-10 border text-sm font-black transition focus:outline-none focus:ring-2 focus:ring-[#9ca3af] ${isSelected
                    ? "border-[#9ca3af] bg-[#343844] text-white"
                    : "border-[#343844] bg-[#0b0d12] text-[#9ca3af] hover:border-[#6b7280] hover:text-white"}`}>
                {stageInfo.stage}단계
              </button>);
        })}
        </div>
      </div>

      {selectedStage.skills.length > 0 ? (<div className="mt-4 space-y-3">
          {selectedStage.skills.map((skill) => (<div key={skill.id} className="grid grid-cols-[80px_1px_minmax(0,1fr)] overflow-hidden border border-[#343844] bg-[#0b0d12]">
              <div className="flex items-start justify-center p-3">
                <div className="relative h-14 w-14 overflow-hidden border border-[#343844] bg-black">
                  {skill.iconPath ? (<Image src={skill.iconPath} alt="" fill sizes="56px" className="object-contain"/>) : null}
                </div>
              </div>
              <div className="bg-[#343844]"/>
              <div className="min-w-0 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-black text-white">{skill.name}</h3>
                  <span className="border border-[#343844] bg-[#222631] px-2 py-1 text-xs font-bold text-white">
                    {skill.type}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#9ca3af]">
                  {skill.description || "스킬 설명이 없습니다."}
                </p>
                {skill.upgradeDescription || skill.cooldown ? (<div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#343844] pt-3 text-sm font-bold">
                    {skill.upgradeDescription ? (<span className="text-[#bf9000]">
                        {skill.upgradeDescription}
                      </span>) : null}
                    {skill.cooldown ? (<span className="flex items-center text-[#cfd4dc]">
                        쿨타임
                        <Image src={skillTimeIconPath} alt="" width={18} height={18} className="ml-1 mr-1 h-[18px] w-[18px] object-contain"/>
                        {skill.cooldown}
                      </span>) : null}
                  </div>) : null}
              </div>
            </div>))}
        </div>) : (<div className="mt-4 border border-[#343844] bg-[#0b0d12] px-4 py-8 text-center text-sm font-semibold text-[#9ca3af]">
          이 단계에서 사용할 수 있는 스킬이 없습니다.
        </div>)}
    </div>);
}
