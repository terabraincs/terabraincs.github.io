"use client";
import { useEffect, useRef } from "react";
import { evaluateStoryUnityEase, findStoryDefaultSpineAnimation, findStoryInitialSpineAnimation, findStoryRequestedSpineAnimation, findStorySpineSkin, shouldPreserveStoryEmotionAnimationTime, } from "@/lib/storyPlayback";
import styles from "./StorySpineActor.module.css";
export type StorySpineAsset = {
    id: string;
    jsonUrl: string;
    atlasUrl: string;
    textureUrl: string;
    binaryUrl?: string;
    binaryBytes?: number;
    binarySha256?: string;
    renderUrl?: string;
    renderSha256?: string;
    renderWidth?: number;
    renderHeight?: number;
    renderFrames?: number;
    renderPlays?: number;
    defaultMix?: number;
    skeletonScale?: number;
    layout?: {
        x: number;
        y: number;
        scaleX: number;
        scaleY: number;
        rotation: number;
        flipX: boolean;
        flipY: boolean;
    };
};
type StorySpineSource = {
    jsonText: string;
    atlasText: string;
    image: HTMLImageElement;
};
type StorySpineRuntime = {
    pixi: typeof import("pixi.js");
    spineBase: typeof import("@pixi-spine/base");
    spineRuntime: typeof import("@pixi-spine/runtime-3.7");
};
const storySpineSourceCache = new Map<string, Promise<StorySpineSource>>();
let storySpineRuntimePromise: Promise<StorySpineRuntime> | null = null;
const STORY_STAGE_SPINE_WIDTH = 414;
const STORY_STAGE_SPINE_HEIGHT = 819;
// STV-MAP-070: NKCUIStageInfoSubStory reparents the illustration below
// Story/SPINE_Root through `SPINE ILLUST`, then applies DEFAULT_CHAR_POS.
// The extracted SkeletonGraphic transform is therefore local to this combined
// parent offset instead of the cutscene's 1920×1080 character surface.
const STORY_STAGE_SPINE_PARENT_OFFSET_X = -9.970015;
const STORY_STAGE_SPINE_PARENT_OFFSET_Y = -233.5;
export function preloadStorySpineRuntime() {
    if (storySpineRuntimePromise) {
        return storySpineRuntimePromise;
    }
    storySpineRuntimePromise = Promise.all([
        import("pixi.js"),
        import("@pixi-spine/base"),
        import("@pixi-spine/runtime-3.7"),
    ])
        .then(([pixi, spineBase, spineRuntime]) => ({
        pixi,
        spineBase,
        spineRuntime,
    }))
        .catch((error) => {
        storySpineRuntimePromise = null;
        throw error;
    });
    return storySpineRuntimePromise;
}
function loadStorySpineImage(url: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`텍스처 로딩 실패: ${url}`));
        image.crossOrigin = "anonymous";
        image.decoding = "async";
        image.src = url;
    });
}
async function fetchStorySpineText(url: string) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Spine 파일 요청 실패: HTTP ${response.status}`);
    }
    return response.text();
}
export function preloadStorySpineAsset(asset: StorySpineAsset) {
    const cached = storySpineSourceCache.get(asset.id);
    if (cached) {
        return cached;
    }
    const loading = Promise.all([
        fetchStorySpineText(asset.jsonUrl),
        fetchStorySpineText(asset.atlasUrl),
        loadStorySpineImage(asset.textureUrl),
    ])
        .then(([jsonText, atlasText, image]) => ({ jsonText, atlasText, image }))
        .catch((error) => {
        storySpineSourceCache.delete(asset.id);
        throw error;
    });
    storySpineSourceCache.set(asset.id, loading);
    return loading;
}
type JsonObject = Record<string, unknown>;
type SpineDisplay = import("@pixi-spine/runtime-3.7").Spine;
type SpineTint = readonly [
    number,
    number,
    number,
    number
];
export type StorySpineTintTransition = {
    start: SpineTint;
    end: SpineTint;
    durationMs: number;
    ease: string;
};
const CUTSCENE_SLOT_WIDTH = 888.71;
const CUTSCENE_SLOT_HEIGHT = 1081.3;
const CUTSCENE_BACKGROUND_WIDTH = 1920;
const CUTSCENE_BACKGROUND_HEIGHT = 1080;
const STORY_CHARACTER_UPDATE_INTERVAL_SECONDS = 1 / 30;
const MAX_SPINE_PLAYBACK_SNAPSHOTS = 256;
type SpinePlaybackSnapshot = {
    animation: string;
    animationTime: number;
};
// MOVE는 출발 슬롯의 CharacterView를 비활성화한 뒤 도착 슬롯의
// CharacterView에 AnimationTime을 넘긴다. React에서는 출발 Canvas가
// 먼저 사라질 수 있으므로, 활성 Spine의 최신 시간을 작은 공유 저장소에
// 보존해 같은 화면 전환 안에서만 참조한다.
const spinePlaybackSnapshots = new Map<string, SpinePlaybackSnapshot>();
const spineBonePositions = new Map<string, Map<string, {
    x: number;
    y: number;
    rotation: number;
}>>();
export function getStorySpineBonePosition(instanceId: string, boneName: string) {
    return spineBonePositions.get(instanceId)?.get(boneName) ?? null;
}
function rememberSpineBonePositions(instanceId: string, spine: SpineDisplay, host: HTMLElement, boneNames: readonly string[]) {
    if (!instanceId || boneNames.length === 0) {
        return;
    }
    const hostWidth = Math.max(host.clientWidth, 1);
    const hostHeight = Math.max(host.clientHeight, 1);
    const cosine = Math.cos(spine.rotation);
    const sine = Math.sin(spine.rotation);
    const positions = new Map<string, {
        x: number;
        y: number;
        rotation: number;
    }>();
    boneNames.forEach((boneName) => {
        const bone = spine.skeleton.findBone(boneName);
        if (!bone) {
            return;
        }
        const scaledX = bone.worldX * spine.scale.x;
        const scaledY = bone.worldY * spine.scale.y;
        const screenX = spine.position.x + scaledX * cosine - scaledY * sine;
        const screenY = spine.position.y + scaledX * sine + scaledY * cosine;
        positions.set(boneName, {
            x: screenX * CUTSCENE_BACKGROUND_WIDTH / hostWidth -
                CUTSCENE_BACKGROUND_WIDTH / 2,
            y: CUTSCENE_BACKGROUND_HEIGHT / 2 -
                screenY * CUTSCENE_BACKGROUND_HEIGHT / hostHeight,
            rotation: bone.getWorldRotationX() + spine.rotation * 180 / Math.PI,
        });
    });
    spineBonePositions.set(instanceId, positions);
}
function rememberSpinePlayback(instanceId: string, spine: SpineDisplay) {
    if (!instanceId) {
        return;
    }
    const current = spine.state.getCurrent(0);
    if (!current) {
        return;
    }
    spinePlaybackSnapshots.delete(instanceId);
    spinePlaybackSnapshots.set(instanceId, {
        animation: current.animation.name,
        // Unity Spine의 GetCurrentAnimationTime은 TrackTime이 아니라
        // 반복 길이가 반영된 AnimationTime을 반환한다.
        animationTime: current.getAnimationTime(),
    });
    while (spinePlaybackSnapshots.size > MAX_SPINE_PLAYBACK_SNAPSHOTS) {
        const oldestKey = spinePlaybackSnapshots.keys().next().value;
        if (typeof oldestKey !== "string") {
            break;
        }
        spinePlaybackSnapshots.delete(oldestKey);
    }
}
function transferSpinePlayback(spine: SpineDisplay, sourceInstanceId: string) {
    const snapshot = sourceInstanceId
        ? spinePlaybackSnapshots.get(sourceInstanceId)
        : undefined;
    const current = spine.state.getCurrent(0);
    if (!snapshot || !current) {
        return null;
    }
    // NKCASUISpineIllust.SetCurrentAnimationTime(time, 0, false)는 현재
    // TrackEntry의 TrackTime만 바꾸고 전환 설정은 그대로 둔다.
    current.trackTime = snapshot.animationTime;
    return snapshot;
}
function isJsonObject(value: unknown): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function objectValues(value: unknown) {
    return isJsonObject(value) ? Object.values(value) : [];
}
function normalizeTimeline(value: unknown) {
    if (!Array.isArray(value)) {
        return;
    }
    for (const frame of value) {
        if (isJsonObject(frame) && !("time" in frame)) {
            frame.time = 0;
        }
    }
}
function normalizeSpineTimelineTimes(skeletonJson: unknown) {
    if (!isJsonObject(skeletonJson) || !isJsonObject(skeletonJson.animations)) {
        return;
    }
    for (const animation of Object.values(skeletonJson.animations)) {
        if (!isJsonObject(animation)) {
            continue;
        }
        for (const sectionName of ["slots", "bones"] as const) {
            for (const target of objectValues(animation[sectionName])) {
                for (const timeline of objectValues(target)) {
                    normalizeTimeline(timeline);
                }
            }
        }
        for (const sectionName of ["ik", "transform"] as const) {
            for (const timeline of objectValues(animation[sectionName])) {
                normalizeTimeline(timeline);
            }
        }
        for (const constraint of objectValues(animation.paths)) {
            for (const timeline of objectValues(constraint)) {
                normalizeTimeline(timeline);
            }
        }
        for (const skin of objectValues(animation.deform)) {
            for (const slot of objectValues(skin)) {
                for (const timeline of objectValues(slot)) {
                    normalizeTimeline(timeline);
                }
            }
        }
        normalizeTimeline(animation.drawOrder);
        normalizeTimeline(animation.draworder);
        normalizeTimeline(animation.events);
    }
}
function applyRequestedSkin(spine: SpineDisplay, { skinName, skinOption, prefabSkinName, backgroundEnabled, includePrefabSkin = true, }: {
    skinName: string;
    skinOption: number;
    prefabSkinName: string;
    backgroundEnabled: boolean;
    includePrefabSkin?: boolean;
}) {
    const requestedSkin = findStorySpineSkin(spine.skeleton.data.skins.map((skin) => skin.name), {
        skinName,
        skinOption,
        prefabSkinName,
        backgroundEnabled,
        includePrefabSkin,
    });
    if (requestedSkin) {
        spine.skeleton.setSkinByName(requestedSkin);
        spine.skeleton.setSlotsToSetupPose();
    }
    return requestedSkin;
}
function applyTint(spine: SpineDisplay, tintColor: SpineTint | null, host?: HTMLDivElement | null) {
    const [red, green, blue, alpha] = tintColor ?? [1, 1, 1, 1];
    spine.skeleton.color.set(red, green, blue, alpha);
    if (host) {
        host.dataset.spineTint = `${red},${green},${blue},${alpha}`;
    }
}
function interpolateTint(transition: StorySpineTintTransition, elapsedMs: number): SpineTint {
    if (transition.durationMs <= 0 || elapsedMs >= transition.durationMs) {
        return transition.end;
    }
    const progress = evaluateStoryUnityEase(transition.ease, elapsedMs / transition.durationMs, transition.durationMs);
    return transition.start.map((value, index) => value +
        (transition.end[index] - value) * progress) as unknown as SpineTint;
}
function restartStorySpineAnimation(spine: SpineDisplay, host: HTMLDivElement | null, animation: string, loop: boolean, startTime = 0) {
    // NKCASUISpineIllust.SetAnimation(forceRestart=true)은 유효한 애니메이션을
    // 트랙에 넣기 직전에 Skeleton.SetToSetupPose()를 호출한다. 이 초기화가
    // 없으면 새 애니메이션이 키를 갖지 않는 본·슬롯 상태가 이전 표정에서
    // 남을 수 있다. 예약 재생(addAnimation)이 아니라 실제 전환 시점에만 한다.
    spine.skeleton.setToSetupPose();
    if (host) {
        const previousResetCount = Number.parseInt(host.dataset.spineSetupPoseResetCount ?? "0", 10);
        host.dataset.spineSetupPoseResetCount = String(Number.isFinite(previousResetCount) ? previousResetCount + 1 : 1);
    }
    const entry = spine.state.setAnimation(0, animation, loop);
    if (startTime > 0) {
        entry.trackTime = startTime;
    }
    return entry;
}
export default function StorySpineActor({ asset, face, commandFace, loop = true, animationRevision = 0, instanceId = "", trackedBoneNames = [], trackTimeTransferFrom = "", skinName = "", skinOption = 0, prefabSkinName = "", prefabAnimation = "", prefabAnimationOnly = false, prefabAnimationLoop = true, backgroundEnabled = true, fitMode = "character", layoutCoordinateSpace = "cutscene-canvas", tintColor = null, tintTransition = null, paused = false, label, }: {
    asset: StorySpineAsset;
    face: string;
    commandFace?: string;
    loop?: boolean;
    animationRevision?: number;
    instanceId?: string;
    trackedBoneNames?: readonly string[];
    trackTimeTransferFrom?: string;
    skinName?: string;
    skinOption?: number;
    prefabSkinName?: string;
    prefabAnimation?: string;
    prefabAnimationOnly?: boolean;
    prefabAnimationLoop?: boolean;
    backgroundEnabled?: boolean;
    fitMode?: "character" | "background";
    layoutCoordinateSpace?: "cutscene-canvas" | "story-stage-mask";
    tintColor?: SpineTint | null;
    tintTransition?: StorySpineTintTransition | null;
    paused?: boolean;
    label: string;
}) {
    const requestedCommandFace = commandFace ?? face;
    const hostRef = useRef<HTMLDivElement>(null);
    const spineRef = useRef<SpineDisplay | null>(null);
    const animationNamesRef = useRef<string[]>([]);
    const animationDurationsRef = useRef<Map<string, number>>(new Map());
    const commandFaceRef = useRef(requestedCommandFace);
    const loopRef = useRef(loop);
    const instanceIdRef = useRef(instanceId);
    const trackedBoneNamesRef = useRef(trackedBoneNames);
    const trackTimeTransferFromRef = useRef(trackTimeTransferFrom);
    const skinNameRef = useRef(skinName);
    const skinOptionRef = useRef(skinOption);
    const prefabSkinNameRef = useRef(prefabSkinName);
    const prefabAnimationRef = useRef(prefabAnimation);
    const tintColorRef = useRef<SpineTint | null>(tintColor);
    const tintTransitionRef = useRef<{
        value: StorySpineTintTransition;
        elapsedMs: number;
    } | null>(tintTransition
        ? { value: tintTransition, elapsedMs: 0 }
        : null);
    const pausedRef = useRef(paused);
    const tintTransitionPayload = tintTransition
        ? JSON.stringify(tintTransition)
        : "";
    // CharacterView가 기본 애니메이션을 enum 오버로드로 열 때는 half update를
    // 사용한다. 유효한 얼굴 문자열이 한 번이라도 SetAnimation(string)으로
    // 적용되면 클라이언트가 false로 바꾸며, 이후 IDLE 복귀에도 유지된다.
    const useHalfUpdateRef = useRef(fitMode === "character");
    useEffect(() => {
        pausedRef.current = paused;
    }, [paused]);
    useEffect(() => {
        commandFaceRef.current = requestedCommandFace;
        loopRef.current = loop;
        instanceIdRef.current = instanceId;
        trackedBoneNamesRef.current = trackedBoneNames;
        trackTimeTransferFromRef.current = trackTimeTransferFrom;
        const spine = spineRef.current;
        if (!spine) {
            return;
        }
        prefabAnimationRef.current = prefabAnimation;
        const transferred = transferSpinePlayback(spine, trackTimeTransferFrom);
        const animation = requestedCommandFace
            ? findStoryRequestedSpineAnimation(animationNamesRef.current, requestedCommandFace)
            : "";
        const current = spine.state.getCurrent(0);
        const currentAnimation = current?.animation.name ?? "";
        const currentDuration = animationDurationsRef.current.get(currentAnimation) ?? 0;
        const nextDuration = animationDurationsRef.current.get(animation) ?? 0;
        const preservesTime = Boolean(current) &&
            shouldPreserveStoryEmotionAnimationTime({
                currentAnimation,
                nextAnimation: animation,
                currentDuration,
                nextDuration,
                loop,
            });
        const preservedAnimationTime = preservesTime
            ? current?.getAnimationTime() ?? 0
            : 0;
        // NKCASUISpineIllust.SetAnimation은 이름이 없으면 오류만 기록하고
        // 현재 트랙을 건드리지 않는다. IDLE이나 첫 애니메이션으로 임의
        // 대체하면 원본의 오탈자 명령에서 표정이 갑자기 바뀐다.
        if (animation) {
            useHalfUpdateRef.current = false;
            restartStorySpineAnimation(spine, hostRef.current, animation, loop, preservedAnimationTime);
            const returnAnimation = !loop
                ? findStoryDefaultSpineAnimation(animationNamesRef.current)
                : "";
            if (returnAnimation) {
                spine.state.addAnimation(0, returnAnimation, true, 0);
            }
            if (hostRef.current) {
                hostRef.current.dataset.spineQueuedAnimation = returnAnimation;
            }
        }
        if (animation && hostRef.current) {
            hostRef.current.dataset.spineHalfUpdate = "false";
            hostRef.current.dataset.spineAnimation = animation;
            hostRef.current.dataset.spineAnimationLoop = String(loop);
            hostRef.current.dataset.spineTrackTimeMode = preservesTime
                ? "preserved"
                : "restarted";
        }
        if (hostRef.current) {
            hostRef.current.dataset.spineTrackTimeTransfer = transferred
                ? "applied"
                : trackTimeTransferFrom
                    ? "missing"
                    : "none";
            hostRef.current.dataset.spineTransferredAnimation =
                transferred?.animation ?? "";
            hostRef.current.dataset.spineTransferredAnimationTime =
                transferred ? String(transferred.animationTime) : "";
        }
        rememberSpinePlayback(instanceId, spine);
    }, [
        animationRevision,
        instanceId,
        loop,
        prefabAnimation,
        requestedCommandFace,
        trackTimeTransferFrom,
        trackedBoneNames,
    ]);
    useEffect(() => {
        skinNameRef.current = skinName;
        skinOptionRef.current = skinOption;
        prefabSkinNameRef.current = prefabSkinName;
        const spine = spineRef.current;
        if (!spine) {
            return;
        }
        const requestedSkin = applyRequestedSkin(spine, {
            skinName,
            skinOption,
            prefabSkinName,
            backgroundEnabled,
            // 같은 CharacterView를 재사용할 때 클라이언트는 프리팹 시작 스킨을
            // 다시 적용하지 않는다. background/SKIN_n/이름 스킨이 모두 없으면
            // 현재 스킨을 그대로 유지한다.
            includePrefabSkin: false,
        });
        if (hostRef.current) {
            hostRef.current.dataset.spineSkin =
                requestedSkin || spine.skeleton.skin?.name || "";
        }
    }, [backgroundEnabled, prefabSkinName, skinName, skinOption]);
    useEffect(() => {
        tintColorRef.current = tintColor;
        if (spineRef.current && !tintTransitionRef.current) {
            applyTint(spineRef.current, tintColor, hostRef.current);
        }
    }, [tintColor]);
    useEffect(() => {
        const nextTransition = tintTransitionPayload
            ? JSON.parse(tintTransitionPayload) as StorySpineTintTransition
            : null;
        tintTransitionRef.current = nextTransition
            ? { value: nextTransition, elapsedMs: 0 }
            : null;
        if (spineRef.current) {
            applyTint(spineRef.current, nextTransition?.start ?? tintColorRef.current, hostRef.current);
        }
    }, [tintTransitionPayload]);
    useEffect(() => {
        const host = hostRef.current;
        if (!host) {
            return;
        }
        const controller = new AbortController();
        let cancelled = false;
        let resizeObserver: ResizeObserver | null = null;
        let app: import("pixi.js").Application | null = null;
        let atlas: import("@pixi-spine/base").TextureAtlas | null = null;
        let baseTexture: import("pixi.js").BaseTexture | null = null;
        let tickerUpdate: (() => void) | null = null;
        let animationUpdateAccumulator = 0;
        let animationUpdateCount = 0;
        void (async () => {
            try {
                const [{ pixi, spineBase, spineRuntime }, source] = await Promise.all([
                    preloadStorySpineRuntime(),
                    preloadStorySpineAsset(asset),
                ]);
                const { jsonText, atlasText, image } = source;
                if (cancelled) {
                    return;
                }
                app = new pixi.Application({
                    resizeTo: host,
                    backgroundAlpha: 0,
                    antialias: true,
                    autoDensity: true,
                    resolution: Math.min(window.devicePixelRatio || 1, 2),
                });
                host.replaceChildren(app.view as HTMLCanvasElement);
                baseTexture = new pixi.BaseTexture(image, {
                    scaleMode: pixi.SCALE_MODES.LINEAR,
                    mipmap: pixi.MIPMAP_MODES.ON,
                    alphaMode: pixi.ALPHA_MODES.PMA,
                });
                const loadedAtlas = await new Promise<import("@pixi-spine/base").TextureAtlas>((resolve, reject) => {
                    try {
                        new spineBase.TextureAtlas(atlasText, (_pagePath, callback) => callback(baseTexture!), resolve);
                    }
                    catch (error) {
                        reject(error);
                    }
                });
                atlas = loadedAtlas;
                const attachmentLoader = new spineRuntime.AtlasAttachmentLoader(loadedAtlas);
                const parser = new spineRuntime.SkeletonJson(attachmentLoader);
                const skeletonJson: unknown = JSON.parse(jsonText);
                normalizeSpineTimelineTimes(skeletonJson);
                const skeletonData = parser.readSkeletonData(skeletonJson);
                const spine = new spineRuntime.Spine(skeletonData);
                const animationNames = skeletonData.animations.map((animation) => animation.name);
                const animationDurations = new Map(skeletonData.animations.map((animation) => [
                    animation.name,
                    animation.duration,
                ]));
                // SPINE_BG는 CharacterView의 SetDefaultAnimation 대상이 아니다.
                // 프리팹 SkeletonGraphic이 지정한 시작 애니메이션과 loop를 그대로
                // 유지하고, 일반 본체만 기존 IDLE 기본 경로를 사용한다.
                const defaultAnimation = prefabAnimationOnly
                    ? animationNames.includes(prefabAnimationRef.current)
                        ? prefabAnimationRef.current
                        : ""
                    : findStoryInitialSpineAnimation(animationNames, "", prefabAnimationRef.current);
                const usesPrefabStartingAnimation = Boolean(defaultAnimation) &&
                    defaultAnimation === prefabAnimationRef.current &&
                    (prefabAnimationOnly || !animationNames.includes("IDLE"));
                const defaultAnimationLoop = usesPrefabStartingAnimation
                    ? prefabAnimationLoop
                    : true;
                animationNamesRef.current = animationNames;
                animationDurationsRef.current = animationDurations;
                spine.autoUpdate = false;
                if (typeof asset.defaultMix === "number" &&
                    Number.isFinite(asset.defaultMix) &&
                    asset.defaultMix >= 0) {
                    spine.stateData.defaultMix = asset.defaultMix;
                }
                host.dataset.spineDefaultMix = String(spine.stateData.defaultMix);
                const requestedSkin = applyRequestedSkin(spine, {
                    skinName: skinNameRef.current,
                    skinOption: skinOptionRef.current,
                    prefabSkinName: prefabSkinNameRef.current,
                    backgroundEnabled,
                });
                host.dataset.spineSkin =
                    requestedSkin || spine.skeleton.skin?.name || "";
                applyTint(spine, tintTransitionRef.current?.value.start ?? tintColorRef.current, host);
                if (defaultAnimation) {
                    // CharacterView는 새 일러스트를 연 직후 일반 유닛의 IDLE을
                    // 반복 재생으로 설정하고, MOVE 시간과 얼굴 명령은 그 다음에
                    // 순서대로 적용한다.
                    restartStorySpineAnimation(spine, host, defaultAnimation, defaultAnimationLoop);
                    host.dataset.spineAnimation = defaultAnimation;
                    host.dataset.spineAnimationLoop = String(defaultAnimationLoop);
                    host.dataset.spinePrefabAnimationFallback = String(usesPrefabStartingAnimation);
                    host.dataset.spineTrackTimeMode = "initial";
                }
                useHalfUpdateRef.current = fitMode === "character";
                host.dataset.spineHalfUpdate = String(useHalfUpdateRef.current);
                const transferred = transferSpinePlayback(spine, trackTimeTransferFromRef.current);
                const requestedAnimation = commandFaceRef.current
                    ? findStoryRequestedSpineAnimation(animationNames, commandFaceRef.current)
                    : "";
                if (requestedAnimation) {
                    useHalfUpdateRef.current = false;
                    host.dataset.spineHalfUpdate = "false";
                    const current = spine.state.getCurrent(0);
                    const currentAnimation = current?.animation.name ?? "";
                    const preservesTime = Boolean(current) &&
                        shouldPreserveStoryEmotionAnimationTime({
                            currentAnimation,
                            nextAnimation: requestedAnimation,
                            currentDuration: animationDurations.get(currentAnimation) ?? 0,
                            nextDuration: animationDurations.get(requestedAnimation) ?? 0,
                            loop: loopRef.current,
                        });
                    const preservedAnimationTime = preservesTime
                        ? current?.getAnimationTime() ?? 0
                        : 0;
                    restartStorySpineAnimation(spine, host, requestedAnimation, loopRef.current, preservedAnimationTime);
                    host.dataset.spineAnimation = requestedAnimation;
                    host.dataset.spineAnimationLoop = String(loopRef.current);
                    host.dataset.spineTrackTimeMode = preservesTime
                        ? "preserved"
                        : "restarted";
                    const returnAnimation = !loopRef.current
                        ? findStoryDefaultSpineAnimation(animationNames)
                        : "";
                    if (returnAnimation) {
                        spine.state.addAnimation(0, returnAnimation, true, 0);
                    }
                    host.dataset.spineQueuedAnimation = returnAnimation;
                }
                host.dataset.spineTrackTimeTransfer = transferred
                    ? "applied"
                    : trackTimeTransferFromRef.current
                        ? "missing"
                        : "none";
                host.dataset.spineTransferredAnimation =
                    transferred?.animation ?? "";
                host.dataset.spineTransferredAnimationTime = transferred
                    ? String(transferred.animationTime)
                    : "";
                rememberSpinePlayback(instanceIdRef.current, spine);
                app.stage.addChild(spine);
                spineRef.current = spine;
                tickerUpdate = () => {
                    const activeSpine = spineRef.current;
                    if (!activeSpine || !app || pausedRef.current) {
                        return;
                    }
                    try {
                        const deltaSeconds = Math.max(app.ticker.deltaMS / 1000, 0);
                        let updateDeltaSeconds = deltaSeconds;
                        const tintTween = tintTransitionRef.current;
                        if (tintTween) {
                            tintTween.elapsedMs = Math.min(tintTween.elapsedMs + app.ticker.deltaMS, Math.max(tintTween.value.durationMs, 0));
                            applyTint(activeSpine, interpolateTint(tintTween.value, tintTween.elapsedMs), host);
                        }
                        // 기본 클라이언트는 60fps + 보통 애니메이션 품질에서
                        // CharacterView의 SkeletonGraphic만 half update를 사용한다.
                        // 배경 Spine은 CharacterView가 아니므로 매 프레임 갱신한다.
                        if (fitMode === "character" && useHalfUpdateRef.current) {
                            animationUpdateAccumulator += deltaSeconds;
                            if (animationUpdateAccumulator <
                                STORY_CHARACTER_UPDATE_INTERVAL_SECONDS) {
                                return;
                            }
                            updateDeltaSeconds = animationUpdateAccumulator;
                            animationUpdateAccumulator = 0;
                        }
                        activeSpine.update(updateDeltaSeconds);
                        animationUpdateCount += 1;
                        host.dataset.spineUpdateCount = String(animationUpdateCount);
                        host.dataset.spineUpdateDeltaSeconds = String(updateDeltaSeconds);
                        const activeAnimation = activeSpine.state.getCurrent(0)?.animation.name;
                        const activeAnimationTime = activeSpine.state.getCurrent(0)?.getAnimationTime();
                        if (activeAnimation) {
                            host.dataset.spineAnimation = activeAnimation;
                            host.dataset.spineAnimationLoop = String(activeSpine.state.getCurrent(0)?.loop ?? false);
                        }
                        if (typeof activeAnimationTime === "number") {
                            host.dataset.spineAnimationTime =
                                String(activeAnimationTime);
                        }
                        rememberSpinePlayback(instanceIdRef.current, activeSpine);
                        rememberSpineBonePositions(instanceIdRef.current, activeSpine, host, trackedBoneNamesRef.current);
                    }
                    catch (error) {
                        host.dataset.spineError =
                            error instanceof Error ? error.message : String(error);
                        activeSpine.visible = false;
                        if (tickerUpdate) {
                            app.ticker.remove(tickerUpdate);
                        }
                    }
                };
                app.ticker.add(tickerUpdate);
                const layout = () => {
                    if (cancelled || !app || !spineRef.current) {
                        return;
                    }
                    const hostWidth = Math.max(host.clientWidth, 1);
                    const hostHeight = Math.max(host.clientHeight, 1);
                    if (Math.abs(app.screen.width - hostWidth) > 0.5 ||
                        Math.abs(app.screen.height - hostHeight) > 0.5) {
                        app.renderer.resize(hostWidth, hostHeight);
                    }
                    const target = spineRef.current;
                    target.scale.set(1);
                    target.position.set(0, 0);
                    try {
                        target.update(0);
                    }
                    catch (error) {
                        // ResizeObserver가 cleanup과 같은 프레임에 전달되면 Pixi가 이미
                        // 파기한 슬롯을 layout할 수 있다. 이 teardown 경합은 로딩 실패가
                        // 아니므로 조용히 끝내고, 활성 인스턴스의 오류만 보고한다.
                        if (!cancelled) {
                            host.dataset.spineError =
                                error instanceof Error ? error.message : String(error);
                            target.visible = false;
                        }
                        return;
                    }
                    target.visible = true;
                    const usesStoryStageMask = layoutCoordinateSpace === "story-stage-mask";
                    const storyStageSkeletonScale = Number(asset.skeletonScale);
                    if (usesStoryStageMask &&
                        (!asset.layout ||
                            !Number.isFinite(storyStageSkeletonScale) ||
                            storyStageSkeletonScale <= 0)) {
                        host.dataset.spineError =
                            "Story stage Spine layout/skeletonScale metadata is missing";
                        target.visible = false;
                        return;
                    }
                    const storyStageSkeletonPixelsPerUnit = usesStoryStageMask
                        ? storyStageSkeletonScale * 100
                        : 1;
                    const referenceHeight = usesStoryStageMask
                        ? STORY_STAGE_SPINE_HEIGHT
                        : fitMode === "background"
                            ? CUTSCENE_BACKGROUND_HEIGHT
                            : CUTSCENE_SLOT_HEIGHT;
                    const referenceWidth = usesStoryStageMask
                        ? STORY_STAGE_SPINE_WIDTH
                        : fitMode === "background"
                            ? CUTSCENE_BACKGROUND_WIDTH
                            : CUTSCENE_SLOT_WIDTH;
                    // CharacterView의 RectTransform은 캐릭터 기준 좌표만 제공하며
                    // Mask/RectMask2D가 아니다. 따라서 일반 캐릭터의 렌더 표면을
                    // 슬롯 크기로 자르지 않고, 전체 CanvasScaler(1920×1080)의 배율로
                    // 좌표와 크기만 환산한다. Pinup은 별도 원본 Mask 계층에서 자른다.
                    const referenceScale = usesStoryStageMask
                        ? Math.min(app.screen.width / STORY_STAGE_SPINE_WIDTH, app.screen.height / STORY_STAGE_SPINE_HEIGHT)
                        : fitMode === "background"
                            ? Math.max(app.screen.width / referenceWidth, app.screen.height / referenceHeight)
                            : Math.min(app.screen.width / CUTSCENE_BACKGROUND_WIDTH, app.screen.height / CUTSCENE_BACKGROUND_HEIGHT);
                    if (asset.layout) {
                        const flipX = asset.layout.flipX ? -1 : 1;
                        const flipY = asset.layout.flipY ? -1 : 1;
                        const parentOffsetX = usesStoryStageMask
                            ? STORY_STAGE_SPINE_PARENT_OFFSET_X
                            : 0;
                        const parentOffsetY = usesStoryStageMask
                            ? STORY_STAGE_SPINE_PARENT_OFFSET_Y
                            : 0;
                        target.scale.set(asset.layout.scaleX *
                            storyStageSkeletonPixelsPerUnit *
                            referenceScale *
                            flipX, asset.layout.scaleY *
                            storyStageSkeletonPixelsPerUnit *
                            referenceScale *
                            flipY);
                        target.rotation = (-asset.layout.rotation * Math.PI) / 180;
                        target.position.set(app.screen.width / 2 +
                            (asset.layout.x + parentOffsetX) * referenceScale, app.screen.height / 2 -
                            (asset.layout.y + parentOffsetY) * referenceScale);
                        host.dataset.spineLayoutReferenceScale = String(referenceScale);
                        host.dataset.spineSkeletonScale = String(asset.skeletonScale ?? "");
                        host.dataset.spineSkeletonPixelsPerUnit = String(storyStageSkeletonPixelsPerUnit);
                        host.dataset.spineLayoutParentOffsetX = String(parentOffsetX);
                        host.dataset.spineLayoutParentOffsetY = String(parentOffsetY);
                        host.dataset.spineLayoutResolvedX = String(target.position.x);
                        host.dataset.spineLayoutResolvedY = String(target.position.y);
                        host.dataset.spineLayoutResolvedScaleX = String(target.scale.x);
                        host.dataset.spineLayoutResolvedScaleY = String(target.scale.y);
                        rememberSpineBonePositions(instanceIdRef.current, target, host, trackedBoneNamesRef.current);
                        return;
                    }
                    const bounds = target.getLocalBounds();
                    const scale = Math.min((referenceWidth * referenceScale) /
                        Math.max(bounds.width, 1), app.screen.height / Math.max(bounds.height, 1));
                    target.scale.set(scale);
                    target.position.set(app.screen.width / 2 - (bounds.x + bounds.width / 2) * scale, app.screen.height - (bounds.y + bounds.height) * scale);
                    rememberSpineBonePositions(instanceIdRef.current, target, host, trackedBoneNamesRef.current);
                };
                requestAnimationFrame(layout);
                resizeObserver = new ResizeObserver(layout);
                resizeObserver.observe(host);
            }
            catch (error) {
                if (!controller.signal.aborted && !cancelled) {
                    host.dataset.spineError =
                        error instanceof Error ? error.message : String(error);
                    host.replaceChildren();
                }
            }
        })();
        return () => {
            cancelled = true;
            controller.abort();
            resizeObserver?.disconnect();
            const activeSpine = spineRef.current;
            if (activeSpine) {
                rememberSpinePlayback(instanceIdRef.current, activeSpine);
                activeSpine.autoUpdate = false;
            }
            if (tickerUpdate) {
                app?.ticker.remove(tickerUpdate);
            }
            app?.ticker.stop();
            spineRef.current = null;
            spineBonePositions.delete(instanceIdRef.current);
            animationNamesRef.current = [];
            animationDurationsRef.current = new Map();
            app?.destroy(true, { children: true });
            atlas?.dispose();
            if (!atlas) {
                baseTexture?.destroy();
            }
        };
    }, [
        asset,
        backgroundEnabled,
        fitMode,
        layoutCoordinateSpace,
        prefabAnimationLoop,
        prefabAnimationOnly,
    ]);
    return (<div ref={hostRef} className={styles.host} aria-label={label} data-spine-asset-id={asset.id} data-spine-instance-id={instanceId} data-spine-default-mix={asset.defaultMix ?? ""} data-spine-track-time-source={trackTimeTransferFrom} data-spine-update-mode={fitMode === "character" ? "half-30fps" : "every-frame"} data-spine-layout-coordinate-space={layoutCoordinateSpace}/>);
}
