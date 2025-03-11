import { MotionValue } from "motion-dom"

export const isMotionValue = (value: any): value is MotionValue =>
    Boolean(value && value.getVelocity)
