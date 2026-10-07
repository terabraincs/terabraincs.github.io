"use client";
import { deploymentUrl } from "@/lib/deployment";
import { useEffect, useRef, useState } from "react";
import styles from "./MatchTenNewRecordParticles.module.css";
const CLIENT_TEXTURE_SOURCE = deploymentUrl("/game-assets/match-ten/client-exact/texture/PTCS_RECT_TRIANGLE_00.png");
const RENDER_TEXTURE_SOURCE = deploymentUrl("/game-assets/match-ten/client-exact/derived/PTCS_RECT_TRIANGLE_00_SHADER_RGB.png");
const CANVAS_WIDTH = 512;
const CANVAS_HEIGHT = 256;
const CANVAS_CENTER_X = CANVAS_WIDTH / 2;
const CANVAS_CENTER_Y = CANVAS_HEIGHT / 2;
const ROOT_SCALE = 8;
const SYSTEM_DURATION_SECONDS = 1;
const PREWARM_SECONDS = 1;
const EMISSION_RATE = 3;
const LIFETIME_MIN = 2;
const LIFETIME_MAX = 2.5;
const MAX_PARTICLES = 100;
const SERIALIZED_RANDOM_SEED = 5;
const SHAPE_WIDTH = 5;
const SHAPE_HEIGHT = 5;
const ATLAS_COLUMNS = 2;
const ATLAS_ROWS = 2;
const LIMIT_REPLAY_HZ = 60;
type Rgb = readonly [
    number,
    number,
    number
];
type CurveKey = Readonly<{
    time: number;
    value: number;
    inSlope: number;
    outSlope: number;
}>;
type StepKey = readonly [
    time: number,
    value: number
];
type Emitter = Readonly<{
    name: "A_EMBER" | "A_GLOW" | "B_EMBER" | "B_GLOW";
    pair: "A" | "B";
    kind: "ember" | "glow";
    shapeX: -5 | 5;
    velocityX: -5 | 5;
    size: readonly [
        number,
        number
    ];
    sortingOrder: 0 | 101;
}>;
const SIZE_OVER_LIFETIME = [
    { time: 0, value: 1, inSlope: 0, outSlope: 0 },
    { time: 1, value: 0, inSlope: -2, outSlope: -2 },
] as const satisfies readonly CurveKey[];
const LIMIT_VELOCITY_MAX = [
    {
        time: 0.013491544872522354,
        value: 1,
        inSlope: 0,
        outSlope: 0,
    },
    {
        time: 0.21537795662879944,
        value: 0.12931346893310547,
        inSlope: -0.16362881660461426,
        outSlope: -0.16362881660461426,
    },
    {
        time: 1,
        value: 0.044677734375,
        inSlope: 0,
        outSlope: 0,
    },
] as const satisfies readonly CurveKey[];
const LIMIT_VELOCITY_MIN = [
    {
        time: 0.013491544872522354,
        value: 0.3115230202674866,
        inSlope: -0.9544081091880798,
        outSlope: -0.9544081091880798,
    },
    {
        time: 0.2090851366519928,
        value: 0.06368198990821838,
        inSlope: -0.1936194747686386,
        outSlope: -0.1936194747686386,
    },
    {
        time: 1,
        value: 0.01593017578125,
        inSlope: 0,
        outSlope: 0,
    },
] as const satisfies readonly CurveKey[];
const ALPHA_OVER_LIFETIME = [
    [0, 0],
    [0.13714808880750745, 1],
    [0.4911726558327611, 1],
    [1, 0],
] as const satisfies readonly StepKey[];
const CUSTOM_DATA_TIMES = [
    0.1428666114807129,
    0.15118888020515442,
    0.16247490048408508,
    0.17987677454948425,
    0.19130519032478333,
    0.2833626866340637,
    0.30107685923576355,
    0.31170037388801575,
    0.33023935556411743,
    0.35276108980178833,
    0.37128880620002747,
    0.39116188883781433,
    0.4083704352378845,
    0.43088433146476746,
    0.45427894592285156,
    0.5906261801719666,
    0.6100329756736755,
    0.6252812147140503,
    0.6391432881355286,
    0.656470775604248,
    0.6800388693809509,
    0.6973686814308167,
    0.7139968276023865,
    0.7276583313941956,
    0.7407890558242798,
    0.755925178527832,
    0.7680602073669434,
] as const;
const SIBLING_ORDER = [
    "A_EMBER",
    "A_GLOW",
    "B_EMBER",
    "B_GLOW",
] as const;
const EMITTERS = [
    {
        name: "A_EMBER",
        pair: "A",
        kind: "ember",
        shapeX: -5,
        velocityX: -5,
        size: [0.800000011920929, 1.600000023841858],
        sortingOrder: 101,
    },
    {
        name: "A_GLOW",
        pair: "A",
        kind: "glow",
        shapeX: -5,
        velocityX: -5,
        size: [3, 6],
        sortingOrder: 0,
    },
    {
        name: "B_EMBER",
        pair: "B",
        kind: "ember",
        shapeX: 5,
        velocityX: 5,
        size: [0.800000011920929, 1.600000023841858],
        sortingOrder: 101,
    },
    {
        name: "B_GLOW",
        pair: "B",
        kind: "glow",
        shapeX: 5,
        velocityX: 5,
        size: [3, 6],
        sortingOrder: 0,
    },
] as const satisfies readonly Emitter[];
export const MATCH_TEN_NEW_RECORD_PARTICLE_CONTRACT = {
    clientTexture: CLIENT_TEXTURE_SOURCE,
    derivedShaderRgbTexture: RENDER_TEXTURE_SOURCE,
    material: "PTCS_UI_RECT_TRIANGLE_00_PM",
    shader: "UI/Particles/Premultiply Alpha",
    blend: "One / OneMinusSrcAlpha",
    customDataY: 0,
    effectiveBlend: "additive RGB: Custom1.y=0 makes shader output alpha zero",
    canvasCompositeOperation: "lighter",
    cssCompositeOperation: "plus-lighter",
    renderer: "UiParticles",
    rendererEnabled: false,
    rendererAlignment: 2,
    currentColorQuantization: "Color32 RGBA (8-bit); Custom1.x remains float",
    materialTint: [1, 1, 1, 1] as const,
    rootScale: [ROOT_SCALE, ROOT_SCALE, 1] as const,
    durationSeconds: SYSTEM_DURATION_SECONDS,
    looping: true,
    prewarmSeconds: PREWARM_SECONDS,
    playOnAwake: true,
    localSimulation: true,
    serializedRandomSeed: SERIALIZED_RANDOM_SEED,
    runtimePairSeedSelection: true,
    runtimeSeedSignedRange: [-2147483647, 2147483647] as const,
    runtimeSeedGenerator: "Web Crypto mapped to the exact Unity signed range; UnityEngine.Random's internal PRNG stream is not reproduced",
    seedLifecycle: "first result uses serialized seed 5; later result occurrences use selector-pair reseeds",
    rateOverTime: EMISSION_RATE,
    maxParticles: MAX_PARTICLES,
    lifetimeSeconds: [LIFETIME_MIN, LIFETIME_MAX] as const,
    startSpeed: 0,
    startRotation: 0,
    gravity: 0,
    shape: {
        type: 18,
        scale: [SHAPE_WIDTH, SHAPE_HEIGHT, 1] as const,
    },
    textureSheet: {
        columns: ATLAS_COLUMNS,
        rows: ATLAS_ROWS,
        animationType: "whole-sheet",
        timeMode: "lifetime",
        cycles: 1,
        emberFrame: 0,
        emberSerializedRowMode: "random (inactive for whole-sheet)",
        emberEffectiveTile: 0,
        glowFrame: 0.75,
        glowEffectiveTile: 3,
    },
    sizeOverLifetime: SIZE_OVER_LIFETIME,
    alphaOverLifetime: ALPHA_OVER_LIFETIME,
    glowColor: [
        [1, 0.46728819608688354, 0],
        [1, 0.2631131410598755, 0],
    ] as const,
    customData: {
        vertexStream: "Custom1XY",
        componentCount: 2,
        y: 0,
        times: CUSTOM_DATA_TIMES,
        ember: { high: 1, low: 0.2507574260234833, multiplier: 1 },
        glow: { high: 1, low: 0.4378485083580017, multiplier: 0.5 },
    },
    siblingOrder: SIBLING_ORDER,
    effectiveDrawOrder: EMITTERS.map((emitter) => emitter.name),
    drawOrderSource: "UiParticles CanvasRenderer sibling order; disabled ParticleSystemRenderer sortingOrder is inactive",
    limitVelocity: {
        mode: "two-curves",
        minimumMultiplier: 1,
        maximumMultiplier: 100,
        minimumCurve: LIMIT_VELOCITY_MIN,
        maximumCurve: LIMIT_VELOCITY_MAX,
        dampen: 1,
        multiplyDragByParticleSize: true,
        multiplyDragByParticleVelocity: true,
        drag: 0,
        replayHz: LIMIT_REPLAY_HZ,
        replayNote: "Serialized curves/scalars are exact; the browser replays Unity's native per-step clamp at 60 Hz.",
    },
    emitters: EMITTERS,
} as const;
let texturePromise: Promise<HTMLImageElement> | null = null;
function loadTexture() {
    if (!texturePromise) {
        texturePromise = new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new window.Image(); image.crossOrigin = "anonymous";
            image.decoding = "async";
            image.addEventListener("load", () => resolve(image), { once: true });
            image.addEventListener("error", reject, { once: true });
            image.src = deploymentUrl(RENDER_TEXTURE_SOURCE);
        });
    }
    return texturePromise;
}
if (typeof window !== "undefined") {
    void loadTexture().catch(() => undefined);
}
function selectedRuntimeSeed() {
    if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
        const randomValue = new Uint32Array(1);
        // UnityEngine.Random.Range(int, int) includes the minimum and excludes the
        // maximum. Rejection keeps the 4,294,967,294-value range unbiased before
        // ParticleSystem.randomSeed receives the signed result as UInt32.
        do {
            window.crypto.getRandomValues(randomValue);
        } while (randomValue[0] >= 4294967294);
        return (randomValue[0] - 2147483647) >>> 0;
    }
    return SERIALIZED_RANDOM_SEED;
}
function particleRandom(seed: number, particleIndex: number, channel: number) {
    let value = (seed ^
        Math.imul(particleIndex + 0x6d2b79f5, 0x1b873593) ^
        Math.imul(channel + 1, 0x85ebca6b)) >>> 0;
    value = Math.imul(value ^ (value >>> 16), 0x7feb352d) >>> 0;
    value = Math.imul(value ^ (value >>> 15), 0x846ca68b) >>> 0;
    return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}
