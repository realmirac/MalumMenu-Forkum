import { BaseModule } from "../core/BaseModule";
import { Frame, Game } from "../core/Game";
import { State } from "../data/State";
import { UnityUtils } from "../utils/UnityUtils";

/** Client-side vision cheats, ported from MalumMenu (PC): MalumESP, LogicOptionsPatches, PlayerControlPatches */
export class EspModule extends BaseModule {
    public readonly name = "Esp";

    private ghostsTouched = false;
    private controlsTouched = false;

    public init(): void {
        const module = this;

        // PC MalumESP.SeeGhostsCheat: dead players are hidden from living ones; flip their Visible flag
        Frame.on("PlayerPhysics.LateUpdate", "seeGhosts", physics => {
            if (!State.seeGhosts && !module.ghostsTouched) return;

            const player = Game.get(physics, "myPlayer");
            const local = Game.localPlayer();
            if (Game.isNull(player) || !local) return;

            if (Game.isDead(player) && !Game.isDead(local)) {
                Game.set(player, "Visible", State.seeGhosts);
                module.ghostsTouched = true;
            }
        });

        // PC PlayerPhysicsPatches: invertControls makes speed negative for yourself
        Frame.on("PlayerPhysics.LateUpdate", "invertControls", physics => {
            if (!State.invertControls && !module.controlsTouched) return;
            if (!Boolean(Game.get(physics, "AmOwner"))) return;

            const local = Game.localPlayer();
            const body = local ? Game.get(local, "MyPhysics") : undefined;
            if (!body || Game.isNull(body)) return;

            const sign = State.invertControls ? -1 : 1;
            Game.set(body, "Speed", sign * Math.abs(Number(Game.get(body, "Speed"))));
            Game.set(body, "GhostSpeed", sign * Math.abs(Number(Game.get(body, "GhostSpeed"))));
            module.controlsTouched = State.invertControls;
        });

        // PC HudManagerPatches / Utils.IsChatUiActive: keep the chat button available at all times.
        // This fights the game's own logic (which hides the button outside meetings), so unlike the
        // other per-frame writes here it has to keep forcing every frame rather than diff against a cache
        Frame.on("HudManager.Update", "alwaysChat", hud => {
            if (!State.alwaysChat) return;
            const chat = Game.get(hud, "Chat");
            if (Game.isNull(chat)) return;
            Game.call(UnityUtils.getGameObject(chat), "SetActive", 1, true);
        });
    }

    public override initHooks(): void {
        // Show protections (guardian angel shields) while seeGhosts is on
        Game.hook("PlayerControl.TurnOnProtection", "PlayerControl", "TurnOnProtection", -1, (self, call, ...args) => {
            if (State.seeGhosts) args[0] = true;
            return call(...args);
        });

        // Reveal Votes: with anonymous votes off the game shows who voted for whom
        for (const className of ["LogicOptions", "LogicOptionsNormal"]) {
            Game.hook(`${className}.GetAnonymousVotes`, className, "GetAnonymousVotes", 0, (self, call) => {
                const result = call();
                return State.revealVotes ? false : result;
            });
        }

        // Moonwalk: PC skips the walking animation for yourself
        Game.hook("PlayerPhysics.HandleAnimation", "PlayerPhysics", "HandleAnimation", -1, (self, call, ...args) => {
            if (State.moonWalk && Boolean(Game.get(self, "AmOwner"))) {
                Game.call(self, "ResetAnimState", 0);
                return undefined;
            }
            return call(...args);
        });
    }
}
