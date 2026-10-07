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
type EquipmentRow = {
    m_ItemEquipID: number;
    m_ItemEquipStrID: string;
    m_ItemEquipName?: string;
    m_ItemEquipDesc?: string;
    m_NKM_ITEM_TIER?: number;
    m_NKM_ITEM_GRADE?: string;
    m_ItemEquipPosition?: string;
    m_EquipUnitStyleType?: string;
    m_ItemEquipIconName?: string;
    m_MaxEnchantLevel?: number;
    STAT_TYPE_1?: string;
    STAT_VALUE_1?: number;
    STAT_LEVELUP_VALUE_1?: number;
    m_StatGroupID?: number;
    m_StatGroupID_2?: number;
    m_SetGroup?: number[];
    m_lstPrivateUnitID?: number[];
    m_bRelic?: boolean;
    m_PotentialOptionGroupID?: number;
};
type RandomStatRow = {
    m_StatGroupID: number;
    m_StatType?: string;
    m_MinStat?: number;
    m_MaxStat?: number;
    m_MinStatValue?: number;
    m_MaxStatValue?: number;
};
type SetOptionRow = {
    m_EquipSetID: number;
    m_EquipSetPart?: number;
    m_EquipSetName?: string;
    m_EquipSetIcon?: string;
    m_StatType_1?: string;
    m_StatType_2?: string;
    m_StatRate_1?: number;
    m_StatRate_2?: number;
    m_StatValue_1?: number;
    m_StatValue_2?: number;
};
type PotentialOptionRow = {
    m_PotentialOptionGroupID: number;
    OptionKey?: number;
    Socket1_StatType?: string;
    Socket1_MinStat?: number;
    Socket1_MaxStat?: number;
    Socket1_MinStatRate?: number;
    Socket1_MaxStatRate?: number;
    Socket2_MinStat?: number;
    Socket2_MaxStat?: number;
    Socket2_MinStatRate?: number;
    Socket2_MaxStatRate?: number;
    Socket3_MinStat?: number;
    Socket3_MaxStat?: number;
    Socket3_MinStatRate?: number;
    Socket3_MaxStatRate?: number;
};
type UpgradeRow = {
    UpgradeEquipID: number;
    CoreEquipID: number;
};
type EquipmentRecommendRow = {
    EquipRecommendID: number;
    WeaponSlot?: number;
    DefenceSlot?: number;
    ACCSlot_1?: number;
    ACCSlot_2?: number;
};
type StatInfoRow = {
    Stat_ID?: string;
    Stat_Name?: string;
};
type MergedUnit = {
    unitId: number;
    unitStrId: string;
    nameKey: string;
    titleKey: string;
};
export type EquipmentListItem = {
    id: string;
    numericId: number;
    href: string;
    name: string;
    grade: string;
    gradeColor: string;
    tier: number;
    position: string;
    unitType: string;
    equipmentKind: string;
    isExclusive: boolean;
    privateUnitNames: string[];
    imagePath: string;
    backgroundImagePath: string;
    mainStatLabel: string;
    mainStatValue: string;
};
export type EquipmentOptionGroup = {
    label: string;
    options: string[];
};
export type EquipmentSetOption = {
    id: number;
    name: string;
    requiredParts: number;
    iconPath: string;
    effects: string[];
};
export type EquipmentPotentialOption = {
    id: string;
    label: string;
    sockets: string[];
};
export type EquipmentUnitLink = {
    id: number;
    name: string;
    title: string;
    href: string;
    imagePath: string;
};
export type EquipmentVariantLink = {
    id: string;
    name: string;
    href: string;
    tier: number;
    grade: string;
    gradeColor: string;
};
export type EquipmentSeriesLink = EquipmentListItem & {
    isCurrent: boolean;
};
export type EquipmentDetail = EquipmentListItem & {
    description: string;
    mainStatValues: string[];
    randomOptionGroups: EquipmentOptionGroup[];
    setOptions: EquipmentSetOption[];
    potentialOptions: EquipmentPotentialOption[];
    privateUnits: EquipmentUnitLink[];
    sameImageVariants: EquipmentVariantLink[];
    seriesItems: EquipmentSeriesLink[];
};
const gradeMap: Record<string, {
    label: string;
    color: string;
    order: number;
}> = {
    NIG_N: { label: "N", color: "var(--grade-n)", order: 1 },
    NIG_R: { label: "R", color: "var(--grade-r)", order: 2 },
    NIG_SR: { label: "SR", color: "var(--grade-sr)", order: 3 },
    NIG_SSR: { label: "SSR", color: "var(--grade-ssr)", order: 4 },
};
const positionMap: Record<string, string> = {
    IEP_WEAPON: "무기",
    IEP_DEFENCE: "방어구",
    IEP_ACC: "보조장비",
};
const unitTypeMap: Record<string, string> = {
    NUST_COUNTER: "카운터",
    NUST_SOLDIER: "솔저",
    NUST_MECHANIC: "메카닉",
};
const flatStatTypes = new Set([
    "NST_HP",
    "NST_ATK",
    "NST_DEF",
    "NST_CRITICAL",
    "NST_HIT",
    "NST_EVADE",
]);
const fallbackStatNames: Record<string, string> = {
    NST_HP: "체력",
    NST_ATK: "공격력",
    NST_DEF: "방어력",
    NST_CRITICAL: "치명",
    NST_HIT: "명중",
    NST_EVADE: "회피",
};
function readLocalJson<T>(fileName: string) {
    const filePaths = [
        path.join(process.cwd(), "json", "equipment", fileName),
        path.join(process.cwd(), "json", "KR", "equipment", fileName),
        path.join(process.cwd(), "json", "character", fileName),
        path.join(process.cwd(), "json", "KR", "character", fileName),
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
function cleanGameText(text: string) {
    return text
        .replace(/<color=#[0-9a-f]+>/gi, "")
        .replace(/<\/color>/gi, "")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();
}
function getText(textMap: Map<string, string>, key?: string) {
    if (!key || key === "SI_BLANK") {
        return "";
    }
    return cleanGameText(textMap.get(key) ?? "");
}
function formatNumber(value: number) {
    return new Intl.NumberFormat("ko-KR", {
        maximumFractionDigits: 1,
    }).format(value);
}
function formatPercent(value: number) {
    return `${formatNumber(value * 100)}%`;
}
function formatStatValue(statType: string, value: number) {
    return flatStatTypes.has(statType)
        ? formatNumber(value)
        : formatPercent(value);
}
function getGradeInfo(gradeKey?: string) {
    return gradeMap[gradeKey ?? ""] ?? gradeMap.NIG_N;
}
function getEquipmentImagePath(iconName?: string) {
    if (!iconName) {
        return "";
    }
    const candidates = [
        `AB_INVEN_ICON_${iconName}.png`,
        `AB_INVEN_ICON_IQI_EQUIP_${iconName}.png`,
    ];
    for (const fileName of candidates) {
        const filePath = path.join(process.cwd(), "public", "equipment", "equip_image", fileName);
        if (publicFileExists(filePath)) {
            return deploymentUrl(`/equipment/equip_image/${fileName}`);
        }
    }
    return "";
}
function getEquipmentBackgroundImagePath(grade: string) {
    const fileName = `AB_INVEN_ICON_FRAME_${grade}.png`;
    const filePath = path.join(process.cwd(), "public", "equipment", "equip_background", fileName);
    return publicFileExists(filePath)
        ? deploymentUrl(`/equipment/equip_background/${fileName}`) : "";
}
function getSetIconPath(iconName?: string) {
    if (!iconName) {
        return "";
    }
    const fileName = `${iconName}.png`;
    const filePath = path.join(process.cwd(), "public", "equipment", "equip_set", fileName);
    return publicFileExists(filePath) ? deploymentUrl(`/equipment/equip_set/${fileName}`) : "";
}
function getUnitIconImagePath(unitStrId: string) {
    const fileName = `AB_INVEN_ICON_${unitStrId}.png`;
    const filePath = path.join(process.cwd(), "public", "unit", "unit_icon", fileName);
    return publicFileExists(filePath) ? deploymentUrl(`/unit/unit_icon/${fileName}`) : "";
}
function getVisibleEquipmentRows(equipmentTextMap: Map<string, string>) {
    const rows = readLocalJson<JsonTable<EquipmentRow>>("002_LUA_ITEM_EQUIP_TEMPLET_g.json")?.data ?? [];
    return rows.filter((row) => {
        const equipmentName = getText(equipmentTextMap, row.m_ItemEquipName);
        return (row.m_ItemEquipPosition !== "IEP_ENCHANT" &&
            !row.m_ItemEquipStrID.startsWith("IQI_EQUIP_TEST_") &&
            !equipmentName.startsWith("레거시 "));
    });
}
function getEquipmentListRows(equipmentTextMap: Map<string, string>, rows = getVisibleEquipmentRows(equipmentTextMap)) {
    const representativeByName = new Map<string, EquipmentRow>();
    const upgradeRows = readLocalJson<JsonTable<UpgradeRow>>("004_LUA_ITEM_EQUIP_UPGRADE_g.json")?.data ?? [];
    const upgradeCoreIds = new Set(upgradeRows.map((upgradeRow) => upgradeRow.CoreEquipID));
    for (const row of rows) {
        const displayName = getText(equipmentTextMap, row.m_ItemEquipName) || row.m_ItemEquipStrID;
        const current = representativeByName.get(displayName);
        if (!current) {
            representativeByName.set(displayName, row);
            continue;
        }
        const currentGradeOrder = getGradeInfo(current.m_NKM_ITEM_GRADE).order;
        const nextGradeOrder = getGradeInfo(row.m_NKM_ITEM_GRADE).order;
        const currentIsUpgradeCore = upgradeCoreIds.has(current.m_ItemEquipID);
        const nextIsUpgradeCore = upgradeCoreIds.has(row.m_ItemEquipID);
        const shouldReplace = currentIsUpgradeCore !== nextIsUpgradeCore
            ? nextIsUpgradeCore
            : (row.m_NKM_ITEM_TIER ?? 0) > (current.m_NKM_ITEM_TIER ?? 0) ||
                ((row.m_NKM_ITEM_TIER ?? 0) === (current.m_NKM_ITEM_TIER ?? 0) &&
                    nextGradeOrder > currentGradeOrder) ||
                ((row.m_NKM_ITEM_TIER ?? 0) === (current.m_NKM_ITEM_TIER ?? 0) &&
                    nextGradeOrder === currentGradeOrder &&
                    row.m_ItemEquipID > current.m_ItemEquipID);
        if (shouldReplace) {
            representativeByName.set(displayName, row);
        }
    }
    return Array.from(representativeByName.values());
}
function createStatNameMap() {
    const statTextMap = createTextMap(readLocalJson<TextTable>("043_LUA_SI_STAT_INFO_KOREA_g.json"));
    const statRows = readLocalJson<JsonTable<StatInfoRow>>("116_LUA_STAT_INFO_TEMPLET_h.json")?.data ?? [];
    const statNameMap = new Map<string, string>();
    for (const row of statRows) {
        if (!row.Stat_ID) {
            continue;
        }
        const name = getText(statTextMap, row.Stat_Name).replace(/\s+/g, " ");
        statNameMap.set(row.Stat_ID, name || fallbackStatNames[row.Stat_ID] || row.Stat_ID);
    }
    return statNameMap;
}
function createUnitNameMap() {
    const mergedUnits = readLocalJson<MergedUnit[]>("merged_units.json") ?? [];
    const unitTextMap = createTextMap(readLocalJson<TextTable>("002_LUA_SI_UNIT_KOREA_l.json"));
    const unitNameMap = new Map<number, string>();
    for (const unit of mergedUnits) {
        unitNameMap.set(unit.unitId, getText(unitTextMap, unit.nameKey) || unit.unitStrId);
    }
    return unitNameMap;
}
function getPrivateUnitNames(row: EquipmentRow, unitNameMap: Map<number, string>) {
    return Array.from(new Set((row.m_lstPrivateUnitID ?? [])
        .map((unitId) => unitNameMap.get(unitId))
        .filter((name): name is string => Boolean(name))));
}
function getStatName(statNameMap: Map<string, string>, statType?: string) {
    if (!statType) {
        return "능력치";
    }
    return statNameMap.get(statType) ?? fallbackStatNames[statType] ?? statType;
}
function createListItem(row: EquipmentRow, equipmentTextMap: Map<string, string>, statNameMap: Map<string, string>, unitNameMap: Map<number, string>): EquipmentListItem {
    const gradeInfo = getGradeInfo(row.m_NKM_ITEM_GRADE);
    const statType = row.STAT_TYPE_1 ?? "";
    const statValue = row.STAT_VALUE_1 ?? 0;
    return {
        id: row.m_ItemEquipStrID,
        numericId: row.m_ItemEquipID,
        href: deploymentUrl(`/equipment/${encodeURIComponent(row.m_ItemEquipStrID)}`),
        name: getText(equipmentTextMap, row.m_ItemEquipName) || row.m_ItemEquipStrID,
        grade: gradeInfo.label,
        gradeColor: gradeInfo.color,
        tier: row.m_NKM_ITEM_TIER ?? 0,
        position: positionMap[row.m_ItemEquipPosition ?? ""] ?? "장비",
        unitType: unitTypeMap[row.m_EquipUnitStyleType ?? ""] ?? "기타",
        equipmentKind: row.m_bRelic === true ? "렐릭 장비" : "일반 장비",
        isExclusive: (row.m_lstPrivateUnitID?.length ?? 0) > 0,
        privateUnitNames: getPrivateUnitNames(row, unitNameMap),
        imagePath: getEquipmentImagePath(row.m_ItemEquipIconName),
        backgroundImagePath: getEquipmentBackgroundImagePath(gradeInfo.label),
        mainStatLabel: getStatName(statNameMap, statType),
        mainStatValue: formatStatValue(statType, statValue),
    };
}
function createRandomOptionGroups(row: EquipmentRow, randomRows: RandomStatRow[], statNameMap: Map<string, string>) {
    return [row.m_StatGroupID, row.m_StatGroupID_2].flatMap((groupId, index): EquipmentOptionGroup[] => {
        if (typeof groupId !== "number") {
            return [];
        }
        const options = randomRows
            .filter((randomRow) => randomRow.m_StatGroupID === groupId)
            .flatMap((randomRow) => {
            const statType = randomRow.m_StatType;
            const minimum = randomRow.m_MinStatValue ?? randomRow.m_MinStat;
            const maximum = randomRow.m_MaxStatValue ?? randomRow.m_MaxStat;
            if (!statType ||
                typeof minimum !== "number" ||
                typeof maximum !== "number") {
                return [];
            }
            return [
                `${getStatName(statNameMap, statType)} ${formatStatValue(statType, minimum)} ~ ${formatStatValue(statType, maximum)}`,
            ];
        });
        return options.length > 0
            ? [{ label: `보조 옵션 ${index + 1}`, options }]
            : [];
    });
}
function createSetOptions(row: EquipmentRow, setRows: SetOptionRow[], equipmentTextMap: Map<string, string>, statNameMap: Map<string, string>) {
    const setIds = new Set(row.m_SetGroup ?? []);
    return setRows
        .filter((setRow) => setIds.has(setRow.m_EquipSetID))
        .map((setRow): EquipmentSetOption => {
        const effects = [1, 2].flatMap((index) => {
            const statType = setRow[`m_StatType_${index}` as keyof SetOptionRow];
            const statRate = setRow[`m_StatRate_${index}` as keyof SetOptionRow];
            const statValue = setRow[`m_StatValue_${index}` as keyof SetOptionRow];
            if (typeof statType !== "string") {
                return [];
            }
            if (typeof statRate === "number") {
                return [`${getStatName(statNameMap, statType)} ${formatPercent(statRate)}`];
            }
            if (typeof statValue === "number") {
                return [
                    `${getStatName(statNameMap, statType)} ${formatStatValue(statType, statValue)}`,
                ];
            }
            return [];
        });
        return {
            id: setRow.m_EquipSetID,
            name: getText(equipmentTextMap, setRow.m_EquipSetName) ||
                `세트 ${setRow.m_EquipSetID}`,
            requiredParts: setRow.m_EquipSetPart ?? 0,
            iconPath: getSetIconPath(setRow.m_EquipSetIcon),
            effects,
        };
    });
}
function createPotentialOptions(row: EquipmentRow, potentialRows: PotentialOptionRow[], statNameMap: Map<string, string>, equipmentUiTextMap: Map<string, string>) {
    if (typeof row.m_PotentialOptionGroupID !== "number") {
        return [];
    }
    return potentialRows
        .filter((potentialRow) => potentialRow.m_PotentialOptionGroupID === row.m_PotentialOptionGroupID)
        .flatMap((potentialRow): EquipmentPotentialOption[] => {
        const statType = potentialRow.Socket1_StatType;
        if (!statType) {
            return [];
        }
        const fixedSocketRanges = [
            [potentialRow.Socket1_MinStat, potentialRow.Socket1_MaxStat],
            [potentialRow.Socket2_MinStat, potentialRow.Socket2_MaxStat],
            [potentialRow.Socket3_MinStat, potentialRow.Socket3_MaxStat],
        ];
        const rateSocketRanges = [
            [potentialRow.Socket1_MinStatRate, potentialRow.Socket1_MaxStatRate],
            [potentialRow.Socket2_MinStatRate, potentialRow.Socket2_MaxStatRate],
            [potentialRow.Socket3_MinStatRate, potentialRow.Socket3_MaxStatRate],
        ];
        const usesRateValues = rateSocketRanges.some(([minimum, maximum]) => {
            return typeof minimum === "number" && typeof maximum === "number";
        });
        const socketRanges = usesRateValues
            ? rateSocketRanges
            : fixedSocketRanges;
        const sockets = socketRanges.flatMap(([minimum, maximum], index) => {
            if (typeof minimum !== "number" || typeof maximum !== "number") {
                return [];
            }
            const minimumText = usesRateValues
                ? formatPercent(minimum)
                : formatStatValue(statType, minimum);
            const maximumText = usesRateValues
                ? formatPercent(maximum)
                : formatStatValue(statType, maximum);
            return [
                `소켓 ${index + 1} ${minimumText} ~ ${maximumText}`,
            ];
        });
        const inventoryStatNameKey = `SI_DP_STAT_SHORT_NAME_FOR_INVEN_EQUIP_${statType}` +
            (usesRateValues ? "_RATE" : "");
        const inventoryStatName = getText(equipmentUiTextMap, inventoryStatNameKey);
        if (sockets.length === 0) {
            return [];
        }
        return [
            {
                id: `${potentialRow.m_PotentialOptionGroupID}-${potentialRow.OptionKey ?? 0}`,
                label: inventoryStatName || getStatName(statNameMap, statType),
                sockets,
            },
        ];
    });
}
function createPrivateUnits(row: EquipmentRow) {
    const unitIds = new Set(row.m_lstPrivateUnitID ?? []);
    if (unitIds.size === 0) {
        return [];
    }
    const mergedUnits = readLocalJson<MergedUnit[]>("merged_units.json") ?? [];
    const unitTextMap = createTextMap(readLocalJson<TextTable>("002_LUA_SI_UNIT_KOREA_l.json"));
    return mergedUnits
        .filter((unit) => unitIds.has(unit.unitId))
        .map((unit): EquipmentUnitLink => ({
        id: unit.unitId,
        name: getText(unitTextMap, unit.nameKey) || unit.unitStrId,
        title: getText(unitTextMap, unit.titleKey),
        href: deploymentUrl(`/characters/${encodeURIComponent(unit.unitStrId)}`),
        imagePath: getUnitIconImagePath(unit.unitStrId),
    }));
}
function createSameImageVariants(row: EquipmentRow, rows: EquipmentRow[], equipmentTextMap: Map<string, string>) {
    if (!row.m_ItemEquipIconName) {
        return [];
    }
    const currentTier = row.m_NKM_ITEM_TIER ?? 0;
    const currentGrade = row.m_NKM_ITEM_GRADE ?? "";
    const representativeByVersion = new Map<string, EquipmentRow>();
    for (const candidate of rows) {
        const candidateTier = candidate.m_NKM_ITEM_TIER ?? 0;
        const candidateGrade = candidate.m_NKM_ITEM_GRADE ?? "";
        if (candidate.m_ItemEquipID === row.m_ItemEquipID ||
            candidate.m_ItemEquipIconName !== row.m_ItemEquipIconName ||
            (candidateTier === currentTier && candidateGrade === currentGrade)) {
            continue;
        }
        const candidateName = getText(equipmentTextMap, candidate.m_ItemEquipName) ||
            candidate.m_ItemEquipStrID;
        const versionKey = `${candidateName}-${candidateTier}-${candidateGrade}`;
        const current = representativeByVersion.get(versionKey);
        if (!current || candidate.m_ItemEquipID > current.m_ItemEquipID) {
            representativeByVersion.set(versionKey, candidate);
        }
    }
    return Array.from(representativeByVersion.values())
        .map((candidate): EquipmentVariantLink => {
        const gradeInfo = getGradeInfo(candidate.m_NKM_ITEM_GRADE);
        return {
            id: candidate.m_ItemEquipStrID,
            name: getText(equipmentTextMap, candidate.m_ItemEquipName) ||
                candidate.m_ItemEquipStrID,
            href: deploymentUrl(`/equipment/${encodeURIComponent(candidate.m_ItemEquipStrID)}`),
            tier: candidate.m_NKM_ITEM_TIER ?? 0,
            grade: gradeInfo.label,
            gradeColor: gradeInfo.color,
        };
    })
        .sort((first, second) => {
        return (first.tier - second.tier ||
            getGradeInfo(`NIG_${first.grade}`).order -
                getGradeInfo(`NIG_${second.grade}`).order ||
            first.name.localeCompare(second.name, "ko"));
    });
}
function getEquipmentDisplayName(row: EquipmentRow, equipmentTextMap: Map<string, string>) {
    return (getText(equipmentTextMap, row.m_ItemEquipName) || row.m_ItemEquipStrID);
}
function getSharedPrivateUnitId(rows: EquipmentRow[]) {
    const firstUnitIds = rows[0]?.m_lstPrivateUnitID ?? [];
    return firstUnitIds.find((unitId) => {
        return rows.every((row) => row.m_lstPrivateUnitID?.includes(unitId));
    });
}
function hasCommonSeriesPrefix(names: string[]) {
    const firstWord = names[0]?.trim().split(/\s+/)[0];
    return Boolean(firstWord &&
        firstWord.length >= 2 &&
        names.every((name) => name === firstWord || name.startsWith(`${firstWord} `)));
}
function isCoherentRecommendedSeries(rows: EquipmentRow[], equipmentTextMap: Map<string, string>) {
    if (rows.length < 2) {
        return false;
    }
    const unitTypes = new Set(rows.map((row) => row.m_EquipUnitStyleType));
    if (unitTypes.size !== 1) {
        return false;
    }
    if (typeof getSharedPrivateUnitId(rows) === "number") {
        return true;
    }
    const familyCodes = new Set(rows.map((row) => Math.floor(row.m_ItemEquipID / 1000)));
    const names = rows.map((row) => getEquipmentDisplayName(row, equipmentTextMap));
    return familyCodes.size === 1 || hasCommonSeriesPrefix(names);
}
function createEquipmentSeries(row: EquipmentRow, rows: EquipmentRow[], equipmentTextMap: Map<string, string>, statNameMap: Map<string, string>, unitNameMap: Map<number, string>) {
    const representativeRows = getEquipmentListRows(equipmentTextMap, rows);
    const representativeByName = new Map(representativeRows.map((representative) => [
        getEquipmentDisplayName(representative, equipmentTextMap),
        representative,
    ]));
    const rowById = new Map(rows.map((candidate) => [candidate.m_ItemEquipID, candidate]));
    const currentName = getEquipmentDisplayName(row, equipmentTextMap);
    const recommendRows = readLocalJson<JsonTable<EquipmentRecommendRow>>("206_LUA_EQUIP_RECOMMEND_LIST_e.json")?.data ?? [];
    const recommendedSeries = recommendRows
        .map((recommendRow) => {
        const slotIds = [
            recommendRow.WeaponSlot,
            recommendRow.DefenceSlot,
            recommendRow.ACCSlot_1,
            recommendRow.ACCSlot_2,
        ].filter((slotId): slotId is number => typeof slotId === "number");
        const slotRows = Array.from(new Map(slotIds.flatMap((slotId) => {
            const slotRow = rowById.get(slotId);
            return slotRow ? [[slotId, slotRow] as const] : [];
        })).values());
        if (!slotRows.some((slotRow) => getEquipmentDisplayName(slotRow, equipmentTextMap) === currentName) ||
            !isCoherentRecommendedSeries(slotRows, equipmentTextMap)) {
            return null;
        }
        const resolvedRows = Array.from(new Map(slotRows.flatMap((slotRow) => {
            const displayName = getEquipmentDisplayName(slotRow, equipmentTextMap);
            const representative = representativeByName.get(displayName);
            return representative
                ? [[displayName, representative] as const]
                : [];
        })).values());
        return resolvedRows.length >= 2
            ? {
                id: recommendRow.EquipRecommendID,
                rows: resolvedRows,
            }
            : null;
    })
        .filter((series): series is {
        id: number;
        rows: EquipmentRow[];
    } => series !== null)
        .sort((first, second) => {
        return second.rows.length - first.rows.length || first.id - second.id;
    });
    let seriesRows = recommendedSeries[0]?.rows ?? [];
    if (seriesRows.length === 0 && (row.m_lstPrivateUnitID?.length ?? 0) === 0) {
        const familyCode = Math.floor(row.m_ItemEquipID / 1000);
        const fallbackRows = representativeRows.filter((candidate) => {
            return ((candidate.m_lstPrivateUnitID?.length ?? 0) === 0 &&
                Math.floor(candidate.m_ItemEquipID / 1000) === familyCode &&
                candidate.m_EquipUnitStyleType === row.m_EquipUnitStyleType);
        });
        if (fallbackRows.length === 3 || fallbackRows.length === 4) {
            seriesRows = fallbackRows;
        }
    }
    const positionOrder: Record<string, number> = {
        IEP_WEAPON: 1,
        IEP_DEFENCE: 2,
        IEP_ACC: 3,
    };
    return seriesRows
        .sort((first, second) => {
        return ((positionOrder[first.m_ItemEquipPosition ?? ""] ?? 99) -
            (positionOrder[second.m_ItemEquipPosition ?? ""] ?? 99) ||
            first.m_ItemEquipID - second.m_ItemEquipID);
    })
        .map((seriesRow): EquipmentSeriesLink => {
        const listItem = createListItem(seriesRow, equipmentTextMap, statNameMap, unitNameMap);
        return {
            ...listItem,
            isCurrent: listItem.name === currentName,
        };
    });
}
export function loadEquipment(): EquipmentListItem[] {
    const equipmentTextMap = createTextMap(readLocalJson<TextTable>("001_LUA_SI_EQUIP_TEMPLET_KOREA_b.json"));
    const statNameMap = createStatNameMap();
    const unitNameMap = createUnitNameMap();
    return getEquipmentListRows(equipmentTextMap)
        .map((row) => createListItem(row, equipmentTextMap, statNameMap, unitNameMap))
        .sort((first, second) => {
        return (Number(first.isExclusive) - Number(second.isExclusive) ||
            second.tier - first.tier ||
            getGradeInfo(`NIG_${second.grade}`).order -
                getGradeInfo(`NIG_${first.grade}`).order ||
            first.numericId - second.numericId);
    });
}
export function getEquipmentRouteIds() {
    const equipmentTextMap = createTextMap(readLocalJson<TextTable>("001_LUA_SI_EQUIP_TEMPLET_KOREA_b.json"));
    return getVisibleEquipmentRows(equipmentTextMap).map((row) => row.m_ItemEquipStrID);
}
export function getPrivateEquipmentForUnit(unitId: number) {
    const equipmentTextMap = createTextMap(readLocalJson<TextTable>("001_LUA_SI_EQUIP_TEMPLET_KOREA_b.json"));
    const statNameMap = createStatNameMap();
    const unitNameMap = createUnitNameMap();
    const privateRows = getVisibleEquipmentRows(equipmentTextMap).filter((row) => {
        return row.m_lstPrivateUnitID?.includes(unitId) === true;
    });
    return getEquipmentListRows(equipmentTextMap, privateRows)
        .map((row) => createListItem(row, equipmentTextMap, statNameMap, unitNameMap))
        .sort((first, second) => {
        return (first.position.localeCompare(second.position, "ko") ||
            first.numericId - second.numericId);
    });
}
export function getEquipmentDetail(routeId: string): EquipmentDetail | null {
    const decodedRouteId = decodeURIComponent(routeId);
    const equipmentTextMap = createTextMap(readLocalJson<TextTable>("001_LUA_SI_EQUIP_TEMPLET_KOREA_b.json"));
    const rows = getVisibleEquipmentRows(equipmentTextMap);
    const row = rows.find((equipmentRow) => {
        return (equipmentRow.m_ItemEquipStrID === decodedRouteId ||
            String(equipmentRow.m_ItemEquipID) === decodedRouteId);
    });
    if (!row) {
        return null;
    }
    const statNameMap = createStatNameMap();
    const unitNameMap = createUnitNameMap();
    const listItem = createListItem(row, equipmentTextMap, statNameMap, unitNameMap);
    const randomRows = readLocalJson<JsonTable<RandomStatRow>>("188_LUA_ITEM_EQUIP_RANDOM_STAT_b.json")?.data ?? [];
    const setRows = readLocalJson<JsonTable<SetOptionRow>>("007_LUA_ITEM_EQUIP_SET_OPTION_a.json")?.data ?? [];
    const potentialRows = readLocalJson<JsonTable<PotentialOptionRow>>("180_LUA_ITEM_EQUIP_POTENTIAL_OPTION_w.json")?.data ?? [];
    const equipmentUiTextMap = createTextMap(readLocalJson<TextTable>("018_LUA_SI_DYNAMIC_PREFAB_KOREA_a.json"));
    const maxEnchantLevel = row.m_MaxEnchantLevel ?? 0;
    const statType = row.STAT_TYPE_1 ?? "";
    const mainStatValues = Array.from({ length: maxEnchantLevel + 1 }, (_, enhanceLevel) => {
        const statValue = (row.STAT_VALUE_1 ?? 0) +
            (row.STAT_LEVELUP_VALUE_1 ?? 0) * enhanceLevel;
        return formatStatValue(statType, statValue);
    });
    return {
        ...listItem,
        description: getText(equipmentTextMap, row.m_ItemEquipDesc) ||
            "장비 설명이 없습니다.",
        mainStatValues,
        randomOptionGroups: createRandomOptionGroups(row, randomRows, statNameMap),
        setOptions: createSetOptions(row, setRows, equipmentTextMap, statNameMap),
        potentialOptions: createPotentialOptions(row, potentialRows, statNameMap, equipmentUiTextMap),
        privateUnits: createPrivateUnits(row),
        sameImageVariants: createSameImageVariants(row, rows, equipmentTextMap),
        seriesItems: createEquipmentSeries(row, rows, equipmentTextMap, statNameMap, unitNameMap),
    };
}
