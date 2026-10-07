import type { SwordClientAsset, SwordClientLayout, SwordClientNode } from './swordTrainingClientLayout.ts';
export const CAFE_MISSION_ROOT = 'POPUP_UI_SINGLE_CAFE_MISSION';
export const CAFE_MISSION_RESULT_ROOT = `${CAFE_MISSION_ROOT}/POPUP_SINGLE_CAFE_MISSION_RESULT`;
export const CAFE_MISSION_SLOT_TEMPLATE = 'POPUP_UI_SINGLE_CAFE_MISSION_SLOT';
export const CAFE_MISSION_REWARD_SLOT_TEMPLATE = 'POPUP_UI_SINGLE_CAFE_REWARD_SLOT';
export const CAFE_MISSION_TAB_ID = 9992;
export const CAFE_MISSION_GROUP_ID = 999201;
export const CAFE_MISSION_LIST_CONTENT = `${CAFE_MISSION_ROOT}/Content/Mission/Top/Mission_List_Root/MISSION_LIST_ScrollRect/Viewport/Content`;
export const CAFE_MISSION_GROUP_REWARD_CONTENT = `${CAFE_MISSION_ROOT}/POPUP_SINGLE_CAFE_REWARD/SLOT_LIST_ScrollRect/Viewport/Content`;
export const CAFE_MISSION_RESOURCE_ROOT = `${CAFE_MISSION_ROOT}/SINGLE_CAFE_RES_LIST`;
export const CAFE_MISSION_ERRAND_ROOT = `${CAFE_MISSION_ROOT}/Content/Mission/Bottom/ERRAND_Root`;
export const CAFE_MISSION_ERRAND_SCORE_ROOT = `${CAFE_MISSION_ERRAND_ROOT}/MY_SCORE`;
export const CAFE_MISSION_ERRAND_SCORE_ICON = `${CAFE_MISSION_ERRAND_SCORE_ROOT}/Icon`;
export const CAFE_MISSION_ERRAND_SCORE_TEXT = `${CAFE_MISSION_ERRAND_SCORE_ROOT}/MY_SCORE_TEXT`;
export const CAFE_MISSION_ERRAND_STEP_ROOT = `${CAFE_MISSION_ERRAND_ROOT}/STEP`;
export const CAFE_MISSION_ERRAND_INGREDIENT_REWARD_ROOT = `${CAFE_MISSION_ERRAND_ROOT}/INGREDIENT_REWARD`;
export const CAFE_MISSION_ERRAND_INGREDIENT_REWARD_SCALE = 0.9;
export const CAFE_MISSION_ERRAND_INGREDIENT_REWARD_RIGHT_OFFSET = 80;
/** These slot branches are permanently absent under the offline mission
 * presentation policy. Keep the extracted source intact, but omit the dead
 * subtrees before cloning seven runtime rows. */
export const CAFE_MISSION_SLOT_RUNTIME_OMITTED_ROOTS = [
    `${CAFE_MISSION_SLOT_TEMPLATE}/ButtonBg`,
    `${CAFE_MISSION_SLOT_TEMPLATE}/COUNT_TEXT`,
    `${CAFE_MISSION_SLOT_TEMPLATE}/Line`,
    `${CAFE_MISSION_SLOT_TEMPLATE}/RewardBg`,
    `${CAFE_MISSION_SLOT_TEMPLATE}/STATE_CLEAR`,
    `${CAFE_MISSION_SLOT_TEMPLATE}/STATE_CLEAR_REPEAT`,
    `${CAFE_MISSION_SLOT_TEMPLATE}/STATE_COMPLETE`,
    `${CAFE_MISSION_SLOT_TEMPLATE}/STATE_COOL_LOCK`,
    `${CAFE_MISSION_SLOT_TEMPLATE}/STATE_COOL_TIME`,
] as const;
export function retainCafeMissionSlotRuntimePath(path: string): boolean {
    return !CAFE_MISSION_SLOT_RUNTIME_OMITTED_ROOTS.some(root => path === root || path.startsWith(`${root}/`));
}
export type CafeMissionRowV2 = {
    m_MissionID: number;
    m_MissionTabId: number;
    m_MissionCounterGroupID: number;
    m_MissionIcon: string;
    m_MissionTitle: string;
    m_MissionDesc: string;
    m_ResetInterval: string;
    m_Times: number;
    m_MissionCond: string;
    m_MissionRequire?: number;
    m_ShortCutType?: string;
    m_ShortCut?: string;
    m_RewardType_1?: string;
    m_RewardID_1?: number;
    m_RewardValue_1?: number;
    m_RewardType_2?: string;
    m_RewardID_2?: number;
    m_RewardValue_2?: number;
    m_RewardType_3?: string;
    m_RewardID_3?: number;
    m_RewardValue_3?: number;
    [field: string]: string | number | undefined;
};
export type CafeMissionDataV2 = {
    missionTab: {
        id: number;
        rows: CafeMissionRowV2[];
    };
    missionGroup: {
        id: number;
        rows: CafeMissionRowV2[];
    };
    strings: Record<string, string>;
};
export type CafeMissionIconAssetV2 = SwordClientAsset & {
    sourceBundle: string;
};
export type CafeMissionIconCatalogV2 = Record<string, CafeMissionIconAssetV2[]>;
/** NKCStringTable.GetString splits the serialized @@ arguments before applying
 * the source string table's decimal {n} replacements. */
