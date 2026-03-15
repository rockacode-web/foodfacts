import { useEffect, useState } from "react";

interface VoiceControlsProps {
  summaryText: string;
}

const VoiceControls = ({ summaryText }: VoiceControlsProps) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState("");

  const handleSpeak = () => {
    if (!("speechSynthesis" in window)) {
      setSpeechError("Text-to-speech is not supported in this browser.");
      return;
    }

    setSpeechError("");
    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(summaryText);
    utterance.rate = 0.98;
    utterance.pitch = 1;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => {
      setIsSpeaking(false);
      setSpeechError("Unable to read aloud right now.");
    };

    setIsSpeaking(true);
    synth.speak(utterance);
  };

  const handleStop = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return (
    <div className="voice-card">
      <button type="button" className="ghost-action compact" onClick={handleSpeak}>
        Read Summary
      </button>
      <button
        type="button"
        className="ghost-action compact"
        onClick={handleStop}
        disabled={!isSpeaking}
      >
        Stop
      </button>
      {speechError && <p className="error-inline">{speechError}</p>}
    </div>
  );
};

export default VoiceControls;
