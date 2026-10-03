"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
type VoiceLanguage = "ko" | "ja";
const VoiceLanguageContext = createContext<VoiceLanguage | null>(null);
export function useVoiceLanguage() {
    return useContext(VoiceLanguageContext);
}
export default function VoiceLanguageControls({ children, className, hasJapaneseVoice, }: {
    children: ReactNode;
    className?: string;
    hasJapaneseVoice: boolean;
}) {
    const [language, setLanguage] = useState<VoiceLanguage>("ko");
    const selectedLanguage = hasJapaneseVoice ? language : "ko";
    return (<VoiceLanguageContext.Provider value={selectedLanguage}>
      <div className={className} data-voice-language={selectedLanguage}>
        <div role="group" aria-label="대사 음성 언어" className="mb-4 flex flex-wrap items-center gap-2">
          {([
            ["ko", "한국어"],
            ["ja", "일본어"],
        ] as const).map(([value, label]) => (<button key={value} type="button" aria-pressed={selectedLanguage === value} disabled={value === "ja" && !hasJapaneseVoice} title={value === "ja" && !hasJapaneseVoice ? "일본어 음성이 없습니다" : undefined} onClick={() => setLanguage(value)} className={`rounded-md border px-4 py-2 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40 ${selectedLanguage === value
                ? "border-[#bf9000] bg-[#bf9000] text-[#0b0d12]"
                : "border-[#4b5160] bg-[#222631] text-[#cfd4dc] enabled:hover:border-[#bf9000] enabled:hover:text-white"}`}>
              {label}
            </button>))}
        </div>
        {children}
      </div>
    </VoiceLanguageContext.Provider>);
}
