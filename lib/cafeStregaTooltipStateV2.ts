/** Original NKCUITooltip screen quadrant/pivot, exact 50-unit offset and vertical overflow adjustment. */
export type CafeTooltipPivot = 0 | 1 | 2 | 3 | 4;
export function cafeTooltipPosition(screen: {
    width: number;
    height: number;
}, screenPoint: {
    x: number;
    y: number;
} | null, localPoint: {
    x: number;
    y: number;
}, canvasHeight: number, panelHeight: number) {
    // ScreenPoint is Unity coordinates (origin bottom-left), localPoint is the
    // original sub-camera ScreenPointToLocalPointInRectangle result.
    const pivotType: CafeTooltipPivot = screenPoint === null ? 0 : screenPoint.x > screen.width * 0.5
        ? screenPoint.y > screen.height * 0.5 ? 1 : 2 : screenPoint.y > screen.height * 0.5 ? 3 : 4;
    const pivots = [[0.5, 0.5], [1, 1], [1, 0], [0, 1], [0, 0]] as const;
    if (pivotType === 0)
        return { pivotType, pivot: pivots[0], position: [0, 0] as const };
    const isRight = pivotType === 1 || pivotType === 2;
    const isUp = pivotType === 1 || pivotType === 3;
    const x = localPoint.x + (isRight ? -50 : 50);
    let y = localPoint.y + (isUp ? -50 : 50);
    const needed = panelHeight + 50;
    const available = canvasHeight * 0.5 + (isUp ? localPoint.y : -localPoint.y);
    if (needed > available)
        y += (needed - available) * (isUp ? 1 : -1);
    return { pivotType, pivot: pivots[pivotType], position: [x, y] as const };
}
/** Source closes on !Input.anyKey, or held mouse travel squared strictly >10000. */
export function cafeTooltipShouldClose(anyKey: boolean, mouseHeld: boolean, firstTouch: {
    x: number;
    y: number;
}, currentTouch: {
    x: number;
    y: number;
}) {
    return !anyKey || mouseHeld && (firstTouch.x - currentTouch.x) ** 2 + (firstTouch.y - currentTouch.y) ** 2 > 10000;
}
