

struct Uniforms {
    resolution: vec2f,
};

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;
@group(0) @binding(2) var inputTexture: texture_2d<f32>;
@group(0) @binding(3) var tempTexture: texture_storage_2d<r32float, read_write>;
@group(0) @binding(4) var outputTexture: texture_storage_2d<r32float, read_write>;


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

@compute(8, 8)
fn compute(@builtin(global_invocation_id) id: vec3u) -> @location(0) vec4f {


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
            var texture:vec3f= textureLoad(inputTexture, idx).rgb;
            var temp: vec2f = (vec2f(f32(x),f32(y))+0.5) / 8.;
            var coef = DCTcoeff(k, temp) * kx * ky;
            val += texture * coef ;
        }
    }

    textureStore(outputTexture, vec2u(fsInput.position.xy), vec4f(val/4.0, 1.0));

    workgroupBarrier()

    //Colour quantize

   	var fragColor:vec3f = textureLoad(tempTexture, ourSampler, id.xy).rgb;
    
    // if(texelFetch(iChannel2, ivec2(65, 0), 0).x<0.5)
        // this assumes data between 0 and 1.
        fragColor = round(fragColor/8.*NB_LEVELS)/NB_LEVELS*8.;


    textureStore(tempTexture, id.xy, vec4f(fragColor, 1.0));

    workgroupBarrier()


/// This is the reconstruction step, where each 8x8 bloc is converted back to the spatial domain

    var k:vec2f = (fsInput.position.xy % 8.) - 0.5;
    var K:vec2f = (fsInput.position.xy - k) - 0.5;

    var value: vec3f = vec3f(0.f) ;

    for(var u:i32=0; u<NB_FREQ; u++){
    	for(var v:i32=0; v<NB_FREQ; v++)
        {
             var ux:f32 = 1.0;
            var vy:f32 = 1.0;
            if (u ==0){ux = SQRT2;}
            if (v ==0){vy = SQRT2;}
            var temp: f32= DCTcoeff( vec2f(f32(u),f32(v)), (k+.5) / 8. );
            var coef:f32 =  temp * ux * vy;
            var idx:vec2f = (K+vec2(f32(u),f32(v))+0.5)/ uniforms.resolution.xy;
            var texture:vec3f=textureLoad(tempTexture, idx).rgb;
            value += texture * coef ;
        }
    }

    textureStore(outputTexture, id.xy, vec4f(value, 1.0));

}




