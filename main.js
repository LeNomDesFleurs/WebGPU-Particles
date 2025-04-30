
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
                color: vec4f
            };

            struct OurVertexShaderOutput {
                @builtin(position) position: vec4f,
                @location(0) texcoord: vec2f,
            };

            // @group(0) @binding(0)
            // var<uniform> uniforms: Uniforms;
            // @group(0) @binding(1) 
            // var<uniform> height: f32;
            @group(0) @binding(2) var ourSampler: sampler;
            @group(0) @binding(3) var ourTexture: texture_2d<f32>;


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


        
            @fragment
            fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
                // return uniforms.color;
                return textureSample(ourTexture, ourSampler, fsInput.texcoord);

            }
        `,
    })

    
    const pipeline = device.createRenderPipeline({
        label: 'tuto',
        layout: 'auto',
        vertex: { module },
        fragment: {
            module,
            targets: [{ format }],
        },
    })

    const uniformBuffer = device.createBuffer({
        label: 'tuto',
        size: 5 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    const heightBuffer = device.createBuffer({
        label: 'height', 
        size: 4, 
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    
    const sampler = device.createSampler();

    const bindGroup = device.createBindGroup({
        label: 'tuto',
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            // { binding: 0, resource: { buffer: uniformBuffer,} },
            // {binding: 1, resource: {buffer: heightBuffer}},
            { binding: 2, resource: sampler },
          { binding: 3, resource: texture.createView() },
        ],
    })


 


    function draw(r = 0.0, g = 0.0, b = 0.0, p=0.0) {
        const encoder = device.createCommandEncoder({ label: 'tuto' })

        const colorArray = new Float32Array([r, g, b, 1.0]);
        const height = new Float32Array([p]);

        device.queue.writeBuffer(heightBuffer, 0, height.buffer)
        device.queue.writeBuffer(uniformBuffer, 0, colorArray.buffer)
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
