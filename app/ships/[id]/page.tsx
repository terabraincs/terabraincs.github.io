import { deploymentUrl } from "@/lib/deployment";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import Image from "@/components/DeploymentImage";
import Link from "@/components/DeploymentLink";
import { notFound } from "next/navigation";
import ShipSkillPanel from "@/components/ShipSkillPanel";
import RarityIcon from "@/components/RarityIcon";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { getShipDetail, loadShips } from "@/lib/ships";
type ShipDetailPageProps = {
    params: Promise<{
        id: string;
    }>;
};
export const dynamicParams = false;
export function generateStaticParams() {
    return loadShips().map((ship) => ({ id: ship.id }));
}
export async function generateMetadata({ params, }: ShipDetailPageProps): Promise<Metadata> {
    const { id } = await params;
    const ship = getShipDetail(decodeURIComponent(id));
    return {
        title: `${ship?.name ?? "함선 상세"} | 카운터사이드 웹뷰어`,
        description: "카운터사이드 함선 상세 정보를 확인하는 페이지입니다.",
    };
}
export default async function ShipDetailPage({ params }: ShipDetailPageProps) {
    const { id } = await params;
    const ship = getShipDetail(decodeURIComponent(id));
    if (!ship) {
        notFound();
    }
    return (<div className="flex min-h-screen flex-col bg-[#0b0d12] text-[#e5e7eb]">
      <SiteHeader />

      <main className="flex-1">
        <article className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <Link href={deploymentUrl("/ships")} className="inline-flex items-center text-sm font-semibold text-white transition hover:text-[#d1d5db]">
            ← 함선 목록
          </Link>

          <header className="mt-5 border-b border-[#343844] pb-6">
            <p className="text-sm font-semibold tracking-[0.28em] text-white">
              SHIP DETAIL
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-3xl font-black text-white sm:text-4xl">
                  {ship.name}
                </h1>
              </div>
              <div className="flex flex-wrap gap-2">
                <RarityIcon grade={ship.grade} size="lg"/>
                <span className="inline-flex items-center gap-2 rounded border border-[#343844] bg-[#171a21] px-3 py-2 text-sm font-bold text-[#e5e7eb]">
                  {ship.shipTypeIconPath ? (<Image src={ship.shipTypeIconPath} alt="" width={18} height={18} className="h-[18px] w-[18px] object-contain"/>) : null}
                  <span>{ship.title}</span>
                </span>
              </div>
            </div>
          </header>

          <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
            <div className="overflow-hidden rounded-md border border-[#343844] bg-[#171a21]">
              <div className="relative flex aspect-[16/10] items-center justify-center bg-[#050608]">
                {ship.imagePath ? (<Image src={ship.imagePath} alt="" fill sizes="(max-width: 1024px) 100vw, 420px" className="object-contain p-5" priority/>) : (<div className="text-xs font-bold tracking-[0.25em] text-[#565c6b]">
                    NO IMAGE
                  </div>)}
              </div>

              <div className="grid grid-cols-2 border-t border-[#343844] text-sm">
                <InfoCell label="함종" value={ship.title} iconPath={ship.shipTypeIconPath}/>
                <InfoCell label="등급" value={<RarityIcon grade={ship.grade} size="md"/>}/>
              </div>
            </div>

            <div className="space-y-6">
              <section className="rounded-md border border-[#343844] bg-[#171a21] p-5">
                <SectionTitle title="작전 능력" note="1레벨 기준"/>
                {ship.stats.length > 0 ? (<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {ship.stats.map((stat) => (<div key={stat.label} className="border border-[#343844] bg-[#0b0d12] p-3">
                        <p className="text-xs font-bold text-[#9ca3af]">
                          {stat.label}
                        </p>
                        <p className="mt-1 text-lg font-black text-white">
                          {stat.value}
                        </p>
                      </div>))}
                  </div>) : (<EmptyMessage text="능력치 데이터가 없습니다."/>)}
              </section>
            </div>
          </section>

          <section className="mt-8 rounded-md border border-[#343844] bg-[#171a21] p-5">
            <SectionTitle title="함선 스킬"/>
            <ShipSkillPanel skillStages={ship.skillStages}/>
          </section>
        </article>
      </main>

      <SiteFooter />
    </div>);
}
function InfoCell({ label, value, iconPath = "", }: {
    label: string;
    value: ReactNode;
    iconPath?: string;
}) {
    return (<div className="border-r border-t border-[#343844] p-3">
      <p className="text-xs font-bold text-[#9ca3af]">{label}</p>
      <div className="mt-1 flex min-h-6 items-center gap-2 font-black text-white">
        {iconPath ? (<Image src={iconPath} alt="" width={18} height={18} className="h-[18px] w-[18px] object-contain"/>) : null}
        <span>{value || "-"}</span>
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
