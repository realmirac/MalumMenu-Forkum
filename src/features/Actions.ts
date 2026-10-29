import { Game } from "../core/Game";
import { State } from "../data/State";
import { DebugLog } from "../logger/DebugLog";
import { Logger } from "../logger/Logger";
import { UnityUtils } from "../utils/UnityUtils";
import { Target } from "./Target";
import { Step, Throttle } from "./Throttle";

/**
 * One-shot cheats (buttons), ported from MalumMenu (PC): MalumCheats, MalumPPMCheats, MalumSabotageCheats, DoorsHandler, Utils
 *
 * Every action goes through {@link Actions.run}: it records OK / FAIL in the debug log and shows a short on-screen message,
 * so a phone user can see right away whether something worked and why not.
 */
export class Actions {
    /** Runs `fn`, logs the result and reports a failure on screen. `fn` may return a short success message */
    static run(label: string, fn: () => string | void): void {
        try {
            const message = fn();
            DebugLog.record(label, true, message ?? undefined);
            if (message) Logger.toast(`${label}: ${message}`);
        } catch (e: any) {
            DebugLog.record(label, false, e);
            Logger.toast(`${label} failed: ${e?.message ?? e}`);
        }
    }

    private static requireLocal(): Il2Cpp.Object {
        const local = Game.localPlayer();
        if (!local) throw new Error("no local player (join a game first)");
        return local;
    }

    private static requireShip(): Il2Cpp.Object {
        const ship = Game.instance("ShipStatus");
        if (!ship) throw new Error("no ship (start a match first)");
        return ship;
    }

    private static requireClient(): Il2Cpp.Object {
        const client = Game.instance("AmongUsClient");
        if (!client) throw new Error("AmongUsClient missing");
        return client;
    }

    // ------------------------------------------------------------------ killing

    /**
     * PC Utils.MurderPlayer: sends the final MurderPlayer RPC straight to every client, so the game doesn't run its
     * own "may this player kill?" checks. Falls back to PlayerControl.RpcMurderPlayer if the raw route is unavailable.
     */
    static murder(target: Il2Cpp.Object): string {
        const local = this.requireLocal();
        const client = this.requireClient();

        const succeeded = Game.enumVal("MurderResultFlags", "Succeeded");
        const rpcCall = Game.enumVal("RpcCalls", "MurderPlayer");
        const reliable = Game.enumVal("SendOption", "Reliable");

        try {
            if (succeeded === undefined || rpcCall === undefined || reliable === undefined) throw new Error("enum values missing");

            const netId = Game.get(local, "NetId");
            for (const player of Game.players()) {
                const clientId = Game.call(client, "GetClientIdFromCharacter", 1, player);
                const writer = Game.call(client, "StartRpcImmediately", 4, netId, rpcCall, reliable, clientId);

                Game.call(writer, "WriteNetObject", 1, target);
                const writeInt = Game.overload(writer, "Write", ["System.Int32"]);
                if (!writeInt) throw new Error("MessageWriter.Write(int) missing");
                writeInt.invoke(succeeded);

                Game.call(client, "FinishRpcImmediately", 1, writer);
            }
            return "raw RPC";
        } catch (rawError) {
            DebugLog.record("murder (raw RPC)", false, rawError);
            Game.call(local, "RpcMurderPlayer", 2, target, true);
            return "RpcMurderPlayer";
        }
    }

    private static killMatching(label: string, filter: (p: Il2Cpp.Object) => boolean): void {
        this.run(label, () => {
            if (!Game.isShip()) throw new Error("killing outside a match is disabled (too buggy)");
            const local = this.requireLocal();
            let count = 0;
            for (const player of Game.players()) {
                if (Game.isNull(player) || Game.playerId(player) === Game.playerId(local)) continue;
                if (!filter(player)) continue;
                this.murder(player);
                count++;
            }
            return `${count} players`;
        });
    }

