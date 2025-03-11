import { MotionValue } from "motion-dom"
import { addUniqueItem } from "motion-utils"
import { getWillChangeName } from "./get-will-change-name"
import { WillChange } from "./types"

export class WillChangeMotionValue
    extends MotionValue<string>
    implements WillChange
{
    private values: string[] = []

    add(name: string) {
        const styleName = getWillChangeName(name)

        if (styleName) {
            addUniqueItem(this.values, styleName)
            this.update()
        }
    }

    private update() {
        this.set(this.values.length ? this.values.join(", ") : "auto")
    }
}
