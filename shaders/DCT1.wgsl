/// 
/// Discrete cosine transform step, where 8x8 blocs are converted into frequency space
///

struct Uniforms {
    resolution: vec2f,
};

struct OurVertexShaderOutput {
    @builtin(position) position: vec4f,
    @location(0) texcoord: vec2f,
};

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var ourSampler: sampler;
@group(0) @binding(2) var inputTexture: texture_2d<f32>;
@group(0) @binding(3) var outputTexture: texture_storage_2d<r32float, write>;

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

//Dummy vertex quad to get position for the sampling
@vertex
fn vs(@builtin(vertex_index) vertexIndex : u32) -> OurVertexShaderOutput {
    var vsOutput: OurVertexShaderOutput;

    let vertex = vertices[vertexIndex];
    // let rotate_position = uniforms.transformMatrix * vec3f(vertex.xy, 1);
    // vsOutput.position = vec4f(rotate_position, 1.0);
    vsOutput.position = vec4f(vertex.xy, 1.0, 1.0);

    vsOutput.texcoord = vertex.zw;
    return vsOutput;
}

const PI:f32= 3.1415972;
const SQRT2:f32= 0.70710678118;

const NB_LEVELS:f32= 10.;
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

/// This is the discrete cosine transform step, where 8x8 blocs are converted into frequency space

   var k:vec2f = (fsInput.position.xy % 8.)-.5;
    var K:vec2f = (fsInput.position.xy) - .5 - k;
    
    var val:vec3f = vec3(0.);
    
//This is where the DCT is performed

    for(var x:i32=0; x<8; x++){
    	for(var y:i32 =0; y<8; y++){
            var kx:f32 = 1.0;
            var ky:f32 = 1.0;
            if (k.x < 0.5){kx = SQRT2;}
            if (k.y < 0.5){ky = SQRT2;}
            var idx:vec2f = (K+vec2f(f32(x),f32(y))+.5)/uniforms.resolution.xy;
            var texture:vec3f= textureSample(inputTexture, ourSampler, idx).rgb;
            var temp: vec2f = (vec2f(f32(x),f32(y))+0.5) / 8.;
            var coef = DCTcoeff(k, temp) * kx * ky;
            val += texture * coef ;
        }
    }

    textureStore(outputTexture, vec2u(fsInput.position.xy), vec4f(val/4.0, 1.0));
    return vec4f(val, 1.0);
}