    static killAll(): void {
        this.killMatching("Kill All", () => true);
    }

    static killCrew(): void {
        this.killMatching("Kill Crewmates", p => {
            const data = Game.playerData(p);
            return data !== undefined && Game.teamName(data) === "Crewmate";
        });
    }

    static killImpostors(): void {
        this.killMatching("Kill Impostors", p => {
            const data = Game.playerData(p);
            return data !== undefined && Game.teamName(data) === "Impostor";
        });
    }

    static killTarget(): void {
        this.run("Kill Target", () => {
            if (!Game.isShip()) throw new Error("killing outside a match is disabled (too buggy)");
            const target = Target.require();
            return `${Game.playerName(target)} via ${this.murder(target)}`;
        });
    }

    /** Kill the target from anywhere, then snap back to where you were */
    static telekillTarget(): void {
        this.run("Telekill Target", () => {
            if (!Game.isShip()) throw new Error("killing outside a match is disabled (too buggy)");
            const local = this.requireLocal();
            const target = Target.require();

            const oldPosition = Game.call(local, "GetTruePosition", 0);
            const way = this.murder(target);
            setTimeout(() => {
                UnityUtils.run(() => {
                    this.run("Telekill snap back", () => {
                        Game.call(Game.get(this.requireLocal(), "NetTransform"), "RpcSnapTo", 1, oldPosition);
                    });
                })();
            }, 250);
            return `${Game.playerName(target)} via ${way}`;
        });
    }

    // ------------------------------------------------------------------ movement / camera

    static teleportToTarget(): void {
        this.run("Teleport to Target", () => {
            const local = this.requireLocal();
            const target = Target.require();
            const position = Game.call(target, "GetTruePosition", 0);
            Game.call(Game.get(local, "NetTransform"), "RpcSnapTo", 1, position);
            return Game.playerName(target);
        });
    }

    /** Try to snap every other player onto you. Only works where the server lets non-owners snap (host/lenient lobbies) */
    static teleportAllToMe(): void {
        this.run("Teleport All To Me", () => {
            const local = this.requireLocal();
            const position = Game.call(local, "GetTruePosition", 0);
            const others = Game.players().filter(p => !Game.isNull(p) && !p.handle.equals(local.handle));
            if (others.length === 0) throw new Error("no other players");
            const steps: Step[] = others.map(p => ({
                name: Game.playerName(p),
                run: () => { Game.call(Game.get(p, "NetTransform"), "RpcSnapTo", 1, position); },
            }));
            Throttle.sequence("Teleport All To Me", steps, 150, this.report("Teleport All To Me", steps.length));
            return `${steps.length} players queued`;
        });
    }

    private static mainCamera(): Il2Cpp.Object {
        const camera = Game.get(Game.need("Camera"), "main");
        if (Game.isNull(camera)) throw new Error("Camera.main is null");
        return camera;
    }

    private static followerCamera(): Il2Cpp.Object {
        const camera = this.mainCamera();
        const follower = UnityUtils.getComponentFromObject(camera, Game.need("FollowerCamera"));
        if (!follower) throw new Error("FollowerCamera missing");
        return follower;
    }

    /** Camera zoom. PC uses the scroll wheel, on a phone it's buttons. delta > 0 zooms out, 0 resets */
    static zoom(delta: number): void {
        this.run("Zoom", () => {
            const camera = this.mainCamera();
            const hud = Game.instance("HudManager");
            const current = Number(Game.get(camera, "orthographicSize"));
            const next = delta === 0 ? 3 : Math.max(3, current + delta);

            State.customFov = next > 3;
            State.fov = next;
            Game.set(camera, "orthographicSize", next);
            if (hud) {
                const uiCamera = Game.get(hud, "UICamera");
                if (!Game.isNull(uiCamera)) Game.set(uiCamera, "orthographicSize", next);
            }

            // PC calls Utils.AdjustResolution so the game's UI follows the new camera size
            try {
                const screen = Game.need("Screen");
                const changed = Game.get(Game.need("ResolutionManager"), "ResolutionChanged");
                Game.call(changed, "Invoke", 4, Number(Game.get(screen, "width")) / Number(Game.get(screen, "height")), Game.get(screen, "width"), Game.get(screen, "height"), Game.get(screen, "fullScreen"));
            } catch (e) {
                DebugLog.record("Zoom (resolution sync)", false, e);
            }
            return `size ${next}`;
        });
    }

