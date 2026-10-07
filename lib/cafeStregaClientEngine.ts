/**
 * Fresh port of NKCUIEventBarCreateMenu, Assembly-CSharp.dll method tokens
 * 06009F25–06009F3C. Recipe data must come from the original event 6002 table.
 * This research artifact does not import or modify the old Cafe implementation.
 */
export type CafeTechnique = "stir" | "shake";
export type CafeInventory = Readonly<Record<number, number>>;
export interface CafeRecipe {
    itemId: number;
    technique: CafeTechnique;
    materials: readonly {
        itemId: number;
        count: number;
    }[];
    delivery: {
        limit: string;
        limitCount: number;
        count: number;
        rewardItemId: number;
        rewardCount: number;
    };
}
export interface CafeCreateState {
    step: "technique" | "amount";
    selectedIngredients: readonly number[];
    technique: CafeTechnique | null;
    quantity: number;
}
export interface CafeCreateRequest {
    itemId: number;
    count: number;
}
export interface CafeDailyOrder {
    itemId: number;
    remainingDeliveryCount: number;
}
export function createCafeCreateState(): CafeCreateState {
    return { step: "technique", selectedIngredients: [], technique: null, quantity: 0 };
}
// GetCreatedCocktailID and its predicate use Contains, not ingredient order.
export function cafeRecipeForSelection(recipes: readonly CafeRecipe[], state: CafeCreateState): CafeRecipe | null {
    if (state.selectedIngredients.length !== 2 || state.technique === null)
        return null;
    return recipes.find(recipe => recipe.technique === state.technique &&
        recipe.materials.every(material => state.selectedIngredients.includes(material.itemId))) ?? null;
}
export function selectCafeIngredient(state: CafeCreateState, itemId: number, ingredientIds: readonly number[]): CafeCreateState {
    if (state.step !== "technique" || !ingredientIds.includes(itemId))
        return state;
    if (state.selectedIngredients.includes(itemId)) {
        return { ...state, selectedIngredients: state.selectedIngredients.filter(id => id !== itemId) };
    }
    // OnSelectIngredient refuses a third selection; it does not evict an old one.
    if (state.selectedIngredients.length >= 2)
        return state;
    return { ...state, selectedIngredients: [...state.selectedIngredients, itemId] };
}
export function selectCafeTechnique(state: CafeCreateState, technique: CafeTechnique): CafeCreateState {
    if (state.step !== "technique" || technique === state.technique)
        return state;
    return { ...state, technique };
}
export function cafeCanCreate(recipe: CafeRecipe | null, inventory: CafeInventory, quantity: number): boolean {
    // Public wrapper additionally rejects invalid external values. Client buttons
    // only generate integral quantities in [1, 999]. There is no server call here.
    return recipe !== null && Number.isInteger(quantity) && quantity >= 1 && quantity <= 999 &&
        recipe.materials.every(material => (inventory[material.itemId] ?? 0) >= material.count * quantity);
}
export function cafeNextStep(recipes: readonly CafeRecipe[], state: CafeCreateState): CafeCreateState {
    if (state.step !== "technique" || cafeRecipeForSelection(recipes, state) === null)
        return state;
    // SetStep2State always starts at 001, including when the material is short.
    return { ...state, step: "amount", quantity: 1 };
}
export function cafeCancelStep(state: CafeCreateState): CafeCreateState {
    // OnClickCancel only switches the two roots/step; selection is preserved.
    return state.step === "amount" ? { ...state, step: "technique" } : state;
}
export function cafeChangeQuantity(recipes: readonly CafeRecipe[], state: CafeCreateState, inventory: CafeInventory, direction: "up" | "down" | "max"): CafeCreateState {
    if (state.step !== "amount")
        return state;
    const recipe = cafeRecipeForSelection(recipes, state);
    if (!recipe)
        return state;
    if (direction === "up") {
        const quantity = Math.min(state.quantity + 1, 999);
        return cafeCanCreate(recipe, inventory, quantity) ? { ...state, quantity } : state;
    }
    if (direction === "down")
        return { ...state, quantity: Math.max(state.quantity - 1, 1) };
    const max = Math.min(999, ...recipe.materials.map(material => Math.floor((inventory[material.itemId] ?? 0) / material.count)));
    // MAX shows 001 red instead of 000 when no drink is affordable.
    return { ...state, quantity: Math.max(max, 1) };
}
export function cafeQuantityText(state: CafeCreateState): string {
    return String(state.quantity).padStart(3, "0");
}
export function cafeQuantityColor(recipes: readonly CafeRecipe[], state: CafeCreateState, inventory: CafeInventory): "white" | "red" {
    return cafeCanCreate(cafeRecipeForSelection(recipes, state), inventory, state.quantity) ? "white" : "red";
}
/** NKCUIItemCostSlot.SetCount, Cafe prefab m_bShowReqCount=true. */
export function cafeCostText(available: number, required: number): string {
    if (available < required)
        return `<color=#ff0000ff>${available}</color>/${required}`;
    return available > 100000 ? `*/${required}` : `${available}/${required}`;
}
export function cafeCreateRequest(recipes: readonly CafeRecipe[], state: CafeCreateState, inventory: CafeInventory, resultOpen: boolean): CafeCreateRequest | null {
    const recipe = cafeRecipeForSelection(recipes, state);
    // OnClickOK explicitly returns while the result is open.
    if (state.step !== "amount" || resultOpen || !recipe || !cafeCanCreate(recipe, inventory, state.quantity))
        return null;
    return { itemId: recipe.itemId, count: state.quantity };
}
export function cafeRefreshCreateState(state: CafeCreateState): CafeCreateState {
    // Refresh dispatches SetStep1State/SetStep2State for the current step.
    return state.step === "technique" ? createCafeCreateState() : { ...state, quantity: 1 };
}
export function cafeDeliveryStatus(recipes: readonly CafeRecipe[], inventory: CafeInventory, order: CafeDailyOrder | null, selectedItemId: number): "unknown" | "finished" | "unselected" | "wrong" | "shortage" | "ready" {
    // DailyCocktailItemID and RemainDeliveryLimitValue are a server NOT packet.
    // null means unavailable, and must never be converted into a random order.
    if (order === null)
        return "unknown";
    if (order.remainingDeliveryCount <= 0)
        return "finished";
    const recipe = recipes.find(recipe => recipe.itemId === selectedItemId);
    if (!recipe)
        return "unselected";
    if (selectedItemId !== order.itemId)
        return "wrong";
    return (inventory[selectedItemId] ?? 0) < recipe.delivery.count ? "shortage" : "ready";
}
/** Explicit user policy, NOT a recovered client/server inventory default. */
export function createCafeLocalInventory(ingredientIds: readonly number[]): Record<number, number> {
    return Object.fromEntries(ingredientIds.map(itemId => [itemId, 30]));
}
/** Explicit user policy: apply once on completion of the Momo animation. */
export function completeCafeLocalMomo(inventory: CafeInventory, ingredientIds: readonly number[]): Record<number, number> {
    const next = { ...inventory };
    for (const itemId of ingredientIds)
        next[itemId] = (inventory[itemId] ?? 0) + 30;
    return next;
}
/**
 * Explicit offline adapter: client normally receives inventory diffs and a
 * rewardData packet. This only applies the recipe cost/yield in page memory.
 * It cannot grant game-account items and has no persistence API.
 */
