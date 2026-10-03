import { deploymentUrl } from "@/lib/deployment";
import type { Metadata } from "next";
import Image from "@/components/DeploymentImage";
import Link from "@/components/DeploymentLink";
import CollectionTrophyList from "@/components/CollectionTrophyList";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { getCollectionTrophyData } from "@/lib/collectionTrophies";
export const metadata: Metadata = {
    title: "트로피 | 카운터사이드 웹뷰어",
    description: "카운터사이드의 사원형 SD 트로피를 확인하는 페이지입니다.",
};
export default function CollectionTrophiesPage() {
    const { trophies } = getCollectionTrophyData();
    return (<div className="flex min-h-screen flex-col bg-[#0b0d12] text-[#e5e7eb]">
      <SiteHeader />

      <main className="flex-1">
        <article className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <Link href={deploymentUrl("/collection")} className="inline-flex items-center text-sm font-semibold text-white transition hover:text-[#d1d5db]">
            ← 수집 요소
          </Link>

          <header className="mt-5 flex flex-col gap-3 border-b border-[#343844] pb-6">
            <p className="text-sm font-semibold tracking-[0.28em] text-white">
              TROPHY LIST
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <Image src={deploymentUrl("/collection/trophy/ui/NKM_UI_UNIT_SELECT_LIST_TAP_ICON_TROPHY.png")} alt="" width={32} height={32} className="object-contain"/>
                  <h1 className="text-3xl font-bold text-[#cfd4dc] sm:text-4xl">
                    트로피 목록
                  </h1>
                </div>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#9ca3af] sm:text-base">
                  사원형 SD 트로피를 구분, 클래스와 희귀도별로 확인할 수 있습니다.
                </p>
              </div>
              <p className="text-sm font-semibold text-white">
                {trophies.length}개
              </p>
            </div>
          </header>

          <CollectionTrophyList trophies={trophies}/>
        </article>
      </main>

      <SiteFooter />
    </div>);
}
