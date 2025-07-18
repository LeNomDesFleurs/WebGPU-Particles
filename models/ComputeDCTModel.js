import { RenderModel } from '../src/RenderModel.js'
import { UniformBufferBuilder } from '../src/Buffer.js'
import { BITMAP, setRenderDonePromise } from '../src/utils.js'

export class DCT extends RenderModel {
    constructor(device, renderCtx) {
        super(device, renderCtx)
    }

    async loadAsset() {
        await this.addTextureBitmap('texture-input', BITMAP)
        await this.addShaderModule('dct1', './shaders/DCTcompute.wgsl')
    }

    createResources() {
        const canvas = document.getElementById('gfx')
        const context = canvas.getContext('webgpu')

        this.uniformBuffer = this.uniformBufferBuilder
            .add({ name: 'resolution', type: 'vec2' })
            .add({ name: 'frequence', type: 'f32' })
            .build()

        this.textureOut1 = this.device.createTexture({
            label: 'texture-out1',
            format: 'rgba8unorm',
            size: [this.textures['texture-input'].width, this.textures['texture-input'].height],
            usage:
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.STORAGE_BINDING,
        })

        context.configure({
            device: this.device,
            format: 'rgba8unorm',
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
        })

        const bindGroupLayout = this.device.createBindGroupLayout({
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
                        sampleType: 'write-only',
                        format: 'rgba8unorm',
                        viewDimension: '2d',
                    },
                },
            ],
        })

        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout],
        })

        this.bindGroup1 = this.device.createBindGroup({
            label: 'dct1-bindgroup',
            layout: bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.uniformBuffer.getBufferObject() },
                },
                {
                    binding: 1,
                    resource: this.textures['texture-input'].createView(),
                },
                {
                    binding: 2,
                    resource: context.getCurrentTexture().createView(),
                },
            ],
        })

        this.pipeline1 = this.device.createComputePipeline({
            label: 'dct-pipeline',
            layout: pipelineLayout,
            compute: {
                module: this.shaderModules['dct1'],
                targets: [{ format: this.renderCtx.getFormat() }],
            },
        })
    }

    updateUniforms(freq = 8) {
        var canvasSize = this.renderCtx.getCanvasSize()
        canvasSize.width = freq
        this.uniformBuffer.set('resolution', canvasSize)
        this.uniformBuffer.set('frequence', freq)

        this.device.queue.writeBuffer(
            this.uniformBuffer.getBufferObject(),
            0,
            this.uniformBuffer.getBuffer()
        )
    }

    render() {
        let nb_freq = 8

        const encoder = this.device.createCommandEncoder({ label: 'DCT' })

        this.updateUniforms(nb_freq)

        const pass = encoder.beginComputePass()

        pass.setBindGroup(0, this.bindGroup1)
        pass.setPipeline(this.pipeline1)
        pass.dispatchWorkgroups(this.textures['texture-input'].width / nb_freq, this.textures['texture-input'].height / nb_freq)
        pass.end()

        const commandBuffer = encoder.finish()
        this.device.queue.submit([commandBuffer])
        let promise = this.device.queue.onSubmittedWorkDone();
        setRenderDonePromise(promise);
    }

    addControllers() {
        throw new Error('addControllers() must be implemented by subclass')
    }
}
