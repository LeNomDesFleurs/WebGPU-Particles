import { mat3 } from "../mat3.js"
import { loadImageBitmap, loadWGSL, throttle } from "../utils.js"

let IMAGE_URL = ''

let sortingpath = "./shaders/sorting.wgsl"


async function init() {
    if (!navigator.gpu) throw new Error('WebGPU not supported on the browser.')

    const adapter = await navigator.gpu.requestAdapter()
    const device = await adapter?.requestDevice()
    if (!device) throw new Error('no GPU support on the browser.')

    const canvas = document.getElementById('gfx')
    const context = canvas.getContext('webgpu')
    const format = navigator.gpu.getPreferredCanvasFormat()
    context.configure({ device, format })

    //     const img = document.createElement("img");
    //     img.src = new URL(
    //     "rose.png",
    //     import.meta.url,
    //   ).toString();
    //   await img.decode();
    //   const imageBitmap = await loadImageBitmap(img);

    IMAGE_URL = 'rose.jpg';
    // await img.decode();
    const source = await loadImageBitmap(IMAGE_URL);


    // --------------------------- BIND GROUP
    


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
    const _MaskRandomOffset = 3;
    const _AnimationSpeed = 4;
    const _SpanLimit = 5;
    const _MaxRandomOffset = 6;
    const _SortBy = 7;
    const _ReverseSorting = 8;
    const _SortedGamma = 9;
    const _FrameTime = 10;
    const BUFFER_WIDTH = 11;
    const BUFFER_HEIGHT = 12;

    let _LowThresholdValue = uniformValues.subarray(_LowThreshold, _HighThreshold);
    let _HighThresholdValue = uniformValues.subarray(_HighThreshold, _InvertMask);
    let _InvertMaskValue = uniformValues.subarray(_InvertMask, _MaskRandomOffset);
    let _MaskRandomOffsetValue = uniformValues.subarray(_MaskRandomOffset,_AnimationSpeed);
    let _AnimationSpeedValue = uniformValues.subarray(_AnimationSpeed, _SpanLimit);
    let _SpanLimitValue = uniformValues.subarray(_SpanLimit, _MaxRandomOffset);
    let _MaxRandomOffsetValue = uniformValues.subarray(_MaxRandomOffset, _SortBy);
    let _SortByValue = uniformValues.subarray(_SortBy, _ReverseSorting);
    let _ReverseSortingValue = uniformValues.subarray(_ReverseSorting, _SortedGamma);
    let _SortedGammaValue = uniformValues.subarray(_SortedGamma, _FrameTime);
    let _FrameTimeValue = uniformValues.subarray(_FrameTime, BUFFER_WIDTH);
    let BUFFER_WIDTHValue = uniformValues.subarray(BUFFER_WIDTH, BUFFER_HEIGHT);
    let BUFFER_HEIGHTValue = uniformValues.subarray(BUFFER_HEIGHT, BUFFER_HEIGHT + 4);

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
        format: 'r32sint',
        size: [source.width, source.height],
        usage: GPUTextureUsage.STORAGE_BINDING
    })

    const storageSortValue = device.createTexture({
        label: "storageSortValue",
        format: 'r32float',
        size: [source.width, source.height],
        usage: GPUTextureUsage.STORAGE_BINDING
    })

    const storageSpanLenght = device.createTexture({
        label: "storageSpanLenght",
        format: 'r32uint',
        size: [source.width, source.height],
        usage: GPUTextureUsage.STORAGE_BINDING
    })

    context.configure({
        device: device,
        format: 'rgba8unorm',
        usage: GPUTextureUsage.STORAGE_BINDING
    });

    
    const sampler = device.createSampler();
    
    
    const outputTexture = context.getCurrentTexture();
    const bindGroup = device.createBindGroup({
        label: 'tuto',
        layout: bindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: uniformBuffer, } },
            { binding: 1, resource: sampler },
            { binding: 2, resource: inputTexture.createView() },
            { binding: 3, resource: outputTexture.createView() },
            { binding: 4, resource: storageMask.createView() },
            { binding: 5, resource: storageSortValue.createView() },
            { binding: 6, resource: storageSpanLenght.createView() },
        ],
    })

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


    const createMaskPipeline = device.createComputePipeline({
        label: 'tuto',
        layout: pipelineLayout,
        compute: {
            module: sortingModule,
            entryPoint: "CS_CreateMask",
        },
    })

    
    const identifyspanPipeline = device.createComputePipeline({
        label: 'tuto',
        layout: pipelineLayout,
        compute: { module: sortingModule, entryPoint: "CS_IdentifySpans" },
    })

    const pixelsortPipeline = device.createComputePipeline({
        label: 'tuto',
        layout: pipelineLayout,
        compute: { module: sortingModule, entryPoint: "CS_PixelSort" },
    })
    // const compositePipeline = device.createComputePipeline({
    //     label: 'tuto',
    //     layout: pipelineLayout,
    //     compute: { module: sortingModule, entryPoint: "CS_Composite" },
    // })

    const visualizePipeline = device.createComputePipeline({
        label: 'tuto',
        layout: pipelineLayout,
        compute: { module: sortingModule, entryPoint: "CS_VisualizeSpans" },
    })

   

    const rgbSliders = ['control-p', 'min', 'max', ].map((id) =>
        document.getElementById(id)
    )

    const handleSliderChange = throttle(() => {
        draw(
            parseInt(rgbSliders[0].value) / 255.0,
            parseFloat(rgbSliders[1].value) / 255.0,
            parseFloat(rgbSliders[2].value) / 255.0,
            // parseFloat(rgbSliders[3].value) / 255.0
        )
    }, 30);

    rgbSliders.forEach((slider) => {
        slider.addEventListener('input', handleSliderChange)
    })

   
    draw()
    window.redraw = draw
}

init()