export function cafeMissionString(strId: string, strings: Record<string, string>): string {
    const [key, ...args] = strId.split('@@');
    const template = strings[key];
    if (template === undefined)
        throw new Error(`Missing source Cafe mission string ${key}`);
    return template.replace(/\{(\d+)\}/g, (_token, index: string) => {
        const value = args[Number(index)];
        if (value === undefined)
            throw new Error(`Missing source Cafe mission string argument ${strId}`);
        return value;
    });
}
export function cafeMissionSlotPath(id: number): string {
    if (!Number.isInteger(id))
        throw new TypeError(`Invalid Cafe mission id ${id}`);
    return `${CAFE_MISSION_LIST_CONTENT}/${CAFE_MISSION_SLOT_TEMPLATE}_${id}`;
}
export function cafeMissionGroupRewardSlotPath(id: number): string {
    if (!Number.isInteger(id))
        throw new TypeError(`Invalid Cafe mission-group id ${id}`);
    return `${CAFE_MISSION_GROUP_REWARD_CONTENT}/${CAFE_MISSION_REWARD_SLOT_TEMPLATE}_${id}`;
}
/** Presentation policy: repeat the former coupon icon/count geometry three
 * times, but keep the source ingredient sprites and resource bindings. The
 * complete group is reduced uniformly and shifted right so it remains inside
 * the visible paper area while retaining a gap before the errand button.
 * The original resource panel remains lower-left as owned inventory. */
