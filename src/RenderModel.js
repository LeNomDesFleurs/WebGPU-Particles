import { VertexBufferBuilder, UniformBufferBuilder } from './Buffer.js'
import {
    loadImageBitmap,
    loadBitMap,
    loadWGSL,
    replaceAsync,
    getRenderDonePromise,
    setImageUrl,
    SetBitMap,
    getBitMap,
} from './utils.js'

const ZOOM_FACTOR = 2.0
export class RenderModel {
    constructor(device, renderCtx) {
        this.renderCtx = renderCtx
        this.device = device
        this.queue = []
        this.shaderModules = new Map()
        this.pixelBuffer
        this.textures = new Map()
        this._pipelineObject = null

        this.uniformBufferBuilder = new UniformBufferBuilder(this.device)
        this.vertexBufferBuilder = new VertexBufferBuilder(this.device)
    }

    async initBlit() {
        const canvas = this.renderCtx.getCanvas()
        this.renderTexture = this.device.createTexture({
            size: [canvas.width, canvas.height],
            format: this.renderCtx.getFormat(),
            usage:
                GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_SRC,
        })

        await this.addShaderModule('blit', './shaders/blit.wgsl')
        this.blitPipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: this.shaderModules['blit'],
                entryPoint: 'vs',
            },
            fragment: {
                module: this.shaderModules['blit'],
                entryPoint: 'fs',
                targets: [{ format: this.renderCtx.getFormat() }],
            },
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
        })

        // for zoom
        await this.addShaderModule('zoom', './shaders/zoom.wgsl')
        this.zoomPipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: this.shaderModules['zoom'],
                entryPoint: 'vs',
            },
            fragment: {
                module: this.shaderModules['zoom'],
                entryPoint: 'fs',
                targets: [{ format: this.renderCtx.getFormat() }],
            },
        })
    }

    async initZoom() {
        const canvas = this.renderCtx.getZoomCanvas()
        if (!canvas) return

        this.zoomParamsBuffer = this.device.createBuffer({
            size: 24,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })

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
        })
    }

    async loadAsset() {
        throw new Error('loadAssets() must be implemented by subclass')
    }
    async updateImage(file) {
        await this.replaceTexture('texture-input', file)
        await this.createResources()
    }

    async updateImageBitmap(bitmap) {
        await this.replaceTexture('texture-input', bitmap)
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
        const container = document.getElementById('controller')
        const fileLabel = document.createElement('label')
        // fileLabel.textContent = "PNG file: "
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/png, image/jpg, image/jpeg'
        input.addEventListener('change', async (event) => {
            const file = event.target.files[0]
            await setImageUrl(file)
            // create a temp. image object
            const data = await createImageBitmap(file, {
                colorSpaceConversion: 'none',
            })
            await loadBitMap(data)
            // SetBitMap(data);
            let bitmap = await getBitMap()
            await this.updateImageBitmap(bitmap)
            this.render()
        })
        fileLabel.appendChild(input)
        container.appendChild(fileLabel)

        // <button id="download">Download Canvas</button>

        const DownloadButton = document.createElement('button')
        ;(DownloadButton.textContent = 'Download'),
            (DownloadButton.style.width = '100px')
        DownloadButton.addEventListener('click', async (event) => {
            await this.render()
            handeDownload(this.pixelBuffer, this.widthBytes, this.heightBytes)
        })
        container.appendChild(DownloadButton)

        async function handeDownload(pixelBuffer, widthBytes, heightBytes) {
            let canvas = document.getElementById('gfx')
            let canvasUrl = canvas.toDataURL('image/jpeg', 1)
            const createEl = document.createElement('a')
            createEl.href = canvasUrl
            createEl.download = 'Processed Image'
            createEl.click()
            createEl.remove()
        }

        function convertBGRAtoRGBA(input, width, height) {
            const output = new Uint8ClampedArray(width * height * 4)
            for (let i = 0; i < width * height; i++) {
                const idx = i * 4
                output[idx + 0] = input[idx + 2] // R <- B
                output[idx + 1] = input[idx + 1] // G <- G
                output[idx + 2] = input[idx + 0] // B <- R
                output[idx + 3] = input[idx + 3] // A unchanged
            }
            return output
        }
    }

    addControllers(controls = []) {
        const controller = document.getElementById('controller')

        controls.forEach((ctrl) => {
            const label = document.createElement('label')
            label.textContent = `${ctrl.label}: `
            label.style.width = '250px'

            if (ctrl.type == 'range') {
                const input = document.createElement('input')
                input.type = 'range'
                input.id = ctrl.id
                input.min = ctrl.min
                input.max = ctrl.max
                input.step = ctrl.step
                input.value = ctrl.value
                // TODO throttle sliders
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
            let shaderSrcReplaced = await replaceAsync(
                shaderSrc,
                /#include\s+"(.*?)"/g,
                async (_, path) => await loadWGSL(path)
            )

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

    async replaceTexture(name, url, format = 'rgba8unorm') {
        const oldTexture = this.textures[name]
        if (oldTexture && typeof oldTexture.destroy === 'function') {
            oldTexture.destroy()
        }
        await this.addTextureBitmap(name, url, (format = 'rgba8unorm'))
    }

    // trying to normalize the use of the state bitmap, keeping the old function to be sure;
    async replaceTextureBitMap(name, bitmap, format = 'rgba8unorm') {
        const oldTexture = this.textures[name]
        if (oldTexture && typeof oldTexture.destroy === 'function') {
            oldTexture.destroy()
        }
        await this.addTextureBitmap(name, bitmap, (format = 'rgba8unorm'))
    }

    async addStorage(name, format = 'r32float', size) {
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
    //trying to generalize the use of the state bitmap, keeping old function below for now
    async addTextureBitmap(name, bitmap, format = 'rgba8unorm') {
        this.width = bitmap.width
        this.height = bitmap.height
        const texture = this.device.createTexture({
            label: name,
            format,
            size: [bitmap.width, bitmap.height],
            usage:
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT,
        })
        this.textures[name] = texture
        this.device.queue.copyExternalImageToTexture(
            { source: bitmap },
            { texture },
            { width: bitmap.width, height: bitmap.height }
        )

        console.log('setsize')
        console.log([bitmap.width, bitmap.height])
        // this.renderCtx.setCanvasSize(bitmap.width, bitmap.height)
        let canvas = this.renderCtx.getCanvas()
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        return texture
    }

    async addTexture(name, blob, format = 'rgba8unorm') {
        const source = await loadImageBitmap(blob, {
            colorSpaceConversion: 'none',
        })
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

        console.log('2nd set')
        console.log([source.width, source.height])
        let canvas = this.renderCtx.getCanvas()
        canvas.width = source.width
        canvas.height = source.height
        // this.renderCtx.setCanvasSize(source.width, source.height)

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
        })

        swapChainPass.setPipeline(this.blitPipeline)
        swapChainPass.setBindGroup(0, this.blitBindGroup)
        swapChainPass.draw(6)
        swapChainPass.end()

        this.device.queue.submit([encoder.finish()])
    }

    destroy() {
        // Destroy texture
        this.textures.forEach((texture) => {
            texture.destroy()
        })

        // Destroy controller
        const controllers = document.getElementById('controller')
        controllers.innerHTML = ''

        // this.device.queue
    }

    renderZoom(mouseX, mouseY, canvasWidth, canvasHeight) {
        this.device.queue.writeBuffer(
            this.zoomParamsBuffer,
            0,
            new Float32Array([
                mouseX / canvasWidth,
                mouseY / canvasHeight,
                ZOOM_FACTOR,
                canvasWidth,
                canvasHeight,
            ])
        )

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
        pass.setVertexBuffer(0, this.vertexBuffer.getBufferObject())
        pass.draw(6)
        pass.end()

        const commandBuffer = encoder.finish()
        this.device.queue.submit([commandBuffer])
    }
}
