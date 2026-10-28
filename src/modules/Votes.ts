import { AssemblyHelper } from "../core/AssemblyHelper";
import { BaseModule } from "../core/BaseModule";
import { State } from "../data/State";
import { Logger } from "../logger/Logger";

/**
 * Reveal Votes, ported from MalumMenu (PC) LogicOptionsPatches
 *
 * `LogicOptions.GetAnonymousVotes` / `LogicOptionsNormal.GetAnonymousVotes` postfix: result = false,
 * so the game itself shows who voted for whom even when the lobby uses anonymous votes
 */
export class VotesModule extends BaseModule {
    public readonly name = "Votes";

    public init(): void {}

    public override initHooks(): void {
        for (const className of ["LogicOptions", "LogicOptionsNormal"]) {
            const klass = AssemblyHelper.findClass(className);
            const method = klass?.tryMethod("GetAnonymousVotes", 0);

            if (!klass || !method || method.class.name !== klass.name) {
                Logger.warn(`[${this.name}] ${className}.GetAnonymousVotes not declared here, skipping`);
                continue;
            }

            // @ts-ignore
            method.implementation = function (): any {
                const original = (this as Il2Cpp.Object).method<boolean>("GetAnonymousVotes", 0).invoke();
                return State.revealVotes ? false : original;
            };
        }
    }
}
