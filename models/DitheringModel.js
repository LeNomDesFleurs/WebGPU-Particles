import { UniformBufferBuilder } from '../src/Buffer.js'
import { RenderModel } from '../src/RenderModel.js'
import { state } from '../src/utils.js'

var IMAGE_URL = '../assets/rose.jpg'
let DITHERING_SHADER_PATH = './shaders/dithering.wgsl'

const VERTEX_DATA = new Float32Array([
     -1.0, -1.0, 0.0,  0.0,  // center
    1.0, -1.0, 1.0,  0.0,  // right, center
    -1.0, 1.0, 0.0,  1.0,  // center, top

    // 2nd triangle
    -1.0, 1.0, 0.0,  1.0,  // center, top
     1.0, -1.0, 1.0,  0.0,  // right, center
     1.0, 1.0, 1.0,  1.0,  // right, top
])

export class DitheringModel extends RenderModel {
    constructor(device, renderCtx) {
        super(device, renderCtx)
    }

    async loadAsset() {
        await this.addTexture('texture-input', IMAGE_URL)
        await this.addShaderModule('dithering', DITHERING_SHADER_PATH)
    }

    createResources() {
        const bufferBuilder = new UniformBufferBuilder(this.device)
        this.uniformBuffer = bufferBuilder
            .add({ name: 'resolution', type: 'vec2' })
            .add({ name: 'col-nb', type: 'f32' })
            .add({ name: 'dith-str', type: 'f32' })
            .add({ name: 'bayer_filter_size', type: 'f32' })
            .add({ name: 'pixelate', type: 'f32' })
            .build()
        
        
        this.vertexBuffer = this.device.createBuffer({
            label: 'vertex buffer vertices',
            size: VERTEX_DATA.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(this.vertexBuffer, 0, VERTEX_DATA);
            

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
                        arrayStride: 4 * 4,
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: 'float32x2'},
                            { shaderLocation: 1, offset: 2 * 4, format: 'float32x2'}
                        ]
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
        this.uniformBuffer.set('resolution', canvasSize)
        this.uniformBuffer.set('col-nb', state.colNb)
        this.uniformBuffer.set('pixelate', state.pixelate)
        this.uniformBuffer.set('dith-str', state.ditherStrength)
        this.uniformBuffer.set('bayer_filter_size', state.bayerFilterSize)
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

    async init() {
        await this.loadAsset()
        this.createResources()
        this.addControls()
    }

    render() {
        const encoder = this.device.createCommandEncoder({ label: 'dithering' })
        this.updateUniforms()

        const pass = encoder.beginRenderPass({
            label: 'nique',
            colorAttachments: [
                {
                    view: this.renderCtx.getView(),
                    clearValue: [1.0, 1.0, 1.0, 1],
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        })
        pass.setPipeline(this.pipeline)
        pass.setBindGroup(0, this.bindGroup)
        pass.setVertexBuffer(0, this.vertexBuffer);
        pass.draw(6)
        pass.end()
        console.log('view format:', this.renderCtx.getFormat());

        const commandBuffer = encoder.finish()
        this.device.queue.submit([commandBuffer])
    }

    // static transformCanvas(p, canvasWidth, canvasHeight) {
    //     let angle = p*180.
    //     let radians = angle * (Math.PI / 180.);

    //     const W = canvasWidth * Math.abs(Math.cos(radians)) + canvasHeight * Math.abs(Math.sin(radians));
    //     const H = canvasWidth * Math.abs(Math.sin(radians)) + canvasHeight * Math.abs(Math.cos(radians));
    //     const a = Math.min(canvasWidth / W, canvasHeight / H);

    //     const rotationMatrix = mat4.create();
    //     mat4.rotate(rotationMatrix, rotationMatrix, radians, [0, 0, 1]);

    //     const scaleMatrix = mat4.create();
    //     mat4.scale(scaleMatrix, scaleMatrix, [a, a, 1]);

    //     const transformMatrix = mat4.multiply(mat4.create(), rotationMatrix, scaleMatrix);

    //     return transformMatrix;
    // }
}
