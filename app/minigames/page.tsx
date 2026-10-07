import { deploymentUrl } from "@/lib/deployment";
import type { Metadata } from "next";
import Image from "@/components/DeploymentImage";
import Link from "@/components/DeploymentLink";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { miniGames } from "@/lib/minigames";
export const metadata: Metadata = {
    title: "미니게임 | 카운터사이드 웹뷰어",
    description: "카운터사이드 인게임 미니게임을 플레이하는 페이지입니다.",
};
export default function MiniGamesPage() {
    return (<div className="flex min-h-screen flex-col bg-[#0b0d12] text-[#e5e7eb]">
      <SiteHeader />

      <main className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <header className="border-b border-[#343844] pb-6">
            <h1 className="text-3xl font-bold text-white sm:text-4xl">
              미니게임
            </h1>
          </header>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {miniGames.map((game) => (<Link key={game.slug} href={game.available ? deploymentUrl(`/minigames/${game.slug}`) : "#"} aria-disabled={!game.available} className="group relative min-h-[300px] overflow-hidden rounded-md border border-[#343844] bg-[#111318] transition hover:border-white focus:outline-none focus:ring-2 focus:ring-white">
                <Image src={deploymentUrl(game.imagePath)} alt="" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover object-center transition duration-300 group-hover:scale-[1.02]"/>
                {game.slug === "match-ten" ? (<Image src={deploymentUrl("/game-assets/match-ten/images/texture/UI_SINGLE_MATCHTEN_DECO_01.png")} alt="" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-contain object-left-bottom transition duration-300 group-hover:scale-[1.02]"/>) : null}
                {game.slug === "cafe-strega" ? (<Image src={deploymentUrl("/game-assets/cafe-strega/images/ui/SINGLE_CAFE_LOGO2.png")} alt="" width={374} height={251} className="absolute left-5 top-5 h-auto w-44 drop-shadow-[0_4px_12px_rgba(0,0,0,0.65)]"/>) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10"/>
                <div className="relative flex min-h-[300px] flex-col justify-end p-6">
                  <h2 className="text-2xl font-black text-white">
                    {game.title}
                  </h2>
                </div>
              </Link>))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>);
}
