"use client";
import { deploymentUrl } from "@/lib/deployment";
import { useEffect, useRef } from "react";
import { MATCH_TEN_CLIENT_TIMING } from "@/lib/matchTenClientLayout";
import styles from "./MatchTenClearBurst.module.css";
const EXP_TEXTURE = deploymentUrl("/game-assets/match-ten/client-exact/texture/NK_EXPLOSION_SEQ_03_GRAY.png");
const STAR_TEXTURE = deploymentUrl("/game-assets/match-ten/client-common/PTCS_HARIM_SET_01.png");
const CANVAS_SIZE = 192;
const CANVAS_CENTER = CANVAS_SIZE / 2;
const EXP_DURATION_MS = 449.99998807907104;
const EXP_BLEND_FACTOR = 0.2809999883174896;
const STAR_PARTICLE_COUNT = 5;
const STAR_LIFETIME_SECONDS = 0.5;
const STAR_RANDOM_SEED = 125497344;
const STAR_RADIUS = 16.450000762939453;
const STAR_START_SPEED = 10;
const STAR_SPEED_MODIFIER = 5;
const STAR_START_SIZE = 4;
const STAR_GRAVITY = 14;
const STAR_LIMIT_SPEED = 1;
const STAR_LIMIT_DAMPEN = 0.10000000149011612;
const STAR_FRAME = 2;
const STAR_TILES = 2;
const DEG_TO_RAD = Math.PI / 180;
const EXP_COLOR_KEYS = [
    {
        time: 578 / 65535,
        value: [
            0.8867924213409424,
            0.7496060729026794,
            0.5647027492523193,
        ] as const,
    },
    {
        time: 27949 / 65535,
        value: [
            0.6792452931404114,
            0.6506497263908386,
            0.6119615435600281,
        ] as const,
    },
    {
        time: 1,
        value: [
            0.6415094137191772,
            0.5755792856216431,
            0.4871840178966522,
        ] as const,
    },
] as const;
const STAR_SIZE_KEYS = [
    {
        time: 0,
        value: 1,
        inSlope: -0.09736514091491699,
        outSlope: -0.09736514091491699,
    },
    {
        time: 0.6092307567596436,
        value: 0.7043277025222778,
        inSlope: -1.143867015838623,
        outSlope: -1.143867015838623,
    },
    {
        time: 1,
        value: 0,
        inSlope: -1.8024133443832397,
        outSlope: -1.8024133443832397,
    },
] as const;
const STAR_ROTATION = [
    -0.0015507815405726433,
    0.0032257980201393366,
    -0.90125572681427,
    0.4332728683948517,
] as const;
type Rgb = readonly [
    number,
    number,
    number
];
type LoadedImages = {
    explosion: HTMLImageElement;
    star: HTMLImageElement;
};
type StarParticle = {
    angle: number;
    color: Rgb;
    alpha: number;
};
let loadedImagesPromise: Promise<LoadedImages> | null = null;
function loadImage(source: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image(); image.crossOrigin = "anonymous";
        image.decoding = "async";
        image.addEventListener("load", () => resolve(image), { once: true });
        image.addEventListener("error", reject, { once: true });
        image.src = deploymentUrl(source);
    });
}
function getLoadedImages() {
    if (!loadedImagesPromise) {
        loadedImagesPromise = Promise.all([
            loadImage(EXP_TEXTURE),
            loadImage(STAR_TEXTURE),
        ]).then(([explosion, star]) => ({ explosion, star }));
    }
    return loadedImagesPromise;
}
if (typeof window !== "undefined") {
    void getLoadedImages().catch(() => undefined);
}
function randomUnit() {
    if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
        const randomValue = new Uint32Array(1);
        window.crypto.getRandomValues(randomValue);
        return randomValue[0] / 4294967296;
    }
    return Math.random();
}
function randomRange(minimum: number, maximum: number) {
    return minimum + (maximum - minimum) * randomUnit();
}
function particleRandom(index: number, channel: number) {
    let value = (STAR_RANDOM_SEED ^
        Math.imul(index + 0x6d2b79f5, 0x1b873593) ^
        Math.imul(channel + 1, 0x85ebca6b)) >>> 0;
    value = Math.imul(value ^ (value >>> 16), 0x7feb352d) >>> 0;
    value = Math.imul(value ^ (value >>> 15), 0x846ca68b) >>> 0;
    return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}
