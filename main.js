import { mat3 } from "./mat3.js"
import { loadImageBitmap, loadWGSL } from "./utils.js"

let IMAGE_URL = ''
let DITHERING_SHADER_PATH = "./shaders/dithering.wgsl"

async function init() {
    if (!navigator.gpu) throw new Error('WebGPU not supported on the browser.')

    const adapter = await navigator.gpu.requestAdapter()
    const device = await adapter?.requestDevice()
    if (!device) throw new Error('no GPU support on the browser.')

    const canvas = document.getElementById('gfx')
    const context = canvas.getContext('webgpu')
    const format = navigator.gpu.getPreferredCanvasFormat()
    context.configure({ device, format })

	IMAGE_URL = 'rose.jpg';
	const source = await loadImageBitmap(IMAGE_URL);

	const texture = device.createTexture({
		label: "dithering-target",
		format: 'rgba8unorm',
		size: [source.width, source.height],
		usage: GPUTextureUsage.TEXTURE_BINDING |
				GPUTextureUsage.COPY_DST |
				GPUTextureUsage.RENDER_ATTACHMENT,
	})

	const shaderSrc = await loadWGSL(DITHERING_SHADER_PATH);
    const module = device.createShaderModule({
        label: 'load-texture',
        code: shaderSrc
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
		}],
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

    // (colors + resolution + transformation matrix)
    // must be at least 80 bytes
    const uniformBufferSize = ((4 + 2 + 12) * 4)+8; // TODO CHECK VALUE
    const uniformBuffer = device.createBuffer({
        label: 'uniforms',
        size: uniformBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    const uniformValues = new Float32Array(uniformBufferSize / 4);

    // offsets to the various uniform values in float32 indices
    
    const kResolutionOffset = 0;
    const kMatrixOffset = 4;

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


    function draw(p=0.0) {
        const encoder = device.createCommandEncoder({ label: 'tuto' })

        let angle = p*180.
        let radians = angle * (Math.PI / 180.);

        const rotationMatrix = mat3.rotation(radians);
        //Goal is to rescale the rectangle once rotated to avoid cropping
        const scale_value = mat3.rotationScale(radians, canvas.width, canvas.height);

        const scalingMatrix = mat3.scaling([scale_value, scale_value]);
        const matrix = mat3.multiply(rotationMatrix, scalingMatrix);
        matrixValue.set([
            ...matrix.slice(0, 3), 0,
            ...matrix.slice(3, 6), 0,
            ...matrix.slice(6, 9), 0,
		]);
		resolutionValue.set([canvas.width, canvas.height]);

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

	const rot = document.getElementById('control-p');
	rot.addEventListener('input', () => {
		draw(parseFloat(rot.value) / 255.0);
	})

    draw()
    window.redraw = draw
}

init()