    private static spectating = false;

    static spectateTarget(): void {
        this.run("Spectate Target", () => {
            const local = this.requireLocal();
            const target = Target.require();
            Game.call(this.followerCamera(), "SetTarget", 1, target);
            Game.set(local, "moveable", false); // can't move while spectating
            this.spectating = true;
            return Game.playerName(target);
        });
    }

    static stopSpectating(): void {
        this.run("Stop Spectating", () => {
            const local = this.requireLocal();
            Game.call(this.followerCamera(), "SetTarget", 1, local);
            Game.set(local, "moveable", true);
            this.spectating = false;
            return "camera back on you";
        });
    }

    // ------------------------------------------------------------------ roles

    private static oldRole: string | undefined;

    static clearFakeRoleCache(): void {
        this.oldRole = undefined;
    }

    private static readonly impostorRoles = ["Impostor", "Shapeshifter", "Phantom", "Viper"];

    /** Role names a living player may switch to, following PC's anticheat-safe rules */
    static fakeRoleChoices(): string[] {
        const all = Game.enumNames("RoleTypes").filter(n => !n.includes("Ghost") && n !== "GuardianAngel" && n !== "SpiritGuide");
        const old = this.oldRole;
        const host = Game.isHost();
        return all.filter(name => {
            // Special impostor roles only if you were assigned them, otherwise the anticheat kicks you
            if (["Shapeshifter", "Phantom", "Viper", "Judge"].includes(name)) return old === name;
            if (name === "Impostor") return host || (old !== undefined && this.impostorRoles.includes(old));
            return true;
        });
    }

    /** PC SetFakeRolePPM: RoleManager.SetRole on yourself (the server's real assignment doesn't change) */
    static setFakeRole(roleName: string): void {
        this.run(`Fake Role ${roleName}`, () => {
            const local = this.requireLocal();
            const data = Game.playerData(local);
            if (data && this.oldRole === undefined) this.oldRole = Game.roleName(data);

            if (!this.fakeRoleChoices().includes(roleName)) {
                throw new Error(`${roleName} is blocked for you (kick risk). Allowed: ${this.fakeRoleChoices().join(", ")}`);
            }

            const roleType = Game.enumVal("RoleTypes", roleName);
            const manager = Game.instance("RoleManager");
            if (roleType === undefined || !manager) throw new Error("RoleManager / RoleTypes missing");
            Game.call(manager, "SetRole", 2, local, roleType);
            return "set locally";
        });
    }

    static fakeDie(): void {
        this.run("Fake Death", () => {
            const local = this.requireLocal();
            const reason = Game.enumVal("DeathReason", "Exile");
            if (reason === undefined) throw new Error("DeathReason.Exile missing");
            Game.call(local, "Die", 2, reason, true);
        });
    }

    static revive(): void {
        this.run("Revive", () => {
            Game.call(this.requireLocal(), "Revive", 0);
        });
    }

    static completeMyTasks(): void {
        this.run("Complete My Tasks", () => {
            const local = this.requireLocal();
            const tasks = Game.list(Game.get(local, "myTasks"));
            for (const task of tasks) {
                Game.call(local, "RpcCompleteTask", 1, Game.call(task, "get_Id", 0));
            }
            return `${tasks.length} tasks`;
        });
    }

    // ------------------------------------------------------------------ ship: sabotage

