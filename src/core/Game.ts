import { DebugLog } from "../logger/DebugLog";

/**
 * Tolerant access to the game's IL2CPP types
 *
 * The PC mod is compiled against the game's interop libraries, so it knows every member exactly.
 * Here we only learn the real signatures at runtime, so everything is looked up by name and failures
 * are recorded in the debug log instead of silently breaking a whole module.
 *
 * - classes are found by simple name, whatever their namespace (RoleTypes lives in AmongUs.GameOptions, etc.)
 * - a member can be a field or a property: {@link Game.get} / {@link Game.set} try both
 */
export class Game {
    private static classCache = new Map<string, Il2Cpp.Class | undefined>();
    private static imageIndex = new Map<string, Map<string, Il2Cpp.Class>>();
    private static readonly imageOrder = ["Assembly-CSharp", "Hazel", "UnityEngine.CoreModule"];

    // ---------------------------------------------------------------- classes

    private static indexFor(assemblyName: string): Map<string, Il2Cpp.Class> {
        let index = this.imageIndex.get(assemblyName);
        if (index) return index;

        index = new Map();
        try {
            for (const klass of Il2Cpp.domain.assembly(assemblyName).image.classes) {
                if (!index.has(klass.name)) index.set(klass.name, klass);
                index.set(klass.fullName, klass);
            }
        } catch (e) {
            DebugLog.warn(`[Game] cannot index ${assemblyName}: ${e}`);
        }
        this.imageIndex.set(assemblyName, index);
        return index;
    }

    /** Finds a class by simple name (`RoleTypes`) or full name (`AmongUs.GameOptions.RoleTypes`) in the game and Unity assemblies */
    static cls(name: string, quiet = false): Il2Cpp.Class | undefined {
        if (this.classCache.has(name)) return this.classCache.get(name);

        let found: Il2Cpp.Class | undefined;
        for (const assemblyName of this.imageOrder) {
            found = this.indexFor(assemblyName).get(name);
            if (found) break;
        }

        this.classCache.set(name, found);
        if (!quiet) DebugLog.probe(`class ${name}`, found !== undefined);
        return found;
    }

    /** Same as {@link cls} but throws, for use inside a feature wrapped by a try/catch */
    static need(name: string): Il2Cpp.Class {
        const klass = this.cls(name);
        if (!klass) throw new Error(`class ${name} not found`);
        return klass;
    }

    // ---------------------------------------------------------------- values

    static isNull(value: any): boolean {
        if (value === undefined || value === null) return true;
        if (value instanceof Il2Cpp.Object) return value.isNull();
        return false;
    }

    /** Il2Cpp.String / string -> string */
    static str(value: any): string {
        if (value === undefined || value === null) return "";
        if (typeof value === "string") return value;
        try {
            return value.content ?? "";
        } catch {
            return "";
        }
    }

    /** Reads a field, or the getter of a property with the same name. `target` can be an object or a class (static) */
    static get(target: any, name: string): any {
        if (Game.isNull(target) && !(target instanceof Il2Cpp.Class)) return undefined;

        const field = target.tryField(name);
        if (field) return field.value;

        const getter = target.tryMethod(`get_${name}`, 0);
        if (getter) return getter.invoke();

        return undefined;
    }

    /** Writes a field, or the setter of a property with the same name. Returns false if neither exists */
    static set(target: any, name: string, value: any): boolean {
        if (Game.isNull(target) && !(target instanceof Il2Cpp.Class)) return false;

        const field = target.tryField(name);
        if (field) {
            field.value = value;
            return true;
        }

        const setter = target.tryMethod(`set_${name}`, 1);
        if (setter) {
            setter.invoke(value);
            return true;
        }

        return false;
    }

    /** Calls an instance or static method by name and parameter count (-1 = any). Throws if it doesn't exist */
    static call(target: any, name: string, argc: number, ...args: any[]): any {
        const method = target.tryMethod(name, argc);
        if (!method) throw new Error(`method ${name}/${argc} missing on ${target instanceof Il2Cpp.Class ? target.name : target.class.name}`);
        return method.invoke(...args);
    }

