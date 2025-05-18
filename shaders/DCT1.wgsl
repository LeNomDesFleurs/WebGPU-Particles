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

//Dummy vertex quad to get position for the sampling
@vertex
fn vs(@builtin(vertex_index) vertexIndex : u32) -> OurVertexShaderOutput {
    var vsOutput: OurVertexShaderOutput;

    let vertex = vertices[vertexIndex];
    // let rotate_position = uniforms.transformMatrix * vec3f(vertex.xy, 1);
    // vsOutput.position = vec4f(rotate_position, 1.0);
    vsOutput.position = vec4f(vertex.x, vertex.y, 1.0, 1.0);

    vsOutput.texcoord = vec2f(vertex.z, vertex.w);
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
const NB_FREQ:f32=8;
//#define NB_FREQ		int(mod(iTime, 7.)+1.)

fn DCTcoeff(k:vec2f, x:vec2f)->f32
{
    return cos(PI*k.x*x.x)*cos(PI*k.y*x.y);
}

@fragment
fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {

/// This is the discrete cosine transform step, where 8x8 blocs are converted into frequency space



   var k:vec2f = ((fsInput.texcoord.xy *1000) % 8.)-.5;
    var K:vec2f = (fsInput.texcoord.xy*1000) - k - .5;
    
    var val:vec3f = vec3(0.);
    
//This is where the DCT is performed

    for(var x:f32=0; x<NB_FREQ; x+=1.0){
    	for(var y:f32 =0; y<NB_FREQ; y+=1.0){
            var kx:f32 = 1.0;
            var ky:f32 = 1.0;
            if (k.x < 0.5){kx = SQRT2;}
            if (k.y < 0.5){ky = SQRT2;}
            var idx:vec2f = (K+vec2f(f32(x),f32(y)))/uniforms.resolution.xy;
            var texture:vec3f= textureSample(inputTexture, ourSampler, vec2f(idx.x, idx.y)).rgb;
            var temp: vec2f = (vec2f(f32(x),f32(y))) / f32(NB_FREQ);
            var coef = DCTcoeff(k, temp) * kx * ky;
            // val += texture * coef ;
            val += (textureSample(inputTexture, ourSampler,(K+vec2(x,y)+.5)/uniforms.resolution.xy).rgb) * DCTcoeff(k, (vec2(x,y)+0.5)/8.) * kx * ky;

        }
    }

    textureStore(outputTexture, vec2u(fsInput.texcoord.xy*1000), vec4f(val, 1.0));
    return vec4f(val, 1.0);
    // return vec4f(fsInput.texcoord.xy, 1.0, 1.0);
    // return vec4f(fsInput.position.xy/1000, 1.0, 1.0);
}




