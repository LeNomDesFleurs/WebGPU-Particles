import { RenderModel } from '../src/RenderModel.js'
import { UniformBufferBuilder } from '../src/Buffer.js'
import { state } from '../src/utils.js'
import { loadImageBitmap } from '../src/utils.js'

var IMAGE_URL = '../assets/rose.jpg'

export class PixelSortingModel extends RenderModel {
    async loadAsset() {
        const source = await loadImageBitmap('../assets/rose.jpg')
        await this.addTexture('texture-input', '../assets/rose.jpg')
        var size = { width: source.width, height: source.height }
        await this.addStorage('mask', 'r32sint', size);
        await this.addStorage('sortvalues', 'r32float', size);
        await this.addStorage('spanlenghts', 'r32uint', size);
        await this.addShaderModule('sorting', '../shaders/sorting.wgsl');
    }

    createResources() {
        const bufferBuilder = new UniformBufferBuilder(this.device)
        this.uniformBuffer = bufferBuilder
            .add({ name: 'resolution', type: 'vec2' })
            .add({ name: 'LowThreshold', type: 'f32' })
            .add({ name: 'HighThreshold', type: 'f32' })
            .add({ name: 'InvertMask', type: 'f32' })
            .add({ name: 'SpanLimit', type: 'f32' })
            .add({ name: 'MaskRandomOffset', type: 'f32' })
            .add({ name: 'SortBy', type: 'f32' })
            .add({ name: 'ReverseSorting', type: 'f32' })
            .add({ name: 'SortedGamma', type: 'f32' })
            .build()

        // --------------------------- BIND GROUP
        const bindGroupLayout = this.device.createBindGroupLayout({
            label: 'sortingbindgroup',
            entries: [
                {
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
                        access: 'write-only',
                        format: 'rgba8unorm',
                        viewDimension: '2d',
                    },
                },
                //Storage
                {
                    binding: 3,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: {
                        access: 'read-write',
                        format: 'r32sint',
                        viewDimension: '2d',
                    },
                },
                {
                    binding: 4,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: {
                        access: 'read-write',
                        format: 'r32float',
                        viewDimension: '2d',
                    },
                },
                {
                    binding: 5,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: {
                        access: 'read-write',
                        format: 'r32uint',
                        viewDimension: '2d',
                    },
                },
            ],
        })

