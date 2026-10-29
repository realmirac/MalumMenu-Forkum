import { Game } from "../core/Game";
import { Logger } from "../logger/Logger";
import { JavaUtils } from "../utils/JavaUtils";
import { UnityUtils } from "../utils/UnityUtils";

/**
 * Player picking for a phone: the PC mod opens a player-pick menu, the Android menu is built once at startup,
 * so instead you cycle through the players with "Next Target" and the actions use the selected one.
 */
export class Target {
    private static selectedId: number | undefined;

    /** Moves the selection to the next player and shows who it is */
    static next(): void {
        const players = Game.players().filter(p => {
            const data = Game.playerData(p);
            return data !== undefined && !Boolean(Game.get(data, "Disconnected"));
        });

        if (players.length === 0) {
            this.selectedId = undefined;
            Logger.toast("Target: no players (join a match first)");
            return;
        }

        const ids = players.map(p => Game.playerId(p));
        const at = this.selectedId === undefined ? -1 : ids.indexOf(this.selectedId);
        const chosen = players[(at + 1) % players.length];
        this.selectedId = Game.playerId(chosen);

        const data = Game.playerData(chosen);
        const role = data ? (Game.roleName(data) ?? "?") : "?";
        const state = Game.isDead(chosen) ? "dead" : "alive";
        Logger.toast(`Target: ${Game.playerName(chosen)} (${role}, ${state}) [${((at + 1) % players.length) + 1}/${players.length}]`);
    }

    /** Opens a list of all players; the chosen one becomes the target, then `then` runs on the game thread */
    static pick(then?: () => void): void {
        const players = Game.players().filter(p => {
            const data = Game.playerData(p);
            return data !== undefined && !Boolean(Game.get(data, "Disconnected"));
        });
        if (players.length === 0) {
            Logger.toast("Target: no players (join a match first)");
            return;
        }
        const entries = players.map(p => {
            const data = Game.playerData(p);
            const role = data ? (Game.roleName(data) ?? "?") : "?";
            return { id: Game.playerId(p), label: `${Game.playerName(p)} (${role}${Game.isDead(p) ? ", dead" : ""})` };
        });
        JavaUtils.pickFromList("Select Player", entries.map(e => e.label), index => {
            this.selectedId = entries[index].id;
            Logger.toast(`Target: ${entries[index].label}`);
            if (then) UnityUtils.run(then)();
        });
    }

    /** The selected player, looked up fresh because PlayerControl objects are destroyed between matches */
    static current(): Il2Cpp.Object | undefined {
        if (this.selectedId === undefined) return undefined;
        return Game.players().find(p => Game.playerId(p) === this.selectedId);
    }

    static require(): Il2Cpp.Object {
        const target = this.current();
        if (!target) throw new Error('no target selected (press "Next Target" first)');
        return target;
    }
}
