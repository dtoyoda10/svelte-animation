import * as React from "react"
import { animate } from "framer-motion"

export const App = () => {
    React.useEffect(() => {
        let count = 0
        for (let i = 0; i < 250; i++) {
            count++
            animate("rgba(0,0,0,0)", "rgba(255,255,255,1)", { duration: 20 })
        }

        console.log("started ", count, "animations")
    })

    return null
}
