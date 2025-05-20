// Dithering : can prevent 'color banding' - breaks up the flat areas into small structured patterns, tricking the eyes into seeing smoother transitions.
// Dither : nudging pixel values slightly up or down to better simulate gradients, even with a reduced number of colors 
struct Uniforms {
    resolution: vec2f,
    levels_per_channel: f32, // allowed number of levels (color values between 0. and 1.) per channel (rgb)
    dith_strength: f32,
    bayer_filter_size: f32,
    randomize_r: f32,
    randomize_g: f32,
    randomize_b: f32
};

struct OurVertexShaderOutput {
    @builtin(position) position: vec4f,
    @location(0) texcoord: vec2f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var uSampler: sampler;
@group(0) @binding(2) var uTexture: texture_2d<f32>;

// TODO think -> some other dithering than bayer ? ==> what if i change this every frame ? (randomize)

const VERTICES = array(
    // 1st triangle
    vec4f( -1.0, -1.0, 0.0,  0.0),  // center
    vec4f(1.0, -1.0, 1.0,  0.0),  // right, center
    vec4f(-1.0, 1.0, 0.0,  1.0),  // center, top

    // 2nd triangle
    vec4f(-1.0, 1.0, 0.0,  1.0),  // center, top
    vec4f( 1.0, -1.0, 1.0,  0.0),  // right, center
    vec4f( 1.0, 1.0, 1.0,  1.0),  // right, top
);

// Bayer dithering (ordered dithering) : uses a repeating matrix of pre-defined values 
const BAYER_FILTER_2 = array(
    0., 2.,
    3., 1.
);

const BAYER_FILTER_4 = array(
    0., 8., 2., 10.,
    12., 4., 14., 6.,
    3., 11., 1., 9.,
    15., 7., 13., 5.
);

const BAYER_FILTER_8 = array(
    0., 32.,  8., 40.,  2., 34., 10., 42.,
    48., 16., 56., 24., 50., 18., 58., 26.,
    12., 44.,  4., 36., 14., 46.,  6., 38.,
    60., 28., 52., 20., 62., 30., 54., 22.,
    3., 35., 11., 43.,  1., 33.,  9., 41.,
    51., 19., 59., 27., 49., 17., 57., 25.,
    15., 47.,  7., 39., 13., 45.,  5., 37.,
    63., 31., 55., 23., 61., 29., 53., 21.
);

@vertex
fn vs(@builtin(vertex_index) vertexIndex : u32) -> OurVertexShaderOutput {
    var vsOutput: OurVertexShaderOutput;

    let vertex = VERTICES[vertexIndex];
    vsOutput.position = vec4f(vertex.xy, 0.0, 1.0);
    vsOutput.texcoord = vertex.zw;
    return vsOutput;
}

fn getBayerValue(uvScreenSpace: vec2f) ->f32 {
    let bayerCoords = (uvScreenSpace * uniforms.resolution) % uniforms.bayer_filter_size;

    // Bayer filter value then normalized by the maximum size
    let index = i32(bayerCoords.y * uniforms.bayer_filter_size + bayerCoords.x);
    var value = 0.5;
    if (uniforms.bayer_filter_size == 2.) {
        value = BAYER_FILTER_2[index] / 4.;
    } else if (uniforms.bayer_filter_size == 4.) {
        value = BAYER_FILTER_4[index] / 16.;
    } else {
        value = BAYER_FILTER_8[index] / 64.;
    }

    // set range from -0.5 to 0.5
    return value - 0.5; 
}

// Quantization: the process of reducing the number of possible values (only a fixed number of discrete values)
fn quantize(col: f32, quantStep: f32) -> f32 {
    let centered = col + quantStep / 2.0; // Add the half of the quant step to determine which level the value belongs to (centered between levels).
    let level = floor(centered / quantStep);
    return level * quantStep;
}

fn random(uv: vec2f) -> f32 {
    return fract(sin(dot(uv, vec2f(12.9898, 78.233))) * 43758.5453);
}

@fragment
fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
    // quantization step : the space between allowed color values.
    let quantStep: f32 = 1.0 / (uniforms.levels_per_channel - 1.0); 

    var imageCol = textureSample(uTexture, uSampler, fsInput.texcoord).rgb;
    imageCol += getBayerValue(fsInput.texcoord) * quantStep * uniforms.dith_strength;

    let randCol : f32 = random(fsInput.texcoord);
    return vec4f(
        select(quantize(imageCol.r, quantStep), randCol, uniforms.randomize_r != 0.0),
        select(quantize(imageCol.g, quantStep), randCol, uniforms.randomize_g != 0.0),
        select(quantize(imageCol.b, quantStep), randCol, uniforms.randomize_b != 0.0),
        1.0
    );
}