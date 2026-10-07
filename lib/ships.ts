import { publicFileExists } from "@/lib/publicAssets";
import { deploymentUrl } from "@/lib/deployment";
import fs from "node:fs";
import path from "node:path";
type JsonTable<T> = {
    data?: T[];
};
type TextTable = {
    data?: unknown[];
    m_dicString?: Record<string, string>;
};
type ShipBuildRow = {
    m_ShipID: number;
    m_ShipName: string;
    m_ShipUpgradeTarget1?: number;
    m_ShipType?: string;
};
type UnitBaseRow = {
    m_UnitID: number;
    m_ShipGroupID?: number;
    m_UnitStrID: string;
    m_NKM_UNIT_TYPE?: string;
    m_NKM_UNIT_STYLE_TYPE?: string;
    m_Title?: string;
    m_Name?: string;
    m_FaceCardName?: string;
    m_NKM_UNIT_GRADE?: string;
    m_StarGradeMax?: number;
    m_SkillStrID1?: string;
    m_SkillStrID2?: string;
    m_SkillStrID3?: string;
    m_SkillStrID4?: string;
    m_SkillStrID5?: string;
};
type UnitStatRow = {
    m_UnitStrID: string;
    m_RespawnCost?: number;
    m_StatData?: {
        m_Stat?: Record<string, number>;
        m_StatPerLevel?: Record<string, number>;
    };
};
type ShipSkillRow = {
    m_ShipSkillStrID: string;
    m_ShipSkillIcon?: string;
    m_SkillName?: string;
    m_SkillDesc?: string;
    m_SkillBuildDesc?: string;
    m_NKM_SKILL_TYPE?: string;
    m_fCooltimeSecond?: number;
};
type ShipLevelRow = {
    m_ShipStarGrade: number;
    m_ShipLimitBreakGrade?: number;
    m_ShipRareGrade: string;
    m_ShipMaxLevel?: number;
};
type ShipLimitBreakRow = {
    ShipID: number;
    ShipLimitBreakGrade: number;
    ShipLimitBreakMaxLevel?: number;
};
export type ShipStage = {
    shipId: number;
    unitStrId: string;
    stage: number;
    maxLevel: string;
};
export type ShipSkill = {
    id: string;
    name: string;
    description: string;
    upgradeDescription: string;
    type: string;
    iconPath: string;
    cooldown: string;
};
export type ShipSkillStage = {
    stage: number;
    skills: ShipSkill[];
};
export type ShipStat = {
    label: string;
    baseValue: number;
    perLevelValue: number;
};
export type ShipLimitBreakLevel = {
    grade: number;
    maxLevel: number;
};
export type ShipListItem = {
    id: string;
    href: string;
    name: string;
    title: string;
    shipTypeIconPath: string;
    grade: string;
    gradeColor: string;
    shipType: string;
    stageCount: number;
    imagePath: string;
};
export type ShipDetail = ShipListItem & {
    sortId: number;
    description: string;
    stages: ShipStage[];
    skillStages: ShipSkillStage[];
    stats: ShipStat[];
    maxLevel: number;
    limitBreakLevels: ShipLimitBreakLevel[];
};
const gradeMap: Record<string, {
    label: string;
    color: string;
}> = {
    NUG_N: {
        label: "N",
        color: "var(--grade-n)",
    },
    NUG_R: {
        label: "R",
        color: "var(--grade-r)",
    },
    NUG_SR: {
        label: "SR",
        color: "var(--grade-sr)",
    },
    NUG_SSR: {
        label: "SSR",
        color: "var(--grade-ssr)",
    },
};
const shipStyleTypeMap: Record<string, string> = {
    NUST_SHIP_ASSAULT: "강습함",
    NUST_SHIP_HEAVY: "중장갑함",
    NUST_SHIP_CRUISER: "순양함",
    NUST_SHIP_SPECIAL: "특무함",
    NUST_SHIP_ETC: "기타",
    NUST_CORRUPTED: "침식체",
};
const shipStyleIconFileMap: Record<string, string> = {
    NUST_SHIP_ASSAULT: "AB_UI_WARFARE_SHIP_INFO_TYPE_04.png",
    NUST_SHIP_HEAVY: "AB_UI_WARFARE_SHIP_INFO_TYPE_01.png",
    NUST_SHIP_CRUISER: "AB_UI_WARFARE_SHIP_INFO_TYPE_03.png",
    NUST_SHIP_SPECIAL: "AB_UI_WARFARE_SHIP_INFO_TYPE_02.png",
    NUST_SHIP_PATROL: "AB_UI_WARFARE_SHIP_INFO_TYPE_05.png",
};
const shipTypeMap: Record<string, string> = {
    SHIP_NORMAL: "정규",
    SHIP_EVENT: "이벤트",
};
const skillTypeMap: Record<string, string> = {
    NST_PASSIVE: "패시브",
    NST_SHIP_ACTIVE: "액티브",
};
const excludedShipIds = new Set(["NKM_SHIP_PATROL_VEHCLE"]);
const statLabels: Record<string, string> = {
    NST_HP: "체력",
    NST_ATK: "공격력",
    NST_DEF: "방어력",
    NST_CRITICAL: "치명",
    NST_HIT: "명중",
    NST_EVADE: "회피",
};
const statOrder = [
    "NST_HP",
    "NST_ATK",
    "NST_DEF",
    "NST_CRITICAL",
    "NST_HIT",
    "NST_EVADE",
];
function readLocalJson<T>(fileName: string) {
    const filePaths = [
        path.join(process.cwd(), "json", "ship", fileName),
        path.join(process.cwd(), "json", "KR", "ship", fileName),
        path.join(process.cwd(), "json", fileName),
        path.join(process.cwd(), "json", "KR", fileName),
    ];
    const filePath = filePaths.find((candidatePath) => publicFileExists(candidatePath));
    if (!filePath) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
    }
    catch {
        return null;
    }
}
function createTextMap(table: TextTable | null) {
    const textMap = new Map<string, string>();
    if (!table) {
        return textMap;
    }
    if (Array.isArray(table.data)) {
        for (const row of table.data) {
            if (Array.isArray(row) &&
                typeof row[0] === "string" &&
                typeof row[1] === "string") {
                textMap.set(row[0], row[1]);
            }
        }
    }
    if (table.m_dicString) {
        for (const [key, value] of Object.entries(table.m_dicString)) {
            textMap.set(key, value);
        }
    }
    return textMap;
}
function getText(textMap: Map<string, string>, key?: string) {
    if (!key || key === "SI_BLANK") {
        return "";
    }
    return textMap.get(key) ?? "";
}
function getGradeInfo(gradeKey?: string) {
    return gradeMap[gradeKey ?? ""] ?? gradeMap.NUG_N;
}
function getShipStage(shipName: string) {
    const match = shipName.match(/_(\d+)$/);
    return match ? Number(match[1]) : 0;
}
function getBaseShipId(shipName: string) {
    return shipName.replace(/_\d+$/, "");
}
function formatFallbackName(baseShipId: string) {
    return baseShipId
        .replace(/^NKM_SHIP_/, "")
        .replace(/_/g, " ")
        .toUpperCase();
}
function getPublicImagePath(folderName: string, fileBaseName?: string) {
    if (!fileBaseName) {
        return "";
    }
    const fileName = fileBaseName.endsWith(".png")
        ? fileBaseName
        : `${fileBaseName}.png`;
    const filePath = path.join(process.cwd(), "public", "ship", folderName, fileName);
    if (!publicFileExists(filePath)) {
        return "";
    }
    return deploymentUrl(`/ship/${folderName}/${fileName}`);
}
function getShipTypeIconPath(shipStyleType?: string) {
    const fileName = shipStyleIconFileMap[shipStyleType ?? ""];
    if (!fileName) {
        return "";
    }
    const filePath = path.join(process.cwd(), "public", "ship", "ship_type", fileName);
    if (!publicFileExists(filePath)) {
        return "";
    }
    return deploymentUrl(`/ship/ship_type/${fileName}`);
}
function getShipImagePath(baseShipId: string, faceCardName?: string) {
    return (getPublicImagePath("ship_ilust", faceCardName) ||
        getPublicImagePath("ship_ilust", `AB_UNIT_FACE_CARD_${baseShipId}`));
}
function getSkillIconPath(iconName?: string) {
    return getPublicImagePath("ship_skill", iconName);
}
function getSkillIds(unit: UnitBaseRow | undefined) {
    if (!unit) {
        return [];
    }
    return [
        unit.m_SkillStrID1,
        unit.m_SkillStrID2,
        unit.m_SkillStrID3,
        unit.m_SkillStrID4,
        unit.m_SkillStrID5,
    ].filter((skillId): skillId is string => Boolean(skillId));
}
function createStats(statRow: UnitStatRow | undefined) {
    const stats = statRow?.m_StatData?.m_Stat;
    const statsPerLevel = statRow?.m_StatData?.m_StatPerLevel;
    if (!stats) {
        return [];
    }
    return statOrder
        .filter((statKey) => typeof stats[statKey] === "number")
        .map((statKey) => ({
        label: statLabels[statKey] ?? statKey,
        baseValue: stats[statKey],
        perLevelValue: statsPerLevel?.[statKey] ?? 0,
    }));
}
function getLevelMap(levelRows: ShipLevelRow[]) {
    const levelMap = new Map<string, number>();
    for (const row of levelRows) {
        if ((row.m_ShipLimitBreakGrade ?? 0) > 0) {
            continue;
        }
        levelMap.set(`${row.m_ShipRareGrade}:${row.m_ShipStarGrade}`, row.m_ShipMaxLevel ?? 0);
    }
    return levelMap;
}
function groupBuildRows(buildRows: ShipBuildRow[]) {
    const groups = new Map<string, ShipBuildRow[]>();
    for (const row of buildRows) {
        if (!row.m_ShipName) {
            continue;
        }
        const baseShipId = getBaseShipId(row.m_ShipName);
        const group = groups.get(baseShipId) ?? [];
        group.push(row);
        groups.set(baseShipId, group);
    }
    return groups;
}
function loadShipContext() {
    const buildRows = readLocalJson<JsonTable<ShipBuildRow>>("136_LUA_SHIP_BUILD_TEMPLET_g.json")
        ?.data ?? [];
    const unitBaseRows = readLocalJson<JsonTable<UnitBaseRow>>("004_LUA_UNIT_TEMPLET_BASE_h.json")
        ?.data ?? [];
    const unitStatRows = readLocalJson<JsonTable<UnitStatRow>>("003_LUA_UNIT_STAT_TEMPLET_h.json")
        ?.data ?? [];
    const skillRows = readLocalJson<JsonTable<ShipSkillRow>>("166_LUA_SHIP_SKILL_TEMPLET_g.json")
        ?.data ?? [];
    const levelRows = readLocalJson<JsonTable<ShipLevelRow>>("061_LUA_SHIP_LEVELUP_TEMPLET_e.json")
        ?.data ?? [];
    const limitBreakRows = readLocalJson<JsonTable<ShipLimitBreakRow>>("031_LUA_SHIP_LIMITBREAK_TEMPLET_a.json")?.data ?? [];
    const unitTextMap = createTextMap(readLocalJson<TextTable>("002_LUA_SI_UNIT_KOREA_l.json"));
    const skillTextMap = createTextMap(readLocalJson<TextTable>("022_LUA_SI_SHIP_SKILL_KOREA_f.json"));
    const descriptionTextMap = createTextMap(readLocalJson<TextTable>("095_LUA_SI_DESC_KOREA_l.json"));
    return {
        buildRows,
        unitBaseById: new Map<string, UnitBaseRow>(unitBaseRows.map((row) => [row.m_UnitStrID, row])),
        unitStatById: new Map<string, UnitStatRow>(unitStatRows.map((row) => [row.m_UnitStrID, row])),
        skillById: new Map<string, ShipSkillRow>(skillRows.map((row) => [row.m_ShipSkillStrID, row])),
        levelMap: getLevelMap(levelRows),
        limitBreakRows,
        unitTextMap,
        skillTextMap,
        descriptionTextMap,
    };
}
function createShipDetail(baseShipId: string, context = loadShipContext()): ShipDetail | null {
    if (excludedShipIds.has(baseShipId)) {
        return null;
    }
    if (context.buildRows.length === 0) {
        return null;
    }
    const groupedRows = groupBuildRows(context.buildRows).get(baseShipId);
    if (!groupedRows) {
        return null;
    }
    const stages = groupedRows
        .slice()
        .sort((a, b) => getShipStage(a.m_ShipName) - getShipStage(b.m_ShipName));
    const firstBuildRow = stages[0];
    const lastBuildRow = stages[stages.length - 1];
    const firstUnit = context.unitBaseById.get(firstBuildRow.m_ShipName);
    const lastUnit = context.unitBaseById.get(lastBuildRow.m_ShipName) ?? firstUnit;
    const gradeInfo = getGradeInfo(lastUnit?.m_NKM_UNIT_GRADE);
    const shipStyleType = lastUnit?.m_NKM_UNIT_STYLE_TYPE ?? "";
    const title = getText(context.unitTextMap, lastUnit?.m_Title) ||
        shipStyleTypeMap[shipStyleType] ||
        "함선";
    const name = getText(context.unitTextMap, lastUnit?.m_Name) ||
        formatFallbackName(baseShipId);
    const shipVoiceAssetName = `AB_UI_UNIT_VOICE_${firstBuildRow.m_ShipName}`;
    const description = (getText(context.descriptionTextMap, `SI_DESC_UNIT_GET_${firstBuildRow.m_ShipID}`) ||
        getText(context.descriptionTextMap, `${shipVoiceAssetName}@${shipVoiceAssetName}_GET_01`)).trim();
    const skillStages = stages.map((stageRow) => {
        const unit = context.unitBaseById.get(stageRow.m_ShipName);
        const skills = getSkillIds(unit).map((skillId) => {
            const skill = context.skillById.get(skillId);
            return {
                id: skillId,
                name: getText(context.skillTextMap, skill?.m_SkillName) || skillId,
                description: getText(context.skillTextMap, skill?.m_SkillDesc),
                upgradeDescription: getText(context.skillTextMap, skill?.m_SkillBuildDesc),
                type: skillTypeMap[skill?.m_NKM_SKILL_TYPE ?? ""] ?? "스킬",
                iconPath: getSkillIconPath(skill?.m_ShipSkillIcon),
                cooldown: typeof skill?.m_fCooltimeSecond === "number"
                    ? `${skill.m_fCooltimeSecond}초`
                    : "",
            };
        });
        return {
            stage: getShipStage(stageRow.m_ShipName),
            skills,
        };
    });
    const displayStages = stages.map((stageRow) => {
        const unit = context.unitBaseById.get(stageRow.m_ShipName);
        const stage = getShipStage(stageRow.m_ShipName);
        const maxLevel = context.levelMap.get(`${unit?.m_NKM_UNIT_GRADE ?? ""}:${stage}`);
        return {
            shipId: stageRow.m_ShipID,
            unitStrId: stageRow.m_ShipName,
            stage,
            maxLevel: maxLevel ? String(maxLevel) : "",
        };
    });
    const limitBreakLevels = context.limitBreakRows
        .filter((row) => row.ShipID === lastBuildRow.m_ShipID)
        .sort((a, b) => a.ShipLimitBreakGrade - b.ShipLimitBreakGrade)
        .map((row) => ({
        grade: row.ShipLimitBreakGrade,
        maxLevel: row.ShipLimitBreakMaxLevel ?? 0,
    }))
        .filter((level) => level.maxLevel > 0);
    return {
        id: baseShipId,
        href: deploymentUrl(`/ships/${baseShipId}`),
        name,
        title,
        shipTypeIconPath: getShipTypeIconPath(shipStyleType),
        grade: gradeInfo.label,
        gradeColor: gradeInfo.color,
        shipType: shipTypeMap[lastBuildRow.m_ShipType ?? ""] ?? "함선",
        stageCount: stages.length,
        imagePath: getShipImagePath(baseShipId, lastUnit?.m_FaceCardName),
        sortId: firstBuildRow.m_ShipID,
        description,
        stages: displayStages,
        skillStages,
        stats: createStats(context.unitStatById.get(lastBuildRow.m_ShipName)),
        maxLevel: context.levelMap.get(`${lastUnit?.m_NKM_UNIT_GRADE ?? ""}:${getShipStage(lastBuildRow.m_ShipName)}`) ?? 1,
        limitBreakLevels,
    };
}
export function loadShips() {
    const context = loadShipContext();
    if (context.buildRows.length === 0) {
        return [];
    }
    return Array.from(groupBuildRows(context.buildRows).keys())
        .map((baseShipId) => createShipDetail(baseShipId, context))
        .filter((ship): ship is ShipDetail => ship !== null)
        .sort((a, b) => a.sortId - b.sortId)
        .map(({ id, href, name, title, shipTypeIconPath, grade, gradeColor, shipType, stageCount, imagePath, }) => ({
        id,
        href,
        name,
        title,
        shipTypeIconPath,
        grade,
        gradeColor,
        shipType,
        stageCount,
        imagePath,
    }));
}
export function getShipDetail(baseShipId: string) {
    return createShipDetail(baseShipId);
}
