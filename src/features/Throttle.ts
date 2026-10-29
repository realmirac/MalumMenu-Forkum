import { DebugLog } from "../logger/DebugLog";
import { Logger } from "../logger/Logger";
import { UnityUtils } from "../utils/UnityUtils";

export interface Step {
    name: string;
    run: () => void;
}

/**
 * The server drops (or kicks for) bursts of RPCs, so anything that sends many messages is spread out: one step every `delayMs`.
 * Each step runs on the game's main thread and reports OK / FAIL to the debug log on its own.
 */
export class Throttle {
    /** Runs the steps one after another. `done` gets the number of steps that worked and failed, then the sequence is over */
    static sequence(label: string, steps: Step[], delayMs = 350, done?: (ok: number, failed: number) => void): void {
        let index = 0;
        let ok = 0;
        let failed = 0;

        const next = (): void => {
            if (index >= steps.length) {
                if (done) done(ok, failed);
                return;
            }

            const step = steps[index++];
            UnityUtils.runInMain(() => {
                try {
                    step.run();
                    ok++;
                    DebugLog.record(`${label}: ${step.name}`, true);
                } catch (e) {
                    failed++;
                    DebugLog.record(`${label}: ${step.name}`, false, e);
                }
            }).catch(e => Logger.error(`[Throttle] ${label}: ${e}`));

            setTimeout(next, delayMs);
        };

        next();
    }
}
