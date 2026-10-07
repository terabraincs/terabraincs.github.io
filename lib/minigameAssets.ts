import catalog from "@/data/minigame-assets.json";
const mediaPaths = new Set(catalog.paths);
const fontAliases: Record<string, string> = catalog.fontAliases;
export function minigameAssetUrl(url: string): string {
  if (!url.startsWith("/")) return url;
  const separator = url.search(/[?#]/);
  const pathname = separator < 0 ? url : url.slice(0, separator);
  const suffix = separator < 0 ? "" : url.slice(separator);
  const normalized = pathname.replace(/^\/minigames\/(?=(?:cafe-strega|match-ten|sword-training)\/)/, "/game-assets/");
  if (fontAliases[normalized]) return fontAliases[normalized] + suffix;
  if (!mediaPaths.has(normalized)) return url;
  return catalog.baseUrl + normalized.split("/").map(encodeURIComponent).join("/") + suffix;
}
