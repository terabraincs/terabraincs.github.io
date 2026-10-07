"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { swordClientComponent, type SwordClientLayout } from "@/lib/swordTrainingClientLayout";
import { sampleSwordTrainingClientAnimation, type SwordTrainingClientAnimationClip } from "@/lib/swordTrainingClientAnimation";
import { SWORD_REWARD_ROOT, SWORD_REWARD_SLOT, type buildSwordConditionsRewardLayout } from "@/lib/swordTrainingClientRewards";
import type { SwordParticleSystemSource } from "@/lib/swordTrainingClientParticles";
import SwordTrainingPrefab, { type SwordPrefabOverride } from "./SwordTrainingPrefab";
export type SwordTrainingRewardsProps = {
    source: ReturnType<typeof buildSwordConditionsRewardLayout>;
    strings: Record<string, string>;
    particles?: readonly SwordParticleSystemSource[];
    width: number;
    height: number;
    elapsedSeconds: number;
    active: boolean;
    bestScore: number;
    onClose: () => void;
    onButtonSound?: () => void;
};
/** Cached 1103 popup with the user's conditions-only reward presentation. */
export default function SwordTrainingRewards({ source, strings, particles, width, height, elapsedSeconds, active, bestScore, onClose, onButtonSound }: SwordTrainingRewardsProps) {
    const { layout, rows } = source;
    const [open, setOpen] = useState({ started: elapsedSeconds, serial: 0 });
    const wasActive = useRef(active);
    useLayoutEffect(() => {
        if (active && !wasActive.current)
            setOpen(previous => ({ started: elapsedSeconds, serial: previous.serial + 1 }));
        wasActive.current = active;
    }, [active, elapsedSeconds]);
    const resetKey = String(open.serial);
    const soundAction = (action: () => void) => () => { onButtonSound?.(); action(); };
    const overrides: Record<string, SwordPrefabOverride> = {};
    const intro = (layout as SwordClientLayout & {
        animations: SwordTrainingClientAnimationClip[];
    }).animations.find(clip => clip.name === "UI_SINGLE_SWORDTRAINING_POPUP_INTRO");
    if (!intro)
        throw new Error("Missing original reward popup intro");
    const popupTime = active && !wasActive.current ? 0 : Math.max(0, elapsedSeconds - open.started);
    for (const [path, attributes] of Object.entries(sampleSwordTrainingClientAnimation(intro, popupTime)))
        overrides[`${SWORD_REWARD_ROOT}/Content/${path}`] = { attributes };
    overrides[SWORD_REWARD_ROOT] = { active, label: "rewards-popup", data: { "data-reward-group": "1103", "data-reward-best-score": bestScore } };
    overrides[source.paths.totalScore] = { text: String(bestScore) };
    overrides[source.paths.close] = { label: "rewards-close", onClick: soundAction(onClose) };
    // Appearance only: no pointer/keyboard callback, focus target or button sound.
    overrides[source.paths.all] = { label: "rewards-claim-all", locked: true, raycast: false };
    overrides[source.paths.loop] = { scrollResetKey: resetKey, scrollHotkeys: active, label: "rewards-scroll" };
    const allButton = swordClientComponent(source.layout.nodes.find(node => node.path === source.paths.all)!, "NKCUIComStateButton");
    for (const [field, visible] of [["m_ButtonBG_Normal", false], ["m_ButtonBG_Locked", true]] as const) {
        const target = allButton?.references.find(ref => ref.field === field)?.nodePath;
        if (target)
            overrides[target] = { active: visible };
    }
    for (const row of rows) {
        const rowRoot = source.rowRoots.get(row.id)!;
        const target = (original: string) => rowRoot + original.slice(SWORD_REWARD_SLOT.length);
        overrides[rowRoot] = { active: true, label: `reward-${row.id}`, data: { "data-reward-score": row.score } };
        overrides[target(source.paths.description)] = { text: row.description };
    }
    return <SwordTrainingPrefab layout={layout} rootPath={SWORD_REWARD_ROOT} strings={strings} particles={particles} width={width} height={height} elapsedSeconds={elapsedSeconds} overrides={overrides} separateDynamicTransforms memoizeSubtrees/>;
}
