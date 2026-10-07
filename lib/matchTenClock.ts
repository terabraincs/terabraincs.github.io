/** Exact Stopwatch-to-centisecond conversion used by NKCPopupMatchTen. */
export function getMatchTenElapsedMilliseconds(elapsedBeforeRun: number, runStartedAt: number | null, now: number) {
    const elapsed = elapsedBeforeRun + (runStartedAt === null ? 0 : now - runStartedAt);
    return Math.max(0, Math.trunc(elapsed));
}
export function getMatchTenRemainingCentiseconds(totalSeconds: number, elapsedBeforeRun: number, runStartedAt: number | null, now: number) {
    const totalMilliseconds = totalSeconds * 1000;
    const elapsedMilliseconds = getMatchTenElapsedMilliseconds(elapsedBeforeRun, runStartedAt, now);
    return Math.max(0, Math.trunc((totalMilliseconds - elapsedMilliseconds) / 10));
}
export function isMatchTenTimerExpired(totalSeconds: number, elapsedBeforeRun: number, runStartedAt: number | null, now: number) {
    return (getMatchTenElapsedMilliseconds(elapsedBeforeRun, runStartedAt, now) >=
        totalSeconds * 1000);
}
