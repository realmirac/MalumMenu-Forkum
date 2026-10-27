import { AssemblyHelper } from "../core/AssemblyHelper";
import { BaseModule } from "../core/BaseModule";
import { State } from "../data/State";
import { UnityUtils } from "../utils/UnityUtils";
import { Logger } from "../logger/Logger";

export class ShipModule extends BaseModule {
    public readonly name = "Ship";

    private GameOptionsManager!: Il2Cpp.Class;
    private HudManager!: Il2Cpp.Class;
    private MapOptions!: Il2Cpp.Class;
    private PlayerControl!: Il2Cpp.Class;
    private ShipStatus!: Il2Cpp.Class;
    private SystemTypes!: Il2Cpp.Class;
    private VentilationSystem!: Il2Cpp.Class;

    private ShipStatus_FixedUpdate!: Il2Cpp.Method;

    public init(): void {
        this.GameOptionsManager = AssemblyHelper.AssemblyCSharp.class("GameOptionsManager");
        this.HudManager = AssemblyHelper.AssemblyCSharp.class("HudManager");
        this.MapOptions = AssemblyHelper.AssemblyCSharp.class("MapOptions");
        this.PlayerControl = AssemblyHelper.AssemblyCSharp.class("PlayerControl");
        this.ShipStatus = AssemblyHelper.AssemblyCSharp.class("ShipStatus");
        this.SystemTypes = AssemblyHelper.AssemblyCSharp.class("SystemTypes");
        this.VentilationSystem = AssemblyHelper.AssemblyCSharp.class("VentilationSystem");

        this.ShipStatus_FixedUpdate = this.ShipStatus.method<void>("FixedUpdate");
    }

    public override initHooks(): void {
        const module = this;

        this.ShipStatus_FixedUpdate.implementation = function (): void {
            if (State.walkInVents) {
                const localPlayer = module.localPlayer;

                if (localPlayer.isNull()) {
                    return this.method<void>("FixedUpdate").invoke();
                }

                localPlayer.field<boolean>("inVent").value = false;
                localPlayer.field<boolean>("moveable").value = true;
            }

            return this.method<void>("FixedUpdate").invoke();
        };
    }

    public callMeeting(): void {
        const module = this;

        const ShipStatusInstance = module.ShipStatus.field<Il2Cpp.Object>("Instance").value;
        if (ShipStatusInstance.isNull()) {
            Logger.warn(`[${module.name}::callMeeting] ShipStatusInstance is null`);
            return;
        }

        const localPlayer = module.localPlayer;
        if (localPlayer.isNull()) {
            Logger.warn(`[${module.name}::callMeeting] LocalPlayer is null`);
            return;
        }

        localPlayer.method<void>("CmdReportDeadBody").invoke(NULL);
    }

    public sabotageReactor(): void {
        const module = this;

        const ShipStatusInstance = module.ShipStatus.field<Il2Cpp.Object>("Instance").value;
        if (ShipStatusInstance.isNull()) {
            Logger.warn(`[${module.name}::sabotageReactor] ShipStatusInstance is null`);
            return;
        }

        ShipStatusInstance.method<void>("RpcUpdateSystem").invoke(3, 128);
    }

    /**
     * Triggers every sabotage the current map supports and closes all doors
     *
     * Ported from MalumMenu (PC) MalumSabotageCheats: the map decides which systems exist,
     * so we pick them by map id instead of probing ShipStatus.Systems
     */
    public sabotageAll(): void {
        const module = this;

        const ShipStatusInstance = module.ShipStatus.field<Il2Cpp.Object>("Instance").value;
        if (ShipStatusInstance.isNull()) {
            Logger.toast("Sabotage All: no ship (join a game first)");
            return;
        }

        const mapId = module.getMapId();
        const sent: string[] = [];

        const send = (label: string, system: string, amount: number): void => {
            try {
                const type = UnityUtils.enumValue(module.SystemTypes, system);
                if (type === undefined) {
                    Logger.warn(`[${module.name}::sabotageAll] SystemTypes.${system} not found`);
                    return;
                }
                ShipStatusInstance.method<void>("RpcUpdateSystem").invoke(type, amount);
                sent.push(label);
            } catch (e) {
                Logger.warn(`[${module.name}::sabotageAll] ${label} failed: ${e}`);
            }
        };

        // Map ids: 0 Skeld, 1 MiraHQ, 2 Polus, 3 Dleks, 4 Airship, 5 Fungle
        // Reactor
        if (mapId === 2) send("Reactor", "Laboratory", 128);
        else if (mapId === 4) send("Reactor", "HeliSabotage", 128);
        else send("Reactor", "Reactor", 128);

        // Oxygen only exists on Skeld, MiraHQ and Dleks
        if (mapId !== 2 && mapId !== 4 && mapId !== 5) send("Oxygen", "LifeSupp", 128);

        // Comms
        send("Comms", "Comms", 128);

        // Lights (Fungle has no electrical system). Low 5 bits are the switches that get flipped
        if (mapId !== 5) {
            let switches = 4;
            for (let i = 0; i < 5; i++) {
                if (Math.random() < 0.5) switches |= 1 << i;
            }
            send("Lights", "Electrical", switches | 128);
        }

        // Mushroom mixup (Fungle only)
        if (mapId === 5) send("Mushrooms", "MushroomMixupSabotage", 1);

        const doors = module.closeAllDoors(false);
        if (doors > 0) sent.push("Doors");

        Logger.toast(`Sabotage All (map ${mapId}): ${sent.length > 0 ? sent.join(", ") : "nothing was sent"}`);
    }

