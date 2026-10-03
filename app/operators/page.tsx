import type { Metadata } from "next";
import OperatorSearchList from "@/components/OperatorSearchList";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { loadOperators } from "@/lib/operators";
export const metadata: Metadata = {
    title: "오퍼레이터 | 카운터사이드 웹뷰어",
    description: "카운터사이드 오퍼레이터 목록을 확인하는 페이지입니다.",
};
export default function OperatorsPage() {
    const operators = loadOperators();
    const isUsingLocalData = operators.length > 0;
    return (<div className="flex min-h-screen flex-col bg-[#0b0d12] text-[#e5e7eb]">
      <SiteHeader />

      <main className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="flex flex-col gap-3 border-b border-[#343844] pb-6">
            <p className="text-sm font-semibold tracking-[0.28em] text-white">
              OPERATOR LIST
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white sm:text-4xl">
                  오퍼레이터 목록
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#9ca3af] sm:text-base">
                  {isUsingLocalData
            ? "오퍼레이터의 스킬, 보조기술과 음성을 확인할 수 있습니다."
            : "오퍼레이터 json 데이터가 없는 환경에서는 목록을 표시하지 않습니다."}
                </p>
              </div>
              <p className="text-sm font-semibold text-white">
                {isUsingLocalData ? "총" : "데이터 없음"}{" "}
                {operators.length}개
              </p>
            </div>
          </div>

          {isUsingLocalData ? (<OperatorSearchList operators={operators}/>) : (<div className="mt-8 rounded-md border border-[#343844] bg-[#171a21] px-4 py-12 text-center text-sm font-semibold text-[#9ca3af]">
              `json/operator` 폴더에 오퍼레이터 데이터가 있으면 이곳에 목록이
              표시됩니다.
            </div>)}
        </section>
      </main>

      <SiteFooter />
    </div>);
}
