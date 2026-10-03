import type { CollectionAcquisitionEntry } from "@/lib/collectionAcquisition";
const statusNames = {
    past: "과거",
    inactive: "비활성",
} as const;
export default function CollectionAcquisitionList({ entries, collapsible = true, }: {
    entries: CollectionAcquisitionEntry[];
    collapsible?: boolean;
}) {
    const acquisitionEntries = entries.length > 0 ? (<ul className="space-y-2 pb-2">
        {entries.map((entry, index) => (<li key={`${entry.source}-${entry.detail}-${entry.status ?? ""}-${index}`} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 text-xs leading-5">
            <span className="border border-[#4b5563] bg-[#111318] px-1.5 py-0.5 font-bold text-white">
              {entry.source}
            </span>
            <span className="min-w-0 text-[#b7bdc7]">
              {entry.detail}
              {entry.status ? (<span className="ml-1.5 whitespace-nowrap text-[#7f8794]">
                  ({statusNames[entry.status]})
                </span>) : null}
            </span>
          </li>))}
      </ul>) : (<p className="pb-2 text-xs leading-5 text-[#7f8794]">
        확인 가능한 직접 지급 조건이 없습니다.
      </p>);
    if (!collapsible) {
        return (<section className="mt-4 border-t border-[#343844]">
        <div className="flex min-h-10 items-center gap-2 py-2.5 text-xs font-black text-[#c7cbd1]">
          <span>획득 조건</span>
          <span className="ml-auto font-bold text-[#7f8794]">
            {entries.length > 0 ? `${entries.length}개` : "없음"}
          </span>
        </div>
        {acquisitionEntries}
      </section>);
    }
    return (<details className="group mt-4 border-t border-[#343844]">
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 py-2.5 text-xs font-black text-[#c7cbd1] [&::-webkit-details-marker]:hidden">
        <span>획득 조건</span>
        <span className="ml-auto font-bold text-[#7f8794]">
          {entries.length > 0 ? `${entries.length}개` : "없음"}
        </span>
        <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center border border-[#4b5563] text-sm leading-none text-white group-open:hidden">
          +
        </span>
        <span aria-hidden="true" className="hidden h-5 w-5 items-center justify-center border border-white text-sm leading-none text-white group-open:flex">
          -
        </span>
      </summary>

      {acquisitionEntries}
    </details>);
}
