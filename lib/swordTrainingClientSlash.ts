/** Original UI Image mesh and active AB_FX_UI_SLASH_03 evaluators. */
export type SwordTrainingSlashSource = {
    hierarchy: {
        path: string;
        active: boolean;
        transform: {
            localScale: {
                x: number;
                y: number;
                z: number;
            };
            SizeDelta?: {
                x: number;
                y: number;
            };
            Pivot?: {
                x: number;
                y: number;
            };
        };
    }[];
    evaluators: {
        component: string;
        path: string;
        duration: number;
        timeScale?: number;
        randomValue?: boolean;
        minimum?: {
            z: number;
        };
        maximum?: {
            z: number;
        };
        colorMax?: {
            r: number;
            g: number;
            b: number;
            a: number;
        };
        colorBoost?: number;
        blendFactor?: number;
        useAlphaCurve?: boolean;
        gradientMode?: number;
        curveX?: {
            time: number;
            value: number;
            inSlope: number;
            outSlope: number;
            weightedMode: number;
        }[];
    }[];
    sprites: {
        hit: {
            texture: string;
            vertices: number[][];
            triangles: number[];
            uvs: number[][];
            rect: number[];
            pivot: number[];
            boundsSize: number[];
            pixelsPerUnit: number;
        };
    };
};
export type SwordTrainingHitFx = {
    id: string;
    /** Canvas-space position of the weapon socket; Y down. */
    x: number;
    y: number;
    /** Socket ancestor scale; no left-side mirroring is added by the original hit path. */
    scaleX: number;
    scaleY: number;
    elapsed: number;
    /** One original Random.Range(0f, 360f) draw, retained for this playback. */
    randomRotationDegrees: number;
};
export type SwordTrainingHitMesh = {
    id: string;
    texture: string;
    positions: number[];
    uvs: number[];
    indices: number[];
    color: [
        number,
        number,
        number,
        number
    ];
};
export function sampleSwordTrainingHitFx(source: SwordTrainingSlashSource, effect: SwordTrainingHitFx): SwordTrainingHitMesh | null {
    if (!Number.isFinite(effect.elapsed) || effect.elapsed < 0)
        throw new RangeError("Invalid hit FX time");
    const root = "AB_FX_UI_SLASH_03";
    const player = source.evaluators.find((item) => item.path === root && item.component === "NKC_FXM_PLAYER");
    const rotation = source.evaluators.find((item) => item.path === `${root}/SLASH` && item.component === "NKC_FXM_ROTATION");
    const scale = source.evaluators.find((item) => item.component === "NKC_FXM_SCALE" && item.path.startsWith(root));
    const tint = source.evaluators.find((item) => item.component === "NKC_FXM_UI_IMAGE_PMA" && item.path.startsWith(root));
    const parent = source.hierarchy.find((item) => item.path === `${root}/SLASH`);
    const image = source.hierarchy.find((item) => item.path === `${root}/SLASH/GameObject/Image`);
    if (!player?.timeScale || !scale?.curveX || !tint?.colorMax || !rotation || !parent || !image?.transform.SizeDelta || !image.transform.Pivot) {
        throw new Error("Incomplete original Sword Training hit FX source");
    }
    if (!rotation.randomValue || rotation.minimum?.z !== 0 || rotation.maximum?.z !== 360)
        throw new Error("Unexpected original hit rotation configuration");
    if (!Number.isFinite(effect.randomRotationDegrees) || effect.randomRotationDegrees < 0 || effect.randomRotationDegrees > 360)
        throw new RangeError("Original hit rotation must be sampled in [0,360]");
    if (tint.gradientMode !== 0 || tint.useAlphaCurve || tint.colorBoost === undefined || tint.blendFactor === undefined)
        throw new Error("Unsupported original hit color evaluator");
    const playback = Math.fround(effect.elapsed * player.timeScale);
    if (playback >= player.duration)
        return null;
    const time = Math.min(1, Math.max(0, Math.fround(playback / scale.duration)));
    const keys = scale.curveX;
    if (keys.some((key) => key.weightedMode !== 0))
        throw new Error("Weighted hit FX curves require original evaluator support");
    let scaleValue = keys[keys.length - 1].value;
    for (let index = 0; index < keys.length - 1; index++) {
        const a = keys[index], b = keys[index + 1];
        if (time > b.time)
            continue;
        const duration = b.time - a.time, t = (time - a.time) / duration, t2 = t * t, t3 = t2 * t;
        scaleValue = (2 * t3 - 3 * t2 + 1) * a.value + (t3 - 2 * t2 + t) * duration * a.outSlope
            + (-2 * t3 + 3 * t2) * b.value + (t3 - t2) * duration * b.inSlope;
        break;
    }
    // Front camera 418 is orthographic. GenerateSprite divides by Sprite.bounds
    // (source full rect / PPU), not by the tight triangle bounding box.
    const sprite = source.sprites.hit;
    const size = image.transform.SizeDelta, pivot = image.transform.Pivot;
    const radians = effect.randomRotationDegrees * Math.PI / 180;
    const cos = Math.cos(radians), sin = Math.sin(radians);
    const positions = sprite.vertices.flatMap(([x, y]) => {
        const localX = (x / sprite.boundsSize[0] * size.x - (pivot.x - sprite.pivot[0]) * size.x) * scaleValue;
        const localY = (y / sprite.boundsSize[1] * size.y - (pivot.y - sprite.pivot[1]) * size.y) * scaleValue;
        return [effect.x + (localX * cos - localY * sin) * parent.transform.localScale.x * effect.scaleX,
            effect.y - (localX * sin + localY * cos) * parent.transform.localScale.y * effect.scaleY];
    });
    const c = tint.colorMax;
    const f = Math.fround;
    return { id: effect.id, texture: sprite.texture, positions, uvs: sprite.uvs.flat(), indices: sprite.triangles,
        color: [f(f(c.r * c.a) * tint.colorBoost), f(f(c.g * c.a) * tint.colorBoost), f(f(c.b * c.a) * tint.colorBoost),
            f(c.a * Math.min(1, Math.max(0, tint.blendFactor)))] };
}
