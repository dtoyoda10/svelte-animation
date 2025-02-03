import { SVGRenderState } from "../types"
export function updateSVGDimensions(
    instance: SVGElement,
    renderState: SVGRenderState
) {
    try {
        renderState.dimensions =
            typeof (instance as SVGGraphicsElement).getBBox === "function"
                ? (instance as SVGGraphicsElement).getBBox()
                : (instance.getBoundingClientRect() as DOMRect)
    } catch (e) {
        // Most likely trying to measure an unrendered element under Firefox
        renderState.dimensions = {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
        }
    }
}
