import { ObsidianLayout, add, CENTER } from "frida-java-menu";

import { I18n } from "../../i18n/I18n";
import { State } from "../../data/State";
import { Actions } from "../../features/Actions";
import { Game } from "../../core/Game";
import { UnityUtils } from "../../utils/UnityUtils";

export class RolesTab {
    static draw(layout: ObsidianLayout) {
        const roles = layout.textView(I18n.t("menu.tabs.roles"));
        roles.gravity = CENTER;
        add(roles);

        const toggle = (key: string, apply: (state: boolean) => void) => add(layout.toggle(I18n.t(`menu.functions.${key}`), apply));

        toggle("reveal_roles", state => (State.revealRoles = state));

        add(layout.button(I18n.t("menu.functions.complete_my_tasks"), UnityUtils.run(() => Actions.completeMyTasks())));

        // Role names come from the game's own RoleTypes enum, so new roles show up without a mod update
        const roleNames = Game.enumNames("RoleTypes").filter(n => !n.includes("Ghost") && n !== "GuardianAngel" && n !== "SpiritGuide");
        if (roleNames.length > 0) {
            add(layout.radioGroup(I18n.t("menu.functions.fake_role"), roleNames, UnityUtils.run((index: number) => Actions.setFakeRole(roleNames[index]))));
        }

        // Impostor
        toggle("kill_anyone", state => (State.killAnyone = state));
        toggle("no_kill_cd", state => (State.noKillCd = state));
        toggle("kill_reach", state => (State.killReach = state));
        toggle("kill_vanished", state => (State.killVanished = state));
        toggle("interrogate_reach", state => (State.interrogateReach = state));
        toggle("track_reach", state => (State.trackReach = state));

        // Shapeshifter
        toggle("no_ss_anim", state => (State.noShapeshiftAnim = state));
        toggle("endless_ss", state => (State.endlessSsDuration = state));

        // Engineer
        toggle("endless_vent", state => (State.endlessVentTime = state));
        toggle("no_vent_cd", state => (State.noVentCooldown = state));

        // Scientist
        toggle("endless_battery", state => (State.endlessBattery = state));
        toggle("no_vitals_cd", state => (State.noVitalsCooldown = state));

        // Tracker
        toggle("endless_tracking", state => (State.endlessTracking = state));
        toggle("no_track_cd", state => (State.noTrackingCooldown = state));
        toggle("no_track_delay", state => (State.noTrackingDelay = state));
    }
}
