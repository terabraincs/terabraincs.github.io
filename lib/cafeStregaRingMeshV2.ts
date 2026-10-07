
import { deploymentUrl } from "@/lib/deployment";
/** Exact original NKC_FX_UI_MESH_RENDERER geometry and Cafe shader specialization.
 * Shader equations come from fresh DXBC programs 2/6, not visual fitting. */
import type { CafeMaterialValuesV2 } from "./cafeStregaFxmMaterialV2";
export type CafeRingMeshV2 = {
    positions: number[][];
    uv0: number[][];
    indices: number[];
};
export type CafeRingMaterialV2 = {
    name: string;
    shader: string;
    values: CafeMaterialValuesV2;
    textures: Record<string, {
        url: string;
        settings: {
            m_FilterMode: number;
            m_WrapU: number;
            m_WrapV: number;
        };
    }>;
};
export type CafeRingFrameV2 = {
    width: number;
    height: number;
    rectWidth: number;
    rectHeight: number;
    thickness: number;
    /** Row-major source local 3D -> full-stage CSS pixels (origin upper-left). */
    matrix: readonly number[];
    color: readonly number[];
    material: CafeMaterialValuesV2;
    enabled: boolean;
    /** Original Shader globals. Default runtime values are zero until assigned. */
    globalTransparency?: number;
    enemyTransparency?: number;
    isMine?: number;
};
const f32 = Math.fround;
export function cafeRingGeometryV2(mesh: CafeRingMeshV2, width: number, height: number, thickness: number) {
    // OnPopulateMesh: Vector3.Scale(sourceVertex,(rect.width,rect.height,m_Thickness)*scaleFactor).
    // Constructor scaleFactor=1; SetScaleFromPixelPerUnit is never called here.
    return { positions: mesh.positions.map(p => [f32(p[0] * width), f32(p[1] * height), f32(p[2] * thickness)]),
        uv0: mesh.uv0, indices: mesh.indices };
}
export function cafeRingAssertSpecializationV2(material: CafeRingMaterialV2, v: CafeMaterialValuesV2) {
    const distorted = material.shader === "StudioBside/FX/SB-FX-PMA-MainDs-Mask-Dissolve";
    if (!distorted && material.shader !== "StudioBside/FX/SB-FX-PMA-Main-Mask")
        throw new Error("Unknown Cafe ring shader");
    const fixed: Record<string, number> = { _UVMain: 0, _UVMask: 0, _MainTexAngle: 0, _MaskAngle: 0,
        _MainTexPivot: 0, _MaskPivot: 0, _MainTex_Scroll_X: 0, _MainTex_Scroll_Y: 0,
        _Mask_Scroll_X: 0, _Mask_Scroll_Y: 0, _MainTexChannel: 0, _MaskChannel: 0, _MaskRef: 1,
        _SrcBlend: 1, _DstBlend: 10, _Cull: 0, _ZWrite: 0 };
    if (distorted)
        Object.assign(fixed, { _UVMainDs: 0, _MainDsAngle: 0, _MainDsPivot: 0,
            _MainDs_Scroll_X: 0, _MainDs_Scroll_Y: 0, _MainDsChannel: 0, _DissolveAmount: 0,
            _SoftDissolve: 0, _EdgeOnly: 0, _DissolveEdgeBlend: 0 });
    for (const [key, value] of Object.entries(fixed))
        if (v[key] !== value)
            throw new Error(`Unaudited source ring shader branch ${key}`);
    return distorted;
}
const VERTEX = `attribute vec2 aPosition;attribute vec2 aUv;uniform vec2 uSize;varying vec2 vUv;
void main(){vUv=aUv;gl_Position=vec4(aPosition.x/uSize.x*2.-1.,1.-aPosition.y/uSize.y*2.,0.,1.);}`;
const FRAGMENT = `precision highp float;varying vec2 vUv;
uniform sampler2D uMain,uMask,uNoise;uniform vec4 uMainST,uMaskST,uNoiseST,uTint,uVertex,uMainColor;
uniform vec4 uFactors;uniform vec3 uDistortion;uniform float uDistorted,uFade;
vec4 readUnity(sampler2D t,vec2 uv){return texture2D(t,vec2(uv.x,1.-uv.y));}
void main(){
 vec2 uv=vUv*uMainST.xy+uMainST.zw;
 if(uDistorted>.5){float noise=clamp(readUnity(uNoise,vUv*uNoiseST.xy+uNoiseST.zw).r,0.,1.)*uDistortion.x;uv-=noise*uDistortion.yz;}
 vec4 main=mix(vec4(1.),readUnity(uMain,uv)*uMainColor,uFactors.z);
 vec4 mixed=mix(main,main*readUnity(uMask,vUv*uMaskST.xy+uMaskST.zw),uFactors.w);
 // MainDs-Mask-Dissolve's source Amount=0, SoftDissolve=0, EdgeOnly=0
 // makes the entire dissolve section identity, then explicitly premultiplies.
 // Main-Mask's DXBC does NOT perform that extra texture-alpha multiplication.
 if(uDistorted>.5)mixed.rgb*=mixed.a;
 vec4 tint=vec4(uTint.rgb*uTint.a*uFactors.x*uVertex.rgb*uVertex.a,uTint.a*uFactors.x*uFactors.y*uVertex.a);
 gl_FragColor=mixed*tint*uFade;
}`;
function compile(gl: WebGLRenderingContext, type: number, source: string) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(shader) ?? "Cafe ring shader compile failed");
    return shader;
}
/** Canvas must occupy the source sibling's drawing order but the full stage,
 * without clipping to the graphic's 100×100 layout rect. */
