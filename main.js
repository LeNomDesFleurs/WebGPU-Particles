import { ComputeDCTModel } from './models/ComputeDCTModel.js'
import { DitheringModel } from './models/DitheringModel.js'
import { PixelSortingModel } from './models/PixelSortingModel.js'
import { getRendererContextInstance } from './src/RenderContext.js'
import { state } from './src/utils.js'

const MODELS = [ComputeDCTModel, DitheringModel, PixelSortingModel];
let CURRENT_MODEL;

async function init(renderContext) {
    CURRENT_MODEL = new DitheringModel(
        renderContext.getDevice(),
        renderContext
    )
    await CURRENT_MODEL.init()
    CURRENT_MODEL.render()
}

document.addEventListener('DOMContentLoaded', async () => {
    const renderContext = await getRendererContextInstance()
    
    init(renderContext)

    const modelsContainer = document.getElementById('models-container');
    MODELS.forEach((model) => {
        const button = document.createElement('button')
        button.textContent = model.name;
        button.style.backgroundColor = 'blue';
        button.style.width = '5rem'
        button.addEventListener('click', async () => {
            // if (CURRENT_MODEL.name == model.name) { plus tard -> disable if already clicked
            //     button.style.backgroundColor = 'green';
            //     button.disabled = true;
            // }
            CURRENT_MODEL.destroy();

            CURRENT_MODEL = new model(renderContext.getDevice(), renderContext);
            await CURRENT_MODEL.init();
            CURRENT_MODEL.render();
        })
        modelsContainer.appendChild(button);
    });

    document.getElementById('download').addEventListener('click', function (e) {
        let canvas = document.getElementById('gfx')
        let canvasUrl = canvas.toDataURL('image/jpeg', 0.5)
        const createEl = document.createElement('a')
        createEl.href = canvasUrl
        createEl.download = 'download-this-canvas'
        createEl.click()
        createEl.remove()
    })

});


