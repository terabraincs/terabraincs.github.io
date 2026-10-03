import { deploymentUrl } from "@/lib/deployment";
import Image from "@/components/DeploymentImage";
import type { ChangeEventHandler } from "react";
type SearchInputProps = {
    value: string;
    onChange: ChangeEventHandler<HTMLInputElement>;
    ariaLabel: string;
    containerClassName?: string;
    inputClassName?: string;
};
export default function SearchInput({ value, onChange, ariaLabel, containerClassName = "", inputClassName = "", }: SearchInputProps) {
    return (<div className={`relative min-w-0 ${containerClassName}`}>
      <Image src={deploymentUrl("/ui/NKM_UI_COMMON_ICON_SEARCH.png")} alt="" width={22} height={22} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 object-contain"/>
      <input type="search" value={value} onChange={onChange} aria-label={ariaLabel} placeholder="검색" className={`w-full pl-11 pr-3 ${inputClassName}`}/>
    </div>);
}
