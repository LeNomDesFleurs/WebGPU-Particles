import { UniformBufferBuilder } from "../Buffer.js";
import { RenderModel } from "../RenderModel.js";
import { mat4 } from "../lib/esm/index.js"
import { state } from "../utils.js";

let IMAGE_URL = './rose.jpg'
let DITHERING_SHADER_PATH = "./shaders/dithering-mat4.wgsl"

export class DitheringModel extends RenderModel {
    constructor(device, renderCtx) {
        super(device);
        this.renderCtx = renderCtx;
    }

    async loadAsset() {
        await this.addTexture('main-rose', IMAGE_URL);
        await this.addShaderModule('dithering', DITHERING_SHADER_PATH);
    }

    createResources() {
        const bufferBuilder = new UniformBufferBuilder(this.device);
        this.uniformBuffer = bufferBuilder
                                        .add({ name: 'transform-matrix', type: 'mat4'})
                                        .add({ name: 'resolution', type: 'vec2' })
                                        .add({ name: 'col-nb', type: 'f32'})
                                        .add({ name: 'dith-str', type: 'f32' })
                                        .build();


        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [{
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
                sampler: { type: 'non-filtering' }
            },
            {
                binding: 2,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: 'unfilterable-float',
                    viewDimension: '2d',
                    multisampled: false,
                }
            }]
        });
        
        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [ bindGroupLayout ],
        });

        this.bindGroup = this.device.createBindGroup({
            label: 'dithering-bindgroup',
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer.getBufferObject(),} },
                { binding: 1, resource: this.renderCtx.getSampler() },
                { binding: 2, resource: this.textures['main-rose'].createView() },
            ],
        })

        this.pipeline = this.device.createRenderPipeline({
            label: 'dithering-pipeline',
            layout: pipelineLayout,
            vertex: { module: this.shaderModules['dithering'] },
            fragment: {
                module: this.shaderModules['dithering'],
                targets: [{ format : this.renderCtx.getFormat() }],
            },
        })
    }

    updateUniforms(...args) {
        const canvasSize = this.renderCtx.getCanvasSize();
        this.uniformBuffer.set('transform-matrix', DitheringModel.transformCanvas(state.p, canvasSize[0], canvasSize[1]));
        this.uniformBuffer.set('resolution', canvasSize);
        this.uniformBuffer.set('col-nb', state.colNb);
        this.uniformBuffer.set('dith-str', state.ditherStrength);
        this.device.queue.writeBuffer(this.uniformBuffer.getBufferObject(), 0, this.uniformBuffer.getBuffer());
    }

    addControllers() {
        const rot = document.getElementById('control-p');
        rot.addEventListener('input', () => {
            state.p = parseFloat(rot.value) / 255.0;
            this.render();
        });
    
        const colNb = document.getElementById('col-nb');
        colNb.addEventListener('input', () => {
            state.colNb = parseFloat(colNb.value);
            this.render();
        });
    
        const dithStr = document.getElementById('dith-str');
        dithStr.addEventListener('input', () => {
            state.ditherStrength = parseFloat(dithStr.value) / 255.0;
            this.render();
        })
    }

    encodeRenderPass() {

    }

    async init() {
        await this.loadAsset();
        this.createResources();
        this.addControllers();
    }

    render() {
        const encoder = this.device.createCommandEncoder({ label: 'dithering' });
        this.updateUniforms();

        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: this.renderCtx.getView(),
                clearValue: [1.0, 1.0, 1.0, 1],
                loadOp: 'clear',
                storeOp: 'store'
            }],    
        });
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroup)
        pass.draw(6);
        pass.end()

        const commandBuffer = encoder.finish()
        this.device.queue.submit([commandBuffer])
    }


    static transformCanvas(p, canvasWidth, canvasHeight) {
        let angle = p*180.
        let radians = angle * (Math.PI / 180.);
    
        const W = canvasWidth * Math.abs(Math.cos(radians)) + canvasHeight * Math.abs(Math.sin(radians));
        const H = canvasWidth * Math.abs(Math.sin(radians)) + canvasHeight * Math.abs(Math.cos(radians));
        const a = Math.min(canvasWidth / W, canvasHeight / H);

        const rotationMatrix = mat4.create();
        mat4.rotate(rotationMatrix, rotationMatrix, radians, [0, 0, 1]);
    
        const scaleMatrix = mat4.create();
        mat4.scale(scaleMatrix, scaleMatrix, [a, a, 1]);
        
        const transformMatrix = mat4.multiply(mat4.create(), rotationMatrix, scaleMatrix);
    
        return transformMatrix;
    }
}