    /** Finds an overload by exact parameter type names, e.g. `["System.Int32"]`. For an object the result is bound to it */
    static overload(target: any, name: string, types: string[]): Il2Cpp.Method | undefined {
        const first = target.tryMethod(name, -1);
        if (!first) return undefined;
        return first.tryOverload(...types) ?? undefined;
    }

    // ---------------------------------------------------------------- enums

    static enumVal(enumName: string, member: string): number | undefined {
        const klass = this.cls(enumName);
        if (!klass) return undefined;
        const field = klass.tryField(member);
        if (!field) {
            DebugLog.probe(`enum ${enumName}.${member}`, false);
            return undefined;
        }
        return Number(field.value);
    }

    static enumName(enumName: string, value: number): string | undefined {
        const klass = this.cls(enumName);
        if (!klass) return undefined;
        for (const field of klass.fields) {
            if (!field.isStatic) continue;
            try {
                if (Number(field.value) === value) return field.name;
            } catch {
                // value__ and friends can't be read
            }
        }
        return undefined;
    }

    /** All member names of an enum, in declaration order */
    static enumNames(enumName: string): string[] {
        const klass = this.cls(enumName);
        if (!klass) return [];
        return klass.fields.filter(f => f.isStatic).map(f => f.name);
    }

    // ---------------------------------------------------------------- game objects

    /** `Foo.Instance` (static field, or the `get_Instance` of DestroyableSingleton) or undefined */
    static instance(className: string): Il2Cpp.Object | undefined {
        const klass = this.cls(className, true);
        if (!klass) return undefined;
        try {
            const value = this.get(klass, "Instance");
            return this.isNull(value) ? undefined : value;
        } catch {
            return undefined;
        }
    }

    static localPlayer(): Il2Cpp.Object | undefined {
        const klass = this.cls("PlayerControl", true);
        if (!klass) return undefined;
        const value = this.get(klass, "LocalPlayer");
        return this.isNull(value) ? undefined : value;
    }

    /** Elements of a List<T> or T[] */
    static list(collection: any): Il2Cpp.Object[] {
        const result: Il2Cpp.Object[] = [];
        if (this.isNull(collection)) return result;

        if (collection instanceof Il2Cpp.Array) {
            for (let i = 0; i < collection.length; i++) result.push(collection.get(i) as Il2Cpp.Object);
            return result;
        }

        const count = Number(collection.method("get_Count", 0).invoke());
        const getItem = collection.method("get_Item", 1);
        for (let i = 0; i < count; i++) result.push(getItem.invoke(i) as Il2Cpp.Object);
        return result;
    }

    /** Every PlayerControl in the match (PlayerControl.AllPlayerControls) */
    static players(): Il2Cpp.Object[] {
        const klass = this.cls("PlayerControl", true);
        if (!klass) return [];
        return this.list(this.get(klass, "AllPlayerControls")).filter(p => !this.isNull(p));
    }

    static playerData(player: Il2Cpp.Object): Il2Cpp.Object | undefined {
        const data = this.get(player, "Data");
        return this.isNull(data) ? undefined : data;
    }

    static playerId(player: Il2Cpp.Object): number {
        return Number(this.get(player, "PlayerId"));
    }

    static playerName(player: Il2Cpp.Object): string {
        const data = this.playerData(player);
        const fromData = data ? this.str(this.get(data, "PlayerName")) : "";
        if (fromData) return fromData;
        const outfit = this.get(player, "CurrentOutfit");
        return this.isNull(outfit) ? `Player ${this.playerId(player)}` : this.str(this.get(outfit, "PlayerName"));
    }

    static isDead(player: Il2Cpp.Object): boolean {
        const data = this.playerData(player);
        return data ? Boolean(this.get(data, "IsDead")) : false;
    }

