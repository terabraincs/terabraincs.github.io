import { deploymentUrl } from "@/lib/deployment";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import Image from "@/components/DeploymentImage";
import Link from "@/components/DeploymentLink";
import { notFound } from "next/navigation";
import OperatorSkillPanel from "@/components/OperatorSkillPanel";
import OperatorStatsPanel from "@/components/OperatorStatsPanel";
import RarityIcon from "@/components/RarityIcon";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import VoicePlayButton from "@/components/VoicePlayButton";
import { getOperatorDetail, loadOperators } from "@/lib/operators";
type OperatorDetailPageProps = {
    params: Promise<{
        id: string;
    }>;
};
export const dynamicParams = false;
export function generateStaticParams() {
    return loadOperators().map((operator) => ({ id: operator.id }));
}
export async function generateMetadata({ params, }: OperatorDetailPageProps): Promise<Metadata> {
    const { id } = await params;
    const operator = getOperatorDetail(decodeURIComponent(id), {
        includeDialogues: false,
    });
    return {
        title: `${operator?.name ?? "오퍼레이터 상세"} | 카운터사이드 웹뷰어`,
        description: "카운터사이드 오퍼레이터 상세 정보를 확인하는 페이지입니다.",
    };
}
export default async function OperatorDetailPage({ params, }: OperatorDetailPageProps) {
    const { id } = await params;
    const operator = getOperatorDetail(decodeURIComponent(id));
    if (!operator) {
        notFound();
    }
    const normalDialogues = operator.dialogues.filter((dialogue) => !dialogue.isExtra);
    const extraDialogues = operator.dialogues.filter((dialogue) => dialogue.isExtra);
    return (<div className="flex min-h-screen flex-col bg-[#0b0d12] text-[#e5e7eb]">
      <SiteHeader />

      <main className="flex-1">
        <article className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <Link href={deploymentUrl("/operators")} className="inline-flex items-center text-sm font-semibold text-white transition hover:text-[#d1d5db]">
            ← 오퍼레이터 목록
          </Link>

          <header className="mt-5 border-b border-[#343844] pb-6">
            <p className="text-sm font-semibold tracking-[0.28em] text-white">
              OPERATOR DETAIL
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-3xl font-black text-white sm:text-4xl">
                  {operator.name}
                </h1>
                <p className="mt-2 text-sm font-semibold text-[#9ca3af]">
                  {operator.title}
                </p>
              </div>
              <RarityIcon grade={operator.grade} size="lg"/>
            </div>
          </header>

          <div className="mt-8 space-y-6">
            <section className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr] lg:items-start">
              <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-md border border-[#343844] bg-[#171a21] lg:mx-0">
                <div className="relative flex aspect-[256/354] items-center justify-center bg-[#050608]">
                  {operator.imagePath ? (<Image src={operator.imagePath} alt={`${operator.name} 이미지`} fill sizes="(max-width: 1024px) 320px, 320px" className="object-fill" priority/>) : (<div className="text-xs font-bold tracking-[0.25em] text-[#565c6b]">
                      NO IMAGE
                    </div>)}
                </div>

                <div className="grid grid-cols-2 border-t border-[#343844] text-sm">
                  <InfoCell label="등급" value={<RarityIcon grade={operator.grade} size="md"/>}/>
                  <InfoCell label="보조 기술" value={`${operator.passiveCount}개`}/>
                </div>
              </div>

              <div className="space-y-6">
                <OperatorStatsPanel stats={operator.stats}/>
                <OperatorSkillPanel skill={operator.tacticalSkill}/>
              </div>
            </section>

            <section className="rounded-md border border-[#343844] bg-[#171a21] p-5">
              <SectionTitle title="대사"/>
              {operator.dialogues.length > 0 ? (<div className="mt-4">
                  <div className="grid gap-3">
                    {normalDialogues.map((dialogue) => (<div key={dialogue.id} className="voice-dialogue-card border border-[#343844] bg-[#0b0d12] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="pt-2 text-sm font-black text-[#bf9000]">
                            {dialogue.label}
                          </p>
                          {dialogue.audioPath ? (<VoicePlayButton src={dialogue.audioPath} label={`${dialogue.label} 대사`}/>) : null}
                        </div>
                        <p className="mt-2 text-base leading-7 text-[#d1d5db]">
                          {dialogue.text}
                        </p>
                      </div>))}
                  </div>

                  {extraDialogues.length > 0 ? (<details className="mt-4">
                      <summary className="cursor-pointer border border-[#343844] bg-[#222631] px-4 py-3 text-sm font-black text-[#e5e7eb] transition hover:bg-[#2a2f3c]">
                        엑스트라 대사
                        <span className="ml-2 text-xs text-[#9ca3af]">
                          {extraDialogues.length}개
                        </span>
                      </summary>
                      <div className="mt-3 grid gap-3">
                        {extraDialogues.map((dialogue) => (<div key={dialogue.id} className="voice-dialogue-card border border-[#343844] bg-[#0b0d12] p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-2 pt-2">
                                <p className="text-sm font-black text-[#bf9000]">
                                  {dialogue.label}
                                </p>
                                <span className="border border-[#4b5160] bg-[#222631] px-1.5 py-0.5 text-[10px] font-black text-[#cfd4dc]">
                                  엑스트라
                                </span>
                              </div>
                              {dialogue.audioPath ? (<VoicePlayButton src={dialogue.audioPath} label={`${dialogue.label} 엑스트라 대사`}/>) : null}
                            </div>
                            <p className="mt-2 text-base leading-7 text-[#d1d5db]">
                              {dialogue.text}
                            </p>
                          </div>))}
                      </div>
                    </details>) : null}
                </div>) : (<EmptyMessage text="대사 데이터가 없습니다."/>)}
            </section>
          </div>
        </article>
      </main>

      <SiteFooter />
    </div>);
}
function InfoCell({ label, value }: {
    label: string;
    value: ReactNode;
}) {
    return (<div className="border-r border-t border-[#343844] p-3">
      <p className="text-xs font-bold text-[#9ca3af]">{label}</p>
      <div className="mt-1 flex min-h-6 items-center font-black text-white">
        {value || "-"}
      </div>
    </div>);
}
function SectionTitle({ title, note = "" }: {
    title: string;
    note?: string;
}) {
    return (<h2 className="border-b border-[#343844] pb-3 text-xl font-black text-white">
      <span className="mr-2 text-white">■</span>
      {title}
      {note ? (<span className="ml-3 align-middle text-sm font-bold text-[#9ca3af]">
          {note}
        </span>) : null}
    </h2>);
}
function EmptyMessage({ text }: {
    text: string;
}) {
    return (<div className="mt-4 border border-[#343844] bg-[#0b0d12] px-4 py-8 text-center text-sm font-semibold text-[#9ca3af]">
      {text}
    </div>);
}
