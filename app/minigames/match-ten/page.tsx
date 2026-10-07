import type { Metadata } from "next";
import MatchTenGame from "@/components/minigames/MatchTenGame";
import SiteHeader from "@/components/SiteHeader";
import { getMatchTenConfig } from "@/lib/matchTen";
export const metadata: Metadata = {
    title: "탕비실 침공작전 | 카운터사이드 웹뷰어",
    description: "숫자의 합이 10이 되도록 선택해 간식을 획득하는 미니게임입니다.",
};
export default function MatchTenPage() {
    const config = getMatchTenConfig();
    return (<div className="flex min-h-screen flex-col bg-[#080a0f] text-white">
      <SiteHeader />
      <main className="flex flex-1">
        <MatchTenGame config={config}/>
      </main>
    </div>);
}
