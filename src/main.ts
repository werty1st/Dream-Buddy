import { scan, MpidPeripheral, hex } from "./mpid/session";
import { decode, enableReadTransmission } from "./mpid/magicbullet";
import {
  cmd,
  Command,
  soothing,
  setLedBrightness,
  setLightColor,
  turnOffLight,
  setVolume,
  turnOffAudio,
  playAudio,
  setPlaylistDuration,
  setCurrentDateFrom,
  requestGlobalState,
  decodeGlobalState,
  type GlobalState,
} from "./mpid/bunny";
import "./style.css";

// Lichtfarben (LEDColor) mit Anzeige-Swatch wie im "Beruhiger anpassen"-Screen.
const COLORS = [
  { id: 0, label: "Warm", css: "conic-gradient(#f87171,#fbbf24,#f97316,#f87171)" },
  { id: 1, label: "Rot", css: "#ef4444" },
  { id: 2, label: "Gelb", css: "#fde047" },
  { id: 3, label: "Orange", css: "#f97316" },
];

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <main>
    <header>
      <h1>Dream Buddy <details class="help"><summary>?</summary>
        <div class="help-body">
          <p><b>Entspannung</b> — Musik + Licht an, läuft bis du stoppst.</p>
          <p><b>Dauer</b> — schaltet Licht + Sound nach der eingestellten Zeit automatisch ab (5–20 min).</p>
          <p><b>Licht</b> — Helligkeit und Farbe getrennt einstellbar.</p>
        </div>
      </details></h1>
      <p class="status" id="status">nicht verbunden</p>
    </header>

    <section id="connect-view">
      <button id="scan">Gerät suchen</button>
      <button id="guide" class="ghost">Anleitung</button>
      <button id="install" class="ghost" hidden>App installieren</button>
    </section>

    <div id="wizard" hidden>
      <div class="wiz-card">
        <div class="wiz-head">
          <button id="wiz-back" class="ghost small">←</button>
          <span id="wiz-title">Koppeln</span>
          <button id="wiz-close" class="ghost small">✕</button>
        </div>
        <div class="wiz-art" id="wiz-art"></div>
        <h3 id="wiz-step"></h3>
        <p id="wiz-text"></p>
        <p class="wiz-hint" id="wiz-hint"></p>
        <div class="dots" id="wiz-dots"></div>
        <button id="wiz-next">Weiter</button>
      </div>
    </div>

    <section id="panel" hidden>
      <button id="soothe" class="big">Entspannung starten</button>

      <div class="card" id="light-card">
        <div class="card-head">
          <span>☀️ Licht</span>
          <input type="checkbox" id="light-toggle" class="switch" />
        </div>
        <input type="range" id="brightness" min="0" max="9" value="5" />
        <div class="colors" id="colors"></div>
      </div>

      <div class="card" id="music-card">
        <div class="card-head">
          <span>🎵 Musik und Sound</span>
          <input type="checkbox" id="music-toggle" class="switch" />
        </div>
        <input type="range" id="volume" min="0" max="9" value="5" />
        <select id="audio">
          <option value="0">Standard-Playlist</option>
          <option value="2">Naturgeräusche</option>
          <option value="3">Meeresrauschen</option>
          <option value="4">Weißes Rauschen</option>
        </select>
        <label class="row">Dauer
          <select id="duration">
            <option value="0">5 Min</option>
            <option value="1">10 Min</option>
            <option value="2">15 Min</option>
            <option value="3">20 Min</option>
          </select>
          <details class="help"><summary>?</summary>
            <div class="help-body">Schaltet Licht + Sound nach der eingestellten Zeit automatisch ab.</div>
          </details>
        </label>
      </div>

      <div class="card" id="wake-card">
        <div class="card-head"><span>⏰ Weckruf</span>
          <details class="help"><summary>?</summary>
            <div class="help-body">Nach der eingestellten Zeit fahren Licht und Lautstärke langsam von 0 auf 9 hoch (10 Stufen über ca. 5 Minuten). <b>Der Tab muss offen und verbunden bleiben</b> — das Häschen kann das nicht selbst.</div>
          </details>
        </div>
        <label class="row">In
          <select id="wake-delay">
            <option value="45">45 Min</option>
            <option value="60" selected>60 Min</option>
            <option value="90">90 Min</option>
          </select>
        </label>
        <div class="row">
          <button id="wake-start">Weckruf stellen</button>
          <button id="wake-cancel" class="ghost">Abbrechen</button>
        </div>
        <p class="state" id="wake-state"></p>
      </div>

      <p class="state" id="state"></p>
    </section>

    <pre id="log"></pre>
  </main>
