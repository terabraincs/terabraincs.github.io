"use client";
import { deploymentUrl } from "@/lib/deployment";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { swordClientCanvas, swordClientGeometry, swordClientReference, swordClientWorldRect, type SwordClientLayout, type SwordClientNode } from "@/lib/swordTrainingClientLayout";
import { sampleSwordTrainingClientAnimation, type SwordTrainingClientAnimationClip } from "@/lib/swordTrainingClientAnimation";
import { SwordTrainingClientEngine, type SwordTrainingClientSnapshot } from "@/lib/swordTrainingClientEngine";
import { createSwordClientAudio, type SwordClientAudioManifest } from "@/lib/swordTrainingClientAudio";
import { attachSwordTrainingNativeText, type NativeTextCatalog } from "@/lib/swordTrainingNativeText";
import { attachSwordNativeLegacyMetrics, type SwordNativeLegacyMetrics } from "@/lib/swordTrainingNativeLegacyText";
import { SwordTrainingClientFlow, type SwordClientFlowSnapshot } from "@/lib/swordTrainingClientFlow";
import type { SwordParticleSystemSource } from "@/lib/swordTrainingClientParticles";
import { emptySwordTrainingRecord, readSwordTrainingRecord, recordSwordTrainingResult, synchronizeSwordTrainingRecord, SWORD_TRAINING_EVENT_ID, SWORD_TRAINING_RECORD_KEY } from "@/lib/swordTrainingClientRecord";
import { buildSwordConditionsRewardLayout, swordRewardConditions, type SwordRewardTables } from "@/lib/swordTrainingClientRewards";
import SwordTrainingPrefab, { type SwordPrefabOverride } from "./SwordTrainingPrefab";
import SwordTrainingActors, { type SwordTrainingActor } from "./SwordTrainingActors";
import SwordTrainingSlash, { type SwordTrainingHitFx } from "./SwordTrainingSlash";
import SwordTrainingRewards from "./SwordTrainingRewards";
const SOURCE = deploymentUrl("/game-assets/sword-training/client-source");
const MAIN = "UI_SINGLE_SWORDTRAINING";
const RULE = "UI_SINGLE_POPUP_SWORDTRAINING_RULE";
const RESULT = "UI_SINGLE_POPUP_SWORDTRAINING_RESULT";
const EMPTY_ACTORS: SwordTrainingActor[] = [];
const EMPTY_HITS: SwordTrainingHitFx[] = [];
type Tables = Omit<SwordRewardTables, "games"> & {
    games: {
        m_Id: number;
        m_BannerTitle: string;
        m_BannerDesc: string;
        m_GameType: string;
        m_ScoreRewardGroupID: number;
    }[];
};
type RewardPresentation = ReturnType<typeof buildSwordConditionsRewardLayout>;
type Bundle = {
    layout: SwordClientLayout & {
        animations: SwordTrainingClientAnimationClip[];
    };
    reward: RewardPresentation;
    tables: Tables;
    audio: SwordClientAudioManifest;
    particles: {
        systems: SwordParticleSystemSource[];
    };
};
type Flow = SwordClientFlowSnapshot;
type View = {
    flow: Flow;
    totalTime: number;
    snapshot: SwordTrainingClientSnapshot | null;
};
function requiredNode(layout: SwordClientLayout, path: string): SwordClientNode {
    const node = layout.nodes.find(item => item.path === path);
    if (!node)
        throw new Error(`Missing original prefab node ${path}`);
    return node;
}
function sourcePaths(layout: SwordClientLayout) {
    const module = requiredNode(layout, MAIN);
    const moduleField = (name: string) => swordClientReference(module, "NKCUIModuleSubUISwordTraining", name);
    const game = requiredNode(layout, moduleField("m_SwordTraining"));
    const gameField = (name: string) => swordClientReference(game, "NKCPopupSwordTraining", name);
    const rule = requiredNode(layout, RULE), result = requiredNode(layout, RESULT);
    const lobbyClose = `${MAIN}/SWORD/Content/01/BTN/BTN_CLOSE`;
    requiredNode(layout, lobbyClose);
    return {
        start: moduleField("m_btnStart"), rule: moduleField("m_btnRule"), reward: moduleField("m_btnScoreReward"),
        bestScore: moduleField("m_lbScore"), eventTime: moduleField("m_lbEventTime"),
        game: game.path, gameGroup: game.parentPath!, mask: `${game.path}/Contents/Mask`,
        score: gameField("m_lbScore"), left: gameField("m_csbtnTouchL"), right: gameField("m_csbtnTouchR"),
        ruleClose: swordClientReference(rule, "NKCPopupImage", "m_btnClose"), ruleText: swordClientReference(rule, "NKCPopupImage", "m_lbDesc"),
        resultClose: swordClientReference(result, "NKCPopupSwordTrainingResult", "m_btnClose"),
        resultRestart: swordClientReference(result, "NKCPopupSwordTrainingResult", "m_btnRestart"),
        resultScore: swordClientReference(result, "NKCPopupSwordTrainingResult", "m_lbScore"),
        resultNew: swordClientReference(result, "NKCPopupSwordTrainingResult", "m_objNewScore"),
        resultName: swordClientReference(result, "NKCPopupSwordTrainingResult", "m_lbUserName"),
        resultUid: swordClientReference(result, "NKCPopupSwordTrainingResult", "m_lbUserUID"),
        lobbyClose,
    };
}
export default function SwordTrainingClientGame() {
    const router = useRouter();
    const hostRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<SwordTrainingClientEngine | null>(null);
    const soundRef = useRef<ReturnType<typeof createSwordClientAudio> | null>(null);
    const flowModelRef = useRef<SwordTrainingClientFlow | null>(null);
    const flowRef = useRef<Flow>({ phase: "intro", time: 0, animatorClip: "UI_SINGLE_SWORDTRAINING_INTRO", animatorTime: 0,
        lobbyActive: true, gameActive: false, raycastActive: true, pendingStarts: 0, openCalls: 0 });
    const timeRef = useRef(0);
    // NKCPopupSwordTraining owns one reused hit-FX object, not overlapping copies.
    const hitRef = useRef<{
        id: string;
        side: "left" | "right";
        startedAt: number;
        rotation: number;
    } | null>(null);
    const nextHitRef = useRef(0);
    const keyboardRef = useRef({ left: false, right: false });
    const recordRef = useRef(emptySwordTrainingRecord());
    const storageRef = useRef<Storage | null>(null);
    const [bestScore, setBestScore] = useState(0);
    const [resultNewRecord, setResultNewRecord] = useState(false);
    const [recordReady, setRecordReady] = useState(false);
    const [storageStatus, setStorageStatus] = useState<"loading" | "available" | "unavailable">("loading");
    const [bundle, setBundle] = useState<Bundle | null>(null);
    const [size, setSize] = useState({ width: 1920, height: 1080 });
    const [view, setView] = useState<View>({ flow: flowRef.current, totalTime: 0, snapshot: null });
    const [popup, setPopup] = useState<"rule" | "reward" | null>(null);
    const popupRef = useRef<typeof popup>(null);
    const visitedPopups = useRef({ rule: false, result: false, reward: false });
    const [popupStart, setPopupStart] = useState(0);
    const [actorReady, setActorReady] = useState(false);
    const [hitReady, setHitReady] = useState(false);
    const [sourceError, setSourceError] = useState<string | null>(null);
    const [spriteReady, setSpriteReady] = useState(false);
    const sourceReadyRef = useRef(false);
    sourceReadyRef.current = actorReady && hitReady && spriteReady && recordReady && !sourceError;
    const onActorReady = useCallback(() => setActorReady(true), []);
    const onHitReady = useCallback(() => setHitReady(true), []);
    const onSourceError = useCallback((message: string) => setSourceError(message), []);
    const paths = useMemo(() => bundle ? sourcePaths(bundle.layout) : null, [bundle]);
    const gameMask = useMemo(() => bundle && paths ? swordClientWorldRect(bundle.layout, paths.mask) : null, [bundle, paths]);
    const canvas = swordClientCanvas(size.width, size.height);
    const geometry = useMemo(() => bundle ? swordClientGeometry(bundle.layout, size.width, size.height) : null, [bundle, size]);
    const playButtonSound = useCallback(() => { soundRef.current?.play("FX_UI_BUTTON_SELECT"); }, []);
    const closeReward = useCallback(() => { setPopup(null); }, []);
    useEffect(() => {
        // The user selected event 1103 and opted to persist only its highest score.
        // Access browser storage after hydration; SSR never reads window or a user record.
        try {
            storageRef.current = window.localStorage;
        }
        catch {
            storageRef.current = null;
        }
        const loaded = readSwordTrainingRecord(storageRef.current);
        recordRef.current = loaded.record;
        setBestScore(loaded.record.bestScore);
        setStorageStatus(loaded.available ? "available" : "unavailable");
        setRecordReady(true);
        const synchronize = (event: StorageEvent) => {
            if (event.key !== SWORD_TRAINING_RECORD_KEY || event.storageArea !== storageRef.current)
                return;
            // Merge maxima, including simultaneous completed games in multiple tabs.
            // Do not recompute this result popup's NEW_RECORD flag on a remote update.
            const merged = synchronizeSwordTrainingRecord(storageRef.current, recordRef.current, event.newValue);
            recordRef.current = merged.record;
            setBestScore(merged.record.bestScore);
            setStorageStatus(merged.persisted ? "available" : "unavailable");
        };
        window.addEventListener("storage", synchronize);
        return () => window.removeEventListener("storage", synchronize);
    }, []);
    const saveCompletedResult = useCallback((score: number) => {
        // NKCPopupSwordTraining.UpdateGameResult compares against the previous best
        // before opening Result. Saving first must not suppress its NEW_RECORD FX.
        const update = recordSwordTrainingResult(storageRef.current, recordRef.current, score);
        recordRef.current = update.record;
        setBestScore(update.record.bestScore);
        setResultNewRecord(update.isNewRecord);
        setStorageStatus(update.persisted ? "available" : "unavailable");
    }, []);
    useEffect(() => {
        const controller = new AbortController();
        const json = async <T,>(name: string): Promise<T> => {
            const response = await fetch(deploymentUrl(`${SOURCE}/${name}.json`), { signal: controller.signal });
            if (!response.ok)
                throw new Error(`Original resource ${name}: HTTP ${response.status}`);
            return response.json();
        };
        void Promise.all([json<Bundle["layout"]>("layout"), json<Tables>("tables"), json<SwordClientAudioManifest>("audio"), json<NativeTextCatalog>("native-text/native-text"), json<Bundle["particles"]>("particles"), json<SwordNativeLegacyMetrics>("native-legacy-metrics")])
            .then(([layout, tables, audio, nativeText, particles, legacyMetrics]) => {
            if (controller.signal.aborted)
                return;
            const nativeLayout = attachSwordNativeLegacyMetrics({ ...layout, nodes: attachSwordTrainingNativeText(layout, nativeText).nodes }, legacyMetrics);
            const conditions = swordRewardConditions(tables);
            const reward = buildSwordConditionsRewardLayout(nativeLayout, conditions);
            const module = requiredNode(reward.layout, MAIN);
            const redDotPath = swordClientReference(module, "NKCUIModuleSubUISwordTraining", "m_objReddot");
            const runtimeLayout = { ...reward.layout, nodes: reward.layout.nodes.filter(node => node.path !== redDotPath && !node.path.startsWith(`${redDotPath}/`)) } as Bundle["layout"];
            const runtimeReward = { ...reward, layout: runtimeLayout };
            setBundle({ layout: runtimeLayout, reward: runtimeReward, tables, audio, particles });
            soundRef.current = createSwordClientAudio(audio);
            soundRef.current.play("THEMA_GAMECIRCLE_02");
            const urls = [...new Set([
                    ...runtimeLayout.nodes.flatMap(node => node.images?.map(image => image.webPath).filter((url): url is string => Boolean(url)) ?? []),
                    ...Object.values(nativeText.textures).map(texture => texture.png),
                    ...particles.systems.map(system => system.texture),
                ].filter((url): url is string => Boolean(url)))];
            return Promise.all(urls.map(url => new Promise<void>((resolve, reject) => {
                const image = new Image(); image.crossOrigin = "anonymous";
                image.onload = () => resolve();
                image.onerror = () => reject(new Error(`Original sprite failed: ${url}`));
                image.src = deploymentUrl(url);
            }))).then(() => { if (!controller.signal.aborted)
                setSpriteReady(true); });
        }).catch(error => { if (!controller.signal.aborted)
            setSourceError(String(error)); });
        return () => { controller.abort(); soundRef.current?.stop(); soundRef.current = null; };
    }, []);
    useEffect(() => {
        const host = hostRef.current;
        if (!host)
            return;
        const measure = () => {
            const { width, height } = host.getBoundingClientRect();
            if (width > 0 && height > 0) {
                setSize((current) => current.width === width && current.height === height
                    ? current
                    : { width, height });
            }
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(host);
        return () => observer.disconnect();
    }, []);
    useEffect(() => { popupRef.current = popup; }, [popup]);
    useEffect(() => {
        if (!geometry)
            return;
        if (engineRef.current)
            engineRef.current.setGeometry(geometry);
        else
            engineRef.current = new SwordTrainingClientEngine({ geometry });
    }, [geometry]);
    useEffect(() => {
        if (!bundle)
            return;
        if (!flowModelRef.current)
            flowModelRef.current = new SwordTrainingClientFlow(bundle.layout.animations, bundle.layout.nodes);
        let disposed = false, frame = 0, previous = performance.now();
        const tick = (now: number) => {
            if (disposed)
                return;
            // Preserved TimeManager.MaximumAllowedTimestep is 1, not an invented clamp.
            const delta = Math.min(1, Math.max(0, (now - previous) / 1000));
            previous = now;
            // Browser resource fetch is the adapter for source bundle loading. Keep
            // the initial prefab/preload branches mounted, but do not consume INTRO
            // or its source input-block interval until all render sources are ready.
            if (!sourceReadyRef.current) {
                frame = requestAnimationFrame(tick);
                return;
            }
            timeRef.current += delta;
            const engine = engineRef.current;
            let snapshot = engine && (flowRef.current.phase === "game" || flowRef.current.phase === "result")
                ? engine.advance(delta, keyboardRef.current)
                : null;
            keyboardRef.current.left = false;
            keyboardRef.current.right = false;
            // Native Update precedes OnStart coroutine resumption and Animator update.
            const opens = flowModelRef.current!.advance(delta);
            for (let index = 0; index < opens; index++) {
                hitRef.current = null;
                engine?.start();
            }
            if (opens)
                snapshot = engine?.getSnapshot() ?? null;
            flowRef.current = flowModelRef.current!.snapshot();
            for (const event of engine?.drainEvents() ?? []) {
                if ((event.type === "sound" || event.type === "music") && event.key)
                    soundRef.current?.play(event.key);
                if (event.type === "hit-fx" && event.side)
                    hitRef.current = {
                        id: `hit-${nextHitRef.current++}`, side: event.side,
                        startedAt: timeRef.current, rotation: Math.random() * 360,
                    };
                if (event.type === "result") {
                    saveCompletedResult(event.score ?? 0);
                    visitedPopups.current.result = true;
                    flowModelRef.current!.showResult();
                    flowRef.current = flowModelRef.current!.snapshot();
                }
            }
            setView({
                flow: flowRef.current,
                totalTime: timeRef.current,
                snapshot: snapshot ?? engine?.getSnapshot() ?? null,
            });
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => { disposed = true; cancelAnimationFrame(frame); };
    }, [bundle, saveCompletedResult]);
    const returnToLobby = useCallback(() => {
        engineRef.current?.stop();
        hitRef.current = null;
        flowModelRef.current?.returnToLobby();
        if (flowModelRef.current)
            flowRef.current = flowModelRef.current.snapshot();
        // The source 02_to_01 controller state actually references the 01_IDLE clip.
        soundRef.current?.play("THEMA_GAMECIRCLE_02");
        setPopup(null);
    }, []);
    const restart = useCallback(() => {
        hitRef.current = null;
        engineRef.current?.restart();
        flowModelRef.current?.restart();
        if (flowModelRef.current)
            flowRef.current = flowModelRef.current.snapshot();
        setPopup(null);
    }, []);
    useEffect(() => {
        const cancel = () => {
            if (popupRef.current)
                setPopup(null);
            else if (flowRef.current.phase === "result")
                returnToLobby();
            else if (!flowRef.current.gameActive)
                router.push("/minigames/");
            // NKCUIModuleSubUISwordTraining.OnBackButton consumes Cancel while the
            // embedded game is active. Do not exit or open a confirmation popup.
        };
        const keydown = (event: KeyboardEvent) => {
            if (event.repeat)
                return;
            if (event.key === "Escape") {
                event.preventDefault();
                cancel();
            }
            else if (!popupRef.current && flowRef.current.phase === "game") {
                // Source CheckInput runs after fixed simulation and checks Left before
                // Right when both keys went down during the same rendered frame.
                // Keypad4/6 arrive through the separate StateButton.Update hotkey path:
                // InitUI.SetHotkey(Left/Right) + SetDefaultHotkeyEvent(260/262).
                // That path calls OnPointerClickEvent directly (no pointer-click sound).
                if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a" || event.code === "Numpad4") {
                    event.preventDefault();
                    keyboardRef.current.left = true;
                }
                if (event.key === "ArrowRight" || event.key.toLowerCase() === "d" || event.code === "Numpad6") {
                    event.preventDefault();
                    keyboardRef.current.right = true;
                }
            }
        };
        const suppressMouseBack = (event: MouseEvent) => {
            if (event.button !== 3)
                return;
            // KeyCode.Mouse3=326 is the same original Cancel event as Escape.
            // Suppress the browser's auxiliary history navigation, including the
            // later mouseup/auxclick defaults, without triggering Cancel twice.
            event.preventDefault();
            event.stopPropagation();
        };
        const pointerdown = (event: PointerEvent) => {
            if (event.button !== 3)
                return;
            suppressMouseBack(event);
            cancel();
        };
        window.addEventListener("keydown", keydown);
        window.addEventListener("pointerdown", pointerdown, true);
        for (const type of ["mousedown", "mouseup", "pointerup", "auxclick"] as const)
            window.addEventListener(type, suppressMouseBack, true);
        return () => {
            window.removeEventListener("keydown", keydown);
            window.removeEventListener("pointerdown", pointerdown, true);
            for (const type of ["mousedown", "mouseup", "pointerup", "auxclick"] as const)
                window.removeEventListener(type, suppressMouseBack, true);
        };
    }, [returnToLobby, router]);
    const ready = actorReady && hitReady && spriteReady && recordReady && !sourceError;
    const overrides = useMemo(() => {
        if (!bundle || !paths || !geometry || !gameMask)
            return {};
        const result: Record<string, SwordPrefabOverride> = {};
        const clip = bundle.layout.animations.find(item => item.name === view.flow.animatorClip);
        if (!clip)
            throw new Error(`Missing original transition ${view.flow.animatorClip}`);
        for (const [path, attributes] of Object.entries(sampleSwordTrainingClientAnimation(clip, view.flow.animatorTime))) {
            result[path ? `${MAIN}/${path}` : MAIN] = { attributes };
        }
        const override = (path: string, values: SwordPrefabOverride) => { result[path] = { ...result[path], ...values }; };
        const openPopup = (kind: "rule" | "reward") => {
            visitedPopups.current[kind] = true;
            soundRef.current?.play("FX_UI_BUTTON_SELECT");
            setPopup(kind);
            setPopupStart(timeRef.current);
        };
        override(paths.bestScore, { text: String(bestScore) });
        // Date interval and account data are absent from the preserved client tables.
        // Do not display the prefab's 2099 placeholder as a real event date.
        override(paths.eventTime, { text: "" });
        override(paths.start, { label: "start", onClick: !popup && ready ? () => {
                soundRef.current?.play("FX_UI_BUTTON_SELECT");
                flowModelRef.current?.start();
            } : undefined });
        override(paths.rule, { label: "rules", onClick: !popup ? () => openPopup("rule") : undefined });
        override(paths.reward, { label: "rewards", onClick: !popup ? () => openPopup("reward") : undefined });
        override(paths.lobbyClose, { label: "lobby-close", onClick: !popup ? () => { soundRef.current?.play("FX_UI_BUTTON_SELECT"); router.push("/minigames/"); } : undefined });
        const gameVisible = view.flow.gameActive;
        // Keep the real gameplay subtree mounted, but invisible, solely to preload
        // source assets before accepting Start; no input/game time runs while hidden.
        const groupAttributes = { ...result[paths.gameGroup]?.attributes };
        if (!gameVisible || groupAttributes.m_IsActive === 0)
            groupAttributes.m_Alpha = 0;
        override(paths.gameGroup, { active: true, raycast: gameVisible, attributes: groupAttributes });
        override(paths.score, { text: String(view.snapshot?.score ?? 0) });
        const touchAttack = (side: "left" | "right") => {
            // InitUI binds PointerClick. The source state button plays its own select
            // sound even when OnAttack subsequently rejects a concurrent attack.
            soundRef.current?.play("FX_UI_BUTTON_SELECT");
            engineRef.current?.attack(side);
        };
        override(paths.left, { label: "attack-left", onClick: !popup && view.flow.phase === "game" ? () => touchAttack("left") : undefined });
        override(paths.right, { label: "attack-right", onClick: !popup && view.flow.phase === "game" ? () => touchAttack("right") : undefined });
        const mask = gameMask;
        const playing = view.flow.phase === "game" || view.flow.phase === "result";
        const actors = view.snapshot && playing
            ? [...view.snapshot.background, view.snapshot.player, ...view.snapshot.foreground].map(actor => ({
                ...actor, x: mask.width / 2 + actor.x - mask.x, y: mask.height / 2 - actor.y + mask.y,
                scaleX: actor.scaleX * (actor.flipX ? -1 : 1), scaleY: actor.scaleY, alpha: 1,
            })) : EMPTY_ACTORS;
        const hit = hitRef.current;
        const socket = hit ? geometry.weapon[hit.side] : null;
        const effects: SwordTrainingHitFx[] = hit && socket && playing ? [{
                id: hit.id, x: mask.width / 2 + socket.x - mask.x, y: mask.height / 2 - socket.y + mask.y,
                scaleX: geometry.weapon.scaleX, scaleY: geometry.weapon.scaleY,
                elapsed: view.totalTime - hit.startedAt, randomRotationDegrees: hit.rotation,
            }] : EMPTY_HITS;
        override(paths.mask, { content: <>
      <SwordTrainingActors width={mask.width} height={mask.height} actors={actors} onReady={onActorReady} onError={onSourceError}/>
      <SwordTrainingSlash width={mask.width} height={mask.height} effects={effects} onReady={onHitReady} onError={onSourceError}/>
    </> });
        return result;
    }, [bundle, paths, geometry, gameMask, popup, ready, router, view, bestScore, onActorReady, onHitReady, onSourceError]);
    const popupOverrides = useMemo(() => {
        const result: {
            rule: Record<string, SwordPrefabOverride>;
            result: Record<string, SwordPrefabOverride>;
        } = { rule: {}, result: {} };
        if (!bundle || !paths)
            return result;
        const clip = bundle.layout.animations.find(item => item.name === "UI_SINGLE_SWORDTRAINING_POPUP_INTRO")!;
        for (const kind of ["rule", "result"] as const) {
            if (!visitedPopups.current[kind])
                continue;
            const root = kind === "rule" ? `${RULE}/CONTENT` : `${RESULT}/Contents`;
            const elapsed = kind === "rule" ? view.totalTime - popupStart : view.flow.time;
            for (const [path, attributes] of Object.entries(sampleSwordTrainingClientAnimation(clip, elapsed)))
                result[kind][`${root}/${path}`] = { attributes };
        }
        result.rule[RULE] = { active: popup === "rule" };
        result.result[RESULT] = { active: view.flow.phase === "result" };
        const closePopup = () => { soundRef.current?.play("FX_UI_BUTTON_SELECT"); setPopup(null); };
        const selectedGame = bundle.tables.games.find(game => game.m_Id === SWORD_TRAINING_EVENT_ID);
        if (!selectedGame)
            throw new Error("Original Sword Training 1103 template is missing");
        result.rule[paths.ruleText] = { text: bundle.tables.strings[selectedGame.m_BannerDesc] };
        result.rule[paths.ruleClose] = { label: "rules-close", onClick: closePopup };
        result.result[paths.resultScore] = { text: String(view.snapshot?.resultScore ?? 0) };
        result.result[paths.resultNew] = { active: resultNewRecord };
        result.result[paths.resultName] = { text: "" };
        result.result[paths.resultUid] = { text: "" };
        result.result[paths.resultClose] = { label: "result-close", onClick: () => { soundRef.current?.play("FX_UI_BUTTON_SELECT"); returnToLobby(); } };
        result.result[paths.resultRestart] = { label: "restart", onClick: () => { soundRef.current?.play("FX_UI_BUTTON_SELECT"); restart(); } };
        return result;
    }, [bundle, paths, popup, popupStart, view, resultNewRecord, restart, returnToLobby]);
    return <div ref={hostRef} data-testid="sword-client-game" data-source-rebuild="true" data-phase={view.flow.phase} data-engine-phase={view.snapshot?.phase ?? "idle"} data-source-ready={ready} data-score-storage="localStorage" data-score-storage-status={storageStatus} data-best-score={bestScore} data-event-id={SWORD_TRAINING_EVENT_ID} data-new-record={resultNewRecord} data-current-score={view.snapshot?.score ?? 0} data-result-score={view.snapshot?.resultScore ?? ""} data-attacking={view.snapshot?.attacking ?? false} data-source-animator={view.flow.animatorClip} data-source-animator-time={view.flow.animatorTime} data-source-game-active={view.flow.gameActive} data-source-pending-starts={view.flow.pendingStarts} data-source-open-calls={view.flow.openCalls} style={{ position: "relative", width: "100%", height: "100svh", overflow: "clip", background: "black", touchAction: "none", userSelect: "none" }}>
    {bundle && <div style={{ position: "absolute", left: 0, top: 0, width: canvas.width, height: canvas.height, transformOrigin: "0 0", transform: `scale(${canvas.scale})` }}>
      <SwordTrainingPrefab layout={bundle.layout} particles={bundle.particles.systems} rootPath={MAIN} width={canvas.width} height={canvas.height} elapsedSeconds={view.totalTime} strings={bundle.tables.strings} overrides={overrides} separateDynamicTransforms memoizeSubtrees/>
      {/* Original popup instances are cached; CloseInternal only deactivates
                them. Preserve their ScrollRect position and global tween lifetime. */}
      {visitedPopups.current.rule && <SwordTrainingPrefab layout={bundle.layout} particles={bundle.particles.systems} rootPath={RULE} width={canvas.width} height={canvas.height} elapsedSeconds={view.totalTime} strings={bundle.tables.strings} overrides={popupOverrides.rule} separateDynamicTransforms memoizeSubtrees/>}
      {visitedPopups.current.result && <SwordTrainingPrefab layout={bundle.layout} particles={bundle.particles.systems} rootPath={RESULT} width={canvas.width} height={canvas.height} elapsedSeconds={view.totalTime} strings={bundle.tables.strings} overrides={popupOverrides.result} separateDynamicTransforms memoizeSubtrees/>}
      {visitedPopups.current.reward && <SwordTrainingRewards source={bundle.reward} strings={bundle.tables.strings} particles={bundle.particles.systems} width={canvas.width} height={canvas.height} elapsedSeconds={view.totalTime} active={popup === "reward"} bestScore={bestScore} onClose={closeReward} onButtonSound={playButtonSound}/>}
    </div>}
    {(!bundle || sourceError) && <p role="status" style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center", color: "white" }}>{sourceError ? `원본 리소스 확인 실패: ${sourceError}` : "원본 리소스를 불러오는 중…"}</p>}
    {storageStatus === "unavailable" && <p role="status" data-testid="sword-storage-warning" style={{ position: "absolute", left: 8, right: 8, bottom: 8, margin: 0, padding: 8, color: "white", background: "#000c", fontSize: 14, textAlign: "center", pointerEvents: "none" }}>
      브라우저 저장소에 접근할 수 없어 최고점수를 저장하지 못했습니다. 현재 페이지에서는 기록이 유지됩니다.
    </p>}
  </div>;
}
