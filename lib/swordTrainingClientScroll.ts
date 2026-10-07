import type { ClientFields } from "./swordTrainingClientLayout";
/** UnityEngine.UI.ScrollRect's vertical, top-pivot path used by the rule prefab. */
export class SwordTrainingClientScroll {
    position: number;
    velocity = 0;
    dragging = false;
    private previous: number;
    private dragCursor = 0;
    private dragPosition = 0;
    private scrolling = false;
    readonly elasticity: number;
    readonly deceleration: number;
    readonly inertia: boolean;
    readonly sensitivity: number;
    constructor(fields: ClientFields, initialPosition: number) {
        if (fields.m_Horizontal || !fields.m_Vertical || fields.m_MovementType !== 1)
            throw new Error("Unverified source ScrollRect variant");
        this.position = initialPosition;
        this.previous = initialPosition;
        this.elasticity = Number(fields.m_Elasticity);
        this.deceleration = Number(fields.m_DecelerationRate);
        this.inertia = Boolean(fields.m_Inertia);
        this.sensitivity = Number(fields.m_ScrollSensitivity);
    }
    initializePotentialDrag(): void { this.velocity = 0; }
    /** Source OnDisable clears motion flags/velocity, but never content position. */
    disable(): void { this.dragging = false; this.scrolling = false; this.velocity = 0; }
    beginDrag(localY: number): void { this.dragCursor = localY; this.dragPosition = this.position; this.dragging = true; }
    endDrag(): void { this.dragging = false; }
    private offset(position: number, maximum: number): number {
        if (-position > Math.fround(0.001))
            return -position;
        if (maximum - position < -Math.fround(0.001))
            return maximum - position;
        return 0;
    }
    drag(localY: number, viewHeight: number, contentHeight: number): void {
        if (!this.dragging)
            return;
        const desired = this.dragPosition + localY - this.dragCursor;
        const offset = this.offset(desired, Math.max(0, contentHeight - viewHeight));
        const rubber = (1 - 1 / (Math.abs(offset) * Math.fround(0.55) / viewHeight + 1)) * viewHeight * Math.sign(offset);
        this.position = Math.fround(desired + offset - rubber);
    }
    /** Delta is already translated from browser input units to source UI units. */
    scroll(delta: number): void {
        this.position = Math.fround(this.position + delta * this.sensitivity);
        this.scrolling = true;
    }
    /** Scrollbar.onValueChanged -> ScrollRect.SetVerticalNormalizedPosition. */
    setNormalizedPosition(value: number, viewHeight: number, contentHeight: number): void {
        if (![value, viewHeight, contentHeight].every(Number.isFinite) || !(viewHeight > 0 && contentHeight >= 0)) {
            throw new RangeError("Invalid ScrollRect normalized position");
        }
        const maximum = Math.max(0, contentHeight - viewHeight);
        this.position = Math.fround(Math.max(0, Math.min(1, value)) * maximum);
        this.velocity = 0;
        this.scrolling = false;
        this.previous = this.position;
    }
    update(delta: number, viewHeight: number, contentHeight: number): number {
        if (![delta, viewHeight, contentHeight].every(Number.isFinite) || !(delta >= 0 && viewHeight > 0 && contentHeight >= 0))
            throw new RangeError("Invalid ScrollRect frame");
        const offset = this.offset(this.position, Math.max(0, contentHeight - viewHeight));
        if (delta > 0) {
            if (!this.dragging && (offset !== 0 || this.velocity !== 0)) {
                if (offset !== 0) {
                    // Original Mathf.SmoothDamp overload, maximum speed is Infinity.
                    const smoothTime = Math.max(Math.fround(0.0001), this.elasticity * (this.scrolling ? 3 : 1));
                    const omega = 2 / smoothTime;
                    const step = omega * delta;
                    const decay = 1 / (1 + step + Math.fround(0.48) * step * step + Math.fround(0.235) * step * step * step);
                    const target = this.position + offset;
                    const change = this.position - target;
                    const temp = (this.velocity + omega * change) * delta;
                    this.velocity = Math.fround((this.velocity - omega * temp) * decay);
                    const next = target + (change + temp) * decay;
                    if ((target - this.position > 0) === (next > target)) {
                        this.position = target;
                        this.velocity = 0;
                    }
                    else
                        this.position = Math.fround(next);
                    if (Math.abs(this.velocity) < 1)
                        this.velocity = 0;
                }
                else if (this.inertia) {
                    this.velocity = Math.fround(this.velocity * Math.pow(this.deceleration, delta));
                    if (Math.abs(this.velocity) < 1)
                        this.velocity = 0;
                    this.position = Math.fround(this.position + this.velocity * delta);
                }
                else
                    this.velocity = 0;
            }
            if (this.dragging && this.inertia) {
                const targetVelocity = (this.position - this.previous) / delta;
                this.velocity = Math.fround(this.velocity + (targetVelocity - this.velocity) * Math.min(1, delta * 10));
            }
        }
        this.previous = this.position;
        this.scrolling = false;
        return this.position;
    }
    preview(delta: number, viewHeight: number, contentHeight: number): number {
        const copy = Object.assign(Object.create(SwordTrainingClientScroll.prototype), this) as SwordTrainingClientScroll;
        return copy.update(delta, viewHeight, contentHeight);
    }
}
