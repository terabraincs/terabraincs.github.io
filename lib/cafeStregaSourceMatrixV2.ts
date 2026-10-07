import { swordClientRect, type SwordClientLayout } from './swordTrainingClientLayout';
const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function multiply(a: number[], b: number[]) { return a.map((_, i) => [0, 1, 2, 3].reduce((v, k) => v + a[Math.floor(i / 4) * 4 + k] * b[k * 4 + i % 4], 0)); }
/** Original RectTransform hierarchy including local Z and quaternion X/Y.
 * Unlike a CSS bounding box, ring mesh Z contributes to its projected Y. */
export function cafeSourceMatrixV2(layout: SwordClientLayout, path: string, width: number, height: number) {
    const byPath = new Map(layout.nodes.map(n => [n.path, n]));
    const chain = [];
    let node = byPath.get(path);
    while (node) {
        chain.unshift(node);
        node = node.parentPath ? byPath.get(node.parentPath) : undefined;
    }
    let matrix = identity(), pw = width, ph = height, px = .5, py = .5;
    for (const current of chain) {
        const rect = current.rect;
        let x = rect.localPosition[0], y = rect.localPosition[1];
        let nw = 0, nh = 0, npx = .5, npy = .5;
        if (rect.type === 'RectTransform') {
            const box = swordClientRect(rect, pw, ph);
            nw = box.width;
            nh = box.height;
            npx = box.pivotX;
            npy = box.pivotY;
            x = box.left + nw * npx - pw * px;
            y = ph * (1 - py) - box.top - nh * (1 - npy);
        }
        const [qx, qy, qz, qw] = rect.localRotation, [sx, sy, sz] = rect.localScale;
        const local = [(1 - 2 * (qy * qy + qz * qz)) * sx, 2 * (qx * qy - qz * qw) * sy, 2 * (qx * qz + qy * qw) * sz, x,
            2 * (qx * qy + qz * qw) * sx, (1 - 2 * (qx * qx + qz * qz)) * sy, 2 * (qy * qz - qx * qw) * sz, y,
            2 * (qx * qz - qy * qw) * sx, 2 * (qy * qz + qx * qw) * sy, (1 - 2 * (qx * qx + qy * qy)) * sz, rect.localPosition[2], 0, 0, 0, 1];
        matrix = multiply(matrix, local);
        pw = nw;
        ph = nh;
        px = npx;
        py = npy;
    }
    return { width: pw, height: ph, matrix: multiply([1, 0, 0, width / 2, 0, -1, 0, height / 2, 0, 0, 1, 0, 0, 0, 0, 1], matrix) };
}
