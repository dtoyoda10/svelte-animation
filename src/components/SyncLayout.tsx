import * as React from "react"
import { createContext } from "react"
import { useForceUpdate } from "../utils/use-force-update"

type SyncLayout = () => void

interface SyncLayoutProps {
    children: React.ReactNode
}

export const SyncLayoutContext = createContext<SyncLayout | null>(null)

/**
 * When layout changes happen asynchronously to their instigating render (ie when exiting
 * children of `AnimatePresence` are removed), `SyncLayout` can wrap parent and sibling
 * components that need to animate as a result of this layout change.
 *
 * @motion
 *
 * ```jsx
 * const MyComponent = ({ isVisible }) => {
 *   return (
 *     <SyncLayout>
 *       <AnimatePresence>
 *         {isVisible && (
 *           <motion.div exit={{ opacity: 0 }} />
 *         )}
 *       </AnimatePresence>
 *       <motion.div positionTransition />
 *     </SyncLayout>
 *   )
 * }
 * ```
 *
 * @internalremarks
 *
 * The way this component works is by memoising a function and passing it down via context.
 * The function, when called, updates the local state, which is used to invalidate the
 * memoisation cache. A new function is called, performing a synced re-render of components
 * that are using the SyncLayoutContext.
 *
 * @internal
 */
export const UnstableSyncLayout = ({ children }: SyncLayoutProps) => {
    const forceUpdate = useForceUpdate()

    return (
        <SyncLayoutContext.Provider value={forceUpdate}>
            {children}
        </SyncLayoutContext.Provider>
    )
}
