import fs from "node:fs";
import path from "node:path";
type JsonRecord = Record<string, unknown>;
type JsonTable = {
    data?: unknown[];
};
export type CollectionAcquisitionStatus = "past" | "inactive";
export type CollectionAcquisitionEntry = {
    source: string;
    detail: string;
    status?: CollectionAcquisitionStatus;
};
const jsonDirectory = path.join(process.cwd(), "json");
const collectionDirectory = path.join(jsonDirectory, "collection");
const acquisitionDirectory = path.join(collectionDirectory, "acquisition");
const titleDirectory = path.join(collectionDirectory, "title");
let cachedAcquisitionMap: Map<number, CollectionAcquisitionEntry[]> | null = null;
function readTable(filePath: string) {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8")) as JsonTable;
    }
    catch {
        return null;
    }
}
function readRows(filePath: string) {
    return (readTable(filePath)?.data ?? []).filter((row): row is JsonRecord => typeof row === "object" && row !== null && !Array.isArray(row));
}
function toString(value: unknown) {
    return typeof value === "string" ? value : "";
}
function toNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function createTextMap(filePaths: string[]) {
    const textMap = new Map<string, string>();
    for (const filePath of filePaths) {
        for (const row of readTable(filePath)?.data ?? []) {
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
function resolveText(value: unknown, textMap: Map<string, string>) {
    const stringValue = toString(value);
    if (!stringValue) {
        return "";
    }
    const [templateKey, ...parameters] = stringValue.split("@@");
    const template = textMap.get(templateKey);
    if (!template) {
        return "";
    }
    return stripUnityRichText(template.replace(/\{(\d+)\}/g, (_, index: string) => {
        const parameter = parameters[Number(index)] ?? "";
        return textMap.get(parameter) ?? parameter;
    }));
}
function isPastDate(value: unknown) {
    const dateString = toString(value);
    if (!dateString) {
        return false;
    }
    const timestamp = Date.parse(dateString.replace(" ", "T"));
    return Number.isFinite(timestamp) && timestamp < Date.now();
}
function getRewardItemIds(row: JsonRecord, typePrefix: string, idPrefix: string, slotCount: number) {
    const itemIds: number[] = [];
    for (let slot = 1; slot <= slotCount; slot += 1) {
        if (row[`${typePrefix}${slot}`] !== "RT_MISC") {
            continue;
        }
        const itemId = toNumber(row[`${idPrefix}${slot}`]);
        if (itemId !== null) {
            itemIds.push(itemId);
        }
    }
    return itemIds;
}
function pushToGroupMap(groupMap: Map<number, JsonRecord[]>, groupId: number | null, row: JsonRecord) {
    if (groupId === null) {
        return;
    }
    const rows = groupMap.get(groupId) ?? [];
    rows.push(row);
    groupMap.set(groupId, rows);
}
function formatRankRange(minRank: number | null, maxRank: number | null) {
    if (minRank === null || maxRank === null) {
        return "최종 순위 보상";
    }
    if (minRank === maxRank) {
        return `최종 ${minRank.toLocaleString("ko-KR")}위 보상`;
    }
    return `최종 ${minRank.toLocaleString("ko-KR")}~${maxRank.toLocaleString("ko-KR")}위 보상`;
}
export function getCollectionAcquisitionMap() {
    if (cachedAcquisitionMap) {
        return cachedAcquisitionMap;
    }
    const itemRows = readRows(path.join(collectionDirectory, "012_LUA_ITEM_MISC_TEMPLET_h.json"));
    const targetItemIds = new Set(itemRows.flatMap((row) => {
        const itemId = toNumber(row.m_ItemMiscID);
        const itemType = toString(row.m_ItemMiscType);
        return itemId !== null &&
            ["IMT_EMBLEM", "IMT_EMBLEM_RANK", "IMT_SELFIE_FRAME"].includes(itemType)
            ? [itemId]
            : [];
    }));
    const textMap = createTextMap([
        path.join(collectionDirectory, "053_LUA_SI_ITEM_TEMPLET_KOREA_a.json"),
        path.join(collectionDirectory, "081_LUA_SI_LOBBY_KOREA_k.json"),
        path.join(jsonDirectory, "story", "021_LUA_SI_EPISODE_TEMPLET_KOREA_z.json"),
        path.join(titleDirectory, "047_LUA_SI_MISSION_TEMPLET_KOREA_z.json"),
        path.join(acquisitionDirectory, "012_LUA_SI_FIERCE_TEMPLET_KOREA_a.json"),
        path.join(acquisitionDirectory, "014_LUA_SI_ATTENDANCE_TEMPLET_KOREA_w.json"),
        path.join(acquisitionDirectory, "051_LUA_SI_PVP_RANK_TIER_KOREA_b.json"),
        path.join(acquisitionDirectory, "060_LUA_SI_EVENT_PASS_KOREA_f.json"),
        path.join(acquisitionDirectory, "078_LUA_SI_PVP_RANK_SEASON_KOREA_z.json"),
    ]);
    const acquisitionMap = new Map<number, CollectionAcquisitionEntry[]>();
    const acquisitionKeys = new Map<number, Set<string>>();
    const addEntry = (itemId: number, entry: CollectionAcquisitionEntry) => {
        if (!targetItemIds.has(itemId) || !entry.detail) {
            return;
        }
        const key = `${entry.source}|${entry.detail}|${entry.status ?? ""}`;
        const keys = acquisitionKeys.get(itemId) ?? new Set<string>();
        if (keys.has(key)) {
            return;
        }
        keys.add(key);
        acquisitionKeys.set(itemId, keys);
        acquisitionMap.set(itemId, [...(acquisitionMap.get(itemId) ?? []), entry]);
    };
    const itemNameById = new Map<number, string>();
    const itemNameByStringId = new Map<string, string>();
    for (const row of itemRows) {
        const itemId = toNumber(row.m_ItemMiscID);
        const itemStringId = toString(row.m_ItemMiscStrID);
        const itemName = resolveText(row.m_ItemMiscName, textMap);
        if (itemId !== null && itemName) {
            itemNameById.set(itemId, itemName);
        }
        if (itemStringId && itemName) {
            itemNameByStringId.set(itemStringId, itemName);
        }
    }
    const missionRows = readRows(path.join(titleDirectory, "045_LUA_MISSION_TEMPLET_j.json"));
    for (const row of missionRows) {
        const title = resolveText(row.m_MissionTitle, textMap);
        const description = resolveText(row.m_MissionDesc, textMap);
        const detail = title && description && title !== description
            ? `${title} - ${description}`
            : description || title || "미션 달성 보상";
        for (const itemId of getRewardItemIds(row, "m_RewardType_", "m_RewardID_", 3)) {
            addEntry(itemId, { source: "미션", detail });
        }
    }
    const eventPassTemplates = readRows(path.join(acquisitionDirectory, "241_LUA_EVENT_PASS_TEMPLET_g.json"));
    const eventPassTemplateMap = new Map<number, JsonRecord[]>();
    for (const row of eventPassTemplates) {
        pushToGroupMap(eventPassTemplateMap, toNumber(row.PassRewardGroupID), row);
    }
    for (const row of readRows(path.join(acquisitionDirectory, "032_LUA_EVENT_PASS_REWARD_TEMPLET_y.json"))) {
        const rewardGroupId = toNumber(row.PassRewardGroupID);
        const templates = (rewardGroupId === null
            ? undefined
            : eventPassTemplateMap.get(rewardGroupId)) ?? [null];
        const passLevel = toNumber(row.PassLevel);
        for (const template of templates) {
            const title = template
                ? resolveText(template.EventPassTitleStrID, textMap)
                : "";
            const status = template && isPastDate(template.EventPassEndDate)
                ? ("past" as const)
                : undefined;
            for (const [typeField, idField, rewardTrack] of [
                ["NormalRewardItemType", "NormalRewardItemID", "무료 보상"],
                ["CoreRewardItemType", "CoreRewardItemID", "유료 보상"],
            ] as const) {
                if (row[typeField] !== "RT_MISC") {
                    continue;
                }
                const itemId = toNumber(row[idField]);
                if (itemId === null) {
                    continue;
                }
                addEntry(itemId, {
                    source: "이벤트 패스",
                    detail: `${title || "이벤트 패스"}${passLevel === null ? "" : ` ${passLevel}레벨`} ${rewardTrack}`,
                    status,
                });
            }
        }
    }
    for (const fileName of [
        "094_LUA_SHOP_TEMPLET_13_j.json",
        "233_LUA_SHOP_TEMPLET_12_j.json",
    ]) {
        for (const row of readRows(path.join(jsonDirectory, fileName))) {
            if (row.m_ItemType !== "RT_MISC") {
                continue;
            }
            const itemId = toNumber(row.m_ItemID);
            if (itemId === null) {
                continue;
            }
            const price = toNumber(row.m_Price);
            const priceItemId = toNumber(row.m_PriceItemID);
            const priceItemName = priceItemId === null ? "" : itemNameById.get(priceItemId) ?? "";
            const detail = price !== null && price > 0
                ? `${price.toLocaleString("ko-KR")} ${priceItemName || "재화"}로 구매`
                : "상점 상품";
            const status = row.m_bEnabled === false || row.m_bVisible === false
                ? ("inactive" as const)
                : undefined;
            addEntry(itemId, {
                source: row.m_TabID === "TAB_SEASON_GAUNTLET" ? "건틀렛 상점" : "상점",
                detail,
                status,
            });
        }
    }
    for (const row of readRows(path.join(jsonDirectory, "250_LUA_RANDOM_ITEM_BOX_j.json"))) {
        if (row.m_RewardType !== "RT_MISC") {
            continue;
        }
        const itemId = toNumber(row.m_RewardID);
        if (itemId === null) {
            continue;
        }
        const rewardGroupStringId = toString(row.m_RewardGroupStrID);
        const boxName = itemNameByStringId.get(rewardGroupStringId) ??
            resolveText(`SI_ITEM_MISC_NAME_${rewardGroupStringId}`, textMap);
        addEntry(itemId, {
            source: "상자·패키지",
            detail: boxName ? `${boxName} 구성품` : "상자·패키지 구성품",
        });
    }
    const attendanceTabMap = new Map<number, JsonRecord[]>();
    for (const row of readRows(path.join(acquisitionDirectory, "015_LUA_ATTENDANCE_TAB_TEMPLET_b.json"))) {
        pushToGroupMap(attendanceTabMap, toNumber(row.m_RewardGroup), row);
    }
    for (const row of readRows(path.join(jsonDirectory, "027_LUA_ATTENDANCE_REWARD_TEMPLET_y.json"))) {
        if (row.m_RewardType !== "RT_MISC") {
            continue;
        }
        const itemId = toNumber(row.m_RewardID);
        const rewardGroupId = toNumber(row.m_RewardGroup);
        if (itemId === null) {
            continue;
        }
        const tabs = (rewardGroupId === null
            ? undefined
            : attendanceTabMap.get(rewardGroupId)) ?? [null];
        for (const tab of tabs) {
            const title = (tab && resolveText(tab.m_TabNameMain, textMap)) ||
                resolveText(row.m_MailTitle, textMap) ||
                "출석 이벤트";
            const loginDate = toNumber(row.m_LoginDate);
            const status = tab && toString(tab.m_OpenTag).includes("OLD")
                ? ("past" as const)
                : undefined;
            addEntry(itemId, {
                source: "출석",
                detail: `${title}${loginDate === null ? "" : ` ${loginDate}일차`} 보상`,
                status,
            });
        }
    }
    const bingoTemplateMap = new Map<number, JsonRecord[]>();
    for (const row of readRows(path.join(acquisitionDirectory, "237_LUA_EVENT_BINGO_TEMPLET_f.json"))) {
        pushToGroupMap(bingoTemplateMap, toNumber(row.m_BingoCompletRewardGroupID), row);
    }
    for (const row of readRows(path.join(acquisitionDirectory, "089_LUA_EVENT_BINGO_REWARD_TEMPLET_x.json"))) {
        const itemIds = getRewardItemIds(row, "m_BingoCompletRewardType_", "m_BingoCompletRewardID_", 3);
        const groupId = toNumber(row.m_BingoCompletRewardGroupID);
        const value = toNumber(row.m_BingoCompletTypeValue);
        const isLineReward = row.m_BingoCompletType === "LINE_SINGLE";
        const templates = (groupId === null ? undefined : bingoTemplateMap.get(groupId)) ?? [];
        const status = templates.some((template) => Array.isArray(template.listContentsTagAllow)
            ? template.listContentsTagAllow.includes("TAG_EVENT_NOT_USED")
            : false)
            ? ("inactive" as const)
            : undefined;
        for (const itemId of itemIds) {
            addEntry(itemId, {
                source: "빙고",
                detail: isLineReward && value !== null
                    ? `${value}줄 완성 보상`
                    : "빙고 완성 보상",
                status,
            });
        }
    }
    type PvpSeasonInfo = {
        kind: "랭크전" | "전략전";
        rankGroup: number;
        isPast: boolean;
    };
    const pvpSeasons: PvpSeasonInfo[] = [];
    for (const [fileName, kind] of [
        ["072_LUA_PVP_RANK_SEASON_j.json", "랭크전"],
        ["256_LUA_PVP_ASYNC_SEASON_i.json", "전략전"],
    ] as const) {
        for (const row of readRows(path.join(acquisitionDirectory, fileName))) {
            const rankGroup = toNumber(row.m_RankGroup);
            if (rankGroup !== null) {
                pvpSeasons.push({
                    kind,
                    rankGroup,
                    isPast: isPastDate(row.m_SeasonDateEnd),
                });
            }
        }
    }
    const rankRewardRows = readRows(path.join(acquisitionDirectory, "096_LUA_PVP_RANK_q.json"));
    const rankRewardsByItem = new Map<number, JsonRecord[]>();
    for (const row of rankRewardRows) {
        for (const itemId of getRewardItemIds(row, "m_RewardTypeSeason_", "m_RewardIDSeason_", 3)) {
            const rows = rankRewardsByItem.get(itemId) ?? [];
            rows.push(row);
            rankRewardsByItem.set(itemId, rows);
        }
    }
    for (const [itemId, rows] of rankRewardsByItem) {
        for (const kind of ["랭크전", "전략전"] as const) {
            const kindRows = rows.filter((row) => {
                const rankGroup = toNumber(row.m_RankGroup);
                return pvpSeasons.some((season) => season.kind === kind && season.rankGroup === rankGroup);
            });
            if (kindRows.length === 0) {
                continue;
            }
            const tierNames = [
                ...new Set(kindRows
                    .map((row) => resolveText(row.m_LeagueName, textMap))
                    .filter(Boolean)),
            ];
            const detail = tierNames.length === 1
                ? `${tierNames[0]} 시즌 종료 보상`
                : "시즌 종료 티어 보상";
            const relatedSeasons = pvpSeasons.filter((season) => season.kind === kind &&
                kindRows.some((row) => toNumber(row.m_RankGroup) === season.rankGroup));
            addEntry(itemId, {
                source: kind,
                detail,
                status: relatedSeasons.length > 0 &&
                    relatedSeasons.every((season) => season.isPast)
                    ? "past"
                    : undefined,
            });
        }
    }
    const leagueSeasonRows = readRows(path.join(acquisitionDirectory, "234_LUA_PVP_LEAGUE_SEASON_h.json"));
    const leagueRankGroups = new Map<number, boolean>();
    const leagueRewardGroups = new Map<number, boolean>();
    for (const row of leagueSeasonRows) {
        const isPast = isPastDate(row.m_SeasonDateEnd);
        const rankGroup = toNumber(row.m_RankGroup);
        const rewardGroup = toNumber(row.m_RankSeasonRewardGroup);
        if (rankGroup !== null) {
            leagueRankGroups.set(rankGroup, (leagueRankGroups.get(rankGroup) ?? true) && isPast);
        }
        if (rewardGroup !== null) {
            leagueRewardGroups.set(rewardGroup, (leagueRewardGroups.get(rewardGroup) ?? true) && isPast);
        }
    }
    const leagueRewardsByItem = new Map<number, JsonRecord[]>();
    for (const row of readRows(path.join(acquisitionDirectory, "163_LUA_PVP_LEAGUE_o.json"))) {
        for (const itemId of getRewardItemIds(row, "m_RewardTypeSeason_", "m_RewardIDSeason_", 3)) {
            const rows = leagueRewardsByItem.get(itemId) ?? [];
            rows.push(row);
            leagueRewardsByItem.set(itemId, rows);
        }
    }
    for (const [itemId, rows] of leagueRewardsByItem) {
        const tierNames = [
            ...new Set(rows
                .map((row) => resolveText(row.m_LeagueName, textMap))
                .filter(Boolean)),
        ];
        const rankGroups = rows
            .map((row) => toNumber(row.m_RankGroup))
            .filter((value): value is number => value !== null);
        addEntry(itemId, {
            source: "리그전",
            detail: tierNames.length === 1
                ? `${tierNames[0]} 시즌 종료 보상`
                : "시즌 종료 티어 보상",
            status: rankGroups.length > 0 &&
                rankGroups.every((group) => leagueRankGroups.get(group) === true)
                ? "past"
                : undefined,
        });
    }
    const finalRankRowsByItem = new Map<number, JsonRecord[]>();
    for (const row of readRows(path.join(acquisitionDirectory, "240_LUA_PVP_LEAGUE_SEASON_REWARD_z.json"))) {
        for (const itemId of getRewardItemIds(row, "m_RewardType_", "m_RewardID_", 2)) {
            const rows = finalRankRowsByItem.get(itemId) ?? [];
            rows.push(row);
            finalRankRowsByItem.set(itemId, rows);
        }
    }
    for (const [itemId, rows] of finalRankRowsByItem) {
        const minRank = Math.min(...rows
            .map((row) => toNumber(row.MinRank))
            .filter((value): value is number => value !== null));
        const maxRank = Math.max(...rows
            .map((row) => toNumber(row.MaxRank))
            .filter((value): value is number => value !== null));
        const rewardGroups = rows
            .map((row) => toNumber(row.SeasonRewardGroupId))
            .filter((value): value is number => value !== null);
        addEntry(itemId, {
            source: "리그전",
            detail: formatRankRange(Number.isFinite(minRank) ? minRank : null, Number.isFinite(maxRank) ? maxRank : null),
            status: rewardGroups.length > 0 &&
                rewardGroups.every((group) => leagueRewardGroups.get(group) === true)
                ? "past"
                : undefined,
        });
    }
    const eventMatchSeasonsByRewardGroup = new Map<number, JsonRecord[]>();
    for (const row of readRows(path.join(acquisitionDirectory, "259_LUA_PVP_EVENTMATCH_SEASON_a.json"))) {
        if (!Array.isArray(row.RewardGroupID)) {
            continue;
        }
        for (const value of row.RewardGroupID) {
            pushToGroupMap(eventMatchSeasonsByRewardGroup, toNumber(value), row);
        }
    }
    for (const row of readRows(path.join(acquisitionDirectory, "059_LUA_PVP_EVENTMATCH_REWARD_a.json"))) {
        const rewardGroupId = toNumber(row.RewardGroupID);
        const seasons = (rewardGroupId === null
            ? undefined
            : eventMatchSeasonsByRewardGroup.get(rewardGroupId)) ?? [null];
        const description = resolveText(row.EventGauntletDescStrID, textMap);
        const playTimes = toNumber(row.PlayTimes);
        for (const itemId of getRewardItemIds(row, "EventRewardType_", "EventRewardID_", 5)) {
            for (const season of seasons) {
                const seasonName = season
                    ? resolveText(season.SeasonName, textMap)
                    : "";
                addEntry(itemId, {
                    source: "이벤트 매치",
                    detail: description ||
                        `${seasonName || "이벤트 매치"}${playTimes === null ? "" : ` ${playTimes}회 플레이`} 보상`,
                });
            }
        }
    }
    const fierceRankRowsByGroup = new Map<number, JsonRecord[]>();
    for (const row of readRows(path.join(acquisitionDirectory, "115_LUA_FIERCE_RANK_REWARD_g.json"))) {
        pushToGroupMap(fierceRankRowsByGroup, toNumber(row.FierceRankRewardGroupID), row);
    }
    const fiercePointRowsByGroup = new Map<number, JsonRecord[]>();
    for (const row of readRows(path.join(acquisitionDirectory, "135_LUA_FIERCE_POINT_REWARD_f.json"))) {
        pushToGroupMap(fiercePointRowsByGroup, toNumber(row.FiercePointRewardGroupID), row);
    }
    const referencedFierceRankGroups = new Set<number>();
    const referencedFiercePointGroups = new Set<number>();
    for (const template of readRows(path.join(acquisitionDirectory, "104_LUA_FIERCE_TEMPLET_k.json"))) {
        const rankGroupId = toNumber(template.RankRewardGroupID);
        const pointGroupId = toNumber(template.PointRewardGroupID);
        if (rankGroupId !== null) {
            referencedFierceRankGroups.add(rankGroupId);
        }
        if (pointGroupId !== null) {
            referencedFiercePointGroups.add(pointGroupId);
        }
        const rankRows = (rankGroupId === null
            ? undefined
            : fierceRankRowsByGroup.get(rankGroupId)) ?? [];
        const pointRows = (pointGroupId === null
            ? undefined
            : fiercePointRowsByGroup.get(pointGroupId)) ?? [];
        const rankRowsByItem = new Map<number, JsonRecord[]>();
        for (const row of rankRows) {
            for (const itemId of getRewardItemIds(row, "RankRewardType_", "RankRewardID_", 5)) {
                const rows = rankRowsByItem.get(itemId) ?? [];
                rows.push(row);
                rankRowsByItem.set(itemId, rows);
            }
        }
        for (const [itemId, rows] of rankRowsByItem) {
            const descriptions = [
                ...new Set(rows
                    .map((row) => resolveText(row.RankDescStrID, textMap))
                    .filter(Boolean)),
            ];
            addEntry(itemId, {
                source: "격전지원",
                detail: descriptions.length === 1
                    ? `${descriptions[0]} 보상`
                    : "시즌 순위 보상",
            });
        }
        for (const row of pointRows) {
            const description = resolveText(row.PointDescStrID, textMap);
            const point = toNumber(row.Point);
            for (const itemId of getRewardItemIds(row, "PointRewardType_", "PointRewardID_", 3)) {
                addEntry(itemId, {
                    source: "격전지원",
                    detail: description ||
                        (point === null
                            ? "누적 점수 보상"
                            : `${point.toLocaleString("ko-KR")}점 달성 보상`),
                });
            }
        }
    }
    for (const [groupId, rows] of fierceRankRowsByGroup) {
        if (referencedFierceRankGroups.has(groupId)) {
            continue;
        }
        for (const row of rows) {
            const description = resolveText(row.RankDescStrID, textMap);
            for (const itemId of getRewardItemIds(row, "RankRewardType_", "RankRewardID_", 5)) {
                addEntry(itemId, {
                    source: "격전지원",
                    detail: description ? `${description} 보상` : "시즌 순위 보상",
                    status: "past",
                });
            }
        }
    }
    for (const [groupId, rows] of fiercePointRowsByGroup) {
        if (referencedFiercePointGroups.has(groupId)) {
            continue;
        }
        for (const row of rows) {
            const description = resolveText(row.PointDescStrID, textMap);
            const point = toNumber(row.Point);
            for (const itemId of getRewardItemIds(row, "PointRewardType_", "PointRewardID_", 3)) {
                addEntry(itemId, {
                    source: "격전지원",
                    detail: description ||
                        (point === null
                            ? "누적 점수 보상"
                            : `${point.toLocaleString("ko-KR")}점 달성 보상`),
                    status: "past",
                });
            }
        }
    }
    for (const entries of acquisitionMap.values()) {
        entries.sort((first, second) => {
            const sourceOrder = [
                "미션",
                "이벤트 패스",
                "출석",
                "빙고",
                "랭크전",
                "전략전",
                "리그전",
                "이벤트 매치",
                "격전지원",
                "건틀렛 상점",
                "상점",
                "상자·패키지",
            ];
            return (sourceOrder.indexOf(first.source) -
                sourceOrder.indexOf(second.source) ||
                first.detail.localeCompare(second.detail, "ko-KR"));
        });
    }
    cachedAcquisitionMap = acquisitionMap;
    return acquisitionMap;
}
