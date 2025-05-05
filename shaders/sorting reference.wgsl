#include "Includes/AcerolaFX_Common.fxh"
#include "Includes/AcerolaFX_TempTex1.fxh"

#ifndef AFX_DEBUG_MASK
 #define AFX_DEBUG_MASK 0
#endif

#ifndef AFX_DEBUG_SPANS
 #define AFX_DEBUG_SPANS 0
#endif

#ifndef AFX_HORIZONTAL_SORT
 #define AFX_HORIZONTAL_SORT 0
#endif


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

texture2D AFX_PixelSortMaskTex { Width = BUFFER_WIDTH; Height = BUFFER_HEIGHT; Format = R8; }; 
sampler2D Mask { Texture = AFX_PixelSortMaskTex; };
storage2D s_Mask { Texture = AFX_PixelSortMaskTex; };

texture2D AFX_SortValueTex { Width = BUFFER_WIDTH; Height = BUFFER_HEIGHT; Format = R8; }; 
sampler2D SortValue { Texture = AFX_SortValueTex; };
storage2D s_SortValue { Texture = AFX_SortValueTex; };

texture2D AFX_SpanLengthsTex { Width = BUFFER_WIDTH; Height = BUFFER_HEIGHT; Format = R16F; }; 
sampler2D SpanLengths { Texture = AFX_SpanLengthsTex; };
storage2D s_SpanLengths { Texture = AFX_SpanLengthsTex; };

sampler2D PixelSort { Texture = AFXTemp1::AFX_RenderTex1; MagFilter = POINT; MinFilter = POINT; MipFilter = POINT; };
float4 PS_EndPass(float4 position : SV_POSITION, float2 uv : TEXCOORD) : SV_TARGET { return tex2D(PixelSort, uv).rgba; }
float4 PS_DebugMask(float4 position : SV_POSITION, float2 uv : TEXCOORD) : SV_TARGET { return tex2D(Mask, uv).r; }

float hash(n:u32) {
    // integer hash copied from Hugo Elias
	n = (n << 13U) ^ n;
    n = n * (n * n * 15731U + 0x789221U) + 0x1376312589U;
    return f32(n & u32(0x7fffffffU)) / f32(0x7fffffff);
}

