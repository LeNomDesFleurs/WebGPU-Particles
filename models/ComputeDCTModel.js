import { RenderModel } from '../src/RenderModel.js'
import { UniformBufferBuilder } from '../src/Buffer.js'

export class ComputeDCTModel extends RenderModel {
    constructor(device, renderCtx) {
        super(device)
        this.renderCtx = renderCtx
    }

    async loadAsset() {
        await this.addTexture('main-rose', './assets/rose.jpg')
        await this.addShaderModule('dct1', './shaders/DCTcompute.wgsl')
    }

    createResources() {
        const canvas = document.getElementById('gfx')
        const context = canvas.getContext('webgpu')

        const bufferBuilder = new UniformBufferBuilder(this.device)
        this.uniformBuffer = bufferBuilder
            .add({ name: 'resolution', type: 'vec2' })
            .add({ name: 'frequence', type: 'f32' })
            .build()

        this.textureOut1 = this.device.createTexture({
            label: 'texture-out1',
            format: 'rgba8unorm',
            size: [1000, 1000],
            usage:
                GPUTextureUsage.TEXTURE_BINDING |
                // GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.STORAGE_BINDING,
        })

        context.configure({
            device: this.device,
            format: 'rgba8unorm',
            usage: GPUTextureUsage.STORAGE_BINDING,
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

        this.test = this.textureOut1.createView()

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
                    resource: this.textures['main-rose'].createView(),
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

    async init() {
        await this.loadAsset()
        await this.createResources()
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

        let width = 1000
        let height = 1000

        pass.setBindGroup(0, this.bindGroup1)
        pass.setPipeline(this.pipeline1)
        pass.dispatchWorkgroups(width / nb_freq, height / nb_freq)
        pass.end()

        const commandBuffer = encoder.finish()
        this.device.queue.submit([commandBuffer])
    }

    addControllers() {
        throw new Error('addControllers() must be implemented by subclass')
    }
}
