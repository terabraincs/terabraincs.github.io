"use client";
import { deploymentUrl } from "@/lib/deployment";
import { useEffect, useRef, useState } from "react";
import { preloadStorySpineRuntime } from "@/components/story/StorySpineActor";
export type SwordTrainingActorKind = "player" | "normal" | "yellow" | "boss";
export type SwordTrainingActor = {
    id: string;
    kind: SwordTrainingActorKind;
    /** Canvas coordinates of the SkeletonGraphic world pivot, not its bounds. */
    x: number;
    y: number;
    /** Parent hierarchy scale only; a negative X reproduces the client's Y flip. */
    scaleX?: number;
    scaleY?: number;
    /** Clockwise radians in the web canvas coordinate system. */
    rotation?: number;
    alpha?: number;
    animation: string;
    /** Unwrapped seconds since this animation began; supplied by the game clock. */
    animationTime: number;
    loop: boolean;
};
type Props = {
    width: number;
    height: number;
    /** Back-to-front, matching Unity hierarchy sibling order. */
    actors: readonly SwordTrainingActor[];
    className?: string;
    onError?: (message: string) => void;
    /** All four original skeletons, atlases and textures have been decoded. */
    onReady?: () => void;
};
type Spine = import("@pixi-spine/runtime-3.7").Spine;
type SkeletonData = import("@pixi-spine/runtime-3.7").SkeletonData;
type Runtime = Awaited<ReturnType<typeof preloadStorySpineRuntime>>;
type ManifestActor = {
    model: string;
    skeletonScale: number;
    defaultMix: number;
    graphic: {
        initialSkinName: string;
    };
    transforms: {
        m_Father: {
            m_PathID: number;
        };
        m_LocalScale: {
            x: number;
            y: number;
        };
    }[];
};
type LoadedActor = {
    data: SkeletonData;
    childScaleX: number;
    childScaleY: number;
    defaultMix: number;
    skin: string;
};
type Instance = {
    spine: Spine;
    kind: SwordTrainingActorKind;
    animation: string;
    loop: boolean;
    time: number;
};
const SOURCE = deploymentUrl("/game-assets/sword-training/client-source");
// SkeletonGraphic.UpdateMesh multiplies the source-unit mesh by the FrontCanvas
// referencePixelsPerUnit. The prefab child scale is applied separately below.
const REFERENCE_PIXELS_PER_UNIT = 100;
async function fetchText(url: string, signal: AbortSignal) {
    const response = await fetch(deploymentUrl(url), { signal });
    if (!response.ok)
        throw new Error(`Sword Training asset ${response.status}: ${url}`);
    return response.text();
}
function loadImage(url: string, signal: AbortSignal) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image(); image.crossOrigin = "anonymous";
        const dispose = () => {
            signal.removeEventListener("abort", abort);
            image.onload = null;
            image.onerror = null;
        };
        const abort = () => {
            dispose();
            image.src = "";
            reject(new DOMException("Aborted", "AbortError"));
        };
        image.onload = () => { dispose(); resolve(image); };
        image.onerror = () => { dispose(); reject(new Error(`Sword Training texture failed: ${url}`)); };
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) {
            abort();
            return;
        }
        image.src = deploymentUrl(url);
    });
}
export default function SwordTrainingActors({ width, height, actors, className, onError, onReady }: Props) {
    const hostRef = useRef<HTMLDivElement>(null);
    const latest = useRef({ width, height, actors, onError, onReady });
    const renderRef = useRef<(() => void) | null>(null);
    const [status, setStatus] = useState("loading");
    latest.current = { width, height, actors, onError, onReady };
    useEffect(() => {
        const host = hostRef.current;
        if (!host)
            return;
        const controller = new AbortController();
        let cancelled = false;
        let app: import("pixi.js").Application | null = null;
        const atlases: import("@pixi-spine/base").TextureAtlas[] = [];
        const textures: import("pixi.js").BaseTexture[] = [];
        const instances = new Map<string, Instance>();
        let lastError = "";
        const reportError = (error: unknown) => {
            if (cancelled)
                return;
            const message = error instanceof Error ? error.message : String(error);
            host.dataset.spineError = message;
            if (message !== lastError) {
                lastError = message;
                setStatus("error");
                latest.current.onError?.(message);
                console.error(message);
            }
        };
        void (async () => {
            try {
                const [runtime, manifestText] = await Promise.all([
                    preloadStorySpineRuntime(),
                    fetchText(`${SOURCE}/spine.json`, controller.signal),
                ]);
                const manifest = JSON.parse(manifestText) as {
                    actors: Record<SwordTrainingActorKind, ManifestActor>;
                };
                const loaded = new Map<SwordTrainingActorKind, LoadedActor>();
                const { pixi, spineBase, spineRuntime }: Runtime = runtime;
                await Promise.all((Object.keys(manifest.actors) as SwordTrainingActorKind[]).map(async (kind) => {
                    const source = manifest.actors[kind];
                    const base = `${SOURCE}/spine/${kind}/${source.model}`;
                    const [jsonText, atlasText, image] = await Promise.all([
                        fetchText(`${base}.json`, controller.signal),
                        fetchText(`${base}.atlas`, controller.signal),
                        loadImage(`${base}.png`, controller.signal),
                    ]);
                    if (cancelled)
                        return;
                    const texture = new pixi.BaseTexture(image, {
                        alphaMode: pixi.ALPHA_MODES.PMA,
                        scaleMode: pixi.SCALE_MODES.LINEAR,
                        mipmap: pixi.MIPMAP_MODES.OFF,
                    });
                    textures.push(texture);
                    const atlas = await new Promise<import("@pixi-spine/base").TextureAtlas>((resolve, reject) => {
                        try {
                            new spineBase.TextureAtlas(atlasText, (_path, callback) => callback(texture), resolve);
                        }
                        catch (error) {
                            reject(error);
                        }
                    });
                    atlases.push(atlas);
                    const parser = new spineRuntime.SkeletonJson(new spineRuntime.AtlasAttachmentLoader(atlas));
                    parser.scale = source.skeletonScale;
                    const data = parser.readSkeletonData(JSON.parse(jsonText));
                    const child = source.transforms.find((transform) => transform.m_Father.m_PathID !== 0);
                    if (!child)
                        throw new Error(`Missing source SkeletonGraphic transform: ${kind}`);
                    loaded.set(kind, { data, childScaleX: child.m_LocalScale.x, childScaleY: child.m_LocalScale.y,
                        defaultMix: source.defaultMix, skin: source.graphic.initialSkinName });
                }));
                if (cancelled)
                    return;
                app = new pixi.Application({
                    width: latest.current.width, height: latest.current.height,
                    backgroundAlpha: 0, antialias: true, autoDensity: true, autoStart: false,
                    resolution: window.devicePixelRatio || 1,
                });
                const canvas = app.view as HTMLCanvasElement;
                canvas.style.width = "100%";
                canvas.style.height = "100%";
                canvas.style.display = "block";
                host.replaceChildren(canvas);
                renderRef.current = () => {
                    if (!app || cancelled)
                        return;
                    try {
                        const current = latest.current;
                        if (app.screen.width !== current.width || app.screen.height !== current.height)
                            app.renderer.resize(current.width, current.height);
                        const ids = new Set(current.actors.map((actor) => actor.id));
                        if (ids.size !== current.actors.length)
                            throw new Error("Duplicate Sword Training actor id");
                        for (const [id, entry] of instances) {
                            if (!ids.has(id)) {
                                app.stage.removeChild(entry.spine);
                                entry.spine.destroy({ children: true });
                                instances.delete(id);
                            }
                        }
                        for (const [index, actor] of current.actors.entries()) {
                            const source = loaded.get(actor.kind);
                            if (!source)
                                throw new Error(`Unknown original Sword Training actor: ${actor.kind}`);
                            if (!Number.isFinite(actor.animationTime) || actor.animationTime < 0)
                                throw new Error(`Invalid Sword Training animation time: ${actor.id}`);
                            let instance = instances.get(actor.id);
                            if (instance && instance.kind !== actor.kind) {
                                app.stage.removeChild(instance.spine);
                                instance.spine.destroy({ children: true });
                                instances.delete(actor.id);
                                instance = undefined;
                            }
                            if (!instance) {
                                const spine = new spineRuntime.Spine(source.data);
                                spine.autoUpdate = false;
                                spine.stateData.defaultMix = source.defaultMix;
                                spine.skeleton.setSkinByName(source.skin);
                                spine.skeleton.setSlotsToSetupPose();
                                instance = { spine, kind: actor.kind, animation: "", loop: actor.loop, time: -1 };
                                instances.set(actor.id, instance);
                                app.stage.addChild(spine);
                            }
                            const { spine } = instance;
                            if (instance.animation !== actor.animation || instance.loop !== actor.loop || actor.animationTime < instance.time) {
                                if (!source.data.findAnimation(actor.animation))
                                    throw new Error(`Unknown original Sword Training animation: ${actor.kind}/${actor.animation}`);
                                // NKCASUISpineIllust.SetAnimation resets the original skeleton,
                                // including attachments/deform, before replacing the track.
                                spine.skeleton.setToSetupPose();
                                spine.state.setAnimation(0, actor.animation, actor.loop);
                                instance.animation = actor.animation;
                                instance.loop = actor.loop;
                            }
                            const track = spine.state.getCurrent(0);
                            if (track)
                                track.trackTime = actor.animationTime;
                            instance.time = actor.animationTime;
                            spine.position.set(actor.x, actor.y);
                            spine.scale.set(REFERENCE_PIXELS_PER_UNIT * source.childScaleX * (actor.scaleX ?? 1), REFERENCE_PIXELS_PER_UNIT * source.childScaleY * (actor.scaleY ?? 1));
                            spine.rotation = actor.rotation ?? 0;
                            spine.alpha = actor.alpha ?? 1;
                            // SpineBase performs original slot clipping and draw-order evaluation.
                            // No bounds-based viewport, vertical cutoff, ghost cap or fitted scale.
                            spine.update(0);
                            if (app.stage.children[index] !== spine)
                                app.stage.setChildIndex(spine, index);
                        }
                        app.render();
                        const actorCount = String(instances.size);
                        if (host.dataset.actorCount !== actorCount)
                            host.dataset.actorCount = actorCount;
                        delete host.dataset.spineError;
                        if (lastError) {
                            lastError = "";
                            setStatus("ready");
                        }
                    }
                    catch (error) {
                        reportError(error);
                    }
                };
                setStatus("ready");
                renderRef.current();
                if (!lastError)
                    latest.current.onReady?.();
            }
            catch (error) {
                reportError(error);
            }
        })();
        return () => {
            cancelled = true;
            controller.abort();
            renderRef.current = null;
            instances.clear();
            app?.destroy(true, { children: true, texture: false, baseTexture: false });
            // Every atlas refers to its own extracted page; dispose releases that page.
            for (const atlas of atlases)
                atlas.dispose();
            for (const texture of textures)
                if (!texture.destroyed)
                    texture.destroy();
        };
    }, []);
    useEffect(() => { renderRef.current?.(); }, [width, height, actors]);
    return <div ref={hostRef} className={className} aria-hidden="true" data-sword-spine-status={status} data-spine-origin="source-prefab" data-spine-clipping="source-slots" data-source-actor-frame={JSON.stringify(actors.map(({ id, kind, x, y, scaleX, scaleY, rotation, alpha, animation, animationTime, loop }) => ({ id, kind, x, y, scaleX, scaleY, rotation, alpha, animation, animationTime, loop })))} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}/>;
}
