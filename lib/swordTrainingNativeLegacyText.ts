
import { deploymentUrl } from "@/lib/deployment";
import type { SwordClientLayout } from "./swordTrainingClientLayout";
export type SwordNativeLegacyMetrics = {
    schemaVersion: number;
    nodes: Record<string, {
        fontSize: number;
        advances: Record<string, number>;
    }>;
};
export type SwordNativeLegacyLayoutSample = {
    text: string;
    fontSize: number;
    rect: [
        number,
        number
    ];
    localRect: [
        number,
        number,
        number,
        number
    ];
    preferredWidth: number;
    preferredHeight: number;
    pixelsPerUnit: number;
    shader: string;
    lines: {
        start: number;
        height: number;
        topY: number;
        leading: number;
    }[];
    characters: {
        cursor: [
            number,
            number
        ];
        width: number;
    }[];
    atlas: {
        webPath: string;
        width: number;
        height: number;
        filterMode: number;
        wrapMode: number;
    };
    mesh: {
        positions: number[][];
        uvs: number[][];
        colors: number[][];
        indices: number[];
    };
};
export type SwordNativeLegacyLayouts = {
    schemaVersion: number;
    nodes: Record<string, SwordNativeLegacyLayoutSample[]>;
};
export type SwordNativeLegacyBinding = {
    catalog: SwordNativeLegacyLayouts;
    path: string;
    measureSample?: (value: string, width: number, fontSize: number) => SwordNativeLegacyLayoutSample;
    resolveSample?: (value: string, width: number, fontSize: number) => SwordNativeLegacyLayoutSample;
    /** Render the final-density bitmap outside CSS-scaled ancestors. Unity draws
     * these meshes directly into the screen framebuffer, so a second browser
     * texture resample would incorrectly attenuate opaque glyph pixels. */
    directScreenRaster?: boolean;
};
export function attachSwordNativeLegacyLayouts<T extends SwordClientLayout>(layout: T, catalog: SwordNativeLegacyLayouts): T {
    if (catalog.schemaVersion !== 1)
        throw new Error("Unsupported native legacy layout catalog");
    return { ...layout, nodes: layout.nodes.map(node => {
            if (!catalog.nodes[node.path])
                return node;
            if (node.texts?.length !== 1 || node.texts[0].native)
                throw new Error(`Invalid native legacy text binding: ${node.path}`);
            return { ...node, texts: node.texts.map(text => ({ ...text, legacyNative: { catalog, path: node.path } })) };
        }) };
}
export function swordNativeLegacySample(binding: SwordNativeLegacyBinding, value: string, width: number, fontSize: number) {
    if (binding.resolveSample)
        return binding.resolveSample(value, width, fontSize);
    const sample = binding.catalog.nodes[binding.path]?.find(sample => sample.text === value && sample.fontSize === fontSize && Math.abs(sample.rect[0] - width) < .005);
    if (!sample)
        throw new Error(`Uncaptured native legacy layout: ${binding.path}, ${fontSize}px / ${width}px / ${value}`);
    return sample;
}
const nativeAtlases = new Map<string, Promise<HTMLImageElement>>();
const tintedAtlases = new Map<string, HTMLCanvasElement>();
function atlasImage(path: string) {
    let promise = nativeAtlases.get(path);
    if (!promise) {
        promise = new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.crossOrigin = "anonymous"; image.onload = () => resolve(image); image.onerror = () => reject(new Error(`Original dynamic font atlas unavailable: ${path}`)); image.src = deploymentUrl(path); });
        nativeAtlases.set(path, promise);
    }
    return promise;
}
/** Align the browser bitmap, not the original glyphs, to device pixels. */
export function swordNativeLegacyRasterFrame(sample: SwordNativeLegacyLayoutSample, density: readonly [
    number,
    number
], origin: readonly [
    number,
    number
], dpr: number) {
    const [rx, ry, rw, rh] = sample.localRect, { positions } = sample.mesh;
    const left = Math.min(rx, ...positions.map(position => position[0])), right = Math.max(rx + rw, ...positions.map(position => position[0]));
    const bottom = Math.min(ry, ...positions.map(position => position[1])), top = Math.max(ry + rh, ...positions.map(position => position[1]));
    const offset = [left - rx, ry + rh - top], extent = [right - left, top - bottom];
    const phase = offset.map((value, axis) => {
        const screen = origin[axis] * dpr + value * density[axis];
        return (screen - Math.floor(screen)) / density[axis];
    });
    const size = extent.map((value, axis) => Math.max(1, Math.ceil((value + phase[axis]) * density[axis])));
    return { left, top, phase, size, offset: offset.map((value, axis) => value - phase[axis]),
        cssSize: size.map((value, axis) => value / density[axis]), key: [...density, ...phase, ...size].join(":") };
}
/** Original CanvasRenderer mesh + GPU-read dynamic Font atlas. No browser font rasterizer. */
export async function rasterSwordNativeLegacyText(canvas: HTMLCanvasElement, sample: SwordNativeLegacyLayoutSample, density: readonly [
    number,
    number
], valid: () => boolean, frame: ReturnType<typeof swordNativeLegacyRasterFrame>) {
    if (sample.shader !== "UI/Default")
        throw new Error(`Unverified native legacy font shader: ${sample.shader}`);
    const atlas = await atlasImage(sample.atlas.webPath);
    if (!valid())
        return;
    const { positions, uvs, colors, indices } = sample.mesh;
    const { left, top, phase } = frame;
    canvas.width = frame.size[0];
    canvas.height = frame.size[1];
    const context = canvas.getContext("2d");
    if (!context)
        throw new Error("Native font raster Canvas unavailable");
    context.scale(density[0], density[1]);
    context.imageSmoothingEnabled = sample.atlas.filterMode !== 0;
    if (indices.length % 6 !== 0)
        throw new Error("Unexpected native UI glyph mesh topology");
    for (let offset = 0; offset < indices.length; offset += 6) {
        // Outline/Shadow produce triangle soup with duplicated corner indices.
        // Coalesce only byte-identical vertex attributes, never merge UV seams.
        const corners = new Map<string, number>();
        for (const index of indices.slice(offset, offset + 6)) {
            const key = JSON.stringify([positions[index], uvs[index], colors[index]]);
            if (!corners.has(key))
                corners.set(key, index);
        }
        const vertices = [...corners.values()];
        if (vertices.length !== 4)
            throw new Error("Native legacy glyph is not a quad");
        const color = colors[vertices[0]];
        if (vertices.some(index => colors[index].some((value, channel) => value !== color[channel])))
            throw new Error("Uncaptured legacy glyph color gradient");
        const colorKey = `${sample.atlas.webPath}:${color.join(",")}`;
        let tinted = tintedAtlases.get(colorKey);
        if (!tinted) {
            tinted = document.createElement("canvas");
            tinted.width = atlas.width;
            tinted.height = atlas.height;
            const tint = tinted.getContext("2d")!;
            tint.drawImage(atlas, 0, 0);
            tint.globalCompositeOperation = "source-in";
            tint.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${color[3] / 255})`;
            tint.fillRect(0, 0, atlas.width, atlas.height);
            tintedAtlases.set(colorKey, tinted);
        }
        const target = vertices.map(index => [positions[index][0] - left + phase[0], top - positions[index][1] + phase[1]]);
        const input = vertices.map(index => [uvs[index][0] * atlas.width, (1 - uvs[index][1]) * atlas.height]);
        const [u0, v0] = input[0], du1 = input[1][0] - u0, dv1 = input[1][1] - v0, du2 = input[2][0] - u0, dv2 = input[2][1] - v0;
        const determinant = du1 * dv2 - du2 * dv1;
        if (Math.abs(determinant) < 1e-8)
            continue;
        const dx1 = target[1][0] - target[0][0], dy1 = target[1][1] - target[0][1], dx2 = target[2][0] - target[0][0], dy2 = target[2][1] - target[0][1];
        const a = (dx1 * dv2 - dx2 * dv1) / determinant, b = (dy1 * dv2 - dy2 * dv1) / determinant;
        const c = (dx2 * du1 - dx1 * du2) / determinant, d = (dy2 * du1 - dy1 * du2) / determinant;
        const sourceX = Math.min(...input.map(vertex => vertex[0])), sourceY = Math.min(...input.map(vertex => vertex[1]));
        const sourceWidth = Math.max(...input.map(vertex => vertex[0])) - sourceX, sourceHeight = Math.max(...input.map(vertex => vertex[1])) - sourceY;
        context.save();
        context.transform(a, b, c, d, positions[vertices[0]][0] - left + phase[0] - a * u0 - c * v0, top - positions[vertices[0]][1] + phase[1] - b * u0 - d * v0);
        context.drawImage(tinted, sourceX, sourceY, sourceWidth, sourceHeight, sourceX, sourceY, sourceWidth, sourceHeight);
        context.restore();
    }
    canvas.style.inset = "auto";
    canvas.style.left = `${frame.offset[0]}px`;
    canvas.style.top = `${frame.offset[1]}px`;
    canvas.style.width = `${frame.cssSize[0]}px`;
    canvas.style.height = `${frame.cssSize[1]}px`;
    canvas.dataset.nativeLegacy = "original-mesh-font-atlas";
    canvas.dataset.sourceStatus = "ready";
    canvas.dataset.nativePreferred = JSON.stringify([sample.preferredWidth, sample.preferredHeight]);
    canvas.dataset.nativeRasterPhase = JSON.stringify(phase);
    canvas.dataset.nativeRasterDensity = JSON.stringify(density);
}
/** Bind only source paths exercised by the independent legacy-font probe. */
export function attachSwordNativeLegacyMetrics<T extends SwordClientLayout>(layout: T, catalog: SwordNativeLegacyMetrics): T {
    if (catalog.schemaVersion !== 1)
        throw new Error("Unsupported native legacy metrics");
    return { ...layout, nodes: layout.nodes.map(node => {
            const metrics = catalog.nodes[node.path];
            if (!metrics)
                return node;
            if (node.texts?.length !== 1 || node.texts[0].componentType === "NKCComTMPUIText")
                throw new Error(`Invalid legacy numeric binding: ${node.path}`);
            return { ...node, texts: node.texts.map(text => ({ ...text, legacyNativeMetrics: metrics })) };
        }) };
}
