import { RenderModel } from '../src/RenderModel.js'
import { UniformBufferBuilder } from '../src/Buffer.js'
import { loadImageBitmap } from '../src/utils.js'
import { state, IMAGE_URL, setRenderDonePromise } from '../src/utils.js'

const mat3 = {
    multiply(a, b) {
        const a00 = a[0 * 3 + 0]
        const a01 = a[0 * 3 + 1]
        const a02 = a[0 * 3 + 2]
        const a10 = a[1 * 3 + 0]
        const a11 = a[1 * 3 + 1]
        const a12 = a[1 * 3 + 2]
        const a20 = a[2 * 3 + 0]
        const a21 = a[2 * 3 + 1]
        const a22 = a[2 * 3 + 2]
        const b00 = b[0 * 3 + 0]
        const b01 = b[0 * 3 + 1]
        const b02 = b[0 * 3 + 2]
        const b10 = b[1 * 3 + 0]
        const b11 = b[1 * 3 + 1]
        const b12 = b[1 * 3 + 2]
        const b20 = b[2 * 3 + 0]
        const b21 = b[2 * 3 + 1]
        const b22 = b[2 * 3 + 2]

        return [
            b00 * a00 + b01 * a10 + b02 * a20,
            b00 * a01 + b01 * a11 + b02 * a21,
            b00 * a02 + b01 * a12 + b02 * a22,
            b10 * a00 + b11 * a10 + b12 * a20,
            b10 * a01 + b11 * a11 + b12 * a21,
            b10 * a02 + b11 * a12 + b12 * a22,
            b20 * a00 + b21 * a10 + b22 * a20,
            b20 * a01 + b21 * a11 + b22 * a21,
            b20 * a02 + b21 * a12 + b22 * a22,
        ]
    },
    translation([tx, ty]) {
        return [1, 0, 0, 0, 1, 0, tx, ty, 1]
    },

    rotation(angleInRadians) {
        const c = Math.cos(angleInRadians)
        const s = Math.sin(angleInRadians)
        return [c, s, 0, -s, c, 0, 0, 0, 1]
    },

    scaling([sx, sy]) {
        return [sx, 0, 0, 0, sy, 0, 0, 0, 1]
    },

    rotationScale(radians, width, height) {
        const W =
            width * Math.abs(Math.cos(radians)) +
            height * Math.abs(Math.sin(radians))
        const H =
            width * Math.abs(Math.sin(radians)) +
            height * Math.abs(Math.cos(radians))
        return Math.min(width / W, height / H)
    },
}

const VERTEX_DATA = new Float32Array([
    -1.0,
    -1.0,
    0.0,
    0.0, // center
    1.0,
    -1.0,
    1.0,
    0.0, // right, center
    -1.0,
    1.0,
    0.0,
    1.0, // center, top

    // 2nd triangle
    -1.0,
    1.0,
    0.0,
    1.0, // center, top
    1.0,
    -1.0,
    1.0,
    0.0, // right, center
    1.0,
    1.0,
    1.0,
    1.0, // right, top
])

export class PixelSortingModel extends RenderModel {
    async loadAsset() {
        const source = await this.addTexture('texture-input', IMAGE_URL)
        var size = { width: source.width, height: source.height }
        await this.addTexture('temp', IMAGE_URL)
        await this.addStorage('mask', 'r32sint', size)
        await this.addStorage('sortvalues', 'r32float', size)
        await this.addStorage('spanlenghts', 'r32uint', size)
        await this.addShaderModule('sorting', '../shaders/sorting.wgsl')
        await this.addShaderModule('rotation', '../shaders/rotation.wgsl')
    }

