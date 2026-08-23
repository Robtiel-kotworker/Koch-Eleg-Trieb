# Electribe Clone

Ein hochwertiger Web-Klon der **Korg Electribe 2**: ein 16-Part-Step-Sequencer/Groovebox, der komplett im Browser läuft (React + TypeScript + Web Audio API).

## Features

- **16 Parts × 16 Steps**, je Step mit Velocity und Pitch-Lock ("Parameter Lock").
- **Pro Part**: Sample-Auswahl, Level, Pan, Pitch, Filter (Cutoff/Resonanz), Amp-Attack/Release, Mute/Solo.
- **Sample-genauer Sequencer** (Look-ahead-Scheduling, kein Timing-Drift), Tempo 40–300 BPM, Swing.
- **Eingebautes "Init Kit"**: 16 Drum-/Perc-Sounds werden zur Laufzeit per Web-Audio-Synthese erzeugt – kein Netzwerk, keine externen Dateien nötig, daher **immer verfügbar**, auch offline.
- **Eigene Sample-Packs**: beliebige lokale Audiodateien (WAV/MP3/OGG/FLAC/…) per Datei-Dialog importieren. Sie werden im Browser (IndexedDB) gespeichert und bleiben nach einem Reload erhalten.
- **Pattern-Verwaltung**: mehrere Patterns anlegen, duplizieren, umbenennen, löschen (persistiert in `localStorage`).

## Hinweis zum Sample-Pack "DAW Druck am wandern"

Das vom Nutzer erwähnte Sample-Pack aus "DAW Druck am wandern" ist **nicht** fest eingebettet, da zum Zeitpunkt der Entwicklung keine verifizierbare URL oder Datei dafür vorlag. Sobald die Quelle (URL oder ZIP-Datei) bereitgestellt wird, kann sie leicht als zusätzlicher, fest eingebauter Default-Pack ergänzt werden. Bis dahin sorgt das synthetisierte Init Kit dafür, dass die App sofort einsatzbereit ist, und eigene Packs lassen sich jederzeit über den Sample-Browser hinzufügen.

## Entwicklung

```bash
npm install
npm run dev      # Dev-Server
npm run build    # Typecheck + Produktions-Build
npm run lint     # oxlint
```

## Architektur

```
src/
  audio/
    AudioEngine.ts     # AudioContext, Master-Bus, Voice-Playback (Pitch/Filter/Pan/Envelope)
    synthKit.ts         # Synthese des eingebauten "Init Kit" (OfflineAudioContext)
    sampleStore.ts       # IndexedDB-Persistenz für importierte Sample-Packs
    scheduler.ts          # Look-ahead Sequencer-Clock
    useSequencer.ts        # React-Hook: verbindet Scheduler mit dem State-Store
  state/
    store.ts             # zustand-Store: Patterns, Parts, Steps, Transport
    defaultPattern.ts      # Default-/Demo-Pattern
  components/             # UI (Transport, Step-Grid, Part-Editor, Sample-Browser, …)
```
