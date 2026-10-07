"use client";
import { deploymentUrl } from "@/lib/deployment";
import Image from "@/components/DeploymentImage";
import Link from "@/components/DeploymentLink";
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type HTMLAttributes, type PointerEvent as ReactPointerEvent, type ReactNode, } from "react";
import type { MatchTenConfig, MatchTenReward } from "@/lib/matchTen";
import { createMatchTenSfxPlayer, getMatchTenAudioVolume, } from "@/lib/matchTenAudio";
import { createMatchTenPreviewBoard, createPlayableMatchTenBoard, getMatchTenBoardLocalPoint, getMatchTenBoundsSum, getMatchTenCellBounds, getMatchTenPointerBounds, getMatchTenSelectableSlotIndices, hasMatchTenMove, resolveMatchTenSelection, type MatchTenBoardCell, type MatchTenPoint, } from "@/lib/matchTenBoard";
import { getMatchTenRemainingCentiseconds, isMatchTenTimerExpired, } from "@/lib/matchTenClock";
import { EMPTY_MATCH_TEN_RECORD, MATCH_TEN_RECORD_STORAGE_KEY, loadMatchTenRecord, saveMatchTenResult, type MatchTenRecord, } from "@/lib/matchTenRecord";
import { MATCH_TEN_CLIENT_SOURCE, MATCH_TEN_CLIENT_TIMING, getMatchTenClientRect, } from "@/lib/matchTenClientLayout";
import MatchTenClearBurst from "./MatchTenClearBurst";
import MatchTenSlicedImage from "./MatchTenSlicedImage";
import MatchTenNewRecordParticles from "./MatchTenNewRecordParticles";
import styles from "./MatchTenGame.module.css";
type GamePhase = "intro" | "lobby" | "transition" | "countdown" | "playing" | "reroll" | "result" | "returning";
type PopupKind = "rule" | "reward" | null;
type ReturningFrom = "countdown" | "playing" | "result" | null;
type MatchTenResult = {
    score: number;
    timeLeft: number;
    sequence: number;
    scoreIsNewRecord: boolean;
    timeIsNewRecord: boolean;
};
type DragSelection = {
    pointerId: number;
    start: MatchTenPoint;
    end: MatchTenPoint;
};
const EXACT_ROOT = deploymentUrl("/game-assets/match-ten/client-exact");
const AUDIO_ROOT = deploymentUrl("/game-assets/match-ten/audio");
const MATCHTEN = "UI_SINGLE_MATCHTEN/MATCHTEN";
const HOME = MATCHTEN + "/Content";
const LOBBY = HOME + "/01";
const GAME_PAGE = HOME + "/02";
const GAME = GAME_PAGE + "/UI_SINGLE_MATCHTEN_INGAME";
const GAME_TOP = GAME + "/Top";
const GAME_CENTER = GAME + "/Center";
const INTRO = "UI_SINGLE_MATCHTEN/INTRO";
const RESULT = "UI_SINGLE_POPUP_MATCHTEN_RESULT";
const REWARD = "UI_SINGLE_POPUP_MATCHTEN_REWARD";
const RULE = "UI_SINGLE_POPUP_MATCHTEN_RULE";
const sprite = (name: string) => EXACT_ROOT + "/sprite/" + name + ".png";
const texture = (name: string) => EXACT_ROOT + "/texture/" + name + ".png";
const tinted = (name: string) => EXACT_ROOT + "/tinted/" + name + ".png";
const localized = (name: string) => EXACT_ROOT + "/localized/" + name + ".png";
const SPRITE_BORDER = {
    buttonWide: [70, 0, 70, 0] as const,
    slot: [23, 22, 23, 22] as const,
    selection: [19, 19, 19, 19] as const,
};
const EMPTY_SELECTED_IDS = new Set<number>();
type IntroCurveKey = readonly [
    timeSeconds: number,
    value: number
];
const INTRO_ACTIVE_TIMING = {
    rootOn: 0.016666668,
    cut01On: 0.16666667,
    cut02On: 0.71666664,
    cut03On: 0.71666664,
    cut04On: 1.3333334,
    cut04Off: 2.6666667,
    cut05On: 2.6666667,
    matchTenOn: 3.5,
} as const;
const INTRO_SOUND_TIMING = {
    tada2OnMs: 300.00001192092896,
    tada2OffMs: 733.3333492279053,
    fireOnMs: 1333.3333730697632,
    fireOffMs: 2666.6667461395264,
    tadaOnMs: 2833.3332538604736,
    tadaOffMs: MATCH_TEN_CLIENT_TIMING.introClipMs,
} as const;
const COUNTDOWN_SOUND_OFF_MS = [
    1916.6666269302368,
    2916.6667461395264,
    4333.333492279053,
] as const;
const GAME_PAGE_OFF_MS = MATCH_TEN_CLIENT_TIMING.lobbyTransitionMs / 2;
const COUNTDOWN_CURVES = {
    iconAlpha: [
        [0, 0],
        [0.8333333, 0],
        [1, 1],
        [1.75, 1],
        [1.9833333, 0],
        [2, 1],
        [2.8333333, 1],
        [2.9833333, 0],
        [3, 1],
        [3.8333333, 1],
        [4, 0],
        [4.8333335, 0],
    ],
    iconScale: [
        [0, 2.4],
        [0.8333333, 2.4],
        [1.9166666, 2],
        [1.9833333, 2],
        [2, 2.4],
        [2.9833333, 2],
        [3, 2.4],
        [4, 2],
        [4.8333335, 2],
    ],
    blindAlpha: [
        [0, 1],
        [4.3333335, 1],
        [4.8333335, 0],
    ],
} as const satisfies Record<string, readonly IntroCurveKey[]>;
/*
 * UI_SINGLE_MATCHTEN_INTRO.anim uses zero in/out tangents on every changing
 * scalar segment. Unity therefore evaluates each segment as cubic Hermite
 * smoothstep. Active/enabled tracks are handled separately as stepped keys.
 */
