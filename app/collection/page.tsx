import { deploymentUrl } from "@/lib/deployment";
import type { Metadata } from "next";
import Image from "@/components/DeploymentImage";
import Link from "@/components/DeploymentLink";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import CollectionFramePreview from "@/components/CollectionFramePreview";
import { getCollectionEmblemData } from "@/lib/collectionEmblems";
import { getCollectionFrameData } from "@/lib/collectionFrames";
import { getCollectionTitleData } from "@/lib/collectionTitles";
import { getCollectionTrophyData } from "@/lib/collectionTrophies";
export const metadata: Metadata = {
    title: "수집 요소 | 카운터사이드 웹뷰어",
    description: "카운터사이드의 칭호, 엠블럼, 프레임과 트로피를 확인하는 페이지입니다.",
};
export default function CollectionPage() {
    const { titles } = getCollectionTitleData();
    const { emblems } = getCollectionEmblemData();
    const { frames } = getCollectionFrameData();
    const { trophies } = getCollectionTrophyData();
    const previewTitle = titles[0];
    const previewEmblem = emblems[0];
    const previewFrame = frames[0];
    const previewTrophy = trophies.find((trophy) => trophy.imagePath);
    return (<div className="flex min-h-screen flex-col bg-[#0b0d12] text-[#e5e7eb]">
      <SiteHeader />

      <main className="flex-1">
        <article className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <header className="border-b border-[#343844] pb-5">
            <p className="text-sm font-semibold tracking-[0.28em] text-[#9ca3af]">
              COLLECTION
            </p>
            <h1 className="mt-3 text-3xl font-bold text-[#cfd4dc] sm:text-4xl">
              수집 요소
            </h1>
          </header>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Link href={deploymentUrl("/collection/titles")} className="group grid min-h-40 grid-cols-[minmax(0,1fr)_140px] overflow-hidden border border-[#343844] bg-[#171a21] transition hover:border-white hover:bg-[#1d2029] focus:outline-none focus:ring-2 focus:ring-[#9ca3af] sm:grid-cols-[minmax(0,1fr)_220px]">
              <div className="flex min-w-0 flex-col justify-center p-5">
                <span className="text-xs font-bold text-[#9ca3af]">TITLE</span>
                <h2 className="mt-2 text-2xl font-black text-white">칭호</h2>
                <p className="mt-3 text-sm font-bold text-[#9ca3af]">
                  {titles.length}종
                </p>
              </div>
              <div className="flex items-center justify-center border-l border-[#343844] bg-[#0b0d12] p-3">
                {previewTitle?.imagePath ? (<div className="relative aspect-[4/1] w-full max-w-[256px]">
                    <Image src={previewTitle.imagePath} alt="칭호 미리보기" fill sizes="220px" className="object-fill transition group-hover:scale-105"/>
                  </div>) : null}
              </div>
            </Link>

            <Link href={deploymentUrl("/collection/emblems")} className="group grid min-h-40 grid-cols-[minmax(0,1fr)_140px] overflow-hidden border border-[#343844] bg-[#171a21] transition hover:border-white hover:bg-[#1d2029] focus:outline-none focus:ring-2 focus:ring-[#9ca3af] sm:grid-cols-[minmax(0,1fr)_220px]">
              <div className="flex min-w-0 flex-col justify-center p-5">
                <span className="text-xs font-bold text-[#9ca3af]">EMBLEM</span>
                <h2 className="mt-2 text-2xl font-black text-white">엠블럼</h2>
                <p className="mt-3 text-sm font-bold text-[#9ca3af]">
                  {emblems.length}종
                </p>
              </div>
              <div className="flex items-center justify-center border-l border-[#343844] bg-[#0b0d12] p-3">
                {previewEmblem?.imagePath ? (<div className="relative h-28 w-28">
                    <Image src={previewEmblem.imagePath} alt="엠블럼 미리보기" fill sizes="112px" className="object-contain transition group-hover:scale-105"/>
                  </div>) : null}
              </div>
            </Link>

            <Link href={deploymentUrl("/collection/frames")} className="group grid min-h-40 grid-cols-[minmax(0,1fr)_140px] overflow-hidden border border-[#343844] bg-[#171a21] transition hover:border-white hover:bg-[#1d2029] focus:outline-none focus:ring-2 focus:ring-[#9ca3af] sm:grid-cols-[minmax(0,1fr)_220px]">
              <div className="flex min-w-0 flex-col justify-center p-5">
                <span className="text-xs font-bold text-[#9ca3af]">FRAME</span>
                <h2 className="mt-2 text-2xl font-black text-white">프레임</h2>
                <p className="mt-3 text-sm font-bold text-[#9ca3af]">
                  {frames.length}종
                </p>
              </div>
              <div className="flex items-center justify-center border-l border-[#343844] bg-[#0b0d12] p-3">
                {previewFrame?.imagePath ? (<div className="w-28 transition group-hover:scale-105">
                    <CollectionFramePreview imagePath={previewFrame.imagePath} name={previewFrame.name} size="hub"/>
                  </div>) : null}
              </div>
            </Link>

            <Link href={deploymentUrl("/collection/trophies")} className="group grid min-h-40 grid-cols-[minmax(0,1fr)_140px] overflow-hidden border border-[#343844] bg-[#171a21] transition hover:border-white hover:bg-[#1d2029] focus:outline-none focus:ring-2 focus:ring-[#9ca3af] sm:grid-cols-[minmax(0,1fr)_220px]">
              <div className="flex min-w-0 flex-col justify-center p-5">
                <span className="text-xs font-bold text-[#9ca3af]">
                  TROPHY
                </span>
                <div className="mt-2 flex items-center gap-2">
                  <Image src={deploymentUrl("/collection/trophy/ui/NKM_UI_UNIT_SELECT_LIST_TAP_ICON_TROPHY.png")} alt="" width={24} height={24} className="object-contain"/>
                  <h2 className="text-2xl font-black text-white">트로피</h2>
                </div>
                <p className="mt-3 text-sm font-bold text-[#9ca3af]">
                  {trophies.length}종
                </p>
              </div>
              <div className="flex items-center justify-center overflow-hidden border-l border-[#343844] bg-[#0b0d12] p-3">
                {previewTrophy?.imagePath ? (<div className="relative h-28 w-28 transition group-hover:scale-105">
                    <Image src={previewTrophy.imagePath} alt="트로피 미리보기" fill sizes="112px" className="object-contain"/>
                  </div>) : null}
              </div>
            </Link>

          </div>
        </article>
      </main>

      <SiteFooter />
    </div>);
}
