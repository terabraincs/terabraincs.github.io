/** Original NKC_FXM_MATERIAL_UI branches used by the two Cafe ring meshes. */
import { swordParticleGradient } from "./swordTrainingClientParticles";
import type { SwordClientComponent } from "./swordTrainingClientLayout";
export type CafeMaterialValuesV2 = Record<string, number | number[]>;
export type CafeFxmEvaluatorFrameV2 = {
    playback: number;
    delta: number;
    executing: boolean;
    revision: number;
};
type Property = {
    Enable: number;
    RandomValue: number;
    Mode: number;
    PropertyName: string;
    ConstantX: number;
    ConstantY: number;
    ConstantZ: number;
    ConstantW: number;
    TimeZ: number;
    TimeW: number;
    Gradient: Parameters<typeof swordParticleGradient>[0];
};
const f32 = Math.fround;
/** One original evaluator instance. update() must receive each revision once,
 * in source writer order. It does not own PLAYER/reset/loop clocks. */
export class CafeStregaFxmMaterialV2 {
    readonly targetPath: string;
    private revision = -1;
    private properties: Property[];
    private enabled = false;
    private values: CafeMaterialValuesV2;
    constructor(private component: SwordClientComponent, sourceValues: CafeMaterialValuesV2) {
        if (component.type !== "NKC_FXM_MATERIAL_UI" || component.fields.RandomValue)
            throw new Error("Unaudited Cafe material evaluator");
        const target = component.references.find(r => r.field === "Target");
        if (!target?.nodePath)
            throw new Error("Unresolved original material target");
        this.targetPath = target.nodePath;
        this.properties = structuredClone(component.fields.Properties) as Property[];
        if (this.properties.some(p => p.RandomValue || ![0, 2, 10, 12, 17].includes(p.Mode)))
            throw new Error("Unaudited Cafe material property");
        this.values = structuredClone(sourceValues);
    }
    update(frame: CafeFxmEvaluatorFrameV2): {
        enabled: boolean;
        values: CafeMaterialValuesV2;
    } {
        if (frame.revision === this.revision)
            return this.snapshot();
        this.revision = frame.revision;
        if (this.component.fields.SyncRenderer)
            this.enabled = frame.executing;
        const duration = Number(this.component.fields.Duration);
        const normalized = duration === 0 ? 0 : f32(frame.playback / duration);
        for (const p of this.properties) {
            if (!p.Enable)
                continue;
            switch (p.Mode) {
                case 0:
                case 12:
                    this.values[p.PropertyName] = p.ConstantX;
                    break;
                case 2:
                    this.values[p.PropertyName] = [p.ConstantX, p.ConstantY, p.ConstantZ, p.ConstantW];
                    break;
                case 10: {
                    const c = swordParticleGradient(p.Gradient, normalized);
                    this.values[p.PropertyName] = [c.r, c.g, c.b, c.a];
                    break;
                }
                case 17: {
                    // ExecuteProperty(false,!executing), IL_14D0. AnimateTime wraps once
                    // at +/-10; constants Z/W are state, not frame-local offsets.
                    const animate = (value: number, speed: number) => {
                        if (Math.abs(speed) <= 1e-5 || !frame.executing)
                            return 0;
                        const next = f32(value + f32(f32(frame.delta * f32(.1)) * speed));
                        return next > 10 ? f32(next - 10) : next < -10 ? f32(next + 10) : next;
                    };
                    p.ConstantZ = animate(p.ConstantZ, p.TimeZ);
                    p.ConstantW = animate(p.ConstantW, p.TimeW);
                    const value = this.values[p.PropertyName];
                    if (!Array.isArray(value) || value.length !== 4)
                        throw new Error("Missing source vector material property");
                    this.values[p.PropertyName] = [value[0], value[1], f32(value[2] + p.ConstantZ), f32(value[3] + p.ConstantW)];
                    break;
                }
            }
        }
        return this.snapshot();
    }
    snapshot(): {
        enabled: boolean;
        values: CafeMaterialValuesV2;
    } { return { enabled: this.enabled, values: structuredClone(this.values) }; }
    clone(): CafeStregaFxmMaterialV2 { return Object.assign(Object.create(CafeStregaFxmMaterialV2.prototype), this, { properties: structuredClone(this.properties), values: structuredClone(this.values) }); }
}
/** Original ActionType=PlayContinue (2). The source OnExecute/OnReset never
 * stops these systems. Invoke start() on EVALUATER.OnStart, not every revision.
 * Actual parent GameObject deactivation remains the scene's responsibility. */
export function cafeParticleControllerTargetsV2(component: SwordClientComponent): string[] {
    const f = component.fields;
    if (component.type !== "NKC_FXM_PARTICLE_SYSTEM_RENDERER" || f.ActionType !== 2 || f.RandomValue || f.SeedType !== 1) {
        throw new Error("Unaudited original Cafe particle controller");
    }
    const targets = component.references.filter(r => /^Targets\[\d+\]$/.test(r.field));
    if (!targets.length || targets.some(r => !r.nodePath))
        throw new Error("Unresolved original Cafe particle targets");
    return targets.map(r => r.nodePath!);
}
