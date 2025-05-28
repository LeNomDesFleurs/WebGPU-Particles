#include "../shaders/common.wgsl"

// stuff to tweak
// CS_PixelSort workgroup size

const AFX_DEBUG_MASK: i32 = 0;
const AFX_DEBUG_SPANS: i32 = 0;
const AFX_HORIZONTAL_SORT: i32 = 0;

// -------------------UNIFORMS

struct Uniforms {
    resolution: vec2f,
    // Adjust the threshold at which dark pixels are omitted from the mask.
    // 0.0 - 0.5
    _LowThreshold: f32,
    // Adjust the threshold at which bright pixels are omitted from the mask.
    // 0.5 - 1.0
    _HighThreshold: f32,
    // Invert sorting mask.
    _InvertMask: f32,
    // Adjust the max length of sorted spans. This will heavily impact performance.
    // 0 - 256
    _SpanLimit: f32,
    // Adjust the random length offset of limited spans to reduce uniformity.
    // 1-64
    _MaxRandomOffset: f32,
    /*
What color information to sort by
0 "Luminance\0"
1 "Saturation\0"
2 "Hue\0",
*/

    _SortBy: f32,
    _ReverseSorting: f32,
    // Adjust gamma of sorted pixels to accentuate them.
    // 0.1 - 5.0
    _SortedGamma: f32,

}

;

@group(0) @binding(0)
var<uniform> uni: Uniforms;
@group(0) @binding(1)
var inputTexture: texture_2d<f32>;
@group(0) @binding(2)
var outputTexture: texture_storage_2d<rgba8unorm, write>;
//storage Buffers
@group(0) @binding(3)
var s_Mask: texture_storage_2d<r32sint, read_write>;
@group(0) @binding(4)
var s_SortValue: texture_storage_2d<r32float, read_write>;
@group(0) @binding(5)
var s_SpanLengths: texture_storage_2d<r32uint, read_write>;



@compute @workgroup_size(8, 8)
fn CS_CreateMask(@builtin(global_invocation_id) id: vec3u) {
    // var pixelSize:vec2f = vec2f(f32(uni.resolution.y), f32(uni.resolution.x));
    var seed: u32 = id.x * u32(uni.resolution.x);
    var col: vec4f = textureLoad(inputTexture, id.xy, u32(0));
    var l: f32 = Luminance(col.rgb);
    var result: i32 = 1;
    if (l < uni._LowThreshold || uni._HighThreshold < l) {
        result = 0;
    }

    var r: i32 = result;

    if (uni._InvertMask == 1) {
        r = 1 - result;
    }

    textureStore(s_Mask, id.xy, vec4(r));

    CS_CreateSortValues(id);
    CS_ClearBuffers(id);
}

@compute @workgroup_size(1, 1)
fn CS_VisualizeSpans(@builtin(global_invocation_id) id: vec3u) {
    var spanLength: u32 = textureLoad(s_SpanLengths, id.xy).r;

    if (spanLength >= 1) {
        var seed: u32 = id.x + u32(uni.resolution.x) * id.y + u32(uni.resolution.x) * u32(uni.resolution.y);
        var c: vec4f = vec4f(hash(seed), hash(seed * 2), hash(seed * 3), 1.0f);

        for (var i: u32 = 0; i < spanLength; i++) {
            var idx: vec2u = vec2u(id.x, id.y + i);
            textureStore(outputTexture, idx, vec4(c));
        }
    }
}

// @compute @workgroup_size(8, 8)
fn CS_CreateSortValues(id: vec3u) {
    var col: vec4f = textureLoad(inputTexture, id.xy, u32(0));

    var hsl: vec3f = RGBtoHSL(col.rgb);

    var output: f32 = 0.0f;

    if (uni._SortBy == 0.0) {
        output = hsl.b;
    }
    else if (uni._SortBy == 1.0) {
        output = hsl.g;
    }
    else {
        output = hsl.r;
    }

    textureStore(s_SortValue, id.xy, vec4(output));

}

// @compute @workgroup_size(8, 8)
fn CS_ClearBuffers(id: vec3u) {
    textureStore(s_SpanLengths, id.xy, vec4(0));

}

