import { loadImageBitmap, loadWGSL, CANVAS_ID } from "./utils.js"
import { CommandQueue } from './RenderCommand.js'

export let rendererInstance = null;
export async function getRendererInstance() {
    if (rendererInstance) return rendererInstance;

    if (!navigator.gpu) throw new Error('WebGPU not supported.');
    
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter?.requestDevice();
    if (!device) throw new Error('No GPU device available.');

    const canvas = document.getElementById(CANVAS_ID);
    const context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format });

    rendererInstance = new Renderer(device, canvas, context, format);
    // await rendererInstance.init();
    return rendererInstance;
}

class Renderer {
    constructor(device, canvas, context, format) {
        this._device = device;
        this._canvas = canvas;
        this._context = context;
        this._format = format;

        this._sampler = this._device.createSampler();

    }

    getView() { return this._context.getCurrentTexture().createView(); }
    getSampler() { return this._sampler; }
    getDevice() { return this._device; }
    getFormat() { return this._format; }
    getCanvasSize() { return [this._canvas.width, this._canvas.height] }

    createModel() {
        return new RenderModel(this._device);
    }
}

class RenderModel {
    constructor(device) {
        this.device = device;

        this.queue = [];
        this.shaderModules = new Map();
        this.textures = new Map();
        this._pipelineObject = null;
    }

    async addShaderModule(name, path) {
        try {
            if (this.shaderModules.has(name)) throw new Error("shader name already exists")

            const shaderSrc = await loadWGSL(path);
            const module = this.device.createShaderModule({
                label: name,
                code: shaderSrc
            })
            this.shaderModules[name] = module;
            return module;
        } catch (e) {
            console.log(e);
        }
    }

    async addTexture(name, path, format='rgba8unorm') {
        const source = await loadImageBitmap(path);
        const texture = this.device.createTexture({
            label: name,
            format,
            size: [source.width, source.height],
            usage: GPUTextureUsage.TEXTURE_BINDING |
                    GPUTextureUsage.COPY_DST |
                    GPUTextureUsage.RENDER_ATTACHMENT,
        })
        this.textures[name] = texture;
        this.device.queue.copyExternalImageToTexture(
            { source, flipY: true },
            { texture },
            { width: source.width, height: source.height },
		);

        return texture;
    }

    setRenderPassEncoder(descriptor) { this._renderPassDescriptor = descriptor; }
    setVerticesNum(verticesNb) { this._verticesNb = verticesNb; }
    bindPipeline(pipeline) { this._pipelineObject = pipeline; }
    
    render() {
        const encoder = this.device.createCommandEncoder({ label: 'dithering' });

        const pass = encoder.beginRenderPass(this._renderPassDescriptor);
        pass.setPipeline(this._pipelineObject.getPipeline())
        pass.setBindGroup(0, this._pipelineObject.getBindGroup())
        pass.draw(this._verticesNb);
        pass.end()

        const commandBuffer = encoder.finish()
        this.device.queue.submit([commandBuffer])
    }

    createCommandQueue() {
        //TODO internally relate it
        return new CommandQueue(this.device);
    }
}