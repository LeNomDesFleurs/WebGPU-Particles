struct Uniforms {
    resolution: vec2f,
    colorNb: f32,
    dith_strength: f32,
    bayer_filter_size: f32,
    // [0; 1]
    pixelate: f32,
};

struct OurVertexShaderOutput {
    @builtin(position) position: vec4f,
    @location(0) texcoord: vec2f,
};

struct Vertex {
    @location(0) position: vec2f,
    @location(1) texCoord: vec2f
}

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var ourSampler: sampler;
@group(0) @binding(2) var ourTexture: texture_2d<f32>;

// TODO customize BAYER_SIZE => prepare function or already intialized arrays
// TODO think -> some other dithering than bayer ? ==> what if i change this every frame ? (randomize)

@vertex
fn vs(vert: Vertex, @builtin(vertex_index) vertexIndex : u32) -> OurVertexShaderOutput {
    var vsOutput: OurVertexShaderOutput;

    vsOutput.position = vec4f(vert.position.xy, 0.0, 1.0);
    vsOutput.texcoord = vec2f(vert.texCoord.x, 1-vert.texCoord.y);
    return vsOutput;
}

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

// Getting the specific pattern from the grid
fn getBayer(uvScreenSpace: vec2f, pix:vec2f) ->f32 {
    let BAYER_SIZE = 8.0;


    // replace top line by bottom line and change the pixelate parameter to glitch the matrix
    var uv = uvScreenSpace * pix % uniforms.bayer_filter_size;
    // var uv = uvScreenSpace * uniforms.resolution % uniforms.bayer_filter_size;

    // let uv = modf(uvScreenSpace.xy, vec2f(BAYER_SIZE));
    let index = i32(uv.y * uniforms.bayer_filter_size + uv.x);
    if (uniforms.bayer_filter_size == 2.) {
        return BAYER_FILTER_2[index] / 4.;
    } else if (uniforms.bayer_filter_size == 4.) {
        return BAYER_FILTER_4[index] / 16.;
    } else {
        return BAYER_FILTER_8[index] / 64.;
    }
}

// Crushing the colors
fn quantize(channel: f32, period: f32) -> f32 {
    return floor((channel + period / 2.0) / period) * period;
}

@fragment
fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {

    var pix :vec2f = uniforms.resolution * uniforms.pixelate;
    // var pix:f32 = 500;

    let fragCoord = floor(fsInput.texcoord * pix)/pix;

    let period = vec3(1.0 / (f32(uniforms.colorNb) - 1.0));

    var output = textureSample(ourTexture, ourSampler, fragCoord).rgb;
    output += (getBayer(fragCoord, pix) - 0.5) * period * uniforms.dith_strength;
    output = vec3f(quantize(output.r, period.r), quantize(output.g, period.g), quantize(output.b, period.b));

    return vec4f(output, 1.0);
}