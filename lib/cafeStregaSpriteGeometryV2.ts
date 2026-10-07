import type { SwordClientAsset } from './swordTrainingClientLayout';
export type CafeSourceSpriteGeometryV2 = {
    spriteRect: number[];
    spritePivot: number[];
    spriteBounds: number[];
    sourceVertices: number[][];
    sourceTriangles: number[];
    pngUV: number[][];
};
type ExtractedSpriteAsset = SwordClientAsset & {
    rect?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    pivot?: readonly [
        number,
        number
    ];
    mesh?: {
        vertices?: number[][];
        triangles?: number[][];
        pngUV?: number[][];
    };
};
/** Build the same Sprite geometry captured from Unity from the extracted
 * AssetBundle values. Dynamic FXM frames are not assigned to an Image at
 * prefab load time, so Unity's capture catalog cannot enumerate them there. */
export function cafeSourceSpriteGeometryV2(asset: SwordClientAsset): CafeSourceSpriteGeometryV2 {
    const source = asset as ExtractedSpriteAsset;
    const rect = source.rect;
    const pivot = source.pivot;
    const mesh = source.mesh;
    const ppu = Number(source.pixelsPerUnit);
    if (!rect || !pivot || !mesh?.vertices?.length || !mesh.triangles?.length || !mesh.pngUV?.length || !(ppu > 0)) {
        throw new Error(`Original Cafe Sprite mesh is incomplete: ${asset.name}`);
    }
    if (mesh.vertices.length !== mesh.pngUV.length)
        throw new Error(`Original Cafe Sprite vertex/UV count differs: ${asset.name}`);
    return {
        spriteRect: [rect.x, rect.y, rect.width, rect.height],
        spritePivot: [pivot[0] * rect.width, pivot[1] * rect.height],
        spriteBounds: [(0.5 - pivot[0]) * rect.width / ppu, (0.5 - pivot[1]) * rect.height / ppu, rect.width / ppu, rect.height / ppu],
        sourceVertices: mesh.vertices.map(vertex => [vertex[0], vertex[1]]),
        sourceTriangles: mesh.triangles.flat(),
        pngUV: mesh.pngUV.map(uv => [uv[0], uv[1]]),
    };
}
