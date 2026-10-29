import { AssemblyHelper } from "../core/AssemblyHelper";
import { BaseModule } from "../core/BaseModule";
import { Game } from "../core/Game";
import { State } from "../data/State";
import { Logger } from "../logger/Logger";

export class PassiveModule extends BaseModule {
    public readonly name = "Passive";

    // Classes
    private Screen!: Il2Cpp.Class;

    private ResolutionManager!: Il2Cpp.Class;

    // Methods
    private ResolutionManager_SetResolution!: Il2Cpp.Method;

    private HasResolutionBeenChanged!: boolean;
    private OriginalWidth!: number;
    private OriginalHeight!: number;

    public init(): void {
        this.Screen = AssemblyHelper.CoreModule.class("UnityEngine.Screen");

        this.ResolutionManager = AssemblyHelper.AssemblyCSharp.class("ResolutionManager");

        this.ResolutionManager_SetResolution = this.ResolutionManager.method<void>("SetResolution", 3);

        this.HasResolutionBeenChanged = false;
    }

    /**
     * Free Chat / online unlock, ported from MalumMenu (PC): EOSManagerPatches + OtherPatches ("Unlock Extra Features").
     *
     * The PC build patches SIX places. The first Android port only had the first two, which is why the Free Chat filter could
     * be selected but no lobby ever showed up and none could be joined: the game still saw an account that may not play online.
     *
     *  - EOSManager.IsFreechatAllowed / IsFriendsListAllowed -> true   (unlocks the Free Chat filter + language picker)
     *  - EOSManager.IsAllowedOnline(canOnline)               -> arg forced to true
     *  - EOSManager.IsMinorOrWaiting                         -> false  (no minor restrictions on the lobby list)
     *  - AccountManager.CanPlayOnline                        -> true
     *  - FullAccount.CanSetCustomName(canSetName)            -> arg forced to true
     *  - InnerNetClient.JoinGame                             -> DataManager.Player.Account.LoginStatus = LoggedIn before joining
     *
     * On by default, matching the PC build's "Unlock Extra Features".
     */
    public override initHooks(): void {
        const on = (): boolean => State.unlockFreeChat;

        Game.hook("EOSManager.IsFreechatAllowed", "EOSManager", "IsFreechatAllowed", 0, (self, call) => (on() ? true : call()));
        Game.hook("EOSManager.IsFriendsListAllowed", "EOSManager", "IsFriendsListAllowed", 0, (self, call) => (on() ? true : call()));
        Game.hook("EOSManager.IsAllowedOnline", "EOSManager", "IsAllowedOnline", 1, (self, call, canOnline) => call(on() ? true : canOnline));
        Game.hook("EOSManager.IsMinorOrWaiting", "EOSManager", "IsMinorOrWaiting", 0, (self, call) => (on() ? false : call()));
        Game.hook("AccountManager.CanPlayOnline", "AccountManager", "CanPlayOnline", 0, (self, call) => (on() ? true : call()));
        Game.hook("FullAccount.CanSetCustomName", "FullAccount", "CanSetCustomName", 1, (self, call, canSetName) => call(on() ? true : canSetName));

        Game.hook("InnerNetClient.JoinGame", "InnerNetClient", "JoinGame", 0, (self, call) => {
            if (on()) PassiveModule.markLoggedIn();
            return call();
        });
    }

    /** PC: DataManager.Player.Account.LoginStatus = EOSManager.AccountLoginStatus.LoggedIn */
    private static markLoggedIn(): void {
        const dataManager = Game.cls("DataManager", true);
        const status = Game.cls("AccountLoginStatus", true);
        if (!dataManager || !status) throw new Error("DataManager / AccountLoginStatus not found");

        const account = Game.get(Game.get(dataManager, "Player"), "Account");
        const loggedIn = status.tryField("LoggedIn");
        if (Game.isNull(account) || !loggedIn) throw new Error("account or LoggedIn value missing");

        if (!Game.set(account, "LoginStatus", loggedIn.value)) throw new Error("LoginStatus is not writable");
    }

    public toggleFullResolution(state: boolean): void {
        const module = this;

        if (!this.HasResolutionBeenChanged) {
            const original_resolution = module.Screen.method<Il2Cpp.Object>("get_currentResolution").invoke();
            module.OriginalWidth = original_resolution.method<number>("get_width").invoke();
            module.OriginalHeight = original_resolution.method<number>("get_height").invoke();
            Logger.debug(`[${module.name}::ToggleFullResolution] Original resolution: ${module.OriginalWidth}x${module.OriginalHeight}`);
        }
        this.HasResolutionBeenChanged = true;

        if (state) {
            // resolutions returns all full-screen resolutions that the monitor supports, sorted by width
            const resolutions = module.Screen.method<Il2Cpp.Array<Il2Cpp.Object>>("get_resolutions").invoke();
            const width = resolutions.get(0).method<number>("get_width").invoke();
            const height = resolutions.get(0).method<number>("get_height").invoke();
            //const refreshRateRatio = resolutions.get(0).method<Il2Cpp.Object>("get_refreshRateRatio").invoke();
            //const refreshRate = refreshRateRatio.field("value").value;

            Logger.debug(`[${module.name}::ToggleFullResolution] Setting resolution to ${height}x${width}`);
            module.ResolutionManager_SetResolution.invoke(height, width, true);
        } else {
            Logger.debug(`[${module.name}::ToggleFullResolution] Resetting resolution to ${module.OriginalWidth!}x${module.OriginalHeight!}`);
            module.ResolutionManager_SetResolution.invoke(module.OriginalWidth, module.OriginalHeight, true);
        }
    }
}
