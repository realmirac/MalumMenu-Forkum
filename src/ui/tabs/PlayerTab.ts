import { add, CENTER, ObsidianLayout } from "frida-java-menu";

import { I18n } from "../../i18n/I18n";
import { Actions } from "../../features/Actions";
import { Target } from "../../features/Target";
import { UnityUtils } from "../../utils/UnityUtils";

/** Actions on other players. Pick someone with "Next Target", then use the buttons below (PC opens a player menu instead) */
export class PlayerTab {
    static draw(layout: ObsidianLayout) {
        const title = layout.textView(I18n.t("menu.tabs.player"));
        title.gravity = CENTER;
        add(title);

        const button = (key: string, action: () => void) => add(layout.button(I18n.t(`menu.functions.${key}`), UnityUtils.run(action)));

        button("next_target", () => Target.next());
        button("kill_target", () => Actions.killTarget());
        button("telekill_target", () => Actions.telekillTarget());
        button("teleport_target", () => Actions.teleportToTarget());
        button("teleport_all", () => Actions.teleportAllToMe());
        button("spectate_target", () => Actions.spectateTarget());
        button("stop_spectate", () => Actions.stopSpectating());
        button("report_target", () => Actions.reportTarget());
        button("eject_target", () => Actions.ejectTarget());

        button("kill_all", () => Actions.killAll());
        button("kill_crew", () => Actions.killCrew());
        button("kill_impostors", () => Actions.killImpostors());

        button("fake_die", () => Actions.fakeDie());
        button("revive", () => Actions.revive());
    }
}
