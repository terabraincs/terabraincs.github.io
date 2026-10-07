import { sampleSwordTrainingClientCurve } from './swordTrainingClientAnimation.ts';
import type { ClientColor, SwordClientComponent } from './swordTrainingClientLayout';
type Fields = Record<string, unknown>;
const f = Math.fround;
function gradientChannel(gradient: Fields, channel: string, time: number) {
    const alpha = channel === 'a', count = Number(gradient[alpha ? 'm_NumAlphaKeys' : 'm_NumColorKeys']);
    const prefix = alpha ? 'atime' : 'ctime';
    const at = (index: number) => Number(gradient[`${prefix}${index}`]) / 65535;
    const value = (index: number) => Number((gradient[`key${index}`] as Fields)[channel]);
    if (time <= at(0))
        return value(0);
    for (let index = 1; index < count; index++)
        if (time <= at(index)) {
            const t = at(index) === at(index - 1) ? 1 : (time - at(index - 1)) / (at(index) - at(index - 1));
            return f(value(index - 1) + f(f(value(index) - value(index - 1)) * f(t)));
        }
    return value(count - 1);
}
function curve(fields: Fields, name: string, time: number) {
    const keys = (fields[name] as {
        m_Curve: {
            time: number;
            value: number;
            inSlope: number;
            outSlope: number;
            weightedMode: number;
        }[];
    }).m_Curve;
    if (!keys.length || keys.some(key => key.weightedMode !== 0))
        throw new Error(`Unverified Cafe color curve ${name}`);
    return f(sampleSwordTrainingClientCurve({ relativePath: '', attribute: name, keys }, time)!);
}
/** Original UI_IMAGE/PMA SetOutputColor. Execute(false) is a separate clear write. */
export function sampleCafeFxmColorV2(component: SwordClientComponent, playback: number): ClientColor {
    const fields = component.fields;
    if (fields.UseMultiTargets || fields.RandomValue || fields.UseSheetAnimation)
        throw new Error('Unverified Cafe image evaluator variant');
    const gradient = fields.MinMaxGradient as Fields, mode = Number(gradient.m_Mode);
    const t = Number(fields.Duration) === 0 ? 0 : f(playback / Number(fields.Duration));
    if (mode !== 0 && mode !== 1)
        throw new Error(`Unverified Cafe gradient mode ${mode}`);
    const input = ['r', 'g', 'b', 'a'].map(channel => mode === 0 ? Number((gradient.m_ColorMax as Fields)[channel]) : gradientChannel(gradient.m_GradientMax as Fields, channel, t));
    if (component.type === 'NKC_FXM_UI_IMAGE') {
        const alpha = f(input[3] * f((fields.UseAlphaCurve ? curve(fields, 'Curve', t) : 1) * Number(fields.AlphaMultiplier)));
        return [input[0], input[1], input[2], alpha];
    }
    if (component.type !== 'NKC_FXM_UI_IMAGE_PMA')
        throw new Error('Not a Cafe image color evaluator');
    // Unlike UI_IMAGE, PMA ignores AlphaMultiplier when UseAlphaCurve=false.
    const alpha = fields.UseAlphaCurve ? f(input[3] * f(curve(fields, 'Curve', t) * Number(fields.AlphaMultiplier))) : input[3];
    const boost = Number(fields.ColorBoost), blend = f(Number(fields.BlendFactor) * (fields.UseBlendCurve ? curve(fields, 'Blend', t) : 1));
    return [f(f(input[0] * alpha) * boost), f(f(input[1] * alpha) * boost), f(f(input[2] * alpha) * boost), f(alpha * Math.max(0, Math.min(1, blend)))];
}
