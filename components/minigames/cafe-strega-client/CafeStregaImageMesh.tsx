"use client";
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cafeGpuImageV2, drawCafeImageGpuV2 } from '@/lib/cafeStregaImageGpuV2';
import type { SwordTrainingPmaMesh } from '../sword-training/SwordTrainingPmaMeshes';
type Props = {
    width: number;
    height: number;
    mesh: SwordTrainingPmaMesh;
};
const sameValues = (left: readonly number[] | undefined, right: readonly number[] | undefined) => left === right || Boolean(left && right && left.length === right.length && left.every((value, index) => value === right[index]));
function CafeStregaImageMesh({ width, height, mesh }: Props) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const [loaded, setLoaded] = useState<{
        texture: string;
        image: HTMLImageElement;
    } | null>(null);
    const [failure, setFailure] = useState<{
        texture: string;
        message: string;
    } | null>(null);
    const ready = loaded?.texture === mesh.texture, error = failure?.texture === mesh.texture ? failure.message : null;
    useEffect(() => {
        let disposed = false;
        const texture = mesh.texture;
        void cafeGpuImageV2(texture).then(image => { if (!disposed)
            setLoaded({ texture, image }); })
            .catch(error => { if (!disposed)
            setFailure({ texture, message: String(error) }); });
        return () => { disposed = true; };
    }, [mesh.texture]);
    useLayoutEffect(() => {
        if (!ready || !canvas.current)
            return;
        try {
            // The helper still samples the current ancestor transform and DPR on every
            // commit; it reuses pixels only when that raster size and all draw values match.
            drawCafeImageGpuV2(canvas.current, loaded.image, mesh, width, height, false, true, true);
        }
        catch (error) {
            const texture = mesh.texture, message = String(error);
            queueMicrotask(() => setFailure({ texture, message }));
        }
    }, [ready, loaded, mesh, width, height]);
    return <canvas ref={canvas} data-source-status={error ? 'error' : ready ? 'ready' : 'loading'} data-source-error={error ?? undefined} data-cafe-image-texture={mesh.texture} style={{ position: 'absolute', left: 0, top: 0, width, height, pointerEvents: 'none', visibility: ready ? 'visible' : 'hidden' }}/>;
}
/** SourcePrefab may revisit an animated ancestor every frame. Keep the exact
 * retained canvas when this image's native mesh and tint did not change, so a
 * static image does not resample ancestor transforms or touch the GPU pool. */
export default memo(CafeStregaImageMesh, (previous, next) => previous.width === next.width && previous.height === next.height
    && previous.mesh.id === next.mesh.id && previous.mesh.texture === next.mesh.texture
    && previous.mesh.positions === next.mesh.positions && previous.mesh.uvs === next.mesh.uvs && previous.mesh.indices === next.mesh.indices
    && sameValues(previous.mesh.color, next.mesh.color)
    && sameValues(previous.mesh.particleCustom, next.mesh.particleCustom)
    && sameValues(previous.mesh.particleTint, next.mesh.particleTint)
    && previous.mesh.sourceStraightAlpha === next.mesh.sourceStraightAlpha
    && previous.mesh.sourceAlphaAdditive === next.mesh.sourceAlphaAdditive
    && previous.mesh.sourceAlphaAdditiveMultiplier === next.mesh.sourceAlphaAdditiveMultiplier);