    createResources() {
        this.uniformBuffer = this.uniformBufferBuilder
            .add({ name: 'resolution', type: 'vec2' })
            .add({ name: 'LowThreshold', type: 'f32' })
            .add({ name: 'HighThreshold', type: 'f32' })
            .add({ name: 'InvertMask', type: 'f32' })
            .add({ name: 'SpanLimit', type: 'f32' })
            .add({ name: 'MaskRandomOffset', type: 'f32' })
            .add({ name: 'SortBy', type: 'f32' })
            .add({ name: 'ReverseSorting', type: 'f32' })
            .add({ name: 'SortedGamma', type: 'f32' })
            .build()

        this.rotationUniformBuffer = this.uniformBufferBuilder
            .add({ name: 'matrix', type: 'mat3' })
            // .add({ name: 'resolution', type: 'vec2f' })
            // .add({ name: 'angle', type: 'f32' })
            .build()

        this.vertexBuffer = this.vertexBufferBuilder
            .bindBufferData(VERTEX_DATA)
            .addAttribute({ location: 0, type: 'vec2f' })
            .addAttribute({ location: 1, type: 'vec2f' })
            .build()

        this.vertexBuffer.apply() // TODO find a smoother way

        // --------------------------- BIND GROUP
        const bindGroupLayout = this.device.createBindGroupLayout({
            label: 'sortingbindgroup',
            entries: [
                {
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
                    texture: {
                        sampleType: 'unfilterable-float',
                        viewDimension: '2d',
                        multisampled: false,
                    },
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: {
                        access: 'write-only',
                        format: 'rgba8unorm',
                        viewDimension: '2d',
                    },
                },
                //Storage
                {
                    binding: 3,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: {
                        access: 'read-write',
                        format: 'r32sint',
                        viewDimension: '2d',
                    },
                },
                {
                    binding: 4,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: {
                        access: 'read-write',
                        format: 'r32float',
                        viewDimension: '2d',
                    },
                },
                {
                    binding: 5,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: {
                        access: 'read-write',
                        format: 'r32uint',
                        viewDimension: '2d',
                    },
                },
            ],
        })

        const rotationGroupLayout = this.device.createBindGroupLayout({
            label: 'rotationBindGroup',
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
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

        this.rotationlayout = rotationGroupLayout

        this.layout = bindGroupLayout

        const rotationPipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [rotationGroupLayout],
        })

        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout],
        })

        this.RotationPipeline = this.device.createRenderPipeline({
            label: 'rotationPipeline',
            layout: rotationPipelineLayout,
            vertex: {
                module: this.shaderModules['rotation'],
                buffers: [
                    {
                        arrayStride: this.vertexBuffer.getStride(),
                        attributes: this.vertexBuffer.getAttributes(),
                    },
                ],
            },
            fragment: {
                module: this.shaderModules['rotation'],
                targets: [{ format: 'rgba8unorm' }],
            },
        })

        this.createMaskPipeline = this.device.createComputePipeline({
            label: 'createMaskPipeline',
            layout: pipelineLayout,
            compute: {
                module: this.shaderModules['sorting'],
                entryPoint: 'CS_CreateMask',
            },
        })

        this.identifyspanPipeline = this.device.createComputePipeline({
            label: 'identifyspanPipeline',
            layout: pipelineLayout,
            compute: {
                module: this.shaderModules['sorting'],
                entryPoint: 'CS_IdentifySpans',
            },
        })

        this.pixelsortPipeline = this.device.createComputePipeline({
            label: 'pixelsortPipeline',
            layout: pipelineLayout,
            compute: {
                module: this.shaderModules['sorting'],
                entryPoint: 'CS_PixelSort',
            },
        })

        this.visualizePipeline = this.device.createComputePipeline({
            label: 'pixelsortPipeline',
            layout: pipelineLayout,
            compute: {
                module: this.shaderModules['sorting'],
                entryPoint: 'CS_VisualizeSpans',
            },
        })
    }

    updateUniforms(...args) {
        const canvasSize = this.renderCtx.getCanvasSize()
        this.uniformBuffer.set('resolution', canvasSize)
        this.uniformBuffer.set('LowThreshold', state.LowThreshold)
        this.uniformBuffer.set('HighThreshold', state.HighThreshold)
        this.uniformBuffer.set('InvertMask', state.InvertMask)
        this.uniformBuffer.set('SpanLimit', state.SpanLimit)
        this.uniformBuffer.set('MaskRandomOffset', state.MaskRandomOffset)
        this.uniformBuffer.set('SortBy', state.SortBy)
        this.uniformBuffer.set('ReverseSorting', state.ReverseSorting)
        this.uniformBuffer.set('SortedGamma', state.SortedGamma)
        this.uniformBuffer.set()
        this.device.queue.writeBuffer(
            this.uniformBuffer.getBufferObject(),
            0,
            this.uniformBuffer.getBuffer()
        )

        let radians = (Math.PI / 180) * state.angle
        var rotationMatrix = mat3.rotation(radians)
        //Goal is to rescale the rectangle once rotated to avoid cropping
        const scale_value = mat3.rotationScale(
            radians,
            canvasSize[0],
            canvasSize[1]
        )
        const scalingMatrix = mat3.scaling([scale_value, scale_value])
        const matrix = mat3.multiply(rotationMatrix, scalingMatrix)

        // matrix.forEach(myFunction)

        // function myFunction(item, index, arr) {
        //     arr[index] = item == item ? item : 0 ;
        // }
        console.log(matrix)

        // this.rotationUniformBuffer.set('resolution', canvasSize)
        // this.rotationUniformBuffer.set('angle', state.angle)
        // matrix.set([
        //     ...matrix.slice(0, 3), 0,
        //     ...matrix.slice(3, 6), 0,
        //     ...matrix.slice(6, 9), 0,
        //   ]);
        this.rotationUniformBuffer.set('matrix', matrix)

        this.device.queue.writeBuffer(
            this.rotationUniformBuffer.getBufferObject(),
            0,
            this.rotationUniformBuffer.getBuffer()
        )
    }

    addControls() {
        super.addControls()
        const controls = [
            {
                type: 'range',
                id: 'LowThreshold',
                label: 'LowThreshold',
                min: 0,
                max: 255,
                value: 100,
                step: 1,
                handler: (v) => (state.LowThreshold = v / 255.0),
            },
            {
                type: 'range',
                id: 'HighThreshold',
                label: 'HighThreshold',
                min: 0,
                max: 255,
                value: 180,
                step: 1,
                handler: (v) => (state.HighThreshold = v / 255.0),
            },
            {
                type: 'range',
                id: 'InvertMask',
                label: 'InvertMask',
                min: 0,
                max: 255,
                value: 255,
                step: 1,
                handler: (v) => (state.InvertMask = v / 255.0),
            },
            {
                type: 'range',
                id: 'SpanLimit',
                label: 'SpanLimit',
                min: 1,
                max: 2000,
                value: 500,
                step: 1,
                handler: (v) => (state.SpanLimit = v),
            },
            {
                type: 'range',
                name: 'MaskRandomOffset',
                label: 'MaskRandomOffset',
                min: 0,
                max: 255,
                value: 255,
                step: 1,
                handler: (v) => (state.MaskRandomOffset = v / 255.0),
            },
            {
                type: 'radio',
                name: 'SortBy',
                label: 'SortBy',
                options: [0, 1, 2],
                default: 0,
                handler: (v) => (state.SortBy = v),
            },
            {
                type: 'range',
                name: 'ReverseSorting',
                label: 'ReverseSorting',
                min: 0,
                max: 255,
                value: 255,
                step: 1,
                handler: (v) => (state.ReverseSorting = v / 255.0),
            },
            {
                type: 'range',
                name: 'SortedGamma',
                label: 'SortedGamma',
                min: 0,
                max: 255,
                value: 255,
                step: 1,
                handler: (v) => (state.SortedGamma = v / 255.0),
            },
            {
                type: 'range',
                name: 'angle',
                label: 'angle',
                min: 0,
                max: 360,
                step: 1,
                handler: (v) => (state.angle = v),
            },
        ]
        this.addControllers(controls)
    }

    async render() {
        const source = await loadImageBitmap('../assets/rose.jpg')
        // var source = createImageBitmap(IMAGE_URL, {colorSpaceConversion: 'none',})

        this.device.queue.copyExternalImageToTexture(
            { source: source },
            { texture: this.textures['texture-input'] },
            { width: source.width, height: source.height }
        )

        const canvas = document.getElementById('gfx')
        const context = canvas.getContext('webgpu')

        context.configure({
            device: this.device,
            format: 'rgba8unorm',
            usage: GPUTextureUsage.STORAGE_BINDING,
        })

        const outputTexture = context.getCurrentTexture()

        this.updateUniforms()
        var buffer = this.uniformBuffer

        const bindGroup = this.device.createBindGroup({
            label: 'sorting buffer',
            layout: this.layout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: buffer.getBufferObject() },
                },
                {
                    binding: 1,
                    resource: this.textures['temp'].createView(),
                },
                {
                    binding: 2,
                    resource: outputTexture.createView(),
                },
                {
                    binding: 3,
                    resource: this.textures['mask'].createView(),
                },
                {
                    binding: 4,
                    resource: this.textures['sortvalues'].createView(),
                },
                {
                    binding: 5,
                    resource: this.textures['spanlenghts'].createView(),
                },
            ],
        })

        const rotationBindgroup = this.device.createBindGroup({
            label: 'rotation buffer',
            layout: this.rotationlayout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.rotationUniformBuffer.getBufferObject(),
                    },
                },
                {
                    binding: 1,
                    resource: this.renderCtx.getSampler(),
                },
                {
                    binding: 2,
                    resource: this.textures['texture-input'].createView(),
                },
            ],
        })

        const encoder = this.device.createCommandEncoder({ label: 'sorting' })

        // const encoder = this.device.createCommandEncoder({ label: 'dithering' })
        // this.updateUniforms()

        var pass = encoder.beginRenderPass({
            label: 'rotation',
            colorAttachments: [
                {
                    view: this.textures['temp'].createView(),
                    clearValue: [0.0, 0.0, 0.0, 0.0],
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        })
        pass.setPipeline(this.RotationPipeline)
        pass.setBindGroup(0, rotationBindgroup)
        pass.setVertexBuffer(0, this.vertexBuffer.getBufferObject())
        pass.draw(6)
        pass.end()

        pass = encoder.beginComputePass()

        let width = this.textures['texture-input'].width
        let height = this.textures['texture-input'].height

        pass.setBindGroup(0, bindGroup)
        pass.setPipeline(this.createMaskPipeline)
        pass.dispatchWorkgroups(width / 8, height / 8)
        pass.setPipeline(this.identifyspanPipeline)
        pass.dispatchWorkgroups(width / 8, height / 8)
        // pass.setPipeline(this.visualizePipeline)
        // pass.dispatchWorkgroups(width, height);
        pass.setPipeline(this.pixelsortPipeline)
        pass.dispatchWorkgroups(width, height)
        pass.end()

        var commandBuffer = encoder.finish()
        this.device.queue.submit([commandBuffer])
        let promise = this.device.queue.onSubmittedWorkDone()
        setRenderDonePromise(promise)
    }
}
