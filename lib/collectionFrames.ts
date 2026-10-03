import { deploymentUrl } from "@/lib/deployment";
import fs from "node:fs";
import path from "node:path";
import { getCollectionAcquisitionMap, type CollectionAcquisitionEntry, } from "@/lib/collectionAcquisition";
type JsonTable<T> = {
    data?: T[];
};
type FrameItemRow = {
    m_ItemMiscID?: number;
    m_ItemMiscName?: string;
    m_ItemMiscDesc?: string;
    m_ItemMiscType?: string;
    m_ItemMiscIconName?: string;
};
type FrameCollectionRow = {
    MiscType?: string;
    CollectionItemID?: number;
    SortIndex?: number;
};
type TextTable = {
    data?: unknown[];
};
export type CollectionFrameItem = {
    id: number;
    order: number;
    name: string;
    description: string;
    imagePath: string;
    isCollectionRegistered: boolean;
    acquisition: CollectionAcquisitionEntry[];
};
export type CollectionFrameData = {
    frames: CollectionFrameItem[];
};
const collectionDataDirectory = path.join(process.cwd(), "json", "collection");
let cachedFrameData: CollectionFrameData | null = null;
function readJsonTable<T>(fileName: string) {
    const filePath = path.join(collectionDataDirectory, fileName);
    if (!fs.existsSync(filePath)) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8")) as JsonTable<T>;
    }
    catch {
        return null;
    }
}
function createTextMap(table: TextTable | null) {
    const textMap = new Map<string, string>();
    for (const row of table?.data ?? []) {
        if (Array.isArray(row) &&
            typeof row[0] === "string" &&
            typeof row[1] === "string") {
            textMap.set(row[0], row[1]);
        }
    }
    return textMap;
}
function stripUnityRichText(value: string) {
    return value
        .replace(/<color=[^>]+>/gi, "")
        .replace(/<\/color>/gi, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .trim();
}
function resolveTextValue(value: string | undefined, textMap: Map<string, string>) {
    if (!value) {
        return "";
    }
    const [templateKey, ...parameters] = value.split("@@");
    const template = textMap.get(templateKey);
    if (!template) {
        return "";
    }
    const resolved = template.replace(/\{(\d+)\}/g, (_, index: string) => {
        const parameter = parameters[Number(index)] ?? "";
        return textMap.get(parameter) ?? parameter;
    });
    return stripUnityRichText(resolved);
}
export function getCollectionFrameData(): CollectionFrameData {
    if (cachedFrameData) {
        return cachedFrameData;
    }
    const itemRows = readJsonTable<FrameItemRow>("012_LUA_ITEM_MISC_TEMPLET_h.json")?.data ?? [];
    const collectionRows = readJsonTable<FrameCollectionRow>("162_LUA_COLLECTION_V6_MISC_g.json")
        ?.data ?? [];
    const textMap = createTextMap(readJsonTable<unknown>("053_LUA_SI_ITEM_TEMPLET_KOREA_a.json"));
    const collectionOrderMap = new Map(collectionRows.flatMap((row) => {
        if (row.MiscType !== "FRAME" ||
            typeof row.CollectionItemID !== "number") {
            return [];
        }
        return [
            [
                row.CollectionItemID,
                typeof row.SortIndex === "number"
                    ? row.SortIndex
                    : Number.MAX_SAFE_INTEGER,
            ] as const,
        ];
    }));
    const acquisitionMap = getCollectionAcquisitionMap();
    const frames = itemRows
        .filter((row) => {
        return (typeof row.m_ItemMiscID === "number" &&
            row.m_ItemMiscType === "IMT_SELFIE_FRAME");
    })
        .map((row): CollectionFrameItem => {
        const id = row.m_ItemMiscID ?? 0;
        const iconName = row.m_ItemMiscIconName ?? "";
        const resolvedName = resolveTextValue(row.m_ItemMiscName, textMap);
        return {
            id,
            order: collectionOrderMap.get(id) ?? Number.MAX_SAFE_INTEGER,
            name: resolvedName.replace(/^프레임\s*:\s*/, "") || `프레임 ${id}`,
            description: resolveTextValue(row.m_ItemMiscDesc, textMap) ||
                "프레임 설명이 없습니다.",
            imagePath: iconName
                ? deploymentUrl(`/collection/frame/AB_INVEN_${iconName}.png`) : "",
            isCollectionRegistered: collectionOrderMap.has(id),
            acquisition: acquisitionMap.get(id) ?? [],
        };
    })
        .sort((first, second) => Number(second.isCollectionRegistered) -
        Number(first.isCollectionRegistered) ||
        first.order - second.order ||
        first.id - second.id);
    cachedFrameData = { frames };
    return cachedFrameData;
}
