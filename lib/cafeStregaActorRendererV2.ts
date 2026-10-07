import { deploymentUrl } from "@/lib/deployment";
/** Fresh Cafe actor renderer. Source prefab transforms are supplied by the caller.
 * No bounds fitting, bitmap animation, old Cafe code, or guessed positions.
 * SkeletonGraphic2Pass: source depth-only alpha >= .95 pass, then PMA color pass.
 */
import type { Skeleton, AnimationState, SkeletonData } from "@pixi-spine/runtime-3.7";
export type CafeActorKindV2 = "evelyn" | "yoo-na" | "mission";
export type CafeActorFrameV2 = {
    animation: string;
    time: number;
    /** Change this to restart the same requested animation. */
    animationKey?: number | string;
    loop: boolean;
    /** Original NPC SetAnimation queues default IDLE after the non-looping track. */
    queueIdle?: boolean;
    /** Source SkeletonGraphic local UI-space -> full-stage CSS-space affine matrix. */
    matrix: readonly [
        number,
        number,
        number,
        number,
        number,
        number
    ];
    alpha: number;
    width: number;
    height: number;
};
type Runtime = {
    pixi: typeof import("pixi.js");
    base: typeof import("@pixi-spine/base");
    spine: typeof import("@pixi-spine/runtime-3.7");
};
type SourceActor = {
    model: string;
    skeletonScale: number;
    defaultMix: number;
    graphic: {
        initialSkinName: string;
        initialFlipX: number;
        initialFlipY: number;
    };
};
type Source = {
    runtime: Runtime;
    data: SkeletonData;
    actor: SourceActor;
    image: HTMLImageElement;
};
type Mesh = {
    vertices: Float32Array;
    triangles: Uint16Array;
    color: Float32Array;
    depth: number;
    clip: Float32Array | null;
};
type DrawableAttachment = import("@pixi-spine/runtime-3.7").RegionAttachment | import("@pixi-spine/runtime-3.7").MeshAttachment;
type AttachmentWork = {
    world: Float32Array;
    packed: Float32Array;
    triangles: Uint16Array;
    color: Float32Array;
};
type ClipWork = {
    world: Float32Array;
    transformed: Float32Array;
    maskVertices: Float32Array;
    maskIndices: Uint16Array;
};
const PREFIX = deploymentUrl("/game-assets/cafe-strega/client-source-v2");
const sourceCache = new Map<CafeActorKindV2, Promise<Source>>();
let runtimePromise: Promise<Runtime> | undefined;
/** Pixi's AtlasAttachmentLoader deliberately does not populate Unity-style UVs.
 * Its MeshAttachment has regionUVs only and its RegionAttachment offset starts
 * at zero: normal Pixi rendering supplies these through Sprite/TextureMatrix.
 * This custom renderer must initialize the same data explicitly.
 */
