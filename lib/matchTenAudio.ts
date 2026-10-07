/** NKCGameOptionDataSt.Init defaults; GetSoundVolumeAsFloat divides by 100. */
export const MATCH_TEN_AUDIO_DEFAULTS = Object.freeze({
    master: 1,
    music: 0.7,
    sfx: 0.6,
    musicFactor: 1,
});
export const MAX_MATCH_TEN_SFX_VOICES = 30;
/**
 * NKCSoundManager.GetFinalMusicVolume/GetFinalVol source gain.
 * At these defaults, SetMixerVolume gives In/OutBgm and In/OutSoundNormal
 * 0 dB (-14 + 20 * 0.7 and -12 + 20 * 0.6 respectively).
 * The original AudioMixer's native effects are a separate, unimplemented DSP
 * stage; matching these gains is not a claim of identical mixed output.
 */
export function getMatchTenAudioVolume(kind: "bgm" | "sfx", localVolume = 1): number {
    // GetFinalMusicVol/GetFinalVol operate on System.Single at every multiply.
    let volume = Math.fround(Math.fround(kind === "bgm"
        ? MATCH_TEN_AUDIO_DEFAULTS.music
        : MATCH_TEN_AUDIO_DEFAULTS.sfx) * Math.fround(localVolume));
    if (kind === "bgm") {
        volume = Math.fround(volume * Math.fround(MATCH_TEN_AUDIO_DEFAULTS.musicFactor));
    }
    return Math.fround(volume * Math.fround(MATCH_TEN_AUDIO_DEFAULTS.master));
}
/** Minimal media surface, also usable by deterministic tests without a browser. */
export type MatchTenSfxAudio = {
    currentTime: number;
    play(): Promise<void>;
    pause(): void;
    addEventListener(type: "ended" | "error", listener: () => void): void;
    removeEventListener(type: "ended" | "error", listener: () => void): void;
};
type ActiveVoice = {
    onEnded: () => void;
    onError: () => void;
    onRelease?: () => void;
};
function stopPlayback(audio: MatchTenSfxAudio): void {
    try {
        audio.pause();
    }
    catch {
        // A media failure must not prevent voice bookkeeping from being released.
    }
    try {
        audio.currentTime = 0;
    }
    catch {
        // Seeking may be unavailable before metadata or after a media failure.
    }
}
/** One shared 30-voice pool for all Match Ten SFX; BGM stays outside this pool. */
export function createMatchTenSfxPlayer() {
    const active = new Map<MatchTenSfxAudio, ActiveVoice>();
    function release(audio: MatchTenSfxAudio, voice: ActiveVoice, stop: boolean): void {
        // The record identity is a generation guard: a stale rejected play promise
        // or queued event from an earlier playback cannot release its replacement.
        if (active.get(audio) !== voice)
            return;
        active.delete(audio);
        audio.removeEventListener("ended", voice.onEnded);
        audio.removeEventListener("error", voice.onError);
        if (stop)
            stopPlayback(audio);
        try {
            voice.onRelease?.();
        }
        catch {
            // Cleanup callbacks must not break the rest of the shared sound pool.
        }
    }
    function stop(audio: MatchTenSfxAudio | null): void {
        if (!audio)
            return;
        const voice = active.get(audio);
        if (voice)
            release(audio, voice, true);
        else
            stopPlayback(audio);
    }
    function play(audio: MatchTenSfxAudio | null, onRelease?: () => void): void {
        if (!audio)
            return;
        const previous = active.get(audio);
        if (previous)
            release(audio, previous, true);
        // Map insertion order is the latest playback start order, including replay.
        while (active.size >= MAX_MATCH_TEN_SFX_VOICES) {
            const oldest = active.entries().next().value;
            if (!oldest)
                break;
            release(oldest[0], oldest[1], true);
        }
        const voice: ActiveVoice = {
            onEnded: () => release(audio, voice, false),
            onError: () => release(audio, voice, true),
            onRelease,
        };
        active.set(audio, voice);
        audio.addEventListener("ended", voice.onEnded);
        audio.addEventListener("error", voice.onError);
        try {
            audio.currentTime = 0;
            void audio.play().catch(() => release(audio, voice, true));
        }
        catch {
            release(audio, voice, true);
        }
    }
    function stopAll(): void {
        for (const [audio, voice] of [...active])
            release(audio, voice, true);
    }
    return { play, stop, stopAll, getActiveCount: () => active.size };
}
