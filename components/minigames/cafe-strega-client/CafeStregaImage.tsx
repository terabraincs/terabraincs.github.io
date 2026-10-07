"use client";
import { memo } from 'react';
import type { SourcePrefabImageRenderer } from '../sword-training/SwordTrainingPrefab';
import SourceImage from '../sword-training/SwordTrainingImage';
import SourceMeshes from '../sword-training/SwordTrainingPmaMeshes';
import CafeStregaImageMesh from './CafeStregaImageMesh';
import type { SwordClientReference } from '@/lib/swordTrainingClientLayout';
import type { SwordClientAsset } from '@/lib/swordTrainingClientLayout';
import { cafeSourceSpriteGeometryV2 } from '@/lib/cafeStregaSpriteGeometryV2';
export type CafeImageGeometry = {
    sprites: Record<string, {
        spriteRect: number[];
        spritePivot: number[];
        spriteBounds: number[];
        sourceVertices: number[][];
        sourceTriangles: number[];
        pngUV: number[][];
    }>;
    images: Record<string, {
        rect: number[];
        pivot: number[];
        fillAmount: number;
        fillMethod: number;
        fillOrigin: number;
        fillClockwise: number;
        generatedVertices: number[][];
        generatedPngUvs: number[][];
        generatedTriangles: number[];
    }>;
};
type Props = Parameters<SourcePrefabImageRenderer>[0] & {
    geometry: CafeImageGeometry;
};
type CachedMeshGeometry = {
    positions: number[];
    uvs: number[];
    indices: number[];
};
const meshGeometryCache = new WeakMap<CafeImageGeometry, Map<string, CachedMeshGeometry>>();
const spritePathCache = new WeakMap<Map<string, SwordClientAsset>, Map<string, SwordClientAsset>>();
const MESH_GEOMETRY_CACHE_LIMIT = 256;
function cachedMeshGeometry(geometry: CafeImageGeometry, key: string, create: () => CachedMeshGeometry) {
    let entries = meshGeometryCache.get(geometry);
    if (!entries) {
        entries = new Map();
        meshGeometryCache.set(geometry, entries);
    }
    let value = entries.get(key);
    if (!value) {
        value = create();
        entries.set(key, value);
        if (entries.size > MESH_GEOMETRY_CACHE_LIMIT)
            entries.delete(entries.keys().next().value!);
    }
    return value;
}
function spriteByPath(assets: Map<string, SwordClientAsset>, webPath: string) {
    let sprites = spritePathCache.get(assets);
    if (!sprites) {
        sprites = new Map();
        for (const asset of assets.values())
            if (asset.type === 'Sprite' && asset.webPath)
                sprites.set(asset.webPath, asset);
        spritePathCache.set(assets, sprites);
    }
    return sprites.get(webPath);
}
function CafeStregaImage({ node, image, width, height, pivot, color, fillAmount, assets, geometry }: Props) {
    const component = node.components.find(component => component.pathId === image.componentPathId)!;
    const materialRef = component.references.find(reference => reference.field === 'm_Material');
    const material = materialRef?.assetId ? assets.get(materialRef.assetId) : null;
    const shader = material?.shaderName ?? 'UI/Default';
    const meshMode = image.imageType === 0 && Boolean(component.fields.m_UseSpriteMesh);
    // SINGLE_CAFE_BUTTON_5 has the original Sprite.border [142, 0, 175, 0]
    // over a 310 px-wide sprite. Unity keeps the resulting six-pixel centre
    // quad and reverses its U coordinates. CanvasRenderingContext2D.drawImage
    // cannot express that reversed source interval, so use the native-equation
    // mesh path for overlapping sliced borders instead of dropping the quad.
    const overlappingSlice = image.imageType === 1 && image.border && image.pixelSize &&
        (image.border[0] + image.border[2] > image.pixelSize[0] || image.border[1] + image.border[3] > image.pixelSize[1]);
    if (shader === 'UI/Default' && !meshMode && !overlappingSlice)
        return <SourceImage image={image} width={width} height={height} pivot={pivot} color={color} fillAmount={fillAmount}/>;
    if (!['UI/Default', 'NKC/Mobile/Particles/Additive', 'UI/Particles/Additive', 'NKC/NKC_FX_SPRITE_UI'].includes(String(shader)))
        throw new Error(`Unimplemented original Cafe Image shader: ${node.path}: ${shader}`);
    if (!image.webPath || !(width > 0 && height > 0))
        return null;
    const sprite = spriteByPath(assets, image.webPath);
    if (!sprite)
        throw new Error(`Original Cafe Sprite is missing: ${node.path}`);
    const geometryKey = JSON.stringify([node.path, image.componentPathId, sprite.id, width, height, pivot,
        image.imageType, image.preserveAspect, image.pixelSize, image.border, image.pixelsPerUnit,
        image.pixelsPerUnitMultiplier, image.fillCenter, fillAmount ?? image.fillAmount, image.fillMethod,
        image.fillOrigin, Number(image.fillClockwise)]);
    const { positions, uvs, indices } = cachedMeshGeometry(geometry, geometryKey, () => {
        let nextPositions: number[] = [], nextUvs: number[] = [], nextIndices: number[] = [];
        const source = geometry.sprites[sprite.id] ?? (meshMode ? cafeSourceSpriteGeometryV2(sprite) : undefined);
        if (image.imageType === 3) {
            const captured = geometry.images[node.path];
            if (!captured || (fillAmount ?? image.fillAmount) !== captured.fillAmount || image.fillMethod !== captured.fillMethod || image.fillOrigin !== captured.fillOrigin || Number(image.fillClockwise) !== captured.fillClockwise)
                throw new Error(`Uncaptured original Cafe Filled mesh: ${node.path}`);
            nextPositions = captured.generatedVertices.flatMap(vertex => [(vertex[0] - captured.rect[0]) / captured.rect[2] * width,
                (1 - (vertex[1] - captured.rect[1]) / captured.rect[3]) * height]);
            nextUvs = captured.generatedPngUvs.flat();
            nextIndices = captured.generatedTriangles;
        }
        else if (meshMode) {
            if (!source)
                throw new Error(`Uncaptured original Sprite.bounds: ${sprite.name}`);
            const size = [width, height];
            if (image.preserveAspect) {
                const ratio = source.spriteRect[2] / source.spriteRect[3];
                if (ratio > width / height)
                    size[1] = width / ratio;
                else
                    size[0] = height * ratio;
            }
            const offset = size.map((extent, axis) => (pivot[axis] - source.spritePivot[axis] / source.spriteRect[axis + 2]) * extent);
            nextPositions = source.sourceVertices.flatMap(vertex => [vertex[0] / source.spriteBounds[2] * size[0] - offset[0] + width * pivot[0],
                height * (1 - pivot[1]) - (vertex[1] / source.spriteBounds[3] * size[1] - offset[1])]);
            nextUvs = source.pngUV.flat();
            nextIndices = source.sourceTriangles;
        }
        else if (image.imageType === 0) {
            let dw = width, dh = height;
            if (image.preserveAspect && image.pixelSize) {
                const ratio = image.pixelSize[0] / image.pixelSize[1];
                if (ratio > width / height)
                    dh = width / ratio;
                else
                    dw = height * ratio;
            }
            const x = (width - dw) * pivot[0], y = (height - dh) * (1 - pivot[1]);
            nextPositions = [x, y, x, y + dh, x + dw, y + dh, x + dw, y];
            nextUvs = [0, 0, 0, 1, 1, 1, 1, 0];
            nextIndices = [0, 1, 2, 2, 3, 0];
        }
        else if (image.imageType === 1) {
            const border = image.border ?? [0, 0, 0, 0], pixels = image.pixelSize!;
            const ppu = (image.pixelsPerUnit ?? 100) / 100 * (image.pixelsPerUnitMultiplier ?? 1);
            const xScale = Math.min(1, width / ((border[0] + border[2]) / ppu || 1));
            const yScale = Math.min(1, height / ((border[1] + border[3]) / ppu || 1));
            const xs = [0, border[0] / ppu * xScale, width - border[2] / ppu * xScale, width];
            const ys = [0, border[3] / ppu * yScale, height - border[1] / ppu * yScale, height];
            const us = [0, border[0] / pixels[0], 1 - border[2] / pixels[0], 1];
            const vs = [0, border[3] / pixels[1], 1 - border[1] / pixels[1], 1];
            for (let y = 0; y < 3; y++)
                for (let x = 0; x < 3; x++) {
                    if (x === 1 && y === 1 && !image.fillCenter)
                        continue;
                    const start = nextPositions.length / 2;
                    nextPositions.push(xs[x], ys[y], xs[x], ys[y + 1], xs[x + 1], ys[y + 1], xs[x + 1], ys[y]);
                    nextUvs.push(us[x], vs[y], us[x], vs[y + 1], us[x + 1], vs[y + 1], us[x + 1], vs[y]);
                    nextIndices.push(start, start + 1, start + 2, start + 2, start + 3, start);
                }
        }
        else
            throw new Error(`Unimplemented original Cafe Image type: ${node.path}: ${image.imageType}`);
        return { positions: nextPositions, uvs: nextUvs, indices: nextIndices };
    });
    if (material) {
        const reference = (material.references as SwordClientReference[]).find(reference => reference.field === 'm_Shader');
        if (!reference?.resolved)
            throw new Error(`Unresolved original Cafe shader: ${material.name}`);
    }
    const mesh = { id: image.componentPathId, texture: image.webPath, positions, uvs, indices, color,
        sourceStraightAlpha: shader === 'UI/Default', sourceAlphaAdditive: shader === 'NKC/Mobile/Particles/Additive' || shader === 'UI/Particles/Additive', sourceAlphaAdditiveMultiplier: shader === 'UI/Particles/Additive' ? 2 as const : 1 as const };
    const rendered = shader !== 'NKC/NKC_FX_SPRITE_UI' || color[3] === 0 ? <CafeStregaImageMesh width={width} height={height} mesh={mesh}/>
        : <SourceMeshes width={width} height={height} meshes={[mesh]}/>;
    return <span data-cafe-image-texture={mesh.texture} style={{ display: 'contents' }}>{rendered}</span>;
}
const sameValues = (left: readonly number[] | undefined, right: readonly number[] | undefined) => left === right || Boolean(left && right && left.length === right.length && left.every((value, index) => value === right[index]));
export default memo(CafeStregaImage, (previous, next) => previous.node === next.node && previous.image === next.image && previous.width === next.width && previous.height === next.height
    && sameValues(previous.pivot, next.pivot) && sameValues(previous.color, next.color) && previous.fillAmount === next.fillAmount && previous.assets === next.assets && previous.geometry === next.geometry);
