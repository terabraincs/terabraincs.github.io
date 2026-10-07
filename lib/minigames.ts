import { deploymentUrl } from "@/lib/deployment";
export type MiniGameSummary = {
    slug: string;
    title: string;
    imagePath: string;
    available: boolean;
};
export const miniGames: MiniGameSummary[] = [
    {
        slug: "cafe-strega",
        title: "카페 스트레가",
        imagePath: deploymentUrl("/game-assets/cafe-strega/images/ui/SINGLE_CAFE_BG.png"),
        available: true,
    },
    {
        slug: "match-ten",
        title: "탕비실 침공작전",
        imagePath: deploymentUrl("/game-assets/match-ten/images/texture/UI_SINGLE_MATCHTEN_CUT_02.png"),
        available: true,
    },
    {
        slug: "sword-training",
        title: "나이엘의 검술 훈련",
        imagePath: deploymentUrl("/game-assets/sword-training/images/texture/UI_SINGLE_SWORDTRAINING_CUT_01.png"),
        available: true,
    },
];
