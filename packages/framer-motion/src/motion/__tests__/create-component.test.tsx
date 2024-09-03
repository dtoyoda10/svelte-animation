import { render } from "../../../jest.setup"
import { createMotionComponent } from "../../render/components/motion/create"
import { motionValue } from "../../value"

const motion = { div: createMotionComponent("div") }

describe("Create DOM Motion component", () => {
    test("Animates", async () => {
        const promise = new Promise((resolve) => {
            const x = motionValue(0)
            const onComplete = () => resolve(x.get())
            const Component = () => (
                <motion.div
                    animate={{ x: 20 }}
                    style={{ x }}
                    onAnimationComplete={onComplete}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        return expect(promise).resolves.toBe(20)
    })
})
