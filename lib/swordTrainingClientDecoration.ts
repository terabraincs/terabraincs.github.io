import { sampleSwordTrainingClientCurve } from "./swordTrainingClientAnimation.ts";
import type { SwordTrainingClientAnimationKey } from "./swordTrainingClientAnimation.ts";
/** Only behaviours present in the freshly extracted Sword Training prefab. */
export type SwordTrainingClientSerializedFields = Readonly<Record<string, unknown>>;
export type SwordTrainingClientRgba = readonly [
    number,
    number,
    number,
    number
];
export type SwordTrainingClientDecorationPose = Record<string, number>;
function number(fields: SwordTrainingClientSerializedFields, key: string): number {
    const value = fields[key];
    if (typeof value !== "number" || !Number.isFinite(value))
        throw new Error(`Missing source number: ${key}`);
    return value;
}
function record(fields: SwordTrainingClientSerializedFields, key: string): SwordTrainingClientSerializedFields {
    const value = fields[key];
    if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error(`Missing source object: ${key}`);
    return value as SwordTrainingClientSerializedFields;
}
function flag(fields: SwordTrainingClientSerializedFields, key: string): boolean {
    const value = fields[key];
    if (value !== 0 && value !== 1 && value !== false && value !== true)
        throw new Error(`Missing source flag: ${key}`);
    return Boolean(value);
}
/** Original NKMTrackingFloat.TrackRatio(TDT_SLOWER), including float32 rounding. */
export function sampleSwordTrainingClientButtonTracking(start: number, target: number, elapsed: number, duration: number): number {
    if (![start, target, elapsed, duration].every(Number.isFinite) || duration < 0)
        throw new RangeError("Invalid tracking arguments");
    if (elapsed <= 0)
        return Math.fround(start);
    if (elapsed >= duration || duration === 0)
        return Math.fround(target);
    const f = Math.fround;
    const ratio = f(1 - f(Math.pow(f(1 - f(f(elapsed) / f(duration))), 3)));
    return f(f(start) + f(f(f(target) - f(start)) * ratio));
}
/** OnPointerDown resets to one; OnPointerUp starts from the current tracked value. */
export class SwordTrainingClientButtonScale {
    value = 1;
    private start = 1;
    private target = 1;
    private elapsed = 0;
    private tracking = false;
    readonly touchSize: number;
    readonly selectSize: number;
    readonly trackingTime: number;
    constructor(fields: SwordTrainingClientSerializedFields) {
        this.touchSize = number(fields, "m_fTouchSize");
        this.selectSize = number(fields, "m_fSelectSize");
        this.trackingTime = number(fields, "m_fTrackingTime");
    }
    pointerDown(): void {
        this.value = 1;
        this.setTracking(this.touchSize);
    }
    pointerUp(selected = false): void {
        this.setTracking(selected ? this.selectSize : 1);
    }
    /** Source PointerExit changes the state, but intentionally does not stop scale tracking. */
    pointerExit(): void { }
    disable(): void {
        this.tracking = false;
        this.value = 1;
    }
    update(deltaSeconds: number): number {
        if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0)
            throw new RangeError("Invalid frame time");
        if (this.tracking) {
            this.elapsed = Math.fround(this.elapsed + Math.fround(deltaSeconds));
            this.value = sampleSwordTrainingClientButtonTracking(this.start, this.target, this.elapsed, this.trackingTime);
            if (this.elapsed >= this.trackingTime)
                this.tracking = false;
        }
        return this.value;
    }
    preview(deltaSeconds: number): number {
        const copy = Object.assign(Object.create(SwordTrainingClientButtonScale.prototype), this) as SwordTrainingClientButtonScale;
        return copy.update(deltaSeconds);
    }
    private setTracking(target: number): void {
        this.start = this.value;
        this.target = target;
        this.elapsed = 0;
        this.tracking = true;
    }
}
function tweenFraction(fields: SwordTrainingClientSerializedFields, elapsed: number): number {
    const duration = number(fields, "duration");
    const loops = number(fields, "loops");
    const loopType = number(fields, "loopType");
    const ease = number(fields, "easeType");
    if (!(duration > 0) || (loops !== -1 && loops < 1))
        throw new Error("Unsupported source tween duration/loops");
    if (loopType !== 0 && loopType !== 1)
        throw new Error("Unverified tween loop type");
    const rawTime = Math.max(0, elapsed - number(fields, "delay"));
    const time = loops === -1 ? rawTime : Math.min(rawTime, duration * loops);
    let iteration = Math.floor(time / duration);
    let position = time - iteration * duration;
    // DOTween holds the just-finished endpoint on an exact loop boundary.
    if (time > 0 && position === 0) {
        iteration -= 1;
        position = duration;
    }
    let ratio = position / duration;
    if (loopType === 1 && iteration % 2 === 1)
        ratio = 1 - ratio;
    if (ease === 1)
        return ratio; // DG.Tweening.Ease.Linear
    if (ease === 6)
        return -ratio * (ratio - 2); // DG.Tweening.Ease.OutQuad
    throw new Error(`Unverified Sword Training tween ease: ${ease}`);
}
/**
 * Applies only properties declared by DOTweenAnimation.CreateTween. `initial`
 * must be the actual startup values, not the previous sampled pose. Rotation
 * uses world Euler values because source Rotate calls Transform.DORotate.
 */
