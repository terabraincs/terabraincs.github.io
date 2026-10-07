import { deploymentUrl } from "@/lib/deployment";
/** Fresh Cafe binding helpers. No imports from the previous Cafe implementation. */
import type { SwordClientAsset, SwordClientComponent, SwordClientLayout, SwordClientNode, SwordClientReference, } from './swordTrainingClientLayout';
import type { SwordTrainingClientAnimationClip } from './swordTrainingClientAnimation';
export const CAFE_SOURCE_V2 = deploymentUrl("/game-assets/cafe-strega/client-source-v2");
export const CAFE_ROOT_V2 = 'UI_SINGLE_CAFE';
export type CafeSourceV2 = SwordClientLayout & {
    animations: (SwordClientAsset & SwordTrainingClientAnimationClip)[];
};
type NodeLocation = {
    node: SwordClientNode;
    index: number;
};
type NodePathIndex = {
    kind: 'root';
    values: Map<string, NodeLocation>;
} | {
    kind: 'patch';
    parent: NodePathIndex;
    path: string;
    value: NodeLocation;
    memo: Map<string, NodeLocation | null>;
};
type AssetIdentityIndex = {
    kind: 'root';
    byId: Map<string, SwordClientAsset>;
    spritesByName: Map<string, SwordClientAsset[]>;
} | {
    kind: 'append';
    parent: AssetIdentityIndex;
    asset: SwordClientAsset;
    spriteMemo: Map<string, SwordClientAsset[]>;
};
type BindMemo = Map<string, WeakMap<SwordClientAsset, Map<string, SwordClientLayout>>>;
type LayoutIndex = {
    nodes: SwordClientNode[];
    assets: SwordClientAsset[];
    nodePaths: NodePathIndex;
    assetIdentities: AssetIdentityIndex;
    bindings: BindMemo;
};
const layoutIndexes = new WeakMap<SwordClientLayout, LayoutIndex>();
const componentIndexes = new WeakMap<SwordClientNode, Map<string, SwordClientComponent>>();
const referenceIndexes = new WeakMap<SwordClientComponent, Map<string, SwordClientReference>>();
function createNodePathIndex(nodes: SwordClientNode[]): NodePathIndex {
    return { kind: 'root', values: new Map(nodes.map((node, index) => [node.path, { node, index }])) };
}
/** Match swordClientIndex's asset-ID de-duplication before resolving a sprite name. */
function createAssetIdentityIndex(assets: SwordClientAsset[]): AssetIdentityIndex {
    const byId = new Map(assets.map(asset => [asset.id, asset]));
    const spritesByName = new Map<string, SwordClientAsset[]>();
    for (const asset of byId.values()) {
        if (asset.type !== 'Sprite')
            continue;
        const matches = spritesByName.get(asset.name) ?? [];
        matches.push(asset);
        spritesByName.set(asset.name, matches);
    }
    return { kind: 'root', byId, spritesByName };
}
function layoutIndex(layout: SwordClientLayout): LayoutIndex {
    const cached = layoutIndexes.get(layout);
    // Layouts are immutable in the source renderer. Still rebuild if a caller
    // replaces either public array, rather than retaining an index for old data.
    if (cached && cached.nodes === layout.nodes && cached.assets === layout.assets)
        return cached;
    const created: LayoutIndex = {
        nodes: layout.nodes,
        assets: layout.assets,
        nodePaths: createNodePathIndex(layout.nodes),
        assetIdentities: createAssetIdentityIndex(layout.assets),
        bindings: new Map(),
    };
    layoutIndexes.set(layout, created);
    return created;
}
function nodeLocation(index: NodePathIndex, path: string): NodeLocation | null {
    if (index.kind === 'root')
        return index.values.get(path) ?? null;
    if (path === index.path)
        return index.value;
    const cached = index.memo.get(path);
    if (cached !== undefined)
        return cached;
    const resolved = nodeLocation(index.parent, path);
    index.memo.set(path, resolved);
    return resolved;
}
function assetById(index: AssetIdentityIndex, id: string): SwordClientAsset | undefined {
    if (index.kind === 'root')
        return index.byId.get(id);
    return index.asset.id === id ? index.asset : assetById(index.parent, id);
}
function spritesByName(index: AssetIdentityIndex, name: string): SwordClientAsset[] {
    if (index.kind === 'root')
        return index.spritesByName.get(name) ?? [];
    const cached = index.spriteMemo.get(name);
    if (cached)
        return cached;
    const parent = spritesByName(index.parent, name);
    const matches = index.asset.type === 'Sprite' && index.asset.name === name ? [...parent, index.asset] : parent;
    index.spriteMemo.set(name, matches);
    return matches;
}
function sourceComponent(node: SwordClientNode, type: string) {
    let index = componentIndexes.get(node);
    if (!index) {
        index = new Map();
        // Preserve Array.find semantics if malformed evidence repeats a type.
        for (const component of node.components)
            if (!index.has(component.type))
                index.set(component.type, component);
        componentIndexes.set(node, index);
    }
    return index.get(type);
}
function sourceReference(component: SwordClientComponent, field: string) {
    let index = referenceIndexes.get(component);
    if (!index) {
        index = new Map();
        // Preserve Array.find semantics if malformed evidence repeats a field.
        for (const reference of component.references)
            if (!index.has(reference.field))
                index.set(reference.field, reference);
        referenceIndexes.set(component, index);
    }
    return index.get(field);
}
export function cafeSourceNode(layout: SwordClientLayout, path: string): SwordClientNode {
    const node = nodeLocation(layoutIndex(layout).nodePaths, path)?.node;
    if (!node)
        throw new Error(`Original Cafe node is missing: ${path}`);
    return node;
}
export function cafeSourceBinding(layout: SwordClientLayout, nodePath: string, type: string) {
    const node = cafeSourceNode(layout, nodePath);
    const component = sourceComponent(node, type);
    if (!component)
        throw new Error(`Original Cafe component is missing: ${nodePath}.${type}`);
    return {
        node, fields: component.fields,
        path: (field: string) => {
            const value = sourceReference(component, field);
            if (!value?.resolved || !value.nodePath)
                throw new Error(`Unresolved source reference: ${node.path} / ${type}.${field}`);
            return value.nodePath;
        },
        optionalPath: (field: string) => sourceReference(component, field)?.nodePath ?? null,
        reference: (field: string) => {
            const value = sourceReference(component, field);
            if (!value?.resolved)
                throw new Error(`Original Cafe reference is missing: ${nodePath}.${type}.${field}`);
            return value;
        },
    };
}
function colorKey(color: readonly [
    number,
    number,
    number,
    number
] | undefined) {
    if (!color)
        return 'source';
    return `color:${color.map(value => Number.isNaN(value) ? 'NaN' : Object.is(value, -0) ? '-0' : String(value)).join(',')}`;
}
function cachedBinding(index: LayoutIndex, nodePath: string, sprite: SwordClientAsset, color: string) {
    return index.bindings.get(nodePath)?.get(sprite)?.get(color);
}
function rememberBinding(index: LayoutIndex, nodePath: string, sprite: SwordClientAsset, color: string, result: SwordClientLayout) {
    let bySprite = index.bindings.get(nodePath);
    if (!bySprite) {
        bySprite = new WeakMap();
        index.bindings.set(nodePath, bySprite);
    }
    let byColor = bySprite.get(sprite);
    if (!byColor) {
        byColor = new Map();
        bySprite.set(sprite, byColor);
    }
    byColor.set(color, result);
}
function sameTuple(a: readonly number[] | null | undefined, b: readonly number[] | null | undefined) {
    return a === b || Boolean(a && b && a.length === b.length && a.every((value, item) => Object.is(value, b[item])));
}
/** Binding a runtime item changes the source Image sprite, not its RectTransform.
 * Unique bindings retain a normal Array for every existing renderer. Repeated
 * frame bindings reuse that immutable result, so the 400+ node source array is
 * copied only once per actual sprite/color combination.
 */
