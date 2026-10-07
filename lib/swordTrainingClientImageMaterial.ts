import type { ClientColor, ClientVector2, SwordClientAsset, SwordClientNode, SwordClientReference } from "./swordTrainingClientLayout";
import type { SwordClientImage } from "../components/minigames/sword-training/SwordTrainingImage";
import { swordTrainingColor32 } from "./swordTrainingClientPma";
/** Identified by the original PPtr, not an asset-name substring. */
export const SWORD_SOURCE_ADDITIVE_IMAGE_MATERIAL = "CAB-c053aa272d0641a3f0966e95024e51a3:-3436825484165908113";
export const SWORD_SOURCE_ADDITIVE_IMAGE_SHADER = "-8307568223059034784";
export type SwordClientAdditiveImageMaterial = {
    assetId: string;
    shaderName: "NKC/Mobile/Particles/Additive";
    sourceBlend: 5;
    destinationBlend: 1;
    textureScale: ClientVector2;
    textureOffset: ClientVector2;
};
/** Resolves Image -> Material -> Shader without changing the other ADD shaders. */
export function swordTrainingImageMaterial(node: SwordClientNode, image: SwordClientImage, assets: ReadonlyMap<string, SwordClientAsset>): SwordClientAdditiveImageMaterial | undefined {
    const component = node.components.find(value => value.pathId === image.componentPathId);
    const reference = component?.references.find(value => value.field === "m_Material");
    if (reference?.assetId !== SWORD_SOURCE_ADDITIVE_IMAGE_MATERIAL)
        return undefined;
    const material = assets.get(reference.assetId);
    const shader = (material?.references as SwordClientReference[] | undefined)?.find(value => value.field === "m_Shader");
    const fields = material?.fields as Record<string, unknown> | undefined;
    const properties = fields?.m_SavedProperties as {
        m_Floats?: [
            string,
            number
        ][];
        m_TexEnvs?: [
            string,
            {
                m_Texture: {
                    m_PathID: string;
                };
                m_Scale: {
                    x: number;
                    y: number;
                };
                m_Offset: {
                    x: number;
                    y: number;
                };
            }
        ][];
    } | undefined;
    const floats = new Map(properties?.m_Floats);
    const texture = properties?.m_TexEnvs?.find(([name]) => name === "_MainTex")?.[1];
    if (!material || material.type !== "Material" || shader?.pathId !== SWORD_SOURCE_ADDITIVE_IMAGE_SHADER
        || material.shaderName !== "NKC/Mobile/Particles/Additive" || floats.get("_Src") !== 5 || floats.get("_Dst") !== 1
        || (fields?.m_ValidKeywords as unknown[] | undefined)?.length !== 0 || !texture || String(texture.m_Texture.m_PathID) !== "0"
        || component?.fields.m_UseSpriteMesh || image.imageType !== 0) {
        throw new Error(`Unsupported original Sword Training additive Image material: ${node.path}`);
    }
    return { assetId: reference.assetId, shaderName: "NKC/Mobile/Particles/Additive", sourceBlend: 5, destinationBlend: 1,
        textureScale: [texture.m_Scale.x, texture.m_Scale.y], textureOffset: [texture.m_Offset.x, texture.m_Offset.y] };
}
/** Source fragment is texture * saturated Color32 (no factor two); Blend SrcAlpha One. */
export function swordTrainingAdditiveImageContribution(texture: ClientColor, color: ClientColor): ClientColor {
    const vertex = swordTrainingColor32(color);
    const alpha = texture[3] * vertex[3];
    // Zero compositing alpha retains destination RGB in the browser's premultiplied surface.
    return [texture[0] * vertex[0] * alpha, texture[1] * vertex[1] * alpha, texture[2] * vertex[2] * alpha, 0];
}
/** Original Image.GenerateSimpleSprite quad; source ST uses Unity bottom-origin UVs. */
export function swordTrainingAdditiveImageQuad(image: SwordClientImage, width: number, height: number, pivot: ClientVector2, material: SwordClientAdditiveImageMaterial) {
    let left = 0, top = 0, drawnWidth = width, drawnHeight = height;
    if (image.preserveAspect && image.pixelSize) {
        const ratio = image.pixelSize[0] / image.pixelSize[1];
        if (ratio > width / height) {
            drawnHeight = width / ratio;
            top = (height - drawnHeight) * (1 - pivot[1]);
        }
        else {
            drawnWidth = height * ratio;
            left = (width - drawnWidth) * pivot[0];
        }
    }
    const [sx, sy] = material.textureScale, [ox, oy] = material.textureOffset;
    const uv = (u: number, v: number) => [u * sx + ox, v * sy + 1 - sy - oy];
    return { positions: [left, top, left, top + drawnHeight, left + drawnWidth, top + drawnHeight, left + drawnWidth, top],
        uvs: [...uv(0, 0), ...uv(0, 1), ...uv(1, 1), ...uv(1, 0)], indices: [0, 1, 2, 2, 3, 0] };
}