export function sampleSwordTrainingClientDecoration(fields: SwordTrainingClientSerializedFields, elapsedSeconds: number, initial: Readonly<SwordTrainingClientDecorationPose>): SwordTrainingClientDecorationPose {
    if (!Number.isFinite(elapsedSeconds))
        throw new RangeError("Invalid tween time");
    if (!flag(fields, "isActive") || !flag(fields, "isValid") || !flag(fields, "autoGenerate"))
        return {};
    if (flag(fields, "isRelative") || flag(fields, "isSpeedBased") || flag(fields, "useTargetAsV3"))
        throw new Error("Unverified source tween options");
    const fraction = tweenFraction(fields, flag(fields, "autoPlay") ? elapsedSeconds : 0);
    const type = number(fields, "animationType");
    const targetType = number(fields, "targetType");
    const from = flag(fields, "isFrom");
    const pose: SwordTrainingClientDecorationPose = {};
    const sample = (attribute: string, end: number, rotationMode?: number) => {
        const original = initial[attribute];
        if (!Number.isFinite(original))
            throw new Error(`Missing actual tween startup value: ${attribute}`);
        let start = from ? end : original;
        let target = from ? original : end;
        if (rotationMode === 0) {
            start = (start % 360 + 360) % 360;
            target = (target % 360 + 360) % 360;
            let change = target - start;
            if (change > 180)
                change -= 360;
            else if (change < -180)
                change += 360;
            target = start + change;
        }
        else if (rotationMode !== undefined && rotationMode !== 1)
            throw new Error("Unverified rotation mode");
        pose[attribute] = start + (target - start) * fraction;
    };
    if (type === 1 && targetType === 5) {
        if (flag(fields, "optionalBool0"))
            throw new Error("Unexpected snapped UI move");
        const end = record(fields, "endValueV3");
        for (const axis of ["x", "y", "z"])
            sample(`m_AnchoredPosition.${axis}`, number(end, axis));
    }
    else if (type === 3 && targetType === 11) {
        const end = record(fields, "endValueV3");
        for (const axis of ["x", "y", "z"])
            sample(`worldEulerAngles.${axis}`, number(end, axis), number(fields, "optionalRotationMode"));
    }
    else if (type === 5 && targetType === 11) {
        const uniform = flag(fields, "optionalBool0");
        const end = record(fields, "endValueV3");
        for (const axis of ["x", "y", "z"])
            sample(`m_LocalScale.${axis}`, uniform ? number(fields, "endValueFloat") : number(end, axis));
    }
    else if (type === 7 && (targetType === 2 || targetType === 3)) {
        sample(targetType === 2 ? "m_Alpha" : "m_Color.a", number(fields, "endValueFloat"));
    }
    else
        throw new Error(`Unverified source tween type/target: ${type}/${targetType}`);
    return pose;
}
function gradientChannel(gradient: SwordTrainingClientSerializedFields, channel: string, time: number): number {
    if (number(gradient, "m_Mode") !== 0)
        throw new Error("Unverified gradient mode");
    const alpha = channel === "a";
    const count = number(gradient, alpha ? "m_NumAlphaKeys" : "m_NumColorKeys");
    const prefix = alpha ? "atime" : "ctime";
    if (count < 1)
        throw new Error("Empty source gradient");
    const value = (i: number) => number(record(gradient, `key${i}`), channel);
    if (time <= number(gradient, `${prefix}0`) / 65535)
        return value(0);
    for (let i = 1; i < count; i += 1) {
        const right = number(gradient, `${prefix}${i}`) / 65535;
        if (time <= right) {
            const left = number(gradient, `${prefix}${i - 1}`) / 65535;
            const ratio = right === left ? 1 : (time - left) / (right - left);
            return value(i - 1) + (value(i) - value(i - 1)) * ratio;
        }
    }
    return value(count - 1);
}
function scalarCurve(fields: SwordTrainingClientSerializedFields, key: string, time: number): number {
    const curve = record(fields, key).m_Curve;
    if (!Array.isArray(curve) || !curve.length)
        throw new Error(`Empty source curve: ${key}`);
    for (const point of curve)
        if (point.weightedMode !== 0)
            throw new Error("Unverified weighted curve");
    const result = sampleSwordTrainingClientCurve({ relativePath: "", attribute: key, keys: curve as SwordTrainingClientAnimationKey[] }, time);
    if (result === undefined)
        throw new Error(`Unresolved source curve: ${key}`);
    return result;
}
/**
 * NKC_FXM_UI_IMAGE_PMA.SetOutputColor. Input is the FX player's current
 * playback time (already looped/capped by its clock), not wall-clock time.
 * Color is deliberately NOT normal-alpha RGBA: alpha zero can have lit RGB.
 * Renderer applies original Graphic.Color32 quantization and PMA shader.
 */
