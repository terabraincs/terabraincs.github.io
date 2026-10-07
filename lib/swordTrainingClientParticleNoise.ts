/** Original UnityPlayer 2022.3.62f2 High noise derivative, VA 0x18112ACC0.
 * The permutation and gradient vectors are read from VAs 0x1819B2570 and
 * 0x181C5F270. The straight-line scalar arithmetic below preserves the native
 * SSE add/subtract/multiply order; each original operation rounds to float32.
 * Generated from original instructions by scripts/native-probes/generate-sword-training-noise.mjs.
 */
const f = Math.fround;
const P = [151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180, 151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180] as const;
const G = [1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 1, 1, 0, -1, 1, 0, 0, -1, 1, 0, -1, -1] as const;
/** Returns the first two coordinate derivatives, including the native frequency factor. */
export function swordClientNoiseDerivative(x: number, y: number, z: number, frequency: number): [
    number,
    number
] {
    x = f(x);
    y = f(y);
    z = f(z);
    frequency = f(frequency);
    const sx = f(x * frequency), sy = f(y * frequency), sz = f(z * frequency);
    const ix = Math.floor(sx), iy = Math.floor(sy), iz = Math.floor(sz);
    const ux = f(sx - ix), uy = f(sy - iy), uz = f(sz - iz);
    const gradient = (dx: number, dy: number, dz: number): readonly [
        number,
        number,
        number
    ] => {
        const index = (P[P[P[(ix & 255) + dx] + (iy & 255) + dy] + (iz & 255) + dz] & 15) * 3;
        return [G[index], G[index + 1], G[index + 2]];
    };
    const g000 = gradient(0, 0, 0), g100 = gradient(1, 0, 0), g010 = gradient(0, 1, 0), g110 = gradient(1, 1, 0);
    const g001 = gradient(0, 0, 1), g101 = gradient(1, 0, 1), g011 = gradient(0, 1, 1), g111 = gradient(1, 1, 1);
    const t0 = f(uy * g000[1]); // 0x18112B1BB
    const t1 = f(uz * g000[2]); // 0x18112B1C3
    const t2 = f(ux * g000[0]); // 0x18112B1CB
    const t3 = f(uy * g100[1]); // 0x18112B1D3
    const t4 = f(t0 + t1); // 0x18112B1E0
    const t5 = f(uz * g100[2]); // 0x18112B1EC
    const t6 = f(f(uy - 1) * g010[1]); // 0x18112B1F4
    const t7 = f(f(uy - 1) * g110[1]); // 0x18112B200
    const t8 = f(t4 + t2); // 0x18112B208
    const t9 = f(t3 + t5); // 0x18112B210
    const t10 = f(uy * g101[1]); // 0x18112B214
    const t11 = f(f(ux - 1) * g100[0]); // 0x18112B21F
    const t12 = f(uz * g010[2]); // 0x18112B226
    const t13 = f(t9 + t11); // 0x18112B235
    const t14 = f(uy * g001[1]); // 0x18112B239
    const t15 = f(t6 + t12); // 0x18112B23D
    const t16 = f(ux * g010[0]); // 0x18112B245
    const t17 = f(uz * g110[2]); // 0x18112B24C
    const t18 = f(t15 + t16); // 0x18112B258
    const t19 = f(f(ux - 1) * g110[0]); // 0x18112B261
    const t20 = f(t7 + t17); // 0x18112B268
    const t21 = f(f(uz - 1) * g001[2]); // 0x18112B26F
    const t22 = f(t20 + t19); // 0x18112B273
    const t23 = f(t14 + t21); // 0x18112B280
    const t24 = f(ux * g001[0]); // 0x18112B283
    const t25 = f(f(uz - 1) * g101[2]); // 0x18112B28A
    const t26 = f(t23 + t24); // 0x18112B291
    const t27 = f(f(ux - 1) * g101[0]); // 0x18112B299
    const t28 = f(t10 + t25); // 0x18112B2A0
    const t29 = f(t28 + t27); // 0x18112B2A3
    const t30 = f(f(uz - 1) * g011[2]); // 0x18112B2B8
    const t31 = f(ux * g011[0]); // 0x18112B2C2
    const t32 = f(f(uy - 1) * g011[1]); // 0x18112B2D0
    const t33 = f(t32 + t30); // 0x18112B2EE
    const t34 = f(ux - 2); // 0x18112B302
    const t35 = f(t33 + t31); // 0x18112B317
    const t36 = f(ux * t34); // 0x18112B324
    const t37 = f(ux * 30); // 0x18112B331
    const t38 = f(t36 + 1); // 0x18112B338
    const t39 = f(t37 * ux); // 0x18112B33C
    const t40 = f(t39 * t38); // 0x18112B351
    const t41 = f(uy - 2); // 0x18112B361
    const t42 = f(uy * t41); // 0x18112B368
    const t43 = f(uy * 30); // 0x18112B375
    const t44 = f(t42 + 1); // 0x18112B37C
    const t45 = f(t43 * uy); // 0x18112B386
    const t46 = f(t45 * t44); // 0x18112B3A5
    const t47 = f(ux * 6); // 0x18112B3C5
    const t48 = f(t47 + -15); // 0x18112B3C8
    const t49 = f(ux * t48); // 0x18112B3CB
    const t50 = f(ux * ux); // 0x18112B3D9
    const t51 = f(t49 + 10); // 0x18112B3DD
    const t52 = f(t50 * ux); // 0x18112B3E0
    const t53 = f(t52 * t51); // 0x18112B3F7
    const t54 = f(uy * 6); // 0x18112B407
    const t55 = f(t54 + -15); // 0x18112B40A
    const t56 = f(uy * t55); // 0x18112B40D
    const t57 = f(uy * uy); // 0x18112B41B
    const t58 = f(t56 + 10); // 0x18112B41F
    const t59 = f(t57 * uy); // 0x18112B422
    const t60 = f(t59 * t58); // 0x18112B43A
    const t61 = f(uz * 6); // 0x18112B44D
    const t62 = f(t61 + -15); // 0x18112B46B
    const t63 = f(uz * t62); // 0x18112B480
    const t64 = f(uz * uz); // 0x18112B48E
    const t65 = f(t63 + 10); // 0x18112B492
    const t66 = f(t64 * uz); // 0x18112B4A3
    const t67 = f(t66 * t65); // 0x18112B4C5
    const t68 = f(f(uy - 1) * g111[1]); // 0x18112B4CC
    const t69 = f(t13 - t8); // 0x18112B4D9
    const t70 = f(t18 - t8); // 0x18112B4E8
    const t71 = f(t22 - t18); // 0x18112B4F7
    const t72 = f(t71 - t13); // 0x18112B4FB
    const t73 = f(t72 + t8); // 0x18112B4FF
    const t74 = f(t29 - t26); // 0x18112B50D
    const t75 = f(t74 - t13); // 0x18112B510
    const t76 = f(t75 + t8); // 0x18112B514
    const t77 = f(t35 - t26); // 0x18112B522
    const t78 = f(t77 - t18); // 0x18112B525
    const t79 = f(t78 + t8); // 0x18112B529
    const t80 = f(f(uz - 1) * g111[2]); // 0x18112B539
    const t81 = f(t68 + t80); // 0x18112B540
    const t82 = f(f(ux - 1) * g111[0]); // 0x18112B548
    const t83 = f(t81 + t82); // 0x18112B54B
    const t84 = f(t83 - t35); // 0x18112B55C
    const t85 = f(g100[0] - g000[0]); // 0x18112B56A
    const t86 = f(t84 - t29); // 0x18112B56D
    const t87 = f(t86 + t26); // 0x18112B57B
    const t88 = f(t87 - t22); // 0x18112B58C
    const t89 = f(t88 + t18); // 0x18112B5A0
    const t90 = f(t89 + t13); // 0x18112B5B4
    const t91 = f(t90 - t8); // 0x18112B5C8
    const t92 = f(g110[0] - g010[0]); // 0x18112B5EB
    const t93 = f(g111[0] - g011[0]); // 0x18112B5F2
    const t94 = f(g111[1] - g011[1]); // 0x18112B5F9
    const t95 = f(g001[1] - g000[1]); // 0x18112B601
    const t96 = f(g110[1] - g010[1]); // 0x18112B606
    const t97 = f(g100[1] - g000[1]); // 0x18112B617
    const t98 = f(t92 - g100[0]); // 0x18112B61B
    const t99 = f(t93 - g101[0]); // 0x18112B62A
    const t100 = f(g010[0] - g000[0]); // 0x18112B638
    const t101 = f(t96 - g100[1]); // 0x18112B63C
    const t102 = f(g001[0] - g000[0]); // 0x18112B647
    const t103 = f(t94 - g101[1]); // 0x18112B657
    const t104 = f(g010[1] - g000[1]); // 0x18112B65F
    const t105 = f(g000[0] + t98); // 0x18112B672
    const t106 = f(g000[1] + t101); // 0x18112B675
    const t107 = f(g101[0] - g001[0]); // 0x18112B68A
    const t108 = f(g101[1] - g001[1]); // 0x18112B697
    const t109 = f(t107 - g100[0]); // 0x18112B6AF
    const t110 = f(t108 - g100[1]); // 0x18112B6BA
    const t111 = f(g000[0] + t109); // 0x18112B6CE
    const t112 = f(g011[0] - g001[0]); // 0x18112B6E4
    const t113 = f(g000[1] + t110); // 0x18112B6EC
    const t114 = f(g011[1] - g001[1]); // 0x18112B6FB
    const t115 = f(t112 - g010[0]); // 0x18112B70B
    const t116 = f(t114 - g010[1]); // 0x18112B720
    const t117 = f(g000[0] + t115); // 0x18112B72E
    const t118 = f(g001[0] + t99); // 0x18112B73C
    const t119 = f(g000[1] + t116); // 0x18112B74E
    const t120 = f(g001[1] + t103); // 0x18112B75D
    const t121 = f(t118 - g110[0]); // 0x18112B770
    const t122 = f(t120 - g110[1]); // 0x18112B78D
    const t123 = f(g010[0] + t121); // 0x18112B794
    const t124 = f(g010[1] + t122); // 0x18112B7C1
    const t125 = f(g100[0] + t123); // 0x18112B7C8
    const t126 = f(g100[1] + t124); // 0x18112B7CF
    const t127 = f(t53 * t105); // 0x18112B7DD
    const t128 = f(t125 - g000[0]); // 0x18112B7EB
    const t129 = f(t126 - g000[1]); // 0x18112B7F6
    const t130 = f(t127 + t100); // 0x18112B7FA
    const t131 = f(t53 * t113); // 0x18112B7FE
    const t132 = f(t131 + t95); // 0x18112B818
    const t133 = f(t53 * t85); // 0x18112B827
    const t134 = f(t53 * t97); // 0x18112B82E
    const t135 = f(t133 + g000[0]); // 0x18112B840
    const t136 = f(t53 * t106); // 0x18112B844
    const t137 = f(t134 + g000[1]); // 0x18112B84B
    const t138 = f(t60 * t130); // 0x18112B84F
    const t139 = f(t53 * t128); // 0x18112B856
    const t140 = f(t136 + t104); // 0x18112B85B
    const t141 = f(t138 + t135); // 0x18112B866
    const t142 = f(t139 + t117); // 0x18112B87B
    const t143 = f(t60 * t140); // 0x18112B87E
    const t144 = f(t53 * t129); // 0x18112B88C
    const t145 = f(t60 * t142); // 0x18112B891
    const t146 = f(t143 + t137); // 0x18112B894
    const t147 = f(t144 + t119); // 0x18112B8A2
    const t148 = f(t53 * t111); // 0x18112B8A6
    const t149 = f(t60 * t147); // 0x18112B8B6
    const t150 = f(t148 + t102); // 0x18112B8B9
    const t151 = f(t149 + t132); // 0x18112B8CB
    const t152 = f(t145 + t150); // 0x18112B8D9
    const t153 = f(t151 * t67); // 0x18112B8E8
    const t154 = f(t152 * t67); // 0x18112B8F2
    const t155 = f(t153 + t146); // 0x18112B8F5
    const t156 = f(t154 + t141); // 0x18112B8F8
    const t157 = f(t60 * t73); // 0x18112B90D
    const t158 = f(t60 * t91); // 0x18112B910
    const t159 = f(t157 + t69); // 0x18112B91B
    const t160 = f(t158 + t76); // 0x18112B922
    const t161 = f(t160 * t67); // 0x18112B93D
    const t162 = f(t161 + t159); // 0x18112B944
    const t163 = f(t53 * t91); // 0x18112B94C
    const t164 = f(t53 * t73); // 0x18112B950
    const t165 = f(t162 * t40); // 0x18112B953
    const t166 = f(t163 + t79); // 0x18112B95B
    const t167 = f(t164 + t70); // 0x18112B963
    const t168 = f(t165 + t156); // 0x18112B96A
    const t169 = f(t166 * t67); // 0x18112B974
    const t170 = f(t169 + t167); // 0x18112B981
    const t171 = f(t170 * t46); // 0x18112B985
    const t172 = f(t171 + t155); // 0x18112B98D
    const t173 = f(t172 * frequency); // 0x18112B99A
    const t174 = f(t168 * frequency); // 0x18112B99E
    return [t174, t173];
}
