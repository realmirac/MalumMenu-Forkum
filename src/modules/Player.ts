import { AssemblyHelper } from "../core/AssemblyHelper";
import { BaseModule } from "../core/BaseModule";
import { State } from "../data/State";
import { UnityUtils } from "../utils/UnityUtils";
import { Logger } from "../logger/Logger";
import { Frame } from "../core/Game";

export class PlayerModule extends BaseModule {
    public readonly name = "Player";

    private Vector2!: Il2Cpp.Class;

    private AmongUsClient!: Il2Cpp.Class;
    private Constants!: Il2Cpp.Class;
    private NetworkModes!: Il2Cpp.Class;
    private PhysicsHelpers!: Il2Cpp.Class;
    private PlayerControl!: Il2Cpp.Class;
    private PlayerPhysics!: Il2Cpp.Class;
    private PlayerPurchasesData!: Il2Cpp.Class;
    private HudManager!: Il2Cpp.Class;
    private Vent!: Il2Cpp.Class;

    private speedWasCustom = false;
    private fovWasCustom = false;

    private Vector2_Distance!: Il2Cpp.Method;

    private PhysicsHelpers_AnythingBetween!: Il2Cpp.Method;
    private PlayerPhysics_LateUpdate!: Il2Cpp.Method;
    private PlayerPurchasesData_GetPurchase!: Il2Cpp.Method;
    private HudManager_Update!: Il2Cpp.Method;
    private Vent_CanUse!: Il2Cpp.Method;

    public init(): void {
        this.Vector2 = AssemblyHelper.CoreModule.class("UnityEngine.Vector2");

        this.AmongUsClient = AssemblyHelper.AssemblyCSharp.class("AmongUsClient");
        this.Constants = AssemblyHelper.AssemblyCSharp.class("Constants");
        this.NetworkModes = AssemblyHelper.AssemblyCSharp.class("NetworkModes");
        this.PhysicsHelpers = AssemblyHelper.AssemblyCSharp.class("PhysicsHelpers");
        this.PlayerControl = AssemblyHelper.AssemblyCSharp.class("PlayerControl");
        this.PlayerPhysics = AssemblyHelper.AssemblyCSharp.class("PlayerPhysics");
        this.PlayerPurchasesData = AssemblyHelper.AssemblyCSharp.class("PlayerPurchasesData");
        this.HudManager = AssemblyHelper.AssemblyCSharp.class("HudManager");
        this.Vent = AssemblyHelper.AssemblyCSharp.class("Vent");

        this.Vector2_Distance = this.Vector2.method<number>("Distance", 2);

        this.PhysicsHelpers_AnythingBetween = this.PhysicsHelpers.method<boolean>("AnythingBetween", 5);
        this.PlayerPhysics_LateUpdate = this.PlayerPhysics.method<void>("LateUpdate");
        this.PlayerPurchasesData_GetPurchase = this.PlayerPurchasesData.method<boolean>("GetPurchase");
        this.HudManager_Update = this.HudManager.method<void>("Update");
        this.Vent_CanUse = this.Vent.method<boolean>("CanUse", 3);
    }