export async function createCafeRingRendererV2(canvas: HTMLCanvasElement, mesh: CafeRingMeshV2, material: CafeRingMaterialV2) {
    const distorted = cafeRingAssertSpecializationV2(material, material.values);
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: true, preserveDrawingBuffer: true });
    if (!gl)
        throw new Error("Cafe source ring requires WebGL");
    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX), fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT), program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(program) ?? "Cafe ring link failed");
    const buffers = [gl.createBuffer()!, gl.createBuffer()!];
    const names = distorted ? ["_MainTex", "_Mask", "_MainDs"] : ["_MainTex", "_Mask"];
    const textures = await Promise.all(names.map(async (name) => {
        const source = material.textures[name];
        if (!source || source.settings.m_FilterMode !== 1 || source.settings.m_WrapU !== 0 || source.settings.m_WrapV !== 0)
            throw new Error("Unaudited source ring texture sampler");
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const i = new Image(); i.crossOrigin = "anonymous";
            i.onload = () => resolve(i);
            i.onerror = () => reject(new Error(`Original Cafe ring texture failed: ${source.url}`));
            i.src = deploymentUrl(source.url);
        });
        const texture = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        return texture;
    }));
    const location = (key: string) => gl.getUniformLocation(program, key);
    const pos = gl.getAttribLocation(program, "aPosition"), uv = gl.getAttribLocation(program, "aUv");
    return {
        render(frame: CafeRingFrameV2) {
            const dpr = window.devicePixelRatio || 1, w = Math.round(frame.width * dpr), h = Math.round(frame.height * dpr);
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
            }
            gl.viewport(0, 0, w, h);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            if (!frame.enabled)
                return;
            cafeRingAssertSpecializationV2(material, frame.material);
            if (frame.matrix.length !== 16)
                throw new Error("Ring needs original full 4x4 source transform");
            const geometry = cafeRingGeometryV2(mesh, frame.rectWidth, frame.rectHeight, frame.thickness), vertices = new Float32Array(geometry.positions.length * 4), m = frame.matrix;
            geometry.positions.forEach((p, i) => { vertices.set([m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3], m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7], geometry.uv0[i][0], geometry.uv0[i][1]], i * 4); });
            gl.useProgram(program);
            gl.disable(gl.DEPTH_TEST);
            gl.disable(gl.CULL_FACE);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers[0]);
            gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(pos);
            gl.enableVertexAttribArray(uv);
            gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 16, 0);
            gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 16, 8);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers[1]);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geometry.indices), gl.STATIC_DRAW);
            textures.forEach((t, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(location(["uMain", "uMask", "uNoise"][i]), i); });
            // Even a dynamically unused sampler must not alias a different texture type.
            if (!distorted)
                gl.uniform1i(location("uNoise"), 0);
            const v = frame.material, n = (k: string) => { const a = v[k]; if (typeof a !== "number")
                throw new Error(`Missing source scalar ${k}`); return a; };
            const vector = (k: string) => { const a = v[k]; if (!Array.isArray(a) || a.length !== 4)
                throw new Error(`Missing source vector ${k}`); return a; };
            gl.uniform2f(location("uSize"), frame.width, frame.height);
            gl.uniform4fv(location("uMainST"), vector("_MainTex_ST"));
            gl.uniform4fv(location("uMaskST"), vector("_Mask_ST"));
            gl.uniform4fv(location("uNoiseST"), distorted ? vector("_MainDs_ST") : [1, 1, 0, 0]);
            gl.uniform4fv(location("uTint"), vector("_TintColor"));
            gl.uniform4fv(location("uVertex"), [...frame.color]);
            gl.uniform4fv(location("uMainColor"), vector("_MainTexColor"));
            gl.uniform4f(location("uFactors"), n("_Intensity"), n("_BlendFactor"), n("_MainTexAmount"), n("_MaskAmount"));
            gl.uniform3f(location("uDistortion"), distorted ? n("_MainDsAmount") : 0, distorted ? n("_MainDsU") : 0, distorted ? n("_MainDsV") : 0);
            gl.uniform1f(location("uDistorted"), distorted ? 1 : 0);
            const enemy = frame.enemyTransparency ?? 0, own = frame.globalTransparency ?? 0;
            gl.uniform1f(location("uFade"), 1 - (1 - n("_BypassFGO")) * (enemy + (own - enemy) * (frame.isMine ?? 0)));
            gl.drawElements(gl.TRIANGLES, geometry.indices.length, gl.UNSIGNED_SHORT, 0);
        },
        dispose() { textures.forEach(t => gl.deleteTexture(t)); buffers.forEach(b => gl.deleteBuffer(b)); gl.deleteProgram(program); gl.deleteShader(vs); gl.deleteShader(fs); },
    };
}
