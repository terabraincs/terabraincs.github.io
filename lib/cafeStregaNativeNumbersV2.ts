import type { SwordNativeLegacyLayoutSample } from "./swordTrainingNativeLegacyText";
export type CafeNumericTemplate = SwordNativeLegacyLayoutSample & {
    usedFontSize: number;
};
export type CafeNativeNumericStyle = {
    nodePath: string;
    fontSize: number;
    bestFit: boolean;
    minSize: number;
    maxSize: number;
    alignment: number;
    rect: [
        number,
        number
    ];
    pivot: [
        number,
        number
    ];
    horizontalPreferred: boolean;
    letterSpacing: number;
    horizontalAlignmentRounding?: "floor" | "round";
    preferredHeightAtMaxSize?: boolean;
    bestFitClampMin?: boolean;
    lineSpacing: number;
    alignByGeometry?: boolean;
    templates: Record<string, Record<string, CafeNumericTemplate>>;
    sourceSamples?: Record<string, CafeNumericTemplate>;
};
export type CafeNativeNumericCatalog = {
    schemaVersion: number;
    nodes: Record<string, string>;
    styles: Record<string, CafeNativeNumericStyle>;
};
function parseNumeric(value: string, templates?: Record<string, CafeNumericTemplate>) {
    const values: {
        character: string;
        color?: number[];
    }[] = [];
    const colors: (number[] | undefined)[] = [undefined];
    for (let index = 0; index < value.length;) {
        const tag = value.slice(index).match(/^<color=#([0-9a-f]{6}(?:[0-9a-f]{2})?)>/i);
        if (tag) {
            const hex = tag[1].padEnd(8, "f");
            colors.push([0, 2, 4, 6].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16)));
            index += tag[0].length;
            continue;
        }
        if (value.startsWith("</color>", index)) {
            if (colors.length === 1)
                throw new Error("Unbalanced native numeric color tag");
            colors.pop();
            index += 8;
            continue;
        }
        const character = value[index++];
        if (!/^[0-9,/*]$/.test(character) && !templates?.[character])
            throw new Error(`Uncaptured native numeric character: ${character}`);
        values.push({ character, color: colors.at(-1) });
    }
    if (colors.length !== 1 || values.length === 0)
        throw new Error("Invalid native numeric value");
    return values;
}
/** Original glyph advances, not browser text measurement. */
export function cafeNativeNumericPreferredWidth(style: CafeNativeNumericStyle, value: string) {
    const templates = style.templates[String(style.fontSize)];
    return parseNumeric(value, templates).reduce((sum, entry) => {
        const template = templates?.[entry.character];
        if (!template)
            throw new Error(`Uncaptured native numeric glyph: ${entry.character}`);
        return sum + template.preferredWidth;
    }, 0);
}
/** Source TextGenerator glyph templates + original LetterSpacing/Outline order. */
export function composeCafeNativeNumeric(style: CafeNativeNumericStyle, value: string, width = style.rect[0]): CafeNumericTemplate {
    const characters = parseNumeric(value, style.templates[String(style.fontSize)]);
    const preferredWidth = cafeNativeNumericPreferredWidth(style, value);
    if (style.horizontalPreferred)
        width = preferredWidth;
    let fontSize = style.fontSize;
    if (style.bestFit) {
        for (fontSize = style.maxSize; fontSize >= style.minSize; fontSize--) {
            const templates = style.templates[String(fontSize)];
            if (characters.every(entry => templates?.[entry.character]?.characters.length && (entry.character === " " || templates[entry.character].mesh.positions.length))
                && characters.reduce((sum, entry) => sum + templates[entry.character].characters[0].width, 0) <= width)
                break;
        }
        if (fontSize < style.minSize) {
            if (!style.bestFitClampMin)
                throw new Error("Native numeric value exceeds captured source BestFit range");
            fontSize = style.minSize;
        }
    }
    const glyphs = characters.map(entry => {
        const template = style.templates[String(fontSize)]?.[entry.character];
        if (!template?.characters.length || entry.character !== " " && !template.mesh.positions.length)
            throw new Error(`Native glyph is not visible at ${fontSize}px: ${entry.character}`);
        return template;
    });
    const totalAdvance = glyphs.reduce((sum, glyph) => sum + glyph.characters[0].width, 0);
    const anchor = style.alignment % 3;
    const anchorFactor = anchor / 2;
    const localLeft = -width * style.pivot[0];
    const alignedCursor = localLeft + (width - totalAdvance) * anchorFactor;
    let cursor = style.horizontalAlignmentRounding === "round" ? Math.round(alignedCursor) : Math.floor(alignedCursor);
    const bounds = (templates: CafeNumericTemplate[]) => {
        let advance = 0;
        const x: number[] = [], y: number[] = [];
        for (const glyph of templates) {
            for (const vertex of glyph.mesh.positions) {
                x.push(vertex[0] - glyph.characters[0].cursor[0] + advance);
                y.push(vertex[1] - glyph.characters[0].cursor[1]);
            }
            advance += glyph.characters[0].width;
        }
        return { minX: Math.min(...x), maxX: Math.max(...x), minY: Math.min(...y), maxY: Math.max(...y) };
    };
    let geometryCursorY: number | undefined;
    if (style.alignByGeometry) {
        const box = bounds(glyphs);
        cursor = Math.round(localLeft + (width - (box.maxX - box.minX)) * anchorFactor - box.minX);
        const verticalFactor = 1 - Math.floor(style.alignment / 3) / 2;
        geometryCursorY = Math.floor(-style.rect[1] * style.pivot[1] + (style.rect[1] - (box.maxY - box.minY)) * verticalFactor - box.minY);
    }
    const cursors: number[] = [];
    for (const glyph of glyphs) {
        cursors.push(cursor);
        cursor += glyph.characters[0].width;
    }
    const mesh: SwordNativeLegacyLayoutSample["mesh"] = { positions: [], uvs: [], colors: [], indices: [] };
    const visibleBase = glyphs.find(glyph => glyph.mesh.indices.length);
    if (!visibleBase)
        throw new Error("No visible captured native numeric glyph");
    const passCount = visibleBase.mesh.indices.length / 6;
    if (!glyphs.every(glyph => !glyph.mesh.indices.length || glyph.mesh.indices.length / 6 === passCount))
        throw new Error("Original glyph effect topology differs");
    for (let pass = 0; pass < passCount; pass++)
        for (let index = 0; index < glyphs.length; index++) {
            const glyph = glyphs[index];
            if (!glyph.mesh.indices.length)
                continue;
            const spacing = style.letterSpacing * style.fontSize / 100 * (index - (glyphs.length - 1) * anchorFactor);
            const shift = cursors[index] - glyph.characters[0].cursor[0] + spacing;
            const indices = glyph.mesh.indices.slice(pass * 6, pass * 6 + 6);
            const unique = [...new Set(indices)];
            const base = mesh.positions.length;
            for (const vertex of unique) {
                mesh.positions.push([glyph.mesh.positions[vertex][0] + shift, glyph.mesh.positions[vertex][1] + (geometryCursorY === undefined ? 0 : geometryCursorY - glyph.characters[0].cursor[1]), glyph.mesh.positions[vertex][2]]);
                mesh.uvs.push(glyph.mesh.uvs[vertex]);
                mesh.colors.push(pass === passCount - 1 && characters[index].color ? characters[index].color! : glyph.mesh.colors[vertex]);
            }
            for (const vertex of indices)
                mesh.indices.push(base + unique.indexOf(vertex));
        }
    const base = glyphs[0];
    // Unity Text.preferredHeight asks TextGenerator for a width-constrained,
    // height-unconstrained result. Its BestFit choice may therefore differ from
    // the visible mesh (46px preferred height versus 45px in the 58.26px box).
    let heightFontSize = style.bestFit && style.preferredHeightAtMaxSize ? style.maxSize : style.fontSize;
    if (style.bestFit && !style.preferredHeightAtMaxSize)
        for (heightFontSize = style.maxSize; heightFontSize > style.minSize; heightFontSize--) {
            const templates = style.templates[String(heightFontSize)];
            if (characters.reduce((sum, entry) => sum + templates[entry.character].preferredWidth, 0) <= width)
                break;
        }
    const heightGlyphs = characters.map(c => style.templates[String(heightFontSize)][c.character]);
    const heightBounds = style.alignByGeometry ? bounds(heightGlyphs) : undefined;
    const heightLines = style.preferredHeightAtMaxSize ? characters.reduce((state, entry) => {
        const next = style.templates[String(heightFontSize)][entry.character].preferredWidth;
        if (state.width > 0 && state.width + next > width)
            return { lines: state.lines + 1, width: next };
        return { lines: state.lines, width: state.width + next };
    }, { lines: 1, width: 0 }).lines : 1;
    const singleLineHeight = heightBounds ? heightBounds.maxY - heightBounds.minY : style.templates[String(heightFontSize)][characters[0].character].preferredHeight;
    const lineAdvance = heightGlyphs[0].lines[0]?.height ?? singleLineHeight;
    const preferredHeight = Math.floor(singleLineHeight + Math.max(0, heightLines - 1) * lineAdvance * style.lineSpacing);
    return { ...base, text: value, fontSize: style.fontSize, usedFontSize: fontSize,
        rect: [width, style.rect[1]], localRect: [-width * style.pivot[0], -style.rect[1] * style.pivot[1], width, style.rect[1]],
        preferredWidth, preferredHeight, mesh,
        characters: glyphs.map((glyph, index) => ({ cursor: [cursors[index], geometryCursorY ?? glyph.characters[0].cursor[1]], width: glyph.characters[0].width })),
        lines: [{ ...base.lines[0], start: 0, ...(geometryCursorY === undefined ? {} : { topY: geometryCursorY }) }] };
}
export function cafeNativeNumericSample(catalog: CafeNativeNumericCatalog, nodePath: string, value: string, width?: number) {
    if (catalog.schemaVersion !== 1)
        throw new Error("Unsupported native numeric catalog");
    const styleId = catalog.nodes[nodePath];
    if (!styleId || !catalog.styles[styleId])
        throw new Error(`No original numeric style: ${nodePath}`);
    const style = catalog.styles[styleId];
    const captured = style.sourceSamples?.[value];
    if (captured && (width === undefined || Math.abs(captured.rect[0] - width) < 0.005))
        return captured;
    return composeCafeNativeNumeric(style, value, width);
}
