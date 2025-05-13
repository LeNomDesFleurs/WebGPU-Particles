import { loadImageBitmap, loadWGSL } from './utils.js'

export class RenderModel {
    constructor(device) {
        this.device = device;
        this.queue = [];
        this.shaderModules = new Map();
        this.textures = new Map();
        this._pipelineObject = null;
    }

    async loadAsset() { throw new Error("loadAssets() must be implemented by subclass"); }
    createResources() { throw new Error("createResources() must be implemented by subclass"); }
    updateUniforms(...args) { throw new Error("updateUniforms() must be implemented by subclass"); }
    encodeRenderPass() { throw new Error("encodeRenderPass() must be implemented by subclass"); }
    render() { throw new Error("render() must be implemented by subclass"); }
    addControllers() { throw new Error("addControllers() must be implemented by subclass"); }

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
}