export function instantiateCafeMissionErrandIngredientReward<T extends SwordClientLayout>(layout: T): T {
    const resource = layout.nodes.find(node => node.path === CAFE_MISSION_RESOURCE_ROOT);
    const score = layout.nodes.find(node => node.path === CAFE_MISSION_ERRAND_SCORE_ROOT);
    const scoreIcon = layout.nodes.find(node => node.path === CAFE_MISSION_ERRAND_SCORE_ICON);
    const scoreText = layout.nodes.find(node => node.path === CAFE_MISSION_ERRAND_SCORE_TEXT);
    const step = layout.nodes.find(node => node.path === CAFE_MISSION_ERRAND_STEP_ROOT);
    if (!resource || resource.rect.type !== 'RectTransform')
        throw new Error('Cafe mission resource panel is missing');
    const rectNodes = [score, scoreIcon, scoreText];
    if (rectNodes.some(node => !node || node.rect.type !== 'RectTransform'
        || !node.rect.anchorMin || !node.rect.anchorMax || !node.rect.anchoredPosition
        || !node.rect.sizeDelta || !node.rect.pivot)) {
        throw new Error('Cafe mission coupon icon/count geometry is missing');
    }
    if (!step || step.parentPath !== CAFE_MISSION_ERRAND_ROOT || step.rect.type !== 'RectTransform'
        || !step.rect.anchorMin || !step.rect.anchorMax || !step.rect.anchoredPosition
        || !step.rect.sizeDelta || !step.rect.pivot) {
        throw new Error('Cafe mission errand STEP transform is missing');
    }
    const coupon = score!;
    const couponIcon = scoreIcon!;
    const couponText = scoreText!;
    const couponTextSource = couponText.texts?.[0];
    const couponTextComponent = couponText.components.find(component => component.type === 'NKCComText');
    if (!couponTextSource || !couponTextComponent)
        throw new Error('Cafe mission coupon count text is missing');
    if (layout.nodes.some(node => node.path === CAFE_MISSION_ERRAND_INGREDIENT_REWARD_ROOT)) {
        throw new Error('Cafe mission ingredient reward is already instantiated');
    }
    const rewardCount = 3;
    const couponWidth = coupon.rect.sizeDelta![0];
    const iconWidth = couponIcon.rect.sizeDelta![0] * couponIcon.rect.localScale[0];
    const iconHeight = couponIcon.rect.sizeDelta![1] * couponIcon.rect.localScale[1];
    const iconCenterX = couponIcon.rect.anchoredPosition![0];
    const iconLeft = iconCenterX - couponIcon.rect.pivot![0] * iconWidth;
    const iconRight = iconLeft + iconWidth;
    const countCenterX = couponWidth * couponText.rect.anchorMin![0] + couponText.rect.anchoredPosition![0];
    const countLeft = countCenterX - couponText.rect.pivot![0] * couponText.rect.sizeDelta![0];
    const countRight = countLeft + couponText.rect.sizeDelta![0];
    const pairLeft = Math.min(iconLeft, countLeft);
    const pairRight = Math.max(iconRight, countRight);
    const pairWidth = pairRight - pairLeft;
    const stepRight = step.rect.anchoredPosition[0] + (1 - step.rect.pivot[0]) * step.rect.sizeDelta[0];
    const remap = (path: string) => path === CAFE_MISSION_RESOURCE_ROOT || path.startsWith(`${CAFE_MISSION_RESOURCE_ROOT}/`)
        ? CAFE_MISSION_ERRAND_INGREDIENT_REWARD_ROOT + path.slice(CAFE_MISSION_RESOURCE_ROOT.length)
        : path;
    const retained = new Set([
        CAFE_MISSION_RESOURCE_ROOT,
        ...Array.from({ length: rewardCount }, (_, index) => `${CAFE_MISSION_RESOURCE_ROOT}/Res_${index + 1}`),
        ...Array.from({ length: rewardCount }, (_, index) => `${CAFE_MISSION_RESOURCE_ROOT}/Res_${index + 1}/COUNT_TEXT`),
    ]);
    const clones = sourceSubtree(layout, CAFE_MISSION_RESOURCE_ROOT)
        .filter(node => retained.has(node.path))
        .map(node => {
        const root = node.path === CAFE_MISSION_RESOURCE_ROOT;
        const match = node.path.match(/\/Res_(\d)(\/COUNT_TEXT)?$/);
        const itemIndex = match ? Number(match[1]) - 1 : -1;
        const count = Boolean(match?.[2]);
        const item = itemIndex >= 0 && !count;
        const itemOffset = itemIndex * pairWidth;
        const rect = root ? {
            ...coupon.rect,
            anchorMin: step.rect.anchorMin,
            anchorMax: step.rect.anchorMax,
            anchoredPosition: [stepRight + CAFE_MISSION_ERRAND_INGREDIENT_REWARD_RIGHT_OFFSET, coupon.rect.anchoredPosition![1]] as const,
            sizeDelta: [pairWidth * rewardCount, coupon.rect.sizeDelta![1]] as const,
            pivot: [1, coupon.rect.pivot![1]] as const,
            localScale: [
                CAFE_MISSION_ERRAND_INGREDIENT_REWARD_SCALE,
                CAFE_MISSION_ERRAND_INGREDIENT_REWARD_SCALE,
                coupon.rect.localScale[2],
            ] as const,
        } : item ? {
            ...couponIcon.rect,
            anchoredPosition: [iconCenterX - pairLeft + itemOffset, couponIcon.rect.anchoredPosition![1]] as const,
            sizeDelta: [iconWidth, iconHeight] as const,
            localScale: [1, 1, couponIcon.rect.localScale[2]] as const,
        } : count ? {
            ...couponText.rect,
            anchorMin: [0, couponText.rect.anchorMin![1]] as const,
            anchorMax: [0, couponText.rect.anchorMax![1]] as const,
            anchoredPosition: [countCenterX - pairLeft + itemOffset, couponText.rect.anchoredPosition![1]] as const,
        } : node.rect;
        return {
            ...node,
            path: remap(node.path),
            parentPath: root ? CAFE_MISSION_ERRAND_ROOT : count
                ? CAFE_MISSION_ERRAND_INGREDIENT_REWARD_ROOT
                : node.parentPath ? remap(node.parentPath) : null,
            siblingIndex: root ? step.siblingIndex : itemIndex * 2 + (count ? 1 : 0),
            rect,
            components: node.components.map(component => ({
                ...(count && component.type === 'NKCComText'
                    ? { ...component, fields: { ...couponTextComponent.fields, m_GameObject: component.fields.m_GameObject } }
                    : component),
                references: component.references.map(reference => ({
                    ...reference,
                    ...(reference.nodePath ? { nodePath: remap(reference.nodePath) } : {}),
                })),
            })),
            ...(count ? { texts: [{ ...couponTextSource, componentPathId: node.texts?.[0]?.componentPathId ?? couponTextSource.componentPathId }] } : {}),
        };
    });
    return { ...layout, nodes: [...layout.nodes, ...clones] };
}
function sourceSubtree(layout: SwordClientLayout, root: string): SwordClientNode[] {
    const nodes = layout.nodes.filter(node => node.path === root || node.path.startsWith(`${root}/`));
    if (!nodes.some(node => node.path === root))
        throw new Error(`Missing original Cafe mission prefab ${root}`);
    return nodes;
}
function requireTarget(layout: SwordClientLayout, path: string): void {
    if (!layout.nodes.some(node => node.path === path))
        throw new Error(`Missing original Cafe mission content ${path}`);
}
function requireUniqueIds(rows: readonly Pick<CafeMissionRowV2, 'm_MissionID'>[], label: string): void {
    const ids = rows.map(row => row.m_MissionID);
    if (ids.some(id => !Number.isInteger(id)))
        throw new TypeError(`${label} contains an invalid mission id`);
    if (new Set(ids).size !== ids.length)
        throw new Error(`${label} contains duplicate mission ids`);
}
function cloneRows(source: readonly SwordClientNode[], sourceRoot: string, targetParent: string, rows: readonly Pick<CafeMissionRowV2, 'm_MissionID'>[], rowPath: (id: number) => string): SwordClientNode[] {
    return rows.flatMap((row, siblingIndex) => {
        const targetRoot = rowPath(row.m_MissionID);
        const remap = (path: string) => path === sourceRoot || path.startsWith(`${sourceRoot}/`)
            ? targetRoot + path.slice(sourceRoot.length)
            : path;
        return source.map(node => ({
            ...node,
            path: remap(node.path),
            parentPath: node.path === sourceRoot ? targetParent : node.parentPath ? remap(node.parentPath) : null,
            siblingIndex: node.path === sourceRoot ? siblingIndex : node.siblingIndex,
            components: node.components.map(component => ({
                ...component,
                references: component.references.map(reference => ({
                    ...reference,
                    ...(reference.nodePath ? { nodePath: remap(reference.nodePath) } : {}),
                })),
            })),
        }));
    });
}
/** Materialize the two finite LoopScrollRect data sets with immutable clones
 * of the exact source prefabs. Only hierarchy identity and internal nodePath
 * references change; authored geometry, components, images and text survive. */
