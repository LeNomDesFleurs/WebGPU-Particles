import { RenderModel } from '../src/RenderModel.js'
import { UniformBufferBuilder } from '../src/Buffer.js'
import { BITMAP, state, setRenderDonePromise, loadImageBitmap } from '../src/utils.js'

export class DCT extends RenderModel {
    constructor(device, renderCtx) {
        super(device, renderCtx)
    }

    async loadAsset() {
        const source = await this.addTextureBitmap('texture-input', BITMAP)
        await this.addShaderModule('dct1', './shaders/DCTcompute.wgsl')
    }

    createResources() {
        const canvas = document.getElementById('gfx')
        const context = canvas.getContext('webgpu')

        this.uniformBuffer = this.uniformBufferBuilder
            .add({ name: 'resolution', type: 'vec2' })
            .add({ name: 'frequence', type: 'f32' })
            .add({name: 'compression', type: 'f32'})
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

        this.layout = bindGroupLayout;

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

    updateUniforms() {
        const canvasSize = this.renderCtx.getCanvasSize()
        this.uniformBuffer
            .set('resolution', canvasSize)
            .set('frequence', state.freq)
            .set('compression', state.compression)
            .apply()
    }

    addControls() {
        super.addControls()
        const controls = [
            {
                type: 'range',
                id: 'freq',
                label: 'freq',
                min: 0,
                max: 7,
                value: 0,
                step: 1,
                handler: (v) => (state.freq = v ),
            },
            {
                type: 'range',
                id: 'compression',
                label: 'compression',
                min: 0,
                max: 255,
                value: 150,
                step: 1,
                handler: (v) => (state.compression = v / 8.0),
            },
        ]

        this.addControllers(controls)
    }
    async render() {
        let nb_freq = 8

        const source = await loadImageBitmap(BITMAP)
const canvas = document.getElementById('gfx')
        const context = canvas.getContext('webgpu')
        
        this.updateUniforms()
        context.configure({
            device: this.device,
            format: 'rgba8unorm',
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
        })
        
        this.device.queue.copyExternalImageToTexture(
            { source: source },
            { texture: this.textures['texture-input'] },
            { width: source.width, height: source.height }
        )


        this.bindGroup1 = this.device.createBindGroup({
            label: 'dct1-bindgroup',
            layout: this.layout,
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

        const encoder = this.device.createCommandEncoder({ label: 'DCT' })


        const pass = encoder.beginComputePass()

        pass.setBindGroup(0, this.bindGroup1)
        pass.setPipeline(this.pipeline1)
        pass.dispatchWorkgroups(this.textures['texture-input'].width / nb_freq, this.textures['texture-input'].height / nb_freq)
        pass.end()

        const commandBuffer = encoder.finish()
        this.device.queue.submit([commandBuffer])
    }

  
}
