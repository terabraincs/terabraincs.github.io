export type MatchTenBoardCell = {
    id: number;
    value: number;
    snack: number;
    /** Compatibility mirror of the client's value === 0 cleared state. */
    removed: boolean;
    /** Mirrors m_objNum.activeInHierarchy, which is distinct from value === 0. */
    numberActive: boolean;
};
export type MatchTenPoint = {
    x: number;
    y: number;
};
export type MatchTenPointerBounds = {
    left: number;
    right: number;
    top: number;
    bottom: number;
};
export type MatchTenCellBounds = {
    left: number;
    right: number;
    top: number;
    bottom: number;
};
export type MatchTenBoardGeometry = {
    columns: number;
    rows: number;
    width: number;
    height: number;
    cellWidth: number;
    cellHeight: number;
    columnGap: number;
    rowGap: number;
    paddingBottom: number;
    contentLeft: number;
    contentTop: number;
};
/**
 * Values read from UI_SINGLE_MATCHTEN_INGAME/Center/BOARD's GridLayoutGroup.
 * Unity uses MiddleCenter alignment, a fixed 20-column constraint, and only a
 * 22 px bottom padding. Coordinates exposed by this module use a CSS-style
 * top-left origin.
 */
export const MATCH_TEN_CLIENT_BOARD_GEOMETRY: Readonly<MatchTenBoardGeometry> = Object.freeze({
    columns: 20,
    rows: 8,
    width: 1780,
    height: 694.23388671875,
    cellWidth: 62,
    cellHeight: 62,
    columnGap: 23,
    rowGap: 15,
    paddingBottom: 22,
    contentLeft: 51.5,
    contentTop: 35.616943359375,
});
export const MATCH_TEN_PERFECT_SCORE = 160;
const minimumCellValue = 1;
const maximumCellValue = 9;
const minimumSnack = 1;
const maximumSnack = 3;
type MatchTenRandom = () => number;
export type CreateMatchTenBoardOptions = {
    /** A Math.random-compatible source used only for the 1..9 cell rolls. */
    valueRandom?: MatchTenRandom;
    /**
     * A source for the once-per-board pantry sprite choice. The client consumes
     * this only after SetBoard has accepted a playable set of cell values.
     */
    pantryRandom?: MatchTenRandom;
    /** Fixes the pantry sprite and avoids consuming pantryRandom. */
    pantry?: 1 | 2 | 3;
};
export type MatchTenSelectionResolution = {
    pointerBounds: MatchTenPointerBounds;
    selectedIndices: number[];
    cellBounds: MatchTenCellBounds | null;
    sum: number;
    success: boolean;
    clearedCount: number;
    rawScore: number;
    score: number;
    complete: boolean;
    board: MatchTenBoardCell[];
};
function randomRange(minimum: number, maximumExclusive: number, random: MatchTenRandom) {
    const sample = random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
        throw new RangeError("Match Ten random sources must return a value in [0, 1).");
    }
    return Math.floor(sample * (maximumExclusive - minimum)) + minimum;
}
function getRandomCellValue(random: MatchTenRandom) {
    return randomRange(minimumCellValue, maximumCellValue + 1, random);
}
function getRandomSnack(random: MatchTenRandom) {
    return randomRange(minimumSnack, maximumSnack + 1, random);
}
function assertBoardDimensions(columns: number, rows: number) {
    if (!Number.isInteger(columns) || columns <= 0) {
        throw new RangeError("Match Ten columns must be a positive integer.");
    }
    if (!Number.isInteger(rows) || rows <= 0) {
        throw new RangeError("Match Ten rows must be a positive integer.");
    }
}
export function getMatchTenBoardIndex(column: number, row: number, columns = MATCH_TEN_CLIENT_BOARD_GEOMETRY.columns) {
    return row * columns + column;
}
export function getMatchTenBoardCoordinate(index: number, columns = MATCH_TEN_CLIENT_BOARD_GEOMETRY.columns) {
    return {
        column: index % columns,
        row: Math.floor(index / columns),
    };
}
/** Returns row-major array indices in the client's column-outer roll order. */
export function getMatchTenRollOrder(columns = MATCH_TEN_CLIENT_BOARD_GEOMETRY.columns, rows = MATCH_TEN_CLIENT_BOARD_GEOMETRY.rows) {
    assertBoardDimensions(columns, rows);
    const order: number[] = [];
    for (let column = 0; column < columns; column += 1) {
        for (let row = 0; row < rows; row += 1) {
            order.push(getMatchTenBoardIndex(column, row, columns));
        }
    }
    return order;
}
export function createMatchTenPreviewBoard(columns: number, rows: number) {
    assertBoardDimensions(columns, rows);
    return Array.from({ length: columns * rows }, (_, index) => ({
        id: index,
        value: (index % maximumCellValue) + minimumCellValue,
        snack: minimumSnack,
        removed: false,
        numberActive: true,
    }));
}
export function hasMatchTenMove(board: readonly MatchTenBoardCell[], columns: number, rows: number) {
    assertBoardDimensions(columns, rows);
    const prefix = Array.from({ length: rows + 1 }, () => Array<number>(columns + 1).fill(0));
    for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
            const value = board[getMatchTenBoardIndex(column, row, columns)]?.value ?? 0;
            prefix[row + 1][column + 1] =
                value +
                    prefix[row][column + 1] +
                    prefix[row + 1][column] -
                    prefix[row][column];
        }
    }
    for (let top = 0; top < rows; top += 1) {
        for (let bottom = top; bottom < rows; bottom += 1) {
            for (let left = 0; left < columns; left += 1) {
                for (let right = left; right < columns; right += 1) {
                    const sum = prefix[bottom + 1][right + 1] -
                        prefix[top][right + 1] -
                        prefix[bottom + 1][left] +
                        prefix[top][left];
                    if (sum === 10)
                        return true;
                }
            }
        }
    }
    return false;
}
/**
 * Mirrors NKCPopupMatchTen.SetBoard: slot storage stays row-major, while rolls
 * happen column first and then row. A reroll changes only non-zero values;
 * cleared slots and every slot's already-selected pantry sprite are retained.
 */
