import Java from "frida-java-bridge";

import { JavaUtils } from "../utils/JavaUtils";

/**
 * Debug log that survives without a PC:
 * - every line is kept in memory (last {@link MAX_TAIL} lines) and appended to a file on the device
 * - the log can be copied to the clipboard or shared from the Debug tab
 * - every feature records OK / FAIL here, so we can see what really works on a given game version
 */
export class DebugLog {
    static readonly FILE_NAME = "malummenu_debug.log";
    private static readonly MAX_TAIL = 1500;
    private static readonly MAX_FAILS_LOGGED = 5;

    /** When on, successful calls and every hook error are logged too (can be spammy) */
    static verbose = false;
    static path = "(not written yet)";

    private static pending: string[] = [];
    private static tail: string[] = [];
    private static stats = new Map<string, { ok: number; fail: number; last?: string }>();
    private static started = false;

    static init(): void {
        if (this.started) return;
        this.started = true;
        setInterval(() => this.flush(), 3000);
    }

    private static time(): string {
        const d = new Date();
        const p = (n: number, l = 2) => n.toString().padStart(l, "0");
        return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
    }

    static line(level: string, message: string): void {
        const text = `[${this.time()}] ${level} ${message}`;
        console.log(text);
        this.pending.push(text);
        this.tail.push(text);
        if (this.tail.length > this.MAX_TAIL) this.tail.splice(0, this.tail.length - this.MAX_TAIL);
    }

    static info(message: string): void {
        this.line("INFO ", message);
    }

    static warn(message: string): void {
        this.line("WARN ", message);
    }

    static error(message: string): void {
        this.line("ERROR", message);
    }

    /** Records the result of a feature call or hook. Failures are always logged (first few per label) */
    static record(label: string, ok: boolean, detail?: unknown): void {
        let entry = this.stats.get(label);
        if (!entry) {
            entry = { ok: 0, fail: 0 };
            this.stats.set(label, entry);
        }

        const text = detail === undefined ? undefined : String((detail as any)?.stack ?? detail);
        if (ok) {
            entry.ok++;
            if (entry.ok === 1 || this.verbose) this.line("OK   ", `${label}${text ? " - " + text : ""}`);
        } else {
            entry.fail++;
            entry.last = text;
            if (entry.fail <= this.MAX_FAILS_LOGGED || this.verbose) this.line("FAIL ", `${label}${text ? " - " + text : ""}`);
        }
    }

    /** Startup / compatibility check result: is this class, method or field present in this game version? Only absences get a log line */
    static probe(what: string, present: boolean, detail?: string): void {
        const label = `probe: ${what}`;
        let entry = this.stats.get(label);
        if (!entry) {
            entry = { ok: 0, fail: 0 };
            this.stats.set(label, entry);
        }
        if (present) {
            entry.ok++;
            return;
        }
        entry.fail++;
        if (entry.fail === 1) this.line("FAIL ", `${label} - ${detail ?? "MISSING in this game version"}`);
    }

    /** One line per label: how often it worked / failed */
    static summary(): string[] {
        const lines: string[] = [];
        for (const [label, e] of this.stats) {
            lines.push(`${e.fail > 0 ? "FAIL" : "ok  "} ${label}  ok=${e.ok} fail=${e.fail}${e.last ? " last=" + e.last.split("\n")[0] : ""}`);
        }
        return lines.sort();
    }

    /** Writes everything pending to the file on the device */
    static flush(): void {
        if (this.pending.length === 0) return;
        const text = this.pending.join("\n") + "\n";
        this.pending = [];

        try {
            Java.perform(() => {
                try {
                    this.path = JavaUtils.appendLogFile(this.FILE_NAME, text);
                } catch (e) {
                    console.error(`DebugLog: cannot write file: ${e}`);
                }
            });
        } catch (e) {
            console.error(`DebugLog: flush failed: ${e}`);
        }
    }

    /** Header + summary + the recent lines, ready to paste or share */
    static report(maxLines = 600): string {
        const head = [
            "=== MalumMenu debug report ===",
            `Frida ${Frida.version}, Unity ${Il2Cpp.unityVersion}, game ${Il2Cpp.application.version}`,
            `Log file: ${this.path}`,
            "",
            "--- summary (ok / fail per feature) ---",
            ...this.summary(),
            "",
            "--- recent log ---"
        ];
        return head.concat(this.tail.slice(-maxLines)).join("\n");
    }
}
