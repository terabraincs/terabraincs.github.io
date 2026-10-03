import { deploymentUrl } from "@/lib/deployment";
import type { Metadata } from "next";
import Link from "@/components/DeploymentLink";
import CollectionFrameList from "@/components/CollectionFrameList";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { getCollectionFrameData } from "@/lib/collectionFrames";
export const metadata: Metadata = {
    title: "프레임 | 카운터사이드 웹뷰어",
    description: "카운터사이드의 프로필 프레임을 확인하는 페이지입니다.",
};
export default function CollectionFramesPage() {
    const { frames } = getCollectionFrameData();
    return (<div className="flex min-h-screen flex-col bg-[#0b0d12] text-[#e5e7eb]">
      <SiteHeader />

      <main className="flex-1">
        <article className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <Link href={deploymentUrl("/collection")} className="inline-flex items-center text-sm font-semibold text-white transition hover:text-[#d1d5db]">
            ← 수집 요소
          </Link>

          <header className="mt-5 border-b border-[#343844] pb-5">
            <p className="text-sm font-semibold tracking-[0.28em] text-[#9ca3af]">
              FRAME
            </p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <h1 className="text-3xl font-bold text-[#cfd4dc] sm:text-4xl">
                프레임
              </h1>
              <span className="text-sm font-bold text-[#9ca3af]">
                {frames.length}종
              </span>
            </div>
          </header>

          <CollectionFrameList frames={frames}/>
        </article>
      </main>

      <SiteFooter />
    </div>);
}
