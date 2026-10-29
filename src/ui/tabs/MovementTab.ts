import { ObsidianLayout, add, CENTER } from "frida-java-menu";

import { I18n } from "../../i18n/I18n";
import { State } from "../../data/State";

export class MovementTab {
    static draw(layout: ObsidianLayout) {
        const movement = layout.textView(I18n.t("menu.tabs.movement"));
        movement.gravity = CENTER;
        add(movement);

        add(
            layout.toggle(I18n.t("menu.functions.moonwalk"), (state: boolean) => {
                State.moonWalk = state;
            })
        );

        add(
            layout.toggle(I18n.t("menu.functions.invert_controls"), (state: boolean) => {
                State.invertControls = state;
            })
        );
    }
}