const INTRO_CURVES = {
    backgroundAlpha: [
        [0, 0],
        [0.083333336, 1],
    ],
    cut01Alpha: [
        [0, 0],
        [0.21666667, 0],
        [0.3, 1],
        [0.71666664, 1],
        [1, 0],
    ],
    cut01X: [
        [0, 0],
        [0.71666664, 0],
        [1.1666666, -1422.2],
    ],
    cut01Scale: [
        [0, 1],
        [0.25, 1.4],
        [0.33333334, 1],
        [4.4166665, 1],
    ],
    cut02Alpha: [
        [0, 0],
        [0.6666667, 0],
        [1, 1],
        [1.3333334, 1],
        [1.5, 0],
    ],
    cut02Y: [
        [0, 220],
        [0.6666667, 220],
        [0.9166667, -133],
    ],
    cut03Alpha: [
        [0, 0],
        [0.8333333, 0],
        [1.0833334, 1],
        [1.3333334, 1],
        [1.5, 0],
    ],
    cut03Y: [
        [0, 280],
        [0.8333333, 280],
        [1.0833334, -1.4053],
    ],
    cut04Alpha: [
        [0, 0],
        [1.5, 0],
        [1.6666666, 1],
        [2.5, 1],
        [2.6666667, 0],
    ],
    cut04Width: [
        [0, 181.8445],
        [1.6666666, 181.8445],
        [2, 1530],
    ],
    cut04ArtY: [
        [1.5, -233],
        [1.6, -176.4],
        [1.6833333, -233],
        [1.7833333, -176.4],
        [1.8833333, -233],
        [1.9833333, -176.4],
        [2.0666666, -233],
        [2.1666667, -176.4],
        [2.2833333, -233],
        [2.3833334, -176.4],
        [2.4666667, -233],
        [2.5666666, -176.4],
        [2.6666667, -233],
        [2.7666667, -176.4],
        [2.85, -233],
        [4.4166665, -233],
    ],
    cut05Alpha: [
        [0, 0],
        [2.6666667, 0],
        [3, 1],
    ],
    cut05Scale: [
        [0, 1],
        [2.5833333, 2],
        [3, 1],
        [4.4166665, 1],
    ],
    cut05ArtOneX: [
        [0, 1121.5],
        [3.6833334, 1121.5],
        [4.1833334, 1438.7],
    ],
    cut05ArtOneY: [
        [0, 507],
        [3.6833334, 507],
        [4.1833334, 491.6],
    ],
    cut05ArtOneScale: [
        [0, 0.9],
        [3.6833334, 0.9],
        [4.1833334, 0.8],
    ],
    cut05ArtOneRotation: [
        [0, 0],
        [3.6833334, 0],
        [4.1833334, -5.6],
        [4.4166665, -5.6],
    ],
    cut05ArtTwoX: [
        [0, 686],
        [3.6833334, 686],
        [4.1833334, 454],
    ],
    cut05ArtTwoY: [
        [0, 418],
        [3.6833334, 418],
        [4.1833334, 422.4],
    ],
    cut05ArtTwoScale: [
        [0, 1.04],
        [3.6833334, 1.04],
        [4.1833334, 1],
    ],
    cut05ArtTwoRotation: [
        [0, -5.74],
        [3.6833334, -5.74],
        [4.1833334, 0],
        [4.4166665, 0],
    ],
    rootAlpha: [
        [0, 1],
        [3.9333334, 1],
        [4.4166665, 0],
    ],
    lobbyTitleAlpha: [
        [0, 1],
        [4.1, 0],
        [4.25, 1],
        [4.4166665, 1],
    ],
    lobbyTitleScale: [
        [0, 1],
        [4.0833335, 1.6],
        [4.1833334, 0.9],
        [4.25, 1],
        [4.4166665, 1],
    ],
    lobbyStartAlpha: [
        [0, 1],
        [4.1666665, 0],
        [4.3333335, 1],
    ],
    lobbyMenuAlpha: [
        [0, 0],
        [4.1666665, 0],
        [4.4166665, 1],
    ],
} as const satisfies Record<string, readonly IntroCurveKey[]>;
function sampleIntroCurve(keys: readonly IntroCurveKey[], elapsedMilliseconds: number) {
    const time = elapsedMilliseconds / 1000;
    if (time <= keys[0][0])
        return keys[0][1];
    for (let index = 1; index < keys.length; index += 1) {
        const right = keys[index];
        if (time > right[0])
            continue;
        const left = keys[index - 1];
        const progress = (time - left[0]) / (right[0] - left[0]);
        const hermite = progress * progress * (3 - 2 * progress);
        return left[1] + (right[1] - left[1]) * hermite;
    }
    return keys[keys.length - 1][1];
}
function cssNumber(value: number, precision = 5) {
    const rounded = Number(value.toFixed(precision));
    return Object.is(rounded, -0) ? "0" : String(rounded);
}
function designPixels(value: number) {
    return cssNumber(value) + "px";
}
function anchoredValue(percent: number, pixels: number) {
    if (Math.abs(percent) < 0.000001)
        return designPixels(pixels);
    const percentText = cssNumber(percent, 4) + "%";
    if (Math.abs(pixels) < 0.000001)
        return percentText;
    return pixels < 0
        ? "calc(" + percentText + " - " + designPixels(-pixels) + ")"
        : "calc(" + percentText + " + " + designPixels(pixels) + ")";
}
function quaternionZDegrees(rotation: readonly [
    number,
    number,
    number,
    number
]) {
    const [x, y, z, w] = rotation;
    return ((Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z)) * 180) /
        Math.PI);
}
const CLIENT_RECT_STYLE_CACHE = new Map<string, CSSProperties>();
/** Converts a serialized Unity RectTransform into its parent-relative CSS. */
function clientRectStyle(sourcePath: string): CSSProperties {
    const cached = CLIENT_RECT_STYLE_CACHE.get(sourcePath);
    if (cached)
        return cached;
    const rect = getMatchTenClientRect(sourcePath);
    const widthPercent = (rect.anchorMax[0] - rect.anchorMin[0]) * 100;
    const heightPercent = (rect.anchorMax[1] - rect.anchorMin[1]) * 100;
    const leftPixels = rect.anchoredPosition[0] - rect.pivot[0] * rect.sizeDelta[0];
    const bottomPixels = rect.anchoredPosition[1] - rect.pivot[1] * rect.sizeDelta[1];
    const angle = quaternionZDegrees(rect.localRotation);
    const style: CSSProperties = {
        position: "absolute",
        left: anchoredValue(rect.anchorMin[0] * 100, leftPixels),
        bottom: anchoredValue(rect.anchorMin[1] * 100, bottomPixels),
        width: anchoredValue(widthPercent, rect.sizeDelta[0]),
        height: anchoredValue(heightPercent, rect.sizeDelta[1]),
        transformOrigin: cssNumber(rect.pivot[0] * 100, 4) +
            "% " +
            cssNumber((1 - rect.pivot[1]) * 100, 4) +
            "%",
        transform: "rotate(" +
            cssNumber(-angle) +
            "deg) scale(" +
            cssNumber(rect.localScale[0]) +
            ", " +
            cssNumber(rect.localScale[1]) +
            ")",
    };
    CLIENT_RECT_STYLE_CACHE.set(sourcePath, style);
    return style;
}
type AnimatedClientRect = {
    anchoredPosition?: readonly [
        number,
        number
    ];
    sizeDelta?: readonly [
        number,
        number
    ];
    localScale?: readonly [
        number,
        number
    ];
    rotationZ?: number;
};
/** Applies AnimationClip RectTransform values without changing prefab anchors. */
function animatedClientRectStyle(sourcePath: string, animated: AnimatedClientRect): CSSProperties {
    const rect = getMatchTenClientRect(sourcePath);
    const anchoredPosition = animated.anchoredPosition ?? rect.anchoredPosition;
    const sizeDelta = animated.sizeDelta ?? rect.sizeDelta;
    const localScale = animated.localScale ?? [rect.localScale[0], rect.localScale[1]];
    const widthPercent = (rect.anchorMax[0] - rect.anchorMin[0]) * 100;
    const heightPercent = (rect.anchorMax[1] - rect.anchorMin[1]) * 100;
    const leftPixels = anchoredPosition[0] - rect.pivot[0] * sizeDelta[0];
    const bottomPixels = anchoredPosition[1] - rect.pivot[1] * sizeDelta[1];
    const rotationZ = animated.rotationZ ?? quaternionZDegrees(rect.localRotation);
    return {
        position: "absolute",
        left: anchoredValue(rect.anchorMin[0] * 100, leftPixels),
        bottom: anchoredValue(rect.anchorMin[1] * 100, bottomPixels),
        width: anchoredValue(widthPercent, sizeDelta[0]),
        height: anchoredValue(heightPercent, sizeDelta[1]),
        transformOrigin: cssNumber(rect.pivot[0] * 100, 4) +
            "% " +
            cssNumber((1 - rect.pivot[1]) * 100, 4) +
            "%",
        transform: "rotate(" +
            cssNumber(-rotationZ) +
            "deg) scale(" +
            cssNumber(localScale[0]) +
            ", " +
            cssNumber(localScale[1]) +
            ")",
    };
}
function FillImage({ src, alt = "", priority = false, objectFit = "fill", className, style, }: {
    src: string;
    alt?: string;
    priority?: boolean;
    objectFit?: "fill" | "contain" | "cover";
    className?: string;
    style?: CSSProperties;
}) {
    return (<Image src={deploymentUrl(src)} alt={alt} fill sizes="100vw" priority={priority} draggable={false} className={className} style={{ objectFit, ...style }}/>);
}
function IntroMaskedCut({ base, style, artSource, artStyle, }: {
    base: string;
    style: CSSProperties;
    artSource: string;
    artStyle?: CSSProperties;
}) {
    return (<ClientFrame path={base} className={styles.introCutFrame} style={style} data-intro-cut={base.slice(base.lastIndexOf("/") + 1)}>
      <SlicedFill src={deploymentUrl(tinted("UI_EVENT_MD_DOT_30PX_INTRO_DARK"))} border={[30, 30, 30, 30]} className={styles.slicedBackground}/>
      <ClientFrame path={base + "/1"} className={styles.introCutInner}>
        <SlicedFill src={deploymentUrl("/game-assets/match-ten/client-common/UI_EVENT_MD_DOT_30PX.png")} border={[30, 30, 30, 30]} asMask>
          <SlicedFill src={deploymentUrl(tinted("UI_EVENT_MD_DOT_30PX_INTRO_LIGHT"))} border={[30, 30, 30, 30]} className={styles.slicedBackground}/>
          <ClientSprite path={base + "/1/2"} src={deploymentUrl(artSource)} style={artStyle} priority/>
        </SlicedFill>
      </ClientFrame>
    </ClientFrame>);
}
function IntroSequence({ elapsed }: {
    elapsed: number;
}) {
    const value = (curve: readonly IntroCurveKey[]) => sampleIntroCurve(curve, elapsed);
    const seconds = elapsed / 1000;
    const cut01 = INTRO + "/Bg/Cut01";
    const cut02 = INTRO + "/Bg/Cut02";
    const cut03 = INTRO + "/Bg/Cut03";
    const cut04 = INTRO + "/Bg/Cut04";
    const cut05 = INTRO + "/Bg/Cut05";
    const cut01Scale = value(INTRO_CURVES.cut01Scale);
    const cut05Scale = value(INTRO_CURVES.cut05Scale);
    const cut05ArtOneScale = value(INTRO_CURVES.cut05ArtOneScale);
    const cut05ArtTwoScale = value(INTRO_CURVES.cut05ArtTwoScale);
    if (seconds < INTRO_ACTIVE_TIMING.rootOn)
        return null;
    return (<ClientFrame path={INTRO} className={styles.introRoot} style={{ opacity: value(INTRO_CURVES.rootAlpha) }} data-match-ten-intro data-intro-elapsed-ms={elapsed.toFixed(3)} aria-hidden="true">
      <ClientFrame path={INTRO + "/Bg"}>
        <FillImage src={deploymentUrl(texture("UI_SINGLE_MATCHTEN_BG_01"))} priority style={{ opacity: value(INTRO_CURVES.backgroundAlpha) }}/>

        {seconds >= INTRO_ACTIVE_TIMING.cut01On ? (<IntroMaskedCut base={cut01} artSource={texture("UI_SINGLE_MATCHTEN_DECO_01")} style={{
                ...animatedClientRectStyle(cut01, {
                    anchoredPosition: [value(INTRO_CURVES.cut01X), 0],
                    localScale: [cut01Scale, cut01Scale],
                }),
                opacity: value(INTRO_CURVES.cut01Alpha),
            }}/>) : null}

        {seconds >= INTRO_ACTIVE_TIMING.cut02On ? (<IntroMaskedCut base={cut02} artSource={texture("UI_SINGLE_MATCHTEN_DECO_01")} style={{
                ...animatedClientRectStyle(cut02, {
                    anchoredPosition: [
                        -350.7804870605469,
                        value(INTRO_CURVES.cut02Y),
                    ],
                }),
                opacity: value(INTRO_CURVES.cut02Alpha),
            }}/>) : null}

        {seconds >= INTRO_ACTIVE_TIMING.cut03On ? (<IntroMaskedCut base={cut03} artSource={texture("UI_SINGLE_MATCHTEN_DECO_01")} style={{
                ...animatedClientRectStyle(cut03, {
                    anchoredPosition: [404, value(INTRO_CURVES.cut03Y)],
                }),
                opacity: value(INTRO_CURVES.cut03Alpha),
            }}/>) : null}

        {seconds >= INTRO_ACTIVE_TIMING.cut04On &&
            seconds < INTRO_ACTIVE_TIMING.cut04Off ? (<IntroMaskedCut base={cut04} artSource={texture("UI_SINGLE_MATCHTEN_DECO_03")} artStyle={animatedClientRectStyle(cut04 + "/1/2", {
                anchoredPosition: [-110, value(INTRO_CURVES.cut04ArtY)],
            })} style={{
                ...animatedClientRectStyle(cut04, {
                    sizeDelta: [value(INTRO_CURVES.cut04Width), 492.7240905761719],
                }),
                opacity: value(INTRO_CURVES.cut04Alpha),
            }}/>) : null}

        {seconds >= INTRO_ACTIVE_TIMING.cut05On ? (<ClientFrame path={cut05} className={styles.introCutFive} style={{
                ...animatedClientRectStyle(cut05, {
                    localScale: [cut05Scale, cut05Scale],
                }),
                opacity: value(INTRO_CURVES.cut05Alpha),
            }} data-intro-cut="Cut05">
            <ClientSprite path={cut05 + "/1"} src={deploymentUrl(texture("UI_SINGLE_MATCHTEN_DECO_03"))} style={animatedClientRectStyle(cut05 + "/1", {
                anchoredPosition: [
                    value(INTRO_CURVES.cut05ArtOneX),
                    value(INTRO_CURVES.cut05ArtOneY),
                ],
                localScale: [cut05ArtOneScale, cut05ArtOneScale],
                rotationZ: value(INTRO_CURVES.cut05ArtOneRotation),
            })} priority/>
            <ClientSprite path={cut05 + "/2"} src={deploymentUrl(texture("UI_SINGLE_MATCHTEN_DECO_01"))} style={animatedClientRectStyle(cut05 + "/2", {
                anchoredPosition: [
                    value(INTRO_CURVES.cut05ArtTwoX),
                    value(INTRO_CURVES.cut05ArtTwoY),
                ],
                localScale: [cut05ArtTwoScale, cut05ArtTwoScale],
                rotationZ: value(INTRO_CURVES.cut05ArtTwoRotation),
            })} priority/>
          </ClientFrame>) : null}
      </ClientFrame>
    </ClientFrame>);
}
function SlicedFill({ src, border, className, maskColor, asMask, children, }: {
    src: string;
    border: readonly [
        number,
        number,
        number,
        number
    ];
    className?: string;
    maskColor?: string;
    asMask?: boolean;
    children?: ReactNode;
}) {
    return (<MatchTenSlicedImage src={deploymentUrl(src)} border={border} maskColor={maskColor} asMask={asMask} className={className ? styles.slicedFill + " " + className : styles.slicedFill}>
      {children}
    </MatchTenSlicedImage>);
}
function ClientFrame({ path, className, style, children, ...attributes }: {
    path: string;
    className?: string;
    style?: CSSProperties;
    children?: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, "children" | "className" | "style">) {
    return (<div className={className ? styles.clientRect + " " + className : styles.clientRect} style={{ ...clientRectStyle(path), ...style }} data-client-path={path} {...attributes}>
      {children}
    </div>);
}
function ClientSprite({ path, src, alt = "", className, imageClassName, priority, objectFit, style, }: {
    path: string;
    src: string;
    alt?: string;
    className?: string;
    imageClassName?: string;
    priority?: boolean;
    objectFit?: "fill" | "contain" | "cover";
    style?: CSSProperties;
}) {
    return (<ClientFrame path={path} className={className} style={style}>
      <FillImage src={deploymentUrl(src)} alt={alt} className={imageClassName} priority={priority} objectFit={objectFit}/>
    </ClientFrame>);
}
function formatTime(centiseconds: number) {
    return (Math.max(0, centiseconds) / 100).toFixed(2);
}
function countdownNumber(elapsed: number) {
    if (elapsed < 2000)
        return 3;
    if (elapsed < 3000)
        return 2;
    return 1;
}
function CloseButton({ base, onClick, href, label, }: {
    base: string;
    onClick?: () => void;
    href?: string;
    label: string;
}) {
    const contents = (<>
      <ClientSprite path={base + "/Img"} src={deploymentUrl(sprite("UI_SINGLE_MATCHTEN_BTN_01"))}/>
      <ClientSprite path={base + "/Icon"} src={deploymentUrl(sprite("UI_SINGLE_MATCHTEN_ICON_CLOSE"))}/>
    </>);
    const className = styles.clientButton;
    if (href) {
        return (<Link href={href} className={className} style={clientRectStyle(base)} data-client-path={base} aria-label={label}>
        {contents}
      </Link>);
    }
    return (<button type="button" className={className} style={clientRectStyle(base)} data-client-path={base} aria-label={label} onClick={onClick}>
      {contents}
    </button>);
}
function LobbyPage({ motion, introElapsed = 0, bestRecord, onStart, onRule, onReward, }: {
    motion: "intro" | "idle" | "leaving" | "entering";
    introElapsed?: number;
    bestRecord: MatchTenRecord;
    onStart: () => void;
    onRule: () => void;
    onReward: () => void;
}) {
    const introTitleScale = sampleIntroCurve(INTRO_CURVES.lobbyTitleScale, introElapsed);
    const introTitleStyle = motion === "intro"
        ? {
            ...animatedClientRectStyle(LOBBY + "/Title", {
                localScale: [introTitleScale, introTitleScale],
            }),
            opacity: sampleIntroCurve(INTRO_CURVES.lobbyTitleAlpha, introElapsed),
        }
        : undefined;
    const introMenuStyle = motion === "intro"
        ? {
            opacity: sampleIntroCurve(INTRO_CURVES.lobbyMenuAlpha, introElapsed),
        }
        : undefined;
    const introStartStyle = motion === "intro"
        ? {
            ...clientRectStyle(LOBBY + "/BTN_START"),
            opacity: sampleIntroCurve(INTRO_CURVES.lobbyStartAlpha, introElapsed),
        }
        : clientRectStyle(LOBBY + "/BTN_START");
    return (<ClientFrame path={LOBBY} className={motion === "leaving"
            ? styles.lobbyTransitionOut
            : motion === "entering"
                ? styles.lobbyTransitionIn
                : styles.lobbyPage} data-testid="match-ten-lobby">
      <ClientFrame path={LOBBY + "/Bg"}>
        <ClientSprite path={LOBBY + "/Bg/cut01"} src={deploymentUrl(texture("UI_SINGLE_MATCHTEN_CUT_01"))} priority/>
        <ClientSprite path={LOBBY + "/Bg/cut02"} src={deploymentUrl(texture("UI_SINGLE_MATCHTEN_CUT_02"))} priority/>
        <ClientSprite path={LOBBY + "/Bg/cut03"} src={deploymentUrl(texture("UI_SINGLE_MATCHTEN_CUT_03"))} priority/>
        <ClientSprite path={LOBBY + "/Bg/cut04"} src={deploymentUrl(texture("UI_SINGLE_MATCHTEN_CUT_04"))} priority/>
        <ClientSprite path={LOBBY + "/Bg/cut05"} src={deploymentUrl(texture("UI_SINGLE_MATCHTEN_DECO_01"))} className={styles.lobbyDecoOne} priority/>
        <ClientSprite path={LOBBY + "/Bg/cut06"} src={deploymentUrl(texture("UI_SINGLE_MATCHTEN_DECO_02"))} className={styles.lobbyDecoTwo} priority/>
      </ClientFrame>

      <ClientSprite path={LOBBY + "/Title"} src={deploymentUrl(localized("UI_SINGLE_MATCHTEN_TITLE"))} style={introTitleStyle} priority/>

      <ClientFrame path={LOBBY + "/BTN"} style={introMenuStyle}>
        <ClientFrame path={LOBBY + "/BTN/RECORD"} className={styles.recordPanel}>
          <ClientFrame path={LOBBY + "/BTN/RECORD/shadow"} className={styles.recordShadow}>
            <SlicedFill src={deploymentUrl(tinted("UI_EVENT_MD_DOT_20PX_RECORD_SHADOW"))} border={[18, 18, 18, 18]}/>
          </ClientFrame>
          <ClientFrame path={LOBBY + "/BTN/RECORD/Bg"} className={styles.recordBackground}>
            <SlicedFill src={deploymentUrl(tinted("UI_EVENT_MD_DOT_20PX_RECORD_BG"))} border={[18, 18, 18, 18]}/>
            <ClientFrame path={LOBBY + "/BTN/RECORD/Bg/Bg02"} className={styles.recordInset}>
              <SlicedFill src={deploymentUrl(sprite("UI_SINGLE_MATCHTEN_SLOT_BG_01"))} border={SPRITE_BORDER.slot}/>
            </ClientFrame>
            <ClientSprite path={LOBBY + "/BTN/RECORD/Bg/Title"} src={deploymentUrl(localized("UI_SINGLE_MATCHTEN_SCORE"))}/>
          </ClientFrame>
          <ClientFrame path={LOBBY + "/BTN/RECORD/LINE"} className={styles.recordLine}/>
          <ClientFrame path={LOBBY + "/BTN/RECORD/SCORE"} className={styles.recordValue}>
            <ClientFrame path={LOBBY + "/BTN/RECORD/SCORE/NUM_TEXT"} className={styles.recordNumber} data-testid="match-ten-best-score">
              {bestRecord.bestScore}
            </ClientFrame>
            <ClientSprite path={LOBBY + "/BTN/RECORD/SCORE/Icon"} src={deploymentUrl(tinted("UI_SINGLE_MATCHTEN_ICON_SCORE_LOBBY"))}/>
          </ClientFrame>
          <ClientFrame path={LOBBY + "/BTN/RECORD/TIME"} className={styles.recordValue}>
            <ClientFrame path={LOBBY + "/BTN/RECORD/TIME/NUM_TEXT"} className={styles.recordNumber} data-testid="match-ten-best-time">
              {formatTime(bestRecord.bestTimeLeft)}
            </ClientFrame>
            <ClientSprite path={LOBBY + "/BTN/RECORD/TIME/Icon"} src={deploymentUrl(tinted("UI_SINGLE_MATCHTEN_ICON_TIME_LOBBY"))}/>
          </ClientFrame>
        </ClientFrame>

        <button type="button" className={styles.clientButton} style={clientRectStyle(LOBBY + "/BTN/BTN_REWARD")} data-client-path={LOBBY + "/BTN/BTN_REWARD"} data-testid="match-ten-reward-button" onClick={onReward}>
          <ClientFrame path={LOBBY + "/BTN/BTN_REWARD/Bg"}>
            <SlicedFill src={deploymentUrl(sprite("UI_SINGLE_MATCHTEN_BTN_02"))} border={SPRITE_BORDER.buttonWide}/>
          </ClientFrame>
          <ClientFrame path={LOBBY + "/BTN/BTN_REWARD/Text"} className={styles.menuText}>
            점수 보상
          </ClientFrame>
        </button>

        <button type="button" className={styles.clientButton} style={clientRectStyle(LOBBY + "/BTN/BTN_RULE")} data-client-path={LOBBY + "/BTN/BTN_RULE"} data-testid="match-ten-rule-button" onClick={onRule}>
          <ClientFrame path={LOBBY + "/BTN/BTN_RULE/Bg"}>
            <SlicedFill src={deploymentUrl(sprite("UI_SINGLE_MATCHTEN_BTN_02"))} border={SPRITE_BORDER.buttonWide}/>
          </ClientFrame>
          <ClientFrame path={LOBBY + "/BTN/BTN_RULE/Text"} className={styles.menuText}>
            규칙
          </ClientFrame>
        </button>

        <CloseButton base={LOBBY + "/BTN/BTN_CLOSE"} href={deploymentUrl("/minigames/")} label="미니게임 목록으로 돌아가기"/>
      </ClientFrame>

      <button type="button" className={styles.clientButton} style={introStartStyle} data-client-path={LOBBY + "/BTN_START"} data-testid="match-ten-start" onClick={onStart}>
        <ClientSprite path={LOBBY + "/BTN_START/IMG"} src={deploymentUrl(localized("UI_SINGLE_MATCHTEN_START"))} className={styles.startButtonImage} objectFit="contain"/>
        <ClientSprite path={LOBBY + "/BTN_START/IMG/IMG (1)"} src={deploymentUrl(sprite("UI_SINGLE_MATCHTEN_ICON_ARROW"))} className={styles.startArrowOne}/>
        <ClientSprite path={LOBBY + "/BTN_START/IMG/IMG (2)"} src={deploymentUrl(sprite("UI_SINGLE_MATCHTEN_ICON_ARROW"))} className={styles.startArrowTwo}/>
      </button>
    </ClientFrame>);
}
const GameTimeDisplay = memo(function GameTimeDisplay({ timeLeft, }: {
    timeLeft: number;
}) {
    return (<ClientFrame path={GAME_TOP + "/Time"}>
      <ClientFrame path={GAME_TOP + "/Time/Title"} className={styles.statTitle}>
        <ClientSprite path={GAME_TOP + "/Time/Title/Icon"} src={deploymentUrl(tinted("UI_SINGLE_MATCHTEN_ICON_TIME_HUD"))}/>
        <span>남은 시간</span>
      </ClientFrame>
      <ClientFrame path={GAME_TOP + "/Time/NUM"} className={timeLeft < 1000
            ? styles.statNumber + " " + styles.timeWarning
            : styles.statNumber}>
        {formatTime(timeLeft)}
      </ClientFrame>
    </ClientFrame>);
}, () => true);
const GameTop = memo(function GameTop({ score, timeLeft, onBack, }: {
    score: number;
    timeLeft: number;
    onBack: () => void;
}) {
    return (<ClientFrame path={GAME_TOP}>
      <ClientSprite path={GAME_TOP + "/Bg"} src={deploymentUrl(texture("UI_SINGLE_MATCHTEN_SCORE_BG_02"))}/>
      <ClientSprite path={GAME_TOP + "/Deco01"} src={deploymentUrl(texture("UI_SINGLE_MATCHTEN_DECO_01"))}/>
      <ClientSprite path={GAME_TOP + "/Deco02"} src={deploymentUrl(texture("UI_SINGLE_MATCHTEN_DECO_03"))}/>
      <button type="button" className={styles.clientButton} style={clientRectStyle(GAME_TOP + "/BTN_BACK")} data-client-path={GAME_TOP + "/BTN_BACK"} aria-label="게임 종료" onClick={onBack}>
        <ClientSprite path={GAME_TOP + "/BTN_BACK/IMG"} src={deploymentUrl(sprite("UI_SINGLE_MATCHTEN_BTN_01"))}/>
      <ClientSprite path={GAME_TOP + "/BTN_BACK/Icon"} src={deploymentUrl(sprite("UI_SINGLE_MATCHTEN_ICON_BACK"))}/>
      </button>
      <ClientFrame path={GAME_TOP + "/Score"}>
        <ClientFrame path={GAME_TOP + "/Score/Title"} className={styles.statTitle}>
          <ClientSprite path={GAME_TOP + "/Score/Title/Icon"} src={deploymentUrl(tinted("UI_SINGLE_MATCHTEN_ICON_SCORE_HUD"))}/>
          <span>점수</span>
        </ClientFrame>
        <ClientFrame path={GAME_TOP + "/Score/NUM"} className={styles.statNumber}>
          {score}
        </ClientFrame>
      </ClientFrame>
      <GameTimeDisplay timeLeft={timeLeft}/>
    </ClientFrame>);
});
function BoardCell({ cell, visualCell, selected, clearing, inactive, }: {
    cell: MatchTenBoardCell;
    visualCell: MatchTenBoardCell;
    selected: boolean;
    clearing: boolean;
    inactive: boolean;
}) {
    if (inactive) {
        return <div className={styles.cell + " " + styles.inactiveCell}/>;
    }
    return (<div className={styles.cell} data-cell-index={cell.id} data-cell-value={cell.value}>
      <div className={clearing
            ? styles.cellCanvas + " " + styles.cellClearing
            : cell.removed
                ? styles.cellCanvas + " " + styles.cellRemoved
                : styles.cellCanvas}>
        {clearing ? <MatchTenClearBurst /> : null}
        <div className={styles.cellNormal}>
          <div className={styles.snackImage}>
            <FillImage src={deploymentUrl(sprite("UI_SINGLE_MATCHTEN_PANTRY_" +
            String(visualCell.snack).padStart(2, "0")))}/>
          </div>
          <div className={styles.numberImage}>
            <FillImage src={deploymentUrl(sprite("UI_SINGLE_MATCHTEN_NUM_" +
            String(Math.max(1, visualCell.value)).padStart(2, "0")))}/>
          </div>
        </div>
        <div className={selected && !cell.removed
            ? styles.selectedCell
            : styles.selectedCell + " " + styles.selectedCellHidden}>
          <SlicedFill src={deploymentUrl(tinted("UI_EVENT_MD_MISSION_LINE_2_SELECTED"))} border={[20, 20, 20, 20]}/>
        </div>
      </div>
    </div>);
}
const MemoBoardCell = memo(BoardCell, (previous, next) => previous.cell.id === next.cell.id &&
    previous.cell.value === next.cell.value &&
    previous.cell.removed === next.cell.removed &&
    previous.visualCell.value === next.visualCell.value &&
    previous.visualCell.snack === next.visualCell.snack &&
    previous.selected === next.selected &&
    previous.clearing === next.clearing &&
    previous.inactive === next.inactive);
function GameBoard({ board, clearingCells, inactiveIds, selectedIds, boardRef, selection, }: {
    board: MatchTenBoardCell[];
    clearingCells: Map<number, MatchTenBoardCell>;
    inactiveIds: Set<number>;
    selectedIds: Set<number>;
    boardRef: React.RefObject<HTMLDivElement | null>;
    selection: DragSelection | null;
}) {
    const bounds = selection
        ? getMatchTenPointerBounds(selection.start, selection.end)
        : null;
    return (<>
      <ClientFrame path={GAME_CENTER + "/Bg"} className={styles.boardBackdrop}>
        <SlicedFill src={deploymentUrl(tinted("UI_EVENT_MD_DOT_30PX_BOARD"))} border={[30, 30, 30, 30]} className={styles.slicedBackground}/>
      </ClientFrame>
      <div ref={boardRef} className={styles.board} style={clientRectStyle(GAME_CENTER + "/BOARD")} data-client-path={GAME_CENTER + "/BOARD"} data-testid="match-ten-board">
        {board.map((cell) => {
            const clearing = clearingCells.get(cell.id);
            return (<MemoBoardCell key={cell.id} cell={cell} visualCell={clearing ?? cell} selected={selectedIds.has(cell.id)} clearing={Boolean(clearing)} inactive={inactiveIds.has(cell.id)}/>);
        })}
        {bounds ? (<div className={styles.selectionBox} data-testid="match-ten-selection" style={{
                left: bounds.left,
                top: bounds.top,
                width: bounds.right - bounds.left,
                height: bounds.bottom - bounds.top,
            }}>
            <SlicedFill src={deploymentUrl(sprite("UI_SINGLE_MATCHTEN_OUTLINE"))} border={SPRITE_BORDER.selection}/>
          </div>) : null}
      </div>
    </>);
}
const MemoGameBoard = memo(GameBoard);
function Countdown({ elapsed }: {
    elapsed: number;
}) {
    const alpha = sampleIntroCurve(COUNTDOWN_CURVES.iconAlpha, elapsed);
    const scale = sampleIntroCurve(COUNTDOWN_CURVES.iconScale, elapsed);
    const number = countdownNumber(elapsed);
    const blindAlpha = sampleIntroCurve(COUNTDOWN_CURVES.blindAlpha, elapsed);
    return (<ClientFrame path={GAME_CENTER + "/COUNTDOWN"} className={styles.countdown} data-testid="match-ten-countdown">
      <ClientFrame path={GAME_CENTER + "/COUNTDOWN/Blind"} className={styles.countdownBlind} style={{ opacity: blindAlpha }}>
        <SlicedFill src={deploymentUrl(tinted("UI_EVENT_MD_DOT_30PX_BOARD"))} border={[30, 30, 30, 30]} className={styles.slicedBackground}/>
      </ClientFrame>
      <ClientFrame path={GAME_CENTER + "/COUNTDOWN/Icon"} className={styles.countdownIcon} style={{
            opacity: alpha,
            transform: "scale(" + cssNumber(scale) + ")",
        }}>
        <FillImage src={deploymentUrl(sprite("UI_SINGLE_MATCHTEN_NUM_" + String(number).padStart(2, "0")))}/>
      </ClientFrame>
    </ClientFrame>);
}
function RerollOverlay({ onReroll }: {
    onReroll: () => void;
}) {
    const base = GAME_CENTER + "/REROLL";
    return (<ClientFrame path={base} className={styles.rerollOverlay} data-testid="match-ten-reroll">
      <ClientFrame path={base + "/RaycastArea"} className={styles.rerollShade}/>
      <ClientFrame path={base + "/InfoBox"} className={styles.rerollInfo}>
        <SlicedFill src={deploymentUrl(sprite("UI_SINGLE_MATCHTEN_SLOT_BG_02"))} border={SPRITE_BORDER.slot}/>
        <ClientFrame path={base + "/InfoBox/Bg"} className={styles.rerollInfoTint}>
          <SlicedFill src={deploymentUrl(tinted("UI_EVENT_MD_DOT_20PX_REROLL_INFO"))} border={[18, 18, 18, 18]} className={styles.slicedBackground}/>
        </ClientFrame>
        <ClientFrame path={base + "/InfoBox/Text_1"} className={styles.rerollTextOne}>
          조합 가능한 숫자가 없습니다.
        </ClientFrame>
        <ClientFrame path={base + "/InfoBox/Text_2"} className={styles.rerollTextTwo}>
          새로고침 버튼을 눌러주세요.
        </ClientFrame>
        <button type="button" className={styles.clientButton} style={clientRectStyle(base + "/InfoBox/BTN_REROLL")} data-client-path={base + "/InfoBox/BTN_REROLL"} data-testid="match-ten-reroll-button" onClick={onReroll}>
          <ClientFrame path={base + "/InfoBox/BTN_REROLL/IMG"}>
            <SlicedFill src={deploymentUrl(sprite("UI_SINGLE_MATCHTEN_BTN_03"))} border={SPRITE_BORDER.buttonWide}/>
          </ClientFrame>
          <ClientFrame path={base + "/InfoBox/BTN_REROLL/Text"} className={styles.rerollButtonText}>
            새로고침
          </ClientFrame>
        </button>
      </ClientFrame>
    </ClientFrame>);
}
function GameScene({ phase, returningFrom, score, timeLeft, board, clearingCells, inactiveIds, selectedIds, selection, countdownElapsed, boardRef, onBack, onReroll, pointerHandlers, }: {
    phase: GamePhase;
    returningFrom: ReturningFrom;
    score: number;
    timeLeft: number;
    board: MatchTenBoardCell[];
    clearingCells: Map<number, MatchTenBoardCell>;
    inactiveIds: Set<number>;
    selectedIds: Set<number>;
    selection: DragSelection | null;
    countdownElapsed: number;
    boardRef: React.RefObject<HTMLDivElement | null>;
    onBack: () => void;
    onReroll: () => void;
    pointerHandlers: {
        onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
        onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
        onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
        onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
        onLostPointerCapture: (event: ReactPointerEvent<HTMLDivElement>) => void;
    };
}) {
    return (<ClientFrame path={GAME_PAGE} className={phase === "transition"
            ? styles.gameTransitionIn
            : phase === "returning"
                ? styles.gameTransitionOut
                : styles.gamePage} data-testid="match-ten-game">
      <div className={styles.gameInputRoot} style={clientRectStyle(GAME)} data-client-path={GAME} {...pointerHandlers}>
        <GameTop score={score} timeLeft={timeLeft} onBack={onBack}/>
        <ClientFrame path={GAME_CENTER}>
          <MemoGameBoard board={board} clearingCells={clearingCells} inactiveIds={inactiveIds} selectedIds={selectedIds} boardRef={boardRef} selection={selection}/>
          {phase === "countdown" ||
            (phase === "returning" && returningFrom === "countdown") ? (<Countdown elapsed={countdownElapsed}/>) : null}
          {phase === "reroll" ? <RerollOverlay onReroll={onReroll}/> : null}
        </ClientFrame>
      </div>
    </ClientFrame>);
}
function ResultPopup({ result, midScore, highScore, onClose, onRestart, }: {
    result: MatchTenResult;
    midScore: number;
    highScore: number;
    onClose: () => void;
    onRestart: () => void;
}) {
    const resultNumber = result.score >= highScore ? 3 : result.score >= midScore ? 2 : 1;
    const scoreIsNewRecord = result.scoreIsNewRecord;
    const timeIsNewRecord = result.timeIsNewRecord;
    const renderNewRecord = (base: string) => (<div className={styles.newRecord} data-client-path={base + "/NEW_RECORD"}>
      <ClientFrame path={base + "/NEW_RECORD/TEXT"} className={styles.newRecordText}>
        NEW RECORD
        <MatchTenNewRecordParticles clientPath={base + "/NEW_RECORD/TEXT/UI_PTC_FLOW_RECT"} useSerializedSeed={result.sequence === 0}/>
        <ClientSprite path={base + "/NEW_RECORD/TEXT/Flare 1"} src={deploymentUrl(tinted("MATCHTEN_NEW_RECORD_FLARE1"))} className={styles.newRecordAdditive}/>
        <ClientSprite path={base + "/NEW_RECORD/TEXT/Flare 2"} src={deploymentUrl(tinted("MATCHTEN_NEW_RECORD_FLARE2"))} className={styles.newRecordAdditive}/>
        <ClientSprite path={base + "/NEW_RECORD/TEXT/Glow"} src={deploymentUrl(tinted("MATCHTEN_NEW_RECORD_GLOW"))} className={styles.newRecordAdditive}/>
      </ClientFrame>
    </div>);
    return (<div className={styles.popupRoot} data-result-sequence={result.sequence} data-new-score-record={scoreIsNewRecord} data-new-time-record={timeIsNewRecord} data-testid="match-ten-result">
      <ClientFrame path={RESULT + "/Shadow"} className={styles.resultShadow}/>
      <ClientSprite path={RESULT + "/Bg"} src={deploymentUrl(texture("UI_SINGLE_MATCHTEN_BG_03"))}/>
      <ClientFrame path={RESULT + "/Contents"}>
        <ClientSprite path={RESULT + "/Contents/IMG_root"} src={deploymentUrl(texture("UI_SINGLE_MATCHTEN_RESULT_" + String(resultNumber).padStart(2, "0")))} className={styles.resultCharacter}/>
        <ClientSprite path={RESULT + "/Contents/Title"} src={deploymentUrl(localized("UI_SINGLE_MATCHTEN_RESULT"))} objectFit="contain"/>
        <ClientSprite path={RESULT + "/Contents/Bg"} src={deploymentUrl(texture("UI_SINGLE_MATCHTEN_SCORE_BG_02"))}/>
        <ClientFrame path={RESULT + "/Contents/INFO"} className={styles.resultInfo} style={{ width: "max-content", transform: "translateX(-50%)" }} aria-label="클라이언트 계정 정보 영역">
          <SlicedFill src={deploymentUrl(tinted("UI_EVENT_MD_DOT_30PX_RESULT_INFO"))} border={[30, 30, 30, 30]} className={styles.slicedBackground}/>
          <span className={styles.resultUserName} data-client-path={RESULT + "/Contents/INFO/USER_NAME"}/>
          <span className={styles.resultUserUid} data-client-path={RESULT + "/Contents/INFO/UID"}/>
        </ClientFrame>
        <ClientFrame path={RESULT + "/Contents/SCORE"}>
          <ClientFrame path={RESULT + "/Contents/SCORE/Title"} className={styles.resultStatTitle} style={{ width: "max-content", transform: "translateX(-50%)" }}>
            <ClientSprite path={RESULT + "/Contents/SCORE/Title/Icon"} src={deploymentUrl(tinted("UI_SINGLE_MATCHTEN_ICON_SCORE_HUD"))}/>
            <span>점수</span>
          </ClientFrame>
          <ClientFrame path={RESULT + "/Contents/SCORE/Layoutgroup"} className={styles.resultNumberLayout}>
            <span className={styles.resultNumber + " " + styles.resultScoreNumber} data-client-path={RESULT + "/Contents/SCORE/Layoutgroup/NUM_TEXT"}>
              {result.score}
            </span>
            {scoreIsNewRecord
            ? renderNewRecord(RESULT + "/Contents/SCORE/Layoutgroup")
            : null}
          </ClientFrame>
        </ClientFrame>
        <ClientFrame path={RESULT + "/Contents/TIME"}>
          <ClientFrame path={RESULT + "/Contents/TIME/Title"} className={styles.resultStatTitle} style={{
            left: "calc(50% + 48.599998px)",
            width: "max-content",
            transform: "translateX(-50%)",
        }}>
            <ClientSprite path={RESULT + "/Contents/TIME/Title/Icon"} src={deploymentUrl(tinted("UI_SINGLE_MATCHTEN_ICON_TIME_HUD"))}/>
            <span>남은 시간</span>
          </ClientFrame>
          <ClientFrame path={RESULT + "/Contents/TIME/Layoutgroup"} className={styles.resultNumberLayout}>
            <span className={styles.resultNumber + " " + styles.resultTimeNumber} data-client-path={RESULT + "/Contents/TIME/Layoutgroup/NUM_TEXT"}>
              {formatTime(result.timeLeft)}
            </span>
            {timeIsNewRecord
            ? renderNewRecord(RESULT + "/Contents/TIME/Layoutgroup")
            : null}
          </ClientFrame>
        </ClientFrame>
        <button type="button" className={styles.clientButton} style={clientRectStyle(RESULT + "/Contents/BTN_Close")} data-client-path={RESULT + "/Contents/BTN_Close"} data-testid="match-ten-result-close" onClick={onClose}>
          <ClientFrame path={RESULT + "/Contents/BTN_Close/Bg"}>
            <SlicedFill src={deploymentUrl(sprite("UI_SINGLE_MATCHTEN_BTN_02"))} border={SPRITE_BORDER.buttonWide}/>
          </ClientFrame>
          <ClientFrame path={RESULT + "/Contents/BTN_Close/Text"} className={styles.resultButtonText}>
            종료
          </ClientFrame>
        </button>
        <button type="button" className={styles.clientButton} style={clientRectStyle(RESULT + "/Contents/BTN_Restart")} data-client-path={RESULT + "/Contents/BTN_Restart"} data-testid="match-ten-restart" onClick={onRestart}>
          <ClientFrame path={RESULT + "/Contents/BTN_Restart/Bg"}>
            <SlicedFill src={deploymentUrl(sprite("UI_SINGLE_MATCHTEN_BTN_03"))} border={SPRITE_BORDER.buttonWide}/>
          </ClientFrame>
          <ClientSprite path={RESULT + "/Contents/BTN_Restart/Icon"} src={deploymentUrl(sprite("UI_SINGLE_MATCHTEN_ICON_RESTART"))}/>
          <ClientFrame path={RESULT + "/Contents/BTN_Restart/Text"} className={styles.resultButtonText}>
            재도전
          </ClientFrame>
        </button>
      </ClientFrame>
    </div>);
}
function RulePopup({ config, onClose, }: {
    config: MatchTenConfig;
    onClose: () => void;
}) {
    const lines = config.ruleText.split("\n");
    const renderBoldLine = (line: string) => line.split(/(<b>.*?<\/b>)/gi).map((part, index) => /^<b>.*<\/b>$/i.test(part) ? (<strong className={styles.ruleBold} key={index}>
          {part.slice(3, -4)}
        </strong>) : (part.replace(/<[^>]+>/g, "")));
    return (<div className={styles.popupRoot} data-testid="match-ten-rule">
      <ClientFrame path={RULE + "/Bg"} className={styles.ruleShade}/>
      <ClientSprite path={RULE + "/BG"} src={deploymentUrl(texture("UI_SINGLE_MATCHTEN_BG_03"))}/>
      <ClientFrame path={RULE + "/CONTENT"}>
        <ClientSprite path={RULE + "/CONTENT/Title"} src={deploymentUrl(localized("UI_SINGLE_MATCHTEN_RULE"))} objectFit="contain"/>
        <ClientFrame path={RULE + "/CONTENT/DESC_ScrollRect"} className={styles.ruleScroll}>
          <ClientFrame path={RULE + "/CONTENT/DESC_ScrollRect/Bg"} className={styles.ruleBackground}>
            <SlicedFill src={deploymentUrl(tinted("UI_EVENT_MD_DOT_20PX_RULE_DESC"))} border={[18, 18, 18, 18]} className={styles.slicedBackground}/>
          </ClientFrame>
          <ClientFrame path={RULE + "/CONTENT/DESC_ScrollRect/Viewport"} className={styles.ruleViewport}>
            <ClientFrame path={RULE + "/CONTENT/DESC_ScrollRect/Viewport/Content"} className={styles.ruleContent}>
              <p className={styles.ruleText}>
                <strong className={styles.ruleHeading}>
                  {lines[0].replace(/<[^>]+>/g, "")}
                </strong>
                {lines.slice(1).map((line, index) => (<Fragment key={index}>
                    {"\n"}
                    {renderBoldLine(line)}
                  </Fragment>))}
              </p>
            </ClientFrame>
          </ClientFrame>
        </ClientFrame>
        <CloseButton base={RULE + "/CONTENT/BTN_CLOSE"} onClick={onClose} label="규칙 닫기"/>
      </ClientFrame>
    </div>);
}
function RewardSlot({ reward }: {
    reward: MatchTenReward;
}) {
    return (<div className={styles.rewardSlot}>
      <SlicedFill src={deploymentUrl(sprite("UI_SINGLE_MATCHTEN_SLOT_BG_01"))} border={SPRITE_BORDER.slot}/>
      <span className={styles.rewardDescription}>
        점수 [{reward.score}] 점 달성
      </span>
    </div>);
}
function RewardPopup({ config, bestRecord, onClose, }: {
    config: MatchTenConfig;
    bestRecord: MatchTenRecord;
    onClose: () => void;
}) {
    return (<div className={styles.popupRoot + " " + styles.rewardPopup} data-testid="match-ten-reward" onClick={onClose}>
      <ClientFrame path={REWARD + "/Shadow"} className={styles.rewardShade}/>
      <ClientSprite path={REWARD + "/Bg"} src={deploymentUrl(texture("UI_SINGLE_MATCHTEN_BG_03"))}/>
      <ClientFrame path={REWARD + "/Panel"} onClick={(event) => event.stopPropagation()}>
        <ClientSprite path={REWARD + "/Panel/Deco"} src={deploymentUrl(texture("UI_SINGLE_MATCHTEN_REWARD_DECO"))}/>
        <ClientSprite path={REWARD + "/Panel/Deco_01"} src={deploymentUrl(sprite("UI_SINGLE_MATCHTEN_DECO_01"))} className={styles.rewardDecoOne}/>
        <ClientSprite path={REWARD + "/Panel/Deco_01 (1)"} src={deploymentUrl(sprite("UI_SINGLE_MATCHTEN_DECO_01"))} className={styles.rewardDecoTwo}/>
        <ClientSprite path={REWARD + "/Panel/Deco_01 (2)"} src={deploymentUrl(sprite("UI_SINGLE_MATCHTEN_DECO_01"))} className={styles.rewardDecoThree}/>
        <ClientSprite path={REWARD + "/Panel/Title"} src={deploymentUrl(localized("UI_SINGLE_MATCHTEN_REWARD"))} objectFit="contain"/>
        <ClientFrame path={REWARD + "/Panel/Content"}>
          <ClientFrame path={REWARD + "/Panel/Content/SCORE"}>
            <ClientFrame path={REWARD + "/Panel/Content/SCORE/TitleBG"} className={styles.rewardScoreBackground}>
              <SlicedFill src={deploymentUrl(tinted("UI_EVENT_MD_DOT_20PX_REWARD_SCORE"))} border={[18, 18, 18, 18]}/>
            </ClientFrame>
            <ClientSprite path={REWARD + "/Panel/Content/SCORE/Score"} src={deploymentUrl(localized("UI_SINGLE_MATCHTEN_BEST"))}/>
            <ClientFrame path={REWARD + "/Panel/Content/SCORE/SCORE_TEXT"} className={styles.rewardScore} data-testid="match-ten-reward-best-score">
              {bestRecord.bestScore}
            </ClientFrame>
          </ClientFrame>
          <ClientFrame path={REWARD + "/Panel/Content/SLOT_ScrollRect"} className={styles.rewardScroll}>
            <ClientFrame path={REWARD + "/Panel/Content/SLOT_ScrollRect/Bg"} className={styles.rewardScrollBackground}>
              <SlicedFill src={deploymentUrl(tinted("UI_EVENT_MD_DOT_20PX_REWARD_SCROLL"))} border={[18, 18, 18, 18]} className={styles.slicedBackground}/>
            </ClientFrame>
            <ClientFrame path={REWARD + "/Panel/Content/SLOT_ScrollRect/Viewport"} className={styles.rewardViewport}>
              <div className={styles.rewardList}>
                {config.rewards.map((reward) => (<RewardSlot key={reward.id} reward={reward}/>))}
              </div>
            </ClientFrame>
          </ClientFrame>
          <button type="button" className={styles.clientButton} style={clientRectStyle(REWARD + "/Panel/Content/BUTTON")} data-client-path={REWARD + "/Panel/Content/BUTTON"} disabled>
            <ClientFrame path={REWARD + "/Panel/Content/BUTTON/BUTTON_LOCKED"}>
              <SlicedFill src={deploymentUrl(sprite("UI_SINGLE_MATCHTEN_BTN_03"))} border={SPRITE_BORDER.buttonWide} className={styles.disabledButtonImage}/>
              <span className={styles.rewardAllText}>일괄 완료</span>
            </ClientFrame>
          </button>
          <CloseButton base={REWARD + "/Panel/Content/BTN_CLOSE"} onClick={onClose} label="점수 보상 닫기"/>
        </ClientFrame>
      </ClientFrame>
    </div>);
}
export default function MatchTenGame({ config }: {
    config: MatchTenConfig;
}) {
    const initialTime = config.durationSeconds * 100;
    const recordLimits = useMemo(() => ({ maxScore: config.columns * config.rows, maxTimeLeft: initialTime }), [config.columns, config.rows, initialTime]);
    const [bestRecord, setBestRecord] = useState<MatchTenRecord>(EMPTY_MATCH_TEN_RECORD);
    const [phase, setPhase] = useState<GamePhase>("intro");
    const [returningFrom, setReturningFrom] = useState<ReturningFrom>(null);
    const [introElapsed, setIntroElapsed] = useState(0);
    const [popup, setPopup] = useState<PopupKind>(null);
    const [board, setBoard] = useState<MatchTenBoardCell[]>(() => createMatchTenPreviewBoard(config.columns, config.rows));
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(initialTime);
    const [selection, setSelection] = useState<DragSelection | null>(null);
    const [clearingCells, setClearingCells] = useState(() => new Map<number, MatchTenBoardCell>());
    const [inactiveIds, setInactiveIds] = useState(() => new Set<number>());
    const [countdownElapsed, setCountdownElapsed] = useState(0);
    const [result, setResult] = useState<MatchTenResult | null>(null);
    const [canvasMetrics, setCanvasMetrics] = useState({
        width: 1920,
        height: 1080,
        scale: 1,
    });
    const loopBackgroundWidth = Math.max(canvasMetrics.width, (canvasMetrics.height * 16) / 9);
    const loopBackgroundHeight = Math.max(canvasMetrics.height, (canvasMetrics.width * 9) / 16);
    const stageRef = useRef<HTMLDivElement>(null);
    const boardElementRef = useRef<HTMLDivElement>(null);
    const boardBoundsRef = useRef<DOMRect | null>(null);
    const boardDataRef = useRef(board);
    const scoreRef = useRef(0);
    const timeRef = useRef(initialTime);
    const dragRef = useRef<DragSelection | null>(null);
    const elapsedBeforeRunRef = useRef(0);
    const timerRunStartedRef = useRef<number | null>(null);
    const returningFromRef = useRef<ReturningFrom>(null);
    const returningStartedAtRef = useRef<number | null>(null);
    const finishedRef = useRef(false);
    const resultSequenceRef = useRef(0);
    const bestRecordRef = useRef(bestRecord);
    const timeElementRef = useRef<HTMLElement | null>(null);
    const pendingSelectionRef = useRef<DragSelection | null>(null);
    const selectionFrameRef = useRef<number | null>(null);
    const [sfxPlayer] = useState(() => createMatchTenSfxPlayer());
    const countAudioRef = useRef<HTMLAudioElement | null>(null);
    const startAudioRef = useRef<HTMLAudioElement | null>(null);
    const buttonAudioRef = useRef<HTMLAudioElement | null>(null);
    const introTada2AudioRef = useRef<HTMLAudioElement | null>(null);
    const introFireAudioRef = useRef<HTMLAudioElement | null>(null);
    const introTadaAudioRef = useRef<HTMLAudioElement | null>(null);
    const activePangAudiosRef = useRef(new Set<HTMLAudioElement>());
    const pendingPangTimeoutsRef = useRef(new Set<number>());
    const countdownSoundTimeoutsRef = useRef(new Set<number>());
    const timeoutIdsRef = useRef(new Set<number>());
    const schedule = useCallback((callback: () => void, delay: number) => {
        const id = window.setTimeout(() => {
            timeoutIdsRef.current.delete(id);
            callback();
        }, delay);
        timeoutIdsRef.current.add(id);
        return id;
    }, []);
    useEffect(() => {
        // Read after hydration; merely opening the game must not write a record.
        const refreshRecord = () => {
            const loaded = loadMatchTenRecord(recordLimits);
            bestRecordRef.current = loaded;
            setBestRecord(loaded);
        };
        refreshRecord();
        const onStorage = (event: StorageEvent) => {
            if (event.key === MATCH_TEN_RECORD_STORAGE_KEY || event.key === null) {
                refreshRecord();
            }
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, [recordLimits]);
    useEffect(() => {
        const stage = stageRef.current;
        if (!stage)
            return;
        const update = () => {
            boardBoundsRef.current = null;
            const width = stage.clientWidth;
            const height = stage.clientHeight;
            if (width <= 0 || height <= 0)
                return;
            const matchHeight = Math.fround(width / height) >= MATCH_TEN_CLIENT_SOURCE.aspectSwitch;
            const scale = matchHeight ? height / 1080 : width / 1920;
            setCanvasMetrics({
                width: width / scale,
                height: height / scale,
                scale,
            });
        };
        update();
        const observer = new ResizeObserver(update);
        observer.observe(stage);
        return () => observer.disconnect();
    }, []);
    useEffect(() => {
        const timeoutIds = timeoutIdsRef.current;
        const activePangAudios = activePangAudiosRef.current;
        const pendingPangTimeouts = pendingPangTimeoutsRef.current;
        const countdownSoundTimeouts = countdownSoundTimeoutsRef.current;
        // STV-AUD-004: music is served as the web-derived Ogg Opus copy; SFX stay WAV.
        const bgm = new Audio(deploymentUrl(AUDIO_ROOT + "/bgm/UI_MATCH_TEN.ogg"));
        bgm.loop = true;
        bgm.volume = getMatchTenAudioVolume("bgm");
        bgm.preload = "auto";
        const countAudio = new Audio(deploymentUrl(AUDIO_ROOT + "/sfx/FX_UI_MATCH_TEN_COUNT.wav"));
        countAudio.volume = getMatchTenAudioVolume("sfx");
        countAudio.preload = "auto";
        const startAudio = new Audio(deploymentUrl(AUDIO_ROOT + "/sfx/FX_UI_MATCH_TEN_START.wav"));
        startAudio.volume = getMatchTenAudioVolume("sfx");
        startAudio.preload = "auto";
        const buttonAudio = new Audio(deploymentUrl(AUDIO_ROOT + "/sfx/FX_UI_BUTTON_SELECT.wav"));
        buttonAudio.volume = getMatchTenAudioVolume("sfx");
        buttonAudio.preload = "auto";
        const introTada2Audio = new Audio(deploymentUrl(AUDIO_ROOT + "/sfx/FX_CUTSCEN_TADA2.wav"));
        introTada2Audio.volume = getMatchTenAudioVolume("sfx");
        introTada2Audio.preload = "auto";
        const introFireAudio = new Audio(deploymentUrl(AUDIO_ROOT + "/sfx/FX_COMBAT_ALL_FIRE_05.wav"));
        introFireAudio.volume = getMatchTenAudioVolume("sfx");
        introFireAudio.preload = "auto";
        const introTadaAudio = new Audio(deploymentUrl(AUDIO_ROOT + "/sfx/FX_CUTSCEN_TADA.wav"));
        introTadaAudio.volume = getMatchTenAudioVolume("sfx");
        introTadaAudio.preload = "auto";
        countAudioRef.current = countAudio;
        startAudioRef.current = startAudio;
        buttonAudioRef.current = buttonAudio;
        introTada2AudioRef.current = introTada2Audio;
        introFireAudioRef.current = introFireAudio;
        introTadaAudioRef.current = introTadaAudio;
        const playBgm = () => {
            if (!bgm.paused)
                return;
            void bgm.play().catch(() => undefined);
        };
        playBgm();
        window.addEventListener("pointerdown", playBgm);
        window.addEventListener("keydown", playBgm);
        return () => {
            window.removeEventListener("pointerdown", playBgm);
            window.removeEventListener("keydown", playBgm);
            bgm.pause();
            sfxPlayer.stopAll();
            activePangAudios.clear();
            pendingPangTimeouts.clear();
            countdownSoundTimeouts.clear();
            for (const id of timeoutIds)
                window.clearTimeout(id);
            timeoutIds.clear();
        };
    }, [sfxPlayer]);
    const playAudio = useCallback((audio: HTMLAudioElement | null) => sfxPlayer.play(audio), [sfxPlayer]);
    const stopAudio = useCallback((audio: HTMLAudioElement | null) => sfxPlayer.stop(audio), [sfxPlayer]);
    useEffect(() => {
        if (phase !== "intro")
            return;
        const timeoutIds = timeoutIdsRef.current;
        const started = performance.now();
        let animationFrame = 0;
        const soundTimeouts = [
            schedule(() => playAudio(introTada2AudioRef.current), INTRO_SOUND_TIMING.tada2OnMs),
            schedule(() => stopAudio(introTada2AudioRef.current), INTRO_SOUND_TIMING.tada2OffMs),
            schedule(() => playAudio(introFireAudioRef.current), INTRO_SOUND_TIMING.fireOnMs),
            schedule(() => stopAudio(introFireAudioRef.current), INTRO_SOUND_TIMING.fireOffMs),
            schedule(() => playAudio(introTadaAudioRef.current), INTRO_SOUND_TIMING.tadaOnMs),
            schedule(() => stopAudio(introTadaAudioRef.current), INTRO_SOUND_TIMING.tadaOffMs),
        ];
        const animate = (now: number) => {
            const elapsed = Math.min(MATCH_TEN_CLIENT_TIMING.introClipMs, now - started);
            setIntroElapsed(elapsed);
            if (elapsed >= MATCH_TEN_CLIENT_TIMING.introClipMs) {
                setPhase("lobby");
                return;
            }
            animationFrame = requestAnimationFrame(animate);
        };
        animationFrame = requestAnimationFrame(animate);
        return () => {
            cancelAnimationFrame(animationFrame);
            for (const id of soundTimeouts) {
                window.clearTimeout(id);
                timeoutIds.delete(id);
            }
            stopAudio(introTada2AudioRef.current);
            stopAudio(introFireAudioRef.current);
            stopAudio(introTadaAudioRef.current);
        };
    }, [phase, playAudio, schedule, stopAudio]);
    const playPangs = useCallback((count: number) => {
        for (let index = 0; index < count; index += 1) {
            const audio = new Audio(deploymentUrl(AUDIO_ROOT + "/sfx/FX_UI_MATCH_TEN_PANG.wav"));
            const remove = () => activePangAudiosRef.current.delete(audio);
            audio.volume = getMatchTenAudioVolume("sfx", 0.699999988079071);
            activePangAudiosRef.current.add(audio);
            sfxPlayer.play(audio, remove);
        }
    }, [sfxPlayer]);
    const schedulePangs = useCallback((count: number) => {
        let id = 0;
        id = schedule(() => {
            pendingPangTimeoutsRef.current.delete(id);
            playPangs(count);
        }, 66.6666716337204);
        pendingPangTimeoutsRef.current.add(id);
    }, [playPangs, schedule]);
    const stopGameSfx = useCallback(() => {
        stopAudio(countAudioRef.current);
        stopAudio(startAudioRef.current);
        for (const id of countdownSoundTimeoutsRef.current) {
            window.clearTimeout(id);
            timeoutIdsRef.current.delete(id);
        }
        countdownSoundTimeoutsRef.current.clear();
        for (const id of pendingPangTimeoutsRef.current) {
            window.clearTimeout(id);
            timeoutIdsRef.current.delete(id);
        }
        pendingPangTimeoutsRef.current.clear();
        for (const audio of activePangAudiosRef.current)
            stopAudio(audio);
        activePangAudiosRef.current.clear();
    }, [stopAudio]);
    const pauseGameTimer = useCallback((now = performance.now()) => {
        const runStarted = timerRunStartedRef.current;
        if (runStarted === null)
            return;
        elapsedBeforeRunRef.current += Math.max(0, now - runStarted);
        timerRunStartedRef.current = null;
    }, []);
    const resumeGameTimer = useCallback((now = performance.now()) => {
        if (timerRunStartedRef.current === null) {
            timerRunStartedRef.current = now;
        }
    }, []);
    const readRemainingTime = useCallback((now = performance.now()) => getMatchTenRemainingCentiseconds(config.durationSeconds, elapsedBeforeRunRef.current, timerRunStartedRef.current, now), [config.durationSeconds]);
    const writeTimeDisplay = useCallback((nextTime: number) => {
        let element = timeElementRef.current;
        if (!element?.isConnected) {
            element = stageRef.current?.querySelector<HTMLElement>(`[data-client-path="${GAME_TOP}/Time/NUM"]`) ?? null;
            timeElementRef.current = element;
        }
        if (!element)
            return;
        const text = formatTime(nextTime);
        if (element.textContent !== text)
            element.textContent = text;
        element.classList.toggle(styles.timeWarning, nextTime < 1000);
    }, []);
    const setBoardState = useCallback((next: MatchTenBoardCell[]) => {
        boardDataRef.current = next;
        setBoard(next);
    }, []);
    const finishGame = useCallback((finalScore: number, finalTime: number, finishedAt = performance.now()) => {
        if (finishedRef.current)
            return;
        pauseGameTimer(finishedAt);
        finishedRef.current = true;
        scoreRef.current = finalScore;
        timeRef.current = finalTime;
        writeTimeDisplay(finalTime);
        dragRef.current = null;
        setSelection(null);
        setScore(finalScore);
        setTimeLeft(finalTime);
        const sequence = resultSequenceRef.current;
        resultSequenceRef.current += 1;
        // Only normal completion (board cleared or timer expired) reaches here.
        // The client tracks score and remaining centiseconds independently.
        const { record, scoreIsNewRecord, timeIsNewRecord } = saveMatchTenResult(bestRecordRef.current, { score: finalScore, timeLeft: finalTime }, recordLimits);
        bestRecordRef.current = record;
        setBestRecord(record);
        setResult({
            score: finalScore,
            timeLeft: finalTime,
            sequence,
            scoreIsNewRecord,
            timeIsNewRecord,
        });
        setPhase("result");
    }, [pauseGameTimer, recordLimits, writeTimeDisplay]);
    useEffect(() => {
        if (phase !== "transition")
            return;
        const timeoutIds = timeoutIdsRef.current;
        const id = schedule(() => setPhase("countdown"), 100 + MATCH_TEN_CLIENT_TIMING.lobbyTransitionMs);
        return () => {
            window.clearTimeout(id);
            timeoutIds.delete(id);
        };
    }, [phase, schedule]);
    useEffect(() => {
        if (phase !== "returning")
            return;
        const timeoutIds = timeoutIdsRef.current;
        const pageOffId = schedule(stopGameSfx, GAME_PAGE_OFF_MS);
        const lobbyId = schedule(() => {
            returningFromRef.current = null;
            returningStartedAtRef.current = null;
            setReturningFrom(null);
            setPhase("lobby");
        }, MATCH_TEN_CLIENT_TIMING.lobbyTransitionMs);
        return () => {
            window.clearTimeout(pageOffId);
            window.clearTimeout(lobbyId);
            timeoutIds.delete(pageOffId);
            timeoutIds.delete(lobbyId);
        };
    }, [phase, schedule, stopGameSfx]);
    useEffect(() => {
        if (phase !== "countdown")
            return;
        const timeoutIds = timeoutIdsRef.current;
        const countdownSoundTimeouts = countdownSoundTimeoutsRef.current;
        const started = performance.now();
        let animationFrame = 0;
        const countStartTimeouts = MATCH_TEN_CLIENT_TIMING.countdownCountSoundMs.map((delay) => schedule(() => playAudio(countAudioRef.current), delay));
        const countStopTimeouts = COUNTDOWN_SOUND_OFF_MS.map((delay) => schedule(() => stopAudio(countAudioRef.current), delay));
        const startTimeout = schedule(() => playAudio(startAudioRef.current), MATCH_TEN_CLIENT_TIMING.countdownStartSoundMs);
        const startStopTimeout = schedule(() => stopAudio(startAudioRef.current), MATCH_TEN_CLIENT_TIMING.countdownMs);
        const soundTimeouts = [
            ...countStartTimeouts,
            ...countStopTimeouts,
            startTimeout,
            startStopTimeout,
        ];
        for (const id of soundTimeouts)
            countdownSoundTimeouts.add(id);
        const clearSoundTimeouts = () => {
            for (const id of soundTimeouts) {
                window.clearTimeout(id);
                timeoutIds.delete(id);
                countdownSoundTimeouts.delete(id);
            }
        };
        const animate = (now: number) => {
            const elapsed = Math.min(MATCH_TEN_CLIENT_TIMING.countdownMs, now - started);
            setCountdownElapsed(elapsed);
            const returningStartedAt = returningStartedAtRef.current;
            if (returningFromRef.current === "countdown" &&
                returningStartedAt !== null) {
                if (now < returningStartedAt + GAME_PAGE_OFF_MS) {
                    animationFrame = requestAnimationFrame(animate);
                }
                return;
            }
            if (elapsed >= MATCH_TEN_CLIENT_TIMING.countdownMs) {
                clearSoundTimeouts();
                stopAudio(countAudioRef.current);
                stopAudio(startAudioRef.current);
                resumeGameTimer(now);
                setPhase("playing");
                return;
            }
            animationFrame = requestAnimationFrame(animate);
        };
        animationFrame = requestAnimationFrame(animate);
        return () => {
            if (returningFromRef.current !== "countdown") {
                cancelAnimationFrame(animationFrame);
                clearSoundTimeouts();
            }
        };
    }, [phase, playAudio, resumeGameTimer, schedule, stopAudio]);
    useEffect(() => {
        if (phase !== "playing")
            return;
        const runStarted = timerRunStartedRef.current ?? performance.now();
        timerRunStartedRef.current = runStarted;
        let animationFrame = 0;
        const tick = (now: number) => {
            const nextTime = readRemainingTime(now);
            if (nextTime !== timeRef.current) {
                timeRef.current = nextTime;
                writeTimeDisplay(nextTime);
            }
            if (isMatchTenTimerExpired(config.durationSeconds, elapsedBeforeRunRef.current, timerRunStartedRef.current, now)) {
                finishGame(scoreRef.current, 0, now);
                return;
            }
            animationFrame = requestAnimationFrame(tick);
        };
        animationFrame = requestAnimationFrame(tick);
        return () => {
            cancelAnimationFrame(animationFrame);
            if (timerRunStartedRef.current === runStarted) {
                pauseGameTimer();
            }
        };
    }, [
        config.durationSeconds,
        finishGame,
        pauseGameTimer,
        phase,
        readRemainingTime,
        writeTimeDisplay,
    ]);
    const prepareGame = useCallback(() => {
        stopGameSfx();
        const nextBoard = createPlayableMatchTenBoard(config.columns, config.rows);
        setBoardState(nextBoard);
        setScore(0);
        scoreRef.current = 0;
        setTimeLeft(initialTime);
        timeRef.current = initialTime;
        writeTimeDisplay(initialTime);
        timeElementRef.current = null;
        elapsedBeforeRunRef.current = 0;
        timerRunStartedRef.current = null;
        returningFromRef.current = null;
        returningStartedAtRef.current = null;
        setReturningFrom(null);
        finishedRef.current = false;
        dragRef.current = null;
        setSelection(null);
        setClearingCells(new Map());
        setInactiveIds(new Set());
        setResult(null);
    }, [
        config.columns,
        config.rows,
        initialTime,
        setBoardState,
        stopGameSfx,
        writeTimeDisplay,
    ]);
    const startGame = useCallback(() => {
        prepareGame();
        setPopup(null);
        setPhase("transition");
    }, [prepareGame]);
    const restartGame = useCallback(() => {
        prepareGame();
        setPhase("countdown");
    }, [prepareGame]);
    const returnToLobby = useCallback(() => {
        const returningStartedAt = performance.now();
        const source: ReturningFrom = phase === "countdown" || phase === "playing" || phase === "result"
            ? phase
            : null;
        pauseGameTimer(returningStartedAt);
        returningFromRef.current = source;
        returningStartedAtRef.current = returningStartedAt;
        setReturningFrom(source);
        finishedRef.current = false;
        dragRef.current = null;
        setSelection(null);
        setResult(null);
        setPhase("returning");
    }, [pauseGameTimer, phase]);
    const requestExit = useCallback(() => {
        // Return straight to this game's lobby without the score-loss popup.
        pauseGameTimer();
        finishedRef.current = true;
        dragRef.current = null;
        setSelection(null);
        setResult(null);
        setPopup(null);
        returningFromRef.current = null;
        returningStartedAtRef.current = null;
        setReturningFrom(null);
        stopGameSfx();
        setPhase("lobby");
    }, [pauseGameTimer, stopGameSfx]);
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape" || event.repeat)
                return;
            if (phase === "result") {
                event.preventDefault();
                returnToLobby();
                return;
            }
            if (popup) {
                event.preventDefault();
                setPopup(null);
                return;
            }
            if (phase === "countdown" ||
                phase === "playing" ||
                phase === "reroll") {
                event.preventDefault();
                requestExit();
                return;
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [phase, popup, requestExit, returnToLobby]);
    const reroll = useCallback(() => {
        if (phase !== "reroll")
            return;
        const current = boardDataRef.current;
        const next = createPlayableMatchTenBoard(config.columns, config.rows, current);
        setInactiveIds(new Set(current.filter((cell) => cell.value === 0).map((cell) => cell.id)));
        setBoardState(next);
        setSelection(null);
        dragRef.current = null;
        resumeGameTimer();
        setPhase("playing");
    }, [
        config.columns,
        config.rows,
        phase,
        resumeGameTimer,
        setBoardState,
    ]);
    const selectionMetrics = useMemo(() => {
        if (!selection)
            return { ids: EMPTY_SELECTED_IDS, sum: 0 };
        const indices = getMatchTenSelectableSlotIndices(board, selection.start, selection.end);
        const bounds = getMatchTenCellBounds(indices, config.columns);
        return {
            ids: new Set(indices),
            sum: bounds ? getMatchTenBoundsSum(board, bounds, config.columns) : 0,
        };
    }, [board, config.columns, selection]);
    const selectedIds = selectionMetrics.ids;
    const selectionSum = selectionMetrics.sum;
    const cancelSelectionFrame = useCallback(() => {
        if (selectionFrameRef.current !== null) {
            window.cancelAnimationFrame(selectionFrameRef.current);
            selectionFrameRef.current = null;
        }
        pendingSelectionRef.current = null;
    }, []);
    const queueSelectionFrame = useCallback((next: DragSelection) => {
        pendingSelectionRef.current = next;
        if (selectionFrameRef.current !== null)
            return;
        selectionFrameRef.current = window.requestAnimationFrame(() => {
            selectionFrameRef.current = null;
            const pending = pendingSelectionRef.current;
            pendingSelectionRef.current = null;
            if (!pending || dragRef.current?.pointerId !== pending.pointerId)
                return;
            setSelection(pending);
        });
    }, []);
    useEffect(() => {
        if (phase !== "playing")
            cancelSelectionFrame();
        return cancelSelectionFrame;
    }, [cancelSelectionFrame, phase]);
    const releaseSelection = useCallback((end: MatchTenPoint) => {
        const drag = dragRef.current;
        if (!drag || phase !== "playing")
            return;
        cancelSelectionFrame();
        boardBoundsRef.current = null;
        const currentBoard = boardDataRef.current;
        const resolution = resolveMatchTenSelection(currentBoard, scoreRef.current, drag.start, end);
        dragRef.current = null;
        setSelection(null);
        if (!resolution.success)
            return;
        const justCleared = new Map<number, MatchTenBoardCell>();
        currentBoard.forEach((cell, index) => {
            if (cell.value > 0 && resolution.board[index]?.value === 0) {
                justCleared.set(cell.id, cell);
            }
        });
        setClearingCells((previous) => {
            const next = new Map(previous);
            for (const [id, cell] of justCleared)
                next.set(id, cell);
            return next;
        });
        schedulePangs(resolution.clearedCount);
        schedule(() => {
            setClearingCells((previous) => {
                const next = new Map(previous);
                for (const id of justCleared.keys())
                    next.delete(id);
                return next;
            });
        }, MATCH_TEN_CLIENT_TIMING.nodeClearMs);
        setBoardState(resolution.board);
        scoreRef.current = resolution.score;
        setScore(resolution.score);
        if (resolution.complete) {
            const finishedAt = performance.now();
            finishGame(resolution.score, readRemainingTime(finishedAt), finishedAt);
            return;
        }
        if (!hasMatchTenMove(resolution.board, config.columns, config.rows)) {
            pauseGameTimer();
            setPhase("reroll");
        }
    }, [
        config.columns,
        config.rows,
        finishGame,
        pauseGameTimer,
        phase,
        readRemainingTime,
        schedule,
        schedulePangs,
        setBoardState,
        cancelSelectionFrame,
    ]);
    const pointerToBoard = useCallback((event: ReactPointerEvent<HTMLDivElement>, refreshBounds = false) => {
        const boardElement = boardElementRef.current;
        if (!boardElement)
            return null;
        if (refreshBounds || !boardBoundsRef.current) {
            boardBoundsRef.current = boardElement.getBoundingClientRect();
        }
        const bounds = boardBoundsRef.current;
        return getMatchTenBoardLocalPoint(event.clientX, event.clientY, bounds);
    }, []);
    const pointerHandlers = useMemo(() => {
        const cancelPointerSelection = (event: ReactPointerEvent<HTMLDivElement>) => {
            if (dragRef.current?.pointerId !== event.pointerId)
                return;
            cancelSelectionFrame();
            boardBoundsRef.current = null;
            dragRef.current = null;
            setSelection(null);
        };
        return {
            onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
                if (phase !== "playing" || event.button !== 0)
                    return;
                if (event.target instanceof Element &&
                    event.target.closest("button, a")) {
                    return;
                }
                const point = pointerToBoard(event, true);
                if (!point)
                    return;
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                const next = {
                    pointerId: event.pointerId,
                    start: point,
                    end: point,
                };
                dragRef.current = next;
                setSelection(next);
            },
            onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => {
                const drag = dragRef.current;
                if (!drag || drag.pointerId !== event.pointerId)
                    return;
                const point = pointerToBoard(event);
                if (!point)
                    return;
                event.preventDefault();
                const next = { ...drag, end: point };
                dragRef.current = next;
                queueSelectionFrame(next);
            },
            onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => {
                const drag = dragRef.current;
                if (!drag || drag.pointerId !== event.pointerId)
                    return;
                const point = pointerToBoard(event, true) ?? drag.end;
                event.preventDefault();
                cancelSelectionFrame();
                releaseSelection(point);
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                }
            },
            onPointerCancel: cancelPointerSelection,
            onLostPointerCapture: cancelPointerSelection,
        };
    }, [
        cancelSelectionFrame,
        phase,
        pointerToBoard,
        queueSelectionFrame,
        releaseSelection,
    ]);
    const introSeconds = introElapsed / 1000;
    const matchTenVisible = phase !== "intro" || introSeconds >= INTRO_ACTIVE_TIMING.matchTenOn;
    const lobbyVisible = phase === "intro" ||
        phase === "lobby" ||
        phase === "transition" ||
        phase === "returning";
    const gameVisible = phase !== "intro" && phase !== "lobby";
    return (<section ref={stageRef} className={styles.stage} aria-label="탕비실 침공작전" onClickCapture={(event) => {
            const target = event.target;
            if (!(target instanceof Element))
                return;
            const control = target.closest("button, a");
            if (!control || !event.currentTarget.contains(control))
                return;
            playAudio(buttonAudioRef.current);
        }}>
      <div className={styles.clientCanvas} style={{
            width: canvasMetrics.width,
            height: canvasMetrics.height,
            transform: "scale(" + cssNumber(canvasMetrics.scale) + ")",
        }} data-reference-width="1920" data-reference-height="1080" data-client-aspect-switch={MATCH_TEN_CLIENT_SOURCE.aspectSwitch}>
        <div className={styles.outerLoopBackground} style={{
            left: (canvasMetrics.width - loopBackgroundWidth) / 2,
            top: (canvasMetrics.height - loopBackgroundHeight) / 2,
            width: loopBackgroundWidth,
            height: loopBackgroundHeight,
        }}/>
        <ClientFrame path="UI_SINGLE_MATCHTEN/Bg/Gradient" className={styles.outerGradient}/>
        <div className={styles.matchtenRoot}>
          {matchTenVisible ? (<ClientFrame path={HOME}>
              <ClientSprite path={HOME + "/Bg"} src={deploymentUrl(texture("UI_SINGLE_MATCHTEN_BG_01"))} priority/>
              {lobbyVisible ? (<LobbyPage motion={phase === "intro"
                    ? "intro"
                    : phase === "transition"
                        ? "leaving"
                        : phase === "returning"
                            ? "entering"
                            : "idle"} introElapsed={introElapsed} bestRecord={bestRecord} onStart={startGame} onRule={() => {
                    setPopup("rule");
                }} onReward={() => {
                    setPopup("reward");
                }}/>) : null}
              {gameVisible ? (<GameScene phase={phase} returningFrom={returningFrom} score={score} timeLeft={timeLeft} board={board} clearingCells={clearingCells} inactiveIds={inactiveIds} selectedIds={selectedIds} selection={selection} countdownElapsed={countdownElapsed} boardRef={boardElementRef} onBack={requestExit} onReroll={reroll} pointerHandlers={pointerHandlers}/>) : null}
            </ClientFrame>) : null}
          {phase === "intro" &&
            introSeconds >= INTRO_ACTIVE_TIMING.matchTenOn ? (<ClientFrame path={MATCHTEN + "/RaycastArea"} className={styles.introRaycastArea} aria-hidden="true"/>) : null}
          {phase === "intro" ? <IntroSequence elapsed={introElapsed}/> : null}
        </div>

        {phase === "result" && result ? (<ResultPopup result={result} midScore={config.midScore} highScore={config.highScore} onClose={returnToLobby} onRestart={restartGame}/>) : null}
        {popup === "rule" ? (<RulePopup config={config} onClose={() => setPopup(null)}/>) : null}
        {popup === "reward" ? (<RewardPopup config={config} bestRecord={bestRecord} onClose={() => {
                setPopup(null);
            }}/>) : null}
      </div>
      <output className={styles.srOnly} aria-live="polite">
        {selection ? "선택 합계 " + selectionSum : ""}
      </output>
    </section>);
}
