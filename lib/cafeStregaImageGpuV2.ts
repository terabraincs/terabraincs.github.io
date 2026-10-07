
import { deploymentUrl } from "@/lib/deployment";
import type { SwordTrainingPmaMesh } from '../components/minigames/sword-training/SwordTrainingPmaMeshes';
import { swordTrainingColor32 } from './swordTrainingClientPma';
let pool: ReturnType<typeof createPool> | undefined;
const images = new Map<string, Promise<HTMLImageElement>>();
export function cafeGpuImageV2(url: string) {
    let value = images.get(url);
    if (!value) {
        value = new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.crossOrigin = "anonymous"; image.onload = () => resolve(image); image.onerror = () => reject(new Error(`Original Cafe image load failed: ${url}`)); image.src = deploymentUrl(url); });
        images.set(url, value);
    }
    return value;
}
function createPool() {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true, preserveDrawingBuffer: true });
    if (!gl)
        throw new Error('Cafe original UI shader requires WebGL');
    const vertex = 'attribute vec2 aPosition;attribute vec2 aUv;uniform vec2 uSize;varying vec2 vUv;void main(){vUv=aUv;gl_Position=vec4(aPosition.x/uSize.x*2.-1.,1.-aPosition.y/uSize.y*2.,0.,1.);}';
    const fragment = `precision highp float;varying vec2 vUv;uniform sampler2D uTexture;uniform vec4 uColor,uParticleTint;uniform vec2 uParticleCustom;uniform float uMode,uFactor;
    void main(){vec4 s=texture2D(uTexture,vUv)*uColor;
    if(uMode<.5)gl_FragColor=vec4(s.rgb*s.a,s.a);
    else if(uMode<1.5){s*=uFactor;gl_FragColor=vec4(s.rgb*clamp(s.a,0.,1.),0.);}
    else if(uMode<2.5)gl_FragColor=vec4(s.rgb*2.,0.);
    else gl_FragColor=vec4(s.rgb*uParticleTint.rgb*uColor.a*uParticleCustom.x,0.);}`;
    const particleVertex = 'attribute vec2 aPosition;attribute vec2 aUv;attribute vec4 aColor;attribute vec2 aParticleCustom;uniform vec2 uSize;varying vec2 vUv;varying vec4 vColor;varying vec2 vParticleCustom;void main(){vUv=aUv;vColor=aColor;vParticleCustom=aParticleCustom;gl_Position=vec4(aPosition.x/uSize.x*2.-1.,1.-aPosition.y/uSize.y*2.,0.,1.);}';
    const particleFragment = 'precision highp float;varying vec2 vUv;varying vec4 vColor;varying vec2 vParticleCustom;uniform sampler2D uTexture;uniform vec4 uParticleTint;void main(){vec4 s=texture2D(uTexture,vUv)*vColor;gl_FragColor=vec4(s.rgb*uParticleTint.rgb*vColor.a*vParticleCustom.x,0.);}';
    const compileProgram = (vertexSource: string, fragmentSource: string) => { const value = gl.createProgram()!; for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]] as const) {
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
            throw new Error(gl.getShaderInfoLog(shader) || 'Cafe GPU compile');
        gl.attachShader(value, shader);
        gl.deleteShader(shader);
    } gl.linkProgram(value); if (!gl.getProgramParameter(value, gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(value) || 'Cafe GPU link'); return value; };
    const program = compileProgram(vertex, fragment), particleProgram = compileProgram(particleVertex, particleFragment);
    const buffers = [gl.createBuffer()!, gl.createBuffer()!, gl.createBuffer()!];
    const particleBuffers = [gl.createBuffer()!, gl.createBuffer()!, gl.createBuffer()!, gl.createBuffer()!, gl.createBuffer()!];
    const textures = new Map<string, WebGLTexture>();
    const maximum = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number;
    const locations = {
        position: gl.getAttribLocation(program, 'aPosition'), uv: gl.getAttribLocation(program, 'aUv'),
        texture: gl.getUniformLocation(program, 'uTexture'), size: gl.getUniformLocation(program, 'uSize'),
        color: gl.getUniformLocation(program, 'uColor'), mode: gl.getUniformLocation(program, 'uMode'),
        particleCustom: gl.getUniformLocation(program, 'uParticleCustom'), particleTint: gl.getUniformLocation(program, 'uParticleTint'),
        factor: gl.getUniformLocation(program, 'uFactor'),
    };
    const particleLocations = {
        position: gl.getAttribLocation(particleProgram, 'aPosition'), uv: gl.getAttribLocation(particleProgram, 'aUv'),
        color: gl.getAttribLocation(particleProgram, 'aColor'), custom: gl.getAttribLocation(particleProgram, 'aParticleCustom'),
        texture: gl.getUniformLocation(particleProgram, 'uTexture'), size: gl.getUniformLocation(particleProgram, 'uSize'),
        tint: gl.getUniformLocation(particleProgram, 'uParticleTint'),
    };
    return { canvas, gl, program, particleProgram, buffers, particleBuffers, textures, maximum, locations, particleLocations,
        rasterWidth: 1, rasterHeight: 1,
        particlePositions: new Float32Array(0), particleUvs: new Float32Array(0), particleColors: new Float32Array(0),
        particleCustoms: new Float32Array(0), particleIndices: new Uint16Array(0),
        floats: new WeakMap<object, Float32Array>(), indices: new WeakMap<object, Uint16Array>(),
        positionBuffers: new Map<object, WebGLBuffer>(), uvBuffers: new Map<object, WebGLBuffer>(), indexBuffers: new Map<object, WebGLBuffer>() };
}
type Pool = ReturnType<typeof createPool>;
type LastDraw = {
    source: HTMLImageElement;
    positions: readonly number[];
    uvs: readonly number[];
    indices: readonly number[];
    texture: string;
    width: number;
    height: number;
    rasterWidth: number;
    rasterHeight: number;
    color: readonly number[];
    particleCustom?: readonly number[];
    particleTint?: readonly number[];
    sourceStraightAlpha: boolean;
    sourceAlphaAdditive: boolean;
    sourceAlphaAdditiveMultiplier: number;
};
const lastDraws = new WeakMap<HTMLCanvasElement, LastDraw>();
const transformScales = new WeakMap<HTMLCanvasElement, {
    signature: string;
    x: number;
    y: number;
}>();
const ZERO2: readonly number[] = [0, 0], ONE4: readonly number[] = [1, 1, 1, 1];
// The source geometry catalog itself is capped at 256 entries. Match that
// working set so entry/create transitions cannot churn live GPU buffers while
// still keeping resize-created resources strictly bounded.
const STATIC_BUFFER_CACHE_LIMIT = 256;
const equal = (left: readonly number[] | undefined, right: readonly number[] | undefined) => left === right || Boolean(left && right && left.length === right.length && left.every((value, index) => value === right[index]));
function rasterDimensions(p: Pool, target: HTMLCanvasElement, width: number, height: number) {
    const cafeRoot = target.closest<HTMLElement>('[data-cafe-rebuild="v2"]'), transforms: string[] = [];
    for (let node: HTMLElement | null = target; node; node = node.parentElement) {
        const inline = node.style.transform;
        const directlyUsable = inline && inline !== 'none' && !inline.includes('var(') && !inline.includes('calc(');
        const transform = directlyUsable ? inline : inline && inline !== 'none' ? getComputedStyle(node).transform : cafeRoot ? 'none' : getComputedStyle(node).transform;
        if (transform !== 'none')
            transforms.push(transform);
        if (node === cafeRoot)
            break;
    }
    const signature = transforms.join('\u0000');
    let transformScale = transformScales.get(target);
    if (!transformScale || transformScale.signature !== signature) {
        let matrix = new DOMMatrixReadOnly();
        for (const transform of transforms)
            matrix = new DOMMatrixReadOnly(transform).multiply(matrix);
        transformScale = { signature, x: Math.hypot(matrix.m11, matrix.m12), y: Math.hypot(matrix.m21, matrix.m22) };
        transformScales.set(target, transformScale);
    }
    const scale = window.devicePixelRatio || 1, requestedW = Math.ceil(width * transformScale.x * scale), requestedH = Math.ceil(height * transformScale.y * scale);
    const fit = Math.min(1, p.maximum / Math.max(1, requestedW), p.maximum / Math.max(1, requestedH));
    return [Math.max(1, Math.floor(requestedW * fit)), Math.max(1, Math.floor(requestedH * fit))] as const;
}
function prepareRaster(p: Pool, width: number, height: number, clear: boolean) {
    const { canvas, gl } = p, nextWidth = Math.max(canvas.width, width), nextHeight = Math.max(canvas.height, height);
    if (canvas.width !== nextWidth)
        canvas.width = nextWidth;
    if (canvas.height !== nextHeight)
        canvas.height = nextHeight;
    p.rasterWidth = width;
    p.rasterHeight = height;
    const bottom = canvas.height - height;
    gl.viewport(0, bottom, width, height);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0, bottom, width, height);
    if (clear) {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }
}
function floatCapacity(value: Float32Array<ArrayBuffer>, length: number): Float32Array<ArrayBuffer> { if (value.length >= length)
    return value; let size = Math.max(16, value.length); while (size < length)
    size *= 2; return new Float32Array(size); }