`;

const $ = <T extends HTMLElement>(id: string) => document.querySelector<T>(id)!;
const statusEl = $<HTMLParagraphElement>("#status");
const stateEl = $<HTMLParagraphElement>("#state");
const logEl = $<HTMLPreElement>("#log");
const panel = $<HTMLElement>("#panel");
// Debug-Log nur mit #debug in der URL (Hash-Wechsel wirkt sofort, kein Reload).
const syncDebug = () => (logEl.hidden = !location.hash.includes("debug"));
syncDebug();
addEventListener("hashchange", syncDebug);

const log = (m: string) => (logEl.textContent = m + "\n" + logEl.textContent);

let peripheral: MpidPeripheral | undefined;
let ready = false;
let last: GlobalState | undefined; // zuletzt bekannter Gerätezustand

// Sendet nur wenn Session steht; Fehler landen im Log. `refresh` fragt danach
// GLOBAL_STATE ab, damit die UI (v.a. der Soothe-Button) den echten Zustand zeigt.
async function send(payload: Uint8Array, label: string, refresh = false) {
  if (!peripheral || !ready) return;
  try {
    await peripheral.send(payload);
    log("→ " + label);
    if (refresh) await peripheral.send(requestGlobalState());
  } catch (err) {
    log(`${label}: ${(err as Error).message}`);
  }
}

// ---------- GLOBAL_STATE -> UI spiegeln ----------

const MODE = ["Beruhiger", "Try-Me", "Wach", "Schlafenszeit", "Pairing", "Firmware", "Nap"];

function applyState(s: GlobalState) {
  last = s;
  $<HTMLInputElement>("#light-toggle").checked = s.ledOn;
  $<HTMLInputElement>("#brightness").value = String(s.ledBrightness);
  $<HTMLInputElement>("#music-toggle").checked = s.musicOn;
  $<HTMLInputElement>("#volume").value = String(s.volume);
  $<HTMLSelectElement>("#duration").value = String(s.playlistDuration);
  markColor(s.ledColor);
  const active = s.ledOn || s.musicOn;
  $<HTMLButtonElement>("#soothe").textContent = active ? "Entspannung stoppen" : "Entspannung starten";
  $<HTMLButtonElement>("#soothe").classList.toggle("on", active);
  stateEl.textContent =
    `Modus: ${MODE[s.operationMode] ?? s.operationMode} · Batterie: ${s.batteryStatus ? "schwach" : "ok"}`;
}

function markColor(id: number) {
  document.querySelectorAll<HTMLButtonElement>("#colors button").forEach((b) => {
    b.classList.toggle("sel", Number(b.dataset.color) === id);
  });
}

// ---------- Verbinden ----------

/** Scan + Connect. Von "Gerät suchen" und vom Guide genutzt. */
async function connectFlow(): Promise<boolean> {
  try {
    const device = await scan();
    statusEl.textContent = `${device.name ?? device.id} — verbinde…`;
    peripheral = new MpidPeripheral(device, {
      onLog: log,
      onDiscovered: (name, match) => (statusEl.textContent = `${name} — ${match?.label ?? "?"}`),
      onDecrypted: onData,
      onSessionReady: onPaired,
    });
    await peripheral.connect();
    return true;
  } catch (err) {
    statusEl.textContent = "Verbindung fehlgeschlagen";
    log("scan: " + (err as Error).message);
    return false;
  }
}

$<HTMLButtonElement>("#scan").addEventListener("click", () => connectFlow());

// Nach dem MPID-Handshake nur ENABLE_RX senden. Erst wenn das Gerät dessen
// Empfang bestätigt (CMD_RECEIVED recvLen=3 auf SSI0) ist es "ready" — dann
// laufen Pairing-Complete + Requests (wie notifyDeviceIsReady -> onConnect).
let deviceReadyDone = false;

async function onPaired() {
  ready = true;
  deviceReadyDone = false;
  statusEl.textContent = "verbunden ●";
  $<HTMLElement>("#connect-view").hidden = true;
  panel.hidden = false;
  await send(enableReadTransmission(), "read transmission an");
  // Fallback, falls das ready-Ack ausbleibt.
  setTimeout(() => onDeviceReady("timeout"), 1500);
}

async function onDeviceReady(via: string) {
  if (deviceReadyDone) return;
  deviceReadyDone = true;
  log(`device ready (${via})`);
  await send(cmd(Command.SEND_PAIRING_COMPLETE), "pairing complete");
  await send(setCurrentDateFrom(new Date()), "Uhrzeit gesetzt");
  await send(requestGlobalState(), "Status abgefragt");
}

// RX: MagicBullet dekodieren, GLOBAL_STATE (Response 2) in die UI spiegeln.
function onData(plain: Uint8Array) {
  log("  plain: " + hex(plain));
  const r = decode(plain);
  if (r.service === "SSI") {
    log(`  RX SSI cmd=${r.command} app=${r.app ? hex(r.app) : "(parse fail) raw=" + hex(r.raw)}`);
    if (r.app && r.app.length >= 9 && r.app[0] === 2) {
      applyState(decodeGlobalState(r.app.slice(1)));
    }
  } else if (r.service === "GENERAL") {
    log(`  RX GENERAL ${r.reportName}: ${hex(r.data)}${r.cmdReceived ? ` (vsid=${r.cmdReceived.vsid} len=${r.cmdReceived.recvLen} st=${r.cmdReceived.status})` : ""}`);
    // enable_rx (SSI0, 3 byte) bestätigt -> Gerät ist bereit.
    if (r.cmdReceived && r.cmdReceived.vsid === 1 && r.cmdReceived.recvLen === 3) {
      onDeviceReady("ack");
    }
  } else {
    log(`  RX ? 0x${r.id.toString(16)}: ${hex(r.raw)}`);
  }
}

// ---------- Controls ----------

// Soothing-Toggle auf einem Button: Entscheid aus dem echten Zustand (last),
// nicht aus dem Button selbst. refresh holt danach GLOBAL_STATE -> Label folgt.
$<HTMLButtonElement>("#soothe").addEventListener("click", () => {
  const active = last ? last.ledOn || last.musicOn : false;
  send(soothing(!active), active ? "soothing aus" : "soothing an", true);
});

$<HTMLInputElement>("#light-toggle").addEventListener("change", (e) => {
  const on = (e.target as HTMLInputElement).checked;
  send(on ? setLedBrightness(Number($<HTMLInputElement>("#brightness").value)) : turnOffLight(),
    on ? "Licht an" : "Licht aus", true);
});
$<HTMLInputElement>("#brightness").addEventListener("change", (e) =>
  send(setLedBrightness(Number((e.target as HTMLInputElement).value)), "Helligkeit", true));

$<HTMLInputElement>("#music-toggle").addEventListener("change", (e) => {
  const on = (e.target as HTMLInputElement).checked;
  send(on ? playAudio(Number($<HTMLSelectElement>("#audio").value)) : turnOffAudio(),
    on ? "Musik an" : "Musik aus", true);
});
$<HTMLInputElement>("#volume").addEventListener("change", (e) =>
  send(setVolume(Number((e.target as HTMLInputElement).value)), "Lautstärke", true));
$<HTMLSelectElement>("#audio").addEventListener("change", (e) =>
  send(playAudio(Number((e.target as HTMLSelectElement).value)), "Audio", true));
$<HTMLSelectElement>("#duration").addEventListener("change", (e) =>
  send(setPlaylistDuration(Number((e.target as HTMLSelectElement).value)), "Dauer"));


// ---------- Weckruf ----------
// Muss app-getrieben laufen: das Protokoll kennt kein Fade-/Ramp-Kommando,
// nur SET_LED_BRIGHTNESS / SET_VOLUME mit sofortiger Wirkung. Also schickt die
// App die Stufen einzeln — Tab muss offen und verbunden bleiben.

const RAMP_STEPS = 10; // Stufen 0..9
const RAMP_STEP_MS = 30_000; // ~5 Minuten gesamt

let wakeAt: number | undefined;
let wakeTick: number | undefined;
let wakeRamp: number | undefined;
let wakeLock: WakeLockSentinel | undefined;

const wakeState = $<HTMLParagraphElement>("#wake-state");

function cancelWake(msg = "") {
  clearInterval(wakeTick);
  clearInterval(wakeRamp);
  wakeAt = wakeTick = wakeRamp = undefined;
  wakeLock?.release().catch(() => {});
  wakeLock = undefined;
  wakeState.textContent = msg;
}

function tickWake() {
  if (!wakeAt) return;
  const left = Math.max(0, wakeAt - Date.now());
  const min = Math.floor(left / 60000);
  const sec = Math.floor((left % 60000) / 1000);
  wakeState.textContent = `Weckruf in ${min}:${String(sec).padStart(2, "0")}`;
  if (left <= 0) {
    clearInterval(wakeTick);
    wakeAt = undefined;
    runRamp();
  }
}

async function runRamp() {
  log("Weckruf: Rampe startet");
  let level = 0;
  // Bei 0 anfangen, damit es nicht schlagartig laut wird.
  await send(setVolume(0), "Weckruf Lautstärke 0");
  await send(setLedBrightness(0), "Weckruf Helligkeit 0");
  await send(soothing(true), "Weckruf: Licht + Musik an", true);

  wakeRamp = setInterval(async () => {
    level++;
    wakeState.textContent = `Weckruf läuft — Stufe ${level}/${RAMP_STEPS - 1}`;
    await send(setLedBrightness(level), `Helligkeit ${level}`);
    await send(setVolume(level), `Lautstärke ${level}`);
    if (level >= RAMP_STEPS - 1) cancelWake("Weckruf fertig");
  }, RAMP_STEP_MS);
}

$<HTMLButtonElement>("#wake-start").addEventListener("click", async () => {
  const min = Number($<HTMLSelectElement>("#wake-delay").value);
  cancelWake();
  wakeAt = Date.now() + min * 60_000;
  wakeTick = setInterval(tickWake, 1000);
  tickWake();
  // Bildschirmsperre verhindern — sonst schläft das Gerät und die Rampe stoppt.
  try {
    wakeLock = await navigator.wakeLock?.request("screen");
  } catch {
    log("Wake Lock nicht verfügbar — Bildschirm bitte an lassen");
  }
});

$<HTMLButtonElement>("#wake-cancel").addEventListener("click", () => cancelWake("abgebrochen"));

// Der Browser gibt den Wake Lock beim Tab-Wechsel frei — zurückholen.
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible" && (wakeAt || wakeRamp) && !wakeLock) {
    try {
      wakeLock = await navigator.wakeLock?.request("screen");
    } catch {
      /* ohne Wake Lock weiterlaufen */
    }
  }
});

// ---------- Guide / Onboarding (optional, hinter "Anleitung") ----------
// Nachgebaut aus screens/screen_pair_1..3.jpg. Kein Standardweg — der direkte
// "Gerät suchen"-Button bleibt unverändert.

interface WizStep {
  title: string;
  art: string;
  step: string;
  text: string;
  hint?: string;
  next: string;
  action?: () => Promise<boolean>;
}

const WIZ: WizStep[] = [
  {
    title: "Ein Produkt hinzufügen",
    art: "🐰",
    step: "Traumhäschen Schlafbegleiter",
    text: "Wählen Sie Ihr Smart Connect Produkt aus. Diese App unterstützt aktuell nur das Traumhäschen (GMN58).",
    next: "Auswählen",
  },
  {
    title: "Koppeln",
    art: "🔌",
    step: "Schritt 1",
    text: "Öffnen Sie den Rücken des Häschens und schieben Sie den Netz-/Lautstärkeschalter auf AN.",
    hint: "Hinweis: Achten Sie darauf, dass Ihr Gerät beim Koppeln nicht weiter als zwei Meter vom Häschen entfernt ist.",
    next: "Weiter",
  },
  {
    title: "Koppeln",
    art: "🎵",
    step: "Schritt 2",
    text: "Das Häschen spielt eine Melodie — es ist im Kopplungsmodus. Tippen Sie auf Koppeln und wählen Sie es im Browser-Dialog aus.",
    hint: "Die Melodie stoppt und die LED leuchtet kurz grün, sobald die Kopplung abgeschlossen ist.",
    next: "Koppeln",
    action: connectFlow,
  },
  {
    title: "Verbunden",
    art: "✅",
    step: "Erfolg!",
    text: "Traumhäschen Schlafbegleiter erfolgreich verbunden.",
    next: "Fertig",
  },
];

const wizard = $<HTMLDivElement>("#wizard");
let wizIdx = 0;

function renderWiz() {
  const s = WIZ[wizIdx];
  $<HTMLSpanElement>("#wiz-title").textContent = s.title;
  $<HTMLDivElement>("#wiz-art").textContent = s.art;
  $<HTMLHeadingElement>("#wiz-step").textContent = s.step;
  $<HTMLParagraphElement>("#wiz-text").textContent = s.text;
  $<HTMLParagraphElement>("#wiz-hint").textContent = s.hint ?? "";
  $<HTMLButtonElement>("#wiz-next").textContent = s.next;
  $<HTMLButtonElement>("#wiz-back").hidden = wizIdx === 0;
  $<HTMLDivElement>("#wiz-dots").innerHTML = WIZ.map(
    (_, i) => `<span class="dot${i === wizIdx ? " on" : ""}"></span>`,
  ).join("");
}

const closeWiz = () => (wizard.hidden = true);

$<HTMLButtonElement>("#guide").addEventListener("click", () => {
  wizIdx = 0;
  wizard.hidden = false;
  renderWiz();
});
$<HTMLButtonElement>("#wiz-close").addEventListener("click", closeWiz);
$<HTMLButtonElement>("#wiz-back").addEventListener("click", () => {
  if (wizIdx > 0) wizIdx--;
  renderWiz();
});
$<HTMLButtonElement>("#wiz-next").addEventListener("click", async () => {
  const s = WIZ[wizIdx];
  if (s.action) {
    const btn = $<HTMLButtonElement>("#wiz-next");
    btn.disabled = true;
    const ok = await s.action();
    btn.disabled = false;
    if (!ok) return; // auf dem Schritt bleiben, damit man es erneut versuchen kann
  }
  if (wizIdx === WIZ.length - 1) return closeWiz();
  wizIdx++;
  renderWiz();
});

// Farb-Swatches
const colorsEl = $<HTMLDivElement>("#colors");
for (const c of COLORS) {
  const b = document.createElement("button");
  b.dataset.color = String(c.id);
  b.title = c.label;
  b.style.background = c.css;
  b.addEventListener("click", () => {
    markColor(c.id);
    send(setLightColor(c.id), `Farbe ${c.label}`);
  });
  colorsEl.appendChild(b);
}

// --- PWA -------------------------------------------------------------------

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch((e) => log(`SW-Registrierung fehlgeschlagen: ${e}`));
  });
}

// Nicht in lib.dom, nur Chromium kennt das Event.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

// Chrome/Android: Installations-Button erst zeigen, wenn der Browser ihn anbietet.
const installBtn = $<HTMLButtonElement>("#install");
let deferredPrompt: BeforeInstallPromptEvent | null = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e as BeforeInstallPromptEvent;
  installBtn.hidden = false;
});

installBtn.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  await deferredPrompt.prompt();
  deferredPrompt = null;
  installBtn.hidden = true;
});

window.addEventListener("appinstalled", () => {
  installBtn.hidden = true;
});