@compute @workgroup_size(8, 8)
fn CS_IdentifySpans(@builtin(global_invocation_id) id: vec3u) {
    var seed: u32 = id.x + u32(uni.resolution.x) * id.y + u32(uni.resolution.x) * u32(uni.resolution.y);
    var idx: vec2u = vec2u(0);
    var pos: u32 = 0;
    var spanStartIndex: u32 = 0;
    var spanLength: u32 = 0;

    var screenLimit: u32 = u32(uni.resolution.y);

    var spanLimit: u32 = u32(f32(uni._SpanLimit) - (hash(seed) * f32(uni._MaxRandomOffset)));

    while (pos < screenLimit) {
        idx = vec2u(id.x, pos);

        var mask: i32 = textureLoad(s_Mask, idx).r;
        pos++;

        if (mask == 0 || spanLength >= spanLimit) {
            idx = vec2u(id.x, spanStartIndex);
            var masking: u32;
            if (mask == 1) {
                masking = spanLength + 1;
            }
            else {
                masking = spanLength;
            }
            textureStore(s_SpanLengths, idx, vec4(spanLength, 0, 0, 0));
            spanStartIndex = pos;
            spanLength = 0;
        }
        else {
            spanLength++;
        }
    }

    if (spanLength != 0) {
        // #if AFX_HORIZONTAL_SORT == 0
        idx = vec2u(id.x, spanStartIndex);
        // #else
        // idx = vec2u(spanStartIndex, id.y);
        // #endif
        textureStore(s_SpanLengths, idx, vec4(spanLength, 0, 0, 0));
    }

}

var<workgroup> gs_PixelSortCache: array<f32, 1000>;

@compute @workgroup_size(8, 8)
fn CS_PixelSort(@builtin(global_invocation_id) id: vec3u) {

    let spanLength: u32 = u32(textureLoad(s_SpanLengths, id.xy).r);

    if (spanLength >= 1) {
        var idx: vec2u = vec2u(0);
        // #if AFX_HORIZONTAL_SORT == 0
        const direction: vec2u = vec2u(0, 1);
        // #else
        // const uint2 direction = uint2(1, 0);
        // #endif

        for (var k: u32 = 0; k < spanLength; k++) {
            idx = id.xy + k * direction;
            var temp: f32 = textureLoad(s_SortValue, idx).r;
            gs_PixelSortCache[k] = f32(temp);
        }

        var minValue: f32 = gs_PixelSortCache[0];
        var maxValue: f32 = gs_PixelSortCache[0];
        var minIndex: u32 = 0;
        var maxIndex: u32 = 0;

        for (var i: u32 = 0; i < (spanLength / 2) + 1; i++) {
            for (var j: u32 = 1; j < spanLength; j++) {
                var v: f32 = gs_PixelSortCache[j];

                if (v == saturate(v)) {
                    if (v < minValue) {
                        minValue = v;
                        minIndex = j;
                    }

                    if (maxValue < v) {
                        maxValue = v;
                        maxIndex = j;
                    }
                }
                //                 let valid = v == clamp(v, 0.0, 1.0);
                // minValue = select(minValue, v, valid && v < minValue);
                // minIndex = select(minIndex, j, valid && v < minValue);
                // maxValue = select(maxValue, v, valid && v > maxValue);
                // maxIndex = select(maxIndex, j, valid && v > maxValue);
            }

            var minIdx: vec2u = vec2u(0);
            var maxIdx: vec2u = vec2u(0);

            // if (uni._ReverseSorting==1) {
            //     minIdx = id.xy + i * direction;
            //     maxIdx = id.xy + (spanLength - i - 1) * direction;
            // } else {
            minIdx = id.xy + (spanLength - i - 1) * direction;
            maxIdx = id.xy + i * direction;
            // }

            // var minColorIdx: vec2u = id.xy + minIndex * direction;
            var minColorIdx: vec2u=id.xy;
            // var maxColorIdx: vec2u = id.xy + maxIndex * direction;
            var maxColorIdx: vec2u=id.xy;

            // load sorted pixels
            var color = pow(abs(textureLoad(inputTexture, minColorIdx.xy, 0)), vec4f(uni._SortedGamma));
            textureStore(outputTexture, minIdx.xy, color);
            color = pow(abs(textureLoad(inputTexture, maxColorIdx.xy, 0)), vec4f(uni._SortedGamma));
            textureStore(outputTexture, maxIdx.xy, color);

            gs_PixelSortCache[minIndex] = 2;
            gs_PixelSortCache[maxIndex] = - 2;
            minValue = 1;
            maxValue = - 1;
        }
    }
    CS_Composite(id);
}

// @compute @workgroup_size(8, 8)
fn CS_Composite(id: vec3u) {
    // load non sorted pixels
    if (textureLoad(s_Mask, id.xy).r == 0) {
        var color: vec4f = textureLoad(inputTexture, id.xy, 0);
        textureStore(outputTexture, id.xy, color);
    }
}
