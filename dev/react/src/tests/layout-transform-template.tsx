import { motion } from "framer-motion"
import React from "react"

export function App() {
    const [animate, setAnimate] = React.useState(false)

    return (
        <>
            <div
                style={{
                    width: 515,
                    height: 272,
                    position: "relative",
                    border: "1px solid black",
                }}
            >
                <motion.div
                    layout
                    style={animate ? styles.outerAnimate : styles.outer}
                    transition={{ duration: 30, ease: () => 0.5 }}
                >
                    <motion.div
                        layout
                        style={animate ? styles.innerAnimate : styles.inner}
                        initial={
                            animate
                                ? undefined
                                : {
                                      transform:
                                          "matrix(0.866049, -0.499959, 0.500041, 0.866002, 0, 0)",
                                  }
                        }
                        animate={
                            animate
                                ? {
                                      transform: "matrix(1, 0, 0, 1, 0, 0)",
                                  }
                                : undefined
                        }
                        transition={{ duration: 30, ease: () => 0.5 }}
                        transformTemplate={(
                            transform: any,
                            generatedTransform: string
                        ) => {
                            /**
                             * The `transform` property here should be constantly updating as it animates the value
                             */
                            console.log(
                                "transform within template",
                                transform,
                                generatedTransform
                            )
                            if (transform && transform.transform) {
                                return `${generatedTransform} ${transform.transform}`
                            }
                            return generatedTransform
                        }}
                    >
                        <motion.div
                            layout
                            style={
                                animate
                                    ? styles.baseLayerAnimate
                                    : styles.baseLayer
                            }
                            transformTemplate={(
                                _: any,
                                generatedTransform: string
                            ) => {
                                return generatedTransform
                            }}
                        >
                            <motion.div
                                layout
                                id="measure"
                                style={styles.background}
                                transformTemplate={(
                                    _: any,
                                    generatedTransform: string
                                ) => {
                                    return generatedTransform
                                }}
                            />
                        </motion.div>
                    </motion.div>
                </motion.div>
            </div>
            <button
                style={{ position: "absolute", right: 10, top: 10 }}
                onClick={() => {
                    setAnimate(!animate)
                }}
            >
                Animate
            </button>
        </>
    )
}

const styles = {
    outer: {
        backgroundColor: "#fc0303",
        height: 186,
        left: 113,
        right: 178,
        top: 49,
        bottom: "auto",
        position: "absolute",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },

    outerAnimate: {
        backgroundColor: "#fc0303",
        height: 100,
        width: 200,
        left: 37,
        right: "auto",
        top: "auto",
        bottom: 56,
        position: "absolute",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },

    inner: {
        width: 200,
        height: 100,
        flex: "0 0 auto",
    },

    innerAnimate: {
        /* width: 200,
        height: 100, */
        flex: "0 0 auto",
    },

    baseLayer: {
        width: "100%",
        height: "100%",
        position: "relative",
    },

    baseLayerAnimate: {
        width: 200,
        height: 100,
        position: "relative",
    },

    background: {
        backgroundColor: "blue",
        position: "absolute",
        inset: 0,
    },
} as const
