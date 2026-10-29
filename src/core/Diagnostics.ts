import { Game } from "./Game";
import { DebugLog } from "../logger/DebugLog";
import { JavaUtils } from "../utils/JavaUtils";
import Java from "frida-java-bridge";

/** What the mod expects from the game. `Name/argc` is a method (-1 = any parameter count), a plain name is a field or property */
const EXPECTED: Record<string, string[]> = {
    PlayerControl: ["LocalPlayer", "AllPlayerControls", "Data", "PlayerId", "NetId", "NetTransform", "cosmetics", "CurrentOutfit", "myTasks", "moveable", "inVent", "Visible", "AmOwner", "MyPhysics", "Collider", "GetTruePosition/0", "RpcMurderPlayer/2", "CmdReportDeadBody/1", "RpcCompleteTask/1", "SetKillTimer/1", "CmdCheckShapeshift/2", "CmdCheckRevertShapeshift/1", "TurnOnProtection/-1", "Die/2", "Revive/0", "RpcStartMeeting/1"],
    NetworkedPlayerInfo: ["PlayerName", "IsDead", "Disconnected", "Role", "PlayerId", "Object", "DefaultOutfit"],
    RoleBehaviour: ["Role", "TeamType", "CanVent", "CanBeKilled", "Player", "TeamColor", "NameColor", "IsValidTarget/1"],
    CosmeticsLayer: ["nameText", "SetName/1"],
    CustomNetworkTransform: ["RpcSnapTo/1"],
    PlayerPhysics: ["myPlayer", "Speed", "GhostSpeed", "AmOwner", "LateUpdate/0", "HandleAnimation/-1", "ResetAnimState/0"],
    ShipStatus: ["Instance", "AllDoors", "AllVents", "Systems", "FixedUpdate/0", "RpcUpdateSystem/-1", "RpcCloseDoorsOfType/1"],
    OpenableDoor: ["Id", "Room"],
    MeetingHud: ["Instance", "playerStates", "DespawnOnDestroy", "Update/0", "RpcVotingComplete/-1"],
    PlayerVoteArea: ["NameText", "PlayerId"],
    AmongUsClient: ["Instance", "AmHost", "StartRpcImmediately/4", "FinishRpcImmediately/1", "GetClientIdFromCharacter/1", "SendStartGame/0"],
    MessageWriter: ["WriteNetObject/1"],
    GameData: ["Instance", "GetPlayerById/1"],
    GameManager: ["Instance", "LogicOptions"],
    GameOptionsManager: ["Instance", "currentGameOptions"],
    HudManager: ["Instance", "Chat", "UICamera", "AbilityButton", "ShadowQuad", "OpenMeetingRoom/1", "Update/0"],
    MeetingRoomManager: ["Instance", "AssignSelf/2"],
    RoleManager: ["Instance", "AllRoles", "SetRole/2"],
    FollowerCamera: ["Target", "Locked", "SetTarget/1"],
    ImpostorRole: ["IsValidTarget/1", "FindClosestTarget/0"],
    PhantomRole: ["IsValidTarget/1"],
    DetectiveRole: ["FindClosestTarget/0"],
    TrackerRole: ["FindClosestTarget/0", "FixedUpdate/0", "cooldownSecondsRemaining", "delaySecondsRemaining", "durationSecondsRemaining"],
    EngineerRole: ["FixedUpdate/0", "inVentTimeRemaining", "cooldownSecondsRemaining", "GetCooldown/0"],
    ScientistRole: ["Update/0", "currentCharge", "currentCooldown", "RoleCooldownValue"],
    ShapeshifterRole: ["FixedUpdate/0", "durationSecondsRemaining"],
    LogicOptions: ["GetAnonymousVotes/0", "GetRoleFloat/1"],
    LogicOptionsNormal: ["GetAnonymousVotes/0"],
    ResolutionManager: ["ResolutionChanged"],
    Camera: ["main", "orthographicSize"],
    Screen: ["width", "height", "fullScreen"],
    RoleTypes: ["Crewmate", "Impostor", "Scientist", "Engineer", "Shapeshifter", "Tracker", "Phantom"],
    RoleTeamTypes: ["Crewmate", "Impostor"],
    SystemTypes: ["Reactor", "Laboratory", "HeliSabotage", "LifeSupp", "Electrical", "Comms", "Doors", "MushroomMixupSabotage"],
    RpcCalls: ["MurderPlayer"],
    MurderResultFlags: ["Succeeded"],
    SendOption: ["Reliable"],
    DeathReason: ["Exile"],
    FloatOptionNames: ["ShapeshifterDuration", "TrackerDelay", "TrackerDuration"]
};

/** Extra classes that are only dumped in the API report (to learn signatures, not checked at startup) */
const EXTRA_DUMP = ["PlayerControl", "DeadBody", "VentilationSystem", "SwitchSystem", "MapBehaviour", "NormalPlayerTask", "PlainDoor", "Vent", "ControllerManager", "InnerNetClient", "VoterState"];

export class Diagnostics {
    static apiText = "";

