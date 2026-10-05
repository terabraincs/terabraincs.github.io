import { deploymentUrl } from "@/lib/deployment";
import HubCard from "@/components/HubCard";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
const hubCards = [
    {
        title: "사원",
        href: deploymentUrl("/characters"),
        imagePath: deploymentUrl("/unit/unit_face/AB_UNIT_FACE_CARD_NKM_UNIT_SD_C_YOO_MI_NA.png"),
    },
    {
        title: "장비",
        href: deploymentUrl("/equipment"),
        imagePath: deploymentUrl("/equipment/equip_image/AB_INVEN_ICON_IQI_EQUIP_COUNTER_WEAPON_T7_RELIC_A_SSR.png"),
    },
    {
        title: "함선",
        href: deploymentUrl("/ships"),
        imagePath: deploymentUrl("/ship/ship_ilust/AB_UNIT_FACE_CARD_NKM_SHIP_A_GLEIPNIR.png"),
    },
    {
        title: "오퍼레이터",
        href: deploymentUrl("/operators"),
        imagePath: deploymentUrl("/operator/operator_skill/OPR_LEE_SUYEON.png"),
    },
    {
        title: "수집 요소",
        href: deploymentUrl("/collection"),
        imagePath: deploymentUrl("/collection/emblem/AB_INVEN_ICON_IMI_ITEM_EMBLEM_BASIC_ANNIVERSARY_10.png"),
    },
    {
        title: "주크박스",
        href: deploymentUrl("/music"),
        imagePath: deploymentUrl("/music/BGM_COVER_OST_1.png"),
        imagePosition: "center 30%",
    },
    {
        title: "스토리 뷰어",
        href: deploymentUrl("/story"),
        imagePath: deploymentUrl("/story/detail-thumbnails/BG_SUB_FAILURE.png"),
        imagePosition: "center 30%",
    },
    {
        title: "Spine 뷰어",
        href: deploymentUrl("/spine-viewer"),
        imagePath: deploymentUrl("/unit/unit_face/AB_UNIT_FACE_CARD_NKM_UNIT_CA_YOO_MI_NA.png"),
    },
    {
        title: "미니게임",
        href: deploymentUrl("/minigames"),
        imagePath: deploymentUrl("/game-assets/match-ten/images/texture/UI_SINGLE_MATCHTEN_CUT_02.png"),
        overlayImagePath: deploymentUrl("/game-assets/match-ten/images/texture/UI_SINGLE_MATCHTEN_DECO_01.png"),
    },
];
const backupLinks = [
    {
        title: "라운지 백업",
        href: "https://lounge.counterside.kro.kr/",
    },
    {
        title: "공식 홈페이지 백업",
        href: "https://counterside.kro.kr/website/",
    },
];
export default function Home() {
    return (<div className="flex min-h-screen flex-col bg-[#0b0d12] text-[#e5e7eb]">
      <SiteHeader />

      <main className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold leading-tight text-white sm:text-5xl">
              카운터사이드 웹뷰어
            </h1>
            <p className="mt-4 text-sm leading-6 text-[#9ca3af] sm:text-base">
              이 웹페이지는 자료를 소유, 권리를 주장하지 않습니다. 모든 권리는
              Studiobside Co., Ltd에게 있습니다
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {hubCards.map((card) => (<HubCard key={card.href} {...card}/>))}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {backupLinks.map((link) => (<a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="flex min-h-[88px] items-center justify-between gap-4 rounded-lg border border-[#343844] bg-[#171a21] p-5 text-xl font-bold text-white transition duration-200 hover:-translate-y-1 hover:border-white hover:shadow-[0_18px_50px_rgba(255,255,255,0.18)] focus:outline-none focus:ring-2 focus:ring-white">
                <span>{link.title}</span>
                <span aria-hidden="true">↗</span>
              </a>))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>);
}
