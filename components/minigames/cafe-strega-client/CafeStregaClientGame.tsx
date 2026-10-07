"use client";
import { deploymentUrl } from "@/lib/deployment";
import { memo, startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { swordClientCanvas, swordClientWorldRect, type SwordClientAsset } from '@/lib/swordTrainingClientLayout';
import { sampleSwordTrainingClientAnimation } from '@/lib/swordTrainingClientAnimation';
import { attachSwordTrainingNativeText, type NativeTextCatalog } from '@/lib/swordTrainingNativeText';
import { attachCafeNativeTextV2 } from '@/lib/cafeStregaNativeTextV2';
import type { SwordNativeLegacyLayouts } from '@/lib/swordTrainingNativeLegacyText';
import type { CafeNativeNumericCatalog } from '@/lib/cafeStregaNativeNumbersV2';
import { CafeStregaAudioV2, type CafeAudioManifestV2 } from '@/lib/cafeStregaAudioV2';
import { CAFE_ROOT_V2, CAFE_SOURCE_V2, cafeSourceBinding, cafeBindSourceImage, type CafeSourceV2 } from '@/lib/cafeStregaSourceV2';
import { createCafeCreateState, selectCafeIngredient, selectCafeTechnique, cafeRecipeForSelection, cafeNextStep, cafeCancelStep, cafeChangeQuantity, cafeQuantityText, cafeCanCreate, cafeCreateRequest, applyCafeLocalCreation, completeCafeLocalMomo, cafeRefreshCreateState, cafeBeginHold, cafeAdvanceHold, cafeDeliveryStatus, type CafeHoldConfig, type CafeHoldState, type CafeRecipe, type CafeCreateState } from '@/lib/cafeStregaClientEngine';
import { CAFE_STREGA_LOCAL_STATE_KEY, deliverCafeStregaDailyOrder, getCafeStregaDailyOrder, loadCafeStregaLocalState, replaceCafeStregaLocalInventory, saveCafeStregaLocalState, type CafeStregaLocalCatalog, type CafeStregaLocalState } from '@/lib/cafeStregaLocalStateV2';
import SourcePrefab, { type SourcePrefabImageRenderer, type SwordPrefabOverride } from '../sword-training/SwordTrainingPrefab';
import CafeStregaActor from './CafeStregaActor';
import CafeStregaImage, { type CafeImageGeometry } from './CafeStregaImage';
import CafeStregaTooltip, { instantiateCafeTooltip, type CafeTooltipNativeGeometry } from './CafeStregaTooltip';
import { cafeTooltipShouldClose } from '@/lib/cafeStregaTooltipStateV2';
import { cafeStregaDisplayItemDescription } from '@/lib/cafeStregaItemDescriptionV2';
import { CafeStregaFxmSceneV2, cafeFxmDrawLayoutV2, type CafeFxmInputV2 } from '@/lib/cafeStregaFxmSceneV2';
import CafeStregaRing, { type CafeRingCatalogV2 } from './CafeStregaRing';
import CafeStregaParticles from './CafeStregaParticles';
import type { CafeParticleSourceV2 } from '@/lib/cafeStregaParticleSceneV2';
import { CAFE_MISSION_RESULT_ROOT, CAFE_MISSION_ROOT, CAFE_MISSION_SLOT_TEMPLATE, CAFE_MISSION_SLOT_RUNTIME_OMITTED_ROOTS, CAFE_MISSION_ERRAND_INGREDIENT_REWARD_ROOT, cafeMissionSlotPath, cafeMissionString, instantiateCafeMissionErrandIngredientReward, instantiateCafeMissionLayout, type CafeMissionDataV2, } from '@/lib/cafeStregaMissionV2';
type CafeItem = {
    name: string;
    description: string;
    iconName: string;
    type: string;
    grade: string;
    dateStrId: string | null;
};
type CafeData = CafeMissionDataV2 & {
    ingredientIds: number[];
    recipes: CafeRecipe[];
    items: Record<number, CafeItem>;
    userOverrides: {
        completedMomoIngredientAddition: number;
    };
};
type Layout = CafeSourceV2 & {
    itemAssets: Record<number, (SwordClientAsset & {
        sourceBundle: string;
    })[]>;
    missionIconAssets: Record<string, (SwordClientAsset & {
        sourceBundle: string;
    })[]>;
    evidence: {
        playerSettings: {
            timeManager: Record<string, number>;
        };
    };
};
type DialogueSequence = {
    input: string;
    split: string;
    pureTextCount: number;
    prefixes: string[];
};
type Bundle = {
    layout: Layout;
    data: CafeData;
    imageGeometry: CafeImageGeometry;
    audio: CafeAudioManifestV2;
    dialogue: {
        nodes: Record<string, DialogueSequence[]>;
    };
    tooltipLayout: CafeSourceV2;
    tooltipGeometry: {
        items: Record<number, {
            panelHeight: number;
            parent: {
                sizeDelta: [
                    number,
                    number
                ];
                localPosition: [
                    number,
                    number,
                    number
                ];
            };
        }>;
    };
    ring: CafeRingCatalogV2;
    particles: {
        systems: CafeParticleSourceV2[];
    };
};
type ClipTrack = {
    name: string;
    started: number;
};
type ScriptState = {
    sequence: DialogueSequence;
    index: number;
    started: number;
    outro: number | null;
};
type EntryScriptState = ScriptState & {
    type: 1 | 2;
    shownAt: number;
};
type StorageStatus = 'loading' | 'persisted' | 'memory';
const MAIN = CAFE_ROOT_V2;
const MISSION = CAFE_MISSION_ROOT;
const MISSION_SLOT = CAFE_MISSION_SLOT_TEMPLATE;
const MISSION_RESULT = CAFE_MISSION_RESULT_ROOT;
const DAY_MS = 86400000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const format = (source: string, ...args: (string | number)[]) => source.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)]));
type PrewarmedMissionPrefabProps = {
    open: boolean;
    prewarming: boolean;
    layout: Layout;
    overrides: Record<string, SwordPrefabOverride>;
    elapsedSeconds: number;
    width: number;
    height: number;
    strings: Record<string, string>;
    imageRenderer: SourcePrefabImageRenderer;
};
/** The mission popup owns several full-resolution source canvases. Once its
 * idle prewarm has mounted them, retain the exact pixels and freeze the whole
 * prefab while closed instead of rebuilding those canvases on every click. */
