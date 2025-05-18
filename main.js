import { mat3 } from "./mat3.js"
import { loadImageBitmap, loadWGSL, throttle } from "./utils.js"

let IMAGE_URL = ''

let sortingpath = "./shaders/DCTcompute.wgsl"


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
    // await img.decode();
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
            texture: {
                sampleType: 'unfilterable-float',
                viewDimension: '2d',
                multisampled: false,
            },
        },
        {
            binding: 2,
            visibility: GPUShaderStage.COMPUTE,
            storageTexture: {
                access: "write-only",
                format: "rgba8unorm",
                viewDimension: '2d',
            },
        },
        
        ],
    });


    // must be at least 80 bytes
    const uniformBufferSize = (13 * 4); // TODO CHECK VALUE
    const uniformBuffer = device.createBuffer({
        label: 'uniforms',
        size: uniformBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    const uniformValues = new Float32Array(uniformBufferSize / 4);


    const _LowThreshold = 0;
    const _HighThreshold = 1;
    const _InvertMask = 2;


    let _LowThresholdValue = uniformValues.subarray(_LowThreshold, _HighThreshold);
    let _HighThresholdValue = uniformValues.subarray(_HighThreshold, _InvertMask);

    const inputTexture = device.createTexture({
        label: "inputTexture",
        format: 'rgba8unorm',
        size: [source.width, source.height],
        usage: GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.RENDER_ATTACHMENT,
    })

    context.configure({
        device: device,
        format: 'rgba8unorm',
        usage: GPUTextureUsage.STORAGE_BINDING
    });


    // ----------------------------------- SHADER

    const sortingSrc = await loadWGSL(sortingpath);

    const sortingModule = device.createShaderModule({
        label: 'sortingSrc',
        code: sortingSrc
    })


    // ----------------------------------- PIPELINE

    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
    });


    const DCTPipeline = device.createComputePipeline({
        label: 'tuto',
        layout: pipelineLayout,
        compute: {
            module: sortingModule,
            entryPoint: "compute",
        },
    })


    function draw() {

        const outputTexture = context.getCurrentTexture();
        const bindGroup = device.createBindGroup({
            label: 'tuto',
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: uniformBuffer, } },
                { binding: 1, resource: inputTexture.createView() },
                { binding: 2, resource: outputTexture.createView() },
            ],
        })

        // _LowThresholdValue.set([min]);
        // _HighThresholdValue.set([max]);


        const encoder = device.createCommandEncoder({ label: 'tuto' })
        device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
        device.queue.copyExternalImageToTexture(
            { source: source },
            { texture: inputTexture },
            { width: source.width, height: source.height },
        );

        const pass = encoder.beginComputePass();

        let width = canvas.width;
        let height = canvas.height;

        pass.setBindGroup(0, bindGroup)
        pass.setPipeline(DCTPipeline)
        pass.dispatchWorkgroups(width / 8, height / 8);
        pass.end()

        const commandBuffer = encoder.finish()
        device.queue.submit([commandBuffer])
    }
   
    draw()
    window.redraw = draw
}

init()
