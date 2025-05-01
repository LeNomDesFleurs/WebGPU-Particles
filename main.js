
const mat3 = {
    multiply(a, b) {
      const a00 = a[0 * 3 + 0];
      const a01 = a[0 * 3 + 1];
      const a02 = a[0 * 3 + 2];
      const a10 = a[1 * 3 + 0];
      const a11 = a[1 * 3 + 1];
      const a12 = a[1 * 3 + 2];
      const a20 = a[2 * 3 + 0];
      const a21 = a[2 * 3 + 1];
      const a22 = a[2 * 3 + 2];
      const b00 = b[0 * 3 + 0];
      const b01 = b[0 * 3 + 1];
      const b02 = b[0 * 3 + 2];
      const b10 = b[1 * 3 + 0];
      const b11 = b[1 * 3 + 1];
      const b12 = b[1 * 3 + 2];
      const b20 = b[2 * 3 + 0];
      const b21 = b[2 * 3 + 1];
      const b22 = b[2 * 3 + 2];
  
      return [
        b00 * a00 + b01 * a10 + b02 * a20,
        b00 * a01 + b01 * a11 + b02 * a21,
        b00 * a02 + b01 * a12 + b02 * a22,
        b10 * a00 + b11 * a10 + b12 * a20,
        b10 * a01 + b11 * a11 + b12 * a21,
        b10 * a02 + b11 * a12 + b12 * a22,
        b20 * a00 + b21 * a10 + b22 * a20,
        b20 * a01 + b21 * a11 + b22 * a21,
        b20 * a02 + b21 * a12 + b22 * a22,
      ];
    },
    translation([tx, ty]) {
      return [
        1, 0, 0,
        0, 1, 0,
        tx, ty, 1,
      ];
    },
  
    rotation(angleInRadians) {
      const c = Math.cos(angleInRadians);
      const s = Math.sin(angleInRadians);
      return [
        c, s, 0,
        -s, c, 0,
        0, 0, 1,
      ];
    },
  
    scaling([sx, sy]) {
      return [
        sx, 0, 0,
        0, sy, 0,
        0, 0, 1,
      ];
    },
  };

