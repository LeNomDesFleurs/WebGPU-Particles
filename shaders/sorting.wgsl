
const AFX_DEBUG_MASK:i32 = 0;
const AFX_DEBUG_SPANS:i32 = 0;
const AFX_HORIZONTAL_SORT:i32 = 0;

// -------------------UNIFORMS


struct Uniforms{
// Adjust the threshold at which dark pixels are omitted from the mask.
// 0.0 - 0.5
    _LowThreshold:f32,
// Adjust the threshold at which bright pixels are omitted from the mask.
// 0.5 - 1.0
    _HighThreshold:f32,
// Invert sorting mask.
    _InvertMask:f32,
// Adjust the random offset of each segment to reduce uniformity.
// -0.01 - 0.01
    _MaskRandomOffset:f32,
// Animate the random offset
// 0 - 30
    _AnimationSpeed:f32,
// Adjust the max length of sorted spans. This will heavily impact performance.
// 0 - 256
    _SpanLimit:f32,
// Adjust the random length offset of limited spans to reduce uniformity.
// 1-64
    _MaxRandomOffset:f32,
/*
What color information to sort by
0 "Luminance\0"
1 "Saturation\0"
2 "Hue\0",
*/
     _SortBy:f32,
 _ReverseSorting:f32,
// Adjust gamma of sorted pixels to accentuate them.
// 0.1 - 5.0
 _SortedGamma:f32,
 _FrameTime:f32, 
 BUFFER_WIDTH:f32,
 BUFFER_HEIGHT:f32,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var inputTexture: texture_2d<f32>;
@group(0) @binding(3) var outputTexture: texture_storage_2d<rgba8unorm, write>;
//storage Buffers
@group(0) @binding(4) var s_Mask: texture_storage_2d<r32sint, read_write>;
@group(0) @binding(5) var s_SortValue: texture_storage_2d<r32float, read_write>;
@group(0) @binding(6) var s_SpanLengths: texture_storage_2d<r32uint, read_write>;



const AFX_EPSILON: f32= 0.001;

   fn RGBtoHCV(RGB:vec3f)->vec3f {
        // Based on work by Sam Hocevar and Emil Persson
        var P:vec4f;
        if (RGB.g < RGB.b) 
        { 
            P=vec4f(RGB.bg, -1.0, 2.0/3.0);
        } else {
            P=vec4f(RGB.gb, 0.0, -1.0/3.0);
        }
        var Q:vec4f;
        if (RGB.r < P.x){
            Q = vec4f(P.xyw, RGB.r);
        } else {
            Q = vec4f(RGB.r, P.yzx);
        }
        let C:f32 = Q.x - min(Q.w, Q.y);
        let H:f32 = abs((Q.w - Q.y) / (6 * C + AFX_EPSILON) + Q.z);
        return vec3f(H, C, Q.x);
    }

    fn RGBtoHSL(RGB:vec3f)->vec3f {
        let HCV:vec3f = RGBtoHCV(RGB);
        let L:f32 = HCV.z - HCV.y * 0.5;
        let S:f32 = HCV.y / (1 - abs(L * 2 - 1) + AFX_EPSILON);
        return vec3f(HCV.x, S, L);
    }

fn hash(nn:u32)->f32 {

    var n:u32 =nn;
    // integer hash copied from Hugo Elias
	// n = (n << 13) ^ n;
    // n = n * (n * n * 15731 + u32(0x789221)) + u64(0x1376312589);
    // return f32(n & u32(0x7fffffff)) / f32(0x7fffffff);
    return 0.2f;
}


