import { AssemblyHelper } from "../core/AssemblyHelper";
import { BaseModule } from "../core/BaseModule";
import { State } from "../data/State";
import { Logger } from "../logger/Logger";

/**
 * Role cheats ported from MalumMenu (PC)
 *
 * PC source -> mobile:
 * - MalumCheats.HandleEngineerCheats / HandleShapeshifterCheats / HandleScientistCheats / HandleTrackerCheats
 *   (Harmony postfixes on `<Role>.FixedUpdate` / `ScientistRole.Update`)
 * - PlayerControl.SetKillTimer, CmdCheckShapeshift, CmdCheckRevertShapeshift (Harmony prefixes)
 * - ImpostorRole.IsValidTarget (Kill Anyone) and ImpostorRole.FindClosestTarget (Kill Reach)
 *
 * A Harmony postfix becomes "call the original, then run our code"; a prefix that changes an argument
 * becomes "call the original with the changed argument"
 */
export class RoleCheatsModule extends BaseModule {
    public readonly name = "RoleCheats";

    /** float.MaxValue. Anything above {@link HUGE_THRESHOLD} was written by us and has to be reset when the cheat is turned off */
    private static readonly HUGE = 3.4028234663852886e38;
    private static readonly HUGE_THRESHOLD = 1e30;

    private static reported = new Set<string>();

    private static PlayerControl: Il2Cpp.Class;
    private static HudManager: Il2Cpp.Class;
    private static AmongUsClient: Il2Cpp.Class;
    private static GameData: Il2Cpp.Class;

    public init(): void {
        RoleCheatsModule.PlayerControl = AssemblyHelper.findClass("PlayerControl")!;
        RoleCheatsModule.HudManager = AssemblyHelper.findClass("HudManager")!;
        RoleCheatsModule.AmongUsClient = AssemblyHelper.findClass("AmongUsClient")!;
        RoleCheatsModule.GameData = AssemblyHelper.findClass("GameData")!;
    }

    public override initHooks(): void {
        // Engineer
        this.hookRole("EngineerRole", "FixedUpdate", 0, role => {
            const inVent = role.field<number>("inVentTimeRemaining");
            if (State.endlessVentTime) {
                inVent.value = RoleCheatsModule.HUGE;
            } else if (inVent.value > RoleCheatsModule.HUGE_THRESHOLD) {
                // Cheat was just turned off: back to the normal vent time
                inVent.value = role.method<number>("GetCooldown").invoke();
            }

            if (State.noVentCooldown && role.field<number>("cooldownSecondsRemaining").value > 0) {
                role.field<number>("cooldownSecondsRemaining").value = 0;
                RoleCheatsModule.resetAbilityButton();
            }
        });

        // Shapeshifter
        this.hookRole("ShapeshifterRole", "FixedUpdate", 0, role => {
            const duration = role.field<number>("durationSecondsRemaining");
            if (State.endlessSsDuration) {
                duration.value = RoleCheatsModule.HUGE;
            } else if (duration.value > RoleCheatsModule.HUGE_THRESHOLD) {
                // Ending the timer makes the game revert the shapeshift on its own
                duration.value = 0;
            }
        });

        // Scientist
        this.hookRole("ScientistRole", "Update", 0, role => {
            if (State.noVitalsCooldown) {
                role.field<number>("currentCooldown").value = 0;
            }

            const charge = role.field<number>("currentCharge");
            if (State.endlessBattery) {
                charge.value = RoleCheatsModule.HUGE;
            } else if (charge.value > RoleCheatsModule.HUGE_THRESHOLD) {
                charge.value = role.field<number>("RoleCooldownValue").value;
            }
        });

        // Tracker
        this.hookRole("TrackerRole", "FixedUpdate", 0, role => {
            if (State.noTrackingCooldown) {
                role.field<number>("cooldownSecondsRemaining").value = 0;
                role.field<number>("delaySecondsRemaining").value = 0;
                RoleCheatsModule.resetAbilityButton();
            }

            const duration = role.field<number>("durationSecondsRemaining");
            if (State.endlessTracking) {
                duration.value = RoleCheatsModule.HUGE;
            } else if (duration.value > RoleCheatsModule.HUGE_THRESHOLD) {
                duration.value = 0;
            }
        });

        this.hookKillCooldown();
        this.hookShapeshiftAnimation();
        this.hookKillAnyone();
        this.hookKillReach();
    }