        this.layout = bindGroupLayout

        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout],
        })

        this.createMaskPipeline = this.device.createComputePipeline({
            label: 'createMaskPipeline',
            layout: pipelineLayout,
            compute: {
                module: this.shaderModules['sorting'],
                entryPoint: 'CS_CreateMask',
            },
        })

        this.identifyspanPipeline = this.device.createComputePipeline({
            label: 'identifyspanPipeline',
            layout: pipelineLayout,
            compute: {
                module: this.shaderModules['sorting'],
                entryPoint: 'CS_IdentifySpans',
            },
        })

        this.pixelsortPipeline = this.device.createComputePipeline({
            label: 'pixelsortPipeline',
            layout: pipelineLayout,
            compute: {
                module: this.shaderModules['sorting'],
                entryPoint: 'CS_PixelSort',
            },
        })

        this.visualizePipeline = this.device.createComputePipeline({
            label: 'pixelsortPipeline',
            layout: pipelineLayout,
            compute: {
                module: this.shaderModules['sorting'],
                entryPoint: 'CS_VisualizeSpans',
            },
        })
    }

    updateUniforms(...args) {
        const canvasSize = this.renderCtx.getCanvasSize()
        this.uniformBuffer.set('resolution', canvasSize)
        this.uniformBuffer.set('LowThreshold', state.LowThreshold)
        this.uniformBuffer.set('HighThreshold', state.HighThreshold)
        this.uniformBuffer.set('InvertMask', state.InvertMask)
        this.uniformBuffer.set('SpanLimit', state.SpanLimit)
        this.uniformBuffer.set('MaskRandomOffset', state.MaskRandomOffset)
        this.uniformBuffer.set('SortBy', state.SortBy)
        this.uniformBuffer.set('ReverseSorting', state.ReverseSorting)
        this.uniformBuffer.set('SortedGamma', state.SortedGamma)
        this.device.queue.writeBuffer(
            this.uniformBuffer.getBufferObject(),
            0,
            this.uniformBuffer.getBuffer()
        )
    }

    addControls() {
        super.addControls()
        const controls = [
            {
                type: 'range',
                id: 'LowThreshold',
                label: 'LowThreshold',
                min: 0,
                max: 255,
                value: 100,
                step: 1,
                handler: (v) => (state.LowThreshold = v / 255.0),
            },
            {
                type: 'range',
                id: 'HighThreshold',
                label: 'HighThreshold',
                min: 0,
                max: 255,
                value: 180,
                step: 1,
                handler: (v) => (state.HighThreshold = v / 255.0),
            },
            {
                type: 'range',
                id: 'InvertMask',
                label: 'InvertMask',
                min: 0,
                max: 255,
                value: 255,
                step: 1,
                handler: (v) => (state.InvertMask = v / 255.0),
            },
            {
                type: 'range',
                id: 'SpanLimit',
                label: 'SpanLimit',
                min: 1,
                max: 2000,
                value: 500,
                step: 1,
                handler: (v) => (state.SpanLimit = v),
            },
            {
                type: 'range',
                name: 'MaskRandomOffset',
                label: 'MaskRandomOffset',
                min: 0,
                max: 255,
                value: 255,
                step: 1,
                handler: (v) => (state.MaskRandomOffset = v / 255.0),
            },
            {
                type: 'radio',
                name: 'SortBy',
                label: 'SortBy',
                options: [0, 1, 2],
                default: 0,
                handler: (v) => (state.SortBy = v),
            },
            {
                type: 'range',
                name: 'ReverseSorting',
                label: 'ReverseSorting',
                min: 0,
                max: 255,
                value: 255,
                step: 1,
                handler: (v) => (state.ReverseSorting = v / 255.0),
            },
            {
                type: 'range',
                name: 'SortedGamma',
                label: 'SortedGamma',
                min: 0,
                max: 255,
                value: 255,
                step: 1,
                handler: (v) => (state.SortedGamma = v / 255.0),
            },
        ]
        this.addControllers(controls)
    }

    async render() {
        const source = await loadImageBitmap('../assets/rose.jpg')
        // var source = createImageBitmap(IMAGE_URL, {colorSpaceConversion: 'none',})

        this.device.queue.copyExternalImageToTexture(
            { source: source },
            { texture: this.textures['texture-input'] },
            { width: source.width, height: source.height }
        )

        const canvas = document.getElementById('gfx')
        const context = canvas.getContext('webgpu')

        context.configure({
            device: this.device,
            format: 'rgba8unorm',
            usage: GPUTextureUsage.STORAGE_BINDING,
        })

        const outputTexture = context.getCurrentTexture()

        this.updateUniforms()
        var buffer = this.uniformBuffer

        const bindGroup = this.device.createBindGroup({
            label: 'sorting buffer',
            layout: this.layout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: buffer.getBufferObject() },
                },
                {
                    binding: 1,
                    resource: this.textures['texture-input'].createView(),
                },
                {
                    binding: 2,
                    resource: outputTexture.createView(),
                },
                {
                    binding: 3,
                    resource: this.textures['mask'].createView(),
                },
                {
                    binding: 4,
                    resource: this.textures['sortvalues'].createView(),
                },
                {
                    binding: 5,
                    resource: this.textures['spanlenghts'].createView(),
                },
            ],
        })

        const encoder = this.device.createCommandEncoder({ label: 'sorting' })

        const pass = encoder.beginComputePass()

        // let width = canvas.width;
        let width = this.textures['texture-input'].width
        // let height = canvas.height;
        let height = this.textures['texture-input'].height

        pass.setBindGroup(0, bindGroup)
        pass.setPipeline(this.createMaskPipeline)
        pass.dispatchWorkgroups(width / 8, height / 8)
        // pass.setPipeline(createsortvaluePipeline)
        // pass.dispatchWorkgroups(width / 8, height / 8);
        // pass.setPipeline(clearbufferPipeline)
        // pass.dispatchWorkgroups(width / 8, height / 8);
        pass.setPipeline(this.identifyspanPipeline)
        pass.dispatchWorkgroups(width / 8, height / 8)
        // pass.setPipeline(this.visualizePipeline)
        // pass.dispatchWorkgroups(width, height);
        pass.setPipeline(this.pixelsortPipeline)
        pass.dispatchWorkgroups(width / 8, height / 8)
        // pass.setPipeline(compositePipeline)
        // pass.dispatchWorkgroups(width / 8, height / 8);
        pass.end()

        const commandBuffer = encoder.finish()
        this.device.queue.submit([commandBuffer])
    }

    async init() {
        await this.loadAsset()
        this.createResources()
        this.addControls()
    }
}
