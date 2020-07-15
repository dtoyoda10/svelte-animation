import { VisualElement } from "../VisualElement"
import { AxisBox2D, Point2D, BoxDelta } from "../../types/geometry"
import { delta, copyAxisBox, axisBox } from "../../utils/geometry"
import { ResolvedValues } from "../types"
import { buildHTMLStyles } from "./utils/build-html-styles"
import { DOMVisualElementConfig, TransformOrigin } from "./types"
import { isTransformProp } from "./utils/transform"
import { getDefaultValueType } from "./utils/value-types"
import {
    Presence,
    SharedLayoutAnimationConfig,
} from "../../components/AnimateSharedLayout/types"
import {
    resetBox,
    applyTreeDeltas,
    applyBoxTransforms,
    removeBoxTransforms,
} from "../../utils/geometry/delta-apply"
import { updateBoxDelta } from "../../utils/geometry/delta-calc"
import { Transition } from "../../types"
import { eachAxis } from "../../utils/each-axis"
import { motionValue, MotionValue } from "../../value"
import { startAnimation } from "../../animation/utils/transitions"
import { getBoundingBox } from "./layout/measure"

export type LayoutUpdateHandler = (
    layout: AxisBox2D,
    prev: AxisBox2D,
    config?: SharedLayoutAnimationConfig
) => void

/**
 * A VisualElement for HTMLElements
 */
export class HTMLVisualElement<
    E extends HTMLElement | SVGElement = HTMLElement
