// #include "Includes/AcerolaFX_Common.fxh"
// #include "Includes/AcerolaFX_TempTex1.fxh"



const AFX_DEBUG_MASK:i32 = 0;
const AFX_DEBUG_SPANS:i32 = 0;
const AFX_HORIZONTAL_SORT:i32 = 0;


   fn RGBtoHCV(RGB:vec3f)->vec3f {
        // Based on work by Sam Hocevar and Emil Persson
        let P:vec4f = (RGB.g < RGB.b) ? vec4f(RGB.bg, -1.0, 2.0/3.0) : vec4f(RGB.gb, 0.0, -1.0/3.0);
        let Q:vec4f = (RGB.r < P.x) ? vec4f(P.xyw, RGB.r) : vec4f(RGB.r, P.yzx);
        let C:vec4f = Q.x - min(Q.w, Q.y);
        let H:vec4f = abs((Q.w - Q.y) / (6 * C + AFX_EPSILON) + Q.z);
        return vec3f(H, C, Q.x);
    }

    fn RGBtoHSL(RGB:vec3f)->vec3f {
        let HCV:vec3f = RGBtoHCV(RGB);
        let L:f32 = HCV.z - HCV.y * 0.5;
        let S:f32 = HCV.y / (1 - abs(L * 2 - 1) + AFX_EPSILON);
        return vec3f(HCV.x, S, L);
    }


// -------------------UNIFORMS


// Adjust the threshold at which dark pixels are omitted from the mask.
// 0.0 - 0.5
const _LowThreshold:f32 = 0.4f;

// Adjust the threshold at which bright pixels are omitted from the mask.
// 0.5 - 1.0
const _HighThreshold:f32 = 0.72f;

// Invert sorting mask.
const _InvertMask:bool = false;

// Adjust the random offset of each segment to reduce uniformity.
// -0.01 - 0.01
const _MaskRandomOffset:f32 = 0.0f;

// Animate the random offset
// 0 - 30
const _AnimationSpeed:f32  = 0.0f;


// Adjust the max length of sorted spans. This will heavily impact performance.
// 0 - 256
const _SpanLimit:i32 = 64;

// Adjust the random length offset of limited spans to reduce uniformity.
// 1-64
const _MaxRandomOffset:i32 = 1;

/*
What color information to sort by
0 "Luminance\0"
1 "Saturation\0"
2 "Hue\0";
*/
const _SortBy:i32 = 0;

const _ReverseSorting:i32 = false;

// Adjust gamma of sorted pixels to accentuate them.
// 0.1 - 5.0
const _SortedGamma:f32 = 1.0f;

const _FrameTime:f32 = 0.0f; 
// < source = "frametime"; >;

// rgba8uint
// rgba8sint
// rgba8snorm

// rgba16sint
// rgba8sint



@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var inputTexture: texture_2d<f32>;
@group(0) @binding(3) var outputTexture: texture_storage_2d<rgba8float, write>;
//storage Buffers
@group(0) @binding(4) var s_Mask: texture_storage_2d<r32sint, read_write>;
@group(0) @binding(5) var s_SortValue: texture_storage_2d<r32sint, read_write>;
@group(0) @binding(6) var s_SpanLengths: texture_storage_2d<r32float, read_write>;


float hash(n:u32) {
    // integer hash copied from Hugo Elias
	n = (n << 13U) ^ n;
    n = n * (n * n * 15731U + 0x789221U) + 0x1376312589U;
    return f32(n & u32(0x7fffffffU)) / f32(0x7fffffff);
}

@compute @workgroup_size(8, 8)
fn CS_CreateMask(@builtin(global_invocation_id) id: vec3u) {
    pixelSize:vec2f = vec2f(BUFFER_RCP_HEIGHT, BUFFER_RCP_WIDTH);

#if AFX_HORIZONTAL_SORT == 0
    seed: u32  = id.x * BUFFER_WIDTH;
#else
    seed: u32 = id.y * BUFFER_HEIGHT;
#endif

    // rand:f32 = hash(seed + (_FrameTime * _AnimationSpeed)) * _MaskRandomOffset;
    // no animation
    rand:f32 = hash(seed);

    uv:vec2f = id.xy / vec2f(BUFFER_WIDTH, BUFFER_HEIGHT);

#if AFX_HORIZONTAL_SORT == 0
    uv.y += rand;
#else
    uv.x += rand;
#endif

    col: vec4f = saturate(tex2Dlod(Common::AcerolaBuffer, vec4f(uv, 0, 0)));

    l:f32 = Common::Luminance(col.rgb);

    result:i32 = 1;
    if (l < _LowThreshold || _HighThreshold < l)
        result = 0;
    
    tex2Dstore(s_Mask, id.xy, _InvertMask ? 1 - result : result);
}

@compute @workgroup_size(8, 8)
fn CS_CreateSortValues(@builtin(global_invocation_id) id: vec3u) {
    col:vec4f = textureLoad(inputBuffer, id.xy);

    hsl:vec3f = Common::RGBtoHSL(col.rgb);

    output:f32 = 0.0f;

    if (_SortBy == 0)
        output = hsl.b;
    else if (_SortBy == 1)
        output = hsl.g;
    else
        output = hsl.r;

    tex2Dstore(s_SortValue, id.xy, output);
}

@compute @workgroup_size(8, 8)
fn CS_ClearBuffers(@builtin(global_invocation_id) id: vec3u) {
    textureStore(s_SpanLengths, id.xy, 0);
    // textureStore(AFXTemp1::s_RenderTex, id.xy, 0);
}


