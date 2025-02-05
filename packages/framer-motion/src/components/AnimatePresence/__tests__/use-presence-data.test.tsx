import { AnimatePresence } from ".."
import { render } from "../../../../jest.setup"
import { usePresence } from "../use-presence"
import { usePresenceData } from "../use-presence-data"

describe("usePresenceCustomData", () => {
    test("returns custom data passed to AnimatePresence", () => {
        const Child = () => {
            const data = usePresenceData()
            const [isPresent] = usePresence()
            return (
                <div
                    id="test-div"
                    style={{ opacity: isPresent ? 0.8 : data }}
                />
            )
        }

        const Parent = ({ isVisible }: { isVisible: boolean }) => (
            <AnimatePresence custom={0.5}>
                {isVisible && <Child />}
            </AnimatePresence>
        )

        const { container, rerender } = render(<Parent isVisible={true} />)
        expect(container.querySelector("#test-div")).toHaveStyle({
            opacity: 0.8,
        })

        rerender(<Parent isVisible={false} />)
        expect(container.querySelector("#test-div")).toHaveStyle({
            opacity: 0.5,
        })
    })

    test("returns null when outside AnimatePresence", () => {
        let capturedCustomData: any = undefined

        const Component = () => {
            const customData = usePresenceData()
            capturedCustomData = customData
            return <div />
        }

        render(<Component />)
        expect(capturedCustomData).toBeNull()
    })
})
