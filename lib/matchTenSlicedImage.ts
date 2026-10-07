export type MatchTenSlicePatch = {
    sx: number;
    sy: number;
    sw: number;
    sh: number;
    dx: number;
    dy: number;
    dw: number;
    dh: number;
};
export type MatchTenSliceLayout = {
    width: number;
    height: number;
    patches: MatchTenSlicePatch[];
};
function destinationEdges(targetSize: number, backingSize: number, leading: number, trailing: number) {
    const borderSize = leading + trailing;
    // Unity Image.GetAdjustedBorders proportionally shrinks both borders when
    // their sum exceeds the target rectangle. The original source cuts stay put.
    const collapsedCenter = borderSize > 0 && targetSize <= borderSize;
    const first = collapsedCenter
        ? targetSize * (leading / borderSize)
        : leading;
    const second = collapsedCenter ? first : targetSize - trailing;
    // Snap each shared edge once, not each patch's position/size independently.
    // This only snaps the final raster grid; exact client border values above are
    // retained, and adjacent draws neither overlap nor leave uncovered pixels.
    return [
        0,
        Math.round((first / targetSize) * backingSize),
        Math.round((second / targetSize) * backingSize),
        backingSize,
    ] as const;
}
/** Build one Canvas raster from the exact Unity [left, bottom, right, top] cuts. */
export function getMatchTenSliceLayout(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number, border: readonly [
    number,
    number,
    number,
    number
], pixelRatio = 1): MatchTenSliceLayout {
    const empty: MatchTenSliceLayout = { width: 0, height: 0, patches: [] };
    const dimensions = [
        sourceWidth,
        sourceHeight,
        targetWidth,
        targetHeight,
        pixelRatio,
    ];
    if (dimensions.some((value) => !Number.isFinite(value) || value <= 0)) {
        return empty;
    }
    const [left, bottom, right, top] = border;
    if (border.some((value) => !Number.isFinite(value) || value < 0) ||
        left + right > sourceWidth ||
        top + bottom > sourceHeight) {
        throw new RangeError("Match Ten sprite borders exceed the source image");
    }
    const width = Math.ceil(targetWidth * pixelRatio);
    const height = Math.ceil(targetHeight * pixelRatio);
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height))
        return empty;
    // PNG/Canvas starts at the top; Unity's serialized border stores bottom first.
    const sourceX = [0, left, sourceWidth - right, sourceWidth];
    const sourceY = [0, top, sourceHeight - bottom, sourceHeight];
    const targetX = destinationEdges(targetWidth, width, left, right);
    const targetY = destinationEdges(targetHeight, height, top, bottom);
    const patches: MatchTenSlicePatch[] = [];
    for (let row = 0; row < 3; row += 1) {
        for (let column = 0; column < 3; column += 1) {
            const sx = sourceX[column];
            const sy = sourceY[row];
            const sw = sourceX[column + 1] - sx;
            const sh = sourceY[row + 1] - sy;
            const dx = targetX[column];
            const dy = targetY[row];
            const dw = targetX[column + 1] - dx;
            const dh = targetY[row + 1] - dy;
            if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0)
                continue;
            patches.push({ sx, sy, sw, sh, dx, dy, dw, dh });
        }
    }
    return { width, height, patches };
}
