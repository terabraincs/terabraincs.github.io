/** Source schema for the fresh Unity-bundle extraction. No legacy game input. */
export type ClientVector2 = readonly [
    number,
    number
];
export type ClientColor = readonly [
    number,
    number,
    number,
    number
];
export type ClientFields = Record<string, unknown>;
export type SwordClientReference = {
    field: string;
    pathId: string;
    resolved: boolean;
    type?: string;
    name?: string;
    nodePath?: string;
    assetId?: string;
    webPath?: string;
};
export type SwordClientComponent = {
    type: string;
    pathId: string;
    fields: ClientFields;
    references: SwordClientReference[];
    image?: {
        sprite?: SwordClientReference | null;
        imageType: number;
        color: ClientColor;
        preserveAspect: boolean | number;
        fillCenter: boolean | number;
        pixelsPerUnitMultiplier: number;
        border?: ClientColor;
    };
    [extra: string]: unknown;
};
export type SwordClientRect = {
    type: "RectTransform" | "Transform";
    anchorMin: ClientVector2 | null;
    anchorMax: ClientVector2 | null;
    anchoredPosition: ClientVector2 | null;
    sizeDelta: ClientVector2 | null;
    pivot: ClientVector2 | null;
    localPosition: readonly [
        number,
        number,
        number
    ];
    localScale: readonly [
        number,
        number,
        number
    ];
    localRotation: readonly [
        number,
        number,
        number,
        number
    ];
};
export type SwordClientNode = {
    path: string;
    name: string;
    parentPath: string | null;
    pathId: string;
    activeSelf: boolean;
    siblingIndex: number;
    rect: SwordClientRect;
    components: SwordClientComponent[];
    images?: import("../components/minigames/sword-training/SwordTrainingImage").SwordClientImage[];
    texts?: import("../components/minigames/sword-training/SwordTrainingText").SwordClientText[];
};
export type SwordClientAsset = {
    id: string;
    name: string;
    type: string;
    webPath: string;
    border?: ClientColor;
    pixelSize?: ClientVector2;
    pixelsPerUnit?: number;
    [extra: string]: unknown;
};
export type SwordClientLayout = {
    schemaVersion: number;
    roots: string[];
    nodes: SwordClientNode[];
    assets: SwordClientAsset[];
    unknowns: Record<string, unknown>[];
};
export type SwordLayoutBox = {
    left: number;
    top: number;
    width: number;
    height: number;
    pivotX: number;
    pivotY: number;
    scaleX: number;
    scaleY: number;
    /** CSS clockwise degrees; Unity's local Z rotation has the opposite sign. */
    rotation: number;
};
/** NKCUIManager.SetAspect IL_001D..0108, verified in the preserved DLL.
 * This deliberately keeps the actual 1.777f comparison, not a rounded 16/9.
 */
export function swordClientCanvas(width: number, height: number) {
    if (!(width > 0 && height > 0))
        throw new RangeError("Invalid canvas extent");
    const matchHeight = width / height >= Math.fround(1.777);
    const scale = matchHeight ? height / 1080 : width / 1920;
    return { width: width / scale, height: height / scale, scale, matchHeight };
}
/** Unity RectTransform anchor / pivot arithmetic, with Y converted only here. */
export function swordClientRect(rect: SwordClientRect, parentWidth: number, parentHeight: number): SwordLayoutBox {
    if (rect.type !== "RectTransform" || !rect.anchorMin || !rect.anchorMax ||
        !rect.anchoredPosition || !rect.sizeDelta || !rect.pivot) {
        throw new Error("A non-UI Transform needs its source renderer's coordinate system");
    }
    const [minX, minY] = rect.anchorMin;
    const [maxX, maxY] = rect.anchorMax;
    const [pivotX, pivotY] = rect.pivot;
    const width = parentWidth * (maxX - minX) + rect.sizeDelta[0];
    const height = parentHeight * (maxY - minY) + rect.sizeDelta[1];
    const anchorX = parentWidth * (minX + (maxX - minX) * pivotX);
    const anchorY = parentHeight * (minY + (maxY - minY) * pivotY);
    const [qx, qy, qz, qw] = rect.localRotation;
    const rotation = -Math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz)) * 180 / Math.PI;
    return {
        left: anchorX + rect.anchoredPosition[0] - pivotX * width,
        top: parentHeight - anchorY - rect.anchoredPosition[1] - (1 - pivotY) * height,
        width, height, pivotX, pivotY,
        scaleX: rect.localScale[0], scaleY: rect.localScale[1], rotation,
    };
}
export function swordClientIndex(layout: SwordClientLayout) {
    const nodes = new Map(layout.nodes.map(node => [node.path, node]));
    const assets = new Map(layout.assets.map(asset => [asset.id, asset]));
    const children = new Map<string | null, SwordClientNode[]>();
    for (const node of layout.nodes) {
        const list = children.get(node.parentPath) ?? [];
        list.push(node);
        children.set(node.parentPath, list);
    }
    for (const list of children.values())
        list.sort((a, b) => a.siblingIndex - b.siblingIndex);
    return { nodes, assets, children };
}
export function swordClientComponent(node: SwordClientNode, type: string) {
    return node.components.find(component => component.type === type);
}
export function swordClientReference(node: SwordClientNode, type: string, field: string) {
    const reference = swordClientComponent(node, type)?.references.find(item => item.field === field);
    if (!reference?.resolved || !reference.nodePath) {
        throw new Error(`Unresolved source reference: ${node.path} / ${type}.${field}`);
    }
    return reference.nodePath;
}
/** Source-authored colors can exceed 1 in FX; do not clamp the evidence itself. */
export function swordClientCssColor(color: ClientColor) {
    return `rgba(${color[0] * 255}, ${color[1] * 255}, ${color[2] * 255}, ${color[3]})`;
}
/** Resolve the original UI hierarchy's pivot in a centered, Y-up design space.
 * Source gameplay nodes have no layout groups or dynamic sizing on this chain.
 */
