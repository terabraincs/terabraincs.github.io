/** Values are extracted from Unity's AnimationClip, not replacement CSS easing. */
export type SwordTrainingClientSlope = number | "Infinity" | "-Infinity" | "NaN";
export type SwordTrainingClientAnimationKey = {
    time: number;
    value: number;
    inSlope?: SwordTrainingClientSlope;
    outSlope?: SwordTrainingClientSlope;
    /** AssetStudio's original cubic [a, b, c, d], evaluated at time - key.time. */
    coeff?: readonly number[];
};
export type SwordTrainingClientAnimationCurve = {
    relativePath: string | null;
    attribute: string | null;
    source?: string;
    keys: readonly SwordTrainingClientAnimationKey[];
};
export type SwordTrainingClientAnimationClip = {
    name?: string;
    stopTime: number;
    loopTime?: boolean;
    decodedCurves: readonly SwordTrainingClientAnimationCurve[];
};
export type SwordTrainingClientAnimationPose = Record<string, Record<string, number>>;
function isStepSlope(slope: SwordTrainingClientSlope | undefined): boolean {
    return slope === "Infinity" || slope === "-Infinity" || slope === Infinity || slope === -Infinity;
}
function finiteSlope(slope: SwordTrainingClientSlope | undefined): number {
    return typeof slope === "number" && Number.isFinite(slope) ? slope : 0;
}
/** Sample a scalar curve. Input keys remain untouched and must retain source order. */
export function sampleSwordTrainingClientCurve(curve: SwordTrainingClientAnimationCurve, timeSeconds: number): number | undefined {
    if (!Number.isFinite(timeSeconds))
        throw new RangeError("Animation time must be finite");
    const { keys } = curve;
    if (keys.length === 0)
        return undefined;
    // Upper bound chooses the last key at a duplicate timestamp, including zero-length clips.
    let low = 0;
    let high = keys.length;
    while (low < high) {
        const middle = (low + high) >>> 1;
        if (keys[middle].time <= timeSeconds)
            low = middle + 1;
        else
            high = middle;
    }
    if (low === 0)
        return keys[0].value;
    const left = keys[low - 1];
    const right = keys[low];
    if (!right || timeSeconds === left.time || curve.source === "m_ConstantClip")
        return left.value;
    if (isStepSlope(left.outSlope) || isStepSlope(right.inSlope))
        return left.value;
    const duration = right.time - left.time;
    if (!(duration > 0))
        return right.value;
    const elapsed = timeSeconds - left.time;
    const fraction = elapsed / duration;
    if (curve.source === "m_DenseClip")
        return left.value + (right.value - left.value) * fraction;
    // Streamed data already contains the exact polynomial. Avoid recomputing its
    // tangents from rounded frame values (ReadData has already decoded those too).
    if (left.coeff?.length === 4) {
        const [a, b, c, d] = left.coeff;
        return ((a * elapsed + b) * elapsed + c) * elapsed + d;
    }
    // Unpacked Unity keyframes use cubic Hermite slopes in value-units per second.
    const squared = fraction * fraction;
    const cubed = squared * fraction;
    return (2 * cubed - 3 * squared + 1) * left.value
        + (cubed - 2 * squared + fraction) * duration * finiteSlope(left.outSlope)
        + (-2 * cubed + 3 * squared) * right.value
        + (cubed - squared) * duration * finiteSlope(right.inSlope);
}
/** Does not mutate the manifest, persist state, or infer Animator state transitions. */
export function sampleSwordTrainingClientAnimation(clip: SwordTrainingClientAnimationClip, timeSeconds: number): SwordTrainingClientAnimationPose {
    if (!Number.isFinite(timeSeconds))
        throw new RangeError("Animation time must be finite");
    if (!Number.isFinite(clip.stopTime) || clip.stopTime < 0)
        throw new RangeError("Invalid AnimationClip stopTime");
    const elapsed = Math.max(0, timeSeconds);
    const time = clip.stopTime === 0 ? 0
        : clip.loopTime ? elapsed % clip.stopTime : Math.min(elapsed, clip.stopTime);
    const pose: SwordTrainingClientAnimationPose = Object.create(null);
    for (const curve of clip.decodedCurves) {
        if (curve.relativePath === null || curve.attribute === null)
            continue;
        const value = sampleSwordTrainingClientCurve(curve, time);
        if (value === undefined || !Number.isFinite(value))
            continue;
        const attributes = pose[curve.relativePath] ??= Object.create(null);
        attributes[curve.attribute] = value;
    }
    return pose;
}
