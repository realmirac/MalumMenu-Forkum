import { ObsidianLayout, add, CENTER } from "frida-java-menu";

import { I18n } from "../../i18n/I18n";
import { State } from "../../data/State";
import { Actions } from "../../features/Actions";
import { UnityUtils } from "../../utils/UnityUtils";

export class ESPTab {
    static draw(layout: ObsidianLayout) {
        const esp = layout.textView(I18n.t("menu.tabs.esp"));
        esp.gravity = CENTER;
        add(esp);

        const toggle = (key: string, apply: (state: boolean) => void) => add(layout.toggle(I18n.t(`menu.functions.${key}`), apply));

        toggle("no_shadows", state => (State.noShadows = state));
        toggle("see_ghosts", state => (State.seeGhosts = state));
        toggle("reveal_votes", state => (State.revealVotes = state));
        toggle("always_chat", state => (State.alwaysChat = state));

        add(layout.button(I18n.t("menu.functions.zoom_out"), UnityUtils.run(() => Actions.zoom(1))));
        add(layout.button(I18n.t("menu.functions.zoom_in"), UnityUtils.run(() => Actions.zoom(-1))));
        add(layout.button(I18n.t("menu.functions.zoom_reset"), UnityUtils.run(() => Actions.zoom(0))));
    }
}
