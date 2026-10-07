import type { SwordClientLayout } from "./swordTrainingClientLayout";
export type NativeTextMesh = {
    index: number;
    material: string;
    positions: number[];
    uv: number[];
    scales: number[];
    colors: number[];
    indices: number[];
};
type NativeCharacter = {
    unicode: number;
    glyphIndex: number;
    font: string;
    origin: number;
    advance: number;
    baseline: number;
    ascender: number;
    descender: number;
    line: number;
    visible: boolean;
    mesh: number;
    vertex: number;
    scale: number;
};
type NativeLine = {
    firstCharacterIndex: number;
    lastCharacterIndex: number;
    ascender: number;
    descender: number;
    baseline: number;
    lineHeight: number;
    maxAdvance: number;
};
export type NativeTextSample = {
    id: string;
    componentPathId: string;
    value: string;
    rect: [
        number,
        number
    ];
    pivot: [
        number,
        number
    ];
    preferred: [
        number,
        number
    ];
    fontSize: number;
    lines: NativeLine[];
    characters: NativeCharacter[];
    meshes: NativeTextMesh[];
};
type NativeGlyph = {
    width: number;
    height: number;
    horizontalBearingX: number;
    horizontalBearingY: number;
    horizontalAdvance: number;
    scale: number;
};
type NativeNode = {
    source: string;
    samples: Record<string, string>;
    digits: Record<string, string>;
    settings: Record<string, unknown>;
    padding?: number;
    modernHangul?: boolean;
    leadingCharacters?: number[];
    followingCharacters?: number[];
    fonts: Record<string, {
        face: Record<string, number>;
        glyphs: Record<string, NativeGlyph>;
    }>;
};
export type NativeTextCatalog = {
    schemaVersion: number;
    nodes: Record<string, NativeNode>;
    samples: Record<string, NativeTextSample>;
    materials: Record<string, {
        name: string;
        shader: string;
        keywords: string[];
        properties: Record<string, number | number[] | string | null>;
    }>;
    textures: Record<string, {
        png: string;
        width: number;
        height: number;
        filterMode: number;
        wrapMode: number;
    }>;
};
export type NativeTextBinding = {
    catalog: NativeTextCatalog;
    node: NativeNode;
};
/** Bind only original TMP records; legacy UnityEngine.UI.Text keeps its own path. */
export function attachSwordTrainingNativeText(layout: SwordClientLayout, catalog: NativeTextCatalog): SwordClientLayout {
    if (catalog.schemaVersion !== 1)
        throw new Error("Unsupported native TMP catalog");
    return { ...layout, nodes: layout.nodes.map(node => ({ ...node, texts: node.texts?.map(text => {
                if (text.componentType !== "NKCComTMPUIText")
                    return text;
                const native = catalog.nodes[text.componentPathId];
                if (!native)
                    throw new Error(`Original TMP oracle missing: ${text.componentPathId}`);
                return { ...text, native: { catalog, node: native } };
            }) })) };
}
const f = Math.fround;
const add = (a: number, b: number) => f(f(a) + f(b));
const sub = (a: number, b: number) => f(f(a) - f(b));
const mul = (a: number, b: number) => f(f(a) * f(b));
const preferredRound = (value: number) => f(Math.trunc(add(mul(value, 100), 1)) / 100);
type WorkingCharacter = {
    sample: NativeTextSample;
    character: NativeCharacter;
    advance: number;
    glyphAdvance: number;
    ascender: number;
    descender: number;
    index: number;
};
/** The exercised GenerateTextMesh subset: original fixed strings and decimal
 * scores. Line breaking uses native glyph metrics and TMP's float32 arithmetic,
 * not browser font measurement. Uncaptured user text is rejected explicitly. */
