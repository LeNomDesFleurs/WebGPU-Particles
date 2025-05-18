import { ComputeDCTModel } from './models/ComputeDCTModel.js';
import { DitheringModel } from './models/DitheringModel.js';
import { PixelSortingModel } from './models/PixelSortingModel.js';
import { getRendererContextInstance } from './RenderContext.js';
import { state } from './utils.js';

async function init() {
    const renderContext = await getRendererContextInstance();
	const modelDithering = new DitheringModel(renderContext.getDevice(), renderContext);
    const modelDCT = new ComputeDCTModel(renderContext.getDevice(), renderContext);
    
    // await modelDCT.init();
    // modelDCT.render();

    await modelDCT.init();
    modelDCT.render();

    
}

init()
