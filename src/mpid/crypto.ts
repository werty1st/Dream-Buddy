import type { MpidToken } from "./token";

export interface MpidCrypto {
  startSession(token: MpidToken): Promise<Uint8Array>;
  encrypt(plain: Uint8Array): Promise<Uint8Array>;
  decrypt(cipher: Uint8Array): Promise<Uint8Array>;
}

const CRC8_TABLE = (() => {
  const t = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let b = 0; b < 8; b++) c = c & 0x80 ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff;
    t[i] = c;
  }
  return t;
})();

export function crc8(data: Uint8Array, init = 0xff): number {
  let crc = init;
  for (const b of data) crc = CRC8_TABLE[(b ^ crc) & 0xff];
  return crc;
}

const P = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn;
const B = 0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604bn;

function bytesToBig(b: Uint8Array): bigint {
  let n = 0n;
  for (const x of b) n = (n << 8n) | BigInt(x);
  return n;
}

function bigToBytes(n: bigint, len: number): Uint8Array {
  const out = new Uint8Array(len);
  for (let i = len - 1; i >= 0; i--, n >>= 8n) out[i] = Number(n & 0xffn);
  return out;
}

function modPow(base: bigint, exp: bigint, m: bigint): bigint {
  let r = 1n;
  base %= m;
  while (exp > 0n) {
    if (exp & 1n) r = (r * base) % m;
    base = (base * base) % m;
    exp >>= 1n;
  }
  return r;
}

export function decompressPoint(c: Uint8Array): Uint8Array {
  if (c.length !== 33 || (c[0] !== 0x02 && c[0] !== 0x03)) {
    throw new Error("kein komprimierter P-256-Punkt");
  }
  const x = bytesToBig(c.subarray(1));
  const y2 = (((x * x) % P) * x - 3n * x + B) % P;
  let y = modPow((y2 + P) % P, (P + 1n) / 4n, P);
  if ((y & 1n) !== BigInt(c[0] & 1)) y = P - y;
  const out = new Uint8Array(65);
  out[0] = 0x04;
  out.set(bigToBytes(x, 32), 1);
  out.set(bigToBytes(y, 32), 33);
  return out;
}

export function compressPoint(raw: Uint8Array): Uint8Array {
  if (raw.length !== 65 || raw[0] !== 0x04) throw new Error("erwarte unkomprimierten P-256-Punkt");
  const out = new Uint8Array(33);
  out[0] = 0x02 | (raw[64] & 1);
  out.set(raw.subarray(1, 33), 1);
  return out;
}


const subtle = () => globalThis.crypto.subtle;

async function aesCtr(
  key: Uint8Array,
  iv: Uint8Array,
  data: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  const k = await subtle().importKey("raw", key.slice(0, 16) as BufferSource, "AES-CTR", false, [
    "encrypt",
  ]);
  const out = await subtle().encrypt(
    { name: "AES-CTR", counter: iv as BufferSource, length: 128 },
    k,
    data as BufferSource,
  );
  return new Uint8Array(out);
}

export async function deriveSessionKey(sharedSecret: Uint8Array): Promise<Uint8Array> {
  let buf = new Uint8Array(sharedSecret.subarray(0, 32));
  const ctr = new Uint8Array(16);
  ctr.set(new TextEncoder().encode("mattel"), 9);
  for (let i = 0; i < 100; i++) {
    buf = await aesCtr(buf, ctr, buf);
    for (let j = 7; j >= 4; j--) if (++ctr[j] !== 0) break;
  }
  return buf;
}


export class MpidSession implements MpidCrypto {
  private privateKey?: CryptoKey;
  private sessionKey?: Uint8Array;
  private localSalt?: Uint8Array;
  private tokenSalt?: Uint8Array;
  private txSeq = 0;

  get established(): boolean {
    return this.sessionKey !== undefined;
  }

  async startSession(token: MpidToken): Promise<Uint8Array> {
    const pair = await subtle().generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
      "deriveBits",
    ]);
    this.privateKey = pair.privateKey;
    const ourRaw = new Uint8Array(await subtle().exportKey("raw", pair.publicKey));

    this.localSalt = globalThis.crypto.getRandomValues(new Uint8Array(4));
    this.tokenSalt = token.salt.slice(0, 4);

    const peer = await subtle().importKey(
      "raw",
      decompressPoint(token.publicKeyCompressed) as BufferSource,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      [],
    );
    const shared = new Uint8Array(
      await subtle().deriveBits({ name: "ECDH", public: peer }, this.privateKey, 256),
    );
    this.sessionKey = await deriveSessionKey(shared);
    this.txSeq = 0;

    const out = new Uint8Array(37);
    out.set(compressPoint(ourRaw), 0);
    out.set(this.localSalt, 33);
    return out;
  }


  private iv(seqBytes: Uint8Array, swapSalts: boolean): Uint8Array {
    const iv = new Uint8Array(16);
    iv.set(seqBytes, 0);
    iv.set(swapSalts ? this.tokenSalt! : this.localSalt!, 4);
    iv.set(swapSalts ? this.localSalt! : this.tokenSalt!, 8);
    return iv;
  }

  async encrypt(payload: Uint8Array): Promise<Uint8Array> {
    if (!this.sessionKey) throw new Error("Session nicht etabliert");
    const seq = ++this.txSeq;
    const bodyLen = payload.length + 1; 

    const hdr = new Uint8Array(8);
    hdr[0] = 0x7e;
    hdr[1] = (seq >>> 24) & 0xff;
    hdr[2] = (seq >>> 16) & 0xff;
    hdr[3] = (seq >>> 8) & 0xff;
    hdr[4] = seq & 0xff;
    hdr[5] = (bodyLen >>> 8) & 0xff;
    hdr[6] = bodyLen & 0xff;
    hdr[7] = crc8(hdr.subarray(0, 7));

    const body = new Uint8Array(bodyLen);
    body.set(payload, 0);
    body[payload.length] = crc8(payload);

    const enc = await aesCtr(this.sessionKey, this.iv(hdr.subarray(1, 5), false), body);
    const pkt = new Uint8Array(8 + bodyLen);
    pkt.set(hdr, 0);
    pkt.set(enc, 8);
    return pkt;
  }

  /** MPID-Paket von RX -> Payload. */
  async decrypt(pkt: Uint8Array): Promise<Uint8Array> {
    if (!this.sessionKey) throw new Error("Session nicht etabliert");
    if (pkt.length < 9) throw new Error("Paket zu kurz");
    const hdr = pkt.subarray(0, 8);
    if (hdr[0] !== 0x7e) throw new Error(`kein MPID-Paket (SOF ${hdr[0].toString(16)})`);
    if (crc8(hdr.subarray(0, 7)) !== hdr[7]) throw new Error("Header-CRC falsch");

    const bodyLen = (hdr[5] << 8) | hdr[6];
    if (pkt.length < 8 + bodyLen) throw new Error("Body unvollständig");

    const body = await aesCtr(
      this.sessionKey,
      this.iv(hdr.subarray(1, 5), true),
      pkt.subarray(8, 8 + bodyLen),
    );
    const payload = body.subarray(0, bodyLen - 1);
    if (crc8(payload) !== body[bodyLen - 1]) throw new Error("Body-CRC falsch");
    return payload;
  }
}

export const crypto = new MpidSession();
