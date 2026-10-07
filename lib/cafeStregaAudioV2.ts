import { deploymentUrl } from "@/lib/deployment";
export type CafeAudioManifestV2 = {
    clips: Record<string, {
        webPath: string;
        kind: 'music' | 'sound';
    }>;
    bgmBinding: {
        BgmAssetID: string;
        BgmVolume: number;
    };
    gainEvidence: {
        master: number;
        music: number;
        sound: number;
    };
    bindings: {
        path: string;
        type: string;
        value: {
            AssetName: string;
            Volume: number;
            Delay: number;
            PlayStartPos: number;
            Loop: number;
            StopOnDisable: number;
            PlayOnEnable: number;
        };
    }[];
};
const CAFE_STREGA_RUNTIME_AUDIO_PATHS: Readonly<Record<string, string>> = Object.freeze({
    // STV-AUD-004: keep the extracted client-source WAV/hash as evidence while
    // serving the independently derived web playback copy as Ogg Opus.
    CUTSCENE_TALK_03: deploymentUrl("/game-assets/cafe-strega/audio/bgm/CUTSCENE_TALK_03.ogg"),
});
export function cafeStregaRuntimeAudioPath(key: string, clip: CafeAudioManifestV2["clips"][string]) {
    return CAFE_STREGA_RUNTIME_AUDIO_PATHS[key] ?? clip.webPath;
}
/** Original assets and nonpositional source gain; no browser/account persistence. */
export class CafeStregaAudioV2 {
    private context: AudioContext | null = null;
    private buffers = new Map<string, Promise<AudioBuffer>>();
    private sources = new Set<AudioBufferSourceNode>();
    private disposed = false;
    private musicStarted = false;
    constructor(readonly manifest: CafeAudioManifestV2, private readonly report: (message: string) => void) { }
    private engine() { return this.context ??= new AudioContext(); }
    private buffer(key: string) {
        let pending = this.buffers.get(key);
        if (!pending) {
            const clip = this.manifest.clips[key];
            if (!clip)
                throw new Error(`Original Cafe audio key missing: ${key}`);
            pending = fetch(deploymentUrl(cafeStregaRuntimeAudioPath(key, clip))).then(response => {
                if (!response.ok)
                    throw new Error(`Original Cafe audio failed: ${key} / ${response.status}`);
                return response.arrayBuffer();
            }).then(bytes => { if (this.disposed)
                throw new Error('Disposed Cafe audio instance'); return this.engine().decodeAudioData(bytes); });
            this.buffers.set(key, pending);
        }
        return pending;
    }
    preload(keys: Iterable<string>) {
        void Promise.all([...new Set(keys)].map(key => this.buffer(key))).catch(error => { if (!this.disposed)
            this.report(String(error)); });
    }
    /** Browser user-gesture permission is the only platform adapter. */
    unlock() {
        if (this.disposed)
            return;
        void this.engine().resume().then(() => {
            if (this.musicStarted || this.disposed)
                return;
            this.musicStarted = true;
            this.play(this.manifest.bgmBinding.BgmAssetID, { loop: true, volume: this.manifest.bgmBinding.BgmVolume / 100 });
        }).catch(error => { if (!this.disposed)
            this.report(String(error)); });
    }
    play(key: string, options: {
        loop?: boolean;
        volume?: number;
        delay?: number;
        offset?: number;
    } = {}) {
        if (this.disposed)
            return;
        const context = this.engine(), scheduled = context.currentTime + (options.delay ?? 0);
        void this.buffer(key).then(buffer => {
            if (this.disposed)
                return;
            const source = context.createBufferSource(), gain = context.createGain();
            const defaults = this.manifest.gainEvidence, kind = this.manifest.clips[key].kind;
            // The original mixer category is 0 dB at these defaults; do not apply it twice.
            gain.gain.value = defaults.master / 100 * defaults[kind] / 100 * (options.volume ?? 1);
            source.buffer = buffer;
            source.loop = options.loop ?? false;
            source.connect(gain);
            gain.connect(context.destination);
            this.sources.add(source);
            source.onended = () => { this.sources.delete(source); source.disconnect(); gain.disconnect(); };
            source.start(Math.max(context.currentTime, scheduled), options.offset ?? 0);
        }).catch(error => { if (!this.disposed)
            this.report(String(error)); });
    }
    /** Serialized NKCComSoundPlayer arguments, with no inferred replacement sounds. */
    activate(path: string, explicitPlay = false) {
        for (const binding of this.manifest.bindings.filter(binding => binding.path === path)) {
            const source = binding.value;
            if (!explicitPlay && !source.PlayOnEnable)
                continue;
            this.play(source.AssetName, { volume: source.Volume, loop: Boolean(source.Loop), delay: source.Delay, offset: source.PlayStartPos });
        }
    }
    dispose() {
        this.disposed = true;
        for (const source of this.sources)
            source.stop();
        this.sources.clear();
        if (this.context)
            void this.context.close();
    }
}
