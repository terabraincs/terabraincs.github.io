import { swordClientComponent, swordClientReference, type SwordClientLayout, type SwordClientNode } from "./swordTrainingClientLayout.ts";
export const SWORD_REWARD_ROOT = "UI_SINGLE_POPUP_SWORDTRAINING_REWARD";
export const SWORD_REWARD_SLOT = "UI_SINGLE_POPUP_SWORDTRAINING_REWARD_SLOT";
export const SWORD_REWARD_GAME_ID = 1103;
export type SwordScoreRewardTableRow = {
    m_ScoreRewardGroupID: number;
    m_Step: number;
    m_ScoreRewardID: number;
    m_Score: number;
    m_ScoreDescStrID: string;
    [field: string]: string | number | undefined;
};
export type SwordRewardTables = {
    games: {
        m_Id: number;
        m_GameType?: string;
        m_ScoreRewardGroupID?: number;
        m_BannerDesc: string;
    }[];
    rewards: SwordScoreRewardTableRow[];
    strings: Record<string, string>;
};
export type SwordRewardCondition = {
    id: number;
    step: number;
    score: number;
    description: string;
};
/** NKCStringTable.GetString splits @@ and passes the remaining strings to
 * ReplaceKeyword. These preserved row descriptions only use decimal {n} slots. */
export function swordRewardDescription(strId: string, strings: Record<string, string>): string {
    const [key, ...args] = strId.split("@@");
    const template = strings[key];
    if (template === undefined)
        throw new Error(`Missing source reward description ${key}`);
    return template.replace(/\{(\d+)\}/g, (_token, index: string) => {
        if (args[Number(index)] === undefined)
            throw new Error(`Missing source string argument ${strId}`);
        return args[Number(index)];
    });
}
function swordRewardTableRows(tables: SwordRewardTables): SwordScoreRewardTableRow[] {
    const game = tables.games.find(row => row.m_Id === SWORD_REWARD_GAME_ID);
    if (!game || game.m_GameType !== "SWORD_TRAINING" || !game.m_ScoreRewardGroupID)
        throw new Error("Missing original Sword Training 1103 template");
    const rows = tables.rewards.filter(row => row.m_ScoreRewardGroupID === game.m_ScoreRewardGroupID).sort((a, b) => a.m_Step - b.m_Step);
    if (!rows.length)
        throw new Error("Missing original score reward group 1103");
    return rows;
}
function swordRewardCondition(row: SwordScoreRewardTableRow, strings: Record<string, string>): SwordRewardCondition {
    return { id: row.m_ScoreRewardID, step: row.m_Step, score: row.m_Score, description: swordRewardDescription(row.m_ScoreDescStrID, strings) };
}
/** Current conditions-only presentation deliberately does not hydrate reward
 * items or receipt state. Original receipt/item adapters live under scripts so
 * the application cannot import them accidentally. */
export function swordRewardConditions(tables: SwordRewardTables): SwordRewardCondition[] {
    return swordRewardTableRows(tables).map(row => swordRewardCondition(row, tables.strings));
}
export function swordRewardSourcePaths(layout: SwordClientLayout) {
    const required = (path: string) => {
        const node = layout.nodes.find(node => node.path === path);
        if (!node)
            throw new Error(`Missing original reward prefab node ${path}`);
        return node;
    };
    const popup = required(SWORD_REWARD_ROOT), slot = required(SWORD_REWARD_SLOT);
    const popupField = (field: string) => swordClientReference(popup, "NKCPopupScoreReward", field);
    const slotField = (field: string) => swordClientReference(slot, "NKCPopupScoreRewardSlot", field);
    const loop = popupField("m_loop"), loopNode = required(loop);
    const sourceLoop = swordClientComponent(loopNode, "LoopVerticalScrollRect");
    if (!sourceLoop)
        throw new Error("Original reward LoopVerticalScrollRect is missing");
    const reference = (field: string) => {
        const path = sourceLoop.references.find(ref => ref.field === field)?.nodePath;
        if (!path)
            throw new Error(`Missing original reward loop reference ${field}`);
        return path;
    };
    return {
        loop, viewport: reference("m_Viewport"), content: reference("m_Content"), close: popupField("m_NKM_UI_POPUP_CLOSE_BUTTON"),
        all: popupField("m_csbtnAllReceiveReward"), totalScore: popupField("m_lbTotalScore"),
        description: slotField("m_Desc"),
    };
}
/** Native LoopScrollRect's finite row objects are represented by source-prefab
 * clones. Their references remain relative to the same cloned hierarchy. */
export function cloneSwordRewardRows(layout: SwordClientLayout, rows: readonly Pick<SwordRewardCondition, "id">[]) {
    const paths = swordRewardSourcePaths(layout);
    const source = layout.nodes.filter(node => node.path === SWORD_REWARD_SLOT || node.path.startsWith(`${SWORD_REWARD_SLOT}/`));
    const rowRoots = new Map<number, string>();
    const clones: SwordClientNode[] = rows.flatMap((row, index) => {
        const root = `${paths.content}/Reward-${row.id}`;
        rowRoots.set(row.id, root);
        const remap = (path: string) => path === SWORD_REWARD_SLOT || path.startsWith(`${SWORD_REWARD_SLOT}/`) ? root + path.slice(SWORD_REWARD_SLOT.length) : path;
        return source.map(node => ({ ...node, path: remap(node.path), parentPath: node.path === SWORD_REWARD_SLOT ? paths.content : node.parentPath ? remap(node.parentPath) : null,
            siblingIndex: node.path === SWORD_REWARD_SLOT ? index : node.siblingIndex,
            components: node.components.map(component => ({ ...component, references: component.references.map(ref => ref.nodePath ? { ...ref, nodePath: remap(ref.nodePath) } : ref) })),
        }));
    });
    return { layout: { ...layout, nodes: [...layout.nodes, ...clones] }, rowRoots, paths };
}
/** User-requested conditions-only presentation. Preserve source assets and row
 * geometry, but omit the item and per-row status/action subtrees entirely. */
export function buildSwordConditionsRewardLayout(layout: SwordClientLayout, rows: readonly SwordRewardCondition[]) {
    const result = cloneSwordRewardRows(layout, rows);
    const description = layout.nodes.find(node => node.path === result.paths.description);
    if (!description || description.parentPath !== SWORD_REWARD_SLOT)
        throw new Error("Missing original reward condition row");
    // In the extracted prefab the retained background and condition are the
    // siblings through m_Desc. Every later top-level sibling is an item or
    // completion-state branch. Use that verified hierarchy instead of resolving
    // removed receipt/item fields into the production bundle.
    const removed = layout.nodes.filter(node => node.parentPath === SWORD_REWARD_SLOT && node.siblingIndex > description.siblingIndex).map(node => node.path);
    if (!removed.length)
        throw new Error("Missing original removed reward branches");
    const hidden = [...result.rowRoots.values()].flatMap(root => removed.map(path => root + path.slice(SWORD_REWARD_SLOT.length)));
    return { ...result, rows, layout: { ...result.layout,
            nodes: result.layout.nodes.filter(node => node.path !== SWORD_REWARD_SLOT && !node.path.startsWith(`${SWORD_REWARD_SLOT}/`) &&
                !hidden.some(path => node.path === path || node.path.startsWith(`${path}/`))),
        } };
}