export function cafeBindSourceImage(layout: SwordClientLayout, nodePath: string, sprite: SwordClientAsset, color?: readonly [
    number,
    number,
    number,
    number
]) {
    if (!sprite.webPath || !sprite.pixelSize)
        throw new Error(`Original sprite pixels are missing: ${sprite.name}`);
    const index = layoutIndex(layout);
    const key = colorKey(color);
    const cached = cachedBinding(index, nodePath, sprite, key);
    if (cached)
        return cached;
    const location = nodeLocation(index.nodePaths, nodePath);
    if (!location)
        throw new Error(`Original Cafe node is missing: ${nodePath}`);
    const source = location.node;
    if (source.images?.length !== 1)
        throw new Error(`Expected one original Image: ${nodePath}`);
    const oldImage = source.images[0];
    const pixelsPerUnit = sprite.pixelsPerUnit ?? oldImage.pixelsPerUnit;
    const imageColor = color ?? oldImage.color;
    const border = sprite.border ?? null;
    const alreadyKnown = assetById(index.assetIdentities, sprite.id) !== undefined;
    if (alreadyKnown && oldImage.webPath === sprite.webPath && sameTuple(oldImage.pixelSize, sprite.pixelSize)
        && oldImage.pixelsPerUnit === pixelsPerUnit && sameTuple(oldImage.color, imageColor)
        && sameTuple(oldImage.border, border)
        && (oldImage as typeof oldImage & {
            tintedWebPath?: unknown;
        }).tintedWebPath === undefined) {
        rememberBinding(index, nodePath, sprite, key, layout);
        return layout;
    }
    const nextImage = { ...oldImage, webPath: sprite.webPath, pixelSize: sprite.pixelSize,
        pixelsPerUnit, tintedWebPath: undefined, color: imageColor, border };
    const nextNode = { ...source, images: [nextImage] };
    // Keep the public layout shape and Array behavior unchanged. The shallow
    // copy shares every untouched node, while memoization removes repeat copies.
    const nodes = layout.nodes.slice();
    nodes[location.index] = nextNode;
    const assets = alreadyKnown ? layout.assets : [...layout.assets, sprite];
    const result = { ...layout, assets, nodes };
    const resultIndex: LayoutIndex = {
        nodes,
        assets,
        nodePaths: { kind: 'patch', parent: index.nodePaths, path: nodePath,
            value: { node: nextNode, index: location.index }, memo: new Map() },
        assetIdentities: alreadyKnown ? index.assetIdentities
            : { kind: 'append', parent: index.assetIdentities, asset: sprite, spriteMemo: new Map() },
        bindings: new Map(),
    };
    layoutIndexes.set(result, resultIndex);
    rememberBinding(index, nodePath, sprite, key, result);
    return result;
}
export function cafeSourceSprite(layout: SwordClientLayout, name: string) {
    const matches = spritesByName(layoutIndex(layout).assetIdentities, name);
    if (matches.length !== 1)
        throw new Error(`Original Cafe sprite identity is ambiguous or missing: ${name} (${matches.length})`);
    return matches[0];
}
