import { deploymentUrl } from "@/lib/deployment";
export type SwordClientAudioManifest = {
    clips: Record<string, {
        webPath: string;
        kind: "music" | "sound";
    }>;
};
const SWORD_TRAINING_RUNTIME_AUDIO_PATHS: Readonly<Record<string, string>> = Object.freeze({
    // STV-AUD-004: these exact client music/voice clips use web-derived Ogg
    // copies. All other serialized sound clips keep their source WAV paths.
    THEMA_GAMECIRCLE_02: deploymentUrl("/game-assets/sword-training/audio/bgm/THEMA_GAMECIRCLE_02.ogg"),
    THEMA_CA_TWINTAIL: deploymentUrl("/game-assets/sword-training/audio/bgm/THEMA_CA_TWINTAIL.ogg"),
    UI_WARFARE_RESULT_WIN: deploymentUrl("/game-assets/sword-training/audio/bgm/UI_WARFARE_RESULT_WIN.ogg"),
    VOICE_UNIT_ACADEMY_C_TWINTAIL_BATTLE_DAMAGE_1: deploymentUrl("/game-assets/sword-training/audio/voice/VOICE_UNIT_ACADEMY_C_TWINTAIL_BATTLE_DAMAGE_1.ogg"),
    VOICE_UNIT_ACADEMY_C_TWINTAIL_BATTLE_DAMAGE_2: deploymentUrl("/game-assets/sword-training/audio/voice/VOICE_UNIT_ACADEMY_C_TWINTAIL_BATTLE_DAMAGE_2.ogg"),
});
export function swordClientRuntimeAudioPath(key: string, source: SwordClientAudioManifest["clips"][string]) {
    return SWORD_TRAINING_RUNTIME_AUDIO_PATHS[key] ?? source.webPath;
}
/** Source category gain, not a claim to reproduce Unity's native mixer DSP. */
export function swordClientAudioGain(kind: "music" | "sound", localVolume = 1) {
    return Math.fround(Math.fround(kind === "music" ? 0.7 : 0.6) * Math.fround(localVolume));
}
export function createSwordClientAudio(manifest: SwordClientAudioManifest) {
    const voices = new Set<HTMLAudioElement>();
    let music: HTMLAudioElement | null = null;
    let musicKey = "";
    let disposed = false;
    // The preserved lobby music starts on Open. Browsers can require an initial
    // gesture; retry that same pending music at the first permitted gesture.
    const unlock = () => { if (!disposed && music?.paused)
        void music.play().catch(() => { }); };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    const release = (voice: HTMLAudioElement) => { voice.pause(); voices.delete(voice); };
    const play = (key: string) => {
        if (disposed)
            return;
        const source = manifest.clips[key];
        if (!source)
            throw new Error(`AudioClip not present in original extraction: ${key}`);
        if (source.kind === "music" && key === musicKey && music && !music.paused)
            return;
        const audio = new Audio(deploymentUrl(swordClientRuntimeAudioPath(key, source)));
        audio.volume = swordClientAudioGain(source.kind);
        if (source.kind === "music") {
            music?.pause();
            music = audio;
            musicKey = key;
            // All three Sword Training PlayMusic calls explicitly pass loop=true.
            audio.loop = true;
        }
        else {
            while (voices.size >= 30)
                release(voices.values().next().value!);
            voices.add(audio);
            audio.addEventListener("ended", () => release(audio), { once: true });
            audio.addEventListener("error", () => release(audio), { once: true });
        }
        void audio.play().catch(() => {
            // Browser autoplay requires a user gesture; do not silently fake playback.
            if (source.kind === "sound")
                release(audio);
        });
    };
    return { play, stop() {
            disposed = true;
            window.removeEventListener("pointerdown", unlock);
            window.removeEventListener("keydown", unlock);
            music?.pause();
            music = null;
            for (const voice of voices)
                release(voice);
        } };
}
