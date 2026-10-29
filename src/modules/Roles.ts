import { BaseModule } from "../core/BaseModule";
import { Frame, Game } from "../core/Game";
import { State } from "../data/State";
import { DebugLog } from "../logger/DebugLog";
import { UnityUtils } from "../utils/UnityUtils";

/**
 * Reveal Roles: shows every player's role above their name (in game and on the meeting screen)
 *
 * Ported from MalumMenu (PC): MalumESP.PlayerNametags / MeetingNametags and Utils.GetNameTag.
 * Like PC, the name is rewritten with rich text every frame because the game resets it.
 */
export class RolesModule extends BaseModule {
    public readonly name = "Roles";

    /** Set once the toggle was used, so turning it off restores the plain names */
    private static touched = false;

    public init(): void {
        Frame.on("PlayerPhysics.LateUpdate", "nametag", self => RolesModule.updatePlayerNametag(self));
    }

    public override initHooks(): void {
        Game.hook("MeetingHud.Update", "MeetingHud", "Update", 0, (self, call) => {
            const result = call();
            RolesModule.updateMeetingNametags(self);
            return result;
        });
    }

    private static updatePlayerNametag(physics: Il2Cpp.Object): void {
        if (!State.revealRoles && !RolesModule.touched) return;

        const player = Game.get(physics, "myPlayer");
        if (Game.isNull(player)) return;

        const data = Game.playerData(player);
        if (!data) return;

        const outfit = Game.get(player, "CurrentOutfit");
        if (Game.isNull(outfit)) return;

        const tag = RolesModule.nameTag(data, Game.str(Game.get(outfit, "PlayerName")));

        const cosmetics = Game.get(player, "cosmetics");
        const nameText = Game.get(cosmetics, "nameText");

        // Rewriting TMP text rebuilds its mesh, so only write when the game reset it or the tag changed (big FPS saver)
        let current = "";
        try {
            current = Game.str(Game.get(nameText, "text"));
        } catch {
            // unreadable, just write
        }
        if (current !== tag) {
            // PC calls cosmetics.SetName(string); if this game version has a different SetName, set the text directly
            const setName = cosmetics.tryMethod("SetName", 1);
            if (setName) setName.invoke(Il2Cpp.string(tag));
            else Game.set(nameText, "text", Il2Cpp.string(tag));
        }

        // Lift the name so it doesn't overlap the colorblind text (PC uses 0.093 for one extra line)
        const y = State.revealRoles ? 0.093 : 0;
        Game.call(UnityUtils.getTransform(nameText), "set_localPosition", 1, UnityUtils.createVector3(0, y, 0));
        DebugLog.record("Reveal Roles (player name)", true);
    }

    private static updateMeetingNametags(meetingHud: Il2Cpp.Object): void {
        if (!State.revealRoles && !RolesModule.touched) return;

        const gameData = Game.instance("GameData");
        if (!gameData) return;

        for (const area of Game.list(Game.get(meetingHud, "playerStates"))) {
            const data = Game.call(gameData, "GetPlayerById", 1, Number(Game.get(area, "PlayerId")));
            if (Game.isNull(data)) continue;

            const outfit = Game.call(data, "get_DefaultOutfit", 0);
            if (Game.isNull(outfit)) continue;

            const tag = RolesModule.nameTag(data, Game.str(Game.get(outfit, "PlayerName")));
            const nameText = Game.get(area, "NameText");
            let current = "";
            try {
                current = Game.str(Game.get(nameText, "text"));
            } catch {
                // unreadable, just write
            }
            if (current !== tag) Game.set(nameText, "text", Il2Cpp.string(tag));
        }
        DebugLog.record("Reveal Roles (meeting names)", true);
    }

    /** Builds the displayed name. `data` is a NetworkedPlayerInfo */
    private static nameTag(data: Il2Cpp.Object, plainName: string): string {
        if (!State.revealRoles) return plainName;
        RolesModule.touched = true;

        if (Boolean(Game.get(data, "Disconnected"))) return plainName;

        const role = Game.roleName(data);
        if (!role) return plainName; // roles aren't assigned in the lobby

        const color = Game.teamName(data) === "Impostor" ? "FF1919" : "8CFFFF";
        const label = role.replace(/([a-z])([A-Z])/g, "$1 $2");
        return `<color=#${color}><size=70%>${label}</size>\n${plainName}</color>`;
    }
}
