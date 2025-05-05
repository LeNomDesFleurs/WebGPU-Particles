// #include "Includes/AcerolaFX_Common.fxh"
// #include "Includes/AcerolaFX_TempTex1.fxh"



const AFX_DEBUG_MASK:i32 = 0;
const AFX_DEBUG_SPANS:i32 = 0;
const AFX_HORIZONTAL_SORT:i32 = 0;





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

const _ReverseSorting:bool = false;

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

const BUFFER_WIDTH:i32=1000;
const BUFFER_HEIGHT:i32=1000;

@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var inputTexture: texture_2d<f32>;
@group(0) @binding(3) var outputTexture: texture_storage_2d<rgba8unorm, write>;
//storage Buffers
@group(0) @binding(4) var s_Mask: texture_storage_2d<r32sint, read_write>;
@group(0) @binding(5) var s_SortValue: texture_storage_2d<r32sint, read_write>;
@group(0) @binding(6) var s_SpanLengths: texture_storage_2d<r32float, read_write>;


@compute @workgroup_size(8, 8)
fn CS_Composite(@builtin(global_invocation_id) id: vec3u) {
    if (textureLoad(s_Mask, id.xy).r == 0) {
        textureStore(outputTexture, id.xy, textureLoad(inputTexture, inputSampler, id.xy));
    }
}