    /**
     * Hooks a role method so that our code runs after the original, only for the role of the local player
     *
     * Skips the hook if the method is only inherited: hooking the base class would run it for every role
     */
    private hookRole(className: string, methodName: string, paramCount: number, handler: (role: Il2Cpp.Object) => void): void {
        const method = this.findOwnMethod(className, methodName, paramCount);
        if (!method) return;

        const tag = `${className}.${methodName}`;

        // @ts-ignore
        method.implementation = function (...args: any[]): any {
            const self = this as Il2Cpp.Object;
            const result = self.method(methodName, paramCount).invoke(...args);

            try {
                const player = self.field<Il2Cpp.Object>("Player").value;
                if (!player.isNull() && player.method<boolean>("get_AmOwner").invoke()) {
                    handler(self);
                }
            } catch (e) {
                RoleCheatsModule.reportOnce(tag, e);
            }

            return result;
        };
    }

    /** `PlayerControl::SetKillTimer`. No Kill Cooldown (host only, like PC: for clients the host enforces the cooldown) */
    private hookKillCooldown(): void {
        const method = this.findOwnMethod("PlayerControl", "SetKillTimer", 1);
        if (!method) return;

        // @ts-ignore
        method.implementation = function (time: number): any {
            const self = this as Il2Cpp.Object;
            let newTime = time;

            try {
                if (State.noKillCd && self.method<boolean>("get_AmOwner").invoke() && RoleCheatsModule.isHost()) {
                    newTime = 0;
                }
            } catch (e) {
                RoleCheatsModule.reportOnce("SetKillTimer", e);
            }

            return self.method("SetKillTimer", 1).invoke(newTime);
        };
    }

    /** `PlayerControl::CmdCheckShapeshift(target, shouldAnimate)` and `CmdCheckRevertShapeshift(shouldAnimate)` */
    private hookShapeshiftAnimation(): void {
        const shift = this.findOwnMethod("PlayerControl", "CmdCheckShapeshift", 2);
        if (shift) {
            // @ts-ignore
            shift.implementation = function (target: Il2Cpp.Object, shouldAnimate: boolean): any {
                const self = this as Il2Cpp.Object;
                return self.method("CmdCheckShapeshift", 2).invoke(target, State.noShapeshiftAnim ? false : shouldAnimate);
            };
        }

        const revert = this.findOwnMethod("PlayerControl", "CmdCheckRevertShapeshift", 1);
        if (revert) {
            // @ts-ignore
            revert.implementation = function (shouldAnimate: boolean): any {
                const self = this as Il2Cpp.Object;
                return self.method("CmdCheckRevertShapeshift", 1).invoke(State.noShapeshiftAnim ? false : shouldAnimate);
            };
        }
    }

    /**
     * `ImpostorRole::IsValidTarget(NetworkedPlayerInfo)`
     *
     * Kill Anyone: protected players, impostors, players in vents and ghosts all become valid. Same checks as the
     * `killAnyoneRequirements` in PC Utils.IsValidTarget
     */
    private hookKillAnyone(): void {
        const method = this.findOwnMethod("ImpostorRole", "IsValidTarget", 1);
        if (!method) return;

        // @ts-ignore
        method.implementation = function (target: Il2Cpp.Object): any {
            const self = this as Il2Cpp.Object;
            const original = self.method<boolean>("IsValidTarget", 1).invoke(target);
            if (!State.killAnyone) return original;

            try {
                return RoleCheatsModule.isLivingOrDeadTarget(target);
            } catch (e) {
                RoleCheatsModule.reportOnce("IsValidTarget", e);
                return original;
            }
        };
    }

    /** `ImpostorRole::FindClosestTarget()`. Kill Reach: the closest valid player on the whole map instead of the one in range */
    private hookKillReach(): void {
        const method = this.findOwnMethod("ImpostorRole", "FindClosestTarget", 0);
        if (!method) return;

        // @ts-ignore
        method.implementation = function (): any {
            const self = this as Il2Cpp.Object;
            if (!State.killReach) return self.method<Il2Cpp.Object>("FindClosestTarget").invoke();

            try {
                const closest = RoleCheatsModule.findClosestValidPlayer(self);
                if (closest) return closest;
            } catch (e) {
                RoleCheatsModule.reportOnce("FindClosestTarget", e);
            }

            return self.method<Il2Cpp.Object>("FindClosestTarget").invoke();
        };
    }

