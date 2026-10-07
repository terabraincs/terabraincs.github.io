import fs from "node:fs";
import path from "node:path";
type MatchTenTableRow = {
    m_Id?: number;
    m_BoardSizeX?: number;
    m_BoardSizeY?: number;
    m_PlayTimeSec?: number;
    m_PlayScoreMid?: number;
    m_PlayScoreHigh?: number;
    m_ScoreRewardGroupID?: number;
};
type MatchTenTable = {
    data?: MatchTenTableRow[];
};
type StringTable = {
    data?: unknown[];
};
type ScoreRewardRow = {
    m_ScoreRewardGroupID?: number;
    m_ScoreRewardID?: number;
    m_Score?: number;
};
type ScoreRewardTable = {
    data?: ScoreRewardRow[];
};
export type MatchTenReward = {
    id: number;
    score: number;
};
export type MatchTenConfig = {
    columns: number;
    rows: number;
    durationSeconds: number;
    midScore: number;
    highScore: number;
    rewards: MatchTenReward[];
    ruleTitle: string;
    ruleText: string;
};
function readJson<T>(fileName: string) {
    const filePath = path.join(process.cwd(), "json", "minigames", "match-ten", fileName);
    if (!fs.existsSync(filePath)) {
        throw new Error(`Match Ten client table is missing: ${filePath}`);
    }
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}
function createStringMap(table: StringTable) {
    const strings = new Map<string, string>();
    for (const row of table.data ?? []) {
        if (Array.isArray(row) &&
            typeof row[0] === "string" &&
            typeof row[1] === "string") {
            strings.set(row[0], row[1]);
        }
    }
    return strings;
}
function requiredNumber(value: number | undefined, field: string) {
    if (!Number.isFinite(value)) {
        throw new Error(`Match Ten client field is missing: ${field}`);
    }
    return value as number;
}
function requiredString(value: string | undefined, field: string) {
    if (!value)
        throw new Error(`Match Ten client string is missing: ${field}`);
    return value;
}
function normalizeUnityRichText(value: string) {
    return value
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
export function getMatchTenConfig(): MatchTenConfig {
    const table = readJson<MatchTenTable>("039_LUA_MATCH_TEN_TEMPLET_h.json");
    const strings = createStringMap(readJson<StringTable>("074_LUA_SI_MATCH_TEN_TEMPLET_KOREA_x.json"));
    const rewardTable = readJson<ScoreRewardTable>("001_LUA_SCORE_REWARD_TEMPLET_e.json");
    const row = table.data?.find((item) => item.m_Id === 1001);
    if (!row)
        throw new Error("Match Ten client template 1001 is missing.");
    const rewardGroupId = requiredNumber(row.m_ScoreRewardGroupID, "m_ScoreRewardGroupID");
    const rewards = (rewardTable.data ?? [])
        .filter((reward) => reward.m_ScoreRewardGroupID === rewardGroupId)
        .map((reward) => ({
        id: requiredNumber(reward.m_ScoreRewardID, "m_ScoreRewardID"),
        score: requiredNumber(reward.m_Score, "m_Score"),
    }));
    if (rewards.length === 0) {
        throw new Error(`Match Ten reward group ${rewardGroupId} is empty.`);
    }
    return {
        columns: requiredNumber(row.m_BoardSizeX, "m_BoardSizeX"),
        rows: requiredNumber(row.m_BoardSizeY, "m_BoardSizeY"),
        durationSeconds: requiredNumber(row.m_PlayTimeSec, "m_PlayTimeSec"),
        midScore: requiredNumber(row.m_PlayScoreMid, "m_PlayScoreMid"),
        highScore: requiredNumber(row.m_PlayScoreHigh, "m_PlayScoreHigh"),
        rewards,
        ruleTitle: requiredString(strings.get("SI_PF_MATCH_TEN_BANNER_TITLE_DUMMY"), "SI_PF_MATCH_TEN_BANNER_TITLE_DUMMY"),
        ruleText: normalizeUnityRichText(requiredString(strings.get("SI_PF_MATCH_TEN_BANNER_DESC_DUMMY"), "SI_PF_MATCH_TEN_BANNER_DESC_DUMMY")),
    };
}
