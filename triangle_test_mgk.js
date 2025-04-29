async function init() {
    if (!navigator.gpu) throw new Error('WebGPU not supported on the browser.')

    const adapter = await navigator.gpu.requestAdapter()
    const device = await adapter?.requestDevice()
    if (!device) throw new Error('no GPU support on the browser.')

    const canvas = document.getElementById('gfx')
    const context = canvas.getContext('webgpu')
    const format = navigator.gpu.getPreferredCanvasFormat()
    context.configure({ device, format })

    const module = device.createShaderModule({
        label: 'tuto-code',
        code: `
            struct Uniforms {
                color: vec4f
            };

            @group(0) @binding(0)
            var<uniform> uniforms: Uniforms;
            @group(0) @binding(1) 
            var<uniform> height: f32;


            @vertex
            fn vs(@builtin(vertex_index) vertexIndex : u32) -> @builtin(position) vec4f {
                let pos = array(
                    vec2f( 0.0,  height),  // top center
                    vec2f(-0.5, -0.5),  // bottom left
                    vec2f( 0.5, -0.5)   // bottom right
                );
        
                return vec4f(pos[vertexIndex], 0.0, 1.0);
            }
        
            @fragment
            fn fs() -> @location(0) vec4f {
                return uniforms.color;
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

    const bindGroup = device.createBindGroup({
        label: 'tuto',
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniformBuffer,} },
            {binding: 1, resource: {buffer: heightBuffer}},
        ],
    })

    function draw(r = 0.0, g = 0.0, b = 0.0, p=0.0) {
        const encoder = device.createCommandEncoder({ label: 'tuto' })

        const colorArray = new Float32Array([r, g, b, 1.0]);
        const height = new Float32Array([p]);

        device.queue.writeBuffer(heightBuffer, 0, height.buffer)
        device.queue.writeBuffer(uniformBuffer, 0, colorArray.buffer)

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
        pass.draw(3)
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
