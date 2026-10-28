import { Logger } from "../logger/Logger";

export class AssemblyHelper {
    static CoreModule: Il2Cpp.Image;
    static TextMeshPro: Il2Cpp.Image;
    static AssemblyCSharp: Il2Cpp.Image;
    static Hazel: Il2Cpp.Image;

    private static classCache = new Map<string, Il2Cpp.Class | null>();

    /**
     * Finds a class of Assembly-CSharp by its short name (without namespace)
     *
     * `image.class("RoleTypes")` needs the exact namespace and throws if it is wrong, and several game types
     * (RoleTypes, SystemTypes, FloatOptionNames, ...) live inside `AmongUs.GameOptions`. Searching by short name works for both
     */
    static findClass(name: string): Il2Cpp.Class | undefined {
        const cached = this.classCache.get(name);
        if (cached !== undefined) return cached ?? undefined;

        const found = this.AssemblyCSharp.tryClass(name) ?? this.AssemblyCSharp.classes.find(klass => klass.name === name) ?? null;
        this.classCache.set(name, found);
        if (!found) Logger.warn(`[AssemblyHelper::findClass] ${name} not found`);
        return found ?? undefined;
    }

    static init() {
        this.CoreModule = Il2Cpp.domain.assembly("UnityEngine.CoreModule").image;
        this.TextMeshPro = Il2Cpp.domain.assembly("Unity.TextMeshPro").image;
        this.AssemblyCSharp = Il2Cpp.domain.assembly("Assembly-CSharp").image;
        this.Hazel = Il2Cpp.domain.assembly("Hazel").image;

        Logger.info("[AssemblyHelper::init] Initialized");
    }
}
