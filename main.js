import { DCT } from './models/ComputeDCTModel.js'
import { Dithering } from './models/DitheringModel.js'
import { Sorting } from './models/PixelSortingModel.js'
import { Morpho } from './models/MorphoModel.js'
import { getRendererContextInstance } from './src/RenderContext.js'
import { state, getRenderDonePromise, SetBitMap, IMAGE_URL } from './src/utils.js'

const MODELS = [DCT, Dithering, Sorting, Morpho];
let CURRENT_MODEL;
let renderContext;


async function initDefaultModel(renderContext) {
    await SetBitMap(IMAGE_URL);
    CURRENT_MODEL = new Sorting(
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
        button.style.backgroundColor = 'rgb(255, 255, 255)';
        button.style.opacity = 0.7;
        button.style.margin = '0.1em';
        button.style.width = '5rem';
        button.style.border = '0em';
        button.style.borderRadius = '1em'
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

});


