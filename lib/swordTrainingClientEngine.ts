/**
 * Recovered NKCPopupSwordTraining/NKCSwordTrainingMonster mechanics.
 * This module deliberately does not import the previous web minigame.
 * Evidence and the native-contact verification boundary are in
 * docs/minigames/sword-training/rebuild/client-mechanics.md.
 */
import { SwordClientContactHistory, type SwordPhysicsAabb } from "./swordTrainingClientPhysics.ts";
const f = Math.fround;
export const SWORD_CLIENT_PHYSICS = Object.freeze({
    fixedDeltaTime: f(0.1),
    maximumDeltaTime: 1,
    manualMass: f(0.0001),
    gravityY: f(-9.8100004196167),
    deathGravityScale: 50,
    maximumStepTranslation: 100,
    attackDuration: f(0.1),
    attackRadius: 45,
    polygonRadius: f(0.01),
    sensorDistanceEpsilon: f(1.1920928955078125e-6),
    knockback: 300,
    normalPerStage: 24,
    stageDelay: f(0.8),
    backgroundDelay: 20,
    backgroundTurnDelay: 5,
});
export type SwordTrainingSide = "left" | "right";
export type SwordTrainingActorKind = "player" | "normal" | "yellow" | "boss";
export type SwordTrainingClientPhase = "idle" | "play" | "gameover" | "result";
export type SwordTrainingPoint = {
    x: number;
    y: number;
};
export type SwordTrainingScale = {
    scaleX: number;
    scaleY: number;
};
export type SwordTrainingClientGeometry = {
    /** Orthographic UI camera world units / CanvasScaler design unit. */
    worldUnitsPerDesignUnit: number;
    player: SwordTrainingPoint & SwordTrainingScale;
    foreground: {
        left: SwordTrainingPoint;
        right: SwordTrainingPoint;
        parent: SwordTrainingPoint;
    } & SwordTrainingScale;
    /** Exact PPtr targets TOUCH_L/TOUCH_R, not the unused similarly named points. */
    background: {
        left: SwordTrainingPoint;
        right: SwordTrainingPoint;
        parent: SwordTrainingPoint;
    } & SwordTrainingScale;
    /** Socket pivots; the original +/-40 anchoredPosition adjustment is applied below. */
    weapon: {
        left: SwordTrainingPoint;
        right: SwordTrainingPoint;
    } & SwordTrainingScale;
};
export type SwordTrainingClientActor = SwordTrainingPoint & SwordTrainingScale & {
    id: string;
    kind: SwordTrainingActorKind;
    flipX: boolean;
    animation: string;
    animationTime: number;
    loop: boolean;
    frozen: boolean;
    /** The original attack/death call relocates the SkeletonGraphic child to the root. */
    graphicAtRoot?: boolean;
    hp?: number;
    spawnSide?: SwordTrainingSide;
    /** Current simulation position before Rigidbody2D render interpolation. */
    physicsX?: number;
    physicsY?: number;
    velocityX?: number;
    velocityY?: number;
};
export type SwordTrainingClientEvent = {
    type: "sound" | "music" | "hit-fx" | "result" | "stage";
    key?: string;
    side?: SwordTrainingSide;
    score?: number;
    stage?: number;
};
export type SwordTrainingClientSnapshot = {
    phase: SwordTrainingClientPhase;
    elapsed: number;
    stage: number;
    score: number;
    resultScore: number | null;
    attacking: boolean;
    attackSide: SwordTrainingSide;
    player: SwordTrainingClientActor;
    foreground: SwordTrainingClientActor[];
    background: SwordTrainingClientActor[];
    spawnTimes: readonly number[];
    normalKills: number;
    bossKills: number;
};
type Body = {
    id: number;
    kind: Exclude<SwordTrainingActorKind, "player">;
    x: number;
    y: number;
    previousX: number;
    previousY: number;
    vx: number;
    vy: number;
    forceX: number;
    speed: number;
    hp: number;
    spawnSide: SwordTrainingSide;
    moveLeft: boolean;
    isBoss: boolean;
    kinematic: boolean;
    animation: string;
    animationTime: number;
    loop: boolean;
    frozen: boolean;
    physicsKey: string;
    colliderInstanceId: number;
    hasCollider: boolean;
    background: boolean;
};
type Timer = {
    due: number;
    frame: number;
    run: () => void;
};
type Pool = {
    entries: (boolean | null)[];
    free: number[];
    physicsEntries: (Body | undefined)[];
};
function validDraw(random: () => number): number {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
        throw new Error("Sword Training random input must be in [0, 1).");
    }
    return value;
}
/** System.Math.Round(double, 2): midpoint-to-even, not JavaScript Math.round. */
export function swordClientRound2(value: number): number {
    const scaled = value * 100;
    const lower = Math.floor(scaled);
    const fraction = scaled - lower;
    return (fraction < 0.5 ? lower : fraction > 0.5 ? lower + 1 : lower % 2 === 0 ? lower : lower + 1) / 100;
}
export function swordClientSpawnTimes(stage: number, random: () => number): number[] {
    const window = Math.max(1000, f(2000 - f(2000 * f(f(stage) * f(0.5)))));
    const times: number[] = [];
    while (times.length < SWORD_CLIENT_PHYSICS.normalPerStage) {
        // The source checks one UNscaled draw, then appends a different scaled draw.
        const checked = swordClientRound2(validDraw(random) * window);
        if (!times.includes(checked)) {
            times.push(swordClientRound2(validDraw(random) * window) * 0.009999999776482582);
        }
    }
    return times.sort((a, b) => a - b);
}
export function swordClientMonsterForce(kind: Exclude<SwordTrainingActorKind, "player">, stage: number): number {
    const base = f(kind === "yellow" ? 0.2 : 0.3);
    return f(base + f(base * f(f(0.1) * f(stage + 1))));
}
/** The actual native AddForce/solver arithmetic; one force, not per-frame acceleration. */
export function swordClientFirstVelocity(kind: Exclude<SwordTrainingActorKind, "player">, stage: number): number {
    return f(SWORD_CLIENT_PHYSICS.fixedDeltaTime * f(f(1 / SWORD_CLIENT_PHYSICS.manualMass) * swordClientMonsterForce(kind, stage)));
}
/** Native sensor final distance test, after closest unrounded shape points. */
export function swordClientSensorOverlap(dx: number, dy: number, radiusSum: number): boolean {
    const distance = f(Math.sqrt(f(f(dx * dx) + f(dy * dy))));
    return Math.max(0, f(distance - f(radiusSum))) < SWORD_CLIENT_PHYSICS.sensorDistanceEpsilon;
}
function cloneGeometry(geometry: SwordTrainingClientGeometry): SwordTrainingClientGeometry {
    if (!(geometry.worldUnitsPerDesignUnit > 0) || !Number.isFinite(geometry.worldUnitsPerDesignUnit)) {
        throw new Error("The client canvas world/design scale must be verified and positive.");
    }
    for (const group of [geometry.player, geometry.foreground, geometry.background, geometry.weapon]) {
        if (!(group.scaleX > 0) || !(group.scaleY > 0))
            throw new Error("Invalid source parent scale.");
    }
    return {
        worldUnitsPerDesignUnit: geometry.worldUnitsPerDesignUnit,
        player: { ...geometry.player },
        foreground: { ...geometry.foreground, left: { ...geometry.foreground.left }, right: { ...geometry.foreground.right }, parent: { ...geometry.foreground.parent } },
        background: { ...geometry.background, left: { ...geometry.background.left }, right: { ...geometry.background.right }, parent: { ...geometry.background.parent } },
        weapon: { ...geometry.weapon, left: { ...geometry.weapon.left }, right: { ...geometry.weapon.right } },
    };
}
/**
 * Advance ONCE per rendered frame. Fixed simulation precedes Update/input, and
 * WaitForSeconds resumes at a frame boundary (it is not a continuous-time event).
 * Native tree/contact history supplies simultaneous-trigger callback order.
 */
