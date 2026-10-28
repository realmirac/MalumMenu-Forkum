import { BaseModule } from "../core/BaseModule";
import { Game } from "../core/Game";
import { State } from "../data/State";

/** Largest float. PC uses float.MaxValue to make timers effectively endless */
const ENDLESS = 3.4e38;

/**
 * Engineer, Scientist, Tracker and Shapeshifter timer cheats, ported from MalumMenu (PC): MalumCheats.Handle*Cheats
 *
 * The values are written after the role's own update runs, and only for the local player's role.
 */
export class RoleTimersModule extends BaseModule {
    public readonly name = "RoleTimers";

    private touched = { engineer: false, shapeshifter: false, scientist: false, tracker: false };

    public init(): void {}

    private static isOwner(role: any): boolean {
        const player = Game.get(role, "Player");
        return !Game.isNull(player) && Boolean(Game.get(player, "AmOwner"));
    }

    /** GameManager.Instance.LogicOptions.GetRoleFloat(FloatOptionNames.<name>) */
    private static roleFloat(optionName: string): number | undefined {
        const manager = Game.instance("GameManager");
        const option = Game.enumVal("FloatOptionNames", optionName);
        if (!manager || option === undefined) return undefined;
        return Number(Game.call(Game.get(manager, "LogicOptions"), "GetRoleFloat", 1, option));
    }

    private static resetAbilityButton(): void {
        const hud = Game.instance("HudManager");
        if (!hud) return;
        const button = Game.get(hud, "AbilityButton");
        Game.call(button, "ResetCoolDown", 0);
        Game.call(button, "SetCooldownFill", 1, 0);
    }

    public override initHooks(): void {
        const module = this;

        Game.hook("EngineerRole.FixedUpdate", "EngineerRole", "FixedUpdate", 0, (self, call) => {
            const result = call();
            if (!RoleTimersModule.isOwner(self)) return result;

            if (State.endlessVentTime) {
                Game.set(self, "inVentTimeRemaining", ENDLESS);
                module.touched.engineer = true;
            } else if (module.touched.engineer) {
                const cooldown = Number(Game.call(self, "GetCooldown", 0));
                if (Number(Game.get(self, "inVentTimeRemaining")) > cooldown) Game.set(self, "inVentTimeRemaining", cooldown);
                module.touched.engineer = false;
            }

            if (State.noVentCooldown && Number(Game.get(self, "cooldownSecondsRemaining")) > 0) {
                Game.set(self, "cooldownSecondsRemaining", 0);
                RoleTimersModule.resetAbilityButton();
            }
            return result;
        });

        Game.hook("ShapeshifterRole.FixedUpdate", "ShapeshifterRole", "FixedUpdate", 0, (self, call) => {
            const result = call();
            if (!RoleTimersModule.isOwner(self)) return result;

            if (State.endlessSsDuration) {
                Game.set(self, "durationSecondsRemaining", ENDLESS);
                module.touched.shapeshifter = true;
            } else if (module.touched.shapeshifter) {
                const normal = RoleTimersModule.roleFloat("ShapeshifterDuration");
                if (normal !== undefined) Game.set(self, "durationSecondsRemaining", normal);
                module.touched.shapeshifter = false;
            }
            return result;
        });

        Game.hook("ScientistRole.Update", "ScientistRole", "Update", 0, (self, call) => {
            const result = call();
            if (!RoleTimersModule.isOwner(self)) return result;

            if (State.noVitalsCooldown) Game.set(self, "currentCooldown", 0);

            if (State.endlessBattery) {
                Game.set(self, "currentCharge", ENDLESS);
                module.touched.scientist = true;
            } else if (module.touched.scientist) {
                Game.set(self, "currentCharge", Number(Game.get(self, "RoleCooldownValue")));
                module.touched.scientist = false;
            }
            return result;
        });

        Game.hook("TrackerRole.FixedUpdate", "TrackerRole", "FixedUpdate", 0, (self, call) => {
            const result = call();
            if (!RoleTimersModule.isOwner(self)) return result;

            if (State.noTrackingCooldown) {
                Game.set(self, "cooldownSecondsRemaining", 0);
                Game.set(self, "delaySecondsRemaining", 0);
                RoleTimersModule.resetAbilityButton();
            }

            if (State.noTrackingDelay) {
                const map = Game.instance("MapBehaviour");
                const delay = RoleTimersModule.roleFloat("TrackerDelay");
                if (map && delay !== undefined) Game.set(map, "trackedPointDelayTime", delay);
            }

            if (State.endlessTracking) {
                Game.set(self, "durationSecondsRemaining", ENDLESS);
                module.touched.tracker = true;
            } else if (module.touched.tracker) {
                const normal = RoleTimersModule.roleFloat("TrackerDuration");
                if (normal !== undefined) Game.set(self, "durationSecondsRemaining", normal);
                module.touched.tracker = false;
            }
            return result;
        });
    }
}
