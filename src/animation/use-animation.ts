import { AnimationControls } from "./AnimationControls"
import { useMemo, useEffect } from "react"
import { Transition, Variants } from "../types"

/**
 * Manually start, stop and sequence animations on one or more `motion` components.
 *
 * @param variants - An optional named map of variants.
 * @param defaultTransition - An optional default transition to use when a variant doesn’t have an explicit `transition` property set.
 * @returns Animation controller with `start` and `stop` methods
 *
 * @public
 */
export function useAnimation(
    variants?: Variants,
    defaultTransition?: Transition
) {
    const animationManager = useMemo(() => new AnimationControls(), [])

    if (variants) {
        animationManager.setVariants(variants)
    }

    if (defaultTransition) {
        animationManager.setDefaultTransition(defaultTransition)
    }

    useEffect(() => {
        animationManager.mount()
        return () => animationManager.unmount()
    }, [])

    return animationManager
}
