"use client";
import { deploymentUrl } from "@/lib/deployment";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { getMatchTenSliceLayout } from "@/lib/matchTenSlicedImage";
type Props = {
    src: string;
    border: readonly [
        left: number,
        bottom: number,
        right: number,
        top: number
    ];
    className?: string;
    maskColor?: string;
    asMask?: boolean;
    children?: ReactNode;
};
const CANVAS_STYLE: CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "block",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
};
const MASK_CANVAS_STYLE: CSSProperties = { ...CANVAS_STYLE, display: "none" };
const MASK_STYLE: CSSProperties = {
    maskMode: "alpha",
    maskImage: "linear-gradient(transparent, transparent)",
    WebkitMaskImage: "linear-gradient(transparent, transparent)",
    maskSize: "100% 100%",
    WebkitMaskSize: "100% 100%",
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskPosition: "center",
    WebkitMaskPosition: "center",
};
/** Composite the original Unity slices before the game canvas is scaled.
 * CSS border-image can expose subpixel seams between separately painted pieces.
 * A single bitmap with shared integer edges has no gaps or alpha-overdraw strips.
 */
export default function MatchTenSlicedImage({ src, border, className, maskColor, asMask = false, children, }: Props) {
    const rootRef = useRef<HTMLElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [left, bottom, right, top] = border;
    const Root = asMask ? "div" : "span";
    useEffect(() => {
        const root = rootRef.current;
        const canvas = canvasRef.current;
        if (!root || !canvas)
            return;
        const context = canvas.getContext("2d");
        if (!context)
            return;
        let disposed = false;
        let rasterSignature = "";
        const image = new Image(); image.crossOrigin = "anonymous";
        image.decoding = "async";
        root.dataset.sliceStatus = "loading";
        const setMaskImage = (value: string) => {
            root.style.setProperty("mask-image", value);
            root.style.setProperty("-webkit-mask-image", value);
        };
        if (asMask) {
            // Keep descendants clipped while the new source loads. Do not expose an
            // earlier source's mask during src/border changes or effect replays.
            setMaskImage("linear-gradient(transparent, transparent)");
        }
        const render = () => {
            if (disposed || !image.complete || !image.naturalWidth)
                return;
            // Computed dimensions are untransformed client-layout units. Keep at
            // least that density so parent scale/press animations resample one bitmap.
            const style = getComputedStyle(root);
            const width = Number.parseFloat(style.width);
            const height = Number.parseFloat(style.height);
            if (!(width > 0 && height > 0))
                return;
            const displayScale = root.getBoundingClientRect().width / width;
            const pixelRatio = (window.devicePixelRatio || 1) * Math.max(1, displayScale);
            const layout = getMatchTenSliceLayout(image.naturalWidth, image.naturalHeight, width, height, [left, bottom, right, top], pixelRatio);
            const signature = JSON.stringify(layout);
            if (signature === rasterSignature)
                return;
            canvas.width = layout.width;
            canvas.height = layout.height;
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = "low";
            for (const patch of layout.patches) {
                context.drawImage(image, patch.sx, patch.sy, patch.sw, patch.sh, patch.dx, patch.dy, patch.dw, patch.dh);
            }
            if (maskColor) {
                // Replace RGB only; retain the source mask's alpha without painting
                // separate CSS mask-box-image pieces at fractional display boundaries.
                context.globalCompositeOperation = "source-in";
                context.fillStyle = maskColor;
                context.fillRect(0, 0, layout.width, layout.height);
                context.globalCompositeOperation = "source-over";
            }
            if (asMask) {
                try {
                    // One PNG alpha mask clips all descendants together; unlike a CSS
                    // mask-box-image, it cannot resample the nine pieces independently.
                    setMaskImage(`url("${deploymentUrl(canvas.toDataURL("image/png"))}")`);
                }
                catch {
                    setMaskImage("linear-gradient(transparent, transparent)");
                    root.dataset.sliceStatus = "error";
                    return;
                }
            }
            rasterSignature = signature;
            root.dataset.sliceStatus = "ready";
        };
        image.onload = render;
        image.onerror = () => {
            if (!disposed)
                root.dataset.sliceStatus = "error";
        };
        const observer = new ResizeObserver(render);
        observer.observe(root);
        window.addEventListener("resize", render);
        image.src = deploymentUrl(src);
        return () => {
            disposed = true;
            image.onload = null;
            image.onerror = null;
            observer.disconnect();
            window.removeEventListener("resize", render);
            if (asMask) {
                root.style.removeProperty("mask-image");
                root.style.removeProperty("-webkit-mask-image");
            }
        };
    }, [src, left, bottom, right, top, maskColor, asMask]);
    return (<Root ref={(element) => {
            rootRef.current = element;
        }} className={className} style={asMask ? MASK_STYLE : undefined} aria-hidden="true" data-match-ten-sliced-image={src} data-slice-renderer="single-raster" data-slice-mode={asMask ? "mask" : "image"} data-slice-mask-color={maskColor}>
      <canvas ref={canvasRef} style={asMask ? MASK_CANVAS_STYLE : CANVAS_STYLE}/>
      {children}
    </Root>);
}