function indexCapacity(value: Uint16Array<ArrayBuffer>, length: number): Uint16Array<ArrayBuffer> { if (value.length >= length)
    return value; let size = Math.max(16, value.length); while (size < length)
    size *= 2; return new Uint16Array(size); }
function floatData(p: Pool, values: readonly number[]) { let typed = p.floats.get(values as object); if (!typed) {
    typed = new Float32Array(values);
    p.floats.set(values as object, typed);
} return typed; }
function indexData(p: Pool, values: readonly number[]) { let typed = p.indices.get(values as object); if (!typed) {
    typed = new Uint16Array(values);
    p.indices.set(values as object, typed);
} return typed; }
function bindGeometry(p: Pool, target: number, values: readonly number[], cache: Map<object, WebGLBuffer>, index = false) {
    const { gl } = p;
    const key = values as object;
    if (!index) {
        let buffer = cache.get(key);
        if (!buffer) {
            buffer = gl.createBuffer()!;
            cache.set(key, buffer);
            gl.bindBuffer(target, buffer);
            gl.bufferData(target, floatData(p, values), gl.STATIC_DRAW);
        }
        else
            gl.bindBuffer(target, buffer);
    }
    else {
        let buffer = cache.get(key);
        if (!buffer) {
            buffer = gl.createBuffer()!;
            cache.set(key, buffer);
            gl.bindBuffer(target, buffer);
            gl.bufferData(target, indexData(p, values), gl.STATIC_DRAW);
        }
        else
            gl.bindBuffer(target, buffer);
    }
    if (cache.size > STATIC_BUFFER_CACHE_LIMIT) {
        const oldest = cache.entries().next().value;
        if (oldest) {
            cache.delete(oldest[0]);
            gl.deleteBuffer(oldest[1]);
        }
    }
}
function sameDraw(previous: LastDraw | undefined, source: HTMLImageElement, mesh: SwordTrainingPmaMesh, width: number, height: number, w: number, h: number, target: HTMLCanvasElement) {
    return Boolean(previous && previous.source === source && previous.positions === mesh.positions && previous.uvs === mesh.uvs && previous.indices === mesh.indices
        && previous.texture === mesh.texture && previous.width === width && previous.height === height && previous.rasterWidth === w && previous.rasterHeight === h
        && target.width === w && target.height === h && equal(previous.color, mesh.color) && equal(previous.particleCustom, mesh.particleCustom)
        && equal(previous.particleTint, mesh.particleTint) && previous.sourceStraightAlpha === Boolean(mesh.sourceStraightAlpha)
        && previous.sourceAlphaAdditive === Boolean(mesh.sourceAlphaAdditive)
        && previous.sourceAlphaAdditiveMultiplier === (mesh.sourceAlphaAdditiveMultiplier ?? 1));
}
/** Shared native-equation GPU rasterizer. Original PMA RGB/alpha0 survives the
 * GPU-to-2D drawImage transfer and normal browser composition, verified in 24
 * direct-GL comparisons including nested opacity (every RGB pixel identical).
 * Do not replace this with opaque RGB/plus-lighter: parent isolation changes it.
 * Mixed-alpha PMA images keep their original direct WebGL path. */