export function prepareCafeAttachmentV2(attachment: DrawableAttachment, r: Runtime): Float32Array {
    const region = attachment.region;
    if (!region?.texture)
        throw new Error(`Original actor atlas region missing: ${attachment.name}`);
    region.texture.updateUvs();
    if (attachment instanceof r.spine.RegionAttachment) {
        attachment.updateOffset();
        const uv = region.texture._uvs;
        // Pixi computeWorldVertices order BL,UL,UR,BR. TextureUvs order UL,UR,BR,BL
        // already includes the source atlas rotation. Do not call setRegion with
        // TextureRegion.u/v: those are rotated corner values, not atlas min/max.
        return new Float32Array([uv.x3, uv.y3, uv.x0, uv.y0, uv.x1, uv.y1, uv.x2, uv.y2]);
    }
    const matrix = new r.pixi.TextureMatrix(region.texture, 0);
    matrix.update(true);
    // Original Spine.MeshAttachment.UpdateUVs maps untrimmed regionUVs through
    // region offset/original size/atlas rotation. Pixi TextureMatrix is the same
    // affine map; this does not change world vertex or triangle ordering.
    return matrix.multiplyUvs(attachment.regionUVs, new Float32Array(attachment.regionUVs.length));
}
function runtime() {
    return runtimePromise ??= Promise.all([import("pixi.js"), import("@pixi-spine/base"), import("@pixi-spine/runtime-3.7")])
        .then(([pixi, base, spine]) => ({ pixi, base, spine }));
}
async function text(url: string) {
    const response = await fetch(deploymentUrl(url));
    if (!response.ok)
        throw new Error(`Original Cafe asset ${response.status}: ${url}`);
    return response.text();
}
async function source(kind: CafeActorKindV2): Promise<Source> {
    if (!sourceCache.has(kind))
        sourceCache.set(kind, (async () => {
            const [r, manifest] = await Promise.all([runtime(), text(`${PREFIX}/spine.json`)]);
            const actor = (JSON.parse(manifest) as {
                actors: Record<CafeActorKindV2, SourceActor>;
            }).actors[kind];
            if (!actor)
                throw new Error(`Unknown source Cafe actor ${kind}`);
            const path = `${PREFIX}/spine/${kind}/${actor.model}`;
            const [json, atlasText, image] = await Promise.all([text(path + ".json"), text(path + ".atlas"), new Promise<HTMLImageElement>((resolve, reject) => {
                    const image = new Image(); image.crossOrigin = "anonymous";
                    image.onload = () => resolve(image);
                    image.onerror = () => reject(new Error(`Cafe atlas failed: ${path}`));
                    image.src = deploymentUrl(path + ".png");
                })]);
            const texture = new r.pixi.BaseTexture(image, { alphaMode: r.pixi.ALPHA_MODES.PMA, scaleMode: r.pixi.SCALE_MODES.LINEAR, mipmap: r.pixi.MIPMAP_MODES.OFF });
            const atlas = await new Promise<import("@pixi-spine/base").TextureAtlas>((resolve, reject) => {
                try {
                    new r.base.TextureAtlas(atlasText, (_name, callback) => callback(texture), resolve);
                }
                catch (error) {
                    reject(error);
                }
            });
            if (atlas.pages.length !== 1)
                throw new Error("Cafe source actor atlas no longer has exactly one page");
            const parser = new r.spine.SkeletonJson(new r.spine.AtlasAttachmentLoader(atlas));
            parser.scale = actor.skeletonScale;
            return { runtime: r, data: parser.readSkeletonData(JSON.parse(json)), actor, image };
        })());
    return sourceCache.get(kind)!;
}
function compile(gl: WebGLRenderingContext, type: number, code: string) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, code);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(shader) ?? "Cafe shader compile failed");
    return shader;
}
const VERTEX = `attribute vec2 aPosition; attribute vec2 aUv;
uniform vec2 uSize; uniform float uDepth; varying vec2 vUv;
void main(){vUv=aUv;gl_Position=vec4(aPosition.x/uSize.x*2.-1.,1.-aPosition.y/uSize.y*2.,uDepth,1.);}`;
const FRAGMENT = `precision highp float; uniform sampler2D uTexture; uniform vec4 uColor; uniform int uPass; varying vec2 vUv;
void main(){
 if(uPass==2){gl_FragColor=vec4(0.);return;}
 vec4 tex=texture2D(uTexture,vUv);
 if(uPass==0){if(tex.a<0.95)discard;gl_FragColor=vec4(0.);return;}
 gl_FragColor=tex*uColor;
}`;
/** Independent full-stage canvas at the exact source hierarchy sibling position. */
export async function createCafeActorRendererV2(canvas: HTMLCanvasElement, kind: CafeActorKindV2) {
    const loaded = await source(kind);
    const { spine: r, base } = loaded.runtime;
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: true, stencil: true, depth: true, preserveDrawingBuffer: true });
    if (!gl)
        throw new Error("WebGL depth/stencil is required for original Cafe Spine rendering");
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX), fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram()!;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(program) ?? "Cafe actor shader link failed");
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, loaded.image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const pos = gl.getAttribLocation(program, "aPosition"), uv = gl.getAttribLocation(program, "aUv");
    const size = gl.getUniformLocation(program, "uSize"), depth = gl.getUniformLocation(program, "uDepth"), tint = gl.getUniformLocation(program, "uColor"), pass = gl.getUniformLocation(program, "uPass"), sampler = gl.getUniformLocation(program, "uTexture");
    let skeleton: Skeleton, state: AnimationState;
    const attachmentUvs = new WeakMap<DrawableAttachment, Float32Array>();
    const attachmentWork = new WeakMap<DrawableAttachment, AttachmentWork>();
    const clipWork = new WeakMap<object, ClipWork>();
    const clipByTransformed = new WeakMap<Float32Array, ClipWork>();
    type GpuMeshWork = {
        vertices: WebGLBuffer;
        triangles: WebGLBuffer;
        indices: Uint16Array;
        uploadedFrame: number;
    };
    const gpuMeshWork = new WeakMap<Float32Array, GpuMeshWork>(), gpuBuffers = new Set<WebGLBuffer>();
    let lastKey = "", lastTime = 0, disposed = false, renderFrame = 0;
    const reset = () => {
        skeleton = new r.Skeleton(loaded.data);
        if (loaded.actor.graphic.initialSkinName)
            skeleton.setSkinByName(loaded.actor.graphic.initialSkinName);
        skeleton.setToSetupPose();
        skeleton.scaleX = loaded.actor.graphic.initialFlipX ? -1 : 1;
        skeleton.scaleY = loaded.actor.graphic.initialFlipY ? -1 : 1;
        const stateData = new r.AnimationStateData(loaded.data);
        stateData.defaultMix = loaded.actor.defaultMix;
        state = new r.AnimationState(stateData);
        lastKey = "";
        lastTime = 0;
    };
    reset();
    function upload(data: Float32Array, indices: Uint16Array) {
        let work = gpuMeshWork.get(data);
        if (!work) {
            const vertexBuffer = gl!.createBuffer()!, indexBuffer = gl!.createBuffer()!;
            gpuBuffers.add(vertexBuffer);
            gpuBuffers.add(indexBuffer);
            gl!.bindBuffer(gl!.ARRAY_BUFFER, vertexBuffer);
            gl!.bufferData(gl!.ARRAY_BUFFER, data.byteLength, gl!.DYNAMIC_DRAW);
            gl!.bindBuffer(gl!.ELEMENT_ARRAY_BUFFER, indexBuffer);
            gl!.bufferData(gl!.ELEMENT_ARRAY_BUFFER, indices, gl!.STATIC_DRAW);
            work = { vertices: vertexBuffer, triangles: indexBuffer, indices, uploadedFrame: -1 };
            gpuMeshWork.set(data, work);
        }
        gl!.bindBuffer(gl!.ARRAY_BUFFER, work.vertices);
        if (work.uploadedFrame !== renderFrame) {
            gl!.bufferSubData(gl!.ARRAY_BUFFER, 0, data);
            work.uploadedFrame = renderFrame;
        }
        gl!.vertexAttribPointer(pos, 2, gl!.FLOAT, false, 16, 0);
        gl!.vertexAttribPointer(uv, 2, gl!.FLOAT, false, 16, 8);
        gl!.bindBuffer(gl!.ELEMENT_ARRAY_BUFFER, work.triangles);
        if (work.indices !== indices) {
            gl!.bufferData(gl!.ELEMENT_ARRAY_BUFFER, indices, gl!.STATIC_DRAW);
            work.indices = indices;
        }
        gl!.drawElements(gl!.TRIANGLES, indices.length, gl!.UNSIGNED_SHORT, 0);
    }
    function render(frame: CafeActorFrameV2) {
        if (disposed)
            return;
        renderFrame++;
        if (!Number.isFinite(frame.time) || frame.time < 0 || frame.width <= 0 || frame.height <= 0 || !frame.matrix.every(Number.isFinite))
            throw new Error("Invalid Cafe source actor frame");
        if (!loaded.data.findAnimation(frame.animation))
            throw new Error(`Missing source animation: ${kind}/${frame.animation}`);
        const animationKey = frame.animationKey ?? 0;
        const key = `${frame.animation}\u0000${typeof animationKey}:${String(animationKey)}\u0000${frame.loop ? 1 : 0}\u0000${frame.queueIdle ? 1 : 0}`;
        if (key === lastKey && frame.time < lastTime)
            reset();
        if (key !== lastKey) {
            state.setAnimation(0, frame.animation, frame.loop);
            if (frame.queueIdle && !frame.loop)
                state.addAnimation(0, "IDLE", true, 0);
            lastKey = key;
            lastTime = 0;
        }
        state.update(frame.time - lastTime);
        state.apply(skeleton);
        skeleton.updateWorldTransform();
        lastTime = frame.time;
        const [a, b, c, d, e, f] = frame.matrix;
        // The installed Spine runtime uses Unity y-up; Pixi defaults to y-down.
        // Normalize only when needed; do not mutate the shared runtime setting.
        const ySign = base.settings.yDown ? 1 : -1;
        const meshes: Mesh[] = [];
        let clip: Float32Array | null = null;
        let endSlot: import("@pixi-spine/runtime-3.7").SlotData | null = null;
        for (const [index, slot] of skeleton.drawOrder.entries()) {
            const attachment = slot.getAttachment();
            if (attachment instanceof r.ClippingAttachment && !clip) {
                const count = attachment.worldVerticesLength;
                let work = clipWork.get(attachment);
                if (!work || work.world.length !== count) {
                    const vertexCount = count / 2;
                    const indices = new Uint16Array(Math.max(0, vertexCount - 2) * 3);
                    for (let vertex = 2, target = 0; vertex < vertexCount; vertex++) {
                        indices[target++] = 0;
                        indices[target++] = vertex - 1;
                        indices[target++] = vertex;
                    }
                    work = { world: new Float32Array(count), transformed: new Float32Array(count),
                        maskVertices: new Float32Array(count * 2), maskIndices: indices };
                    clipWork.set(attachment, work);
                    clipByTransformed.set(work.transformed, work);
                }
                attachment.computeWorldVertices(slot, 0, work.world.length, work.world, 0, 2);
                for (let i = 0; i < work.world.length; i += 2) {
                    const x = work.world[i], y = work.world[i + 1] * ySign;
                    work.transformed[i] = a * x * 100 + c * y * 100 + e;
                    work.transformed[i + 1] = b * x * 100 + d * y * 100 + f;
                }
                clip = work.transformed;
                endSlot = attachment.endSlot;
            }
            else if (attachment instanceof r.RegionAttachment || attachment instanceof r.MeshAttachment) {
                const isRegion = attachment instanceof r.RegionAttachment;
                let uvs = attachmentUvs.get(attachment);
                if (!uvs) {
                    uvs = prepareCafeAttachmentV2(attachment, loaded.runtime);
                    attachmentUvs.set(attachment, uvs);
                }
                const count = isRegion ? 8 : attachment.worldVerticesLength;
                if (uvs.length !== count)
                    throw new Error(`Original actor vertex/UV count mismatch: ${attachment.name}`);
                let work = attachmentWork.get(attachment);
                if (!work || work.world.length !== count) {
                    work = { world: new Float32Array(count), packed: new Float32Array(count * 2),
                        triangles: new Uint16Array(isRegion ? [3, 0, 1, 1, 2, 3] : attachment.triangles), color: new Float32Array(4) };
                    attachmentWork.set(attachment, work);
                }
                if (isRegion)
                    attachment.computeWorldVertices(slot.bone, work.world, 0, 2);
                else
                    attachment.computeWorldVertices(slot, 0, count, work.world, 0, 2);
                for (let i = 0; i < count; i += 2) {
                    const x = work.world[i], y = work.world[i + 1] * ySign, target = i * 2;
                    work.packed[target] = a * x * 100 + c * y * 100 + e;
                    work.packed[target + 1] = b * x * 100 + d * y * 100 + f;
                    work.packed[target + 2] = uvs[i];
                    work.packed[target + 3] = uvs[i + 1];
                }
                const opacity = slot.color.a * attachment.color.a * frame.alpha;
                const rounded = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 255) / 255;
                work.color[0] = rounded(slot.color.r * attachment.color.r * opacity);
                work.color[1] = rounded(slot.color.g * attachment.color.g * opacity);
                work.color[2] = rounded(slot.color.b * attachment.color.b * opacity);
                work.color[3] = rounded(slot.data.blendMode === 1 ? 0 : opacity);
                // Installed Unity RegionAttachment emits BR,BL,UL,UR; Pixi emits
                // BL,UL,UR,BR. Remap Unity's 0,1,2,2,3,0 to preserve its diagonal.
                meshes.push({ vertices: work.packed, triangles: work.triangles, color: work.color, depth: -index / (skeleton.drawOrder.length + 1) * .5, clip });
            }
            if (endSlot === slot.data) {
                clip = null;
                endSlot = null;
            }
        }
        const resolution = window.devicePixelRatio || 1;
        const w = Math.max(1, Math.ceil(frame.width * resolution)), h = Math.max(1, Math.ceil(frame.height * resolution));
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }
        gl!.viewport(0, 0, w, h);
        gl!.useProgram(program);
        gl!.enableVertexAttribArray(pos);
        gl!.enableVertexAttribArray(uv);
        gl!.uniform2f(size, frame.width, frame.height);
        gl!.activeTexture(gl!.TEXTURE0);
        gl!.bindTexture(gl!.TEXTURE_2D, texture);
        gl!.uniform1i(sampler, 0);
        gl!.disable(gl!.CULL_FACE);
        gl!.disable(gl!.SCISSOR_TEST);
        gl!.colorMask(true, true, true, true);
        gl!.depthMask(true);
        gl!.stencilMask(255);
        gl!.clearColor(0, 0, 0, 0);
        gl!.clearDepth(1);
        gl!.clearStencil(0);
        gl!.clear(gl!.COLOR_BUFFER_BIT | gl!.DEPTH_BUFFER_BIT | gl!.STENCIL_BUFFER_BIT);
        gl!.enable(gl!.BLEND);
        gl!.blendFunc(gl!.ONE, gl!.ONE_MINUS_SRC_ALPHA);
        gl!.depthFunc(gl!.LEQUAL);
        const twoPass = kind !== "mission";
        for (const mode of twoPass ? [0, 1] : [1]) {
            let activeClip: Float32Array | null | undefined;
            for (const mesh of meshes) {
                if (activeClip !== mesh.clip) {
                    activeClip = mesh.clip;
                    gl!.disable(gl!.STENCIL_TEST);
                    gl!.stencilMask(255);
                    gl!.clear(gl!.STENCIL_BUFFER_BIT);
                    if (activeClip) {
                        // Even/odd stencil fill supports source concave clipping polygons;
                        // the source's clipped mesh has the same covered sample set.
                        gl!.enable(gl!.STENCIL_TEST);
                        gl!.stencilFunc(gl!.ALWAYS, 0, 1);
                        gl!.stencilMask(1);
                        gl!.stencilOp(gl!.KEEP, gl!.KEEP, gl!.INVERT);
                        gl!.disable(gl!.DEPTH_TEST);
                        gl!.depthMask(false);
                        gl!.colorMask(false, false, false, false);
                        gl!.uniform1i(pass, 2);
                        gl!.uniform1f(depth, 0);
                        const mask = clipByTransformed.get(activeClip);
                        if (!mask)
                            throw new Error("Cafe clipping work buffer is missing");
                        for (let i = 0; i < activeClip.length; i += 2) {
                            mask.maskVertices[i * 2] = activeClip[i];
                            mask.maskVertices[i * 2 + 1] = activeClip[i + 1];
                        }
                        upload(mask.maskVertices, mask.maskIndices);
                        gl!.stencilMask(0);
                        gl!.stencilFunc(gl!.EQUAL, 1, 1);
                        gl!.stencilOp(gl!.KEEP, gl!.KEEP, gl!.KEEP);
                    }
                }
                if (twoPass)
                    gl!.enable(gl!.DEPTH_TEST);
                else
                    gl!.disable(gl!.DEPTH_TEST);
                gl!.depthMask(mode === 0);
                gl!.colorMask(mode === 1, mode === 1, mode === 1, mode === 1);
                gl!.uniform1i(pass, mode);
                gl!.uniform1f(depth, mesh.depth);
                gl!.uniform4fv(tint, mesh.color);
                upload(mesh.vertices, mesh.triangles);
            }
        }
        gl!.disable(gl!.STENCIL_TEST);
        gl!.colorMask(true, true, true, true);
        canvas.dataset.cafeActor = kind;
        canvas.dataset.cafeActorStatus = "ready";
        canvas.dataset.cafeActorAnimation = state.getCurrent(0)?.animation?.name ?? "";
        canvas.dataset.cafeActorMeshes = String(meshes.length);
        canvas.dataset.cafeActorTwoPass = String(twoPass);
    }
    return { render, dispose() { disposed = true; gl!.deleteTexture(texture); for (const buffer of gpuBuffers)
            gl!.deleteBuffer(buffer); gpuBuffers.clear(); gl!.deleteProgram(program); gl!.deleteShader(vertex); gl!.deleteShader(fragment); } };
}
