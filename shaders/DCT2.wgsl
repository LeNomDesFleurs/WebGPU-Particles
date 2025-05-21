struct Uniforms {
    resolution: vec2f,
    transformMatrix: mat3x3f,
};

struct OurVertexShaderOutput {
    @builtin(position) position: vec4f,
    @location(0) texcoord: vec2f,
};

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var ourSampler: sampler;
@group(0) @binding(2) var inputTexture: texture_2d<f32>;
@group(0) @binding(3) var outputTexture: texture_storage_2d<rgba8unorm, write>;

const vertices = array(
        // 1st triangle
        vec4f( -1.0, -1.0, 0.0,  0.0),  // center
        vec4f(1.0, -1.0, 1.0,  0.0),  // right, center
        vec4f(-1.0, 1.0, 0.0,  1.0),  // center, top

        // 2nd triangle
        vec4f(-1.0, 1.0, 0.0,  1.0),  // center, top
        vec4f( 1.0, -1.0, 1.0,  0.0),  // right, center
        vec4f( 1.0, 1.0, 1.0,  1.0),  // right, top
);

@vertex
fn vs(@builtin(vertex_index) vertexIndex : u32) -> OurVertexShaderOutput {
    var vsOutput: OurVertexShaderOutput;

    let vertex = vertices[vertexIndex];
    // let rotate_position = uniforms.transformMatrix * vec3f(vertex.xy, 1);
    // vsOutput.position = vec4f(rotate_position, 1.0);
    vsOutput.position = vec4f(vertex.xy, 0.0, 1.0);
    vsOutput.texcoord = vec2f(vertex.z, vertex.w);

    // vsOutput.texcoord = vertex.zw;
    return vsOutput;
}

const PI:f32= 3.1415972;
const SQRT2:f32= 0.70710678118;

const NB_LEVELS:f32= 4.;
//#define NB_LEVELS (1.+5.*fragCoord.x/iResolution.x)
//#define NB_LEVELS (1.+7.*iMouse.x/iResolution.x)
//#define NB_LEVELS floor(1.+7.*iMouse.x/iResolution.x)
//#define NB_LEVELS (1.+5.*(.5+.5*sin(iTime)))

// You may change the number of frequencies used for the reconstruction for achieving different effects.
const NB_FREQ:i32= 8;
//#define NB_FREQ		int(mod(iTime, 7.)+1.)

fn DCTcoeff(k:vec2f, x:vec2f)->f32
{
    return cos(PI*k.x*x.x)*cos(PI*k.y*x.y);
}

@fragment
fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
    
        	var fragColor:vec3f = textureSample(inputTexture, ourSampler, vec2f(fsInput.texcoord.x, fsInput.texcoord.y )).rgb;
    
    // if(texelFetch(iChannel2, ivec2(65, 0), 0).x<0.5)
        // this assumes data between 0 and 1.
        // fragColor = round(fragColor/8.*NB_LEVELS)/NB_LEVELS*8.;


    textureStore(outputTexture, vec2u(fsInput.texcoord.xy*1000), vec4f(fragColor, 1.0));

    return vec4f(fragColor, 1.0);
}




