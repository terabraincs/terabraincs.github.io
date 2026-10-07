"use client";
import { useMemo } from "react";
import type { ClientColor, ClientVector2 } from "@/lib/swordTrainingClientLayout";
import { swordTrainingAdditiveImageQuad, type SwordClientAdditiveImageMaterial } from "@/lib/swordTrainingClientImageMaterial";
import type { SwordClientImage } from "./SwordTrainingImage";
import SwordTrainingPmaMeshes from "./SwordTrainingPmaMeshes";
/** Original MAT_NKC_ADD Image path, distinct from sprite-PMA and UiParticles shaders. */
export default function SwordTrainingAdditiveImage({ image, width, height, pivot, color = image.color, material }: {
    image: SwordClientImage;
    width: number;
    height: number;
    pivot: ClientVector2;
    color?: ClientColor;
    material: SwordClientAdditiveImageMaterial;
}) {
    const meshes = useMemo(() => image.webPath && width > 0 && height > 0 ? [{
            id: image.componentPathId, texture: image.webPath, color, sourceAlphaAdditive: true,
            ...swordTrainingAdditiveImageQuad(image, width, height, pivot, material),
        }] : [], [image, width, height, pivot, color, material]);
    return <div data-source-image-material={material.assetId} data-source-image-blend="SrcAlpha One" style={{ position: "absolute", inset: 0, width, height, pointerEvents: "none" }}>
    <SwordTrainingPmaMeshes width={width} height={height} meshes={meshes}/>
  </div>;
}
