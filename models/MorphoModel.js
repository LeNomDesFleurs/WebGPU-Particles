import { UniformBufferBuilder } from '../src/Buffer.js'
import { RenderModel } from '../src/RenderModel.js'
import { state } from '../src/utils.js'

var IMAGE_URL = '../assets/rose.jpg'
let DITHERING_SHADER_PATH = './shaders/morpho.wgsl'

const VERTEX_DATA = new Float32Array([
     -1.0, -1.0, 0.0,  0.0,  // center
    1.0, -1.0, 1.0,  0.0,  // right, center
    -1.0, 1.0, 0.0,  1.0,  // center, top

    // 2nd triangle
    -1.0, 1.0, 0.0,  1.0,  // center, top
     1.0, -1.0, 1.0,  0.0,  // right, center
     1.0, 1.0, 1.0,  1.0,  // right, top
])

export class MorphoModel extends RenderModel {
    constructor(device, renderCtx) {
        super(device, renderCtx)
    }

    async loadAsset() {
        await this.addTexture('texture-input', IMAGE_URL)
        await this.addShaderModule('dithering', DITHERING_SHADER_PATH)
    }

    createResources() {
        this.uniformBuffer = this.uniformBufferBuilder
            .add({ name: 'resolution', type: 'vec2' })
            .add({ name: 'op', type: 'i32' })
            .add({ name: 'r', type: 'f32' })
            .add({ name: 'brush_type', type: 'i32' })
            .add({ name: 'p', type: 'f32' })
            .build()

        this.vertexBuffer = this.vertexBufferBuilder
            .bindBufferData(VERTEX_DATA)
            .addAttribute({ location: 0, type: 'vec2f'})
            .addAttribute({ location: 1, type: 'vec2f'})
            .build();
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
                        attributes: this.vertexBuffer.getAttributes()
                    }
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
        // console.log(state.op);
        // console.log(state.r);
        console.log(state.brush_type);
        // console.log(state.p);

        this.uniformBuffer
            .set('resolution', canvasSize)
            .set('op', state.op)
            .set('r', state.r)
            .set('brush_type', state.brush_type)
            .set('p', state.p)
            .apply();
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
                handler: (v) => (state.r = (v+32) / 16.0),
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
        pass.setVertexBuffer(0, this.vertexBuffer.getBufferObject());
        pass.draw(6)
        pass.end()

        this.swapFramebuffer(encoder);
        renderDonePromise = device.queue.onSubmittedWorkDone();

    }
}
