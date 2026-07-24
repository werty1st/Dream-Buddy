export const Status = { OFF: 0, ON: 1 } as const;

export const LEDColor = { WARM_SPECTRUM: 0, RED: 1, YELLOW: 2, ORANGE: 3 } as const;

export const BatteryStatus = { OK: 0, LOW: 1 } as const;

export const OperationMode = {
  SOOTHER: 0,
  TRY_ME: 1,
  DAY_TIME_AWAKE: 2,
  SLEEPY_TIME: 3,
  PAIRING: 4,
  FIRMWARE_UPDATE: 5,
  NAP_TIME: 6,
} as const;

export const Stage = { NONE: 0, READY: 1, SETTLE: 2, SLEEP: 3 } as const;

export const Song = {
  NO_SONG: 0,
  HOME_SWEET_HOME: 1,
  ROCKABYE: 2,
  RAINING: 3,
  LULLABEAR: 4,
  MOZART: 5,
  ARE_YOU_SLEEPING: 6,
  LONDON_BRIDGE: 7,
  DVORAK_NEW_WORLD: 8,
  REST_YOUR_HEAD: 9,
  IF_THE_SEA: 10,
} as const;

export const AudioCommand = {
  DEFAULT_PLAYLIST: 0,
  CUSTOM_PLAYLIST: 1,
  SFX_NATURE: 2,
  SFX_OCEAN: 3,
  SFX_PINK_NOISE: 4,
} as const;

export const PlaylistOption = { DEFAULT_READY_SETTLE_SLEEP: 0, CUSTOM: 1 } as const;

export const PlaylistDuration = {
  MINUTES_5: 0,
  MINUTES_10: 1,
  MINUTES_15: 2,
  MINUTES_20: 3,
  MINUTE_1: 4,
} as const;

/** Alarm-Verzögerung. INACTIVE ist 9, nicht 0 — anders als bei NapDuration. */
export const Alarm = {
  ACTIVE: 0,
  AFTER_15_MIN: 1,
  AFTER_30_MIN: 2,
  AFTER_45_MIN: 3,
  AFTER_60_MIN: 4,
  AFTER_75_MIN: 5,
  AFTER_90_MIN: 6,
  AFTER_105_MIN: 7,
  AFTER_120_MIN: 8,
  INACTIVE: 9,
  AFTER_1_MIN: 10,
} as const;

/** Zeitraffer im Spielzeug — nur zum Testen von Timern. */
export const TimePrescaler = { NONE: 0, SCALE_10X: 1, SCALE_60X: 2, SCALE_3600X: 3 } as const;

export const TransmissionMode = { NORMAL: 0, FACTORY_TEST: 3 } as const;

/** Response-IDs = payload[0] einer Geräteantwort. */
export const Response = {
  GLOBAL_STATE: 2,
  BATTERY_STATUS: 16,
  OTA_COMPLETE_NOTIFICATION: 17,
  TOY_IC_FIRMWARE_VERSION: 18,
  CURRENT_DATE: 19,
  CURRENT_SONG: 20,
  CURRENT_VOLUME: 21,
  LED_STATUS: 22,
  LED_BRIGHTNESS: 23,
  LED_COLOR: 24,
  CURRENT_PLAYLIST: 25,
  PLAYLIST_DURATION: 26,
  TIMER_ABOUT_TO_EXPIRE_NOTIFICATION: 27,
  NAP_TIME_STATUS: 28,
  TRANSMISSION_MODE: 29,
  OPERATION_MODE: 30,
  ACTIVITY_STATE: 31,
  CURRENT_STAGE: 32,
  READY_TO_RISE_STATUS: 33,
  READY_TO_RISE_TIMES: 34,
  SLEEPY_TIME_TIMES: 35,
  NAP_TIME_ALARM_STATUS: 36,
  NAP_TIME_ALARM_TIME: 37,
  READY_TO_RISE_ALARM_STATUS: 38,
  READY_TO_RISE_ALARM_TIMES: 39,
  TIME_PRESCALER: 40,
} as const;

// ---------- Typen ----------

/** 0–9 bei VolumeLevel und LEDBrightnessLevel. */
export type Level = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface TimeOfDay {
  hour: number;
  minute: number;
}

