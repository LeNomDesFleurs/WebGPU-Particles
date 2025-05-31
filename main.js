import { ComputeDCTModel } from './models/ComputeDCTModel.js'
import { DitheringModel } from './models/DitheringModel.js'
import { PixelSortingModel } from './models/PixelSortingModel.js'
import { getRendererContextInstance } from './src/RenderContext.js'
import { state } from './src/utils.js'

const MODELS = [ComputeDCTModel, DitheringModel, PixelSortingModel];
let CURRENT_MODEL;
let renderContext;

async function initDefaultModel(renderContext) {
    CURRENT_MODEL = new DitheringModel(
        renderContext.getDevice(),
        renderContext
    )
    await CURRENT_MODEL.init()
    CURRENT_MODEL.render()
}

let zoomCanvas = null;
let ZOOM_CANVAS_WIDTH = 250;
let ZOOM_CANVAS_HEIGHT = 250;

function moveZoomCanvas(e) {
    if (!zoomCanvas) return;
    zoomCanvas.style.left = (e.pageX - ZOOM_CANVAS_WIDTH / 2) + 'px';
    zoomCanvas.style.top = (e.pageY - ZOOM_CANVAS_HEIGHT / 2) + 'px';

    const canvasSize = renderContext.getCanvasSize();
    CURRENT_MODEL.renderZoom(e.pageX, e.pageY, canvasSize[0], canvasSize[1]);
}

function removeZoomCanvas(e) {
    if (!zoomCanvas) return;
    zoomCanvas.remove();
    zoomCanvas = null;
    renderContext.clearZoom();

    window.removeEventListener('mousemove', moveZoomCanvas);
    window.removeEventListener('mouseup', removeZoomCanvas);
}

document.addEventListener('DOMContentLoaded', async () => {
    renderContext = await getRendererContextInstance()
    initDefaultModel(renderContext)

    const canvas = renderContext.getCanvas();
    canvas.addEventListener('mousedown', async (e) => {
        if (e.button == 2) {
            console.log(e)
            zoomCanvas = document.createElement('canvas');
            zoomCanvas.style.width = ZOOM_CANVAS_WIDTH + 'px'; //TODO something other than px
            zoomCanvas.style.height = ZOOM_CANVAS_HEIGHT + 'px';
            zoomCanvas.style.position = 'absolute';
            zoomCanvas.style.left = (e.pageX - ZOOM_CANVAS_WIDTH / 2) + 'px';
            zoomCanvas.style.top = (e.pageY - ZOOM_CANVAS_HEIGHT / 2) + 'px';
            zoomCanvas.style.zIndex = 9999;
            zoomCanvas.style.background = 'red'
            zoomCanvas.style.borderRadius = '50%'
            zoomCanvas.oncontextmenu = (e) => e.preventDefault();

            document.body.appendChild(zoomCanvas);

            renderContext.setZoom(zoomCanvas);
            await CURRENT_MODEL.initZoom()
            const rect = renderContext.getCanvas().getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const canvasSize = renderContext.getCanvasSize();
            console.log(mouseX, mouseY, canvasSize)
            CURRENT_MODEL.renderZoom(mouseX, mouseY, canvasSize[0], canvasSize[1]);

            window.addEventListener('mousemove', moveZoomCanvas);
            window.addEventListener('mouseup', removeZoomCanvas);
        }
    })

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


