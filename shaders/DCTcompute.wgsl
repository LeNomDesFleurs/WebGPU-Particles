#include "../shaders/common.wgsl"

// This Shader simulate the compression happening when using Jpeg codec
// --------------------------------
// Stuff to tweak
// - Adding HSL conversion before and after, or only before / only after
// - Having a different number of frequences for the DCT and iDCT
// - Number of levels

struct Uniforms {
    resolution: vec2f,
    freq: f32,
};

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
@group(0) @binding(2) var outputTexture: texture_storage_2d<rgba8unorm, write>;


const PI:f32= 3.1415972;
const SQRT2:f32= 0.70710678118;

const NB_LEVELS:f32= 3.;
const NB_FREQ:i32= 8;

fn DCTcoeff(k:vec2f, x:vec2f)->f32
{
    return cos(PI*k.x*x.x)*cos(PI*k.y*x.y);
}

var<workgroup> cache1: array<array<vec3f, NB_FREQ>, NB_FREQ>;
var<workgroup> cache2: array<array<vec3f, NB_FREQ>, NB_FREQ>;

@compute @workgroup_size(8, 8)
fn compute(@builtin(global_invocation_id) global_id: vec3u, @builtin(local_invocation_id)local_id:vec3u) {



var k:vec2u = local_id.xy;
var tex = textureLoad(inputTexture, global_id.xy, 1).rgb;
// tex = RBGtoHSL(tex);
cache1[local_id.x][local_id.y]=tex;
    workgroupBarrier();

/// This is the discrete cosine transform step, where 8x8 blocs are converted into frequency space
    
    var val:vec3f = vec3(0.);
    
//This is where the DCT is performed
    
    for(var x:i32=0; x<NB_FREQ; x++){
    	for(var y:i32 =0; y<NB_FREQ; y++){
            var kx:f32 = 1.0;
            var ky:f32 = 1.0;
            if (k.x ==0){kx = SQRT2;}
            if (k.y ==0){ky = SQRT2;}
            // var idx:vec2f = (K+vec2f(f32(x),f32(y))+.5)/uniforms.resolution.xy;
            var texture:vec3f= cache1[x][y];
            var coef = DCTcoeff(vec2f(k), (vec2f(f32(x),f32(y))+0.5)/8.);
            val += texture * coef * kx * ky;
        }
    }

    cache2[local_id.x][local_id.y] = val/4.0;

    workgroupBarrier();

    //Colour quantize

   	// var fragColor:vec3f = textureLoad(tempTexture, id.xy).rgb;
    var color = cache2[local_id.x][local_id.x];
    cache2[local_id.x][local_id.x] = round(color/8.0*f32(NB_LEVELS))/f32(NB_LEVELS)*f32(NB_FREQ); 
    // if(texelFetch(iChannel2, ivec2(65, 0), 0).x<0.5)
        // this assumes data between 0 and 1.
        // fragColor = round(fragColor/8.*NB_LEVELS)/NB_LEVELS*8.;


    // textureStore(tempTexture, id.xy, vec4f(fragColor, 1.0));

    workgroupBarrier();


/// This is the reconstruction step, where each 8x8 bloc is converted back to the spatial domain


    var value: vec3f = vec3f(0.f) ;

    for(var u:i32=0; u<NB_FREQ; u++){
    	for(var v:i32=0; v<NB_FREQ; v++)
        {
            var ux:f32 = 1.0;
            var vy:f32 = 1.0;
            if (u ==0){ux = SQRT2;}
            if (v ==0){vy = SQRT2;}
            var temp: f32= DCTcoeff( vec2f(f32(u),f32(v)), vec2f(k) / 8 );
            var coef:f32 =  temp * ux * vy;
            // var idx:vec2f = (K+vec2(f32(u),f32(v))+0.5)/ uniforms.resolution.xy;
            var texture:vec3f=cache2[u][v];
            // if ((u == 2 && v==2) || (u==3 && v==3)|| (u==3 && v==4)){
            // texture=cache2[0][0];
            // }
            value += texture * coef ;
        }
    }

    value = value / 4.0;
    // value = HSLtoRGB(value);
    var output = vec4f(value, 1.0);
    textureStore(outputTexture, global_id.xy, output);
}