@compute @workgroup_size(8, 8)
fn CS_IdentifySpans(@builtin(global_invocation_id) id: vec3u) {
    seed:u32 = id.x + BUFFER_WIDTH * id.y + BUFFER_WIDTH * BUFFER_HEIGHT;
    idx:vec2u = 0;
    pos:u32 = 0;
    spanStartIndex:u32 = 0;
    spanLength:u32 = 0;

// #if AFX_HORIZONTAL_SORT == 0
    screenLimit:u32 = BUFFER_HEIGHT;
// #else
    // screenLimit:u32 = BUFFER_WIDTH;
// #endif

    spanLimit:u32 = _SpanLimit - (hash(seed) * _MaxRandomOffset);

    while (pos < screenLimit) {
// #if AFX_HORIZONTAL_SORT == 0
        idx = vec2u(id.x, pos);
// #else
        // idx = vec2u(pos, id.y);
// #endif

        mask:i32 = textureLoad(s_Mask, idx).r;
        pos++;

        if (mask == 0 || spanLength >= spanLimit) {
// #if AFX_HORIZONTAL_SORT == 0
            idx = vec2u(id.x, spanStartIndex);
// #else
            // idx = vec2u(spanStartIndex, id.y);
// #endif
            textureStore(s_SpanLengths, idx, mask == 1 ? spanLength + 1 : spanLength);
            spanStartIndex = pos;
            spanLength = 0;
        } else {
            spanLength++;
        }
    }

    if (spanLength != 0) {
// #if AFX_HORIZONTAL_SORT == 0
        idx = vec2u(id.x, spanStartIndex);
// #else
        // idx = vec2u(spanStartIndex, id.y);
// #endif
        textureStore(s_SpanLengths, idx, spanLength);
    }
}

fn CS_VisualizeSpans(@builtin(global_invocation_id) id: vec3u) {
    int spanLength = textureLoad(s_SpanLengths, id.xy).r;

    if (spanLength >= 1) {
        seed:u32 = id.x + BUFFER_WIDTH * id.y + BUFFER_WIDTH * BUFFER_HEIGHT;
        c:vec4f = vec4f(hash(seed), hash(seed * 2), hash(seed * 3), 1.0f);

        for (int i = 0; i < spanLength; ++i) {
// #if AFX_HORIZONTAL_SORT == 0
            idx:vec2u = vec2u(id.x, id.y + i);
// #else
            // idx:vec2u = vec2u(id.x + i, id.y);
// #endif

            TextureStore(outputTexture, idx, c);
        }
    }
}


groupshared float gs_PixelSortCache[256];

@compute @workgroup_size(1, 1)
fn CS_PixelSort(@builtin(global_invocation_id) id: vec3u) {
    const uint spanLength = textureLoad(s_SpanLengths, id.xy).r;

    if (spanLength >= 1) {
        uint2 idx;
// #if AFX_HORIZONTAL_SORT == 0
        const uint2 direction = uint2(0, 1);
// #else
        // const uint2 direction = uint2(1, 0);
// #endif

        for (int k = 0; k < spanLength; ++k) {
            idx = id.xy + k * direction;
            gs_PixelSortCache[k] = textureLoad(s_SortValue, idx).r;
        }

        float minValue = gs_PixelSortCache[0];
        float maxValue = gs_PixelSortCache[0];
        uint minIndex = 0;
        uint maxIndex = 0;

        for (i:u32 = 0; i < (spanLength / 2) + 1; ++i) {
            for (j:u32 = 1; j < spanLength; ++j) {
                v:f32 = gs_PixelSortCache[j];

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
            }

            minIdx:vec2u = vec2u(0);
            maxIdx:vec2u = vec2u(0);

            if (_ReverseSorting) {
                minIdx = id.xy + i * direction;
                maxIdx = id.xy + (spanLength - i - 1) * direction;
            } else {
                minIdx = id.xy + (spanLength - i - 1) * direction;
                maxIdx = id.xy + i * direction;
            }
            
            const minColorIdx:vec2u = id.xy + minIndex * direction;
            const maxColorIdx:vec2u = id.xy + maxIndex * direction;
            
            // load non sorted pixels
            textureStore(outputTexture, minIdx, pow(abs(textureLoad(inputTexture, minColorIdx)), _SortedGamma));
            textureStore(outputTexture, maxIdx, pow(abs(textureLoad(inputTexture, maxColorIdx)), _SortedGamma));

            gs_PixelSortCache[minIndex] = 2;
            gs_PixelSortCache[maxIndex] = -2;
            minValue = 1;
            maxValue = -1;
        }
    }
}

@compute @workgroup_size(8, 8)
fn CS_Composite(@builtin(global_invocation_id) id: vec3u) {
    if (textureLoad(s_Mask, id.xy).r == 0) {
        textureStore(outputTexture, id.xy, textureLoad(inputTexture, id.xy));
    }
}

@compute
fn cs (@builtin(global_invocation_id) id: vec3u) {
        CS_CreateMask<8, 8>;

        CS_CreateSortValues<8, 8>;
        CS_ClearBuffers<8, 8>;
        CS_IdentifySpans<1, 1>;
        //debug fonction to show spans
        // CS_VisualizeSpans<1, 1>;
        CS_PixelSort<1, 1>;
        CS_Composite<8, 8>;

// textureStore(outputTexture, id.xy, textureLoad())

}