export function swordClientWorldRect(layout: SwordClientLayout, path: string, width = 1920, height = 1080) {
    const index = swordClientIndex(layout);
    const chain: SwordClientNode[] = [];
    let node = index.nodes.get(path);
    if (!node)
        throw new Error(`Missing source transform: ${path}`);
    while (node) {
        chain.unshift(node);
        node = node.parentPath ? index.nodes.get(node.parentPath) : undefined;
    }
    let matrix = [1, 0, 0, 1, 0, 0];
    let parentWidth = width, parentHeight = height;
    let pivotX = 0.5, pivotY = 0.5;
    let box: SwordLayoutBox | undefined;
    for (const item of chain) {
        if (item.rect.type !== "RectTransform")
            throw new Error(`Gameplay transform is not a RectTransform: ${item.path}`);
        box = swordClientRect(item.rect, parentWidth, parentHeight);
        const cx = box.pivotX * box.width, cy = (1 - box.pivotY) * box.height;
        const radians = box.rotation * Math.PI / 180;
        const cosine = Math.cos(radians), sine = Math.sin(radians);
        const a = cosine * box.scaleX, b = sine * box.scaleX;
        const c = -sine * box.scaleY, d = cosine * box.scaleY;
        const x = box.left + cx - a * cx - c * cy;
        const y = box.top + cy - b * cx - d * cy;
        const [ma, mb, mc, md, mx, my] = matrix;
        matrix = [ma * a + mc * b, mb * a + md * b, ma * c + mc * d, mb * c + md * d, ma * x + mc * y + mx, mb * x + md * y + my];
        parentWidth = box.width;
        parentHeight = box.height;
        pivotX = box.pivotX;
        pivotY = box.pivotY;
    }
    const [a, b, c, d, x, y] = matrix;
    const cx = parentWidth * pivotX, cy = parentHeight * (1 - pivotY);
    return { x: a * cx + c * cy + x - width / 2, y: height / 2 - (b * cx + d * cy + y),
        scaleX: Math.hypot(a, b), scaleY: Math.hypot(c, d), width: parentWidth, height: parentHeight, matrix };
}
export function swordClientGeometry(layout: SwordClientLayout, viewportWidth: number, viewportHeight: number) {
    const root = layout.nodes.find(node => node.path === "UI_SINGLE_SWORDTRAINING");
    if (!root)
        throw new Error("Missing original module prefab");
    const gamePath = swordClientReference(root, "NKCUIModuleSubUISwordTraining", "m_SwordTraining");
    const game = layout.nodes.find(node => node.path === gamePath)!;
    const point = (field: string) => swordClientWorldRect(layout, swordClientReference(game, "NKCPopupSwordTraining", field));
    const player = point("m_rtCenter");
    const foreground = point("m_rtSpawnParent");
    const background = point("m_rtBackgroundMonsterParent");
    const leftSocket = point("m_rtLeftAttackSocket"), rightSocket = point("m_rtRightAttackSocket");
    const canvas = swordClientCanvas(viewportWidth, viewportHeight);
    return {
        // SCEN_SUB_UI_Camera orthographicSize=540, independently of CanvasScaler.
        worldUnitsPerDesignUnit: 1080 * canvas.scale / viewportHeight,
        player,
        foreground: { parent: foreground, left: point("m_rtSpawnPointLeft"), right: point("m_rtSpawnPointRight"), scaleX: foreground.scaleX, scaleY: foreground.scaleY },
        background: { parent: background, left: point("m_rtBackgroundMonsterSpawnPositionLeft"), right: point("m_rtBackgroundMonsterSpawnPositionRight"), scaleX: background.scaleX, scaleY: background.scaleY },
        weapon: { left: leftSocket, right: rightSocket, scaleX: leftSocket.scaleX, scaleY: leftSocket.scaleY },
    };
}