export function applyCafeLocalCreation(recipes: readonly CafeRecipe[], inventory: CafeInventory, request: CafeCreateRequest): Record<number, number> | null {
    const recipe = recipes.find(recipe => recipe.itemId === request.itemId) ?? null;
    if (!recipe || !cafeCanCreate(recipe, inventory, request.count))
        return null;
    const next = { ...inventory };
    for (const material of recipe.materials)
        next[material.itemId] = (inventory[material.itemId] ?? 0) - material.count * request.count;
    next[recipe.itemId] = (inventory[recipe.itemId] ?? 0) + request.count;
    return next;
}
export type CafeHoldConfig = Readonly<{
    m_fPressGapMax: number;
    m_fPressGapMin: number;
    m_fDamping: number;
    m_iFastRepeatValue: number;
}>;
export type CafeHoldState = Readonly<{
    elapsed: number;
    gap: number;
}>;
/** Original OnPointerDown 0600547D. This does not invoke the click callback. */
export function cafeBeginHold(config: CafeHoldConfig): CafeHoldState {
    return { elapsed: 0, gap: Math.fround(config.m_fPressGapMax) };
}
/**
 * Original ProcessHold 06005487, one call per client Update while pressed.
 * Read config from the actual button prefab. The separate m_fDelayHold belongs
 * to dOnPointerHolding and does NOT delay the dOnPointerHoldPress path.
 * A normal release/click still invokes the click callback separately.
 */
export function cafeAdvanceHold(state: CafeHoldState, config: CafeHoldConfig, deltaTime: number, touchCount = 1): {
    state: CafeHoldState;
    invocations: number;
} {
    if (touchCount > 1)
        return { state: { ...state, elapsed: 0 }, invocations: 0 };
    const elapsed = Math.fround(state.elapsed + Math.fround(deltaTime));
    if (elapsed <= state.gap)
        return { state: { ...state, elapsed }, invocations: 0 };
    const damped = Math.fround(state.gap * Math.fround(config.m_fDamping));
    const invocations = damped < config.m_fPressGapMin ? Math.max(1, config.m_iFastRepeatValue) : 1;
    const gap = Math.fround(Math.min(config.m_fPressGapMax, Math.max(config.m_fPressGapMin, damped)));
    return { state: { elapsed: 0, gap }, invocations };
}
