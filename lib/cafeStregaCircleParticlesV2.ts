import { SwordTrainingParticleRandom as Random, swordParticleMinMaxCurve as curve, swordParticleGradient as gradient, swordParticleLimitRandom, type SwordNativeParticle, type SwordParticleNativeMesh, type SwordParticleSystemSource } from './swordTrainingClientParticles';
type Vector = {
    x: number;
    y: number;
    z: number;
};
type MinMaxCurve = SwordParticleSystemSource['source']['InitialModule']['startSpeed'];
type Source = Omit<SwordParticleSystemSource, 'source' | 'kind' | 'nativeInitial'> & {
    kind: 'ring' | 'burst' | 'complete' | 'reward';
    nativeInitial: SwordParticleSystemSource['nativeInitial'] & {
        localToWorld: number[];
    };
    nativeEvidence: {
        gravity3D: Vector;
    };
    source: SwordParticleSystemSource['source'] & {
        InitialModule: {
            gravityModifier: MinMaxCurve;
            gravitySource: number;
        };
        ShapeModule: {
            radius: {
                value: number;
                mode: number;
            };
            arc: {
                value: number;
                mode: number;
            };
            radiusThickness: number;
        };
        EmissionModule: {
            enabled: boolean;
            m_Bursts: {
                time: number;
                countCurve: MinMaxCurve;
                cycleCount: number;
                repeatInterval: number;
                probability: number;
            }[];
        };
        ForceModule: {
            enabled: boolean;
            x: MinMaxCurve;
            y: MinMaxCurve;
            z: MinMaxCurve;
            inWorldSpace: boolean;
            randomizePerFrame: boolean;
        };
        RotationModule: {
            enabled: boolean;
            curve: MinMaxCurve;
            separateAxes: boolean;
        };
    };
};
type Particle = SwordNativeParticle & {
    rotation: number;
    gravity: number;
    rotation3D?: Vector;
};
const f = Math.fround;
const axes = ['x', 'y', 'z'] as const;
const byte = (v: number) => Math.trunc(f(f(Math.max(0, Math.min(1, v)) * 255) + .5));
const salted = (seed: number, salt: number) => new Random((seed + salt) >>> 0);
/** Source-only Circle path; PRNG and modules verified against fresh native Emit/PlayerLoop oracles. */
export class CafeStregaCircleParticlesV2 {
    readonly config: Source;
    private initial: Random[];
    private shape: Random[];
    private particles: Particle[] = [];
    private playbackTime: number;
    private elapsed = 0;
    private accumulator: number;
    private nextCycles: number[];
    private gravityLocal: Vector;
    constructor(config: Source) {
        this.config = config;
        const s = config.source;
        if (s.ShapeModule.type !== 10 || s.ShapeModule.radius.mode || s.ShapeModule.arc.mode ||
            s.ShapeModule.radiusThickness < 0 || s.ShapeModule.radiusThickness > 1 || axes.some(axis => s.ShapeModule.m_Rotation[axis]) ||
            s.InitialModule.size3D || s.InitialModule.rotation3D || s.NoiseModule.enabled || s.SizeModule.separateAxes ||
            (s.EmissionModule.rateOverTime.scalar && config.kind !== 'reward') || s.InitialModule.gravitySource || s.ForceModule.inWorldSpace ||
            s.ForceModule.randomizePerFrame || s.RotationModule.separateAxes || s.ClampVelocityModule.separateAxis)
            throw new Error('Cafe particle source exceeds measured Circle module path');
        const state = new Map(config.nativeInitial.playbackState.map(x => [x.name, Number(x.value)]));
        const lanes = ['x', 'y', 'z', 'w'];
        const restore = (kind: string) => lanes.map((lane, index) => {
            const r = new Random(s.randomSeed, index);
            r.restore(lanes.map(axis => state.get(`m_${kind}.m_Random.${axis}.${lane}`) ?? NaN));
            return r;
        });
        this.initial = restore('Initial');
        this.shape = restore('Shape');
        this.playbackTime = config.nativeInitial.time;
        this.accumulator = f(state.get('m_Emission.m_ToEmitAccumulator') ?? 0);
        this.nextCycles = s.EmissionModule.m_Bursts.map(() => 0);
        if (config.nativeInitial.particles.length || this.playbackTime !== 0)
            throw new Error('Expected fresh native unstarted Circle system');
        const m = config.nativeInitial.localToWorld, g = config.nativeEvidence.gravity3D;
        const usesGravity = s.InitialModule.gravityModifier.scalar !== 0 || s.InitialModule.gravityModifier.minScalar !== 0;
        if (m.length !== 16 || usesGravity && [1, 2, 4, 6, 8, 9].some(i => m[i] !== 0))
            throw new Error('Unaudited rotated gravity transform');
        // Gravity is world-space acceleration: original native local-system path
        // uses the inverse transform including source parent scale (.92 in Cafe).
        this.gravityLocal = { x: f(g.x / m[0]), y: f(g.y / m[5]), z: f(g.z / m[10]) };
    }
    snapshot(): readonly Particle[] { return this.particles; }
    isNativeStopped(): boolean { return !this.config.source.looping && this.playbackTime >= this.config.source.lengthInSec && this.particles.length === 0; }
    clone(): CafeStregaCircleParticlesV2 {
        const copy = Object.assign(Object.create(CafeStregaCircleParticlesV2.prototype), this) as CafeStregaCircleParticlesV2;
        const duplicate = (r: Random) => { const n = new Random(0); n.restore(r.snapshot()); return n; };
        copy.initial = this.initial.map(duplicate);
        copy.shape = this.shape.map(duplicate);
        copy.particles = structuredClone(this.particles);
        copy.nextCycles = [...this.nextCycles];
        return copy;
    }
    advanceFrame(deltaSeconds: number, maximumParticleTimestep: number): void {
        if (!(maximumParticleTimestep > 0))
            throw new Error('Missing native particle timestep');
        const dt = f(deltaSeconds), count = Math.max(1, Math.ceil(f(dt / maximumParticleTimestep)));
        for (let i = 0; i < count; i++)
            this.advance(f(dt / count));
    }
    advance(deltaSeconds: number): void {
        if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0)
            throw new Error('Invalid particle delta');
        if (!deltaSeconds)
            return;
        const s = this.config.source, dt = f(deltaSeconds * s.simulationSpeed);
        this.elapsed += deltaSeconds;
        for (const p of this.particles) {
            this.move(p, dt);
            p.remainingLifetime = f(p.remainingLifetime - dt);
        }
        this.particles = this.particles.filter(p => p.remainingLifetime > 0);
        let next = f(this.playbackTime + dt);
        const emissionDelta = f(next - this.playbackTime);
        const emitTo = (end: number) => {
            s.EmissionModule.m_Bursts.forEach((burst, i) => {
                if (burst.probability !== 1 || burst.countCurve.minMaxState !== 0)
                    throw new Error('Unaudited random burst');
                for (;;) {
                    const cycle = this.nextCycles[i];
                    if (burst.cycleCount && cycle >= burst.cycleCount)
                        break;
                    const at = f(burst.time + f(cycle * burst.repeatInterval));
                    if (at >= s.lengthInSec || at > end)
                        break;
                    this.emit(burst.countCurve.scalar, dt);
                    this.nextCycles[i]++;
                }
            });
        };
        if (s.EmissionModule.enabled && (s.looping || this.playbackTime < s.lengthInSec)) {
            const rate = curve(s.EmissionModule.rateOverTime, this.elapsed);
            if (rate) {
                this.accumulator = f(this.accumulator + f(rate * emissionDelta));
                const count = Math.floor(this.accumulator);
                this.accumulator = f(this.accumulator - count);
                this.emitAged(count, ordinal => f((count - ordinal - 1 + this.accumulator) / rate));
            }
            emitTo(Math.min(next, s.lengthInSec));
            if (s.looping && next >= s.lengthInSec) {
                next = f(next - s.lengthInSec);
                this.nextCycles.fill(0);
                emitTo(next);
            }
        }
        this.playbackTime = next;
    }
    /** Also exercised directly against Unity Emit(count) without integration. */
    emit(count: number, age = 0): void {
        this.emitAged(count, () => age);
    }
    private emitAged(count: number, ageAt: (ordinal: number) => number): void {
        const s = this.config.source, init = s.InitialModule, shape = s.ShapeModule;
        for (let first = 0; first < count; first += 4) {
            const draws = this.initial.map(r => Array.from({ length: 5 }, () => r.nextUInt()));
            const points = this.shape.map(r => [r.nextFloat(), r.nextFloat()]);
            for (let lane = 0; lane < Math.min(4, count - first); lane++) {
                const age = ageAt(first + lane);
                const randomSeed = draws[lane][0], draw = (i: number) => f((draws[lane][i] & 0x7fffff) * f(1 / 0x7fffff));
                const angle = f(f(points[lane][0] * shape.arc.value) * f(Math.PI / 180));
                const inner = f(1 - shape.radiusThickness), innerSquared = f(inner * inner);
                const radius = f(f(Math.sqrt(f(innerSquared + f(f(1 - innerSquared) * points[lane][1])))) * shape.radius.value);
                const vector = { x: f(f(Math.cos(angle)) * shape.m_Scale.x), y: f(f(Math.sin(angle)) * shape.m_Scale.y), z: 0 };
                const norm = f(Math.hypot(vector.x, vector.y));
                // UnityPlayer 0x180D8AB91–0x180D8ACA6, salt at RVA 0x1AD93E0.
                const speed = curve(init.startSpeed, this.playbackTime, salted(randomSeed, 0x96aa4de3).nextFloat());
                const lifetime = curve(init.startLifetime, this.playbackTime, draw(1)), size = curve(init.startSize, this.playbackTime, draw(2));
                const color = init.startColor.minMaxState === 0 ? init.startColor.maxColor : init.startColor.minMaxState === 4 ? gradient(init.startColor.maxGradient, draw(4)) : null;
                if (!color)
                    throw new Error('Unaudited Circle initial gradient');
                const p: Particle = { randomSeed, startLifetime: lifetime, remainingLifetime: lifetime,
                    startSize3D: { x: size, y: size, z: size }, startColor: { r: byte(color.r), g: byte(color.g), b: byte(color.b), a: byte(color.a) },
                    position: { x: f(shape.m_Position.x + f(vector.x * radius)), y: f(shape.m_Position.y + f(vector.y * radius)), z: shape.m_Position.z },
                    velocity: { x: f(f(vector.x / norm) * speed), y: f(f(vector.y / norm) * speed), z: 0 },
                    animatedVelocity: { x: 0, y: 0, z: 0 },
                    rotation: curve(init.startRotation, this.playbackTime, draw(3)),
                    gravity: curve(init.gravityModifier, this.playbackTime, salted(randomSeed, 0xe2b7c3c3).nextFloat()) };
                this.move(p, age);
                p.remainingLifetime = f(lifetime - age);
                if (this.particles.length < init.maxNumParticles)
                    this.particles.push(p);
            }
        }
    }
    private move(p: Particle, dt: number): void {
        const s = this.config.source, age = f(1 - f(p.remainingLifetime / p.startLifetime));
        p.custom1 = { x: curve(s.CustomDataModule.vector0_0, age), y: curve(s.CustomDataModule.vector0_1, age) };
        // Native velocity module starts a fresh salted RNG and draws x/y/z in order.
        const r = salted(p.randomSeed, 0xe0fbd834), total = { x: 0, y: 0, z: 0 };
        for (const axis of axes) {
            const random = r.nextFloat();
            p.animatedVelocity[axis] = s.VelocityModule.enabled ? curve(s.VelocityModule[axis], age, random) : 0;
            const force = s.ForceModule.enabled ? curve(s.ForceModule[axis], age) : 0;
            p.velocity[axis] = f(p.velocity[axis] + f(f(f(this.gravityLocal[axis] * p.gravity) + force) * dt));
            total[axis] = f(p.velocity[axis] + p.animatedVelocity[axis]);
        }
        const limit = s.ClampVelocityModule;
        if (limit.enabled) {
            const speed = f(Math.hypot(total.x, total.y, total.z));
            const maximum = curve(limit.magnitude, age, swordParticleLimitRandom(p.randomSeed));
            if (speed > maximum && speed > 0) {
                const damping = f(1 - f(Math.pow(f(1 - limit.dampen), f(Math.abs(dt) * 30))));
                const clamped = f(speed + f(f(maximum - speed) * damping));
                for (const axis of axes) {
                    total[axis] = f(f(total[axis] / speed) * clamped);
                    p.velocity[axis] = f(total[axis] - p.animatedVelocity[axis]);
                }
            }
            if (limit.drag.scalar)
                throw new Error('Unaudited Circle drag');
        }
        const modifier = s.VelocityModule.enabled ? curve(s.VelocityModule.speedModifier, age) : 1;
        for (const axis of axes)
            p.position[axis] = f(p.position[axis] + f(f(total[axis] * modifier) * dt));
        if (s.RotationModule.enabled)
            p.rotation = f(p.rotation + f(curve(s.RotationModule.curve, age) * dt));
        p.rotation3D = { x: 0, y: 0, z: f(p.rotation * f(180 / Math.PI)) };
    }
    mesh(): SwordParticleNativeMesh {
        const positions: {
            x: number;
            y: number;
            z: number;
        }[] = [], uv0: {
            x: number;
            y: number;
        }[] = [], uv1: {
            x: number;
            y: number;
        }[] = [], colors: {
            r: number;
            g: number;
            b: number;
            a: number;
        }[] = [], triangles: number[] = [];
        const s = this.config.source;
        for (const p of this.particles) {
            const age = f(1 - f(p.remainingLifetime / p.startLifetime));
            const half = f(f(p.startSize3D.x * (s.SizeModule.enabled ? curve(s.SizeModule.curve, age) : 1)) / 2);
            const c = gradient(s.ColorModule.gradient.maxGradient, age);
            const channel = (key: 'r' | 'g' | 'b' | 'a') => (p.startColor[key] * (byte(c[key]) + 1)) >> 8;
            const color = { r: channel('r'), g: channel('g'), b: channel('b'), a: channel('a') };
            const uv = s.UVModule, tileCount = uv.tilesX * uv.tilesY;
            const tile = Math.floor((curve(uv.frameOverTime, age) * uv.cycles + curve(uv.startFrame, age)) * tileCount) % tileCount;
            const u = tile % uv.tilesX / uv.tilesX, v = 1 - (Math.floor(tile / uv.tilesX) + 1) / uv.tilesY;
            const start = positions.length, cos = f(Math.cos(p.rotation)), sin = f(Math.sin(p.rotation));
            for (const [x, y] of [[-half, -half], [-half, half], [half, half], [half, -half]])
                positions.push({
                    x: f(p.position.x + f(f(x * cos) - f(y * sin))), y: f(p.position.y + f(f(x * sin) + f(y * cos))), z: p.position.z
                });
            uv0.push({ x: u, y: v }, { x: u, y: v + 1 / uv.tilesY }, { x: u + 1 / uv.tilesX, y: v + 1 / uv.tilesY }, { x: u + 1 / uv.tilesX, y: v });
            for (let i = 0; i < 4; i++) {
                colors.push(color);
                uv1.push({ x: p.custom1!.x, y: p.custom1!.y });
            }
            triangles.push(start, start + 1, start + 2, start + 2, start + 3, start);
        }
        return { positions, uv0, uv1, colors, triangles };
    }
}
