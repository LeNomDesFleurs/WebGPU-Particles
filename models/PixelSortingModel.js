import { RenderModel } from "../RenderModel.js";

export class PixelSortingModel extends RenderModel {
    async loadAsset() {
        await this.addTexture('main-rose', "./rose.jpg");
    }
    
    createResources() {
        // --------------------------- BIND GROUP
        const bindGroupLayout = device.createBindGroupLayout({
            entries: [{
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
                sampler: {
                    type: 'non-filtering',
                },
            },
            {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                texture: {
                    sampleType: 'unfilterable-float',
                    viewDimension: '2d',
                    multisampled: false,
                },
            },
            {
                binding: 3,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: {
                    access: "write-only",
                    format: "rgba8unorm",
                    viewDimension: '2d',

                },
            },
            //Storage
            {
                binding: 4,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: {
                    access: "read-write",
                    format: "r32sint",
                    viewDimension: '2d',

                },
            },
            {
                binding: 5,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: {
                    access: "read-write",
                    format: "r32float",
                    viewDimension: '2d',

                },
            },
            {
                binding: 6,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: {
                    access: "read-write",
                    format: "r32uint",
                    viewDimension: '2d',

                },
            },
            ],
        });

    }
    updateUniforms(...args) { throw new Error("updateUniforms() must be implemented by subclass"); }
    encodeRenderPass() { throw new Error("encodeRenderPass() must be implemented by subclass"); }
    render() { throw new Error("render() must be implemented by subclass"); }
}