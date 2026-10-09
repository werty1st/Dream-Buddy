# Dream Buddy

Web-App zur Steuerung des Mattel/Fisher-Price "Häschen"-Nachtlichts (MagicBullet-Hardware) direkt aus dem Browser — per **Web Bluetooth**, ohne Hersteller-App.

<img src="bunny1.jpg" alt="Dream Buddy Häschen" width="400">

## Funktionen

- Gerät suchen, koppeln und Session aufbauen (Token + Krypto wie in der Original-App)
- **Entspannung**: Musik + Licht an, bis gestoppt wird
- **Dauer**: Licht und Sound nach 5–20 min automatisch abschalten
- **Licht**: Helligkeit und Farbe (Warm, Rot, Gelb, Orange) getrennt einstellbar
- **Audio**: Lautstärke, Playlist, Wiedergabe stoppen
- **Aufwachlicht** (Schlaftrainer): Schlafens- und Aufstehzeit setzen; Bauch drücken leuchtet rot (liegen bleiben) bzw. grün (darf aufstehen). Läuft autonom im Häschen. Geräteuhr wird beim Verbinden gesetzt und zur Kontrolle zurückgelesen.
- **Weckruf**: Licht und Lautstärke nach 45–90 min sanft hochfahren (Tab muss offen bleiben)
- Geräte-Status abfragen (Global State, Batterie, Firmware)
- **Mehrsprachig**: Deutsch, Englisch, Spanisch, Französisch, Italienisch — Browsersprache wird voreingestellt, Auswahl oben rechts

## Installieren (PWA)

Die App ist eine Progressive Web App: In Chrome/Edge (Desktop) erscheint ein
Installations-Symbol in der Adressleiste, auf Android "Zum Startbildschirm
hinzufügen". Im Verbinden-Screen gibt es zusätzlich einen **App installieren**-Button,
sobald der Browser die Installation anbietet.

Ein Service Worker (`public/sw.js`) cached die App-Shell, die Oberfläche startet
also auch offline. Bluetooth selbst braucht natürlich weiterhin das Gerät.

## Voraussetzungen

Browser mit Web-Bluetooth-Support: Chrome, Edge oder Opera (Desktop/Android).
Safari und Firefox unterstützen die API **nicht**. HTTPS oder `localhost` ist Pflicht.

## Entwicklung

```bash
npm install
npm run dev      # Dev-Server auf http://localhost:5173
npm run build    # tsc + Production-Build nach dist/
npm run preview  # Build lokal testen
```

## Aufbau

| Datei | Zweck |
| --- | --- |
| `src/main.ts` | UI und Bedienlogik |
| `src/i18n.ts` | Übersetzungen und Spracherkennung |
| `src/mpid/session.ts` | Scan, GATT-Verbindung, Session-Handling |
| `src/mpid/config.ts` | GATT-UUIDs und MTU pro Hardware-Typ |
| `src/mpid/magicbullet.ts` | Transport-Layer: Framing, Checksumme, Reports |
| `src/mpid/bunny.ts` | Kommandos des Häschens (Licht, Audio, Timer, Aufwachlicht, Uhr) |
| `src/mpid/token.ts`, `crypto.ts` | Pairing-Token und Verschlüsselung |
| `public/sw.js`, `manifest.webmanifest` | PWA: Offline-Cache und Installations-Metadaten |

Das Protokoll ist aus der Original-Android-App (`com.mcpp.mattel.blekit`) portiert.

## Deployment

Push auf `main` baut und veröffentlicht automatisch auf GitHub Pages
(siehe `.github/workflows/pages.yml`). Einmalig nötig: in den Repo-Settings unter
**Pages → Source** "GitHub Actions" auswählen.

Live: https://werty1st.github.io/Dream-Buddy/

## Changelog

Siehe [CHANGELOG.md](CHANGELOG.md).

## Lizenz

Siehe [LICENSE](LICENSE). Kein offizielles Mattel-Produkt.
