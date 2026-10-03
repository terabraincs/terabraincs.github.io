"use client";
import { useMemo, useState } from "react";
import Image from "@/components/DeploymentImage";
import Link from "@/components/DeploymentLink";
import SearchInput from "@/components/SearchInput";
import RarityIcon from "@/components/RarityIcon";
import type { ShipListItem } from "@/lib/ships";
type ShipSearchListProps = {
    ships: ShipListItem[];
};
type FilterKey = "shipTitles" | "grades";
type FilterState = Record<FilterKey, string[]>;
type FilterSection = {
    key: FilterKey;
    title: string;
    options: string[];
    columns?: string;
};
function createEmptyFilters(): FilterState {
    return {
        shipTitles: [],
        grades: [],
    };
}
function getSearchText(ship: ShipListItem) {
    return [
        ship.name,
        ship.title,
        ship.grade,
        ship.shipType,
    ]
        .join(" ")
        .toLowerCase();
}
function matchesSelectedFilter(selectedValues: string[], value?: string) {
    if (selectedValues.length === 0) {
        return true;
    }
    return Boolean(value && selectedValues.includes(value));
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
function getShipTitleIconPath(ships: ShipListItem[], title: string) {
    return ships.find((ship) => ship.title === title)?.shipTypeIconPath ?? "";
}
export default function ShipSearchList({ ships }: ShipSearchListProps) {
    const [searchKeyword, setSearchKeyword] = useState("");
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [selectedFilters, setSelectedFilters] = useState<FilterState>(() => createEmptyFilters());
    const normalizedKeyword = searchKeyword.trim().toLowerCase();
    const filterSections = useMemo<FilterSection[]>(() => {
        const sections: FilterSection[] = [
            {
                key: "shipTitles",
                title: "함선 타입",
                options: ["강습함", "순양함", "중장갑함", "특무함"],
            },
            {
                key: "grades",
                title: "희귀도",
                options: ["SSR", "SR", "R", "N"],
                columns: "grid-cols-4",
            },
        ];
        return sections.map((section) => ({
            ...section,
            options: section.options.filter((option) => ships.some((ship) => section.key === "shipTitles"
                ? ship.title === option
                : ship.grade === option)),
        })).filter((section) => section.options.length > 0);
    }, [ships]);
    const activeFilterCount = Object.values(selectedFilters).reduce((total, values) => total + values.length, 0);
    const filteredShips = useMemo(() => {
        return ships.filter((ship) => {
            const matchesKeyword = !normalizedKeyword || getSearchText(ship).includes(normalizedKeyword);
            const matchesShipTitle = matchesSelectedFilter(selectedFilters.shipTitles, ship.title);
            const matchesGrade = matchesSelectedFilter(selectedFilters.grades, ship.grade);
            return matchesKeyword && matchesShipTitle && matchesGrade;
        });
    }, [normalizedKeyword, selectedFilters, ships]);
    function toggleFilterValue(key: FilterKey, value: string) {
        setSelectedFilters((currentFilters) => {
            const currentValues = currentFilters[key];
            const nextValues = currentValues.includes(value)
                ? currentValues.filter((currentValue) => currentValue !== value)
                : [...currentValues, value];
            return {
                ...currentFilters,
                [key]: nextValues,
            };
        });
    }
    function resetFilters() {
        setSelectedFilters(createEmptyFilters());
    }
    return (<div className="mt-8">
      <div className="flex flex-col gap-3 rounded-md border border-[#343844] bg-[#171a21] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row">
          <label className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="text-sm font-bold text-white">함선 검색</span>
            <SearchInput value={searchKeyword} onChange={(event) => setSearchKeyword(event.target.value)} ariaLabel="함선 검색" inputClassName="h-11 rounded border border-[#343844] bg-[#0b0d12] text-sm font-medium text-[#e5e7eb] outline-none transition placeholder:text-[#5b6270] focus:border-white focus:ring-2 focus:ring-[#9ca3af]/30"/>
          </label>
          <div className="flex w-full flex-col gap-2 sm:w-40">
            <span className="text-sm font-bold text-white">조건 필터</span>
            <button type="button" onClick={() => setIsFilterOpen(true)} className="h-11 rounded border border-[#343844] bg-[#0b0d12] px-3 text-sm font-bold text-[#e5e7eb] transition hover:border-white hover:text-white focus:outline-none focus:ring-2 focus:ring-[#9ca3af]/30">
              필터{activeFilterCount > 0 ? ` ${activeFilterCount}개` : ""}
            </button>
          </div>
        </div>

        <div className="text-sm font-semibold text-white">
          {filteredShips.length} / {ships.length}
        </div>
      </div>

      {isFilterOpen ? (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="ship-filter-title">
          <div className="filter-scroll-panel max-h-[90vh] w-full max-w-lg overflow-y-auto border border-[#4b5563] bg-[linear-gradient(90deg,#151515_0%,#303030_100%)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between gap-4 border-b border-[#4b5563] pb-4">
              <h2 id="ship-filter-title" className="text-center text-2xl font-black text-[#e5e7eb]">
                필터
              </h2>
              <button type="button" onClick={() => setIsFilterOpen(false)} className="border border-[#4b5563] px-3 py-1 text-sm font-bold text-[#9ca3af] transition hover:border-[#9ca3af] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#6b7280]">
                닫기
              </button>
            </div>

            <div className="mt-5 space-y-5">
              {filterSections.map((section) => (<section key={section.key}>
                  <h3 className="mb-3 flex items-center gap-2 text-base font-black text-[#e5e7eb]">
                    <span className="h-4 w-[5px] bg-white shadow-[0_0_10px_rgba(255,255,255,0.75)]"/>
                    {section.title}
                  </h3>
                  <div className={`grid grid-cols-2 gap-2 ${section.columns ?? ""}`}>
                    {section.options.map((option) => {
                    const isSelected = selectedFilters[section.key].includes(option);
                    const iconPath = section.key === "shipTitles"
                        ? getShipTitleIconPath(ships, option)
                        : "";
                    return (<button key={`${section.key}-${option}`} type="button" aria-label={section.key === "grades"
                            ? `${option} 희귀도`
                            : undefined} aria-pressed={isSelected} onClick={() => toggleFilterValue(section.key, option)} className={getFilterButtonClass(isSelected)}>
                          <span className="inline-flex items-center justify-center gap-2">
                            {iconPath ? (<Image src={iconPath} alt="" width={18} height={18} className="h-[18px] w-[18px] object-contain"/>) : null}
                            {section.key === "grades" ? (<RarityIcon grade={option} size="sm"/>) : (<span>{option}</span>)}
                          </span>
                        </button>);
                })}
                  </div>
                </section>))}
            </div>

            <div className="mt-6 flex flex-col gap-2 border-t border-[#4b5563] pt-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={resetFilters} className="min-h-12 min-w-28 border border-[#5b6270] bg-[#181b22] px-6 py-3 text-base font-black text-[#d1d5db] transition hover:border-[#9ca3af] hover:bg-[#222631] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#6b7280]">
                초기화
              </button>
              <button type="button" onClick={() => setIsFilterOpen(false)} className="min-h-12 min-w-28 border border-[#6b7280] bg-[#2d333d] px-6 py-3 text-base font-black text-white transition hover:border-[#d1d5db] hover:bg-[#3f4754] focus:outline-none focus:ring-2 focus:ring-[#9ca3af]">
                확인
              </button>
            </div>
          </div>
        </div>) : null}

      <style>{`
        .filter-scroll-panel {
          scrollbar-color: #6b7280 #151515;
          scrollbar-width: thin;
        }

        .filter-scroll-panel::-webkit-scrollbar {
          width: 12px;
        }

        .filter-scroll-panel::-webkit-scrollbar-button {
          display: none;
          height: 0;
          width: 0;
        }

        .filter-scroll-panel::-webkit-scrollbar-track {
          background: #151515;
          border-left: 1px solid #343844;
        }

        .filter-scroll-panel::-webkit-scrollbar-thumb {
          background: #4b5563;
          border: 3px solid #151515;
        }

        .filter-scroll-panel::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
      `}</style>

      {filteredShips.length > 0 ? (<div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredShips.map((ship) => (<Link key={ship.id} href={ship.href} className="group overflow-hidden rounded-md border border-[#343844] bg-[#171a21] transition hover:-translate-y-1 hover:border-white hover:shadow-[0_18px_45px_rgba(0,0,0,0.35)]">
              <div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden bg-[#0f1117]">
                {ship.imagePath ? (<Image src={ship.imagePath} alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-contain p-4 transition duration-200 group-hover:scale-105"/>) : (<div className="text-xs font-bold tracking-[0.25em] text-[#565c6b]">
                    NO IMAGE
                  </div>)}

                <div className="absolute bottom-0 left-0 h-[5px] w-full" style={{ backgroundColor: ship.gradeColor }}/>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <RarityIcon grade={ship.grade} size="sm"/>
                </div>

                <h2 className="mt-3 truncate text-xl font-black text-white">
                  {ship.name}
                </h2>
                <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-white">
                  {ship.shipTypeIconPath ? (<Image src={ship.shipTypeIconPath} alt="" width={18} height={18} className="h-[18px] w-[18px] object-contain"/>) : null}
                  <span>{ship.title}</span>
                </p>
              </div>
            </Link>))}
        </div>) : (<div className="mt-6 rounded-md border border-[#343844] bg-[#171a21] px-4 py-10 text-center text-sm font-semibold text-[#9ca3af]">
          검색 결과가 없습니다.
        </div>)}
    </div>);
}
