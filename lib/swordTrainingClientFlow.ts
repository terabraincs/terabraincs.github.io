import { sampleSwordTrainingClientAnimation, type SwordTrainingClientAnimationClip } from "./swordTrainingClientAnimation.ts";
const f = Math.fround;
type AnimatorState = "INTRO" | "01_IDLE" | "01_to_02";
export type SwordClientFlowSnapshot = {
    phase: "intro" | "lobby" | "pending" | "entering" | "game" | "result";
    time: number;
    animatorClip: string;
    animatorTime: number;
    lobbyActive: boolean;
    gameActive: boolean;
    raycastActive: boolean;
    pendingStarts: number;
    openCalls: number;
};
/** Original AnimatorController + NKCUIModuleSubUISwordTraining.OnStart.
 * Native FlowProbe confirms that AnyState's ExitTime=0 waits for the end of
 * non-looping INTRO/01_to_02. A second trigger is a pending bool, not a debounce
 * or an immediate reset. Each original StartCoroutine still reaches Open.
 */
export class SwordTrainingClientFlow {
    private clips: Map<string, SwordTrainingClientAnimationClip>;
    private state: AnimatorState = "INTRO";
    private animatorTime = 0;
    private normalizedTime = 0;
    private trigger = false;
    private starts: {
        remaining: number;
        firstFrame: boolean;
        stage: "delay" | "normalized" | "final";
    }[] = [];
    private opened = false;
    private result = false;
    private resultTime = 0;
    private openCalls = 0;
    private sourceActive: Map<string, boolean>;
    constructor(clips: SwordTrainingClientAnimationClip[], nodes: {
        path: string;
        activeSelf: boolean;
    }[]) {
        this.clips = new Map(clips.filter(clip => clip.name).map(clip => [clip.name!, clip]));
        this.sourceActive = new Map(nodes.map(node => [node.path, node.activeSelf]));
        for (const name of ["INTRO", "01_IDLE", "01_to_02"])
            this.clip(name as AnimatorState);
    }
    private clip(state = this.state) {
        const clip = this.clips.get(`UI_SINGLE_SWORDTRAINING_${state}`);
        if (!clip)
            throw new Error(`Missing original flow animation ${state}`);
        return clip;
    }
    start(): void { this.starts.push({ remaining: f(0.1), firstFrame: true, stage: "delay" }); }
    showResult(): void { this.result = true; this.resultTime = 0; }
    restart(): void { this.result = false; }
    returnToLobby(): void {
        // AnyState 02_to_01 is immediate from completed 01_to_02; its actual motion
        // is 01_IDLE, with a ~2ns transition into 01_IDLE. Not the unused exit clip.
        this.state = "01_IDLE";
        this.animatorTime = 0;
        this.normalizedTime = 0;
        this.opened = false;
        this.result = false;
    }
    /** Returns the number of source Open invocations on this rendered frame. */
    advance(deltaSeconds: number): number {
        const delta = f(deltaSeconds);
        if (this.result)
            this.resultTime += deltaSeconds;
        let opens = 0;
        const nextStarts: typeof this.starts = [];
        // Unity resumes normal coroutines before the Animator evaluates this frame.
        for (const job of this.starts) {
            if (job.stage === "delay") {
                // WaitForSeconds starts at the end of the input frame, not its start.
                // The native wait duration is the float constructor value against the
                // elapsed clock, not an Animator-style repeatedly rounded float counter.
                // Native traces at 30/60/120/144 Hz distinguish both details.
                if (job.firstFrame) {
                    job.firstFrame = false;
                    nextStarts.push(job);
                    continue;
                }
                job.remaining -= delta;
                if (job.remaining <= 0) {
                    this.trigger = true;
                    job.stage = "normalized";
                }
            }
            else if (job.stage === "normalized") {
                if (this.normalizedTime >= 1)
                    job.stage = "final";
            }
            else {
                opens++;
                continue;
            }
            nextStarts.push(job);
        }
        this.starts = nextStarts;
        if (opens) {
            this.opened = true;
            this.openCalls += opens;
        }
        if (this.state === "01_IDLE" && this.trigger) {
            this.trigger = false;
            this.state = "01_to_02";
            this.normalizedTime = 0;
        }
        else {
            const previous = this.normalizedTime;
            const duration = this.clip().stopTime || 1;
            this.normalizedTime = f(previous + f(delta / duration));
            if (this.state !== "01_IDLE" && previous < 1 && this.normalizedTime >= 1) {
                const remainder = f(f(this.normalizedTime - 1) * duration);
                if (this.trigger) {
                    this.trigger = false;
                    this.state = "01_to_02";
                    this.normalizedTime = f(remainder / this.clip().stopTime);
                }
                else if (this.state === "INTRO") {
                    this.state = "01_IDLE";
                    this.normalizedTime = remainder;
                }
            }
        }
        this.animatorTime = f(this.normalizedTime * (this.clip().stopTime || 1));
        return opens;
    }
    snapshot(): SwordClientFlowSnapshot {
        const sample = sampleSwordTrainingClientAnimation(this.clip(), this.animatorTime);
        const active = (path: string) => {
            const sampled = sample[path]?.m_IsActive;
            if (sampled !== undefined)
                return sampled !== 0;
            const source = this.sourceActive.get(`UI_SINGLE_SWORDTRAINING/${path}`);
            if (source === undefined)
                throw new Error(`Missing original active state ${path}`);
            return source;
        };
        return {
            phase: this.result ? "result" : this.opened ? "game" : this.state === "01_to_02" ? "entering"
                : this.starts.length ? "pending" : this.state === "INTRO" ? "intro" : "lobby",
            time: this.result ? this.resultTime : this.animatorTime,
            animatorClip: this.clip().name!, animatorTime: this.animatorTime,
            lobbyActive: active("SWORD/Content/01"), gameActive: active("SWORD/Content/02"),
            raycastActive: active("SWORD/RaycastArea"), pendingStarts: this.starts.length, openCalls: this.openCalls,
        };
    }
}
