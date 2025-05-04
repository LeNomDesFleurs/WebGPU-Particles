import { getRendererInstance } from "./Renderer.js"
import { mat4 } from './lib/esm/index.js';
import { UniformBufferBuilder } from "./Buffer.js"
import { EntryBuilder, ResourceType, Pipeline } from "./Pipeline.js";

let IMAGE_URL = 'rose.jpg'
let DITHERING_SHADER_PATH = "./shaders/dithering-mat4.wgsl"

const state = {
    p : 0.0
}

const transformCanvas = (p, canvasWidth, canvasHeight) => {
    let angle = p*180.
    let radians = angle * (Math.PI / 180.);

    const W = canvasWidth * Math.abs(Math.cos(radians)) + canvasHeight * Math.abs(Math.sin(radians));
    const H = canvasWidth * Math.abs(Math.sin(radians)) + canvasHeight * Math.abs(Math.cos(radians));
    const a = Math.min(canvasWidth / W, canvasHeight / H);


    const rotationMatrix = mat4.create();
    mat4.rotate(rotationMatrix, rotationMatrix, radians, [0, 0, 1]);

    const scaleMatrix = mat4.create();
    mat4.scale(scaleMatrix, scaleMatrix, [a, a, 1]);
    
    const transformMatrix = mat4.multiply(mat4.create(), rotationMatrix, scaleMatrix);

    return transformMatrix;
}

async function init() {
	const renderer = await getRendererInstance();
	if (!renderer) return;

	const modelDithering = renderer.createModel();

	const texture = await modelDithering.addTexture('main-rose', IMAGE_URL);
	const shaderModule = await modelDithering.addShaderModule('dithering', DITHERING_SHADER_PATH);
    
    const bufferBuilder = new UniformBufferBuilder();
    const uniformBuffer = bufferBuilder.add({ name: 'resolution', type: 'vec2' })
                                       .add({ name: 'transform-matrix', type: 'mat4'})
                                       .build();

    const entryBuilder = new EntryBuilder();
    const uniformEntry = entryBuilder.setBinding(0)
                                     .setVisibility(GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT)
                                     .setResource(ResourceType.BUFFER, uniformBuffer.getBufferObject(), {
                                        type: 'uniform', 
                                        hasDynamicOffset: false,
                                     })
                                     .build();    
    const samplerEntry = entryBuilder.setBinding(1)
                                     .setVisibility(GPUShaderStage.FRAGMENT)
                                     .setResource(ResourceType.SAMPLER, renderer.getSampler(), {type: 'non-filtering'})
                                     .build();
    const textureEntry = entryBuilder.setBinding(2)
                                     .setVisibility(GPUShaderStage.FRAGMENT)
                                     .setResource(ResourceType.TEXTURE, texture.createView(), {
                                        sampleType: 'unfilterable-float',
                                        viewDimension: '2d',
                                        multisampled: false,
                                     }).build();

    const pipeline = new Pipeline('dithering', [uniformEntry, samplerEntry, textureEntry], shaderModule, shaderModule);
    modelDithering.bindPipeline(pipeline);

    const commandQueue = modelDithering.createCommandQueue();
    commandQueue.addCommand({
        execute : () => {
            const canvasSize = renderer.getCanvasSize();
            uniformBuffer.set('resolution', canvasSize);
            uniformBuffer.set('transform-matrix', transformCanvas(state.p, canvasSize[0], canvasSize[1]));
            renderer.getDevice().queue.writeBuffer(uniformBuffer.getBufferObject(), 0, uniformBuffer.getBuffer());    
        } 
    }).addCommand({
        execute: () => modelDithering.render()
    });

    modelDithering.setRenderPassEncoder({
        colorAttachments: [
            {
                view: renderer.getView(),
                clearValue: [1.0, 1.0, 1.0, 1],
                loadOp: 'clear',
                storeOp: 'store',
            },
        ],
    })
    modelDithering.setVerticesNum(6);
    commandQueue.run();

	// const rot = document.getElementById('control-p');
	// rot.addEventListener('input', () => {
	// 	draw(parseFloat(rot.value) / 255.0);
	// })

    // draw()
}

init()