export function sampleSwordTrainingClientPmaImage(fields: SwordTrainingClientSerializedFields, playerPlaybackSeconds: number): SwordTrainingClientRgba {
    if (!Number.isFinite(playerPlaybackSeconds))
        throw new RangeError("Invalid FX time");
    if (!flag(fields, "m_Enabled"))
        return [0, 0, 0, 0];
    const gradient = record(fields, "MinMaxGradient");
    if (number(gradient, "m_Mode") !== 1)
        throw new Error("Unverified random/color gradient mode");
    const duration = number(fields, "Duration");
    const playback = Math.max(0, Math.min(duration, playerPlaybackSeconds - number(fields, "StartTime")));
    const time = duration === 0 ? 0 : playback / duration;
    const source = record(gradient, "m_GradientMax");
    const input = ["r", "g", "b", "a"].map((channel) => gradientChannel(source, channel, time));
    // In the no-alpha-curve source branch AlphaMultiplier is intentionally ignored.
    const alpha = flag(fields, "UseAlphaCurve") ? input[3] * scalarCurve(fields, "Curve", time) * number(fields, "AlphaMultiplier") : input[3];
    const boost = number(fields, "ColorBoost");
    const blend = number(fields, "BlendFactor") * (flag(fields, "UseBlendCurve") ? scalarCurve(fields, "Blend", time) : 1);
    return [input[0] * alpha * boost, input[1] * alpha * boost, input[2] * alpha * boost, alpha * Math.max(0, Math.min(1, blend))];
}
