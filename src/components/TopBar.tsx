import React from "react";
import { Upload } from "lucide-react";

interface TopBarProps {
  onUploadClick: () => void;
  hasTurns: boolean;
  onExportTranscript: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onUploadClick,
  hasTurns,
  onExportTranscript,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#0B0F12]/95 backdrop-blur-sm border-b border-[#232D35]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#workspace"
          className="font-display text-xl font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-sm"
        >
          PrismVoice
        </a>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400"
        >
          <a
            href="#workspace"
            className="hover:text-slate-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Workspace
          </a>
          <a
            href="#samples"
            className="hover:text-slate-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Sample Scenes
          </a>
          <a
            href="#conversation"
            className="hover:text-slate-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Answers
          </a>
          {hasTurns ? (
            <button
              type="button"
              onClick={onExportTranscript}
              className="hover:text-slate-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Export Notes
            </button>
          ) : (
            <a
              href="#compare"
              className="hover:text-slate-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Comparison
            </a>
          )}
        </nav>

        {/* Zone 3: Single primary action button */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onUploadClick}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#047857] text-white text-sm font-medium hover:bg-[#059669] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F12] focus-visible:ring-emerald-400"
          >
            <Upload className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Upload Image</span>
          </button>
        </div>
      </div>
    </header>
  );
};
