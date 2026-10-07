import { swordClientNoiseDerivative } from "./swordTrainingClientParticleNoise.ts";
/** Original UiParticles mesh contract; native captured streams are not bbox-fitted. */
export type SwordParticleVector = {
    x: number;
    y: number;
    z?: number;
    w?: number;
};
export type SwordParticleColor32 = {
    r: number;
    g: number;
    b: number;
    a: number;
};
export type SwordParticleNativeMesh = {
    positions: readonly SwordParticleVector[];
    uv0: readonly SwordParticleVector[];
    uv1: readonly SwordParticleVector[];
    colors: readonly SwordParticleColor32[];
    triangles: readonly number[];
};
const EMPTY_PARTICLE_MESH: SwordParticleNativeMesh = {
    positions: [],
    uv0: [],
    uv1: [],
    colors: [],
    triangles: [],
};
export type SwordParticleMeshOutput = {
    id: string;
    texture: string;
    positions: readonly number[];
    uvs: readonly number[];
    indices: readonly number[];
    color: readonly [
        number,
        number,
        number,
        number
    ];
    particleCustom: readonly [
        number,
        number
    ];
    particleTint: readonly [
        number,
        number,
        number,
        number
    ];
};
/**
 * The original native initial/shape PRNG lanes were independently observed via
 * ParticleSystem.GetPlaybackState. This is not browser Math.random or a seedless
 * cosmetic substitute. Each lane initializes with seed + lane * 367.
 */
