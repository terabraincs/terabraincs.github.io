import type { CafeDailyOrder, CafeInventory, CafeRecipe } from "./cafeStregaClientEngine";
/**
 * Browser-only state for the offline Cafe Strega reconstruction.
 *
 * The original client receives the daily order and inventory from the game
 * server. This adapter intentionally keeps the user's replacement weekday
 * schedule and local inventory in a separate, versioned browser key.
 */
export const CAFE_STREGA_LOCAL_STATE_KEY = "counterside:minigames:cafe-strega:6002:state:v1";
export const CAFE_STREGA_LOCAL_EVENT_ID = 6002 as const;
export const CAFE_STREGA_LOCAL_STATE_VERSION = 1 as const;
export const CAFE_STREGA_INITIAL_INGREDIENT_COUNT = 30 as const;
const DAY_MS = 86400000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const FIRST_MONDAY_DAY_NUMBER = 4; // 1970-01-05 in shifted UTC days.
export type CafeStregaLocalCatalog = Readonly<{
    ingredientIds: readonly number[];
    recipes: readonly CafeRecipe[];
}>;
export type CafeStregaLocalState = Readonly<{
    version: typeof CAFE_STREGA_LOCAL_STATE_VERSION;
    eventId: typeof CAFE_STREGA_LOCAL_EVENT_ID;
    /** Calendar date in Korea Standard Time (UTC+09:00). */
    dayKey: string;
    /** Contains exactly the three ingredients and six manufactured drinks. */
    inventory: CafeInventory;
    /** The source data currently uses one delivery per day for every recipe. */
    remainingDeliveryCount: number;
}>;
export type CafeStregaScheduledOrder = CafeDailyOrder & Readonly<{
    dayKey: string;
    recipeIndex: number;
}>;
export type CafeStregaLocalStorage = Pick<Storage, "getItem" | "setItem">;
export type CafeStregaLocalLoadResult = Readonly<{
    state: CafeStregaLocalState;
    order: CafeStregaScheduledOrder;
    storageAvailable: boolean;
    needsPersistence: boolean;
    source: "stored" | "new" | "invalid" | "rollover" | "unavailable";
}>;
export type CafeStregaLocalSaveResult = Readonly<{
    state: CafeStregaLocalState;
    order: CafeStregaScheduledOrder;
    persisted: boolean;
}>;
export type CafeStregaDeliveryResult = Readonly<{
    state: CafeStregaLocalState;
    order: CafeStregaScheduledOrder;
    status: "delivered" | "finished" | "shortage";
    consumed: number;
}>;
type CafeClock = number | Date;
function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isItemId(value: unknown): value is number {
    return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function isCount(value: unknown): value is number {
    return (typeof value === "number" &&
        Number.isSafeInteger(value) &&
        value >= 0);
}
function epochMilliseconds(now: CafeClock = Date.now()): number {
    const value = typeof now === "number" ? now : now.getTime();
    if (!Number.isFinite(value))
        throw new RangeError("Cafe clock must be a valid date");
    return value;
}
function positiveModulo(value: number, divisor: number): number {
    return ((value % divisor) + divisor) % divisor;
}
function getCatalog(catalog: CafeStregaLocalCatalog) {
    if (!Array.isArray(catalog.ingredientIds) || !Array.isArray(catalog.recipes)) {
        throw new TypeError("Cafe local-state catalog is malformed");
    }
    if (catalog.recipes.length !== 6) {
        throw new RangeError("Cafe weekday schedule requires exactly six recipes");
    }
    const ingredientIds = [...catalog.ingredientIds];
    const drinkIds = catalog.recipes.map((recipe) => recipe.itemId);
    const allIds = [...ingredientIds, ...drinkIds];
    if (ingredientIds.length === 0 ||
        !allIds.every(isItemId) ||
        new Set(allIds).size !== allIds.length ||
        catalog.recipes.some((recipe) => !isCount(recipe.delivery.limitCount) || recipe.delivery.limitCount < 1 ||
            !isCount(recipe.delivery.count) || recipe.delivery.count < 1)) {
        throw new TypeError("Cafe local-state catalog IDs or delivery values are invalid");
    }
    return { ingredientIds, drinkIds, allIds };
}
function getKstCalendar(now: CafeClock = Date.now()) {
    const shifted = epochMilliseconds(now) + KST_OFFSET_MS;
    const date = new Date(shifted);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const weekday = date.getUTCDay();
    const dayNumber = Math.floor(shifted / DAY_MS);
    return {
        dayKey: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        weekday,
        dayNumber,
    };
}
function isDayKey(value: unknown): value is string {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(parsed.getTime()))
        return false;
    return (`${String(parsed.getUTCFullYear()).padStart(4, "0")}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-${String(parsed.getUTCDate()).padStart(2, "0")}` === value);
}
function cleanInventory(value: unknown, allIds: readonly number[]): Record<number, number> | null {
    if (!isObject(value))
        return null;
    const expectedKeys = allIds.map(String).sort();
    const actualKeys = Object.keys(value).sort();
    if (actualKeys.length !== expectedKeys.length ||
        actualKeys.some((key, index) => key !== expectedKeys[index])) {
        return null;
    }
    const entries: [
        number,
        number
    ][] = [];
    for (const itemId of allIds) {
        const count = value[String(itemId)];
        if (!isCount(count))
            return null;
        entries.push([itemId, count]);
    }
    return Object.fromEntries(entries);
}
function parseState(raw: string | null, catalog: CafeStregaLocalCatalog): CafeStregaLocalState | null {
    if (raw === null)
        return null;
    try {
        const value: unknown = JSON.parse(raw);
        if (!isObject(value))
            return null;
        const { allIds } = getCatalog(catalog);
        const inventory = cleanInventory(value.inventory, allIds);
        if (value.version !== CAFE_STREGA_LOCAL_STATE_VERSION ||
            value.eventId !== CAFE_STREGA_LOCAL_EVENT_ID ||
            !isDayKey(value.dayKey) ||
            !inventory ||
            !isCount(value.remainingDeliveryCount)) {
            return null;
        }
        const stateDay = new Date(`${value.dayKey}T00:00:00+09:00`);
        const dailyLimit = catalog.recipes[getCafeStregaScheduledRecipeIndex(stateDay)].delivery.limitCount;
        if (value.remainingDeliveryCount > dailyLimit)
            return null;
        return {
            version: CAFE_STREGA_LOCAL_STATE_VERSION,
            eventId: CAFE_STREGA_LOCAL_EVENT_ID,
            dayKey: value.dayKey,
            inventory,
            remainingDeliveryCount: value.remainingDeliveryCount,
        };
    }
    catch {
        return null;
    }
}
function resolveStorage(storage: CafeStregaLocalStorage | null | undefined): CafeStregaLocalStorage | null {
    if (storage !== undefined)
        return storage;
    try {
        return typeof window === "undefined" ? null : window.localStorage;
    }
    catch {
        // Browser privacy policy can throw while evaluating localStorage itself.
        return null;
    }
}
export function getCafeStregaKstDayKey(now: CafeClock = Date.now()): string {
    return getKstCalendar(now).dayKey;
}
/**
 * Monday through Saturday map to recipes 0 through 5. Sunday rotates through
 * all six recipes using a Monday-based week ordinal anchored at 1970-01-05.
 * The ordinal does not reset at a year boundary and is independent of locale.
 */