    public override initHooks(): void {
        const module = this;

        this.PlayerPhysics_LateUpdate.implementation = function (): void {
            // Run the original, then let the other modules run their per-frame work (same order as a Harmony postfix)
            const original = (): void => {
                this.method<void>("LateUpdate").invoke();
                Frame.emit("PlayerPhysics.LateUpdate", this);
            };

            //const myPlayer = module.PlayerPhysics.field<Il2Cpp.Object>("myPlayer");
            const localPlayer = module.localPlayer;

            // If we leave and re-join a game, localPlayer.handle points to dead memory
            // To prevent this, we check the internal Unity m_CachedPtr for 0x0
            // Since it's always pointing to real memory
            let cachedPtr: Il2Cpp.Pointer;
            try {
                cachedPtr = UnityUtils.cachedPtr(localPlayer);
            } catch (e) {
                Logger.debug(e + " (This error is expected due to m_CachedPtr not being set yet)");
                return original();
            }

            if (localPlayer.isNull() || cachedPtr.isNull()) {
                return original();
            }

            // instance field: public Collider2D Collider;
            const collider = localPlayer.field<Il2Cpp.Object>("Collider").value;

            // Same as PC: the collider stays off while climbing a ladder (Airship), otherwise the climb animation breaks
            const onLadder = localPlayer.field<boolean>("onLadder").value;
            collider.method("set_enabled").invoke(!(State.noclip || onLadder));

            const myPhysics = localPlayer.field<Il2Cpp.Object>("MyPhysics").value;

            if (State.customSpeed) {
                myPhysics.field<number>("Speed").value = State.speed;
                myPhysics.field<number>("GhostSpeed").value = State.speed;
                module.speedWasCustom = true;
            } else if (module.speedWasCustom) {
                // Restore the defaults once. Writing them every frame would also wipe the lobby's player speed modifier
                myPhysics.field<number>("Speed").value = 2.5;
                myPhysics.field<number>("GhostSpeed").value = 3;
                module.speedWasCustom = false;
            }

            return original();
        };

        // @ts-ignore
        this.PlayerPurchasesData_GetPurchase.implementation = function (itemKey: Il2Cpp.String, bundleKey: Il2Cpp.String): boolean {
            if (State.unlockCosmetics) {
                return true;
            }
            return this.method<boolean>("GetPurchase", 2).invoke(itemKey, bundleKey);
        };

        this.HudManager_Update.implementation = function (): void {
            const original = (): void => {
                this.method<void>("Update").invoke();
                Frame.emit("HudManager.Update", this);
            };

            const HudManagerInstance = module.HudManager.method<Il2Cpp.Object>("get_Instance").invoke();
            const localPlayer = module.localPlayer;

            if (HudManagerInstance.isNull() || localPlayer.isNull()) {
                return original();
            }

            // NetworkedPlayerInfo
            const data = localPlayer.method<Il2Cpp.Object>("get_Data").invoke();
            const impostorVentButton = HudManagerInstance.field<Il2Cpp.Object>("ImpostorVentButton").value;
            const impostorVentButtonGameObject = UnityUtils.getGameObject(impostorVentButton);

            const shadowQuad = HudManagerInstance.field<Il2Cpp.Object>("ShadowQuad").value;
            const shadowQuadGameObject = UnityUtils.getGameObject(shadowQuad);

            // The shadow quad has a fixed size, so it shows its edges once the camera is zoomed out (PC: IsFullbrightActive)
            const zoomedOut = State.customFov && State.fov > 3;
            shadowQuadGameObject.method<void>("SetActive", 1).invoke(!(State.noShadows || zoomedOut));

            module.applyFov(HudManagerInstance);

            let role: Il2Cpp.Object;
            let canVent: boolean;
            try {
                // RoleBehaviour
                role = data.field<Il2Cpp.Object>("Role").value;
                canVent = role.field<boolean>("CanVent").value;
            } catch (e) {
                Logger.debug(e + " (This error is expected due to Role field not being set yet)");
                return original();
            }
            const isDead = data.field<boolean>("IsDead").value;

            if (isDead) {
                shadowQuadGameObject.method<void>("SetActive", 1).invoke(false);
            }

            if (!canVent && !isDead) {
                impostorVentButtonGameObject.method<void>("SetActive", 1).invoke(State.unlockVents);
            }

            return original();
        };

        //@ts-ignore
        this.Vent_CanUse.implementation = function (pc: Il2Cpp.Object, canUse: Il2Cpp.Reference<boolean>, couldUse: Il2Cpp.Reference<boolean>): number {
            if (!State.unlockVents) {
                return this.method<number>("CanUse", 3).invoke(pc, canUse, couldUse);
            }

            const localPlayer = module.localPlayer;
            // The null check has to come before get_Data, otherwise we call a method on a null object
            if (localPlayer.isNull()) {
                return this.method<number>("CanUse", 3).invoke(pc, canUse, couldUse);
            }

            const data = localPlayer.method<Il2Cpp.Object>("get_Data").invoke();
            if (data.isNull()) {
                return this.method<number>("CanUse", 3).invoke(pc, canUse, couldUse);
            }

            const role = data.field<Il2Cpp.Object>("Role").value;
            const canVent = role.field<boolean>("CanVent").value;
            const isDead = data.field<boolean>("IsDead").value;

            if (canVent || isDead) {
                return this.method<number>("CanUse", 3).invoke(pc, canUse, couldUse);
            }

            const object = pc.method<Il2Cpp.Object>("get_Object").invoke();
            const collider = object.field<Il2Cpp.Object>("Collider").value;
            const bounds = collider.method<Il2Cpp.Object>("get_bounds").invoke();
            const center = bounds.method<Il2Cpp.Object>("get_center").invoke();

            const transform = this.method<Il2Cpp.Object>("get_transform").invoke();
            const position = transform.method<Il2Cpp.Object>("get_position").invoke();

            // Convert from Vector3 to Vector2. Works, but there's probably a better way of doing it.
            const centerX = center.field<number>("x").value;
            const centerY = center.field<number>("y").value;
            const positionX = position.field<number>("x").value;
            const positionY = position.field<number>("y").value;

            const centerVector2 = UnityUtils.createVector2(centerX, centerY);
            const positionVector2 = UnityUtils.createVector2(positionX, positionY);

            const num = module.Vector2_Distance.invoke(centerVector2, positionVector2) as number;

            const usableDistance = this.method<number>("get_UsableDistance").invoke(); // 0.75f
            const shipOnlyMask = module.Constants.field<number>("ShipOnlyMask").value;

            // Allow usage of vents unless the vent is too far or there are objects blocking the player's path
            canUse.value =
                num <= usableDistance && !module.PhysicsHelpers_AnythingBetween.invoke(collider, centerVector2, positionVector2, shipOnlyMask, false);
            couldUse.value = true;
            return num;
        };
    }

