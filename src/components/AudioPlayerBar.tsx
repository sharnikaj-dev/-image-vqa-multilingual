import React, { useEffect, useRef, useState } from "react";
import {
  Download,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
} from "lucide-react";
import { VoiceName } from "../types/vqa";

interface AudioPlayerBarProps {
  audioBase64?: string;
  isSynthesizing?: boolean;
  audioError?: string;
  voiceUsed: VoiceName;
  languageName: string;
  bcp47: string;
  textToSpeak: string;
  autoPlay?: boolean;
  onGenerateSpeech: () => void;
}

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const mins = Math.floor(sec / 60);
  const secs = Math.floor(sec % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  audioBase64,
  isSynthesizing,
  audioError,
  voiceUsed,
  languageName,
  bcp47,
  textToSpeak,
  autoPlay,
  onGenerateSpeech,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const hasAutoPlayedRef = useRef(false);

  useEffect(() => {
    hasAutoPlayedRef.current = false;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    if (!audioBase64) {
      setAudioUrl(null);
      return;
    }

    const binary = atob(audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    setAudioUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [audioBase64]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    audio.playbackRate = playbackRate;

    if (autoPlay && !hasAutoPlayedRef.current) {
      hasAutoPlayedRef.current = true;
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }, [audioUrl, autoPlay, playbackRate]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const handleRestart = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setCurrentTime(0);
    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
    setCurrentTime(val);
  };

  const cycleRate = () => {
    const rates = [0.85, 1, 1.2];
    const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(next);
    if (audioRef.current) {
      audioRef.current.playbackRate = next;
    }
  };

  const handleDownloadWav = () => {
    if (!audioUrl) return;
    const link = document.createElement("a");
    link.href = audioUrl;
    link.download = `prismvoice-${languageName.toLowerCase().replace(/\s+/g, "-")}.wav`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleBrowserFallback = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = bcp47;
    utterance.rate = playbackRate;
    window.speechSynthesis.speak(utterance);
  };

  if (isSynthesizing) {
    return (
      <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-[#0B0F12] border border-[#232D35] text-xs text-slate-300">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0" />
        <span>
          Generating {languageName} speech with {voiceUsed} voice...
        </span>
      </div>
    );
  }

  if (!audioUrl) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 py-2.5 px-3 rounded-lg bg-[#0B0F12] border border-[#232D35]">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Volume2 className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            {audioError
              ? `Speech unavailable (${audioError})`
              : `Read aloud in ${languageName}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onGenerateSpeech}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#047857] text-white text-xs font-medium hover:bg-[#059669] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Generate Audio</span>
          </button>
          {typeof window !== "undefined" && "speechSynthesis" in window && (
            <button
              type="button"
              onClick={handleBrowserFallback}
              className="px-2.5 py-1.5 rounded-md border border-[#2A3640] bg-[#13191D] text-slate-200 text-xs font-medium hover:bg-[#192127] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Device Voice
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 py-2 px-3 rounded-lg bg-[#0B0F12] border border-[#232D35]">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        preload="metadata"
      />

      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? "Pause audio" : "Play audio"}
        className="w-8 h-8 rounded-md bg-[#047857] text-white flex items-center justify-center hover:bg-[#059669] transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      >
        {isPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4 ml-0.5" />
        )}
      </button>

      <button
        type="button"
        onClick={handleRestart}
        aria-label="Replay audio"
        className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-[#192127] transition-colors shrink-0 cursor-pointer"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>

      <div className="flex-1 min-w-[140px] flex items-center gap-2.5">
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.05}
          value={currentTime}
          onChange={handleSeek}
          aria-label="Audio progress"
          className="w-full accent-emerald-500 h-1.5 bg-[#232D35] rounded-lg cursor-pointer"
        />
        <span className="text-xs font-mono tabular-nums text-slate-400 whitespace-nowrap shrink-0">
          {formatSeconds(currentTime)} / {formatSeconds(duration)}
        </span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-xs text-slate-400 hidden sm:inline">
          {voiceUsed}
        </span>
        <button
          type="button"
          onClick={cycleRate}
          className="px-2 py-1 rounded border border-[#2A3640] bg-[#13191D] text-xs font-mono tabular-nums text-slate-200 hover:bg-[#192127] transition-colors cursor-pointer"
          title="Playback speed"
        >
          {playbackRate}×
        </button>
        <button
          type="button"
          onClick={handleDownloadWav}
          aria-label="Download WAV audio"
          title="Download WAV"
          className="p-1.5 rounded-md border border-[#2A3640] bg-[#13191D] text-slate-200 hover:bg-[#192127] transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