    private static rpcSystem(system: string, amount: number): void {
        const ship = this.requireShip();
        const type = Game.enumVal("SystemTypes", system);
        if (type === undefined) throw new Error(`SystemTypes.${system} missing`);
        Game.call(ship, "RpcUpdateSystem", -1, type, amount);
    }

    private static reactorSystem(): string {
        const map = Game.mapId();
        return map === 2 ? "Laboratory" : map === 4 ? "HeliSabotage" : "Reactor";
    }

    static sabotage(kind: "reactor" | "oxygen" | "comms" | "lights" | "mushroom", on: boolean): void {
        this.run(`${on ? "Sabotage" : "Repair"} ${kind}`, () => {
            const map = Game.mapId();
            switch (kind) {
                case "reactor": {
                    const system = this.reactorSystem();
                    if (on) this.rpcSystem(system, 128);
                    else if (system === "HeliSabotage") {
                        this.rpcSystem(system, 16 | 0);
                        this.rpcSystem(system, 16 | 1);
                    } else this.rpcSystem(system, 16);
                    break;
                }
                case "oxygen":
                    if (map === 2 || map === 4 || map === 5) throw new Error("this map has no oxygen system");
                    this.rpcSystem("LifeSupp", on ? 128 : 16);
                    break;
                case "comms":
                    if (on) this.rpcSystem("Comms", 128);
                    else if (map === 1 || map === 5) {
                        this.rpcSystem("Comms", 16 | 0);
                        this.rpcSystem("Comms", 16 | 1);
                    } else this.rpcSystem("Comms", 16);
                    break;
                case "lights":
                    if (map === 5) throw new Error("Fungle has no lights");
                    if (on) {
                        let switches = 4;
                        for (let i = 0; i < 5; i++) if (Math.random() < 0.5) switches |= 1 << i;
                        this.rpcSystem("Electrical", switches | 128);
                    } else this.repairLights();
                    break;
                case "mushroom":
                    if (map !== 5) throw new Error("mushrooms only exist on Fungle");
                    this.rpcSystem("MushroomMixupSabotage", 1);
                    break;
            }
            return `map ${map}`;
        });
    }

    /** PC HandleElectrical (repair): flip every switch whose actual position differs from the expected one */
    private static repairLights(): void {
        const ship = this.requireShip();
        const type = Game.enumVal("SystemTypes", "Electrical");
        if (type === undefined) throw new Error("SystemTypes.Electrical missing");

        const systems = Game.get(ship, "Systems");
        const system = Game.call(systems, "get_Item", 1, type);
        const actual = Number(Game.get(system, "ActualSwitches"));
        const expected = Number(Game.get(system, "ExpectedSwitches"));

        for (let i = 0; i < 5; i++) {
            const mask = 1 << i;
            if ((actual & mask) !== (expected & mask)) this.rpcSystem("Electrical", i);
        }
    }

    /** PC HandleUnfixLights: this odd amount breaks the lights so they can't be fixed by hand. Sending it again repairs */
    static toggleUnfixableLights(): void {
        this.run("Unfixable Lights", () => {
            if (Game.mapId() === 5) throw new Error("Fungle has no lights");
            this.rpcSystem("Electrical", 69);
        });
    }

    /** Reports the result of a queued sequence once it is done */
    private static report(label: string, queued: number): (ok: number, failed: number) => void {
        return (ok, failed) => Logger.toast(`${label}: ${ok}/${queued} sent${failed > 0 ? `, ${failed} failed (see the debug log)` : ""}`);
    }

    /** Close-door steps, one per room that has doors */
    private static closeDoorSteps(): Step[] {
        const ship = this.requireShip();
        const rooms = new Set<number>();
        for (const door of this.doors()) rooms.add(Number(Game.get(door, "Room")));
        return Array.from(rooms).map(room => ({ name: `close room ${room}`, run: () => Game.call(ship, "RpcCloseDoorsOfType", 1, room) }));
    }

