import type { MotionValue } from "motion-dom"

export interface WillChange extends MotionValue {
    add(name: string): void
}