export function createPlayableMatchTenBoard(columns: number, rows: number, currentBoard?: readonly MatchTenBoardCell[], options: CreateMatchTenBoardOptions = {}) {
    assertBoardDimensions(columns, rows);
    const valueRandom = options.valueRandom ?? Math.random;
    const retainedPantry = currentBoard?.[0]?.snack ?? options.pantry;
    const rollOrder = getMatchTenRollOrder(columns, rows);
    let nextBoard: MatchTenBoardCell[];
    do {
        nextBoard = Array.from({ length: columns * rows }, (_, index) => {
            const currentCell = currentBoard?.[index];
            return {
                id: currentCell?.id ?? index,
                value: currentCell?.value ?? 0,
                // Initial SetBoardData(true) chooses this sprite only after SetBoard
                // accepts the values below. Use a placeholder until then so RNG call
                // order stays identical to the client.
                snack: currentCell?.snack ?? retainedPantry ?? minimumSnack,
                removed: currentCell?.value === 0,
                // SetBoardData(false) calls SetData for every slot after a reroll.
                // SetData explicitly disables m_objNum when the retained value is 0.
                numberActive: currentCell ? currentCell.value > 0 : true,
            };
        });
        for (const index of rollOrder) {
            const currentCell = currentBoard?.[index];
            if (currentCell?.value === 0)
                continue;
            nextBoard[index] = {
                id: currentCell?.id ?? index,
                value: getRandomCellValue(valueRandom),
                snack: currentCell?.snack ?? retainedPantry ?? minimumSnack,
                removed: false,
                numberActive: true,
            };
        }
    } while (!hasMatchTenMove(nextBoard, columns, rows));
    if (!currentBoard) {
        const pantry = retainedPantry ?? getRandomSnack(options.pantryRandom ?? Math.random);
        nextBoard = nextBoard.map((cell) => ({ ...cell, snack: pantry }));
    }
    return nextBoard;
}
export function getMatchTenPointerBounds(start: MatchTenPoint, end: MatchTenPoint): MatchTenPointerBounds {
    return {
        left: Math.min(start.x, end.x),
        right: Math.max(start.x, end.x),
        top: Math.min(start.y, end.y),
        bottom: Math.max(start.y, end.y),
    };
}
export function getMatchTenSlotCenter(column: number, row: number, geometry: Readonly<MatchTenBoardGeometry> = MATCH_TEN_CLIENT_BOARD_GEOMETRY): MatchTenPoint {
    return {
        x: geometry.contentLeft +
            geometry.cellWidth / 2 +
            column * (geometry.cellWidth + geometry.columnGap),
        y: geometry.contentTop +
            geometry.cellHeight / 2 +
            row * (geometry.cellHeight + geometry.rowGap),
    };
}
/** Converts browser pointer coordinates without clamping them to the board. */
export function getMatchTenBoardLocalPoint(clientX: number, clientY: number, renderedBounds: {
    left: number;
    top: number;
    width: number;
    height: number;
}, geometry: Readonly<MatchTenBoardGeometry> = MATCH_TEN_CLIENT_BOARD_GEOMETRY): MatchTenPoint {
    if (renderedBounds.width <= 0 || renderedBounds.height <= 0) {
        throw new RangeError("The rendered Match Ten board must have a positive size.");
    }
    return {
        x: ((clientX - renderedBounds.left) / renderedBounds.width) * geometry.width,
        y: ((clientY - renderedBounds.top) / renderedBounds.height) * geometry.height,
    };
}
/** Returns every geometrical slot center inside the raw pointer rectangle. */
export function getMatchTenSelectedSlotIndices(start: MatchTenPoint, end: MatchTenPoint, geometry: Readonly<MatchTenBoardGeometry> = MATCH_TEN_CLIENT_BOARD_GEOMETRY) {
    const bounds = getMatchTenPointerBounds(start, end);
    const indices: number[] = [];
    for (let row = 0; row < geometry.rows; row += 1) {
        for (let column = 0; column < geometry.columns; column += 1) {
            const center = getMatchTenSlotCenter(column, row, geometry);
            if (center.x >= bounds.left &&
                center.x <= bounds.right &&
                center.y >= bounds.top &&
                center.y <= bounds.bottom) {
                indices.push(getMatchTenBoardIndex(column, row, geometry.columns));
            }
        }
    }
    return indices;
}
/**
 * Mirrors OnDrag's m_objNum.activeInHierarchy guard. A slot cleared since the
 * last reroll remains active during its CLEAR animation/state; a zero slot
 * passed through SetData by a reroll is inactive and cannot extend the bounds.
 */
