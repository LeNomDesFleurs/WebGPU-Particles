import { DitheringModel } from './DitheringModel.js';
import { getRendererContextInstance } from './RenderContext.js';
import { state } from './utils.js';

async function init() {
    const renderContext = await getRendererContextInstance();
	const modelDithering = new DitheringModel(renderContext.getDevice(), renderContext);

    await modelDithering.init();
    modelDithering.render();

	const rot = document.getElementById('control-p');
	rot.addEventListener('input', () => {
        state.p = parseFloat(rot.value) / 255.0;
        modelDithering.render();
	});
}

init()
