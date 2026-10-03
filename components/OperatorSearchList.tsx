"use client";
import { useMemo, useState } from "react";
import Image from "@/components/DeploymentImage";
import Link from "@/components/DeploymentLink";
import SearchInput from "@/components/SearchInput";
import RarityIcon from "@/components/RarityIcon";
import type { OperatorListItem } from "@/lib/operators";
type OperatorSearchListProps = {
    operators: OperatorListItem[];
};
function getSearchText(operator: OperatorListItem) {
    return [
        operator.name,
        operator.title,
        operator.grade,
        operator.skillName,
        operator.id,
    ]
        .join(" ")
        .toLowerCase();
}
export default function OperatorSearchList({ operators, }: OperatorSearchListProps) {
    const [searchKeyword, setSearchKeyword] = useState("");
    const [selectedGrade, setSelectedGrade] = useState("");
    const normalizedKeyword = searchKeyword.trim().toLowerCase();
    const gradeOptions = useMemo(() => {
        return ["SSR", "SR", "R", "N"].filter((grade) => operators.some((operator) => operator.grade === grade));
    }, [operators]);
    const filteredOperators = useMemo(() => {
        return operators.filter((operator) => {
            const matchesKeyword = !normalizedKeyword || getSearchText(operator).includes(normalizedKeyword);
            const matchesGrade = !selectedGrade || operator.grade === selectedGrade;
            return matchesKeyword && matchesGrade;
        });
    }, [normalizedKeyword, operators, selectedGrade]);
    return (<div className="mt-8">
      <div className="rounded-md border border-[#343844] bg-[#171a21] p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_260px_auto] md:items-end">
          <label className="flex min-w-0 flex-col gap-2">
            <span className="text-sm font-bold text-white">오퍼레이터 검색</span>
            <SearchInput value={searchKeyword} onChange={(event) => setSearchKeyword(event.target.value)} ariaLabel="오퍼레이터 검색" inputClassName="h-11 rounded border border-[#343844] bg-[#0b0d12] text-sm font-medium text-[#e5e7eb] outline-none transition placeholder:text-[#5b6270] focus:border-white focus:ring-2 focus:ring-[#9ca3af]/30"/>
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-bold text-white">희귀도</span>
            <div className="grid grid-cols-4 gap-2">
              {gradeOptions.map((grade) => (<button key={grade} type="button" aria-label={`${grade} 희귀도`} aria-pressed={selectedGrade === grade} onClick={() => setSelectedGrade((currentGrade) => currentGrade === grade ? "" : grade)} className={`h-11 border text-sm font-black transition ${selectedGrade === grade
                ? "border-white bg-white text-[#111318]"
                : "border-[#343844] bg-[#0b0d12] text-[#9ca3af] hover:border-white hover:text-white"}`}>
                  <span className="flex justify-center">
                    <RarityIcon grade={grade} size="sm"/>
                  </span>
                </button>))}
            </div>
          </div>

          <div className="text-sm font-semibold text-white">
            {filteredOperators.length} / {operators.length}
          </div>
        </div>
      </div>

      {filteredOperators.length > 0 ? (<div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filteredOperators.map((operator) => (<Link key={operator.id} href={operator.href} className="group overflow-hidden rounded-lg border border-[#343844] bg-[#171a21] transition duration-200 hover:-translate-y-1 hover:border-white hover:bg-[#222631] focus:outline-none focus:ring-2 focus:ring-[#9ca3af]">
              <div className="relative flex aspect-[256/354] items-center justify-center overflow-hidden border-b border-[#343844] bg-[#10131a]">
                {operator.imagePath ? (<Image src={operator.imagePath} alt={`${operator.name} 이미지`} fill sizes="(min-width: 1280px) 180px, (min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw" className="object-fill transition duration-300 group-hover:scale-105"/>) : (<span className="text-xs font-semibold tracking-[0.18em] text-[#343844]">
                    NO IMAGE
                  </span>)}
              </div>

              <div className="h-1.5 w-full" style={{ backgroundColor: operator.gradeColor }}>
                <span className="sr-only">{operator.grade} 등급</span>
              </div>

              <div className="flex min-h-24 flex-col justify-between gap-3 px-3 py-3">
                <div>
                  <h2 className="line-clamp-2 text-base font-bold leading-6 text-white group-hover:text-white">
                    {operator.name}
                  </h2>
                </div>

                <div className="flex justify-end">
                  <RarityIcon grade={operator.grade} size="sm"/>
                </div>
              </div>
            </Link>))}
        </div>) : (<div className="mt-6 rounded-md border border-[#343844] bg-[#171a21] px-4 py-10 text-center text-sm font-semibold text-[#9ca3af]">
          검색 결과가 없습니다.
        </div>)}
    </div>);
}