    /**
     * Zoom out / in (FOV). PC MalumESP.ZoomOut: `Camera.main.orthographicSize` and `HudManager.UICamera.orthographicSize`, default 3
     *
     * Only written while the cheat is on, and restored once when it is turned off
     */
    private applyFov(hud: Il2Cpp.Object): void {
        if (!this.fovWasCustom && !State.customFov) return;

        const size = State.customFov ? Math.max(3, State.fov) : 3;
        const camera = AssemblyHelper.CoreModule.class("UnityEngine.Camera").method<Il2Cpp.Object>("get_main").invoke();
        if (!camera.isNull()) camera.method<void>("set_orthographicSize").invoke(size);

        const uiCamera = hud.field<Il2Cpp.Object>("UICamera").value;
        if (!uiCamera.isNull()) uiCamera.method<void>("set_orthographicSize").invoke(size);

        this.fovWasCustom = State.customFov;
    }

    public completeTask(task: Il2Cpp.Object): void {
        const module = this;
        const localPlayer = module.localPlayer;

        const taskId = task.method<number>("get_Id").invoke();
        // const isComplete = task.method<boolean>("get_IsComplete").invoke();
        localPlayer.method("RpcCompleteTask").invoke(taskId);
    }

    public completeMyTasks(): void {
        const module = this;

        const localPlayer = module.localPlayer;
        if (localPlayer.isNull()) {
            Logger.warn(`[${module.name}::completeMyTasks] LocalPlayer is null`);
            return;
        }

        // System.Collections.Generic.List<PlayerTask> myTasks;
        const myTasks = localPlayer.field<Il2Cpp.Object>("myTasks").value;

        // Iterate over the list. Source: https://github.com/vfsfitvnm/frida-il2cpp-bridge/issues/556
        const taskCount = myTasks.method<number>("get_Count").invoke();
        Logger.debug(`[${module.name}::completeMyTasks] Found ${taskCount} tasks`);
        for (let i = 0; i < taskCount; i++) {
            const task = myTasks.method<Il2Cpp.Object>("get_Item").invoke(i);
            module.completeTask(task);
        }
    }

    /**
     * `static PlayerControl::LocalPlayer`
     *
     * @returns `PlayerControl` instance
     */
    private get localPlayer(): Il2Cpp.Object {
        return this.PlayerControl.field<Il2Cpp.Object>("LocalPlayer").value;
    }
}
