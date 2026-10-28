# PC → Mobil port analizi

Kaynak: `scp222thj/MalumMenu` (PC, BepInEx + Harmony + C#, `AmongUs.GameLibs.Steam 2026.9.29`, v3.3.1).
Hedef: bu repo (Frida + `frida-il2cpp-bridge` + `frida-java-menu`, TypeScript).

Durum işaretleri: ✅ mobilde var · 🟡 `feat/port-role-cheats` dalında eklendi (cihazda test edilmedi) · ⬜ portlanabilir, yapılmadı · 🚫 bilerek portlanmadı

> **Uyarı:** Aşağıdaki PC metod/alan adları PC derlemesinden (Il2CppInterop) alındı. Android derlemesi farklı bir oyun sürümü olabilir. Her hook `tryMethod` ile bulunmalı ve yoksa log basıp atlanmalı. Yoksa tek eksik metod tüm modülü düşürür.

---

## 1. Harmony → Frida çeviri kuralları

Bunlar yanlış yapılırsa özellik sessizce çalışmaz.

| PC (Harmony) | Mobil (frida-il2cpp-bridge) |
|---|---|
| `Postfix(__instance)` | `method.implementation = function (...args) { const r = (this as Il2Cpp.Object).method(name, n).invoke(...args); /* kodun */ return r; }` |
| `Prefix` → `return true` | orijinali çağır ve döndür |
| `Prefix` → `return false` (orijinali atla) | `invoke` çağırma, kendi dönüş değerini ver |
| `Prefix(ref float time)` argümanı değiştirme | değiştirilmiş argümanla `invoke(newArg)` |
| `Postfix(ref bool __result)` | `invoke` sonucunu al, değiştir, döndür |
| `ref bool canUse` (Vent.CanUse) | `Il2Cpp.Reference<boolean>`; `canUse.value = ...` |
| `PlayerControl.LocalPlayer` | `klass.field("LocalPlayer").value` (static) |
| `Foo.Instance` | `klass.method("get_Instance").invoke()` veya `.field("Instance")` |
| property `x.Data` | `x.method("get_Data").invoke()` |
| `new Il2CppSystem.Action(...)` | `Il2Cpp.delegate(...)`, bu repoda henüz yok. PPM için gerekecek |
| `Il2CppStructArray<T>` / `List<T>` | `Il2Cpp.Array` / `get_Count` + `get_Item(i)` ile döngü |
| enum (`SystemTypes.Reactor`) | sayıyı **yazma**. `UnityUtils.enumValue(klass, "Reactor")` kullan (numaralar sürümler arası kayıyor) |
| `typeof(X)` + namespace | `AssemblyHelper.findClass("X")`, kısa isimle arar. `AmongUs.GameOptions.*` tipleri için `class("RoleTypes")` namespace yüzünden fırlatabilir |

Ek kurallar:
- `Update`/`FixedUpdate`/`LateUpdate` her karede çalışır. Hata olursa toast'u **bir kez** göster (`reportOnce`).
- Hook edilen metod sınıfın kendisinde tanımlı değil de miras ise (`method.class.name !== klass.name`), taban sınıfı hook edersin ve **tüm rollere** uygulanır. `RoleCheats.findOwnMethod` bunu engelliyor.
- Menü callback'leri Java thread'inde çalışır, oyun nesnelerine dokunan her şey `UnityUtils.run(...)` ile ana thread'e alınmalı.
- Silinmiş Unity nesnesi: `isNull()` yetmez, `m_CachedPtr` kontrolü gerekir (`UnityUtils.cachedPtr`).

---

## 2. Özellik matrisi

### Movement
| Özellik | PC metodları | Durum |
|---|---|---|
| NoClip | `PlayerPhysics.LateUpdate` → `PlayerControl.Collider.enabled = !(noClip \|\| onLadder)` | ✅ (merdiven kontrolü bu dalda düzeltildi) |
| Hız | `PlayerControl.MyPhysics.Speed / GhostSpeed` | ✅ (kapatınca her karede 2.5'e yazma hatası düzeltildi, lobi hız çarpanını eziyordu) |
| Invert Controls | `MyPhysics.Speed = -abs(Speed)` | ⬜ kolay |
| Moonwalk | `PlayerPhysics.HandleAnimation` prefix → `ResetAnimState()` ve orijinali atla | ⬜ kolay |
| Teleport to Cursor | `NetTransform.RpcSnapTo(Camera.main.ScreenToWorldPoint(Input.mousePosition))` | ⬜ **mobilde sağ tık yok**: harita dokunuşuna veya buton + ekran merkezine uyarla |
| Teleport to Player | PPM seçimi → `NetTransform.RpcSnapTo(target.transform.position)` | ⬜ (PPM gerekir) |

### Roles
| Özellik | PC metodları | Durum |
|---|---|---|
| Complete My Tasks | `myTasks` döngüsü → `RpcCompleteTask(task.Id)` | ✅ |
| Reveal Roles | `PlayerPhysics.LateUpdate` → `cosmetics.SetName(...)`, `MeetingHud.Update` → `NameText.text` | ✅ |
| Kill Anyone | `ImpostorRole.IsValidTarget` postfix | 🟡 |
| Kill Reach | `ImpostorRole.FindClosestTarget` prefix (en yakın geçerli oyuncu, menzilsiz) | 🟡 |
| No Kill Cooldown | `PlayerControl.SetKillTimer` prefix (`time = 0`, **sadece host**) | 🟡 |
| No Shapeshift Anim | `PlayerControl.CmdCheckShapeshift` / `CmdCheckRevertShapeshift` (`shouldAnimate=false`) | 🟡 |
| Endless Shapeshift | `ShapeshifterRole.FixedUpdate` → `durationSecondsRemaining = float.MaxValue` | 🟡 |
| Engineer: Endless Vent / No Vent CD | `EngineerRole.FixedUpdate` → `inVentTimeRemaining`, `cooldownSecondsRemaining` + `AbilityButton.ResetCoolDown()` | 🟡 |
| Scientist: Endless Battery / No Vitals CD | `ScientistRole.Update` → `currentCharge`, `currentCooldown` | 🟡 |
| Tracker: Endless / No Cooldown | `TrackerRole.FixedUpdate` → `durationSecondsRemaining`, `cooldownSecondsRemaining`, `delaySecondsRemaining` | 🟡 |
| Tracker: No Track Delay | `MapBehaviour.Instance.trackedPointDelayTime = GetRoleFloat(FloatOptionNames.TrackerDelay)` | ⬜ |
| Kill vanished (Phantom) | `PhantomRole.IsValidTarget` postfix | ⬜ kolay (KillAnyone ile aynı kalıp) |
| Interrogate / Track Reach | `DetectiveRole` / `TrackerRole.FindClosestTarget` prefix | ⬜ kolay (KillReach ile aynı kalıp) |
| Set Fake Role | PPM → `RoleManager.Instance.SetRole(LocalPlayer, role)`. Anticheat yüzünden Shapeshifter/Phantom/Viper/Judge/Impostor sadece oyun başında atanmışsa; ölüyse sadece `CrewmateGhost/ImpostorGhost` | ⬜ (PPM gerekir) |
| Set Fake Alive | PPM → `LocalPlayer.Die(DeathReason.Exile, true)` / `Revive()` | ⬜ (PPM gerekir) |
| Tasks menüsü / Impostor Tasks | `TasksUI`, `OtherPatches` | ⬜ |
| *Endless Vanish, No Vanish Anim, See Disguises* | PC'de toggle var ama bu sürümde **uygulaması yok** | — |

### ESP / Kamera
| Özellik | PC metodları | Durum |
|---|---|---|
| No Shadows | `HudManager.Update` → `ShadowQuad.SetActive`; Fungle için `Mushroom.FixedUpdate` → `sporeMask.position.z` | ✅ (spor bulutu kısmı ⬜) |
| See Ghosts | `PlayerPhysics.LateUpdate` → ölü `myPlayer.Visible = true`; `PlayerControl.TurnOnProtection` (`visible=true`); `ChatController.AddChat` prefix (hayalet sohbeti) | ⬜ |
| Reveal Votes | `MeetingHud.Update` (`BloopAVoteIcon`, `VoteSpreader.Votes`), `PopulateResults` prefix, `LogicOptions(Normal).GetAnonymousVotes` → `false` | ⬜ |
| Always Chat | `HudManager.Update` → `Chat.gameObject.SetActive(true)`; `MatchInfoHudButton.Update` prefix | ⬜ |
| Zoom Out | `Camera.main.orthographicSize` + `HudManager.UICamera.orthographicSize` + `ResolutionManager.ResolutionChanged.Invoke(...)` | ⬜ **scroll yok → seekbar** |
| Freecam | `FollowerCamera.enabled=false`, kamera pozisyonu girdiyle | ⬜ **klavye ekseni yok → joystick/butonlar** |
| Spectate | PPM → `FollowerCamera.SetTarget(player)` | ⬜ (PPM gerekir) |
| Tracers | oyuncu GameObject'ine `LineRenderer` ekle, `HatManager.Instance.PlayerMaterial`; `DeadBody` etiketli nesneler | ⬜ |
| Minimap | `MapBehaviour.ShowNormalMap/FixedUpdate/Close` postfix, `HerePoint` kopyala | ⬜ (en zoru) |
| Task Arrows | `NormalPlayerTask.Initialize/FixedUpdate`, `AirshipUploadTask.FixedUpdate`, `Arrow.SetActive` | ⬜ |
| Player Info (seviye/platform) | `AmongUsClient.GetClientFromPlayerInfo(...).PlatformData`, `PlayerLevel` | ⬜ |
| Lobby Info | `GameContainer.SetupGameInfo` postfix | ⬜ |

### Ship / Sabotage
Hepsi `ShipStatus.Instance.RpcUpdateSystem(SystemTypes, byte amount)`: **sabotage = 128**, **onarım = 16**, kapı aç = `Id \| 64`.

| Özellik | Detay | Durum |
|---|---|---|
| Call Meeting | Client: `CmdReportDeadBody(null)`. Host: `MeetingRoomManager.AssignSelf` + `HudManager.OpenMeetingRoom` + `RpcStartMeeting(null)` | ✅ client yolu, host yolu ⬜ |
| Sabotage Reactor | Skeld/Mira/Dleks/Fungle `Reactor`, Polus `Laboratory`, Airship `HeliSabotage` | ✅ (bu dalda harita-duyarlı yapıldı; önceden `3` sabit sayıydı ve Polus/Airship'te çalışmazdı) |
| Sabotage All / Close All Doors | yukarıdaki + `RpcCloseDoorsOfType(room)` | ✅ |
| Oxygen / Comms / Lights **toggle + onarım** | Oxygen: `LifeSupp` (Airship/Polus/Fungle'da yok). Comms: harita 1 ve 5'te `HqHudSystemType` (onarım `16\|0` sonra `16\|1`). Lights: sabotage `4 \| rastgele 5 bit \| 128`, onarım = yanlış anahtarlar için `RpcUpdateSystem(Electrical, i)` | ⬜ (ShipStatus.FixedUpdate hook'unda durum okuma: `Systems[...].IsActive`) |
| Unfixable Lights | `RpcUpdateSystem(Electrical, 69)` (tekrar gönderince onarır) | ⬜ kolay |
| Mushroom Mixup / Spores | `MushroomMixupSabotage, 1`; `LocalPlayer.CmdCheckSporeTrigger(mushroom)` (`FungleShipStatus.sporeMushrooms`) | ⬜ |
| Open All Doors / Doors menüsü | `RpcUpdateSystem(Doors, door.Id \| 64)`, oda başına durum `AllDoors` | ⬜ |
| Auto-open doors on use | `DoorBreakerGame.Start`, `DoorCardSwipeGame.Begin`, `MushroomDoorSabotageMinigame.Begin` prefix | ⬜ |
| Close Meeting | `Destroy(MeetingHud.Instance.gameObject)` + `CoFadeFullScreen` + kamera/HUD resetleri, `ExileController.WrapUp` | ⬜ |
| Report Body | PPM → `CmdReportDeadBody(playerData)` | ⬜ (PPM gerekir) |
| Auto Report Bodies | `DeadBody.Reported`, `CmdReportDeadBody` | ⬜ kolay |
| Sabotage Map | `HudManager.ToggleMapVisible(MapOptions{Mode=Sabotage})` | ✅ |
| Unlock / Kick / Walk in Vents | `Vent.CanUse`, `ImpostorVentButton`, `VentilationSystem.Update(BootImpostors, id)`, `inVent=false; moveable=true` | ✅ (CanUse null-sırası hatası düzeltildi) |
| Animasyonlar (shields, asteroids, garbage, med scan, cams, pet) | `PlayerControl.PlayAnimation` + **`GameDataMessages` struct RPC'leri** (`RpcPlayAnimationMessage`, `RpcSetScannerMessage`, `RpcPetMessage`) `LateBroadcast*Message(Unsafe.As<IGameDataMessage>(..))`; cams: `RpcUpdateSystem(Security, 1)` | ⬜ **zor**: struct + `Unsafe.As` Frida'da elle kurulmalı. Cams/shields gibi `RpcUpdateSystem` olanlar kolay |

### Murder / Host-only
| Özellik | PC metodları | Durum |
|---|---|---|
| Kill Player / Kill All / Crew / Imps | `Utils.MurderPlayer`: her oyuncu için ham RPC (`StartRpcImmediately(LocalPlayer.NetId, RpcCalls.MurderPlayer, ...)`, `WriteNetObject(target)`, `Write((int)MurderResultFlags.Succeeded)`). Lobide kapalı | ⬜ (basit yol: `LocalPlayer.RpcMurderPlayer(target, true)`) |
| Telekill | `MurderPlayer` + `GetTruePosition()` + 0.25 sn sonra `RpcSnapTo` | ⬜ |
| Eject / Skip Meeting / Vote Immune | `MeetingHud.RpcVotingComplete(...)`, `CheckForEndVoting` prefix | ⬜ (host) |
| Force Role | `IntroCutscene.CoBegin` prefix, `RoleManager.SetRole` ile takas | ⬜ (host) |
| No Game End | `LogicGameFlowNormal/HnS.CheckEndCriteria` prefix `false`, `IsGameOverDueToDeath` → `false`, `GameManager.CheckTaskCompletion` → `false` | ⬜ kolay (host) |
| Force Start | `AmongUsClient.SendStartGame()` | ⬜ kolay (host, lobi) |
| No Options Limits | `PlayerControl.RpcSyncSettings` prefix, `IGameOptionsExtensions.GetAdjustedNumImpostors` | ⬜ (host) |
| Protect menüsü | `LocalPlayer.RpcProtectPlayer(player, colorId)` | ⬜ (host) |

### Chat
`ChatController.SendFreeChat` prefix (URL engeli), `ChatController.Update` (`characterLimit` 100→120), `SendChat` postfix (`timeSinceLastMessage`), `TextBoxTMP` yamaları (karakter/pano kısıtları): hepsi ⬜. Mobil klavye farklı çalıştığı için `TextBoxTMP` kısmı ayrıca test edilmeli.

### Passive
| Özellik | PC metodları | Durum |
|---|---|---|
| Free Cosmetics | `PlayerPurchasesData.GetPurchase` → `true` | ✅ |
| Full Resolution | `ResolutionManager.SetResolution` | ✅ (mobil'e özel) |
| UwUify, Keyboard Mode | — | ✅ (mobil'e özel) |
| **Disable Analytics** | `State.disableAnalytics` set ediliyor ama **hiçbir hook onu okumuyor**; toggle şu an hiçbir şey yapmıyor | ⚠️ bozuk, PC karşılığı `Privacy.NoTelemetry` |
| Console / loglar | `PlayerControl.MurderPlayer`, `Shapeshift`, `CompleteTask`, `Vent.EnterVent/ExitVent`, `AmongUsClient.CoStartGame/OnGameEnd` postfix | ⬜ kolay (`UnityLogger` zaten var) |
| Profil / keybind (`MalumProfile.txt`) | `CheatToggles.SaveTogglesToProfile` | ⬜ mobilde `sharedPreferences` (JSON) ile karşılanabilir |
| RGB / Stealth / Panic mode | `MenuUI` (OnGUI) | ⬜ PC arayüzüne özel, mobilde karşılığı yok denecek kadar az |

### Bilerek portlanmayanlar 🚫
- **Overload** (`Utils.Overload`, `OverloadHandler`, `OverloadUI`): hedef oyunculara toplu `Pet` RPC'si yağdırıp bağlantılarını düşürüyor. Diğer oyunculara karşı DoS, portlamadım.
- **Kimlik / yasak atlatma**: GuestMode + sahte friend code (`EOSManager.StartInitialLoginFlow`), `SystemInfo.deviceUniqueIdentifier` sahteleme, `Avoid Penalties` (`PlayerBanData.BanMinutesLeft`), yaş/ebeveyn kısıtı kaldırma (`EOSManager.IsMinorOrWaiting`, `IsFreechatAllowed`, `IsAllowedOnline`, `AccountManager.CanPlayOnline`), seviye/platform sahteleme. Karar senin, ama bunları ben yazmıyorum.

---

## 3. Mobil'e özgü sorunlar

1. **Oyuncu seçme menüsü (PPM):** PC'de `ShapeshifterMinigame`'i klonlayıp `Begin/SetPlayer` hook'larıyla özel listeye çeviriyor. Teleport, Kill Player, Spectate, Report Body, Eject, Set Fake Role/Alive hepsi buna dayanıyor. Oyun içi UI olduğu için dokunmatikte de çalışır. İhtiyaç: (a) `Il2Cpp.delegate` ile `Action` üretmek, (b) `NetworkedPlayerInfo` prefab klonu (`GameData.Instance.PlayerInfoPrefab`) ve `Outfits[Default]` doldurma, (c) `ShapeshifterMinigame.Begin` + `ShapeshifterPanel.SetPlayer` prefix'leri. **Tek seferde yazılırsa 8 özelliği açar**, bu yüzden bir sonraki öncelik.
2. **Girdi:** sağ tık, scroll, klavye ekseni yok (Teleport to Cursor, Zoom Out, Freecam). Seekbar/buton/dokunuş karşılıkları lazım.
3. **UI:** PC'de `OnGUI` pencereleri (Doors, Tasks, Roles, Console). Mobilde tek `frida-java-menu` paneli. Büyük listeler için sekme sayısı sınırlı kalır; `radioGroup`/dinamik liste kullanılmalı.
4. **Dinamik liste:** `frida-java-menu` öğeleri bir kez eklenir; oyuncu listesi gibi değişen içerik için "Yenile" butonu + `radioGroup` yeniden kurma gerekir ya da PPM yaklaşımı.
5. **Oyun sürümü:** PC `2026.9.29`, APK `19.0.0 (2026.9.29)`. Aynı kaynak sürüm olduğu için isimler büyük ölçüde örtüşmeli, ama Android'de strip edilmiş / inline edilmiş metodlar olabilir. Hook eklenmeden önce `Il2Cpp.dump()` ile metodun varlığı doğrulanmalı.

## 4. Önerilen sıra
1. Bu dal: rol cheat'leri + düzeltmeler → cihazda doğrula (özellikle `Reveal Roles`, `Sabotage Reactor`, `NoClip` merdiven).
2. Kolay toplu paket: Reveal Votes, See Ghosts, Always Chat, No Game End, Force Start, Unfixable Lights, Oxygen/Comms/Lights toggle'ları, Open All Doors, Auto Report Bodies, Moonwalk, Invert Controls, Disable Analytics düzeltmesi, Console logları.
3. PPM altyapısı → Teleport/Kill Player/Spectate/Report/Eject/Fake Role/Fake Alive.
4. Zoom Out, Tracers, Task Arrows, Minimap, animasyonlar.
