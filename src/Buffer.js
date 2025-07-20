import {
    TYPE_SIZE,
    getUniformBufferSize,
    TYPE_ATTRIBUTE_FORMAT,
} from './utils.js'

class WGPUBuffer {
    constructor(device) {
        this.device = device
        this.bufferObject = null
        this.buffer = null
    }

    getBuffer() {
        return this.buffer
    }
    getBufferObject() {
        return this.bufferObject
    }

    apply(bufferOffset = 0) {
        try {
            if (this.bufferObject === null || this.buffer === null) {
                throw new Error("buffer object or buffer isn't defined.")
            }
            this.device.queue.writeBuffer(
                this.bufferObject,
                bufferOffset,
                this.buffer
            )
        } catch (e) {
            console.log(e)
        }
    }
}

class UniformBuffer extends WGPUBuffer {
    constructor(device, buffer, subarraysMap) {
        super(device)
        this.bufferObject = this.device.createBuffer({
            size: getUniformBufferSize(buffer.byteLength),
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, // TODO add flag selection on builder
        })
        this.buffer = buffer
        this.subarraysMap = subarraysMap
    }

    get(k) {
        return this.subarraysMap.get(k)
    }
    set(k, v) {
        try {
            const subarray = this.subarraysMap.get(k)
            if (!subarray) throw new Error(`Uniform ${k} not found.`)
            if (subarray.length == 1) {
                subarray[0] = v
                return this
            }
            for (let i = 0; i < v.length; i++) {
                subarray[i] = v[i]
            }
            return this
        } catch (e) {
            console.log(e)
        }
    }

    // TO DO simplify with the set func above, checking for type ?
    matrixSet(k, v) {
        try {
            const subarray = this.subarraysMap.get(k)
            if (!subarray) throw new Error(`Uniform ${k} not found.`)
            if (subarray.length == 1) {
                subarray[0] = v
                return this
            }
            let alignementOffset = 0;
            for (let i = 0; i < v.length; i++) {
                if (i == 3 || i == 6 || i == 9 ) { alignementOffset++}
                subarray[i+alignementOffset] = v[i]
            }
            return this
        } catch (e) {
            console.log(e)
        }
    }

    update(k, v) {
        this.uniforms[k].value = v
    }

    size() {
        return this.size()
    }
}

class VertexBuffer extends WGPUBuffer {
    constructor(device, buffer, attributesInfo) {
        super(device)
        this.attributes = []
        let offset = 0
        for (let [k, v] of attributesInfo) {
            this.attributes.push({
                shaderLocation: k,
                offset,
                format: TYPE_ATTRIBUTE_FORMAT[v],
            })
            offset += TYPE_SIZE[v]
        }
        this.stride = offset

        this.bufferObject = this.device.createBuffer({
            label: 'vb',
            size: buffer.byteLength, // TODO deal with other type of arrays + empty / undefined buffer
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        })
        this.buffer = buffer
    }

    getStride() {
        return this.stride
    }
    getAttributes() {
        return this.attributes
    }
}

export class VertexBufferBuilder {
    constructor(device) {
        this.attributes = new Map()
        this.device = device
    }

    reset() {
        this.attributes.clear()
    }

    bindBufferData(data) {
        this.buffer = data
        return this
    }

    addAttribute(info) {
        this.attributes.set(info.location, info.type)
        return this
    }

    build() {
        const attributesSorted = new Map([...this.attributes.entries()].sort())
        this.reset()
        return new VertexBuffer(this.device, this.buffer, attributesSorted)
    }
}

export class UniformBufferBuilder {
    constructor(device) {
        this.size = 0
        this.uniforms = new Map()
        this.device = device
    }

    reset() {
        this.size = 0
        this.uniforms.clear()
    }

    add(info) {
        const size = TYPE_SIZE[info.type]
        this.uniforms.set(info.name, { offset: this.size / 4, size: size / 4 }) // todo
        this.size += size
        return this
    }

    build() {
        const uniformValues = new Float32Array(
            this.size / Float32Array.BYTES_PER_ELEMENT
        ) // TODO for now (check other data types)
        const subarraysMap = new Map()
        for (let [k, v] of this.uniforms) {
            const subarray = uniformValues.subarray(v.offset, v.offset + v.size)
            subarraysMap.set(k, subarray)
        }
        this.reset()
        return new UniformBuffer(this.device, uniformValues, subarraysMap)
    }
}
