struct Uniforms {
    resolution: vec2f,
    // transformMatrix: mat3x3f,
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
    // let rotate_position = uniforms.matrix * vec3f(vertex.xy, 1);
    // vsOutput.position = vec4f(rotate_position, 1.0);
    vsOutput.position = vec4f(vertex.xy, 1.0, 1.0);
    vsOutput.texcoord = vec2f(vertex.z, vertex.w);
    // vsOutput.texcoord = vertex.zw;
    return vsOutput;
}



const PI:f32= 3.1415972;
const SQRT2:f32= 0.70710678118;

// You may change the number of frequencies used for the reconstruction for achieving different effects.
const NB_FREQ:f32= 8.f;
//#define NB_FREQ		int(mod(iTime, 7.)+1.)

fn DCTcoeff(k:vec2f, x:vec2f)->f32
{
    return cos(PI*k.x*x.x)*cos(PI*k.y*x.y);
}

@fragment
fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {

/// This is the reconstruction step, where each 8x8 bloc is converted back to the spatial domain

    var k:vec2f = ((fsInput.texcoord.xy*1000) % vec2f(8.0))+0.5;
    var K:vec2f = ((fsInput.texcoord.xy*1000) - k)+0.5;

    var debug=k;

    var value: vec3f = vec3f(0.f) ;

    for(var u:f32=0; u<NB_FREQ; u+=1.f){
    	for(var v:f32=0; v<NB_FREQ; v+=1.f)
        {
            var Cu:f32 = 1.0;
            var Cv:f32 = 1.0;
            if (u ==0){Cu = SQRT2;}
            if (v ==0){Cv = SQRT2;}
            var temp: f32= DCTcoeff( vec2f(u,v), (k) / 8. );
            var coef:f32 =  temp * Cu * Cv;
            var cos1:f32 = u * PI * ((2*k.x)+1.)/(NB_FREQ*2.f);
            var cos2:f32 = v * PI * ((2*k.y)+1.)/(NB_FREQ*2.f);
            coef = cos1 * cos2 * Cu * Cv;

            var idx:vec2f = (K+vec2(u,v)+0.5)/1000.f;
            // value += (textureSample  (inputTexture, ourSampler, (((k+vec2f(u,v)))/1000.f))).rgb * DCTcoeff(vec2(u,v), (k)/8.) * (Cu) * (Cv);

            coef = DCTcoeff(vec2(u,v), (k+.5)/8.) * Cu * Cv;
            var texture:vec3f=textureSample(inputTexture, ourSampler, vec2f(idx.x,idx.y )).rgb;

            // var texture:vec3f=textureSample(inputTexture, ourSampler, vec2f(K/1000)).rgb;
            value += coef * texture;
        }
    }

    // value=textureSample(inputTexture, ourSampler, vec2f(K/1000)).rgb;

    return vec4f(value, 1.0);
}




