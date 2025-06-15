


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

};

struct OurVertexShaderOutput {
    @builtin(position) position: vec4f,
    @location(0) texcoord: vec2f,
};

struct Vertex {
    @location(0) position: vec2f,
    @location(1) texCoord: vec2f
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var ourSampler: sampler;
@group(0) @binding(2) var inputTexture: texture_2d<f32>;

@vertex
fn vs(vert: Vertex, @builtin(vertex_index) vertexIndex : u32) -> OurVertexShaderOutput {
    var vsOutput: OurVertexShaderOutput;
    vsOutput.position = vec4f(vert.position.xy, 0.0, 1.0);
    vsOutput.texcoord = vec2f(vert.texCoord.x, 1-vert.texCoord.y);
    return vsOutput;

}


@fragment
fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {

    var pix:f32 = 500;

    let fragCoord = floor(fsInput.texcoord * pix)/pix;

    var output:vec4f = vec4f(textureSample(inputTexture, ourSampler, fragCoord).rgb, 0.0);

    return output;
}