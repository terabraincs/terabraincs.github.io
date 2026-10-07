/** Fresh Cafe PS lifetime adapter. GPU presentation uses the shared original-equation pool. */
import { SwordTrainingParticleSystem, type SwordParticleSystemSource, type SwordParticleNativeMesh } from "./swordTrainingClientParticles";
import { CafeStregaCircleParticlesV2 } from "./cafeStregaCircleParticlesV2";
export type CafeParticleSourceV2 = (ConstructorParameters<typeof CafeStregaCircleParticlesV2>[0] | (Omit<SwordParticleSystemSource, "kind"> & {
    kind: "light";
})) & {
    source: {
        playOnAwake: boolean;
    };
    nativeInitial: {
        material: {
            shader: string;
        };
    };
};
export type CafeParticleLifetimeFrameV2 = {
    active: boolean;
    starts: number;
    delta: number;
    maximumDeltaTime: number;
    maximumParticleTimestep: number;
    /** Source GO false/true in the same JS turn, e.g. OnSelectMenu. */
    restartKey: string | number;
};
const EMPTY: SwordParticleNativeMesh = { positions: [], uv0: [], uv1: [], colors: [], triangles: [] };
const f = Math.fround;
/** Every original source PS gets one persistent instance; GPU readiness must
 * not delay its clock. Source parent SetActive(false) clears particles and PRNG.
 * Duration completion of the enclosing PLAYER does NOT clear or pause particles. */
export class CafeStregaParticlePlaybackV2 {
    private engine: SwordTrainingParticleSystem | CafeStregaCircleParticlesV2;
    private active = false;
    private starts = 0;
    private key: string | number | undefined;
    private playing = false;
    private elapsed = 0;
    private lastTime: number | null = null;
    constructor(readonly config: CafeParticleSourceV2) { this.engine = this.create(); }
    private create() { return this.config.kind === "light" ? new SwordTrainingParticleSystem(this.config as unknown as SwordParticleSystemSource) : new CafeStregaCircleParticlesV2(this.config); }
    private sourceStopped() { return this.config.kind !== "light" && (this.engine as CafeStregaCircleParticlesV2).isNativeStopped(); }
    update(frame: CafeParticleLifetimeFrameV2): SwordParticleNativeMesh {
        if (frame.delta < 0 || !Number.isFinite(frame.delta))
            throw new Error("Invalid Cafe particle frame delta");
        const changed = frame.restartKey !== this.key;
        if (frame.active !== this.active || changed) {
            this.engine = this.create();
            this.elapsed = 0;
            this.playing = frame.active && Boolean(this.config.source.playOnAwake);
        }
        const started = frame.starts > this.starts;
        this.active = frame.active;
        this.key = frame.restartKey;
        this.starts = frame.starts;
        if (!frame.active)
            return EMPTY;
        if (started) {
            // In Cafe, active restart always goes through GO false/true. Ordinary
            // PlayContinue calls while already emitting leave time/PRNG untouched.
            if (this.sourceStopped()) {
                this.engine = this.create();
                this.elapsed = 0;
            }
            this.playing = true;
        }
        if (this.playing) {
            const delta = Math.min(frame.maximumDeltaTime, frame.delta);
            this.engine.advanceFrame(delta, frame.maximumParticleTimestep);
            this.elapsed = f(this.elapsed + f(delta * this.config.source.simulationSpeed));
            if (this.config.source.looping && this.elapsed >= this.config.source.lengthInSec)
                this.elapsed = f(this.elapsed - this.config.source.lengthInSec);
            if (this.sourceStopped()) {
                this.playing = false;
                this.elapsed = this.config.source.lengthInSec;
            }
        }
        return this.engine.mesh();
    }
    snapshot() { return this.engine.snapshot(); }
    nativeState() {
        return { isPlaying: this.playing, isEmitting: this.playing && (this.config.source.looping || this.elapsed < this.config.source.lengthInSec),
            isStopped: !this.playing, time: this.config.source.looping ? this.elapsed : Math.min(this.elapsed, this.config.source.lengthInSec), particleCount: this.engine.snapshot().length };
    }
    clone(copyEngine = true): CafeStregaParticlePlaybackV2 {
        return Object.assign(Object.create(CafeStregaParticlePlaybackV2.prototype), this, copyEngine ? { engine: this.engine.clone() } : { engine: this.engine }) as CafeStregaParticlePlaybackV2;
    }
    updateAt(time: number, frame: Omit<CafeParticleLifetimeFrameV2, "delta">): SwordParticleNativeMesh {
        if (!Number.isFinite(time) || this.lastTime !== null && time < this.lastTime)
            throw new Error("Cafe particle clock must be monotonic");
        const delta = this.lastTime === null ? 0 : time - this.lastTime;
        this.lastTime = time;
        return this.update({ ...frame, delta });
    }
}
