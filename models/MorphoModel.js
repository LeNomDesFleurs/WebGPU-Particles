import { UniformBufferBuilder } from '../src/Buffer.js'
import { RenderModel } from '../src/RenderModel.js'
import { state, BITMAP, setRenderDonePromise } from '../src/utils.js'

let MORPHO_SHADER_PATH = './shaders/morpho.wgsl'

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

export class Morpho extends RenderModel {
    constructor(device, renderCtx) {
        super(device, renderCtx)
    }

    async loadAsset() {
        await this.addTextureBitmap('texture-input', BITMAP)
        await this.addShaderModule('morpho', MORPHO_SHADER_PATH)
    }

    createResources() {
        const canvas = document.getElementById('gfx')
        const context = canvas.getContext('webgpu')

        context.configure({
            device: this.device,
            format: 'bgra8unorm',
            alphaMode: 'premultiplied',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        })

        this.uniformBuffer = this.uniformBufferBuilder
            .add({ name: 'resolution', type: 'vec2' })
            .add({ name: 'op', type: 'i32' })
            .add({ name: 'r', type: 'f32' })
            .add({ name: 'brush_type', type: 'i32' })
            .add({ name: 'p', type: 'f32' })
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
            label: 'morpho-bindgroup',
            layout: bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.uniformBuffer.getBufferObject() },
                },
                {
                    binding: 1,
                    resource: this.renderCtx.getSampler(),
                },
                {
                    binding: 2,
                    resource: this.textures['texture-input'].createView(),
                },
            ],
        })

        this.pipeline = this.device.createRenderPipeline({
            label: 'morpho-pipeline',
            layout: pipelineLayout,
            vertex: {
                module: this.shaderModules['morpho'],
                buffers: [
                    {
                        arrayStride: this.vertexBuffer.getStride(),
                        attributes: this.vertexBuffer.getAttributes(),
                    },
                ],
            },
            fragment: {
                module: this.shaderModules['morpho'],
                targets: [{ format: this.renderCtx.getFormat() }],
            },
        })
    }

    updateUniforms(...args) {
        const canvasSize = this.renderCtx.getCanvasSize()
        // console.log(state.op);
        // console.log(state.r);
        console.log(state.brush_type)
        // console.log(state.p);

        this.uniformBuffer
            .set('resolution', canvasSize)
            .set('op', state.op)
            .set('r', state.r)
            .set('brush_type', state.brush_type)
            .set('p', state.p)
            .apply()
    }

    addControls() {
        super.addControls()
        const controls = [
            {
                type: 'radio',
                id: 'op',
                label: 'op',
                options: [0, 1],
                default: 2,
                handler: (v) => (state.op = v),
            },
            {
                type: 'range',
                id: 'r',
                label: 'r',
                min: 0,
                max: 255,
                value: 100,
                step: 1,
                handler: (v) => (state.r = (v + 32.0) / 16.0),
            },
            {
                type: 'range',
                id: 'brush_type',
                label: 'brush_type',
                min: 0,
                max: 3,
                value: 1,
                step: 1,
                handler: (v) => (state.brush_type = v),
            },
            {
                type: 'range',
                name: 'p',
                label: 'p',
                min: 0,
                max: 1000,
                value: 500,
                step: 1,
                handler: (v) => (state.p = v / 1000.0),
            },
        ]

        this.addControllers(controls)
    }

    render() {
        const encoder = this.device.createCommandEncoder({ label: 'morpho' })
        this.updateUniforms()

        const pass = encoder.beginRenderPass({
            label: 'morpho-encoder',
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
    }
}
