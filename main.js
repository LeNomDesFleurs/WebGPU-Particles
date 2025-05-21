import { ComputeDCTModel } from './models/ComputeDCTModel.js'
import { DitheringModel } from './models/DitheringModel.js'
import { PixelSortingModel } from './models/PixelSortingModel.js'
import { getRendererContextInstance } from './src/RenderContext.js'
import { state } from './src/utils.js'

async function init() {
    const renderContext = await getRendererContextInstance()
    const modelDithering = new DitheringModel(
        renderContext.getDevice(),
        renderContext
    )
    const modelDCT = new ComputeDCTModel(renderContext.getDevice(), renderContext)

    // await modelDCT.init();
    // modelDCT.render();

    await modelDithering.init()
    modelDithering.render()

    // const renderContext = await getRendererContextInstance();
    // const pixelSortingModel = new PixelSortingModel(renderContext.getDevice(), renderContext);

    // await modelDithering.init();
    // modelDithering.render();

    // await modelSorting.init();
    // modelSorting.render();

    document
        .getElementById('image_input')
        .addEventListener('change', async (event) => {
            const file = event.target.files[0]
            // create a temp. image object
            var test = await createImageBitmap(file, {
                colorSpaceConversion: 'none',
            })

            await modelDithering.update_image(test)
            modelDithering.render()
        })

    document.getElementById('download').addEventListener('click', function (e) {
        let canvas = document.getElementById('gfx')
        let canvasUrl = canvas.toDataURL('image/jpeg', 0.5)
        console.log(canvasUrl)
        const createEl = document.createElement('a')
        createEl.href = canvasUrl
        createEl.download = 'download-this-canvas'
        createEl.click()
        createEl.remove()
    })
}

init()
