


struct Uniforms {
    //  resolution: vec2f,
    // angle: f32,
    matrix: mat3x3f,
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
    var position = vec3f(vert.position.xy, 1.0);
    position = position * uniforms.matrix;
    vsOutput.position = vec4f(position, 1.0);

    vsOutput.texcoord = vec2f(vert.texCoord.x, 1-vert.texCoord.y);
    return vsOutput;

}


@fragment
fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {

    var output:vec4f = vec4f(textureSample(inputTexture, ourSampler, fsInput.texcoord).rgb, 0.0);

    return output;
}