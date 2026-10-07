import { attachSwordNativeLegacyLayouts, type SwordNativeLegacyLayouts } from './swordTrainingNativeLegacyText';
import { cafeNativeNumericSample, type CafeNativeNumericCatalog } from './cafeStregaNativeNumbersV2';
import type { SwordClientLayout } from './swordTrainingClientLayout';
const DIRECT_SCREEN_LEGACY_TEXT = new Set([
    'UI_SINGLE_CAFE/Content/PHASE - 1/DRINK_SLOT/SINGLE_CAFE_DRINK_SLOT/DRINK_NAME/NAME_TEXT',
    'UI_SINGLE_CAFE/Content/PHASE - 1/DRINK_SLOT/SINGLE_CAFE_DRINK_SLOT/CountBg/COUNT_TEXT',
    'UI_SINGLE_CAFE/Content/PHASE - 1/DRINK_SLOT/SINGLE_CAFE_DRINK_SLOT (2)/DRINK_NAME/NAME_TEXT',
    'UI_SINGLE_CAFE/Content/PHASE - 1/DRINK_SLOT/SINGLE_CAFE_DRINK_SLOT (2)/CountBg/COUNT_TEXT',
    'UI_SINGLE_CAFE/Content/PHASE - 1/DRINK_SLOT/SINGLE_CAFE_DRINK_SLOT (4)/DRINK_NAME/NAME_TEXT',
    'UI_SINGLE_CAFE/Content/PHASE - 1/DRINK_SLOT/SINGLE_CAFE_DRINK_SLOT (4)/CountBg/COUNT_TEXT',
    'UI_SINGLE_CAFE/Content/PHASE - 2/SINGLE_CAFE_MENU/Content/STEP_2/Content/Root/COST_Root/AB_ICON_COST_SLOT/COUNT',
    'UI_SINGLE_CAFE/Content/PHASE - 2/SINGLE_CAFE_MENU/Content/STEP_2/Content/Root/COST_Root/AB_ICON_COST_SLOT (1)/COUNT',
    'UI_SINGLE_CAFE/Content/PHASE - 2/SINGLE_CAFE_MENU/Content/STEP_2/Content/Root/COST_Root/AB_ICON_COST_SLOT/REQUIRED/REQUIRED_TEXT',
    'UI_SINGLE_CAFE/Content/PHASE - 2/SINGLE_CAFE_MENU/Content/STEP_2/Content/Root/COST_Root/AB_ICON_COST_SLOT (1)/REQUIRED/REQUIRED_TEXT',
]);
const MISSION_RESOURCE_TEXT_SOURCE: Record<string, string> = {
    'POPUP_UI_SINGLE_CAFE_MISSION/SINGLE_CAFE_RES_LIST/Line/Text': 'UI_SINGLE_CAFE/Content/PHASE - 1/SINGLE_CAFE_RES_LIST/Line/Text',
    'POPUP_UI_SINGLE_CAFE_MISSION/SINGLE_CAFE_RES_LIST/Res_1/COUNT_TEXT': 'UI_SINGLE_CAFE/Content/PHASE - 1/SINGLE_CAFE_RES_LIST/Res_1/COUNT_TEXT',
    'POPUP_UI_SINGLE_CAFE_MISSION/SINGLE_CAFE_RES_LIST/Res_2/COUNT_TEXT': 'UI_SINGLE_CAFE/Content/PHASE - 1/SINGLE_CAFE_RES_LIST/Res_2/COUNT_TEXT',
    'POPUP_UI_SINGLE_CAFE_MISSION/SINGLE_CAFE_RES_LIST/Res_3/COUNT_TEXT': 'UI_SINGLE_CAFE/Content/PHASE - 1/SINGLE_CAFE_RES_LIST/Res_3/COUNT_TEXT',
    'POPUP_UI_SINGLE_CAFE_MISSION/Content/Mission/Bottom/ERRAND_Root/INGREDIENT_REWARD/Res_1/COUNT_TEXT': 'POPUP_UI_SINGLE_CAFE_MISSION/Content/Mission/Bottom/ERRAND_Root/MY_SCORE/MY_SCORE_TEXT',
    'POPUP_UI_SINGLE_CAFE_MISSION/Content/Mission/Bottom/ERRAND_Root/INGREDIENT_REWARD/Res_2/COUNT_TEXT': 'POPUP_UI_SINGLE_CAFE_MISSION/Content/Mission/Bottom/ERRAND_Root/MY_SCORE/MY_SCORE_TEXT',
    'POPUP_UI_SINGLE_CAFE_MISSION/Content/Mission/Bottom/ERRAND_Root/INGREDIENT_REWARD/Res_3/COUNT_TEXT': 'POPUP_UI_SINGLE_CAFE_MISSION/Content/Mission/Bottom/ERRAND_Root/MY_SCORE/MY_SCORE_TEXT',
};
/** Original Unity TextGenerator meshes. Numeric values use native glyph metrics. */
export function attachCafeNativeTextV2<T extends SwordClientLayout>(layout: T, legacy: SwordNativeLegacyLayouts, numbers: CafeNativeNumericCatalog): T {
    const attached = attachSwordNativeLegacyLayouts(layout, legacy);
    return { ...attached, nodes: attached.nodes.map(node => {
            // NKCPopupEventBarMission instantiates the same resource-list prefab as
            // phase 1. The probe catalog records that Text component at its phase-1
            // instance path, so bind the popup clone back to that exact source mesh.
            const sourcePath = MISSION_RESOURCE_TEXT_SOURCE[node.path] ?? node.path;
            // Unity's pool keeps the same source Text component after reparenting.
            // Aux templates are canonical, while actual runtime paths contain parents.
            const numericPath = numbers.nodes[sourcePath] ? sourcePath : Object.keys(numbers.nodes).find(path => sourcePath.endsWith('/' + path));
            if (!numericPath)
                return { ...node, texts: node.texts?.map(text => {
                        const legacyNative = text.legacyNative ?? (legacy.nodes[sourcePath] ? { catalog: legacy, path: sourcePath } : null);
                        if (!legacyNative)
                            return text;
                        return { ...text, legacyNative: { ...legacyNative, directScreenRaster: DIRECT_SCREEN_LEGACY_TEXT.has(node.path),
                                measureSample: (value: string, _width: number, fontSize: number) => {
                                    const sample = legacy.nodes[sourcePath].find(sample => sample.text === value && sample.fontSize === fontSize);
                                    if (!sample)
                                        throw new Error(`Original Cafe text metrics missing: ${node.path}: ${value}`);
                                    return sample;
                                } } };
                    }) };
            if (node.texts?.length !== 1)
                throw new Error(`Original numeric text binding missing: ${node.path}`);
            return { ...node, texts: node.texts.map(text => ({ ...text, legacyNative: { catalog: legacy, path: sourcePath,
                        resolveSample: (value: string, width: number) => cafeNativeNumericSample(numbers, numericPath, value, width),
                        directScreenRaster: DIRECT_SCREEN_LEGACY_TEXT.has(node.path) } })) };
        }) };
}
