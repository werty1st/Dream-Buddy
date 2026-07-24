

export const Service = { GENERAL: 0x00, SSI0: 0x01, SSI1: 0x02 } as const;
export const SpiCommand = { WRITE: 1, READ: 2, WRITE_READ: 3, CANCEL: 4, ENABLE_RX: 5 } as const;

export const ReportID: Record<number, string> = {
  0: "VERSION",
  1: "HEAP_INFO",
  2: "BATTERY_VOLTAGE",
  3: "HAS_CRASH_DUMP",
  4: "CRASH_DUMP_INFO",
  5: "ECHO",
  127: "CMD_RECEIVED",
};

export function composeRequest(data: Uint8Array): Uint8Array {
  let xor = data.length & 0xff;
  for (const b of data) xor ^= b;
  const out = new Uint8Array(data.length + 3);
  out[0] = 0xfe;
  out[1] = data.length & 0xff;
  out.set(data, 2);
  out[data.length + 2] = xor & 0xff;
  return out;
}

export function parseResponse(b: Uint8Array): Uint8Array | null {
  if (b.length < 3 || b[0] !== 0xfe) return null;
  const len = b[1] & 0xff;
  if (b.length < len + 3) return null;
  let xor = 0;
  for (let i = 1; i <= len + 1; i++) xor ^= b[i];
  if ((xor & 0xff) !== b[len + 2]) return null;
  return b.slice(2, 2 + len);
}

export function spiRequest(
  payload: Uint8Array,
  command: number = SpiCommand.WRITE,
  addr = 0,
  service: number = Service.SSI0,
): Uint8Array {
  const out = new Uint8Array(payload.length + 2);
  out[0] = service;
  out[1] = ((command << 4) & 0xf0) | (addr & 0x0f);
  out.set(payload, 2);
  return out;
}

export const wrap = (inner: Uint8Array): Uint8Array => spiRequest(composeRequest(inner));


export const enableReadTransmission = (): Uint8Array =>
  spiRequest(new Uint8Array([1]), SpiCommand.ENABLE_RX);

export type Decoded =
  | { service: "SSI"; command: number; addr: number; app: Uint8Array | null; raw: Uint8Array }
  | {
      service: "GENERAL";
      report: number;
      reportName: string;
      data: Uint8Array;
      // Nur bei CMD_RECEIVED (report 127) gesetzt: GeneralService.Response.CommandReceived.
      cmdReceived?: { vsid: number; recvLen: number; status: number };
    }
  | { service: "UNKNOWN"; id: number; raw: Uint8Array };

/** MPID-Klartext -> dekodierte MagicBullet-Antwort. */
export function decode(data: Uint8Array): Decoded {
  const id = data[0];
  if (id === Service.SSI0 || id === Service.SSI1) {
    const spiPayload = data.slice(2);
    return {
      service: "SSI",
      command: (data[1] >> 4) & 0x0f,
      addr: data[1] & 0x0f,
      app: parseResponse(spiPayload),
      raw: spiPayload,
    };
  }
  if (id === Service.GENERAL) {
    const body = data.slice(2);
    // CMD_RECEIVED (127): [vsid, recvLen(LE16), status(LE32)] = 7 byte.
    const cmdReceived =
      data[1] === 127 && body.length >= 7
        ? { vsid: body[0], recvLen: body[1] | (body[2] << 8), status: body[3] | (body[4] << 8) | (body[5] << 16) | (body[6] << 24) }
        : undefined;
    return {
      service: "GENERAL",
      report: data[1],
      reportName: ReportID[data[1]] ?? `0x${data[1].toString(16)}`,
      data: body,
      cmdReceived,
    };
  }
  return { service: "UNKNOWN", id, raw: data };
}
