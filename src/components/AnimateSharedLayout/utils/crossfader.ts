import { getFrameData } from "framesync"
import {
    circOut,
    linear,
    mix,
    PlaybackControls,
    progress as calcProgress,
} from "popmotion"
import { animate } from "../../../animation/animate"
import { ResolvedValues, VisualElement } from "../../../render/types"
import { EasingFunction, Transition } from "../../../types"
import { motionValue } from "../../../value"

export interface Crossfader {
    isActive(): boolean
    getCrossfadeState(element: VisualElement): ResolvedValues
    from(transition?: Transition): PlaybackControls
    to(transition?: Transition): PlaybackControls
    setOptions(options: CrossfadeAnimationOptions): void
    reset(): void
}

export interface CrossfadeAnimationOptions {
    lead?: VisualElement
    follow?: VisualElement
    crossfadeOpacity?: boolean
    preserveFollowOpacity?: boolean
}

/**
 * TODO: Test crossfadder
 */
export function createCrossfader(): Crossfader {
    /**
     * The current state of the crossfade as a value between 0 and 1
     */
    const progress = motionValue(1)

    let options: CrossfadeAnimationOptions = {
        lead: undefined,
        follow: undefined,
        crossfadeOpacity: false,
        preserveFollowOpacity: false,
    }

    let leadState: ResolvedValues = {}
    let followState: ResolvedValues = {}

    /**
     *
     */
    let isActive = false

    /**
     *
     */
    let hasRenderedFinalCrossfade = true

    /**
     * Framestamp of the last frame we updated values at.
     */
    let prevUpdate = 0

    function startCrossfadeAnimation(target: number, transition?: Transition) {
        const { lead, follow } = options
        isActive = true
        hasRenderedFinalCrossfade = false

        return animate(progress, target, {
            ...transition,
            onUpdate: () => {
                lead && lead.scheduleRender()
                follow && follow.scheduleRender()
            },
            onComplete: () => (isActive = false),
        } as any)
    }

    function updateCrossfade() {
        /**
         * We only want to compute the crossfade once per frame, so we
         * compare the previous update framestamp with the current frame
         * and early return if they're the same.
         */
        const { timestamp } = getFrameData()
        const { lead, follow } = options
        if (timestamp === prevUpdate || !lead) return
        prevUpdate = timestamp

        /**
         * Merge each component's latest values into our crossfaded state
         * before crossfading.
         */
        const latestLeadValues = lead.getLatestValues()
        Object.assign(leadState, latestLeadValues)
        const latestFollowValues = follow?.getLatestValues()
        follow && Object.assign(followState, latestFollowValues)

        /**
         * If the crossfade animation is no longer active, flag that we've
         * rendered the final frame of animation.
         *
         * TODO: This will result in the final frame being rendered only
         * for the first component to render the frame. Perhaps change
         * this to recording the timestamp of the final frame.
         */
        if (!isActive) hasRenderedFinalCrossfade = true

        const p = progress.get()

        /**
         * Crossfade the opacity between the two components. This will result
         * in a different opacity for each component.
         */
        if (options.crossfadeOpacity) {
            const leadTargetOpacity = (latestLeadValues.opacity as number) ?? 1
            const followTargetOpacity =
                (latestFollowValues?.opacity as number) ?? 1

            if (follow) {
                leadState.opacity = mix(
                    0,
                    leadTargetOpacity,
                    easeCrossfadeIn(p)
                )
                followState.opacity = options.preserveFollowOpacity
                    ? followTargetOpacity
                    : mix(followTargetOpacity, 0, easeCrossfadeOut(p))
            } else {
                leadState.opacity = mix(
                    followTargetOpacity,
                    leadTargetOpacity,
                    p
                )
            }
        }

        mixValues(
            leadState,
            followState,
            latestLeadValues,
            latestFollowValues || {},
            p
        )
    }

    return {
        isActive: () => leadState && (isActive || !hasRenderedFinalCrossfade),
        from(transition) {
            return startCrossfadeAnimation(0, transition)
        },
        to(transition) {
            progress.set(1 - progress.get())
            return startCrossfadeAnimation(1, transition)
        },
        reset: () => progress.set(1),
        getCrossfadeState(element) {
            updateCrossfade()
            return element === options.lead ? leadState : followState
        },
        setOptions(newOptions) {
            options = newOptions
            leadState = {}
            followState = {}
        },
    }
}

const easeCrossfadeIn = compress(0, 0.5, circOut)
const easeCrossfadeOut = compress(0.5, 0.95, linear)

function compress(
    min: number,
    max: number,
    easing: EasingFunction
): EasingFunction {
    return (p: number) => {
        // Could replace ifs with clamp
        if (p < min) return 0
        if (p > max) return 1
        return easing(calcProgress(min, max, p))
    }
}

const borders = ["TopLeft", "TopRight", "BottomLeft", "BottomRight"]
const numBorders = borders.length

function mixValues(
    leadState: ResolvedValues,
    followState: ResolvedValues,
    latestLeadValues: ResolvedValues,
    latestFollowValues: ResolvedValues,
    p: number
): void {
    /**
     * Mix border radius
     */
    for (let i = 0; i < numBorders; i++) {
        const borderLabel = `border${borders[i]}Radius`
        const followRadius = getRadius(latestFollowValues, borderLabel)
        const leadRadius = getRadius(latestLeadValues, borderLabel)

        /**
         * Currently we're only crossfading between numerical border radius.
         * It would be possible to crossfade between percentages for a little
         * extra bundle size.
         */
        if (
            typeof followRadius === "number" &&
            typeof leadRadius === "number"
        ) {
            const radius = mix(followRadius, leadRadius, p)
            leadState[borderLabel] = followState[borderLabel] = radius
        }
    }

    /**
     * Mix rotation
     */
    if (latestFollowValues.rotate || latestLeadValues.rotate) {
        const rotate = mix(
            (latestFollowValues.rotate as number) || 0,
            (latestLeadValues.rotate as number) || 0,
            p
        )
        leadState.rotate = followState.rotate = rotate
    }
}

function getRadius(values: ResolvedValues, radiusName: string) {
    return values[radiusName] ?? values.borderRadius ?? 0
}
