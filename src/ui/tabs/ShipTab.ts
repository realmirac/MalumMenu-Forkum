import { add, CENTER, ObsidianLayout } from "frida-java-menu";

import { I18n } from "../../i18n/I18n";
import { State } from "../../data/State";
import { ModuleManager } from "../../core/ModuleManager";
import { UnityUtils } from "../../utils/UnityUtils";
import { ShipModule } from "../../modules/Ship";
import { Actions } from "../../features/Actions";

export class ShipTab {
    static draw(layout: ObsidianLayout) {
        const ship = layout.textView(I18n.t("menu.tabs.ship"));
        ship.gravity = CENTER;
        add(ship);

        const button = (key: string, action: () => void) => add(layout.button(I18n.t(`menu.functions.${key}`), UnityUtils.run(action)));

        // Sabotage: PC lets non-impostors sabotage without cooldown, several at once, even during meetings
        button("sabotage_all", () => Actions.sabotageAll());
        button("repair_all", () => Actions.repairAll());
        button("sabotage_reactor", () => Actions.sabotage("reactor", true));
        button("repair_reactor", () => Actions.sabotage("reactor", false));
        button("sabotage_oxygen", () => Actions.sabotage("oxygen", true));
        button("repair_oxygen", () => Actions.sabotage("oxygen", false));
        button("sabotage_comms", () => Actions.sabotage("comms", true));
        button("repair_comms", () => Actions.sabotage("comms", false));
        button("sabotage_lights", () => Actions.sabotage("lights", true));
        button("repair_lights", () => Actions.sabotage("lights", false));
        button("unfixable_lights", () => Actions.toggleUnfixableLights());
        button("sabotage_mushroom", () => Actions.sabotage("mushroom", true));

        // Doors
        button("close_all_doors", () => Actions.closeAllDoors());
        button("open_all_doors", () => Actions.openAllDoors());

        // Meetings
        button("call_meeting", () => Actions.callMeeting());
        button("skip_meeting", () => Actions.skipMeeting());
        button("close_meeting", () => Actions.closeMeeting());
        button("force_start", () => Actions.forceStartGame());

        button("open_sabotage_map", () => ModuleManager.get(ShipModule)?.openSabotageMap());

        // Vents
        button("kick_vents", () => ModuleManager.get(ShipModule)?.kickVents());
        add(
            layout.toggle(I18n.t("menu.functions.walk_in_vents"), (state: boolean) => {
                State.walkInVents = state;
            })
        );
    }
}