/** Wochenplan, Reihenfolge wie im Protokoll: Sonntag zuerst. */
export interface WeekSchedule {
  sunday?: TimeOfDay;
  monday?: TimeOfDay;
  tuesday?: TimeOfDay;
  wednesday?: TimeOfDay;
  thursday?: TimeOfDay;
  friday?: TimeOfDay;
  saturday?: TimeOfDay;
}

/** Dekodierte GLOBAL_STATE-Antwort (Response 2, 8 Byte / 16 Nibbles). */
export interface GlobalState {
  batteryStatus: number;
  operationMode: number;
  activityState: number;
  musicStatus: number;
  currentSong: number;
  volume: Level;
  playlistDuration: number;
  ledStatus: number;
  ledBrightness: Level;
  ledColor: number;
  napTimeStatus: number;
  napDuration: number;
  r2rStatus: number;
  r2rAlarmStatus: number;
  timePrescaler: number;
  stage: number;
}

/** Teil-Update über SET_GLOBAL_STATE; weggelassene Felder bleiben unverändert (Nibble 0x0F). */
export interface GlobalStatePatch {
  lightsOn?: boolean;
  brightness?: Level;
  musicOn?: boolean;
  volume?: Level;
  r2rEnabled?: boolean;
  r2rAlarmEnabled?: boolean;
  napAlarmEnabled?: boolean;
}

// ---------- Zu implementierende Encoder ----------
// Jede Funktion liefert den fertigen MPID-Payload (analog zu bunny.ts cmd()).

export interface BunnyCommands {
  // Licht
  setLedBrightness(level: Level): Uint8Array;
  setLightColor(color: number): Uint8Array;
  turnOffLight(): Uint8Array;

  // Ton
  setVolume(level: Level): Uint8Array;
  playAudio(audio: number): Uint8Array;
  turnOffAudio(): Uint8Array;
  setMusicPlaylist(option: number, songs: number[]): Uint8Array;
  setPlaylistDuration(duration: number): Uint8Array;

  // Sammel-Update
  setGlobalState(patch: GlobalStatePatch): Uint8Array;

  // Zeit — Voraussetzung dafür, dass Timer im Spielzeug laufen
  setCurrentDate(d: { hour: number; minute: number; second: number; weekday: number }): Uint8Array;
  setTimePrescaler(scale: number): Uint8Array;

  // Ready-to-Rise / Sleepy Time
  setR2RStatus(enabled: boolean): Uint8Array;
  setR2RTimes(week: WeekSchedule): Uint8Array;
  setSleepyTimes(week: WeekSchedule): Uint8Array;
  setR2RAlarms(week: Record<keyof WeekSchedule, number>): Uint8Array;

  // Nap
  setNapTimeAlarm(alarm: number): Uint8Array;

  // Abfragen — Antwort kommt als Response, siehe decodeResponse
  requestGlobalState(): Uint8Array;
  requestBatteryStatus(): Uint8Array;
  requestCurrentDate(): Uint8Array;
  requestVolume(): Uint8Array;
  requestLedBrightness(): Uint8Array;
  requestLightColor(): Uint8Array;
  requestSongPlaying(): Uint8Array;
  requestMusicPlaylist(): Uint8Array;
  requestPlaylistDuration(): Uint8Array;
  requestOperationMode(): Uint8Array;
  requestNapTimeStatus(): Uint8Array;
  requestToyIcFwVersion(): Uint8Array;
}

// ---------- Zu implementierende Decoder / Helfer ----------

/** FPBinaryManipulationKt.twoDigitNumberToBcd — undefined ergibt 0xFF (= unverändert). */
export type Bcd = (n: number | undefined) => number;

/** FPBinaryManipulationKt.reduceLowNibbles — je zwei Bytes zu einem Nibble-Paar. */
export type ReduceLowNibbles = (bytes: number[]) => Uint8Array;

/** GLOBAL_STATE (Response 2) in Felder zerlegen. */
export type DecodeGlobalState = (payload: Uint8Array) => GlobalState;

/** Beliebige Geräteantwort auf Response-ID + Rohdaten aufteilen. */
export type DecodeResponse = (payload: Uint8Array) => { id: number; name: string; data: Uint8Array };