    /** RoleTypes member name of a NetworkedPlayerInfo (`Impostor`, `Crewmate`, ...) or undefined while unassigned */
    static roleName(data: Il2Cpp.Object): string | undefined {
        const role = this.get(data, "Role");
        if (this.isNull(role)) return undefined;
        return this.enumName("RoleTypes", Number(this.get(role, "Role")));
    }

    /** RoleTeamTypes member name (`Impostor`, `Crewmate`) of a NetworkedPlayerInfo */
    static teamName(data: Il2Cpp.Object): string | undefined {
        const role = this.get(data, "Role");
        if (this.isNull(role)) return undefined;
        return this.enumName("RoleTeamTypes", Number(this.get(role, "TeamType")));
    }

    static isHost(): boolean {
        const client = this.instance("AmongUsClient");
        return client ? Boolean(this.get(client, "AmHost")) : false;
    }

    static isMeeting(): boolean {
        return this.instance("MeetingHud") !== undefined;
    }

    static isShip(): boolean {
        return this.instance("ShipStatus") !== undefined;
    }

    /** 0 Skeld, 1 MiraHQ, 2 Polus, 3 Dleks, 4 Airship, 5 Fungle, 255 unknown (same lookup as PC Utils.GetCurrentMapID) */
    static mapId(): number {
        try {
            const manager = this.instance("GameOptionsManager");
            if (manager) {
                const options = this.get(manager, "currentGameOptions");
                if (!this.isNull(options)) return Number(this.get(options, "MapId"));
            }
        } catch (e) {
            DebugLog.record("Game.mapId", false, e);
        }
        return 255;
    }

    // ---------------------------------------------------------------- hooks

    private static hooked = new Set<string>();

    /**
     * Replaces `Class.method` with `handler`
     *
     * `handler(self, call, ...args)` decides what happens: `call(...args)` runs the original (with the arguments you pass),
     * the return value is the method's result. If the handler throws, the original runs once with the untouched
     * arguments, so a bug in the mod can never break the game's own logic.
     *
     * @param argc parameter count to pick an overload, -1 = first method with that name
     * @returns false if the method doesn't exist in this game version
     */
    static hook(label: string, className: string, methodName: string, argc: number, handler: (self: any, call: (...a: any[]) => any, ...args: any[]) => any): boolean {
        const klass = this.cls(className);
        if (!klass) return false;

        const method = klass.tryMethod(methodName, argc);
        DebugLog.probe(`method ${className}.${methodName}/${argc}`, !!method);
        if (!method) return false;

        const key = `${className}.${methodName}/${argc}`;
        if (this.hooked.has(key)) DebugLog.warn(`[Game] ${key} is hooked twice, the later hook wins`);
        this.hooked.add(key);

        try {
            // @ts-ignore: the bridge types `this` and the arguments loosely
            method.implementation = function (...args: any[]) {
                const self: any = this;
                let called = false;
                let last: any;

                const call = (...a: any[]): any => {
                    called = true;
                    last = self.method(methodName, argc).invoke(...a);
                    return last;
                };

                try {
                    return handler(self, call, ...args);
                } catch (e) {
                    DebugLog.record(`hook ${label}`, false, e);
                    return called ? last : call(...args);
                }
            };
            return true;
        } catch (e) {
            DebugLog.record(`install hook ${label}`, false, e);
            return false;
        }
    }
}

/**
 * Per-frame callbacks. The game's frequently called methods (PlayerPhysics.LateUpdate, HudManager.Update, ...) can only
 * have one hook, so the hook owner emits a named point after running the original and every module subscribes here.
 */
export class Frame {
    private static listeners = new Map<string, Array<{ label: string; callback: (self: any) => void }>>();

    static on(point: string, label: string, callback: (self: any) => void): void {
        const list = this.listeners.get(point) ?? [];
        list.push({ label, callback });
        this.listeners.set(point, list);
    }

    static emit(point: string, self: any): void {
        const list = this.listeners.get(point);
        if (!list) return;
        for (const listener of list) {
            try {
                listener.callback(self);
            } catch (e) {
                DebugLog.record(`frame ${point}:${listener.label}`, false, e);
            }
        }
    }
}
