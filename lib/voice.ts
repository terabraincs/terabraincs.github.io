import fs from "node:fs";
import path from "node:path";
import { createSoundAssetUrl } from "@/lib/staticAssets";
export type VoiceCategory = "unit" | "operator";
export type VoiceLanguage = "ko" | "ja";
function isVoiceCategory(value: string): value is VoiceCategory {
    return value === "unit" || value === "operator";
}
export function getVoiceFilePath(category: string, bundleDirectory: string, fileName: string) {
    if (!isVoiceCategory(category) ||
        path.basename(bundleDirectory) !== bundleDirectory ||
        path.basename(fileName) !== fileName ||
        !/^[A-Za-z0-9_]+\.(?:vkor|vjpn)$/i.test(bundleDirectory) ||
        // STV-AUD-004: character/operator playback uses the Opus web derivative.
        // Client WAV files remain preserved outside this URL resolver.
        !/^[A-Za-z0-9_]+\.ogg$/i.test(fileName)) {
        return null;
    }
    const voiceDirectory = category === "unit" ? "unit_voice" : "operator_voice";
    const filePath = path.join(
    /* turbopackIgnore: true */ process.cwd(), "public", "assets", "sound", "voice", voiceDirectory, bundleDirectory, fileName);
    if (!fs.existsSync(/* turbopackIgnore: true */ filePath) ||
        !fs.statSync(/* turbopackIgnore: true */ filePath).isFile()) {
        return null;
    }
    return filePath;
}
export function createVoiceAudioPath(category: VoiceCategory, bundleId: string, soundId: string, language: VoiceLanguage = "ko") {
    if (!bundleId || !soundId) {
        return "";
    }
    const suffix = language === "ja" ? "vjpn" : "vkor";
    const bundleDirectory = `${bundleId.replace(/\.(?:vkor|vjpn)$/i, "").toLowerCase()}.${suffix}`;
    const fileName = `${soundId}.ogg`;
    if (!getVoiceFilePath(category, bundleDirectory, fileName)) {
        return "";
    }
    const voiceDirectory = category === "unit" ? "unit_voice" : "operator_voice";
    return createSoundAssetUrl("voice", voiceDirectory, bundleDirectory, fileName);
}
