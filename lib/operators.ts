import { deploymentUrl } from "@/lib/deployment";
import fs from "node:fs";
import path from "node:path";
import { createVoiceAudioPath } from "@/lib/voice";
type JsonTable<T> = {
    data?: T[];
};
type TextTable = {
    data?: unknown[];
    m_dicString?: Record<string, string>;
};
type OperatorBaseRow = {
    m_UnitID: number;
    m_UnitStrID: string;
    m_Title?: string;
    m_Name?: string;
    m_UnitDesc?: string;
    m_FaceCardName?: string;
    m_MiniMapFaceName?: string;
    m_InvenIconName?: string;
    m_SkillStrID1?: string;
    m_OprPassiveGroupID?: number;
    m_NKM_UNIT_GRADE?: string;
};
type OperatorSkillRow = {
    UseFilter?: boolean;
    m_OperSkillID: number;
    m_OperSkillStrID: string;
    m_OperSkillNameStrID?: string;
    m_OperSkillDescStrID?: string;
    m_OperSkillIcon?: string;
    m_OperSkillType?: string;
    m_OperSkillTarget?: string;
    m_MaxSkillLevel?: number;
};
type OperatorPassiveRow = {
    m_OprPassiveGroupID: number;
    m_OperSkillID: number;
    m_Ratio?: number;
};
type OperatorStatRow = {
    m_UnitStrID: string;
    m_StatData?: {
        m_Stat?: Record<string, number>;
        m_StatPerLevel?: Record<string, number>;
    };
};
type TacticalCommandRow = {
    m_TCStrID: string;
    m_fCoolTime?: number;
    m_ComboValue1?: string;
    m_ComboValue2?: string;
    m_ComboValue3?: string;
    m_fActiveTime?: number;
    m_fActiveTimePerLevel?: number;
    m_fCostPump?: number;
    m_lstBuffStrID_MyTeam?: string[];
    m_lstBuffStrID_Enemy?: string[];
};
type BattleConditionRow = {
    m_BCondStrID: string;
    m_listAllyBuffStrID?: string[];
    m_listEnemyBuffStrID?: string[];
    m_AllyBuffStrID1?: string;
    m_AllyBuffStrID2?: string;
    m_EnemyBuffStrID1?: string;
    m_EnemyBuffStrID2?: string;
};
type BuffRow = {
    m_BuffStrID: string;
    m_fLifeTime?: number;
    m_fLifeTimePerLevel?: number;
    m_fBarrierHP?: number;
    m_fBarrierHPPerLevel?: number;
    [key: string]: unknown;
};
type VoiceTemplateRow = {
    m_bVoiceCondLifetime?: boolean;
    m_VoicePostID?: string;
    m_VoiceButtonName?: string;
};
type SkillValueContext = {
    tacticalCommandById: Map<string, TacticalCommandRow>;
    battleConditionById: Map<string, BattleConditionRow>;
    buffById: Map<string, BuffRow>;
};
type SkillStatEntry = {
    index: number;
    statType: string;
    value?: number;
    factor?: number;
};
export type OperatorSkill = {
    id: string;
    name: string;
    description: string;
    descriptionsByLevel: string[];
    type: string;
    iconPath: string;
    cooldown: number | null;
    activationConditions: string[];
    maxLevel: number;
};
export type OperatorStat = {
    label: string;
    baseValue: number;
    perLevelValue: number;
};
export type OperatorDialogue = {
    id: string;
    audioPath: string;
    isExtra: boolean;
    label: string;
    text: string;
};
export type OperatorListItem = {
    id: string;
    href: string;
    name: string;
    title: string;
    grade: string;
    gradeColor: string;
    imagePath: string;
    skillName: string;
    skillIconPath: string;
    passiveCount: number;
};
export type OperatorDetail = OperatorListItem & {
    sortId: number;
    description: string;
    tacticalSkill: OperatorSkill | null;
    passiveSkills: OperatorSkill[];
    stats: OperatorStat[];
    dialogues: OperatorDialogue[];
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
const skillTypeMap: Record<string, string> = {
    m_Tactical: "지휘 기술",
    m_Passive: "보조 기술",
};
const statLabels: Record<string, string> = {
    NST_HP: "체력",
    NST_ATK: "공격력",
    NST_DEF: "방어력",
    NST_SKILL_COOL_TIME_REDUCE_RATE: "스킬충전속도",
};
const skillStatLabels: Record<string, string> = {
    NST_ATK: "공격력",
    NST_ATK_FACTOR: "공격력",
    NST_ATTACK_COUNT_REDUCE: "피격 횟수",
    NST_ATTACK_DAMAGE_MODIFY_G2: "피해",
    NST_ATTACK_SPEED_RATE: "공격속도",
    NST_BARRIER_REINFORCE_RATE: "받는 배리어",
    NST_CRITICAL_DAMAGE_RATE: "치명타 피해",
    NST_CRITICAL_DAMAGE_RESIST_RATE: "치명타 피해 저항",
    NST_CRITICAL_FACTOR: "치명",
    NST_DAMAGE_REDUCE_PENETRATE: "피해감쇄 관통",
    NST_DAMAGE_REDUCE_RATE: "받는 피해",
    NST_DEF: "방어력",
    NST_DEF_PENETRATE_RATE: "방어관통",
    NST_EVADE: "회피 능력치",
    NST_HIT: "명중 능력치",
    NST_HP_GROWN_ATK_RATE: "체력 비례 공격력",
    NST_HP_REGEN_RATE: "회복",
    NST_HYPER_SKILL_DAMAGE_RATE: "궁극기 피해",
    NST_LONG_RANGE_DAMAGE_RATE: "원거리 피해",
    NST_LONG_RANGE_DAMAGE_REDUCE_RATE: "원거리 피해 감소",
    NST_MOVE_SPEED_RATE: "이동속도",
    NST_MOVE_TYPE_AIR_DAMAGE_REDUCE_RATE: "vs공중 피해 감소",
    NST_MOVE_TYPE_LAND_DAMAGE_RATE: "vs지상 피해",
    NST_MOVE_TYPE_LAND_DAMAGE_REDUCE_RATE: "vs지상 피해 감소",
    NST_ROLE_TYPE_DAMAGE_RATE: "상성 피해",
    NST_SHORT_RANGE_DAMAGE_RATE: "근거리 피해",
    NST_SHORT_RANGE_DAMAGE_REDUCE_RATE: "근거리 피해 감소",
    NST_SKILL_COOL_TIME_REDUCE_RATE: "스킬충전속도",
    NST_SKILL_DAMAGE_RATE: "스킬 피해",
    NST_SPLASH_DAMAGE_REDUCE_RATE: "광역 피해 감소",
    NST_UNIT_TYPE_COUNTER_DAMAGE_RATE: "카운터 피해",
};
const statOrder = [
    "NST_HP",
    "NST_ATK",
    "NST_DEF",
    "NST_SKILL_COOL_TIME_REDUCE_RATE",
];
function readLocalJson<T>(fileName: string) {
    const filePaths = [
        path.join(process.cwd(), "json", "operator", fileName),
        path.join(process.cwd(), "json", "KR", "operator", fileName),
        path.join(process.cwd(), "json", fileName),
        path.join(process.cwd(), "json", "KR", fileName),
    ];
    const filePath = filePaths.find((candidatePath) => fs.existsSync(candidatePath));
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
function formatFallbackName(unitStrId: string) {
    return unitStrId.replace(/^OPR_/, "").replace(/_/g, " ");
}
type OperatorImageFolder = "operator_face" | "operator_map_face" | "operator_icon" | "operator_skill";
const legacyImageFolderMap: Record<OperatorImageFolder, "images" | "skills"> = {
    operator_face: "images",
    operator_map_face: "images",
    operator_icon: "images",
    operator_skill: "skills",
};
function getImagePath(folderName: OperatorImageFolder, fileBaseName?: string) {
    if (!fileBaseName) {
        return "";
    }
    const fileName = fileBaseName.endsWith(".png")
        ? fileBaseName
        : `${fileBaseName}.png`;
    const filePaths = [
        {
            publicPath: deploymentUrl(`/operator/${folderName}/${fileName}`),
            localPath: path.join(process.cwd(), "public", "operator", folderName, fileName),
        },
        {
            publicPath: deploymentUrl(`/operator/${legacyImageFolderMap[folderName]}/${fileName}`),
            localPath: path.join(process.cwd(), "public", "operator", legacyImageFolderMap[folderName], fileName),
        },
    ];
    const matchedFilePath = filePaths.find(({ localPath }) => fs.existsSync(localPath));
    return matchedFilePath?.publicPath ?? "";
}
function getNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function getLevelValue(baseValue: number, perLevelValue: number | null | undefined, level: number) {
    return baseValue + (perLevelValue ?? 0) * (level - 1);
}
function formatNumber(value: number) {
    return value.toLocaleString("ko-KR", {
        maximumFractionDigits: 2,
    });
}
function formatSkillAmount(rawValue: number, statType: string, amountType: "value" | "factor") {
    const absoluteValue = Math.abs(rawValue);
    if (amountType === "value" &&
        (statType === "NST_HIT" ||
            statType === "NST_EVADE" ||
            statType === "NST_ATTACK_COUNT_REDUCE")) {
        return formatNumber(absoluteValue / 10000);
    }
    return formatNumber(absoluteValue / 100);
}
function getSkillStatLabel(statType: string) {
    return skillStatLabels[statType] ?? statType;
}
function getBuffStatEntries(buff: BuffRow, level: number) {
    const entries: SkillStatEntry[] = [];
    for (let index = 1; index <= 3; index += 1) {
        const statType = buff[`m_StatType${index}`];
        if (typeof statType !== "string" || statType === "NST_END") {
            continue;
        }
        const valueBase = getNumber(buff[`m_StatValue${index}`]);
        const factorBase = getNumber(buff[`m_StatFactor${index}`]);
        const addPerLevel = getNumber(buff[`m_StatAddPerLevel${index}`]);
        entries.push({
            index,
            statType,
            value: valueBase === null
                ? undefined
                : getLevelValue(valueBase, addPerLevel, level),
            factor: factorBase === null
                ? undefined
                : getLevelValue(factorBase, addPerLevel, level),
        });
    }
    return entries;
}
function getUniqueBuffRows(buffIds: Array<string | undefined>, context: SkillValueContext) {
    const seenBuffIds = new Set<string>();
    return buffIds
        .filter((buffId): buffId is string => Boolean(buffId))
        .filter((buffId) => {
        if (seenBuffIds.has(buffId)) {
            return false;
        }
        seenBuffIds.add(buffId);
        return true;
    })
        .map((buffId) => context.buffById.get(buffId))
        .filter((buff): buff is BuffRow => Boolean(buff));
}
function getSkillBuffRows(skill: OperatorSkillRow, context: SkillValueContext) {
    if (skill.m_OperSkillType === "m_Tactical") {
        const tacticalCommand = context.tacticalCommandById.get(skill.m_OperSkillTarget ?? "");
        return getUniqueBuffRows([
            ...(tacticalCommand?.m_lstBuffStrID_MyTeam ?? []),
            ...(tacticalCommand?.m_lstBuffStrID_Enemy ?? []),
        ], context);
    }
    const battleCondition = context.battleConditionById.get(skill.m_OperSkillTarget ?? "");
    return getUniqueBuffRows([
        ...(battleCondition?.m_listAllyBuffStrID ?? []),
        ...(battleCondition?.m_listEnemyBuffStrID ?? []),
        battleCondition?.m_AllyBuffStrID1,
        battleCondition?.m_AllyBuffStrID2,
        battleCondition?.m_EnemyBuffStrID1,
        battleCondition?.m_EnemyBuffStrID2,
    ], context);
}
function fillStatReplacement(replacements: Record<string, string>, entry: SkillStatEntry, slotIndex: number) {
    if (slotIndex < 1 || slotIndex > 3) {
        return;
    }
    const statKey = `stat${slotIndex}`;
    const valueKey = `value${slotIndex}`;
    const factorKey = `factor${slotIndex}`;
    replacements[statKey] ??= getSkillStatLabel(entry.statType);
    if (typeof entry.value === "number") {
        replacements[valueKey] ??= formatSkillAmount(entry.value, entry.statType, "value");
    }
    if (typeof entry.factor === "number") {
        replacements[factorKey] ??= formatSkillAmount(entry.factor, entry.statType, "factor");
    }
}
function createSkillValueReplacements(skill: OperatorSkillRow, context: SkillValueContext, level: number) {
    const replacements: Record<string, string> = {};
    const tacticalCommand = context.tacticalCommandById.get(skill.m_OperSkillTarget ?? "");
    const buffRows = getSkillBuffRows(skill, context);
    const firstBuffTime = buffRows
        .map((buff) => {
        const lifeTime = getNumber(buff.m_fLifeTime);
        return lifeTime === null
            ? null
            : getLevelValue(lifeTime, getNumber(buff.m_fLifeTimePerLevel), level);
    })
        .find((lifeTime): lifeTime is number => lifeTime !== null);
    const commandTime = getNumber(tacticalCommand?.m_fActiveTime);
    if (typeof firstBuffTime === "number") {
        replacements.time = formatNumber(firstBuffTime);
    }
    else if (commandTime !== null) {
        replacements.time = formatNumber(getLevelValue(commandTime, getNumber(tacticalCommand?.m_fActiveTimePerLevel), level));
    }
    const costPump = getNumber(tacticalCommand?.m_fCostPump);
    if (costPump !== null) {
        replacements.costpumpresult = formatNumber(costPump);
    }
    const barrierBuff = buffRows.find((buff) => getNumber(buff.m_fBarrierHP) !== null);
    if (barrierBuff) {
        const barrierHp = getNumber(barrierBuff.m_fBarrierHP);
        if (barrierHp !== null) {
            replacements.barrierhp = formatNumber(Math.abs(getLevelValue(barrierHp, getNumber(barrierBuff.m_fBarrierHPPerLevel), level)) * 100);
        }
    }
    const statEntries = buffRows.flatMap((buff) => getBuffStatEntries(buff, level));
    for (const entry of statEntries) {
        fillStatReplacement(replacements, entry, entry.index);
    }
    statEntries.forEach((entry, index) => {
        fillStatReplacement(replacements, entry, index + 1);
    });
    return replacements;
}
function cleanGameText(text: string, replacements: Record<string, string>) {
    return text
        .replace(/<color=[^>]+>/g, "")
        .replace(/<\/color>/g, "")
        .replace(/\{([^}]+)\}/g, (_, key: string) => {
        const value = replacements[key];
        if (!value) {
            return "-";
        }
        return key.startsWith("stat") ? value : `[[skill-value:${value}]]`;
    })
        .trim();
}
function createSkill(skill: OperatorSkillRow | undefined, skillTextMap: Map<string, string>, context: SkillValueContext): OperatorSkill | null {
    if (!skill) {
        return null;
    }
    const maxLevel = skill.m_MaxSkillLevel ?? 1;
    const tacticalCommand = context.tacticalCommandById.get(skill.m_OperSkillTarget ?? "");
    const descriptionsByLevel = Array.from({ length: maxLevel }, (_, index) => {
        const level = index + 1;
        const replacements = createSkillValueReplacements(skill, context, level);
        return cleanGameText(getText(skillTextMap, skill.m_OperSkillDescStrID), replacements);
    });
    return {
        id: skill.m_OperSkillStrID,
        name: getText(skillTextMap, skill.m_OperSkillNameStrID) ||
            skill.m_OperSkillStrID,
        description: descriptionsByLevel[maxLevel - 1] ?? "",
        descriptionsByLevel,
        type: skillTypeMap[skill.m_OperSkillType ?? ""] ?? "스킬",
        iconPath: getImagePath("operator_skill", skill.m_OperSkillIcon),
        cooldown: getNumber(tacticalCommand?.m_fCoolTime),
        activationConditions: [
            tacticalCommand?.m_ComboValue1,
            tacticalCommand?.m_ComboValue2,
            tacticalCommand?.m_ComboValue3,
        ].filter((condition): condition is string => Boolean(condition)),
        maxLevel,
    };
}
function createStats(statRow: OperatorStatRow | undefined) {
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
function createDialogueLabelMap() {
    const menuTextMap = createTextMap(readLocalJson<TextTable>("052_LUA_SI_MENU_KOREA_l.json"));
    const voiceRows = readLocalJson<JsonTable<VoiceTemplateRow>>("147_LUA_COLLECTION_VOICE_TEMPLET_z.json")?.data ?? [];
    const labelMap = new Map<string, {
        label: string;
        isExtra: boolean;
    }>();
    for (const row of voiceRows) {
        if (!row.m_VoicePostID || !row.m_VoiceButtonName) {
            continue;
        }
        const label = menuTextMap.get(row.m_VoiceButtonName);
        const operatorLabel = row.m_VoicePostID === "LIFETIME_COMPLETE"
            ? "엑스트라"
            : label || row.m_VoicePostID.replace(/_/g, " ");
        labelMap.set(row.m_VoicePostID, {
            label: operatorLabel,
            isExtra: row.m_bVoiceCondLifetime === true,
        });
    }
    return labelMap;
}
function getDialogueInfo(soundId: string, unitStrId: string, labelMap: Map<string, {
    label: string;
    isExtra: boolean;
}>) {
    const soundPrefix = `AB_UI_UNIT_VOICE_${unitStrId}_`;
    const shortId = soundId.startsWith(soundPrefix)
        ? soundId.slice(soundPrefix.length)
        : soundId;
    return (labelMap.get(shortId) ?? {
        label: shortId.replace(/_/g, " "),
        isExtra: false,
    });
}
function createOperatorDialogues(unitStrId: string) {
    const captionTextMap = createTextMap(readLocalJson<TextTable>("016_LUA_SI_CAPTION_KOREA_i.json"));
    const dialogueLabelMap = createDialogueLabelMap();
    const bundlePrefix = `AB_UI_UNIT_VOICE_${unitStrId}`;
    if (captionTextMap.size === 0) {
        return [];
    }
    return Array.from(captionTextMap.entries())
        .filter(([key]) => key.startsWith(`${bundlePrefix}@`))
        .map(([key, text]) => {
        const [bundleId = "", soundId = key] = key.split("@");
        const labelInfo = getDialogueInfo(soundId, unitStrId, dialogueLabelMap);
        return {
            id: soundId,
            audioPath: createVoiceAudioPath("operator", bundleId, soundId),
            isExtra: labelInfo.isExtra,
            label: labelInfo.label,
            text,
        };
    });
}
function loadOperatorContext() {
    const operatorRows = readLocalJson<JsonTable<OperatorBaseRow>>("011_LUA_UNIT_TEMPLET_BASE_OPR_a.json")?.data ?? [];
    const skillRows = readLocalJson<JsonTable<OperatorSkillRow>>("010_LUA_OPERATOR_SKILL_TEMPLET_b.json")?.data ?? [];
    const passiveRows = readLocalJson<JsonTable<OperatorPassiveRow>>("001_LUA_OPERATOR_RANDOM_PASSIVE_TEMPLET_s.json")?.data ?? [];
    const statRows = readLocalJson<JsonTable<OperatorStatRow>>("007_LUA_UNIT_STAT_TEMPLET_OPR_a.json")?.data ?? [];
    const battleConditionRows = readLocalJson<JsonTable<BattleConditionRow>>("144_LUA_BATTLE_CONDITION_TEMPLET_z.json")?.data ?? [];
    const buffRows = readLocalJson<JsonTable<BuffRow>>("202_LUA_BUFF_TEMPLET0_l.json")?.data ??
        [];
    const tacticalCommandRows = readLocalJson<JsonTable<TacticalCommandRow>>("255_LUA_TACTICAL_COMMAND_TEMPLET_z.json")?.data ?? [];
    const unitTextMap = createTextMap(readLocalJson<TextTable>("096_LUA_SI_UNIT_OPR_KOREA_h.json"));
    const skillTextMap = createTextMap(readLocalJson<TextTable>("015_LUA_SI_OPR_SKILL_KOREA_g.json"));
    return {
        operatorRows,
        skillById: new Map<number, OperatorSkillRow>(skillRows.map((row) => [row.m_OperSkillID, row])),
        skillByStrId: new Map<string, OperatorSkillRow>(skillRows.map((row) => [row.m_OperSkillStrID, row])),
        passiveRows,
        statById: new Map<string, OperatorStatRow>(statRows.map((row) => [row.m_UnitStrID, row])),
        tacticalCommandById: new Map<string, TacticalCommandRow>(tacticalCommandRows.map((row) => [row.m_TCStrID, row])),
        battleConditionById: new Map<string, BattleConditionRow>(battleConditionRows.map((row) => [row.m_BCondStrID, row])),
        buffById: new Map<string, BuffRow>(buffRows.map((row) => [row.m_BuffStrID, row])),
        unitTextMap,
        skillTextMap,
    };
}
function createOperatorDetail(unitStrId: string, context = loadOperatorContext(), options: {
    includeDialogues?: boolean;
} = {}): OperatorDetail | null {
    const operator = context.operatorRows.find((row) => row.m_UnitStrID === unitStrId);
    if (!operator) {
        return null;
    }
    const gradeInfo = getGradeInfo(operator.m_NKM_UNIT_GRADE);
    const tacticalSkill = createSkill(context.skillByStrId.get(operator.m_SkillStrID1 ?? ""), context.skillTextMap, context);
    const passiveSkills = context.passiveRows
        .filter((row) => row.m_OprPassiveGroupID === operator.m_OprPassiveGroupID)
        .map((row) => createSkill(context.skillById.get(row.m_OperSkillID), context.skillTextMap, context))
        .filter((skill): skill is OperatorSkill => skill !== null);
    return {
        id: operator.m_UnitStrID,
        href: deploymentUrl(`/operators/${encodeURIComponent(operator.m_UnitStrID)}`),
        name: getText(context.unitTextMap, operator.m_Name) ||
            formatFallbackName(operator.m_UnitStrID),
        title: getText(context.unitTextMap, operator.m_Title) || "오퍼레이터",
        grade: gradeInfo.label,
        gradeColor: gradeInfo.color,
        imagePath: getImagePath("operator_face", operator.m_FaceCardName),
        skillName: tacticalSkill?.name ?? "",
        skillIconPath: tacticalSkill?.iconPath ?? "",
        passiveCount: passiveSkills.length,
        sortId: operator.m_UnitID,
        description: getText(context.unitTextMap, operator.m_UnitDesc),
        tacticalSkill,
        passiveSkills,
        stats: createStats(context.statById.get(operator.m_UnitStrID)),
        dialogues: options.includeDialogues
            ? createOperatorDialogues(operator.m_UnitStrID)
            : [],
    };
}
export function loadOperators() {
    const context = loadOperatorContext();
    return context.operatorRows
        .map((operator) => createOperatorDetail(operator.m_UnitStrID, context))
        .filter((operator): operator is OperatorDetail => operator !== null)
        .sort((a, b) => a.sortId - b.sortId)
        .map(({ id, href, name, title, grade, gradeColor, imagePath, skillName, skillIconPath, passiveCount, }) => ({
        id,
        href,
        name,
        title,
        grade,
        gradeColor,
        imagePath,
        skillName,
        skillIconPath,
        passiveCount,
    }));
}
export function getOperatorDetail(unitStrId: string, options: {
    includeDialogues?: boolean;
} = { includeDialogues: true }) {
    return createOperatorDetail(unitStrId, loadOperatorContext(), options);
}