> extends VisualElement<E> {
    /**
     *
     */
    protected defaultConfig: DOMVisualElementConfig = {
        enableHardwareAcceleration: true,
        allowTransformNone: true,
    }

    /**
     * A mutable record of styles we want to apply directly to the rendered Element
     * every frame. We use a mutable data structure to reduce GC during animations.
     */
    style: ResolvedValues = {}

    /**
     * A record of styles we only want to apply via React. This gets set in useMotionValues
     * and applied in the render function. I'd prefer this to live somewhere else to decouple
     * VisualElement from React but works for now.
     */
    reactStyle: ResolvedValues = {}

    /**
     * A mutable record of CSS variables we want to apply directly to the rendered Element
     * every frame. We use a mutable data structure to reduce GC during animations.
     */
    vars: ResolvedValues = {}

    /**
     * Presence data. This is hydrated by useDomVisualElement and used by AnimateSharedLayout
     * to decide how to animate entering/exiting layoutId
     */
    presence?: Presence
    isPresent?: boolean

    /**
     * A mutable record of transforms we want to apply directly to the rendered Element
     * every frame. We use a mutable data structure to reduce GC during animations.
     */
    protected transform: ResolvedValues = {}

    /**
     * A mutable record of transform origins we want to apply directly to the rendered Element
     * every frame. We use a mutable data structure to reduce GC during animations.
     */
    protected transformOrigin: TransformOrigin = {}

    /**
     * A mutable record of transform keys we want to apply to the rendered Element. We order
     * this to order transforms in the desired order. We use a mutable data structure to reduce GC during animations.
     */
    protected transformKeys: string[] = []

    config = this.defaultConfig

    /**
     * When a value is removed, we want to make sure it's removed from all rendered data structures.
     */
    removeValue(key: string) {
        super.removeValue(key)
        delete this.vars[key]
        delete this.style[key]
    }

    /**
     * Empty the mutable data structures by re-creating them. We can do this every React render
     * as the comparative workload to the rest of the render is very low and this is also when
     * we want to reflect values that might have been removed by the render.
     */
    clean() {
        this.style = {}
        this.vars = {}
        this.transform = {}
    }

    updateConfig(config: DOMVisualElementConfig = {}) {
        this.config = { ...this.defaultConfig, ...config }
    }

    /**
     * Read a value directly from the HTMLElement style.
     */
    read(key: string): number | string | null {
        return this.getComputedStyle()[key] || 0
    }

    /**
     * Read a value directly from the HTMLElement in case it's not defined by a Motion
     * prop. If it's a transform, we just return a pre-defined default value as reading these
     * out of a matrix is either error-prone or can incur a big payload for little benefit.
     */
    readNativeValue(key: string) {
        if (isTransformProp(key)) {
            const defaultValueType = getDefaultValueType(key)
            return defaultValueType ? defaultValueType.default || 0 : 0
        } else {
            return this.read(key)
        }
    }

    /**
     * ========================================
     * Layout
     * ========================================
     */
    isLayoutProjectionEnabled = false

    /**
     * A boolean that flags whether this component has children that need to be update
     * when this component changes layout.
     */
    hasLayoutChildren = false

    enableLayoutProjection() {
        this.isLayoutProjectionEnabled = true
        forEachParent(
            this as HTMLVisualElement,
            parent => (parent.hasLayoutChildren = true)
        )
    }

    /**
     * A set of layout update event handlers. These are only called once all layouts have been read,
     * making it safe to perform DOM write operations.
     */
    private layoutUpdateListeners: Set<LayoutUpdateHandler> = new Set()

    /**
     * Keep track of whether the viewport box has been updated since the last render.
     * If it has, we want to fire the onViewportBoxUpdate listener.
     */
    private hasViewportBoxUpdated = false

    /**
     * Optional id. If set, and this is the child of an AnimateSharedLayout component,
     * the targetBox can be transerred to a new component with the same ID.
     */
    layoutId?: string

    /**
     * The measured bounding box as it exists on the page with no transforms applied.
     *
     * To calculate the visual output of a component in any given frame, we:
     *
     *   1. box -> boxCorrected
     *      Apply the delta between the tree transform when the box was measured and
     *      the tree transform in this frame to the box
     *   2. targetBox -> targetBoxFinal
     *      Apply the VisualElement's `transform` properties to the targetBox
     *   3. Calculate the delta between boxCorrected and targetBoxFinal and apply
     *      it as a transform style.
     */
    box: AxisBox2D

    /**
     * The `box` layout with transforms applied from up the
     * tree. We use this as the final bounding box from which we calculate a transform
     * delta to our desired visual position on any given frame.
     *
     * This is considered mutable to avoid object creation on each frame.
     */
    private boxCorrected: AxisBox2D

    /**
     * The visual target we want to project our component into on a given frame
     * before applying transforms defined in `animate` or `style`.
     *
     * This is considered mutable to avoid object creation on each frame.
     */
    targetBox: AxisBox2D

    /**
     * The visual target we want to project our component into on a given frame
     * before applying transforms defined in `animate` or `style`.
     *
     * This is considered mutable to avoid object creation on each frame.
     */
    private targetBoxFinal: AxisBox2D = axisBox()

    /**
     * Can be used to store a snapshot of the measured viewport bounding box before
     * a re-render.
     */
    prevViewportBox?: AxisBox2D

    /**
     * The overall scale of the local coordinate system as transformed by all parents
     * of this component. We use this for scale correction on our calculated layouts
     * and scale-affected values like `boxShadow`.
     *
     * This is considered mutable to avoid object creation on each frame.
     */
    treeScale: Point2D = { x: 1, y: 1 }

    /**
     * The delta between the boxCorrected and the desired
     * targetBox (before user-set transforms are applied). The calculated output will be
     * handed to the renderer and used as part of the style correction calculations, for
     * instance calculating how to display the desired border-radius correctly.
     *
     * This is considered mutable to avoid object creation on each frame.
     */
    delta: BoxDelta = delta()

    /**
     * The delta between the boxCorrected and the desired targetBoxFinal. The calculated
     * output will be handed to the renderer and used to project the boxCorrected into
     * the targetBoxFinal.
     *
     * This is considered mutable to avoid object creation on each frame.
     */
    deltaFinal: BoxDelta = delta()

    /**
     *
     */
    stopLayoutAxisAnimation = {
        x: () => {},
        y: () => {},
    }

    isVisible?: boolean

    hide() {
        if (this.isVisible === false) return
        this.isVisible = false
        this.scheduleRender()
    }

    show() {
        if (this.isVisible === true) return
        this.isVisible = true
        this.scheduleRender()
    }

    /**
     * Register an event listener to fire when the layout is updated. We might want to expose support
     * for this via a `motion` prop.
     */
    onLayoutUpdate(callback: LayoutUpdateHandler) {
        this.layoutUpdateListeners.add(callback)
        return () => this.layoutUpdateListeners.delete(callback)
    }

    /**
     * To be called when all layouts are successfully updated. In turn we can notify layoutUpdate
     * subscribers.
     */
    layoutReady(config?: SharedLayoutAnimationConfig) {
        this.layoutUpdateListeners.forEach(listener => {
            listener(this.box, this.prevViewportBox || this.box, config)
        })
    }

    /**
     * Measure and return the Element's bounding box. We convert it to a AxisBox2D
     * structure to make it easier to work on each individual axis generically.
     */
    getBoundingBox(): AxisBox2D {
        const { transformPagePoint } = this.config
        return getBoundingBox(this.element, transformPagePoint)
    }

    getBoundingBoxWithoutTransforms() {
        const bbox = this.getBoundingBox()
        removeBoxTransforms(bbox, this.latest)
        return bbox
    }

    /**
     * Return the computed style after a render.
     */
    getComputedStyle() {
        return window.getComputedStyle(this.element)
    }

    /**
     *
     */
    snapshotBoundingBox() {
        this.prevViewportBox = this.getBoundingBoxWithoutTransforms()

        /**
         * Update targetBox to match the prevViewportBox. This is just to ensure
         * that targetBox is affected by scroll in the same way as the measured box
         */
        const { x, y } = this.axisProgress
        if (!x.isAnimating() && !y.isAnimating()) {
            this.targetBox = copyAxisBox(this.prevViewportBox)
        }
    }

    /**
     * The viewport scroll at the time of the previous layout measurement.
     */
    viewportScroll: Point2D

    measureLayout() {
        this.box = this.getBoundingBox()
        this.boxCorrected = copyAxisBox(this.box)

        if (!this.targetBox) this.targetBox = copyAxisBox(this.box)
    }

    /**
     * Ensure the targetBox reflects the latest visual box on screen
     */
    refreshTargetBox() {
        this.targetBox = this.getBoundingBoxWithoutTransforms()
    }

    isTargetBoxLocked = false

    lockTargetBox() {
        this.isTargetBoxLocked = true
    }

    unlockTargetBox() {
        this.stopLayoutAnimation()
        this.isTargetBoxLocked = false
    }

    /**
     * Reset the transform on the current Element. This is called as part
     * of a batched process across the entire layout tree. To remove this write
     * cycle it'd be interesting to see if it's possible to "undo" all the current
     * layout transforms up the tree in the same way this.getBoundingBoxWithoutTransforms
     * works
     */
    resetTransform() {
        this.element.style.transform = "none"

        // Ensure that whatever happens next, we restore our transform
        this.scheduleRender()
    }

    /**
     * Set new min/max boundaries to project an axis into
     */
    setAxisTarget(axis: "x" | "y", min: number, max: number) {
        const targetAxis = this.targetBox[axis]
        targetAxis.min = min
        targetAxis.max = max

        // Flag that we want to fire the onViewportBoxUpdate event handler
        this.hasViewportBoxUpdated = true

        /**
         * If this component re-renders we need to ensure that any children performing
         * layout projection also update
         *
         * TODO: This recursively traverses all children for each axis and for each component. A performance
         * improvement would be to:
         *  1. Flag the root component as dirty and schedule it to update pre-render
         *  2. Recursively traverse tree from root layout component during this update
         *      scheduling renders and updating deltas
         */
        scheduleChildrenLayoutRender(this as HTMLVisualElement)
    }

    /**
     *
     */
    axisProgress: MotionPoint = {
        x: motionValue(0),
        y: motionValue(0),
    }

    /**
     *
     */
    startLayoutAxisAnimation(axis: "x" | "y", transition: Transition) {
        const progress = this.axisProgress[axis]

        const { min, max } = this.targetBox[axis]
        const length = max - min

        progress.clearListeners()
        progress.set(min)
        progress.set(min) // Set twice to hard-reset velocity
        progress.onChange(v => this.setAxisTarget(axis, v, v + length))

        return startAnimation(axis, progress, 0, transition)
    }

    stopLayoutAnimation() {
        eachAxis(axis => this.axisProgress[axis].stop())
    }

    /**
     * Update the layout deltas to reflect the relative positions of the layout
     * and the desired target box
     */
    updateLayoutDeltas(isReactRender: boolean) {
        /**
         * Ensure that all the parent deltas are up-to-date before calculating this delta.
         *
         * TODO: This approach is exceptionally wasteful as every child will update
         * the deltas of its parent even if it's already updated for this frame.
         * We can optimise this by replacing this to a call directly to the root VisualElement
         * which then runs iteration from the top-down, but only once per framestamp.
         */
        this.treePath.forEach((p: HTMLVisualElement) =>
            p.updateLayoutDeltas(isReactRender)
        )

        /**
         * Early return if layout reprojection isn't enabled
         */
        if (!this.isLayoutProjectionEnabled || !this.box) return

        /**
         * Reset the corrected box with the latest values from box, as we're then going
         * to perform mutative operations on it.
         */
        resetBox(this.boxCorrected, this.box)

        /**
         * Apply all the parent deltas to this box to produce the corrected box. This
         * is the layout box, as it will appear on screen as a result of the transforms of its parents.
         */
        applyTreeDeltas(this.boxCorrected, this.treeScale, this.treePath as any)

        /**
         * Apply the latest user-set transforms to the targetBox to produce the targetBoxFinal.
         * This is the final box that we will then project into by calculating a transform delta and
         * applying it to the corrected box.
         */
        applyBoxTransforms(this.targetBoxFinal, this.targetBox, this.latest)

        /**
         * Update the delta between the corrected box and the target box before user-set transforms were applied.
         * This will allow us to calculate the corrected borderRadius and boxShadow to compensate
         * for our layout reprojection, but still allow them to be scaled correctly by the user.
         * It might be that to simplify this we may want to accept that user-set scale is also corrected
         * and we wouldn't have to keep and calc both deltas, OR we could support a user setting
         * to allow people to choose whether these styles are corrected based on just the
         * layout reprojection or the final bounding box.
         */
        updateBoxDelta(this.delta, this.boxCorrected, this.targetBox)

        /**
         * Update the delta between the corrected box and the final target box, after
         * user-set transforms are applied to it. This will be used by the renderer to
         * create a transform style that will reproject the element from its actual layout
         * into the desired bounding box.
         */
        updateBoxDelta(this.deltaFinal, this.boxCorrected, this.targetBoxFinal)

        /**
         * If we have a listener for the viewport box, fire it.
         * TODO: Instead of manually checking this, use framesync postRender
         */
        if (!isReactRender) {
            this.hasViewportBoxUpdated &&
                this.config.onViewportBoxUpdate?.(this.targetBox, this.delta)
            this.hasViewportBoxUpdated = false
        }
    }

    /**
     * ========================================
     * Build & render
     * ========================================
     */

    /**
     * Build a style prop using the latest resolved MotionValues
     */
    build(isReactRender: boolean) {
        if (this.isVisible !== undefined) {
            this.style.visibility = this.isVisible ? "visible" : "hidden"
        }

        this.isLayoutProjectionEnabled &&
            this.box &&
            this.updateLayoutDeltas(isReactRender)

        buildHTMLStyles(
            this.latest,
            this.style,
            this.vars,
            this.transform,
            this.transformOrigin,
            this.transformKeys,
            this.config,
            this.isLayoutProjectionEnabled && !!this.box,
            this.delta,
            this.deltaFinal,
            this.treeScale,
            this.targetBoxFinal
        )
    }

    /**
     * Render the Element by rebuilding and applying the latest styles and vars.
     */
    render() {
        // Rebuild the latest animated values into style and vars caches.
        this.build(false)

        // Directly assign style into the Element's style prop. In tests Object.assign is the
        // fastest way to assign styles.
        Object.assign(this.element.style, this.style)

        // Loop over any CSS variables and assign those.
        for (const key in this.vars) {
            this.element.style.setProperty(key, this.vars[key] as string)
        }
    }
}

function scheduleChildrenLayoutRender(element: HTMLVisualElement) {
    if (element.isLayoutProjectionEnabled) {
        element.scheduleRender()
    }

    if (element.hasLayoutChildren) {
        element.children.forEach(scheduleChildrenLayoutRender)
    }
}

function forEachParent(
    child: HTMLVisualElement,
    callback: (parent: HTMLVisualElement) => void
) {
    let parent:
        | HTMLVisualElement
        | undefined = child.parent as HTMLVisualElement

    while (parent) {
        callback(parent)
        parent = parent.parent as HTMLVisualElement
    }
}

interface MotionPoint {
    x: MotionValue<number>
    y: MotionValue<number>
}
