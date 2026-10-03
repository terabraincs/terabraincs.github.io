"use client";
import { useEffect, useMemo, useState } from "react";
import Image from "@/components/DeploymentImage";
import CollectionAcquisitionList from "@/components/CollectionAcquisitionList";
import CollectionSortButtons from "@/components/CollectionSortButtons";
import SearchInput from "@/components/SearchInput";
import type { CollectionEmblemItem } from "@/lib/collectionEmblems";
type CollectionEmblemListProps = {
    emblems: CollectionEmblemItem[];
};
export default function CollectionEmblemList({ emblems, }: CollectionEmblemListProps) {
    const [keyword, setKeyword] = useState("");
    const [sortMode, setSortMode] = useState<"order" | "name">("order");
    const [selectedEmblem, setSelectedEmblem] = useState<CollectionEmblemItem | null>(null);
    const normalizedKeyword = keyword.trim().toLocaleLowerCase("ko-KR");
    const visibleEmblems = useMemo(() => {
        return emblems
            .filter((emblem) => {
            const matchesKeyword = !normalizedKeyword ||
                [
                    emblem.name,
                    emblem.description,
                    emblem.typeName,
                    ...emblem.acquisition.flatMap((entry) => [
                        entry.source,
                        entry.detail,
                    ]),
                ]
                    .join(" ")
                    .toLocaleLowerCase("ko-KR")
                    .includes(normalizedKeyword);
            return matchesKeyword;
        })
            .sort((first, second) => {
            if (sortMode === "name") {
                return first.name.localeCompare(second.name, "ko-KR");
            }
            return (Number(second.isCollectionRegistered) -
                Number(first.isCollectionRegistered) ||
                first.order - second.order ||
                first.id - second.id);
        });
    }, [emblems, normalizedKeyword, sortMode]);
    useEffect(() => {
        if (!selectedEmblem) {
            return;
        }
        const previousOverflow = document.body.style.overflow;
        function closeOnEscape(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setSelectedEmblem(null);
            }
        }
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", closeOnEscape);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", closeOnEscape);
        };
    }, [selectedEmblem]);
    return (<>
      <section className="mt-8 border-y border-[#343844] bg-[#111318] px-4 py-5 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="flex min-w-0 flex-1 items-center gap-3 border border-[#4b5563] bg-[#0b0d12] px-4 py-3 focus-within:border-white">
            <SearchInput value={keyword} onChange={(event) => setKeyword(event.target.value)} ariaLabel="엠블럼 검색" containerClassName="flex-1" inputClassName="bg-transparent text-sm text-[#e5e7eb] outline-none placeholder:text-[#565c6b]"/>
          </label>

          <CollectionSortButtons label="엠블럼" value={sortMode} onChange={setSortMode}/>
        </div>
      </section>

      <div className="mt-6 flex items-center justify-between border-b border-[#343844] pb-3 text-sm font-bold">
        <span className="text-[#9ca3af]">검색 결과</span>
        <span className="text-white">{visibleEmblems.length}개</span>
      </div>

      {visibleEmblems.length > 0 ? (<div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {visibleEmblems.map((emblem) => (<button key={emblem.id} type="button" aria-haspopup="dialog" onClick={() => setSelectedEmblem(emblem)} className="group min-w-0 overflow-hidden border border-[#343844] bg-[#171a21] text-left transition hover:-translate-y-1 hover:border-white hover:bg-[#222631] focus:outline-none focus:ring-2 focus:ring-[#9ca3af]">
              <div className="relative aspect-square w-full overflow-hidden border-b border-[#343844] bg-[#0b0d12]">
                {emblem.imagePath ? (<Image src={emblem.imagePath} alt={`${emblem.name} 이미지`} fill sizes="(min-width: 1280px) 180px, (min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw" className="object-contain p-4 transition duration-300 group-hover:scale-105"/>) : (<span className="absolute inset-0 flex items-center justify-center text-xs font-bold tracking-[0.16em] text-[#565c6b]">
                    NO IMAGE
                  </span>)}
              </div>
              <h2 className="flex min-h-16 items-center px-3 py-3 text-center text-sm font-black leading-5 text-white">
                <span className="line-clamp-2 w-full">{emblem.name}</span>
              </h2>
            </button>))}
        </div>) : (<div className="mt-5 border border-[#343844] bg-[#171a21] px-5 py-16 text-center text-sm font-bold text-[#9ca3af]">
          조건에 맞는 엠블럼이 없습니다.
        </div>)}

      {selectedEmblem ? (<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-4 py-6" role="presentation" onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    setSelectedEmblem(null);
                }
            }}>
          <section role="dialog" aria-modal="true" aria-labelledby="emblem-detail-title" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto border border-[#4b5563] bg-[#171a21] shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
            <header className="flex items-center justify-between gap-4 border-b border-[#343844] bg-[#111318] px-5 py-4">
              <h2 id="emblem-detail-title" className="min-w-0 text-xl font-black text-white sm:text-2xl">
                {selectedEmblem.name}
              </h2>
              <button type="button" onClick={() => setSelectedEmblem(null)} className="shrink-0 border border-[#4b5563] bg-[#0b0d12] px-3 py-2 text-sm font-bold text-[#c7cbd1] transition hover:border-white hover:text-white focus:outline-none focus:ring-2 focus:ring-[#9ca3af]">
                닫기
              </button>
            </header>

            <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[240px_minmax(0,1fr)] md:items-start">
              <div className="relative mx-auto aspect-square w-full max-w-60 border border-[#343844] bg-[#0b0d12]">
                {selectedEmblem.imagePath ? (<Image src={selectedEmblem.imagePath} alt={`${selectedEmblem.name} 이미지`} fill sizes="240px" className="object-contain p-5"/>) : (<span className="absolute inset-0 flex items-center justify-center text-xs font-bold tracking-[0.16em] text-[#565c6b]">
                    NO IMAGE
                  </span>)}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap gap-2 text-xs font-bold text-[#c7cbd1]">
                  <span className="border border-[#4b5563] bg-[#111318] px-2 py-1">
                    {selectedEmblem.typeName}
                  </span>
                  {!selectedEmblem.isCollectionRegistered ? (<span className="border border-[#4b5563] bg-[#111318] px-2 py-1">
                      컬렉션 외
                    </span>) : null}
                </div>
                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[#c7cbd1] sm:text-base">
                  {selectedEmblem.description}
                </p>
                <CollectionAcquisitionList entries={selectedEmblem.acquisition} collapsible={false}/>
              </div>
            </div>
          </section>
        </div>) : null}
    </>);
}