export function layoutSwordNativeText(binding: NativeTextBinding, value: string, width: number, height: number) {
    const { catalog, node } = binding;
    const base = catalog.samples[node.source];
    if (value === "")
        return { meshes: [] as NativeTextMesh[], width: 0, height: 0, lines: [] as number[][], sample: base };
    const numeric = Object.keys(node.digits).length === 10 && /^[0-9]+$/.test(value);
    const exact = node.samples[value] && catalog.samples[node.samples[value]];
    if (!numeric && !exact)
        throw new Error(`Unprobed original TMP string: ${base.componentPathId}: ${value}`);
    const sample = exact || base;
    // Native fixed layouts retain original vertices exactly at their source rect.
    if (!numeric && Math.abs(width - sample.rect[0]) < 0.001 && Math.abs(height - sample.rect[1]) < 0.001) {
        return { meshes: sample.meshes, width: sample.preferred[0], height: sample.preferred[1], lines: sample.lines.map(line => Array.from({ length: line.lastCharacterIndex - line.firstCharacterIndex + 1 }, (_, i) => line.firstCharacterIndex + i)), sample };
    }
    const settings = node.settings;
    const size = sample.fontSize;
    const em = mul(size, 0.01);
    const spacing = mul(Number(settings.m_characterSpacing), em);
    const wordSpacing = mul(Number(settings.m_wordSpacing), em);
    const marginObject = settings.m_margin as {
        x: number;
        y: number;
        z: number;
        w: number;
    };
    const margin = [marginObject.x, marginObject.y, marginObject.z, marginObject.w];
    const available = sub(sub(add(width, 0.0001), margin[0]), margin[2]);
    const chars: WorkingCharacter[] = (numeric ? [...value].map(digit => catalog.samples[node.digits[digit]]) : sample.characters.map(() => sample)).map((source, index) => {
        const character = source.characters[numeric ? 0 : index];
        const font = node.fonts[character.font], glyph = font.glyphs[character.glyphIndex];
        if (!glyph)
            throw new Error(`Original glyph metrics missing: ${character.font}/${character.glyphIndex}`);
        const glyphAdvance = mul(glyph.horizontalAdvance, character.scale);
        const advance = add(add(glyphAdvance, spacing), character.unicode === 32 ? wordSpacing : 0);
        return { sample: source, character, index, glyphAdvance, advance,
            ascender: mul(font.face.m_AscentLine, character.scale), descender: mul(font.face.m_DescentLine, character.scale) };
    });
    const lines: number[][] = [];
    let start = 0, i = 0, lastBreak = -1, x = 0;
    const modern = node.modernHangul;
    while (i < chars.length) {
        const current = chars[i], code = current.character.unicode;
        if (code === 10) {
            lines.push(Array.from({ length: i - start + 1 }, (_, n) => start + n));
            i++;
            start = i;
            lastBreak = -1;
            x = 0;
            continue;
        }
        if (current.character.visible && add(Math.abs(x), current.glyphAdvance) > available && i > start && settings.m_enableWordWrapping) {
            const end = lastBreak >= start ? lastBreak + 1 : i;
            lines.push(Array.from({ length: end - start }, (_, n) => start + n));
            i = end;
            start = end;
            lastBreak = -1;
            x = 0;
            continue;
        }
        x = add(x, current.advance);
        if (code === 32 || code === 45 || code === 8203 || code === 173)
            lastBreak = i;
        else if (modern === false && code > 44032 && code < 55295 && !node.leadingCharacters?.includes(code) && !node.followingCharacters?.includes(chars[i + 1]?.character.unicode))
            lastBreak = i;
        i++;
    }
    if (start < chars.length)
        lines.push(Array.from({ length: chars.length - start }, (_, n) => start + n));
    if (!lines.length)
        lines.push([]);
    const sourceFace = node.fonts[base.characters[0].font].face;
    const sourceScale = f(size / sourceFace.m_PointSize * sourceFace.m_Scale);
    const gap = mul(sub(sourceFace.m_LineHeight, sub(sourceFace.m_AscentLine, sourceFace.m_DescentLine)), sourceScale);
    const lineSpacing = mul(Number(settings.m_lineSpacing), em);
    const paragraphSpacing = mul(Number(settings.m_paragraphSpacing), em);
    const lineMetrics: {
        ascent: number;
        descent: number;
        offset: number;
        advance: number;
    }[] = [];
    let offset = 0;
    for (let row = 0; row < lines.length; row++) {
        const indices = lines[row];
        const ascent = Math.max(...indices.map(index => chars[index].ascender));
        const descent = Math.min(...indices.map(index => chars[index].descender));
        if (row > 0) {
            const previous = lineMetrics[row - 1];
            const paragraph = chars[lines[row - 1].at(-1)!].character.unicode === 10;
            offset = add(offset, add(add(add(-previous.descent, ascent), gap), add(lineSpacing, paragraph ? paragraphSpacing : 0)));
        }
        let advance = 0, lastVisibleAdvance = 0;
        for (const index of indices) {
            advance = add(advance, chars[index].advance);
            if (chars[index].character.visible)
                lastVisibleAdvance = sub(advance, spacing);
        }
        lineMetrics.push({ ascent, descent, offset, advance: lastVisibleAdvance });
    }
    const topAscent = lineMetrics[0].ascent;
    const bottomDescent = sub(lineMetrics.at(-1)!.descent, lineMetrics.at(-1)!.offset);
    const vertical = Number(settings.m_VerticalAlignment), horizontal = Number(settings.m_HorizontalAlignment);
    const pivot = base.pivot;
    const rectLeft = mul(-pivot[0], width), rectTop = mul(sub(1, pivot[1]), height);
    let baseline = sub(sub(rectTop, margin[1]), topAscent);
    if (vertical === 512)
        baseline = sub(add(mul(sub(0.5, pivot[1]), height), f((margin[3] - margin[1]) / 2)), f(add(topAscent, bottomDescent) / 2));
    else if (vertical === 1024)
        baseline = sub(add(mul(-pivot[1], height), margin[3]), bottomDescent);
    const output: NativeTextMesh[] = [];
    for (let row = 0; row < lines.length; row++) {
        const metric = lineMetrics[row];
        let lineX = add(rectLeft, margin[0]);
        if (horizontal === 2)
            lineX = add(lineX, sub(f(available / 2), f(metric.advance / 2)));
        else if (horizontal === 4)
            lineX = add(lineX, sub(available, metric.advance));
        let advance = 0;
        for (const index of lines[row]) {
            const current = chars[index], character = current.character;
            if (character.visible) {
                const mesh = current.sample.meshes.find(mesh => mesh.index === character.mesh)!;
                const vertex = character.vertex;
                const positions: number[] = [];
                const origin = add(lineX, advance), characterBaseline = sub(baseline, metric.offset);
                for (let corner = 0; corner < 4; corner++) {
                    positions.push(add(origin, sub(mesh.positions[(vertex + corner) * 2], character.origin)), add(characterBaseline, sub(mesh.positions[(vertex + corner) * 2 + 1], character.baseline)));
                }
                output.push({ index: output.length, material: mesh.material, positions,
                    uv: mesh.uv.slice(vertex * 2, (vertex + 4) * 2), scales: mesh.scales.slice(vertex, vertex + 4),
                    colors: mesh.colors.slice(vertex * 4, (vertex + 4) * 4), indices: [0, 1, 2, 2, 3, 0] });
            }
            advance = add(advance, current.advance);
        }
    }
    let naturalWidth = 0, naturalLine = 0, naturalVisible = 0;
    for (const current of chars) {
        if (current.character.unicode === 10) {
            naturalWidth = Math.max(naturalWidth, naturalVisible);
            naturalLine = 0;
            naturalVisible = 0;
        }
        else {
            // CalculatePreferredValues measures the final visible glyph before adding
            // characterSpacing. Subtracting it afterwards differs at float32 ties.
            if (current.character.visible)
                naturalVisible = add(Math.abs(naturalLine), current.glyphAdvance);
            naturalLine = add(naturalLine, current.advance);
        }
    }
    naturalWidth = Math.max(naturalWidth, naturalVisible);
    return { meshes: output, width: preferredRound(add(add(naturalWidth, margin[0]), margin[2])),
        height: preferredRound(add(add(sub(topAscent, bottomDescent), margin[1]), margin[3])), lines, sample };
}
