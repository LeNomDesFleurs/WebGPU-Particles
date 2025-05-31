import { CANVAS_ID } from "./utils.js"

export let renderContextInstance = null;
export async function getRendererContextInstance() {
    if (renderContextInstance) return renderContextInstance;

    if (!navigator.gpu) throw new Error('WebGPU not supported.');
    
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter?.requestDevice();
    if (!device) throw new Error('No GPU device available.');

    const canvas = document.getElementById(CANVAS_ID);
    const context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format });

    renderContextInstance = new RenderContext(device, canvas, context, format);
    return renderContextInstance;
}

class RenderContext {
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
    getCanvas() { return this._canvas; }

    setCanvasSize(newWidth, newHeight) {
        const ratio = newHeight / newWidth; 
        this._canvas.height = 1000 * ratio; // on va changer ca aussi 1000
    }
}
