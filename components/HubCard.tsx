import Image from "@/components/DeploymentImage";
import Link from "@/components/DeploymentLink";
import type { CSSProperties } from "react";
type HubCardProps = {
    title: string;
    href: string;
    imagePath: string;
    imagePosition?: string;
    overlayImagePath?: string;
};
export default function HubCard({ title, href, imagePath, imagePosition = "center", overlayImagePath, }: HubCardProps) {
    const backgroundStyle: CSSProperties = {
        backgroundImage: `linear-gradient(135deg, rgba(34, 38, 49, 0.92), rgba(11, 13, 18, 0.68)), url("${imagePath}")`,
        backgroundPosition: imagePosition,
        transformOrigin: imagePosition,
    };
    return (<Link href={href} className="group relative block min-h-[220px] overflow-hidden rounded-lg border border-[#343844] bg-[#171a21] transition duration-200 hover:-translate-y-1 hover:border-white hover:shadow-[0_18px_50px_rgba(255,255,255,0.18)] focus:outline-none focus:ring-2 focus:ring-white">
      <div aria-hidden="true" className="absolute inset-0 bg-cover bg-center transition duration-300 group-hover:scale-105" style={backgroundStyle}/>
      {overlayImagePath ? (<Image src={overlayImagePath} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-contain object-left-bottom brightness-50 transition duration-300 group-hover:scale-105"/>) : null}
      {overlayImagePath ? (<div aria-hidden="true" className="absolute inset-0 bg-[#0b0d12]/40"/>) : null}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#0b0d12] via-[#0b0d12]/45 to-transparent"/>

      <div className="relative flex min-h-[220px] flex-col justify-end p-5">
        <h2 className="text-xl font-bold text-white">{title}</h2>
      </div>
    </Link>);
}
