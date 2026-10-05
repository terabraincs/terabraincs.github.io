"use client";
import { useEffect, useMemo, useState } from "react";
import CollectionAcquisitionList from "@/components/CollectionAcquisitionList";
import CollectionFramePreview from "@/components/CollectionFramePreview";
import CollectionSortButtons from "@/components/CollectionSortButtons";
import SearchInput from "@/components/SearchInput";
import ListResultCount from "@/components/ListResultCount";
import type { CollectionFrameItem } from "@/lib/collectionFrames";
export default function CollectionFrameList({ frames, }: {
    frames: CollectionFrameItem[];
}) {
    const [keyword, setKeyword] = useState("");
    const [sortMode, setSortMode] = useState<"order" | "name">("order");
    const [selectedFrame, setSelectedFrame] = useState<CollectionFrameItem | null>(null);
    const normalizedKeyword = keyword.trim().toLocaleLowerCase("ko-KR");
    const visibleFrames = useMemo(() => {
        return frames
            .filter((frame) => {
            return (!normalizedKeyword ||
                [
                    frame.name,
                    frame.description,
                    ...frame.acquisition.flatMap((entry) => [
                        entry.source,
                        entry.detail,
                    ]),
                ]
                    .join(" ")
                    .toLocaleLowerCase("ko-KR")
                    .includes(normalizedKeyword));
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
    }, [frames, normalizedKeyword, sortMode]);
    useEffect(() => {
        if (!selectedFrame) {
            return;
        }
        const previousOverflow = document.body.style.overflow;
        function closeOnEscape(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setSelectedFrame(null);
            }
        }
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", closeOnEscape);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", closeOnEscape);
        };
    }, [selectedFrame]);
    return (<>
      <section className="mt-8 border border-[#343844] bg-[#111318] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="flex h-11 min-w-0 flex-1 items-center gap-3 border border-[#4b5563] bg-[#0b0d12] px-4 focus-within:border-white">
            <SearchInput value={keyword} onChange={(event) => setKeyword(event.target.value)} ariaLabel="프레임 검색" containerClassName="h-full flex-1" inputClassName="h-full bg-transparent text-sm text-[#e5e7eb] outline-none placeholder:text-[#565c6b]"/>
          </label>

          <div className="flex items-center justify-between gap-3 lg:justify-end">
            <CollectionSortButtons label="프레임" value={sortMode} onChange={setSortMode}/>
            <ListResultCount label="프레임" count={visibleFrames.length} total={frames.length}/>
          </div>
        </div>
      </section>

      {visibleFrames.length > 0 ? (<div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {visibleFrames.map((frame) => (<button key={frame.id} type="button" aria-haspopup="dialog" onClick={() => setSelectedFrame(frame)} className="group min-w-0 overflow-hidden border border-[#343844] bg-[#171a21] text-left transition hover:-translate-y-1 hover:border-white hover:bg-[#222631] focus:outline-none focus:ring-2 focus:ring-[#9ca3af]">
              <div className="flex aspect-square items-center justify-center overflow-hidden border-b border-[#343844] bg-[#0b0d12] p-4 transition duration-300 group-hover:scale-105">
                <CollectionFramePreview imagePath={frame.imagePath} name={frame.name}/>
              </div>
              <h2 className="flex min-h-16 items-center px-3 py-3 text-center text-sm font-black leading-5 text-white">
                <span className="line-clamp-2 w-full">{frame.name}</span>
              </h2>
            </button>))}
        </div>) : (<div className="mt-5 border border-[#343844] bg-[#171a21] px-5 py-16 text-center text-sm font-bold text-[#9ca3af]">
          조건에 맞는 프레임이 없습니다.
        </div>)}

      {selectedFrame ? (<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-4 py-6" role="presentation" onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    setSelectedFrame(null);
                }
            }}>
          <section role="dialog" aria-modal="true" aria-labelledby="frame-detail-title" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto border border-[#4b5563] bg-[#171a21] shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
            <header className="flex items-center justify-between gap-4 border-b border-[#343844] bg-[#111318] px-5 py-4">
              <h2 id="frame-detail-title" className="min-w-0 text-xl font-black text-white sm:text-2xl">
                {selectedFrame.name}
              </h2>
              <button type="button" onClick={() => setSelectedFrame(null)} className="shrink-0 border border-[#4b5563] bg-[#0b0d12] px-3 py-2 text-sm font-bold text-[#c7cbd1] transition hover:border-white hover:text-white focus:outline-none focus:ring-2 focus:ring-[#9ca3af]">
                닫기
              </button>
            </header>

            <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[240px_minmax(0,1fr)] md:items-start">
              <div className="mx-auto flex aspect-square w-full max-w-60 items-center justify-center border border-[#343844] bg-[#0b0d12] p-5">
                <CollectionFramePreview imagePath={selectedFrame.imagePath} name={selectedFrame.name}/>
              </div>

              <div className="min-w-0">
                {!selectedFrame.isCollectionRegistered ? (<span className="inline-flex border border-[#4b5563] bg-[#111318] px-2 py-1 text-xs font-bold text-[#c7cbd1]">
                    컬렉션 외
                  </span>) : null}
                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[#c7cbd1] sm:text-base">
                  {selectedFrame.description}
                </p>
                <CollectionAcquisitionList entries={selectedFrame.acquisition} collapsible={false}/>
              </div>
            </div>
          </section>
        </div>) : null}
    </>);
}
