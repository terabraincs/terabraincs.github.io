"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { swordClientCssColor, type ClientColor } from "@/lib/swordTrainingClientLayout";
import { layoutSwordNativeText, type NativeTextBinding } from "@/lib/swordTrainingNativeText";
import { rasterSwordNativeText, swordNativeTextDensity, swordNativeTextScreenMatrix } from "@/lib/swordTrainingNativeTextRaster";
import { rasterSwordNativeLegacyText, swordNativeLegacyRasterFrame, swordNativeLegacySample, type SwordNativeLegacyBinding } from "@/lib/swordTrainingNativeLegacyText";
export type SwordClientText = {
    componentType: string;
    componentPathId: string;
    text: string;
    stringKey: string;
    font: {
        webPath: string;
        cssFamily: string;
        faceInfo?: Record<string, number | string>;
        fontMetrics?: Record<string, number>;
        fallbackCssFamilies?: string[];
    };
    fontSize: number;
    color: ClientColor;
    alignment: {
        horizontal: number | null;
        vertical: number | null;
        legacy: number | null;
    };
    fontStyle: number;
    richText: number | boolean;
    lineSpacing: number;
    characterSpacing: number | null;
    wordSpacing: number | null;
    paragraphSpacing: number | null;
    margin: ClientColor | null;
    autoSizing: number | boolean;
    minSize: number;
    maxSize: number;
    enableKerning?: number | boolean;
    native?: NativeTextBinding;
    /** Unity Font.GetCharacterInfo at this exact point size, captured natively. */
    legacyNativeMetrics?: {
        fontSize: number;
        advances: Record<string, number>;
    };
    legacyNative?: SwordNativeLegacyBinding;
};
export function swordTextPlain(text: string) {
    return text.replace(/<\/?(?:color|b|i|size)(?:=[^>]+)?>/g, "");
}
/** Font metrics come from the original TMP_FontAsset; no CSS baseline offsets. */
export function swordTextMetrics(source: SwordClientText, size = source.fontSize) {
    const face = source.font.faceInfo;
    if (face) {
        const scale = size / Number(face.m_PointSize) * Number(face.m_Scale);
        return {
            ascent: Number(face.m_AscentLine) * scale,
            descent: -Number(face.m_DescentLine) * scale,
            // TextMeshProUGUI.GenerateTextMesh uses two distinct scales: face
            // metrics use fontSize/pointSize; spacing uses fontSize*.01 (orthographic).
            lineHeight: Number(face.m_LineHeight) * scale + source.lineSpacing * size * 0.01,
            spacing: (source.characterSpacing ?? 0) * size * 0.01,
        };
    }
    const metrics = source.font.fontMetrics;
    if (!metrics)
        return null;
    const scale = size / metrics.unitsPerEm;
    return {
        ascent: metrics.ascent * scale,
        descent: -metrics.descent * scale,
        lineHeight: (metrics.ascent - metrics.descent + metrics.lineGap) * scale * source.lineSpacing,
        spacing: 0,
    };
}
export function swordTextFontCss(source: SwordClientText, size: number) {
    const families = [source.font.cssFamily, ...(source.font.fallbackCssFamilies ?? [])];
    return `${source.fontStyle & 2 ? "italic " : ""}${size}px ${families.map(family => `"${family}"`).join(", ")}`;
}
type Glyph = {
    value: string;
    color: string;
};
function glyphs(source: SwordClientText, value: string): Glyph[] {
    const base = swordClientCssColor(source.color);
    const stack = [base];
    const result: Glyph[] = [];
    for (const part of value.split(/(<color=#[0-9a-fA-F]{6,8}>|<\/color>)/g)) {
        if (source.richText && /^<color=/.test(part))
            stack.push(part.slice(7, -1));
        else if (source.richText && part === "</color>") {
            if (stack.length > 1)
                stack.pop();
        }
        else
            for (const char of part)
                result.push({ value: char, color: stack[stack.length - 1] });
    }
    return result;
}
export function measureSwordText(source: SwordClientText, value: string, width: number, context: CanvasRenderingContext2D) {
    if (source.legacyNative) {
        const sample = source.legacyNative.measureSample?.(value, width, source.fontSize) ?? swordNativeLegacySample(source.legacyNative, value, width, source.fontSize);
        const lines = sample.lines.map((line, index) => [...value.slice(line.start, sample.lines[index + 1]?.start ?? value.length)].filter(character => character !== "\n").map(character => ({ value: character, color: swordClientCssColor(source.color) })));
        return { lines, widths: sample.lines.map(() => sample.preferredWidth), metrics: swordTextMetrics(source)!, margin: source.margin ?? [0, 0, 0, 0], width: sample.preferredWidth, height: sample.preferredHeight };
    }
    if (source.native) {
        const base = source.native.catalog.samples[source.native.node.source];
        const measured = layoutSwordNativeText(source.native, value, width, base.rect[1]);
        const plain = [...swordTextPlain(value)];
        const lines = measured.lines.map(line => line.map(index => ({ value: plain[index], color: swordClientCssColor(source.color) })));
        return { lines, widths: lines.map(() => measured.width), metrics: swordTextMetrics(source)!, margin: source.margin ?? [0, 0, 0, 0], width: measured.width, height: measured.height };
    }
    context.font = swordTextFontCss(source, source.fontSize);
    context.fontKerning = source.enableKerning === false || source.enableKerning === 0 ? "none" : "normal";
    const metrics = swordTextMetrics(source);
    if (!metrics)
        throw new Error(`Original font metrics unavailable: ${source.font.cssFamily}`);
    const margin = source.margin ?? [0, 0, 0, 0];
    const available = width - margin[0] - margin[2];
    const lines: Glyph[][] = [[]];
    let lineWidth = 0;
    const nativeAdvance = source.legacyNativeMetrics?.fontSize === source.fontSize && [...swordTextPlain(value)].every(character => character === "\n" || source.legacyNativeMetrics!.advances[character] !== undefined)
        ? source.legacyNativeMetrics.advances : null;
    for (const glyph of glyphs(source, value)) {
        if (glyph.value === "\n") {
            lines.push([]);
            lineWidth = 0;
            continue;
        }
        const next = (nativeAdvance?.[glyph.value] ?? context.measureText(glyph.value).width) + metrics.spacing;
        if (lineWidth + next > available && lines.at(-1)!.length) {
            lines.push([]);
            lineWidth = 0;
        }
        lines.at(-1)!.push(glyph);
        lineWidth += next;
    }
    const widths = lines.map(line => (nativeAdvance ? line.reduce((sum, glyph) => sum + nativeAdvance[glyph.value], 0) : context.measureText(line.map(g => g.value).join("")).width) + Math.max(0, line.length - 1) * metrics.spacing);
    return { lines, widths, metrics, margin, width: Math.max(0, ...widths) + margin[0] + margin[2], height: metrics.ascent + metrics.descent + (lines.length - 1) * metrics.lineHeight + margin[1] + margin[3] };
}
/** Render original font, color, point-size, alignment and rich-text runs. */
export default function SwordTrainingText({ source, value, width, height }: {
    source: SwordClientText;
    value: string;
    width: number;
    height: number;
}) {
    const ref = useRef<HTMLCanvasElement>(null);
    const anchorRef = useRef<HTMLSpanElement>(null);
    const directScreenRaster = Boolean(source.legacyNative?.directScreenRaster);
    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
    const attachAnchor = useCallback((anchor: HTMLSpanElement | null) => {
        anchorRef.current = anchor;
        if (!directScreenRaster || !anchor)
            return;
        let target = anchor.parentElement;
        while (target?.parentElement && target.parentElement !== document.body) {
            target = target.parentElement;
            if (getComputedStyle(target).position === "fixed" && getComputedStyle(target).transform === "none")
                break;
        }
        setPortalTarget(target ?? document.body);
    }, [directScreenRaster]);
    useEffect(() => {
        const canvas = ref.current;
        if (!canvas || width <= 0 || height <= 0)
            return;
        const sourceElement = directScreenRaster ? anchorRef.current?.parentElement : canvas.parentElement;
        if (!sourceElement)
            return;
        let disposed = false;
        let generation = 0;
        let nativeRasterKey = "";
        let preparedNative: {
            measured: ReturnType<typeof layoutSwordNativeText>;
            sourceRect: readonly [
                number,
                number,
                number,
                number
            ];
            left: number;
            bottom: number;
            top: number;
            extent: number[];
        } | null = null;
        const render = async () => {
            if (source.legacyNative) {
                const sample = swordNativeLegacySample(source.legacyNative, value, width, source.fontSize);
                if (Math.abs(sample.rect[1] - height) > .005)
                    throw new Error(`Uncaptured native legacy height: ${source.legacyNative.path}: ${height}`);
                if (directScreenRaster) {
                    const matrix = swordNativeTextScreenMatrix(sourceElement);
                    if (Math.abs(matrix.b) > 1e-5 || Math.abs(matrix.c) > 1e-5 || matrix.a <= 0 || matrix.d <= 0)
                        throw new Error(`Direct native text requires an unrotated, unreflected source chain: ${source.legacyNative.path}`);
                }
                const density = swordNativeTextDensity(sourceElement) as [
                    number,
                    number
                ];
                if (density.some(value => value <= 0))
                    return;
                const parent = sourceElement.getBoundingClientRect();
                const frame = swordNativeLegacyRasterFrame(sample, density, [parent.left, parent.top], window.devicePixelRatio || 1);
                const appearance = directScreenRaster ? (() => {
                    let opacity = 1;
                    let visible = parent.width > 0 && parent.height > 0;
                    for (let element: HTMLElement | null = sourceElement; element; element = element.parentElement) {
                        const style = getComputedStyle(element);
                        opacity *= Number(style.opacity);
                        if (style.display === "none" || style.visibility === "hidden")
                            visible = false;
                        if (element.dataset.cafeModal && element.dataset.cafeModal !== "none")
                            visible = false;
                    }
                    return { opacity, visible };
                })() : null;
                const renderKey = directScreenRaster
                    ? `${frame.key}:${parent.left}:${parent.top}:${appearance!.opacity}:${appearance!.visible}`
                    : frame.key;
                if (nativeRasterKey === renderKey)
                    return;
                nativeRasterKey = renderKey;
                const revision = ++generation;
                await rasterSwordNativeLegacyText(canvas, sample, density, () => !disposed && generation === revision, frame);
                if (disposed || generation !== revision || !directScreenRaster)
                    return;
                const dpr = window.devicePixelRatio || 1;
                canvas.style.position = "fixed";
                canvas.style.left = `${parent.left + frame.offset[0] * density[0] / dpr}px`;
                canvas.style.top = `${parent.top + frame.offset[1] * density[1] / dpr}px`;
                canvas.style.width = `${frame.size[0] / dpr}px`;
                canvas.style.height = `${frame.size[1] / dpr}px`;
                canvas.style.opacity = String(appearance!.opacity);
                canvas.style.display = appearance!.visible ? "block" : "none";
                canvas.style.zIndex = "1";
                canvas.dataset.nativeScreenRaster = "direct-framebuffer";
                canvas.dataset.nativeScreenAxisAligned = "true";
                return;
            }
            if (source.native) {
                if (!preparedNative) {
                    const measured = layoutSwordNativeText(source.native, value, width, height);
                    const pivot = measured.sample.pivot;
                    const sourceRect = [-pivot[0] * width, -pivot[1] * height, width, height] as const;
                    // Unity TMP can render its SDF-padding vertices outside its own rect.
                    // Preserve them; the original parent RectMask2D supplies clipping.
                    const xs = measured.meshes.flatMap(mesh => mesh.positions.filter((_, index) => index % 2 === 0));
                    const ys = measured.meshes.flatMap(mesh => mesh.positions.filter((_, index) => index % 2 === 1));
                    const left = Math.min(sourceRect[0], ...xs), right = Math.max(sourceRect[0] + width, ...xs);
                    const bottom = Math.min(sourceRect[1], ...ys), top = Math.max(sourceRect[1] + height, ...ys);
                    preparedNative = { measured, sourceRect, left, bottom, top, extent: [right - left, top - bottom] };
                }
                const { measured, sourceRect, left, bottom, top, extent } = preparedNative;
                const density = swordNativeTextDensity(canvas);
                const rasterWidth = Math.max(1, Math.ceil(extent[0] * density[0]));
                const rasterHeight = Math.max(1, Math.ceil(extent[1] * density[1]));
                const rasterKey = `${rasterWidth}:${rasterHeight}`;
                if (nativeRasterKey === rasterKey)
                    return;
                nativeRasterKey = rasterKey;
                const revision = ++generation;
                await rasterSwordNativeText(canvas, source.native.catalog, measured.meshes, [left, bottom, ...extent] as [
                    number,
                    number,
                    number,
                    number
                ], rasterWidth, rasterHeight, () => !disposed && generation === revision);
                if (disposed || generation !== revision)
                    return;
                canvas.style.inset = "auto";
                canvas.style.left = `${left - sourceRect[0]}px`;
                canvas.style.top = `${sourceRect[1] + height - top}px`;
                canvas.style.width = `${extent[0]}px`;
                canvas.style.height = `${extent[1]}px`;
                canvas.dataset.sourceStatus = "ready";
                canvas.dataset.nativeTmp = "original-mesh-sdf";
                canvas.dataset.nativePreferred = JSON.stringify([measured.width, measured.height]);
                canvas.dataset.nativeRasterDensity = JSON.stringify(density);
                canvas.dataset.textOverflow = String(measured.height > height + 0.01);
                return;
            }
            await document.fonts.load(swordTextFontCss(source, source.fontSize), value || "0");
            if (disposed)
                return;
            const density = (window.devicePixelRatio || 1) * Math.max(1, canvas.getBoundingClientRect().width / width);
            canvas.width = Math.ceil(width * density);
            canvas.height = Math.ceil(height * density);
            const context = canvas.getContext("2d");
            if (!context)
                return;
            context.scale(canvas.width / width, canvas.height / height);
            context.font = swordTextFontCss(source, source.fontSize);
            context.fontKerning = source.enableKerning === false || source.enableKerning === 0 ? "none" : "normal";
            context.textBaseline = "alphabetic";
            try {
                const measured = measureSwordText(source, value, width, context);
                const legacy = source.alignment.legacy;
                const horizontal = legacy === null ? source.alignment.horizontal : [1, 2, 4][legacy % 3];
                const vertical = legacy === null ? source.alignment.vertical : [256, 512, 1024][Math.floor(legacy / 3)];
                const { margin, metrics } = measured;
                let baseline = margin[1] + metrics.ascent;
                const spareY = height - measured.height;
                if (vertical === 512)
                    baseline += spareY / 2;
                else if (vertical === 1024)
                    baseline += spareY;
                for (let row = 0; row < measured.lines.length; row++) {
                    let x = margin[0];
                    const spareX = width - margin[0] - margin[2] - measured.widths[row];
                    if (horizontal === 2)
                        x += spareX / 2;
                    else if (horizontal === 4)
                        x += spareX;
                    const line = measured.lines[row];
                    const native = source.legacyNativeMetrics;
                    if (native?.fontSize === source.fontSize && line.every(glyph => native.advances[glyph.value] !== undefined)) {
                        for (const glyph of line) {
                            context.fillStyle = glyph.color;
                            context.fillText(glyph.value, x, baseline + row * metrics.lineHeight);
                            x += native.advances[glyph.value];
                        }
                        continue;
                    }
                    // Canvas letterSpacing applies the separately recovered TMP spacing
                    // without replacing each glyph's kerning with a guessed fixed width.
                    context.letterSpacing = `${metrics.spacing}px`;
                    let run = "", runColor = line[0]?.color;
                    const flush = () => {
                        if (!run)
                            return;
                        context.fillStyle = runColor;
                        context.fillText(run, x, baseline + row * metrics.lineHeight);
                        // Canvas includes letterSpacing in measureText while it is enabled.
                        x += context.measureText(run).width;
                        run = "";
                    };
                    for (const glyph of line) {
                        if (glyph.color !== runColor) {
                            flush();
                            runColor = glyph.color;
                        }
                        run += glyph.value;
                    }
                    flush();
                    context.letterSpacing = "0px";
                }
                canvas.dataset.sourceStatus = "ready";
                canvas.dataset.textOverflow = String(measured.height > height + 0.01);
            }
            catch (error) {
                canvas.dataset.sourceStatus = "error";
                canvas.dataset.sourceError = String(error);
            }
        };
        const requestRender = () => {
            void render().catch(error => {
                if (!disposed) {
                    canvas.dataset.sourceStatus = "error";
                    canvas.dataset.sourceError = `Original font failed: ${source.font.webPath}: ${String(error)}`;
                }
            });
        };
        requestRender();
        // Popup intro, source DOTweens and ButtonScale change ancestor transforms
        // without a window resize. Refresh SDF raster density on those exact style
        // mutations; do not install an unconditional per-node animation-frame loop.
        let requestedFrame: number | null = null;
        const observer = source.native || source.legacyNative ? new MutationObserver(() => {
            if (requestedFrame !== null)
                return;
            requestedFrame = requestAnimationFrame(() => { requestedFrame = null; requestRender(); });
        }) : null;
        // Observe each ancestor itself, never subtree:true and never this canvas;
        // our own canvas style writes cannot feed back into this observer.
        if (observer)
            for (let parent: HTMLElement | null = sourceElement; parent; parent = parent.parentElement)
                observer.observe(parent, { attributes: true, attributeFilter: ["style", "class", "data-cafe-modal"] });
        window.addEventListener("resize", requestRender);
        if (directScreenRaster)
            document.addEventListener("scroll", requestRender, true);
        return () => {
            disposed = true;
            observer?.disconnect();
            if (requestedFrame !== null)
                cancelAnimationFrame(requestedFrame);
            window.removeEventListener("resize", requestRender);
            if (directScreenRaster)
                document.removeEventListener("scroll", requestRender, true);
        };
    }, [source, value, width, height, directScreenRaster, portalTarget]);
    const canvas = <canvas ref={ref} role="img" aria-label={swordTextPlain(value)} data-source-text={source.componentPathId} data-native-screen-source={directScreenRaster ? source.legacyNative?.path : undefined} style={{ position: directScreenRaster ? "fixed" : "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}/>;
    if (!directScreenRaster)
        return canvas;
    return <><span ref={attachAnchor} aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}/>
    {portalTarget ? createPortal(canvas, portalTarget) : null}</>;
}
