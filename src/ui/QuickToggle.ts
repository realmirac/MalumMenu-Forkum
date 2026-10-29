import Java from "frida-java-bridge";
import { add, ObsidianLayout } from "frida-java-menu";

import { I18n } from "../i18n/I18n";

/**
 * Adds a toggle whose switch starts at `initial`
 *
 * A toggle that is on by default (No Shadows, Free Chat, Cosmetics) has to LOOK on when the menu opens, otherwise the
 * switch says "off" while the cheat is running and the first tap silently turns it off.
 */
export function addToggle(layout: ObsidianLayout, key: string, initial: boolean, apply: (state: boolean) => void): void {
    const widget = layout.toggle(I18n.t(`menu.functions.${key}`), apply);
    add(widget);
    if (initial) {
        Java.scheduleOnMainThread(() => {
            widget.checked = true;
        });
    }
}
