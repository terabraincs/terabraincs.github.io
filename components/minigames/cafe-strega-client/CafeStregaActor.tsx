"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createCafeActorRendererV2, type CafeActorKindV2 } from '@/lib/cafeStregaActorRendererV2';
import { swordClientWorldRect, type SwordClientLayout } from '@/lib/swordTrainingClientLayout';
export default function CafeStregaActor({ layout, path, kind, width, height, elapsed, animation, animationKey, loop, onError }: {
    layout: SwordClientLayout;
    path: string;
    kind: CafeActorKindV2;
    width: number;
    height: number;
    elapsed: number;
    animation: string;
    animationKey: number;
    loop: boolean;
    onError: (message: string) => void;
}) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const renderer = useRef<Awaited<ReturnType<typeof createCafeActorRendererV2>> | null>(null);
    const [ready, setReady] = useState(false);
    const geometry = useMemo(() => {
        const source = swordClientWorldRect(layout, path, width, height);
        const node = layout.nodes.find(node => node.path === path)!;
        const [a, b, c, d, e, f] = source.matrix;
        const determinant = a * d - b * c;
        if (determinant === 0)
            throw new Error('Original Cafe actor transform is singular');
        return {
            a, b, c, d, e, f,
            inverse: [d / determinant, -b / determinant, -c / determinant, a / determinant,
                (c * f - d * e) / determinant, (b * e - a * f) / determinant],
            originX: (node.rect.pivot?.[0] ?? .5) * source.width,
            originY: (1 - (node.rect.pivot?.[1] ?? .5)) * source.height,
        };
    }, [layout, path, width, height]);
    const { a, b, c, d, e, f, inverse, originX, originY } = geometry;
    useEffect(() => {
        let disposed = false;
        void createCafeActorRendererV2(canvas.current!, kind).then(value => {
            if (disposed) {
                value.dispose();
                return;
            }
            renderer.current = value;
            if (canvas.current) {
                canvas.current.dataset.cafeActor = kind;
                canvas.current.dataset.cafeActorStatus = 'ready';
            }
            setReady(true);
        }).catch((cause: unknown) => { if (!disposed)
            onError(cause instanceof Error ? cause.message : String(cause)); });
        return () => { disposed = true; renderer.current?.dispose(); renderer.current = null; };
    }, [kind, onError]);
    useLayoutEffect(() => {
        const target = canvas.current;
        // Unity does not render an inactive GameObject. The source prefab keeps
        // all three Spine React instances mounted for pooling, so reject hidden
        // branches before doing any skeleton, mesh, or full-stage WebGL work.
        if (!ready || !renderer.current || !target || document.visibilityState === 'hidden' || target.parentElement?.dataset.sourceActive !== 'true')
            return;
        renderer.current.render({ animation, animationKey, loop, queueIdle: !loop, time: elapsed,
            matrix: [a, b, c, d, e + a * originX + c * originY, f + b * originX + d * originY], alpha: 1, width, height });
    }, [ready, elapsed, a, b, c, d, e, f, originX, originY, animation, animationKey, loop, width, height]);
    return <canvas ref={canvas} style={{ position: 'absolute', left: 0, top: 0, width, height, transformOrigin: '0 0', transform: `matrix(${inverse.join(',')})`, pointerEvents: 'none' }}/>;
}
