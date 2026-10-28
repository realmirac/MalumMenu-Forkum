import { ObsidianLayout, add, CENTER } from "frida-java-menu";

import { I18n } from "../../i18n/I18n";
import { State } from "../../data/State";
import { UnityUtils } from "../../utils/UnityUtils";
import { ModuleManager } from "../../core/ModuleManager";
import { PlayerModule } from "../../modules/Player";

export class RolesTab {
    static draw(layout: ObsidianLayout) {
        const roles = layout.textView(I18n.t("menu.tabs.roles"));
        roles.gravity = CENTER;
        add(roles);

        add(
            layout.button(
                I18n.t("menu.functions.complete_my_tasks"),
                UnityUtils.run(() => ModuleManager.get(PlayerModule)?.completeMyTasks())
            )
        );

        add(
            layout.toggle(I18n.t("menu.functions.reveal_roles"), (state: boolean) => {
                State.revealRoles = state;
            })
        );

        RolesTab.section(layout, "menu.functions.impostor_header", [
            ["menu.functions.kill_anyone", state => (State.killAnyone = state)],
            ["menu.functions.kill_reach", state => (State.killReach = state)],
            ["menu.functions.no_kill_cd", state => (State.noKillCd = state)],
            ["menu.functions.no_ss_anim", state => (State.noShapeshiftAnim = state)],
            ["menu.functions.endless_ss", state => (State.endlessSsDuration = state)]
        ]);

        RolesTab.section(layout, "menu.functions.engineer_header", [
            ["menu.functions.endless_vent", state => (State.endlessVentTime = state)],
            ["menu.functions.no_vent_cd", state => (State.noVentCooldown = state)]
        ]);

        RolesTab.section(layout, "menu.functions.scientist_header", [
            ["menu.functions.endless_battery", state => (State.endlessBattery = state)],
            ["menu.functions.no_vitals_cd", state => (State.noVitalsCooldown = state)]
        ]);

        RolesTab.section(layout, "menu.functions.tracker_header", [
            ["menu.functions.endless_tracking", state => (State.endlessTracking = state)],
            ["menu.functions.no_tracking_cd", state => (State.noTrackingCooldown = state)]
        ]);
    }

    /** A centered header followed by one toggle per entry: `[translation key, setter]` */
    private static section(layout: ObsidianLayout, headerKey: string, toggles: [string, (state: boolean) => void][]): void {
        const header = layout.textView(I18n.t(headerKey));
        header.gravity = CENTER;
        add(header);

        for (const [key, setter] of toggles) {
            add(layout.toggle(I18n.t(key), (state: boolean) => setter(state)));
        }
    }
}
