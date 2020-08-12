import { MotionValue } from "../value"
import { transform, TransformOptions } from "../utils/transform"
import { useCombineMotionValues } from "./use-combine-values"
import { useConstant } from "../utils/use-constant"
import { useMotionValue } from "./use-motion-value"
import { useOnChange } from "./use-on-change"

type InputRange = number[]
type SingleTransformer<I, O> = (input: I) => O
type MultiTransformer<I, O> = (input: I[]) => O
type Transformer<I, O> = SingleTransformer<I, O> | MultiTransformer<I, O>

function isTransformer<I, O>(
    transformer: InputRange | Transformer<I, O>
): transformer is Transformer<I, O> {
    return typeof transformer === "function"
}

/**
 *
 *
 * @public
 */
export function useTransform<I = number, O = string | number>(
    value: MotionValue<number>,
    inputRange: InputRange,
    outputRange: O[],
    options?: TransformOptions<O>
): MotionValue<O>

/**
 * Create a `MotionValue` that transforms the output of another `MotionValue` through a function.
 * In this example, `y` will always be double `x`.
 *
 * @library
 *
 * ```jsx
 * import * as React from "react"
 * import { Frame, useMotionValue, useTransform } from "framer"
 *
 * export function MyComponent() {
 *   const x = useMotionValue(10)
 *   const y = useTransform(x, value => value * 2)
 *
 *   return <Frame x={x} y={y} />
 * }
 * ```
 *
 * @motion
 *
 * ```jsx
 * export const MyComponent = () => {
 *   const x = useMotionValue(10)
 *   const y = useTransform(x, value => value * 2)
 *
 *   return <motion.div style={{ x, y }} />
 * }
 * ```
 *
 * @param input - A `MotionValue` that will pass its latest value through `transform` to update the returned `MotionValue`.
 * @param transform - A function that accepts the latest value from `input` and returns a new value.
 * @returns `MotionValue`
 *
 * @public
 */
export function useTransform<I = string | number, O = string | number>(
    input: MotionValue<I>,
    transformer: SingleTransformer<I, O>
): MotionValue<O>

/**
 * Pass an array of `MotionValue`s and a function to combine them. In this example, `z` will be the `x` multiplied by `y`.
 *
 * @library
 *
 * ```jsx
 * import * as React from "react"
 * import { Frame, useMotionValue, useTransform } from "framer"
 *
 * export function MyComponent() {
 *   const x = useMotionValue(0)
 *   const y = useMotionValue(0)
 *   const z = useTransform([x, y], latest => latest.x * latest.y)
 *
 *   return <Frame x={x} y={y} z={z} />
 * }
 * ```
 *
 * @motion
 *
 * ```jsx
 * export const MyComponent = () => {
 *   const x = useMotionValue(0)
 *   const y = useMotionValue(0)
 *   const z = useTransform([x, y], latest => latest.x * latest.y)
 *
 *   return <motion.div style={{ x, y, z }} />
 * }
 * ```
 *
 * @param input - An array of `MotionValue`s that will pass their latest values through `transform` to update the returned `MotionValue`.
 * @param transform - A function that accepts the latest values from `input` and returns a new value.
 * @returns `MotionValue`
 *
 * @public
 */
export function useTransform<I = string | number, O = string | number>(
    input: MotionValue<I>[],
    transformer: MultiTransformer<I, O>
): MotionValue<O>

/**
 * Create a `MotionValue` that transforms the output of another `MotionValue` by mapping it from one range of values into another.
 *
 * @remarks
 *
 * Given an input range of `[-200, -100, 100, 200]` and an output range of
 * `[0, 1, 1, 0]`, the returned `MotionValue` will:
 *
 * - When provided a value between `-200` and `-100`, will return a value between `0` and  `1`.
 * - When provided a value between `-100` and `100`, will return `1`.
 * - When provided a value between `100` and `200`, will return a value between `1` and  `0`
 *
 *
 * The input range must be a linear series of numbers. The output range
 * can be any value type supported by Framer Motion: numbers, colors, shadows, etc.
 *
 * Every value in the output range must be of the same type and in the same format.
 *
 * @library
 *
 * ```jsx
 * export function MyComponent() {
 *   const x = useMotionValue(0)
 *   const xRange = [-200, -100, 100, 200]
 *   const opacityRange = [0, 1, 1, 0]
 *   const opacity = useTransform(x, xRange, opacityRange)
 *
 *   return <Frame drag="x" x={x} opacity={opacity} />
 * }
 * ```
 *
 * @motion
 *
 * ```jsx
 * export const MyComponent = () => {
 *   const x = useMotionValue(0)
 *   const xRange = [-200, -100, 100, 200]
 *   const opacityRange = [0, 1, 1, 0]
 *   const opacity = useTransform(x, xRange, opacityRange)
 *
 *   return <motion.div drag="x" style={{ opacity, x }} />
 * }
 * ```
 *
 * @param inputValue - `MotionValue`
 * @param inputRange - A linear series of numbers (either all increasing or decreasing)
 * @param outputRange - A series of numbers, colors or strings. Must be the same length as `inputRange`.
 * @param options -
 *
 *  - clamp: boolean - Clamp values to within the given range. Defaults to `true`
 *  - ease: EasingFunction[] - Easing functions to use on the interpolations between each value in the input and output ranges. If provided as an array, the array must be one item shorter than the input and output ranges, as the easings apply to the transition **between** each.
 *
 * @returns `MotionValue`
 *
 * @public
 */
export function useTransform<I = string | number, O = string | number>(
    input: MotionValue<I> | MotionValue<I>[],
    inputRangeOrTransformer: InputRange | Transformer<I, O>,
    outputRange?: O[],
    options?: TransformOptions<O>
): MotionValue<O> {
    const transformer = isTransformer(inputRangeOrTransformer)
        ? inputRangeOrTransformer
        : transform(inputRangeOrTransformer, outputRange!, options)

    return Array.isArray(input)
        ? useListTransform(input, transformer as MultiTransformer<I, O>)
        : useSingleTransform(input, transformer as SingleTransformer<I, O>)
}

function useSingleTransform<I, O>(
    input: MotionValue<I>,
    transformer: SingleTransformer<I, O>
): MotionValue<O> {
    const initialValue = transformer(input.get())
    const output = useMotionValue(initialValue)
    output.set(initialValue)

    useOnChange(input, latest => output.set(transformer(latest)))

    return output
}

function useListTransform<I = string | number, O = string | number>(
    values: MotionValue<I>[],
    transformer: MultiTransformer<I, O>
): MotionValue<O> {
    const latest = useConstant<I[]>(() => [])

    return useCombineMotionValues(values, () => {
        latest.length = 0
        const numValues = values.length
        for (let i = 0; i < numValues; i++) {
            latest[i] = values[i].get()
        }

        return transformer(latest)
    })
}
