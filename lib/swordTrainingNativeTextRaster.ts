
import { deploymentUrl } from "@/lib/deployment";
import type { NativeTextCatalog, NativeTextMesh } from "./swordTrainingNativeText";
// Original ab_font_tmp_loc.asset shader 3039605131867672570, D3D11 DXBC
// vertex programs 2/3 and fragment programs 12/13. No Canvas stroke substitute.
const VERTEX = `
attribute vec2 aPosition;
attribute vec2 aUv;
attribute float aScale;
attribute vec4 aColor;
uniform vec4 uRect;
uniform vec2 uDensity;
uniform vec2 uScaleXY;
uniform float uGradientScale;
uniform float uSharpness;
uniform float uWeightNormal;
uniform float uWeightBold;
uniform float uFaceDilate;
uniform float uRatioA;
uniform float uOutlineWidth;
uniform float uOutlineSoftness;
uniform vec2 uVertexOffset;
varying vec2 vUv;
varying vec4 vColor;
varying vec4 vSdf;
void main() {
  gl_Position = vec4((aPosition + uVertexOffset - uRect.xy) / uRect.zw * 2.0 - 1.0, 0.0, 1.0);
  vec2 pixel = 1.0 / (2.0 * uDensity * uScaleXY);
  float scale = inversesqrt(dot(pixel, pixel)) * abs(aScale) * uGradientScale * (uSharpness + 1.0);
  float weight = ((aScale <= 0.0 ? uWeightBold : uWeightNormal) * 0.25 + uFaceDilate) * uRatioA * 0.5;
  vSdf = vec4(0.5 - weight - (uOutlineWidth + uOutlineSoftness) * uRatioA * 0.5 - 0.5 / scale,
              scale, 0.5 - weight + 0.5 / scale, weight);
  vColor = aColor;
  vUv = aUv;
}`;
const FRAGMENT = `
precision highp float;
uniform sampler2D uAtlas;
uniform vec4 uFaceColor;
uniform vec4 uOutlineColor;
uniform float uOutlineWidth;
uniform float uOutlineSoftness;
uniform float uRatioA;
uniform bool uUnderlay;
uniform vec4 uUnderlayColor;
uniform float uUnderlayDilate;
uniform float uUnderlaySoftness;
uniform float uRatioC;
uniform vec2 uUnderlayOffset;
uniform vec2 uTextureSize;
uniform float uGradientScale;
varying vec2 vUv;
varying vec4 vColor;
varying vec4 vSdf;
float atlas(vec2 uv) { return texture2D(uAtlas, vec2(uv.x, 1.0 - uv.y)).a; }
void main() {
  float alpha = atlas(vUv);
  if (!uUnderlay && alpha < vSdf.x) discard;
  float distance = vSdf.z - alpha;
  float outline = uOutlineWidth * uRatioA * vSdf.y;
  float softness = uOutlineSoftness * uRatioA * vSdf.y;
  vec4 face = uFaceColor; face.rgb *= vColor.rgb * face.a;
  vec4 edge = uOutlineColor; edge.rgb *= edge.a;
  float blend = sqrt(min(1.0, outline)) * clamp(distance * vSdf.y + outline * 0.5, 0.0, 1.0);
  vec4 color = mix(face, edge, blend);
  color *= 1.0 - clamp((distance * vSdf.y - outline * 0.5 + softness * 0.5) / (1.0 + softness), 0.0, 1.0);
  if (uUnderlay) {
    float underScale = vSdf.y / (1.0 + uUnderlaySoftness * uRatioC * vSdf.y);
    float underBias = (0.5 - vSdf.w) * underScale - 0.5 - uUnderlayDilate * uRatioC * underScale * 0.5;
    vec2 uv = vUv - uUnderlayOffset * uRatioC * uGradientScale / uTextureSize;
    float coverage = clamp(atlas(uv) * underScale - underBias, 0.0, 1.0);
    color += vec4(uUnderlayColor.rgb * uUnderlayColor.a, uUnderlayColor.a) * coverage * (1.0 - color.a);
  }
  gl_FragColor = color * vColor.a;
}`;
type Context = {
    canvas: HTMLCanvasElement;
    gl: WebGLRenderingContext;
    program: WebGLProgram;
    buffers: WebGLBuffer[];
    textures: Map<string, Promise<WebGLTexture>>;
};
let shared: Context | undefined;
function getContext() {
    if (shared && !shared.gl.isContextLost())
        return shared;
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true });
    if (!gl)
        throw new Error("Original TMP SDF renderer requires WebGL");
    const program = gl.createProgram();
    if (!program)
        throw new Error("TMP SDF program allocation failed");
    for (const [kind, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]] as const) {
        const shader = gl.createShader(kind)!;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
            throw new Error(gl.getShaderInfoLog(shader) || "TMP shader compile failed");
        gl.attachShader(program, shader);
        gl.deleteShader(shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(program) || "TMP shader link failed");
    const buffers = Array.from({ length: 6 }, () => gl.createBuffer()!);
    shared = { canvas, gl, program, buffers, textures: new Map() };
    return shared;
}
function loadTexture(context: Context, catalog: NativeTextCatalog, id: string) {
    let promise = context.textures.get(id);
    if (!promise) {
        promise = new Promise<WebGLTexture>((resolve, reject) => {
            const record = catalog.textures[id];
            if (!record) {
                reject(new Error(`Original TMP atlas missing: ${id}`));
                return;
            }
            const image = new Image(); image.crossOrigin = "anonymous";
            image.onload = () => {
                try {
                    const gl = context.gl, texture = gl.createTexture();
                    if (!texture)
                        throw new Error("TMP atlas allocation failed");
                    gl.bindTexture(gl.TEXTURE_2D, texture);
                    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
                    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
                    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                    const filter = record.filterMode === 0 ? gl.NEAREST : gl.LINEAR;
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
                    const wrap = record.wrapMode === 0 ? gl.REPEAT : gl.CLAMP_TO_EDGE;
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
                    resolve(texture);
                }
                catch (error) {
                    reject(error);
                }
            };
            image.onerror = () => reject(new Error(`Original TMP atlas load failed: ${record.png}`));
            image.src = deploymentUrl(record.png);
        });
        context.textures.set(id, promise);
    }
    return promise;
}
/** One GPU context for every TMP node. Texture loading finishes before this
 * synchronous draw-and-copy transaction, so async callers cannot interleave GL.
 * rect is the actual local Unity rectangle; meshes retain native Y-up vertices. */