export class SwordTrainingClientEngine {
    private geometry: SwordTrainingClientGeometry;
    private readonly random: () => number;
    private readonly spawnRandom: () => number;
    private phase: SwordTrainingClientPhase = "idle";
    private elapsed = 0;
    private accumulator = 0;
    private frame = 0;
    private stage = 0;
    private normalKills = 0;
    private bossKills = 0;
    private resultScore: number | null = null;
    private nextMonsterId = 0;
    private nextBackgroundId = 0;
    private backgroundCounter = 0;
    private bodies: Body[] = [];
    private backgrounds: Body[] = [];
    private timers: Timer[] = [];
    private events: SwordTrainingClientEvent[] = [];
    private spawnTimes: number[] = [];
    private attacking = false;
    private weaponEnabled = false;
    private weaponHit = false;
    private attackSide: SwordTrainingSide = "right";
    private physics = new SwordClientContactHistory();
    private simulationBodies: Body[] = [];
    private nextPhysicsId = 0;
    private physicsInitialized = false;
    private nextColliderInstanceId = -1;
    private playerFixtures: {
        key: string;
        instanceId: number;
    }[] = [];
    private weaponInstanceId = 0;
    private weaponPosition: SwordTrainingPoint = { x: 0, y: 0 };
    private weaponParentSide: SwordTrainingSide = "left";
    private weaponAnchoredOffset = 0;
    private weaponRotationLeft = false;
    private openedPoolBody: Body | undefined;
    private pendingColliderDestruction: Body[] = [];
    private playerAnimation = "START";
    private playerAnimationTime = 0;
    private playerLoop = false;
    private playerFlipX = false;
    private playerGraphicAtRoot = false;
    private pools: Record<Exclude<SwordTrainingActorKind, "player">, Pool> = {
        normal: { entries: [], free: [], physicsEntries: [] }, yellow: { entries: [], free: [], physicsEntries: [] }, boss: { entries: [], free: [], physicsEntries: [] },
    };
    constructor(options: {
        geometry: SwordTrainingClientGeometry;
        /** Unity global PRNG state cannot be recovered from a service-ended run. */
        random?: () => number;
        /** Independent System.Random draws, injectable for reproducible verification. */
        spawnRandom?: () => number;
    }) {
        this.geometry = cloneGeometry(options.geometry);
        this.random = options.random ?? Math.random;
        this.spawnRandom = options.spawnRandom ?? Math.random;
    }
    start(): void {
        const freshIllustration = !this.physicsInitialized;
        this.closeBodies([...this.bodies, ...this.backgrounds]);
        this.bodies = [];
        if (freshIllustration) {
            this.elapsed = 0;
            this.accumulator = 0;
            this.frame = 0;
            this.timers = [];
            this.events = [];
            this.playerFlipX = false;
            this.playerGraphicAtRoot = false;
        }
        this.stage = 0;
        this.normalKills = 0;
        this.bossKills = 0;
        this.resultScore = null;
        this.nextBackgroundId = 0;
        this.backgroundCounter = 0;
        this.backgrounds = [];
        // Open may be called twice by queued module-start coroutines. InitGame
        // skips existing illustrations/weapon and does not StopAllCoroutines:
        // retain earlier waits and enqueue another foreground/BG/turn coroutine.
        this.initializePhysics();
        this.readyStage();
        this.setPlayerAnimation("START", false);
        this.sound("FX_CUTSCEN_SYS_START1");
    }
    restart(): void {
        // ReStart enters READY directly, not INIT. It reuses the illustration and
        // weapon and only resets ClearData's counters; RESULT already cleared BG.
        this.stage = 0;
        this.normalKills = 0;
        this.bossKills = 0;
        this.resultScore = null;
        this.readyStage();
        this.setPlayerAnimation("START", false);
        this.sound("FX_CUTSCEN_SYS_START1");
    }
    stop(): void {
        this.closeBodies([...this.bodies, ...this.backgrounds]);
        this.phase = "idle";
        this.timers = [];
        this.bodies = [];
        this.backgrounds = [];
        this.attacking = false;
        this.weaponEnabled = false;
        this.disableWeapon();
        for (const fixture of this.playerFixtures)
            this.physics.removeFixture(fixture.key);
        this.physicsInitialized = false;
    }
    setGeometry(geometry: SwordTrainingClientGeometry): void {
        const next = cloneGeometry(geometry);
        const old = this.geometry;
        if (JSON.stringify(next) === JSON.stringify(old))
            return;
        const ratio = next.worldUnitsPerDesignUnit / old.worldUnitsPerDesignUnit;
        // Canvas rescaling changes Transform positions/scales, not Rigidbody velocities.
        for (const body of [...this.bodies, ...this.backgrounds]) {
            body.x = f(body.x * ratio);
            body.y = f(body.y * ratio);
            body.previousX = f(body.previousX * ratio);
            body.previousY = f(body.previousY * ratio);
        }
        this.geometry = next;
        const socket = next.weapon[this.weaponParentSide];
        this.weaponPosition = this.world({ x: socket.x + this.weaponAnchoredOffset * next.weapon.scaleX, y: socket.y });
        if (this.physicsInitialized) {
            for (const fixture of this.playerFixtures)
                this.physics.rebuildFixture(fixture.key, { aabb: this.playerAabb() });
            if (this.weaponEnabled)
                this.physics.rebuildFixture("weapon", { aabb: this.weaponAabb() });
            for (const body of this.bodies)
                this.physics.rebuildFixture(body.physicsKey, { aabb: this.monsterAabb(body) });
        }
    }
    attack(side: SwordTrainingSide): boolean {
        if (this.phase !== "play" || this.attacking)
            return false;
        this.attacking = true;
        this.weaponEnabled = true;
        this.weaponHit = false;
        this.attackSide = side;
        const radius = this.weaponRadius();
        if (!this.physics.fixtures.has("weapon"))
            this.physics.addFixture({ key: "weapon", bodyKey: "weapon", instanceId: this.weaponInstanceId, bodyType: "static",
                aabb: this.circleAabb(this.weaponPosition, radius) });
        const socket = this.geometry.weapon[side];
        // SetParent(false) preserves the old anchored offset. Changing sides therefore
        // rebuilds once at +/-450 before SetPositionAndRotation resets it to +/-350.
        if (side !== this.weaponParentSide) {
            this.weaponParentSide = side;
            this.weaponPosition = this.world({ x: socket.x + this.weaponAnchoredOffset * this.geometry.weapon.scaleX, y: socket.y });
            this.physics.rebuildFixture("weapon", { aabb: this.weaponAabb() });
        }
        this.weaponPosition = this.world(socket);
        if (this.weaponAnchoredOffset !== 0 || this.weaponRotationLeft !== (side === "left")) {
            this.physics.rebuildFixture("weapon", { aabb: this.weaponAabb() });
        }
        this.weaponRotationLeft = side === "left";
        this.weaponAnchoredOffset = side === "left" ? 40 : -40;
        this.weaponPosition = this.world({ x: socket.x + this.weaponAnchoredOffset * this.geometry.weapon.scaleX, y: socket.y });
        this.physics.rebuildFixture("weapon", { aabb: this.weaponAabb() });
        this.playerFlipX = side === "left";
        this.playerGraphicAtRoot = true;
        this.setPlayerAnimation("ATTACK", false);
        this.sound("FX_COMBAT_ALL_SWORD_SLASH_SMALL_14");
        this.wait(SWORD_CLIENT_PHYSICS.attackDuration, () => {
            this.attacking = false;
            this.weaponEnabled = false;
            this.disableWeapon();
            if (!this.weaponHit)
                this.gameOver(null);
            else
                this.events.push({ type: "hit-fx", side });
        });
        return true;
    }
    advance(deltaSeconds: number, input?: {
        left?: boolean;
        right?: boolean;
    }): SwordTrainingClientSnapshot {
        if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0)
            throw new Error("Invalid frame duration.");
        if (this.phase === "idle" || this.phase === "result")
            return this.getSnapshot();
        const dt = Math.min(deltaSeconds, SWORD_CLIENT_PHYSICS.maximumDeltaTime);
        this.frame++;
        this.elapsed += dt;
        this.accumulator += dt;
        this.flushColliderDestruction();
        while (this.accumulator >= SWORD_CLIENT_PHYSICS.fixedDeltaTime) {
            this.accumulator -= SWORD_CLIENT_PHYSICS.fixedDeltaTime;
            this.fixedStep();
        }
        this.playerAnimationTime += dt;
        if (!this.playerLoop) {
            const duration = this.playerAnimation === "START" ? 2.5 : this.playerAnimation === "ATTACK" ? 1 : 3;
            if (this.playerAnimationTime >= duration) {
                this.playerAnimation = "IDLE";
                this.playerAnimationTime -= duration;
                this.playerLoop = true;
            }
        }
        for (const body of this.bodies) {
            if (!body.frozen) {
                body.animationTime += dt;
                if (!body.loop && body.animation === "DEATH" && body.animationTime >= 1) {
                    body.animation = "IDLE";
                    body.animationTime -= 1;
                    body.loop = true;
                }
            }
        }
        for (const body of this.backgrounds) {
            if (!body.frozen) {
                body.animationTime += dt;
                if (!body.loop && body.animation === "DEATH" && body.animationTime >= 1) {
                    body.animation = "IDLE";
                    body.animationTime -= 1;
                    body.loop = true;
                }
            }
        }
        // Input.GetKeyDown checks left before right. The first accepted attack locks the other.
        if (input?.left)
            this.attack("left");
        if (input?.right)
            this.attack("right");
        if (this.phase === "play") {
            const left = this.world(this.geometry.background.left).x;
            const right = this.world(this.geometry.background.right).x;
            for (const body of this.backgrounds) {
                const renderX = this.interpolate(body).x;
                if ((body.moveLeft && renderX < left) || (!body.moveLeft && renderX > right))
                    this.turnBackground(body);
            }
        }
        // A newly yielded timer cannot resume twice in the same rendered frame.
        const ready = this.timers.filter((timer) => timer.due <= this.elapsed && timer.frame < this.frame);
        for (const timer of ready) {
            const index = this.timers.indexOf(timer);
            if (index < 0)
                continue; // StopAllCoroutines may have cancelled the remainder.
            this.timers.splice(index, 1);
            timer.run();
        }
        this.flushColliderDestruction();
        return this.getSnapshot();
    }
    getSnapshot(): SwordTrainingClientSnapshot {
        const unit = this.geometry.worldUnitsPerDesignUnit;
        const actor = (body: Body, background: boolean): SwordTrainingClientActor => {
            const scale = background ? this.geometry.background : this.geometry.foreground;
            const rendered = this.interpolate(body);
            return {
                id: `${background ? "background" : "monster"}-${body.id}`,
                kind: body.kind,
                x: rendered.x / unit,
                y: rendered.y / unit,
                scaleX: scale.scaleX,
                scaleY: scale.scaleY,
                flipX: background ? body.moveLeft : body.spawnSide === "right",
                animation: body.animation,
                animationTime: body.animationTime,
                loop: body.loop,
                frozen: body.frozen,
                hp: body.hp,
                spawnSide: body.spawnSide,
                physicsX: body.x / unit,
                physicsY: body.y / unit,
                velocityX: body.vx,
                velocityY: body.vy,
            };
        };
        return {
            phase: this.phase,
            elapsed: this.elapsed,
            stage: this.stage,
            score: this.normalKills + this.bossKills,
            resultScore: this.resultScore,
            attacking: this.attacking,
            attackSide: this.attackSide,
            player: {
                id: "player",
                kind: "player",
                ...this.geometry.player,
                flipX: this.playerFlipX,
                animation: this.playerAnimation,
                animationTime: this.playerAnimationTime,
                loop: this.playerLoop,
                frozen: false,
                graphicAtRoot: this.playerGraphicAtRoot,
            },
            foreground: this.bodies.map((body) => actor(body, false)),
            background: this.backgrounds.map((body) => actor(body, true)),
            spawnTimes: [...this.spawnTimes],
            normalKills: this.normalKills,
            bossKills: this.bossKills,
        };
    }
    drainEvents(): SwordTrainingClientEvent[] {
        return this.events.splice(0);
    }
    private wait(seconds: number, run: () => void): void {
        this.timers.push({ due: this.elapsed + f(seconds), frame: this.frame, run });
    }
    private readyStage(): void {
        this.closeBodies(this.bodies);
        this.bodies = [];
        this.nextMonsterId = 0;
        this.attacking = false;
        // ReadyGame only clears Weapon.m_IsAttacking. It does not disable an
        // already enabled collider or stop a previous OnWeaponAttack coroutine.
        this.events.push({ type: "music", key: "THEMA_CA_TWINTAIL" });
        this.phase = "play";
        this.spawnTimes = swordClientSpawnTimes(this.stage, this.spawnRandom);
        this.events.push({ type: "stage", stage: this.stage });
        this.backgroundSpawnCoroutine();
        this.backgroundTurnCoroutine();
        let index = 0;
        let previous = 0;
        const spawnNext = () => {
            if (index >= this.spawnTimes.length)
                return;
            const at = f(this.spawnTimes[index]);
            this.wait(f(at - previous), () => {
                if (this.phase !== "play")
                    return;
                previous = at;
                index++;
                this.spawn(false);
                spawnNext();
            });
        };
        this.wait(0.5, spawnNext);
    }
    private randomInt(minimum: number, maximumExclusive: number): number {
        if (minimum === maximumExclusive)
            return minimum;
        return minimum + Math.floor(validDraw(this.random) * (maximumExclusive - minimum));
    }
    private world(point: SwordTrainingPoint): SwordTrainingPoint {
        return { x: f(point.x * this.geometry.worldUnitsPerDesignUnit), y: f(point.y * this.geometry.worldUnitsPerDesignUnit) };
    }
    private spawn(boss: boolean, background = false): void {
        if (this.phase !== "play")
            return;
        const spawnLeft = this.randomInt(1, 11) >= 5;
        const kind = boss ? "boss" : this.randomInt(1, 11) >= 5 ? "normal" : "yellow";
        const reusedKinematic = this.openBody(kind);
        const reused = this.openedPoolBody;
        // Foreground SetData explicitly resets this; background SetData does not.
        const kinematic = background && reusedKinematic;
        const group = background ? this.geometry.background : this.geometry.foreground;
        const point = this.world(spawnLeft ? group.left : group.right);
        const speed = swordClientMonsterForce(kind, this.stage);
        const body: Body = {
            id: background ? this.nextBackgroundId++ : this.nextMonsterId++,
            kind,
            ...point,
            previousX: point.x,
            previousY: point.y,
            vx: 0,
            vy: 0,
            forceX: kinematic ? 0 : spawnLeft ? speed : -speed,
            speed,
            hp: boss ? 3 + this.stage : 1,
            spawnSide: spawnLeft ? "left" : "right",
            moveLeft: !spawnLeft,
            isBoss: boss,
            kinematic,
            animation: "RUN",
            animationTime: 0,
            loop: true,
            frozen: false,
            physicsKey: reused?.physicsKey ?? `body-${this.nextPhysicsId++}`,
            colliderInstanceId: reused?.hasCollider ? reused.colliderInstanceId : 0,
            hasCollider: !background || !!reused?.hasCollider,
            background,
        };
        (background ? this.backgrounds : this.bodies).push(body);
        this.simulationBodies.push(body);
        if (reused?.hasCollider)
            this.openPooledFixture(body, reused);
        else if (!background)
            this.createMonsterFixture(body, !!reused, reusedKinematic);
        if (background && body.hasCollider)
            this.pendingColliderDestruction.push(body);
    }
    private backgroundSpawnCoroutine(): void {
        if (this.backgroundCounter >= 3)
            return;
        this.wait(SWORD_CLIENT_PHYSICS.backgroundDelay, () => {
            this.spawn(false, true);
            this.backgroundCounter++;
            this.backgroundSpawnCoroutine();
        });
    }
    private backgroundTurnCoroutine(): void {
        this.wait(SWORD_CLIENT_PHYSICS.backgroundTurnDelay, () => {
            if (this.backgrounds.length > 0 && this.phase === "play") {
                // Source exclusive upper-bound error intentionally retained.
                const index = this.randomInt(0, this.backgrounds.length - 1);
                this.turnBackground(this.backgrounds[index]);
            }
            this.backgroundTurnCoroutine();
        });
    }
    private turnBackground(body: Body): void {
        body.vx = 0;
        body.vy = 0;
        body.moveLeft = !body.moveLeft;
        if (!body.kinematic)
            body.forceX = f(body.forceX + (body.moveLeft ? -body.speed : body.speed));
    }
    private closeBodies(bodies: Body[]): void {
        for (const body of bodies) {
            if (body.physicsKey) {
                this.physics.removeFixture(body.physicsKey);
                const index = this.simulationBodies.indexOf(body);
                if (index >= 0) {
                    const last = this.simulationBodies.pop()!;
                    if (index < this.simulationBodies.length)
                        this.simulationBodies[index] = last;
                }
            }
            const pool = this.pools[body.kind];
            const free = pool.free.pop();
            if (free === undefined) {
                pool.entries.push(body.kinematic);
                pool.physicsEntries.push(body);
            }
            else {
                pool.entries[free] = body.kinematic;
                pool.physicsEntries[free] = body;
            }
        }
    }
    private openBody(kind: Exclude<SwordTrainingActorKind, "player">): boolean {
        // NKMObjectPool takes the first Dictionary enumerator entry. The installed
        // Dictionary enumerates entry indices and reuses removed slots via freeList.
        const pool = this.pools[kind];
        const first = pool.entries.findIndex((entry) => entry !== null);
        this.openedPoolBody = undefined;
        if (first < 0)
            return false;
        this.openedPoolBody = pool.physicsEntries[first];
        pool.physicsEntries[first] = undefined;
        const kinematic = pool.entries[first]!;
        pool.entries[first] = null;
        pool.free.push(first);
        return kinematic;
    }
    private interpolate(body: Body): SwordTrainingPoint {
        if (body.kinematic)
            return { x: body.x, y: body.y };
        const alpha = this.accumulator / SWORD_CLIENT_PHYSICS.fixedDeltaTime;
        return {
            x: f(body.previousX + f(f(body.x - body.previousX) * alpha)),
            y: f(body.previousY + f(f(body.y - body.previousY) * alpha)),
        };
    }
    private monsterBox(body: Body): {
        x: number;
        y: number;
        halfX: number;
        halfY: number;
    } {
        const unit = this.geometry.worldUnitsPerDesignUnit;
        const group = body.background ? this.geometry.background : this.geometry.foreground;
        const sx = f(group.scaleX * unit);
        const sy = f(group.scaleY * unit);
        return {
            x: f(body.x + f((body.isBoss ? (body.spawnSide === "right" ? -50 : 50) : 0) * sx)),
            y: f(body.y + f((body.isBoss ? 50 : 70) * sy)),
            halfX: f(50 * sx),
            halfY: f((body.isBoss ? 65 : 40) * sy),
        };
    }
    private boxAabb(box: {
        x: number;
        y: number;
        halfX: number;
        halfY: number;
    }): SwordPhysicsAabb {
        const r = SWORD_CLIENT_PHYSICS.polygonRadius;
        return { minX: f(f(box.x - box.halfX) - r), minY: f(f(box.y - box.halfY) - r),
            maxX: f(f(box.x + box.halfX) + r), maxY: f(f(box.y + box.halfY) + r) };
    }
    private circleAabb(point: SwordTrainingPoint, radius: number): SwordPhysicsAabb {
        return { minX: f(point.x - radius), minY: f(point.y - radius), maxX: f(point.x + radius), maxY: f(point.y + radius) };
    }
    private playerBox() {
        const unit = this.geometry.worldUnitsPerDesignUnit;
        const player = this.world(this.geometry.player);
        return { ...player, halfX: f(50 * f(this.geometry.player.scaleX * unit)), halfY: f(75 * f(this.geometry.player.scaleY * unit)) };
    }
    private playerAabb(): SwordPhysicsAabb { return this.boxAabb(this.playerBox()); }
    private monsterAabb(body: Body): SwordPhysicsAabb { return this.boxAabb(this.monsterBox(body)); }
    private weaponRadius(): number { return f(45 * f(Math.max(this.geometry.weapon.scaleX, this.geometry.weapon.scaleY) * this.geometry.worldUnitsPerDesignUnit)); }
    private weaponAabb(): SwordPhysicsAabb { return this.circleAabb(this.weaponPosition, this.weaponRadius()); }
    private disableWeapon(): void { this.physics.removeFixture("weapon"); }
    private initializePhysics(): void {
        if (this.physicsInitialized)
            return;
        this.physicsInitialized = true;
        const p = this.playerBox(), unit = this.geometry.worldUnitsPerDesignUnit;
        // CleanUp pools the player illustration without removing added components.
        // Reopening enables each old collider, then localPosition Z99->0 and
        // localScale Z1->0 each rebuild all proxies, in component insertion order.
        for (const fixture of this.playerFixtures)
            this.physics.addFixture({ ...fixture, bodyKey: "player", bodyType: "static", aabb: this.playerAabb() });
        for (let setter = 0; setter < 2; setter++)
            for (const fixture of this.playerFixtures)
                this.physics.rebuildFixture(fixture.key);
        const playerFixture = { key: this.playerFixtures.length ? `player-${this.playerFixtures.length}` : "player", instanceId: this.nextColliderInstanceId-- };
        this.playerFixtures.push(playerFixture);
        const initialPlayer = this.boxAabb({ ...p, halfX: f(.5 * this.geometry.player.scaleX * unit), halfY: f(.5 * this.geometry.player.scaleY * unit) });
        this.physics.addFixture({ ...playerFixture, bodyKey: "player", bodyType: "static", aabb: initialPlayer });
        this.physics.rebuildFixture(playerFixture.key); // AddComponent's initial enable/rebuild.
        this.physics.rebuildFixture(playerFixture.key, { aabb: this.playerAabb() });
        this.physics.rebuildFixture(playerFixture.key); // isTrigger=true rebuild.
        // Unlike CloseObj(player), CloseInstance(weapon) destroys its GameObject.
        this.weaponInstanceId = this.nextColliderInstanceId--;
        this.weaponParentSide = "left";
        this.weaponAnchoredOffset = 0;
        this.weaponRotationLeft = false;
        this.weaponPosition = this.world(this.geometry.weapon.left);
        this.physics.addFixture({ key: "weapon", bodyKey: "weapon", instanceId: this.weaponInstanceId, bodyType: "static",
            aabb: this.circleAabb(this.weaponPosition, f(.5 * Math.max(this.geometry.weapon.scaleX, this.geometry.weapon.scaleY) * unit)) });
        this.physics.rebuildFixture("weapon");
        this.physics.rebuildFixture("weapon", { aabb: this.weaponAabb() });
        this.physics.rebuildFixture("weapon");
        this.disableWeapon();
    }
    private createMonsterFixture(body: Body, existingBody = false, reusedKinematic = false): void {
        body.colliderInstanceId = this.nextColliderInstanceId--;
        const unit = this.geometry.worldUnitsPerDesignUnit;
        const sx = f(this.geometry.foreground.scaleX * unit), sy = f(this.geometry.foreground.scaleY * unit);
        const base = { x: body.x, y: body.y, halfX: f(.5 * sx), halfY: f(.5 * sy) };
        this.physics.addFixture({ key: body.physicsKey, bodyKey: body.physicsKey, instanceId: body.colliderInstanceId,
            bodyType: existingBody ? (reusedKinematic ? "kinematic" : "dynamic") : "static", aabb: this.boxAabb(base) });
        this.physics.rebuildFixture(body.physicsKey);
        this.physics.rebuildFixture(body.physicsKey); // isTrigger.
        this.physics.rebuildFixture(body.physicsKey, { aabb: this.boxAabb({ ...base, halfX: f(50 * sx), halfY: f((body.isBoss ? 65 : 40) * sy) }) });
        this.physics.rebuildFixture(body.physicsKey, { aabb: this.monsterAabb(body) });
        this.physics.setBodyType(body.physicsKey, "dynamic");
    }
    private openPooledFixture(body: Body, reused: Body): void {
        const group = body.background ? this.geometry.background : this.geometry.foreground;
        const point = this.world(group.parent);
        const atParent = { ...body, x: point.x, y: point.y, spawnSide: "left" as const };
        this.physics.addFixture({ key: body.physicsKey, bodyKey: body.physicsKey, instanceId: body.colliderInstanceId,
            bodyType: reused.kinematic ? "kinematic" : "dynamic", aabb: this.monsterAabb(atParent) });
        // OpenSpineIllust resets original root Z=99 to0 (TouchProxy), then changes
        // localScale Z=1 to0. The latter rebuilds even though planar scale is equal.
        this.physics.tree.touchProxy(this.physics.fixtures.get(body.physicsKey)!.proxyId);
        this.physics.rebuildFixture(body.physicsKey);
        if (body.spawnSide === "right")
            this.physics.rebuildFixture(body.physicsKey, { aabb: this.monsterAabb({ ...atParent, spawnSide: "right" }) });
        this.physics.synchronize(body.physicsKey, this.monsterAabb(body), { x: 0, y: 0 }, false);
        this.physics.tree.touchProxy(this.physics.fixtures.get(body.physicsKey)!.proxyId);
        if (!body.background)
            this.physics.rebuildFixture(body.physicsKey); // CreateMonster restores localScale Z=1.
        if (!body.background)
            this.physics.setBodyType(body.physicsKey, "dynamic", this.monsterAabb(body));
    }
    private flushColliderDestruction(): void {
        for (const body of this.pendingColliderDestruction) {
            this.physics.removeFixture(body.physicsKey);
            body.hasCollider = false;
        }
        this.pendingColliderDestruction = [];
    }
    private sensorOverlap(aKey: string, bKey: string): boolean {
        const getBox = (key: string) => key.startsWith("player") ? this.playerBox() : this.monsterBox(this.simulationBodies.find(b => b.physicsKey === key)!);
        if (aKey === "weapon" || bKey === "weapon") {
            const box = getBox(aKey === "weapon" ? bKey : aKey);
            const dx = Math.max(0, f(Math.abs(f(this.weaponPosition.x - box.x)) - box.halfX));
            const dy = Math.max(0, f(Math.abs(f(this.weaponPosition.y - box.y)) - box.halfY));
            return swordClientSensorOverlap(dx, dy, f(this.weaponRadius() + SWORD_CLIENT_PHYSICS.polygonRadius));
        }
        const a = getBox(aKey), b = getBox(bKey);
        const dx = Math.max(0, f(Math.abs(f(a.x - b.x)) - f(a.halfX + b.halfX)));
        const dy = Math.max(0, f(Math.abs(f(a.y - b.y)) - f(a.halfY + b.halfY)));
        return swordClientSensorOverlap(dx, dy, f(2 * SWORD_CLIENT_PHYSICS.polygonRadius));
    }
    private fixedStep(): void {
        if (this.phase !== "play")
            return;
        const overlap = (a: string, b: string) => this.sensorOverlap(a, b);
        this.physics.collide(overlap);
        const dt = SWORD_CLIENT_PHYSICS.fixedDeltaTime;
        for (const body of this.simulationBodies) {
            if (body.kinematic)
                continue;
            body.previousX = body.x;
            body.previousY = body.y;
            body.vx = f(body.vx + f(dt * f(f(1 / SWORD_CLIENT_PHYSICS.manualMass) * body.forceX)));
            if (body.hp <= 0) {
                body.vy = f(body.vy + f(dt * f(SWORD_CLIENT_PHYSICS.deathGravityScale * SWORD_CLIENT_PHYSICS.gravityY)));
            }
            body.forceX = 0;
            let dx = f(dt * body.vx);
            let dy = f(dt * body.vy);
            const distanceSquared = f(f(dx * dx) + f(dy * dy));
            if (distanceSquared > 10000) {
                const ratio = f(100 / Math.sqrt(distanceSquared));
                body.vx = f(body.vx * ratio);
                body.vy = f(body.vy * ratio);
                dx = f(dt * body.vx);
                dy = f(dt * body.vy);
            }
            body.x = f(body.x + dx);
            body.y = f(body.y + dy);
            if (this.physics.fixtures.has(body.physicsKey))
                this.physics.synchronize(body.physicsKey, this.monsterAabb(body), { x: f(body.x - body.previousX), y: f(body.y - body.previousY) }, true);
        }
        this.physics.finishIntegration(overlap);
        const callbacks = this.physics.collectCallbacks();
        for (const contact of callbacks) {
            if (contact.event !== "enter")
                continue;
            const target = contact.a.startsWith("player") || contact.a === "weapon" ? contact.a : contact.b;
            const body = this.bodies.find(b => b.physicsKey === (target === contact.a ? contact.b : contact.a));
            if (!body)
                continue;
            if (target.startsWith("player"))
                this.gameOver(body);
            else if (target === "weapon" && body.hp > 0)
                this.damage(body);
        }
    }
    private damage(body: Body): void {
        this.weaponHit = true;
        this.sound("FX_COMBAT_MONSTER_BEAST_VOICE_02");
        body.hp--;
        if (body.hp <= 0) {
            // Native AddForce returns for non-dynamic bodyType. A queued trigger can
            // still call DamageReceiver after GameOver has made the body kinematic.
            body.vx = body.kinematic ? 0 : body.spawnSide === "left" ? -600 : 600;
            body.vy = body.kinematic ? 0 : 1000;
            body.animation = "DEATH";
            body.animationTime = 0;
            body.loop = false;
            if (body.isBoss)
                this.bossKills++;
            else
                this.normalKills++;
            if (!body.isBoss && this.normalKills === 24 * (this.stage + 1))
                this.spawn(true);
            if (body.isBoss) {
                this.wait(SWORD_CLIENT_PHYSICS.stageDelay, () => {
                    this.stage++;
                    this.readyStage();
                });
            }
        }
        else {
            body.x = f(body.x + (body.spawnSide === "left" ? -SWORD_CLIENT_PHYSICS.knockback : SWORD_CLIENT_PHYSICS.knockback));
            body.previousX = body.x;
            body.previousY = body.y;
            this.physics.synchronize(body.physicsKey, this.monsterAabb(body), { x: 0, y: 0 }, false);
            this.physics.tree.touchProxy(this.physics.fixtures.get(body.physicsKey)!.proxyId);
        }
    }
    private gameOver(attacker: Body | null): void {
        if (this.phase !== "play")
            return;
        this.timers = [];
        for (const body of [...this.bodies, ...this.backgrounds]) {
            if (this.physics.fixtures.has(body.physicsKey))
                this.physics.setBodyType(body.physicsKey, "kinematic", this.monsterAabb(body));
            body.kinematic = true;
            body.vx = 0;
            body.vy = 0;
            body.forceX = 0;
            body.frozen = body !== attacker;
            if (body === attacker) {
                body.animation = "ATTACK";
                body.animationTime = 0;
                body.loop = true;
            }
        }
        this.weaponEnabled = false;
        this.disableWeapon();
        this.phase = "gameover";
        this.wait(attacker ? f(0.15) : f(0.1), () => {
            if (attacker) {
                this.playerFlipX = attacker.spawnSide === "left";
                this.playerGraphicAtRoot = true;
            }
            this.sound(attacker ? "VOICE_UNIT_ACADEMY_C_TWINTAIL_BATTLE_DAMAGE_1" : "VOICE_UNIT_ACADEMY_C_TWINTAIL_BATTLE_DAMAGE_2");
            this.setPlayerAnimation(attacker ? "DEATH2" : "DEATH1", false);
            // Both original player Spine timelines are exactly 3 seconds.
            this.wait(3, () => {
                this.resultScore = this.normalKills + this.bossKills;
                this.events.push({ type: "music", key: "UI_WARFARE_RESULT_WIN" });
                this.events.push({ type: "result", score: this.resultScore });
                this.phase = "result";
                this.timers = [];
                this.closeBodies([...this.bodies, ...this.backgrounds]);
                this.bodies = [];
                this.backgrounds = [];
                this.backgroundCounter = 0;
                this.nextMonsterId = 0;
                this.stage = 0;
                this.normalKills = 0;
                this.bossKills = 0;
            });
        });
    }
    private setPlayerAnimation(animation: string, loop: boolean): void {
        this.playerAnimation = animation;
        this.playerAnimationTime = 0;
        this.playerLoop = loop;
    }
    private sound(key: string): void {
        this.events.push({ type: "sound", key });
    }
}
