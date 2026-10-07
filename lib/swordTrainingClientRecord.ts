/** Browser-only adapter for the explicitly selected original mini-game 1103.
 * The source commits a completed result and compares NEW_RECORD with the old
 * best using strict greater-than. No account, inventory or reward receipts are
 * persisted here; the browser storage key is independent of the other games.
 */
export const SWORD_TRAINING_EVENT_ID = 1103 as const;
export const SWORD_TRAINING_RECORD_KEY = "counterside.sword-training.1103.record.v1";
export type SwordTrainingRecord = {
    version: 1;
    eventId: 1103;
    bestScore: number;
};
type RecordReader = Pick<Storage, "getItem">;
type RecordStorage = RecordReader & Pick<Storage, "setItem">;
export function emptySwordTrainingRecord(): SwordTrainingRecord {
    return { version: 1, eventId: SWORD_TRAINING_EVENT_ID, bestScore: 0 };
}
function isScore(value: unknown): value is number {
    // Source score is an Int32. 100 is the final reward threshold, not a score cap.
    return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 2147483647;
}
export function parseSwordTrainingRecord(raw: string | null): SwordTrainingRecord {
    try {
        const value: unknown = raw === null ? null : JSON.parse(raw);
        if (value && typeof value === "object" && !Array.isArray(value)) {
            const record = value as Record<string, unknown>;
            if (record.version === 1 && record.eventId === SWORD_TRAINING_EVENT_ID && isScore(record.bestScore)) {
                // Never retain unknown fields such as account IDs or claimed rewards.
                return { version: 1, eventId: SWORD_TRAINING_EVENT_ID, bestScore: record.bestScore };
            }
        }
    }
    catch { /* A malformed local value must not prevent the game from loading. */ }
    return emptySwordTrainingRecord();
}
export function readSwordTrainingRecord(storage: RecordReader | null): {
    record: SwordTrainingRecord;
    available: boolean;
} {
    if (storage) {
        try {
            return { record: parseSwordTrainingRecord(storage.getItem(SWORD_TRAINING_RECORD_KEY)), available: true };
        }
        catch { /* Private mode / browser policy can deny even getItem. */ }
    }
    return { record: emptySwordTrainingRecord(), available: false };
}
export function recordSwordTrainingResult(storage: RecordStorage | null, current: SwordTrainingRecord, score: number): {
    record: SwordTrainingRecord;
    previousBestScore: number;
    isNewRecord: boolean;
    persisted: boolean;
} {
    const saved = readSwordTrainingRecord(storage);
    const memoryBest = current.version === 1 && current.eventId === SWORD_TRAINING_EVENT_ID && isScore(current.bestScore) ? current.bestScore : 0;
    // Re-read at result time so a stale tab cannot knowingly overwrite a better
    // result from another tab. The storage-event adapter also reconciles races.
    const previousBestScore = Math.max(memoryBest, saved.record.bestScore);
    const isNewRecord = isScore(score) && score > previousBestScore;
    const record: SwordTrainingRecord = { version: 1, eventId: SWORD_TRAINING_EVENT_ID,
        bestScore: isNewRecord ? score : previousBestScore };
    let persisted = saved.available && saved.record.bestScore >= record.bestScore;
    if (isScore(score) && saved.available && !persisted && storage) {
        try {
            storage.setItem(SWORD_TRAINING_RECORD_KEY, JSON.stringify(record));
            persisted = true;
        }
        catch { /* Keep the new best in memory; the UI reports that it was not saved. */ }
    }
    return { record, previousBestScore, isNewRecord, persisted };
}
/** A queued StorageEvent may contain a higher score than the latest disk value
 * after competing writes. Preserve that observed maximum, even if its tab has
 * already closed, then reconcile disk without changing a result popup's flag. */
export function synchronizeSwordTrainingRecord(storage: RecordStorage | null, current: SwordTrainingRecord, eventValue: string | null) {
    const observed = parseSwordTrainingRecord(eventValue);
    const memoryBest = isScore(current.bestScore) && current.version === 1 && current.eventId === SWORD_TRAINING_EVENT_ID ? current.bestScore : 0;
    const record = { ...emptySwordTrainingRecord(), bestScore: Math.max(memoryBest, observed.bestScore) };
    return recordSwordTrainingResult(storage, record, record.bestScore);
}
