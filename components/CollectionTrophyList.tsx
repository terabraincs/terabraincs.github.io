"use client";
import { deploymentUrl } from "@/lib/deployment";
import { useEffect, useMemo, useState } from "react";
import Image from "@/components/DeploymentImage";
import CharacterAwakenCircuit from "@/components/CharacterAwakenCircuit";
import RarityIcon from "@/components/RarityIcon";
import SearchInput from "@/components/SearchInput";
import type { CollectionTrophyCategory, CollectionTrophyItem, } from "@/lib/collectionTrophies";
type TrophyFilterState = {
    categories: CollectionTrophyCategory[];
    roles: string[];
    grades: string[];
};
const categoryOptions: {
    value: CollectionTrophyCategory;
    label: string;
}[] = [
    { value: "sd", label: "SD 트로피" },
    { value: "decoration", label: "장식 트로피" },
    { value: "skill", label: "스킬 트로피" },
];
const categoryTagMap: Record<CollectionTrophyCategory, string> = {
    sd: "SD",
    decoration: "장식",
    skill: "스킬",
};
const roleOptions = [
    "스트라이커",
    "디펜더",
    "레인저",
    "스나이퍼",
    "서포터",
    "시즈",
    "타워",
];
const gradeOptions = ["SSR", "SR", "R", "N"];
const gradeColorMap: Record<string, string> = {
    N: "var(--grade-n)",
    R: "var(--grade-r)",
    SR: "var(--grade-sr)",
    SSR: "var(--grade-ssr)",
};
const roleTypeIconMap: Record<string, string> = {
    스트라이커: deploymentUrl("/unit/unit_type/NKM_UI_COMMON_UNIT_CLASS_ICON_STRIKER.png"),
    레인저: deploymentUrl("/unit/unit_type/NKM_UI_COMMON_UNIT_CLASS_ICON_RANGER.png"),
    디펜더: deploymentUrl("/unit/unit_type/NKM_UI_COMMON_UNIT_CLASS_ICON_DEFENDER.png"),
    스나이퍼: deploymentUrl("/unit/unit_type/NKM_UI_COMMON_UNIT_CLASS_ICON_SNIPER.png"),
    서포터: deploymentUrl("/unit/unit_type/NKM_UI_COMMON_UNIT_CLASS_ICON_SUPPORTER.png"),
    시즈: deploymentUrl("/unit/unit_type/NKM_UI_COMMON_UNIT_CLASS_ICON_SIEGE.png"),
    타워: deploymentUrl("/unit/unit_type/NKM_UI_COMMON_UNIT_CLASS_ICON_TOWER.png"),
};
function createEmptyFilters(): TrophyFilterState {
    return {
        categories: [],
        roles: [],
        grades: [],
    };
}
function matchesSelectedFilter<T>(selectedValues: T[], value: T) {
    return selectedValues.length === 0 || selectedValues.includes(value);
}
function getFilterButtonClass(isSelected: boolean) {
    return [
        "min-h-11 border px-3 py-2 text-sm font-bold transition",
        "focus:outline-none focus:ring-2 focus:ring-[#9ca3af]",
        isSelected
            ? "border-white bg-white text-[#111318] shadow-[0_0_14px_rgba(255,255,255,0.22)]"
            : "border-[#4b5563] bg-black/35 text-[#9ca3af] hover:border-white hover:text-white",
    ].join(" ");
}
export default function CollectionTrophyList({ trophies, }: {
    trophies: CollectionTrophyItem[];
}) {
    const [searchKeyword, setSearchKeyword] = useState("");
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [selectedFilters, setSelectedFilters] = useState<TrophyFilterState>(createEmptyFilters);
    const [selectedTrophy, setSelectedTrophy] = useState<CollectionTrophyItem | null>(null);
    const normalizedKeyword = searchKeyword.trim().toLocaleLowerCase("ko-KR");
    const availableRoles = useMemo(() => {
        const roles = new Set(trophies.map((trophy) => trophy.role).filter(Boolean));
        return roleOptions.filter((role) => roles.has(role));
    }, [trophies]);
    const activeFilterCount = Object.values(selectedFilters).reduce((total, values) => total + values.length, 0);
    const visibleTrophies = useMemo(() => {
        return trophies.filter((trophy) => {
            const matchesKeyword = !normalizedKeyword ||
                [
                    trophy.name,
                    trophy.description,
                    trophy.grade,
                    trophy.role,
                    trophy.categoryName,
                ]
                    .join(" ")
                    .toLocaleLowerCase("ko-KR")
                    .includes(normalizedKeyword);
            return (matchesKeyword &&
                matchesSelectedFilter(selectedFilters.categories, trophy.category) &&
                matchesSelectedFilter(selectedFilters.roles, trophy.role) &&
                matchesSelectedFilter(selectedFilters.grades, trophy.grade));
        });
    }, [normalizedKeyword, selectedFilters, trophies]);
    useEffect(() => {
        if (!selectedTrophy) {
            return;
        }
        const previousOverflow = document.body.style.overflow;
        function closeOnEscape(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setSelectedTrophy(null);
            }
        }
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", closeOnEscape);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", closeOnEscape);
        };
    }, [selectedTrophy]);
    function toggleFilterValue<Key extends keyof TrophyFilterState>(key: Key, value: TrophyFilterState[Key][number]) {
        setSelectedFilters((currentFilters) => {
            const currentValues = currentFilters[key] as typeof value[];
            const nextValues = currentValues.includes(value)
                ? currentValues.filter((currentValue) => currentValue !== value)
                : [...currentValues, value];
            return {
                ...currentFilters,
                [key]: nextValues,
            };
        });
    }
    return (<>
      <div className="mt-6 flex flex-col gap-3 rounded-lg border border-[#343844] bg-[#171a21] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row">
          <label className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="text-sm font-bold text-white">트로피 검색</span>
            <SearchInput value={searchKeyword} onChange={(event) => setSearchKeyword(event.target.value)} ariaLabel="트로피 검색" inputClassName="rounded-md border border-[#343844] bg-[#0b0d12] py-2 text-sm text-[#e5e7eb] outline-none transition placeholder:text-[#6b7280] focus:border-white focus:ring-2 focus:ring-[#9ca3af]/30"/>
          </label>
          <div className="flex w-full flex-col gap-2 sm:w-40">
            <span className="text-sm font-bold text-white">조건 필터</span>
            <button type="button" onClick={() => setIsFilterOpen(true)} className="rounded-md border border-[#343844] bg-[#0b0d12] px-3 py-2 text-sm font-bold text-[#e5e7eb] transition hover:border-white hover:text-white focus:outline-none focus:ring-2 focus:ring-[#9ca3af]/30">
              필터{activeFilterCount > 0 ? ` ${activeFilterCount}개` : ""}
            </button>
          </div>
        </div>
        <div className="shrink-0 text-sm font-semibold text-white">
          {visibleTrophies.length} / {trophies.length}개
        </div>
      </div>

      {isFilterOpen ? (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="trophy-filter-title">
          <div className="filter-scroll-panel max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-[#4b5563] bg-[linear-gradient(90deg,#151515_0%,#303030_100%)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between gap-4 border-b border-[#4b5563] pb-4">
              <h2 id="trophy-filter-title" className="text-center text-2xl font-black text-[#e5e7eb]">
                필터
              </h2>
              <button type="button" onClick={() => setIsFilterOpen(false)} className="border border-[#4b5563] px-3 py-1 text-sm font-bold text-[#9ca3af] transition hover:border-[#9ca3af] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#6b7280]">
                닫기
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <section>
                <h3 className="mb-3 flex items-center gap-2 text-base font-black text-[#e5e7eb]">
                  <span className="h-4 w-[5px] bg-white shadow-[0_0_10px_rgba(255,255,255,0.75)]"/>
                  트로피 구분
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {categoryOptions.map((option) => {
                const isSelected = selectedFilters.categories.includes(option.value);
                return (<button key={option.value} type="button" aria-pressed={isSelected} onClick={() => toggleFilterValue("categories", option.value)} className={getFilterButtonClass(isSelected)}>
                        {option.label}
                      </button>);
            })}
                </div>
              </section>

              <section>
                <h3 className="mb-3 flex items-center gap-2 text-base font-black text-[#e5e7eb]">
                  <span className="h-4 w-[5px] bg-white shadow-[0_0_10px_rgba(255,255,255,0.75)]"/>
                  클래스
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {availableRoles.map((role) => {
                const isSelected = selectedFilters.roles.includes(role);
                const iconPath = roleTypeIconMap[role];
                return (<button key={role} type="button" aria-pressed={isSelected} onClick={() => toggleFilterValue("roles", role)} className={getFilterButtonClass(isSelected)}>
                        <span className="inline-flex items-center justify-center gap-2">
                          <Image src={iconPath} alt="" width={22} height={22} className="h-[22px] w-[22px] shrink-0 object-contain"/>
                          <span>{role}</span>
                        </span>
                      </button>);
            })}
                </div>
              </section>

              <section>
                <h3 className="mb-3 flex items-center gap-2 text-base font-black text-[#e5e7eb]">
                  <span className="h-4 w-[5px] bg-white shadow-[0_0_10px_rgba(255,255,255,0.75)]"/>
                  희귀도
                </h3>
                <div className="grid grid-cols-4 gap-2">
                  {gradeOptions.map((grade) => {
                const isSelected = selectedFilters.grades.includes(grade);
                return (<button key={grade} type="button" aria-label={`${grade} 희귀도`} aria-pressed={isSelected} onClick={() => toggleFilterValue("grades", grade)} className={getFilterButtonClass(isSelected)}>
                        <span className="flex justify-center">
                          <RarityIcon grade={grade} size="sm"/>
                        </span>
                      </button>);
            })}
                </div>
              </section>
            </div>

            <div className="mt-6 flex flex-col gap-2 border-t border-[#4b5563] pt-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setSelectedFilters(createEmptyFilters())} className="min-h-12 min-w-28 border border-[#5b6270] bg-[#181b22] px-6 py-3 text-base font-black text-[#d1d5db] transition hover:border-[#9ca3af] hover:bg-[#222631] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#6b7280]">
                초기화
              </button>
              <button type="button" onClick={() => setIsFilterOpen(false)} className="min-h-12 min-w-28 border border-[#6b7280] bg-[#2d333d] px-6 py-3 text-base font-black text-white transition hover:border-[#d1d5db] hover:bg-[#3f4754] focus:outline-none focus:ring-2 focus:ring-[#9ca3af]">
                확인
              </button>
            </div>
          </div>
        </div>) : null}

      {visibleTrophies.length > 0 ? (<div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {visibleTrophies.map((trophy) => (<button key={trophy.id} type="button" aria-haspopup="dialog" onClick={() => setSelectedTrophy(trophy)} className="group min-w-0 overflow-hidden rounded-lg border border-[#343844] bg-[#171a21] text-left transition duration-200 hover:-translate-y-1 hover:border-white hover:bg-[#222631] focus:outline-none focus:ring-2 focus:ring-[#9ca3af]">
                <div className="relative isolate flex aspect-[256/354] items-center justify-center overflow-hidden border-b border-[#343844] bg-[#10131a]">
                  <CharacterAwakenCircuit grade={trophy.grade} isAwakened={trophy.isAwakened}/>
                  {trophy.imagePath ? (<Image src={trophy.imagePath} alt={`${trophy.name} 이미지`} fill sizes="(min-width: 1280px) 180px, (min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw" className={`z-10 transition duration-300 group-hover:scale-105 ${trophy.category === "decoration"
                        ? "object-contain"
                        : "object-fill"}`}/>) : (<span className="relative z-10 text-xs font-semibold tracking-[0.18em] text-[#565c6b]">
                      NO IMAGE
                    </span>)}
                </div>
                <div className="h-1.5 w-full" style={{
                    backgroundColor: gradeColorMap[trophy.grade] ?? "var(--grade-n)",
                }}>
                  <span className="sr-only">{trophy.grade} 등급</span>
                </div>
                <div className="flex min-h-24 flex-col justify-between gap-3 px-3 py-3">
                  <h2 className="line-clamp-2 text-base font-bold leading-6 text-white">
                    {trophy.name}
                  </h2>
                  <span className="w-fit border border-[#4b5563] bg-[#111318] px-2 py-1 text-[11px] font-bold text-[#c7cbd1]">
                    {categoryTagMap[trophy.category]}
                  </span>
                </div>
              </button>))}
        </div>) : (<div className="mt-8 rounded-lg border border-[#343844] bg-[#171a21] px-4 py-12 text-center text-sm font-semibold text-[#9ca3af]">
          검색 결과가 없습니다.
        </div>)}

      {selectedTrophy ? (<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-4 py-6" role="presentation" onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    setSelectedTrophy(null);
                }
            }}>
          <section role="dialog" aria-modal="true" aria-labelledby="trophy-detail-title" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto border border-[#4b5563] bg-[#171a21] shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
            <header className="flex items-center justify-between gap-4 border-b border-[#343844] bg-[#111318] px-5 py-4">
              <h2 id="trophy-detail-title" className="min-w-0 text-xl font-black text-white sm:text-2xl">
                {selectedTrophy.name}
              </h2>
              <button type="button" onClick={() => setSelectedTrophy(null)} className="shrink-0 border border-[#4b5563] bg-[#0b0d12] px-3 py-2 text-sm font-bold text-[#c7cbd1] transition hover:border-white hover:text-white focus:outline-none focus:ring-2 focus:ring-[#9ca3af]">
                닫기
              </button>
            </header>

            <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[240px_minmax(0,1fr)] md:items-start">
              <div className="relative isolate mx-auto flex aspect-[256/354] w-full max-w-60 items-center justify-center overflow-hidden border border-[#343844] bg-[#0b0d12]">
                <CharacterAwakenCircuit grade={selectedTrophy.grade} isAwakened={selectedTrophy.isAwakened}/>
                {selectedTrophy.imagePath ? (<Image src={selectedTrophy.imagePath} alt={`${selectedTrophy.name} 이미지`} fill sizes="240px" className={`z-10 ${selectedTrophy.category === "decoration"
                    ? "object-contain"
                    : "object-fill"}`}/>) : (<span className="relative z-10 text-xs font-bold tracking-[0.16em] text-[#565c6b]">
                    NO IMAGE
                  </span>)}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#c7cbd1]">
                  <span className="flex min-h-8 items-center border border-[#4b5563] bg-[#111318] px-2 py-1">
                    <RarityIcon grade={selectedTrophy.grade} size="sm"/>
                  </span>
                  <span className="flex min-h-8 items-center border border-[#4b5563] bg-[#111318] px-2 py-1">
                    {categoryTagMap[selectedTrophy.category]}
                  </span>
                  {selectedTrophy.role ? (<span className="flex min-h-8 items-center gap-2 border border-[#4b5563] bg-[#111318] px-2 py-1">
                      {roleTypeIconMap[selectedTrophy.role] ? (<Image src={roleTypeIconMap[selectedTrophy.role]} alt="" width={22} height={22} className="h-[22px] w-[22px] object-contain"/>) : null}
                      {selectedTrophy.role}
                    </span>) : null}
                  {selectedTrophy.canSetAsRepresentative ? (<span className="flex min-h-8 items-center border border-[#4b5563] bg-[#111318] px-2 py-1">
                      대표 사원 설정 가능
                    </span>) : null}
                </div>
                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[#c7cbd1] sm:text-base">
                  {selectedTrophy.description}
                </p>
              </div>
            </div>
          </section>
        </div>) : null}
    </>);
}
