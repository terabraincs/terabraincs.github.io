import catalog from "@/data/main-image-assets.json";

export const MAIN_IMAGE_BASE_URL = catalog.baseUrl;
const imagePaths = new Set(catalog.paths);

function localImagePath(url: string) {
  const relative = url.startsWith(MAIN_IMAGE_BASE_URL + "/")
    ? url.slice(MAIN_IMAGE_BASE_URL.length)
    : url;
  try {
    return decodeURI(relative.split(/[?#]/, 1)[0]);
  } catch {
    return "";
  }
}

export function hasMainImageAsset(url: string) {
  return imagePaths.has(localImagePath(url));
}

export function mainImageAssetUrl(url: string) {
  if (!url.startsWith("/") || !hasMainImageAsset(url)) return url;
  const pathname = localImagePath(url);
  const suffix = url.slice(url.search(/[?#]/) < 0 ? url.length : url.search(/[?#]/));
  return MAIN_IMAGE_BASE_URL + pathname.split("/").map(encodeURIComponent).join("/") + suffix;
}
