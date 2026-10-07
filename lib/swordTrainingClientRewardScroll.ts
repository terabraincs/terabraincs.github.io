import type { ClientFields } from './swordTrainingClientLayout';
const f = Math.fround;
const nonzero = (value: number) => f(value * value) >= f(1e-10); // Vector2 != zero.
/** Original LoopScrollRect.dll vertical/elastic path, distinct from rule ScrollRect. */
export class SwordTrainingClientRewardScroll {
    private localPosition: number;
    velocity = 0;
    dragging = false;
    private previous: number;
    private dragCursor = 0;
    private dragPosition = 0;
    readonly elasticity: number;
    readonly deceleration: number;
    readonly inertia: boolean;
    readonly sensitivity: number;
    readonly rubberScale: number;
    private virtualRows: {
        count: number;
        rowHeight: number;
        spacing: number;
        viewHeight: number;
        poolCount: number;
    } | null = null;
    private rowStart = 0;
    /** Logical offset for rendering all source rows; native arithmetic uses localPosition. */
    get position(): number { return f(this.localPosition + f(this.rowStart * this.stride)); }
    set position(value: number) { this.localPosition = f(value - f(this.rowStart * this.stride)); }
    get nativePosition(): number { return this.localPosition; }
    get firstRow(): number { return this.rowStart; }
    get preparedRowCount(): number { return this.virtualRows?.poolCount ?? 0; }
    private get stride(): number { return this.virtualRows ? f(this.virtualRows.rowHeight + this.virtualRows.spacing) : 0; }
    /** Original PrepareCells: fill view+100, then append one extra row (m_bUseHack=true). */
    configureRows(options: {
        count: number;
        rowHeight: number;
        spacing: number;
        viewHeight: number;
    }): void {
        const stride = f(options.rowHeight + options.spacing);
        // Unity layout groups permit negative spacing (the original item-box drop
        // list uses -4.5). LoopScrollRect only needs a finite, positive stride.
        if (!Number.isInteger(options.count) || options.count < 0
            || ![options.rowHeight, options.spacing, options.viewHeight].every(Number.isFinite)
            || !(options.rowHeight > 0 && stride > 0 && options.viewHeight > 0))
            throw new RangeError('Invalid original reward row geometry');
        if (this.virtualRows) {
            if (Object.entries(options).some(([key, value]) => this.virtualRows![key as keyof typeof options] !== value))
                throw new Error('Reward row geometry changed after native PrepareCells');
            return;
        }
        let extent = 0, poolCount = 0;
        while (f(options.viewHeight + 100) > extent) {
            extent = f(extent + stride);
            poolCount++;
        }
        this.virtualRows = { ...options, poolCount: poolCount + 1 };
    }
    private physicalContent(content: number): number {
        if (!this.virtualRows)
            return f(content);
        const count = Math.min(this.virtualRows.poolCount, this.virtualRows.count);
        return Math.max(0, f(f(count * this.stride) - this.virtualRows.spacing));
    }
    constructor(fields: ClientFields, initialPosition = 0) {
        if (fields.m_Horizontal || !fields.m_Vertical || fields.m_MovementType !== 1 || fields.reverseDirection)
            throw new Error('Unverified reward LoopScrollRect variant');
        this.localPosition = this.previous = f(initialPosition);
        this.elasticity = f(Number(fields.m_Elasticity));
        this.deceleration = f(Number(fields.m_DecelerationRate));
        this.inertia = Boolean(fields.m_Inertia);
        this.sensitivity = f(Number(fields.m_ScrollSensitivity));
        this.rubberScale = f(Number(fields.rubberScale));
        if (![this.elasticity, this.deceleration, this.sensitivity, this.rubberScale].every(Number.isFinite))
            throw new Error('Missing original reward scroll fields');
    }
    /** SetIndexPosition + RefreshCells do not reset velocity/drag flags. */
    reset(position = 0): void { this.localPosition = f(position); this.rowStart = 0; }
    initializePotentialDrag(): void { this.velocity = 0; }
    /** Unlike stock ScrollRect, source OnDisable does not clear m_Dragging. */
    disable(): void { this.velocity = 0; }
    beginDrag(localY: number): void { this.dragCursor = f(localY); this.dragPosition = this.localPosition; this.dragging = true; }
    endDrag(): void { this.dragging = false; }
    private offset(position: number, view: number, content: number): number {
        // CalculateOffset uses strict bounds comparisons, not stock .001 tolerance.
        const maximum = Math.max(0, f(this.physicalContent(content) - view));
        if (position < 0)
            return f(-position);
        if (position > maximum)
            return f(maximum - position);
        return 0;
    }
    private rubber(offset: number, view: number): number {
        return f(f(f(1 - f(1 / f(f(f(Math.abs(offset) * f(.55)) / view) + 1))) * view) * (offset >= 0 ? 1 : -1));
    }
    private dimensions(view: number, content: number): void {
        if (!(Number.isFinite(view) && view > 0 && Number.isFinite(content) && content >= 0))
            throw new RangeError('Invalid reward content bounds');
    }
    private setPosition(position: number): void {
        if (!nonzero(f(position - this.localPosition)))
            return;
        this.localPosition = position;
        const rows = this.virtualRows;
        if (!rows)
            return;
        // SetContentAnchoredPosition invokes UpdateBounds(true), which moves at most
        // one pooled row. Offset/RubberDelta were evaluated against the OLD pool.
        let shift = 0;
        if (this.localPosition > f(this.physicalContent(0) - rows.viewHeight)) {
            if (this.rowStart + Math.min(rows.poolCount, rows.count) < rows.count) {
                this.rowStart++;
                shift = -this.stride;
            }
        }
        else if (this.localPosition < 0 && this.rowStart > 0) {
            this.rowStart--;
            shift = this.stride;
        }
        if (shift !== 0) {
            this.localPosition = f(this.localPosition + shift);
            this.previous = f(this.previous + shift);
            this.dragPosition = f(this.dragPosition + shift);
        }
    }
    drag(localY: number, viewHeight: number, contentHeight: number): void {
        if (!this.dragging)
            return;
        this.dimensions(viewHeight, contentHeight);
        const desired = f(this.dragPosition + f(f(f(localY) - this.dragCursor) * this.sensitivity));
        const offset = this.offset(desired, f(viewHeight), f(contentHeight));
        this.setPosition(f(f(desired + offset) - f(this.rubber(offset, f(viewHeight)) * this.rubberScale)));
    }
    /** Browser adapter supplies down-positive wheel notches; native adds 150*sensitivity. */
    scroll(notches: number, viewHeight: number, contentHeight: number): void {
        this.dimensions(viewHeight, contentHeight);
        const desired = f(this.localPosition + f(f(f(notches) * this.sensitivity) * 150));
        const offset = this.offset(desired, f(viewHeight), f(contentHeight));
        this.dragging = true; // Original OnScroll does not clear this on the next frame.
        this.setPosition(f(f(desired + offset) - f(f(this.rubber(offset, f(viewHeight)) * this.rubberScale) * .5)));
    }
    /** NKCUIComLoopScrollHotkey passes ±4000*Time.deltaTime to MovePosition. */
    move(deltaUIUnits: number): void {
        this.dragging = false;
        this.setPosition(f(this.localPosition + f(f(deltaUIUnits) * this.sensitivity)));
    }
    /** Scrollbar.onValueChanged -> LoopScrollRect.SetVerticalNormalizedPosition.
     * A pooled fixed-row list selects the logical row window before assigning
     * the local content position; a fully materialized flexible list has no
     * virtualRows and therefore uses the complete source content directly. */
    setNormalizedPosition(value: number, viewHeight: number, contentHeight: number): void {
        this.dimensions(viewHeight, contentHeight);
        if (!Number.isFinite(value))
            throw new RangeError('Invalid reward normalized position');
        const logicalPosition = f(Math.max(0, Math.min(1, value)) * Math.max(0, f(contentHeight - viewHeight)));
        const rows = this.virtualRows;
        if (rows) {
            const visible = Math.min(rows.poolCount, rows.count);
            const maximumStart = Math.max(0, rows.count - visible);
            this.rowStart = Math.min(maximumStart, Math.max(0, Math.floor(logicalPosition / this.stride)));
        }
        this.localPosition = f(logicalPosition - f(this.rowStart * this.stride));
        this.previous = this.localPosition;
        this.dragPosition = this.localPosition;
        this.velocity = 0;
    }
    update(delta: number, viewHeight: number, contentHeight: number): number {
        this.dimensions(viewHeight, contentHeight);
        if (!(Number.isFinite(delta) && delta >= 0))
            throw new RangeError('Invalid reward scroll delta');
        const dt = f(delta);
        const offset = this.offset(this.localPosition, f(viewHeight), f(contentHeight));
        if (dt > 0) {
            if (!this.dragging && (nonzero(offset) || nonzero(this.velocity))) {
                let next = this.localPosition;
                if (offset !== 0) {
                    const target = f(this.localPosition + offset);
                    const smoothTime = Math.max(f(.0001), this.elasticity); // No stock wheel ×3.
                    const omega = f(2 / smoothTime), x = f(omega * dt);
                    const decay = f(1 / f(f(f(1 + x) + f(f(f(.48) * x) * x)) + f(f(f(f(.235) * x) * x) * x)));
                    const change = f(this.localPosition - target);
                    const temp = f(f(this.velocity + f(omega * change)) * dt);
                    this.velocity = f(f(this.velocity - f(omega * temp)) * decay);
                    next = f(target + f(f(change + temp) * decay));
                    if ((f(target - this.localPosition) > 0) === (next > target)) {
                        next = target;
                        this.velocity = f(f(next - target) / dt);
                    }
                }
                else if (this.inertia) {
                    this.velocity = f(this.velocity * f(Math.pow(this.deceleration, dt)));
                    if (Math.abs(this.velocity) < 1)
                        this.velocity = 0;
                    next = f(next + f(this.velocity * dt));
                }
                else
                    this.velocity = 0;
                // The original only commits the proposed position if Vector2 velocity != zero.
                if (nonzero(this.velocity))
                    this.setPosition(next);
            }
            if (this.dragging && this.inertia) {
                const targetVelocity = f(f(this.localPosition - this.previous) / dt);
                const factor = Math.min(1, Math.max(0, f(dt * 10)));
                this.velocity = f(this.velocity + f(f(targetVelocity - this.velocity) * factor));
            }
        }
        this.previous = this.localPosition;
        return this.position;
    }
    preview(delta: number, viewHeight: number, contentHeight: number): number {
        const copy = Object.assign(Object.create(SwordTrainingClientRewardScroll.prototype), this) as SwordTrainingClientRewardScroll;
        return copy.update(delta, viewHeight, contentHeight);
    }
}