const PrewarmedMissionPrefab = memo(function PrewarmedMissionPrefab({ prewarming, layout, overrides, elapsedSeconds, width, height, strings, imageRenderer, }: PrewarmedMissionPrefabProps) {
    const retainedOverrides = useMemo(() => prewarming ? ({
        ...overrides,
        [MISSION]: { ...overrides[MISSION], active: true },
    }) : overrides, [overrides, prewarming]);
    return <SourcePrefab layout={layout} rootPath={MISSION} width={width} height={height} strings={strings} overrides={retainedOverrides} elapsedSeconds={elapsedSeconds} deferInactiveGraphics retainGraphicsAfterActivation separateDynamicTransforms memoizeSubtrees imageRenderer={imageRenderer}/>;
}, (previous, next) => {
    if (previous.prewarming !== next.prewarming)
        return false;
    if (previous.open || next.open)
        return false;
    return previous.width === next.width
        && previous.height === next.height
        && previous.strings === next.strings
        && previous.imageRenderer === next.imageRenderer;
});
function bindings(layout: Layout) {
    const root = cafeSourceBinding(layout, MAIN, 'NKCUIEventSubUIBar');
    const entry = cafeSourceBinding(layout, root.path('m_eventBarPhaseEntry'), 'NKCUIEventBarPhaseEntry');
    const create = cafeSourceBinding(layout, root.path('m_eventBarPhaseCreate'), 'NKCUIEventBarPhaseCreate');
    const menu = cafeSourceBinding(layout, create.path('m_eventBarCreateMenu'), 'NKCUIEventBarCreateMenu');
    const result = cafeSourceBinding(layout, root.path('m_eventBarResult'), 'NKCUIEventBarResult');
    const home = cafeSourceBinding(layout, MAIN, 'NKCUIModuleHome');
    return { root, entry, create, menu, result, home };
}
export default function CafeStregaClientGame() {
    const router = useRouter();
    const host = useRef<HTMLDivElement>(null);
    const time = useRef(0);
    const hold = useRef<{
        direction: 'up' | 'down';
        config: CafeHoldConfig;
        state: CafeHoldState;
    } | null>(null);
    const audio = useRef<CafeStregaAudioV2 | null>(null);
    const [elapsed, setElapsed] = useState(0);
    const [size, setSize] = useState({ width: 1920, height: 1080 });
    const [bundle, setBundle] = useState<Bundle | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [localState, setLocalState] = useState<CafeStregaLocalState | null>(null);
    const [storageStatus, setStorageStatus] = useState<StorageStatus>('loading');
    const [dailyClock, setDailyClock] = useState(() => Date.now());
    const [selectedDeliveryItemId, setSelectedDeliveryItemId] = useState(0);
    const [entryScript, setEntryScript] = useState<EntryScriptState | null>(null);
    const [bubbleStarted, setBubbleStarted] = useState(0);
    const [entryStateStarted, setEntryStateStarted] = useState(0);
    const [createState, setCreateState] = useState<CafeCreateState>(createCafeCreateState);
    const [phase, setPhase] = useState<'entry' | 'create'>('entry');
    const [track, setTrack] = useState<ClipTrack>({ name: 'SINGLE_CAFE_INTRO', started: 0 });
    const [missionOpened, setMissionOpened] = useState<number | null>(null);
    const [missionStarted, setMissionStarted] = useState<number | null>(null);
    const [missionElapsedBase, setMissionElapsedBase] = useState(0);
    const [missionPrewarmMounted, setMissionPrewarmMounted] = useState(false);
    const [missionPrewarmReadyKey, setMissionPrewarmReadyKey] = useState<string | null>(null);
    const missionLayer = useRef<HTMLDivElement>(null);
    const [result, setResult] = useState<{
        started: number;
        character: number;
    } | null>(null);
    const [npc, setNpc] = useState({ evelyn: { animation: 'IDLE', started: 0, loop: true }, 'yoo-na': { animation: 'IDLE', started: 0, loop: true } });
    const [script, setScript] = useState<ScriptState | null>(null);
    const [pendingHello, setPendingHello] = useState(false);
    const [tooltip, setTooltip] = useState<{
        itemId: number;
        point: {
            x: number;
            y: number;
        };
    } | null>(null);
    const heldInput = useRef({ pointers: new Set<number>(), keys: new Set<string>() });
    const [menuFx, setMenuFx] = useState({ on: false, off: false, onKey: 0, offKey: 0 });
    const frameCommitPending = useRef(false);
    const lastRecipe = useRef<number | null>(null);
    const inventory = useMemo(() => localState?.inventory ?? {}, [localState]);
    const latest = useRef({ inventory, blocked: false });
    latest.current = { inventory, blocked: localState === null || result !== null || missionOpened !== null };
    const canvas = swordClientCanvas(size.width, size.height);
    const missionPrewarmKey = `${canvas.width}:${canvas.height}`;
    const missionPrewarmReady = missionPrewarmReadyKey === missionPrewarmKey;
    const missionElapsedSeconds = missionOpened === null
        ? missionElapsedBase
        : missionElapsedBase + Math.max(0, elapsed - missionOpened);
    useLayoutEffect(() => { frameCommitPending.current = false; }, [elapsed]);
    const source = useMemo(() => bundle ? bindings(bundle.layout) : null, [bundle]);
    const enterEntryPhase = useCallback(() => {
        if (!source)
            return;
        setPhase('entry');
        if (menuFx.on) {
            setMenuFx(previous => ({ ...previous, off: true, offKey: previous.offKey + 1 }));
            audio.current?.activate(source.create.path('m_objMenuSelectOffFx'));
        }
        setScript(null);
        setEntryScript(null);
        setPendingHello(false);
        setTooltip(null);
        hold.current = null;
        setTrack({ name: 'SINGLE_CAFE_STEP_02to01', started: time.current });
    }, [source, menuFx.on]);
    const catalog = useMemo<CafeStregaLocalCatalog | null>(() => bundle ? {
        ingredientIds: bundle.data.ingredientIds,
        recipes: bundle.data.recipes,
    } : null, [bundle]);
    const dailyOrder = useMemo(() => catalog && localState
        ? getCafeStregaDailyOrder(catalog, localState, dailyClock)
        : null, [catalog, localState, dailyClock]);
    const dailyOrderDayKey = dailyOrder?.dayKey ?? null;
    const dailyRemainingDeliveryCount = dailyOrder?.remainingDeliveryCount ?? null;
    const currentDeliveryStatus = bundle
        ? cafeDeliveryStatus(bundle.data.recipes, inventory, dailyOrder, selectedDeliveryItemId)
        : 'unknown';
    const commitLocalState = useCallback((next: CafeStregaLocalState, now = Date.now()) => {
        if (!catalog)
            return;
        const saved = saveCafeStregaLocalState(catalog, next, now);
        setLocalState(saved.state);
        setDailyClock(now);
        setStorageStatus(saved.persisted ? 'persisted' : 'memory');
    }, [catalog]);
    const loadMutationState = useCallback((now: number) => {
        if (!catalog || !localState)
            return null;
        if (storageStatus === 'memory')
            return localState;
        const loaded = loadCafeStregaLocalState(catalog, now);
        return loaded.storageAvailable ? loaded.state : localState;
    }, [catalog, localState, storageStatus]);
    const openEntryScript = useCallback((type: 1 | 2, input: string) => {
        if (!bundle || !source)
            return;
        const path = source.entry.path(type === 1 ? 'm_lbType1Msg' : 'm_lbType2Msg');
        const sequence = bundle.dialogue.nodes[path]?.find(value => value.input === input);
        if (!sequence) {
            setError(`Original Cafe delivery dialogue sequence missing: ${input}`);
            return;
        }
        setEntryScript(previous => ({
            type,
            sequence,
            index: 0,
            started: previous?.started ?? time.current,
            shownAt: time.current,
            outro: previous?.outro ?? null,
        }));
    }, [bundle, source]);
    const fxm = useMemo(() => {
        if (!bundle)
            return null;
        // NKCUISlot.SetMiscItemData -> TurnOffExtraUI -> SetAwakenFX(null).
        // The RawImage awaken evaluator therefore never runs for these RT_MISC rewards.
        const runtimeLayout = { ...bundle.layout, nodes: bundle.layout.nodes.map(node => node.path.includes('/FX_AWAKEN_MASK/')
                ? { ...node, components: node.components.filter(component => component.type !== 'NKC_FXM_UI_RAW_IMAGE_PMA') }
                : node) };
        return new CafeStregaFxmSceneV2(runtimeLayout, bundle.layout.evidence.playerSettings.timeManager['Maximum Particle Timestep']);
    }, [bundle]);
    const runtimeIndex = useMemo(() => {
        if (!bundle)
            return null;
        const nodes = new Map(bundle.layout.nodes.map(node => [node.path, node]));
        const animations = new Map(bundle.layout.animations.map(clip => [clip.name, clip]));
        const assets = new Map(bundle.layout.assets.map(asset => [asset.id, asset]));
        const itemSprites = new Map(Object.entries(bundle.layout.itemAssets).map(([itemId, values]) => {
            const sprite = values.find(asset => asset.sourceBundle === 'ab_inven_icon_item_misc.asset');
            if (!sprite)
                throw new Error(`Original full-size item sprite missing ${itemId}`);
            return [Number(itemId), sprite] as const;
        }));
        const missionIcons = new Map(Object.entries(bundle.layout.missionIconAssets).map(([iconName, values]) => {
            const sprite = values.find(asset => asset.sourceBundle === 'ab_ui_nkm_ui_mission_sprite.asset');
            if (!sprite)
                throw new Error(`Original Cafe mission icon missing ${iconName}`);
            return [iconName, sprite] as const;
        }));
        const skeletonNodes = bundle.layout.nodes.filter(node => node.components.some(component => component.type === 'SkeletonGraphic'));
        const resourcePanelPaths = bundle.layout.nodes.filter(node => node.components.some(component => component.type === 'NKCUIComResourcePanel')).map(node => node.path);
        const ringModifiers = new Map(bundle.ring.renderers.map(ring => {
            const modifier = bundle.layout.nodes.flatMap(node => node.components).find(component => component.type === 'NKC_FXM_MATERIAL_UI'
                && component.references.some(ref => ref.field === 'Target' && ref.nodePath === ring.path));
            if (!modifier)
                throw new Error(`Original ring material evaluator missing: ${ring.path}`);
            return [ring.path, modifier] as const;
        }));
        return { nodes, animations, assets, itemSprites, missionIcons, skeletonNodes, resourcePanelPaths, ringModifiers };
    }, [bundle]);
    const particleRenderIndex = useMemo(() => {
        if (!bundle || !runtimeIndex)
            return null;
        return new Map(bundle.particles.systems.map(particle => {
            const node = runtimeIndex.nodes.get(particle.path);
            if (!node)
                throw new Error(`Original particle node is missing: ${particle.path}`);
            const rect = swordClientWorldRect(bundle.layout, particle.path, canvas.width, canvas.height);
            const controller = particle.controller
                ? runtimeIndex.nodes.get(particle.controller.path)?.components.find(component => component.type === 'NKC_FXM_PARTICLE_SYSTEM_RENDERER')
                : null;
            if (particle.controller && !controller)
                throw new Error(`Original particle controller is missing: ${particle.controller.path}`);
            return [particle.path, { node, rect, controller }] as const;
        }));
    }, [bundle, runtimeIndex, canvas.width, canvas.height]);
    const imageRenderer = useCallback<SourcePrefabImageRenderer>(props => bundle
        ? <CafeStregaImage {...props} geometry={bundle.imageGeometry}/>
        : undefined, [bundle]);
    const recipeId = bundle ? cafeRecipeForSelection(bundle.data.recipes, createState)?.itemId ?? null : null;
    useEffect(() => {
        if (!source || phase !== 'create' || recipeId === lastRecipe.current)
            return;
        const hadRecipe = lastRecipe.current !== null;
        lastRecipe.current = recipeId;
        if (recipeId !== null) {
            setMenuFx(previous => ({ ...previous, on: true, off: false, onKey: previous.onKey + 1 }));
            audio.current?.activate(source.create.path('m_objMenuSelectOnFx'));
        }
        else if (hadRecipe) {
            setMenuFx(previous => ({ ...previous, off: true, offKey: previous.offKey + 1 }));
            audio.current?.activate(source.create.path('m_objMenuSelectOffFx'));
        }
    }, [source, phase, recipeId]);
    useEffect(() => {
        const controller = new AbortController();
        const load = async <T,>(name: string): Promise<T> => {
            const response = await fetch(deploymentUrl(`${CAFE_SOURCE_V2}/${name}`), { signal: controller.signal });
            if (!response.ok)
                throw new Error(`원본 카페 리소스 ${name}: HTTP ${response.status}`);
            return response.json();
        };
        void Promise.all([load<Layout>('layout.json'), load<CafeData>('client-data.json'), load<NativeTextCatalog>('native-text/native-text.json'), load<CafeImageGeometry>('image-native-geometry.json'), load<SwordNativeLegacyLayouts>('native-legacy-layouts.json'), load<CafeNativeNumericCatalog>('native-numbers.json'), load<CafeAudioManifestV2>('audio.json'), load<Bundle['dialogue']>('native-dialogue-sequences.json'), load<CafeSourceV2>('tooltip-layout.json'), load<CafeNativeNumericCatalog>('native-aux-numbers.json'), load<Bundle['tooltipGeometry']>('tooltip-native-geometry.json'), load<CafeRingCatalogV2>('ring-mesh.json'), load<Bundle['particles']>('fx-native.json')])
            .then(([layout, data, text, imageGeometry, legacy, numbers, audio, dialogue, tooltipLayout, auxNumbers, tooltipGeometry, ring, particles]) => {
            if (controller.signal.aborted)
                return;
            const rawSource = bindings(layout);
            const removedRuntimeRoots = [
                rawSource.create.path('m_objCreateFx'),
                `${MISSION}/POPUP_SINGLE_CAFE_REWARD`,
                ...CAFE_MISSION_SLOT_RUNTIME_OMITTED_ROOTS,
                `${MISSION}/Content/Mission/Bottom/ERRAND_Root/MY_SCORE`,
                `${MISSION}/Content/Mission/Bottom/ERRAND_Root/STEP`,
            ];
            const retainedRuntimePath = (path: string) => !removedRuntimeRoots.some(root => path === root || path.startsWith(root + '/'));
            const retainedRoots = [MAIN, MISSION, MISSION_SLOT];
            const presentation = instantiateCafeMissionErrandIngredientReward(layout);
            const relevant = { ...presentation,
                nodes: presentation.nodes.filter(node => retainedRoots.some(root => node.path === root || node.path.startsWith(root + '/'))
                    && retainedRuntimePath(node.path)),
                animations: layout.animations,
            };
            const now = Date.now();
            const loaded = loadCafeStregaLocalState({ ingredientIds: data.ingredientIds, recipes: data.recipes }, now);
            const saved = loaded.needsPersistence
                ? saveCafeStregaLocalState({ ingredientIds: data.ingredientIds, recipes: data.recipes }, loaded.state, now)
                : null;
            setLocalState(saved?.state ?? loaded.state);
            setStorageStatus(loaded.storageAvailable && (!saved || saved.persisted) ? 'persisted' : 'memory');
            setDailyClock(now);
            const numeric = { ...numbers, nodes: { ...numbers.nodes, ...auxNumbers.nodes }, styles: { ...numbers.styles, ...auxNumbers.styles } };
            const native = <T extends CafeSourceV2,>(value: T) => attachCafeNativeTextV2(attachSwordTrainingNativeText(value, text) as T, legacy, numeric);
            const nativeLayout = native(relevant);
            const missionLayout = instantiateCafeMissionLayout(nativeLayout, data.missionTab.rows, []) as Layout;
            setBundle({ layout: missionLayout, data, imageGeometry, audio, dialogue,
                tooltipLayout: native(instantiateCafeTooltip(tooltipLayout)), tooltipGeometry, ring,
                particles: { ...particles, systems: particles.systems.filter(particle => retainedRuntimePath(particle.path)) } });
        }).catch((cause: unknown) => { if (!controller.signal.aborted)
            setError(cause instanceof Error ? cause.message : String(cause)); });
        return () => controller.abort();
    }, []);
    useEffect(() => {
        if (!bundle || !source)
            return;
        const preloadKeys = new Set<string>([bundle.audio.bgmBinding.BgmAssetID]);
        const activationPaths = new Set([
            source.create.path('m_objMenuSelectOnFx'),
            source.create.path('m_objMenuSelectOffFx'),
            source.result.node.path,
            MISSION_RESULT,
        ]);
        for (const binding of bundle.audio.bindings) {
            if (activationPaths.has(binding.path))
                preloadKeys.add(binding.value.AssetName);
        }
        for (const node of bundle.layout.nodes) {
            for (const component of node.components) {
                if (component.type !== 'NKCUIComStateButton')
                    continue;
                const key = component.fields.m_SoundForPointClick;
                if (typeof key === 'string' && key)
                    preloadKeys.add(key);
            }
        }
        const bus = new CafeStregaAudioV2(bundle.audio, setError);
        audio.current = bus;
        bus.preload(preloadKeys);
        return () => { bus.dispose(); if (audio.current === bus)
            audio.current = null; };
    }, [bundle, source]);
    useEffect(() => {
        if (!catalog)
            return;
        const receive = (event: StorageEvent) => {
            if (event.storageArea !== window.localStorage || event.key !== CAFE_STREGA_LOCAL_STATE_KEY && event.key !== null)
                return;
            const now = Date.now();
            const loaded = loadCafeStregaLocalState(catalog, now);
            const saved = loaded.needsPersistence ? saveCafeStregaLocalState(catalog, loaded.state, now) : null;
            setLocalState(saved?.state ?? loaded.state);
            setStorageStatus(loaded.storageAvailable && (!saved || saved.persisted) ? 'persisted' : 'memory');
            setDailyClock(now);
        };
        window.addEventListener('storage', receive);
        return () => window.removeEventListener('storage', receive);
    }, [catalog]);
    useEffect(() => {
        if (!catalog || !localState)
            return;
        const now = Date.now();
        const shifted = now + KST_OFFSET_MS;
        const nextKstMidnight = (Math.floor(shifted / DAY_MS) + 1) * DAY_MS - KST_OFFSET_MS;
        const timer = window.setTimeout(() => {
            const current = Date.now();
            const mutationState = loadMutationState(current);
            if (!mutationState)
                return;
            const saved = saveCafeStregaLocalState(catalog, mutationState, current);
            setLocalState(saved.state);
            setStorageStatus(saved.persisted ? 'persisted' : 'memory');
            setDailyClock(current);
            setSelectedDeliveryItemId(0);
        }, Math.max(1, nextKstMidnight - now + 25));
        return () => window.clearTimeout(timer);
    }, [catalog, localState, loadMutationState]);
    useEffect(() => {
        if (!bundle || !source || dailyOrderDayKey === null || dailyRemainingDeliveryCount === null || phase !== 'entry')
            return;
        const finished = dailyRemainingDeliveryCount <= 0;
        setSelectedDeliveryItemId(0);
        setBubbleStarted(time.current);
        setEntryStateStarted(time.current);
        setNpc(previous => ({ ...previous, evelyn: {
                animation: finished ? 'LAUGH' : 'IDLE', started: time.current, loop: true,
            } }));
        if (finished)
            openEntryScript(1, bundle.data.strings[String(source.entry.fields.m_GiveEnd)]);
        else
            setEntryScript(null);
    }, [bundle, source, dailyOrderDayKey, dailyRemainingDeliveryCount, phase, openEntryScript]);
    useEffect(() => {
        if (!host.current)
            return;
        const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
        observer.observe(host.current);
        return () => observer.disconnect();
    }, []);
    useEffect(() => {
        if (!source || missionPrewarmMounted)
            return;
        let cancelled = false;
        let delayHandle: ReturnType<typeof setTimeout> | null = null;
        let idleHandle: number | null = null;
        let fallbackHandle: ReturnType<typeof setTimeout> | null = null;
        const mount = () => {
            if (!cancelled)
                setMissionPrewarmMounted(true);
        };
        const scheduleIdle = () => {
            if (cancelled)
                return;
            const idleWindow = window as Window & {
                requestIdleCallback?: Window['requestIdleCallback'];
            };
            if (typeof idleWindow.requestIdleCallback === 'function') {
                idleHandle = idleWindow.requestIdleCallback(mount, { timeout: 750 });
            }
            else {
                fallbackHandle = globalThis.setTimeout(mount, 0);
            }
        };
        // Do not move the popup raster work into SINGLE_CAFE_INTRO. Check the
        // clamped game clock as well as wall time: a long initial frame must not
        // make the prewarm race ahead of the source's own intro epoch.
        const waitForSourceIntro = () => {
            if (cancelled)
                return;
            const remaining = Number(source.root.fields.m_introDuration) - time.current;
            if (remaining <= 0) {
                scheduleIdle();
                return;
            }
            delayHandle = globalThis.setTimeout(waitForSourceIntro, Math.max(1, remaining * 1000));
        };
        waitForSourceIntro();
        return () => {
            cancelled = true;
            if (delayHandle !== null)
                clearTimeout(delayHandle);
            if (idleHandle !== null)
                window.cancelIdleCallback(idleHandle);
            if (fallbackHandle !== null)
                clearTimeout(fallbackHandle);
        };
    }, [source, missionPrewarmMounted]);
    useEffect(() => {
        if (!missionPrewarmMounted || missionPrewarmReady)
            return;
        let cancelled = false;
        let frame = 0;
        let stableFrames = 0;
        const inspect = () => {
            if (cancelled)
                return;
            const layer = missionLayer.current;
            const root = layer?.querySelector(`[data-source-node="${MISSION}"]`);
            const statuses = layer ? [...layer.querySelectorAll<HTMLElement>('[data-source-status], [data-cafe-actor-status]')] : [];
            const pending = statuses.some(element => (element.dataset.sourceStatus ?? element.dataset.cafeActorStatus) === 'loading');
            const failed = statuses.some(element => (element.dataset.sourceStatus ?? element.dataset.cafeActorStatus) === 'error');
            stableFrames = root && statuses.length > 0 && !pending && !failed ? stableFrames + 1 : 0;
            if (stableFrames >= 2) {
                setMissionPrewarmReadyKey(missionPrewarmKey);
                return;
            }
            frame = requestAnimationFrame(inspect);
        };
        frame = requestAnimationFrame(inspect);
        return () => { cancelled = true; cancelAnimationFrame(frame); };
    }, [missionPrewarmMounted, missionPrewarmReady, missionPrewarmKey]);
    useEffect(() => {
        if (!bundle)
            return;
        let frame = 0, previous: number | null = null;
        const tick = (now: number) => {
            // Unity has one Update per presented frame. React may still have the
            // previous very large source-prefab render pending when another browser
            // rAF arrives, so do not enqueue a second game frame before that commit.
            if (frameCommitPending.current) {
                frame = requestAnimationFrame(tick);
                return;
            }
            if (previous === null) {
                previous = now;
                frame = requestAnimationFrame(tick);
                return;
            }
            const dt = Math.min((now - previous) / 1000, bundle.layout.evidence.playerSettings.timeManager['Maximum Allowed Timestep']);
            time.current += dt;
            if (hold.current && !latest.current.blocked) {
                const current = hold.current, advanced = cafeAdvanceHold(current.state, current.config, dt, heldInput.current.pointers.size);
                current.state = advanced.state;
                if (advanced.invocations)
                    setCreateState(previous => {
                        let next = previous;
                        for (let index = 0; index < advanced.invocations; index++)
                            next = cafeChangeQuantity(bundle.data.recipes, next, latest.current.inventory, current.direction);
                        return next;
                    });
            }
            previous = now;
            frameCommitPending.current = true;
            startTransition(() => setElapsed(time.current));
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [bundle]);
    useEffect(() => {
        const release = (event: Event) => {
            hold.current = null;
            if (event instanceof PointerEvent)
                heldInput.current.pointers.delete(event.pointerId);
            else {
                heldInput.current.pointers.clear();
                heldInput.current.keys.clear();
            }
            if (!heldInput.current.pointers.size && !heldInput.current.keys.size)
                setTooltip(null);
        };
        const keyDown = (event: KeyboardEvent) => { heldInput.current.keys.add(event.code); audio.current?.unlock(); };
        const keyUp = (event: KeyboardEvent) => {
            heldInput.current.keys.delete(event.code);
            hold.current = null;
            if (!heldInput.current.pointers.size && !heldInput.current.keys.size)
                setTooltip(null);
        };
        window.addEventListener('pointerup', release);
        window.addEventListener('pointercancel', release);
        window.addEventListener('blur', release);
        window.addEventListener('keydown', keyDown, true);
        window.addEventListener('keyup', keyUp, true);
        return () => {
            window.removeEventListener('pointerup', release);
            window.removeEventListener('pointercancel', release);
            window.removeEventListener('blur', release);
            window.removeEventListener('keydown', keyDown, true);
            window.removeEventListener('keyup', keyUp, true);
        };
    }, []);
    useEffect(() => {
        if (!result || !source || elapsed - result.started < Number(source.result.fields.m_fRewardPopupTimer))
            return;
        // Keep the Cafe-specific three-second result sequence, then return to the
        // Cafe entry screen without opening the account-oriented reward UI.
        setResult(null);
        enterEntryPhase();
    }, [result, source, elapsed, enterEntryPhase]);
    useEffect(() => {
        if (!bundle || !source || phase !== 'create')
            return;
        if (pendingHello) {
            const clip = bundle.layout.animations.find(clip => clip.name === track.name)!;
            const attributes = sampleSwordTrainingClientAnimation(clip, elapsed - track.started);
            if (attributes['PHASE - 2']?.m_IsActive === 0)
                return;
            const input = bundle.data.strings[String(source.create.fields.m_BartenderHello)];
            const sequence = bundle.dialogue.nodes[source.create.path('m_lbScriptMsg')].find(sequence => sequence.input === input);
            if (!sequence)
                throw new Error('Original manufacture greeting sequence missing');
            setScript({ sequence, index: 0, started: elapsed, outro: null });
            setPendingHello(false);
        }
        else
            setScript(previous => {
                if (!previous)
                    return previous;
                if (previous.index < previous.sequence.pureTextCount)
                    return { ...previous, index: previous.index + 1 };
                if (previous.outro === null && elapsed - previous.started >= Number(source.create.fields.m_showScriptTime))
                    return { ...previous, outro: elapsed };
                if (previous.outro !== null) {
                    const clip = bundle.layout.animations.find(clip => clip.name === 'SINGLE_CAFE_SCRIPT_OUTRO')!;
                    const sample = sampleSwordTrainingClientAnimation(clip, elapsed - previous.outro);
                    if (sample.Bg?.m_Alpha === 0)
                        return null;
                }
                return previous;
            });
    }, [bundle, source, elapsed, phase, pendingHello, track]);
    useEffect(() => {
        if (!bundle || !source || phase !== 'entry')
            return;
        setEntryScript(previous => {
            if (!previous)
                return previous;
            if (previous.index < previous.sequence.pureTextCount)
                return { ...previous, index: previous.index + 1 };
            if (previous.outro === null && elapsed - previous.shownAt >= Number(source.entry.fields.m_showScriptTime)) {
                return { ...previous, outro: elapsed };
            }
            if (previous.outro !== null) {
                const clip = bundle.layout.animations.find(value => value.name === 'SINGLE_CAFE_SCRIPT_OUTRO')!;
                const sample = sampleSwordTrainingClientAnimation(clip, elapsed - previous.outro);
                if (sample.Bg?.m_Alpha === 0)
                    return null;
            }
            return previous;
        });
    }, [bundle, source, elapsed, phase]);
    useEffect(() => {
        const element = host.current;
        if (!element || !bundle || phase !== 'create' || createState.step !== 'amount')
            return;
        const wheel = (event: WheelEvent) => {
            if (latest.current.blocked || event.deltaY === 0)
                return;
            event.preventDefault();
            setCreateState(previous => cafeChangeQuantity(bundle.data.recipes, previous, latest.current.inventory, event.deltaY > 0 ? 'down' : 'up'));
        };
        element.addEventListener('wheel', wheel, { passive: false });
        return () => element.removeEventListener('wheel', wheel);
    }, [bundle, phase, createState.step]);
    useEffect(() => {
        if (!bundle || !catalog || missionStarted === null)
            return;
        const clip = bundle.layout.animations.find(clip => clip.name === 'POPUP_SINGLE_CAFE_MISSION_RESULT_INTRO');
        if (!clip)
            throw new Error('Original Momo animation missing');
        if (elapsed - missionStarted >= clip.stopTime) {
            const now = Date.now();
            const current = loadMutationState(now);
            if (!current)
                return;
            const nextInventory = completeCafeLocalMomo(current.inventory, bundle.data.ingredientIds);
            commitLocalState(replaceCafeStregaLocalInventory(catalog, current, nextInventory, now), now);
            setMissionStarted(null);
        }
    }, [bundle, catalog, elapsed, missionStarted, loadMutationState, commitLocalState]);
    const closeMissionLayer = useCallback(() => {
        if (missionStarted !== null || missionOpened === null)
            return;
        setMissionElapsedBase(previous => previous + Math.max(0, time.current - missionOpened));
        setMissionOpened(null);
    }, [missionOpened, missionStarted]);
    const baseView = useMemo(() => {
        if (!bundle || !source)
            return null;
        const { data } = bundle, { root, entry, create, menu, home } = source;
        let layout = bundle.layout;
        const mission = cafeSourceBinding(layout, MISSION, 'NKCPopupEventBarMission');
        const missionGroup = cafeSourceBinding(layout, mission.path('m_comMissionGroup'), 'NKCUIComMissionGroup');
        const overrides: Record<string, SwordPrefabOverride> = {};
        const hotkeys: Record<string, () => void> = {};
        const patch = (path: string, value: SwordPrefabOverride) => { overrides[path] = { ...overrides[path], ...value, attributes: { ...overrides[path]?.attributes, ...value.attributes } }; };
        const active = (path: string | null, value: boolean) => { if (path)
            patch(path, { active: value }); };
        const text = (path: string, value: string) => patch(path, { text: value });
        const item = (id: number) => {
            const value = data.items[id];
            if (!value)
                throw new Error(`Original Cafe item missing ${id}`);
            return value;
        };
        const itemImage = (path: string, id: number, color?: readonly [
            number,
            number,
            number,
            number
        ]) => {
            const asset = runtimeIndex?.itemSprites.get(id);
            if (!asset)
                throw new Error(`Original full-size item sprite missing ${id}`);
            layout = cafeBindSourceImage(layout, path, asset, color) as Layout;
        };
        const button = (path: string, label: string, callback: () => void, locked = false, selected = false) => {
            hotkeys[path] = callback;
            const binding = cafeSourceBinding(layout, path, 'NKCUIComStateButton');
            patch(path, { label, locked, onClick: () => {
                    const key = String(binding.fields.m_SoundForPointClick ?? '');
                    if (key)
                        audio.current?.play(key);
                    callback();
                } });
            active(binding.optionalPath('m_ButtonBG_Normal'), !locked && !selected);
            active(binding.optionalPath('m_ButtonBG_Selected'), !locked && selected);
            active(binding.optionalPath('m_ButtonBG_Locked'), locked);
        };
        active(root.path('m_eventBarResult'), result !== null);
        const blocked = localState === null || result !== null || missionOpened !== null;
        const orderRecipe = dailyOrder ? data.recipes[dailyOrder.recipeIndex] : null;
        const orderActive = Boolean(dailyOrder && dailyOrder.remainingDeliveryCount > 0);
        const orderFinished = Boolean(dailyOrder && dailyOrder.remainingDeliveryCount <= 0);
        active(entry.path('m_eventBarBubble'), orderActive);
        active(entry.path('m_objBarLock'), orderFinished);
        active(entry.path('m_objLaughFx'), orderFinished);
        active(entry.path('m_objScriptRoot'), entryScript !== null);
        active(entry.path('m_objScriptType1'), entryScript?.type === 1);
        active(entry.path('m_objScriptType2'), entryScript?.type === 2);
        if (dailyOrder && orderRecipe) {
            const bubble = cafeSourceBinding(layout, entry.path('m_eventBarBubble'), 'NKCUIEventBarBubble');
            itemImage(bubble.path('m_imgCocktail'), dailyOrder.itemId);
            text(bubble.path('m_lbDeliveryCount'), `x${orderRecipe.delivery.count}`);
            const clip = runtimeIndex!.animations.get('SINGLE_CAFE_ORDER_IDLE')!;
            const hideTime = Number(bubble.fields.m_hideTime);
            const cycle = hideTime + clip.stopTime;
            button(bubble.path('m_csbtnButton'), `오늘의 주문: ${item(dailyOrder.itemId).name} ${orderRecipe.delivery.count}잔`, () => {
                openEntryScript(1, format(data.strings[String(entry.fields.m_SelectCocktail)], item(dailyOrder.itemId).name, orderRecipe.delivery.count));
                const currentAt = Math.max(0, time.current - bubbleStarted) % cycle;
                const rewind = Number(bubble.fields.m_rewindAniTime);
                if (currentAt >= hideTime && (currentAt - hideTime) / clip.stopTime > rewind) {
                    setBubbleStarted(time.current - hideTime - rewind * clip.stopTime);
                }
            }, blocked);
        }
        active(entry.path('m_objErrandRedDot'), false);
        text(root.path('m_lbEventLimitDate'), '');
        active(create.path('m_objScriptRoot'), script !== null);
        active(create.path('m_objMenuSelectOnFx'), menuFx.on);
        active(create.path('m_objMenuSelectOffFx'), menuFx.off);
        // NKCPopupEventBarMission is FullScreen. UIOpened(true) hides the
        // underlying UI stack entry while the mission popup owns the screen.
        active(MAIN, missionOpened === null);
        active(MISSION, missionOpened !== null);
        active(MISSION_RESULT, missionStarted !== null);
        const showTooltip = (path: string, itemId: number) => patch(path, { onPointerDown: point => {
                if (!blocked)
                    setTooltip({ itemId, point: { x: point.x, y: point.y } });
            } });
        const animateNpc = (kind: 'evelyn' | 'yoo-na', animation: string) => setNpc(previous => ({ ...previous, [kind]: { animation, started: time.current, loop: false } }));
        const changePhase = (next: 'entry' | 'create') => {
            if (blocked || next === 'create' && time.current < Number(root.fields.m_introDuration))
                return;
            if (next === 'entry') {
                enterEntryPhase();
                return;
            }
            setPhase('create');
            setCreateState(createCafeCreateState());
            lastRecipe.current = null;
            setMenuFx({ on: false, off: false, onKey: 0, offKey: 0 });
            setScript(null);
            setEntryScript(null);
            setPendingHello(true);
            setNpc(previous => ({ ...previous, 'yoo-na': { animation: 'IDLE', started: time.current, loop: true } }));
            setTrack({ name: 'SINGLE_CAFE_STEP_01to02', started: time.current });
        };
        button(root.path('m_csbtnCreatePhase'), '음료 제조', () => changePhase('create'), blocked);
        button(root.path('m_csbtnInitialPhase'), '카페로 돌아가기', () => changePhase('entry'), blocked);
        button(home.path('m_csbtnClose'), '미니게임 목록', () => router.push("/minigames/"), blocked);
        button(entry.path('m_csbtnMomoErrand'), '모모의 심부름', () => {
            if (blocked)
                return;
            setMissionPrewarmMounted(true);
            setMissionStarted(null);
            setMissionOpened(time.current);
        }, blocked);
        button(mission.path('m_csbtnClose'), '돌아가기', closeMissionLayer, missionStarted !== null);
        active(mission.path('m_csbtnCompleteAll'), false);
        active(mission.path('m_csbtnEventShop'), false);
        active(mission.path('m_csbtnErrandRawardList'), false);
        active(`${MISSION}/Content/Mission/Top/Notice`, false);
        button(missionGroup.path('m_csbtnRewardGet'), '심부름 가기', () => {
            if (missionStarted !== null)
                return;
            setMissionStarted(time.current);
            audio.current?.activate(MISSION_RESULT, true);
        }, missionStarted !== null);
        active(missionGroup.path('m_csbtnRewardLocked'), false);
        patch(mission.path('m_LoopScrollRect'), { scrollResetKey: missionOpened ?? 0, scrollHotkeys: missionOpened !== null });
        const resetLabels: Record<string, string> = {
            DAILY: cafeMissionString('SI_DP_MISSION_RESET_INTERVAL_DAILY', data.strings),
            WEEKLY: cafeMissionString('SI_DP_MISSION_RESET_INTERVAL_WEEKLY', data.strings),
            MONTHLY: cafeMissionString('SI_DP_MISSION_RESET_INTERVAL_MONTHLY', data.strings),
        };
        for (const row of data.missionTab.rows) {
            const path = cafeMissionSlotPath(row.m_MissionID);
            const slot = cafeSourceBinding(layout, path, 'NKCUIMissionAchieveSlot');
            const resetInterval = row.m_ResetInterval;
            const repeatMission = resetInterval !== 'NONE';
            if (repeatMission && resetLabels[resetInterval] === undefined)
                throw new Error(`Unsupported original Cafe mission reset interval ${resetInterval}`);
            const iconName = row.m_MissionIcon;
            const icon = typeof iconName === 'string' ? runtimeIndex?.missionIcons.get(iconName) : undefined;
            if (!icon)
                throw new Error(`Original Cafe mission icon missing ${String(iconName)}`);
            active(path, true);
            layout = cafeBindSourceImage(layout, slot.path('m_ImgMissionIcon'), icon) as Layout;
            active(slot.path('m_NKM_UI_MISSION_LIST_SLOT_REPEAT_BADGE'), repeatMission);
            active(slot.path('m_NKM_UI_MISSION_LIST_SLOT_BADGE_BG_DAILY'), resetInterval === 'DAILY');
            active(slot.path('m_NKM_UI_MISSION_LIST_SLOT_BADGE_BG_WEEKLY'), resetInterval === 'WEEKLY');
            active(slot.path('m_NKM_UI_MISSION_LIST_SLOT_BADGE_BG_MONTHLY'), resetInterval === 'MONTHLY');
            if (repeatMission)
                text(slot.path('m_NKM_UI_MISSION_LIST_SLOT_REPEAT_BADGE_Text'), resetLabels[resetInterval]);
            text(slot.path('m_NKM_UI_MISSION_LIST_SLOT_MISSION_EXPLAIN'), cafeMissionString(row.m_MissionDesc, data.strings));
        }
        if (script) {
            text(create.path('m_lbScriptMsg'), script.index >= script.sequence.pureTextCount ? script.sequence.split : script.sequence.prefixes[script.index]);
            button(create.path('m_csbtnScriptPanel'), '대사', () => setScript(previous => !previous ? null : previous.index < previous.sequence.pureTextCount
                ? { ...previous, index: previous.sequence.pureTextCount } : null));
        }
        if (entryScript) {
            const messagePath = entry.path(entryScript.type === 1 ? 'm_lbType1Msg' : 'm_lbType2Msg');
            text(messagePath, entryScript.index >= entryScript.sequence.pureTextCount
                ? entryScript.sequence.split
                : entryScript.sequence.prefixes[entryScript.index]);
            if (entryScript.type === 1) {
                button(entry.path('m_csbtnScriptPanel'), '대사', () => setEntryScript(previous => {
                    if (!previous || previous.type !== 1)
                        return previous;
                    return previous.index < previous.sequence.pureTextCount
                        ? { ...previous, index: previous.sequence.pureTextCount }
                        : null;
                }));
            }
            else {
                button(entry.path('m_csbtnStay'), '다른 메뉴로', () => {
                    openEntryScript(1, data.strings[String(entry.fields.m_GiveCancel)]);
                }, blocked);
                button(entry.path('m_csbtnGive'), '부탁한다', () => {
                    if (!catalog)
                        return;
                    const now = Date.now();
                    const current = loadMutationState(now);
                    if (!current)
                        return;
                    const currentOrder = getCafeStregaDailyOrder(catalog, current, now);
                    if (!dailyOrder || currentOrder.dayKey !== dailyOrder.dayKey || currentOrder.itemId !== dailyOrder.itemId) {
                        setSelectedDeliveryItemId(0);
                        setEntryScript(null);
                        commitLocalState(current, now);
                        return;
                    }
                    const status = cafeDeliveryStatus(data.recipes, current.inventory, currentOrder, selectedDeliveryItemId);
                    if (status === 'wrong') {
                        commitLocalState(current, now);
                        openEntryScript(2, data.strings[String(entry.fields.m_WrongCocktail)]);
                        return;
                    }
                    if (status === 'shortage') {
                        commitLocalState(current, now);
                        openEntryScript(2, format(data.strings[String(entry.fields.m_NeedMoreCocktail)], data.recipes[currentOrder.recipeIndex].delivery.count));
                        return;
                    }
                    if (status === 'finished') {
                        setSelectedDeliveryItemId(0);
                        setEntryScript(null);
                        commitLocalState(current, now);
                        return;
                    }
                    if (status !== 'ready')
                        return;
                    const delivery = deliverCafeStregaDailyOrder(catalog, current, now);
                    if (delivery.status !== 'delivered')
                        return;
                    setEntryScript(null);
                    commitLocalState(delivery.state, now);
                }, blocked);
            }
        }
        for (const path of runtimeIndex!.resourcePanelPaths) {
            const resource = cafeSourceBinding(layout, path, 'NKCUIComResourcePanel');
            (resource.fields.resourceInfo as {
                itemId: number;
            }[]).forEach((value, index) => {
                const count = path === CAFE_MISSION_ERRAND_INGREDIENT_REWARD_ROOT
                    ? data.userOverrides.completedMomoIngredientAddition
                    : inventory[value.itemId] ?? 0;
                text(resource.path(`resourceInfo[${index}].countTextUI`), String(count));
                itemImage(resource.path(`resourceInfo[${index}].iconImageUI`), value.itemId);
                showTooltip(resource.path(`resourceInfo[${index}].csbtnButton`), value.itemId);
            });
        }
        data.recipes.forEach((recipe, index) => {
            const slot = cafeSourceBinding(layout, entry.path(`m_EventBarCocktailSlotArray[${index}]`), 'NKCUIEventBarCocktailSlot');
            const count = inventory[recipe.itemId] ?? 0;
            text(slot.path('m_lbCockTailName'), item(recipe.itemId).name);
            text(slot.path('m_lbCockTailCount'), String(count));
            active(slot.path('m_objNone'), count <= 0);
            active(slot.path('m_objSelect'), selectedDeliveryItemId === recipe.itemId);
            itemImage(slot.path('m_imgCockTailIcon'), recipe.itemId, count <= 0 ? [145 / 255, 145 / 255, 145 / 255, 1] : [1, 1, 1, 1]);
            button(slot.path('m_csbtnSlot'), `${item(recipe.itemId).name} 납품 선택`, () => {
                if (!dailyOrder || dailyOrder.remainingDeliveryCount <= 0)
                    return;
                const selected = selectedDeliveryItemId === recipe.itemId ? 0 : recipe.itemId;
                setSelectedDeliveryItemId(selected);
                if (selected === 0) {
                    const requested = data.recipes[dailyOrder.recipeIndex];
                    openEntryScript(1, format(data.strings[String(entry.fields.m_SelectCocktail)], item(dailyOrder.itemId).name, requested.delivery.count));
                }
                else
                    openEntryScript(2, data.strings[String(entry.fields.m_GiveDesc)]);
            }, blocked || orderFinished, selectedDeliveryItemId === recipe.itemId);
        });
        data.ingredientIds.forEach((id, index) => {
            const slot = cafeSourceBinding(layout, menu.path(`m_ingradientSlotArray[${index}]`), 'NKCUIEventBarIngradientSlot');
            text(slot.path('m_lbName'), item(id).name);
            text(slot.path('m_lbDesc'), cafeStregaDisplayItemDescription(item(id).description));
            itemImage(slot.path('m_imgIcon'), id);
            active(slot.path('m_objSelect'), createState.selectedIngredients.includes(id));
            button(slot.path('m_csbtnSlot'), item(id).name, () => setCreateState(previous => selectCafeIngredient(previous, id, data.ingredientIds)), blocked, createState.selectedIngredients.includes(id));
        });
        const recipe = cafeRecipeForSelection(data.recipes, createState);
        active(menu.path('m_objStepTechnique'), createState.step === 'technique');
        active(menu.path('m_objStepAmount'), createState.step === 'amount');
        text(menu.path('m_lbIngradientCount'), format(data.strings[String(menu.fields.m_SelectedIngrCount)], createState.selectedIngredients.length, 2));
        button(menu.path('m_csbtnShake'), '마법주문 외우기', () => setCreateState(previous => selectCafeTechnique(previous, 'shake')), blocked, createState.technique === 'shake');
        button(menu.path('m_csbtnStir'), '마법진 그리기', () => setCreateState(previous => selectCafeTechnique(previous, 'stir')), blocked, createState.technique === 'stir');
        button(menu.path('m_csbtnNextStep'), '다음으로', () => { setCreateState(previous => cafeNextStep(data.recipes, previous)); animateNpc('yoo-na', 'TOUCH'); }, blocked || !recipe);
        text(menu.path('m_lbCreateCount'), cafeCanCreate(recipe, inventory, createState.quantity) ? cafeQuantityText(createState) : `<color=#ff0000ff>${cafeQuantityText(createState)}</color>`);
        button(menu.path('m_csbtnCancel'), '제조 취소', () => setCreateState(cafeCancelStep), blocked);
        for (const [field, direction, label] of [['m_csbtnUp', 'up', '수량 증가'], ['m_csbtnDown', 'down', '수량 감소'], ['m_csbtnMax', 'max', '최대 수량']] as const) {
            button(menu.path(field), label, () => setCreateState(previous => cafeChangeQuantity(data.recipes, previous, inventory, direction)), blocked);
            if (direction !== 'max') {
                const config = cafeSourceBinding(layout, menu.path(field), 'NKCUIComStateButton').fields as unknown as CafeHoldConfig;
                patch(menu.path(field), { onPointerDown: () => { hold.current = { direction, config, state: cafeBeginHold(config) }; }, onPointerLeave: () => { hold.current = null; } });
            }
        }
        if (recipe) {
            showTooltip(create.path('m_csbtnCockTailResult'), recipe.itemId);
            itemImage(create.path('m_imgCocktailResult'), recipe.itemId);
            text(menu.path('m_lbScript'), format(data.strings[String(menu.fields[recipe.technique === 'shake' ? 'm_BartenderShake' : 'm_BartenderStir'])], item(recipe.itemId).name));
            recipe.materials.forEach((material, index) => {
                const cost = cafeSourceBinding(layout, menu.path(index === 0 ? 'm_ingradientSlot1' : 'm_ingradientSlot2'), 'NKCUIItemCostSlot');
                itemImage(cost.path('m_ICON'), material.itemId);
                showTooltip(cost.path('m_AB_ICON_COST_SLOT'), material.itemId);
                const required = material.count * createState.quantity, available = inventory[material.itemId] ?? 0;
                const count = available > 100000 ? '*' : String(available);
                text(cost.path('m_COUNT'), `${required > available ? `<color=#ff0000ff>${count}</color>` : count}/${required}`);
                active(cost.path('m_REQUIRED'), required > available);
                active(cost.path('m_objEvent'), false);
                active(cost.path('m_BG'), true);
            });
        }
        else {
            const reference = create.reference('m_spriteCocktailNone');
            const sprite = runtimeIndex!.assets.get(reference.assetId!)!;
            layout = cafeBindSourceImage(layout, create.path('m_imgCocktailResult'), sprite) as Layout;
        }
        button(menu.path('m_csbtnOK'), '제조 시작', () => {
            const request = cafeCreateRequest(data.recipes, createState, inventory, blocked);
            if (!request) {
                if (!blocked && recipe) {
                    animateNpc('yoo-na', 'SERIOUS');
                    const input = data.strings[String(create.fields.m_BartenderReject)];
                    const sequence = bundle.dialogue.nodes[create.path('m_lbScriptMsg')].find(sequence => sequence.input === input);
                    if (!sequence)
                        throw new Error('Original manufacture refusal sequence missing');
                    setScript({ sequence, index: 0, started: time.current, outro: null });
                }
                return;
            }
            if (!catalog)
                return;
            const now = Date.now();
            const current = loadMutationState(now);
            if (!current)
                return;
            const next = applyCafeLocalCreation(data.recipes, current.inventory, request);
            if (!next) {
                commitLocalState(current, now);
                animateNpc('yoo-na', 'SERIOUS');
                const input = data.strings[String(create.fields.m_BartenderReject)];
                const sequence = bundle.dialogue.nodes[create.path('m_lbScriptMsg')].find(value => value.input === input);
                if (!sequence)
                    throw new Error('Original manufacture refusal sequence missing');
                setScript({ sequence, index: 0, started: time.current, outro: null });
                return;
            }
            animateNpc('yoo-na', 'TOUCH');
            setCreateState(cafeRefreshCreateState);
            commitLocalState(replaceCafeStregaLocalInventory(catalog, current, next, now), now);
            setResult({ started: time.current, character: Math.floor(Math.random() * 6) });
            audio.current?.activate(source.result.node.path, true);
        }, blocked);
        if (result) {
            const binding = source.result;
            const ref = binding.reference(`m_CafeCharacter[${result.character}]`);
            layout = cafeBindSourceImage(layout, binding.path('m_CharacterImage'), runtimeIndex!.assets.get(ref.assetId!)!) as Layout;
            text(binding.path('m_lbTitle'), data.strings[(binding.fields.m_TitleKey as string[])[result.character]]);
            text(binding.path('m_lbDesc'), data.strings[(binding.fields.m_DescKey as string[])[result.character]]);
        }
        patch(entry.path('m_npcSpineIllust'), { onPointerDown: () => {
                if (blocked || !dailyOrder || !orderRecipe)
                    return;
                if (dailyOrder.remainingDeliveryCount <= 0) {
                    openEntryScript(1, data.strings[String(entry.fields.m_GiveEnd)]);
                    return;
                }
                const bubble = cafeSourceBinding(layout, entry.path('m_eventBarBubble'), 'NKCUIEventBarBubble');
                setBubbleStarted(time.current - Number(bubble.fields.m_hideTime));
                openEntryScript(1, format(data.strings[String(entry.fields.m_Request)], item(dailyOrder.itemId).name));
            } });
        patch(create.path('m_npcSpineIllust'), { onPointerDown: () => { if (!blocked)
                animateNpc('yoo-na', 'TOUCH'); } });
        return { layout, overrides, hotkeys };
    }, [bundle, source, inventory, localState, catalog, dailyOrder, selectedDeliveryItemId, entryScript, bubbleStarted,
        createState, result, script, missionOpened, missionStarted, router, menuFx,
        openEntryScript, enterEntryPhase, closeMissionLayer, loadMutationState, commitLocalState, runtimeIndex]);
    const view = useMemo(() => {
        if (!baseView || !bundle || !source || !runtimeIndex)
            return baseView;
        const { root, entry, create } = source;
        const layout = baseView.layout;
        const overrides: Record<string, SwordPrefabOverride> = { ...baseView.overrides };
        const patch = (path: string, value: SwordPrefabOverride) => {
            overrides[path] = {
                ...overrides[path], ...value, attributes: { ...overrides[path]?.attributes, ...value.attributes },
            };
        };
        const active = (path: string | null, value: boolean) => { if (path)
            patch(path, { active: value }); };
        const playClip = (name: string, path: string, at: number) => {
            const clip = runtimeIndex.animations.get(name);
            if (!clip)
                throw new Error(`Original Cafe AnimationClip missing ${name}`);
            for (const [relative, attributes] of Object.entries(sampleSwordTrainingClientAnimation(clip, at))) {
                patch(relative ? `${path}/${relative}` : path, { attributes });
            }
        };
        playClip(track.name, root.path('m_AniEventGremoryBar'), elapsed - track.started);
        const orderFinished = Boolean(dailyOrder && dailyOrder.remainingDeliveryCount <= 0);
        if (orderFinished)
            playClip('SINGLE_CAFE_LAUGH_FX', entry.path('m_objLaughFx'), elapsed - entryStateStarted);
        if (dailyOrder) {
            const bubble = cafeSourceBinding(layout, entry.path('m_eventBarBubble'), 'NKCUIEventBarBubble');
            const moveDuration = Number(bubble.fields.m_moveYDuration);
            const motionAt = Math.max(0, elapsed - entryStateStarted) % (moveDuration * 2);
            const direction = motionAt <= moveDuration ? motionAt / moveDuration : 2 - motionAt / moveDuration;
            const eased = direction < .5 ? 2 * direction * direction : 1 - ((-2 * direction + 2) ** 2) / 2;
            patch(bubble.node.path, { attributes: {
                    'm_AnchoredPosition.y': bubble.node.rect.anchoredPosition![1] + Number(bubble.fields.m_moveYValue) * eased,
                } });
            const clip = runtimeIndex.animations.get('SINGLE_CAFE_ORDER_IDLE')!;
            const hideTime = Number(bubble.fields.m_hideTime);
            const cycleAt = Math.max(0, elapsed - bubbleStarted) % (hideTime + clip.stopTime);
            const visible = cycleAt >= hideTime;
            active(bubble.path('m_canvasGroup'), visible);
            if (visible)
                playClip(clip.name, bubble.node.path, cycleAt - hideTime);
        }
        const scriptAnimation = (state: ScriptState, rootPath: string) => {
            const intro = runtimeIndex.animations.get('SINGLE_CAFE_SCRIPT_INTRO')!;
            const at = elapsed - state.started;
            if (state.outro !== null) {
                const outroTime = elapsed - state.outro;
                const clip = runtimeIndex.animations.get('SINGLE_CAFE_SCRIPT_OUTRO')!;
                const idle = runtimeIndex.animations.get('SINGLE_CAFE_SCRIPT_IDLE')!;
                const from = sampleSwordTrainingClientAnimation(idle, at - intro.stopTime);
                const to = sampleSwordTrainingClientAnimation(clip, outroTime);
                const weight = Math.min(1, outroTime / .25);
                for (const [relative, attributes] of Object.entries(to))
                    patch(`${rootPath}/${relative}`, {
                        attributes: Object.fromEntries(Object.entries(attributes).map(([key, value]) => [key, (from[relative]?.[key] ?? value) * (1 - weight) + value * weight])),
                    });
            }
            else if (at < intro.stopTime)
                playClip(intro.name, rootPath, at);
            else
                playClip('SINGLE_CAFE_SCRIPT_IDLE', rootPath, at - intro.stopTime);
        };
        if (script)
            scriptAnimation(script, create.path('m_aniScript'));
        if (entryScript)
            scriptAnimation(entryScript, entry.path('m_aniScript'));
        if (result)
            playClip('POPUP_SINGLE_CAFE_RESULT_INTRO', source.result.node.path, elapsed - result.started);
        if (missionOpened !== null)
            playClip('POPUP_SINGLE_CAFE_MISSION_INTRO', `${MISSION}/Content`, elapsed - missionOpened);
        if (missionStarted !== null)
            playClip('POPUP_SINGLE_CAFE_MISSION_RESULT_INTRO', MISSION_RESULT, elapsed - missionStarted);
        for (const node of runtimeIndex.skeletonNodes) {
            const kind = node.path.includes('AB_UNIT_SD_') ? 'mission' : node.path.includes('EVELYN') ? 'evelyn' : 'yoo-na';
            patch(node.path, { content: <CafeStregaActor layout={bundle.layout} path={node.path} kind={kind} width={canvas.width} height={canvas.height} animation={kind === 'mission' ? 'RUN' : npc[kind].animation} loop={kind === 'mission' || npc[kind].loop} animationKey={kind === 'mission' ? missionStarted ?? 0 : npc[kind].started} elapsed={kind === 'mission' ? Math.max(0, elapsed - (missionStarted ?? elapsed)) : Math.max(0, elapsed - npc[kind].started)} onError={setError}/> });
        }
        return { ...baseView, overrides };
    }, [baseView, bundle, source, runtimeIndex, track, elapsed, dailyOrder, entryStateStarted, bubbleStarted, script, entryScript,
        result, missionOpened, missionStarted, npc, canvas.width, canvas.height]);
    const fxInput: CafeFxmInputV2 = useMemo(() => view && source ? { ...view.overrides,
        [source.create.path('m_objMenuSelectOnFx')]: { ...view.overrides[source.create.path('m_objMenuSelectOnFx')], restartKey: menuFx.onKey },
        [source.create.path('m_objMenuSelectOffFx')]: { ...view.overrides[source.create.path('m_objMenuSelectOffFx')], restartKey: menuFx.offKey },
    } : {}, [view, source, menuFx]);
    const fxRestartEntries = useMemo(() => Object.entries(fxInput).filter(([, value]) => value.restartKey !== undefined), [fxInput]);
    const fxFrame = fxm?.preview(elapsed, fxInput);
    useLayoutEffect(() => { fxm?.update(elapsed, fxInput); }, [fxm, elapsed, fxInput]);
    const npcActive = useRef({ evelyn: false, 'yoo-na': false });
    useEffect(() => {
        if (!source || !fxFrame)
            return;
        for (const [kind, binding] of [['evelyn', source.entry], ['yoo-na', source.create]] as const) {
            const active = fxFrame.effectiveActive[binding.path('m_npcSpineIllust')];
            if (active && !npcActive.current[kind])
                setNpc(previous => ({ ...previous, [kind]: {
                        animation: kind === 'evelyn' && dailyRemainingDeliveryCount === 0 ? 'LAUGH' : 'IDLE',
                        started: time.current,
                        loop: true,
                    } }));
            npcActive.current[kind] = active;
        }
    }, [source, fxFrame, dailyRemainingDeliveryCount]);
    const rendered = useMemo(() => {
        if (!view || !fxFrame)
            return view;
        const overrides = { ...view.overrides };
        let layout = view.layout;
        for (const [path, assetId] of Object.entries(fxFrame.sprites)) {
            const sprite = runtimeIndex!.assets.get(assetId);
            if (!sprite)
                throw new Error(`Original Cafe FXM Sprite asset is missing: ${assetId}`);
            layout = cafeBindSourceImage(layout, path, sprite) as Layout;
        }
        for (const [path, attributes] of Object.entries(fxFrame.attributes))
            overrides[path] = { ...overrides[path], attributes: { ...overrides[path]?.attributes, ...attributes } };
        for (const [path, active] of Object.entries(fxFrame.active))
            overrides[path] = { ...overrides[path], active };
        for (const ring of bundle!.ring.renderers) {
            const modifier = runtimeIndex!.ringModifiers.get(ring.path);
            if (!modifier)
                throw new Error(`Original ring material evaluator missing: ${ring.path}`);
            overrides[ring.path] = { ...overrides[ring.path], content: <CafeStregaRing layout={bundle!.layout} source={ring} mesh={bundle!.ring.mesh} modifier={modifier} frame={fxFrame.evaluators[modifier.pathId]} width={canvas.width} height={canvas.height} active={fxFrame.effectiveActive[ring.path]} onError={setError}/> };
        }
        for (const particle of bundle!.particles.systems) {
            const geometry = particleRenderIndex!.get(particle.path)!;
            const restartKey = fxRestartEntries.filter(([path]) => particle.path === path || particle.path.startsWith(path + '/')).map(([path, value]) => `${path}:${value.restartKey}`).join('|');
            overrides[particle.path] = { ...overrides[particle.path], content: <CafeStregaParticles config={particle} elapsedSeconds={elapsed} active={fxFrame.effectiveActive[particle.path]} starts={geometry.controller ? fxFrame.evaluators[geometry.controller.pathId].starts : 0} restartKey={restartKey} width={geometry.rect.width} height={geometry.rect.height} pivot={geometry.node.rect.pivot!} maximumDeltaTime={bundle!.layout.evidence.playerSettings.timeManager['Maximum Allowed Timestep']} maximumParticleTimestep={bundle!.layout.evidence.playerSettings.timeManager['Maximum Particle Timestep']} onError={setError}/> };
        }
        return { layout: cafeFxmDrawLayoutV2(layout), overrides };
    }, [view, fxFrame, bundle, canvas.width, canvas.height, elapsed, fxInput, fxRestartEntries, runtimeIndex, particleRenderIndex]);
    useEffect(() => {
        if (!source || !rendered || !fxFrame)
            return;
        const press = (path: string) => {
            const button = rendered.overrides[path];
            if (fxFrame.effectiveActive[path] && !button?.locked)
                view?.hotkeys[path]?.();
        };
        const keyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.repeat || result || missionStarted !== null)
                return;
            const target = document.activeElement;
            if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.getAttribute('contenteditable') === 'true')
                return;
            if (missionOpened !== null) {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    closeMissionLayer();
                }
                return;
            }
            let field: string | null = null;
            const modifiers = event.shiftKey || event.ctrlKey || event.metaKey;
            if (event.key === 'Escape') {
                event.preventDefault();
                press(phase === 'create' ? source.root.path('m_csbtnInitialPhase') : source.home.path('m_csbtnClose'));
                return;
            }
            if (['Enter', 'NumpadEnter', 'Space', 'Numpad5'].includes(event.code))
                field = 'm_csbtnOK';
            else if (!modifiers) {
                if (event.key === '+' || event.code === 'NumpadAdd')
                    field = 'm_csbtnUp';
                else if (event.key === '-' || event.code === 'NumpadSubtract')
                    field = 'm_csbtnDown';
                else if (['ArrowDown', 'KeyS', 'Numpad2'].includes(event.code))
                    field = 'm_csbtnMax';
                else if (['ArrowRight', 'KeyD', 'Numpad6'].includes(event.code))
                    field = 'm_csbtnNextStep';
                else if (['ArrowLeft', 'KeyA', 'Numpad4'].includes(event.code))
                    field = 'm_csbtnCancel';
            }
            if (!field || phase !== 'create')
                return;
            const path = source.menu.path(field);
            if (!fxFrame.effectiveActive[path] || rendered.overrides[path]?.locked)
                return;
            event.preventDefault();
            press(path);
            if (field === 'm_csbtnUp' || field === 'm_csbtnDown') {
                const config = cafeSourceBinding(bundle!.layout, path, 'NKCUIComStateButton').fields as unknown as CafeHoldConfig;
                hold.current = { direction: field === 'm_csbtnUp' ? 'up' : 'down', config, state: cafeBeginHold(config) };
            }
        };
        window.addEventListener('keydown', keyDown);
        return () => window.removeEventListener('keydown', keyDown);
    }, [source, rendered, view, fxFrame, result, missionOpened, missionStarted, phase, bundle, closeMissionLayer]);
    return <div ref={host} data-cafe-rebuild="v2" data-cafe-phase={phase} data-cafe-step={createState.step} data-cafe-elapsed={elapsed} onPointerDownCapture={event => { heldInput.current.pointers.add(event.pointerId); audio.current?.unlock(); }} onPointerMove={event => { if (tooltip && cafeTooltipShouldClose(true, event.pointerType === 'mouse' && Boolean(event.buttons & 1), tooltip.point, { x: event.clientX, y: event.clientY }))
        setTooltip(null); }} data-cafe-inventory={JSON.stringify(Object.fromEntries(Object.entries(inventory).filter(([itemId, count]) => count !== 0 || bundle?.data.ingredientIds.includes(Number(itemId)))))} data-cafe-day-key={dailyOrder?.dayKey ?? ''} data-cafe-daily-order={dailyOrder ? JSON.stringify(dailyOrder) : 'null'} data-cafe-selected-delivery={selectedDeliveryItemId} data-cafe-delivery-status={currentDeliveryStatus} data-cafe-storage-status={storageStatus} data-cafe-animation-count={bundle?.layout.animations.length ?? 0} data-cafe-mission-preload={!missionPrewarmMounted ? 'pending' : missionPrewarmReady ? 'ready' : 'loading'} data-cafe-modal={result ? 'result' : missionStarted !== null ? 'mission-result' : missionOpened !== null ? 'mission' : 'none'} style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#000', zIndex: 100, touchAction: 'none' }}>
    {error && <p role="alert">{error}</p>}
    {bundle && rendered && <div style={{ position: 'absolute', width: canvas.width, height: canvas.height, transformOrigin: '0 0', transform: `scale(${canvas.scale})` }}>
      <SourcePrefab layout={rendered.layout} rootPath={MAIN} width={canvas.width} height={canvas.height} strings={bundle.data.strings} overrides={rendered.overrides} elapsedSeconds={elapsed} deferInactiveGraphics retainGraphicsAfterActivation separateDynamicTransforms memoizeSubtrees imageRenderer={imageRenderer}/>
      {missionPrewarmMounted && <div ref={missionLayer} data-cafe-mission-preload-layer={missionPrewarmReady ? 'ready' : 'loading'} aria-hidden={missionOpened === null} style={{ position: 'absolute', inset: 0, width: canvas.width, height: canvas.height,
                    visibility: missionOpened === null ? 'hidden' : 'visible', pointerEvents: missionOpened === null ? 'none' : 'auto' }}>
        <PrewarmedMissionPrefab open={missionOpened !== null} prewarming={!missionPrewarmReady} layout={rendered.layout} overrides={rendered.overrides} elapsedSeconds={missionElapsedSeconds} width={canvas.width} height={canvas.height} strings={bundle.data.strings} imageRenderer={imageRenderer}/>
      </div>}
    </div>}
    {bundle && rendered && tooltip && <div data-cafe-tooltip-layer="true" style={{ position: 'absolute', width: canvas.width, height: canvas.height,
                transformOrigin: '0 0', transform: `scale(${canvas.scale})`, zIndex: 2, pointerEvents: 'none' }}>
      <CafeStregaTooltip layout={bundle.tooltipLayout} item={{ ...bundle.data.items[tooltip.itemId], itemId: tooltip.itemId }} itemSprite={runtimeIndex!.itemSprites.get(tooltip.itemId)!} ownedCount={inventory[tooltip.itemId] ?? 0} strings={bundle.data.strings} geometry={{ panelHeight: bundle.tooltipGeometry.items[tooltip.itemId].panelHeight, parentSizeDelta: bundle.tooltipGeometry.items[tooltip.itemId].parent.sizeDelta,
                parentLocalPosition: bundle.tooltipGeometry.items[tooltip.itemId].parent.localPosition } satisfies CafeTooltipNativeGeometry} width={canvas.width} height={canvas.height} screen={size} screenPoint={{ x: tooltip.point.x, y: size.height - tooltip.point.y }} localPoint={{ x: tooltip.point.x / canvas.scale - canvas.width / 2, y: canvas.height / 2 - tooltip.point.y / canvas.scale }} imageRenderer={imageRenderer}/>
    </div>}
  </div>;
}
