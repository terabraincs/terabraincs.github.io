import { deploymentUrl } from "@/lib/deployment";
import fs from "node:fs";
import path from "node:path";
type JsonTable<T> = {
    data?: T[];
};
type UserTitleRow = {
    OrderList?: number;
    UserTitleID?: number;
    TitleNameString?: string;
    TitleColor?: string;
    TitleOutlineColor?: string;
    TitleBG?: string;
    TitleDescString?: string;
    TitleCategoryID?: number;
    EffectPrefab?: string;
    IMGTitle?: boolean;
    ExpiryDate?: string;
    bExclude?: boolean;
};
type UserTitleCategoryRow = {
    TitleCategoryID?: number;
    CategoryString?: string;
};
type MissionRow = {
    m_MissionTitle?: string;
    m_MissionDesc?: string;
    m_MissionCond?: string;
    m_MissionValue?: string;
    m_MissionValue1?: string;
    m_MissionValue2?: string;
    m_RewardType_1?: string;
    m_RewardID_1?: number;
    m_RewardType_2?: string;
    m_RewardID_2?: number;
    m_RewardType_3?: string;
    m_RewardID_3?: number;
};
type TextTable = {
    data?: unknown[];
};
export type CollectionTitleCategory = {
    id: number;
    name: string;
    count: number;
};
export type CollectionTitleItem = {
    id: number;
    order: number;
    name: string;
    description: string;
    categoryId: number;
    categoryName: string;
    imagePath: string;
    isImageTitle: boolean;
    hasEffect: boolean;
    textColor: string;
    outlineColor: string;
    expiryDate: string;
};
export type CollectionTacticalTitleItem = CollectionTitleItem & {
    tacticalLevel: number;
};
export type CollectionTitleData = {
    titles: CollectionTitleItem[];
    categories: CollectionTitleCategory[];
};
const titleDataDirectory = path.join(process.cwd(), "json", "collection", "title");
let cachedTitleData: CollectionTitleData | null = null;
let cachedTacticalTitlesByUnitId: Map<number, CollectionTacticalTitleItem[]> | null = null;
function readJsonTable<T>(fileName: string) {
    const filePath = path.join(titleDataDirectory, fileName);
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
        .replace(/<\/?(?:i|b)>/gi, "")
        .trim();
}
function findText(key: string, textMaps: Map<string, string>[]) {
    for (const textMap of textMaps) {
        const text = textMap.get(key);
        if (text) {
            return text;
        }
    }
    return "";
}
function resolveTextValue(value: string | undefined, textMaps: Map<string, string>[]) {
    if (!value) {
        return "";
    }
    const [templateKey, ...parameters] = value.split("@@");
    const template = findText(templateKey, textMaps);
    if (!template) {
        return "";
    }
    const resolved = template.replace(/\{(\d+)\}/g, (_, index: string) => {
        const parameter = parameters[Number(index)] ?? "";
        const translatedParameter = findText(parameter, textMaps);
        if (translatedParameter) {
            return translatedParameter;
        }
        return parameter.startsWith("SI_") ? "" : parameter;
    });
    return stripUnityRichText(resolved).replace(/ {2,}/g, " ");
}
function createMissionMap(missions: MissionRow[], titleIds: Set<number>) {
    const missionMap = new Map<number, MissionRow>();
    for (const mission of missions) {
        for (let rewardIndex = 1; rewardIndex <= 3; rewardIndex += 1) {
            const rewardType = mission[`m_RewardType_${rewardIndex}` as keyof MissionRow];
            const rewardId = mission[`m_RewardID_${rewardIndex}` as keyof MissionRow];
            if (rewardType === "RT_MISC" &&
                typeof rewardId === "number" &&
                titleIds.has(rewardId) &&
                !missionMap.has(rewardId)) {
                missionMap.set(rewardId, mission);
            }
        }
    }
    return missionMap;
}
function createTacticalTitleMap(missions: MissionRow[], titles: CollectionTitleItem[]) {
    const titleMap = new Map(titles.map((title) => [title.id, title]));
    const tacticalTitleMap = new Map<number, CollectionTacticalTitleItem[]>();
    for (const mission of missions) {
        if (mission.m_MissionCond !== "UNIT_GROWTH_TACTICAL") {
            continue;
        }
        const unitId = Number(mission.m_MissionValue1 ?? mission.m_MissionValue);
        const tacticalLevel = Number(mission.m_MissionValue2);
        if (!Number.isInteger(unitId) || !Number.isInteger(tacticalLevel)) {
            continue;
        }
        for (let rewardIndex = 1; rewardIndex <= 3; rewardIndex += 1) {
            const rewardType = mission[`m_RewardType_${rewardIndex}` as keyof MissionRow];
            const rewardId = mission[`m_RewardID_${rewardIndex}` as keyof MissionRow];
            if (rewardType !== "RT_MISC" || typeof rewardId !== "number") {
                continue;
            }
            const title = titleMap.get(rewardId);
            if (!title) {
                continue;
            }
            const unitTitles = tacticalTitleMap.get(unitId) ?? [];
            if (!unitTitles.some((unitTitle) => unitTitle.id === title.id)) {
                unitTitles.push({ ...title, tacticalLevel });
                tacticalTitleMap.set(unitId, unitTitles);
            }
        }
    }
    for (const unitTitles of tacticalTitleMap.values()) {
        unitTitles.sort((first, second) => first.tacticalLevel - second.tacticalLevel || first.order - second.order);
    }
    return tacticalTitleMap;
}
export function getCollectionTitleData(): CollectionTitleData {
    if (cachedTitleData) {
        return cachedTitleData;
    }
    const titleRows = readJsonTable<UserTitleRow>("160_LUA_USER_TITLE_TEMPLET_g.json")?.data ?? [];
    const categoryRows = readJsonTable<UserTitleCategoryRow>("047_LUA_USER_TITLE_CATEGORY_TEMPLET_w.json")?.data ?? [];
    const missionRows = readJsonTable<MissionRow>("045_LUA_MISSION_TEMPLET_j.json")?.data ?? [];
    const titleTextMap = createTextMap(readJsonTable<unknown>("008_LUA_SI_USER_TITLE_TEMPLET_KOREA_w.json"));
    const missionTextMap = createTextMap(readJsonTable<unknown>("047_LUA_SI_MISSION_TEMPLET_KOREA_z.json"));
    const textMaps = [titleTextMap, missionTextMap];
    const collectionTitleRows = titleRows.filter((row) => {
        return typeof row.UserTitleID === "number";
    });
    const titleIds = new Set(collectionTitleRows.flatMap((row) => typeof row.UserTitleID === "number" ? [row.UserTitleID] : []));
    const missionMap = createMissionMap(missionRows, titleIds);
    const categoryNameMap = new Map(categoryRows.flatMap((row) => {
        if (typeof row.TitleCategoryID !== "number" ||
            typeof row.CategoryString !== "string") {
            return [];
        }
        return [
            [
                row.TitleCategoryID,
                findText(row.CategoryString, textMaps) || row.CategoryString,
            ] as const,
        ];
    }));
    const titles = collectionTitleRows
        .map((row): CollectionTitleItem => {
        const id = row.UserTitleID ?? 0;
        const mission = missionMap.get(id);
        const missionDescription = resolveTextValue(mission?.m_MissionDesc, textMaps);
        const titleDescription = resolveTextValue(row.TitleDescString, textMaps);
        return {
            id,
            order: row.OrderList ?? Number.MAX_SAFE_INTEGER,
            name: findText(row.TitleNameString ?? "", textMaps) || `칭호 ${id}`,
            description: missionDescription || titleDescription || "획득 정보가 없습니다.",
            categoryId: row.TitleCategoryID ?? 0,
            categoryName: categoryNameMap.get(row.TitleCategoryID ?? 0) ?? "기타",
            imagePath: row.TitleBG
                ? deploymentUrl(`/collection/title/${row.TitleBG}.png`) : "",
            isImageTitle: row.IMGTitle === true,
            hasEffect: Boolean(row.EffectPrefab),
            textColor: row.TitleColor || "#ffffff",
            outlineColor: row.TitleOutlineColor || "#151619",
            expiryDate: row.ExpiryDate || "",
        };
    })
        .sort((first, second) => first.order - second.order || first.id - second.id);
    const categories = categoryRows.flatMap((row) => {
        if (typeof row.TitleCategoryID !== "number") {
            return [];
        }
        return [
            {
                id: row.TitleCategoryID,
                name: categoryNameMap.get(row.TitleCategoryID) ?? "기타",
                count: titles.filter((title) => title.categoryId === row.TitleCategoryID).length,
            },
        ];
    });
    cachedTacticalTitlesByUnitId = createTacticalTitleMap(missionRows, titles);
    cachedTitleData = { titles, categories };
    return cachedTitleData;
}
export function getTacticalCollectionTitlesForUnit(unitId: number) {
    getCollectionTitleData();
    return cachedTacticalTitlesByUnitId?.get(unitId) ?? [];
}
