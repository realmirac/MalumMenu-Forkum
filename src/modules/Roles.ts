import { AssemblyHelper } from "../core/AssemblyHelper";
import { BaseModule } from "../core/BaseModule";
import { State } from "../data/State";
import { Logger } from "../logger/Logger";
import { UnityUtils } from "../utils/UnityUtils";

/**
 * Shows every player's role above their name (in game and on the meeting screen)
 *
 * Ported from MalumMenu (PC): MalumESP.PlayerNametags / MeetingNametags and Utils.GetNameTag.
 * Like PC, the name is rewritten with rich text every frame (the game resets it).
 */
export class RolesModule extends BaseModule {
    public readonly name = "Roles";

    private static GameData: Il2Cpp.Class;
    private static MeetingHud: Il2Cpp.Class;
    private static RoleTypes: Il2Cpp.Class;
    private static RoleTeamTypes: Il2Cpp.Class;

    private static MeetingHud_Update: Il2Cpp.Method;

    /** Set once the toggle was used, so turning it off restores the plain names */
    private static touched = false;
    private static errorShown = false;

    public init(): void {
        RolesModule.GameData = AssemblyHelper.AssemblyCSharp.class("GameData");
        RolesModule.MeetingHud = AssemblyHelper.AssemblyCSharp.class("MeetingHud");
        RolesModule.RoleTypes = AssemblyHelper.findClass("RoleTypes")!;
        RolesModule.RoleTeamTypes = AssemblyHelper.findClass("RoleTeamTypes")!;

        RolesModule.MeetingHud_Update = RolesModule.MeetingHud.method<void>("Update");
    }

    public override initHooks(): void {
        RolesModule.MeetingHud_Update.implementation = function (): void {
            this.method<void>("Update").invoke();
            RolesModule.updateMeetingNametags(this as Il2Cpp.Object);
        };
    }

    /** Called from the PlayerPhysics.LateUpdate hook (PlayerModule), once per player per frame */
    public static updatePlayerNametag(physics: Il2Cpp.Object): void {
        if (!State.revealRoles && !RolesModule.touched) return;

        try {
            const player = physics.field<Il2Cpp.Object>("myPlayer").value;
            if (player.isNull()) return;

            const data = player.method<Il2Cpp.Object>("get_Data").invoke();
            if (data.isNull()) return;

            const outfit = player.method<Il2Cpp.Object>("get_CurrentOutfit").invoke();
            if (outfit.isNull()) return;

            const plainName = RolesModule.readString(outfit.field("PlayerName").value);
            const tag = RolesModule.nameTag(data, plainName);

            const cosmetics = player.field<Il2Cpp.Object>("cosmetics").value;
            cosmetics.method<void>("SetName", 1).invoke(Il2Cpp.string(tag));

            // Lift the name so it doesn't overlap the colorblind text
            const nameText = cosmetics.field<Il2Cpp.Object>("nameText").value;
            const y = State.revealRoles ? 0.093 : 0;
            UnityUtils.getTransform(nameText).method<void>("set_localPosition").invoke(UnityUtils.createVector3(0, y, 0));
        } catch (e) {
            RolesModule.reportOnce(e);
        }
    }

    private static updateMeetingNametags(meetingHud: Il2Cpp.Object): void {
        if (!State.revealRoles && !RolesModule.touched) return;

        try {
            const states = meetingHud.field<Il2Cpp.Array<Il2Cpp.Object>>("playerStates").value;
            const gameData = RolesModule.GameData.field<Il2Cpp.Object>("Instance").value;
            if (states.isNull() || gameData.isNull()) return;

            for (let i = 0; i < states.length; i++) {
                const area = states.get(i);
                const playerId = Number(area.method<number>("get_PlayerId").invoke());

                const data = gameData.method<Il2Cpp.Object>("GetPlayerById").invoke(playerId);
                if (data.isNull()) continue;

                const outfit = data.method<Il2Cpp.Object>("get_DefaultOutfit").invoke();
                if (outfit.isNull()) continue;

                const plainName = RolesModule.readString(outfit.field("PlayerName").value);
                const nameText = area.field<Il2Cpp.Object>("NameText").value;
                nameText.method<void>("set_text", 1).invoke(Il2Cpp.string(RolesModule.nameTag(data, plainName)));
            }
        } catch (e) {
            RolesModule.reportOnce(e);
        }
    }

    /** Builds the displayed name. `data` is a NetworkedPlayerInfo */
    private static nameTag(data: Il2Cpp.Object, plainName: string): string {
        if (!State.revealRoles) return plainName;
        RolesModule.touched = true;

        if (data.field<boolean>("Disconnected").value) return plainName;

        const role = data.field<Il2Cpp.Object>("Role").value;
        if (role.isNull()) return plainName; // roles aren't assigned in the lobby

        const roleName = UnityUtils.enumName(RolesModule.RoleTypes, Number(role.field("Role").value)) ?? "Unknown";
        const label = roleName.replace(/([a-z])([A-Z])/g, "$1 $2");

        const team = UnityUtils.enumName(RolesModule.RoleTeamTypes, Number(role.field("TeamType").value));
        const color = team === "Impostor" ? "FF1919" : "8CFFFF";

        return `<color=#${color}><size=70%>${label}</size>\n${plainName}</color>`;
    }

    private static readString(value: any): string {
        return value?.content ?? "";
    }

    private static reportOnce(e: unknown): void {
        if (RolesModule.errorShown) return;
        RolesModule.errorShown = true;
        Logger.toast(`Reveal Roles error: ${e}`);
    }
}
