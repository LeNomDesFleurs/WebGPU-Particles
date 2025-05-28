const AFX_EPSILON: f32 = 0.001;



fn RGBtoHCV(RGB: vec3f) -> vec3f {
    // Based on work by Sam Hocevar and Emil Persson
    var P: vec4f;
    if (RGB.g < RGB.b) {
        P = vec4f(RGB.bg, - 1.0, 2.0 / 3.0);
    }
    else {
        P = vec4f(RGB.gb, 0.0, - 1.0 / 3.0);
    }
    var Q: vec4f;
    if (RGB.r < P.x) {
        Q = vec4f(P.xyw, RGB.r);
    }
    else {
        Q = vec4f(RGB.r, P.yzx);
    }
    let C: f32 = Q.x - min(Q.w, Q.y);
    let H: f32 = abs((Q.w - Q.y) / (6 * C + AFX_EPSILON) + Q.z);
    return vec3f(H, C, Q.x);
}

fn RGBtoHSL(RGB: vec3f) -> vec3f {
    let HCV: vec3f = RGBtoHCV(RGB);
    let L: f32 = HCV.z - HCV.y * 0.5;
    let S: f32 = HCV.y / (1 - abs(L * 2 - 1) + AFX_EPSILON);
    return vec3f(HCV.x, S, L);
}

fn hash(nn: u32) -> f32 {

    var n: u32 = nn;
    // integer hash copied from Hugo Elias
    // n = (n << 13) ^ n;
    // n = n * (n * n * 15731 + u32(0x789221)) + u64(0x1376312589);
    // return f32(n & u32(0x7fffffff)) / f32(0x7fffffff);
    return 0.2f;
}

fn Luminance(color: vec3f) -> f32 {
    return max(0.00001f, dot(color, vec3f(0.2127f, 0.7152f, 0.0722f)));
}




    fn HUEtoRGB(H:f32)->vec3f {
        var R:f32 = abs(H * 6 - 3) - 1;
        var G:f32 = 2 - abs(H * 6 - 2);
        var B:f32 = 2 - abs(H * 6 - 4);
        return vec3f(R,G,B);
    }

    fn HSLtoRGB(HSL:vec3f)->vec3f {
        var RGB: vec3f = HUEtoRGB(HSL.x);
        var C:f32 = (1 - abs(2 * HSL.z - 1)) * HSL.y;
        return (RGB - 0.5) * C + HSL.z;
    }