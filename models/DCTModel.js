import { RenderModel } from '../src/RenderModel.js'
import { UniformBufferBuilder } from '../src/Buffer.js'

export class DCTModel extends RenderModel {
    constructor(device, renderCtx) {
        super(device, renderCtx)
    }

    async loadAsset() {
        await this.addTexture('texture-input', IMAGE_URL)
        await this.addShaderModule('dct1', '../shaders/DCT1.wgsl')
        await this.addShaderModule('dct2', '../shaders/DCT2.wgsl')
        await this.addShaderModule('dct3', '../shaders/DCT3.wgsl')
    }

    createResources() {
        this.uniformBuffer = this.uniformBufferBuilder
            .add({ name: 'resolution', type: 'vec2' })
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

        this.textureOut2 = this.device.createTexture({
            label: 'texture-out2',
            format: 'rgba8unorm',
            size: [1000, 1000],
            usage:
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.STORAGE_BINDING,
        })

        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
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
                    sampler: { type: 'non-filtering' },
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {
                        sampleType: 'unfilterable-float',
                        viewDimension: '2d',
                        multisampled: false,
                    },
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.FRAGMENT,
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
                { binding: 1, resource: this.renderCtx.getSampler() },
                {
                    binding: 2,
                    resource: this.textures['texture-input'].createView(),
                },
                { binding: 3, resource: this.textureOut1.createView() },
            ],
        })

        this.bindGroup2 = this.device.createBindGroup({
            label: 'dct2-bindgroup',
            layout: bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.uniformBuffer.getBufferObject() },
                },
                { binding: 1, resource: this.renderCtx.getSampler() },
                { binding: 2, resource: this.textureOut1.createView() },
                { binding: 3, resource: this.textureOut2.createView() },
            ],
        })

        this.bindGroup3 = this.device.createBindGroup({
            label: 'dct1-bindgroup',
            layout: bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.uniformBuffer.getBufferObject() },
                },
                { binding: 1, resource: this.renderCtx.getSampler() },
                { binding: 2, resource: this.textureOut1.createView() },
                { binding: 3, resource: this.textureOut2.createView() },
            ],
        })

        this.pipeline1 = this.device.createRenderPipeline({
            label: 'dct1-pipeline',
            layout: pipelineLayout,
            vertex: { module: this.shaderModules['dct1'] },
            fragment: {
                module: this.shaderModules['dct1'],
                targets: [{ format: this.renderCtx.getFormat() }],
            },
        })

        this.pipeline2 = this.device.createRenderPipeline({
            label: 'dct2-pipeline',
            layout: pipelineLayout,
            vertex: { module: this.shaderModules['dct2'] },
            fragment: {
                module: this.shaderModules['dct2'],
                targets: [{ format: this.renderCtx.getFormat() }],
            },
        })

        this.pipeline3 = this.device.createRenderPipeline({
            label: 'dct3-pipeline',
            layout: pipelineLayout,
            vertex: { module: this.shaderModules['dct3'] },
            fragment: {
                module: this.shaderModules['dct3'],
                targets: [{ format: this.renderCtx.getFormat() }],
            },
        })
    }

    updateUniforms(...args) {
        const canvasSize = this.renderCtx.getCanvasSize()
        this.uniformBuffer.set('resolution', canvasSize)
        this.device.queue.writeBuffer(
            this.uniformBuffer.getBufferObject(),
            0,
            this.uniformBuffer.getBuffer()
        )
    }

    render() {
        const encoder = this.device.createCommandEncoder({ label: 'dct' })
        this.updateUniforms()

        const pass = encoder.beginRenderPass({
            label: 'first',
            colorAttachments: [
                {
                    view: this.renderCtx.getView(),
                    clearValue: [1.0, 1.0, 1.0, 1],
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        })
        pass.setPipeline(this.pipeline1)
        pass.setBindGroup(0, this.bindGroup1)
        pass.draw(6)
        pass.end()

        // const pass2 = encoder.beginRenderPass({
        //     label: 'second',
        //     colorAttachments: [{
        //         view: this.renderCtx.getView(),
        //         clearValue: [1.0, 1.0, 1.0, 1],
        //         loadOp: 'clear',
        //         storeOp: 'store'
        //     }],
        // });
        // pass2.setPipeline(this.pipeline2);
        // pass2.setBindGroup(0, this.bindGroup2)
        // pass2.draw(6);
        // pass2.end()

        const pass3 = encoder.beginRenderPass({
            label: 'third',
            colorAttachments: [
                {
                    view: this.renderCtx.getView(),
                    clearValue: [1.0, 1.0, 1.0, 1],
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        })
        pass3.setPipeline(this.pipeline3)
        pass3.setBindGroup(0, this.bindGroup3)
        pass3.draw(6)
        pass3.end()

        const commandBuffer = encoder.finish()
        this.device.queue.submit([commandBuffer])
    }

    async init() {
        await this.loadAsset()
        this.createResources()
    }

    addControllers() {
        throw new Error('addControllers() must be implemented by subclass')
    }
}