export class SwordTrainingParticleRandom {
    private state: [
        number,
        number,
        number,
        number
    ];
    constructor(seed: number, lane = 0) {
        if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || !Number.isInteger(lane) || lane < 0 || lane > 3)
            throw new RangeError("Invalid original particle seed/lane");
        const x = (seed + lane * 367) >>> 0;
        const y = (Math.imul(1812433253, x) + 1) >>> 0;
        const z = (Math.imul(1812433253, y) + 1) >>> 0;
        const w = (Math.imul(1812433253, z) + 1) >>> 0;
        this.state = [x, y, z, w];
    }
    nextUInt(): number {
        const [x, y, z, w] = this.state;
        const t = (x ^ (x << 11)) >>> 0;
        const value = (w ^ (w >>> 19) ^ t ^ (t >>> 8)) >>> 0;
        this.state = [y, z, w, value];
        return value;
    }
    /** Native range includes one: 23-bit integer divided by 0x7fffff. */
    nextFloat(): number {
        return Math.fround((this.nextUInt() & 0x7fffff) * Math.fround(1 / 0x7fffff));
    }
    snapshot(): readonly number[] { return [...this.state]; }
    restore(state: readonly number[]): void {
        if (state.length !== 4 || state.some(n => !Number.isInteger(n) || n < 0 || n > 0xffffffff))
            throw new RangeError("Invalid captured native particle random state");
        this.state = [...state] as [
            number,
            number,
            number,
            number
        ];
    }
}
type Color = {
    r: number;
    g: number;
    b: number;
    a: number;
};
type Vector3 = {
    x: number;
    y: number;
    z: number;
};
type CurveKey = {
    time: number;
    value: number;
    inSlope: number | string;
    outSlope: number | string;
    weightedMode: number;
};
type Curve = {
    m_Curve: readonly CurveKey[];
    m_PreInfinity: number;
    m_PostInfinity: number;
};
type MinMaxCurve = {
    minMaxState: number;
    scalar: number;
    minScalar: number;
    maxCurve: Curve;
    minCurve: Curve;
};
type Gradient = Record<string, number | Color> & {
    m_NumColorKeys: number;
    m_NumAlphaKeys: number;
    m_Mode: number;
};
type MinMaxGradient = {
    minMaxState: number;
    maxColor: Color;
    minColor: Color;
    maxGradient: Gradient;
    minGradient: Gradient;
};
export type SwordNativeParticle = {
    randomSeed: number;
    position: Vector3;
    velocity: Vector3;
    animatedVelocity: Vector3;
    startLifetime: number;
    remainingLifetime: number;
    startSize3D: Vector3;
    startColor: Color;
    /** Native ParticleSystem.Particle stores presentation rotation in degrees. */
    rotation3D?: Vector3;
    custom1?: SwordParticleVector;
};
export type SwordParticleSystemSource = {
    path: string;
    name: string;
    kind: "lobby" | "result";
    texture: string;
    controller?: {
        path: string;
        fields: {
            StartTime: number;
            ActionType: number;
        };
    } | null;
    tint: readonly [
        number,
        number,
        number,
        number
    ];
    nativeInitial: {
        time: number;
        localToRoot: readonly number[];
        playbackState: readonly {
            name: string;
            value: string;
        }[];
        particles: readonly SwordNativeParticle[];
    };
    source: {
        randomSeed: number;
        looping: boolean;
        prewarm: boolean;
        simulationSpeed: number;
        lengthInSec: number;
        InitialModule: {
            startLifetime: MinMaxCurve;
            startSize: MinMaxCurve;
            startColor: MinMaxGradient;
            startSpeed: MinMaxCurve;
            startRotation: MinMaxCurve;
            size3D: boolean;
            rotation3D: boolean;
            maxNumParticles: number;
        };
        ShapeModule: {
            type: number;
            m_Position: Vector3;
            m_Rotation: Vector3;
            m_Scale: Vector3;
        };
        EmissionModule: {
            rateOverTime: MinMaxCurve;
            m_BurstCount: number;
        };
        SizeModule: {
            enabled: boolean;
            separateAxes: boolean;
            curve: MinMaxCurve;
        };
        ColorModule: {
            enabled: boolean;
            gradient: MinMaxGradient;
        };
        VelocityModule: {
            enabled: boolean;
            x: MinMaxCurve;
            y: MinMaxCurve;
            z: MinMaxCurve;
            speedModifier: MinMaxCurve;
        };
        ClampVelocityModule: {
            enabled: boolean;
            magnitude: MinMaxCurve;
            dampen: number;
            drag: MinMaxCurve;
            separateAxis: boolean;
        };
        NoiseModule: {
            enabled: boolean;
            separateAxes: boolean;
            quality: number;
            octaves: number;
            remapEnabled: boolean;
            frequency: number;
            damping: boolean;
            strength: MinMaxCurve;
            scrollSpeed: MinMaxCurve;
            positionAmount: MinMaxCurve;
        };
        CustomDataModule: {
            enabled: boolean;
            vector0_0: MinMaxCurve;
            vector0_1: MinMaxCurve;
        };
        UVModule: {
            enabled: boolean;
            tilesX: number;
            tilesY: number;
            animationType: number;
            frameOverTime: MinMaxCurve;
            startFrame: MinMaxCurve;
            cycles: number;
        };
    };
};
const f32 = Math.fround;
const lerp32 = (a: number, b: number, t: number) => f32(a + f32(f32(b - a) * t));
/** Original native curves use Hermite tangents; infinite tangents are steps. */
export function swordParticleCurve(curve: Curve, time: number): number {
    const keys = curve.m_Curve;
    if (!keys.length)
        return 0;
    if (time <= keys[0].time)
        return keys[0].value;
    if (time >= keys[keys.length - 1].time)
        return keys[keys.length - 1].value;
    let index = 1;
    while (keys[index].time <= time)
        index++;
    const a = keys[index - 1], b = keys[index];
    if (a.weightedMode || b.weightedMode)
        throw new Error("Unmeasured weighted particle curve");
    if (!Number.isFinite(Number(a.outSlope)) || !Number.isFinite(Number(b.inSlope)))
        return a.value;
    const d = f32(b.time - a.time), t = f32(f32(time - a.time) / d), t2 = f32(t * t), t3 = f32(t2 * t);
    return f32(f32(f32(2 * t3 - 3 * t2 + 1) * a.value) + f32(f32(t3 - 2 * t2 + t) * f32(d * Number(a.outSlope))) +
        f32(f32(-2 * t3 + 3 * t2) * b.value) + f32(f32(t3 - t2) * f32(d * Number(b.inSlope))));
}
export function swordParticleMinMaxCurve(curve: MinMaxCurve, time: number, random = 0): number {
    switch (curve.minMaxState) {
        case 0: return curve.scalar;
        case 1: return f32(swordParticleCurve(curve.maxCurve, time) * curve.scalar);
        // Native 0x180D40052 and 0x180D40082 multiply BOTH curves by scalar, not minScalar.
        case 2: return lerp32(f32(swordParticleCurve(curve.minCurve, time) * curve.scalar), f32(swordParticleCurve(curve.maxCurve, time) * curve.scalar), random);
        case 3: return lerp32(curve.minScalar, curve.scalar, random);
        default: throw new Error("Unsupported original particle MinMaxCurve mode");
    }
}
export function swordParticleGradient(gradient: Gradient, time: number): Color {
    if (gradient.m_Mode !== 0)
        throw new Error("Unmeasured particle gradient mode");
    const t = Math.max(0, Math.min(1, time)) * 65535;
    const sample = (channel: keyof Color, prefix: "ctime" | "atime", count: number) => {
        let right = 0;
        while (right < count && Number(gradient[`${prefix}${right}`]) < t)
            right++;
        if (!right)
            return (gradient.key0 as Color)[channel];
        if (right === count)
            return (gradient[`key${count - 1}`] as Color)[channel];
        const start = Number(gradient[`${prefix}${right - 1}`]), end = Number(gradient[`${prefix}${right}`]);
        return lerp32((gradient[`key${right - 1}`] as Color)[channel], (gradient[`key${right}`] as Color)[channel], f32((t - start) / (end - start)));
    };
    return { r: sample("r", "ctime", gradient.m_NumColorKeys), g: sample("g", "ctime", gradient.m_NumColorKeys),
        b: sample("b", "ctime", gradient.m_NumColorKeys), a: sample("a", "atime", gradient.m_NumAlphaKeys) };
}
function byte(value: number): number { return Math.trunc(f32(f32(Math.max(0, Math.min(1, value)) * 255) + 0.5)); }
function initialColor(gradient: MinMaxGradient, random: number): Color {
    const c = gradient.minMaxState === 0 ? gradient.maxColor : gradient.minMaxState === 4 ? swordParticleGradient(gradient.maxGradient, random) : null;
    if (!c)
        throw new Error("Unmeasured original initial particle color mode");
    return { r: byte(c.r), g: byte(c.g), b: byte(c.b), a: byte(c.a) };
}
export function swordParticleLimitRandom(seed: number): number {
    return new SwordTrainingParticleRandom((seed + 0x13371337) >>> 0).nextFloat();
}
/** Native result particles continue from the original prewarmed first-draw state. */
export class SwordTrainingParticleSystem {
    readonly config: SwordParticleSystemSource;
    private initial: SwordTrainingParticleRandom[];
    private shape: SwordTrainingParticleRandom[];
    private particles: SwordNativeParticle[];
    private accumulator: number;
    private playbackTime: number;
    private noiseScroll: number;
    private noiseOffset: Vector3;
    private elapsed = 0;
    constructor(config: SwordParticleSystemSource) {
        this.config = config;
        const s = config.source;
        if (s.NoiseModule.enabled && (s.NoiseModule.separateAxes || ![1, 2].includes(s.NoiseModule.quality) || s.NoiseModule.octaves !== 1 || s.NoiseModule.remapEnabled))
            throw new Error("Original particle Noise exceeds the audited single-axis/single-octave path");
        if (s.ShapeModule.type !== 18 || s.InitialModule.size3D || s.InitialModule.rotation3D ||
            s.InitialModule.startSpeed.scalar || s.EmissionModule.m_BurstCount || s.SizeModule.separateAxes)
            throw new Error("Original particle configuration exceeds the audited active module path");
        const state = new Map(config.nativeInitial.playbackState.map(entry => [entry.name, Number(entry.value)]));
        const lanes = ["x", "y", "z", "w"];
        const restore = (module: string) => lanes.map((lane, index) => {
            const random = new SwordTrainingParticleRandom(s.randomSeed, index);
            random.restore(lanes.map(key => state.get(`m_${module}.m_Random.${key}.${lane}`) ?? NaN));
            return random;
        });
        this.initial = restore("Initial");
        this.shape = restore("Shape");
        this.accumulator = f32(state.get("m_Emission.m_ToEmitAccumulator") ?? 0);
        this.playbackTime = config.nativeInitial.time;
        this.noiseScroll = f32(state.get("m_Noise.m_ScrollOffset") ?? 0);
        const offset = new SwordTrainingParticleRandom(s.randomSeed);
        this.noiseOffset = { x: f32(offset.nextFloat() * 100), y: f32(offset.nextFloat() * 100), z: f32(offset.nextFloat() * 100) };
        this.particles = structuredClone(config.nativeInitial.particles) as SwordNativeParticle[];
    }
    snapshot(): readonly SwordNativeParticle[] { return this.particles; }
    /** Preview on a private copy: abandoned React renders must not advance PRNGs. */
    clone(): SwordTrainingParticleSystem {
        const copy = Object.assign(Object.create(SwordTrainingParticleSystem.prototype), this) as SwordTrainingParticleSystem;
        const duplicate = (random: SwordTrainingParticleRandom) => { const next = new SwordTrainingParticleRandom(0); next.restore(random.snapshot()); return next; };
        copy.initial = this.initial.map(duplicate);
        copy.shape = this.shape.map(duplicate);
        copy.particles = structuredClone(this.particles);
        return copy;
    }
    /** Native 0x180D7C040: long frames are equal substeps, not time-dropping clamps. */
    advanceFrame(deltaSeconds: number, maximumParticleTimestep: number): void {
        if (!(maximumParticleTimestep > 0))
            throw new RangeError("Missing source maximum particle timestep");
        const delta = f32(deltaSeconds);
        const steps = Math.max(1, Math.ceil(f32(delta / maximumParticleTimestep)));
        const step = f32(delta / steps);
        for (let index = 0; index < steps; index++)
            this.advance(step);
    }
    advance(deltaSeconds: number): void {
        if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0)
            throw new RangeError("Particle delta must be finite and nonnegative");
        if (!deltaSeconds)
            return;
        const dt = f32(deltaSeconds * this.config.source.simulationSpeed);
        this.elapsed += deltaSeconds;
        // Native Noise advances its scroll once for the existing-particle update.
        // Empty systems and newly emitted-particle batches do not advance it again.
        if (this.config.source.NoiseModule.enabled && this.particles.length)
            this.noiseScroll = f32(this.noiseScroll + f32(swordParticleMinMaxCurve(this.config.source.NoiseModule.scrollSpeed, this.playbackTime) * dt));
        for (const p of this.particles) {
            this.move(p, dt);
            p.remainingLifetime = f32(p.remainingLifetime - dt);
        }
        // Native ParticleSystem storage removes a dead slot by moving the final
        // live buffer element into it. The Omen AURA trace exposes this order at
        // frame 5; stable Array.filter ordering changes alpha-blended draw order.
        for (let index = 0; index < this.particles.length;) {
            if (this.particles[index].remainingLifetime > 0) {
                index++;
                continue;
            }
            const last = this.particles.pop()!;
            if (index < this.particles.length)
                this.particles[index] = last;
        }
        const rate = swordParticleMinMaxCurve(this.config.source.EmissionModule.rateOverTime, this.elapsed);
        const nextTime = f32(this.playbackTime + dt);
        const emissionDelta = f32(nextTime - this.playbackTime);
        this.playbackTime = nextTime >= this.config.source.lengthInSec ? f32(nextTime - this.config.source.lengthInSec) : nextTime;
        // Native emission uses the float32 playback-time difference, not the original
        // delta argument. The distinction controls exact threshold frames after loops.
        this.accumulator = f32(this.accumulator + f32(rate * emissionDelta));
        const count = Math.floor(this.accumulator);
        this.accumulator = f32(this.accumulator - count);
        for (let first = 0; first < count; first += 4) {
            const inputs = this.initial.map(random => Array.from({ length: 5 }, () => random.nextUInt()));
            const shapes = this.shape.map(random => [random.nextFloat(), random.nextFloat()]);
            for (let lane = 0; lane < Math.min(4, count - first); lane++) {
                const source = this.config.source, initial = source.InitialModule, shape = source.ShapeModule;
                const draw = (i: number) => f32((inputs[lane][i] & 0x7fffff) * f32(1 / 0x7fffff));
                const lifetime = swordParticleMinMaxCurve(initial.startLifetime, this.elapsed, draw(1));
                const size = swordParticleMinMaxCurve(initial.startSize, this.elapsed, draw(2));
                const age = f32((count - first - lane - 1 + this.accumulator) / rate);
                const p: SwordNativeParticle = { randomSeed: inputs[lane][0], startLifetime: lifetime, remainingLifetime: lifetime,
                    position: { x: f32(shape.m_Position.x + f32(f32(shapes[lane][0] - 0.5) * shape.m_Scale.x)),
                        y: f32(shape.m_Position.y + f32(f32(shapes[lane][1] - 0.5) * shape.m_Scale.y)), z: shape.m_Position.z },
                    velocity: { x: 0, y: 0, z: 0 }, animatedVelocity: { x: 0, y: 0, z: 0 },
                    startSize3D: { x: size, y: size, z: size }, startColor: initialColor(initial.startColor, draw(4)),
                    // Cafe's native Emit oracle established that Initial draw index 3 is
                    // the 2D start-rotation sample. Particle.rotation3D is exposed in
                    // degrees even though the serialized curve is radians.
                    rotation3D: { x: 0, y: 0,
                        z: f32(swordParticleMinMaxCurve(initial.startRotation, this.playbackTime, draw(3)) * f32(180 / Math.PI)) } };
                this.move(p, age);
                p.remainingLifetime = f32(lifetime - age);
                if (this.particles.length < initial.maxNumParticles)
                    this.particles.push(p);
            }
        }
    }
    private move(p: SwordNativeParticle, dt: number): void {
        const source = this.config.source, age = f32(1 - f32(p.remainingLifetime / p.startLifetime));
        p.custom1 = { x: swordParticleMinMaxCurve(source.CustomDataModule.vector0_0, age), y: swordParticleMinMaxCurve(source.CustomDataModule.vector0_1, age) };
        const velocity = source.VelocityModule;
        const modifier = velocity.enabled ? swordParticleMinMaxCurve(velocity.speedModifier, age) : 1;
        const total = { x: 0, y: 0, z: 0 };
        const noise = this.noise(p.position, age, p.randomSeed);
        for (const axis of ["x", "y", "z"] as const) {
            p.animatedVelocity[axis] = f32((velocity.enabled ? swordParticleMinMaxCurve(velocity[axis], age) : 0) + noise[axis]);
            total[axis] = f32(p.velocity[axis] + p.animatedVelocity[axis]);
        }
        const limit = source.ClampVelocityModule;
        if (limit.enabled) {
            const speed = f32(Math.hypot(total.x, total.y, total.z));
            const maximum = swordParticleMinMaxCurve(limit.magnitude, age, swordParticleLimitRandom(p.randomSeed));
            if (speed > maximum && speed > 0) {
                // Original 0x181AD9040 is 30, not render FPS.
                const dampening = f32(1 - f32(Math.pow(f32(1 - limit.dampen), f32(Math.abs(dt) * 30))));
                const clamped = lerp32(speed, maximum, dampening);
                for (const axis of ["x", "y", "z"] as const) {
                    total[axis] = f32(f32(total[axis] / speed) * clamped);
                    p.velocity[axis] = f32(total[axis] - p.animatedVelocity[axis]);
                }
            }
            const drag = swordParticleMinMaxCurve(limit.drag, age);
            if (drag) {
                const speed = f32(Math.hypot(total.x, total.y, total.z));
                const reduced = Math.max(0, f32(speed - f32(drag * dt)));
                for (const axis of ["x", "y", "z"] as const) {
                    total[axis] = speed > 0 ? f32(f32(total[axis] / speed) * reduced) : 0;
                    p.velocity[axis] = f32(total[axis] - p.animatedVelocity[axis]);
                }
            }
        }
        // Velocity-over-lifetime speedModifier affects integration after the native
        // clamp/drag path. Particle.totalVelocity itself does not include it.
        for (const axis of ["x", "y", "z"] as const)
            p.position[axis] = f32(p.position[axis] + f32(f32(total[axis] * modifier) * dt));
    }
    private noise(position: Vector3, age: number, seed: number): Vector3 {
        const noise = this.config.source.NoiseModule;
        if (!noise.enabled)
            return { x: 0, y: 0, z: 0 };
        const x = f32(position.x + this.noiseOffset.x), y = f32(position.y + this.noiseOffset.y), z = f32(position.z + this.noiseOffset.z);
        const xx = f32(x + 100), frequency = Math.max(f32(0.000001), noise.frequency);
        // Native High/no-separate-axis job 0x181139F90: three coordinate permutations
        // of the original derivative produce curl. Scroll is the third coordinate.
        const a = swordClientNoiseDerivative(z, y, f32(x + this.noiseScroll), frequency);
        const b = swordClientNoiseDerivative(xx, z, f32(y + this.noiseScroll), frequency);
        const c = swordClientNoiseDerivative(y, xx, f32(z + this.noiseScroll), frequency);
        const amplitude = f32(swordParticleMinMaxCurve(noise.strength, age, new SwordTrainingParticleRandom((seed + 0x3edcba94) >>> 0).nextFloat()) *
            (noise.damping ? f32(1 / frequency) : 1));
        const amount = swordParticleMinMaxCurve(noise.positionAmount, age, new SwordTrainingParticleRandom((seed + 0xb77ce39a) >>> 0).nextFloat());
        return { x: f32(f32(f32(c[0] - b[1]) * amplitude) * amount), y: f32(f32(f32(a[0] - c[1]) * amplitude) * amount), z: f32(f32(f32(b[0] - a[1]) * amplitude) * amount) };
    }
    mesh(): SwordParticleNativeMesh {
        const positions: SwordParticleVector[] = [], uv0: SwordParticleVector[] = [], uv1: SwordParticleVector[] = [], colors: Color[] = [], triangles: number[] = [];
        const source = this.config.source;
        for (const p of this.particles) {
            const age = f32(1 - f32(p.remainingLifetime / p.startLifetime));
            if (age >= 1)
                continue;
            const sizeFactor = source.SizeModule.enabled ? swordParticleMinMaxCurve(source.SizeModule.curve, age) : 1;
            const half = f32(f32(p.startSize3D.x * sizeFactor) / 2);
            const lifetimeColor = source.ColorModule.enabled
                ? swordParticleGradient(source.ColorModule.gradient.maxGradient, age)
                : { r: 1, g: 1, b: 1, a: 1 };
            // Native GetCurrentColor 0x180D1FC55-0x180D1FC8A uses packed Color32,
            // then integer (start * (gradient + 1)) >> 8, not float multiplication.
            const channel = (key: keyof Color) => (p.startColor[key] * (byte(lifetimeColor[key]) + 1)) >> 8;
            const color = { r: channel("r"), g: channel("g"), b: channel("b"), a: channel("a") };
            const custom = p.custom1 ?? { x: swordParticleMinMaxCurve(source.CustomDataModule.vector0_0, age), y: swordParticleMinMaxCurve(source.CustomDataModule.vector0_1, age) };
            const uv = source.UVModule, tileCount = uv.tilesX * uv.tilesY;
            const tile = Math.floor((swordParticleMinMaxCurve(uv.frameOverTime, age) * uv.cycles + swordParticleMinMaxCurve(uv.startFrame, age)) * tileCount) % tileCount;
            const u = tile % uv.tilesX / uv.tilesX, v = 1 - (Math.floor(tile / uv.tilesX) + 1) / uv.tilesY;
            const start = positions.length;
            const radians = f32(f32(p.rotation3D?.z ?? 0) * f32(Math.PI / 180));
            const cos = f32(Math.cos(radians)), sin = f32(Math.sin(radians));
            for (const [x, y] of [[-half, -half], [-half, half], [half, half], [half, -half]])
                positions.push({
                    x: f32(p.position.x + f32(f32(x * cos) - f32(y * sin))),
                    y: f32(p.position.y + f32(f32(x * sin) + f32(y * cos))), z: p.position.z,
                });
            uv0.push({ x: u, y: v }, { x: u, y: v + 1 / uv.tilesY }, { x: u + 1 / uv.tilesX, y: v + 1 / uv.tilesY }, { x: u + 1 / uv.tilesX, y: v });
            for (let i = 0; i < 4; i++) {
                colors.push(color);
                uv1.push(custom);
            }
            triangles.push(start, start + 1, start + 2, start + 2, start + 3, start);
        }
        return { positions, uv0, uv1, colors, triangles };
    }
}
/**
 * Split the exact original four-vertex billboards into shared shader draws.
 * Color32 and UV1 are constant across each source particle, unlike across the
 * whole ParticleSystem. Root projection is supplied, never fitted to mesh bounds.
 */
