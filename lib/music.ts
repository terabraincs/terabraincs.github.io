import catalog from "@/data/music-tracks.json";
import { deploymentData } from "@/lib/deployment";

export type MusicTrack = {
  id: string;
  order: number;
  title: string;
  audioPath: string;
  coverPath: string;
  duration: number;
  volume: number;
  unlockText: string;
  isLocked: boolean;
  isRegistered: boolean;
};

// Precomputed from the converted Ogg files; Pages builds need no local audio.
export function loadMusicTracks(): MusicTrack[] {
  return deploymentData(catalog.tracks);
}