function quantizeColor32(value: number) {
    return Math.round(Math.min(Math.max(value, 0), 1) * 255) / 255;
}
function sampleLinear(keys: readonly StepKey[], time: number) {
    if (time <= keys[0][0])
        return keys[0][1];
    for (let index = 1; index < keys.length; index += 1) {
        const right = keys[index];
        if (time > right[0])
            continue;
        const left = keys[index - 1];
        const progress = (time - left[0]) / (right[0] - left[0]);
        return left[1] + (right[1] - left[1]) * progress;
    }
    return keys[keys.length - 1][1];
}
function sampleCurve(keys: readonly CurveKey[], time: number) {
    if (time <= keys[0].time)
        return keys[0].value;
    for (let index = 1; index < keys.length; index += 1) {
        const right = keys[index];
        if (time > right.time)
            continue;
        const left = keys[index - 1];
        const duration = right.time - left.time;
        const progress = (time - left.time) / duration;
        const progressSquared = progress * progress;
        const progressCubed = progressSquared * progress;
        return ((2 * progressCubed - 3 * progressSquared + 1) * left.value +
            (progressCubed - 2 * progressSquared + progress) *
                left.outSlope *
                duration +
            (-2 * progressCubed + 3 * progressSquared) * right.value +
            (progressCubed - progressSquared) * right.inSlope * duration);
    }
    return keys[keys.length - 1].value;
}
function sampleCustomData(kind: Emitter["kind"], progress: number) {
    const low = kind === "ember" ? 0.2507574260234833 : 0.4378485083580017;
    const multiplier = kind === "ember" ? 1 : 0.5;
    let value = 1;
    for (let index = 0; index < CUSTOM_DATA_TIMES.length; index += 1) {
        if (progress < CUSTOM_DATA_TIMES[index])
            break;
        value = index % 2 === 0 ? 1 : low;
    }
    return value * multiplier;
}
function getMovement(emitter: Emitter, seed: number, particleIndex: number, age: number, lifetime: number) {
    const steps = Math.max(1, Math.ceil(age * LIMIT_REPLAY_HZ));
    const stepTime = age / steps;
    const limitRandom = particleRandom(seed, particleIndex, 22);
    let velocity = emitter.velocityX;
    let movement = 0;
    for (let step = 0; step < steps; step += 1) {
        const progress = Math.min(((step + 1) * stepTime) / lifetime, 1);
        const minimum = sampleCurve(LIMIT_VELOCITY_MIN, progress);
        const maximum = sampleCurve(LIMIT_VELOCITY_MAX, progress) * 100;
        const speedLimit = minimum + (maximum - minimum) * limitRandom;
        if (Math.abs(velocity) > speedLimit) {
            velocity = Math.sign(velocity) * speedLimit;
        }
        movement += velocity * stepTime;
    }
    return movement;
}
function makeTintedFrame(image: HTMLImageElement, column: number, row: number, color: Rgb) {
    const sourceWidth = image.naturalWidth / ATLAS_COLUMNS;
    const sourceHeight = image.naturalHeight / ATLAS_ROWS;
    const canvas = document.createElement("canvas");
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;
    const context = canvas.getContext("2d");
    if (!context)
        return canvas;
    context.drawImage(image, column * sourceWidth, row * sourceHeight, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
    // The derived atlas preserves the Texture2D's shader-sampled RGB and forces
    // alpha to one. This prevents Canvas 2D from multiplying RGB by tex.a, which
    // the compiled client shader does not use in its RGB output.
    const pixels = context.getImageData(0, 0, sourceWidth, sourceHeight);
    for (let offset = 0; offset < pixels.data.length; offset += 4) {
        pixels.data[offset] = Math.round(pixels.data[offset] * color[0]);
        pixels.data[offset + 1] = Math.round(pixels.data[offset + 1] * color[1]);
        pixels.data[offset + 2] = Math.round(pixels.data[offset + 2] * color[2]);
        pixels.data[offset + 3] = 255;
    }
    context.putImageData(pixels, 0, 0);
    return canvas;
}
export default function MatchTenNewRecordParticles({ clientPath, useSerializedSeed, }: {
    clientPath: string;
    useSerializedSeed: boolean;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [pairSeeds] = useState(() => useSerializedSeed
        ? { A: SERIALIZED_RANDOM_SEED, B: SERIALIZED_RANDOM_SEED }
        : { A: selectedRuntimeSeed(), B: selectedRuntimeSeed() });
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const context = canvas.getContext("2d");
        if (!context)
            return;
        const deviceScale = window.devicePixelRatio || 1;
        canvas.width = Math.ceil(CANVAS_WIDTH * deviceScale);
        canvas.height = Math.ceil(CANVAS_HEIGHT * deviceScale);
        const startTime = performance.now();
        let animationFrame = 0;
        let disposed = false;
        let texture: HTMLImageElement | null = null;
        const tintedFrames = new Map<string, CanvasImageSource>();
        canvas.dataset.assetsReady = "false";
        canvas.dataset.active = "true";
        canvas.dataset.prewarmed = "true";
        canvas.dataset.runtimeSeedA = String(pairSeeds.A);
        canvas.dataset.runtimeSeedB = String(pairSeeds.B);
        void loadTexture()
            .then((loadedTexture) => {
            if (disposed)
                return;
            texture = loadedTexture;
            canvas.dataset.assetsReady = "true";
        })
            .catch(() => {
            if (!disposed)
                canvas.dataset.assetsReady = "error";
        });
        const getFrame = (kind: Emitter["kind"], row: number, color: Rgb) => {
            if (!texture)
                return null;
            const column = kind === "ember" ? 0 : 1;
            const key = `${column}:${row}:${color.join(":")}`;
            let frame = tintedFrames.get(key);
            if (!frame) {
                frame = makeTintedFrame(texture, column, row, color);
                tintedFrames.set(key, frame);
            }
            return frame;
        };
        const render = (now: number) => {
            const elapsed = Math.max((now - startTime) / 1000, 0);
            const simulationTime = elapsed + PREWARM_SECONDS;
            let drawnParticles = 0;
            context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
            context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            context.imageSmoothingEnabled = true;
            context.globalCompositeOperation = "lighter";
            if (texture) {
                EMITTERS.forEach((emitter) => {
                    const seed = pairSeeds[emitter.pair];
                    const firstIndex = Math.max(Math.ceil((simulationTime - LIFETIME_MAX) * EMISSION_RATE), 0);
                    const lastIndex = Math.floor(simulationTime * EMISSION_RATE);
                    for (let particleIndex = firstIndex; particleIndex <= lastIndex; particleIndex += 1) {
                        const lifetime = LIFETIME_MIN +
                            (LIFETIME_MAX - LIFETIME_MIN) *
                                particleRandom(seed, particleIndex, 0);
                        const age = simulationTime - particleIndex / EMISSION_RATE;
                        if (age < 0 || age > lifetime)
                            continue;
                        const progress = age / lifetime;
                        const alpha = quantizeColor32(sampleLinear(ALPHA_OVER_LIFETIME, progress));
                        const customData = sampleCustomData(emitter.kind, progress);
                        if (alpha <= 0 || customData <= 0)
                            continue;
                        const x = emitter.shapeX +
                            (particleRandom(seed, particleIndex, 3) - 0.5) * SHAPE_WIDTH +
                            getMovement(emitter, seed, particleIndex, age, lifetime);
                        const y = (particleRandom(seed, particleIndex, 4) - 0.5) * SHAPE_HEIGHT;
                        const startSize = emitter.size[0] +
                            (emitter.size[1] - emitter.size[0]) *
                                particleRandom(seed, particleIndex, 7);
                        const size = startSize * sampleCurve(SIZE_OVER_LIFETIME, progress) * ROOT_SCALE;
                        if (size <= 0)
                            continue;
                        const color: Rgb = emitter.kind === "ember"
                            ? [1, 1, 1]
                            : [
                                1,
                                quantizeColor32(0.46728819608688354 +
                                    (0.2631131410598755 - 0.46728819608688354) *
                                        particleRandom(seed, particleIndex, 1)),
                                0,
                            ];
                        const row = emitter.kind === "ember" ? 0 : 1;
                        const frame = getFrame(emitter.kind, row, color);
                        if (!frame)
                            continue;
                        context.save();
                        context.translate(CANVAS_CENTER_X + x * ROOT_SCALE, CANVAS_CENTER_Y - y * ROOT_SCALE);
                        // The client material still uses One / OneMinusSrcAlpha. Its
                        // compiled shader writes alpha=0 because Custom1.y is zero, while
                        // leaving RGB multiplied by lifetime alpha and Custom1.x. Canvas
                        // `lighter` is the equivalent no-destination-attenuation RGB path.
                        context.globalCompositeOperation = "lighter";
                        context.globalAlpha = Math.min(alpha * customData, 1);
                        context.drawImage(frame, -size / 2, -size / 2, size, size);
                        context.restore();
                        drawnParticles += 1;
                    }
                });
            }
            canvas.dataset.drawnParticles = String(drawnParticles);
            canvas.dataset.elapsedSeconds = elapsed.toFixed(3);
            animationFrame = window.requestAnimationFrame(render);
        };
        animationFrame = window.requestAnimationFrame(render);
        return () => {
            disposed = true;
            window.cancelAnimationFrame(animationFrame);
            context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
            context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            canvas.dataset.active = "false";
        };
    }, [pairSeeds]);
    return (<span aria-hidden="true" className={styles.root} data-blend="One / OneMinusSrcAlpha" data-canvas-composite="lighter" data-client-path={clientPath} data-css-composite="plus-lighter" data-emitter-count={EMITTERS.length} data-effective-draw-order="A_EMBER,A_GLOW,B_EMBER,B_GLOW" data-emitter-sibling-order="A_EMBER,A_GLOW,B_EMBER,B_GLOW" data-lifetime-seconds="2..2.5" data-loop="true" data-limit-replay-hz={LIMIT_REPLAY_HZ} data-match-ten-new-record-particles="client-exact" data-max-particles={MAX_PARTICLES} data-prewarm-seconds={PREWARM_SECONDS} data-play-on-awake="true" data-rate-per-second={EMISSION_RATE} data-root-scale={ROOT_SCALE} data-serialized-seed={SERIALIZED_RANDOM_SEED} data-shader="UI/Particles/Premultiply Alpha" data-client-texture={CLIENT_TEXTURE_SOURCE} data-render-texture={RENDER_TEXTURE_SOURCE} data-seed-mode={useSerializedSeed ? "serialized-first-result" : "runtime-reseeded"} data-custom1-y="0" data-effective-blend="additive-rgb">
      <canvas className={styles.canvas} ref={canvasRef}/>
    </span>);
}