    /** Every sabotage the map supports, then all doors. The RPCs are queued 350 ms apart so the server doesn't drop them */
    static sabotageAll(): void {
        this.run("Sabotage All", () => {
            const map = Game.mapId();
            const steps: Step[] = [];
            // Only one critical sabotage (reactor/O2) can run at once, so O2 is skipped; non-critical ones go first
            const kinds: Array<"reactor" | "oxygen" | "comms" | "lights" | "mushroom"> = ["comms", "lights", "mushroom", "reactor"];
            for (const kind of kinds) {
                if (kind === "oxygen" && (map === 2 || map === 4 || map === 5)) continue;
                if (kind === "lights" && map === 5) continue;
                if (kind === "mushroom" && map !== 5) continue;
                steps.push({ name: kind, run: () => this.sabotageQuiet(kind) });
            }
            steps.push(...this.closeDoorSteps());

            if (steps.length === 0) throw new Error("nothing to sabotage on this map");
            Throttle.sequence("Sabotage All", steps, 350, this.report("Sabotage All", steps.length));
            return `map ${map}: ${steps.length} steps queued`;
        });
    }

    private static sabotageQuiet(kind: "reactor" | "oxygen" | "comms" | "lights" | "mushroom"): void {
        switch (kind) {
            case "reactor":
                return this.rpcSystem(this.reactorSystem(), 128);
            case "oxygen":
                return this.rpcSystem("LifeSupp", 128);
            case "comms":
                return this.rpcSystem("Comms", 128);
            case "lights": {
                let switches = 4;
                for (let i = 0; i < 5; i++) if (Math.random() < 0.5) switches |= 1 << i;
                return this.rpcSystem("Electrical", switches | 128);
            }
            case "mushroom":
                return this.rpcSystem("MushroomMixupSabotage", 1);
        }
    }

    static repairAll(): void {
        this.run("Repair All", () => {
            const map = Game.mapId();
            const steps: Step[] = [];
            const system = this.reactorSystem();

            steps.push({
                name: "reactor",
                run: () => {
                    this.rpcSystem(system, 16);
                    if (system === "HeliSabotage") this.rpcSystem(system, 17);
                }
            });
            if (map !== 2 && map !== 4 && map !== 5) steps.push({ name: "oxygen", run: () => this.rpcSystem("LifeSupp", 16) });
            steps.push({
                name: "comms",
                run: () => {
                    this.rpcSystem("Comms", 16);
                    if (map === 1 || map === 5) this.rpcSystem("Comms", 17);
                }
            });
            if (map !== 5) steps.push({ name: "lights", run: () => this.repairLights() });

            Throttle.sequence("Repair All", steps, 350, this.report("Repair All", steps.length));
            return `${steps.length} steps queued`;
        });
    }

    // ------------------------------------------------------------------ ship: doors

    private static doors(): Il2Cpp.Object[] {
        return Game.list(Game.get(this.requireShip(), "AllDoors"));
    }

    static closeAllDoors(): void {
        this.run("Close All Doors", () => {
            const steps = this.closeDoorSteps();
            if (steps.length === 0) return "this map has no doors";
            Throttle.sequence("Close All Doors", steps, 250, this.report("Close All Doors", steps.length));
            return `${steps.length} rooms queued`;
        });
    }

    /** PC DoorsHandler.OpenDoor: Doors system, door id | 64 */
    static openAllDoors(): void {
        this.run("Open All Doors", () => {
            const steps: Step[] = this.doors().map(door => {
                const id = Number(Game.get(door, "Id"));
                return { name: `open door ${id}`, run: () => this.rpcSystem("Doors", id | 64) };
            });
            if (steps.length === 0) return "this map has no doors";
            Throttle.sequence("Open All Doors", steps, 250, this.report("Open All Doors", steps.length));
            return `${steps.length} doors queued`;
        });
    }

    // ------------------------------------------------------------------ ship: meetings

