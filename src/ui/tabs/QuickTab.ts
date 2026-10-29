import { ObsidianLayout, add, CENTER } from "frida-java-menu";

import { I18n } from "../../i18n/I18n";
import { State } from "../../data/State";
import { Actions } from "../../features/Actions";
import { UnityUtils } from "../../utils/UnityUtils";
import { addToggle } from "../QuickToggle";

/**
 * Quick Options: the handful of options people actually reach for, ordered by importance (most important first).
 *
 * Each toggle lives ONLY here (it is removed from its old tab) so there are never two switches for one setting that
 * could disagree. Buttons are stateless, so they also stay in their normal tab.
 *
 * Order:
 *  1. No Shadows        - on by default, the single most used option
 *  2. Free Chat / Online unlock - on by default, needed to find and join Free Chat lobbies
 *  3. Reveal Roles
 *  4. Complete My Tasks
 *  5. Sabotage All
 *  6. Call Meeting
 *  7. NoClip
 *  8. Speed (toggle + slider)
 *  9. Unlock Vents
 * 10. Zoom (out / in / reset)
 * 11. See Ghosts
 * 12. Reveal Votes
 * 13. Kill Anyone
 * 14. Unlock Cosmetics - on by default
 */
export class QuickTab {
    static draw(layout: ObsidianLayout) {
        const title = layout.textView(I18n.t("menu.tabs.quick"));
        title.gravity = CENTER;
        add(title);

        const button = (key: string, action: () => void) => add(layout.button(I18n.t(`menu.functions.${key}`), UnityUtils.run(action)));

        addToggle(layout, "no_shadows", State.noShadows, state => (State.noShadows = state));
        addToggle(layout, "unlock_free_chat", State.unlockFreeChat, state => (State.unlockFreeChat = state));
        addToggle(layout, "reveal_roles", State.revealRoles, state => (State.revealRoles = state));

        button("complete_my_tasks", () => Actions.completeMyTasks());
        button("sabotage_all", () => Actions.sabotageAll());
        button("call_meeting", () => Actions.callMeeting());

        addToggle(layout, "noclip", State.noclip, state => (State.noclip = state));

        add(
            layout.seekbar(I18n.t("menu.functions.speed_val"), 20, 0, (value: number) => {
                State.speed = value;
            })
        );
        addToggle(layout, "custom_speed", State.customSpeed, state => (State.customSpeed = state));

        addToggle(layout, "unlock_vents", State.unlockVents, state => (State.unlockVents = state));

        button("zoom_out", () => Actions.zoom(1));
        button("zoom_in", () => Actions.zoom(-1));
        button("zoom_reset", () => Actions.zoom(0));

        addToggle(layout, "see_ghosts", State.seeGhosts, state => (State.seeGhosts = state));
        addToggle(layout, "reveal_votes", State.revealVotes, state => (State.revealVotes = state));
        addToggle(layout, "kill_anyone", State.killAnyone, state => (State.killAnyone = state));
        addToggle(layout, "unlock_cosmetics", State.unlockCosmetics, state => (State.unlockCosmetics = state));
    }
}
