/** UnityEngine.Color32.op_Implicit: Clamp01, float32 multiply, ties-to-even. */
export function swordTrainingColor32(color: readonly number[]): number[] {
    return color.map((value) => {
        if (!Number.isFinite(value))
            throw new RangeError("PMA vertex color must be finite");
        const scaled = Math.fround(Math.max(0, Math.min(1, value)) * 255);
        const floor = Math.floor(scaled);
        const rounded = scaled - floor === 0.5 ? (floor % 2 === 0 ? floor : floor + 1) : Math.round(scaled);
        return rounded / 255;
    });
}