    static callMeeting(): void {
        this.run("Call Meeting", () => {
            const local = this.requireLocal();
            if (Game.isHost()) {
                // Same as PlayerControl.ReportDeadBody but without the additional checks
                Game.call(Game.instance("MeetingRoomManager"), "AssignSelf", 2, local, NULL);
                Game.call(Game.instance("HudManager"), "OpenMeetingRoom", 1, local);
                Game.call(local, "RpcStartMeeting", 1, NULL);
                return "as host";
            }
            Game.call(local, "CmdReportDeadBody", 1, NULL);
            return "report request";
        });
    }

    /** Reports the target as if you found their body */
    static reportTarget(): void {
        this.run("Report Target", () => {
            const local = this.requireLocal();
            const target = Target.require();
            Game.call(local, "CmdReportDeadBody", 1, Game.playerData(target) ?? NULL);
            return Game.playerName(target);
        });
    }

    /** RpcVotingComplete(states, exiled, tie, ...) with the arguments PC uses: no votes, optional exiled player */
    private static votingComplete(exiled: Il2Cpp.Object | undefined, tie: boolean): void {
        const meeting = Game.instance("MeetingHud");
        if (!meeting) throw new Error("no meeting is open");

        const method = meeting.tryMethod("RpcVotingComplete", -1);
        if (!method) throw new Error("MeetingHud.RpcVotingComplete missing");

        let usedTie = false;
        const args = method.parameters.map(p => {
            const typeName = p.type.name;
            if (typeName.endsWith("[]")) return Il2Cpp.array(Game.need("VoterState"), 0);
            if (typeName === "System.Boolean") {
                if (!usedTie) {
                    usedTie = true;
                    return tie;
                }
                return false;
            }
            if (typeName.startsWith("System.")) return 0;
            return exiled ?? NULL;
        });
        method.invoke(...(args as any[]));
    }

    static skipMeeting(): void {
        this.run("Skip Meeting", () => this.votingComplete(undefined, true));
    }

    static ejectTarget(): void {
        this.run("Eject Target", () => {
            const target = Target.require();
            this.votingComplete(Game.playerData(target), false);
            return Game.playerName(target);
        });
    }

    /** PC CloseMeetingCheat: removes the meeting window only for you so you can keep playing */
    static closeMeeting(): void {
        this.run("Close Meeting", () => {
            const meeting = Game.instance("MeetingHud");
            if (!meeting) throw new Error("no meeting is open");

            Game.set(meeting, "DespawnOnDestroy", false);
            Game.call(Game.need("Object"), "Destroy", 1, UnityUtils.getGameObject(meeting));

            const hud = Game.instance("HudManager");
            const local = this.requireLocal();
            const steps: Array<[string, () => void]> = [
                ["fade", () => Game.call(hud, "StartCoroutine", -1, Game.call(hud, "CoFadeFullScreen", 4, UnityUtils.createColor(0, 0, 0, 1), UnityUtils.createColor(0, 0, 0, 0), 0.2, false))],
                ["unlock camera", () => Game.set(this.followerCamera(), "Locked", false)],
                ["map buttons", () => Game.call(hud, "SetMapAndInfoButtonsEnabled", 1, true)],
                ["hud", () => Game.call(hud, "SetHudActive", 1, true)],
                ["controllers", () => Game.call(Game.instance("ControllerManager"), "CloseAndResetAll", 0)],
                ["movement", () => Game.set(local, "moveable", true)]
            ];
            for (const [name, step] of steps) {
                try {
                    step();
                } catch (e) {
                    DebugLog.record(`Close Meeting: ${name}`, false, e);
                }
            }
        });
    }

    static forceStartGame(): void {
        this.run("Force Start Game", () => {
            if (!Game.isHost()) throw new Error("only the host can start the game");
            Game.call(this.requireClient(), "SendStartGame", 0);
        });
    }
}
