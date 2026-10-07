import type { Metadata } from "next";
import SwordTrainingClientGame from "@/components/minigames/sword-training/SwordTrainingClientGame";
export const metadata: Metadata = {
    title: "나이엘의 검술 훈련 | 카운터사이드 웹뷰어",
    description: "좌우에서 다가오는 침식체를 베어내는 미니게임입니다.",
};
export default function SwordTrainingPage() {
    return <SwordTrainingClientGame />;
}
