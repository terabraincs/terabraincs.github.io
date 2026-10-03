import { deploymentUrl } from "@/lib/deployment";
import fs from "node:fs";
import path from "node:path";
import { getCollectionAcquisitionMap, type CollectionAcquisitionEntry, } from "@/lib/collectionAcquisition";
type JsonTable<T> = {
    data?: T[];
};
type EmblemItemRow = {
    m_ItemMiscID?: number;
    m_ItemMiscStrID?: string;
    m_ItemMiscName?: string;
    m_ItemMiscDesc?: string;
    m_ItemMiscType?: string;
    m_ItemMiscIconName?: string;
};
type EmblemCollectionRow = {
    MiscType?: string;
    CollectionItemID?: number;
    SortIndex?: number;
};
type TextTable = {
    data?: unknown[];
};
export type CollectionEmblemItem = {
    id: number;
    order: number;
    name: string;
    description: string;
    type: "normal" | "rank";
    typeName: string;
    imagePath: string;
    isCollectionRegistered: boolean;
    acquisition: CollectionAcquisitionEntry[];
};
export type CollectionEmblemData = {
    emblems: CollectionEmblemItem[];
};
const emblemDataDirectory = path.join(process.cwd(), "json", "collection");
let cachedEmblemData: CollectionEmblemData | null = null;
function readJsonTable<T>(fileName: string) {
    const filePath = path.join(emblemDataDirectory, fileName);
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
export function getCollectionEmblemData(): CollectionEmblemData {
    if (cachedEmblemData) {
        return cachedEmblemData;
    }
    const itemRows = readJsonTable<EmblemItemRow>("012_LUA_ITEM_MISC_TEMPLET_h.json")?.data ?? [];
    const collectionRows = readJsonTable<EmblemCollectionRow>("162_LUA_COLLECTION_V6_MISC_g.json")
        ?.data ?? [];
    const textMap = createTextMap(readJsonTable<unknown>("053_LUA_SI_ITEM_TEMPLET_KOREA_a.json"));
    const collectionOrderMap = new Map(collectionRows.flatMap((row) => {
        if (row.MiscType !== "EMBLEM" ||
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
    const emblems = itemRows
        .filter((row) => {
        return (typeof row.m_ItemMiscID === "number" &&
            !row.m_ItemMiscStrID?.startsWith("IMI_ITEM_EMBLEM_RANK_DUMMY_") &&
            (row.m_ItemMiscType === "IMT_EMBLEM" ||
                row.m_ItemMiscType === "IMT_EMBLEM_RANK"));
    })
        .map((row): CollectionEmblemItem => {
        const id = row.m_ItemMiscID ?? 0;
        const type = row.m_ItemMiscType === "IMT_EMBLEM_RANK" ? "rank" : "normal";
        const iconName = row.m_ItemMiscIconName ?? "";
        return {
            id,
            order: collectionOrderMap.get(id) ?? Number.MAX_SAFE_INTEGER,
            name: resolveTextValue(row.m_ItemMiscName, textMap) || `엠블럼 ${id}`,
            description: resolveTextValue(row.m_ItemMiscDesc, textMap) ||
                "엠블럼 설명이 없습니다.",
            type,
            typeName: type === "rank" ? "랭크 엠블럼" : "일반 엠블럼",
            imagePath: iconName
                ? deploymentUrl(`/collection/emblem/AB_INVEN_${iconName}.png`) : "",
            isCollectionRegistered: collectionOrderMap.has(id),
            acquisition: acquisitionMap.get(id) ?? [],
        };
    })
        .sort((first, second) => Number(second.isCollectionRegistered) -
        Number(first.isCollectionRegistered) ||
        first.order - second.order ||
        first.id - second.id);
    cachedEmblemData = { emblems };
    return cachedEmblemData;
}
