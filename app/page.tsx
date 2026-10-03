import { deploymentUrl } from "@/lib/deployment";
import HubCard from "@/components/HubCard";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
const hubCards = [
    {
        title: "사원 정보",
        href: deploymentUrl("/characters"),
        badge: "EMPLOYEE",
        description: "사원 등급, 클래스, 스킬 정보",
        imagePath: deploymentUrl("/unit/unit_face/AB_UNIT_FACE_CARD_NKM_UNIT_CA_YOO_MI_NA.png"),
    },
    {
        title: "장비 정보",
        href: deploymentUrl("/equipment"),
        badge: "EQUIPMENT",
        description: "장비 세트, 옵션, 추천 장비",
        imagePath: deploymentUrl("/equipment/equip_image/AB_INVEN_ICON_IQI_EQUIP_COUNTER_WEAPON_T7_RELIC_A_SSR.png"),
    },
    {
        title: "함선 정보",
        href: deploymentUrl("/ships"),
        badge: "SHIP",
        description: "함선 스킬, 타입, 활용처",
        imagePath: deploymentUrl("/ship/ship_ilust/AB_UNIT_FACE_CARD_NKM_SHIP_H_ENTERPRISE.png"),
    },
    {
        title: "오퍼레이터 정보",
        href: deploymentUrl("/operators"),
        badge: "OPERATOR",
        description: "오퍼레이터 스킬과 보조기술",
        imagePath: deploymentUrl("/operator/operator_face/AB_UNIT_FACE_CARD_OPR_KIMHANA.png"),
    },
    {
        title: "수집 요소",
        href: deploymentUrl("/collection"),
        badge: "COLLECTION",
        description: "칭호와 꾸미기 수집 요소",
        imagePath: deploymentUrl("/collection/title/USERTITLE_TEAMUP_SR_0001.png"),
    },
    {
        title: "스토리 연대기",
        href: deploymentUrl("/story"),
        badge: "CHRONICLE",
        description: "메인스트림과 서브스트림의 연결 지도",
        imagePath: deploymentUrl("/story/map-buttons/SUB_THUMB_BIG_CROSSROAD.png"),
    },
    {
        title: "주크박스",
        href: deploymentUrl("/music"),
        badge: "MUSIC",
        description: "카운터사이드 수록 음악 감상",
        imagePath: deploymentUrl("/music/BGM_COVER_OST_1.png"),
    },
    {
        title: "Spine 뷰어",
        href: deploymentUrl("/spine-viewer"),
        badge: "SPINE 3.7",
        description: "카드 일러스트와 Spine 애니메이션 보기",
        imagePath: deploymentUrl("/unit/unit_face/AB_UNIT_FACE_CARD_NKM_UNIT_C_YOO_MI_NA_RA.png"),
    },
    {
        title: "미니게임",
        href: deploymentUrl("/minigames"),
        badge: "MINI GAME",
        description: "인게임 미니게임 플레이",
        imagePath: deploymentUrl("/game-assets/match-ten/images/texture/UI_SINGLE_MATCHTEN_CUT_02.png"),
        overlayImagePath: deploymentUrl("/game-assets/match-ten/images/texture/UI_SINGLE_MATCHTEN_DECO_01.png"),
    },
];
export default function Home() {
    return (<div className="flex min-h-screen flex-col bg-[#0b0d12] text-[#e5e7eb]">
      <SiteHeader />

      <main className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold tracking-[0.28em] text-[#ff5a66]">
              COUNTERSIDE WEB VIEWER
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-tight text-white sm:text-5xl">
              카운터사이드 웹뷰어
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#9ca3af] sm:text-lg">
              카운터사이드의 사원, 장비, 함선, 오퍼레이터, 수집 요소와 콘텐츠
              정보를 정리하는 웹사이트입니다.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {hubCards.map((card) => (<HubCard key={card.href} {...card}/>))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>);
}
