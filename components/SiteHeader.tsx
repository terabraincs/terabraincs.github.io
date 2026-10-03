import { deploymentUrl } from "@/lib/deployment";
import Image from "@/components/DeploymentImage";
import Link from "@/components/DeploymentLink";
const menuItems = [
    { label: "사원", href: deploymentUrl("/characters") },
    { label: "오퍼레이터", href: deploymentUrl("/operators") },
    { label: "함선", href: deploymentUrl("/ships") },
    { label: "장비", href: deploymentUrl("/equipment") },
    { label: "수집", href: deploymentUrl("/collection") },
    { label: "스토리", href: deploymentUrl("/story") },
    { label: "음악", href: deploymentUrl("/music") },
];
export default function SiteHeader() {
    return (<header className="sticky top-0 z-50 border-b border-[#343844] bg-[#0b0d12]/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <Link href="/" aria-label="카운터사이드 웹뷰어 홈으로 이동" className="inline-flex h-12 items-center transition hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-[#9ca3af] focus:ring-offset-2 focus:ring-offset-[#0b0d12]">
          <Image src={deploymentUrl("/counterside_logo.webp")} alt="카운터사이드 웹뷰어" width={801} height={303} priority className="h-12 w-auto object-contain"/>
        </Link>

        <nav aria-label="주요 메뉴" className="flex w-full min-w-0 flex-wrap items-center gap-1 text-sm font-medium text-[#9ca3af] md:w-auto md:justify-end">
          {menuItems.map((item) => (<Link key={item.href} href={item.href} className="shrink-0 whitespace-nowrap rounded px-3 py-2 transition hover:bg-[#171a21] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#9ca3af]">
              {item.label}
            </Link>))}
        </nav>
      </div>
    </header>);
}
