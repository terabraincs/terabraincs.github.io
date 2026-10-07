"use client";
import { deploymentUrl } from "@/lib/deployment";

import { useEffect, useRef, type ReactNode } from "react";
import type { ClientColor, ClientVector2 } from "@/lib/swordTrainingClientLayout";
export type SwordClientImage = {
    componentType: string;
    componentPathId: string;
    webPath?: string;
    imageType: number | null;
    color: ClientColor;
    pixelSize?: ClientVector2;
    pixelsPerUnit: number | null;
    pixelsPerUnitMultiplier: number | null;
    border: ClientColor | null;
    preserveAspect: boolean | number | null;
    fillCenter: boolean | number | null;
    fillMethod: number | null;
    fillAmount: number | null;
    fillOrigin: number | null;
    fillClockwise: boolean | number | null;
};
const loaded = new Map<string, Promise<HTMLImageElement>>();
function loadImage(src: string) {
    let promise = loaded.get(src);
    if (!promise) {
        promise = new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image(); image.crossOrigin = "anonymous";
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error(`Cannot load client sprite: ${src}`));
            image.src = deploymentUrl(src);
        });
        loaded.set(src, promise);
    }
    return promise;
}
function destinationCuts(extent: number, first: number, last: number, raster: number) {
    const ratio = first + last > extent ? extent / (first + last) : 1;
    return [0, Math.round(first * ratio / extent * raster), Math.round((extent - last * ratio) / extent * raster), raster];
}
/** Unity Image mesh rendered as one raster, so scaled slice edges share pixels. */
export default function SwordTrainingImage({ image, width, height, pivot, color = image.color, fillAmount = image.fillAmount, mask = false, showMaskGraphic = false, children, }: {
    image: SwordClientImage;
    width: number;
    height: number;
    pivot: ClientVector2;
    color?: ClientColor;
    fillAmount?: number | null;
    mask?: boolean;
    showMaskGraphic?: boolean;
    children?: ReactNode;
}) {
    const rootRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [r, g, b, a] = color;
    const [px, py] = pivot;
    useEffect(() => {
        const root = rootRef.current;
        const canvas = canvasRef.current;
        if (!root || !canvas || width <= 0 || height <= 0)
            return;
        let cancelled = false;
        root.dataset.sourceStatus = "loading";
        const render = async () => {
            try {
                const source = image.webPath ? await loadImage(image.webPath) : null;
                if (cancelled)
                    return;
                const scale = Math.max(1, root.getBoundingClientRect().width / width);
                const density = (window.devicePixelRatio || 1) * scale;
                canvas.width = Math.ceil(width * density);
                canvas.height = Math.ceil(height * density);
                const context = canvas.getContext("2d", { willReadFrequently: r !== 1 || g !== 1 || b !== 1 });
                if (!context)
                    throw new Error("Canvas 2D is unavailable");
                context.imageSmoothingEnabled = true;
                if (!source) {
                    context.fillStyle = "white";
                    context.fillRect(0, 0, canvas.width, canvas.height);
                }
                else if (image.imageType === 1 && image.border?.some(Boolean)) {
                    const [left, bottom, right, top] = image.border;
                    const units = (image.pixelsPerUnit! / 100) * image.pixelsPerUnitMultiplier!;
                    const sx = [0, left, source.width - right, source.width];
                    const sy = [0, top, source.height - bottom, source.height];
                    const dx = destinationCuts(width, left / units, right / units, canvas.width);
                    const dy = destinationCuts(height, top / units, bottom / units, canvas.height);
                    for (let y = 0; y < 3; y++)
                        for (let x = 0; x < 3; x++) {
                            if (x === 1 && y === 1 && !image.fillCenter)
                                continue;
                            const sw = sx[x + 1] - sx[x], sh = sy[y + 1] - sy[y];
                            const dw = dx[x + 1] - dx[x], dh = dy[y + 1] - dy[y];
                            if (sw > 0 && sh > 0 && dw > 0 && dh > 0)
                                context.drawImage(source, sx[x], sy[y], sw, sh, dx[x], dy[y], dw, dh);
                        }
                }
                else {
                    let w = canvas.width, h = canvas.height;
                    if (image.preserveAspect) {
                        const aspect = source.width / source.height;
                        if (w / h > aspect)
                            w = h * aspect;
                        else
                            h = w / aspect;
                    }
                    const x = (canvas.width - w) * px, y = (canvas.height - h) * (1 - py);
                    if (image.imageType === 3 && fillAmount !== null && fillAmount !== undefined && fillAmount < 1) {
                        if (image.fillMethod !== 0)
                            throw new Error("Unimplemented source fill method");
                        const start = image.fillOrigin === 1 ? 1 - fillAmount : 0;
                        if (fillAmount > 0)
                            context.drawImage(source, source.width * start, 0, source.width * fillAmount, source.height, x + w * start, y, w * fillAmount, h);
                    }
                    else
                        context.drawImage(source, x, y, w, h);
                }
                // Gamma-space vertex RGB multiplication: verified PlayerSettings colorSpace=0.
                if (r !== 1 || g !== 1 || b !== 1) {
                    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
                    for (let i = 0; i < pixels.data.length; i += 4) {
                        pixels.data[i] *= r;
                        pixels.data[i + 1] *= g;
                        pixels.data[i + 2] *= b;
                    }
                    context.putImageData(pixels, 0, 0);
                }
                if (mask) {
                    const url = `url("${deploymentUrl(canvas.toDataURL())}")`;
                    root.style.maskImage = url;
                    root.style.webkitMaskImage = url;
                }
                root.dataset.sourceStatus = "ready";
            }
            catch (error) {
                if (!cancelled) {
                    root.dataset.sourceStatus = "error";
                    root.dataset.sourceError = String(error);
                }
            }
        };
        void render();
        window.addEventListener("resize", render);
        return () => { cancelled = true; window.removeEventListener("resize", render); };
    }, [image, width, height, px, py, r, g, b, mask, fillAmount]);
    return <div ref={rootRef} data-source-image={image.webPath ?? "Unity-white"} style={{
            position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none",
            ...(mask ? { maskSize: "100% 100%", maskRepeat: "no-repeat", WebkitMaskSize: "100% 100%", WebkitMaskRepeat: "no-repeat" } : { opacity: a }),
        }}>
    <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: mask && !showMaskGraphic ? "none" : "block" }}/>
    {children}
  </div>;
}
