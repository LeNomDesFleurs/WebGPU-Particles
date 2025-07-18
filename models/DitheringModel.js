import { UniformBufferBuilder } from '../src/Buffer.js'
import { RenderModel } from '../src/RenderModel.js'
import { state, IMAGE_URL, BITMAP, setRenderDonePromise } from '../src/utils.js'

let DITHERING_SHADER_PATH = './shaders/dithering.wgsl'

const VERTEX_DATA = new Float32Array([
    -1.0,
    -1.0,
    0.0,
    0.0, // center
    1.0,
    -1.0,
    1.0,
    0.0, // right, center
    -1.0,
    1.0,
    0.0,
    1.0, // center, top

    // 2nd triangle
    -1.0,
    1.0,
    0.0,
    1.0, // center, top
    1.0,
    -1.0,
    1.0,
    0.0, // right, center
    1.0,
    1.0,
    1.0,
    1.0, // right, top
])

export class Dithering extends RenderModel {
    constructor(device, renderCtx) {
        super(device, renderCtx)
    }

    async loadAsset() {
        await this.addTextureBitmap('texture-input', BITMAP)
        await this.addShaderModule('dithering', DITHERING_SHADER_PATH)
    }

    createResources() {
        this.uniformBuffer = this.uniformBufferBuilder
            .add({ name: 'resolution', type: 'vec2' })
            .add({ name: 'col-nb', type: 'f32' })
            .add({ name: 'dith-str', type: 'f32' })
            .add({ name: 'bayer_filter_size', type: 'f32' })
            .add({ name: 'pixelate', type: 'f32' })
            .build()

        this.vertexBuffer = this.vertexBufferBuilder
            .bindBufferData(VERTEX_DATA)
            .addAttribute({ location: 0, type: 'vec2f' })
            .addAttribute({ location: 1, type: 'vec2f' })
            .build()
        this.vertexBuffer.apply() // TODO find a smoother way

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
            ],
        })

        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout],
        })

        this.bindGroup = this.device.createBindGroup({
            label: 'dithering-bindgroup',
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
            ],
        })

        this.pipeline = this.device.createRenderPipeline({
            label: 'dithering-pipeline',
            layout: pipelineLayout,
            vertex: {
                module: this.shaderModules['dithering'],
                buffers: [
                    {
                        arrayStride: this.vertexBuffer.getStride(),
                        attributes: this.vertexBuffer.getAttributes(),
                    },
                ],
            },
            fragment: {
                module: this.shaderModules['dithering'],
                targets: [{ format: this.renderCtx.getFormat() }],
            },
        })
    }

    updateUniforms(...args) {
        const canvasSize = this.renderCtx.getCanvasSize()
        this.uniformBuffer
            .set('resolution', canvasSize)
            .set('col-nb', state.colNb)
            .set('pixelate', state.pixelate)
            .set('dith-str', state.ditherStrength)
            .set('bayer_filter_size', state.bayerFilterSize)
            .apply()
    }

    addControls() {
        super.addControls()
        const controls = [
            {
                type: 'range',
                id: 'col-nb',
                label: 'color nb',
                min: 2,
                max: 20,
                value: 2,
                step: 1,
                handler: (v) => (state.colNb = v),
            },
            {
                type: 'range',
                id: 'dith-str',
                label: 'dither strength',
                min: 0,
                max: 255,
                value: 255,
                step: 1,
                handler: (v) => (state.ditherStrength = v / 255.0),
            },
            {
                type: 'range',
                id: 'pixelate',
                label: 'pixelate',
                min: 0,
                max: 1000,
                value: 1000,
                step: 1,
                handler: (v) => (state.pixelate = v / 1000.0),
            },
            {
                type: 'radio',
                name: 'bayer-size',
                label: 'bayer size',
                options: [2, 4, 8],
                default: 8,
                handler: (v) => (state.bayerFilterSize = v),
            },
        ]

        this.addControllers(controls)
    }

    render() {
        const encoder = this.device.createCommandEncoder({ label: 'dithering' })
        this.updateUniforms()

        const pass = encoder.beginRenderPass({
            label: 'nique',
            colorAttachments: [
                {
                    view: this.renderTexture.createView(),
                    clearValue: [1.0, 1.0, 1.0, 1],
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        })
        pass.setPipeline(this.pipeline)
        pass.setBindGroup(0, this.bindGroup)
        pass.setVertexBuffer(0, this.vertexBuffer.getBufferObject())
        pass.draw(6)
        pass.end()

        this.swapFramebuffer(encoder)
        let promise = this.device.queue.onSubmittedWorkDone()
        setRenderDonePromise(promise)
    }
}
