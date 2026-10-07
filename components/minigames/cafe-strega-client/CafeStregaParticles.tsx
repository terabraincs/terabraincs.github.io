"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CafeStregaParticlePlaybackV2, type CafeParticleSourceV2 } from '@/lib/cafeStregaParticleSceneV2';
import { swordTrainingLocalParticleMeshes, type SwordParticleSystemSource } from '@/lib/swordTrainingClientParticles';
import { cafeGpuImageV2, drawCafeParticleGpuV2 } from '@/lib/cafeStregaImageGpuV2';
type ParticleLifetime = {
    active: boolean;
    starts: number;
    restartKey: string | number;
    maximumDeltaTime: number;
    maximumParticleTimestep: number;
};
type StagedParticleFrame = {
    time: number;
    lifetime: ParticleLifetime;
    playback: CafeStregaParticlePlaybackV2;
    mesh: ReturnType<CafeStregaParticlePlaybackV2['updateAt']>;
};
/** Render-safe two-phase clock. Only the already evaluated candidate is
 * promoted after React commits the corresponding frame. */
class CafeParticleFrameStage {
    private committed: CafeStregaParticlePlaybackV2;
    private pending: StagedParticleFrame | null = null;
    constructor(config: CafeParticleSourceV2) { this.committed = new CafeStregaParticlePlaybackV2(config); }
    preview(time: number, lifetime: ParticleLifetime): StagedParticleFrame {
        const pending = this.pending;
        if (pending && pending.time === time && pending.lifetime.active === lifetime.active && pending.lifetime.starts === lifetime.starts
            && pending.lifetime.restartKey === lifetime.restartKey && pending.lifetime.maximumDeltaTime === lifetime.maximumDeltaTime
            && pending.lifetime.maximumParticleTimestep === lifetime.maximumParticleTimestep)
            return pending;
        const playback = this.committed.clone(lifetime.active);
        const frame = { time, lifetime, playback, mesh: playback.updateAt(time, lifetime) };
        this.pending = frame;
        return frame;
    }
    commit(frame: StagedParticleFrame) { this.committed = frame.playback; if (this.pending === frame)
        this.pending = null; }
}
/** Mount inside the exact original UiParticles node. Bounds below only allocate
 * its canvas: every particle remains in original local coordinates, and all
 * source ancestor FXM/DOTween/RectTransform changes remain inherited normally. */
export default function CafeStregaParticles({ config, elapsedSeconds, active, starts, restartKey, width, height, pivot, maximumDeltaTime, maximumParticleTimestep, onError }: {
    config: CafeParticleSourceV2;
    elapsedSeconds: number;
    active: boolean;
    starts: number;
    restartKey: string | number;
    width: number;
    height: number;
    pivot: readonly [
        number,
        number
    ];
    maximumDeltaTime: number;
    maximumParticleTimestep: number;
    onError: (message: string) => void;
}) {
    const stage = useMemo(() => new CafeParticleFrameStage(config), [config]);
    const staged = stage.preview(elapsedSeconds, { active, starts, restartKey, maximumDeltaTime, maximumParticleTimestep });
    useLayoutEffect(() => { stage.commit(staged); }, [stage, staged]);
    const mesh = staged.mesh;
    const frame = useMemo(() => {
        const native = swordTrainingLocalParticleMeshes(config as unknown as SwordParticleSystemSource, mesh);
        if (config.nativeInitial.material.shader !== 'UI/Particles/Additive')
            return native;
        return { ...native, meshes: native.meshes.map(entry => ({
                ...entry, particleCustom: undefined, sourceAlphaAdditive: true as const, sourceAlphaAdditiveMultiplier: 2 as const,
            })) };
    }, [config, mesh]);
    const { minX, maxY, width: boundsWidth, height: boundsHeight } = frame;
    const canvas = useRef<HTMLCanvasElement>(null);
    const [loaded, setLoaded] = useState<{
        texture: string;
        image: HTMLImageElement;
    } | null>(null);
    const ready = loaded?.texture === config.texture;
    useEffect(() => {
        let disposed = false;
        void cafeGpuImageV2(config.texture).then(value => { if (!disposed)
            setLoaded({ texture: config.texture, image: value }); })
            .catch((error: unknown) => { if (!disposed)
            onError(error instanceof Error ? error.message : String(error)); });
        return () => { disposed = true; };
    }, [config, onError]);
    useLayoutEffect(() => {
        // The source hierarchy already hides this canvas. Keeping the retained
        // framebuffer hidden lets inactive systems do zero GPU presentation work.
        if (!active || !ready || !canvas.current)
            return;
        try {
            drawCafeParticleGpuV2(canvas.current, loaded.image, frame.meshes, boundsWidth, boundsHeight);
        }
        catch (error: unknown) {
            onError(error instanceof Error ? error.message : String(error));
        }
    }, [active, ready, loaded, boundsWidth, boundsHeight, frame.meshes, config, onError]);
    return <canvas ref={canvas} data-cafe-particle-system={config.path} data-cafe-particle-count={mesh.positions.length / 4} data-cafe-particle-ready={ready} data-cafe-particle-bounds={JSON.stringify([minX, maxY, boundsWidth, boundsHeight])} style={{ position: 'absolute', pointerEvents: 'none', left: pivot[0] * width + minX, top: (1 - pivot[1]) * height - maxY,
            width: boundsWidth, height: boundsHeight, visibility: active ? 'visible' : 'hidden' }}/>;
}
