type ListResultCountProps = {
    label: string;
    count: number;
    total: number;
};
export default function ListResultCount({ label, count, total, }: ListResultCountProps) {
    return (<span className="ml-auto flex h-11 shrink-0 items-center justify-end whitespace-nowrap text-sm leading-5 font-bold tabular-nums text-white" aria-label={`${label} 표시 개수`}>
      {count} / {total}
    </span>);
}
