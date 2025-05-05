import { mat3 } from "./mat3.js"
import { loadImageBitmap, loadWGSL } from "./utils.js"

let IMAGE_URL = ''
let clearbufferpath = "./shaders/sorting/clearbuffer.wgsl"
let compositepath = "./shaders/sorting/composite.wgsl"
let createmaskpath = "./shaders/sorting/createmask.wgsl"
let createsortvaluepath = "./shaders/sorting/createsortvalue.wgsl"
let identifyspanpath = "./shaders/sorting/identifyspans.wgsl"
let pixelsortpath = "./shaders/sorting/pixelsort.wgsl"

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
    

    // --------------------------- BIND GROUP
    const bindGroupLayout = device.createBindGroupLayout({
        entries: [{
            binding: 0,
            visibility: GPUShaderStage.COMPUTE,
            buffer: {
                    type: 'uniform', 
                    hasDynamicOffset: false,
                },
			},
			{
                binding: 1,
				visibility: GPUShaderStage.COMPUTE,
				sampler: {
                    type: 'non-filtering',
				},
			},
			{
				binding: 2,
				visibility: GPUShaderStage.COMPUTE,
				texture: {
					sampleType: 'unfilterable-float',
					viewDimension: '2d',
					multisampled: false,
				},
		    },
            {
                binding: 3,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: {
                    access:"write-only",
                    format:"rgba8unorm",
                    viewDimension: '2d',
                    
                },
            },
            //Storage
            {
                binding: 4,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: {
                    access:"read-write",
                    format:"r32uint",
                    viewDimension: '2d',
                    
                },
            },
            {
                binding: 5,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: {
                    access:"read-write",
                    format:"r32uint",
                    viewDimension: '2d',

                },
            },
            {
                binding: 6,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: {
                    access:"read-write",
                    format:"r32float",
                    viewDimension: '2d',
                    
                },
            },
    ],
    });
    
    
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
    
    
    const inputTexture = device.createTexture({
            label: "inputTexture",
            format: 'rgba8unorm',
            size: [source.width, source.height],
            usage: GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.RENDER_ATTACHMENT,
        })
    
        const storageMask = device.createTexture({
            label: "storageMask",
            format: 'r32uint',
            size: [source.width, source.height],
            usage: GPUTextureUsage.STORAGE_BINDING 
        })
        
        const storageSortValue = device.createTexture({
            label: "storageSortValue",
            format: 'r32uint',
            size: [source.width, source.height],
            usage: GPUTextureUsage.STORAGE_BINDING 
        })
    
        const storageSpanLenght = device.createTexture({
            label: "storageSpanLenght",
            format: 'r32float',
            size: [source.width, source.height],
            usage: GPUTextureUsage.STORAGE_BINDING 
        })
    
    context.configure({
        device: device,
        format: 'rgba8unorm',
        usage: GPUTextureUsage.STORAGE_BINDING
    });
    
        const outputTexture = context.getCurrentTexture();
        
        const sampler = device.createSampler();
        
        const bindGroup = device.createBindGroup({
            label: 'tuto',
            layout: bindGroupLayout,
            entries: [
            { binding: 0, resource: { buffer: uniformBuffer,} },
            { binding: 1, resource: sampler },
			{ binding: 2, resource: inputTexture.createView() },
			{ binding: 3, resource: outputTexture.createView() },
			{ binding: 4, resource: storageMask.createView() },
			{ binding: 5, resource: storageSortValue.createView() },
			{ binding: 6, resource: storageSpanLenght.createView() },
        ],
    })

    // ----------------------------------- SHADER

    const clearbufferSrc = await loadWGSL(clearbufferpath);
    const compositeSrc = await loadWGSL(compositepath);
    const createmaskSrc = await loadWGSL(createmaskpath);
    const createsortvalueSrc = await loadWGSL(createsortvaluepath);
    const identifyspanSrc = await loadWGSL(identifyspanpath);
    const pixelsortSrc = await loadWGSL(pixelsortpath);
    
    const clearbufferModule = device.createShaderModule({
        label: 'clearbufferSrc',
        code: clearbufferSrc
    })

    const compositeModule = device.createShaderModule({
        label: 'compositeSrc',
        code: compositeSrc
    })

    const createmaskModule = device.createShaderModule({
        label: 'createmaskSrc',
        code: createmaskSrc
    })

    const createsortvalueModule = device.createShaderModule({
        label: 'createsortvalueSrc',
        code: createsortvalueSrc
    })

    const identifyspanModule = device.createShaderModule({
        label: 'identifyspanSrc',
        code: identifyspanSrc
    })

    const pixelsortModule = device.createShaderModule({
        label: 'pixelsortSrc',
        code: pixelsortSrc
    })
  

    // ----------------------------------- PIPELINE

    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [ bindGroupLayout ],
    });
    

    const clearbufferPipeline = device.createComputePipeline({
        label: 'tuto',
        layout: pipelineLayout,
        compute: { clearbufferModule },
    })
    
    const compositePipeline = device.createComputePipeline({
        label: 'tuto',
        layout: pipelineLayout,
        compute: { compositeModule },
    })

    const createMaskPipeline = device.createComputePipeline({
        label: 'tuto',
        layout: pipelineLayout,
        compute: { createmaskModule },
    })

    const createsortvaluePipeline = device.createComputePipeline({
        label: 'tuto',
        layout: pipelineLayout,
        compute: { createsortvalueModule },
    })

    const identifyspanPipeline = device.createComputePipeline({
        label: 'tuto',
        layout: pipelineLayout,
        compute: { identifyspanModule },
    })

    const pixelsortPipeline = device.createComputePipeline({
        label: 'tuto',
        layout: pipelineLayout,
        compute: { pixelsortModule },
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

        let width = canvas.width;
        let height = canvas.height;

        pass.setBindGroup(0, bindGroup)
        pass.setPipeline(createMaskPipeline)
        passEncoder.dispatchWorkgroups(width / 8, height / 8);
        pass.setPipeline(createsortvaluePipeline)
        passEncoder.dispatchWorkgroups(width/8, height/8);
        pass.setPipeline(clearbufferPipeline)
        passEncoder.dispatchWorkgroups(width / 8, height / 8);
        pass.setPipeline(identifyspanPipeline)
        passEncoder.dispatchWorkgroups(width, height);
        pass.setPipeline(pixelsortPipeline)
        passEncoder.dispatchWorkgroups(width, height);
        pass.setPipeline(compositePipeline)
        passEncoder.dispatchWorkgroups(width / 8, height / 8);
        // pass.draw(6)
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
