import { wrap } from "./magicbullet";

export const Command = {
  SET_GLOBAL_ON: 3,
  SET_GLOBAL_STATE: 1,
  REQUEST_GLOBAL_STATE: 83,
  REQUEST_BATTERY_STATUS: 84,
  SET_CURRENT_DATE: 48,
  REQUEST_CURRENT_DATE: 49,
  SEND_PAIRING_COMPLETE: 52,
  REQUEST_TOYIC_FW_VERSION: 53,
  SET_LED_BRIGHTNESS: 58,
  REQUEST_LED_BRIGHTNESS: 59,
  SET_LIGHT_COLOR: 60,
  REQUEST_LIGHT_COLOR: 61,
  TURN_OFF_LIGHT: 62,
  SET_VOLUME: 55,
  REQUEST_VOLUME: 57,
  TURN_OFF_AUDIO: 56,
  PLAY_AUDIO: 63,
  REQUEST_SONG_PLAYING: 85,
  SET_MUSIC_PLAYLIST: 64,
  REQUEST_MUSIC_PLAYLIST: 65,
  SET_PLAYLIST_DURATION: 66,
  REQUEST_PLAYLIST_DURATION: 67,
  SET_R2R_STATUS: 68,
  REQUEST_R2R_STATUS: 69,
  SET_R2R_TIMES: 70,
  REQUEST_R2R_TIMES: 71,
  SET_SLEEPY_TIMES: 72,
  REQUEST_SLEEPY_TIMES: 73,
  SET_R2R_ALARMS: 74,
  REQUEST_R2R_ALARM_STATUS: 75,
  REQUEST_R2R_ALARMS: 76,
  START_NAP_TIME: 77,
  REQUEST_CURRENT_NAP_TIME_STATUS: 78,
  SET_NAP_TIME_ALARM: 79,
  REQUEST_NAP_TIME_ALARM_STATUS: 80,
  REQUEST_NAP_TIME_ALARM: 81,
  SET_TIME_PRESCALER: 82,
  REQUEST_TIME_PRESCALER: 115,
  REQUEST_OPERATION_MODE: 114,
  REQUEST_ACTIVITY_STATE: 116,
  REQUEST_CURRENT_STAGE: 117,
  REQUEST_TRANSMISSION_MODE: 118,
} as const;

export const cmd = (id: number, ...args: number[]) => wrap(new Uint8Array([id, ...args]));

export const NapDuration: Record<number, number> = {
  1: 15,
  2: 30,
  3: 45,
  4: 60,
  5: 75,
  6: 90,
  7: 105,
  8: 120,
  9: 150,
  10: 180,
};
export const NAP_INACTIVE = 0;


export const soothing = (on: boolean) => cmd(Command.SET_GLOBAL_ON, on ? 1 : 0);


export const nap = (duration: number) => cmd(Command.START_NAP_TIME, duration);


export const bcd = (n: number | undefined): number =>
  n == null ? 0xff : (n % 10) | (Math.floor(n / 10) << 4);

export function reduceLowNibbles(bytes: number[]): Uint8Array {
  const b = bytes.length % 2 === 1 ? [0, ...bytes] : bytes;
  const out = new Uint8Array(b.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = (b[2 * i + 1] & 0x0f) | ((b[2 * i] << 4) & 0xf0);
  return out;
}

// ---------- Einzelkommandos (FPBunnyModel.java) ----------

export const setLedBrightness = (level: number) => cmd(Command.SET_LED_BRIGHTNESS, level);
export const setLightColor = (color: number) => cmd(Command.SET_LIGHT_COLOR, color);
export const turnOffLight = () => cmd(Command.TURN_OFF_LIGHT);

export const setVolume = (level: number) => cmd(Command.SET_VOLUME, level);
export const playAudio = (audio: number) => cmd(Command.PLAY_AUDIO, audio);
export const turnOffAudio = () => cmd(Command.TURN_OFF_AUDIO);
export const setPlaylistDuration = (duration: number) => cmd(Command.SET_PLAYLIST_DURATION, duration);

export const setCurrentDate = (hour: number, minute: number, second: number, weekday: number) =>
  cmd(Command.SET_CURRENT_DATE, bcd(hour), bcd(minute), bcd(second), bcd(weekday));

export const setCurrentDateFrom = (d: Date) =>
  setCurrentDate(d.getHours(), d.getMinutes(), d.getSeconds(), d.getDay() + 1);

export const requestGlobalState = () => cmd(Command.REQUEST_GLOBAL_STATE);
export const requestBatteryStatus = () => cmd(Command.REQUEST_BATTERY_STATUS);
export const requestNapStatus = () => cmd(Command.REQUEST_CURRENT_NAP_TIME_STATUS);

// ---------- GLOBAL_STATE (Response 2) dekodieren ----------

const lo = (b: number) => b & 0x0f;
const hi = (b: number) => (b >> 4) & 0x0f;

export interface GlobalState {
  batteryStatus: number; // 0=OK, 1=LOW
  operationMode: number; // 0..6
  activityState: number; // Status 0/1
  musicOn: boolean;
  currentSong: number;
  volume: number; // 0..9
  playlistDuration: number;
  ledOn: boolean;
  ledBrightness: number; // 0..9
  ledColor: number; // 0..3
  napOn: boolean;
  napDuration: number; // NapDuration-ID
  r2rOn: boolean;
  r2rAlarmOn: boolean;
  timePrescaler: number;
  stage: number; // 0=None,1=Ready,2=Settle,3=Sleep
}


export function decodeGlobalState(data: Uint8Array): GlobalState {
  return {
    batteryStatus: hi(data[0]),
    operationMode: lo(data[0]),
    activityState: hi(data[1]),
    musicOn: lo(data[1]) === 1,
    currentSong: hi(data[2]),
    volume: lo(data[2]),
    playlistDuration: hi(data[3]),
    ledOn: lo(data[3]) === 1,
    ledBrightness: hi(data[4]),
    ledColor: lo(data[4]),
    napOn: hi(data[5]) === 1,
    napDuration: lo(data[5]),
    r2rOn: hi(data[6]) === 1,
    r2rAlarmOn: lo(data[6]) === 1,
    timePrescaler: hi(data[7]),
    stage: lo(data[7]),
  };
}
