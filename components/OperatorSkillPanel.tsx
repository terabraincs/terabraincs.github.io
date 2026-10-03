"use client";
import { deploymentUrl } from "@/lib/deployment";
import { useState } from "react";
import Image from "@/components/DeploymentImage";
import type { OperatorSkill } from "@/lib/operators";
type OperatorSkillPanelProps = {
    skill: OperatorSkill | null;
};
const activationConditionIconMap: Record<string, {
    label: string;
    path: string;
}> = {
    NURT_STRIKER: {
        label: "스트라이커",
        path: deploymentUrl("/unit/unit_type/NKM_UI_COMMON_UNIT_CLASS_ICON_STRIKER.png"),
    },
    NURT_RANGER: {
        label: "레인저",
        path: deploymentUrl("/unit/unit_type/NKM_UI_COMMON_UNIT_CLASS_ICON_RANGER.png"),
    },
    NURT_DEFENDER: {
        label: "디펜더",
        path: deploymentUrl("/unit/unit_type/NKM_UI_COMMON_UNIT_CLASS_ICON_DEFENDER.png"),
    },
    NURT_SNIPER: {
        label: "스나이퍼",
        path: deploymentUrl("/unit/unit_type/NKM_UI_COMMON_UNIT_CLASS_ICON_SNIPER.png"),
    },
    NURT_SUPPORTER: {
        label: "서포터",
        path: deploymentUrl("/unit/unit_type/NKM_UI_COMMON_UNIT_CLASS_ICON_SUPPORTER.png"),
    },
};
function clampLevel(level: number, maximumLevel: number) {
    return Math.min(Math.max(level, 1), maximumLevel);
}
export default function OperatorSkillPanel({ skill, }: OperatorSkillPanelProps) {
    const maximumLevel = skill?.maxLevel ?? 1;
    const [level, setLevel] = useState(maximumLevel);
    function changeLevel(value: string) {
        const nextLevel = Number(value);
        if (!Number.isFinite(nextLevel)) {
            return;
        }
        setLevel(clampLevel(Math.round(nextLevel), maximumLevel));
    }
    const description = skill?.descriptionsByLevel[level - 1] ?? skill?.description ?? "";
    return (<section className="rounded-md border border-[#343844] bg-[#171a21] p-5">
      <div className="border-b border-[#343844] pb-3">
        <h2 className="text-xl font-black text-white">
          <span className="mr-2 text-white">■</span>
          지휘 기술
        </h2>

        {skill ? (<label className="mt-3 flex w-fit items-center gap-2 text-sm font-bold text-[#9ca3af]">
            <input type="number" min={1} max={maximumLevel} value={level} onChange={(event) => changeLevel(event.target.value)} className="h-9 w-20 border border-[#4b5160] bg-[#0b0d12] px-2 text-center font-black text-white outline-none transition focus:border-[#9ca3af]" aria-label="지휘 기술 기준 레벨"/>
            레벨 기준
          </label>) : null}
      </div>

      {skill ? (<div className="mt-4 grid grid-cols-[96px_minmax(0,1fr)] gap-4">
          <div className="flex items-start justify-center pt-1">
            {skill.iconPath ? (<Image src={skill.iconPath} alt="" width={80} height={80} className="h-20 w-20 object-contain"/>) : null}
          </div>
          <div className="min-w-0 py-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-black text-white">{skill.name}</h3>
              <span className="border border-[#343844] bg-[#222631] px-2 py-1 text-xs font-bold text-white">
                {skill.type}
              </span>
            </div>
            <div className="mt-3 flex flex-nowrap items-center gap-2 overflow-x-auto pb-1">
              {skill.cooldown !== null ? (<div className="flex h-10 shrink-0 items-center gap-2 rounded-sm border border-[#343844] bg-[#0b0d12] px-3 text-sm font-bold text-[#cfd4dc]">
                  <span>쿨타임</span>
                  <Image src={deploymentUrl("/ui/AB_UI_NKM_UI_LEADER_BOARD_TIME_ICON.png")} alt="" width={18} height={18} className="h-[18px] w-[18px] object-contain"/>
                  <span>{skill.cooldown}초</span>
                </div>) : null}
              {skill.activationConditions.length > 0 ? (<div className="flex h-10 shrink-0 items-center gap-3 rounded-sm border border-[#343844] bg-[#0b0d12] px-3 text-sm font-bold text-[#cfd4dc]">
                  <span>발동 조건</span>
                  <div className="flex items-center gap-2" aria-label="지휘 기술 발동 조건">
                    {skill.activationConditions.map((condition, index) => {
                    const icon = activationConditionIconMap[condition];
                    if (!icon) {
                        return null;
                    }
                    return (<div key={`${condition}-${index}`} className="flex items-center gap-2">
                          <Image src={icon.path} alt={icon.label} title={icon.label} width={30} height={30} className="h-[30px] w-[30px] object-contain"/>
                          {index < skill.activationConditions.length - 1 ? (<span className="text-lg font-black text-[#6b7280]" aria-hidden="true">
                              →
                            </span>) : null}
                        </div>);
                })}
                  </div>
                </div>) : null}
            </div>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#9ca3af]">
              <SkillDescription text={description || "스킬 설명이 없습니다."}/>
            </p>
          </div>
        </div>) : (<div className="mt-4 border border-[#343844] bg-[#0b0d12] px-4 py-8 text-center text-sm font-semibold text-[#9ca3af]">
          지휘 기술 데이터가 없습니다.
        </div>)}
    </section>);
}
function SkillDescription({ text }: {
    text: string;
}) {
    const parts = text.split(/(\[\[skill-value:[^\]]+\]\])/g);
    return parts.map((part, index) => {
        const matchedValue = part.match(/^\[\[skill-value:([^\]]+)\]\]$/);
        if (!matchedValue) {
            return part;
        }
        return (<span key={`${matchedValue[1]}-${index}`} className="font-black text-[#bf9000]">
        {matchedValue[1]}
      </span>);
    });
}
