import Java from "frida-java-bridge";
import { add, CENTER, ObsidianLayout } from "frida-java-menu";

import { I18n } from "../../i18n/I18n";
import { State } from "../../data/State";
import { UwUifyModule } from "../../modules/UwUify";
import { UnityUtils } from "../../utils/UnityUtils";
import { ModuleManager } from "../../core/ModuleManager";
import { PassiveModule } from "../../modules/Passive";

export class PassiveTab {
    static draw(layout: ObsidianLayout) {
        const passive = layout.textView(I18n.t("menu.tabs.passive"));
        passive.gravity = CENTER;
        add(passive);

        // Cosmetics are unlocked by default, so the switch starts checked
        const cosmetics = layout.toggle(I18n.t("menu.functions.unlock_cosmetics"), (state: boolean) => {
            State.unlockCosmetics = state;
        });
        add(cosmetics);
        Java.scheduleOnMainThread(() => {
            cosmetics.checked = State.unlockCosmetics;
        });

        // Free Chat (and the language picker inside it) is unlocked by default, no account needed
        const freeChat = layout.toggle(I18n.t("menu.functions.unlock_free_chat"), (state: boolean) => {
            State.unlockFreeChat = state;
        });
        add(freeChat);
        Java.scheduleOnMainThread(() => {
            freeChat.checked = State.unlockFreeChat;
        });

        add(
            layout.toggle(
                I18n.t("menu.functions.full_resolution"),
                UnityUtils.run((state: boolean) => {
                    ModuleManager.get(PassiveModule)?.toggleFullResolution(state);
                })
            )
        );

        add(
            layout.toggle(I18n.t("menu.functions.disable_analytics"), (state: boolean) => {
                State.disableAnalytics = state;
            })
        );

        add(
            layout.toggle(
                I18n.t("menu.functions.uwuify"),
                UnityUtils.run((state: boolean) => {
                    State.uwuifyMode = state;
                    ModuleManager.get(UwUifyModule)?.toggleUwUify(state);
                })
            )
        );

        add(
            layout.toggle(I18n.t("menu.functions.keyboard_mode"), (state: boolean) => {
                State.keyboardMode = state;
            })
        );
        add(layout.textView(I18n.t("menu.functions.keyboard_mode_note")));
    }
}
