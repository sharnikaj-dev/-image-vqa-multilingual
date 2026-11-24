import React, { useState } from "react";
import { Download, Share2, Check, X } from "lucide-react";
import { usePWAInstall } from "../hooks/usePWAInstall";

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const handleCopyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // Ignore clipboard errors
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        {!isInstalled && (
          <>
            {isInstallable ? (
              <button
                type="button"
                onClick={install}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#13191D] border border-emerald-500/50 text-emerald-300 text-xs font-medium hover:bg-emerald-500/10 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Install App</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowGuideModal(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#13191D] border border-[#2A3640] text-slate-200 text-xs font-medium hover:border-emerald-500/50 hover:text-emerald-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isIOS ? "Install on iOS" : "Install App"}</span>
              </button>
            )}
          </>
        )}

        <button
          type="button"
          onClick={handleCopyShareUrl}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#13191D] border border-[#2A3640] text-slate-200 text-xs font-medium hover:bg-[#192127] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {copiedUrl ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span className="text-emerald-300">Link Copied</span>
            </>
          ) : (
            <>
              <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Copy App Link</span>
            </>
          )}
        </button>
      </div>

      {showGuideModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-sm rounded-xl bg-[#13191D] border border-[#2A3640] p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <h3
                id="pwa-install-title"
                className="font-display text-lg font-semibold text-slate-100"
              >
                {isIOS ? "Install on iPhone or iPad" : "Install PrismVoice App"}
              </h3>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Close dialog"
                className="p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-[#192127] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="text-xs text-slate-300 space-y-2 leading-relaxed list-decimal list-inside">
                <li>
                  Tap the <strong className="text-slate-100">Share</strong>{" "}
                  button in Safari&apos;s toolbar.
                </li>
                <li>
                  Scroll down and tap{" "}
                  <strong className="text-slate-100">Add to Home Screen</strong>.
                </li>
                <li>
                  Tap <strong className="text-slate-100">Add</strong> to launch
                  PrismVoice as a standalone app.
                </li>
              </ol>
            ) : (
              <ol className="text-xs text-slate-300 space-y-2 leading-relaxed list-decimal list-inside">
                <li>
                  Open this page directly in Chrome, Edge, or Android browser.
                </li>
                <li>
                  Click the{" "}
                  <strong className="text-slate-100">Install</strong> icon in
                  the browser address bar or menu.
                </li>
                <li>
                  PrismVoice will open in its own window with offline sample
                  scene caching.
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2 rounded-lg bg-[#047857] text-white text-xs font-semibold hover:bg-[#059669] transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
};