    /** Closes every door on the map (doors are closed room by room). Returns the number of rooms closed */
    public closeAllDoors(notify: boolean = true): number {
        const module = this;

        const ShipStatusInstance = module.ShipStatus.field<Il2Cpp.Object>("Instance").value;
        if (ShipStatusInstance.isNull()) {
            if (notify) Logger.toast("Close All Doors: no ship (join a game first)");
            return 0;
        }

        const rooms = new Set<number>();
        try {
            const allDoors = ShipStatusInstance.field<Il2Cpp.Array<Il2Cpp.Object>>("AllDoors").value;
            if (!allDoors.isNull()) {
                for (let i = 0; i < allDoors.length; i++) {
                    rooms.add(Number(allDoors.get(i).field("Room").value));
                }
            }
        } catch (e) {
            Logger.warn(`[${module.name}::closeAllDoors] reading AllDoors failed: ${e}`);
        }

        let closed = 0;
        for (const room of rooms) {
            try {
                ShipStatusInstance.method<void>("RpcCloseDoorsOfType").invoke(room);
                closed++;
            } catch (e) {
                Logger.warn(`[${module.name}::closeAllDoors] room ${room} failed: ${e}`);
            }
        }

        if (notify) Logger.toast(closed > 0 ? `Closed doors in ${closed} rooms` : "This map has no doors");
        return closed;
    }

    /**
     * Current map id, same lookup as MalumMenu (PC) Utils.GetCurrentMapID
     *
     * 0 Skeld, 1 MiraHQ, 2 Polus, 3 Dleks, 4 Airship, 5 Fungle. Returns 255 if unknown
     */
    private getMapId(): number {
        try {
            const manager = this.GameOptionsManager.method<Il2Cpp.Object>("get_Instance").invoke();
            const options = manager.field<Il2Cpp.Object>("currentGameOptions").value;
            return Number(options.method<number>("get_MapId").invoke());
        } catch (e) {
            Logger.warn(`[${this.name}::getMapId] ${e}`);
            return 255;
        }
    }

    public kickVents(): void {
        const module = this;

        const ShipStatusInstance = module.ShipStatus.field<Il2Cpp.Object>("Instance").value;
        if (ShipStatusInstance.isNull()) {
            Logger.warn(`[${module.name}::kickVents] ShipStatusInstance is null`);
            return;
        }

        const allVents = ShipStatusInstance.method<Il2Cpp.Array<Il2Cpp.Object>>("get_AllVents").invoke();

        for (const vent of allVents) {
            // VentilationSystem.Operation.BootImpostors = 5
            module.VentilationSystem.method<void>("Update", 2).invoke(5, vent.field("Id").value);
        }
    }

    public openSabotageMap(): void {
        const module = this;

        const HudManagerInstanceExists = module.HudManager.method<boolean>("get_InstanceExists").invoke();
        if (!HudManagerInstanceExists) {
            Logger.warn(`[${module.name}::openSabotageMap] HudManagerInstance does not exist`);
            return;
        }

        // No isNull check here because we trust that InstanceExists tells the truth
        const HudManagerInstance = module.HudManager.method<Il2Cpp.Object>("get_Instance").invoke();
        const MapOptions = UnityUtils.createInstance(module.MapOptions);
        const Modes = module.MapOptions.nested("Modes");
        const Sabotage = Modes.field("Sabotage");

        MapOptions.field("Mode").value = Sabotage.value;

        HudManagerInstance.method<void>("ToggleMapVisible", 1).invoke(MapOptions);
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
