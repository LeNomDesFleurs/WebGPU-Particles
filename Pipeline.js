import { rendererInstance } from "./Renderer.js";

export const ResourceType = {
    BUFFER : 0,
    SAMPLER: 1,
    TEXTURE: 2
};

// class BindGroup {

// }

class Entry {
    constructor(params) {
        this.params = params;
    }

    getLayoutInfo() {
        const base = {
            binding: this.params.binding,
            visibility: this.params.visibility
        }

        const dataInfo = (this.params.dataType == ResourceType.BUFFER) ? { buffer : this.params.dataInfo } 
            : (this.params.dataType == ResourceType.SAMPLER) ? { sampler : this.params.dataInfo } 
            : { texture: this.params.dataInfo }
        
        return { ...base, ...dataInfo };
    }

    getResourceInfo() {
        return {
            binding: this.params.binding,
            resource: (this.params.dataType === ResourceType.BUFFER) ? { buffer: this.params.data } : this.params.data
        }
    }
}

export class EntryBuilder {
    constructor() {
        this.reset();
    }

    reset() {
        this._binding = null;
        this._visibility = null;
        this._resourceType = null;
        this._resourceData = null;
        this._resourceDataInfo = null;
    }

    setBinding(b) {
        this._binding = b;
        return this;
    }
    setVisibility(v) {
        this._visibility = v; 
        return this; 
    }
    
    setResource(resourceType, data, dataInfo = {}) {
        if (this._resourceData) {
            throw new Error("resource data already set.");
        }
        this._resourceType = resourceType;
        this._resourceData = data;
        this._resourceDataInfo = dataInfo;
        return this;
    }
    
    build() {
        if (this._binding === null || this._visibility === null || this._resourceData === null) {
            throw new Error('you must set both binding and visibility');
        }
        const res = {
            binding: this._binding,
            visibility: this._visibility,
            data: this._resourceData,
            dataType: this._resourceType,
            dataInfo: this._resourceDataInfo
        }

        this.reset();
        return new Entry(res);
    }
}

export class Pipeline {
    constructor(name, entries, vertexModule, fragmentModule) {
        if (!rendererInstance) throw new Error('no renderer instance found');

        this.entries = entries;

        const device = rendererInstance.getDevice();
        console.log(this._getBindGroupLayoutInfo())
        this.bindgroupLayout = device.createBindGroupLayout({ entries: this._getBindGroupLayoutInfo() });
        this.bindgroup = device.createBindGroup({
            label: name + '-bindgroup',
            layout: this.bindgroupLayout,
            entries: this._getEntriesInfo()
        });
        this.pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [ this.bindgroupLayout ] // TODO extend later
        });
        this.pipeline = device.createRenderPipeline({
            label: name + '-pipeline',
            layout: this.pipelineLayout,
            vertex: { module: vertexModule },
            fragment: {
                module: fragmentModule,
                targets: [{ format: rendererInstance.getFormat() }]
            }
        })
    }

    _getBindGroupLayoutInfo() { return this.entries.map((e) => e.getLayoutInfo()); }
    _getEntriesInfo() { return this.entries.map((e) => e.getResourceInfo()); }
    
    getBindGroup() { return this.bindgroup; }
    getPipeline() { return this.pipeline; }
}

