

export interface MpidToken {
  protocolVersion: number;
  isMagicDevice: boolean;
  keyID: number;
  configTableID: number;
  machineNumber: number;
  serial: Uint8Array;
  publicKeyCompressed: Uint8Array;
  signature: Uint8Array; // 64 byte
  salt: Uint8Array; // 4 byte
  day: string;
  year: string;
  location: string;
  apNumber: string;
  itemNumber: string;
  revision: string;
}

function bytesToInt(b: Uint8Array): number {
  let i = 0;
  for (let n = 0; n < b.length; n++) {
    i |= b[n] & 0xff;
    if (n !== b.length - 1) i <<= 8;
  }
  return i >>> 0;
}

const ascii = (b: Uint8Array) => new TextDecoder("ascii").decode(b);

export function parseMpidToken(buf: Uint8Array): MpidToken {
  const protocolVersion = buf[0];
  const gen1 = protocolVersion === 1 && buf.length === 136;

  const serial = buf.slice(1, 25);
  const publicKeyCompressed = buf.slice(25, 58);
  const machineBytes = buf.slice(63, 65);
  const machineNumber = ((machineBytes[0] & 0xff) << 8) | (machineBytes[1] & 0xff);
  const keyID = bytesToInt(buf.slice(65, 68));

  let configTableID = 0;
  let signature: Uint8Array;
  let salt: Uint8Array;

  if (gen1) {
    signature = buf.slice(68, 132);
    salt = buf.slice(132, 136);
  } else {
    let i = 68;
    if (protocolVersion === 10) {
      configTableID = bytesToInt(buf.slice(68, 70));
      i = 70;
    }
    const tableLen = buf.length - 64 - 4 - i;
    const sigStart = i + tableLen;
    signature = buf.slice(sigStart, sigStart + 64);
    salt = buf.slice(sigStart + 64, sigStart + 68);
  }

  return {
    protocolVersion,
    isMagicDevice: !gen1,
    keyID,
    configTableID,
    machineNumber,
    serial,
    publicKeyCompressed,
    signature,
    salt,
    day: ascii(serial.slice(0, 3)),
    year: ascii(serial.slice(3, 4)),
    location: ascii(serial.slice(4, 6)),
    apNumber: ascii(serial.slice(6, 16)),
    revision: ascii(serial.slice(16, 18)),
    itemNumber: ascii(serial.slice(18, 24)),
  };
}
