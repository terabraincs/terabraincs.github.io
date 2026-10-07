"use client";
import { deploymentData } from "@/lib/deployment";
import { useMemo } from "react";
import sourceRaw from "@/public/game-assets/sword-training/client-source/slash-fx.json";
const source = deploymentData(sourceRaw);
import { sampleSwordTrainingHitFx, type SwordTrainingHitFx, type SwordTrainingSlashSource } from "@/lib/swordTrainingClientSlash";
import SwordTrainingPmaMeshes, { type SwordTrainingPmaMesh } from "./SwordTrainingPmaMeshes";
export type { SwordTrainingHitFx } from "@/lib/swordTrainingClientSlash";
type Props = {
    width: number;
    height: number;
    effects: readonly SwordTrainingHitFx[];
    className?: string;
    onReady?: () => void;
    onError?: (message: string) => void;
};
const PRELOAD_ONLY: readonly SwordTrainingPmaMesh[] = [{
        id: "source-hit-atlas-preload",
        texture: source.sprites.hit.texture,
        positions: [],
        uvs: [],
        indices: [],
        color: [0, 0, 0, 0],
    }];
/** Only the client-triggered hit FX is played. SLASH_02/SLASH is inactive in
 * the original prefab and NKCSwordTrainingWeapon never activates that child. */
export default function SwordTrainingSlash({ width, height, effects, className, onReady, onError }: Props) {
    const meshes = useMemo(() => {
        // Preload the hit atlas while the lobby is open, without drawing a fake frame.
        const result: SwordTrainingPmaMesh[] = [...PRELOAD_ONLY];
        for (const effect of effects) {
            const mesh = sampleSwordTrainingHitFx(source as SwordTrainingSlashSource, effect);
            if (mesh)
                result.push(mesh);
        }
        return result.length === PRELOAD_ONLY.length ? PRELOAD_ONLY : result;
    }, [effects]);
    return <SwordTrainingPmaMeshes width={width} height={height} meshes={meshes} className={className} onReady={onReady} onError={onError}/>;
}
