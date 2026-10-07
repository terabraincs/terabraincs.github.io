"use client";

import Image from "@/components/DeploymentImage";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MusicTrack } from "@/lib/music";
import styles from "./Jukebox.module.css";

type MusicPlayerListProps = {
  tracks: MusicTrack[];
};

type PlaybackState = "idle" | "loading" | "playing" | "paused" | "error";
type SortMode = "default" | "name";
type RepeatMode = "none" | "all" | "one";

const ASSET_PATH = "/music";
const SEEN_TRACKS_STORAGE_KEY = "counterside-jukebox-seen";

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return "0:00";
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function readStoredIds(key: string) {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown;

    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function Equalizer({ isPlaying }: { isPlaying: boolean }) {
  return (
    <span
      className={`${styles.equalizer} ${isPlaying ? styles.equalizerPlaying : ""}`}
      aria-hidden="true"
    >
      {Array.from({ length: 11 }, (_, index) => (
        <span key={index} className={styles.equalizerBar} />
      ))}
    </span>
  );
}

export default function MusicPlayerList({ tracks }: MusicPlayerListProps) {
  const firstPlayableTrack = tracks.find((track) => !track.isLocked) ?? tracks[0];
  const audioRef = useRef<HTMLAudioElement>(null);
  const [activeTrackId, setActiveTrackId] = useState(firstPlayableTrack?.id ?? "");
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(firstPlayableTrack?.duration ?? 0);
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("none");
  const [isRandom, setIsRandom] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(1);
  const [newTrackIds, setNewTrackIds] = useState<Set<string>>(() => new Set());
  const activeTrack = tracks.find((track) => track.id === activeTrackId) ?? null;
  const isPlaying = playbackState === "playing";

  const displayedTracks = useMemo(() => {
    const registeredTracks = tracks.filter((track) => track.isRegistered);
    const unregisteredTracks = tracks.filter((track) => !track.isRegistered);

    if (sortMode === "name") {
      registeredTracks.sort((first, second) => {
        return first.title.localeCompare(second.title, "ko");
      });
    } else {
      registeredTracks.sort((first, second) => first.order - second.order);
    }

    unregisteredTracks.sort((first, second) => {
      return first.title.localeCompare(second.title, "en");
    });

    return [...registeredTracks, ...unregisteredTracks];
  }, [sortMode, tracks]);

  useEffect(() => {
    const restoreStorageId = window.setTimeout(() => {
      const seenTrackIds = readStoredIds(SEEN_TRACKS_STORAGE_KEY);

      if (seenTrackIds.length === 0) {
        localStorage.setItem(
          SEEN_TRACKS_STORAGE_KEY,
          JSON.stringify(tracks.map((track) => track.id)),
        );
        return;
      }

      const seenTrackSet = new Set(seenTrackIds);
      setNewTrackIds(
        new Set(
          tracks
            .filter(
              (track) => track.isRegistered && !seenTrackSet.has(track.id),
            )
            .map((track) => track.id),
        ),
      );
    }, 0);

    return () => window.clearTimeout(restoreStorageId);
  }, [tracks]);

  function markTrackAsSeen(trackId: string) {
    setNewTrackIds((currentIds) => {
      if (!currentIds.has(trackId)) {
        return currentIds;
      }

      const nextIds = new Set(currentIds);
      nextIds.delete(trackId);
      return nextIds;
    });

    const seenTrackIds = new Set(readStoredIds(SEEN_TRACKS_STORAGE_KEY));
    seenTrackIds.add(trackId);
    localStorage.setItem(SEEN_TRACKS_STORAGE_KEY, JSON.stringify([...seenTrackIds]));
  }

  async function playTrack(track: MusicTrack, restart = false) {
    const audio = audioRef.current;

    if (!audio || track.isLocked || !track.audioPath) {
      return;
    }

    markTrackAsSeen(track.id);

    if (activeTrackId === track.id && audio.currentSrc) {
      if (!audio.paused && !restart) {
        audio.pause();
        return;
      }

      if (restart) {
        audio.currentTime = 0;
        setCurrentTime(0);
      }

      audio.volume = Math.min(track.volume * volumeLevel, 1);
      setPlaybackState("loading");

      try {
        await audio.play();
      } catch {
        setPlaybackState("error");
      }

      return;
    }

    audio.pause();
    audio.src = track.audioPath;
    audio.volume = Math.min(track.volume * volumeLevel, 1);
    audio.currentTime = 0;
    audio.load();
    setActiveTrackId(track.id);
    setCurrentTime(0);
    setDuration(track.duration);
    setPlaybackState("loading");

    try {
      await audio.play();
    } catch {
      setPlaybackState("error");
    }
  }

  function getPlaybackQueue() {
    const currentQueue = displayedTracks.filter((track) => !track.isLocked);

    if (currentQueue.some((track) => track.id === activeTrackId)) {
      return currentQueue;
    }

    return [...tracks]
      .filter((track) => !track.isLocked)
      .sort((first, second) => first.order - second.order);
  }

  function getRandomTrack(queue: MusicTrack[]) {
    if (queue.length <= 1) {
      return queue[0] ?? null;
    }

    const candidates = queue.filter((track) => track.id !== activeTrackId);
    return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
  }

  function moveTrack(direction: -1 | 1) {
    const queue = getPlaybackQueue();

    if (queue.length === 0) {
      return;
    }

    if (isRandom) {
      const randomTrack = getRandomTrack(queue);
      if (randomTrack) void playTrack(randomTrack);
      return;
    }

    const currentIndex = Math.max(
      queue.findIndex((track) => track.id === activeTrackId),
      0,
    );
    const nextIndex = (currentIndex + direction + queue.length) % queue.length;
    void playTrack(queue[nextIndex]);
  }

  function handleTrackEnded() {
    if (!activeTrack) {
      setPlaybackState("idle");
      return;
    }

    if (repeatMode === "one") {
      void playTrack(activeTrack, true);
      return;
    }

    const queue = getPlaybackQueue();
    const currentIndex = queue.findIndex((track) => track.id === activeTrack.id);

    if (isRandom) {
      const randomTrack = getRandomTrack(queue);
      if (randomTrack) void playTrack(randomTrack);
      return;
    }

    if (currentIndex >= 0 && currentIndex < queue.length - 1) {
      void playTrack(queue[currentIndex + 1]);
      return;
    }

    if (repeatMode === "all" && queue[0]) {
      void playTrack(queue[0]);
      return;
    }

    setCurrentTime(duration);
    setPlaybackState("idle");
  }

  function seekTo(value: number) {
    const audio = audioRef.current;

    if (!audio || !Number.isFinite(value)) {
      return;
    }

    audio.currentTime = value;
    setCurrentTime(value);
  }

  function changeVolume(value: number) {
    const nextVolumeLevel = Math.min(Math.max(value, 0), 1);
    const audio = audioRef.current;

    setVolumeLevel(nextVolumeLevel);

    if (audio && activeTrack) {
      audio.volume = Math.min(activeTrack.volume * nextVolumeLevel, 1);
    }
  }

  function cycleRepeatMode() {
    setRepeatMode((currentMode) => {
      if (currentMode === "none") return "all";
      if (currentMode === "all") return "one";
      return "none";
    });
  }

  const repeatIcon = repeatMode === "one"
    ? `${ASSET_PATH}/AB_UI_BRM_ICON_REPEAT_X1.png`
    : `${ASSET_PATH}/AB_UI_BRM_ICON_REPEAT.png`;
  const repeatLabel = repeatMode === "none"
    ? "반복 없음"
    : repeatMode === "all"
      ? "전체 반복"
      : "한 곡 반복";

  return (
    <section className={styles.jukebox} aria-label="카운터사이드 주크박스">
      <audio
        ref={audioRef}
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setPlaybackState("playing")}
        onPlaying={() => setPlaybackState("playing")}
        onPause={() => setPlaybackState("paused")}
        onWaiting={() => setPlaybackState("loading")}
        onEnded={handleTrackEnded}
        onError={() => setPlaybackState("error")}
      />

      <div className={styles.topArea}>
        <div className={styles.albumArea}>
          <div className={styles.albumCoverFrame}>
            <div className={styles.albumCover}>
              <Image
                src={activeTrack?.coverPath ?? `${ASSET_PATH}/BGM_COVER_NONE.png`}
                alt={activeTrack ? `${activeTrack.title} 앨범 커버` : "앨범 커버"}
                fill
                sizes="(max-width: 900px) 82vw, 480px"
                className="object-fill"
                priority
              />
            </div>
          </div>
        </div>

        <div className={styles.libraryArea}>
          <div className={styles.libraryToolbar}>
            <div className={styles.sortGroup} aria-label="음악 정렬">
              <span className={styles.sortLabel}>정렬</span>
              <span className={styles.sortDivider} aria-hidden="true">/</span>
              <button
                type="button"
                aria-pressed={sortMode === "default"}
                onClick={() => setSortMode("default")}
                className={sortMode === "default" ? styles.sortButtonActive : styles.sortButton}
              >
                기본
              </button>
              <button
                type="button"
                aria-pressed={sortMode === "name"}
                onClick={() => setSortMode("name")}
                className={sortMode === "name" ? styles.sortButtonActive : styles.sortButton}
              >
                이름
              </button>
            </div>
          </div>

          <ol className={styles.trackList}>
            {displayedTracks.map((track) => {
              const isActive = activeTrackId === track.id;
              const isTrackPlaying = isActive && isPlaying;

              return (
                <li
                  key={track.id}
                  className={`${styles.trackSlot} ${isActive ? styles.trackSlotActive : ""} ${track.isLocked ? styles.trackSlotLocked : ""}`}
                >
                  <Image
                    src={`${ASSET_PATH}/AB_UI_BRM_SLOT_GRADIENT.png`}
                    alt=""
                    fill
                    sizes="860px"
                    className={styles.slotGradient}
                  />
                  <button
                    type="button"
                    disabled={track.isLocked}
                    onClick={() => void playTrack(track)}
                    aria-label={track.isLocked ? `${track.title} 잠김` : `${track.title} ${isTrackPlaying ? "일시정지" : "재생"}`}
                    className={styles.trackSelectButton}
                  >
                    <span className={styles.trackStatus}>
                      {track.isLocked ? (
                        <Image
                          src={`${ASSET_PATH}/AB_UI_BRM_ICON_LOCK.png`}
                          alt=""
                          width={24}
                          height={32}
                        />
                      ) : isActive ? (
                        <Image
                          src={`${ASSET_PATH}/AB_UI_BRM_ICON_PLAY_2.png`}
                          alt=""
                          width={50}
                          height={50}
                        />
                      ) : (
                        track.isRegistered
                          ? String(track.order).padStart(3, "0")
                          : "미등록"
                      )}
                    </span>
                    <span className={styles.trackTitleGroup}>
                      <span className={styles.trackTitle}>
                        {track.isLocked ? "BLIND" : track.title}
                      </span>
                      {isActive ? <Equalizer isPlaying={isTrackPlaying} /> : null}
                      {newTrackIds.has(track.id) ? (
                        <span className={styles.newLabel}>NEW</span>
                      ) : null}
                    </span>
                    <span className={styles.trackDuration}>
                      {track.isLocked ? "--:--" : formatTime(track.duration)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <div className={styles.playerArea}>
        <div className={styles.playerInner}>
          <div className={styles.progressRow}>
            <span>{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(currentTime, duration || 0)}
              disabled={!activeTrack || !duration}
              onChange={(event) => seekTo(Number(event.target.value))}
              aria-label="음악 재생 위치"
              className={styles.progressSlider}
            />
            <span>{formatTime(duration)}</span>
          </div>

          <div className={styles.playerBody}>
            <div className={styles.nowPlaying}>
              <h2>{activeTrack?.title ?? "선택된 음악 없음"}</h2>
              <span>{activeTrack?.unlockText ?? ""}</span>
            </div>

            <div className={styles.controlGroup}>
              <button
                type="button"
                aria-pressed={isRandom}
                onClick={() => setIsRandom((currentValue) => !currentValue)}
                title={isRandom ? "랜덤 재생 켜짐" : "랜덤 재생 꺼짐"}
                aria-label={isRandom ? "랜덤 재생 끄기" : "랜덤 재생 켜기"}
                className={`${styles.controlButton} ${isRandom ? styles.controlButtonActive : ""}`}
              >
                <Image
                  src={`${ASSET_PATH}/AB_UI_BRM_ICON_RANDOM.png`}
                  alt=""
                  width={42}
                  height={32}
                />
              </button>
              <button
                type="button"
                onClick={() => moveTrack(-1)}
                title="이전 곡"
                aria-label="이전 곡"
                className={styles.controlButton}
              >
                <Image
                  src={`${ASSET_PATH}/AB_UI_BRM_BUTTON_NEXT.png`}
                  alt=""
                  width={34}
                  height={30}
                  className="rotate-180"
                />
              </button>
              <button
                type="button"
                disabled={!activeTrack || activeTrack.isLocked}
                onClick={() => activeTrack && void playTrack(activeTrack)}
                title={isPlaying ? "일시정지" : "재생"}
                aria-label={isPlaying ? "현재 곡 일시정지" : "현재 곡 재생"}
                className={styles.playButton}
              >
                <Image
                  src={`${ASSET_PATH}/${isPlaying ? "AB_UI_BRM_BUTTON_PAUSE.png" : "AB_UI_BRM_BUTTON_PLAY.png"}`}
                  alt=""
                  width={82}
                  height={81}
                  className={playbackState === "loading" ? "animate-pulse" : ""}
                />
              </button>
              <button
                type="button"
                onClick={() => moveTrack(1)}
                title="다음 곡"
                aria-label="다음 곡"
                className={styles.controlButton}
              >
                <Image
                  src={`${ASSET_PATH}/AB_UI_BRM_BUTTON_NEXT.png`}
                  alt=""
                  width={34}
                  height={30}
                />
              </button>
              <button
                type="button"
                aria-pressed={repeatMode !== "none"}
                onClick={cycleRepeatMode}
                title={repeatLabel}
                aria-label={`${repeatLabel}, 눌러서 변경`}
                className={`${styles.controlButton} ${repeatMode !== "none" ? styles.controlButtonActive : styles.controlButtonDimmed}`}
              >
                <Image
                  src={repeatIcon}
                  alt=""
                  width={repeatMode === "one" ? 42 : 38}
                  height={36}
                />
              </button>
            </div>

            <div className={styles.volumeControl}>
              <label htmlFor="jukebox-volume" title="음량">
                <Image
                  src={`${ASSET_PATH}/NKM_UI_POPUP_ICON_SOUND.png`}
                  alt=""
                  width={24}
                  height={25}
                />
                <span className="sr-only">음량</span>
              </label>
              <input
                id="jukebox-volume"
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(volumeLevel * 100)}
                onChange={(event) => changeVolume(Number(event.target.value) / 100)}
                aria-label="음악 재생 음량"
                className={styles.volumeSlider}
              />
              <output htmlFor="jukebox-volume">
                {Math.round(volumeLevel * 100)}%
              </output>
            </div>

          </div>

          {playbackState === "error" ? (
            <p className={styles.playerError}>음원을 불러오지 못했습니다.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
