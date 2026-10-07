"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createCafeRingRendererV2, type CafeRingMeshV2, type CafeRingMaterialV2 } from '@/lib/cafeStregaRingMeshV2';
import { CafeStregaFxmMaterialV2, type CafeFxmEvaluatorFrameV2 } from '@/lib/cafeStregaFxmMaterialV2';
import { cafeSourceMatrixV2 } from '@/lib/cafeStregaSourceMatrixV2';
import { swordClientWorldRect, type SwordClientLayout, type SwordClientComponent } from '@/lib/swordTrainingClientLayout';
export type CafeRingCatalogV2 = {
    mesh: CafeRingMeshV2;
    renderers: {
        path: string;
        material: CafeRingMaterialV2;
        source: {
            fields: {
                m_Thickness: number;
                m_Color: {
                    r: number;
                    g: number;
                    b: number;
                    a: number;
                };
            };
        };
    }[];
};
type StagedMaterialFrame = {
    material: CafeStregaFxmMaterialV2;
    value: ReturnType<CafeStregaFxmMaterialV2['update']>;
};
/** Keeps speculative render evaluation separate from the material clock that
 * belongs to the last committed React frame. */
class CafeMaterialFrameStage {
    private committed: CafeStregaFxmMaterialV2;
    private pending: {
        frame: CafeFxmEvaluatorFrameV2;
        staged: StagedMaterialFrame;
    } | null = null;
    private latest: {
        revision: number;
        staged: StagedMaterialFrame;
    } | null = null;
    constructor(modifier: SwordClientComponent, values: CafeRingMaterialV2['values']) {
        this.committed = new CafeStregaFxmMaterialV2(modifier, values);
    }
    preview(frame: CafeFxmEvaluatorFrameV2): StagedMaterialFrame {
        if (this.latest?.revision === frame.revision)
            return this.latest.staged;
        if (this.pending?.frame === frame)
            return this.pending.staged;
        const material = this.committed.clone();
        const staged = { material, value: material.update(frame) };
        this.pending = { frame, staged };
        this.latest = { revision: frame.revision, staged };
        return staged;
    }
    commit(staged: StagedMaterialFrame) { this.committed = staged.material; if (this.pending?.staged === staged)
        this.pending = null; }
}
export default function CafeStregaRing({ layout, source, mesh, modifier, frame, width, height, active, onError }: {
    layout: SwordClientLayout;
    source: CafeRingCatalogV2['renderers'][number];
    mesh: CafeRingMeshV2;
    modifier: SwordClientComponent;
    frame: CafeFxmEvaluatorFrameV2;
    width: number;
    height: number;
    active: boolean;
    onError: (message: string) => void;
}) {
    const canvas = useRef<HTMLCanvasElement>(null), renderer = useRef<Awaited<ReturnType<typeof createCafeRingRendererV2>> | null>(null);
    const [readyKey, setReadyKey] = useState<{
        mesh: CafeRingMeshV2;
        source: CafeRingCatalogV2['renderers'][number];
    } | null>(null);
    const ready = readyKey?.mesh === mesh && readyKey.source === source;
    const stage = useMemo(() => new CafeMaterialFrameStage(modifier, source.material.values), [modifier, source]);
    const staged = stage.preview(frame);
    useLayoutEffect(() => { stage.commit(staged); }, [stage, staged]);
    const value = staged.value;
    const geometry = useMemo(() => {
        const flat = swordClientWorldRect(layout, source.path, width, height), true3D = cafeSourceMatrixV2(layout, source.path, width, height);
        const [a, b, c, d, e, f] = flat.matrix, determinant = a * d - b * c;
        return { true3D, inverse: [d / determinant, -b / determinant, -c / determinant, a / determinant, (c * f - d * e) / determinant, (b * e - a * f) / determinant] };
    }, [layout, source.path, width, height]);
    useEffect(() => {
        let disposed = false;
        void createCafeRingRendererV2(canvas.current!, mesh, source.material).then(value => { if (disposed)
            value.dispose();
        else {
            renderer.current = value;
            setReadyKey({ mesh, source });
        } }).catch(error => { if (!disposed)
            onError(String(error)); });
        return () => { disposed = true; renderer.current?.dispose(); renderer.current = null; };
    }, [mesh, source, onError]);
    useLayoutEffect(() => {
        if (!active || !ready || !renderer.current)
            return;
        try {
            const color = source.source.fields.m_Color;
            renderer.current.render({ width, height, rectWidth: geometry.true3D.width, rectHeight: geometry.true3D.height, thickness: source.source.fields.m_Thickness,
                matrix: geometry.true3D.matrix, color: [color.r, color.g, color.b, color.a], material: value.values, enabled: value.enabled });
        }
        catch (error) {
            onError(String(error));
        }
    }, [ready, width, height, source, geometry, value, active, onError]);
    return <canvas ref={canvas} data-cafe-ring={source.path} data-cafe-ring-ready={ready} style={{ position: 'absolute', left: 0, top: 0, width, height, transformOrigin: '0 0', transform: `matrix(${geometry.inverse.join(',')})`, pointerEvents: 'none', visibility: active ? 'visible' : 'hidden' }}/>;
}