    /** Port of the `killAnyoneRequirements` check in PC Utils.IsValidTarget */
    private static isLivingOrDeadTarget(target: Il2Cpp.Object): boolean {
        if (target.isNull()) return false;
        if (target.field<boolean>("Disconnected").value) return false;

        const player = target.method<Il2Cpp.Object>("get_Object").invoke();
        if (player.isNull()) return false;
        if (!player.method<boolean>("get_Visible").invoke()) return false;

        const local = RoleCheatsModule.PlayerControl.field<Il2Cpp.Object>("LocalPlayer").value;
        if (local.isNull()) return false;
        if (RoleCheatsModule.readNumber(player, "PlayerId") === RoleCheatsModule.readNumber(local, "PlayerId")) return false;

        return !target.field<Il2Cpp.Object>("Role").value.isNull();
    }

    /** Port of PC ImpostorRole_FindClosestTarget: GetPlayersSortedByDistance()[0] filtered by IsValidTarget and an enabled collider */
    private static findClosestValidPlayer(role: Il2Cpp.Object): Il2Cpp.Object | undefined {
        const local = RoleCheatsModule.PlayerControl.field<Il2Cpp.Object>("LocalPlayer").value;
        const gameData = RoleCheatsModule.GameData.field<Il2Cpp.Object>("Instance").value;
        if (local.isNull() || gameData.isNull()) return undefined;

        const origin = local.method<Il2Cpp.ValueType>("GetTruePosition").invoke();
        const ox = origin.field<number>("x").value;
        const oy = origin.field<number>("y").value;

        // System.Collections.Generic.List<NetworkedPlayerInfo>
        const players = gameData.field<Il2Cpp.Object>("AllPlayers").value;
        const count = players.method<number>("get_Count").invoke();

        let best: Il2Cpp.Object | undefined;
        let bestDistance = Number.POSITIVE_INFINITY;

        for (let i = 0; i < count; i++) {
            const info = players.method<Il2Cpp.Object>("get_Item").invoke(i);
            if (info.isNull()) continue;

            const player = info.method<Il2Cpp.Object>("get_Object").invoke();
            if (player.isNull()) continue;
            if (!role.method<boolean>("IsValidTarget", 1).invoke(info)) continue;

            const collider = player.field<Il2Cpp.Object>("Collider").value;
            if (!collider.method<boolean>("get_enabled").invoke()) continue;

            const position = player.method<Il2Cpp.ValueType>("GetTruePosition").invoke();
            const dx = position.field<number>("x").value - ox;
            const dy = position.field<number>("y").value - oy;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < bestDistance) {
                bestDistance = distance;
                best = player;
            }
        }

        return best;
    }

    /** `HudManager.Instance.AbilityButton.ResetCoolDown()` + `SetCooldownFill(0)`, so the button does not keep showing the old cooldown */
    private static resetAbilityButton(): void {
        const hud = RoleCheatsModule.HudManager.method<Il2Cpp.Object>("get_Instance").invoke();
        if (hud.isNull()) return;

        const button = hud.field<Il2Cpp.Object>("AbilityButton").value;
        if (button.isNull()) return;

        button.method<void>("ResetCoolDown").invoke();
        button.method<void>("SetCooldownFill").invoke(0);
    }

    /** `AmongUsClient.Instance.AmHost` */
    private static isHost(): boolean {
        const client = RoleCheatsModule.AmongUsClient.method<Il2Cpp.Object>("get_Instance").invoke();
        if (client.isNull()) return false;
        return client.method<boolean>("get_AmHost").invoke();
    }

    /** Reads a numeric member that is a field in some game versions and a property in others */
    private static readNumber(object: Il2Cpp.Object, name: string): number {
        const field = object.tryField<number>(name);
        if (field) return Number(field.value);
        return Number(object.method<number>(`get_${name}`).invoke());
    }

    /** Finds a method that is declared by the class itself and not only inherited */
    private findOwnMethod(className: string, methodName: string, paramCount: number): Il2Cpp.Method | undefined {
        const klass = AssemblyHelper.findClass(className);
        if (!klass) return undefined;

        const method = klass.tryMethod(methodName, paramCount);
        if (!method) {
            Logger.warn(`[${this.name}] ${className}.${methodName}(${paramCount}) not found, skipping`);
            return undefined;
        }

        if (method.class.name !== klass.name) {
            Logger.warn(`[${this.name}] ${className}.${methodName} is inherited from ${method.class.name}, skipping`);
            return undefined;
        }

        return method;
    }

    /** Hooks run every frame, so an error is shown once per feature instead of spamming toasts */
    private static reportOnce(key: string, error: unknown): void {
        if (RoleCheatsModule.reported.has(key)) return;
        RoleCheatsModule.reported.add(key);
        Logger.toast(`${key} failed: ${error}`);
    }
}
