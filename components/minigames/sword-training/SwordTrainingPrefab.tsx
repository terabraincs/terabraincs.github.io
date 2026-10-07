"use client";
import { deploymentUrl } from "@/lib/deployment";

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { swordClientComponent, swordClientIndex, swordClientRect, type ClientColor, type SwordClientAsset, type SwordClientLayout, type SwordClientNode, type SwordLayoutBox, } from "@/lib/swordTrainingClientLayout";
import { SwordTrainingClientButtonScale, sampleSwordTrainingClientPmaImage } from "@/lib/swordTrainingClientDecoration";
import { SwordTrainingClientPrefabMotion } from "@/lib/swordTrainingClientPrefabMotion";
import { SwordTrainingClientScroll } from "@/lib/swordTrainingClientScroll";
import { SwordTrainingClientRewardScroll } from "@/lib/swordTrainingClientRewardScroll";
import SwordTrainingImage from "./SwordTrainingImage";
import SwordTrainingAdditiveImage from "./SwordTrainingAdditiveImage";
import { swordTrainingImageMaterial } from "@/lib/swordTrainingClientImageMaterial";
import SwordTrainingText, { measureSwordText } from "./SwordTrainingText";
import SwordTrainingPmaMeshes, { type SwordTrainingPmaMesh } from "./SwordTrainingPmaMeshes";
import { SwordTrainingParticleEmitter } from "./SwordTrainingParticles";
import type { SwordParticleSystemSource } from "@/lib/swordTrainingClientParticles";
import type { SwordClientImage } from "./SwordTrainingImage";
export type SourcePrefabImageRenderer = (args: {
    node: SwordClientNode;
    image: SwordClientImage;
    width: number;
    height: number;
    pivot: readonly [
        number,
        number
    ];
    color: ClientColor;
    fillAmount?: number;
    assets: Map<string, SwordClientAsset>;
}) => ReactNode | undefined;
export type SwordPrefabOverride = {
    active?: boolean;
    text?: string;
    attributes?: Record<string, number>;
    onClick?: () => void;
    onPointerDown?: (point: {
        x: number;
        y: number;
        pointerId: number;
    }) => void;
    onPointerUp?: () => void;
    onPointerLeave?: () => void;
    label?: string;
    content?: ReactNode;
    replaceChildren?: boolean;
    locked?: boolean;
    /** Preloaded-but-inactive source branches must not participate in raycasts. */
    raycast?: boolean;
    data?: Record<string, string | number>;
    /** NKCPopupScoreReward.SetData calls SetIndexPosition(0). */
    scrollResetKey?: string | number;
    scrollHotkeys?: boolean;
};
type PositionedNode = {
    node: SwordClientNode;
    source: SwordClientNode;
    active: boolean;
    sourceWorldRotation: number;
    box: SwordLayoutBox;
    parentWidth: number;
    parentHeight: number;
    parentPivot: readonly [
        number,
        number
    ];
    children: PositionedNode[];
    hasFrameWork: boolean;
};
type Overrides = Record<string, SwordPrefabOverride>;
const ROOT_PIVOT = [0.5, 0.5] as const;
const sourceFontLoads = new Map<string, Promise<FontFace>>();
const contentIdentity = new WeakMap<object, number>();
const overrideRevisionCache = new WeakMap<SwordPrefabOverride, number>();
let nextContentIdentity = 1;
type SourceClockLimits = {
    maximumDeltaTime: number;
    maximumParticleDeltaTime: number;
    dragThreshold: number;
};
type SourceScrollbarContext = {
    path: string;
    handlePath: string;
    direction: number;
    value: number;
    size: number;
    setValue: (value: number) => void;
};
type SourceScrollContext = {
    contentPath: string;
    viewportPath: string;
    offset: number;
    viewHeight: number;
    cullRows: boolean;
    firstRow: number;
    rowCount: number;
    gesture: {
        blockedClick: boolean;
        cancelledPointer: number | null;
    };
    scrollbar?: SourceScrollbarContext;
};
function objectIdentity(value: ReactNode) {
    if ((typeof value !== "object" && typeof value !== "function") || value === null)
        return String(value ?? "");
    const object = value as object;
    let identity = contentIdentity.get(object);
    if (!identity) {
        identity = nextContentIdentity++;
        contentIdentity.set(object, identity);
    }
    return identity;
}
function hashText(value: string) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}
function directOverrideRevision(value: SwordPrefabOverride | undefined) {
    if (!value)
        return 0;
    const cached = overrideRevisionCache.get(value);
    if (cached !== undefined)
        return cached;
    const revision = hashText(JSON.stringify([
        value.active ?? null,
        value.text ?? null,
        value.attributes ? Object.entries(value.attributes).sort(([left], [right]) => left.localeCompare(right)) : null,
        value.label ?? null,
        value.locked ?? null,
        value.replaceChildren ?? null,
        value.raycast ?? null,
        value.data ?? null,
        value.scrollResetKey ?? null,
        value.scrollHotkeys ?? null,
        Boolean(value.onClick), Boolean(value.onPointerDown), Boolean(value.onPointerUp), Boolean(value.onPointerLeave),
        objectIdentity(value.content),
    ]));
    overrideRevisionCache.set(value, revision);
    return revision;
}
function prefabRevisionMap(root: PositionedNode, overrides: Overrides) {
    const revisions = new Map<string, number>();
    const visit = (node: PositionedNode): number => {
        let revision = directOverrideRevision(overrides[node.node.path]);
        for (const child of node.children)
            revision = Math.imul(revision ^ visit(child), 16777619) >>> 0;
        revisions.set(node.node.path, revision);
        return revision;
    };
    visit(root);
    return revisions;
}
function positionedAt(root: PositionedNode, path: string): PositionedNode | undefined {
    if (root.node.path === path)
        return root;
    for (const child of root.children) {
        const result = positionedAt(child, path);
        if (result)
            return result;
    }
    return undefined;
}
function transformBox(node: SwordClientNode, width: number, height: number, parentPivot: readonly [
    number,
    number
] = ROOT_PIVOT): SwordLayoutBox {
    if (node.rect.type === "RectTransform")
        return swordClientRect(node.rect, width, height);
    const [x, y] = node.rect.localPosition;
    const [qx, qy, qz, qw] = node.rect.localRotation;
    return { left: width * parentPivot[0] + x, top: height * (1 - parentPivot[1]) - y,
        width: 0, height: 0, pivotX: 0.5, pivotY: 0.5,
        scaleX: node.rect.localScale[0], scaleY: node.rect.localScale[1],
        rotation: -Math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz)) * 180 / Math.PI };
}
function sourceNode(node: SwordClientNode, override?: SwordPrefabOverride) {
    const attributes = override?.attributes;
    if (!attributes)
        return node;
    const rect = { ...node.rect };
    if (rect.anchoredPosition)
        rect.anchoredPosition = [attributes["m_AnchoredPosition.x"] ?? rect.anchoredPosition[0], attributes["m_AnchoredPosition.y"] ?? rect.anchoredPosition[1]];
    rect.localScale = [attributes["m_LocalScale.x"] ?? rect.localScale[0], attributes["m_LocalScale.y"] ?? rect.localScale[1], attributes["m_LocalScale.z"] ?? rect.localScale[2]];
    return { ...node, rect };
}
function isActive(node: SwordClientNode, overrides: Overrides) {
    const value = overrides[node.path];
    return value?.active ?? (value?.attributes?.m_IsActive === undefined ? node.activeSelf : value.attributes.m_IsActive !== 0);
}
function buildLayout(layout: SwordClientLayout, rootPath: string, width: number, height: number, strings: Record<string, string>, overrides: Overrides, context: CanvasRenderingContext2D) {
    const index = swordClientIndex(layout);
    const textValue = (node: SwordClientNode) => {
        const text = node.texts?.[0];
        if (!text)
            return "";
        return overrides[node.path]?.text ?? (text.stringKey ? strings[text.stringKey] : text.text);
    };
    function place(original: SwordClientNode, parentWidth: number, parentHeight: number, parentPivot: readonly [
        number,
        number
    ] = ROOT_PIVOT, forced?: Partial<SwordLayoutBox>, parentActive = true, parentSourceRotation = 0): PositionedNode {
        const node = sourceNode(original, overrides[original.path]);
        const active = parentActive && isActive(original, overrides);
        const sourceWorldRotation = parentSourceRotation + transformBox(original, parentWidth, parentHeight, parentPivot as typeof ROOT_PIVOT).rotation;
        let box = { ...transformBox(node, parentWidth, parentHeight, parentPivot as typeof ROOT_PIVOT), ...forced };
        const attributes = overrides[node.path]?.attributes;
        // A source FXM_POSITION writes Transform.localPosition, not anchoredPosition.
        if (attributes?.['m_LocalPosition.x'] !== undefined)
            box.left = parentWidth * parentPivot[0] + attributes['m_LocalPosition.x'] - box.width * box.pivotX;
        if (attributes?.['m_LocalPosition.y'] !== undefined)
            box.top = parentHeight * (1 - parentPivot[1]) - attributes['m_LocalPosition.y'] - box.height * (1 - box.pivotY);
        const aspect = swordClientComponent(node, "AspectRatioFitter");
        if (aspect?.fields.m_Enabled) {
            const mode = Number(aspect.fields.m_AspectMode), ratio = Number(aspect.fields.m_AspectRatio);
            if (!(ratio > 0))
                throw new Error(`Invalid original AspectRatioFitter: ${node.path}`);
            if (mode === 1) {
                const height = box.width / ratio;
                box = { ...box, height, top: box.top + (box.height - height) * (1 - box.pivotY) };
            }
            else if (mode === 2) {
                const width = box.height * ratio;
                box = { ...box, width, left: box.left + (box.width - width) * box.pivotX };
            }
            else if (mode === 3 || mode === 4) {
                // Original UnityEngine.UI.AspectRatioFitter.UpdateRect: anchors 0/1,
                // anchoredPosition 0; adjust exactly one sizeDelta axis.
                const heightFromWidth = (parentHeight * ratio < parentWidth) === (mode === 4);
                const width = heightFromWidth ? parentWidth : parentHeight * ratio;
                const height = heightFromWidth ? parentWidth / ratio : parentHeight;
                box = { ...box, width, height, left: (parentWidth - width) * box.pivotX, top: (parentHeight - height) * (1 - box.pivotY) };
            }
            else if (mode !== 0)
                throw new Error(`Unknown original AspectRatioFitter mode: ${mode}`);
        }
        const allChildren = index.children.get(node.path) ?? [];
        const sourceChildren = allChildren.filter(child => isActive(child, overrides));
        let children = sourceChildren.map(child => place(child, box.width, box.height, [box.pivotX, box.pivotY], undefined, active, sourceWorldRotation));
        const group = node.components.find(component => component.fields.m_Enabled && /^(Horizontal|Vertical)LayoutGroup$/.test(component.type));
        const fitter = swordClientComponent(node, "ContentSizeFitter");
        if (!group && fitter?.fields.m_Enabled && node.texts?.[0]) {
            const measured = measureSwordText(node.texts[0], textValue(node), box.width, context);
            const previous = box;
            if (Number(fitter.fields.m_HorizontalFit) === 2)
                box = { ...box, width: measured.width, left: previous.left + (previous.width - measured.width) * box.pivotX };
            if (Number(fitter.fields.m_VerticalFit) === 2)
                box = { ...box, height: measured.height, top: previous.top + (previous.height - measured.height) * (1 - box.pivotY) };
            children = sourceChildren.map(child => place(child, box.width, box.height, [box.pivotX, box.pivotY], undefined, active, sourceWorldRotation));
        }
        if (group) {
            const horizontal = group.type === "HorizontalLayoutGroup";
            const fields = group.fields;
            const ownElement = swordClientComponent(node, "LayoutElement")?.fields;
            // The Cafe mission slot's source probe records the standalone
            // description group at its LayoutElement preferred width (704), then
            // HorizontalLayoutGroup gives the remaining width to MISSION_TEXT.
            // Preserve that original resolved width when no parent LayoutGroup has
            // already supplied one. This predicate is unique to that source shape.
            if (horizontal && forced?.width === undefined && ownElement?.m_Enabled
                && Number(ownElement.m_PreferredWidth) >= 0 && sourceChildren.some(child => {
                const element = swordClientComponent(child, "LayoutElement")?.fields;
                return element?.m_Enabled && Number(element.m_FlexibleWidth) > 0;
            })) {
                const preferred = Number(ownElement.m_PreferredWidth);
                box = { ...box, width: preferred, left: box.left + (box.width - preferred) * box.pivotX };
            }
            const padding = fields.m_Padding as Record<string, number>;
            const pLeft = padding.m_Left, pRight = padding.m_Right, pTop = padding.m_Top, pBottom = padding.m_Bottom;
            const spacing = Number(fields.m_Spacing);
            const alignment = Number(fields.m_ChildAlignment);
            const controlWidth = Boolean(fields.m_ChildControlWidth), controlHeight = Boolean(fields.m_ChildControlHeight);
            const natural = children.map(child => {
                const text = child.node.texts?.[0];
                let desiredWidth = child.box.width, desiredHeight = child.box.height;
                if (text) {
                    const measured = measureSwordText(text, textValue(child.node), horizontal ? Number.MAX_SAFE_INTEGER : box.width - pLeft - pRight, context);
                    if (controlWidth)
                        desiredWidth = horizontal ? measured.width : box.width - pLeft - pRight;
                    if (controlHeight)
                        desiredHeight = measured.height;
                }
                const element = swordClientComponent(child.node, "LayoutElement")?.fields;
                if (element?.m_Enabled) {
                    if (controlWidth && Number(element.m_PreferredWidth) >= 0)
                        desiredWidth = Number(element.m_PreferredWidth);
                    if (controlHeight && Number(element.m_PreferredHeight) >= 0)
                        desiredHeight = Number(element.m_PreferredHeight);
                }
                // TMP minWidth/minHeight are zero; the result NEW_RECORD container
                // supplies only a LayoutElement (unset minimum also resolves to zero).
                // Do not invent minimum metrics for legacy Text or nested groups.
                const knownMinimum = text?.componentType.includes("TMP") || (!text && !child.node.images?.length && element?.m_Enabled);
                const minimum = (axis: "Width" | "Height", controlled: boolean, extent: number) => !controlled ? extent
                    : knownMinimum ? Math.max(0, Number(element?.m_Enabled ? element[`m_Min${axis}`] ?? -1 : 0)) : undefined;
                const flexible = (axis: "Width" | "Height", controlled: boolean) => !controlled ? 0
                    : Math.max(0, Number(element?.m_Enabled && Number(element[`m_Flexible${axis}`]) >= 0 ? element[`m_Flexible${axis}`] : 0));
                return { width: desiredWidth, height: desiredHeight,
                    minWidth: minimum("Width", controlWidth, desiredWidth), minHeight: minimum("Height", controlHeight, desiredHeight),
                    flexibleWidth: flexible("Width", controlWidth), flexibleHeight: flexible("Height", controlHeight) };
            });
            const gap = Math.max(0, natural.length - 1) * spacing;
            const preferredWidth = pLeft + pRight + (horizontal ? natural.reduce((sum, child) => sum + child.width, gap) : Math.max(0, ...natural.map(child => child.width)));
            const preferredHeight = pTop + pBottom + (horizontal ? Math.max(0, ...natural.map(child => child.height)) : natural.reduce((sum, child) => sum + child.height, gap));
            if (fitter?.fields.m_Enabled) {
                const previous = box;
                // LayoutUtility.GetPreferredSize includes the fitter object's own
                // LayoutElement. Its priority 1 overrides LayoutGroup priority 0.
                const ownPreferred = (field: string, natural: number) => ownElement?.m_Enabled && Number(ownElement[field]) >= 0
                    ? Number(ownElement.m_LayoutPriority) > 0 ? Number(ownElement[field]) : Number(ownElement.m_LayoutPriority) === 0 ? Math.max(natural, Number(ownElement[field])) : natural : natural;
                const fittedWidth = ownPreferred("m_PreferredWidth", preferredWidth), fittedHeight = ownPreferred("m_PreferredHeight", preferredHeight);
                if (Number(fitter.fields.m_HorizontalFit) === 2)
                    box = { ...box, width: fittedWidth, left: previous.left + (previous.width - fittedWidth) * box.pivotX };
                if (Number(fitter.fields.m_VerticalFit) === 2)
                    box = { ...box, height: fittedHeight, top: previous.top + (previous.height - fittedHeight) * (1 - box.pivotY) };
            }
            const extra = Math.max(0, horizontal ? box.width - preferredWidth : box.height - preferredHeight);
            // Original HorizontalOrVerticalLayoutGroup.SetChildrenAlongAxis:
            // when the available main axis is below totalPreferred, interpolate
            // each child's minimum/preferred size. Keeping every preferred height
            // pushed NEW_RECORD and the score below their native result positions.
            const minimumSizes = natural.map(child => horizontal ? child.minWidth : child.minHeight);
            const totalMinimum = minimumSizes.every(value => value !== undefined)
                ? (horizontal ? pLeft + pRight : pTop + pBottom) + gap + minimumSizes.reduce<number>((sum, value) => sum + value!, 0) : undefined;
            const totalPreferred = horizontal ? preferredWidth : preferredHeight;
            const available = horizontal ? box.width : box.height;
            const minMaxLerp = totalMinimum !== undefined && totalMinimum !== totalPreferred
                ? Math.max(0, Math.min(1, (available - totalMinimum) / (totalPreferred - totalMinimum))) : 1;
            const expand = Boolean(horizontal ? fields.m_ChildForceExpandWidth : fields.m_ChildForceExpandHeight);
            const flexibleSizes = natural.map(child => Math.max(expand ? 1 : 0, horizontal ? child.flexibleWidth : child.flexibleHeight));
            const totalFlexible = flexibleSizes.reduce((sum, value) => sum + value, 0);
            const align = horizontal ? alignment % 3 : Math.floor(alignment / 3);
            let cursor = (horizontal ? pLeft : pTop) + (totalFlexible > 0 ? 0 : extra * align / 2);
            children = sourceChildren.map((child, i) => {
                const target = { width: natural[i].width, height: natural[i].height };
                if (minMaxLerp < 1) {
                    const minimum = minimumSizes[i]!;
                    if (horizontal)
                        target.width = minimum + (target.width - minimum) * minMaxLerp;
                    else
                        target.height = minimum + (target.height - minimum) * minMaxLerp;
                }
                if (totalFlexible > 0) {
                    if (horizontal && controlWidth)
                        target.width += extra * flexibleSizes[i] / totalFlexible;
                    if (!horizontal && controlHeight)
                        target.height += extra * flexibleSizes[i] / totalFlexible;
                }
                // SetChildrenAlongAxis stretches a cross-axis child to the inner
                // group size whenever that child reports a positive flexible size.
                // Force-expand only supplies a minimum flexible value of one.
                if (horizontal && controlHeight && (fields.m_ChildForceExpandHeight || natural[i].flexibleHeight > 0)) {
                    target.height = box.height - pTop - pBottom;
                }
                if (!horizontal && controlWidth && (fields.m_ChildForceExpandWidth || natural[i].flexibleWidth > 0)) {
                    target.width = box.width - pLeft - pRight;
                }
                const left = horizontal ? cursor : pLeft + (box.width - pLeft - pRight - target.width) * (alignment % 3) / 2;
                const top = horizontal ? pTop + (box.height - pTop - pBottom - target.height) * Math.floor(alignment / 3) / 2 : cursor;
                cursor += (horizontal ? target.width : target.height) + spacing;
                return place(child, box.width, box.height, [box.pivotX, box.pivotY], { ...target, left, top }, active, sourceWorldRotation);
            });
        }
        // Inactive Unity GameObjects retain their components and global DOTweens.
        // Keep corresponding React instances, but exclude them from LayoutGroups.
        children.push(...allChildren.filter(child => !isActive(child, overrides)).map(child => place(child, box.width, box.height, [box.pivotX, box.pivotY], undefined, false, sourceWorldRotation)));
        children.sort((a, b) => a.node.siblingIndex - b.node.siblingIndex);
        const tweenManager = original.components.find(component => component.type === "DOTweenVisualManager" && component.fields.m_Enabled);
        const globallyUpdatingTween = original.components.some(component => component.type === "DOTweenAnimation")
            && (!tweenManager || Number(tweenManager.fields.onDisableBehaviour) === 0);
        const ownActiveFrameWork = original.components.some(component => component.type === "DOTweenAnimation" || component.type === "NKC_FXM_PLAYER"
            || component.type === "NKCUIComStateButton" || component.type === "NKCUIComButton" || component.type === "ScrollRect"
            || component.type === "LoopVerticalScrollRect" || component.type === "LoopVerticalScrollFlexibleRect");
        return { node, source: original, active, sourceWorldRotation, box, parentWidth, parentHeight, parentPivot, children,
            // DOTween without a pausing VisualManager keeps using its global updater
            // while the GameObject is hidden. Keep ticking frame-work descendants so
            // reactivation resumes at the same client-authored phase.
            hasFrameWork: globallyUpdatingTween || active && ownActiveFrameWork || children.some(child => child.hasFrameWork) };
    }
    const root = index.nodes.get(rootPath);
    if (!root)
        throw new Error(`Missing original prefab ${rootPath}`);
    return place(root, width, height);
}
function initialMotionPose(source: SwordClientNode, sourceWorldRotation: number) {
    return {
        "m_AnchoredPosition.x": source.rect.anchoredPosition?.[0] ?? 0,
        "m_AnchoredPosition.y": source.rect.anchoredPosition?.[1] ?? 0,
        "m_AnchoredPosition.z": source.rect.localPosition[2],
        "m_LocalScale.x": source.rect.localScale[0], "m_LocalScale.y": source.rect.localScale[1], "m_LocalScale.z": source.rect.localScale[2],
        "worldEulerAngles.x": 0, "worldEulerAngles.y": 0, "worldEulerAngles.z": -sourceWorldRotation,
        "m_Alpha": Number(swordClientComponent(source, "CanvasGroup")?.fields.m_Alpha ?? 1),
        "m_Color.a": source.images?.[0]?.color[3] ?? 1,
    };
}
function PrefabPmaImage({ node, assets, width, height, playback }: {
    node: SwordClientNode;
    assets: Map<string, SwordClientAsset>;
    width: number;
    height: number;
    playback: number | null;
}) {
    const pma = swordClientComponent(node, "NKC_FXM_UI_IMAGE_PMA")!;
    const image = swordClientComponent(node, "Image")!;
    const sprite = assets.get(image.references.find(ref => ref.field === "m_Sprite")?.assetId ?? "");
    if (!sprite)
        throw new Error(`Missing original PMA sprite: ${node.path}`);
    const geometry = sprite.mesh as {
        pngUV: number[][];
        triangles: number[][];
    } | undefined;
    if (!geometry)
        throw new Error(`Missing original PMA geometry: ${node.path}`);
    const mesh: SwordTrainingPmaMesh = {
        id: node.path, texture: sprite.webPath,
        positions: geometry.pngUV.flatMap(([u, v]) => [u * width, v * height]),
        uvs: geometry.pngUV.flat(), indices: geometry.triangles.flat(),
        color: playback === null ? [0, 0, 0, 0] : sampleSwordTrainingClientPmaImage(pma.fields, playback),
    };
    return <SwordTrainingPmaMeshes width={width} height={height} meshes={[mesh]}/>;
}
type PrefabNodeProps = {
    value: PositionedNode;
    overridesRef: MutableRefObject<Overrides>;
    revisions: ReadonlyMap<string, number>;
    revision: number;
    strings: Record<string, string>;
    assets: Map<string, SwordClientAsset>;
    particles: ReadonlyMap<string, SwordParticleSystemSource>;
    elapsedSeconds: number;
    clockLimits: SourceClockLimits;
    parentRotation?: number;
    fxPlayback?: number | null;
    scrollContext?: SourceScrollContext;
    raycastEnabled?: boolean;
    imageRenderer?: SourcePrefabImageRenderer;
    deferInactiveGraphics?: boolean;
    retainGraphicsAfterActivation?: boolean;
    separateDynamicTransforms?: boolean;
    memoizeSubtrees?: boolean;
};
function PrefabNode({ value, overridesRef, revisions, strings, assets, particles, elapsedSeconds, clockLimits, parentRotation = 0, fxPlayback = null, scrollContext, raycastEnabled = true, imageRenderer, deferInactiveGraphics = false, retainGraphicsAfterActivation = false, separateDynamicTransforms = false, memoizeSubtrees = false }: PrefabNodeProps) {
    const overrides = overridesRef.current;
    const { node, source, children, active } = value;
    const graphicsActivated = useRef(active);
    if (active)
        graphicsActivated.current = true;
    const renderGraphics = !deferInactiveGraphics || active
        || (retainGraphicsAfterActivation && graphicsActivated.current);
    let box = value.box;
    const handleState = scrollContext?.scrollbar?.handlePath === node.path ? scrollContext.scrollbar : undefined;
    if (handleState && node.rect.anchorMin && node.rect.anchorMax) {
        // UnityEngine.UI.Scrollbar.UpdateVisuals writes HandleRect anchorMin/max.
        // Direction enum: 0 LTR, 1 RTL, 2 BTT, 3 TTB.
        const axis = handleState.direction < 2 ? 0 : 1;
        const reverse = handleState.direction === 1 || handleState.direction === 3;
        const movement = handleState.value * (1 - handleState.size);
        const minimum = reverse ? 1 - movement - handleState.size : movement;
        const maximum = reverse ? 1 - movement : movement + handleState.size;
        // Scrollbar.UpdateVisuals starts from a full-stretch Rect and then writes
        // only the scrolling axis. The serialized Handle anchors are not reused.
        const anchorMin: [
            number,
            number
        ] = [0, 0];
        const anchorMax: [
            number,
            number
        ] = [1, 1];
        anchorMin[axis] = minimum;
        anchorMax[axis] = maximum;
        box = transformBox({ ...node, rect: { ...node.rect, anchorMin, anchorMax } }, value.parentWidth, value.parentHeight, value.parentPivot);
    }
    const override = overrides[node.path];
    const hasMotion = source.components.some(component => component.type === "DOTweenAnimation" || component.type === "NKC_FXM_PLAYER");
    const [motion] = useState(() => new SwordTrainingClientPrefabMotion(source, initialMotionPose(source, value.sourceWorldRotation), elapsedSeconds, active, clockLimits.maximumDeltaTime, clockLimits.maximumParticleDeltaTime));
    const motionFrame = hasMotion ? motion.preview(elapsedSeconds, active) : { attributes: {}, fxPlayback: null };
    useLayoutEffect(() => { if (hasMotion)
        motion.update(elapsedSeconds, active); }, [motion, hasMotion, elapsedSeconds, active]);
    // These prefab Animator channels and DOTweens target different properties.
    // Explicit runtime/Animator overrides remain authoritative if future evidence overlaps.
    const attrs = { ...motionFrame.attributes, ...override?.attributes };
    const group = swordClientComponent(node, "CanvasGroup");
    const sourceRaycast = node.components.some(component => component.fields.m_Enabled && component.fields.m_RaycastTarget);
    const canRaycast = active && raycastEnabled && override?.raycast !== false && (!group || !group.fields.m_Enabled || group.fields.m_BlocksRaycasts !== false);
    const button = swordClientComponent(source, "NKCUIComStateButton") ?? swordClientComponent(source, "NKCUIComButton");
    const [buttonTracker] = useState(() => button ? new SwordTrainingClientButtonScale(button.fields) : null);
    const [, invalidateButton] = useState(0);
    const [tempRaycast, setTempRaycast] = useState(false);
    const buttonState = useRef<"normal" | "pressed" | "selected" | "locked">(button?.fields.m_bLock ? "locked" : button?.fields.m_bSelect ? "selected" : "normal");
    const pointer = useRef<number | null>(null);
    const [buttonClock] = useState(() => ({ time: elapsedSeconds }));
    const selected = Boolean(button?.fields.m_bSelect);
    const locked = override?.locked ?? Boolean(button?.fields.m_bLock);
    const interactive = Boolean(override?.onClick || override?.onPointerDown);
    const elementRef = useRef<HTMLDivElement>(null);
    const sourceScrollbarComponent = swordClientComponent(source, "Scrollbar");
    const liveScrollbar = scrollContext?.scrollbar?.path === node.path ? scrollContext.scrollbar : undefined;
    const scrollbarInteractive = Boolean(liveScrollbar && sourceScrollbarComponent?.fields.m_Enabled && sourceScrollbarComponent.fields.m_Interactable);
    const scrollbarPointer = useRef<{
        id: number;
        offset: number;
        dragging: boolean;
    } | null>(null);
    const scrollSource = swordClientComponent(source, "ScrollRect") ?? swordClientComponent(source, "LoopVerticalScrollRect")
        ?? swordClientComponent(source, "LoopVerticalScrollFlexibleRect");
    // LoopVerticalScrollFlexibleRect derives from the same original
    // LoopScrollRect input/elasticity implementation. Its variable-height
    // recycler is already resolved into the complete finite source-prefab list,
    // so it uses the verified loop input boundary without the fixed-row pool.
    const rewardScroll = scrollSource?.type === "LoopVerticalScrollRect" || scrollSource?.type === "LoopVerticalScrollFlexibleRect";
    // Unity ScrollRect.viewRect falls back to its own RectTransform when the
    // serialized m_Viewport reference is null (the Cafe result list does this).
    const scrollViewportPath = scrollSource
        ? scrollSource.references.find(ref => ref.field === "m_Viewport")?.nodePath ?? node.path
        : "";
    const scrollContentPath = scrollSource?.references.find(ref => ref.field === "m_Content")?.nodePath ?? "";
    const scrollViewport = scrollSource ? positionedAt(value, scrollViewportPath) : undefined;
    const scrollContent = scrollSource ? positionedAt(value, scrollContentPath) : undefined;
    const initialScrollPosition = scrollContent?.source.rect.anchoredPosition?.[1] ?? 0;
    const [scrollModel] = useState(() => scrollSource ? rewardScroll ? new SwordTrainingClientRewardScroll(scrollSource.fields, initialScrollPosition) : new SwordTrainingClientScroll(scrollSource.fields, initialScrollPosition) : null);
    if (scrollModel instanceof SwordTrainingClientRewardScroll && scrollViewport && scrollContent
        && scrollSource?.type === "LoopVerticalScrollRect") {
        const row = scrollContent.children[0];
        const group = swordClientComponent(scrollContent.source, "VerticalLayoutGroup");
        const grid = swordClientComponent(scrollContent.source, "GridLayoutGroup");
        if (group && row)
            scrollModel.configureRows({ count: scrollContent.children.length, rowHeight: row.box.height, spacing: Number(group.fields.m_Spacing), viewHeight: scrollViewport.box.height });
        else if (grid) {
            if (scrollContent.children.length > 1)
                throw new Error('Multi-cell source reward grid requires its own row adapter');
            const cell = grid.fields.m_CellSize as {
                y: number;
            }, spacing = grid.fields.m_Spacing as {
                y: number;
            };
            scrollModel.configureRows({ count: scrollContent.children.length, rowHeight: cell.y, spacing: spacing.y, viewHeight: scrollViewport.box.height });
        }
        else if (row)
            throw new Error("Missing original reward layout group");
    }
    const [scrollClock] = useState(() => ({ time: elapsedSeconds }));
    const scrollGesture = useRef({ blockedClick: false, cancelledPointer: null as number | null });
    const scrollKeys = useRef(new Set<string>());
    const scrollReset = useRef(override?.scrollResetKey);
    const [, invalidateScroll] = useState(0);
    const scrollPointer = useRef<{
        id: number;
        x: number;
        y: number;
        dragging: boolean;
    } | null>(null);
    const scrollDelta = Math.max(0, elapsedSeconds - scrollClock.time);
    const scrollPosition = scrollModel && scrollViewport && scrollContent ? active ? scrollModel.preview(scrollDelta, scrollViewport.box.height, scrollContent.box.height) : scrollModel.position : 0;
    const scrollMaximum = scrollViewport && scrollContent ? Math.max(0, scrollContent.box.height - scrollViewport.box.height) : 0;
    const scrollbarPath = scrollSource?.references.find(reference => reference.field === "m_VerticalScrollbar")?.nodePath;
    const scrollbarNode = scrollbarPath ? positionedAt(value, scrollbarPath) : undefined;
    const scrollbarSource = scrollbarNode ? swordClientComponent(scrollbarNode.source, "Scrollbar") : undefined;
    const scrollbarHandlePath = scrollbarSource?.references.find(reference => reference.field === "m_HandleRect")?.nodePath;
    const scrollbarContext: SourceScrollbarContext | undefined = scrollModel && scrollViewport && scrollContent && scrollbarPath && scrollbarHandlePath && scrollbarSource
        ? {
            path: scrollbarPath,
            handlePath: scrollbarHandlePath,
            direction: Number(scrollbarSource.fields.m_Direction),
            value: scrollMaximum > 0 ? Math.max(0, Math.min(1, scrollPosition / scrollMaximum)) : .5,
            size: scrollContent.box.height > 0 ? Math.max(0, Math.min(1, (scrollViewport.box.height - Math.max(0, -scrollPosition, scrollPosition - scrollMaximum)) / scrollContent.box.height)) : 1,
            setValue: normalized => {
                scrollModel.setNormalizedPosition(normalized, scrollViewport.box.height, scrollContent.box.height);
                invalidateScroll(previous => previous + 1);
            },
        }
        : undefined;
    const nextScrollContext = scrollModel ? { contentPath: scrollContentPath, viewportPath: scrollViewportPath, offset: scrollPosition - initialScrollPosition, viewHeight: scrollViewport?.box.height ?? 0,
        // The flexible Cafe list has already been expanded into its complete,
        // finite set of source-prefab rows. Keep those source paths mounted while
        // applying the original loop-scroll motion; fixed LoopVerticalScrollRect
        // reward lists still use their native-size pooled window.
        cullRows: scrollSource?.type === "LoopVerticalScrollRect",
        firstRow: scrollModel instanceof SwordTrainingClientRewardScroll ? scrollModel.firstRow : 0, rowCount: scrollModel instanceof SwordTrainingClientRewardScroll ? scrollModel.preparedRowCount : Infinity,
        gesture: scrollGesture.current, scrollbar: scrollbarContext } : scrollContext;
    useLayoutEffect(() => {
        const delta = Math.max(0, elapsedSeconds - scrollClock.time);
        scrollClock.time = elapsedSeconds;
        if (scrollModel && scrollViewport && scrollContent && active) {
            if (scrollModel instanceof SwordTrainingClientRewardScroll) {
                if (scrollReset.current !== override?.scrollResetKey) {
                    scrollReset.current = override?.scrollResetKey;
                    scrollModel.reset();
                    invalidateScroll(previous => previous + 1);
                }
                if (override?.scrollHotkeys) {
                    const keys = scrollKeys.current;
                    const direction = ["ArrowUp", "KeyW", "Numpad8"].some(key => keys.has(key)) ? -1 : ["ArrowDown", "KeyS", "Numpad2"].some(key => keys.has(key)) ? 1 : 0;
                    if (direction)
                        scrollModel.move(Math.fround(Math.fround(direction * 4000) * Math.fround(Math.min(clockLimits.maximumDeltaTime, delta))));
                }
            }
            scrollModel.update(delta, scrollViewport.box.height, scrollContent.box.height);
        }
        if (scrollModel && !active) {
            scrollModel.disable();
            scrollPointer.current = null;
        }
    }, [scrollModel, scrollClock, elapsedSeconds, scrollViewport?.box.height, scrollContent?.box.height, active, override?.scrollResetKey, override?.scrollHotkeys, clockLimits.maximumDeltaTime]);
    useEffect(() => {
        if (!rewardScroll || !active || !override?.scrollHotkeys) {
            scrollKeys.current.clear();
            return;
        }
        const codes = new Set(["ArrowUp", "KeyW", "Numpad8", "ArrowDown", "KeyS", "Numpad2"]);
        const down = (event: KeyboardEvent) => { if (codes.has(event.code)) {
            event.preventDefault();
            scrollKeys.current.add(event.code);
        } };
        const up = (event: KeyboardEvent) => { scrollKeys.current.delete(event.code); };
        const blur = () => scrollKeys.current.clear();
        window.addEventListener("keydown", down);
        window.addEventListener("keyup", up);
        window.addEventListener("blur", blur);
        return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); scrollKeys.current.clear(); };
    }, [rewardScroll, active, override?.scrollHotkeys]);
    useEffect(() => {
        const element = elementRef.current;
        if (!element || !scrollModel || !scrollViewport)
            return;
        const viewport = () => scrollViewportPath === node.path ? element
            : element.querySelector<HTMLElement>(`[data-source-node="${CSS.escape(scrollViewportPath)}"]`);
        const wheel = (event: WheelEvent) => {
            const target = viewport();
            if (!target || !(event.target instanceof Node) || !target.contains(event.target))
                return;
            event.preventDefault();
            event.stopPropagation();
            const scale = target.getBoundingClientRect().height / scrollViewport.box.height;
            // Browser wheel pixels are a different input unit from Unity's wheel
            // notches. Isolate that adapter; the source ScrollSensitivity stays 1.
            const unit = event.deltaMode === 0 ? 1 / scale : event.deltaMode === 2 ? scrollViewport.box.height : 1;
            const amount = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
            if (scrollModel instanceof SwordTrainingClientRewardScroll) {
                // DOM pixel/line/page wheel units are normalized at this boundary;
                // the original LoopScrollRect still receives notches and multiplies 150.
                const notches = event.deltaMode === 1 ? amount : amount * unit / 150;
                scrollModel.scroll(notches, scrollViewport.box.height, scrollContent!.box.height);
            }
            else
                scrollModel.scroll(amount * unit);
            invalidateScroll(previous => previous + 1);
        };
        const release = (event: PointerEvent) => {
            if (scrollPointer.current?.id !== event.pointerId)
                return;
            scrollPointer.current = null;
            scrollModel.endDrag();
            invalidateScroll(previous => previous + 1);
        };
        element.addEventListener("wheel", wheel, { passive: false });
        window.addEventListener("pointerup", release);
        window.addEventListener("pointercancel", release);
        return () => { element.removeEventListener("wheel", wheel); window.removeEventListener("pointerup", release); window.removeEventListener("pointercancel", release); };
    }, [scrollModel, scrollViewport?.box.height, scrollContent?.box.height, scrollViewportPath]);
    useEffect(() => {
        if (!scrollbarInteractive) {
            scrollbarPointer.current = null;
            return;
        }
        const release = (event: PointerEvent) => {
            if (scrollbarPointer.current?.id === event.pointerId)
                scrollbarPointer.current = null;
        };
        window.addEventListener("pointerup", release);
        window.addEventListener("pointercancel", release);
        return () => { window.removeEventListener("pointerup", release); window.removeEventListener("pointercancel", release); };
    }, [scrollbarInteractive]);
    const buttonDelta = Math.min(clockLimits.maximumDeltaTime, Math.max(0, elapsedSeconds - buttonClock.time));
    const touchScale = active && buttonTracker ? buttonTracker.preview(buttonDelta) : 1;
    useLayoutEffect(() => {
        if (!buttonTracker)
            return;
        const delta = Math.min(clockLimits.maximumDeltaTime, Math.max(0, elapsedSeconds - buttonClock.time));
        buttonClock.time = elapsedSeconds;
        if (!active) {
            buttonTracker.disable();
            if (pointer.current !== null)
                setTempRaycast(false);
            pointer.current = null;
            buttonState.current = locked ? "locked" : selected ? "selected" : "normal";
        }
        if (pointer.current !== null && scrollContext?.gesture.cancelledPointer === pointer.current) {
            pointer.current = null;
            buttonTracker.pointerUp(selected);
            setTempRaycast(false);
            buttonState.current = locked ? "locked" : selected ? "selected" : "normal";
        }
        buttonTracker.update(delta);
    }, [buttonTracker, buttonClock, elapsedSeconds, active, clockLimits.maximumDeltaTime, locked, selected, scrollContext?.gesture.cancelledPointer]);
    useEffect(() => {
        if (!buttonTracker || !interactive)
            return;
        const release = (event: PointerEvent) => {
            if (pointer.current !== event.pointerId)
                return;
            pointer.current = null;
            buttonTracker.pointerUp(selected);
            setTempRaycast(false);
            invalidateButton(previous => previous + 1);
            if (event.type === "pointercancel")
                buttonState.current = locked ? "locked" : selected ? "selected" : "normal";
        };
        window.addEventListener("pointerup", release);
        window.addEventListener("pointercancel", release);
        return () => { window.removeEventListener("pointerup", release); window.removeEventListener("pointercancel", release); };
    }, [buttonTracker, interactive, selected, locked]);
    const mask = node.components.find(component => component.type === "Mask" && component.fields.m_Enabled);
    const rectMask = node.components.find(component => component.type === "RectMask2D" && component.fields.m_Enabled);
    const alpha = attrs.m_Alpha ?? (group ? Number(group.fields.m_Alpha) : 1);
    // A controller can live on a parent and write a child Image. It is not itself
    // a drawable; only the actual Image's own branch creates a canvas here.
    const sourcePma = node.images?.length ? swordClientComponent(node, "NKC_FXM_UI_IMAGE_PMA") : undefined;
    const sourcePlayer = swordClientComponent(node, "NKC_FXM_PLAYER");
    const nextFxPlayback = sourcePlayer ? motionFrame.fxPlayback : fxPlayback;
    const particle = particles.get(node.path);
    const anchoredX = attrs["m_AnchoredPosition.x"];
    const anchoredY = attrs["m_AnchoredPosition.y"];
    const localX = attrs["m_LocalPosition.x"];
    const localY = attrs["m_LocalPosition.y"];
    const dynamicX = separateDynamicTransforms
        ? localX === undefined ? (anchoredX ?? source.rect.anchoredPosition?.[0] ?? 0) - (source.rect.anchoredPosition?.[0] ?? 0) : localX - source.rect.localPosition[0]
        : (anchoredX ?? node.rect.anchoredPosition?.[0] ?? 0) - (node.rect.anchoredPosition?.[0] ?? 0);
    const dynamicY = separateDynamicTransforms
        ? localY === undefined ? (anchoredY ?? source.rect.anchoredPosition?.[1] ?? 0) - (source.rect.anchoredPosition?.[1] ?? 0) : localY - source.rect.localPosition[1]
        : (anchoredY ?? node.rect.anchoredPosition?.[1] ?? 0) - (node.rect.anchoredPosition?.[1] ?? 0);
    const left = box.left + dynamicX;
    const top = box.top - dynamicY - (scrollContext?.contentPath === node.path ? scrollContext.offset : 0);
    const rotation = attrs['localEulerAngles.z'] !== undefined ? -attrs['localEulerAngles.z'] : attrs["worldEulerAngles.z"] === undefined ? box.rotation : -attrs["worldEulerAngles.z"] - parentRotation;
    const scaleX = attrs["m_LocalScale.x"] ?? box.scaleX, scaleY = attrs["m_LocalScale.y"] ?? box.scaleY;
    const style: CSSProperties = {
        display: active ? undefined : "none",
        position: "absolute", left, top, width: box.width, height: box.height,
        transformOrigin: `${box.pivotX * 100}% ${(1 - box.pivotY) * 100}%`,
        transform: `rotate(${rotation}deg) scale(${scaleX * touchScale}, ${scaleY * touchScale})`,
        opacity: alpha,
        // A source RectMask clips; it is not a second browser scroll container.
        // Native focus must not scroll it independently of the source ScrollRect.
        overflow: rectMask ? "clip" : "visible",
        // Transparent source Graphics still block input (RaycastArea has alpha 0,
        // RaycastTarget=1, CullTransparentMesh=false). Preserve sibling draw order.
        pointerEvents: canRaycast && (sourceRaycast || interactive || scrollbarInteractive || scrollContext?.viewportPath === node.path) ? "auto" : "none",
        // RectMask viewport nodes need a browser hit surface, unlike Unity's
        // non-Graphic RectMask2D. Keep an interactive Scrollbar above that
        // synthetic surface while retaining the authored sibling geometry.
        zIndex: scrollbarInteractive ? 1 : undefined,
        cursor: interactive || scrollbarInteractive ? "pointer" : undefined,
        touchAction: scrollContext?.viewportPath === node.path || scrollbarInteractive ? "none" : undefined,
        padding: 0, border: 0, margin: 0, background: "none", textAlign: "initial",
    };
    const imageLayer = node.images?.[0];
    const liveOverride = () => overridesRef.current[node.path];
    const invokePointerClick = () => {
        if (scrollContext?.gesture.blockedClick)
            return;
        // NKCUIComStateButtonBase.OnPointerClick checks Pressed/Locked state, not
        // PointerEventData.button. StandaloneInputModule also dispatches middle
        // and right clicks, which browsers expose as auxclick instead of click.
        if (!button || buttonState.current === "pressed") {
            buttonState.current = selected ? "selected" : "normal";
            liveOverride()?.onClick?.();
        }
        else if (buttonState.current === "locked" && (button.type === "NKCUIComButton" || button.fields.m_bGetCallbackWhileLocked))
            liveOverride()?.onClick?.();
    };
    const scrollbarValueAt = (event: ReactPointerEvent<HTMLDivElement>, offset: number) => {
        if (!liveScrollbar || !elementRef.current)
            return liveScrollbar?.value ?? 0;
        const rect = elementRef.current.getBoundingClientRect();
        const vertical = liveScrollbar.direction >= 2;
        const extent = vertical ? rect.height : rect.width;
        const coordinate = (vertical ? event.clientY - rect.top : event.clientX - rect.left) - offset;
        const movable = extent * (1 - liveScrollbar.size);
        if (!(movable > 0))
            return liveScrollbar.value;
        const start = extent * liveScrollbar.size / 2;
        const screenValue = Math.max(0, Math.min(1, (coordinate - start) / movable));
        return liveScrollbar.direction === 0 || liveScrollbar.direction === 3 ? screenValue : 1 - screenValue;
    };
    const beginScrollbarPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!scrollbarInteractive || !liveScrollbar || event.button !== 0 || !elementRef.current)
            return;
        event.preventDefault();
        event.stopPropagation();
        const handle = elementRef.current.querySelector<HTMLElement>(`[data-source-node="${CSS.escape(liveScrollbar.handlePath)}"]`);
        const vertical = liveScrollbar.direction >= 2;
        const coordinate = vertical ? event.clientY : event.clientX;
        const handleBounds = handle?.getBoundingClientRect();
        const handleStart = handleBounds ? vertical ? handleBounds.top : handleBounds.left : 0;
        const handleExtent = handleBounds ? vertical ? handleBounds.height : handleBounds.width : 0;
        const overHandle = Boolean(handleBounds && coordinate >= handleStart && coordinate <= handleStart + handleExtent);
        if (overHandle) {
            scrollbarPointer.current = { id: event.pointerId, offset: coordinate - (handleStart + handleExtent / 2), dragging: true };
        }
        else {
            const target = scrollbarValueAt(event, 0);
            liveScrollbar.setValue(liveScrollbar.value + Math.sign(target - liveScrollbar.value) * liveScrollbar.size);
            scrollbarPointer.current = { id: event.pointerId, offset: 0, dragging: false };
        }
        event.currentTarget.setPointerCapture(event.pointerId);
    };
    const moveScrollbarPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
        const current = scrollbarPointer.current;
        if (!scrollbarInteractive || !liveScrollbar || !current?.dragging || current.id !== event.pointerId)
            return;
        event.preventDefault();
        event.stopPropagation();
        liveScrollbar.setValue(scrollbarValueAt(event, current.offset));
    };
    const content = <>
    {particle && <SwordTrainingParticleEmitter config={particle} elapsedSeconds={elapsedSeconds} active={active} fxPlayback={nextFxPlayback} width={box.width} height={box.height} pivot={[box.pivotX, box.pivotY]} maximumDeltaTime={clockLimits.maximumDeltaTime} maximumParticleTimestep={clockLimits.maximumParticleDeltaTime}/>}
    {sourcePma && renderGraphics && <PrefabPmaImage node={node} assets={assets} width={box.width} height={box.height} playback={nextFxPlayback}/>}
    {!mask && !sourcePma && renderGraphics && node.images?.map(image => {
            const color: ClientColor = [attrs["m_Color.r"] ?? image.color[0], attrs["m_Color.g"] ?? image.color[1], attrs["m_Color.b"] ?? image.color[2], attrs["m_Color.a"] ?? image.color[3]];
            const custom = imageRenderer?.({ node, image, width: box.width, height: box.height, pivot: [box.pivotX, box.pivotY], color, fillAmount: attrs.m_FillAmount ?? image.fillAmount, assets });
            if (custom !== undefined)
                return <span key={image.componentPathId} style={{ display: 'contents' }}>{custom}</span>;
            const material = swordTrainingImageMaterial(node, image, assets);
            if (material)
                return <SwordTrainingAdditiveImage key={image.componentPathId} image={image} width={box.width} height={box.height} pivot={[box.pivotX, box.pivotY]} color={color} material={material}/>;
            return <SwordTrainingImage key={image.componentPathId} image={image} width={box.width} height={box.height} pivot={[box.pivotX, box.pivotY]} color={color} fillAmount={attrs.m_FillAmount ?? image.fillAmount}/>;
        })}
    {renderGraphics && node.texts?.map(text => <SwordTrainingText key={text.componentPathId} source={text} value={override?.text ?? (text.stringKey ? strings[text.stringKey] : text.text)} width={box.width} height={box.height}/>)}
    {!override?.replaceChildren && children.filter((child, index) => !(scrollContext?.cullRows && scrollContext.contentPath === node.path) ||
            (index >= scrollContext.firstRow && index < scrollContext.firstRow + scrollContext.rowCount && child.box.top + child.box.height >= scrollContext.offset && child.box.top <= scrollContext.offset + scrollContext.viewHeight)).map(child => <MemoPrefabNode key={child.node.path} value={child} overridesRef={overridesRef} revisions={revisions} revision={revisions.get(child.node.path) ?? 0} strings={strings} assets={assets} particles={particles} elapsedSeconds={elapsedSeconds} clockLimits={clockLimits} parentRotation={parentRotation + rotation} fxPlayback={nextFxPlayback} scrollContext={nextScrollContext} raycastEnabled={canRaycast} imageRenderer={imageRenderer} deferInactiveGraphics={deferInactiveGraphics} retainGraphicsAfterActivation={retainGraphicsAfterActivation} separateDynamicTransforms={separateDynamicTransforms} memoizeSubtrees={memoizeSubtrees}/>)}
    {override?.content}
  </>;
    return <div ref={elementRef} {...override?.data} data-source-node={node.path} data-source-active={active ? "true" : "false"} data-source-button-scale={button ? touchScale : undefined} data-source-scroll-position={scrollModel ? scrollPosition : undefined} data-source-scroll-max={scrollModel && scrollContent && scrollViewport ? Math.max(0, scrollContent.box.height - scrollViewport.box.height) : undefined} data-source-scroll-first-row={scrollModel instanceof SwordTrainingClientRewardScroll ? scrollModel.firstRow : undefined} data-source-scroll-pool-count={scrollModel instanceof SwordTrainingClientRewardScroll ? scrollModel.preparedRowCount : undefined} data-source-scrollbar-value={liveScrollbar?.value} data-source-scrollbar-size={liveScrollbar?.size} data-source-scrollbar-direction={liveScrollbar?.direction} data-testid={override?.label ? `sword-${override.label}` : undefined} data-source-raycast={canRaycast && sourceRaycast} style={style} role={scrollbarInteractive ? "scrollbar" : interactive ? "button" : undefined} tabIndex={interactive || scrollbarInteractive ? 0 : undefined} aria-label={override?.label} aria-disabled={interactive || override?.locked !== undefined ? locked : undefined} aria-valuemin={scrollbarInteractive ? 0 : undefined} aria-valuemax={scrollbarInteractive ? 1 : undefined} aria-valuenow={scrollbarInteractive ? liveScrollbar?.value : undefined} onPointerDownCapture={scrollModel ? event => {
            if (event.button !== 0)
                return;
            if (scrollbarPath && event.target instanceof Element
                && event.target.closest(`[data-source-node="${CSS.escape(scrollbarPath)}"]`))
                return;
            scrollGesture.current.blockedClick = false;
            scrollGesture.current.cancelledPointer = null;
            scrollPointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false };
            scrollModel.initializePotentialDrag();
        } : scrollbarInteractive ? beginScrollbarPointer : undefined} onPointerDown={interactive ? event => {
            if (event.button > 2)
                return;
            event.stopPropagation();
            pointer.current = event.pointerId;
            buttonState.current = locked ? "locked" : "pressed";
            buttonTracker?.pointerDown();
            invalidateButton(previous => previous + 1);
            setTempRaycast(Boolean(buttonTracker && buttonTracker.touchSize < 1));
            if (!locked)
                liveOverride()?.onPointerDown?.({ x: event.clientX, y: event.clientY, pointerId: event.pointerId });
        } : undefined} onPointerUp={override?.onPointerUp ? () => liveOverride()?.onPointerUp?.() : undefined} onPointerCancel={override?.onPointerUp ? () => liveOverride()?.onPointerUp?.() : undefined} onPointerLeave={() => { if (buttonState.current === "pressed")
        buttonState.current = selected ? "selected" : "normal"; buttonTracker?.pointerExit(); liveOverride()?.onPointerLeave?.(); }} onPointerMoveCapture={scrollModel && scrollViewport && scrollContent ? event => {
            const current = scrollPointer.current;
            if (!current || current.id !== event.pointerId)
                return;
            const viewport = scrollViewportPath === node.path ? event.currentTarget
                : event.currentTarget.querySelector<HTMLElement>(`[data-source-node="${CSS.escape(scrollViewportPath)}"]`);
            if (!viewport)
                return;
            const scale = viewport.getBoundingClientRect().height / scrollViewport.box.height;
            const localY = -event.clientY / scale;
            if (!current.dragging && Math.hypot(event.clientX - current.x, event.clientY - current.y) >= clockLimits.dragThreshold) {
                current.dragging = true;
                scrollModel.beginDrag(localY);
                scrollGesture.current.blockedClick = true;
                scrollGesture.current.cancelledPointer = event.pointerId;
                event.currentTarget.setPointerCapture(event.pointerId);
            }
            if (current.dragging) {
                event.preventDefault();
                scrollModel.drag(localY, scrollViewport.box.height, scrollContent.box.height);
                invalidateScroll(previous => previous + 1);
            }
        } : scrollbarInteractive ? moveScrollbarPointer : undefined} onPointerMove={interactive ? event => {
            // Touch browsers may implicitly capture the pointer. Raycast the actual
            // source hitbox so moving outside still cancels native Pressed state.
            if (pointer.current === event.pointerId && buttonState.current === "pressed") {
                const hit = document.elementFromPoint(event.clientX, event.clientY);
                if (!hit || !event.currentTarget.contains(hit))
                    buttonState.current = selected ? "selected" : "normal";
            }
        } : undefined} onClickCapture={scrollModel ? event => { if (scrollGesture.current.blockedClick) {
            event.preventDefault();
            event.stopPropagation();
        } }
            : scrollbarInteractive ? event => { event.preventDefault(); event.stopPropagation(); } : undefined} onClick={override?.onClick ? event => {
            event.stopPropagation();
            invokePointerClick();
        } : undefined} onAuxClick={override?.onClick ? event => {
            if (event.button !== 1 && event.button !== 2)
                return;
            event.preventDefault();
            event.stopPropagation();
            invokePointerClick();
        } : undefined} onContextMenu={override?.onClick ? event => { event.preventDefault(); event.stopPropagation(); } : undefined}>
    {mask && imageLayer ? <SwordTrainingImage image={imageLayer} width={box.width} height={box.height} pivot={[box.pivotX, box.pivotY]} mask showMaskGraphic={Boolean(mask.fields.m_ShowMaskGraphic)}>{content}</SwordTrainingImage> : content}
    {tempRaycast && <div data-source-temp-raycaster="true" style={{ position: "absolute", left: "-20%", top: "-20%", width: "140%", height: "140%", pointerEvents: "auto" }}/>}
  </div>;
}
const MemoPrefabNode = memo(PrefabNode, (previous, next) => {
    if (!next.memoizeSubtrees)
        return false;
    if (previous.value !== next.value || previous.revision !== next.revision)
        return false;
    if ((previous.value.hasFrameWork || next.value.hasFrameWork) && previous.elapsedSeconds !== next.elapsedSeconds)
        return false;
    return previous.overridesRef === next.overridesRef
        && previous.strings === next.strings
        && previous.assets === next.assets
        && previous.particles === next.particles
        && previous.clockLimits === next.clockLimits
        && previous.parentRotation === next.parentRotation
        && previous.fxPlayback === next.fxPlayback
        && previous.scrollContext === next.scrollContext
        && previous.raycastEnabled === next.raycastEnabled
        && previous.imageRenderer === next.imageRenderer
        && previous.deferInactiveGraphics === next.deferInactiveGraphics
        && previous.retainGraphicsAfterActivation === next.retainGraphicsAfterActivation
        && previous.separateDynamicTransforms === next.separateDynamicTransforms;
});
export default function SwordTrainingPrefab({ layout, rootPath, width, height, strings, particles, overrides = {}, elapsedSeconds = 0, imageRenderer, deferInactiveGraphics = false, retainGraphicsAfterActivation = false, separateDynamicTransforms = false, memoizeSubtrees = false }: {
    layout: SwordClientLayout;
    rootPath: string;
    width: number;
    height: number;
    particles?: readonly SwordParticleSystemSource[];
    strings: Record<string, string>;
    overrides?: Overrides;
    elapsedSeconds?: number;
    imageRenderer?: SourcePrefabImageRenderer;
    deferInactiveGraphics?: boolean;
    retainGraphicsAfterActivation?: boolean;
    /** Keep animated transform attributes out of the hierarchy layout pass. */
    separateDynamicTransforms?: boolean;
    /** Reconcile only source branches whose frame inputs actually changed. */
    memoizeSubtrees?: boolean;
}) {
    const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
    const [fontError, setFontError] = useState<string | null>(null);
    const overridesRef = useRef(overrides);
    overridesRef.current = overrides;
    const fonts = useMemo(() => {
        type SourceFont = {
            cssFamily: string;
            webPath: string;
            fallbackFonts?: {
                cssFamily: string;
                webPath: string;
            }[];
        };
        return [...new Map(layout.nodes.flatMap(node => node.texts ?? []).flatMap(text => {
                const font = text.font as SourceFont;
                return [font, ...(font.fallbackFonts ?? [])].map(item => [item.cssFamily, item] as const);
            })).values()];
    }, [layout]);
    const fontSources = JSON.stringify(fonts.map(font => [font.cssFamily, font.webPath]));
    const assets = useMemo(() => swordClientIndex(layout).assets, [layout]);
    const particleIndex = useMemo(() => new Map((particles ?? []).map(config => [config.path, config])), [particles]);
    const clockLimits = useMemo(() => {
        const manifest = layout as SwordClientLayout & {
            evidence: {
                playerSettings: {
                    timeManager: Record<string, number>;
                };
            };
            scene: {
                components: {
                    type: string;
                    fields: Record<string, unknown>;
                }[];
            };
        };
        const source = manifest.evidence.playerSettings.timeManager;
        const maximumDeltaTime = source["Maximum Allowed Timestep"], maximumParticleDeltaTime = source["Maximum Particle Timestep"];
        const dragThreshold = Number(manifest.scene.components.find(component => component.type === "EventSystem")?.fields.m_DragThreshold);
        if (!(maximumDeltaTime > 0 && maximumParticleDeltaTime > 0 && dragThreshold >= 0))
            throw new Error("Missing verified source UI clock limits");
        return { maximumDeltaTime, maximumParticleDeltaTime, dragThreshold };
    }, [layout]);
    useEffect(() => {
        let disposed = false;
        void Promise.all((JSON.parse(fontSources) as [
            string,
            string
        ][]).map(async ([cssFamily, webPath]) => {
            try {
                const key = `${cssFamily}:${webPath}`;
                let pending = sourceFontLoads.get(key);
                if (!pending) {
                    const face = new FontFace(cssFamily, `url("${deploymentUrl(webPath)}")`);
                    pending = face.load().then(value => { document.fonts.add(value); return value; });
                    sourceFontLoads.set(key, pending);
                }
                return await pending;
            }
            catch (cause) {
                // FontFace.load may reject with a browser Event instead of an Error.
                // Preserve the actual source identity and do not silently use an OS font.
                const detail = cause instanceof Error ? `: ${cause.message}` : "";
                throw new Error(`클라이언트 글꼴을 불러오지 못했습니다: ${cssFamily} (${webPath})${detail}`);
            }
        })).then(() => {
            if (disposed)
                return;
            const nextContext = document.createElement("canvas").getContext("2d");
            if (!nextContext)
                throw new Error("클라이언트 글꼴 측정용 Canvas 2D를 사용할 수 없습니다.");
            setFontError(null);
            setContext(nextContext);
        }).catch((cause: unknown) => {
            if (!disposed)
                setFontError(cause instanceof Error ? cause.message : "클라이언트 글꼴을 불러오지 못했습니다.");
        });
        return () => { disposed = true; };
    }, [fontSources]);
    const structuralCache = useRef<{
        signature: string;
        overrides: Overrides;
    }>({ signature: "", overrides: {} });
    let layoutOverrides = overrides;
    if (separateDynamicTransforms) {
        const entries = Object.entries(overrides).flatMap(([path, value]) => {
            const activeAttribute = value.attributes?.m_IsActive;
            if (value.active === undefined && value.text === undefined && activeAttribute === undefined)
                return [];
            return [[path, value.active ?? null, value.text ?? null, activeAttribute ?? null] as const];
        });
        const signature = JSON.stringify(entries);
        if (signature !== structuralCache.current.signature) {
            structuralCache.current = {
                signature,
                overrides: Object.fromEntries(entries.map(([path, active, text, activeAttribute]) => [path, {
                        active: active === null ? undefined : active,
                        text: text === null ? undefined : text,
                        attributes: activeAttribute === null ? undefined : { m_IsActive: activeAttribute },
                    } satisfies SwordPrefabOverride])),
            };
        }
        layoutOverrides = structuralCache.current.overrides;
    }
    const positioned = useMemo(() => context ? buildLayout(layout, rootPath, width, height, strings, layoutOverrides, context) : null, [context, layout, rootPath, width, height, strings, layoutOverrides]);
    const revisions = useMemo(() => positioned ? prefabRevisionMap(positioned, overrides) : new Map<string, number>(), [positioned, overrides]);
    if (fontError)
        return <div role="alert" data-source-status="error">{fontError}</div>;
    return positioned ? <MemoPrefabNode key={rootPath} value={positioned} overridesRef={overridesRef} revisions={revisions} revision={revisions.get(rootPath) ?? 0} strings={strings} assets={assets} particles={particleIndex} elapsedSeconds={elapsedSeconds} clockLimits={clockLimits} imageRenderer={imageRenderer} deferInactiveGraphics={deferInactiveGraphics} retainGraphicsAfterActivation={retainGraphicsAfterActivation} separateDynamicTransforms={separateDynamicTransforms} memoizeSubtrees={memoizeSubtrees}/> : null;
}
