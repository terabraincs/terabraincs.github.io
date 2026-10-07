"use client";
import SwordTrainingPmaMeshes from "./SwordTrainingPmaMeshes";
import { useLayoutEffect, useState } from "react";
import { SwordTrainingParticlePlayback, swordTrainingLocalParticleMeshes, type SwordParticleMeshOutput, type SwordParticleSystemSource } from "@/lib/swordTrainingClientParticles";
/** Source UiParticles billboard streams using the original particle shader. */
export default function SwordTrainingParticles(props: {
    width: number;
    height: number;
    meshes: readonly SwordParticleMeshOutput[];
    className?: string;
    onReady?: () => void;
    onError?: (message: string) => void;
}) {
    return <SwordTrainingPmaMeshes {...props}/>;
}
/** Lives at the original UiParticles node; source ancestors retain all transforms. */
export function SwordTrainingParticleEmitter({ config, elapsedSeconds, active, fxPlayback, width, height, pivot, maximumDeltaTime, maximumParticleTimestep }: {
    config: SwordParticleSystemSource;
    elapsedSeconds: number;
    active: boolean;
    fxPlayback: number | null;
    width: number;
    height: number;
    pivot: readonly [
        number,
        number
    ];
    maximumDeltaTime: number;
    maximumParticleTimestep: number;
}) {
    const [playback] = useState(() => new SwordTrainingParticlePlayback(config, elapsedSeconds, active, maximumDeltaTime, maximumParticleTimestep));
    const mesh = playback.preview(elapsedSeconds, active, fxPlayback);
    useLayoutEffect(() => { playback.update(elapsedSeconds, active, fxPlayback, false); }, [playback, elapsedSeconds, active, fxPlayback]);
    const frame = swordTrainingLocalParticleMeshes(config, mesh);
    return <div data-source-particle-system={config.path} data-source-particle-count={mesh.positions.length / 4} data-source-particle-bounds={JSON.stringify([frame.minX, frame.maxY, frame.width, frame.height])} style={{ position: "absolute", pointerEvents: "none", left: pivot[0] * width + frame.minX,
            top: (1 - pivot[1]) * height - frame.maxY, width: frame.width, height: frame.height }}>
    <SwordTrainingParticles width={frame.width} height={frame.height} meshes={frame.meshes}/>
  </div>;
}
