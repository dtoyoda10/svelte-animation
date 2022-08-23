import { MotionContextProps } from "."
import { MotionProps } from "../../motion/types"
import { isVariantLabel } from "../../render/utils/is-variant-label"
import { isControllingVariants } from "../../render/utils/is-controlling-variants"

export function getCurrentTreeVariants(
    props: MotionProps,
    context: MotionContextProps
): MotionContextProps {
    if (isControllingVariants(props)) {
        const { initial, animate } = props
        return {
            initial:
                initial === false || isVariantLabel(initial)
                    ? (initial as any)
                    : undefined,
            animate: isVariantLabel(animate) ? animate : undefined,
        }
    }
    return props.inherit !== false ? context : {}
}
