type CollectionSortMode = "order" | "name";
type CollectionSortButtonsProps = {
    label: string;
    value: CollectionSortMode;
    onChange: (value: CollectionSortMode) => void;
};
const sortOptions: {
    value: CollectionSortMode;
    label: string;
}[] = [
    { value: "order", label: "기본" },
    { value: "name", label: "이름" },
];
export default function CollectionSortButtons({ label, value, onChange, }: CollectionSortButtonsProps) {
    return (<div className="flex shrink-0 items-center gap-2" aria-label={`${label} 정렬`}>
      <span className="text-sm font-bold text-[#9ca3af]">정렬</span>
      <div className="grid h-11 grid-cols-2 border border-[#4b5563] bg-[#0b0d12] p-1">
        {sortOptions.map((option) => {
            const isSelected = value === option.value;
            return (<button key={option.value} type="button" onClick={() => onChange(option.value)} aria-pressed={isSelected} className={`h-full min-w-16 px-3 text-sm font-bold transition ${isSelected
                    ? "bg-white text-[#111318]"
                    : "text-[#9ca3af] hover:bg-white/10 hover:text-white"}`}>
              {option.label}
            </button>);
        })}
      </div>
    </div>);
}
