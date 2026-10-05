import fs from "node:fs";
import path from "node:path";
import { createSoundAssetUrl } from "@/lib/staticAssets";
import { readOggOpusDuration } from "@/lib/oggOpusDuration";

type MusicMetadataRow = {
  OrderIdx?: number;
  IDX?: number;
  BgmID?: string;
  BgmNameStringID?: string;
  BgmAssetID?: string;
  BgmCoverIMGID?: string;
  BgmVolume?: number;
  BgmUnlockStringID?: string;
  UnlockCond?: string;
};

type MusicMetadataTable = {
  data?: MusicMetadataRow[];
};

type TextTable = {
  data?: unknown[];
};

export type MusicTrack = {
  id: string;
  order: number;
  title: string;
  audioPath: string;
  coverPath: string;
  duration: number;
  volume: number;
  unlockText: string;
  isLocked: boolean;
  isRegistered: boolean;
};

const MUSIC_ASSET_PATH = "/music";
const COVER_IDS = new Set([
  "BGM_COVER_NONE",
  "BGM_COVER_OST_1",
  "BGM_COVER_OST_2",
  "BGM_COVER_OST_3",
  "BGM_COVER_OST_4",
]);
let musicTitleMapCache: Map<string, string> | null = null;

function getCounterSideAssetRoot() {
  return (
    process.env.COUNTERSIDE_ASSET_ROOT?.trim() ||
    path.resolve(process.cwd(), "..", "..", "CS_asset")
  );
}

function readFirstJson<T>(filePaths: string[]) {
  for (const filePath of filePaths) {
    if (!fs.existsSync(/* turbopackIgnore: true */ filePath)) {
      continue;
    }

    try {
      return JSON.parse(
        fs.readFileSync(/* turbopackIgnore: true */ filePath, "utf8"),
      ) as T;
    } catch {
      continue;
    }
  }

  return null;
}

function readMusicJson<T>(fileName: string, sourceDirectory: string) {
  return readFirstJson<T>([
    path.join(
      /* turbopackIgnore: true */ process.cwd(),
      "json",
      "sound",
      fileName,
    ),
    path.join(
      /* turbopackIgnore: true */ getCounterSideAssetRoot(),
      "2차 복호화(TextAsset)",
      "JSON",
      sourceDirectory,
      fileName,
    ),
  ]);
}

function createTextMap(table: TextTable | null) {
  const textMap = new Map<string, string>();

  if (!Array.isArray(table?.data)) {
    return textMap;
  }

  for (const row of table.data) {
    if (
      Array.isArray(row) &&
      typeof row[0] === "string" &&
      typeof row[1] === "string"
    ) {
      textMap.set(row[0], row[1]);
    }
  }

  return textMap;
}

function getMusicDirectories() {
  const directories = [
    path.join(/* turbopackIgnore: true */ process.cwd(), "sound", "music"),
    process.env.COUNTERSIDE_BGM_DIR?.trim() || "",
    path.join(
      /* turbopackIgnore: true */ getCounterSideAssetRoot(),
      "music",
      "music",
    ),
  ];

  return [...new Set(directories.filter(Boolean))];
}

function getAvailableMusicFileNames() {
  const fileNames = new Map<string, string>();

  for (const directory of getMusicDirectories()) {
    if (!fs.existsSync(/* turbopackIgnore: true */ directory)) {
      continue;
    }

    try {
      for (const entry of fs.readdirSync(
        /* turbopackIgnore: true */ directory,
        { withFileTypes: true },
      )) {
        // STV-AUD-004: playback and duration metadata both use the web Opus
        // derivative, so the deployed jukebox does not require source WAVs.
        if (!entry.isFile() || !/^[A-Za-z0-9_]+\.ogg$/i.test(entry.name)) {
          continue;
        }

        const normalizedName = entry.name.toLocaleLowerCase("en-US");

        if (!fileNames.has(normalizedName)) {
          fileNames.set(normalizedName, entry.name);
        }
      }
    } catch {
      continue;
    }
  }

  return [...fileNames.values()];
}

export function getMusicFilePath(fileName: string) {
  if (
    path.basename(fileName) !== fileName ||
    !/^[A-Za-z0-9_]+\.ogg$/i.test(fileName)
  ) {
    return null;
  }

  for (const directory of getMusicDirectories()) {
    const filePath = path.join(/* turbopackIgnore: true */ directory, fileName);

    if (
      fs.existsSync(/* turbopackIgnore: true */ filePath) &&
      fs.statSync(/* turbopackIgnore: true */ filePath).isFile()
    ) {
      return filePath;
    }
  }

  return null;
}

function createMusicAudioPath(fileName: string) {
  if (!getMusicFilePath(fileName)) {
    return "";
  }

  const legacyBaseUrl = process.env.NEXT_PUBLIC_BGM_BASE_URL
    ?.trim()
    .replace(/\/+$/, "");

  return legacyBaseUrl
    ? `${legacyBaseUrl}/${encodeURIComponent(fileName)}`
    : createSoundAssetUrl("music", fileName);
}

