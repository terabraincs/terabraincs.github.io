import { publicFileExists } from "@/lib/publicAssets";
import { deploymentUrl } from "@/lib/deployment";
import fs from "node:fs";
import path from "node:path";
type JsonTable<T> = {
    data?: T[];
};
type TextTable = {
    data?: unknown[];
};
type TrophyUnitRow = {
    m_UnitID?: number;
    m_UnitStrID?: string;
    m_NKM_UNIT_STYLE_TYPE?: string;
    m_NKM_UNIT_ROLE_TYPE?: string;
    m_Name?: string;
    m_FaceCardName?: string;
    m_SkillStrID1?: string;
    m_NKM_UNIT_GRADE?: string;
    m_UnitDesc?: string;
    m_bProfileMainUnit?: boolean;
    m_bAwaken?: boolean;
};
export type CollectionTrophyCategory = "sd" | "decoration" | "skill";
export type CollectionTrophyItem = {
    id: number;
    order: number;
    name: string;
    description: string;
    grade: string;
    role: string;
    category: CollectionTrophyCategory;
    categoryName: string;
    imagePath: string;
    canSetAsRepresentative: boolean;
    isAwakened: boolean;
};
export type CollectionTrophyData = {
    trophies: CollectionTrophyItem[];
};
const trophyDataDirectory = path.join(process.cwd(), "json", "collection", "trophy");
const trophyImageDirectory = path.join(process.cwd(), "public", "collection", "trophy", "face_cards");
const sharedPlaceholderFaceCardName = "AB_UNIT_FACE_CARD_NKM_BASE";
const gradeMap: Record<string, string> = {
    NUG_N: "N",
    NUG_R: "R",
    NUG_SR: "SR",
    NUG_SSR: "SSR",
};
const roleMap: Record<string, string> = {
    NURT_STRIKER: "스트라이커",
    NURT_RANGER: "레인저",
    NURT_DEFENDER: "디펜더",
    NURT_SNIPER: "스나이퍼",
    NURT_SUPPORTER: "서포터",
    NURT_TOWER: "타워",
    NURT_SIEGE: "시즈",
};
let cachedTrophyData: CollectionTrophyData | null = null;
function readJson<T>(filePath: string) {
    if (!publicFileExists(filePath)) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
    }
    catch {
        return null;
    }
}
function createTextMap(filePaths: string[]) {
    const textMap = new Map<string, string>();
    for (const filePath of filePaths) {
        const table = readJson<TextTable>(filePath);
        for (const row of table?.data ?? []) {
            if (Array.isArray(row) &&
                typeof row[0] === "string" &&
                typeof row[1] === "string") {
                textMap.set(row[0], row[1]);
            }
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
function resolveText(value: string | undefined, textMap: Map<string, string>) {
    if (!value) {
        return "";
    }
    const [templateKey, ...parameters] = value.split("@@");
    const template = textMap.get(templateKey);
    if (!template) {
        return "";
    }
    return stripUnityRichText(template.replace(/\{(\d+)\}/g, (_, index: string) => {
        const parameter = parameters[Number(index)] ?? "";
        return textMap.get(parameter) ?? parameter;
    }));
}
function isTrophyUnit(row: TrophyUnitRow) {
    const unitStrId = row.m_UnitStrID ?? "";
    return (row.m_NKM_UNIT_STYLE_TYPE === "NUST_TRAINER" &&
        row.m_SkillStrID1 === "NKM_UNIT_SD_SKILL" &&
        (unitStrId.startsWith("NKM_UNIT_SD_") ||
            unitStrId.endsWith("SKILL_TROPHY")));
}
function getTrophyCategory(unitStrId: string) {
    if (unitStrId.endsWith("SKILL_TROPHY")) {
        return {
            category: "skill" as const,
            categoryName: "스킬 트로피",
        };
    }
    if (unitStrId.startsWith("NKM_UNIT_SD_DECO_")) {
        return {
            category: "decoration" as const,
            categoryName: "장식 트로피",
        };
    }
    return {
        category: "sd" as const,
        categoryName: "SD 트로피",
    };
}
function getTrophyImagePath(faceCardName: string | undefined) {
    if (!faceCardName) {
        return "";
    }
    const fileName = `${path.basename(faceCardName)}.png`;
    if (!publicFileExists(path.join(trophyImageDirectory, fileName))) {
        return "";
    }
    return deploymentUrl(`/collection/trophy/face_cards/${fileName}`);
}
export function getCollectionTrophyData(): CollectionTrophyData {
    if (cachedTrophyData) {
        return cachedTrophyData;
    }
    const rootJsonDirectory = path.join(process.cwd(), "json");
    const oldRows = readJson<JsonTable<TrophyUnitRow>>(path.join(rootJsonDirectory, "004_LUA_UNIT_TEMPLET_BASE_h.json"))?.data ?? [];
    const newRows = readJson<JsonTable<TrophyUnitRow>>(path.join(trophyDataDirectory, "013_LUA_UNIT_TEMPLET_BASE_SD_e.json"))?.data ?? [];
    const textMap = createTextMap([
        path.join(rootJsonDirectory, "KR", "002_LUA_SI_UNIT_KOREA_l.json"),
        path.join(trophyDataDirectory, "010_LUA_SI_UNIT_SD_KOREA_i.json"),
    ]);
    const trophyRows = [...oldRows, ...newRows].filter((row) => {
        return (isTrophyUnit(row) && row.m_FaceCardName !== sharedPlaceholderFaceCardName);
    });
    const trophies = trophyRows.map((row, order): CollectionTrophyItem => {
        const id = row.m_UnitID ?? 0;
        const unitStrId = row.m_UnitStrID ?? "";
        const description = resolveText(row.m_UnitDesc, textMap) || "트로피 설명이 없습니다.";
        const { category, categoryName } = getTrophyCategory(unitStrId);
        return {
            id,
            order,
            name: resolveText(row.m_Name, textMap) || `트로피 ${id}`,
            description,
            grade: gradeMap[row.m_NKM_UNIT_GRADE ?? ""] ?? "",
            role: roleMap[row.m_NKM_UNIT_ROLE_TYPE ?? ""] ?? "",
            category,
            categoryName,
            imagePath: getTrophyImagePath(row.m_FaceCardName),
            canSetAsRepresentative: row.m_bProfileMainUnit === true || description.includes("대표 사원"),
            isAwakened: row.m_bAwaken === true,
        };
    });
    cachedTrophyData = { trophies };
    return cachedTrophyData;
}
