export const State = {
    // Movement
    noclip: false,
    customFov: false,
    fov: 3,
    freecam: false,
    customSpeed: false,
    speed: 5,
    moonWalk: false,
    invertControls: false,

    // ESP
    noShadows: false,
    revealRoles: false,
    seeGhosts: false,
    revealVotes: false,
    alwaysChat: false,

    // Vents
    unlockVents: false,
    walkInVents: false,

    // Roles
    killAnyone: false,
    noKillCd: false,
    killReach: false,
    killVanished: false,
    interrogateReach: false,
    trackReach: false,
    noShapeshiftAnim: false,
    endlessSsDuration: false,
    endlessVentTime: false,
    noVentCooldown: false,
    endlessBattery: false,
    noVitalsCooldown: false,
    endlessTracking: false,
    noTrackingCooldown: false,
    noTrackingDelay: false,

    // Host
    noGameEnd: false,
    voteImmune: false,
    noOptionsLimits: false,
    forcedRole: "" as string,

    // Doors
    autoOpenDoors: false,
    spamCloseDoors: false,
    spamOpenDoors: false,
    autoReportBodies: false,

    // Tracers
    tracersCrew: false,
    tracersImps: false,
    tracersGhosts: false,
    tracersBodies: false,
    colorTracers: false,
    distanceTracers: false,

    // Minimap
    mapCrew: false,
    mapImps: false,
    mapGhosts: false,
    colorMap: false,

    // Other ESP
    taskArrows: false,
    seePlayerInfo: false,
    seeLobbyInfo: false,

    // Animations (visible to other players)
    animCams: false,
    animScan: false,

    // Event log (written to the debug log file)
    logDeaths: false,
    logShapeshifts: false,
    logVents: false,
    logTasks: false,
    logGameState: false,
    copyLobbyCode: false,

    // Passive
    unlockCosmetics: true,
    unlockFreeChat: true,
    disableAnalytics: false,
    uwuifyMode: false,
    keyboardMode: false
};
