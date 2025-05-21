import { RenderModel } from '../src/RenderModel.js'

export class PixelSortingModel extends RenderModel {
    async loadAsset() {
        await this.addTexture('texture-input', '../assets/rose.jpg')
    }

    createResources() {
        // --------------------------- BIND GROUP
        const bindGroupLayout = device.createBindGroupLayout({
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
                        access: 'write-only',
                        format: 'rgba8unorm',
                        viewDimension: '2d',
                    },
                },
                //Storage
                {
                    binding: 4,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: {
                        access: 'read-write',
                        format: 'r32sint',
                        viewDimension: '2d',
                    },
                },
                {
                    binding: 5,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: {
                        access: 'read-write',
                        format: 'r32float',
                        viewDimension: '2d',
                    },
                },
                {
                    binding: 6,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: {
                        access: 'read-write',
                        format: 'r32uint',
                        viewDimension: '2d',
                    },
                },
            ],
        })
    }
    updateUniforms(...args) {
        const canvasSize = this.renderCtx.getCanvasSize()
        this.uniformBuffer.set(
            'transform-matrix',
            DitheringModel.transformCanvas(
                state.p,
                canvasSize[0],
                canvasSize[1]
            )
        )
        this.uniformBuffer.set('resolution', canvasSize)
        // this.uniformBuffer.set('col-nb', state.colNb);
        // this.uniformBuffer.set('dith-str', state.ditherStrength);
        this.device.queue.writeBuffer(
            this.uniformBuffer.getBufferObject(),
            0,
            this.uniformBuffer.getBuffer()
        )
    }
    encodeRenderPass() {
        throw new Error('encodeRenderPass() must be implemented by subclass')
    }
    render() {
        const outputTexture = context.getCurrentTexture()
        const bindGroup = device.createBindGroup({
            label: 'tuto',
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: uniformBuffer } },
                { binding: 1, resource: sampler },
                { binding: 2, resource: inputTexture.createView() },
                { binding: 3, resource: outputTexture.createView() },
                { binding: 4, resource: storageMask.createView() },
                { binding: 5, resource: storageSortValue.createView() },
                { binding: 6, resource: storageSpanLenght.createView() },
            ],
        })

        _LowThresholdValue.set([min])
        _HighThresholdValue.set([max])
        _InvertMaskValue.set([0])
        _MaskRandomOffsetValue.set([0.0])
        _AnimationSpeedValue.set([0.0])
        // max 1000, else, got to change the cache size in the shader
        _SpanLimitValue.set([1000])
        _MaxRandomOffsetValue.set([1])
        _SortByValue.set([0])
        _ReverseSortingValue.set([0])
        _SortedGammaValue.set([1.0])
        _FrameTimeValue.set([0.0])
        BUFFER_WIDTHValue.set([canvas.width])
        BUFFER_HEIGHTValue.set([canvas.height])

        const encoder = device.createCommandEncoder({ label: 'tuto' })
        device.queue.writeBuffer(uniformBuffer, 0, uniformValues)
        device.queue.copyExternalImageToTexture(
            { source: source },
            { texture: inputTexture },
            { width: source.width, height: source.height }
        )

        const pass = encoder.beginComputePass()

        // let width = canvas.width;
        let width = this.textures['texture-input'].width
        // let height = canvas.height;
        let height = this.textures['texture-input'].height

        pass.setBindGroup(0, bindGroup)
        pass.setPipeline(createMaskPipeline)
        pass.dispatchWorkgroups(width / 8, height / 8)
        // pass.setPipeline(createsortvaluePipeline)
        // pass.dispatchWorkgroups(width / 8, height / 8);
        // pass.setPipeline(clearbufferPipeline)
        // pass.dispatchWorkgroups(width / 8, height / 8);
        pass.setPipeline(identifyspanPipeline)
        pass.dispatchWorkgroups(width / 8, height / 8)
        // pass.setPipeline(visualizePipeline)
        // pass.dispatchWorkgroups(width, height);
        pass.setPipeline(pixelsortPipeline)
        pass.dispatchWorkgroups(width / 8, height / 8)
        // pass.setPipeline(compositePipeline)
        // pass.dispatchWorkgroups(width / 8, height / 8);
        pass.end()

        const commandBuffer = encoder.finish()
        device.queue.submit([commandBuffer])
    }

    async init() {
        await this.loadAsset()
        this.createResources()
        this.addControllers()
    }
}