export function drawCafeImageGpuV2(target: HTMLCanvasElement, source: HTMLImageElement, mesh: SwordTrainingPmaMesh, width: number, height: number, append = false, present = true, staticGeometry = true) {
    const p = pool ??= createPool(), { gl } = p;
    if (!(width > 0 && height > 0))
        return;
    if (!mesh.sourceStraightAlpha && !mesh.sourceAlphaAdditive && !mesh.particleCustom && mesh.color[3] !== 0)
        throw new Error('Mixed PMA must use direct original blend');
    if (mesh.particleCustom && mesh.particleCustom[1] !== 0)
        throw new Error('Nonadditive particle needs original mixed-alpha blend');
    let w = p.rasterWidth, h = p.rasterHeight;
    if (!append)
        [w, h] = rasterDimensions(p, target, width, height);
    if (staticGeometry && !append && present && sameDraw(lastDraws.get(target), source, mesh, width, height, w, h, target))
        return;
    if (!append)
        prepareRaster(p, w, h, true);
    if (mesh.particleCustom || mesh.sourceAlphaAdditive) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
    }
    else
        gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(p.program);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    let texture = p.textures.get(mesh.texture);
    if (!texture) {
        texture = gl.createTexture()!;
        p.textures.set(mesh.texture, texture);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    else
        gl.bindTexture(gl.TEXTURE_2D, texture);
    for (const [i, attribute, values, cache] of [[0, p.locations.position, mesh.positions, p.positionBuffers], [1, p.locations.uv, mesh.uvs, p.uvBuffers]] as const) {
        if (staticGeometry)
            bindGeometry(p, gl.ARRAY_BUFFER, values, cache);
        else {
            gl.bindBuffer(gl.ARRAY_BUFFER, p.buffers[i]);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.DYNAMIC_DRAW);
        }
        gl.enableVertexAttribArray(attribute);
        gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
    }
    if (staticGeometry)
        bindGeometry(p, gl.ELEMENT_ARRAY_BUFFER, mesh.indices, p.indexBuffers, true);
    else {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, p.buffers[2]);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.indices), gl.DYNAMIC_DRAW);
    }
    gl.uniform1i(p.locations.texture, 0);
    gl.uniform2f(p.locations.size, width, height);
    gl.uniform4fv(p.locations.color, swordTrainingColor32(mesh.color));
    gl.uniform1f(p.locations.mode, mesh.particleCustom ? 3 : mesh.sourceStraightAlpha ? 0 : mesh.sourceAlphaAdditive ? 1 : 2);
    gl.uniform2fv(p.locations.particleCustom, mesh.particleCustom ?? ZERO2);
    gl.uniform4fv(p.locations.particleTint, mesh.particleTint ?? ONE4);
    gl.uniform1f(p.locations.factor, mesh.sourceAlphaAdditiveMultiplier ?? 1);
    gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
    if (!present)
        return;
    if (target.width !== w)
        target.width = w;
    if (target.height !== h)
        target.height = h;
    const context = target.getContext('2d')!;
    context.globalCompositeOperation = 'copy';
    context.drawImage(p.canvas, 0, 0, w, h, 0, 0, w, h);
    context.globalCompositeOperation = 'source-over';
    if (staticGeometry && !append)
        lastDraws.set(target, { source, positions: mesh.positions, uvs: mesh.uvs, indices: mesh.indices, texture: mesh.texture, width, height,
            rasterWidth: w, rasterHeight: h, color: [...mesh.color], particleCustom: mesh.particleCustom ? [...mesh.particleCustom] : undefined,
            particleTint: mesh.particleTint ? [...mesh.particleTint] : undefined, sourceStraightAlpha: Boolean(mesh.sourceStraightAlpha),
            sourceAlphaAdditive: Boolean(mesh.sourceAlphaAdditive), sourceAlphaAdditiveMultiplier: mesh.sourceAlphaAdditiveMultiplier ?? 1 });
    else
        lastDraws.delete(target);
}
export function drawCafeParticleGpuV2(target: HTMLCanvasElement, source: HTMLImageElement, meshes: readonly SwordTrainingPmaMesh[], width: number, height: number) {
    if (!meshes.length) {
        target.getContext('2d')!.clearRect(0, 0, target.width, target.height);
        lastDraws.delete(target);
        return;
    }
    const first = meshes[0], tint = first.particleTint ?? ONE4;
    let vertexCount = 0, indexCount = 0;
    const compatible = meshes.every(mesh => {
        const vertices = mesh.positions.length / 2;
        const valid = Boolean(mesh.particleCustom && mesh.particleCustom[1] === 0 && !mesh.sourceStraightAlpha && !mesh.sourceAlphaAdditive
            && mesh.texture === first.texture && equal(mesh.particleTint ?? ONE4, tint) && mesh.positions.length % 2 === 0 && mesh.uvs.length === mesh.positions.length
            && mesh.color.length === 4 && mesh.particleCustom?.length === 2 && mesh.indices.every(index => Number.isInteger(index) && index >= 0 && index < vertices));
        vertexCount += vertices;
        indexCount += mesh.indices.length;
        return valid;
    }) && vertexCount <= 65535;
    if (!compatible) {
        meshes.forEach((mesh, index) => drawCafeImageGpuV2(target, source, mesh, width, height, index > 0, index === meshes.length - 1, false));
        return;
    }
    const p = pool ??= createPool(), { gl } = p, [w, h] = rasterDimensions(p, target, width, height);
    p.particlePositions = floatCapacity(p.particlePositions, vertexCount * 2);
    p.particleUvs = floatCapacity(p.particleUvs, vertexCount * 2);
    p.particleColors = floatCapacity(p.particleColors, vertexCount * 4);
    p.particleCustoms = floatCapacity(p.particleCustoms, vertexCount * 2);
    p.particleIndices = indexCapacity(p.particleIndices, indexCount);
    let vertexOffset = 0, indexOffset = 0;
    for (const mesh of meshes) {
        const vertices = mesh.positions.length / 2, color = swordTrainingColor32(mesh.color), custom = mesh.particleCustom!;
        p.particlePositions.set(mesh.positions, vertexOffset * 2);
        p.particleUvs.set(mesh.uvs, vertexOffset * 2);
        for (let vertex = 0; vertex < vertices; vertex++) {
            p.particleColors.set(color, (vertexOffset + vertex) * 4);
            p.particleCustoms.set(custom, (vertexOffset + vertex) * 2);
        }
        for (let index = 0; index < mesh.indices.length; index++)
            p.particleIndices[indexOffset + index] = mesh.indices[index] + vertexOffset;
        vertexOffset += vertices;
        indexOffset += mesh.indices.length;
    }
    prepareRaster(p, w, h, true);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(p.particleProgram);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    let texture = p.textures.get(first.texture);
    if (!texture) {
        texture = gl.createTexture()!;
        p.textures.set(first.texture, texture);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    else
        gl.bindTexture(gl.TEXTURE_2D, texture);
    for (const [buffer, attribute, values, size, length] of [
        [p.particleBuffers[0], p.particleLocations.position, p.particlePositions, 2, vertexCount * 2],
        [p.particleBuffers[1], p.particleLocations.uv, p.particleUvs, 2, vertexCount * 2],
        [p.particleBuffers[3], p.particleLocations.color, p.particleColors, 4, vertexCount * 4],
        [p.particleBuffers[4], p.particleLocations.custom, p.particleCustoms, 2, vertexCount * 2],
    ] as const) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, values.subarray(0, length), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(attribute);
        gl.vertexAttribPointer(attribute, size, gl.FLOAT, false, 0, 0);
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, p.particleBuffers[2]);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, p.particleIndices.subarray(0, indexCount), gl.DYNAMIC_DRAW);
    gl.uniform1i(p.particleLocations.texture, 0);
    gl.uniform2f(p.particleLocations.size, width, height);
    gl.uniform4fv(p.particleLocations.tint, tint);
    gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
    if (target.width !== w)
        target.width = w;
    if (target.height !== h)
        target.height = h;
    const context = target.getContext('2d')!;
    context.globalCompositeOperation = 'copy';
    context.drawImage(p.canvas, 0, 0, w, h, 0, 0, w, h);
    context.globalCompositeOperation = 'source-over';
    lastDraws.delete(target);
}
