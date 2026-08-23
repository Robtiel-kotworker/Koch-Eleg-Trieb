# Electribe Clone

Ein hochwertiger Web-Klon der **Korg Electribe 2**: ein 16-Part-Step-Sequencer/Groovebox, der  komplett im Browser läuft (React + TypeScript + Web Audio API).

## Features

- **16 Parts × 16 Steps**, je Step mit Velocity und Pitch-Lock ("Parameter Lock").
- **Pro Part**: Sample-Auswahl, Level, Pan, Pitch, Filter (Cutoff/Resonanz), Amp-Attack/Release, Mute/Solo.
- **Sample-genauer Sequencer** (Look-ahead-Scheduling, kein Timing-Drift), Tempo 40–300 BPM, Swing.
- **Eingebautes "Init Kit"**: 16 Drum-/Perc-Sounds werden zur Laufzeit per Web-Audio-Synthese erzeugt – kein Netzwerk, keine externen Dateien nötig, daher **immer verfügbar**, auch offline.
- **Eigene Sample-Packs**: beliebige lokale Audiodateien (WAV/MP3/OGG/FLAC/…) per Datei-Dialog importieren. Sie werden im Browser (IndexedDB) gespeichert und bleiben nach einem Reload erhalten.
- **Cloud-Bibliothek**: die komplette persönliche Sample-Sammlung des Nutzers (18.768 Dateien, 72 Ordner, ~8,7 GB, gehostet auf Cloudflare R2) ist im Sample-Browser durchsuchbar. Der Katalog (Dateinamen/Ordner) ist als kompaktes JSON-Manifest fest im Repo gebündelt und daher **sofort und offline durchsuchbar** – die eigentlichen Audiodaten werden erst beim ersten Antippen eines Samples nachgeladen und danach dauerhaft in IndexedDB gecacht (dann offline verfügbar, kein erneuter Download).
- **Pattern-Verwaltung**: mehrere Patterns anlegen, duplizieren, umbenennen, löschen (persistiert in `localStorage`).

## Zur Cloud-Bibliothek ("DAW Druck am wandern")

Das ursprünglich erwähnte Sample-Pack stellte sich als die komplette persönliche Sample-Sammlung des Nutzers heraus (18.768 Dateien, ~8,7 GB, Hardcore/Hardstyle-Kicks, Bässe, Vocals, Effekte etc. in 72 Ordnern, gehostet unter `pub-0d94543090fa4adca1cd861ae2e74df1.r2.dev`). 8,7 GB lassen sich nicht fest in eine Web-App/ein Git-Repo einbetten – deshalb der gewählte Ansatz:

1. Ein kompaktes Manifest (`public/cloud-samples/manifest.json`, ~1 MB) mit allen Datei-Pfaden + Größen ist fest im Repo und macht die **gesamte Sammlung sofort durchsuchbar**, auch offline.
2. Die eigentliche Audiodatei wird erst geladen, wenn ein Sample im "Cloud-Bibliothek"-Tab angeklickt wird (Fetch von der R2-URL, CORS ist dort korrekt für `*` freigegeben).
3. Nach dem ersten Laden wird das Sample dauerhaft in IndexedDB gecacht – ab dann ist es wie jedes lokal importierte Sample offline verfügbar, kein erneuter Download nötig.

Damit ist die Sammlung so "immer verfügbar", wie es für 8,7 GB in einer Web-App technisch sinnvoll möglich ist.

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
    sampleStore.ts       # IndexedDB-Persistenz für importierte + gecachte Cloud-Samples
    cloudLibrary.ts       # Manifest laden, URL-/ID-Auflösung für die Cloud-Bibliothek
    scheduler.ts            # Look-ahead Sequencer-Clock
    useSequencer.ts           # React-Hook: verbindet Scheduler mit dem State-Store
  state/
    store.ts             # zustand-Store: Patterns, Parts, Steps, Transport
    defaultPattern.ts      # Default-/Demo-Pattern
  components/             # UI (Transport, Step-Grid, Part-Editor, Sample-Browser, Cloud-Bibliothek, …)

public/
  cloud-samples/manifest.json  # Gebündelter Katalog der Cloud-Bibliothek (Namen + Größen, ~1 MB)
```
