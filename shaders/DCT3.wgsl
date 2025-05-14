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

@vertex
fn vs(@builtin(vertex_index) vertexIndex : u32) -> OurVertexShaderOutput {
    var vsOutput: OurVertexShaderOutput;

    let vertex = vertices[vertexIndex];
    let rotate_position = uniforms.matrix * vec3f(vertex.xy, 1);
    vsOutput.position = vec4f(rotate_position, 1.0);
    // vsOutput.position = vec4f(vertex.xy, 1.0, 1.0);

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
fn fs(fsInput: OurVertexShaderOutput, @builtin(position) position: vec4f) -> @location(0) vec4f {

/// This is the reconstruction step, where each 8x8 bloc is converted back to the spatial domain

    var k:vec2f = (position.xy% 8.)-.5;
    var K:vec2f = position.xy-k-.5;
        
    var val: vec3f = vec3(0.);

    for(int u=0; u<NB_FREQ; ++u)
    	for(int v=0; v<NB_FREQ; ++v)
        {
             var ux:f32 = 1.0;
            var vy:f32 = 1.0;
            if (u ==0){ux = SQRT2;}
            if (v ==0){vy = SQRT2;}

            var coef:f32 = DCTcoeff(vec2(u,v), (k+.5)/8.) * ux * vy;
            var idx:i32 = (K+vec2(u,v)+0.5)/uniforms.resolution;
            var texture:vec2f=texture(iChannel0, idx).rgb
            val += texture * coef ;
        }
    
    return vec4f(var, 1.0);
}




