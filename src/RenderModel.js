import { VertexBufferBuilder, UniformBufferBuilder } from './Buffer.js';
import { loadImageBitmap, loadWGSL, replaceAsync } from './utils.js'

const ZOOM_FACTOR = 2.0;
export class RenderModel {
    constructor(device, renderCtx) {
        this.renderCtx = renderCtx;
        this.device = device
        this.queue = []
        this.shaderModules = new Map()
        this.textures = new Map()
        this._pipelineObject = null

        this.uniformBufferBuilder = new UniformBufferBuilder(this.device)
        this.vertexBufferBuilder = new VertexBufferBuilder(this.device);
    }

    async initBlit() {
        const canvas = this.renderCtx.getCanvas();
        this.renderTexture = this.device.createTexture({
            size: [canvas.width, canvas.height],
            format: this.renderCtx.getFormat(),
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
        });

        await this.addShaderModule('blit', './shaders/blit.wgsl')
        this.blitPipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: this.shaderModules['blit'],
                entryPoint: 'vs'
            },
            fragment: {
                module: this.shaderModules['blit'],
                entryPoint: 'fs',
                targets: [{format: this.renderCtx.getFormat()}]
            }
        })
        this.blitBindGroup = this.device.createBindGroup({
            layout: this.blitPipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: this.device.createSampler({}),
                },
                {
                    binding: 1,
                    resource: this.renderTexture.createView(),
                },
            ],
        });

        // for zoom
        await this.addShaderModule('zoom', './shaders/zoom.wgsl')
        this.zoomPipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: this.shaderModules['zoom'],
                entryPoint: 'vs'
            },
            fragment: {
                module: this.shaderModules['zoom'],
                entryPoint: 'fs',
                targets: [{format: this.renderCtx.getFormat()}]
            }
        })

    }

    async initZoom() {
        const canvas = this.renderCtx.getZoomCanvas();
        if (!canvas) return;

        this.zoomParamsBuffer = this.device.createBuffer({
            size: 24,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.zoomBindGroup = this.device.createBindGroup({
            layout: this.zoomPipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: this.renderCtx.getSampler(),
                },
                {
                    binding: 1,
                    resource: this.renderTexture.createView(),
                },
                {
                    binding: 2,
                    resource: { buffer: this.zoomParamsBuffer },
                },

            ],
        });
    }

    async loadAsset() {
        throw new Error('loadAssets() must be implemented by subclass')
    }
    async updateImage(file) {
        await this.replaceTexture('texture-input', file)
        await this.createResources()
    }

    async init() {
        await this.initBlit()
        await this.loadAsset()
        this.createResources()
        this.addControls()
    }

    createResources() {}
    updateUniforms(...args) {}
    // encodeRenderPass() { throw new Error("encodeRenderPass() must be implemented by subclass"); }
    render() {
        throw new Error('render() must be implemented by subclass')
    }
    addControls() {
        // <label>PNG file: <input type="file" id="image_input" accept="image/png" id="load-image"></label>
        const container = document.getElementById("controller");
        const fileLabel = document.createElement("label");
        fileLabel.textContent = "PNG file: "
        const input = document.createElement("input")
        input.type = "file"
        input.accept = "image/png, image/jpg"
        input.addEventListener('change', async (event) => {
            const file = event.target.files[0]
            // create a temp. image object
            const data = await createImageBitmap(file, {
                colorSpaceConversion: 'none',
            })

            await this.updateImage(data)
            this.render()
        })
        fileLabel.appendChild(input);
        container.appendChild(fileLabel);
        // throw new Error('addControls() must be implemented by subclass')
    }

    addControllers(controls = []) {
        const controller = document.getElementById('controller')

        controls.forEach((ctrl) => {
            const label = document.createElement('label')
            label.textContent = `${ctrl.label}: `

            if (ctrl.type == 'range') {
                const input = document.createElement('input')
                input.type = 'range'
                input.id = ctrl.id
                input.min = ctrl.min
                input.max = ctrl.max
                input.step = ctrl.step
                input.value = ctrl.value
                input.addEventListener('input', () => {
                    ctrl.handler(parseFloat(input.value))
                    this.render()
                })
                label.appendChild(input)
            } else if (ctrl.type == 'radio') {
                const container = document.createElement('div')
                ctrl.options.forEach((size) => {
                    const radio = document.createElement('input')
                    radio.type = 'radio'
                    radio.name = ctrl.name
                    radio.value = size
                    if (size === ctrl.default) radio.checked = true

                    radio.addEventListener('change', () => {
                        ctrl.handler(parseFloat(radio.value))
                        this.render()
                    })
                    const radioLabel = document.createElement('label')
                    radioLabel.textContent = `${size}×${size}`
                    radioLabel.appendChild(radio)

                    container.appendChild(radioLabel)
                })

                label.appendChild(container)
                controller.appendChild(label)
            }

            controller.appendChild(label)
        })
    }

    async addShaderModule(name, path) {
        try {
            if (this.shaderModules.has(name))
                throw new Error('shader name already exists')

            let shaderSrc = await loadWGSL(path)
            let shaderSrcReplaced = await replaceAsync(shaderSrc, /#include\s+"(.*?)"/g, async (_, path)=> await loadWGSL(path));

            const module = this.device.createShaderModule({
                label: name,
                code: shaderSrcReplaced,
            })
            this.shaderModules[name] = module
            return module
        } catch (e) {
            console.log(e)
        }
    }

    async replaceTexture(name, bitmap, format = 'rgba8unorm') {
        const oldTexture = this.textures[name]
        if (oldTexture && typeof oldTexture.destroy === 'function') {
            oldTexture.destroy()
        }
        await this.addTexture(name, bitmap, (format = 'rgba8unorm'))
    }

    async addStorage(name, format = "r32float", size) {
        const texture = this.device.createTexture({
            label: name,
            format: format,
            size: [size.width, size.height],
            usage:
                GPUTextureUsage.STORAGE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT,
        })
        this.textures[name] = texture
        return texture

    }

    async addTexture(name, blob, format = 'rgba8unorm') {
        const source = await loadImageBitmap(blob)
        const texture = this.device.createTexture({
            label: name,
            format,
            size: [source.width, source.height],
            usage:
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT,
        })
        this.textures[name] = texture
        this.device.queue.copyExternalImageToTexture(
            { source },
            { texture },
            { width: source.width, height: source.height }
        )
        this.renderCtx.setCanvasSize(source.width, source.height);

        return texture
    }

    swapFramebuffer(encoder) {
        const swapChainPass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: this.renderCtx.getView(), 
                    loadOp: 'clear',
                    storeOp: 'store',
                    clearValue: [0, 0, 0, 1],
                },
            ],
        });
    
        swapChainPass.setPipeline(this.blitPipeline);
        swapChainPass.setBindGroup(0, this.blitBindGroup);
        swapChainPass.draw(6);
        swapChainPass.end();
    
        this.device.queue.submit([encoder.finish()]);
    }

    destroy() {
        // Destroy texture
        this.textures.forEach((texture) => {
            texture.destroy();
        })

        // Destroy controller
        const controllers = document.getElementById('controller');
        controllers.innerHTML = "";

        // this.device.queue
    }

    renderZoom(mouseX, mouseY, canvasWidth, canvasHeight) {
        this.device.queue.writeBuffer(
            this.zoomParamsBuffer,
            0,
            new Float32Array([mouseX / canvasWidth, mouseY / canvasHeight, ZOOM_FACTOR, canvasWidth, canvasHeight])
        );

        const encoder = this.device.createCommandEncoder({ label: 'zoom' })
        const pass = encoder.beginRenderPass({
            label: 'nique',
            colorAttachments: [
                {
                    view: this.renderCtx.getZoomView(),
                    clearValue: [1.0, 1.0, 1.0, 1],
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        })
        pass.setPipeline(this.zoomPipeline)
        pass.setBindGroup(0, this.zoomBindGroup)
        pass.setVertexBuffer(0, this.vertexBuffer.getBufferObject());
        pass.draw(6)
        pass.end()

        const commandBuffer = encoder.finish();
        this.device.queue.submit([commandBuffer]);
    }
}
