// Source Code: https://www.shadertoy.com/view/XscXRl

struct Uniforms {
    resolution: vec2f,
    op:i32,// op 1:   0: neutral  1: dilatation   2 : erosion
    r:f32,
    brush_type:i32,// brush:  0: disk 1:  star  2: diamond  3: square 
    p:f32,
};

struct OurVertexShaderOutput {
    @builtin(position) position: vec4f,
    @location(0) texcoord: vec2f,
};

struct Vertex {
    @location(0) position: vec2f,
    @location(1) texCoord: vec2f
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var ourSampler: sampler;
@group(0) @binding(2) var ourTexture: texture_2d<f32>;

// TODO customize BAYER_SIZE => prepare function or already intialized arrays
// TODO think -> some other dithering than bayer ? ==> what if i change this every frame ? (randomize)

@vertex
fn vs(vert: Vertex, @builtin(vertex_index) vertexIndex : u32) -> OurVertexShaderOutput {
    var vsOutput: OurVertexShaderOutput;

    vsOutput.position = vec4f(vert.position.xy, 0.0, 1.0);
    vsOutput.texcoord = vec2f(vert.texCoord.x, 1-vert.texCoord.y);
    return vsOutput;
}

fn brush(d:vec2f) -> bool {   
    var b:vec2f = abs(d);
    if (uniforms.brush_type == 0){
       return dot(b,b) <= uniforms.r*uniforms.r;
    } else if (uniforms.brush_type == 1){
        return pow(b.x,uniforms.p)+pow(b.y,uniforms.p) <= pow(uniforms.r,uniforms.p);
    } else if (uniforms.brush_type == 2){
        return b.x+b.y < uniforms.r ;
    } else {
        return max(b.x,b.x*.5+b.y*.87) < uniforms.r;
    }

}


  

@fragment
fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
    let fragCoord = fsInput.texcoord;

    var output:vec4f = vec4f(textureSample(ourTexture, ourSampler, fragCoord).rgb, 0);

  var R:vec2f = uniforms.resolution;

    var m:vec4f=vec4(1e9);
    var M:vec4f=-m;

	for (var y:f32 = -uniforms.r; y<=uniforms.r; y=y+1.0){
	  for (var x:f32 = -uniforms.r; x<=uniforms.r; x=x+1.0){
        var d:vec2f=vec2f(x,y);
          if (brush(d)) {
              var t:vec4f = textureSample(ourTexture, ourSampler, fragCoord + (d/uniforms.resolution) );
              m = min(m,t); M = max(M,t);
          }
    }}
    if(uniforms.op==1) 
    {
    output = M;
    } else {                 // dilatation
    output = m;
    }                 // erosion

    return output;
}