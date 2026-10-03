"use client";
import { deploymentUrl } from "@/lib/deployment";
import { useEffect, useRef, useState } from "react";
import Image from "@/components/DeploymentImage";
import { useVoiceLanguage } from "@/components/VoiceLanguageControls";
type PlaybackState = "idle" | "loading" | "playing" | "paused" | "error";
type VoicePlayButtonProps = {
    src: string;
    japaneseSrc?: string;
    label: string;
};
let activeAudio: HTMLAudioElement | null = null;
export default function VoicePlayButton({ src, japaneseSrc, label, }: VoicePlayButtonProps) {
    const language = useVoiceLanguage();
    const selectedSrc = language === "ja" ? japaneseSrc ?? "" : src;
    const languageLabel = language === "ja" ? "일본어" : "한국어";
    if (!selectedSrc) {
        const unavailableLabel = `${languageLabel} 음성 없음`;
        return (<span className="flex shrink-0 items-center gap-2">
        <span className="text-xs text-[#9ca3af]">{unavailableLabel}</span>
        <button type="button" disabled aria-label={`${label} ${unavailableLabel}`} data-voice-playing="false" title={unavailableLabel} className="flex h-10 w-10 shrink-0 items-center justify-center opacity-30">
          <Image src={deploymentUrl("/ui/AB_UI_COLLECTION_ICON_PAUSE.png")} alt="" width={34} height={34}/>
        </button>
      </span>);
    }
    return (<VoicePlayer key={`${language ?? "ko"}:${selectedSrc}`} src={selectedSrc} label={language ? `${label} ${languageLabel}` : label}/>);
}
function VoicePlayer({ src, label }: {
    src: string;
    label: string;
}) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const mountedRef = useRef(false);
    const playbackRequestRef = useRef(0);
    const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
    const isPlaying = playbackState === "playing";
    const isPlaybackActive = isPlaying || playbackState === "loading";
    const buttonLabel = isPlaying ? `${label} 일시정지` : `${label} 재생`;
    const iconPath = isPlaying
        ? deploymentUrl("/ui/AB_UI_COLLECTION_ICON_PLAY.png") : deploymentUrl("/ui/AB_UI_COLLECTION_ICON_PAUSE.png");
    useEffect(() => {
        mountedRef.current = true;
        const audio = audioRef.current;
        return () => {
            mountedRef.current = false;
            playbackRequestRef.current += 1;
            if (audio) {
                audio.pause();
                audio.currentTime = 0;
            }
            if (activeAudio === audio) {
                activeAudio = null;
            }
        };
    }, []);
    async function togglePlayback() {
        const audio = audioRef.current;
        if (!audio) {
            return;
        }
        const request = ++playbackRequestRef.current;
        if (!audio.paused || (playbackState === "loading" && activeAudio === audio)) {
            audio.pause();
            audio.currentTime = 0;
            if (activeAudio === audio) {
                activeAudio = null;
            }
            setPlaybackState("idle");
            return;
        }
        if (activeAudio && activeAudio !== audio) {
            activeAudio.pause();
            activeAudio.currentTime = 0;
        }
        activeAudio = audio;
        audio.currentTime = 0;
        setPlaybackState("loading");
        try {
            await audio.play();
            if (!mountedRef.current || activeAudio !== audio) {
                audio.pause();
                audio.currentTime = 0;
            }
        }
        catch {
            if (!mountedRef.current ||
                request !== playbackRequestRef.current ||
                activeAudio !== audio) {
                return;
            }
            activeAudio = null;
            setPlaybackState("error");
        }
    }
    function handlePlaying() {
        const audio = audioRef.current;
        if (!mountedRef.current || !audio) {
            return;
        }
        if (activeAudio !== audio) {
            audio.pause();
            audio.currentTime = 0;
            return;
        }
        setPlaybackState("playing");
    }
    return (<>
      <button type="button" aria-label={buttonLabel} data-voice-playing={isPlaybackActive ? "true" : "false"} title={playbackState === "error" ? "음원을 재생할 수 없습니다" : buttonLabel} onClick={togglePlayback} className="flex h-10 w-10 shrink-0 items-center justify-center transition hover:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
        <Image src={iconPath} alt="" width={isPlaying ? 31 : 34} height={34} className={playbackState === "loading" ? "animate-pulse" : ""}/>
      </button>
      <audio ref={audioRef} src={src} preload="none" onPlay={handlePlaying} onPlaying={handlePlaying} onPause={() => {
            if (mountedRef.current && audioRef.current?.paused) {
                setPlaybackState("paused");
            }
        }} onWaiting={() => {
            if (mountedRef.current && activeAudio === audioRef.current) {
                setPlaybackState("loading");
            }
        }} onEnded={() => {
            if (!mountedRef.current) {
                return;
            }
            const audio = audioRef.current;
            if (audio) {
                audio.currentTime = 0;
            }
            if (activeAudio === audio) {
                activeAudio = null;
            }
            setPlaybackState("idle");
        }} onError={() => {
            if (!mountedRef.current || activeAudio !== audioRef.current) {
                return;
            }
            activeAudio = null;
            setPlaybackState("error");
        }}/>
    </>);
}
