import { RenderModel } from "../RenderModel.js";
import { UniformBufferBuilder } from "../Buffer.js";


export class DCTModel extends RenderModel {
    constructor(device, renderCtx) {
        super(device);
        this.renderCtx = renderCtx;
    }

    async loadAsset() {
        await this.addTexture('main-rose', "./rose.jpg");
        await this.addShaderModule('dct1', "./shaders/DCT1.wgsl");
        await this.addShaderModule('dct2', "./shaders/DCT2.wgsl");
        await this.addShaderModule('dct3', "./shaders/DCT3.wgsl");
    }

    createResources() {
        const bufferBuilder = new UniformBufferBuilder(this.device);
        this.uniformBuffer = bufferBuilder.add({ name: 'resolution', type: 'vec2'}).build();

        this.textureOut1 = this.device.createTexture({
            label: "texture-out1",
            format: 'rgba8unorm',
            size: [1000, 1000],
            usage: GPUTextureUsage.TEXTURE_BINDING |
                    GPUTextureUsage.RENDER_ATTACHMENT
        });
        this.textureOut2 = this.device.createTexture({
            label: "texture-out2",
            format: 'rgba8unorm',
            size: [1000, 1000],
            usage: GPUTextureUsage.TEXTURE_BINDING |
                    GPUTextureUsage.RENDER_ATTACHMENT
        });

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
            label: 'dct1-bindgroup',
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer.getBufferObject(),} },
                { binding: 1, resource: this.renderCtx.getSampler() },
                { binding: 2, resource: this.textures['main-rose'].createView() },
            ],
        })

        this.pipeline = this.device.createRenderPipeline({
            label: 'dct1-pipeline',
            layout: pipelineLayout,
            vertex: { module: this.shaderModules['dct1'] },
            fragment: {
                module: this.shaderModules['dct1'],
                targets: [{ format : this.renderCtx.getFormat() }],
            },
        })
    }


    updateUniforms(...args) {
        const canvasSize = this.renderCtx.getCanvasSize();
        this.uniformBuffer.set('resolution', canvasSize);
        this.device.queue.writeBuffer(this.uniformBuffer.getBufferObject(), 0, this.uniformBuffer.getBuffer());
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

    async init() {
        await this.loadAsset();
        this.createResources();
    }

    addControllers() { throw new Error("addControllers() must be implemented by subclass"); }

    

}