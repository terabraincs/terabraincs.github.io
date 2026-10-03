import { deploymentUrl } from "@/lib/deployment";
import Image from "@/components/DeploymentImage";
const rarityIconMap = {
    N: {
        src: deploymentUrl("/ui/rank/BANNER_COMMON_PREFAB_RANK_N.png"),
        width: 52,
    },
    R: {
        src: deploymentUrl("/ui/rank/BANNER_COMMON_PREFAB_RANK_R.png"),
        width: 52,
    },
    SR: {
        src: deploymentUrl("/ui/rank/BANNER_COMMON_PREFAB_RANK_SR.png"),
        width: 96,
    },
    SSR: {
        src: deploymentUrl("/ui/rank/BANNER_COMMON_PREFAB_RANK_SSR.png"),
        width: 134,
    },
} as const;
const sizeClassMap = {
    xs: "h-4",
    sm: "h-5",
    md: "h-6",
    lg: "h-8",
    xl: "h-10",
} as const;
type RarityIconProps = {
    grade: string;
    size?: keyof typeof sizeClassMap;
    className?: string;
};
export default function RarityIcon({ grade, size = "md", className = "", }: RarityIconProps) {
    const icon = rarityIconMap[grade as keyof typeof rarityIconMap];
    if (!icon) {
        return (<span className={`font-black text-white ${className}`.trim()}>
        {grade}
      </span>);
    }
    return (<Image src={icon.src} alt={`${grade} 등급`} width={icon.width} height={64} className={`w-auto shrink-0 object-contain ${sizeClassMap[size]} ${className}`.trim()}/>);
}
