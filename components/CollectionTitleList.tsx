"use client";
import { useMemo, useState } from "react";
import Image from "@/components/DeploymentImage";
import CollectionSortButtons from "@/components/CollectionSortButtons";
import SearchInput from "@/components/SearchInput";
import ListResultCount from "@/components/ListResultCount";
import type { CollectionTitleCategory, CollectionTitleItem, } from "@/lib/collectionTitles";
type CollectionTitleListProps = {
    titles: CollectionTitleItem[];
    categories: CollectionTitleCategory[];
};
function createOutlineShadow(color: string) {
    return `-1px -1px 0 ${color}, 1px -1px 0 ${color}, -1px 1px 0 ${color}, 1px 1px 0 ${color}`;
}
export default function CollectionTitleList({ titles, categories, }: CollectionTitleListProps) {
    const [keyword, setKeyword] = useState("");
    const [categoryId, setCategoryId] = useState(0);
    const [sortMode, setSortMode] = useState<"order" | "name">("order");
    const normalizedKeyword = keyword.trim().toLocaleLowerCase("ko-KR");
    const visibleTitles = useMemo(() => {
        return titles
            .filter((title) => {
            const matchesCategory = categoryId === 0 || title.categoryId === categoryId;
            const matchesKeyword = !normalizedKeyword ||
                [
                    title.name,
                    title.description,
                    title.categoryName,
                    String(title.id),
                ]
                    .join(" ")
                    .toLocaleLowerCase("ko-KR")
                    .includes(normalizedKeyword);
            return matchesCategory && matchesKeyword;
        })
            .sort((first, second) => {
            if (sortMode === "name") {
                return first.name.localeCompare(second.name, "ko-KR");
            }
            return first.order - second.order || first.id - second.id;
        });
    }, [categoryId, normalizedKeyword, sortMode, titles]);
    return (<>
      <section className="mt-8 border border-[#343844] bg-[#111318] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="flex h-11 min-w-0 flex-1 items-center gap-3 border border-[#4b5563] bg-[#0b0d12] px-4 focus-within:border-white">
            <SearchInput value={keyword} onChange={(event) => setKeyword(event.target.value)} ariaLabel="칭호 검색" containerClassName="h-full flex-1" inputClassName="h-full bg-transparent text-sm text-[#e5e7eb] outline-none placeholder:text-[#565c6b]"/>
          </label>

          <div className="flex items-center justify-between gap-3 lg:justify-end">
            <CollectionSortButtons label="칭호" value={sortMode} onChange={setSortMode}/>
            <ListResultCount label="칭호" count={visibleTitles.length} total={titles.length}/>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          <button type="button" onClick={() => setCategoryId(0)} aria-pressed={categoryId === 0} className={`min-h-11 border px-3 py-2 text-sm font-bold transition ${categoryId === 0
            ? "border-white bg-white text-[#111318]"
            : "border-[#4b5563] bg-black/30 text-[#9ca3af] hover:border-white hover:text-white"}`}>
            전체
          </button>
          {categories.map((category) => (<button key={category.id} type="button" onClick={() => setCategoryId(category.id)} aria-pressed={categoryId === category.id} className={`min-h-11 border px-3 py-2 text-sm font-bold transition ${categoryId === category.id
                ? "border-white bg-white text-[#111318]"
                : "border-[#4b5563] bg-black/30 text-[#9ca3af] hover:border-white hover:text-white"}`}>
              {category.name}
            </button>))}
        </div>
      </section>

      {visibleTitles.length > 0 ? (<div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {visibleTitles.map((title) => (<article key={title.id} className="min-w-0 border border-[#343844] bg-[#171a21] p-4">
              <div className="flex justify-center border border-[#2b303a] bg-[#0b0d12] p-3">
                <div className="relative aspect-[4/1] w-full max-w-[256px] overflow-hidden">
                  {title.imagePath ? (<Image src={title.imagePath} alt="" fill sizes="256px" className="object-fill"/>) : null}
                  {!title.isImageTitle ? (<span className="absolute inset-0 flex items-center justify-center px-3 text-center text-sm font-black" style={{
                        color: title.textColor,
                        textShadow: createOutlineShadow(title.outlineColor),
                    }}>
                      {title.name}
                    </span>) : null}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className="border border-[#4b5563] bg-[#111318] px-2 py-1 text-[#c7cbd1]">
                  {title.categoryName}
                </span>
                {title.hasEffect ? (<span className="border border-[#4b5563] bg-[#111318] px-2 py-1 text-[#c7cbd1]">
                    효과
                  </span>) : null}
              </div>

              <h2 className="mt-3 text-lg font-black text-white">{title.name}</h2>
              <p className="mt-2 min-h-12 whitespace-pre-line text-sm leading-6 text-[#9ca3af]">
                {title.description}
              </p>
              {title.expiryDate ? (<p className="mt-3 border-t border-[#343844] pt-3 text-xs font-bold text-[#9ca3af]">
                  만료 {title.expiryDate}
                </p>) : null}
            </article>))}
        </div>) : (<div className="mt-5 border border-[#343844] bg-[#171a21] px-5 py-16 text-center text-sm font-bold text-[#9ca3af]">
          조건에 맞는 칭호가 없습니다.
        </div>)}
    </>);
}
