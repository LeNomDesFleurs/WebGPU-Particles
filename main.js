import { mat3 } from "./mat3.js"
import { loadImageBitmap, loadWGSL, throttle } from "./utils.js"

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
                access: "write-only",
                format: "rgba8unorm",
                viewDimension: '2d',

            },
        },
        //Storage
        {
            binding: 4,
            visibility: GPUShaderStage.COMPUTE,
            storageTexture: {
                access: "read-write",
                format: "r32sint",
                viewDimension: '2d',

            },
        },
        {
            binding: 5,
            visibility: GPUShaderStage.COMPUTE,
            storageTexture: {
                access: "read-write",
                format: "r32float",
                viewDimension: '2d',

            },
        },
        {
            binding: 6,
            visibility: GPUShaderStage.COMPUTE,
            storageTexture: {
                access: "read-write",
                format: "r32uint",
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

    const createsortvaluePipeline = device.createComputePipeline({
        label: 'tuto',
        layout: pipelineLayout,
        compute: {
            module: sortingModule,
            entryPoint: "CS_CreateSortValues",
        },
    })

    const clearbufferPipeline = device.createComputePipeline({
        label: 'tuto',
        layout: pipelineLayout,
        compute: { module: sortingModule, entryPoint: "CS_ClearBuffers" },
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
    const compositePipeline = device.createComputePipeline({
        label: 'tuto',
        layout: pipelineLayout,
        compute: { module: sortingModule, entryPoint: "CS_Composite" },
    })

    const visualizePipeline = device.createComputePipeline({
        label: 'tuto',
        layout: pipelineLayout,
        compute: { module: sortingModule, entryPoint: "CS_VisualizeSpans" },
    })

    function draw(p = 0.0, min = 0.0, max = 1.0) {

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

        _LowThresholdValue.set([min]);
        _HighThresholdValue.set([max]);
        _InvertMaskValue.set([0]);
        _MaskRandomOffsetValue.set([0.0]);
        _AnimationSpeedValue.set([0.0]);
        // max 1000, else, got to change the cache size in the shader
        _SpanLimitValue.set([1000]);
        _MaxRandomOffsetValue.set([1]);
        _SortByValue.set([0]);
        _ReverseSortingValue.set([0]);
        _SortedGammaValue.set([1.0]);
        _FrameTimeValue.set([0.0]);
        BUFFER_WIDTHValue.set([canvas.width]);
        BUFFER_HEIGHTValue.set([canvas.height]);


        // let angle = p * 180.
        // let radians = angle * (Math.PI / 180.);

        // const rotationMatrix = mat3.rotation(radians);
        //Goal is to rescale the rectangle once rotated to avoid cropping
        // const scale_value = mat3.rotationScale(radians, canvas.width, canvas.height);

        // const scalingMatrix = mat3.scaling([scale_value, scale_value]);
        // const matrix = mat3.multiply(rotationMatrix, scalingMatrix);
        // matrixValue.set([
        //     ...matrix.slice(0, 3), 0,
        //     ...matrix.slice(3, 6), 0,
        //     ...matrix.slice(6, 9), 0,
        // ]);
        // resolutionValue.set([canvas.width, canvas.height]);

        const encoder = device.createCommandEncoder({ label: 'tuto' })
        device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
        device.queue.copyExternalImageToTexture(
            { source: source },
            { texture: inputTexture },
            { width: source.width, height: source.height },
        );

        const pass = encoder.beginComputePass();

        // let width = canvas.width;
        let width = 1000;
        // let height = canvas.height;
        let height = 1000;

        pass.setBindGroup(0, bindGroup)
        pass.setPipeline(createMaskPipeline)
        pass.dispatchWorkgroups(width / 8, height / 8);
        pass.setPipeline(createsortvaluePipeline)
        pass.dispatchWorkgroups(width / 8, height / 8);
        pass.setPipeline(clearbufferPipeline)
        pass.dispatchWorkgroups(width / 8, height / 8);
        pass.setPipeline(identifyspanPipeline)
        pass.dispatchWorkgroups(width, height);
        // pass.setPipeline(visualizePipeline)
        // pass.dispatchWorkgroups(width, height);
        pass.setPipeline(pixelsortPipeline)
        pass.dispatchWorkgroups(width, height);
        pass.setPipeline(compositePipeline)
        pass.dispatchWorkgroups(width / 8, height / 8);
        pass.end()

        const commandBuffer = encoder.finish()
        device.queue.submit([commandBuffer])
    }

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
    }, 200);

    rgbSliders.forEach((slider) => {
        slider.addEventListener('input', handleSliderChange)
    })

//  const rot = document.getElementById('control-p');
//     rot.addEventListener('input', () => {
//         draw(parseFloat(rot.value) / 255.0);
//     })

   
    draw()
    window.redraw = draw
}

init()
