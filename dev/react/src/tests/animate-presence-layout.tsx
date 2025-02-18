import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useState } from "react"

export const App = () => {
    const [width, setWidth] = useState(100)
    const [presenceState, setPresenceState] = useState(true)

    useEffect(() => {
        if (width === 200) return
        const timeout = setTimeout(() => {
            setWidth(50)

            setTimeout(() => {
                setWidth(200)
            }, 1000)
        }, 1000)

        return () => clearTimeout(timeout)
    }, [width])

    useEffect(() => {
        setTimeout(() => {
            setPresenceState(false)
        }, 2100)
    }, [presenceState])

    return (
        <>
            <AnimatePresence initial={false}>
                {presenceState && (
                    <motion.div exit={{ opacity: 0 }}>
                        <motion.div
                            layout
                            style={{
                                width,
                                height: 100,
                                background: "red",
                            }}
                        >
                            Presence
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