export function getCafeStregaScheduledRecipeIndex(now: CafeClock = Date.now()): number {
    const { weekday, dayNumber } = getKstCalendar(now);
    if (weekday !== 0)
        return weekday - 1;
    const weekOrdinal = Math.floor((dayNumber - FIRST_MONDAY_DAY_NUMBER) / 7);
    return positiveModulo(weekOrdinal, 6);
}
export function createCafeStregaLocalState(catalog: CafeStregaLocalCatalog, now: CafeClock = Date.now()): CafeStregaLocalState {
    const { ingredientIds, drinkIds } = getCatalog(catalog);
    const recipeIndex = getCafeStregaScheduledRecipeIndex(now);
    return {
        version: CAFE_STREGA_LOCAL_STATE_VERSION,
        eventId: CAFE_STREGA_LOCAL_EVENT_ID,
        dayKey: getCafeStregaKstDayKey(now),
        inventory: Object.fromEntries([
            ...ingredientIds.map((itemId) => [itemId, CAFE_STREGA_INITIAL_INGREDIENT_COUNT]),
            ...drinkIds.map((itemId) => [itemId, 0]),
        ]),
        remainingDeliveryCount: catalog.recipes[recipeIndex].delivery.limitCount,
    };
}
/** Preserve inventory across a KST date change and reset only daily delivery. */
export function rollCafeStregaLocalState(catalog: CafeStregaLocalCatalog, state: CafeStregaLocalState, now: CafeClock = Date.now()): CafeStregaLocalState {
    const currentDayKey = getCafeStregaKstDayKey(now);
    if (state.dayKey === currentDayKey)
        return state;
    const recipeIndex = getCafeStregaScheduledRecipeIndex(now);
    return {
        ...state,
        dayKey: currentDayKey,
        remainingDeliveryCount: catalog.recipes[recipeIndex].delivery.limitCount,
    };
}
export function getCafeStregaDailyOrder(catalog: CafeStregaLocalCatalog, state: CafeStregaLocalState, now: CafeClock = Date.now()): CafeStregaScheduledOrder {
    getCatalog(catalog);
    const current = rollCafeStregaLocalState(catalog, state, now);
    const recipeIndex = getCafeStregaScheduledRecipeIndex(now);
    return {
        dayKey: current.dayKey,
        recipeIndex,
        itemId: catalog.recipes[recipeIndex].itemId,
        remainingDeliveryCount: current.remainingDeliveryCount,
    };
}
/** Loading is read-only. `needsPersistence` tells the caller to save explicitly. */
export function loadCafeStregaLocalState(catalog: CafeStregaLocalCatalog, now: CafeClock = Date.now(), storage?: CafeStregaLocalStorage | null): CafeStregaLocalLoadResult {
    const initial = createCafeStregaLocalState(catalog, now);
    const target = resolveStorage(storage);
    if (!target) {
        return {
            state: initial,
            order: getCafeStregaDailyOrder(catalog, initial, now),
            storageAvailable: false,
            needsPersistence: false,
            source: "unavailable",
        };
    }
    let raw: string | null;
    try {
        raw = target.getItem(CAFE_STREGA_LOCAL_STATE_KEY);
    }
    catch {
        return {
            state: initial,
            order: getCafeStregaDailyOrder(catalog, initial, now),
            storageAvailable: false,
            needsPersistence: false,
            source: "unavailable",
        };
    }
    const stored = parseState(raw, catalog);
    if (!stored) {
        return {
            state: initial,
            order: getCafeStregaDailyOrder(catalog, initial, now),
            storageAvailable: true,
            needsPersistence: true,
            source: raw === null ? "new" : "invalid",
        };
    }
    const state = rollCafeStregaLocalState(catalog, stored, now);
    const rolledOver = state !== stored;
    return {
        state,
        order: getCafeStregaDailyOrder(catalog, state, now),
        storageAvailable: true,
        needsPersistence: rolledOver,
        source: rolledOver ? "rollover" : "stored",
    };
}
/**
 * Replace only the known ingredient/drink counts. Invalid or partial external
 * inventories are rejected without changing the current state.
 */
