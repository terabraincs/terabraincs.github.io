import { sampleSwordTrainingClientCurve } from './swordTrainingClientAnimation';
import type { SwordClientComponent } from './swordTrainingClientLayout';
const f = Math.fround;
/**
 * NKC_FXM_UI_IMAGE.ExecuteCurrentSprite from the preserved client DLL.
 *
 * The client evaluates Frame whenever Sprites is non-empty.  The serialized
 * UseSheetAnimation flag is not read by that method.  Cafe's checked-circle
 * effects use the deterministic, non-random branch represented here.
 */
export function sampleCafeFxmSpriteV2(component: SwordClientComponent, playback: number): string | null {
    const sprites = component.references
        .map(reference => ({ reference, match: /^Sprites\[(\d+)]$/.exec(reference.field) }))
        .filter((entry): entry is typeof entry & {
        match: RegExpExecArray;
    } => entry.match !== null)
        .sort((left, right) => Number(left.match[1]) - Number(right.match[1]));
    if (!sprites.length)
        return null;
    const fields = component.fields;
    if (fields.RandomSprite || fields.ShuffleStart || fields.ShuffleArray || fields.UseMultiTargets) {
        throw new Error(`Unverified Cafe FXM sprite branch: ${component.pathId}`);
    }
    const curve = (fields.Frame as {
        m_Curve?: {
            time: number;
            value: number;
            inSlope: number;
            outSlope: number;
            weightedMode: number;
        }[];
    } | undefined)?.m_Curve;
    if (!curve?.length)
        throw new Error(`Original Cafe FXM Frame curve is missing: ${component.pathId}`);
    const duration = Number(fields.Duration);
    const normalized = Math.abs(duration) <= 1e-6 ? 0 : f(playback / duration);
    const value = sampleSwordTrainingClientCurve({ relativePath: '', attribute: 'Frame', keys: curve }, normalized);
    if (value === undefined)
        throw new Error(`Original Cafe FXM Frame curve could not be sampled: ${component.pathId}`);
    const index = Math.max(0, Math.min(sprites.length - 1, Math.trunc(value)));
    const selected = sprites[index].reference;
    if (!selected.resolved || !selected.assetId)
        throw new Error(`Original Cafe FXM Sprite is unresolved: ${component.pathId}.Sprites[${index}]`);
    return selected.assetId;
}
