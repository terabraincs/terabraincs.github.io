export type MatchTenRecord = {
    bestScore: number;
    /** Remaining time in the client's integer 1/100-second unit. */
    bestTimeLeft: number;
};
export type MatchTenRecordLimits = {
    maxScore: number;
    maxTimeLeft: number;
};
export type MatchTenRecordStorage = Pick<Storage, "getItem" | "setItem">;
export type MatchTenRecordUpdate = {
    record: MatchTenRecord;
    scoreIsNewRecord: boolean;
    timeIsNewRecord: boolean;
};
export const EMPTY_MATCH_TEN_RECORD: Readonly<MatchTenRecord> = Object.freeze({
    bestScore: 0,
    bestTimeLeft: 0,
});
export const MATCH_TEN_RECORD_STORAGE_KEY = "counterside:minigames:match-ten:1001:record:v1";
function isValidInteger(value: unknown, maximum: number): value is number {
    return (typeof value === "number" &&
        Number.isSafeInteger(value) &&
        value >= 0 &&
        value <= maximum);
}
function areValidLimits(limits: MatchTenRecordLimits): boolean {
    return (isValidInteger(limits.maxScore, Number.MAX_SAFE_INTEGER) &&
        isValidInteger(limits.maxTimeLeft, Number.MAX_SAFE_INTEGER));
}
function readValidRecord(value: unknown, limits: MatchTenRecordLimits): MatchTenRecord | null {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return null;
    }
    const candidate = value as Record<string, unknown>;
    if (!isValidInteger(candidate.bestScore, limits.maxScore) ||
        !isValidInteger(candidate.bestTimeLeft, limits.maxTimeLeft)) {
        return null;
    }
    return {
        bestScore: candidate.bestScore,
        bestTimeLeft: candidate.bestTimeLeft,
    };
}
function resolveStorage(storage: MatchTenRecordStorage | null | undefined): MatchTenRecordStorage | null {
    if (storage !== undefined)
        return storage;
    try {
        return typeof window === "undefined" ? null : window.localStorage;
    }
    catch {
        // Browser policy can throw even while accessing the localStorage getter.
        return null;
    }
}
function readStoredRecord(limits: MatchTenRecordLimits, storage: MatchTenRecordStorage | null): {
    record: MatchTenRecord;
    canWrite: boolean;
} {
    const empty = { ...EMPTY_MATCH_TEN_RECORD };
    if (!storage)
        return { record: empty, canWrite: false };
    let serialized: string | null;
    try {
        serialized = storage.getItem(MATCH_TEN_RECORD_STORAGE_KEY);
    }
    catch {
        // Do not overwrite an unreadable record: another tab may have a higher one.
        return { record: empty, canWrite: false };
    }
    if (serialized === null)
        return { record: empty, canWrite: true };
    try {
        const payload: unknown = JSON.parse(serialized);
        if (typeof payload !== "object" ||
            payload === null ||
            Array.isArray(payload) ||
            (payload as Record<string, unknown>).version !== 1) {
            return { record: empty, canWrite: true };
        }
        return {
            record: readValidRecord(payload, limits) ?? empty,
            canWrite: true,
        };
    }
    catch {
        return { record: empty, canWrite: true };
    }
}
/** Read-only hydration: loading never saves or removes browser data. */
export function loadMatchTenRecord(limits: MatchTenRecordLimits, storage?: MatchTenRecordStorage | null): MatchTenRecord {
    if (!areValidLimits(limits))
        return { ...EMPTY_MATCH_TEN_RECORD };
    return readStoredRecord(limits, resolveStorage(storage)).record;
}
/** NKCMatchTenManager.SetMyScore compares score and remaining time independently. */
export function saveMatchTenResult(previous: MatchTenRecord, result: {
    score: number;
    timeLeft: number;
}, limits: MatchTenRecordLimits, storage?: MatchTenRecordStorage | null): MatchTenRecordUpdate {
    const unchanged = (record: MatchTenRecord): MatchTenRecordUpdate => ({
        record,
        scoreIsNewRecord: false,
        timeIsNewRecord: false,
    });
    if (!areValidLimits(limits)) {
        return unchanged({ ...EMPTY_MATCH_TEN_RECORD });
    }
    const target = resolveStorage(storage);
    const stored = readStoredRecord(limits, target);
    const memory = readValidRecord(previous, limits) ?? EMPTY_MATCH_TEN_RECORD;
    const baseline = {
        bestScore: Math.max(memory.bestScore, stored.record.bestScore),
        bestTimeLeft: Math.max(memory.bestTimeLeft, stored.record.bestTimeLeft),
    };
    if (!isValidInteger(result.score, limits.maxScore) ||
        !isValidInteger(result.timeLeft, limits.maxTimeLeft)) {
        return unchanged(baseline);
    }
    const record = {
        bestScore: Math.max(baseline.bestScore, result.score),
        bestTimeLeft: Math.max(baseline.bestTimeLeft, result.timeLeft),
    };
    if (target && stored.canWrite) {
        try {
            target.setItem(MATCH_TEN_RECORD_STORAGE_KEY, JSON.stringify({
                version: 1,
                bestScore: record.bestScore,
                bestTimeLeft: record.bestTimeLeft,
            }));
        }
        catch {
            // Private mode/quota failures must not interrupt the completed game.
        }
    }
    return {
        record,
        scoreIsNewRecord: result.score > baseline.bestScore,
        timeIsNewRecord: result.timeLeft > baseline.bestTimeLeft,
    };
}
