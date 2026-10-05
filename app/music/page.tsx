import type { Metadata } from "next";
import MusicPlayerList from "@/components/MusicPlayerList";
import SiteHeader from "@/components/SiteHeader";
import { loadMusicTracks } from "@/lib/music";

export const metadata: Metadata = {
  title: "주크박스 | 카운터사이드 웹뷰어",
  description: "카운터사이드 수록 음악을 선택하고 재생하는 주크박스입니다.",
};

export default function MusicPage() {
  const tracks = loadMusicTracks();

  return (
    <div className="flex min-h-screen flex-col bg-[#050a18] text-[#e5e7eb]">
      <SiteHeader />

      <main className="flex flex-1 flex-col">
        {tracks.length > 0 ? (
          <MusicPlayerList tracks={tracks} />
        ) : (
          <div className="flex min-h-[calc(100svh-81px)] items-center justify-center bg-[#050a18] px-4">
            <div className="border border-[#34405d] bg-black/45 px-6 py-12 text-center text-sm font-semibold text-[#a8b0c2]">
              주크박스 데이터와 음원 경로를 찾을 수 없습니다.
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
