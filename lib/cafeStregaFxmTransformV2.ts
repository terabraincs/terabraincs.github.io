/** Fresh original DLL port, limited to the transform branches in Cafe v2. */
import { sampleSwordTrainingClientCurve } from "./swordTrainingClientAnimation.ts";
import type { SwordClientComponent } from "./swordTrainingClientLayout";
type Vec3 = readonly [
    number,
    number,
    number
];
export type CafeFxmTransformPoseV2 = {
    localPosition: Vec3;
    localScale: Vec3;
    localRotationZ: number;
};
type Fields = Record<string, unknown>;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const f32 = Math.fround;
const numeric = (fields: Fields, key: string) => {
    const value = fields[key];
    if (typeof value !== "number" || !Number.isFinite(value))
        throw new Error(`Missing original FXM number: ${key}`);
    return value;
};
function curve(fields: Fields, key: string, time: number): number {
    const value = fields[key] as {
        m_Curve?: Array<{
            time: number;
            value: number;
            inSlope: number;
            outSlope: number;
            weightedMode: number;
        }>;
    };
    const keys = value?.m_Curve;
    if (!keys?.length || keys.some(point => point.weightedMode !== 0))
        throw new Error(`Unaudited FXM curve: ${key}`);
    const sampled = sampleSwordTrainingClientCurve({ relativePath: "", attribute: key, keys }, time);
    if (sampled === undefined)
        throw new Error(`Unresolved FXM curve: ${key}`);
    return f32(sampled);
}
/**
 * One evaluator instance, not one source GameObject. The owning FXM_PLAYER must
 * call reset() on Restart/Stop and step() only when UpdateEvaluater runs. Pass
 * its actual capped/scaled frame delta, not the difference of wrapped playback.
 * All returned positions/scales are absolute local transform values, not
 * offsets/multipliers of prefab values. The caller resolves target nodePath.
 */
export class CafeStregaFxmTransformV2 {
    readonly targetPath: string;
    private readonly component: SwordClientComponent;
    private completed = false;
    private playback = 0;
    private pose: CafeFxmTransformPoseV2;
    private readonly fields: Fields;
    constructor(component: SwordClientComponent, initial: CafeFxmTransformPoseV2) {
        this.component = component;
        this.fields = component.fields;
        this.pose = { ...initial };
        const f = this.fields;
        if (!["NKC_FXM_SCALE", "NKC_FXM_POSITION", "NKC_FXM_ROTATE"].includes(component.type))
            throw new Error("Not a source FXM transform");
        if (f.RandomValue || f.UseMultiTargets || f.UseMultiRandom)
            throw new Error("Unaudited random/multitarget FXM transform");
        const target = component.references.find(reference => reference.field === "Target");
        if (!target?.nodePath)
            throw new Error("Unresolved original FXM target");
        this.targetPath = target.nodePath;
        if (component.type === "NKC_FXM_POSITION" && !(f.SeparateAxes && f.Dimension === 1))
            throw new Error("Unaudited position branch");
        if (component.type === "NKC_FXM_ROTATE") {
            if (f.Space !== 1)
                throw new Error("Unaudited rotate world space");
            if (f.SeparateAxes && (f.FactorX !== 0 || f.FactorY !== 0))
                throw new Error("Unaudited rotate X/Y");
        }
    }
    private execute(playback: number, delta: number): void {
        const f = this.fields;
        if (!f.m_Enabled)
            return;
        const duration = numeric(f, "Duration");
        const t = duration === 0 ? 0 : f32(playback / duration);
        const x = f32(curve(f, "CurveX", t) * numeric(f, "FactorX"));
        if (this.component.type === "NKC_FXM_SCALE") {
            const separate = Boolean(f.SeparateAxes);
            const y = separate ? f32(curve(f, "CurveY", t) * numeric(f, "FactorY")) : x;
            const z = f.Dimension !== 0 ? 1 : separate ? f32(curve(f, "CurveZ", t) * numeric(f, "FactorZ")) : x;
            this.pose = { ...this.pose, localScale: [x, y, z] };
        }
        else if (this.component.type === "NKC_FXM_POSITION") {
            const y = f32(curve(f, "CurveY", t) * numeric(f, "FactorY"));
            this.pose = { ...this.pose, localPosition: [x, y, 0] };
        }
        else if (playback <= 0) {
            // NKC_FXM_ROTATE.OnExecute assigns Vector3.zero, not the prefab rotation.
            this.pose = { ...this.pose, localRotationZ: 0 };
        }
        else {
            const speed = f32(delta * numeric(f, "Speed"));
            const axis = f.SeparateAxes ? f32(curve(f, "CurveZ", t) * numeric(f, "FactorZ")) : x;
            this.pose = { ...this.pose, localRotationZ: f32(this.pose.localRotationZ + f32(axis * speed)) };
        }
    }
    reset(): CafeFxmTransformPoseV2 {
        this.completed = false;
        const mode = numeric(this.fields, "ResetMode");
        if (mode === 0 || mode === 1) {
            this.playback = 0;
            this.execute(0, 0);
        }
        else if (mode !== 2)
            throw new Error("Unaudited reset mode");
        return this.snapshot();
    }
    step(playerPlayback: number, delta: number): CafeFxmTransformPoseV2 {
        if (!Number.isFinite(playerPlayback) || !Number.isFinite(delta) || delta < 0)
            throw new Error("Invalid source FXM clock");
        if (this.completed)
            return this.snapshot();
        const f = this.fields;
        const start = numeric(f, "StartTime"), duration = numeric(f, "Duration");
        // Original PLAYER.UpdateEvaluater does not execute a not-yet-started item.
        if (playerPlayback < start && this.playback <= 0)
            return this.snapshot();
        this.playback = f32(clamp(f32(playerPlayback - start), 0, duration));
        this.execute(this.playback, delta);
        if (this.playback >= duration) {
            this.completed = true;
            // Original EVALUATER.OnComplete calls OnExecute(false) only for mode 0.
            if (numeric(f, "ResetMode") === 0) {
                this.playback = 0;
                this.execute(0, 0);
            }
        }
        return this.snapshot();
    }
    snapshot(): CafeFxmTransformPoseV2 { return { ...this.pose }; }
    clone(): CafeStregaFxmTransformV2 {
        return Object.assign(Object.create(CafeStregaFxmTransformV2.prototype), this, { pose: { ...this.pose } });
    }
    /** Original loop clears completion only, unlike Restart/Stop. */
    loop(): void { this.completed = false; }
}
