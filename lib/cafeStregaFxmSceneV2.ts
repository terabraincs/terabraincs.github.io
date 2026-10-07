import { swordClientIndex, type SwordClientComponent, type SwordClientLayout, type SwordClientNode } from './swordTrainingClientLayout';
import { CafeStregaFxmTransformV2 } from './cafeStregaFxmTransformV2';
import { sampleCafeFxmColorV2 } from './cafeStregaFxmColorV2';
import { sampleCafeFxmSpriteV2 } from './cafeStregaFxmSpriteV2';
type Attributes = Record<string, number>;
export type CafeFxmInputV2 = Record<string, {
    active?: boolean;
    attributes?: Attributes;
    restartKey?: number | string;
}>;
export type CafeFxmEvaluationV2 = {
    playback: number;
    delta: number;
    executing: boolean;
    revision: number;
    starts: number;
};
type Evaluator = {
    node: SwordClientNode;
    component: SwordClientComponent;
    started: boolean;
    completed: boolean;
    playback: number;
    transform?: CafeStregaFxmTransformV2;
    output: CafeFxmEvaluationV2;
};
type Player = {
    node: SwordClientNode;
    component: SwordClientComponent;
    members: string[];
    active: boolean;
    stopped: boolean;
    pending: boolean;
    playback: number;
    epoch: number;
    restartKey: string;
};
export type CafeFxmFrameV2 = {
    attributes: Record<string, Attributes>;
    active: Record<string, boolean>;
    sprites: Record<string, string>;
    effectiveActive: Record<string, boolean>;
    players: Record<string, {
        playback: number | null;
        active: boolean;
        epoch: number;
    }>;
    evaluators: Record<string, CafeFxmEvaluationV2>;
};
type StagedFrame = {
    time: number;
    input: CafeFxmInputV2;
    scene: CafeStregaFxmSceneV2;
    frame: CafeFxmFrameV2;
};
const f = Math.fround;
const descendants = (path: string, ancestor: string) => path === ancestor || path.startsWith(ancestor + '/');
const evaluaterTypes = new Set(['NKC_FXM_UI_IMAGE', 'NKC_FXM_UI_IMAGE_PMA', 'NKC_FXM_POSITION', 'NKC_FXM_ROTATE', 'NKC_FXM_SCALE',
    'NKC_FXM_EVENT', 'NKC_FXM_PARTICLE_SYSTEM_RENDERER', 'NKC_FXM_MATERIAL_UI']);
/** Original FXM_PLAYER owns a list, not its evaluator's target. Nested players
 * intentionally share evaluator instances, just as GetComponentsInChildren(true).
 * This is also why a modifier on an empty parent must not draw an extra Image. */
