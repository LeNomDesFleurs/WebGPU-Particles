import { loadImageBitmap, loadWGSL } from './utils.js'

export class RenderModel {
    constructor(device) {
        this.device = device
        this.queue = []
        this.shaderModules = new Map()
        this.textures = new Map()
        this._pipelineObject = null
    }

    async loadAsset() {
        throw new Error('loadAssets() must be implemented by subclass')
    }
    createResources() {
        throw new Error('createResources() must be implemented by subclass')
    }
    updateUniforms(...args) {
        throw new Error('updateUniforms() must be implemented by subclass')
    }
    // encodeRenderPass() { throw new Error("encodeRenderPass() must be implemented by subclass"); }
    render() {
        throw new Error('render() must be implemented by subclass')
    }
    addControls() {
        throw new Error('addControls() must be implemented by subclass')
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

            const shaderSrc = await loadWGSL(path)
            const module = this.device.createShaderModule({
                label: name,
                code: shaderSrc,
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
            { source},
            { texture },
            { width: source.width, height: source.height }
        )

        return texture
    }
}
