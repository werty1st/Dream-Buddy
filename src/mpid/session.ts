

import {
  allServiceUuids,
  lookupService,
  type MpidConfig,
  type UUIDKey,
  type KnownService,
} from "./config";
import { parseMpidToken, type MpidToken } from "./token";
import { crypto as mpidCrypto, type MpidCrypto } from "./crypto";

type Chars = Partial<Record<UUIDKey, BluetoothRemoteGATTCharacteristic>>;

export const hex = (b: Uint8Array) =>
  [...b].map((x) => x.toString(16).padStart(2, "0")).join(" ");

export interface SessionEvents {
  onLog?: (msg: string) => void;
  onDiscovered?: (name: string, match?: KnownService) => void;
  onToken?: (token: MpidToken) => void;
  onDecrypted?: (data: Uint8Array) => void;
  onSessionReady?: () => void;
}


const MATTEL_MANUFACTURER_ID = 950;

export async function scan(): Promise<BluetoothDevice> {
  return navigator.bluetooth.requestDevice({
    filters: [
      { manufacturerData: [{ companyIdentifier: MATTEL_MANUFACTURER_ID }] },
      ...allServiceUuids().map((s) => ({ services: [s] })),
    ],
    optionalServices: allServiceUuids(),
  });
}

export class MpidPeripheral {
  private chars: Chars = {};
  private config?: MpidConfig;

  constructor(
    private device: BluetoothDevice,
    private events: SessionEvents = {},
    private crypto: MpidCrypto = mpidCrypto,
  ) {}

  private log(m: string) {
    this.events.onLog?.(m);
  }

  async connect(): Promise<void> {
    const name = this.device.name ?? this.device.id;
    this.device.addEventListener("gattserverdisconnected", () => this.log("disconnected"));
    const gatt = await this.device.gatt!.connect();
    this.log(`connected: ${name}`);

    const services = await gatt.getPrimaryServices();
    let matched: KnownService | undefined;
    for (const svc of services) {
      const known = lookupService(svc.uuid);
      if (known) {
        matched = known;
        break;
      }
    }
    this.events.onDiscovered?.(name, matched);
    if (!matched) {
      this.log("kein bekannter Service am Gerät.");
      return;
    }
    this.log(`device: ${matched.label}`);
    if (!matched.config) {
      this.log(`Transport für "${matched.label}" noch nicht implementiert (nur MagicBullet/MagicWand).`);
      return;
    }
    this.config = matched.config;

    const gattService = await gatt.getPrimaryService(this.config.uuids.SERVICE!);
    const byUuid = new Map<string, UUIDKey>();
    for (const [key, uuid] of Object.entries(this.config.uuids)) {
      byUuid.set(uuid.toLowerCase(), key as UUIDKey);
    }
    for (const ch of await gattService.getCharacteristics()) {
      const key = byUuid.get(ch.uuid.toLowerCase());
      if (key) this.chars[key] = ch;
    }
    this.log(`chars: ${Object.keys(this.chars).join(", ")}`);

    const rx = this.chars.RX;
    if (rx?.properties.notify || rx?.properties.indicate) {
      await rx.startNotifications();
      rx.addEventListener("characteristicvaluechanged", (e) => this.onRx(e));
    }

    const factory = this.chars.FACTORY;
    if (factory?.properties.read) {
      const v = await factory.readValue();
      await this.onFactory(new Uint8Array(v.buffer));
    } else {
      this.log("FACTORY nicht lesbar — kein Token, Handshake nicht möglich.");
    }
  }

  private async onFactory(bytes: Uint8Array): Promise<void> {
    const token = parseMpidToken(bytes);
    this.log(`FACTORY token: proto ${token.protocolVersion}, keyID ${token.keyID}, item ${token.itemNumber}`);
    this.events.onToken?.(token);
    try {
      const pubKeyAndSalt = await this.crypto.startSession(token);
      await this.write("SESSION", pubKeyAndSalt);
      this.events.onSessionReady?.();
    } catch (err) {
      this.log((err as Error).message);
    }
  }

  private async onRx(e: Event): Promise<void> {
    const v = (e.target as BluetoothRemoteGATTCharacteristic).value;
    if (!v) return;
    const raw = new Uint8Array(v.buffer);
    this.log(`rx raw: ${hex(raw)}`);
    try {
      const plain = await this.crypto.decrypt(raw);
      this.events.onDecrypted?.(plain);
    } catch (err) {
      this.log("rx: " + (err as Error).message);
    }
  }

  async send(plain: Uint8Array): Promise<void> {
    const cipher = await this.crypto.encrypt(plain);
    await this.write("TX", cipher);
  }

  private async write(key: UUIDKey, data: Uint8Array): Promise<void> {
    const ch = this.chars[key];
    if (!ch) throw new Error(`characteristic ${key} nicht vorhanden`);
    if (!this.config) throw new Error("kein Transport erkannt");
    const chunks: Uint8Array[] = [];
    if (this.config.packageMaxSize > 0) {
      for (let i = 0; i < data.length; i += this.config.packageMaxSize) {
        chunks.push(data.slice(i, i + this.config.packageMaxSize));
      }
    } else {
      chunks.push(data);
    }
    const write = ch.properties.write
      ? ch.writeValueWithResponse.bind(ch)
      : ch.writeValueWithoutResponse.bind(ch);
    for (const c of chunks) await write(c as BufferSource);
  }

  disconnect(): void {
    this.device.gatt?.disconnect();
  }
}
