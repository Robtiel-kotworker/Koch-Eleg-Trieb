import { useEffect, useState } from 'react';
import { useRecorder } from './audio/useRecorder';
import { useSequencer } from './audio/useSequencer';
import { useAppStore } from './state/store';
import { PartEditor } from './components/PartEditor';
import { PartStrip } from './components/PartStrip';
import { PatternManager } from './components/PatternManager';
import { SampleBrowser } from './components/SampleBrowser';
import { StepGrid } from './components/StepGrid';
import { TransportBar } from './components/TransportBar';

function App() {
  const audioReady = useAppStore((s) => s.audioReady);
  const [sampleBrowserOpen, setSampleBrowserOpen] = useState(false);
  const { currentStep, playing, togglePlay } = useSequencer();
  const { status: recorderStatus, message: recorderMessage, toggleRecording } = useRecorder();

  useEffect(() => {
    void useAppStore.getState().init();
  }, []);

  return (
    <div className="app">
      <TransportBar
        isPlaying={playing}
        onTogglePlay={() => void togglePlay()}
        onOpenSampleBrowser={() => setSampleBrowserOpen(true)}
        recorderStatus={recorderStatus}
        recorderMessage={recorderMessage}
        onToggleRecording={toggleRecording}
      />

      <PatternManager />

      {!audioReady && <p className="loading-banner">Lade Init Kit &amp; gespeicherte Sample-Packs…</p>}

      <PartStrip />
      <StepGrid currentStep={currentStep} isPlaying={playing} />
      <PartEditor onOpenSampleBrowser={() => setSampleBrowserOpen(true)} />

      {sampleBrowserOpen && <SampleBrowser onClose={() => setSampleBrowserOpen(false)} />}

      <footer className="app-footer">
        Eleg-Trieb Clone · Samples werden lokal im Browser gespeichert (IndexedDB) und stehen offline zur Verfügung.
      </footer>
    </div>
  );
}

export default App;
