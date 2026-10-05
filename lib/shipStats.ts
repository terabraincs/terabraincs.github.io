import type { ShipStat } from "./ships";
export function getShipStatValue(stat: ShipStat, level: number, limitBreakGrade: number) {
    // Match the original CalculateStat and GetLimitBreakStatMultiplierForShip floats.
    const growth = Math.fround(Math.fround(stat.perLevelValue) * (level - 1));
    const baseStat = Math.fround(Math.fround(stat.baseValue) + growth);
    const limitBreakMultiplier = Math.fround(1 + Math.fround(Math.fround(0.02) * limitBreakGrade));
    const value = Math.fround(baseStat * limitBreakMultiplier);
    // Ship info formats a Single with "#;-#;0", using seven significant digits.
    return Math.round(Number(value.toPrecision(7)));
}
