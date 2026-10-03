import { deploymentUrl } from "@/lib/deployment";
import type { Metadata } from "next";
import Image from "@/components/DeploymentImage";
import Link from "@/components/DeploymentLink";
import { notFound } from "next/navigation";
import EquipmentMainStatPanel from "@/components/EquipmentMainStatPanel";
import RarityIcon from "@/components/RarityIcon";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { getEquipmentDetail, getEquipmentRouteIds, type EquipmentSeriesLink, } from "@/lib/equipment";
type EquipmentDetailPageProps = {
    params: Promise<{
        id: string;
    }>;
};
export const dynamicParams = false;
export function generateStaticParams() {
    return getEquipmentRouteIds().map((id) => ({ id }));
}
export async function generateMetadata({ params, }: EquipmentDetailPageProps): Promise<Metadata> {
    const { id } = await params;
    const equipment = getEquipmentDetail(id);
    return {
        title: `${equipment?.name ?? "장비 상세"} | 카운터사이드 웹뷰어`,
        description: "카운터사이드 장비 상세 정보를 확인하는 페이지입니다.",
    };
}
export default async function EquipmentDetailPage({ params, }: EquipmentDetailPageProps) {
    const { id } = await params;
    const equipment = getEquipmentDetail(id);
    if (!equipment) {
        notFound();
    }
    return (<div className="flex min-h-screen flex-col bg-[#0b0d12] text-[#e5e7eb]">
      <SiteHeader />

      <main className="flex-1">
        <article className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <Link href={deploymentUrl("/equipment")} className="inline-flex items-center text-sm font-semibold text-white transition hover:text-[#d1d5db]">
            ← 장비 목록
          </Link>

          <header className="mt-5 border-b border-[#343844] pb-6">
            <p className="text-sm font-semibold tracking-[0.28em] text-white">
              EQUIPMENT DETAIL
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <h1 className="text-3xl font-black text-white sm:text-4xl">
                {equipment.name}
              </h1>
              <div className="flex flex-wrap gap-2">
                <InfoBadge text={`T${equipment.tier}`}/>
                <span className="inline-flex items-center rounded border border-[#343844] bg-[#171a21] px-3 py-2">
                  <RarityIcon grade={equipment.grade} size="md"/>
                </span>
                <InfoBadge text={equipment.position}/>
                <InfoBadge text={equipment.unitType}/>
                {equipment.equipmentKind === "렐릭 장비" ? (<InfoBadge text="렐릭 장비"/>) : null}
                {equipment.isExclusive ? <InfoBadge text="전용장비"/> : null}
                {equipment.privateUnitNames.map((unitName) => (<InfoBadge key={unitName} text={unitName}/>))}
              </div>
            </div>
          </header>

          <nav className="mt-6 flex flex-wrap gap-2 border-b border-[#343844] pb-6" aria-label="장비 상세 문단 이동">
            <DetailSectionLink href="#equipment-info" label="장비 정보"/>
            <DetailSectionLink href="#equipment-description" label="장비 설명"/>
            {equipment.seriesItems.length > 0 ? (<DetailSectionLink href="#equipment-series" label="장비 세트"/>) : null}
            <DetailSectionLink href="#equipment-main-stat" label="주 능력치"/>
            <DetailSectionLink href="#equipment-options" label="보조 옵션"/>
            {equipment.potentialOptions.length > 0 ? (<DetailSectionLink href="#equipment-potential" label="잠재 옵션"/>) : null}
            <DetailSectionLink href="#equipment-set-options" label="세트 옵션"/>
          </nav>

          <div className="mt-8 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-md border border-[#343844] bg-[#171a21]">
              <div className="relative flex aspect-square items-center justify-center bg-[#0f1117]">
                {equipment.backgroundImagePath ? (<Image src={equipment.backgroundImagePath} alt="" fill sizes="(max-width: 1024px) 100vw, 360px" className="object-cover" priority/>) : null}
                {equipment.imagePath ? (<Image src={equipment.imagePath} alt={`${equipment.name} 이미지`} fill sizes="(max-width: 1024px) 100vw, 360px" className="z-10 object-contain p-5" priority/>) : (<span className="relative z-10 text-xs font-bold tracking-[0.2em] text-[#565c6b]">
                    NO IMAGE
                  </span>)}
              </div>
            </div>

            <div className="min-w-0">
              <section id="equipment-info" className="scroll-mt-24">
                <SectionTitle title="장비 정보"/>
                <div className="mt-4 grid grid-cols-2 border-l border-t border-[#343844] sm:grid-cols-3">
                  <InfoCell label="장착 부위" value={equipment.position}/>
                  <InfoCell label="사원 타입" value={equipment.unitType}/>
                  <InfoCell label="구분" value={equipment.equipmentKind}/>
                </div>
              </section>

              {equipment.privateUnits.length > 0 ||
            equipment.sameImageVariants.length > 0 ? (<div className={`mt-8 grid gap-6 ${equipment.privateUnits.length > 0 &&
                equipment.sameImageVariants.length > 0
                ? "lg:grid-cols-2"
                : ""}`}>
                  {equipment.privateUnits.length > 0 ? (<section id="equipment-private-unit" className="min-w-0 scroll-mt-24">
                      <SectionTitle title="전용 사원"/>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {equipment.privateUnits.map((unit) => (<Link key={unit.id} href={unit.href} className="flex min-h-20 min-w-[220px] items-center overflow-hidden border border-[#343844] bg-[#171a21] text-sm font-black text-[#e5e7eb] transition hover:border-white hover:bg-[#1d2029] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#9ca3af]">
                            <span className="relative h-20 w-20 shrink-0 bg-[#0b0d12]">
                              {unit.imagePath ? (<Image src={unit.imagePath} alt="" fill sizes="80px" className="object-contain"/>) : null}
                            </span>
                            <span className="min-w-0 px-4 py-3">
                              {unit.title ? (<span className="block truncate text-xs font-bold text-[#9ca3af]">
                                  {unit.title}
                                </span>) : null}
                              <span className="mt-1 block truncate">
                                {unit.name}
                              </span>
                            </span>
                          </Link>))}
                      </div>
                    </section>) : null}

                  {equipment.sameImageVariants.length > 0 ? (<section id="equipment-variants" className="min-w-0 scroll-mt-24">
                      <SectionTitle title="다른 티어·희귀도"/>
                      <div className={`mt-4 grid gap-3 ${equipment.privateUnits.length === 0
                    ? "sm:grid-cols-2"
                    : ""}`}>
                        {equipment.sameImageVariants.map((variant) => (<Link key={variant.id} href={variant.href} className="flex min-h-16 items-center justify-between gap-4 border border-[#343844] bg-[#171a21] px-4 py-3 transition hover:border-white hover:bg-[#1d2029] focus:outline-none focus:ring-2 focus:ring-[#9ca3af]">
                            <span className="min-w-0 truncate text-sm font-black text-white">
                              {variant.name}
                            </span>
                            <span className="flex shrink-0 items-center gap-2 text-sm font-black text-[#d1d5db]">
                              <span>T{variant.tier}</span>
                              <RarityIcon grade={variant.grade} size="sm"/>
                            </span>
                          </Link>))}
                      </div>
                    </section>) : null}
                </div>) : null}
            </div>
          </div>

          <section id="equipment-description" className="mt-10 scroll-mt-24">
            <SectionTitle title="장비 설명"/>
            <p className="mt-4 border-l-4 border-white bg-[#171a21] px-4 py-4 whitespace-pre-line text-sm leading-7 text-[#c7cbd1]">
              {equipment.description}
            </p>
          </section>

          {equipment.seriesItems.length > 0 ? (<section id="equipment-series" className="mt-10 scroll-mt-24">
              <SectionTitle title="장비 세트"/>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {equipment.seriesItems.map((seriesItem) => (<EquipmentSeriesCard key={seriesItem.id} item={seriesItem}/>))}
              </div>
            </section>) : null}

          <section id="equipment-main-stat" className="mt-10 scroll-mt-24">
            <SectionTitle title="주 능력치"/>
            <EquipmentMainStatPanel label={equipment.mainStatLabel} values={equipment.mainStatValues}/>
          </section>

          <section id="equipment-options" className="mt-10 scroll-mt-24">
            <SectionTitle title="보조 옵션"/>
            {equipment.randomOptionGroups.length > 0 ? (<div className="mt-4 grid gap-5">
                {equipment.randomOptionGroups.map((group) => (<div key={group.label}>
                    <h3 className="border-b border-[#343844] pb-2 text-base font-black text-white">
                      {group.label}
                    </h3>
                    <ul className="mt-3 grid grid-cols-2 border-l border-t border-[#343844] bg-[#171a21]">
                      {group.options.map((option) => (<li key={option} className="min-w-0 break-words border-r border-b border-[#343844] px-3 py-3 text-sm font-semibold leading-6 text-[#c7cbd1] sm:px-4">
                          {option}
                        </li>))}
                    </ul>
                  </div>))}
              </div>) : (<EmptyMessage text="보조 옵션 데이터가 없습니다."/>)}
          </section>

          {equipment.potentialOptions.length > 0 ? (<section id="equipment-potential" className="mt-10 scroll-mt-24">
              <SectionTitle title="잠재 옵션"/>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {equipment.potentialOptions.map((option) => (<div key={option.id} className="rounded-md border border-[#343844] bg-[#171a21] p-4">
                    <h3 className="font-black text-white">{option.label}</h3>
                    <ul className="mt-3 space-y-2 text-sm font-semibold text-[#9ca3af]">
                      {option.sockets.map((socket) => (<li key={socket}>{socket}</li>))}
                    </ul>
                  </div>))}
              </div>
            </section>) : null}

          <section id="equipment-set-options" className="mt-10 scroll-mt-24">
            <SectionTitle title="세트 옵션"/>
            {equipment.setOptions.length > 0 ? (<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {equipment.setOptions.map((setOption) => (<div key={setOption.id} className="grid min-h-28 grid-cols-[56px_minmax(0,1fr)] gap-3 rounded-md border border-[#343844] bg-[#171a21] p-4">
                    <div className="flex h-14 w-14 items-center justify-center bg-[#0b0d12]">
                      {setOption.iconPath ? (<Image src={setOption.iconPath} alt="" width={44} height={44} className="h-11 w-11 object-contain"/>) : null}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-black text-white">
                        {setOption.name}
                      </h3>
                      <p className="mt-1 text-xs font-bold text-[#9ca3af]">
                        {setOption.requiredParts}세트
                      </p>
                      {setOption.effects.map((effect) => (<p key={effect} className="mt-1 text-sm font-semibold text-[#c7cbd1]">
                          {effect}
                        </p>))}
                    </div>
                  </div>))}
              </div>) : (<EmptyMessage text="적용 가능한 세트 옵션이 없습니다."/>)}
          </section>

        </article>
      </main>

      <SiteFooter />
    </div>);
}
function InfoBadge({ text }: {
    text: string;
}) {
    return (<span className="inline-flex items-center gap-2 rounded border border-[#343844] bg-[#171a21] px-3 py-2 text-sm font-black text-white">
      {text}
    </span>);
}
function EquipmentSeriesCard({ item }: {
    item: EquipmentSeriesLink;
}) {
    const content = (<>
      <span className="relative h-24 w-24 shrink-0 overflow-hidden bg-[#0f1117]">
        {item.backgroundImagePath ? (<Image src={item.backgroundImagePath} alt="" fill sizes="96px" className="object-cover"/>) : null}
        {item.imagePath ? (<Image src={item.imagePath} alt="" fill sizes="96px" className="z-10 object-contain p-2"/>) : null}
      </span>
      <span className="min-w-0 px-3 py-3">
        <span className="flex flex-wrap items-center gap-2 text-xs font-black text-[#9ca3af]">
          <span>{item.position}</span>
          <span>T{item.tier}</span>
          <RarityIcon grade={item.grade} size="xs"/>
        </span>
        <span className="mt-2 line-clamp-2 block text-sm font-black leading-5 text-white">
          {item.name}
        </span>
        {item.isCurrent ? (<span className="mt-2 block text-xs font-bold text-white">
            현재 장비
          </span>) : null}
      </span>
    </>);
    const className = [
        "flex min-h-24 min-w-0 overflow-hidden border bg-[#171a21]",
        item.isCurrent
            ? "border-white ring-1 ring-white/30"
            : "border-[#343844] transition hover:border-white hover:bg-[#1d2029] focus:outline-none focus:ring-2 focus:ring-[#9ca3af]",
    ].join(" ");
    return item.isCurrent ? (<div className={className} aria-current="page">
      {content}
    </div>) : (<Link href={item.href} className={className}>
      {content}
    </Link>);
}
function DetailSectionLink({ href, label }: {
    href: string;
    label: string;
}) {
    return (<a href={href} className="border border-[#343844] bg-[#171a21] px-3 py-2 text-sm font-black text-[#d1d5db] transition hover:border-white hover:text-white focus:outline-none focus:ring-2 focus:ring-[#9ca3af]">
      {label}
    </a>);
}
function InfoCell({ label, value }: {
    label: string;
    value: string;
}) {
    return (<div className="border-b border-r border-[#343844] bg-[#171a21] p-3">
      <p className="text-xs font-bold text-[#9ca3af]">{label}</p>
      <p className="mt-1 font-black text-white">{value || "-"}</p>
    </div>);
}
function SectionTitle({ title }: {
    title: string;
}) {
    return (<h2 className="border-b border-[#343844] pb-3 text-xl font-black text-white">
      <span className="mr-2 text-white">■</span>
      {title}
    </h2>);
}
function EmptyMessage({ text }: {
    text: string;
}) {
    return (<div className="mt-4 border border-[#343844] bg-[#171a21] px-4 py-8 text-center text-sm font-semibold text-[#9ca3af]">
      {text}
    </div>);
}