export class CafeStregaFxmSceneV2 {
    private readonly nodes: SwordClientNode[];
    private readonly activeChains: Map<string, readonly SwordClientNode[]>;
    private evaluators = new Map<string, Evaluator>();
    private players: Player[] = [];
    private attributes: Record<string, Attributes> = {};
    private sprites: Record<string, string> = {};
    private eventActive: Record<string, boolean> = {};
    private requested: Record<string, string> = {};
    private lastTime: number | null = null;
    /** Render evaluates a fork, then the matching layout effect promotes it.
     * The source clock therefore stays commit-safe without evaluating all FXM
     * players twice for every displayed frame. */
    private staged: StagedFrame | null = null;
    constructor(layout: SwordClientLayout, private readonly maxParticleDelta: number) {
        const index = swordClientIndex(layout);
        this.nodes = [];
        const visit = (parent: string | null) => { for (const node of index.children.get(parent) ?? []) {
            this.nodes.push(node);
            visit(node.path);
        } };
        visit(null);
        this.activeChains = new Map(this.nodes.map(node => {
            const chain: SwordClientNode[] = [];
            for (let current: SwordClientNode | undefined = node; current; current = current.parentPath ? index.nodes.get(current.parentPath) : undefined)
                chain.push(current);
            return [node.path, chain] as const;
        }));
        for (const node of this.nodes)
            for (const component of node.components) {
                if (evaluaterTypes.has(component.type)) {
                    const target = component.references.find(ref => ref.field === 'Target')?.nodePath;
                    const targetNode = target ? index.nodes.get(target) : undefined;
                    const rect = targetNode?.rect;
                    const transform = ['NKC_FXM_POSITION', 'NKC_FXM_ROTATE', 'NKC_FXM_SCALE'].includes(component.type)
                        ? new CafeStregaFxmTransformV2(component, { localPosition: rect!.localPosition, localScale: rect!.localScale,
                            localRotationZ: Math.atan2(2 * (rect!.localRotation[3] * rect!.localRotation[2] + rect!.localRotation[0] * rect!.localRotation[1]), 1 - 2 * (rect!.localRotation[1] ** 2 + rect!.localRotation[2] ** 2)) * 180 / Math.PI }) : undefined;
                    this.evaluators.set(component.pathId, { node, component, started: false, completed: false, playback: 0, transform,
                        output: { playback: 0, delta: 0, executing: false, revision: 0, starts: 0 } });
                }
                else if (component.type.startsWith('NKC_FXM_') && component.type !== 'NKC_FXM_PLAYER')
                    throw new Error(`Unaudited Cafe evaluator ${component.type}`);
            }
        for (const node of this.nodes)
            for (const component of node.components.filter(component => component.type === 'NKC_FXM_PLAYER')) {
                const fields = component.fields;
                if (fields.TimeMode !== 0 || fields.SimulationSpace !== 1 || !fields.AutoStart || fields.AutoDisable || !(Number(fields.Duration) > 0))
                    throw new Error(`Unaudited Cafe player ${node.path}`);
                this.players.push({ node, component, members: [...this.evaluators].filter(([, value]) => fields.SingleGO ? value.node.path === node.path : descendants(value.node.path, node.path)).map(([id]) => id),
                    active: false, stopped: true, pending: false, playback: 0, epoch: 0, restartKey: '' });
            }
    }
    clone(): CafeStregaFxmSceneV2 {
        return Object.assign(Object.create(CafeStregaFxmSceneV2.prototype), this, {
            evaluators: new Map([...this.evaluators].map(([id, value]) => [id, { ...value, output: { ...value.output }, transform: value.transform?.clone() }])),
            players: this.players.map(player => ({ ...player })), attributes: Object.fromEntries(Object.entries(this.attributes).map(([path, value]) => [path, { ...value }])),
            sprites: { ...this.sprites },
            eventActive: { ...this.eventActive }, requested: { ...this.requested },
            staged: null,
        });
    }
    preview(time: number, input: CafeFxmInputV2): CafeFxmFrameV2 {
        if (this.staged?.time === time && this.staged.input === input)
            return this.staged.frame;
        const scene = this.clone();
        const frame = scene.update(time, input);
        this.staged = { time, input, scene, frame };
        return frame;
    }
    private promote(scene: CafeStregaFxmSceneV2) {
        this.evaluators = scene.evaluators;
        this.players = scene.players;
        this.attributes = scene.attributes;
        this.sprites = scene.sprites;
        this.eventActive = scene.eventActive;
        this.requested = scene.requested;
        this.lastTime = scene.lastTime;
    }
    private selfActive(node: SwordClientNode, input: CafeFxmInputV2) {
        return this.eventActive[node.path] ?? input[node.path]?.active
            ?? (input[node.path]?.attributes?.m_IsActive === undefined ? node.activeSelf : input[node.path].attributes!.m_IsActive !== 0);
    }
    private isActive(path: string, input: CafeFxmInputV2): boolean {
        const chain = this.activeChains.get(path);
        if (!chain)
            return true;
        return chain.every(node => this.selfActive(node, input));
    }
    private write(evaluator: Evaluator, executing: boolean, delta: number, playerTime?: number) {
        const { component, transform } = evaluator, fields = component.fields;
        evaluator.output = { playback: evaluator.playback, delta, executing, revision: evaluator.output.revision + 1, starts: evaluator.output.starts };
        if (!fields.m_Enabled)
            return;
        const target = component.references.find(ref => ref.field === 'Target')?.nodePath;
        if (transform) {
            const pose = executing ? transform.step(playerTime!, delta) : transform.reset();
            const attributes = this.attributes[transform.targetPath] ??= {};
            if (component.type === 'NKC_FXM_SCALE')
                pose.localScale.forEach((value, index) => { attributes[`m_LocalScale.${'xyz'[index]}`] = value; });
            if (component.type === 'NKC_FXM_POSITION')
                pose.localPosition.forEach((value, index) => { attributes[`m_LocalPosition.${'xyz'[index]}`] = value; });
            if (component.type === 'NKC_FXM_ROTATE')
                attributes['localEulerAngles.z'] = pose.localRotationZ;
        }
        else if (component.type === 'NKC_FXM_UI_IMAGE' || component.type === 'NKC_FXM_UI_IMAGE_PMA') {
            if (!target)
                throw new Error(`Missing Cafe image evaluator target ${component.pathId}`);
            const sprite = sampleCafeFxmSpriteV2(component, evaluator.playback);
            if (sprite)
                this.sprites[target] = sprite;
            const color = executing ? sampleCafeFxmColorV2(component, evaluator.playback) : [0, 0, 0, 0];
            const attributes = this.attributes[target] ??= {};
            color.forEach((value, index) => { attributes[`m_Color.${'rgba'[index]}`] = value; });
        }
    }
    private reset(player: Player) {
        for (const id of player.members) {
            const evaluator = this.evaluators.get(id)!;
            evaluator.started = evaluator.completed = false;
            if (Number(evaluator.component.fields.ResetMode) !== 2) {
                evaluator.playback = 0;
                this.write(evaluator, false, 0);
            }
            else
                evaluator.transform?.reset();
        }
    }
    private invoke(evaluator: Evaluator, input: CafeFxmInputV2) {
        const { component, node } = evaluator;
        if (!this.isActive(node.path, input))
            return;
        if (component.fields.ProbFxEvent !== 1)
            throw new Error('Unverified probabilistic Cafe UnityEvent');
        const calls = (component.fields.Evt as {
            m_PersistentCalls: {
                m_Calls: {
                    m_MethodName: string;
                    m_Mode: number;
                    m_CallState: number;
                    m_Arguments: {
                        m_BoolArgument: number;
                    };
                }[];
            };
        }).m_PersistentCalls.m_Calls;
        calls.forEach((call, index) => {
            if (!call.m_CallState)
                return;
            const target = component.references.find(ref => ref.field === `Evt.m_PersistentCalls.m_Calls[${index}].m_Target`)?.nodePath;
            if (!target || call.m_MethodName !== 'SetActive' || call.m_Mode !== 6)
                throw new Error('Unverified Cafe persistent UnityEvent');
            this.eventActive[target] = Boolean(call.m_Arguments.m_BoolArgument);
        });
    }
    update(time: number, input: CafeFxmInputV2): CafeFxmFrameV2 {
        if (this.staged?.time === time && this.staged.input === input) {
            const { scene, frame } = this.staged;
            this.staged = null;
            this.promote(scene);
            return frame;
        }
        this.staged = null;
        const delta = this.lastTime === null ? 0 : f(Math.min(Math.max(0, time - this.lastTime), this.maxParticleDelta));
        this.lastTime = time;
        const inputEntries = Object.entries(input);
        const restartEntries = inputEntries.filter(([, value]) => value.restartKey !== undefined);
        for (const [path, value] of inputEntries) {
            const request = `${value.active ?? ''}:${value.attributes?.m_IsActive ?? ''}:${value.restartKey ?? ''}`;
            if (request !== this.requested[path]) {
                this.requested[path] = request;
                delete this.eventActive[path];
            }
        }
        for (const player of this.players) {
            const fields = player.component.fields, active = this.isActive(player.node.path, input) && Boolean(fields.m_Enabled);
            const key = restartEntries.filter(([path]) => descendants(player.node.path, path)).map(([path, value]) => `${path}:${value.restartKey}`).join('|');
            const restarted = active && (!player.active || key !== player.restartKey);
            if (!active && player.active) {
                player.pending = false;
                if (!player.stopped) {
                    player.stopped = true;
                    player.playback = 0;
                    this.reset(player);
                }
            }
            player.active = active;
            player.restartKey = key;
            if (restarted) {
                player.epoch++;
                player.pending = true;
            }
            // AutoStart uses Invoke(Restart, 0): the activation frame has no Update.
            if (!active || restarted || delta <= 0)
                continue;
            if (player.pending) {
                this.reset(player);
                player.playback = 0;
                player.stopped = false;
                player.pending = false;
            }
            if (player.stopped)
                continue;
            const dt = f(delta * Number(fields.TimeScale)), duration = Number(fields.Duration), total = f(player.playback + dt);
            if (fields.Loop) {
                if (total > duration)
                    for (const id of player.members) {
                        const evaluator = this.evaluators.get(id)!;
                        evaluator.started = evaluator.completed = false;
                        evaluator.transform?.loop();
                    }
                player.playback = f(total - f(Math.floor(total / duration) * duration));
            }
            else
                player.playback = Math.max(0, Math.min(duration, total));
            if (player.playback > 0)
                for (const id of player.members) {
                    const evaluator = this.evaluators.get(id)!, source = evaluator.component.fields;
                    if (evaluator.completed || !source.m_Enabled)
                        continue;
                    if (player.playback < Number(source.StartTime) && evaluator.playback <= 0)
                        continue;
                    evaluator.playback = f(Math.max(0, Math.min(Number(source.Duration), f(player.playback - Number(source.StartTime)))));
                    if (!evaluator.started) {
                        evaluator.started = true;
                        evaluator.output.starts++;
                        if (evaluator.component.type === 'NKC_FXM_EVENT')
                            this.invoke(evaluator, input);
                    }
                    this.write(evaluator, true, dt, player.playback);
                    if (evaluator.playback >= Number(source.Duration)) {
                        evaluator.completed = true;
                        // Transform helper already implements its own original OnComplete.
                        if (Number(source.ResetMode) === 0 && !evaluator.transform) {
                            evaluator.playback = 0;
                            this.write(evaluator, false, 0);
                        }
                    }
                }
            if (!fields.Loop && player.playback >= duration) {
                player.stopped = true;
                player.playback = 0;
                this.reset(player);
            }
        }
        const effectiveActive: Record<string, boolean> = {};
        for (const node of this.nodes)
            effectiveActive[node.path] = this.selfActive(node, input) && (!node.parentPath || effectiveActive[node.parentPath]);
        return { attributes: this.attributes, sprites: this.sprites, active: this.eventActive, effectiveActive,
            players: Object.fromEntries(this.players.map(player => [player.node.path, { active: player.active, playback: player.stopped ? null : player.playback, epoch: player.epoch }])),
            evaluators: Object.fromEntries([...this.evaluators].map(([id, evaluator]) => [id, evaluator.output])) };
    }
}
/** Keep original components in the source bundle; strip only at the draw boundary
 * so the shared Sword-only player cannot execute a Cafe evaluator a second time. */
const drawLayouts = new WeakMap<SwordClientLayout, SwordClientLayout>();
export function cafeFxmDrawLayoutV2<T extends SwordClientLayout>(layout: T): T {
    const cached = drawLayouts.get(layout);
    if (cached)
        return cached as T;
    const result = { ...layout, nodes: layout.nodes.map(node => ({ ...node, components: node.components.filter(component => !component.type.startsWith('NKC_FXM_')) })) } as T;
    drawLayouts.set(layout, result);
    return result;
}
