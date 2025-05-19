// -----------------------------------------

// Source :
// DCT algo on Shader Toy by  Ultraviolet : https://www.shadertoy.com/view/XtffDj
// HSL convertion from acerola : https://github.com/GarrettGunnell/AcerolaFX/blob/main/Shaders/Includes/AcerolaFX_Common.fxh

// -----------------------------------------

// Interesting stuff to tweak
// -o HSL -> DCT -> FX -> iDCT -> iHSL o-
// -o HSL -> DCT -> FX -> iDCT o-
// -o DCT -> FX -> iDCT -> iHSL o-
// Reusing [0; 0] frequency


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

const NB_LEVELS:f32= 8.;
const NB_FREQ:i32= 8;
var<workgroup> cache1: array<array<vec3f, NB_FREQ>, NB_FREQ>;
var<workgroup> cache2: array<array<vec3f, NB_FREQ>, NB_FREQ>;

fn DCTcoeff(k:vec2f, x:vec2f)->f32
{
    return cos(PI*k.x*x.x)*cos(PI*k.y*x.y);
}

// Lirabry

const AFX_EPSILON: f32= 0.001;


  fn RGBtoHCV(RGB:vec3f)->vec3f {
    //stole from acerola FX
        // Based on work by Sam Hocevar and Emil Persson
        var P:vec4f;
        if (RGB.g < RGB.b) 
        { 
            P=vec4f(RGB.bg, -1.0, 2.0/3.0);
        } else {
            P=vec4f(RGB.gb, 0.0, -1.0/3.0);
        }
        var Q:vec4f;
        if (RGB.r < P.x){
            Q = vec4f(P.xyw, RGB.r);
        } else {
            Q = vec4f(RGB.r, P.yzx);
        }
        let C:f32 = Q.x - min(Q.w, Q.y);
        let H:f32 = abs((Q.w - Q.y) / (6 * C + AFX_EPSILON) + Q.z);
        return vec3f(H, C, Q.x);
    }

    fn RGBtoHSL(RGB:vec3f)->vec3f {
        let HCV:vec3f = RGBtoHCV(RGB);
        let L:f32 = HCV.z - HCV.y * 0.5;
        let S:f32 = HCV.y / (1 - abs(L * 2 - 1) + AFX_EPSILON);
        return vec3f(HCV.x, S, L);
    }

    fn HUEtoRGB(H:f32)->vec3f {
        var R:f32 = abs(H * 6 - 3) - 1;
        var G:f32 = 2 - abs(H * 6 - 2);
        var B:f32 = 2 - abs(H * 6 - 4);
        return vec3f(R,G,B);
    }

    fn HSLtoRGB(HSL:vec3f)->vec3f {
        var RGB: vec3f = HUEtoRGB(HSL.x);
        var C:f32 = (1 - abs(2 * HSL.z - 1)) * HSL.y;
        return (RGB - 0.5) * C + HSL.z;
    }

// the workgroup is a block of NB_FREQ_NBFREQ threads, where each thread is a pixel of the block
@compute @workgroup_size(8, 8)
fn compute(@builtin(global_invocation_id) global_id: vec3u, @builtin(local_invocation_id)local_id:vec3u) {

// Here I extract the NB_FREQxNB_FREQ pixel block from the texture to local memory to optimize memory query and ease the process
// cache data is shared among all thread of the same workgroup (i.e. every pixel on the same NB_FREQxNB_FREQ block)

// local coord (i.e. coord in the block)
var k:vec2u = local_id.xy;

var tex = textureLoad(inputTexture, global_id.xy, 1).rgb;
// tex = RGBtoHSL(tex);
cache1[local_id.x][local_id.y]=tex;
    workgroupBarrier();

/// This is the discrete cosine transform step, where 8x8 blocs are converted into frequency space
    
    var value:vec3f = vec3(0.);
    for(var x:i32=0; x<NB_FREQ; x++){
    	for(var y:i32 =0; y<NB_FREQ; y++){
            var kx = select(1.0, SQRT2, k.x==0 );
            var ky = select(1.0, SQRT2, k.y==0 );
            var coord:vec2f = vec2f(f32(x),f32(y));
            var coef = DCTcoeff(vec2f(k), (coord+0.5)/8.) * kx * ky;
            var texture:vec3f= cache1[x][y];
            value += texture * coef;
        }
    }

    cache2[local_id.x][local_id.y] = value/4.0;

    // this wait for all thread to have calculated their frequencies before proceeding
    // some blocks might disappear if you remove it
    workgroupBarrier();

    // Welcome to the frequency space !
    // Here, the block doesn't contain a picture anymore, but a list of frequencies you can alter

    //retrieve color from the cache
    var color = cache2[local_id.x][local_id.x];
    //Colour quantize
    cache2[local_id.x][local_id.x] = round(color/8.0*f32(NB_LEVELS))/f32(NB_LEVELS)*f32(NB_FREQ); 

    workgroupBarrier();

/// This is the reconstruction step, where each block is converted back to the spatial domain

    // reuse value variable, zero it down
    value=vec3f(0.f) ;

    for(var u:i32=0; u<NB_FREQ; u++){
    	for(var v:i32=0; v<NB_FREQ; v++)
        {
            var Cu = select(1.0, SQRT2, u==0);
            var Cv = select(1.0, SQRT2, v==0);
            var coord = vec2f(f32(u),f32(v));
            var temp: f32= DCTcoeff( coord, vec2f(k) / 8 );
            var coef:f32 = temp * Cu * Cv;
            var texture:vec3f=cache2[u][v];
            
            // Uncomment to mess with the frequencies and add patterns to the image
            // if ((u == 2 && v==2) || (u==7 && v==7)|| (u==4 && v==4)){ //change value to modify the pattern
            // texture=cache2[0][0];
            // }

            value += texture * coef ;
        }
    }

    value = value / 4.0;

    // uncomment to mess with HSL values
    // value = HSLtoRGB(value);

    // format output
    var output = vec4f(value, 1.0);
    textureStore(outputTexture, global_id.xy, output);
}