export function replaceCafeStregaLocalInventory(catalog: CafeStregaLocalCatalog, state: CafeStregaLocalState, inventory: CafeInventory, now: CafeClock = Date.now()): CafeStregaLocalState {
    const { allIds } = getCatalog(catalog);
    const current = rollCafeStregaLocalState(catalog, state, now);
    const clean = cleanInventory(inventory, allIds);
    return clean ? { ...current, inventory: clean } : current;
}
export function saveCafeStregaLocalState(catalog: CafeStregaLocalCatalog, state: CafeStregaLocalState, now: CafeClock = Date.now(), storage?: CafeStregaLocalStorage | null): CafeStregaLocalSaveResult {
    const target = resolveStorage(storage);
    const { allIds } = getCatalog(catalog);
    const current = rollCafeStregaLocalState(catalog, state, now);
    const inventory = cleanInventory(current.inventory, allIds);
    const validState = inventory
        ? { ...current, inventory }
        : createCafeStregaLocalState(catalog, now);
    let persisted = false;
    if (target) {
        try {
            target.setItem(CAFE_STREGA_LOCAL_STATE_KEY, JSON.stringify(validState));
            persisted = true;
        }
        catch {
            // Storage denial/quota failure must not interrupt the game session.
        }
    }
    return {
        state: validState,
        order: getCafeStregaDailyOrder(catalog, validState, now),
        persisted,
    };
}
/** Apply one scheduled delivery locally. Reward items are not granted here. */
export function deliverCafeStregaDailyOrder(catalog: CafeStregaLocalCatalog, state: CafeStregaLocalState, now: CafeClock = Date.now()): CafeStregaDeliveryResult {
    const current = rollCafeStregaLocalState(catalog, state, now);
    const order = getCafeStregaDailyOrder(catalog, current, now);
    const recipe = catalog.recipes[order.recipeIndex];
    if (order.remainingDeliveryCount <= 0) {
        return { state: current, order, status: "finished", consumed: 0 };
    }
    const owned = current.inventory[order.itemId] ?? 0;
    if (owned < recipe.delivery.count) {
        return { state: current, order, status: "shortage", consumed: 0 };
    }
    const next: CafeStregaLocalState = {
        ...current,
        inventory: {
            ...current.inventory,
            [order.itemId]: owned - recipe.delivery.count,
        },
        remainingDeliveryCount: current.remainingDeliveryCount - 1,
    };
    return {
        state: next,
        order: getCafeStregaDailyOrder(catalog, next, now),
        status: "delivered",
        consumed: recipe.delivery.count,
    };
}