export function getMusicAssetAudioPath(assetId: string) {
  const normalizedAssetId = assetId.trim();

  if (!/^[A-Za-z0-9_]+$/i.test(normalizedAssetId)) {
    return "";
  }

  const candidates = [
    `${normalizedAssetId}.ogg`,
    `${normalizedAssetId.replace(/^BGM_/i, "")}.ogg`,
  ];

  for (const fileName of [...new Set(candidates)]) {
    const audioPath = createMusicAudioPath(fileName);

    if (audioPath) {
      return audioPath;
    }
  }

  return "";
}

export function getMusicTitle(assetId: string) {
  const normalizedAssetId = assetId.trim().toLocaleLowerCase("en-US");

  if (!normalizedAssetId) {
    return "";
  }

  if (!musicTitleMapCache) {
    const metadata = readMusicJson<MusicMetadataTable>(
      "124_LUA_BGM_INFO_TEMPLETE_h.json",
      "Assetbundles_ab_script",
    )?.data ?? [];
    const textMap = createTextMap(
      readMusicJson<TextTable>(
        "063_LUA_SI_BGM_INFO_TEMPLET_KOREA_y.json",
        "Assetbundles_ab_script_string_table",
      ),
    );

    musicTitleMapCache = new Map<string, string>();

    for (const row of metadata) {
      const title = row.BgmNameStringID
        ? (textMap.get(row.BgmNameStringID) ?? "")
        : "";

      if (!title) {
        continue;
      }

      for (const id of [row.BgmID, row.BgmAssetID]) {
        if (id) {
          musicTitleMapCache.set(id.toLocaleLowerCase("en-US"), title);
        }
      }
    }
  }

  return musicTitleMapCache.get(normalizedAssetId) ?? "";
}

function getCoverPath(coverId?: string) {
  const resolvedCoverId = coverId && COVER_IDS.has(coverId)
    ? coverId
    : "BGM_COVER_NONE";

  return `${MUSIC_ASSET_PATH}/${resolvedCoverId}.png`;
}

export function loadMusicTracks(): MusicTrack[] {
  const metadata = readMusicJson<MusicMetadataTable>(
    "124_LUA_BGM_INFO_TEMPLETE_h.json",
    "Assetbundles_ab_script",
  )?.data;
  const textMap = createTextMap(
    readMusicJson<TextTable>(
      "063_LUA_SI_BGM_INFO_TEMPLET_KOREA_y.json",
      "Assetbundles_ab_script_string_table",
    ),
  );

  if (!metadata) {
    return [];
  }

  const registeredTracks = metadata
    .filter((row) => {
      return Boolean(row.BgmID && row.BgmAssetID && row.BgmNameStringID);
    })
    .sort((first, second) => {
      return (
        (first.OrderIdx ?? first.IDX ?? 0) -
        (second.OrderIdx ?? second.IDX ?? 0)
      );
    })
    .map((row, index) => {
      const assetId = row.BgmAssetID as string;
      const nameKey = row.BgmNameStringID as string;
      const fileName = `${assetId}.ogg`;
      const audioPath = createMusicAudioPath(fileName);
      const filePath = getMusicFilePath(fileName);

      return {
        id: row.BgmID as string,
        order: row.OrderIdx ?? row.IDX ?? index + 1,
        title: textMap.get(nameKey) ?? assetId,
        audioPath,
        coverPath: getCoverPath(row.BgmCoverIMGID),
        duration: readOggOpusDuration(filePath),
        volume: Math.min(Math.max((row.BgmVolume ?? 100) / 100, 0), 1),
        unlockText: row.BgmUnlockStringID
          ? textMap.get(row.BgmUnlockStringID) ?? ""
          : "",
        isLocked: !audioPath,
        isRegistered: true,
      };
    });

  const registeredAssetIds = new Set(
    metadata
      .map((row) => row.BgmAssetID?.toLocaleLowerCase("en-US"))
      .filter((assetId): assetId is string => Boolean(assetId)),
  );
  const unregisteredTracks = getAvailableMusicFileNames()
    .map((fileName) => ({
      fileName,
      assetId: path.basename(fileName, path.extname(fileName)),
    }))
    .filter(({ assetId }) => {
      return !registeredAssetIds.has(assetId.toLocaleLowerCase("en-US"));
    })
    .sort((first, second) => {
      return first.assetId.localeCompare(second.assetId, "en");
    })
    .map(({ fileName, assetId }, index): MusicTrack => {
      const audioPath = createMusicAudioPath(fileName);
      const filePath = getMusicFilePath(fileName);

      return {
        id: `UNREGISTERED_${assetId}`,
        order: registeredTracks.length + index + 1,
        title: assetId,
        audioPath,
        coverPath: getCoverPath("BGM_COVER_NONE"),
        duration: readOggOpusDuration(filePath),
        volume: 1,
        unlockText: "",
        isLocked: !audioPath,
        isRegistered: false,
      };
    });

  return [...registeredTracks, ...unregisteredTracks];
}
