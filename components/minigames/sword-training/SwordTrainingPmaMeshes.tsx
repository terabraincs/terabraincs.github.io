"use client";
import { deploymentUrl } from "@/lib/deployment";

import { useEffect, useRef, useState } from "react";
import { swordTrainingColor32 } from "@/lib/swordTrainingClientPma";
export type SwordTrainingPmaMesh = {
    id: string;
    texture: string;
    /** Original mesh projected into this canvas, two coordinates per vertex, Y down. */
    positions: readonly number[];
    /** Coordinates against the complete extracted PNG, with V zero at its top. */
    uvs: readonly number[];
    indices: readonly number[];
    /** NKC_FXM_UI_IMAGE_PMA.SetOutputColor result, before Graphic Color32 conversion. */
    color: readonly [
        number,
        number,
        number,
        number
    ];
    /** Original UiParticles UV1.xy. Present only for UI/Particles/Premultiply Alpha. */
    particleCustom?: readonly [
        number,
        number
    ];
    /** Original particle material _TintColor; ignored by the sprite shader. */
    particleTint?: readonly [
        number,
        number,
        number,
        number
    ];
    /** MAT_NKC_ADD: texture * Color32 with SrcAlpha/One (not factor-two PMA). */
    sourceAlphaAdditive?: boolean;
    /** Original UI/Particles/Additive uses two; NKC/Mobile/Particles/Additive one. */
    sourceAlphaAdditiveMultiplier?: 1 | 2;
    /** UI/Default with the original tight Sprite mesh. */
    sourceStraightAlpha?: boolean;
};
type Props = {
    width: number;
    height: number;
    meshes: readonly SwordTrainingPmaMesh[];
    className?: string;
    onReady?: () => void;
    onError?: (message: string) => void;
};
// Installed common/shaders.asset, NKC/NKC_FX_SPRITE_UI, DXBC program 17.
// In particular BlendFactor=0 emits nonzero RGB with zero alpha. A CSS opacity
// or standard straight-alpha image would discard that original additive light.
const VERTEX = `
attribute vec2 aPosition;
attribute vec2 aUv;
uniform vec2 uSize;
varying vec2 vUv;
void main() {
  gl_Position = vec4(aPosition.x / uSize.x * 2.0 - 1.0, 1.0 - aPosition.y / uSize.y * 2.0, 0.0, 1.0);
  vUv = aUv;
}`;
const FRAGMENT = `
precision highp float;
uniform sampler2D uTexture;
uniform vec4 uColor;
uniform vec2 uParticleCustom;
uniform vec4 uParticleTint;
uniform bool uParticleShader;
uniform bool uSourceAlphaAdditive;
uniform float uAdditiveMultiplier;
uniform bool uStraightAlpha;
varying vec2 vUv;
void main() {
  if (uStraightAlpha) {
    vec4 sampled = texture2D(uTexture, vUv) * uColor;
    gl_FragColor = vec4(sampled.rgb * sampled.a, sampled.a);
  } else if (uSourceAlphaAdditive) {
    // NKC/Mobile/Particles/Additive DXBC: sample; mul(texture, vertexColor).
    // Fold native SrcAlpha/One into a zero-alpha premultiplied contribution,
    // preserving underlying UI/text RGB during browser composition.
    vec4 sampled = texture2D(uTexture, vUv) * uColor * uAdditiveMultiplier;
    gl_FragColor = vec4(sampled.rgb * clamp(sampled.a, 0.0, 1.0), 0.0);
  } else if (uParticleShader) {
    // Original UI/Particles/Premultiply Alpha, DXBC fragment program 3.
    vec4 sampled = texture2D(uTexture, vUv) * uParticleTint;
    float amount = uColor.a * uParticleCustom.x;
    gl_FragColor = sampled * vec4(amount * uColor.rgb, amount * uParticleCustom.y);
  } else {
    vec4 color = texture2D(uTexture, vUv) * uColor * 2.0;
    color.a = clamp(color.a, 0.0, 1.0);
    gl_FragColor = color;
  }
}`;
/** Original sprite-PMA and UiParticles-PMA shader variants, sharing GL resources. */
export default function SwordTrainingPmaMeshes({ width, height, meshes, className, onReady, onError }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const latest = useRef({ width, height, meshes, onReady, onError });
    const renderRef = useRef<(() => void) | null>(null);
    const [status, setStatus] = useState("loading");
    latest.current = { width, height, meshes, onReady, onError };
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: true });
        if (!gl) {
            setStatus("error");
            latest.current.onError?.("The original Sword Training PMA shader requires WebGL.");
            return;
        }
        let cancelled = false;
        let ready = false;
        let errorMessage = "";
        const textures = new Map<string, {
            texture: WebGLTexture;
            image: HTMLImageElement;
            loaded: boolean;
        }>();
        const shaders: WebGLShader[] = [];
        const buffers: WebGLBuffer[] = [];
        let program: WebGLProgram | null = null;
        const maximumBuffer = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number;
        const maximumViewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
        const fail = (error: unknown) => {
            if (cancelled)
                return;
            const message = error instanceof Error ? error.message : String(error);
            canvas.dataset.pmaError = message;
            if (errorMessage !== message) {
                errorMessage = message;
                setStatus("error");
                latest.current.onError?.(message);
            }
        };
        try {
            program = gl.createProgram();
            if (!program)
                throw new Error("Sword Training PMA program allocation failed.");
            for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]] as const) {
                const shader = gl.createShader(type);
                if (!shader)
                    throw new Error("Sword Training PMA shader allocation failed.");
                shaders.push(shader);
                gl.shaderSource(shader, source);
                gl.compileShader(shader);
                if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
                    throw new Error(gl.getShaderInfoLog(shader) || "PMA shader compilation failed.");
                gl.attachShader(program, shader);
            }
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS))
                throw new Error(gl.getProgramInfoLog(program) || "PMA shader link failed.");
            gl.useProgram(program);
            for (let index = 0; index < 3; index++) {
                const buffer = gl.createBuffer();
                if (!buffer)
                    throw new Error("Sword Training PMA mesh allocation failed.");
                buffers.push(buffer);
            }
            const position = gl.getAttribLocation(program, "aPosition");
            const uv = gl.getAttribLocation(program, "aUv");
            const size = gl.getUniformLocation(program, "uSize");
            const color = gl.getUniformLocation(program, "uColor");
            const particleShader = gl.getUniformLocation(program, "uParticleShader");
            const sourceAlphaAdditive = gl.getUniformLocation(program, "uSourceAlphaAdditive");
            const additiveMultiplier = gl.getUniformLocation(program, "uAdditiveMultiplier");
            const straightAlpha = gl.getUniformLocation(program, "uStraightAlpha");
            const particleCustom = gl.getUniformLocation(program, "uParticleCustom");
            const particleTint = gl.getUniformLocation(program, "uParticleTint");
            gl.uniform1i(gl.getUniformLocation(program, "uTexture"), 0);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            gl.disable(gl.DEPTH_TEST);
            gl.disable(gl.CULL_FACE);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
            gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
            gl.clearColor(0, 0, 0, 0);
            renderRef.current = () => {
                if (cancelled)
                    return;
                try {
                    const current = latest.current;
                    if (!(current.width > 0 && current.height > 0))
                        return;
                    // A source Image may be a 100-unit rect beneath a 55x transform.
                    // Its WebGL backing buffer must follow rendered pixels, not that tiny
                    // local rect. Accumulate basis vectors to handle rotated ancestors
                    // without confusing an axis-aligned bounding box with texture scale.
                    let matrix = new DOMMatrixReadOnly();
                    for (let node: HTMLElement | null = canvas; node; node = node.parentElement) {
                        const transform = window.getComputedStyle(node).transform;
                        if (transform !== "none")
                            matrix = new DOMMatrixReadOnly(transform).multiply(matrix);
                    }
                    const resolution = window.devicePixelRatio || 1;
                    const requestedWidth = Math.max(1, Math.ceil(canvas.clientWidth * Math.hypot(matrix.m11, matrix.m12) * resolution));
                    const requestedHeight = Math.max(1, Math.ceil(canvas.clientHeight * Math.hypot(matrix.m21, matrix.m22) * resolution));
                    const hardwareScale = Math.min(1, maximumBuffer / requestedWidth, maximumBuffer / requestedHeight, maximumViewport[0] / requestedWidth, maximumViewport[1] / requestedHeight);
                    const pixelWidth = Math.max(1, Math.floor(requestedWidth * hardwareScale));
                    const pixelHeight = Math.max(1, Math.floor(requestedHeight * hardwareScale));
                    const requestedRaster = `${requestedWidth}x${requestedHeight}`;
                    const rasterScale = String(hardwareScale);
                    if (canvas.dataset.pmaRasterRequested !== requestedRaster)
                        canvas.dataset.pmaRasterRequested = requestedRaster;
                    if (canvas.dataset.pmaRasterHardwareScale !== rasterScale)
                        canvas.dataset.pmaRasterHardwareScale = rasterScale;
                    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
                        canvas.width = pixelWidth;
                        canvas.height = pixelHeight;
                    }
                    gl.viewport(0, 0, canvas.width, canvas.height);
                    gl.clear(gl.COLOR_BUFFER_BIT);
                    gl.uniform2f(size, current.width, current.height);
                    let waiting = false;
                    for (const mesh of current.meshes) {
                        if (mesh.positions.length !== mesh.uvs.length || mesh.positions.length % 2 !== 0 || mesh.indices.some((index) => index < 0 || index >= mesh.positions.length / 2)) {
                            throw new Error(`Invalid original PMA mesh: ${mesh.id}`);
                        }
                        let entry = textures.get(mesh.texture);
                        if (!entry) {
                            const texture = gl.createTexture();
                            if (!texture)
                                throw new Error("Sword Training PMA texture allocation failed.");
                            const image = new Image(); image.crossOrigin = "anonymous";
                            entry = { texture, image, loaded: false };
                            textures.set(mesh.texture, entry);
                            const loading = entry;
                            image.onload = () => {
                                if (cancelled)
                                    return;
                                gl.bindTexture(gl.TEXTURE_2D, texture);
                                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                                loading.loaded = true;
                                renderRef.current?.();
                            };
                            image.onerror = () => fail(`Sword Training PMA texture failed: ${mesh.texture}`);
                            image.src = deploymentUrl(mesh.texture);
                        }
                        if (!entry.loaded) {
                            waiting = true;
                            continue;
                        }
                        gl.bindTexture(gl.TEXTURE_2D, entry.texture);
                        gl.bindBuffer(gl.ARRAY_BUFFER, buffers[0]);
                        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.positions), gl.DYNAMIC_DRAW);
                        gl.enableVertexAttribArray(position);
                        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
                        gl.bindBuffer(gl.ARRAY_BUFFER, buffers[1]);
                        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.uvs), gl.DYNAMIC_DRAW);
                        gl.enableVertexAttribArray(uv);
                        gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 0, 0);
                        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers[2]);
                        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.indices), gl.DYNAMIC_DRAW);
                        gl.uniform4fv(color, swordTrainingColor32(mesh.color));
                        gl.uniform1i(particleShader, mesh.particleCustom ? 1 : 0);
                        gl.uniform1i(sourceAlphaAdditive, mesh.sourceAlphaAdditive ? 1 : 0);
                        gl.uniform1f(additiveMultiplier, mesh.sourceAlphaAdditiveMultiplier ?? 1);
                        gl.uniform1i(straightAlpha, mesh.sourceStraightAlpha ? 1 : 0);
                        if (mesh.particleCustom) {
                            gl.uniform2f(particleCustom, mesh.particleCustom[0], mesh.particleCustom[1]);
                            const tint = mesh.particleTint ?? [1, 1, 1, 1];
                            gl.uniform4f(particleTint, tint[0], tint[1], tint[2], tint[3]);
                        }
                        gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
                    }
                    const meshCount = String(current.meshes.length);
                    if (canvas.dataset.pmaMeshCount !== meshCount)
                        canvas.dataset.pmaMeshCount = meshCount;
                    if (!waiting && !errorMessage && !ready) {
                        ready = true;
                        setStatus("ready");
                        latest.current.onReady?.();
                    }
                }
                catch (error) {
                    fail(error);
                }
            };
            renderRef.current();
        }
        catch (error) {
            fail(error);
        }
        const render = () => renderRef.current?.();
        window.addEventListener("resize", render);
        return () => {
            cancelled = true;
            renderRef.current = null;
            window.removeEventListener("resize", render);
            for (const entry of textures.values()) {
                entry.image.onload = null;
                entry.image.onerror = null;
                gl.deleteTexture(entry.texture);
            }
            for (const buffer of buffers)
                gl.deleteBuffer(buffer);
            for (const shader of shaders)
                gl.deleteShader(shader);
            if (program)
                gl.deleteProgram(program);
        };
    }, []);
    useEffect(() => { renderRef.current?.(); }, [width, height, meshes]);
    return <canvas ref={canvasRef} className={className} aria-hidden="true" data-sword-pma-status={status} data-source-shader={meshes.some(mesh => mesh.sourceAlphaAdditive) ? "NKC/Mobile/Particles/Additive" : meshes.some(mesh => mesh.particleCustom) ? "UI/Particles/Premultiply Alpha" : "NKC/NKC_FX_SPRITE_UI"} style={{ display: "block", width: "100%", height: "100%", pointerEvents: "none" }}/>;
}
