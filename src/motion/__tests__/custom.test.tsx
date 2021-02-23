import { render } from "../../../jest.setup"
import { motion } from "../.."
import * as React from "react"
import { RefObject } from "react"

interface Props {
    foo: boolean
}

describe("motion.custom", () => {
    test("accepts custom types", () => {
        const BaseComponent = React.forwardRef(
            (_props: Props, ref: RefObject<HTMLDivElement>) => {
                return <div ref={ref} />
            }
        )

        const MotionComponent = motion.custom<Props>(BaseComponent)

        const Component = () => <MotionComponent foo />

        render(<Component />)
    })

    test("doesn't forward motion props but does forward custom props", () => {
        let animate: any
        let foo: boolean = false
        const BaseComponent = React.forwardRef(
            (props: Props, ref: RefObject<HTMLDivElement>) => {
                animate = (props as any).animate
                foo = props.foo
                return <div ref={ref} />
            }
        )

        const MotionComponent = motion.custom<Props>(BaseComponent)

        const Component = () => <MotionComponent foo animate={{ x: 100 }} />

        render(<Component />)

        expect(animate).toBeUndefined()
        expect(foo).toBe(true)
    })
})
