import { TYPE_SIZE } from "./utils.js"
import { rendererInstance } from "./Renderer.js";

// class WGPUBuffer {
//     // TODO
// }

class UniformBuffer /*extends WGPUBuffer*/ {
    constructor(buffer, subarraysMap) {
        if (!rendererInstance) throw new Error('no renderer instance found');

        this.bufferObject = rendererInstance.getDevice().createBuffer({
            size: buffer.byteLength ,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, // TODO add flag selection on builder
        })

        this.buffer = buffer;
        this.subarraysMap = subarraysMap;
    }

    get(k) { return this.subarraysMap.get(k); }
    set(k, v) { this.subarraysMap.set(k, v); }
    getBuffer() { return this.buffer; }
    getBufferObject() { return this.bufferObject; }
    update(k, v) { this.uniforms[k].value = v; }

    size() { return this.size(); }
}

export class UniformBufferBuilder {
    constructor() {
        this.size = 0;
        this.uniforms = new Map();
    }

    add(info) {
        const size = TYPE_SIZE[info.type];
        this.uniforms.set(info.name, { offset : this.size, size });
        this.size += size;
        return this;
    }

    build() {
        const uniformValues = new Float32Array(this.size / Float32Array.BYTES_PER_ELEMENT); // TODO for now (check other data types)
        const subarraysMap = new Map();
        for (let [k, v] of this.uniforms) {
            const subarray = uniformValues.subarray(v.offset, v.offset + v.size);
            subarraysMap.set(k, subarray);
        }
        return new UniformBuffer(uniformValues, subarraysMap);
    }
}