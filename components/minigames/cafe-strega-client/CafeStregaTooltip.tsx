"use client";
/** Original misc tooltip research adapter. Measured native TMP/layout is required. */
import SourcePrefab, { type SwordPrefabOverride, type SourcePrefabImageRenderer } from '@/components/minigames/sword-training/SwordTrainingPrefab';
import { cafeSourceBinding, cafeBindSourceImage, type CafeSourceV2 } from '@/lib/cafeStregaSourceV2';
import { sampleSwordTrainingClientAnimation } from '@/lib/swordTrainingClientAnimation';
import type { SwordClientAsset, SwordClientNode } from '@/lib/swordTrainingClientLayout';
import { CAFE_MISC_SLOT_EXTRA_OFF } from '@/lib/cafeStregaMiscSlotV2';
import { cafeTooltipPosition } from '@/lib/cafeStregaTooltipStateV2';
import { cafeStregaDisplayItemDescription } from '@/lib/cafeStregaItemDescriptionV2';
export const CAFE_TOOLTIP_ROOT = 'NKM_UI_POPUP_TOOLTIP';
const ITEM = 'NKM_UI_POPUP_TOOLTIP_ITEM', TEXT = 'NKM_UI_POPUP_TOOLTIP_TEXT';
export type CafeTooltipItem = {
    itemId: number;
    name: string;
    description: string;
    type: string;
    grade: string;
    dateStrId: string | null;
};
export type CafeTooltipNativeGeometry = {
    panelHeight: number;
    parentSizeDelta: readonly [
        number,
        number
    ];
    parentLocalPosition: readonly [
        number,
        number,
        number
    ];
};
/** Original OpenInstance + SetParent, not manually styled HTML content. */
export function instantiateCafeTooltip(source: CafeSourceV2): CafeSourceV2 {
    const root = cafeSourceBinding(source, CAFE_TOOLTIP_ROOT, 'NKCUITooltip');
    const parent = root.path('m_rtParent');
    const remap = (value: string) => value === ITEM || value.startsWith(ITEM + '/') || value === TEXT || value.startsWith(TEXT + '/')
        ? parent + '/' + value : value;
    const nodes = source.nodes.map(node => {
        const isTemplate = node.path === ITEM || node.path === TEXT;
        const cloned = remap(node.path) !== node.path;
        return { ...node, path: remap(node.path), parentPath: isTemplate ? parent : node.parentPath ? remap(node.parentPath) : null,
            siblingIndex: isTemplate ? node.path === ITEM ? 0 : 1 : node.siblingIndex,
            rect: isTemplate ? { ...node.rect, localScale: [1, 1, 1], localPosition: [node.rect.localPosition[0], node.rect.localPosition[1], 0] } : node.rect,
            components: node.components.map(component => ({ ...component,
                fields: node.path === parent && component.type === 'VerticalLayoutGroup' ? { ...component.fields, m_Spacing: 160 } : component.fields,
                references: cloned ? component.references.map(reference => ({ ...reference,
                    nodePath: reference.nodePath ? remap(reference.nodePath) : reference.nodePath })) : component.references,
            })),
        } as SwordClientNode;
    });
    return { ...source, nodes };
}
export function bindCafeTooltipFrame(source: CafeSourceV2, item: CafeTooltipItem, sprite: SwordClientAsset, ownedCount: number, strings: Record<string, string>, geometry: CafeTooltipNativeGeometry, screen: {
    width: number;
    height: number;
}, screenPoint: {
    x: number;
    y: number;
} | null, localPoint: {
    x: number;
    y: number;
}, canvasHeight: number) {
    if (![704, 705, 706, 31098, 31099, 31100, 31101, 31102, 31103].includes(item.itemId))
        throw new Error('Unaudited tooltip item');
    if (!Number.isFinite(geometry.panelHeight) || geometry.panelHeight <= 0)
        throw new Error('Original native tooltip layout required');
    let layout = source;
    const root = cafeSourceBinding(layout, CAFE_TOOLTIP_ROOT, 'NKCUITooltip');
    const parent = root.path('m_rtParent'), panel = root.path('m_rtPanel'), deco = root.path('m_rtDeco');
    const tip = cafeSourceBinding(layout, `${parent}/${ITEM}`, 'NKCUITooltipItem');
    const slotPath = tip.path('m_slot'), slot = cafeSourceBinding(layout, slotPath, 'NKCUISlot');
    const overrides: Record<string, SwordPrefabOverride> = {};
    const patch = (path: string, value: SwordPrefabOverride) => {
        overrides[path] = { ...overrides[path], ...value,
            attributes: { ...overrides[path]?.attributes, ...value.attributes } };
    };
    const active = (path: string | null, value: boolean) => { if (path)
        patch(path, { active: value }); };
    const type = strings[item.type === 'IMT_RESOURCE' ? 'SI_DP_MISC_TYPE_STRING_IMT_RESOURCE' : 'SI_DP_MISC_TYPE_STRING_IMT_RANDOMBOX'];
    const count = strings.SI_DP_TOOLTIP_QUANTITY_ONE_PARAM;
    if (type === undefined || count === undefined)
        throw new Error('Original tooltip strings missing');
    patch(tip.path('m_type'), { text: type });
    patch(tip.path('m_name'), { text: item.name });
    patch(tip.path('m_amount'), { text: count.replace('{0:N0}', ownedCount.toLocaleString('ko-KR')) });
    patch(`${parent}/${TEXT}`, { text: cafeStregaDisplayItemDescription(item.description) });
    active(tip.path('m_lbPrivateEquip'), false);
    for (const field of [...CAFE_MISC_SLOT_EXTRA_OFF, 'm_lbName', 'm_objItemCount', 'm_lbItemCount'])
        active(slot.optionalPath(field), false);
    active(slot.path('m_objTimeInterval'), Boolean(item.dateStrId));
    const backgroundId = slot.reference(item.grade === 'NIG_SSR' ? 'm_spBGRaritySSR' : 'm_spBGRarityN').assetId;
    const background = layout.assets.find(asset => asset.id === backgroundId);
    if (!background)
        throw new Error('Original tooltip rarity background missing');
    layout = cafeBindSourceImage(layout, slot.path('m_imgIcon'), sprite, [1, 1, 1, 1]) as CafeSourceV2;
    layout = cafeBindSourceImage(layout, slot.path('m_imgBG'), background) as CafeSourceV2;
    layout = { ...layout, nodes: layout.nodes.map(node => node.path === slotPath
            ? { ...node, components: node.components.filter(component => component.type !== 'LayoutElement') } : node) };
    patch(slotPath, { raycast: false });
    const none = layout.animations.find(clip => clip.type === 'AnimationClip' && clip.name === 'AB_ICON_SLOT_FX_AWAKEN_NONE');
    if (!none)
        throw new Error('Original tooltip non-awakened pose missing');
    for (const [relative, attributes] of Object.entries(sampleSwordTrainingClientAnimation(none, 0)))
        patch(relative ? `${slot.path('m_animAwakenFX')}/${relative}` : slot.path('m_animAwakenFX'), { attributes });
    const position = cafeTooltipPosition(screen, screenPoint, localPoint, canvasHeight, geometry.panelHeight);
    for (const [index, field] of ['m_deco_rightUp', 'm_deco_rightDown', 'm_deco_leftUp', 'm_deco_leftDown'].entries())
        active(root.path(field), position.pivotType === index + 1);
    layout = { ...layout, nodes: layout.nodes.map(node => {
            // NKCUIManager reparents popup instances at the UI root and resets the
            // popup RectTransform. The authored prefab position is an off-screen pool
            // location and is not the position used by NKCUITooltip.Open.
            if (node.path === CAFE_TOOLTIP_ROOT)
                return { ...node, rect: { ...node.rect,
                        anchoredPosition: [0, 0] as const, localPosition: [0, 0, node.rect.localPosition[2]] as const } };
            if (node.path === panel)
                return { ...node, rect: { ...node.rect, pivot: position.pivot,
                        anchoredPosition: position.position, localPosition: [position.position[0], position.position[1], 0] as const,
                        sizeDelta: [node.rect.sizeDelta![0], geometry.panelHeight] as const } };
            if (node.path === deco)
                return { ...node, rect: { ...node.rect,
                        // Both source parent and deco have the same stretch anchors and pivot.
                        // Their source Update copies localPosition and sizeDelta every frame.
                        anchoredPosition: layout.nodes.find(candidate => candidate.path === parent)!.rect.anchoredPosition,
                        sizeDelta: geometry.parentSizeDelta, localPosition: geometry.parentLocalPosition } };
            return node;
        }) };
    active(CAFE_TOOLTIP_ROOT, true);
    return { layout, overrides, position };
}
export default function CafeStregaTooltip(props: {
    layout: CafeSourceV2;
    item: CafeTooltipItem;
    itemSprite: SwordClientAsset;
    ownedCount: number;
    strings: Record<string, string>;
    geometry: CafeTooltipNativeGeometry;
    width: number;
    height: number;
    screen: {
        width: number;
        height: number;
    };
    screenPoint: {
        x: number;
        y: number;
    } | null;
    localPoint: {
        x: number;
        y: number;
    };
    imageRenderer?: SourcePrefabImageRenderer;
}) {
    const view = bindCafeTooltipFrame(props.layout, props.item, props.itemSprite, props.ownedCount, props.strings, props.geometry, props.screen, props.screenPoint, props.localPoint, props.height);
    return <SourcePrefab layout={view.layout} rootPath={CAFE_TOOLTIP_ROOT} width={props.width} height={props.height} strings={props.strings} overrides={view.overrides} elapsedSeconds={0} imageRenderer={props.imageRenderer} deferInactiveGraphics/>;
}