export function instantiateCafeMissionLayout<T extends SwordClientLayout>(layout: T, missionRows: readonly CafeMissionRowV2[], groupRows: readonly CafeMissionRowV2[]): T {
    if (missionRows.length)
        requireTarget(layout, CAFE_MISSION_LIST_CONTENT);
    if (groupRows.length)
        requireTarget(layout, CAFE_MISSION_GROUP_REWARD_CONTENT);
    requireUniqueIds(missionRows, 'Cafe mission tab');
    requireUniqueIds(groupRows, 'Cafe mission group');
    const occupied = new Set(layout.nodes.map(node => node.path));
    const requestedRoots = [
        ...missionRows.map(row => cafeMissionSlotPath(row.m_MissionID)),
        ...groupRows.map(row => cafeMissionGroupRewardSlotPath(row.m_MissionID)),
    ];
    const existing = requestedRoots.find(path => occupied.has(path));
    if (existing)
        throw new Error(`Cafe mission row already exists: ${existing}`);
    const missionSource = missionRows.length ? sourceSubtree(layout, CAFE_MISSION_SLOT_TEMPLATE) : [];
    const rewardSource = groupRows.length ? sourceSubtree(layout, CAFE_MISSION_REWARD_SLOT_TEMPLATE) : [];
    const clones = [
        ...cloneRows(missionSource, CAFE_MISSION_SLOT_TEMPLATE, CAFE_MISSION_LIST_CONTENT, missionRows, cafeMissionSlotPath),
        ...cloneRows(rewardSource, CAFE_MISSION_REWARD_SLOT_TEMPLATE, CAFE_MISSION_GROUP_REWARD_CONTENT, groupRows, cafeMissionGroupRewardSlotPath),
    ];
    const clonePaths = new Set<string>();
    for (const node of clones) {
        if (occupied.has(node.path) || clonePaths.has(node.path))
            throw new Error(`Duplicate Cafe mission clone path ${node.path}`);
        clonePaths.add(node.path);
    }
    return { ...layout, nodes: [...layout.nodes, ...clones] };
}