 fn Luminance(color:vec3f)->f32 {
        return max(0.00001f, dot(color, vec3f(0.2127f, 0.7152f, 0.0722f)));
    }


@compute @workgroup_size(8, 8)
fn CS_CreateMask(@builtin(global_invocation_id) id: vec3u) {
    // var pixelSize:vec2f = vec2f(f32(uni.BUFFER_HEIGHT), f32(uni.BUFFER_WIDTH));

// #if AFX_HORIZONTAL_SORT == 0
    var seed: u32  = id.x * u32(uni.BUFFER_WIDTH);
// #else
    // seed: u32 = id.y * BUFFER_HEIGHT;
// #endif

    // rand:f32 = hash(seed + (_FrameTime * _AnimationSpeed)) * _MaskRandomOffset;
    // no animation
    // var rand:f32 = 0.f;//hash(seed);

    // var uv:vec2u = vec2u(vec2f(id.xy) / vec2f(f32(uni.BUFFER_HEIGHT), f32(uni.BUFFER_WIDTH)));
    
// #if AFX_HORIZONTAL_SORT == 0
    // uv.y = uv.y + u32(rand);
// #else
    // uv.x += rand;
// #endif

    var col: vec4f = textureLoad(inputTexture, id.xy, u32(0));

    var l:f32 = Luminance(col.rgb);

    var result:i32 = 1;

    if (l < uni._LowThreshold || uni._HighThreshold < l)
       { result = 0;}
    
    var r:i32 = result;

    if (uni._InvertMask==1)
    {
        r = 1-result;
    }

        textureStore(s_Mask, id.xy, vec4(r));
        
}

@compute @workgroup_size(1, 1)
fn CS_VisualizeSpans(@builtin(global_invocation_id) id: vec3u) {
    var spanLength:u32 = textureLoad(s_SpanLengths, id.xy).r;

    if (spanLength >= 1) {
        var seed:u32 = id.x + u32(uni.BUFFER_WIDTH) * id.y + u32(uni.BUFFER_WIDTH) * u32(uni.BUFFER_HEIGHT);
        var c:vec4f = vec4f(hash(seed), hash(seed * 2), hash(seed * 3), 1.0f);

        for (var i:u32 = 0; i < spanLength; i++) {
// #if AFX_HORIZONTAL_SORT == 0
            var idx:vec2u = vec2u(id.x, id.y + i);
// #else
//             uint2 idx = uint2(id.x + i, id.y);
// #endif

            textureStore(outputTexture, idx, vec4(c));
        }
    }
}

@compute @workgroup_size(8, 8)
fn CS_CreateSortValues(@builtin(global_invocation_id) id: vec3u) {
    var col:vec4f = textureLoad(inputTexture, id.xy, u32(0));

    var hsl:vec3f = RGBtoHSL(col.rgb);

    var output:f32 = 0.0f;

    if (uni._SortBy == 0)
        {output = hsl.b;}
    else if (uni._SortBy == 1)
       { output = hsl.g;}
    else
       { output = hsl.r;}

    textureStore(s_SortValue, id.xy, vec4(output));
    
}

@compute @workgroup_size(8, 8)
fn CS_ClearBuffers(@builtin(global_invocation_id) id: vec3u) {
    textureStore(s_SpanLengths, id.xy, vec4(0));
    // textureStore(AFXTemp1::s_RenderTex, id.xy, 0);
    
}


@compute @workgroup_size(1, 1)
fn CS_IdentifySpans(@builtin(global_invocation_id) id: vec3u) {
    var seed:u32 = id.x + u32(uni.BUFFER_WIDTH) * id.y + u32(uni.BUFFER_WIDTH) * u32(uni.BUFFER_HEIGHT);
    var idx:vec2u = vec2u(0);
    var pos:u32 = 0;
    var spanStartIndex:u32 = 0;
    var spanLength:u32 = 0;

// #if AFX_HORIZONTAL_SORT == 0
    var screenLimit:u32 = u32(uni.BUFFER_HEIGHT);
// #else
    // screenLimit:u32 = BUFFER_WIDTH;
// #endif

    var spanLimit:u32 = u32(f32(uni._SpanLimit) - (hash(seed) * f32(uni._MaxRandomOffset)));

    while (pos < screenLimit) {
// #if AFX_HORIZONTAL_SORT == 0
        idx = vec2u(id.x, pos);
// #else
        // idx = vec2u(pos, id.y);
// #endif

        var mask:i32 = textureLoad(s_Mask, idx).r;
        pos++;

        if (mask == 0 || spanLength >= spanLimit) {
// #if AFX_HORIZONTAL_SORT == 0
            idx = vec2u(id.x, spanStartIndex);
// #else
            // idx = vec2u(spanStartIndex, id.y);
// #endif
var masking:u32;
if (mask==1) {masking = spanLength + 1;} else {masking = spanLength;}
            textureStore(s_SpanLengths, idx, vec4(spanLength, 0, 0, 0));
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
        textureStore(s_SpanLengths, idx, vec4(spanLength, 0, 0, 0));
    }


    
}



@compute @workgroup_size(1, 1)
fn CS_PixelSort(@builtin(global_invocation_id) id: vec3u) {

var gs_PixelSortCache:array<f32, 256>;

    let spanLength:u32 = u32(textureLoad(s_SpanLengths, id.xy).r);

    if (spanLength >= 1) {
        var idx:vec2u= vec2u(0);
// #if AFX_HORIZONTAL_SORT == 0
        const direction: vec2u = vec2u(0, 1);
// #else
        // const uint2 direction = uint2(1, 0);
// #endif

        for (var k:u32 = 0; k < spanLength; k++) {
            idx = id.xy + k * direction;
            var temp:f32 = textureLoad(s_SortValue, idx).r;
            gs_PixelSortCache[k] = f32(temp);
        }

        var minValue:f32 = gs_PixelSortCache[0];
        var maxValue:f32 = gs_PixelSortCache[0];
        var minIndex:u32 = 0;
        var maxIndex:u32 = 0;

        for (var i:u32 = 0; i < (spanLength / 2) + 1; i++) {
            for (var j:u32 = 1; j < spanLength; j++) {
                var v:f32 = gs_PixelSortCache[j];

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

            var minIdx:vec2u = vec2u(0);
            var maxIdx:vec2u = vec2u(0);

            // if (uni._ReverseSorting==1) {
            //     minIdx = id.xy + i * direction;
            //     maxIdx = id.xy + (spanLength - i - 1) * direction;
            // } else {
                minIdx = id.xy + (spanLength - i - 1) * direction;
                maxIdx = id.xy + i * direction;
            // }
            
            var minColorIdx:vec2u = id.xy + minIndex * direction;
            var maxColorIdx:vec2u = id.xy + maxIndex * direction;
            
            // load sorted pixels
            var color = pow(abs(textureLoad(inputTexture, minColorIdx.xy, 0)),vec4f(uni._SortedGamma));
            textureStore(outputTexture, minIdx.xy, color);
            color = pow(abs(textureLoad(inputTexture, maxColorIdx.xy, 0)), vec4f(uni._SortedGamma));
            textureStore(outputTexture, maxIdx.xy, color);

            gs_PixelSortCache[minIndex] = 2;
            gs_PixelSortCache[maxIndex] = -2;
            minValue = 1;
            maxValue = -1;
        }
    }
}



@compute @workgroup_size(8, 8)
fn CS_Composite(@builtin(global_invocation_id) id: vec3u) {
    //load non sorted pixels
    if (textureLoad(s_Mask, id.xy).r == 0) {
        var color:vec4f = textureLoad(inputTexture, id.xy, 0);
        textureStore(outputTexture, id.xy, color);
    }
}