export function swordTrainingNativeParticleMeshes(args: {
    id: string;
    mesh: SwordParticleNativeMesh;
    localToRoot: readonly number[];
    width: number;
    height: number;
    texture: string;
    tint: readonly [
        number,
        number,
        number,
        number
    ];
}): SwordParticleMeshOutput[] {
    const { mesh, localToRoot: m, width, height } = args;
    const count = mesh.positions.length;
    if (m.length !== 16 || !m.every(Number.isFinite) || !(width > 0 && height > 0) || count % 4 ||
        mesh.uv0.length !== count || mesh.uv1.length !== count || mesh.colors.length !== count || mesh.triangles.length !== count / 4 * 6)
        throw new Error("Unexpected original UiParticles mesh streams");
    const output: SwordParticleMeshOutput[] = [];
    for (let vertex = 0; vertex < count; vertex += 4) {
        const color = mesh.colors[vertex], custom = mesh.uv1[vertex];
        if (![color.r, color.g, color.b, color.a].every(value => Number.isInteger(value) && value >= 0 && value <= 255))
            throw new Error("Expected original particle Color32 bytes");
        const positions: number[] = [], uvs: number[] = [];
        for (let offset = 0; offset < 4; offset++) {
            const index = vertex + offset, p = mesh.positions[index], c = mesh.colors[index], uv = mesh.uv0[index], data = mesh.uv1[index];
            if (c.r !== color.r || c.g !== color.g || c.b !== color.b || c.a !== color.a || data.x !== custom.x || data.y !== custom.y)
                throw new Error("Original particle billboard changed per-vertex color/custom-data contract");
            const z = p.z ?? 0;
            positions.push(width / 2 + m[0] * p.x + m[1] * p.y + m[2] * z + m[3], height / 2 - (m[4] * p.x + m[5] * p.y + m[6] * z + m[7]));
            uvs.push(uv.x, 1 - uv.y);
        }
        const indices = mesh.triangles.slice(vertex / 4 * 6, vertex / 4 * 6 + 6).map(value => value - vertex);
        if (indices.some(value => !Number.isInteger(value) || value < 0 || value > 3))
            throw new Error("Particle triangles cross billboards");
        output.push({ id: `${args.id}:${vertex / 4}`, texture: args.texture, positions, uvs, indices,
            color: [color.r / 255, color.g / 255, color.b / 255, color.a / 255],
            particleCustom: [custom.x, custom.y], particleTint: args.tint });
    }
    return output;
}
/** Only allocate the canvas around the native mesh; never normalize its geometry. */
export function swordTrainingLocalParticleMeshes(config: SwordParticleSystemSource, mesh: SwordParticleNativeMesh): {
    minX: number;
    maxY: number;
    width: number;
    height: number;
    meshes: SwordParticleMeshOutput[];
} {
    if (!mesh.positions.length)
        return { minX: 0, maxY: 0, width: 1, height: 1, meshes: [] };
    const xs = mesh.positions.map(p => p.x), ys = mesh.positions.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const width = Math.max(Number.EPSILON, maxX - minX), height = Math.max(Number.EPSILON, maxY - minY);
    const localToRoot = [1, 0, 0, -minX - width / 2, 0, 1, 0, height / 2 - maxY, 0, 0, 1, 0, 0, 0, 0, 1];
    return { minX, maxY, width, height, meshes: swordTrainingNativeParticleMeshes({ id: config.path, mesh, localToRoot, width, height, texture: config.texture, tint: config.tint }) };
}
/** Native hierarchy lifetime is independent from the enclosing React instance. */
export class SwordTrainingParticlePlayback {
    private system: SwordTrainingParticleSystem;
    private playing: boolean;
    private readonly config: SwordParticleSystemSource;
    private time: number;
    private active: boolean;
    private readonly maximumDeltaTime: number;
    private readonly maximumParticleTimestep: number;
    constructor(config: SwordParticleSystemSource, time: number, active: boolean, maximumDeltaTime: number, maximumParticleTimestep: number) {
        this.config = config;
        this.time = time;
        this.active = active;
        this.maximumDeltaTime = maximumDeltaTime;
        this.maximumParticleTimestep = maximumParticleTimestep;
        this.system = new SwordTrainingParticleSystem(config);
        this.playing = active && !config.controller;
        if (config.controller && config.controller.fields.ActionType !== 2)
            throw new Error("Unverified original particle FXM action");
    }
    update(elapsed: number, active: boolean, fxPlayback: number | null, buildMesh = true): SwordParticleNativeMesh {
        if (!Number.isFinite(elapsed) || elapsed < this.time)
            throw new RangeError("Particle presentation time must be monotonic");
        const delta = Math.min(this.maximumDeltaTime, elapsed - this.time);
        this.time = elapsed;
        if (active && !this.active) {
            this.system = new SwordTrainingParticleSystem(this.config);
            this.playing = !this.config.controller;
        }
        if (!active)
            this.playing = false;
        this.active = active;
        // Original PlayContinue starts once; 3-second FXM loops do not restart an emitting PS.
        if (active && !this.playing && this.config.controller && fxPlayback !== null && fxPlayback >= this.config.controller.fields.StartTime)
            this.playing = true;
        if (active && this.playing)
            this.system.advanceFrame(delta, this.maximumParticleTimestep);
        if (!buildMesh || !active)
            return EMPTY_PARTICLE_MESH;
        return this.system.mesh();
    }
    preview(elapsed: number, active: boolean, fxPlayback: number | null): SwordParticleNativeMesh {
        const copy = Object.assign(Object.create(SwordTrainingParticlePlayback.prototype), this, { system: this.system.clone() }) as SwordTrainingParticlePlayback;
        return copy.update(elapsed, active, fxPlayback);
    }
}