async function init() {
    if (!navigator.gpu) throw new Error('WebGPU not supported on the browser.')

    const adapter = await navigator.gpu.requestAdapter()
    const device = await adapter?.requestDevice()
    if (!device) throw new Error('no GPU support on the browser.')

    const canvas = document.getElementById('gfx')
    const context = canvas.getContext('webgpu')
    const format = navigator.gpu.getPreferredCanvasFormat()
    context.configure({ device, format })

    //get bitmap from url
    async function loadImageBitmap(url) {
        const res = await fetch(url);
        const blob = await res.blob();
        return await createImageBitmap(blob, { colorSpaceConversion: 'none' });
      }

      //import image, convert to bitmap, load in a texture
      const url = 'rose.jpg';
      const source = await loadImageBitmap(url);


      const texture = device.createTexture({
        label: url,
        format: 'rgba8unorm',
        size: [source.width, source.height],
        usage: GPUTextureUsage.TEXTURE_BINDING |
               GPUTextureUsage.COPY_DST |
               GPUTextureUsage.RENDER_ATTACHMENT,
      })

    const module = device.createShaderModule({
        label: 'tuto-code',
        code: `
            struct Uniforms {
                color: vec4f,
                resolution: vec2f,
                matrix: mat3x3f,
            };

            struct OurVertexShaderOutput {
                @builtin(position) position: vec4f,
                @location(0) texcoord: vec2f,
            };

            @group(0) @binding(0)
            var<uniform> uniforms: Uniforms;
            // @group(0) @binding(1) 
            // var<uniform> height: f32;
            @group(0) @binding(1) var ourSampler: sampler;
            @group(0) @binding(2) var ourTexture: texture_2d<f32>;


            @vertex
            fn vs(@builtin(vertex_index) vertexIndex : u32) -> OurVertexShaderOutput {
                  let vertices = array(
                    // 1st triangle
                    vec4f( -1.0, -1.0, 0.0,  0.0),  // center
                    vec4f(1.0, -1.0, 1.0,  0.0),  // right, center
                    vec4f(-1.0, 1.0, 0.0,  1.0),  // center, top

                    // 2nd triangle
                    vec4f(-1.0, 1.0, 0.0,  1.0),  // center, top
                    vec4f( 1.0, -1.0, 1.0,  0.0),  // right, center
                    vec4f( 1.0, 1.0, 1.0,  1.0),  // right, top
                );
                var vsOutput: OurVertexShaderOutput;

                 let vertex = vertices[vertexIndex];
                    vsOutput.position = vec4f(vertex.xy, 0.0, 1.0);



                    vsOutput.texcoord = vertex.zw;
                    return vsOutput;
            }


// const int Colors = 2;

// var Colors:i32 = 2;
// Resolution of the base image

// Number of colors in each channel
//const int COLORS_PER_CHANNEL = Colors;

// Strength of the dithering effect, from 0.0 to 1.0
// const float DITHER_STRENGTH = 1.0;
// var DITHER_STRENGHT:f32 = 1.0;

// Size of the dither texture
// const float BAYER_SIZE = 8.0;
// var BAYER_SIZE:f32=8.0;

// 8x8 bayer ordered dithering pattern. Each input pixel
// is scaled to the 0..63 range before looking in this table
// to determine the action

const BAYER_TEXTURE = array(0., 32.,  8., 40.,  2., 34., 10., 42.,
    48., 16., 56., 24., 50., 18., 58., 26.,
    12., 44.,  4., 36., 14., 46.,  6., 38.,
    60., 28., 52., 20., 62., 30., 54., 22.,
     3., 35., 11., 43.,  1., 33.,  9., 41.,
    51., 19., 59., 27., 49., 17., 57., 25.,
    15., 47.,  7., 39., 13., 45.,  5., 37.,
    63., 31., 55., 23., 61., 29., 53., 21.);



// Getting the specific pattern from the grid
fn getBayer(uvScreenSpace: vec2f) ->f32 
{
let BAYER_SIZE = 8.0;
var uv:vec2f = vec2(0.0, 0.0);
let width = 1000.0;
let height = 1000.0;

uv = uvScreenSpace * width % BAYER_SIZE;

    // let uv = modf(uvScreenSpace.xy, vec2f(BAYER_SIZE));
    return BAYER_TEXTURE[i32(uv.y * BAYER_SIZE + uv.x)] / (BAYER_SIZE * BAYER_SIZE);
}

// Crushing the colors
fn quantize(channel: f32, period: f32) -> f32

{
    return floor((channel + period / 2.0) / period) * period;
}
        
            @fragment
            fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {

            let fragCoord = fsInput.texcoord;
            let Colors =2;
            let DITHER_STRENGTH = 1.0;
            let period = vec3(1.0 / (f32(Colors) - 1.0));
    
    var output = textureSample(ourTexture, ourSampler, fsInput.texcoord).rgb;
    output += (getBayer(fragCoord) - 0.5) * period * DITHER_STRENGTH;
    output = vec3f(quantize(output.r, period.r),
               quantize(output.g, period.g),
               quantize(output.b, period.b));
            
                return vec4f(output, 1.0);

                

            }
        `,
    })

    const bindGroupLayout = device.createBindGroupLayout({
        entries: [{
            binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: {
                    type: 'uniform', 
                    hasDynamicOffset: false,
                },
        },
          {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {
              type: 'non-filtering',
            },
          },
          {
            binding: 2,
            visibility: GPUShaderStage.FRAGMENT,
            texture: {
              sampleType: 'unfilterable-float',
              viewDimension: '2d',
              multisampled: false,
            },
          },
        ],
    });
    
    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [ bindGroupLayout ],
      });
    
    
    const pipeline = device.createRenderPipeline({
        label: 'tuto',
        layout: pipelineLayout,
        vertex: { module },
        fragment: {
            module,
            targets: [{ format }],
        },
    })


    const uniformBufferSize = (4 + 2 + 12) * 4;
    const uniformBuffer = device.createBuffer({
        label: 'uniforms',
        // (colors + resolution + transformation matrix)
        size: uniformBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    const uniformValues = new Float32Array(uniformBufferSize / 4);

  // offsets to the various uniform values in float32 indices
    const kColorOffset = 0;
    const kResolutionOffset = 4;
    const kMatrixOffset = 6;

  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
  const resolutionValue = uniformValues.subarray(kResolutionOffset, kResolutionOffset + 4);
  const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 12);
   
    
    const sampler = device.createSampler();

    const bindGroup = device.createBindGroup({
        label: 'tuto',
        layout: bindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: uniformBuffer,} },
            { binding: 1, resource: sampler },
          { binding: 2, resource: texture.createView() },
        ],
    })

    function draw(r = 0.0, g = 0.0, b = 0.0, p=0.0) {
        const encoder = device.createCommandEncoder({ label: 'tuto' })

        const rotationMatrix = mat3.rotation(Math.PI /4.0);
        matrixValue.set([
            ...rotationMatrix.slice(0, 3), 0,
            ...rotationMatrix.slice(3, 6), 0,
            ...rotationMatrix.slice(6, 9), 0,
          ]);
          resolutionValue.set([canvas.width, canvas.height]);

        colorValue.set([r, g, b, 1.0]);
        
        device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
        device.queue.copyExternalImageToTexture(
            { source, flipY: true },
            { texture },
            { width: source.width, height: source.height },
          );


        const pass = encoder.beginRenderPass({
            label: 'tuto',
            colorAttachments: [
                {
                    view: context.getCurrentTexture().createView(),
                    clearValue: [1.0, 1.0, 1.0, 1],
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        })
        pass.setPipeline(pipeline)
        pass.setBindGroup(0, bindGroup)
        pass.draw(6)
        pass.end()

        const commandBuffer = encoder.finish()
        device.queue.submit([commandBuffer])
    }

    const rgbSliders = ['control-r', 'control-g', 'control-b', 'control-p'].map((id) =>
        document.getElementById(id)
    )

    rgbSliders.forEach((slider) => {
        slider.addEventListener('input', () => {
            draw(
                parseInt(rgbSliders[0].value) / 255.0,
                parseInt(rgbSliders[1].value) / 255.0,
                parseInt(rgbSliders[2].value) / 255.0,
                parseFloat(rgbSliders[3].value) / 255.0
            )
        })
    })



    draw()
    window.redraw = draw
}

init()
