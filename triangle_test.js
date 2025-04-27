async function init() {
    if (!navigator.gpu) throw new Error("WebGPU not supported on the browser.");
        
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter?.requestDevice();
    if (!device) throw new Error("no GPU support on the browser.");
    
    const canvas = document.getElementById("gfx");
    const context = canvas.getContext("webgpu");
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format });
    
    const module = device.createShaderModule({
        label: 'tuto-code',
        code: `
            @vertex fn vs(
                @builtin(vertex_index) vertexIndex : u32
            ) -> @builtin(position) vec4f {
                let pos = array(
                    vec2f( 0.0,  0.5),  // top center
                    vec2f(-0.5, -0.5),  // bottom left
                    vec2f( 0.5, -0.5)   // bottom right
                );
        
                return vec4f(pos[vertexIndex], 0.0, 1.0);
            }
        
            @fragment fn fs() -> @location(0) vec4f {
                return vec4f(0.0, 1.0, 0.0, 1.0);
            }
        `
    });
    
    const pipeline = device.createRenderPipeline({
        labe: 'tuto',
        layout: 'auto',
        vertex: {module},
        fragment: {
            module,
            targets: [{ format }]    
        }
    });

    function draw() {
        const encoder = device.createCommandEncoder({label: 'tuto'});
        const pass = encoder.beginRenderPass({
            label: 'tuto',
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                clearValue: [ 0.8, 0.75, 0.12, 1 ],
                loadOp: 'clear',
                storeOp: 'store'
            }]
        });
        pass.setPipeline(pipeline);
        pass.draw(3);
        pass.end();
        
        const commandBuffer = encoder.finish();
        device.queue.submit([commandBuffer]);        
    }

    draw();
    window.redraw = draw;
}
init();