void CS_CreateMask(SV_DISPATCHTHREADID id :vec3u ) {
    pixelSize:vec2f = vec2f(BUFFER_RCP_HEIGHT, BUFFER_RCP_WIDTH);

#if AFX_HORIZONTAL_SORT == 0
    seed: u32  = id.x * BUFFER_WIDTH;
#else
    seed: u32 = id.y * BUFFER_HEIGHT;
#endif

    rand:f32 = hash(seed + (_FrameTime * _AnimationSpeed)) * _MaskRandomOffset;

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

void CS_CreateSortValues(@builtin(global_invocation_id) id: vec3u) {
    col:vec4f = tex2Dfetch(Common::AcerolaBuffer, id.xy);

    hsl:vec3f = Common::RGBtoHSL(col.rgb);

    float output = 0.0f;

    if (_SortBy == 0)
        output = hsl.b;
    else if (_SortBy == 1)
        output = hsl.g;
    else
        output = hsl.r;

    tex2Dstore(s_SortValue, id.xy, output);
}

void CS_ClearBuffers(@builtin(global_invocation_id) id: vec3u) {
    tex2Dstore(s_SpanLengths, id.xy, 0);
    tex2Dstore(AFXTemp1::s_RenderTex, id.xy, 0);
}

void CS_IdentifySpans(@builtin(global_invocation_id) id: vec3u) {
    seed:u32 = id.x + BUFFER_WIDTH * id.y + BUFFER_WIDTH * BUFFER_HEIGHT;
    idx:vec2u = 0;
    pos:u32 = 0;
    spanStartIndex:u32 = 0;
    spanLength:u32 = 0;

#if AFX_HORIZONTAL_SORT == 0
    screenLimit:u32 = BUFFER_HEIGHT;
#else
    screenLimit:u32 = BUFFER_WIDTH;
#endif

    spanLimit:u32 = _SpanLimit - (hash(seed) * _MaxRandomOffset);

    while (pos < screenLimit) {
#if AFX_HORIZONTAL_SORT == 0
        idx = vec2u(id.x, pos);
#else
        idx = vec2u(pos, id.y);
#endif

        mask:i32 = tex2Dfetch(Mask, idx).r;
        pos++;

        if (mask == 0 || spanLength >= spanLimit) {
#if AFX_HORIZONTAL_SORT == 0
            idx = vec2u(id.x, spanStartIndex);
#else
            idx = vec2u(spanStartIndex, id.y);
#endif
            tex2Dstore(s_SpanLengths, idx, mask == 1 ? spanLength + 1 : spanLength);
            spanStartIndex = pos;
            spanLength = 0;
        } else {
            spanLength++;
        }
    }

    if (spanLength != 0) {
#if AFX_HORIZONTAL_SORT == 0
        idx = vec2u(id.x, spanStartIndex);
#else
        idx = vec2u(spanStartIndex, id.y);
#endif
        tex2Dstore(s_SpanLengths, idx, spanLength);
    }
}

void CS_VisualizeSpans(@builtin(global_invocation_id) id: vec3u) {
    int spanLength = tex2Dfetch(SpanLengths, id.xy).r;

    if (spanLength >= 1) {
        seed:u32 = id.x + BUFFER_WIDTH * id.y + BUFFER_WIDTH * BUFFER_HEIGHT;
        c:vec4f = vec4f(hash(seed), hash(seed * 2), hash(seed * 3), 1.0f);

        for (int i = 0; i < spanLength; ++i) {
#if AFX_HORIZONTAL_SORT == 0
            idx:vec2u = vec2u(id.x, id.y + i);
#else
            idx:vec2u = vec2u(id.x + i, id.y);
#endif

            tex2Dstore(AFXTemp1::s_RenderTex, idx, c);
        }
    }
}


groupshared float gs_PixelSortCache[256];

void CS_PixelSort(@builtin(global_invocation_id) id: vec3u) {
    const uint spanLength = tex2Dfetch(SpanLengths, id.xy).r;

    if (spanLength >= 1) {
        uint2 idx;
#if AFX_HORIZONTAL_SORT == 0
        const uint2 direction = uint2(0, 1);
#else
        const uint2 direction = uint2(1, 0);
#endif

        for (int k = 0; k < spanLength; ++k) {
            idx = id.xy + k * direction;
            gs_PixelSortCache[k] = tex2Dfetch(SortValue, idx).r;
        }

        float minValue = gs_PixelSortCache[0];
        float maxValue = gs_PixelSortCache[0];
        uint minIndex = 0;
        uint maxIndex = 0;

        for (uint i = 0; i < (spanLength / 2) + 1; ++i) {
            for (uint j = 1; j < spanLength; ++j) {
                float v = gs_PixelSortCache[j];

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

            uint2 minIdx = 0;
            uint2 maxIdx = 0;

            if (_ReverseSorting) {
                minIdx = id.xy + i * direction;
                maxIdx = id.xy + (spanLength - i - 1) * direction;
            } else {
                minIdx = id.xy + (spanLength - i - 1) * direction;
                maxIdx = id.xy + i * direction;
            }
            
            const uint2 minColorIdx = id.xy + minIndex * direction;
            const uint2 maxColorIdx = id.xy + maxIndex * direction;
            

            tex2Dstore(AFXTemp1::s_RenderTex, minIdx, pow(abs(tex2Dfetch(Common::AcerolaBuffer, minColorIdx)), _SortedGamma));
            tex2Dstore(AFXTemp1::s_RenderTex, maxIdx, pow(abs(tex2Dfetch(Common::AcerolaBuffer, maxColorIdx)), _SortedGamma));
            gs_PixelSortCache[minIndex] = 2;
            gs_PixelSortCache[maxIndex] = -2;
            minValue = 1;
            maxValue = -1;
        }
    }
}

// ---------------------- DEBUG -------------------------

void CS_Composite(@builtin(global_invocation_id) id: vec3u) {
    if (tex2Dfetch(Mask, id.xy).r == 0) {
        tex2Dstore(AFXTemp1::s_RenderTex, id.xy, tex2Dfetch(Common::AcerolaBuffer, id.xy));
    }
}

technique AFX_PixelSort < ui_label = "Pixel Sort"; ui_tooltip = "(EXTREMELY HIGH PERFORMANCE COST) Sort the game pixels."; > {
    pass {
        ComputeShader = CS_CreateMask<8, 8>;
        DispatchSizeX = BUFFER_WIDTH / 8;
        DispatchSizeY = BUFFER_HEIGHT / 8;
    }

#if AFX_DEBUG_MASK != 0
    pass {
        RenderTarget = Common::AcerolaBufferTex;

        VertexShader = PostProcessVS;
        PixelShader = PS_DebugMask;
    }
#else
    pass {
        ComputeShader = CS_CreateSortValues<8, 8>;
        DispatchSizeX = BUFFER_WIDTH / 8;
        DispatchSizeY = BUFFER_HEIGHT / 8;
    }
    
    pass {
        ComputeShader = CS_ClearBuffers<8, 8>;
        DispatchSizeX = BUFFER_WIDTH / 8;
        DispatchSizeY = BUFFER_HEIGHT / 8;
    }

    pass {
        ComputeShader = CS_IdentifySpans<1, 1>;
#if AFX_HORIZONTAL_SORT == 0
        DispatchSizeX = BUFFER_WIDTH;
        DispatchSizeY = 1;
#else
        DispatchSizeX = 1;
        DispatchSizeY = BUFFER_HEIGHT;
#endif
    }

#if AFX_DEBUG_SPANS != 0
    pass {
        ComputeShader = CS_VisualizeSpans<1, 1>;
        DispatchSizeX = BUFFER_WIDTH;
        DispatchSizeY = BUFFER_HEIGHT;
    }
#else
    pass {
        ComputeShader = CS_PixelSort<1, 1>;
        DispatchSizeX = BUFFER_WIDTH;
        DispatchSizeY = BUFFER_HEIGHT;
    }

    pass {
        ComputeShader = CS_Composite<8, 8>;
        DispatchSizeX = BUFFER_WIDTH / 8;
        DispatchSizeY = BUFFER_HEIGHT / 8;
    }
#endif

    pass EndPass {
        RenderTarget = Common::AcerolaBufferTex;

        VertexShader = PostProcessVS;
        PixelShader = PS_EndPass;
    }
#endif
}