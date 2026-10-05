export default function SiteFooter() {
    return (<footer className="border-t border-[#343844] bg-[#0b0d12]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-[#9ca3af] sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <p className="max-w-3xl leading-6">
          이 웹페이지는 자료를 소유, 권리를 주장하지 않습니다. 모든 권리는
          Studiobside Co., Ltd에게 있습니다
        </p>

        <a href="https://github.com/terabraincs/terabraincs.github.io" target="_blank" rel="noopener noreferrer" aria-label="메인페이지 GitHub 저장소" className="shrink-0 self-start rounded font-semibold text-white transition hover:text-[#d1d5db] focus:outline-none focus:ring-2 focus:ring-white md:self-auto">
          GitHub
        </a>
      </div>
    </footer>);
}