    /** Checks every class / method / field the mod relies on and writes the result to the debug log */
    static startup(): void {
        DebugLog.info(`Game ${Il2Cpp.application.version}, Unity ${Il2Cpp.unityVersion}, ${Process.arch}`);

        let missing = 0;
        for (const [className, members] of Object.entries(EXPECTED)) {
            const klass = Game.cls(className);
            if (!klass) {
                missing += members.length + 1;
                continue;
            }
            for (const member of members) {
                if (!Diagnostics.hasMember(klass, member)) missing++;
            }
        }
        DebugLog.info(`Compatibility check finished: ${missing} expected members missing (see FAIL lines above)`);
    }

    private static hasMember(klass: Il2Cpp.Class, member: string): boolean {
        let ok: boolean;
        let label: string;

        if (member.includes("/")) {
            const [name, argc] = member.split("/");
            ok = !!klass.tryMethod(name, Number(argc));
            label = `method ${klass.name}.${name}/${argc}`;
        } else {
            ok = !!klass.tryField(member) || !!klass.tryMethod(`get_${member}`, 0);
            label = `member ${klass.name}.${member}`;
        }
        DebugLog.probe(label, ok);
        return ok;
    }

    /** A snapshot of the current match as the mod sees it: proves host / map / player / role reads work */
    static selfTest(): void {
        const read = (label: string, fn: () => string): void => {
            try {
                const value = fn();
                DebugLog.record(`selftest ${label}`, true, value);
                DebugLog.info(`selftest ${label}: ${value}`);
            } catch (e) {
                DebugLog.record(`selftest ${label}`, false, e);
            }
        };

        read("host", () => String(Game.isHost()));
        read("map id", () => String(Game.mapId()));
        read("ship", () => String(Game.isShip()));
        read("meeting", () => String(Game.isMeeting()));
        read("local player", () => {
            const local = Game.localPlayer();
            return local ? `${Game.playerName(local)} (id ${Game.playerId(local)})` : "none";
        });
        read("players", () =>
            Game.players()
                .map(p => {
                    const data = Game.playerData(p);
                    return `${Game.playerName(p)}:${data ? (Game.roleName(data) ?? "?") : "?"}${Game.isDead(p) ? ":dead" : ""}`;
                })
                .join(", ")
        );
        read("role debug", () => {
            const first = Game.players()[0];
            const data = first ? Game.playerData(first) : undefined;
            if (!data) return "no player data";
            const role = Game.get(data, "Role");
            if (Game.isNull(role)) return "Role is null (roles not assigned yet?)";
            return `class=${(role as Il2Cpp.Object).class.name} Role=${String(Game.get(role, "Role"))} Team=${String(Game.get(role, "TeamType"))}`;
        });
        read("fake role choices", () => "see Roles tab");
    }

    private static describeClass(klass: Il2Cpp.Class): string[] {
        const lines: string[] = [`class ${klass.fullName}${klass.parent ? " : " + klass.parent.name : ""}`];
        for (const field of klass.fields) {
            lines.push(`    ${field.isStatic ? "static " : ""}${field.type.name} ${field.name}`);
        }
        for (const method of klass.methods) {
            const params = method.parameters.map(p => `${p.type.name} ${p.name}`).join(", ");
            lines.push(`    ${method.isStatic ? "static " : ""}${method.returnType.name} ${method.name}(${params})`);
        }
        return lines;
    }

    /** Names of Assembly-CSharp classes matching `pattern` (used to find the lobby filter / chat mode code on a real device) */
    private static findRelated(pattern: RegExp): string[] {
        try {
            return Il2Cpp.domain.assembly("Assembly-CSharp").image.classes.filter(k => pattern.test(k.name)).map(k => k.name).slice(0, 80);
        } catch (e) {
            DebugLog.warn(`[Diagnostics] findRelated failed: ${e}`);
            return [];
        }
    }

    /** Writes the signatures of every class the mod touches to a separate file, so hooks can be written against the real game */
    static dumpApi(): string {
        const names = Array.from(new Set([...Object.keys(EXPECTED), ...EXTRA_DUMP, ...Diagnostics.findRelated(/chat|filter|matchmak|gamelist|listing|accountmanager|loginstatus/i)]));
        const lines: string[] = [`# API report, game ${Il2Cpp.application.version}, Unity ${Il2Cpp.unityVersion}`, ""];

        for (const name of names) {
            const klass = Game.cls(name, true);
            if (!klass) {
                lines.push(`class ${name}  -- NOT FOUND`, "");
                continue;
            }
            try {
                lines.push(...Diagnostics.describeClass(klass), "");
            } catch (e) {
                lines.push(`class ${name}  -- error: ${e}`, "");
            }
        }

        Diagnostics.apiText = lines.join("\n");
        Java.perform(() => {
            try {
                const path = JavaUtils.appendLogFile("malummenu_api.txt", Diagnostics.apiText + "\n");
                DebugLog.info(`API report written to ${path} (${Diagnostics.apiText.length} chars)`);
            } catch (e) {
                DebugLog.error(`cannot write API report: ${e}`);
            }
        });
        return Diagnostics.apiText;
    }
}
