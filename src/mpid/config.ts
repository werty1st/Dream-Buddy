// GATT-Konfiguration pro Hardware-Typ. 1:1 portiert aus
// com/mcpp/mattel/blekit/peripheral/MpidConfig.java (GetXxxConfig()).
// Bunny/Häschen = MagicBullet (UUIDs 4cea..., MTU 65).

export type UUIDKey = "SERVICE" | "RX" | "TX" | "FACTORY" | "SESSION" | "OTA" | "OTA_CMD" | "OTA_DATA";

export interface MpidConfig {
  name: string;
  uuids: Partial<Record<UUIDKey, string>>;
  mtu: number;
  // >0 => Payload in Blöcke dieser Größe splitten (nRF). -1 => ganzer Write.
  packageMaxSize: number;
}

export const MagicBullet: MpidConfig = {
  name: "MagicBullet",
  uuids: {
    SERVICE: "4cea0001-c678-4202-b5d3-712dbb5e5b14",
    TX: "4cea0002-c678-4202-b5d3-712dbb5e5b14",
    RX: "4cea0003-c678-4202-b5d3-712dbb5e5b14",
    FACTORY: "4cea0004-c678-4202-b5d3-712dbb5e5b14",
    SESSION: "4cea0005-c678-4202-b5d3-712dbb5e5b14",
    OTA: "4cea0001-c678-4202-b5d3-712dbb5e5b14",
  },
  mtu: 65,
  packageMaxSize: -1,
};

export const MagicWand: MpidConfig = {
  name: "MagicWand",
  uuids: {
    SERVICE: "add60001-50dc-4344-98b2-f171d65cd5bd",
    TX: "add60002-50dc-4344-98b2-f171d65cd5bd",
    RX: "add60003-50dc-4344-98b2-f171d65cd5bd",
    FACTORY: "add60004-50dc-4344-98b2-f171d65cd5bd",
    SESSION: "add60005-50dc-4344-98b2-f171d65cd5bd",
  },
  mtu: 500,
  packageMaxSize: -1,
};

export const Nordic: MpidConfig = {
  name: "Nordic",
  uuids: {
    SERVICE: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
    TX: "6e400002-b5a3-f393-e0a9-e50e24dcca9e",
    RX: "6e400003-b5a3-f393-e0a9-e50e24dcca9e",
    FACTORY: "6e400004-b5a3-f393-e0a9-e50e24dcca9e",
    SESSION: "6e400005-b5a3-f393-e0a9-e50e24dcca9e",
  },
  mtu: 23,
  packageMaxSize: 20,
};

// Alle bekannten Service-UUIDs (aus FPConnectPeripheralType.java / FPUUIDConstants.java).
// label = Produktname. config = MPID-Transport, falls bekannt. Die FP_*-Familie
// (E2BCFFF0…) teilt sich einen älteren SmartConnect-Transport — Config noch offen.
export interface KnownService {
  service: string;
  label: string;
  config?: MpidConfig;
}

export const knownServices: KnownService[] = [
  { service: "4cea0001-c678-4202-b5d3-712dbb5e5b14", label: "MagicBullet (Bunny/GMN58, GLD09, MBDEV)", config: MagicBullet },
  { service: "add60001-50dc-4344-98b2-f171d65cd5bd", label: "MagicWand (GHP38)", config: MagicWand },
  { service: "e2bcfff0-39b2-a193-c63c-8ef1bb786d4a", label: "Swing" },
  { service: "e2bcfff0-39b2-a193-c63c-8ef1bb786d4b", label: "Mobile" },
  { service: "e2bcfff0-39b2-a193-c63c-8ef1bb786d4c", label: "Mobile Baby" },
  { service: "e2bcfff0-39b2-a193-c63c-8ef1bb786d4d", label: "Mobile Baby Audio" },
  { service: "e2bcfff0-39b2-a193-c63c-8ef1bb786d4e", label: "Swing Baby" },
  { service: "e2bcfff0-39b2-a193-c63c-8ef1bb786d50", label: "Soother" },
  { service: "e2bcfff0-39b2-a193-c63c-8ef1bb786d51", label: "Sleeper" },
  { service: "e2bcfff0-39b2-a193-c63c-8ef1bb786d52", label: "Mobile Baby 2" },
  { service: "e2bcfff0-39b2-a193-c63c-8ef1bb786d53", label: "Deluxe Sleeper" },
  { service: "e2bcfff0-39b2-a193-c63c-8ef1bb786d55", label: "Lamp Soother" },
  { service: "e2bcfff0-39b2-a193-c63c-8ef1bb786d56", label: "Mobile Seahorse" },
  { service: "e2bcfff0-39b2-a193-c63c-8ef1bb786d57", label: "Seahorse" },
  { service: "e2bcfff0-39b2-a193-c63c-8ef1bb786d58", label: "Bassinet" },
  { service: "e2bcfff0-39b2-a193-c63c-8ef1bb786d59", label: "Revolve Swing" },
  { service: "e2bcfff0-39b2-a193-c63c-8ef1bb786d5a", label: "FLG83" },
  { service: "e2bcfff0-39b2-a193-c63c-8ef1bb786d5c", label: "GDD39" },
];

export const allServiceUuids = (): string[] => knownServices.map((k) => k.service);

export const lookupService = (uuid: string): KnownService | undefined =>
  knownServices.find((k) => k.service === uuid.toLowerCase());
