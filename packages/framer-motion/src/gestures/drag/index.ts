import { Feature } from "../../motion/features/Feature"
import type { VisualElement } from "../../render/VisualElement"
import { VisualElementDragControls } from "./VisualElementDragControls"

export class DragGesture extends Feature<HTMLElement> {
    controls: VisualElementDragControls

    removeGroupControls?: Function
    removeListeners?: Function

    constructor(node: VisualElement<HTMLElement>) {
        super(node)
        this.controls = new VisualElementDragControls(node)
    }

    mount() {
        // If we've been provided a DragControls for manual control over the drag gesture,
        // subscribe this component to it on mount.
        const { dragControls } = this.node.getProps()
        this.removeGroupControls = dragControls?.subscribe(this.controls)
        this.removeListeners = this.controls.addListeners()
    }

    unmount() {
        this.removeGroupControls?.()
        this.removeListeners?.()
    }
}
