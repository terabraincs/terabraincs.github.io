import { sampleSwordTrainingClientDecoration, type SwordTrainingClientDecorationPose } from "./swordTrainingClientDecoration";
import type { SwordClientComponent, SwordClientNode } from "./swordTrainingClientLayout";
type TweenClock = {
    component: SwordClientComponent;
    initialized: boolean;
    elapsed: number;
    killed: boolean;
};
export type SwordTrainingPrefabMotionFrame = {
    attributes: SwordTrainingClientDecorationPose;
    /** null means the source Restart/Stop has cleared the image. */
    fxPlayback: number | null;
};
/** Instance lifetime follows Unity GameObject lifetime, not its active flag. */
export class SwordTrainingClientPrefabMotion {
    private readonly tweens: TweenClock[];
    private readonly manager?: SwordClientComponent;
    private readonly player?: SwordClientComponent;
    private active: boolean;
    private time: number;
    private fxTime = 0;
    private fxPlayback: number | null = null;
    constructor(node: SwordClientNode, private readonly initial: Readonly<SwordTrainingClientDecorationPose>, elapsed: number, active: boolean, private readonly maximumDeltaTime: number, private readonly maximumParticleDeltaTime: number) {
        this.tweens = node.components.filter(c => c.type === "DOTweenAnimation").map(component => ({ component, initialized: active, elapsed: 0, killed: false }));
        this.manager = node.components.find(c => c.type === "DOTweenVisualManager" && c.fields.m_Enabled);
        this.player = node.components.find(c => c.type === "NKC_FXM_PLAYER" && c.fields.m_Enabled);
        this.active = active;
        this.time = elapsed;
    }
    update(elapsed: number, active: boolean): SwordTrainingPrefabMotionFrame {
        if (!Number.isFinite(elapsed) || elapsed < this.time)
            throw new RangeError("Prefab time must be finite and monotonic");
        const rawDelta = elapsed - this.time;
        const delta = Math.min(this.maximumDeltaTime, rawDelta);
        this.time = elapsed;
        const enabled = active && !this.active;
        const disabled = !active && this.active;
        for (const tween of this.tweens) {
            if (!tween.initialized && active) {
                tween.initialized = true;
                tween.elapsed = 0;
                continue;
            }
            if (!tween.initialized)
                continue;
            if (tween.killed)
                continue;
            const onEnable = Number(this.manager?.fields.onEnableBehaviour ?? 0);
            const onDisable = Number(this.manager?.fields.onDisableBehaviour ?? 0);
            if (enabled && onEnable === 2) {
                tween.elapsed = 0;
                continue;
            }
            if (onEnable !== 0 && onEnable !== 2)
                throw new Error("Unverified source tween enable behaviour");
            if (onDisable !== 0 && onDisable !== 1)
                throw new Error("Unverified source tween disable behaviour");
            if (!active && onDisable === 1)
                continue;
            // No VisualManager means DOTween's global updater continues while hidden.
            tween.elapsed += delta;
            const fields = tween.component.fields;
            if (fields.autoKill && Number(fields.loops) > 0 && tween.elapsed >= Number(fields.delay) + Number(fields.duration) * Number(fields.loops))
                tween.killed = true;
        }
        if (this.player) {
            const fields = this.player.fields;
            if (disabled || enabled) {
                this.fxTime = 0;
                this.fxPlayback = null;
            }
            if (active && !enabled && fields.AutoStart) {
                const frameDelta = Number(fields.TimeMode) === 0 ? Math.min(delta, this.maximumParticleDeltaTime) : rawDelta;
                const duration = Number(fields.Duration);
                const total = Math.fround(this.fxTime + Math.fround(frameDelta * Number(fields.TimeScale)));
                if (fields.Loop) {
                    this.fxTime = Math.fround(total - Math.floor(total / duration) * duration);
                    // Source skips Evaluate on an exact loop boundary, retaining prior colour.
                    if (this.fxTime > 0 && this.fxTime < duration)
                        this.fxPlayback = this.fxTime;
                }
                else {
                    this.fxTime = Math.max(0, Math.min(total, duration));
                    this.fxPlayback = this.fxTime >= duration ? null : this.fxTime;
                }
            }
        }
        this.active = active;
        return this.snapshot();
    }
    snapshot(): SwordTrainingPrefabMotionFrame {
        const attributes: SwordTrainingClientDecorationPose = {};
        for (const tween of this.tweens) {
            if (tween.initialized)
                Object.assign(attributes, sampleSwordTrainingClientDecoration(tween.component.fields, tween.elapsed, this.initial));
        }
        return { attributes, fxPlayback: this.fxPlayback };
    }
    /** React may abandon a render: evaluate on a clone, commit only after render. */
    preview(elapsed: number, active: boolean): SwordTrainingPrefabMotionFrame {
        const copy = Object.assign(Object.create(SwordTrainingClientPrefabMotion.prototype), this, { tweens: this.tweens.map(tween => ({ ...tween })) }) as SwordTrainingClientPrefabMotion;
        return copy.update(elapsed, active);
    }
}