function sampleColor(keys: typeof EXP_COLOR_KEYS, time: number): Rgb {
    if (time <= keys[0].time)
        return keys[0].value;
    for (let index = 1; index < keys.length; index += 1) {
        const right = keys[index];
        if (time <= right.time) {
            const left = keys[index - 1];
            const progress = (time - left.time) / (right.time - left.time);
            return [
                left.value[0] + (right.value[0] - left.value[0]) * progress,
                left.value[1] + (right.value[1] - left.value[1]) * progress,
                left.value[2] + (right.value[2] - left.value[2]) * progress,
            ];
        }
    }
    return keys[keys.length - 1].value;
}
function sampleStarColor(time: number): {
    color: Rgb;
    alpha: number;
} {
    const first = 0.5188679099082947;
    const last = 0.30188679695129395;
    const channel = first + (last - first) * time;
    const opaqueUntil = 16577 / 65535;
    const alpha = time <= opaqueUntil
        ? 1
        : Math.max(0, (1 - time) / (1 - opaqueUntil));
    return { color: [channel, channel, channel], alpha };
}
function sampleStarSize(time: number) {
    if (time <= 0)
        return STAR_SIZE_KEYS[0].value;
    if (time >= 1)
        return STAR_SIZE_KEYS[STAR_SIZE_KEYS.length - 1].value;
    for (let index = 1; index < STAR_SIZE_KEYS.length; index += 1) {
        const right = STAR_SIZE_KEYS[index];
        if (time <= right.time) {
            const left = STAR_SIZE_KEYS[index - 1];
            const duration = right.time - left.time;
            const progress = (time - left.time) / duration;
            const progressSquared = progress * progress;
            const progressCubed = progressSquared * progress;
            const leftTangent = left.outSlope * duration;
            const rightTangent = right.inSlope * duration;
            return ((2 * progressCubed - 3 * progressSquared + 1) * left.value +
                (progressCubed - 2 * progressSquared + progress) * leftTangent +
                (-2 * progressCubed + 3 * progressSquared) * right.value +
                (progressCubed - progressSquared) * rightTangent);
        }
    }
    return 0;
}
function tintImage(image: HTMLImageElement, color: Rgb) {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context)
        return image;
    context.drawImage(image, 0, 0);
    context.globalCompositeOperation = "multiply";
    context.fillStyle = `rgb(${color
        .map((channel) => Math.round(Math.min(Math.max(channel, 0), 1) * 255))
        .join(" ")})`;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalCompositeOperation = "destination-in";
    context.drawImage(image, 0, 0);
    return canvas;
}
function getStarParticles(): StarParticle[] {
    return Array.from({ length: STAR_PARTICLE_COUNT }, (_, index) => {
        const sampled = sampleStarColor(particleRandom(index, 1));
        return {
            angle: particleRandom(index, 3) * Math.PI * 2,
            color: sampled.color,
            alpha: sampled.alpha,
        };
    });
}
function drawExplosion(context: CanvasRenderingContext2D, image: CanvasImageSource, sourceWidth: number, sourceHeight: number, elapsedMs: number) {
    const progress = Math.min(Math.max(elapsedMs / EXP_DURATION_MS, 0), 1);
    const frame = Math.min(Math.floor(8 * progress), 8);
    const column = frame % 3;
    const row = Math.floor(frame / 3);
    context.save();
    context.translate(1.2999999523162842, 5.900000095367432);
    context.scale(1.446799874305725, 1.446799874305725);
    context.globalAlpha = EXP_BLEND_FACTOR;
    context.globalCompositeOperation = "source-over";
    context.drawImage(image, column * sourceWidth, row * sourceHeight, sourceWidth, sourceHeight, -50, -50, 100, 100);
    context.restore();
}
function applyStarTransform(context: CanvasRenderingContext2D) {
    const [x, y, z, w] = STAR_ROTATION;
    const m00 = 1 - 2 * (y * y + z * z);
    const m01 = 2 * (x * y - z * w);
    const m10 = 2 * (x * y + z * w);
    const m11 = 1 - 2 * (x * x + z * z);
    context.transform(m00, -m10, -m01, m11, 0, 0);
    context.scale(3, 3);
}
function getParticleMovement(angle: number, age: number) {
    const directionX = Math.cos(angle);
    const directionY = Math.sin(angle);
    let velocityX = (directionX * STAR_START_SPEED) * STAR_SPEED_MODIFIER;
    let velocityY = (directionY * STAR_START_SPEED + 10) * STAR_SPEED_MODIFIER;
    let movementX = 0;
    let movementY = 0;
    const steps = Math.max(1, Math.ceil(age * 60));
    const stepTime = age / steps;
    for (let step = 0; step < steps; step += 1) {
        velocityY -= 9.81 * STAR_GRAVITY * stepTime;
        const magnitude = Math.hypot(velocityX, velocityY);
        if (magnitude > STAR_LIMIT_SPEED) {
            const limitedX = (velocityX * STAR_LIMIT_SPEED) / magnitude;
            const limitedY = (velocityY * STAR_LIMIT_SPEED) / magnitude;
            velocityX += (limitedX - velocityX) * STAR_LIMIT_DAMPEN;
            velocityY += (limitedY - velocityY) * STAR_LIMIT_DAMPEN;
        }
        movementX += velocityX * stepTime;
        movementY += velocityY * stepTime;
    }
    return { movementX, movementY };
}
function drawStars(context: CanvasRenderingContext2D, image: HTMLImageElement, tintedImages: CanvasImageSource[], particles: StarParticle[], elapsedSeconds: number) {
    if (elapsedSeconds < 0 || elapsedSeconds > STAR_LIFETIME_SECONDS)
        return;
    const progress = elapsedSeconds / STAR_LIFETIME_SECONDS;
    const sourceWidth = image.naturalWidth / STAR_TILES;
    const sourceHeight = image.naturalHeight / STAR_TILES;
    const sourceX = (STAR_FRAME % STAR_TILES) * sourceWidth;
    const sourceY = sourceHeight;
    context.save();
    context.translate(-3.700000047683716, 4.599999904632568);
    applyStarTransform(context);
    particles.forEach((particle, index) => {
        const baseX = Math.cos(particle.angle) * STAR_RADIUS;
        const baseY = Math.sin(particle.angle) * STAR_RADIUS;
        const { movementX, movementY } = getParticleMovement(particle.angle, elapsedSeconds);
        const size = STAR_START_SIZE * sampleStarSize(progress);
        if (size <= 0 || particle.alpha <= 0)
            return;
        context.save();
        context.translate(baseX + movementX, -(baseY + movementY));
        context.globalAlpha = particle.alpha;
        context.globalCompositeOperation = "lighter";
        context.drawImage(tintedImages[index], sourceX, sourceY, sourceWidth, sourceHeight, -size / 2, -size / 2, size, size);
        context.restore();
    });
    context.restore();
}
export const MATCH_TEN_CLEAR_BURST_CONTRACT = {
    durationMs: MATCH_TEN_CLIENT_TIMING.nodeClearMs,
    activeDelayMs: MATCH_TEN_CLIENT_TIMING.nodeClearPeakMs,
    visibleDurationMs: MATCH_TEN_CLIENT_TIMING.nodeClearMs -
        MATCH_TEN_CLIENT_TIMING.nodeClearPeakMs,
    explosionDurationMs: EXP_DURATION_MS,
    explosionAtlas: "3x3",
    starParticleCount: STAR_PARTICLE_COUNT,
    starLifetimeSeconds: STAR_LIFETIME_SECONDS,
    starTextureSheet: "2x2",
    starTextureFrame: STAR_FRAME,
    starRandomSeed: STAR_RANDOM_SEED,
} as const;
export default function MatchTenClearBurst({ className }: {
    className?: string;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const context = canvas.getContext("2d");
        if (!context)
            return;
        const deviceScale = window.devicePixelRatio || 1;
        canvas.width = Math.ceil(CANVAS_SIZE * deviceScale);
        canvas.height = Math.ceil(CANVAS_SIZE * deviceScale);
        const rootScale = randomRange(0.800000011920929, 0.949999988079071);
        const rootRotationX = randomRange(0, 1);
        const rootRotationZ = randomRange(0, 360);
        const explosionColorSeed = randomUnit();
        const explosionColor = sampleColor(EXP_COLOR_KEYS, explosionColorSeed);
        const particles = getStarParticles();
        const startTime = performance.now();
        let animationFrame = 0;
        let disposed = false;
        let assets: LoadedImages | null = null;
        let tintedExplosion: CanvasImageSource | null = null;
        let tintedStars: CanvasImageSource[] = [];
        canvas.dataset.assetsReady = "false";
        canvas.dataset.rootScale = String(rootScale);
        canvas.dataset.rootRotationX = String(rootRotationX);
        canvas.dataset.rootRotationZ = String(rootRotationZ);
        canvas.dataset.explosionColorSeed = String(explosionColorSeed);
        void getLoadedImages()
            .then((loaded) => {
            if (disposed)
                return;
            assets = loaded;
            tintedExplosion = tintImage(loaded.explosion, explosionColor);
            tintedStars = particles.map((particle) => tintImage(loaded.star, particle.color));
            canvas.dataset.assetsReady = "true";
        })
            .catch(() => {
            if (!disposed)
                canvas.dataset.assetsReady = "error";
        });
        const render = (time: number) => {
            const elapsedMs = Math.max(time - startTime, 0);
            context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
            context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
            if (elapsedMs >= MATCH_TEN_CLIENT_TIMING.nodeClearMs) {
                canvas.dataset.active = "false";
                return;
            }
            const effectElapsedMs = elapsedMs - MATCH_TEN_CLIENT_TIMING.nodeClearPeakMs;
            if (effectElapsedMs >= 0 &&
                assets &&
                tintedExplosion &&
                tintedStars.length === particles.length) {
                canvas.dataset.active = "true";
                context.save();
                context.translate(CANVAS_CENTER, CANVAS_CENTER);
                context.scale(rootScale, rootScale * Math.cos(rootRotationX * DEG_TO_RAD));
                context.rotate(-rootRotationZ * DEG_TO_RAD);
                drawExplosion(context, tintedExplosion, assets.explosion.naturalWidth / 3, assets.explosion.naturalHeight / 3, effectElapsedMs);
                drawStars(context, assets.star, tintedStars, particles, effectElapsedMs / 1000);
                context.restore();
            }
            else {
                canvas.dataset.active = "false";
            }
            animationFrame = window.requestAnimationFrame(render);
        };
        animationFrame = window.requestAnimationFrame(render);
        return () => {
            disposed = true;
            window.cancelAnimationFrame(animationFrame);
            context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
            context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        };
    }, []);
    const rootClassName = className ? styles.root + " " + className : styles.root;
    return (<span aria-hidden="true" className={rootClassName} data-active-delay-ms={MATCH_TEN_CLIENT_TIMING.nodeClearPeakMs} data-duration-ms={MATCH_TEN_CLIENT_TIMING.nodeClearMs} data-exp-duration-ms={EXP_DURATION_MS} data-exp-frame-count="9" data-exp-last-visible-frame="5" data-match-ten-clear-burst="client-exact" data-particle-count={STAR_PARTICLE_COUNT} data-particle-lifetime-ms={STAR_LIFETIME_SECONDS * 1000} data-particle-seed={STAR_RANDOM_SEED} data-particle-speed-modifier={STAR_SPEED_MODIFIER} data-star-frame={STAR_FRAME} data-star-sheet="2x2" data-visible-duration-ms={MATCH_TEN_CLIENT_TIMING.nodeClearMs -
            MATCH_TEN_CLIENT_TIMING.nodeClearPeakMs}>
      <canvas className={styles.canvas} ref={canvasRef}/>
    </span>);
}
