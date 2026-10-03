import Image from "@/components/DeploymentImage";
import Link from "@/components/DeploymentLink";
import type { CSSProperties } from "react";
type HubCardProps = {
    title: string;
    href: string;
    badge: string;
    description: string;
    imagePath: string;
    overlayImagePath?: string;
};
export default function HubCard({ title, href, badge, description, imagePath, overlayImagePath, }: HubCardProps) {
    const backgroundStyle: CSSProperties = {
        backgroundImage: `linear-gradient(135deg, rgba(34, 38, 49, 0.92), rgba(11, 13, 18, 0.68)), url("${imagePath}")`,
    };
    return (<Link href={href} className="group relative block min-h-[220px] overflow-hidden rounded-lg border border-[#343844] bg-[#171a21] transition duration-200 hover:-translate-y-1 hover:border-[#d72638] hover:shadow-[0_18px_50px_rgba(215,38,56,0.18)] focus:outline-none focus:ring-2 focus:ring-[#ff5a66]">
      <div aria-hidden="true" className="absolute inset-0 bg-cover bg-center transition duration-300 group-hover:scale-105" style={backgroundStyle}/>
      {overlayImagePath ? (<Image src={overlayImagePath} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-contain object-left-bottom brightness-50 transition duration-300 group-hover:scale-105"/>) : null}
      {overlayImagePath ? (<div aria-hidden="true" className="absolute inset-0 bg-[#0b0d12]/40"/>) : null}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#0b0d12] via-[#0b0d12]/45 to-transparent"/>

      <div className="relative flex min-h-[220px] flex-col justify-end p-5">
        <span className="mb-3 w-fit border border-[#d72638]/70 bg-[#d72638]/20 px-2.5 py-1 text-xs font-bold tracking-[0.16em] text-[#ff5a66]">
          {badge}
        </span>
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-[#c7cbd1]">{description}</p>
      </div>
    </Link>);
}
