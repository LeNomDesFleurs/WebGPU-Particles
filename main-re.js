import { DitheringModel } from './models/DitheringModel.js';
import { PixelSortingModel } from './models/PixelSortingModel.js';
import { getRendererContextInstance } from './RenderContext.js';
import { state } from './utils.js';

async function init() {
    const renderContext = await getRendererContextInstance();
	const modelDithering = new DitheringModel(renderContext.getDevice(), renderContext);
	const modelSorting = new PixelSortingModel(renderContext.getDevice(), renderContext);

    // await modelDithering.init();
    // modelDithering.render();

    await modelSorting.init();
    modelSorting.render();
    
}

init()
