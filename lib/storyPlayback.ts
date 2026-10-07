export type StoryFxControl = "NCSC_STOP" | "NCSC_ONE_TIME_PLAY" | "NCSC_LOOP_PLAY";
export type StoryFxEvent = {
    name: string;
    path: string;
    action: "play" | "stop";
    loop: boolean;
};
// 클라이언트 기본 프레임 제한은 60 FPS이며 NKCUITypeWriter.Update는
// 한 프레임에 보이는 글자를 최대 하나만 늘린다. 원본 cool time이
// 1~15ms처럼 짧아도 실제 표시는 한 프레임보다 빨라질 수 없다.
export const STORY_TYPEWRITER_FRAME_MS = 1000 / 60;
export function getStoryTypewriterStepDurationMs(coolTimeMs: number) {
    if (!Number.isFinite(coolTimeMs) || coolTimeMs <= 0) {
        return 0;
    }
    const frameCount = Math.max(Math.ceil(coolTimeMs / STORY_TYPEWRITER_FRAME_MS - 1e-9), 1);
    // 곱셈 순서를 이렇게 두면 6프레임=100ms처럼 정수로 떨어지는 값에
    // 불필요한 부동소수점 꼬리가 생기지 않는다.
    return (frameCount * 1000) / 60;
}
export function getStoryStartedTypewriterStepDurationMs(coolTimeMs: number) {
    // TitleMgr는 cool time이 0이어도 TalkBox처럼 Start를 건너뛰지 않는다.
    // NKCUITypeWriter.Update가 한 프레임에 한 글자만 늘리므로 최소 한 프레임이
    // 필요하다.
    return Math.max(getStoryTypewriterStepDurationMs(coolTimeMs), STORY_TYPEWRITER_FRAME_MS);
}
export type StoryTypewriterTarget = "legacy" | "tmp";
export type StoryTypewriterRuntimeState = {
    target: StoryTypewriterTarget;
    currentIndex: number;
    maxVisibleCharacters: number;
    displayedCharacters: number;
    finalTextCharacters: number;
    targetTextCharacters: number;
    finalText: string;
    targetText: string;
    typing: boolean;
};
export function createStoryTypewriterRuntimeState(target: StoryTypewriterTarget): StoryTypewriterRuntimeState {
    return {
        target,
        currentIndex: 1,
        // TMP_Text의 생성자 기본값이다. legacy Text에는 이 제한이 없지만 같은
        // 상태 모양을 쓰기 위해 충분히 큰 값으로 둔다.
        maxVisibleCharacters: 99999,
        displayedCharacters: 0,
        finalTextCharacters: 0,
        targetTextCharacters: 0,
        finalText: "",
        targetText: "",
        typing: false,
    };
}
export function startStoryTypewriter(previous: StoryTypewriterRuntimeState, pureTextCount: number, coolTime: number, append: boolean, targetText = ""): StoryTypewriterRuntimeState {
    const count = Math.max(Math.trunc(pureTextCount), 0);
    // TalkBox Open은 coolTime <= 0이면 NKCUITypeWriter.Start를 호출하지 않는다.
    // TMP 대상은 기존 maxVisibleCharacters가 그대로 적용되고, legacy Text는
    // 전달받은 문자열 전체를 즉시 표시한다.
    if (coolTime <= 0) {
        return {
            ...previous,
            displayedCharacters: previous.target === "tmp"
                ? Math.min(previous.maxVisibleCharacters, count)
                : count,
            targetTextCharacters: count,
            targetText,
            typing: false,
        };
    }
    if (append) {
        return {
            ...previous,
            displayedCharacters: previous.target === "tmp"
                ? Math.min(previous.maxVisibleCharacters, count)
                : Math.min(previous.displayedCharacters, count),
            finalTextCharacters: count,
            targetTextCharacters: count,
            finalText: targetText,
            targetText,
            typing: true,
        };
    }
    return {
        ...previous,
        currentIndex: 1,
        maxVisibleCharacters: previous.target === "tmp" ? 0 : previous.maxVisibleCharacters,
        displayedCharacters: 0,
        finalTextCharacters: count,
        targetTextCharacters: count,
        finalText: targetText,
        targetText,
        typing: true,
    };
}
export function advanceStoryTypewriter(previous: StoryTypewriterRuntimeState, pureTextCount: number): StoryTypewriterRuntimeState {
    const count = Math.max(Math.trunc(pureTextCount), 0);
    if (!previous.typing || previous.currentIndex > count) {
        return { ...previous, typing: false };
    }
    const displayedCharacters = Math.min(previous.currentIndex, count);
    const currentIndex = previous.currentIndex + 1;
    return {
        ...previous,
        currentIndex,
        maxVisibleCharacters: previous.target === "tmp"
            ? previous.currentIndex
            : previous.maxVisibleCharacters,
        displayedCharacters,
        typing: currentIndex <= count,
    };
}
export function finishStoryTypewriter(previous: StoryTypewriterRuntimeState): StoryTypewriterRuntimeState {
    const count = previous.finalTextCharacters;
    return {
        ...previous,
        // NKCUITypeWriter.Finish는 자연 완료의 count + 1과 달리 정확히 count를
        // 저장한다. 바로 뒤 TalkAppend의 첫 타이밍에도 이 차이가 이어진다.
        currentIndex: count,
        maxVisibleCharacters: previous.target === "tmp" ? count : previous.maxVisibleCharacters,
        displayedCharacters: previous.target === "tmp"
            ? Math.min(previous.targetTextCharacters, count)
            : count,
        targetTextCharacters: previous.target === "legacy"
            ? count
            : previous.targetTextCharacters,
        targetText: previous.target === "legacy"
            ? previous.finalText
            : previous.targetText,
        typing: false,
    };
}
export type StoryTitleTypewriterDisplay = {
    titleCharacters: number;
    subtitleCharacters: number;
};
export function isStoryTitleTypewriterRunning(display: StoryTitleTypewriterDisplay, titleCharacters: number, subtitleCharacters: number, manuallyFinished: boolean) {
    if (manuallyFinished) {
        return false;
    }
    return Boolean(display.titleCharacters < Math.max(Math.trunc(titleCharacters), 0) ||
        display.subtitleCharacters <
            Math.max(Math.trunc(subtitleCharacters), 0));
}
export function finishStoryTitleTypewriter(previous: StoryTitleTypewriterDisplay, titleCharacters: number, subtitleCharacters: number): StoryTitleTypewriterDisplay {
    const titleCount = Math.max(Math.trunc(titleCharacters), 0);
    const subtitleCount = Math.max(Math.trunc(subtitleCharacters), 0);
    // TitleMgr는 NKCUITypeWriter 하나로 부제를 먼저 쓰고, 자연 완료된 뒤에만
    // 제목을 시작한다. 재생 중 Finish를 누르면 현재 대상 하나만 완성되므로
    // 아직 시작하지 않은 제목까지 동시에 표시하면 안 된다.
    if (previous.subtitleCharacters < subtitleCount) {
        return {
            titleCharacters: Math.min(previous.titleCharacters, titleCount),
            subtitleCharacters: subtitleCount,
        };
    }
    if (previous.titleCharacters < titleCount) {
        return {
            titleCharacters: titleCount,
            subtitleCharacters: Math.min(previous.subtitleCharacters, subtitleCount),
        };
    }
    return {
        titleCharacters: Math.min(previous.titleCharacters, titleCount),
        subtitleCharacters: Math.min(previous.subtitleCharacters, subtitleCount),
    };
}
export function clearStoryTypewriterTarget(previous: StoryTypewriterRuntimeState): StoryTypewriterRuntimeState {
    return {
        ...previous,
        displayedCharacters: 0,
        targetTextCharacters: 0,
        targetText: "",
        typing: false,
    };
}
export type StoryCommand = {
    key: number;
    waitClick: boolean;
    waitTime: number;
    talkTime: number;
    talkAppend: boolean;
    talkCenterFadeIn?: boolean;
    talkCenterFadeOut?: boolean;
    talkCenterFadeTime?: number;
    closeTalkBox?: boolean;
    titleClear?: boolean;
    titleFadeOut?: boolean;
    titleFadeOutTime?: number;
    titleTalkTime?: number;
    subtitleTalkTime?: number;
    text?: string;
    talkText?: string;
    talkLayoutBreaks?: number[];
    talkLayoutStartCharacters?: number;
    talkLayoutTypewriterCharacters?: number;
    textType?: "talk" | "subtitle" | "title";
    titleText?: string;
    subtitleText?: string;
    action?: "SELECT" | "MARK" | "JUMP" | "PLAY_MUSIC" | string;
    actionKey?: string;
    actionMusicName?: string;
    actionMusicPath?: string;
    actionMusicStartTime?: number;
    characterId?: string;
    position?: string;
    face?: string;
    characterScale?: number[];
    characterOffset?: number[];
    characterScaleTime?: number;
    pinup?: boolean;
    pinupEasingTime?: number;
    characterFadeIn?: boolean;
    characterFadeOut?: boolean;
    characterHologram?: boolean;
    characterFlip?: boolean;
    faceLoop?: boolean;
    characterCrash?: number;
    bounce?: number[];
    trackingTime?: number;
    clear?: boolean;
    fadeIn?: boolean;
    fadeWhite?: boolean;
    fadeTime?: number;
    looseShake?: boolean;
    flashBangTime?: number;
    backgroundName?: string;
    backgroundUrl?: string;
    backgroundGameObject?: boolean;
    backgroundLoop?: boolean;
    backgroundFilter?: string;
    backgroundCrash?: number;
    backgroundCrashTime?: number;
    backgroundFadeInStartColor?: number[];
    backgroundFadeInColor?: number[];
    backgroundFadeOutColor?: number[];
    backgroundFadeInTime?: number;
    backgroundFadeOutTime?: number;
    backgroundFadeInEase?: string;
    backgroundFadeOutEase?: string;
    backgroundAnimationNoWait?: boolean;
    backgroundAnimationTime?: number;
    backgroundAnimatePosition?: boolean;
    backgroundOffset?: number[];
    backgroundAnimateScale?: boolean;
    backgroundScale?: number[];
    backgroundPositionTween?: string;
    backgroundScaleTween?: string;
    backgroundAnimationName?: string;
    backgroundSpine?: StorySpineAssetData;
    backgroundDefaultAnimation?: string;
    backgroundDefaultLoop?: boolean;
    gameObjectEffect?: StoryGameObjectEffect;
    imageName?: string;
    imageUrl?: string;
    imageScale?: number;
    imageOffset?: number[];
    movieName?: string;
    movieUrl?: string;
    movieSkipEnable?: boolean;
    bgmName?: string;
    bgmPath?: string;
    endBgm?: boolean;
    endBgmName?: string;
    endBgmPath?: string;
    fxName?: string;
    fxPath?: string;
    fxControl?: StoryFxControl;
    endFxName?: string;
    endFxPath?: string;
    endFxControl?: StoryFxControl;
    voiceName?: string;
    voicePath?: string;
    source: Record<string, unknown>;
};
export type StorySpineAssetData = {
    id: string;
    jsonUrl: string;
    atlasUrl: string;
    textureUrl: string;
    defaultMix?: number;
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
export type StoryGameObjectEffect = {
    kind: "blood-spread" | string;
    duration: number;
    loop?: boolean;
    assets: string[];
    triggerDelay?: number;
    layers?: Array<{
        index: number;
        x: number;
        y: number;
        width: number;
        height: number;
        rgbMultiplier: number;
        alpha: number;
        duration: number;
        framePeriod: number;
        columns: number;
        rows: number;
        startFrame: number;
        endFrame: number;
    }>;
    spriteLayers?: StoryFxmSpriteLayer[];
    particleLayers?: StoryFxmParticleLayer[];
    circuitBoard?: StoryCircuitBoardEffect;
    chain?: StoryChainEffect;
    waveAura?: StoryWaveAuraEffect;
    waveDistortion?: StoryWaveDistortionEffect;
    waveShockwave?: StoryWaveRenderStageMeshEffect;
    iceMaterial?: StoryIceMaterialEffect;
    slashTrace?: StorySlashTraceEffect;
    mainstream134011Aura?: StoryMainstream134011AuraEffect;
    animationVariants?: Record<string, {
        particlePaths?: string[];
        spritePaths?: string[];
        auraPaths?: string[];
    }>;
    randomVariants?: Record<string, {
        weights: number[];
    }>;
    trackedSpineBones?: string[];
    transientSpriteDuration?: number;
    animationNames?: string[];
    backgroundOnly?: boolean;
    characterLayer?: "back" | "front";
    renderStageSpine?: {
        asset: StorySpineAssetData;
        animation: string;
        loop: boolean;
        tint: [
            number,
            number,
            number,
            number
        ];
        renderTexture: {
            width: number;
            height: number;
            orthographicSize: number;
        };
    };
    renderStageMesh?: StoryWaveRenderStageMeshEffect;
    renderStageTrackedSpineBones?: string[];
    sourceInactiveParts?: string[];
    renderStageSpineSource?: {
        bundle: string;
        modelName: string;
        layout: NonNullable<StorySpineAssetData["layout"]>;
        animation: string;
        loop: boolean;
        tint: [
            number,
            number,
            number,
            number
        ];
        renderTexture: {
            width: number;
            height: number;
            orthographicSize: number;
        };
    };
    unsupportedParts?: string[];
};
export type StoryMainstream134011AuraEffect = {
    dataPath: string;
};
export type StoryMainstream134011AuraProperty = {
    name: string;
    mode: number;
    constant: [
        number,
        number,
        number,
        number
    ];
    time: [
        number,
        number,
        number,
        number
    ];
};
export type StoryMainstream134011AuraSource = {
    renderWidth: number;
    renderHeight: number;
    orthographicSize: number;
    shader: string;
    textures: {
        main: string;
        mask: string;
        ramp: string;
    };
    mesh: {
        name: string;
        positions: number[];
        uvs: number[];
        indices: number[];
        vertexCount: number;
        triangleCount: number;
    };
    material: {
        floats: Record<string, number>;
        colors: Record<string, [
            number,
            number,
            number,
            number
        ]>;
        textureTransforms: Record<string, [
            number,
            number,
            number,
            number
        ]>;
    };
    layers: Array<{
        path: string;
        camera: "back" | "front";
        transformChain: StoryFxmTransformNode[];
        properties: StoryMainstream134011AuraProperty[];
    }>;
};
export type StoryWaveAuraEffect = {
    path: string;
    startTime: number;
    duration: number;
    sortingOrder: number;
    transformChain: StoryFxmTransformNode[];
    mesh: {
        name: string;
        positions: number[];
        uvs: number[];
        indices: number[];
        vertexCount: number;
        triangleCount: number;
    };
    shader: StoryCircuitShader;
    material: {
        mainTexture: string;
        mainDsTexture: string;
        dissolveTexture: string;
        maskTexture: string;
        rampTexture: string;
        textureSettings: Record<"main" | "mainDs" | "dissolve" | "mask" | "ramp", StoryIceMaterialTexture>;
        intensity: number;
        mainDsAmount: number;
        mainDsU: number;
        mainDsV: number;
        rampRange: number;
        rampOffset: number;
        mainTexAngle: number;
        maskAngle: number;
        tint: [
            number,
            number,
            number,
            number
        ];
        tintGradient: StoryFxmGradient;
        mainScale: [
            number,
            number
        ];
        mainScroll: [
            number,
            number
        ];
        mainDsScale: [
            number,
            number
        ];
        mainDsScroll: [
            number,
            number
        ];
    };
};
export type StoryWaveDistortionEffect = {
    mesh: {
        name: string;
        positions: number[];
        uvs: number[];
        indices: number[];
        vertexCount: number;
        triangleCount: number;
    };
    shader: StoryCircuitShader;
    textures: Record<"noise" | "base" | "mask", StoryIceMaterialTexture>;
    material: {
        distortion: number;
        speed: number;
        noiseScale: [
            number,
            number
        ];
        baseScale: [
            number,
            number
        ];
        baseOffset: [
            number,
            number
        ];
    };
    layers: Array<{
        id: number;
        path: string;
        startTime: number;
        duration: number;
        sortingOrder: number;
        transformChain: StoryFxmTransformNode[];
        distortionCurve: StoryFxmCurveKey[];
        distortionMultiplier: number;
        speed: number;
        noiseScale: [
            number,
            number
        ];
        baseScale: [
            number,
            number
        ];
        baseOffset: [
            number,
            number
        ];
        rotationSpeed: number;
    }>;
};
export type StoryWaveRenderStageMaterialProperty = {
    name: string;
    mode: number;
    constant: [
        number,
        number,
        number,
        number
    ];
    time: [
        number,
        number,
        number,
        number
    ];
    random: boolean;
    randomRange: [
        number,
        number,
        number,
        number
    ];
    curveX: StoryFxmCurveKey[];
    curveY: StoryFxmCurveKey[];
    curveZ: StoryFxmCurveKey[];
    curveW: StoryFxmCurveKey[];
    gradient: StoryFxmGradient;
    color?: [
        number,
        number,
        number,
        number
    ];
    texture?: string;
};
export type StoryWaveRenderStageMeshEffect = {
    duration?: number;
    loop?: boolean;
    rawImageColor: [
        number,
        number,
        number,
        number
    ];
    meshes: Record<string, {
        name: string;
        positions: number[];
        uvs: number[];
        indices: number[];
        vertexCount: number;
        triangleCount: number;
    }>;
    textures: Record<string, StoryIceMaterialTexture>;
    materials: Record<string, {
        shader: StoryCircuitShader;
        textureSlots: Record<string, string>;
        floats: Record<string, number>;
        colors: Record<string, [
            number,
            number,
            number,
            number
        ]>;
        textureTransforms: Record<string, [
            number,
            number,
            number,
            number
        ]>;
    }>;
    layers: Array<{
        id: number;
        path: string;
        mesh: string;
        material: string;
        startTime: number;
        duration: number;
        additiveCurve: boolean;
        sortingOrder: number;
        transformChain: StoryFxmTransformNode[];
        properties: StoryWaveRenderStageMaterialProperty[];
    }>;
};
export type StoryChainEffect = {
    mainTexture: string;
    maskTexture: string;
    maskAngle: number;
    maskRef: number;
    inactivePlayers: string[];
    shader: StoryCircuitShader;
    layers: Array<{
        id: number;
        path: string;
        startTime: number;
        duration: number;
        x: number;
        y: number;
        width: number;
        height: number;
        rotation: number;
        mainTilingX: number;
        tint: [
            number,
            number,
            number,
            number
        ];
        intensity: number;
        maskScaleX: number;
        maskScaleY: number;
        maskCurveFactorX: number;
        maskCurveFactorY: number;
        maskCurveX: StoryFxmCurveKey[];
        maskCurveY: StoryFxmCurveKey[];
        scrollStart: number;
        scrollSpeed: number;
        scrollCurve: StoryFxmCurveKey[];
    }>;
};
export type StoryCircuitBoardCurve = {
    attribute: string;
    path: string;
    keys: StoryFxmCurveKey[];
};
export type StoryCircuitBoardEffect = {
    base: string;
    emissive: string;
    core: string;
    renderWidth: number;
    renderHeight: number;
    rawImageAspect: number;
    cameraFieldOfView: number;
    cameraZ: number;
    boardScale: number;
    coreScale: number;
    boardMaterial: StoryCircuitMaterial;
    boardShader: StoryCircuitShader;
    shockwave: {
        sourceDuration: number;
        timeScale: number;
        duration: number;
        localScale: number;
        scaleFactor: number;
        scaleCurve: StoryFxmCurveKey[];
        materialEvaluator: {
            startTime: number;
            duration: number;
            additiveCurve: boolean;
            properties: StoryCircuitMaterialProperty[];
        };
        textures: Record<"main" | "distortion" | "mask" | "ramp", StoryCircuitTexture>;
        material: StoryCircuitMaterial;
        shader: StoryCircuitShader;
    };
    clips: Array<{
        name: string;
        duration: number;
        curves: StoryCircuitBoardCurve[];
    }>;
    triggerDelays: Record<string, number>;
};
export type StoryCircuitTexture = {
    path: string;
    wrapU: number;
    wrapV: number;
    filterMode: number;
};
export type StoryCircuitMaterial = {
    floats: Record<string, number>;
    colors: Record<string, [
        number,
        number,
        number,
        number
    ]>;
    textures: Record<string, {
        scale: [
            number,
            number
        ];
        offset: [
            number,
            number
        ];
    }>;
};
export type StoryCircuitShader = {
    name: string;
    programSha256: string;
};
export type StoryFxmGradient = {
    colors: Array<{
        time: number;
        value: [
            number,
            number,
            number
        ];
    }>;
    alphas: Array<{
        time: number;
        value: number;
    }>;
};
export type StoryCircuitMaterialProperty = {
    name: string;
    mode: number;
    constant: [
        number,
        number,
        number,
        number
    ];
    curveX: StoryFxmCurveKey[];
    curveY: StoryFxmCurveKey[];
    curveZ: StoryFxmCurveKey[];
    curveW: StoryFxmCurveKey[];
    gradient: {
        colors: Array<{
            time: number;
            value: [
                number,
                number,
                number
            ];
        }>;
        alphas: Array<{
            time: number;
            value: number;
        }>;
    };
};
export type StoryFxmParticleCustomCurve = {
    min?: number;
    max?: number;
    minCurve?: StoryFxmCurveKey[];
    maxCurve?: StoryFxmCurveKey[];
    minMultiplier?: number;
    maxMultiplier?: number;
};
export type StoryFxmParticleLayer = {
    id: number;
    path: string;
    assetIndex: number;
    assetIndices?: number[];
    playerDelay?: number;
    playerDelays?: number[];
    playerRepeatPeriod?: number;
    emissionEndTime?: number;
    randomGroup?: string;
    randomVariant?: number;
    duration: number;
    emissionDuration?: number;
    distanceEmission?: {
        boneName: string;
        rateOverDistance: number;
        duration: number;
    };
    simulationMode?: "continuous-loop";
    sourceTimeScale?: number;
    loop: boolean;
    prewarm: boolean;
    randomSeed: number;
    maxParticles?: number;
    rateOverTime: number;
    burst?: {
        time: number;
        min: number;
        max: number;
    };
    bursts?: Array<{
        time: number;
        min: number;
        max: number;
        cycleCount: number;
        repeatInterval: number;
        probability: number;
    }>;
    lifetime: {
        min: number;
        max: number;
    };
    speed?: {
        min: number;
        max: number;
    };
    velocity?: {
        enabled: boolean;
        x: {
            min: number;
            max: number;
        };
        y: {
            min: number;
            max: number;
        };
        curveX?: StoryFxmParticleCustomCurve;
        curveY?: StoryFxmParticleCustomCurve;
    };
    gravity?: {
        min: number;
        max: number;
    };
    force?: {
        x: {
            min: number;
            max: number;
        };
        y: {
            min: number;
            max: number;
        };
    };
    size: {
        min: number;
        max: number;
    };
    size3D?: {
        x: number | {
            min: number;
            max: number;
        };
        y: number | {
            min: number;
            max: number;
        };
        z: number | {
            min: number;
            max: number;
        };
        enabled?: boolean;
    };
    sizeOverLifetime?: StoryFxmCurveKey[];
    startRotation?: {
        min: number;
        max: number;
    };
    rotationOverLifetime?: {
        enabled: boolean;
        value: {
            min: number;
            max: number;
        };
        curve?: StoryFxmParticleCustomCurve;
    };
    startColor: {
        colors: Array<{
            time: number;
            value: [
                number,
                number,
                number
            ];
        }>;
        alphas: Array<{
            time: number;
            value: number;
        }>;
    };
    startColorMin?: {
        colors: Array<{
            time: number;
            value: [
                number,
                number,
                number
            ];
        }>;
        alphas: Array<{
            time: number;
            value: number;
        }>;
    };
    colorOverLifetime: {
        colors: Array<{
            time: number;
            value: [
                number,
                number,
                number
            ];
        }>;
        alphas: Array<{
            time: number;
            value: number;
        }>;
    };
    colorOverLifetimeMin?: {
        colors: Array<{
            time: number;
            value: [
                number,
                number,
                number
            ];
        }>;
        alphas: Array<{
            time: number;
            value: number;
        }>;
    };
    shape: {
        type: "rectangle";
        width: number;
        height: number;
        offsetX?: number;
        offsetY?: number;
        directionX?: number;
        directionY?: number;
    } | {
        type: "circle";
        radius: number;
        radiusThickness: number;
        scaleX?: number;
        scaleY?: number;
    } | {
        type: "edge";
        halfLength: number;
    };
    textureSheet: {
        columns: number;
        rows: number;
        startFrameMin: number;
        startFrameMax: number;
        frameOverTime?: number;
        frameOverTimeRange?: {
            min: number;
            max: number;
        };
        frameOverTimeCurve?: StoryFxmCurveKey[];
        cycles?: number;
    };
    noise: {
        strength: number;
        strengthX?: {
            min: number;
            max: number;
        };
        strengthY?: {
            min: number;
            max: number;
        };
        frequency: number;
        scrollSpeed?: number;
        positionAmount?: number;
        damping: boolean;
    };
    limitVelocity?: {
        enabled: boolean;
        minCurve: StoryFxmCurveKey[];
        maxCurve: StoryFxmCurveKey[];
        multiplier: number;
        dampen: number;
    };
    collision?: {
        type: "circle-kill";
        x: number;
        y: number;
        radius: number;
        particleRadiusScale: number;
    };
    customData?: [
        number,
        number,
        number,
        number
    ];
    customDataAlphaOverLifetime?: StoryFxmCurveKey[];
    customDataCurveX?: StoryFxmParticleCustomCurve;
    customDataCurveY?: StoryFxmParticleCustomCurve;
    materialTint?: [
        number,
        number,
        number,
        number
    ];
    renderMode?: "billboard" | "velocity-mesh";
    transformChain: StoryFxmTransformNode[];
    material: "pma" | "additive" | "nkc-ptc-pma-custom-additive" | "ui-pma-custom";
    sortingOrder: number;
};
export type StorySlashTraceEffect = {
    dataPath: string;
    baseSpineScale: number;
};
export type StorySlashTraceSpriteLayer = {
    name: string;
    texture: string;
    startTime: number;
    duration: number;
    intensity: number;
    gradient: {
        colors: Array<{
            time: number;
            value: [
                number,
                number,
                number
            ];
        }>;
        alphas: Array<{
            time: number;
            value: number;
        }>;
    };
    useAlphaCurve: boolean;
    alphaCurve: StoryFxmCurveKey[];
    x: number;
    y: number;
    width: number;
    height: number;
    pivotX: number;
    pivotY: number;
    flipX: boolean;
    flipY: boolean;
    sortingOrder: number;
};
export type StorySlashTraceSource = {
    shader: string;
    duration: number;
    renderWidth: number;
    renderHeight: number;
    orthographicSize: number;
    clearColor: [
        number,
        number,
        number,
        number
    ];
    baseSpineScale: number;
    textures: {
        main: string;
        ramp: string;
    };
    mesh: {
        name: string;
        positions: number[];
        uvs: number[];
        indices: number[];
        vertexCount: number;
        triangleCount: number;
    };
    sprites: StorySlashTraceSpriteLayer[];
    material: {
        floats: Record<string, number>;
        colors: Record<string, [
            number,
            number,
            number,
            number
        ]>;
        shaderProgramSha256: string;
    };
    spriteMaterial: {
        name: string;
        shader: string;
        srcBlend: number;
        dstBlend: number;
    };
    materialEvaluator: {
        startTime: number;
        duration: number;
        properties: Array<{
            name: string;
            mode: 1 | 2 | 6 | 12;
            constant: [
                number,
                number,
                number,
                number
            ];
            curveX: StoryFxmCurveKey[];
            curveZ: StoryFxmCurveKey[];
            curveW: StoryFxmCurveKey[];
        }>;
    };
    sourceSummary: {
        meshVertices: number;
        meshTriangles: number;
        spriteLayers: number;
        renderTexture: string;
        rawImageAspect: number;
    };
};
export type StoryIceMaterialProperty = {
    name: string;
    mode: 0 | 1 | 2 | 9;
    constant: [
        number,
        number,
        number,
        number
    ];
    color: [
        number,
        number,
        number,
        number
    ];
    curve: StoryFxmCurveKey[];
};
export type StoryIceMaterialLayer = {
    path: string;
    startTime: number;
    duration: number;
    properties: StoryIceMaterialProperty[];
};
export type StoryIceMaterialTexture = {
    name: string;
    width: number;
    height: number;
    filterMode: number;
    wrapU: number;
    wrapV: number;
    path: string;
};
export type StoryIceMaterialEffect = {
    shader: string;
    renderWidth: number;
    renderHeight: number;
    aspectRatio: number;
    sourceDuration: number;
    timeScale: number;
    textures: Record<"main" | "sub" | "mask" | "dissolve", StoryIceMaterialTexture>;
    material: {
        floats: Record<string, number>;
        colors: Record<string, [
            number,
            number,
            number,
            number
        ]>;
        textureTransforms: Record<string, [
            number,
            number,
            number,
            number
        ]>;
    };
    layers: StoryIceMaterialLayer[];
};
export type StoryFxmCurveKey = {
    time: number;
    value: number;
    inSlope: number | "Infinity" | "-Infinity";
    outSlope: number | "Infinity" | "-Infinity";
};
export type StoryFxmTransformEvaluator = {
    kind: "position" | "scale" | "rotation";
    continuous?: boolean;
    speed?: number;
    startTime: number;
    duration: number;
    random: boolean;
    separateAxes: boolean;
    factorX: number;
    factorY: number;
    factorZ: number;
    minX: number;
    minY: number;
    minZ: number;
    maxX: number;
    maxY: number;
    maxZ: number;
    curveX: StoryFxmCurveKey[];
    curveY: StoryFxmCurveKey[];
    curveZ: StoryFxmCurveKey[];
};
export type StoryFxmShakerEvaluator = {
    id: string;
    startTime: number;
    duration: number;
    magnitude: number;
    frequency: number;
    positionOrigin: [
        number,
        number
    ];
    curve: StoryFxmCurveKey[];
    frequencyCurve: StoryFxmCurveKey[];
};
export type StoryFxmTransformNode = {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
    spineBone?: string;
    spineBoneRotation?: boolean;
    evaluator?: StoryFxmTransformEvaluator;
    evaluators?: StoryFxmTransformEvaluator[];
    shaker?: StoryFxmShakerEvaluator;
    shakers?: StoryFxmShakerEvaluator[];
};
export type StoryFxmSpriteLayer = {
    id: number;
    path: string;
    playerDelay: number;
    playerDelays?: number[];
    playerRepeatPeriod?: number;
    randomGroup?: string;
    randomVariant?: number;
    startTime: number;
    duration: number;
    material: "alpha" | "pma";
    intensity: number;
    colorBoost: number;
    blendFactor: number;
    useBlendCurve: boolean;
    blendCurve: StoryFxmCurveKey[];
    alphaMultiplier: number;
    gradient: {
        colors: Array<{
            time: number;
            value: [
                number,
                number,
                number
            ];
        }>;
        alphas: Array<{
            time: number;
            value: number;
        }>;
    };
    useAlphaCurve: boolean;
    alphaCurve: StoryFxmCurveKey[];
    frameCurve: StoryFxmCurveKey[];
    frameAssets: number[];
    width: number;
    height: number;
    pivotX: number;
    pivotY: number;
    flipX: boolean;
    flipY: boolean;
    sortingOrder: number;
    transformChain: StoryFxmTransformNode[];
};
export type StoryScene = {
    version: number;
    id: string;
    title: string;
    commandCount: number;
    commands: StoryCommand[];
};
export type ActorSlot = "left" | "center" | "right";
export type StoryActorState = {
    characterId: string;
    characterViewKey: string;
    slot: ActorSlot;
    face: string;
    commandFace: string;
    faceLoop: boolean;
    faceRevision: number;
    spineViewKey: string;
    spineTrackTimeSourceKey: string;
    scaleX: number;
    scaleY: number;
    scaleFromX: number;
    scaleFromY: number;
    scaleRevision: number;
    offsetX: number;
    offsetY: number;
    pinup: boolean;
    pinupMaskActive: boolean;
    pinupFromWidth: number;
    pinupToWidth: number;
    pinupTransitionMs: number;
    hologram: boolean;
    hologramMaskActive: boolean;
    hologramFromWidth: number;
    hologramToWidth: number;
    hologramTransitionMs: number;
    hologramRevision: number;
    flip: boolean;
    dark: boolean;
    darkAlpha: number;
    colorFromMultiplier: number;
    colorToMultiplier: number;
    colorTransitionMs: number;
    colorTransitionRevision: number;
    whitening: boolean;
    fadeIn: boolean;
    fadeOut: boolean;
    hidden: boolean;
    moving: boolean;
    removeOnNextCommand: boolean;
    moveFromX: number;
    moveFromY: number;
    movementMs: number;
    scaleTransitionMs: number;
    bounceCount: number;
    bounceTimeMs: number;
    crashStrength: number;
};
export type StoryActorViewCache = Partial<Record<ActorSlot, StoryActorState>>;
export type StoryActorColorSnapshot = {
    multiplier: number;
    tracking: boolean;
};
export type StoryActorColorSnapshots = ReadonlyMap<string, StoryActorColorSnapshot> | ReadonlySet<string>;
export type StoryVisualState = {
    backgroundName: string;
    backgroundUrl: string;
    backgroundSpine: StorySpineAssetData | null;
    backgroundSpineAnimation: string;
    backgroundSpineLoop: boolean;
    retainedImageBackgroundName: string;
    retainedImageBackgroundUrl: string;
    retainedImageBackgroundOffsetX: number;
    retainedImageBackgroundOffsetY: number;
    previousBackgroundUrl: string;
    previousBackgroundSpine: StorySpineAssetData | null;
    previousBackgroundSpineAnimation: string;
    previousBackgroundSpineLoop: boolean;
    previousBackgroundOffsetX: number;
    previousBackgroundOffsetY: number;
    previousBackgroundScaleX: number;
    previousBackgroundScaleY: number;
    previousBackgroundGameObject: boolean;
    previousBackgroundEffectRevision: number;
    previousGameObjectEffect: StoryGameObjectEffect | null;
    backgroundGameObject: boolean;
    backgroundGameObjectName: string;
    backgroundEffectRevision: number;
    gameObjectEffect: StoryGameObjectEffect | null;
    backgroundFilter: string;
    backgroundOffsetX: number;
    backgroundOffsetY: number;
    backgroundScaleX: number;
    backgroundScaleY: number;
    backgroundTransitionMs: number;
    backgroundPositionTransitionMs: number;
    backgroundAnimationNoWait: boolean;
    backgroundPositionEase: string;
    backgroundScaleEase: string;
    backgroundCrashStrength: number;
    backgroundCrashTimeMs: number;
    imageName: string;
    imageUrl: string;
    imageTransitionMs: number;
    imageScale: number;
    imageOffsetX: number;
    imageOffsetY: number;
    movieName: string;
    movieUrl: string;
    bgmName: string;
    bgmPath: string;
    bgmVolume: number;
    bgmStartTime: number;
    bgmRestart: boolean;
    bgmRevision: number;
    pendingBgmName: string;
    pendingBgmPath: string;
    dialogueText: string;
    dialogueGoalNormalText: string;
    dialogueGoalCenterText: string;
    dialogueBoxOpen: boolean;
    dialogueBoxType: "normal" | "center";
    dialogueNextNormalActive: boolean;
    dialogueNextCenterActive: boolean;
    dialogueCenterFadePrimed: boolean;
    dialogueOpening: boolean;
    dialogueOpeningTimeMs: number;
    dialogueCentered: boolean;
    dialogueFadeIn: boolean;
    dialogueFadeOut: boolean;
    dialogueFadeTimeMs: number;
    speakerId: string;
    // JapanNeeds TMP 화자명은 Open마다 같은 문자열과 뒤 공백 문자열을
    // 번갈아 넣는다. 화면상 공백은 보이지 않지만 매니저 상태는 보존한다.
    speakerNameHasTempSpace: boolean;
    speakerNameTempFlag: boolean;
    titleText: string;
    subtitleText: string;
    titleFadeOut: boolean;
    titleFadeOutTimeMs: number;
    titleTalkTimeMs: number;
    subtitleTalkTimeMs: number;
    actors: StoryActorState[];
    // 실제 클라이언트는 좌·중·우 NKCCutUnit을 장면이 끝날 때까지
    // 유지한다. Clear/OUT/MOVE로 GameObject가 비활성화돼도 CharacterView와
    // m_prefab은 남으므로, 화면에 보이는 actors와 별도로 슬롯 뷰를 보존한다.
    actorViewCache: StoryActorViewCache;
    shake: boolean;
    shakeRevision: number;
    flash: boolean;
    flashTimeMs: number;
    flashRevision: number;
    fadeActive: boolean;
    fadeCovered: boolean;
    fadeIn: boolean;
    fadeWhite: boolean;
    fadeTimeMs: number;
    fadeOpacity: number;
    backgroundTintStart: number[];
    backgroundTintEnd: number[];
    backgroundTintTimeMs: number;
    backgroundTintEase: string;
    backgroundFadeOutTint: number[];
    backgroundFadeOutTimeMs: number;
    backgroundFadeOutEase: string;
    previousBackgroundTintStart: number[];
    previousBackgroundTintEnd: number[];
    previousBackgroundTintTimeMs: number;
    previousBackgroundTintEase: string;
};
export type StoryBackgroundTransformSnapshot = {
    offsetX: number;
    offsetY: number;
    scaleX: number;
    scaleY: number;
    tint?: number[];
};
export type StoryChoice = {
    text: string;
    actionKey: string;
    commandIndex: number;
    selectionStartIndex: number;
};
const STORY_SELECTION_LOG_FORMAT = "<color=#ffd34c> ▶</color> {0}";
export const STORY_MOVIE_SKIP_TITLE = "영상 스킵";
export const STORY_MOVIE_SKIP_DESCRIPTION = "이 영상을 스킵하시겠습니까?";
export const STORY_MOVIE_PREPARE_WAIT_LIMIT_MS = 15000;
export const STORY_TITLE_TYPING_SOUND_PATH = "fx/typing.wav";
export const STORY_UI_BUTTON_SOUND_PATH = "fx/fx_ui_button_select.wav";
export const STORY_UI_BACK_SOUND_PATH = "fx/fx_ui_button_back.wav";
export const STORY_UI_HOME_SOUND_PATH = "fx/fx_ui_button_home.wav";
export const STORY_SEPIA_COLOR_MATRIX = [
    0.393, 0.769, 0.189, 0, 0,
    0.349, 0.686, 0.168, 0, 0,
    0.272, 0.534, 0.131, 0, 0,
    0, 0, 0, 1, 0,
].join(" ");
export type StoryMovieSkipConfirmHotkeyCode = "Space" | "Enter" | "NumpadEnter" | "Numpad5";
const STORY_MOVIE_SKIP_CONFIRM_HOTKEY_CODES = new Set<StoryMovieSkipConfirmHotkeyCode>(["Space", "Enter", "NumpadEnter", "Numpad5"]);
// STV-RDR-003: NKCInputManager의 Confirm 기본 별칭만 허용한다. 식별 가능한
// physical code가 있으면 key fallback으로 Digit5 같은 반대 사례를 섞지 않는다.
export function getStoryMovieSkipConfirmHotkeyCode(code: string, key: string): StoryMovieSkipConfirmHotkeyCode | null {
    if (STORY_MOVIE_SKIP_CONFIRM_HOTKEY_CODES.has(code as StoryMovieSkipConfirmHotkeyCode)) {
        return code as StoryMovieSkipConfirmHotkeyCode;
    }
    if (code && code !== "Unidentified") {
        return null;
    }
    if (key === " " || key === "Spacebar") {
        return "Space";
    }
    if (key === "Enter") {
        return "Enter";
    }
    return null;
}
export type StoryMouseCancelAction = "ignore" | "suppress" | "cancel";
// STV-RDR-006: Unity KeyCode.Mouse3 is the only mouse Cancel alias. Browsers
// reserve button 3/4 for history navigation, so Mouse4 and editable Mouse3 are
// suppressed without entering the client Back hierarchy.
export function getStoryMouseCancelAction(button: number, isEditable: boolean): StoryMouseCancelAction {
    if (button !== 3 && button !== 4) {
        return "ignore";
    }
    return button === 3 && !isEditable ? "cancel" : "suppress";
}
export type StoryGameObjectRootLayout = {
    canvasScale: number;
    rootScale: number;
    compositeScale: number;
    referenceWidth: number;
    referenceHeight: number;
};
// STV-GO-002: SetAspect의 CanvasScaler와 ProcessGameObjectBG의
// m_OrgGOScale을 CSS 픽셀 공간으로 합성한다. SCREEN_FILM처럼 루트 자체가
// 전체 안전영역인 프리팹은 이 배율을 자식 좌표에 균일하게 적용해야 한다.
export function getStoryGameObjectRootLayout(viewportWidth: number, viewportHeight: number): StoryGameObjectRootLayout {
    const width = Math.max(Number.isFinite(viewportWidth) ? viewportWidth : 0, 1);
    const height = Math.max(Number.isFinite(viewportHeight) ? viewportHeight : 0, 1);
    const widthScale = width / 1920;
    const heightScale = height / 1080;
    const canvasScale = Math.min(widthScale, heightScale);
    const compositeScale = Math.max(widthScale, heightScale);
    return {
        canvasScale,
        rootScale: compositeScale / canvasScale,
        compositeScale,
        referenceWidth: width / canvasScale,
        referenceHeight: height / canvasScale,
    };
}
const STORY_UNIT_ANIMATIONS = new Set([
    "TOUCH",
    "IDLE",
    "LAUGH",
    "HATE",
    "SERIOUS",
    "SERIOUS2",
    "SURPRISE",
    "PRIDE",
    "DESPAIR",
    "CONFUSION",
    "CONFUSION2",
    "CONFUSION3",
    "HURT",
    "TIRED",
    "SKILL",
]);
const STORY_ENUM_ANIMATION_NAMES: Record<string, string> = {
    UNIT_HYPER_CUTIN: "BASE",
    SD_IDLE: "ASTAND",
    SD_ATTACK: "ATTACK",
    SD_WORKING: "WORKING",
    SD_MINING: "MINING",
    SD_WALK: "WALK",
    SD_RUN: "RUN",
    SD_TOUCH: "TOUCH",
    SD_DRAG: "DRAG",
    SD_WIN: "WIN",
    SD_START: "START",
    SD_DOWN: "DOWN",
    SHIP_IDLE: "ASTAND",
};
function findStoryAnimationExact(animationNames: string[], animationName: string) {
    const requested = animationName.trim();
    if (!requested) {
        return "";
    }
    // Spine SkeletonData.FindAnimation은 이름을 대소문자까지 정확히 찾는다.
    // 원본 오탈자를 비슷한 애니메이션으로 보정하지 않는다.
    return animationNames.find((candidate) => candidate === requested) ?? "";
}
export function getStoryCutsceneAnimationName(value: string) {
    const trimmed = value.trim();
    const mapped = STORY_ENUM_ANIMATION_NAMES[trimmed];
    if (mapped) {
        return mapped;
    }
    if (trimmed.startsWith("UNIT_") &&
        STORY_UNIT_ANIMATIONS.has(trimmed.slice("UNIT_".length))) {
        return trimmed.slice("UNIT_".length);
    }
    // Enum.TryParse의 기본 호출은 대소문자를 무시하지 않는다.
    // NKCCutTemplet은 eAnimation 열거형으로 정확히 파싱되는 값만
    // GetAnimationName으로 치환한다. 오탈자나 사용자 지정 문자열은
    // 접두사를 임의로 제거하지 않고 그대로 Spine에 전달한다.
    return trimmed;
}
export function isStorySpineEventAnimationActive(effect: Pick<StoryGameObjectEffect, "animationNames">, face: string) {
    const animationName = getStoryCutsceneAnimationName(face);
    return effect.animationNames?.length
        ? effect.animationNames.includes(animationName)
        : animationName === "TOUCH";
}
export function findStoryRequestedSpineAnimation(animationNames: string[], requestedFace: string) {
    return findStoryAnimationExact(animationNames, getStoryCutsceneAnimationName(requestedFace));
}
export function findStoryDefaultSpineAnimation(animationNames: string[]) {
    // NKCASUISpineIllust의 m_eDefaultAnimation 기본값은 UNIT_IDLE이고
    // 비반복 애니메이션 뒤에는 GetAnimationName을 거친 IDLE을 붙인다.
    return findStoryAnimationExact(animationNames, "IDLE");
}
export function findStorySpineSkin(skinNames: string[], { skinName, skinOption, prefabSkinName, backgroundEnabled, includePrefabSkin = true, }: {
    skinName: string;
    skinOption: number;
    prefabSkinName: string;
    backgroundEnabled: boolean;
    includePrefabSkin?: boolean;
}) {
    const available = new Set(skinNames);
    let selected = "";
    const applyIfAvailable = (candidate: string) => {
        // Spine SkeletonData.FindSkin(string)은 이름을 정확히 비교한다. 원본
        // 템플릿의 대소문자가 틀려도 비슷한 스킨으로 보정하지 않는다.
        if (available.has(candidate)) {
            selected = candidate;
        }
    };
    // 프리팹 SkeletonGraphic의 시작 스킨 위에 CharacterView가
    // 배경 표시용 스킨, 숫자 옵션, 명시적 이름 순서로 다시 적용한다.
    if (includePrefabSkin) {
        applyIfAvailable(prefabSkinName);
    }
    applyIfAvailable(backgroundEnabled ? "default" : "ONLY_UNIT");
    applyIfAvailable(`SKIN_${skinOption > 0 ? skinOption : 1}`);
    applyIfAvailable(skinName);
    return selected;
}
export function findStoryInitialSpineAnimation(animationNames: string[], requestedFace: string, prefabAnimation: string) {
    const requested = findStoryRequestedSpineAnimation(animationNames, requestedFace);
    if (requested) {
        return requested;
    }
    // CharacterView는 프리팹을 연 직후 SetDefaultAnimation을 호출해
    // 일반 유닛의 IDLE을 먼저 재생한다. IDLE 자체가 없는 경우에만
    // SetAnimation이 실패하므로 프리팹 startingAnimation이 남는다.
    return (findStoryAnimationExact(animationNames, "IDLE") ||
        findStoryAnimationExact(animationNames, prefabAnimation) ||
        "");
}
const STORY_EMOTION_ANIMATIONS = [
    "IDLE",
    "LAUGH",
    "HATE",
    "SERIOUS",
    "SURPRISE",
    "PRIDE",
    "DESPAIR",
    "CONFUSION",
    "HURT",
    "TIRED",
];
export function isStoryEmotionAnimation(animationName: string) {
    // 원본 IsEmotionAnimation(string)은 각 기본 이름에
    // StartsWith(strAnim)을 호출한다. 이 때문에 SERIOUS2와
    // CONFUSION2/3은 문자열 오버로드에서 감정 애니메이션이 아니다.
    return STORY_EMOTION_ANIMATIONS.some((candidate) => candidate.startsWith(animationName));
}
export function shouldPreserveStoryEmotionAnimationTime({ currentAnimation, nextAnimation, currentDuration, nextDuration, loop, startTime = 0, }: {
    currentAnimation: string;
    nextAnimation: string;
    currentDuration: number;
    nextDuration: number;
    loop: boolean;
    startTime?: number;
}) {
    return (loop &&
        startTime === 0 &&
        isStoryEmotionAnimation(nextAnimation) &&
        isStoryEmotionAnimation(currentAnimation) &&
        Math.abs(currentDuration - nextDuration) <= 0.00001);
}
const storyEaseCache = new Map<string, string>();
function formatStoryEaseNumber(value: number) {
    return String(Math.round(value * 1000000) / 1000000);
}
function createStoryLinearEase(evaluator: (progress: number) => number, samples = 64, clampTargetAtEnd = false) {
    const points: string[] = [];
    const finalSample = clampTargetAtEnd ? samples - 1 : samples;
    for (let index = 0; index <= finalSample; index += 1) {
        const progress = index / samples;
        points.push(`${formatStoryEaseNumber(evaluator(progress))} ${formatStoryEaseNumber(progress * 100)}%`);
    }
    if (clampTargetAtEnd) {
        points.push(`${formatStoryEaseNumber(evaluator(1))} 99.999%`, "1 100%");
    }
    return `linear(${points.join(", ")})`;
}
function evaluateStoryBounceOut(progress: number) {
    if (progress < 1 / 2.75) {
        return 7.5625 * progress * progress;
    }
    if (progress < 2 / 2.75) {
        const shifted = progress - 1.5 / 2.75;
        return 7.5625 * shifted * shifted + 0.75;
    }
    if (progress < 2.5 / 2.75) {
        const shifted = progress - 2.25 / 2.75;
        return 7.5625 * shifted * shifted + 0.9375;
    }
    const shifted = progress - 2.625 / 2.75;
    return 7.5625 * shifted * shifted + 0.984375;
}
export function evaluateStoryUnityEase(value: string, progress: number, durationMs = 0) {
    const normalized = value.trim().toLocaleUpperCase("en-US");
    const time = Math.min(Math.max(progress, 0), 1);
    if (normalized === "TDT_FASTER") {
        return time * time * time;
    }
    if (normalized === "TDT_SLOWER") {
        return 1 - Math.pow(1 - time, 3);
    }
    if (normalized === "TDT_BACK_OUT") {
        const shifted = time - 1;
        return 1 + 2.70158 * shifted * shifted * shifted +
            1.70158 * shifted * shifted;
    }
    if (normalized === "TDT_BOUNCE_OUT") {
        return evaluateStoryBounceOut(time);
    }
    if (normalized.startsWith("TDT_SIN")) {
        const seconds = Math.max(durationMs, 0) / 1000;
        const degreesPerSecond = normalized === "TDT_SIN_PLUS"
            ? 100
            : normalized === "TDT_SIN_PLUS_FAST"
                ? 100
                : normalized === "TDT_SIN_PLUS_FAST2"
                    ? 200
                    : normalized === "TDT_SIN_PLUS_FAST4"
                        ? 400
                        : 50;
        const absolute = normalized !== "TDT_SIN";
        const amplitude = normalized === "TDT_SIN_PLUS" ? 0.5 : 1;
        const sine = Math.sin((time * seconds * degreesPerSecond * Math.PI) / 180);
        // NKMTracking의 SIN 계열은 마지막 프레임에만 목표값을 강제한다.
        return time >= 1 ? 1 : (absolute ? Math.abs(sine) : sine) * amplitude;
    }
    if (normalized === "INEXPO") {
        return time === 0 ? 0 : Math.pow(2, 10 * (time - 1));
    }
    if (normalized === "OUTEXPO") {
        return time === 1 ? 1 : 1 - Math.pow(2, -10 * time);
    }
    if (normalized === "INOUTQUART") {
        return time < 0.5
            ? 8 * Math.pow(time, 4)
            : 1 - 8 * Math.pow(1 - time, 4);
    }
    return time;
}
export function getStoryUnityEaseCss(value: string, durationMs = 0) {
    const normalized = value.trim().toLocaleUpperCase("en-US");
    const cacheKey = `${normalized}:${durationMs}`;
    const cached = storyEaseCache.get(cacheKey);
    if (cached) {
        return cached;
    }
    let result = "linear";
    if (normalized === "TDT_FASTER") {
        // NKMTrackingFloat: t³
        result = "cubic-bezier(0.333333, 0, 0.666667, 0)";
    }
    else if (normalized === "TDT_SLOWER") {
        // NKMTrackingFloat: 1-(1-t)³
        result = "cubic-bezier(0.333333, 1, 0.666667, 1)";
    }
    else if (normalized === "TDT_BACK_OUT") {
        // NKMTrackingFloat의 overshoot 1.70158 다항식을 정확한 cubic으로 표현한다.
        result = "cubic-bezier(0.333333, 1.567193, 0.666667, 1)";
    }
    else if (normalized === "TDT_BOUNCE_OUT") {
        result = createStoryLinearEase(evaluateStoryBounceOut, 128);
    }
    else if (normalized.startsWith("TDT_SIN")) {
        const seconds = Math.max(durationMs, 0) / 1000;
        const degreesPerSecond = normalized === "TDT_SIN_PLUS"
            ? 100
            : normalized === "TDT_SIN_PLUS_FAST"
                ? 100
                : normalized === "TDT_SIN_PLUS_FAST2"
                    ? 200
                    : normalized === "TDT_SIN_PLUS_FAST4"
                        ? 400
                        : 50;
        const absolute = normalized !== "TDT_SIN";
        const amplitude = normalized === "TDT_SIN_PLUS" ? 0.5 : 1;
        result = createStoryLinearEase((progress) => {
            const sine = Math.sin((progress * seconds * degreesPerSecond * Math.PI) / 180);
            return (absolute ? Math.abs(sine) : sine) * amplitude;
        }, 128, true);
    }
    else if (normalized === "INEXPO") {
        result = createStoryLinearEase((progress) => progress === 0 ? 0 : Math.pow(2, 10 * (progress - 1)), 128);
    }
    else if (normalized === "OUTEXPO") {
        result = createStoryLinearEase((progress) => progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress), 128);
    }
    else if (normalized === "INOUTQUART") {
        result = createStoryLinearEase((progress) => progress < 0.5
            ? 8 * Math.pow(progress, 4)
            : 1 - 8 * Math.pow(1 - progress, 4), 128);
    }
    storyEaseCache.set(cacheKey, result);
    return result;
}
export function formatStorySelectionLog(selection: string) {
    return STORY_SELECTION_LOG_FORMAT.replace("{0}", selection);
}
export function formatStoryLogText(speaker: string, text: string, hasSpeakerId = Boolean(speaker)) {
    // NKCUICutScenPlayer.AddLog는 화자와 본문을 별도 열로 보관하지 않고
    // "화자 : 대사" 형태의 문자열 하나로 NKCUICutScenLog에 저장한다.
    // 캐릭터 템플릿 조회에 실패해 실제 화자명이 비어도 m_CharStrID가
    // 있으면 클라이언트는 빈 화자명과 구분자(` : `)를 그대로 기록한다.
    return hasSpeakerId ? `${speaker} : ${text}` : text;
}
export function skipsStoryCommandBody(command: StoryCommand) {
    return command.action === "JUMP" || command.action === "SELECT";
}
export function getStoryCommandAudioPaths(command: StoryCommand) {
    return [
        command.bgmPath,
        command.endBgmPath,
        command.fxPath,
        command.endFxPath,
        command.voicePath,
        command.actionMusicPath,
    ].filter((path): path is string => Boolean(path));
}
export function doesStoryCommandClearTitle(command: StoryCommand) {
    // ApplyNextCut은 제목이나 부제가 하나라도 있으면 Open을 우선하고,
    // 둘 다 비어 있을 때만 m_bTitleClear의 ForceClear를 실행한다.
    return Boolean(!skipsStoryCommandBody(command) &&
        command.titleClear &&
        !command.titleText &&
        !command.subtitleText);
}
export function getStoryCommandLogText(command: StoryCommand) {
    if (skipsStoryCommandBody(command)) {
        return "";
    }
    // NKCUICutScenPlayer.AddLog의 조건을 그대로 따른다. 일반 대사, 부제,
    // 제목 순서로 처음 존재하는 문자열 하나를 기록한다.
    if (command.talkText) {
        return command.talkText;
    }
    if (command.subtitleText) {
        return command.subtitleText;
    }
    return command.titleText ?? "";
}
export type StoryDialogueNextMemory = {
    normalActive: boolean;
    centerActive: boolean;
    normalGoalText: string;
    centerGoalText: string;
    normalSpeakerNameTempFlag: boolean;
};
export type StoryBackgroundManagerMemory = {
    retainedImageBackgroundName: string;
    retainedImageBackgroundUrl: string;
    backgroundFadeOutTint: number[];
    backgroundFadeOutTimeMs: number;
    backgroundFadeOutEase: string;
};
export function getStoryDialogueNextMemory(state: StoryVisualState, isTyping: boolean): StoryDialogueNextMemory {
    return {
        normalActive: state.dialogueBoxType === "normal" && isTyping
            ? false
            : state.dialogueNextNormalActive,
        centerActive: state.dialogueBoxType === "center" && isTyping
            ? false
            : state.dialogueNextCenterActive,
        normalGoalText: state.dialogueGoalNormalText,
        centerGoalText: state.dialogueGoalCenterText,
        normalSpeakerNameTempFlag: state.speakerNameTempFlag,
    };
}
export function getStoryCommandDialogueBoxType(command: Pick<StoryCommand, "talkCenterFadeIn" | "talkCenterFadeOut">): StoryVisualState["dialogueBoxType"] {
    return command.talkCenterFadeIn || command.talkCenterFadeOut
        ? "center"
        : "normal";
}
export function getStoryDialogueGoalText(state: StoryVisualState, dialogueBoxType: StoryVisualState["dialogueBoxType"]) {
    return dialogueBoxType === "center"
        ? state.dialogueGoalCenterText
        : state.dialogueGoalNormalText;
}
export function getStoryBackgroundFilter(previousFilter: string, requestedFilter?: string) {
    // NKCUICutScenPlayer.ApplyNextCut은 NCFT_NONE일 때 카메라 필터 API를
    // 호출하지 않는다. 반면 다른 모든 값은 SEPIA 여부를 전달하므로,
    // NCFT_NORMAL뿐 아니라 알 수 있는 비-NONE·비-SEPIA 값도 필터를 끈다.
    if (!requestedFilter || requestedFilter === "NCFT_NONE") {
        return previousFilter;
    }
    return requestedFilter === "NCFT_SEPIA" ? "NCFT_SEPIA" : "NCFT_NORMAL";
}
export function createInitialStoryVisualState(dialogueNextMemory?: Partial<StoryDialogueNextMemory>, backgroundManagerMemory?: Partial<StoryBackgroundManagerMemory>): StoryVisualState {
    return {
        backgroundName: "",
        backgroundUrl: "",
        backgroundSpine: null,
        backgroundSpineAnimation: "",
        backgroundSpineLoop: false,
        retainedImageBackgroundName: backgroundManagerMemory?.retainedImageBackgroundName ?? "",
        retainedImageBackgroundUrl: backgroundManagerMemory?.retainedImageBackgroundUrl ?? "",
        retainedImageBackgroundOffsetX: 0,
        retainedImageBackgroundOffsetY: 0,
        previousBackgroundUrl: "",
        previousBackgroundSpine: null,
        previousBackgroundSpineAnimation: "",
        previousBackgroundSpineLoop: false,
        previousBackgroundOffsetX: 0,
        previousBackgroundOffsetY: 0,
        previousBackgroundScaleX: 1,
        previousBackgroundScaleY: 1,
        previousBackgroundGameObject: false,
        previousBackgroundEffectRevision: 0,
        previousGameObjectEffect: null,
        backgroundGameObject: false,
        backgroundGameObjectName: "",
        backgroundEffectRevision: 0,
        gameObjectEffect: null,
        backgroundFilter: "NCFT_NORMAL",
        backgroundOffsetX: 0,
        backgroundOffsetY: 0,
        backgroundScaleX: 1,
        backgroundScaleY: 1,
        backgroundTransitionMs: 0,
        backgroundPositionTransitionMs: 0,
        backgroundAnimationNoWait: false,
        backgroundPositionEase: "TDT_NORMAL",
        backgroundScaleEase: "TDT_NORMAL",
        backgroundCrashStrength: 0,
        backgroundCrashTimeMs: 0,
        imageName: "",
        imageUrl: "",
        imageTransitionMs: 0,
        imageScale: 1,
        imageOffsetX: 0,
        imageOffsetY: 0,
        movieName: "",
        movieUrl: "",
        bgmName: "",
        bgmPath: "",
        bgmVolume: 1,
        bgmStartTime: 0,
        bgmRestart: false,
        bgmRevision: 0,
        pendingBgmName: "",
        pendingBgmPath: "",
        dialogueText: "",
        dialogueGoalNormalText: dialogueNextMemory?.normalGoalText ?? "",
        dialogueGoalCenterText: dialogueNextMemory?.centerGoalText ?? "",
        dialogueBoxOpen: false,
        dialogueBoxType: "normal",
        // 실제 프리팹의 두 진행 아이콘 자식은 활성 상태로 저장되어 있고,
        // 각 대사 매니저의 Close/ClearTalk는 이 상태를 바꾸지 않는다.
        dialogueNextNormalActive: dialogueNextMemory?.normalActive ?? true,
        dialogueNextCenterActive: dialogueNextMemory?.centerActive ?? true,
        dialogueCenterFadePrimed: false,
        dialogueOpening: false,
        dialogueOpeningTimeMs: 0,
        dialogueCentered: false,
        dialogueFadeIn: false,
        dialogueFadeOut: false,
        dialogueFadeTimeMs: 0,
        speakerId: "",
        speakerNameHasTempSpace: false,
        speakerNameTempFlag: dialogueNextMemory?.normalSpeakerNameTempFlag ?? false,
        titleText: "",
        subtitleText: "",
        titleFadeOut: false,
        titleFadeOutTimeMs: 0,
        titleTalkTimeMs: 150,
        subtitleTalkTimeMs: 150,
        actors: [],
        actorViewCache: {},
        shake: false,
        shakeRevision: 0,
        flash: false,
        flashTimeMs: 0,
        flashRevision: 0,
        fadeActive: false,
        fadeCovered: false,
        fadeIn: false,
        fadeWhite: false,
        fadeTimeMs: 0,
        fadeOpacity: 0,
        backgroundTintStart: [1, 1, 1, 0],
        backgroundTintEnd: [1, 1, 1, 0],
        backgroundTintTimeMs: 0,
        backgroundTintEase: "linear",
        backgroundFadeOutTint: backgroundManagerMemory?.backgroundFadeOutTint ?? [1, 1, 1, 1],
        backgroundFadeOutTimeMs: backgroundManagerMemory?.backgroundFadeOutTimeMs ?? 0,
        backgroundFadeOutEase: backgroundManagerMemory?.backgroundFadeOutEase ?? "linear",
        previousBackgroundTintStart: [1, 1, 1, 1],
        previousBackgroundTintEnd: [1, 1, 1, 0],
        previousBackgroundTintTimeMs: 0,
        previousBackgroundTintEase: "linear",
    };
}
type CharacterPositionAction = "place" | "dark" | "in" | "out" | "move";
export type ParsedCharacterPosition = {
    targetSlot: ActorSlot;
    sourceSlot: ActorSlot | null;
    directionSlot: ActorSlot | null;
    action: CharacterPositionAction;
    moveDown: boolean;
    distance: number;
};
const SLOT_REFERENCE_X: Record<ActorSlot, number> = {
    left: -516.7996,
    center: -0.0045,
    right: 509.2004,
};
function tokenToSlot(value: string | undefined): ActorSlot | null {
    if (value === "L") {
        return "left";
    }
    if (value === "R") {
        return "right";
    }
    if (value === "C") {
        return "center";
    }
    return null;
}
export function parseCharacterPosition(position: string | undefined): ParsedCharacterPosition | null {
    if (!position) {
        return null;
    }
    // NKCCutTemplet.ParsePosCommand는 위치 토큰을 대소문자까지 정확히
    // 비교한다. 원본의 소문자 `*_d` 7건은 오탈자를 자동 보정하지 않고
    // 액션 NONE(화면상 일반 배치와 같은 결과)으로 남겨야 한다.
    const tokens = position.split("_");
    const targetSlot = tokenToSlot(tokens[0]);
    if (!targetSlot) {
        return null;
    }
    const distance = targetSlot === "center" ? 1800 : 1400;
    if (tokens.length === 1) {
        return {
            targetSlot,
            sourceSlot: null,
            directionSlot: null,
            action: "place",
            moveDown: false,
            distance,
        };
    }
    if (tokens[1] === "D" && tokens.length === 2) {
        return {
            targetSlot,
            sourceSlot: null,
            directionSlot: null,
            action: "dark",
            moveDown: false,
            distance,
        };
    }
    if (tokens[1] === "F" && tokens.length === 3) {
        return {
            targetSlot,
            sourceSlot: tokenToSlot(tokens[2]),
            directionSlot: null,
            action: "move",
            moveDown: false,
            distance,
        };
    }
    const directMoveType = tokens[1] === "M" ? tokens[2] : undefined;
    const directMoveIsValid = (directMoveType === "I" && tokens.length === 3) ||
        (directMoveType === "O" &&
            (tokens.length === 3 ||
                (tokens.length === 4 && tokens[3] === "DOWN")));
    if (directMoveIsValid) {
        return {
            targetSlot,
            sourceSlot: null,
            directionSlot: targetSlot,
            action: directMoveType === "I" ? "in" : "out",
            moveDown: directMoveType === "O" && tokens[3] === "DOWN",
            distance,
        };
    }
    const sideDirection = tokenToSlot(tokens[1]);
    const sideMoveType = tokens[2] === "M" ? tokens[3] : undefined;
    if (tokens.length === 4 &&
        (tokens[1] === "L" || tokens[1] === "R") &&
        sideDirection &&
        (sideMoveType === "I" || sideMoveType === "O")) {
        return {
            targetSlot,
            sourceSlot: null,
            directionSlot: sideDirection,
            action: sideMoveType === "I" ? "in" : "out",
            moveDown: false,
            distance,
        };
    }
    // ParsePosCommand는 토큰 위치와 개수까지 정확히 검사한다.
    // `R_C_M_I`, `L_C_M_I`처럼 M이 들어 있어도 두 번째 토큰이 L/R/M/F가
    // 아니면 액션 NONE으로 남으며, SetUnit 화면 결과는 일반 배치와 같다.
    return {
        targetSlot,
        sourceSlot: null,
        directionSlot: null,
        action: "place",
        moveDown: false,
        distance,
    };
}
function vectorValue(vector: number[] | undefined, index: number, fallback: number) {
    const value = Number(vector?.[index]);
    return Number.isFinite(value) ? value : fallback;
}
function getActorColorSnapshot(snapshots: StoryActorColorSnapshots | undefined, viewKey: string) {
    if (!snapshots) {
        return undefined;
    }
    if ("get" in snapshots) {
        return snapshots.get(viewKey);
    }
    return snapshots.has(viewKey)
        ? { multiplier: Number.NaN, tracking: true }
        : undefined;
}
function settleActor(actor: StoryActorState): StoryActorState {
    return {
        ...actor,
        hidden: actor.hidden || actor.fadeOut,
        fadeIn: false,
        fadeOut: false,
        moving: false,
        removeOnNextCommand: false,
        moveFromX: actor.offsetX,
        moveFromY: actor.offsetY,
        movementMs: 0,
        scaleFromX: actor.scaleX * (actor.flip ? -1 : 1),
        scaleFromY: actor.scaleY,
        scaleTransitionMs: 0,
        // NKCUICharacterViewEffectPinup.ClosePinupEffect는 닫힘 Tween이 끝나도
        // Mask를 끄지 않고 폭 0인 활성 상태로 둔다. 다음 캐릭터 명령이
        // 같은 슬롯에 SetPinup(false, 0)을 호출하거나 clear가 Cleanup할
        // 때까지 이 0폭 마스크가 캐릭터를 숨겨야 한다.
        pinupMaskActive: actor.pinupMaskActive,
        pinupFromWidth: actor.pinupMaskActive ? actor.pinupToWidth : 0,
        pinupToWidth: actor.pinupMaskActive ? actor.pinupToWidth : 0,
        pinupTransitionMs: 0,
        hologramMaskActive: false,
        hologramFromWidth: actor.hologram ? 750 : 0,
        hologramToWidth: actor.hologram ? 750 : 0,
        hologramTransitionMs: 0,
        // FinishUnit은 위치·Bounce·알파·배율만 끝내며 RGB 밝기 추적은
        // 건드리지 않는다. 캐릭터가 없는 다음 명령으로 넘어가도 진행 중인
        // Whiten/Darken 추적은 원래 남은 시간 동안 계속되어야 한다.
        colorTransitionMs: actor.colorTransitionMs,
        whitening: actor.whitening,
        bounceCount: 0,
        bounceTimeMs: 0,
        crashStrength: 0,
    };
}
function settleActors(actors: StoryActorState[]) {
    return actors
        .filter((actor) => !actor.removeOnNextCommand)
        .map(settleActor);
}
function finishStoryActorUnit(actor: StoryActorState): StoryActorState {
    return {
        ...actor,
        hidden: actor.hidden || actor.fadeOut || actor.removeOnNextCommand,
        fadeIn: false,
        fadeOut: false,
        moving: false,
        moveFromX: actor.offsetX,
        moveFromY: actor.offsetY,
        movementMs: 0,
        scaleFromX: actor.scaleX * (actor.flip ? -1 : 1),
        scaleFromY: actor.scaleY,
        scaleTransitionMs: 0,
        bounceCount: 0,
        bounceTimeMs: 0,
        crashStrength: 0,
    };
}
export function finishStoryCommandActor(previous: StoryVisualState, command: StoryCommand) {
    const parsed = parseCharacterPosition(command.position);
    if (!parsed) {
        return previous;
    }
    let finishedActor: StoryActorState | undefined;
    const actors = previous.actors.map((actor) => {
        if (actor.slot !== parsed.targetSlot) {
            return actor;
        }
        finishedActor = finishStoryActorUnit(actor);
        return finishedActor;
    });
    if (!finishedActor) {
        return previous;
    }
    return {
        ...previous,
        actors,
        actorViewCache: {
            ...previous.actorViewCache,
            [parsed.targetSlot]: finishedActor,
        },
    };
}
function finishStoryAllActors(previous: StoryVisualState): StoryVisualState {
    const actors = previous.actors.map(finishStoryActorUnit);
    const actorViewCache: StoryActorViewCache = {
        ...previous.actorViewCache,
    };
    for (const slot of ["left", "center", "right"] as const) {
        const cached = actorViewCache[slot];
        if (cached) {
            actorViewCache[slot] = finishStoryActorUnit(cached);
        }
    }
    // 활성 GameObject와 CharacterView 캐시가 같은 슬롯을 가리키는 경우에는
    // 화면 actor의 완료 상태를 캐시에도 그대로 공유한다.
    for (const actor of actors) {
        actorViewCache[actor.slot] = actor;
    }
    return {
        ...previous,
        actors,
        actorViewCache,
    };
}
export function finishStoryCommandVisualState(previous: StoryVisualState, snapshot?: {
    fadeOpacity?: number;
}) {
    // 플레이어 클릭은 현재 명령의 대상만이 아니라 UnitMgr의 좌·중·우
    // NKCCutUnit 전부에 FinishUnit()을 호출한다. 자연 완료 타이머는 위의
    // 대상 슬롯 전용 함수를 계속 사용한다.
    const finishedActorState = finishStoryAllActors(previous);
    const finishesBlockingBackgroundAnimation = !previous.backgroundAnimationNoWait;
    // OnClickedPlayer의 미완료 분기는 UnitMgr뿐 아니라 ImgMgr.Finish()와
    // BGMgr.Finish()도 호출한다. BGMgr는 흔들림과 배경 교차 페이드를 항상
    // 끝내고, NoWait가 아닌 위치·배율 추적만 목표값에서 정지시킨다.
    // React 레이어가 다시 렌더되어도 완료된 연출이 되살아나지 않도록 시간과
    // 시작 색을 실제 매니저의 완료 상태로 함께 정리한다.
    const backgroundNeedsFinish = previous.backgroundCrashTimeMs > 0 ||
        previous.backgroundTintTimeMs > 0 ||
        previous.previousBackgroundTintTimeMs > 0 ||
        (finishesBlockingBackgroundAnimation &&
            (previous.backgroundTransitionMs > 0 ||
                previous.backgroundPositionTransitionMs > 0));
    const fadeNeedsFinish = previous.fadeActive && previous.fadeTimeMs > 0;
    const clearsPreviousGameObject = previous.previousBackgroundTintTimeMs > 0 &&
        previous.previousBackgroundGameObject;
    const currentFadeOpacity = Number.isFinite(snapshot?.fadeOpacity)
        ? Math.min(Math.max(Number(snapshot?.fadeOpacity), 0), 1)
        : previous.fadeOpacity;
    if (previous.imageTransitionMs <= 0 &&
        previous.dialogueOpeningTimeMs <= 0 &&
        !backgroundNeedsFinish &&
        !fadeNeedsFinish) {
        return finishedActorState;
    }
    return {
        ...finishedActorState,
        // 이전 Image Tween의 완료 콜백은 Tweening 플래그만 내리고 끝 색 슬롯을
        // 유지한다. 이전 SkeletonGraphic Tween만 ClearGOBG_2로 인스턴스 전체를
        // 파괴하며, DOKill(complete:true)로 끝내는 클릭 Finish도 동일하다.
        previousBackgroundUrl: clearsPreviousGameObject
            ? ""
            : previous.previousBackgroundUrl,
        previousBackgroundSpine: clearsPreviousGameObject
            ? null
            : previous.previousBackgroundSpine,
        previousBackgroundSpineAnimation: clearsPreviousGameObject
            ? ""
            : previous.previousBackgroundSpineAnimation,
        previousBackgroundSpineLoop: clearsPreviousGameObject
            ? false
            : previous.previousBackgroundSpineLoop,
        previousBackgroundOffsetX: clearsPreviousGameObject
            ? 0
            : previous.previousBackgroundOffsetX,
        previousBackgroundOffsetY: clearsPreviousGameObject
            ? 0
            : previous.previousBackgroundOffsetY,
        previousBackgroundScaleX: clearsPreviousGameObject
            ? 1
            : previous.previousBackgroundScaleX,
        previousBackgroundScaleY: clearsPreviousGameObject
            ? 1
            : previous.previousBackgroundScaleY,
        previousBackgroundGameObject: clearsPreviousGameObject
            ? false
            : previous.previousBackgroundGameObject,
        previousBackgroundEffectRevision: clearsPreviousGameObject
            ? 0
            : previous.previousBackgroundEffectRevision,
        previousGameObjectEffect: clearsPreviousGameObject
            ? null
            : previous.previousGameObjectEffect,
        backgroundTransitionMs: finishesBlockingBackgroundAnimation
            ? 0
            : previous.backgroundTransitionMs,
        backgroundPositionTransitionMs: finishesBlockingBackgroundAnimation
            ? 0
            : previous.backgroundPositionTransitionMs,
        backgroundCrashStrength: 0,
        backgroundCrashTimeMs: 0,
        backgroundTintStart: previous.backgroundTintEnd,
        backgroundTintTimeMs: 0,
        previousBackgroundTintStart: previous.previousBackgroundTintEnd,
        previousBackgroundTintTimeMs: 0,
        // NKCUIFadeInOut.Finish()는 FadeIn이면 전역 이미지를 비활성화하고,
        // FadeOut이면 불투명 상태로 남긴 뒤 두 진행 플래그를 모두 내린다.
        fadeActive: false,
        fadeCovered: fadeNeedsFinish ? !previous.fadeIn : previous.fadeCovered,
        fadeTimeMs: fadeNeedsFinish ? 0 : previous.fadeTimeMs,
        // Cutscene FadeOut은 timeout 예약 없이 호출되므로 Finish()가 알파를
        // 1로 강제하지 않고 현재 알파에서 정지한다. FadeIn만 즉시 숨긴다.
        fadeOpacity: fadeNeedsFinish
            ? previous.fadeIn
                ? 0
                : currentFadeOpacity
            : previous.fadeOpacity,
        imageTransitionMs: 0,
        // JapanNeeds.Finish()도 CanvasGroup 알파를 즉시 1로 만들므로, 닫힌
        // 일반 대사창의 1/3초 수동 페이드를 같은 완료 상태에 포함한다.
        dialogueOpening: false,
        dialogueOpeningTimeMs: 0,
    };
}
export function finishStoryPreviousBackgroundFade(previous: StoryVisualState): StoryVisualState {
    if (!previous.previousBackgroundUrl &&
        !previous.previousBackgroundSpine &&
        !previous.previousGameObjectEffect) {
        return previous;
    }
    if (!previous.previousBackgroundGameObject) {
        return {
            ...previous,
            previousBackgroundTintStart: previous.previousBackgroundTintEnd,
            previousBackgroundTintTimeMs: 0,
        };
    }
    return {
        ...previous,
        previousBackgroundUrl: "",
        previousBackgroundSpine: null,
        previousBackgroundSpineAnimation: "",
        previousBackgroundSpineLoop: false,
        previousBackgroundOffsetX: 0,
        previousBackgroundOffsetY: 0,
        previousBackgroundScaleX: 1,
        previousBackgroundScaleY: 1,
        previousBackgroundGameObject: false,
        previousBackgroundEffectRevision: 0,
        previousGameObjectEffect: null,
        previousBackgroundTintStart: previous.previousBackgroundTintEnd,
        previousBackgroundTintTimeMs: 0,
    };
}
function settleActorViewCache(actorViewCache: StoryActorViewCache, actors: StoryActorState[]): StoryActorViewCache {
    const merged: StoryActorViewCache = { ...actorViewCache };
    // 호출자가 예전 상태 스키마처럼 actors만 직접 구성한 테스트도 실제
    // 활성 CharacterView로 취급한다. 정상 재생에서는 같은 슬롯의 활성
    // actor가 캐시의 가장 최신 상태이므로 항상 우선한다.
    for (const actor of actors) {
        merged[actor.slot] = actor;
    }
    for (const slot of ["left", "center", "right"] as const) {
        const cached = merged[slot];
        if (cached) {
            merged[slot] = settleActor(cached);
        }
    }
    return merged;
}
function getMoveDurationMs(command: StoryCommand, action: CharacterPositionAction) {
    if (action !== "in" && action !== "out" && action !== "move") {
        return 0;
    }
    const seconds = Number(command.trackingTime);
    return (Number.isFinite(seconds) && seconds >= 0 ? seconds : 0.6) * 1000;
}
export function doesStoryCharacterMovementRunByCommand(command: StoryCommand) {
    const parsed = parseCharacterPosition(command.position);
    if (!parsed) {
        return false;
    }
    if (command.clear) {
        return parsed.action === "out";
    }
    // ApplyNextCut은 clear가 아니면 캐릭터 템플릿을 찾은 뒤 SetUnit을
    // 호출한다. SetUnit 내부에서 위치 추적을 시작하는 동작은 IN과 MOVE뿐이며,
    // OUT은 DoClear 경로에서만 이동한다.
    return Boolean(command.characterId &&
        (parsed.action === "in" || parsed.action === "move"));
}
function getDirectionSign(slot: ActorSlot | null) {
    return slot === "left" ? -1 : 1;
}
function getBounce(command: StoryCommand) {
    const count = Math.max(Math.floor(Number(command.bounce?.[0]) || 0), 0);
    const timeMs = Math.max((Number(command.bounce?.[1]) || 0) * 1000, 0);
    return { count, timeMs };
}
function getPinupState(existing: StoryActorState | undefined, command: StoryCommand) {
    const pinupTransitionMs = Math.max(Number(command.pinupEasingTime ?? 0) * 1000, 0);
    if (command.pinup === true) {
        return {
            pinup: true,
            pinupMaskActive: true,
            pinupFromWidth: existing?.pinupMaskActive === true ? existing.pinupToWidth : 0,
            pinupToWidth: 300,
            pinupTransitionMs,
        };
    }
    if (pinupTransitionMs > 0) {
        return {
            pinup: false,
            pinupMaskActive: true,
            pinupFromWidth: existing?.pinupMaskActive === true
                ? existing.pinupToWidth
                : existing?.pinup
                    ? 300
                    : 0,
            pinupToWidth: 0,
            pinupTransitionMs,
        };
    }
    return {
        pinup: false,
        pinupMaskActive: false,
        pinupFromWidth: 0,
        pinupToWidth: 0,
        pinupTransitionMs: 0,
    };
}
function getHologramState(existing: StoryActorState | undefined, command: StoryCommand) {
    const keptHologram = existing?.hologram ? existing : null;
    if (command.characterHologram !== true) {
        if (keptHologram) {
            return {
                hologram: true,
                hologramMaskActive: true,
                hologramFromWidth: 750,
                hologramToWidth: 750,
                hologramTransitionMs: 0,
                hologramRevision: keptHologram.hologramRevision,
            };
        }
        return {
            hologram: false,
            hologramMaskActive: false,
            hologramFromWidth: 0,
            hologramToWidth: 0,
            hologramTransitionMs: 0,
            hologramRevision: existing?.hologramRevision ?? 0,
        };
    }
    // NKCUICharacterView.PlayEffect는 이미 같은 Hologram 효과가 켜져 있으면
    // 아무 작업도 하지 않는다. 같은 캐릭터의 후속 명령에서는 마스크
    // 애니메이션을 다시 시작하지 않고 현재 효과를 그대로 유지한다.
    if (keptHologram) {
        return {
            hologram: true,
            hologramMaskActive: true,
            hologramFromWidth: 750,
            hologramToWidth: 750,
            hologramTransitionMs: 0,
            hologramRevision: keptHologram.hologramRevision,
        };
    }
    return {
        hologram: true,
        hologramMaskActive: true,
        hologramFromWidth: 0,
        hologramToWidth: 750,
        hologramTransitionMs: 330,
        hologramRevision: (existing?.hologramRevision ?? 0) + 1,
    };
}
function doesStoryCharacterFadeRunByCommand(command: StoryCommand) {
    const parsed = parseCharacterPosition(command.position);
    return Boolean(command.characterFadeOut ||
        (command.characterFadeIn && parsed?.action !== "dark"));
}
export function getCharacterCommandBlockingDuration(command: StoryCommand, characterFadeRuns = doesStoryCharacterFadeRunByCommand(command), characterMovementRuns = doesStoryCharacterMovementRunByCommand(command)) {
    return (getStoryCharacterFinishTiming(command, characterFadeRuns, characterMovementRuns).uninterruptedMs / 1000);
}
export function getStoryCharacterFinishTiming(command: StoryCommand, characterFadeRuns = doesStoryCharacterFadeRunByCommand(command), characterMovementRuns = doesStoryCharacterMovementRunByCommand(command), characterBounceRuns = true, characterScaleRuns = true) {
    const parsed = parseCharacterPosition(command.position);
    const movementMs = characterMovementRuns && parsed
        ? getMoveDurationMs(command, parsed.action)
        : 0;
    if (command.clear) {
        return {
            pausableMs: movementMs,
            passiveMs: 0,
            uninterruptedMs: movementMs,
            active: movementMs > 0,
        };
    }
    const bounce = getBounce(command);
    const bounceMs = characterBounceRuns
        ? bounce.count * bounce.timeMs * 2
        : 0;
    const trackingMs = Math.max(characterFadeRuns ? 1500 : 0, characterScaleRuns
        ? Math.max(Number(command.characterScaleTime ?? 0) * 1000, 0)
        : 0);
    const finishTriggers = [movementMs, bounceMs].filter((duration) => duration > 0);
    if (finishTriggers.length > 0) {
        // SetUnitMovePos와 BounceUnit은 같은 m_bFinished를 사용한다. 먼저
        // 끝난 쪽의 FinishUnit이 다른 이동/Bounce를 끝내고 알파·배율 추적도
        // 즉시 목표값으로 마무리한다.
        return {
            pausableMs: movementMs,
            passiveMs: bounceMs,
            uninterruptedMs: Math.min(...finishTriggers),
            active: true,
        };
    }
    return {
        pausableMs: trackingMs,
        passiveMs: 0,
        uninterruptedMs: trackingMs,
        active: trackingMs > 0,
    };
}
export function getStoryCharacterFinishRemainingMs(timing: ReturnType<typeof getStoryCharacterFinishTiming>, pausableElapsedMs: number, passiveElapsedMs: number, pausablePaused = false) {
    const pausableRemaining = timing.pausableMs > 0
        ? Math.max(timing.pausableMs - pausableElapsedMs, 0)
        : null;
    const passiveRemaining = timing.passiveMs > 0
        ? Math.max(timing.passiveMs - passiveElapsedMs, 0)
        : null;
    if (pausablePaused) {
        return passiveRemaining;
    }
    if (pausableRemaining !== null && passiveRemaining !== null) {
        return Math.min(pausableRemaining, passiveRemaining);
    }
    return pausableRemaining ?? passiveRemaining;
}
export function getStoryCommandPauseDurations(command: StoryCommand, centerFadeRuns = Boolean(command.talkCenterFadeIn), characterFadeRuns = doesStoryCharacterFadeRunByCommand(command), characterMovementRuns = doesStoryCharacterMovementRunByCommand(command), backgroundFadeRuns = doesStoryBackgroundFadeRunByCommand(command)) {
    const parsed = parseCharacterPosition(command.position);
    const movementSeconds = characterMovementRuns && parsed
        ? getMoveDurationMs(command, parsed.action) / 1000
        : 0;
    const characterTrackingDuration = command.clear
        ? movementSeconds
        : Math.max(movementSeconds, characterFadeRuns ? 1.5 : 0, Math.max(Number(command.characterScaleTime ?? 0), 0));
    const bounce = getBounce(command);
    const characterTweenDuration = command.clear
        ? 0
        : (bounce.count * bounce.timeMs * 2) / 1000;
    const backgroundEffectDuration = Number(command.backgroundCrash ?? 0) > 0 &&
        Number(command.backgroundCrashTime ?? 0) > 0
        ? Number(command.backgroundCrashTime)
        : command.backgroundAnimationNoWait
            ? 0
            : Number(command.backgroundAnimationTime ?? 0);
    const centerFadeDuration = centerFadeRuns &&
        getVisibleTextLength(command.talkText ?? "") > 0 &&
        Number(command.talkTime ?? 0) > 0
        ? 0.1 + Math.max(Number(command.talkCenterFadeTime ?? 0), 0)
        : 0;
    return {
        // SetPause가 Update나 대상 DOTween을 직접 멈추는 매니저들이다.
        pausable: Math.max(backgroundEffectDuration, backgroundFadeRuns ? Number(command.backgroundFadeInTime ?? 0) : 0, characterTrackingDuration),
        // 전역 Fade와 유닛 내부 DOTween은 SetPause 대상이 아니므로
        // 눈 아이콘으로 UI를 숨겨도 실제 시간 기준으로 계속 진행한다.
        passive: Math.max(Math.max(Number(command.fadeTime ?? 0), 0), characterTweenDuration, centerFadeDuration),
    };
}
export function doesStoryBackgroundFadeRunByCommand(command: StoryCommand, activeGameObjectSpine = Boolean(command.backgroundSpine)) {
    const opensBackground = Boolean(command.backgroundName ||
        (command.backgroundGameObject && command.backgroundAnimationName));
    if (!opensBackground || Number(command.backgroundFadeInTime ?? 0) <= 0) {
        return false;
    }
    // NKCUICutScenBGMgr.Open은 일반 Image에는 색상 Tween을 적용하지만,
    // GameObject 배경에서는 GetComponentInChildren<SkeletonGraphic>()로 찾은
    // m_sgGoBG에만 적용한다. 혈흔 Sprite·Unity FXM·미해결 GameObject까지
    // 같은 Fade와 대기시간을 적용하면 클라이언트보다 늦게 넘어가게 된다.
    return command.backgroundGameObject !== true || activeGameObjectSpine;
}
type StoryActorCommandResult = {
    actors: StoryActorState[];
    actorViewCache: StoryActorViewCache;
};
function resetActorForClear(actor: StoryActorState, colorSnapshot?: StoryActorColorSnapshot): StoryActorState {
    const preserveColorTracking = colorSnapshot?.tracking === true;
    return {
        ...actor,
        scaleX: 1,
        scaleY: 1,
        scaleFromX: 1,
        scaleFromY: 1,
        flip: false,
        dark: preserveColorTracking ? actor.dark : false,
        darkAlpha: preserveColorTracking ? actor.darkAlpha : 1,
        colorFromMultiplier: preserveColorTracking
            ? actor.colorFromMultiplier
            : 1,
        colorToMultiplier: preserveColorTracking ? actor.colorToMultiplier : 1,
        colorTransitionMs: preserveColorTracking ? actor.colorTransitionMs : 0,
        colorTransitionRevision: actor.colorTransitionRevision,
        whitening: preserveColorTracking ? actor.whitening : false,
        fadeIn: false,
        fadeOut: false,
        hidden: false,
        scaleTransitionMs: 0,
        crashStrength: 0,
    };
}
function cleanupActorEffects(actor: StoryActorState): StoryActorState {
    return {
        ...actor,
        hologram: false,
        hologramMaskActive: false,
        hologramFromWidth: 0,
        hologramToWidth: 0,
        hologramTransitionMs: 0,
        pinup: false,
        pinupMaskActive: false,
        pinupFromWidth: 0,
        pinupToWidth: 0,
        pinupTransitionMs: 0,
    };
}
function applyActorCommand(actors: StoryActorState[], actorViewCache: StoryActorViewCache, command: StoryCommand, resolveCharacterViewKey?: (characterId: string) => string | undefined, actorColorSnapshots?: StoryActorColorSnapshots): StoryActorCommandResult {
    const settled = settleActors(actors);
    const settledCache = settleActorViewCache(actorViewCache, actors);
    const parsed = parseCharacterPosition(command.position);
    if (command.clear) {
        const resetCache: StoryActorViewCache = {};
        for (const slot of ["left", "center", "right"] as const) {
            const cached = settledCache[slot];
            if (cached) {
                resetCache[slot] = resetActorForClear(cached, getActorColorSnapshot(actorColorSnapshots, cached.spineViewKey));
            }
        }
        // ClearUnit은 현재 위치가 NONE이어도 세 슬롯을 모두 순회한다.
        // 활성 오브젝트는 모두 숨기고 효과를 정리하지만 m_prefab과
        // CharacterView 자체는 장면 Close 전까지 캐시에 남는다.
        if (!parsed) {
            for (const slot of ["left", "center", "right"] as const) {
                const cached = resetCache[slot];
                if (cached) {
                    resetCache[slot] = cleanupActorEffects(cached);
                }
            }
            return { actors: [], actorViewCache: resetCache };
        }
        // ClearUnit은 지정 슬롯 여부와 무관하게 모든 슬롯의 스케일 추적과
        // 반전·CharacterView 색상을 먼저 기본값으로 돌린다. 지정 슬롯은
        // CanvasGroup도 1로 복원하고, DoClear에서 그 슬롯 효과만 정리한다.
        const resetActors = settled.map((actor) => resetActorForClear(actor, getActorColorSnapshot(actorColorSnapshots, actor.spineViewKey)));
        const target = resetActors.find((actor) => actor.slot === parsed.targetSlot);
        const cachedTarget = resetCache[parsed.targetSlot];
        if (cachedTarget) {
            resetCache[parsed.targetSlot] = cleanupActorEffects({
                ...cachedTarget,
                commandFace: command.face ?? "",
            });
        }
        if (!target) {
            return { actors: resetActors, actorViewCache: resetCache };
        }
        if (parsed.action === "place") {
            return {
                actors: resetActors.filter((actor) => actor.slot !== parsed.targetSlot),
                actorViewCache: resetCache,
            };
        }
        if (parsed.action !== "out") {
            // DoClear는 PLACE와 OUT만 별도 처리한다. MOVE/IN/DARK clear는
            // 해당 유닛을 숨기거나 이동시키지 않고 현재 위치에 남긴다.
            const nextActors = resetActors.map((actor) => actor.slot === parsed.targetSlot
                ? cleanupActorEffects({
                    ...actor,
                    commandFace: command.face ?? "",
                    moving: false,
                    removeOnNextCommand: false,
                    movementMs: 0,
                    hidden: false,
                })
                : actor);
            if (nextActors.find((actor) => actor.slot === parsed.targetSlot)) {
                resetCache[parsed.targetSlot] = nextActors.find((actor) => actor.slot === parsed.targetSlot);
            }
            return { actors: nextActors, actorViewCache: resetCache };
        }
        const offsetX = parsed.moveDown
            ? target.offsetX
            : vectorValue(command.characterOffset, 0, 0) +
                getDirectionSign(parsed.directionSlot) * parsed.distance;
        const offsetY = parsed.moveDown
            ? vectorValue(command.characterOffset, 1, 0) - parsed.distance
            : vectorValue(command.characterOffset, 1, 0);
        const nextActors = resetActors.map((actor) => actor.slot === parsed.targetSlot
            ? cleanupActorEffects({
                ...actor,
                commandFace: command.face ?? "",
                offsetX,
                offsetY,
                moveFromX: actor.offsetX,
                moveFromY: actor.offsetY,
                moving: true,
                movementMs: getMoveDurationMs(command, "out"),
                removeOnNextCommand: true,
                hidden: false,
            })
            : actor);
        resetCache[parsed.targetSlot] = nextActors.find((actor) => actor.slot === parsed.targetSlot);
        return { actors: nextActors, actorViewCache: resetCache };
    }
    if (!command.characterId) {
        return { actors: settled, actorViewCache: settledCache };
    }
    // 인게임 NKCUICutScenUnitMgr.SetUnit은 CutUnitPos가 NONE(-1)이면 즉시
    // 반환한다. 따라서 m_CharStrID가 화자명으로만 쓰인 무위치 명령은
    // 새 모델을 만들지도, 기존 모델의 표정이나 효과를 바꾸지도 않는다.
    if (!parsed) {
        return { actors: settled, actorViewCache: settledCache };
    }
    const resolvedCharacterViewKey = resolveCharacterViewKey?.(command.characterId);
    // ApplyNextCut은 GetCutScenCharTempletByStrID()가 null이면 SetUnit()을
    // 호출하지 않는다. 따라서 잘못된/누락된 템플릿 ID가 위치를 갖고 있어도
    // 현재 슬롯, 다른 슬롯의 암전, MOVE 출발 슬롯을 전혀 바꾸지 않는다.
    // resolver를 생략하는 단위 테스트는 기존처럼 ID 자체를 뷰 키로 쓴다.
    if (resolveCharacterViewKey && resolvedCharacterViewKey === undefined) {
        return { actors: settled, actorViewCache: settledCache };
    }
    const targetActor = settled.find((actor) => actor.slot === parsed.targetSlot);
    const targetView = targetActor ?? settledCache[parsed.targetSlot];
    const sourceActor = parsed.action === "move" && parsed.sourceSlot
        ? settled.find((actor) => actor.slot === parsed.sourceSlot) ??
            settledCache[parsed.sourceSlot]
        : undefined;
    const commandFace = command.face ?? "";
    const transfersMoveTrackTime = parsed.action === "move" &&
        Boolean(sourceActor) &&
        sourceActor?.commandFace === commandFace;
    // SetUnit은 MOVE 원본 슬롯을 먼저 ClearUnitByPos로 비운 뒤 대상
    // NKCCutUnit의 CharacterView에 SetUnitIllust를 호출한다. 따라서 표정,
    // 색상, Hologram, Pinup 같은 뷰 상태는 원본 슬롯에서 복사하지 않고
    // 실제 대상 슬롯에 같은 캐릭터가 있을 때만 이어진다.
    const existing = targetView;
    // NKCCutUnit.SetUnitIllust는 캐릭터 문자열 ID가 아니라 m_PrefabStr와
    // 강제 skinID가 같은지로 CharacterView 재사용 여부를 판단한다. 일반
    // 스토리 재생은 dicSkin=null이라 skinID가 항상 0이므로 프리팹 문자열을
    // 대소문자까지 정확히 비교한다. 메타데이터가 없는 단위 테스트에서는
    // 이전 호환을 위해 캐릭터 ID를 뷰 키로 사용한다.
    const characterViewKey = resolvedCharacterViewKey === undefined
        ? command.characterId
        : resolvedCharacterViewKey;
    const existingSameCharacter = (existing?.characterViewKey ?? existing?.characterId) === characterViewKey
        ? existing
        : undefined;
    const scaleTransitionMs = Math.max(Number(command.characterScaleTime ?? 0) * 1000, 0);
    const tracksScale = scaleTransitionMs > 0;
    const scaleX = tracksScale
        ? vectorValue(command.characterScale, 0, 0)
        : 1;
    const scaleY = tracksScale
        ? vectorValue(command.characterScale, 1, scaleX)
        : 1;
    // SetUnitScaleByTime은 대상 NKCCutUnit의 현재 localScale을 시작값으로
    // 저장한다. MOVE도 원본 슬롯이 아니라 새 목표 슬롯의 Transform을 쓴다.
    const scaleFromX = tracksScale
        ? targetView
            ? targetView.scaleX * (targetView.flip ? -1 : 1)
            : 1
        : scaleX * (command.characterFlip ? -1 : 1);
    const scaleFromY = tracksScale ? targetView?.scaleY ?? 1 : scaleY;
    const scaleRevision = tracksScale
        ? (targetView?.scaleRevision ?? 0) + 1
        : targetView?.scaleRevision ?? 0;
    const finalOffsetX = vectorValue(command.characterOffset, 0, 0);
    const finalOffsetY = vectorValue(command.characterOffset, 1, 0);
    const directionSign = getDirectionSign(parsed.directionSlot);
    const movementMs = doesStoryCharacterMovementRunByCommand(command)
        ? getMoveDurationMs(command, parsed.action)
        : 0;
    const bounce = getBounce(command);
    const pinupState = getPinupState(existingSameCharacter, command);
    const hologramState = getHologramState(existingSameCharacter, command);
    const directDark = parsed.action === "dark";
    const startsNewHologram = command.characterHologram === true &&
        existingSameCharacter?.hologram !== true;
    // SetUnitIllust는 시작색을 정한 뒤 새 Hologram 효과를 생성한다. 효과의
    // SetEffect가 유닛 색을 홀로그램 원색으로 다시 써서, 새 홀로그램의
    // *_D 명령은 실제 클라이언트에서도 어둡지 않다.
    const startsDark = directDark && !startsNewHologram;
    // SetUnitIllust는 DARK를 FadeIn보다 먼저 처리하므로 FadeIn을 시작하지
    // 않는다. FadeOut은 DARK보다 먼저 알파 추적을 시작하고, 매 프레임 뒤에
    // 실행되는 UpdateUnitAlpha가 RGB를 흰색으로 다시 써서 암전을 덮는다.
    const alphaTrackingOverridesDark = Boolean(startsDark && command.characterFadeOut);
    const dark = startsDark && !alphaTrackingOverridesDark;
    const darkAlpha = startsDark &&
        hologramState.hologram &&
        existingSameCharacter?.hologram === true
        ? 0.5
        : 1;
    const reusesCharacterView = Boolean(existingSameCharacter);
    // NKCCutUnit.SetUnitIllust()의 동일 프리팹 재사용 분기는 FadeOut만
    // 실행한다. FadeIn 플래그는 새/교체 CharacterView에서만 알파 추적을
    // 시작하므로 같은 캐릭터의 후속 명령에 다시 적용하면 안 된다.
    const appliesFadeIn = Boolean(command.characterFadeIn && !reusesCharacterView && !directDark);
    const appliesFadeOut = Boolean(command.characterFadeOut);
    // 새/교체 캐릭터는 0→1로 0.2초간 밝아진다. 단, 빈 슬롯으로 MOVE하는
    // 경우와 DARK/Fade 명령에는 WhitenUnit을 호출하지 않는다.
    const whitening = !reusesCharacterView &&
        Boolean(existing || parsed.action !== "move") &&
        !directDark &&
        !command.characterFadeIn &&
        !command.characterFadeOut;
    const offsetX = finalOffsetX;
    const offsetY = finalOffsetY;
    let moveFromX = existing?.offsetX ?? finalOffsetX;
    let moveFromY = existing?.offsetY ?? finalOffsetY;
    const removeOnNextCommand = false;
    if (parsed.action === "in") {
        moveFromX = finalOffsetX + directionSign * parsed.distance;
        moveFromY = finalOffsetY;
    }
    else if (parsed.action === "move" && parsed.sourceSlot) {
        moveFromX =
            SLOT_REFERENCE_X[parsed.sourceSlot] -
                SLOT_REFERENCE_X[parsed.targetSlot] +
                (sourceActor?.offsetX ?? 0);
        moveFromY = sourceActor?.offsetY ?? 0;
    }
    const nextActor: StoryActorState = {
        characterId: command.characterId,
        characterViewKey,
        slot: parsed.targetSlot,
        // 얼굴 문자열은 모델 컴포넌트에서 실제로 선택한 애니메이션과
        // 구분해 둔다. 빈 문자열이어도 CharacterView 자체는 기본 IDLE을
        // 시작하며, StorySpineActor가 그 규칙을 적용한다.
        face: command.face ?? existingSameCharacter?.face ?? "",
        // NKCCutUnit은 MOVE 원본 슬롯의 직전 CutTemplet.m_Face와 새 명령의
        // m_Face를 비교한다. 화면에 남아 있는 표정과 별개로 각 명령의
        // 원본 얼굴 문자열을 슬롯 상태에 보존해야 `SURPRISE`와
        // `UNIT_SURPRISE`를 같은 표정으로 보정하지 않으며, 빈 문자열끼리의
        // 비교도 클라이언트와 같아진다.
        commandFace,
        // NKCCutTemplet.m_bFaceLoop의 명령별 기본값은 true다. 새 얼굴 문자열이
        // 있으면 이전 표정의 loop 값을 물려받지 않고 이번 명령 기본값을 쓴다.
        // 얼굴 문자열 자체가 없을 때만 SetAnimation을 호출하지 않으므로 기존
        // 트랙의 loop 상태를 유지한다.
        faceLoop: command.face
            ? command.faceLoop ?? true
            : existingSameCharacter?.faceLoop ?? true,
        faceRevision: command.face
            ? (existingSameCharacter?.faceRevision ?? 0) + 1
            : existingSameCharacter?.faceRevision ?? 0,
        // CharacterView를 실제로 재사용하는 경우에만 같은 Spine 인스턴스
        // 키를 유지한다. MOVE의 출발 슬롯과 도착 슬롯은 별도 뷰이며,
        // 렌더러가 이 키로 출발 뷰의 AnimationTime을 찾는다.
        spineViewKey: existingSameCharacter?.spineViewKey ??
            `${command.key}:${parsed.targetSlot}:${command.characterId}`,
        spineTrackTimeSourceKey: transfersMoveTrackTime && sourceActor
            ? sourceActor.spineViewKey
            : "",
        scaleX,
        scaleY,
        scaleFromX,
        scaleFromY,
        scaleRevision,
        offsetX,
        offsetY,
        ...pinupState,
        ...hologramState,
        // SetUnitScaleByTime은 flip을 쓰기 전에 추적을 예약한다. 추적 시간이
        // 양수면 다음 프레임부터 추적값이 localScale을 덮어써 flip이 사라진다.
        flip: tracksScale ? false : command.characterFlip ?? false,
        dark,
        darkAlpha,
        colorFromMultiplier: whitening ? 0 : dark ? 0.25 : 1,
        colorToMultiplier: dark ? 0.25 : 1,
        colorTransitionMs: 0,
        colorTransitionRevision: existingSameCharacter?.colorTransitionRevision ?? 0,
        whitening,
        fadeIn: appliesFadeIn,
        fadeOut: appliesFadeOut,
        // SetUnitIllust는 기존 알파 추적을 멈춘 뒤 같은 프리팹 재사용을
        // 포함해 CharacterView.SetColor(startColor)를 호출한다. 따라서 앞선
        // FadeOut으로 투명해진 슬롯도 다음 캐릭터 명령에서 즉시 다시 보인다.
        hidden: false,
        moving: movementMs > 0,
        removeOnNextCommand,
        moveFromX,
        moveFromY,
        movementMs,
        scaleTransitionMs,
        bounceCount: bounce.count,
        bounceTimeMs: bounce.timeMs,
        crashStrength: Math.max(Number(command.characterCrash ?? 0), 0),
    };
    const clearsMoveSource = parsed.action === "move" &&
        Boolean(parsed.sourceSlot) &&
        parsed.sourceSlot !== parsed.targetSlot;
    const withoutCharacter = settled
        .filter((actor) => actor.slot !== nextActor.slot &&
        (!clearsMoveSource || actor.slot !== parsed.sourceSlot))
        .map((actor) => ({
        ...actor,
        dark: true,
        // DarkenUnit은 RGB만 0.25까지 0.15초간 선형 추적하고 기존
        // 알파값은 유지한다.
        colorFromMultiplier: getActorColorSnapshot(actorColorSnapshots, actor.spineViewKey)
            ?.multiplier ?? actor.colorToMultiplier,
        colorToMultiplier: 0.25,
        colorTransitionMs: 150,
        colorTransitionRevision: actor.colorTransitionRevision + 1,
        whitening: false,
    }));
    const nextCache: StoryActorViewCache = { ...settledCache };
    if (clearsMoveSource && parsed.sourceSlot) {
        const cachedSource = nextCache[parsed.sourceSlot];
        if (cachedSource) {
            // ClearUnitByPos(..., bNone=true)는 출발 슬롯을 비활성화하고 효과와
            // 배율·색을 정리하지만 m_prefab과 직전 CutTemplet.m_Face는 남긴다.
            nextCache[parsed.sourceSlot] = cleanupActorEffects(resetActorForClear(cachedSource));
        }
    }
    // SetUnit 마지막의 DarkenOtherUnitColor는 활성 여부가 아니라 슬롯의
    // NKCCutTemplet 존재 여부를 본다. 따라서 비활성 캐시도 대상 외에는
    // 어두워지지만, 재등장 SetColor에서 다시 시작색으로 복원된다.
    for (const slot of ["left", "center", "right"] as const) {
        const cached = nextCache[slot];
        if (cached && slot !== parsed.targetSlot) {
            nextCache[slot] = {
                ...cached,
                dark: true,
                colorFromMultiplier: getActorColorSnapshot(actorColorSnapshots, cached.spineViewKey)
                    ?.multiplier ?? cached.colorToMultiplier,
                colorToMultiplier: 0.25,
                colorTransitionMs: 150,
                colorTransitionRevision: cached.colorTransitionRevision + 1,
                whitening: false,
            };
        }
    }
    nextCache[parsed.targetSlot] = nextActor;
    return {
        actors: [...withoutCharacter, nextActor],
        actorViewCache: nextCache,
    };
}
export function applyStoryCommand(previous: StoryVisualState, command: StoryCommand, backgroundTransform?: StoryBackgroundTransformSnapshot, resolveCharacterViewKey?: (characterId: string) => string | undefined, actorColorSnapshots?: StoryActorColorSnapshots): StoryVisualState {
    const actionOnly = skipsStoryCommandBody(command);
    // 인게임은 매 컷 시작 시 예약 음향과 캐릭터 이동 완료, 타이틀 닫기,
    // LooseShake 전환까지 처리한 뒤 JUMP/SELECT에서 즉시 반환한다.
    // 따라서 분기 명령에 함께 들어 있는 배경·캐릭터·시작 음향 필드는 실행하지 않는다.
    if (actionOnly) {
        const hasPendingBgm = Boolean(previous.pendingBgmName);
        const finishedBackgroundState = finishStoryPreviousBackgroundFade(previous);
        const settledActorViewCache = settleActorViewCache(previous.actorViewCache, previous.actors);
        return {
            ...finishedBackgroundState,
            actors: settleActors(previous.actors),
            actorViewCache: settledActorViewCache,
            backgroundTransitionMs: previous.backgroundAnimationNoWait
                ? previous.backgroundTransitionMs
                : 0,
            backgroundPositionTransitionMs: previous.backgroundAnimationNoWait
                ? previous.backgroundPositionTransitionMs
                : 0,
            backgroundAnimationNoWait: previous.backgroundAnimationNoWait,
            backgroundCrashStrength: 0,
            backgroundCrashTimeMs: 0,
            imageTransitionMs: 0,
            bgmName: hasPendingBgm ? previous.pendingBgmName : previous.bgmName,
            bgmPath: hasPendingBgm ? previous.pendingBgmPath : previous.bgmPath,
            bgmVolume: 1,
            bgmStartTime: 0,
            bgmRestart: false,
            bgmRevision: hasPendingBgm
                ? previous.bgmRevision + 1
                : previous.bgmRevision,
            pendingBgmName: "",
            pendingBgmPath: "",
            dialogueOpening: false,
            dialogueOpeningTimeMs: 0,
            dialogueFadeIn: false,
            dialogueFadeOut: false,
            dialogueFadeTimeMs: 0,
            titleText: "",
            subtitleText: "",
            titleFadeOut: false,
            titleFadeOutTimeMs: 0,
            shake: command.looseShake === true,
            shakeRevision: command.looseShake === true
                ? previous.shakeRevision + 1
                : previous.shakeRevision,
            fadeActive: false,
            fadeTimeMs: 0,
        };
    }
    const cleared = previous;
    const actorResult = applyActorCommand(previous.actors, previous.actorViewCache, command, resolveCharacterViewKey, actorColorSnapshots);
    const actors = actorResult.actors;
    const hasTalk = Boolean(command.talkText);
    const requestedDialogueBoxType = getStoryCommandDialogueBoxType(command);
    const previousDialogueGoalText = getStoryDialogueGoalText(cleared, requestedDialogueBoxType);
    const nextDialogueGoalText = hasTalk
        ? command.talkAppend
            ? `${previousDialogueGoalText}${command.talkText}`
            : command.talkText ?? ""
        : previousDialogueGoalText;
    const keepsClosedTalkContents = !hasTalk && actors.length === 0;
    const dialogueText = hasTalk
        ? command.talkLayoutBreaks?.length
            ? applyStoryTalkLayoutBreaks(command.talkAppend ? nextDialogueGoalText : command.talkText ?? "", command.talkLayoutBreaks)
            : command.talkAppend && Number(command.talkTime ?? 0) > 0
                ? nextDialogueGoalText
                : command.talkText ?? ""
        : keepsClosedTalkContents
            ? cleared.dialogueText
            : "";
    const dialogueCentered = hasTalk
        ? requestedDialogueBoxType === "center"
        : false;
    const dialogueGoalNormalText = hasTalk && requestedDialogueBoxType === "normal"
        ? nextDialogueGoalText
        : cleared.dialogueGoalNormalText;
    const dialogueGoalCenterText = hasTalk && requestedDialogueBoxType === "center"
        ? nextDialogueGoalText
        : cleared.dialogueGoalCenterText;
    const dialogueBoxWasClosed = Boolean(command.closeTalkBox);
    const dialogueBoxSwitched = hasTalk && requestedDialogueBoxType !== cleared.dialogueBoxType;
    const dialogueBoxWasOpen = cleared.dialogueBoxOpen &&
        !dialogueBoxWasClosed &&
        !dialogueBoxSwitched;
    const dialogueBoxOpen = hasTalk
        ? true
        : actors.length > 0 && !dialogueBoxWasClosed
            ? cleared.dialogueBoxOpen
            : false;
    const dialogueBoxType = hasTalk
        ? requestedDialogueBoxType
        : cleared.dialogueBoxType;
    let dialogueNextNormalActive = cleared.dialogueNextNormalActive;
    let dialogueNextCenterActive = cleared.dialogueNextCenterActive;
    if (hasTalk) {
        const talkTime = Math.max(Number(command.talkTime ?? 0), 0);
        const previousNextActive = dialogueBoxType === "center"
            ? dialogueNextCenterActive
            : dialogueNextNormalActive;
        // Open은 타자 출력이 있을 때 기존 아이콘을 즉시 숨긴 뒤, 출력 완료 시
        // waitClick인 경우에만 다시 켠다. 즉시 출력 대사는 waitClick일 때만
        // 켜고, 자동 대사라면 기존 자식 활성 상태를 그대로 둔다.
        const nextActive = talkTime > 0
            ? Boolean(command.waitClick)
            : command.waitClick
                ? true
                : previousNextActive;
        if (dialogueBoxType === "center") {
            dialogueNextCenterActive = nextActive;
        }
        else {
            dialogueNextNormalActive = nextActive;
        }
    }
    const keepsCenteredBox = dialogueBoxType === "center" &&
        (hasTalk || (dialogueBoxOpen && actors.length > 0));
    const dialogueCenterFadePrimed = keepsCenteredBox
        ? dialogueBoxWasOpen && cleared.dialogueBoxType === "center"
            ? cleared.dialogueCenterFadePrimed
            : false
        : false;
    const dialogueCenterFadeRuns = hasTalk &&
        dialogueBoxType === "center" &&
        Boolean(command.talkCenterFadeIn) &&
        !dialogueCenterFadePrimed;
    const dialogueOpening = hasTalk &&
        dialogueBoxType === "normal" &&
        !dialogueBoxWasOpen &&
        Number(command.talkTime ?? 0) > 0;
    const opensJapanNeedsTalk = hasTalk && requestedDialogueBoxType === "normal";
    // NKCUICutScenTalkBoxMgrForJapan.Open()은 m_bTempFlag가 false인 호출에서
    // 화자명 뒤에 공백 하나를 붙이고, 호출할 때마다 플래그를 반전한다.
    // 중앙 대사 매니저는 별개이므로 이 플래그를 건드리지 않는다.
    const speakerNameHasTempSpace = opensJapanNeedsTalk
        ? !cleared.speakerNameTempFlag
        : false;
    const speakerNameTempFlag = opensJapanNeedsTalk
        ? !cleared.speakerNameTempFlag
        : cleared.speakerNameTempFlag;
    const backgroundName = command.backgroundName ?? cleared.backgroundName;
    // ApplyNextCut의 비교는 대소문자를 바꾸지 않는 정확한 "CLOSE" 비교다.
    const closesBackground = backgroundName === "CLOSE";
    const reservedBgmName = cleared.pendingBgmName || cleared.bgmName;
    const reservedBgmPath = cleared.pendingBgmPath || cleared.bgmPath;
    const nextBgmName = command.bgmName ?? reservedBgmName;
    const nextBgmPath = command.bgmPath ?? reservedBgmPath;
    const actionMusic = command.action === "PLAY_MUSIC" && command.actionMusicPath
        ? {
            name: command.actionMusicName ?? "",
            path: command.actionMusicPath,
            startTime: Number(command.actionMusicStartTime ?? 0),
        }
        : null;
    const changesBgm = Boolean(cleared.pendingBgmPath || command.bgmPath || actionMusic);
    // NKCUICutScenBGMgr.Open()은 웹에서 재현하지 못한 GameObject라도 기존
    // 이미지 슬롯을 먼저 끈 뒤 새 오브젝트를 연다. 미지원 여부를 배경 교체
    // 조건으로 사용하면 이전 이미지를 잘못 계속 보여 주게 된다.
    const changesBackground = Boolean(command.backgroundName);
    const opensBackground = changesBackground && !closesBackground;
    const reusesGameObjectForAnimation = Boolean(!command.backgroundName &&
        command.backgroundGameObject === true &&
        command.backgroundAnimationName &&
        cleared.backgroundGameObject);
    const backgroundOpenRequested = !closesBackground &&
        Boolean(command.backgroundName ||
            (command.backgroundGameObject && command.backgroundAnimationName));
    const backgroundCrashStrength = Math.max(Number(command.backgroundCrash ?? 0), 0);
    const backgroundCrashTimeMs = Math.max(Number(command.backgroundCrashTime ?? 0) * 1000, 0);
    const runsBackgroundCrash = backgroundCrashStrength > 0 && backgroundCrashTimeMs > 0;
    const runsBackgroundAnimation = !runsBackgroundCrash &&
        Number(command.backgroundAnimationTime ?? 0) > 0 &&
        Boolean(command.backgroundAnimatePosition || command.backgroundAnimateScale);
    const backgroundAnimationTimeMs = Math.max(Number(command.backgroundAnimationTime ?? 0) * 1000, 0);
    const backgroundOffsetX = runsBackgroundAnimation &&
        command.backgroundAnimatePosition
        ? vectorValue(command.backgroundOffset, 0, cleared.backgroundOffsetX)
        : cleared.backgroundOffsetX;
    const backgroundOffsetY = runsBackgroundAnimation &&
        command.backgroundAnimatePosition
        ? vectorValue(command.backgroundOffset, 1, cleared.backgroundOffsetY)
        : cleared.backgroundOffsetY;
    const backgroundScaleX = runsBackgroundAnimation &&
        command.backgroundAnimateScale
        ? vectorValue(command.backgroundScale, 0, cleared.backgroundScaleX)
        : cleared.backgroundScaleX;
    const backgroundScaleY = runsBackgroundAnimation &&
        command.backgroundAnimateScale
        ? vectorValue(command.backgroundScale, 1, backgroundScaleX)
        : cleared.backgroundScaleY;
    const backgroundFadeInTimeMs = Math.max(Number(command.backgroundFadeInTime ?? 0) * 1000, 0);
    const activeGameObjectSpineForFade = Boolean(command.backgroundSpine ||
        (reusesGameObjectForAnimation && cleared.backgroundSpine));
    const runsBackgroundFadeIn = (opensBackground || reusesGameObjectForAnimation) &&
        doesStoryBackgroundFadeRunByCommand(command, activeGameObjectSpineForFade);
    const backgroundTintStart = runsBackgroundFadeIn
        ? command.backgroundFadeInStartColor ?? [1, 1, 1, 1]
        : opensBackground || reusesGameObjectForAnimation
            ? [1, 1, 1, 1]
            : cleared.backgroundTintEnd;
    const backgroundTintEnd = runsBackgroundFadeIn
        ? command.backgroundFadeInColor ?? [1, 1, 1, 1]
        : opensBackground || reusesGameObjectForAnimation
            ? [1, 1, 1, 1]
            : cleared.backgroundTintEnd;
    const backgroundTintEase = runsBackgroundFadeIn
        ? command.backgroundFadeInEase
        : "";
    const nextUsesGameObject = command.backgroundGameObject === true;
    const previousUsesGameObject = cleared.backgroundGameObject;
    const keepsActiveBackground = !closesBackground &&
        changesBackground &&
        Boolean(cleared.backgroundUrl || cleared.backgroundSpine) &&
        cleared.backgroundFadeOutTimeMs > 0 &&
        previousUsesGameObject === nextUsesGameObject;
    const keepsRetainedImageBackground = !closesBackground &&
        changesBackground &&
        !nextUsesGameObject &&
        Boolean(cleared.retainedImageBackgroundUrl) &&
        cleared.backgroundFadeOutTimeMs > 0 &&
        (previousUsesGameObject || !cleared.backgroundUrl);
    const keepsSettledPreviousImage = !changesBackground &&
        !closesBackground &&
        !cleared.previousBackgroundGameObject &&
        Boolean(cleared.previousBackgroundUrl);
    const keepsPreviousBackground = keepsActiveBackground ||
        keepsRetainedImageBackground ||
        keepsSettledPreviousImage;
    const previousOffsetX = keepsSettledPreviousImage
        ? cleared.previousBackgroundOffsetX
        : keepsRetainedImageBackground
            ? cleared.retainedImageBackgroundOffsetX
            : backgroundTransform?.offsetX ?? cleared.backgroundOffsetX;
    const previousOffsetY = keepsSettledPreviousImage
        ? cleared.previousBackgroundOffsetY
        : keepsRetainedImageBackground
            ? cleared.retainedImageBackgroundOffsetY
            : backgroundTransform?.offsetY ?? cleared.backgroundOffsetY;
    const previousScaleX = keepsSettledPreviousImage
        ? cleared.previousBackgroundScaleX
        : keepsActiveBackground && previousUsesGameObject
            ? backgroundTransform?.scaleX ?? cleared.backgroundScaleX
            : 1;
    const previousScaleY = keepsSettledPreviousImage
        ? cleared.previousBackgroundScaleY
        : keepsActiveBackground && previousUsesGameObject
            ? backgroundTransform?.scaleY ?? cleared.backgroundScaleY
            : 1;
    const previousTintStart = keepsSettledPreviousImage
        ? cleared.previousBackgroundTintEnd
        : keepsActiveBackground && previousUsesGameObject
            ? backgroundTransform?.tint ?? cleared.backgroundTintEnd
            : runsBackgroundFadeIn
                ? backgroundTintStart
                : [1, 1, 1, 1];
    const capturesCurrentImageBackground = changesBackground &&
        nextUsesGameObject &&
        !previousUsesGameObject &&
        Boolean(cleared.backgroundUrl);
    const updatesRetainedImageTransform = !previousUsesGameObject && !changesBackground && runsBackgroundAnimation;
    const retainedImageBackgroundName = changesBackground && !closesBackground
        ? nextUsesGameObject
            ? capturesCurrentImageBackground
                ? cleared.backgroundName
                : cleared.retainedImageBackgroundName
            : backgroundName
        : cleared.retainedImageBackgroundName;
    const retainedImageBackgroundUrl = changesBackground && !closesBackground
        ? nextUsesGameObject
            ? capturesCurrentImageBackground
                ? cleared.backgroundUrl
                : cleared.retainedImageBackgroundUrl
            : command.backgroundUrl ?? ""
        : cleared.retainedImageBackgroundUrl;
    const retainedImageBackgroundOffsetX = capturesCurrentImageBackground
        ? backgroundTransform?.offsetX ?? cleared.backgroundOffsetX
        : changesBackground && !nextUsesGameObject
            ? previousUsesGameObject && !runsBackgroundAnimation
                ? cleared.retainedImageBackgroundOffsetX
                : backgroundOffsetX
            : updatesRetainedImageTransform
                ? backgroundOffsetX
                : cleared.retainedImageBackgroundOffsetX;
    const retainedImageBackgroundOffsetY = capturesCurrentImageBackground
        ? backgroundTransform?.offsetY ?? cleared.backgroundOffsetY
        : changesBackground && !nextUsesGameObject
            ? previousUsesGameObject && !runsBackgroundAnimation
                ? cleared.retainedImageBackgroundOffsetY
                : backgroundOffsetY
            : updatesRetainedImageTransform
                ? backgroundOffsetY
                : cleared.retainedImageBackgroundOffsetY;
    const imageName = command.imageName ?? "";
    // NKCUICutScenImgMgr에는 배경 매니저와 달리 "CLOSE" 예약어가 없다.
    // 이미지 이름이 완전히 비어 있을 때만 Close를 호출한다.
    const closesImage = !imageName;
    const clearsTitle = doesStoryCommandClearTitle(command);
    const fadeTimeMs = Math.max(Number(command.fadeTime ?? 0) * 1000, 0);
    const flashTimeMs = Math.max(Number(command.flashBangTime ?? 0) * 1000, 0);
    const runsFade = fadeTimeMs > 0;
    const runsFlash = !runsFade && flashTimeMs > 0;
    return {
        ...cleared,
        backgroundName: closesBackground ? "" : backgroundName,
        backgroundUrl: closesBackground
            ? ""
            : command.backgroundName
                ? command.backgroundUrl ?? ""
                : cleared.backgroundUrl,
        backgroundSpine: closesBackground
            ? null
            : command.backgroundName
                ? command.backgroundSpine ?? null
                : cleared.backgroundSpine,
        backgroundSpineAnimation: command.backgroundAnimationName ??
            (command.backgroundName
                ? command.backgroundDefaultAnimation ?? ""
                : cleared.backgroundSpineAnimation),
        backgroundSpineLoop: command.backgroundAnimationName
            ? command.backgroundLoop ?? true
            : command.backgroundName
                ? command.backgroundDefaultLoop ?? false
                : cleared.backgroundSpineLoop,
        retainedImageBackgroundName,
        retainedImageBackgroundUrl,
        retainedImageBackgroundOffsetX,
        retainedImageBackgroundOffsetY,
        previousBackgroundUrl: keepsPreviousBackground
            ? keepsSettledPreviousImage
                ? cleared.previousBackgroundUrl
                : keepsRetainedImageBackground
                    ? cleared.retainedImageBackgroundUrl
                    : cleared.backgroundUrl
            : "",
        previousBackgroundSpine: keepsPreviousBackground
            ? keepsSettledPreviousImage
                ? cleared.previousBackgroundSpine
                : keepsRetainedImageBackground
                    ? null
                    : cleared.backgroundSpine
            : null,
        previousBackgroundSpineAnimation: keepsPreviousBackground
            ? keepsSettledPreviousImage
                ? cleared.previousBackgroundSpineAnimation
                : keepsRetainedImageBackground
                    ? ""
                    : cleared.backgroundSpineAnimation
            : "",
        previousBackgroundSpineLoop: keepsPreviousBackground
            ? keepsSettledPreviousImage
                ? cleared.previousBackgroundSpineLoop
                : keepsRetainedImageBackground
                    ? false
                    : cleared.backgroundSpineLoop
            : false,
        previousBackgroundOffsetX: keepsPreviousBackground
            ? previousOffsetX
            : 0,
        previousBackgroundOffsetY: keepsPreviousBackground
            ? previousOffsetY
            : 0,
        previousBackgroundScaleX: keepsPreviousBackground
            ? previousScaleX
            : 1,
        previousBackgroundScaleY: keepsPreviousBackground
            ? previousScaleY
            : 1,
        previousBackgroundGameObject: keepsActiveBackground && previousUsesGameObject,
        // ProcessGameObjectBG는 FadeOut 중인 이전 GameObject 인스턴스 전체를
        // m_goBG_2로 옮긴다. SkeletonGraphic 색상만 Tween되지만 자식 FXM은
        // 인스턴스가 파괴될 때까지 그대로 살아 있어야 한다.
        previousBackgroundEffectRevision: keepsActiveBackground && previousUsesGameObject
            ? cleared.backgroundEffectRevision
            : 0,
        previousGameObjectEffect: keepsActiveBackground && previousUsesGameObject
            ? cleared.gameObjectEffect
            : null,
        backgroundGameObject: command.backgroundName
            ? command.backgroundGameObject === true
            : cleared.backgroundGameObject,
        backgroundGameObjectName: closesBackground
            ? ""
            : command.backgroundName
                ? command.backgroundGameObject
                    ? command.backgroundName
                    : ""
                : cleared.backgroundGameObjectName,
        backgroundEffectRevision: command.backgroundName
            ? cleared.backgroundEffectRevision + 1
            : cleared.backgroundEffectRevision,
        gameObjectEffect: command.backgroundName
            ? command.gameObjectEffect ?? null
            : cleared.gameObjectEffect,
        backgroundFilter: getStoryBackgroundFilter(cleared.backgroundFilter, command.backgroundFilter),
        backgroundOffsetX,
        backgroundOffsetY,
        backgroundScaleX,
        backgroundScaleY,
        backgroundTransitionMs: runsBackgroundAnimation
            ? backgroundAnimationTimeMs
            : cleared.backgroundAnimationNoWait && !runsBackgroundCrash
                ? cleared.backgroundTransitionMs
                : 0,
        // NKCUICutScenBGMgr.SetAni()는 0.01초 이하의 위치 이동만 목표 좌표로
        // 먼저 즉시 적용한다. 같은 명령의 배율 추적은 원래 시간을 유지한다.
        backgroundPositionTransitionMs: runsBackgroundAnimation
            ? command.backgroundAnimatePosition
                ? backgroundAnimationTimeMs <= 10
                    ? 0
                    : backgroundAnimationTimeMs
                : 0
            : cleared.backgroundAnimationNoWait && !runsBackgroundCrash
                ? cleared.backgroundPositionTransitionMs
                : 0,
        backgroundAnimationNoWait: runsBackgroundAnimation
            ? command.backgroundAnimationNoWait === true
            : runsBackgroundCrash
                ? false
                : cleared.backgroundAnimationNoWait,
        backgroundPositionEase: command.backgroundPositionTween ?? cleared.backgroundPositionEase,
        backgroundScaleEase: command.backgroundScaleTween ?? cleared.backgroundScaleEase,
        backgroundCrashStrength: runsBackgroundCrash
            ? backgroundCrashStrength
            : 0,
        backgroundCrashTimeMs: runsBackgroundCrash ? backgroundCrashTimeMs : 0,
        imageName: closesImage ? "" : imageName,
        imageUrl: closesImage
            ? ""
            : command.imageUrl ?? "",
        imageTransitionMs: imageName && imageName !== cleared.imageName ? 1000 / 3 : 0,
        imageScale: closesImage
            ? 1
            : Number(command.imageScale ?? 1),
        imageOffsetX: closesImage
            ? 0
            : vectorValue(command.imageOffset, 0, 0),
        imageOffsetY: closesImage
            ? 0
            : vectorValue(command.imageOffset, 1, 0),
        movieName: command.movieName ?? "",
        movieUrl: command.movieUrl ?? "",
        bgmName: actionMusic?.name ?? nextBgmName,
        bgmPath: actionMusic?.path ?? nextBgmPath,
        bgmVolume: 1,
        bgmStartTime: actionMusic?.startTime ?? 0,
        bgmRestart: changesBgm ? Boolean(actionMusic) : cleared.bgmRestart,
        bgmRevision: changesBgm ? cleared.bgmRevision + 1 : cleared.bgmRevision,
        pendingBgmName: command.endBgm ? command.endBgmName ?? "" : "",
        pendingBgmPath: command.endBgm ? command.endBgmPath ?? "" : "",
        dialogueText,
        dialogueGoalNormalText,
        dialogueGoalCenterText,
        dialogueBoxOpen,
        dialogueBoxType,
        dialogueNextNormalActive,
        dialogueNextCenterActive,
        dialogueCenterFadePrimed,
        dialogueOpening,
        dialogueOpeningTimeMs: dialogueOpening ? 1000 / 3 : 0,
        dialogueCentered,
        dialogueFadeIn: dialogueCenterFadeRuns,
        dialogueFadeOut: hasTalk && Boolean(command.talkCenterFadeOut),
        dialogueFadeTimeMs: hasTalk
            ? Math.max(Number(command.talkCenterFadeTime ?? 0) * 1000, 0)
            : 0,
        speakerId: hasTalk
            ? command.characterId ?? ""
            : keepsClosedTalkContents
                ? cleared.speakerId
                : "",
        speakerNameHasTempSpace: hasTalk
            ? speakerNameHasTempSpace
            : keepsClosedTalkContents
                ? cleared.speakerNameHasTempSpace
                : false,
        speakerNameTempFlag,
        titleText: clearsTitle ? "" : command.titleText ?? "",
        subtitleText: clearsTitle ? "" : command.subtitleText ?? "",
        titleFadeOut: Boolean(command.titleFadeOut),
        titleFadeOutTimeMs: Math.max(Number(command.titleFadeOutTime ?? 0) * 1000, 0),
        // 클라이언트의 Open 호출은 원본 Title/SubTitle 타자 시간을
        // 매개변수 순서와 반대로 넘긴다. 바이너리의 실제 동작을 그대로 따른다.
        titleTalkTimeMs: Math.max(Number(command.subtitleTalkTime ?? 0.15) * 1000, 0),
        subtitleTalkTimeMs: Math.max(Number(command.titleTalkTime ?? 0.15) * 1000, 0),
        actors,
        actorViewCache: actorResult.actorViewCache,
        shake: command.looseShake === true,
        shakeRevision: command.looseShake === true
            ? cleared.shakeRevision + 1
            : cleared.shakeRevision,
        // FlashBang은 m_bFading을 켜지 않는 비차단 FadeIn이다. 다음 명령이
        // 시작되어도 같은 전역 이미지의 애니메이션이 끝날 때까지 남는다.
        flash: runsFade ? false : runsFlash ? true : cleared.flash,
        flashTimeMs: runsFade
            ? 0
            : runsFlash
                ? flashTimeMs
                : cleared.flashTimeMs,
        flashRevision: runsFlash
            ? cleared.flashRevision + 1
            : cleared.flashRevision,
        fadeActive: runsFade,
        // NKCUIFadeInOut.FadeOut은 애니메이션이 끝나도 불투명 이미지를
        // 활성 상태로 유지한다. 다음 FadeIn 또는 FlashBang이 이를 걷어낸다.
        fadeCovered: runsFade
            ? command.fadeIn !== true
            : runsFlash
                ? false
                : cleared.fadeCovered,
        fadeIn: command.fadeIn === true,
        fadeWhite: runsFade
            ? command.fadeWhite === true
            : runsFlash
                ? true
                : cleared.fadeWhite,
        fadeTimeMs: runsFade ? fadeTimeMs : 0,
        fadeOpacity: runsFade
            ? command.fadeIn === true
                ? 0
                : 1
            : runsFlash
                ? 0
                : cleared.fadeOpacity,
        backgroundTintStart,
        backgroundTintEnd,
        backgroundTintTimeMs: runsBackgroundFadeIn
            ? backgroundFadeInTimeMs
            : 0,
        backgroundTintEase: backgroundTintEase ?? "",
        backgroundFadeOutTint: backgroundOpenRequested
            ? command.backgroundFadeOutColor ?? [1, 1, 1, 1]
            : cleared.backgroundFadeOutTint,
        backgroundFadeOutTimeMs: backgroundOpenRequested
            ? Math.max(Number(command.backgroundFadeOutTime ?? 0) * 1000, 0)
            : cleared.backgroundFadeOutTimeMs,
        backgroundFadeOutEase: backgroundOpenRequested
            ? command.backgroundFadeOutEase ?? ""
            : cleared.backgroundFadeOutEase,
        previousBackgroundTintStart: keepsPreviousBackground
            ? previousTintStart
            : [1, 1, 1, 1],
        previousBackgroundTintEnd: keepsPreviousBackground
            ? keepsSettledPreviousImage
                ? cleared.previousBackgroundTintEnd
                : cleared.backgroundFadeOutTint
            : [1, 1, 1, 0],
        previousBackgroundTintTimeMs: keepsPreviousBackground
            ? keepsSettledPreviousImage
                ? 0
                : cleared.backgroundFadeOutTimeMs
            : 0,
        previousBackgroundTintEase: keepsPreviousBackground
            ? keepsSettledPreviousImage
                ? cleared.previousBackgroundTintEase
                : cleared.backgroundFadeOutEase
            : "",
    };
}
export function getStoryChoices(commands: StoryCommand[], startIndex: number): StoryChoice[] {
    const choices: StoryChoice[] = [];
    // GetSelectionRoutes는 빈 문자열도 제거하지 않고 연속 SELECT를 모두
    // 반환하며, ProcessSelection이 실제 버튼 배열의 첫 3개만 등록한다.
    for (let index = startIndex; index < commands.length && index < startIndex + 3; index += 1) {
        const command = commands[index];
        if (command.action !== "SELECT") {
            break;
        }
        choices.push({
            text: command.talkText ?? "",
            actionKey: command.actionKey ?? "",
            commandIndex: index,
            selectionStartIndex: startIndex,
        });
    }
    return choices;
}
export function findStoryMarkIndex(commands: StoryCommand[], actionKey: string | undefined) {
    if (actionKey === undefined) {
        return -1;
    }
    return commands.findIndex((command) => command.action === "MARK" && command.actionKey === actionKey);
}
export function resolveStoryTextVariables(value: string, userNickname = "관리자") {
    return value.replace(/<usernickname>/giu, userNickname);
}
export function getVisibleTextLength(value: string) {
    // NKCTextChunk는 꺾쇠 안의 모든 문자열을 태그로 보지 않는다.
    // 실제 컷신에서 쓰는 color/b 계열과 웹 렌더러가 허용한 i/size만
    // 제외하고, `<신호 없음>` 같은 문구의 꺾쇠는 보이는 글자로 센다.
    return resolveStoryTextVariables(value).replace(/<\/?(?:color|size|b|i)(?:=[^>]+)?>/giu, "").length;
}
export function getStoryAutoPureTextLength(value: string) {
    // NKCUICutScenPlayer의 AUTO 추가 대기는 현재 TalkBox 렌더러가 아니라
    // 별도 NKCTextChunk.TextAnalyze(m_Talk)의 GetPureTextCount를 사용한다.
    // 이 구형 파서는 여는 color/b 태그와 모든 닫는 태그만 태그로 인식하며,
    // <usernickname> 치환도 이 계산 뒤에 일어나므로 원문 UTF-16 길이를 센다.
    return value.replace(/<(?:[cCbB][^>]*|\/[^>]*)>/gu, "").length;
}
export function applyStoryTalkLayoutBreaks(value: string, breaks: number[] | undefined) {
    if (!breaks?.length) {
        return value;
    }
    let result = value;
    for (const index of [...breaks].sort((left, right) => right - left)) {
        const safeIndex = Math.min(Math.max(Math.trunc(index), 0), result.length);
        result = `${result.slice(0, safeIndex)}\n${result.slice(safeIndex)}`;
    }
    return result;
}
export function shouldPlayStoryTitleTypingSound(value: string, visibleCharacterIndex: number) {
    const visibleText = resolveStoryTextVariables(value).replace(/<\/?(?:color|size|b|i)(?:=[^>]+)?>/giu, "");
    return visibleText[visibleCharacterIndex] !== " ";
}
export function getStoryAutoWaitDuration(command: StoryCommand, autoEnabledAtCommandStart: boolean) {
    if (!autoEnabledAtCommandStart || !command.talkText) {
        return 0;
    }
    const longTextDuration = Math.min(Math.max(getStoryAutoPureTextLength(command.talkText) - 10, 0) * 0.02, 3);
    return 1 + longTextDuration;
}
export function getStoryControlVisibility(command: StoryCommand | null, paused: boolean, logOpen: boolean) {
    if (paused || logOpen) {
        return {
            log: false,
            pause: false,
            auto: false,
            skip: false,
            restore: paused,
        };
    }
    // 클라이언트는 실제 파일을 찾았는지가 아니라 m_MovieName이 비어 있는지로
    // 영상 명령을 시작한다. 에셋이 빠진 영상도 Play 실패 콜백이 오기 전까지는
    // 일반 컷신 조작부가 아니라 영상용 SKIP 상태를 사용한다.
    if (command?.movieName) {
        return {
            log: false,
            pause: false,
            auto: false,
            skip: command.movieSkipEnable !== false,
            restore: false,
        };
    }
    return {
        log: true,
        pause: true,
        auto: true,
        skip: true,
        restore: false,
    };
}
export function getStoryTextVisibility(paused: boolean, logOpen: boolean) {
    // 실제 클라이언트는 눈 버튼(SetPause)과 LOG 화면 모두에서
    // 타이틀 글자와 현재 TalkBox GameObject를 숨긴다.
    return !paused && !logOpen;
}
export function getStoryTimerRemainingMs(durationMs: number, elapsedMs: number) {
    return Math.max((Number.isFinite(durationMs) ? durationMs : 0) -
        (Number.isFinite(elapsedMs) ? elapsedMs : 0), 0);
}
export function getStoryFxmEligiblePlayerDelays(playerDelays: number[], loop: boolean, elapsed: number, duration: number) {
    // 음수 지연은 직전 애니메이션 루프에서 시작해 현재 루프 경계를 넘어온
    // 효과만 뜻한다. 첫 루프나 비반복 재생에서 이를 사용하면 시작 전에
    // 실행되지 않은 효과가 화면에 나타난다.
    const includesPreviousLoop = loop && elapsed >= duration;
    return playerDelays.filter((delay) => delay >= 0 || includesPreviousLoop);
}
export function getStoryActorCrashStopDelayMs(command: StoryCommand, autoEnabled: boolean, autoWaitDurationMs: number) {
    // NKCUICutScenPlayer.Update는 수동 waitClick 컷에서 IsCutFinished 직후
    // StopCrash를 호출한다. 클릭 대기가 없는 수동 컷은 다음 컷까지
    // 유지하며, AUTO 컷은 원본 waitTime이 지난 뒤 추가 대기 구간에서 멈춘다.
    if (command.waitClick && !autoEnabled) {
        return 0;
    }
    if (autoEnabled && autoWaitDurationMs > 0) {
        return Math.max(Number(command.waitTime ?? 0), 0) * 1000;
    }
    return null;
}
export function doesStoryActorCrashOverrideMovement(actor: Pick<StoryActorState, "moving" | "movementMs" | "crashStrength">, crashStopped: boolean) {
    // NKCUICutScenUnitMgr.Update는 대상 슬롯의 UpdateUnitPos를 먼저 호출한 뒤
    // ManualUpdate의 UpdateUnitCrash가 같은 RectTransform.anchoredPosition을
    // 절대 좌표로 다시 쓴다. 따라서 Crash가 활성인 동안에는 이동 위치가
    // 화면에 더해지지 않고, Crash가 멈춘 다음에만 진행 중인 이동이 보인다.
    return Boolean(actor.moving &&
        actor.movementMs > 0 &&
        actor.crashStrength > 0 &&
        !crashStopped);
}
export function shouldShowStoryNextIndicator(dialogueBoxOpen: boolean, dialogueNextActive: boolean, isTyping: boolean) {
    // ClearTalk/Close/선택지 액션은 m_goTalkNext 자식의 활성 상태를 바꾸지
    // 않는다. 열린 현재 매니저의 자식 상태와 타자 출력 여부만 사용한다.
    return dialogueBoxOpen && dialogueNextActive && !isTyping;
}
export function getStoryNextIndicatorVariant(dialogueBoxType: StoryVisualState["dialogueBoxType"]): "japan-needs" | "center" {
    // ChangeTalkBoxMgrType은 실제 대사가 있는 명령에서만 호출된다.
    // 따라서 현재 명령의 중앙 페이드 플래그가 아니라, 실제로 활성화된
    // 대사창 매니저 종류를 기준으로 아이콘을 골라야 한다.
    return dialogueBoxType === "center" ? "center" : "japan-needs";
}
export function getStoryWheelAction(deltaY: number, logButtonVisible: boolean): "log" | "advance" | "none" {
    // Unity PointerEventData.scrollDelta.y와 브라우저 WheelEvent.deltaY의
    // 부호는 반대다. 인게임은 휠을 위로 올리면 LOG, 아래로 내리면
    // 화면 클릭과 같은 진행 동작을 실행한다.
    if (deltaY < 0) {
        return logButtonVisible ? "log" : "none";
    }
    if (deltaY > 0) {
        return "advance";
    }
    return "none";
}
export function getStoryLogNormalizedPosition(visualPosition: number, scrollHeight: number, clientHeight: number, totalCount: number) {
    if (totalCount <= 0) {
        return 0.5;
    }
    const scrollRange = Math.max(scrollHeight - clientHeight, 0);
    if (scrollRange === 0) {
        // LoopScrollRect expands a short Content bound to the viewport. With one
        // or more items its strict estimatedMax > view.max branch is 0 at rest,
        // then 1 only while the visual content is overscrolled toward the end.
        return visualPosition > 0 ? 1 : 0;
    }
    return visualPosition / scrollRange;
}
export function getStoryLogWheelAction(deltaY: number, normalizedPositionBefore: number, normalizedPositionAfter: number): "close" | "none" {
    // PointerEventData.scrollDelta.y와 WheelEvent.deltaY의 부호는 반대다.
    // LogViewer는 목록 끝에서 아래로 더 내렸고, 스크롤 전후 위치가 모두
    // 끝에 고정된 경우에만 닫힌다.
    return deltaY > 0 &&
        normalizedPositionBefore >= 0.999 &&
        normalizedPositionAfter >= 1
        ? "close"
        : "none";
}
export function getStoryLogCanvasScale(referenceWidth: number, referenceHeight: number) {
    const scale = Math.min(referenceWidth / 1920, referenceHeight / 1080);
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
}
export function getStoryLogHotkeyScrollFrame(scrollTop: number, rubber: number, maximumScrollTop: number, direction: -1 | 1, speed: number, canvasScale: number, deltaTime: number) {
    const currentVisualPosition = scrollTop - rubber;
    const desiredScrollTop = currentVisualPosition + direction * speed * canvasScale * deltaTime;
    const clampedScrollTop = Math.min(maximumScrollTop, Math.max(0, desiredScrollTop));
    // LoopScrollRect.MovePosition leaves Elastic overshoot raw. The browser's
    // native scrollTop holds the in-bounds part while the translated content
    // preserves the same temporary visual position for LateUpdate to restore.
    return {
        scrollTop: clampedScrollTop,
        rubber: clampedScrollTop - desiredScrollTop,
    };
}
export function getStoryLogScrollRubberDelta(overStretching: number, viewSize: number) {
    if (viewSize <= 0 || overStretching === 0) {
        return 0;
    }
    return ((1 - 1 / ((Math.abs(overStretching) * 0.55) / viewSize + 1)) *
        viewSize *
        Math.sign(overStretching));
}
export function getStoryLogPointerDragFrame(startVisualPosition: number, pointerDeltaY: number, maximumScrollTop: number, viewportSize: number, scrollSensitivity = 1, rubberScale = 1) {
    const desiredScrollTop = startVisualPosition - pointerDeltaY * scrollSensitivity;
    const clampedScrollTop = Math.min(maximumScrollTop, Math.max(0, desiredScrollTop));
    let rubber = 0;
    if (desiredScrollTop < 0) {
        rubber =
            getStoryLogScrollRubberDelta(-desiredScrollTop, viewportSize) *
                rubberScale;
    }
    else if (desiredScrollTop > maximumScrollTop) {
        rubber =
            -getStoryLogScrollRubberDelta(desiredScrollTop - maximumScrollTop, viewportSize) * rubberScale;
    }
    return {
        desiredScrollTop,
        scrollTop: clampedScrollTop,
        rubber,
        visualPosition: clampedScrollTop - rubber,
    };
}
export function getStoryLogWheelScrollFrame(scrollTop: number, rubber: number, maximumScrollTop: number, viewportSize: number, deltaX: number, deltaY: number, isPixelDelta: boolean, canvasScale: number, pixelTick: number, wheelMultiplier: number, wheelRubberScale: number) {
    // LoopScrollRect.OnScroll reverses Y first, then substitutes the dominant X
    // axis for a vertical-only view. Browser WheelEvent already has the opposite
    // Y sign, so both browser deltas map directly to increasing scrollTop here.
    const usesHorizontalDelta = Math.abs(deltaX) > Math.abs(deltaY);
    const dominantDelta = usesHorizontalDelta ? deltaX : deltaY;
    const safePixelTick = Math.abs(pixelTick) > 0 ? pixelTick : 1;
    const unityScrollDelta = isPixelDelta
        ? dominantDelta / safePixelTick
        : dominantDelta;
    const wheelDelta = unityScrollDelta * wheelMultiplier * canvasScale;
    const currentVisualPosition = scrollTop - rubber;
    const desiredScrollTop = currentVisualPosition + wheelDelta;
    const clampedScrollTop = Math.min(maximumScrollTop, Math.max(0, desiredScrollTop));
    let nextRubber = 0;
    if (desiredScrollTop < 0) {
        nextRubber =
            getStoryLogScrollRubberDelta(-desiredScrollTop, viewportSize) *
                wheelRubberScale;
    }
    else if (desiredScrollTop > maximumScrollTop) {
        nextRubber =
            -getStoryLogScrollRubberDelta(desiredScrollTop - maximumScrollTop, viewportSize) * wheelRubberScale;
    }
    return {
        axis: usesHorizontalDelta
            ? ("horizontal-dominant" as const)
            : ("vertical-dominant" as const),
        dominantDelta,
        unityScrollDelta,
        wheelDelta,
        desiredScrollTop,
        scrollTop: clampedScrollTop,
        rubber: nextRubber,
        visualPosition: clampedScrollTop - nextRubber,
    };
}
export function getStoryLogInertiaScrollFrame(scrollTop: number, velocity: number, maximumScrollTop: number, deltaTime: number, decelerationRate: number, minimumVelocity: number) {
    let nextVelocity = velocity * Math.pow(decelerationRate, Math.max(deltaTime, 0));
    if (Math.abs(nextVelocity) < Math.max(minimumVelocity, 0)) {
        nextVelocity = 0;
    }
    const desiredScrollTop = scrollTop + nextVelocity * Math.max(deltaTime, 0);
    const clampedScrollTop = Math.min(maximumScrollTop, Math.max(0, desiredScrollTop));
    // Elastic LateUpdate writes the first inertia boundary crossing raw. The
    // following frame sees this offset and enters SmoothDamp.
    return {
        velocity: nextVelocity,
        desiredScrollTop,
        scrollTop: clampedScrollTop,
        rubber: clampedScrollTop - desiredScrollTop,
    };
}
export function smoothStoryLogScrollRubber(current: number, currentVelocity: number, deltaTime: number, elasticity: number) {
    const safeSmoothTime = Math.max(0.0001, elasticity);
    const omega = 2 / safeSmoothTime;
    const x = omega * deltaTime;
    const exponential = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const temporary = (currentVelocity + omega * current) * deltaTime;
    let velocity = (currentVelocity - omega * temporary) * exponential;
    let value = (current + temporary) * exponential;
    // Mathf.SmoothDamp snaps a step that would cross its original zero target.
    if ((-current > 0) === (value > 0)) {
        value = 0;
        velocity = 0;
    }
    return { value, velocity };
}
export function appendStoryLogText(previousText: string, appendedText: string) {
    // NKCUICutScenPlayer.AddLog는 TalkAppend를 대사창 본문과 달리
    // 이전 로그 뒤에 공백 하나를 넣어 합친다.
    return `${previousText} ${appendedText}`;
}
export function shouldFadePreviousStoryTitle(previous: StoryVisualState, nextCommand: StoryCommand) {
    return Boolean((previous.titleText || previous.subtitleText) &&
        previous.titleFadeOut &&
        previous.titleFadeOutTimeMs > 0 &&
        !doesStoryCommandClearTitle(nextCommand));
}
export function getStoryClickAction(command: StoryCommand, cutFinished: boolean, forceWaitClick = false) {
    const hasTalkOrTitle = Boolean(command.talkText || command.titleText || command.subtitleText);
    const waitClick = command.waitClick || forceWaitClick;
    if (!waitClick && hasTalkOrTitle) {
        return "ignore" as const;
    }
    if (!cutFinished) {
        return waitClick
            ? ("finish" as const)
            : ("finish-and-advance" as const);
    }
    return "advance" as const;
}
export function getStoryMovieSurfaceClickAction(command: StoryCommand, moviePlaying: boolean, forceWaitClick = false) {
    if (!command.movieName || !moviePlaying) {
        return "normal" as const;
    }
    // NKCUICutScenPlayer.OnClickedPlayer는 영상 재생 중 상단 SKIP 버튼과
    // 다른 규칙을 사용한다. waitClick이 꺼진 영상은 즉시 다음 컷으로
    // 진행하고, 켜진 영상은 다른 컷신 연출만 끝낸 뒤 영상은 계속 재생한다.
    return command.waitClick || forceWaitClick
        ? ("finish" as const)
        : ("advance" as const);
}
export function addStoryLoopFxInstance<T>(registry: Map<string, Set<T>>, name: string, instance: T) {
    const instances = registry.get(name) ?? new Set<T>();
    instances.add(instance);
    registry.set(name, instances);
    return instances.size;
}
export function takeStoryLoopFxInstances<T>(registry: Map<string, Set<T>>, name: string) {
    const instances = [...(registry.get(name) ?? [])];
    registry.delete(name);
    return instances;
}
export function applyStoryReservedMusic(state: StoryVisualState) {
    // PlayReservedSoundNMusic는 이름이 있을 때만 예약 BGM을 적용한다.
    // 수동 waitClick에서는 다음 명령이 아니라 현재 컷의 연출 완료 시점에
    // 이 함수가 호출되므로 pending 값을 즉시 현재 음악으로 옮긴다.
    if (!state.pendingBgmName) {
        return state;
    }
    return {
        ...state,
        bgmName: state.pendingBgmName,
        bgmPath: state.pendingBgmPath,
        bgmVolume: 1,
        bgmStartTime: 0,
        bgmRestart: false,
        bgmRevision: state.bgmRevision + 1,
        pendingBgmName: "",
        pendingBgmPath: "",
    };
}
export function getStoryNaturalEndTransientFx(event: StoryFxEvent | null) {
    // ApplyNextCut은 마지막 컷 다음에도 예약 효과음을 먼저 실행한 뒤
    // StopPure로 플레이어를 닫는다. CloseInternal은 등록된 반복음만
    // 정지하므로, 화면이 닫힌 뒤 실제로 남는 것은 경로가 있는 일회성
    // 효과음뿐이다. ESC와 SKIP은 ApplyNextCut 없이 StopPure로 직행한다.
    if (!event ||
        event.action !== "play" ||
        event.loop ||
        !event.path) {
        return null;
    }
    return event;
}
export function getLastStoryMusicPath(commands: StoryCommand[], currentIndex: number, pendingBgmPath = "") {
    let finalBgmPath = pendingBgmPath;
    const currentCommand = commands[currentIndex];
    let nextCutIndex = currentIndex + 1;
    // 일반 명령은 ApplyNextCut 끝에서 m_NextCutIndex가 증가하지만 SELECT와
    // JUMP는 ProcessCutsceneAction에서 조기 반환한다. StopPure가 호출하는
    // PlayLastMusicNotPlayed는 이 실제 m_NextCutIndex를 한 번 더 증가시킨 뒤
    // 남은 음악을 훑으므로 액션마다 시작 위치가 다르다.
    if (currentCommand?.action === "SELECT") {
        nextCutIndex = currentIndex;
    }
    else if (currentCommand?.action === "JUMP") {
        const markIndex = findStoryMarkIndex(commands, currentCommand.actionKey ?? "");
        nextCutIndex = markIndex >= 0 ? markIndex : currentIndex;
    }
    for (let index = Math.min(nextCutIndex + 1, commands.length); index < commands.length; index += 1) {
        const command = commands[index];
        if (command.bgmPath) {
            finalBgmPath = command.bgmPath;
        }
        if (command.endBgmPath) {
            finalBgmPath = command.endBgmPath;
        }
        if (command.action === "PLAY_MUSIC" && command.actionMusicPath) {
            finalBgmPath = command.actionMusicPath;
        }
    }
    return finalBgmPath;
}
export function getStoryCommandBlockingDuration(command: StoryCommand, centerFadeRuns = Boolean(command.talkCenterFadeIn), characterFadeRuns = doesStoryCharacterFadeRunByCommand(command), characterMovementRuns = doesStoryCharacterMovementRunByCommand(command), backgroundFadeRuns = doesStoryBackgroundFadeRunByCommand(command)) {
    // NKCUICutScenPlayer는 필드 이름과 반대로 m_fTitleTalkTime을
    // Open의 부제 cool time에, m_fSubTitleTalkTime을 제목 cool time에 넘긴다.
    const titleDuration = (getVisibleTextLength(command.titleText ?? "") *
        getStoryStartedTypewriterStepDurationMs(Number(command.subtitleTalkTime ?? 0.15) * 1000)) /
        1000;
    const subtitleDuration = (getVisibleTextLength(command.subtitleText ?? "") *
        getStoryStartedTypewriterStepDurationMs(Number(command.titleTalkTime ?? 0.15) * 1000)) /
        1000;
    const talkDuration = ((command.talkLayoutTypewriterCharacters ??
        getVisibleTextLength(command.talkText ?? "")) *
        getStoryTypewriterStepDurationMs(Math.max(Number(command.talkTime ?? 0), 0) * 1000)) /
        1000;
    const centerTalkDuration = (centerFadeRuns && talkDuration > 0
        ? 0.1 + Math.max(Number(command.talkCenterFadeTime ?? 0), 0)
        : 0) + talkDuration;
    // NKCUICutScenPlayer는 FadeTime에만 m_bFading을 설정한다.
    // FlashBang은 같은 이미지를 쓰지만 IsCutFinished를 막지 않는다.
    const fadeDuration = Math.max(Number(command.fadeTime ?? 0), 0);
    const backgroundEffectDuration = Number(command.backgroundCrash ?? 0) > 0 &&
        Number(command.backgroundCrashTime ?? 0) > 0
        ? Number(command.backgroundCrashTime)
        : command.backgroundAnimationNoWait
            ? 0
            : Number(command.backgroundAnimationTime ?? 0);
    return Math.max(fadeDuration, backgroundEffectDuration, backgroundFadeRuns ? Number(command.backgroundFadeInTime ?? 0) : 0, titleDuration + subtitleDuration, centerTalkDuration, getCharacterCommandBlockingDuration(command, characterFadeRuns, characterMovementRuns));
}
export function shouldWaitForStoryVoice(isAuto: boolean, voicePath: string | undefined, voicePlaybackEnded: boolean) {
    return isAuto && Boolean(voicePath) && !voicePlaybackEnded;
}