export function getMatchTenSelectableSlotIndices(board: readonly MatchTenBoardCell[], start: MatchTenPoint, end: MatchTenPoint, geometry: Readonly<MatchTenBoardGeometry> = MATCH_TEN_CLIENT_BOARD_GEOMETRY) {
    return getMatchTenSelectedSlotIndices(start, end, geometry).filter((index) => board[index]?.numberActive === true);
}
export function getMatchTenCellBounds(indices: readonly number[], columns = MATCH_TEN_CLIENT_BOARD_GEOMETRY.columns): MatchTenCellBounds | null {
    if (indices.length === 0)
        return null;
    let left = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    let top = Number.POSITIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;
    for (const index of indices) {
        const coordinate = getMatchTenBoardCoordinate(index, columns);
        left = Math.min(left, coordinate.column);
        right = Math.max(right, coordinate.column);
        top = Math.min(top, coordinate.row);
        bottom = Math.max(bottom, coordinate.row);
    }
    return { left, right, top, bottom };
}
export function getMatchTenBoundsSum(board: readonly MatchTenBoardCell[], bounds: MatchTenCellBounds, columns = MATCH_TEN_CLIENT_BOARD_GEOMETRY.columns) {
    let sum = 0;
    for (let row = bounds.top; row <= bounds.bottom; row += 1) {
        for (let column = bounds.left; column <= bounds.right; column += 1) {
            sum += board[getMatchTenBoardIndex(column, row, columns)]?.value ?? 0;
        }
    }
    return sum;
}
export function resolveMatchTenScore(rawScore: number, perfectScore = MATCH_TEN_PERFECT_SCORE) {
    const complete = rawScore >= perfectScore - 1;
    return {
        rawScore,
        score: complete ? perfectScore : rawScore,
        complete,
    };
}
/** Applies the client's drag-release sum, clear, score, and 159->160 rule. */
export function resolveMatchTenSelection(board: readonly MatchTenBoardCell[], currentScore: number, start: MatchTenPoint, end: MatchTenPoint, geometry: Readonly<MatchTenBoardGeometry> = MATCH_TEN_CLIENT_BOARD_GEOMETRY): MatchTenSelectionResolution {
    const pointerBounds = getMatchTenPointerBounds(start, end);
    const selectedIndices = getMatchTenSelectableSlotIndices(board, start, end, geometry);
    const cellBounds = getMatchTenCellBounds(selectedIndices, geometry.columns);
    const sum = cellBounds ? getMatchTenBoundsSum(board, cellBounds, geometry.columns) : 0;
    const success = cellBounds !== null && sum === 10;
    if (!success || !cellBounds) {
        return {
            pointerBounds,
            selectedIndices,
            cellBounds,
            sum,
            success: false,
            clearedCount: 0,
            rawScore: currentScore,
            score: currentScore,
            complete: false,
            board: board.slice(),
        };
    }
    let clearedCount = 0;
    const nextBoard = board.map((cell, index) => {
        const { column, row } = getMatchTenBoardCoordinate(index, geometry.columns);
        const isInside = column >= cellBounds.left &&
            column <= cellBounds.right &&
            row >= cellBounds.top &&
            row <= cellBounds.bottom;
        if (!isInside)
            return cell;
        if (cell.value > 0) {
            clearedCount += 1;
            // SetNumberOff writes m_Num=0 and triggers CLEAR, but does not disable
            // m_objNum. It stays selectable until a later reroll calls SetData(0).
            return { ...cell, value: 0, removed: true, numberActive: true };
        }
        return { ...cell, value: 0, removed: true };
    });
    const score = resolveMatchTenScore(currentScore + clearedCount, board.length);
    return {
        pointerBounds,
        selectedIndices,
        cellBounds,
        sum,
        success: true,
        clearedCount,
        rawScore: score.rawScore,
        score: score.score,
        complete: score.complete,
        board: nextBoard,
    };
}
