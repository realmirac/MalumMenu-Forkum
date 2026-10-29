import Java from "frida-java-bridge";

import { add, CENTER, ObsidianLayout, toast } from "frida-java-menu";

import { I18n } from "../../i18n/I18n";
import { Diagnostics } from "../../core/Diagnostics";
import { DebugLog } from "../../logger/DebugLog";
import { JavaUtils } from "../../utils/JavaUtils";
import { UnityUtils } from "../../utils/UnityUtils";

export class DebugTab {
    static draw(layout: ObsidianLayout) {
        const debugTab = layout.textView(I18n.t("menu.tabs.debug"));
        debugTab.gravity = CENTER;
        add(debugTab);

        const debugText = [
            `Frida v${Frida.version} (runtime: ${Script.runtime})`,
            `Unity version: ${Il2Cpp.unityVersion}`,
            `Android version: ${Java.androidVersion}`,
            `Architecture: ${Process.arch}`,
            `Platform: ${Process.platform}`,
            `PID: ${Process.id}`
        ];
        for (const text of debugText) {
            add(layout.textView(text));
        }

        add(layout.toggle(I18n.t("menu.functions.debug_verbose"), (state: boolean) => (DebugLog.verbose = state)));

        add(
            layout.button(
                I18n.t("menu.functions.debug_selftest"),
                UnityUtils.run(() => {
                    Diagnostics.selfTest();
                    toast("Self-test done, see the debug report", 0);
                })
            )
        );

        add(
            layout.button(I18n.t("menu.functions.debug_copy"), () => {
                DebugLog.flush();
                JavaUtils.copyToClipboard(DebugLog.report());
                toast("Debug report copied. Paste it in a chat or note.", 1);
            })
        );

        add(
            layout.button(I18n.t("menu.functions.debug_share"), () => {
                DebugLog.flush();
                JavaUtils.shareText("MalumMenu debug report", DebugLog.report());
            })
        );

        add(
            layout.button(
                I18n.t("menu.functions.debug_dump_api"),
                UnityUtils.run(() => {
                    const text = Diagnostics.dumpApi();
                    toast(`API report written (${Math.round(text.length / 1024)} KB)`, 1);
                })
            )
        );

        add(
            layout.button(I18n.t("menu.functions.debug_share_api"), () => {
                const text = Diagnostics.apiText;
                if (!text) {
                    toast("Run 'Dump game API report' first", 1);
                    return;
                }
                JavaUtils.shareText("MalumMenu game API report", text);
            })
        );

        add(
            layout.button(I18n.t("menu.functions.debug_path"), () => {
                DebugLog.flush();
                toast(DebugLog.path, 1);
            })
        );

        add(
            layout.button(I18n.t("menu.functions.go_to_main_menu"), () => {
                UnityUtils.LoadScene("MainMenu");
            })
        );

        add(
            layout.button(
                "Exit game",
                () => {
                    toast(I18n.t("menu.toasts.exit_game"), 0);
                },
                () => {
                    JavaUtils.exitFromApp();
                }
            )
        );
    }
}