export async function rasterSwordNativeText(target: HTMLCanvasElement, catalog: NativeTextCatalog, meshes: NativeTextMesh[], rect: readonly [
    number,
    number,
    number,
    number
], rasterWidth: number, rasterHeight: number, shouldRender: () => boolean = () => true) {
    const context = getContext(), { canvas, gl, program, buffers } = context;
    const textures = await Promise.all(meshes.map(mesh => loadTexture(context, catalog, catalog.materials[mesh.material].properties._MainTex as string)));
    if (!shouldRender())
        return;
    const max = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number;
    if (!(rasterWidth > 0 && rasterHeight > 0) || rasterWidth > max || rasterHeight > max)
        throw new Error("TMP raster exceeds GPU limits");
    canvas.width = rasterWidth;
    canvas.height = rasterHeight;
    gl.viewport(0, 0, rasterWidth, rasterHeight);
    gl.useProgram(program);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const uniform = (name: string) => gl.getUniformLocation(program, name);
    const n = (name: string, value: number) => gl.uniform1f(uniform(name), value);
    const v2 = (name: string, value: number[]) => gl.uniform2fv(uniform(name), value);
    const v4 = (name: string, value: number[]) => gl.uniform4fv(uniform(name), value);
    v4("uRect", [...rect]);
    v2("uDensity", [rasterWidth / rect[2], rasterHeight / rect[3]]);
    gl.uniform1i(uniform("uAtlas"), 0);
    meshes.forEach((mesh, meshIndex) => {
        const material = catalog.materials[mesh.material], p = material.properties;
        for (const [shader, source] of [["uGradientScale", "_GradientScale"], ["uSharpness", "_Sharpness"], ["uWeightNormal", "_WeightNormal"], ["uWeightBold", "_WeightBold"], ["uFaceDilate", "_FaceDilate"], ["uRatioA", "_ScaleRatioA"], ["uOutlineWidth", "_OutlineWidth"], ["uOutlineSoftness", "_OutlineSoftness"], ["uUnderlayDilate", "_UnderlayDilate"], ["uUnderlaySoftness", "_UnderlaySoftness"], ["uRatioC", "_ScaleRatioC"]])
            n(shader, p[source] as number);
        v2("uScaleXY", [p._ScaleX as number, p._ScaleY as number]);
        v2("uVertexOffset", [p._VertexOffsetX as number, p._VertexOffsetY as number]);
        v2("uTextureSize", [p._TextureWidth as number, p._TextureHeight as number]);
        v2("uUnderlayOffset", [p._UnderlayOffsetX as number, p._UnderlayOffsetY as number]);
        v4("uFaceColor", p._FaceColor as number[]);
        v4("uOutlineColor", p._OutlineColor as number[]);
        v4("uUnderlayColor", p._UnderlayColor as number[]);
        gl.uniform1i(uniform("uUnderlay"), material.keywords.includes("UNDERLAY_ON") ? 1 : 0);
        for (const [buffer, name, size, data] of [[0, "aPosition", 2, mesh.positions], [1, "aUv", 2, mesh.uv], [2, "aScale", 1, mesh.scales], [3, "aColor", 4, mesh.colors.map(value => value / 255)]] as const) {
            const attribute = gl.getAttribLocation(program, name);
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers[buffer]);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STREAM_DRAW);
            gl.enableVertexAttribArray(attribute);
            gl.vertexAttribPointer(attribute, size, gl.FLOAT, false, 0, 0);
        }
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers[4]);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.indices), gl.STREAM_DRAW);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textures[meshIndex]);
        gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
    });
    const error = gl.getError();
    if (error !== gl.NO_ERROR)
        throw new Error(`Original TMP shader GL error: ${error}`);
    target.width = rasterWidth;
    target.height = rasterHeight;
    const destination = target.getContext("2d");
    if (!destination)
        throw new Error("TMP raster copy requires Canvas2D");
    destination.clearRect(0, 0, rasterWidth, rasterHeight);
    destination.drawImage(canvas, 0, 0);
}
export function swordNativeTextScreenMatrix(element: HTMLElement) {
    let matrix = new DOMMatrix();
    for (let current: HTMLElement | null = element; current; current = current.parentElement) {
        const transform = getComputedStyle(current).transform;
        if (transform !== "none")
            matrix = new DOMMatrix(transform).multiply(matrix);
    }
    return matrix;
}
export function swordNativeTextDensity(element: HTMLElement) {
    const matrix = swordNativeTextScreenMatrix(element);
    const dpr = window.devicePixelRatio || 1;
    return [Math.hypot(matrix.a, matrix.b) * dpr, Math.hypot(matrix.c, matrix.d) * dpr];
}
