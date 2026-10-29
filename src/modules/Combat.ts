import { BaseModule } from "../core/BaseModule";
import { Game } from "../core/Game";
import { State } from "../data/State";

/**
 * Impostor / kill related cheats, ported from MalumMenu (PC): RoleBehaviourPatches and PlayerControlPatches
 *
 * Each hook mirrors one Harmony patch. Nothing here talks to the server directly: the game's own
 * target selection and kill button are made more permissive, so the normal (host-validated) kill flow is used.
 */
export class CombatModule extends BaseModule {
    public readonly name = "Combat";

    public init(): void {}

    /** PC Utils.IsValidTarget: with killAnyone only the bare requirements are checked */
    private static isValidTarget(target: any): boolean {
        const local = Game.localPlayer();
        if (!local || Game.isNull(target)) return false;

        const obj = Game.get(target, "Object");
        if (Game.isNull(obj)) return false;
        if (Game.isNull(Game.get(target, "Role"))) return false;

        const basic = !Boolean(Game.get(target, "Disconnected")) && Boolean(Game.get(obj, "Visible")) && Number(Game.get(target, "PlayerId")) !== Game.playerId(local);
        if (State.killAnyone) return basic;

        const role = Game.get(target, "Role");
        return basic && !Boolean(Game.get(target, "IsDead")) && !Boolean(Game.get(obj, "inVent")) && !Boolean(Game.get(obj, "inMovingPlat")) && Boolean(Game.get(role, "CanBeKilled"));
    }

    /** PC Utils.GetPlayersSortedByDistance filtered for valid targets: the closest valid player, ignoring the usual reach */
    private static closestTarget(role: any): any {
        const local = Game.localPlayer();
        if (!local) return undefined;

        const origin = Game.call(local, "GetTruePosition", 0);
        const ox = Number(origin.field("x").value);
        const oy = Number(origin.field("y").value);

        let best: any;
        let bestDistance = Infinity;
        for (const player of Game.players()) {
            const data = Game.playerData(player);
            if (!data) continue;
            if (!Boolean(Game.call(role, "IsValidTarget", 1, data))) continue;
            if (!Boolean(Game.get(Game.get(player, "Collider"), "enabled"))) continue;

            const position = Game.call(player, "GetTruePosition", 0);
            const dx = Number(position.field("x").value) - ox;
            const dy = Number(position.field("y").value) - oy;
            const distance = dx * dx + dy * dy;
            if (distance < bestDistance) {
                bestDistance = distance;
                best = player;
            }
        }
        return best;
    }

    public override initHooks(): void {
        // Kill anyone: ghosts, impostors, players in vents, protected players...
        Game.hook("ImpostorRole.IsValidTarget", "ImpostorRole", "IsValidTarget", 1, (self, call, target) => {
            const result = call(target);
            return State.killAnyone ? CombatModule.isValidTarget(target) : result;
        });

        // Kill while vanished (Phantom)
        Game.hook("PhantomRole.IsValidTarget", "PhantomRole", "IsValidTarget", 1, (self, call, target) => {
            const result = call(target);
            return State.killVanished ? CombatModule.isValidTarget(target) : result;
        });

        // Infinite reach for kill / interrogate / track
        const reach = (label: string, className: string, enabled: () => boolean): void => {
            Game.hook(label, className, "FindClosestTarget", 0, (self, call) => {
                if (!enabled()) return call();
                return CombatModule.closestTarget(self) ?? call();
            });
        };
        reach("ImpostorRole.FindClosestTarget", "ImpostorRole", () => State.killReach);
        reach("DetectiveRole.FindClosestTarget", "DetectiveRole", () => State.interrogateReach);
        reach("TrackerRole.FindClosestTarget", "TrackerRole", () => State.trackReach);

        // No kill cooldown. Only the host's cooldown is trusted by the other players, so PC limits this to host games
        Game.hook("PlayerControl.SetKillTimer", "PlayerControl", "SetKillTimer", 1, (self, call, time) => {
            if (State.noKillCd && Boolean(Game.get(self, "AmOwner")) && Game.isHost()) return call(0);
            return call(time);
        });

        // Shapeshift without the animation
        Game.hook("PlayerControl.CmdCheckShapeshift", "PlayerControl", "CmdCheckShapeshift", 2, (self, call, target, animate) => {
            return call(target, State.noShapeshiftAnim ? false : animate);
        });
        Game.hook("PlayerControl.CmdCheckRevertShapeshift", "PlayerControl", "CmdCheckRevertShapeshift", 1, (self, call, animate) => {
            return call(State.noShapeshiftAnim ? false : animate);
        });
    }
}
