import React, { useEffect, useRef, useState } from "react";
import {
  Camera,
  Crosshair,
  ImagePlus,
  Maximize2,
  Minimize2,
  Sparkles,
  X,
} from "lucide-react";
import { SAMPLE_SCENES } from "../data/languages";
import { ActiveImage, FocusBox, SampleScene } from "../types/vqa";

interface ImageWorkspaceProps {
  activeImage: ActiveImage | null;
  activeSample: SampleScene | null;
  focusBox: FocusBox | null;
  onFocusBoxChange: (box: FocusBox | null) => void;
  onFileSelected: (file: File) => void;
  onCameraCaptured: (dataUrl: string) => void;
  onSelectSample: (scene: SampleScene) => void;
  onClearImage: () => void;
  onQuickPrompt: (prompt: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const ImageWorkspace: React.FC<ImageWorkspaceProps> = ({
  activeImage,
  activeSample,
  focusBox,
  onFocusBoxChange,
  onFileSelected,
  onCameraCaptured,
  onSelectSample,
  onClearImage,
  onQuickPrompt,
  fileInputRef,
}) => {
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [fitContain, setFitContain] = useState(true);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [draftBox, setDraftBox] = useState<FocusBox | null>(null);
  const [brokenSampleIds, setBrokenSampleIds] = useState<
    Record<string, boolean>
  >({});

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const imageSurfaceRef = useRef<HTMLDivElement | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const openCamera = async () => {
    setCameraError(null);
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setCameraError("Camera access is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setIsCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });
    } catch {
      setCameraError(
        "Camera permission was denied or unavailable. Use file upload or a sample scene."
      );
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    stopCamera();
    onCameraCaptured(dataUrl);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onFileSelected(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
    }
    e.target.value = "";
  };

  const getRelativeCoords = (e: React.MouseEvent) => {
    const el = imageSurfaceRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isFocusMode || !activeImage) return;
    e.preventDefault();
    const pt = getRelativeCoords(e);
    setDragStart(pt);
    setDraftBox({ x: pt.x, y: pt.y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isFocusMode || !dragStart) return;
    const pt = getRelativeCoords(e);
    setDraftBox({
      x: Math.min(dragStart.x, pt.x),
      y: Math.min(dragStart.y, pt.y),
      width: Math.abs(pt.x - dragStart.x),
      height: Math.abs(pt.y - dragStart.y),
    });
  };

  const handleMouseUp = () => {
    if (!isFocusMode || !dragStart) return;
    setDragStart(null);
    if (draftBox && draftBox.width > 0.03 && draftBox.height > 0.03) {
      onFocusBoxChange(draftBox);
    }
    setDraftBox(null);
    setIsFocusMode(false);
  };

  const displayedBox = draftBox ?? focusBox;

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleInputChange}
        className="sr-only"
        aria-label="Upload image file"
      />

      {/* Primary Visual Input Canvas */}
      <div className="bg-[#13191D] border border-[#232D35] rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-100">
              Visual Input
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Upload, capture from camera, or highlight a specific region
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={isCameraOpen ? stopCamera : openCamera}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isCameraOpen
                  ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                  : "border-[#2A3640] bg-[#192127] text-slate-200 hover:bg-[#1E2830]"
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{isCameraOpen ? "Close Camera" : "Camera"}</span>
            </button>

            {activeImage && !isCameraOpen && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (focusBox && !isFocusMode) {
                      onFocusBoxChange(null);
                    } else {
                      setIsFocusMode((prev) => !prev);
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isFocusMode || focusBox
                      ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                      : "border-[#2A3640] bg-[#192127] text-slate-200 hover:bg-[#1E2830]"
                  }`}
                  title={
                    focusBox
                      ? "Clear highlighted region"
                      : "Drag a box on the image to focus your question"
                  }
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>
                    {isFocusMode
                      ? "Draw Box..."
                      : focusBox
                        ? "Clear Region"
                        : "Focus Region"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFitContain((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[#2A3640] bg-[#192127] text-xs font-medium text-slate-200 hover:bg-[#1E2830] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  title={fitContain ? "Fill frame" : "Fit full image"}
                >
                  {fitContain ? (
                    <Maximize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Minimize2 className="w-3.5 h-3.5" />
                  )}
                  <span>{fitContain ? "Fill" : "Fit"}</span>
                </button>

                <button
                  type="button"
                  onClick={onClearImage}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#2A3640] bg-[#192127] text-xs font-medium text-slate-300 hover:text-white hover:bg-[#1E2830] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </>
            )}
          </div>
        </div>

        {cameraError && (
          <p className="mb-3 text-xs text-amber-300 bg-amber-950/40 border border-amber-800/50 rounded-md px-3 py-2">
            {cameraError}
          </p>
        )}

        {/* Camera / Image / Dropzone */}
        {isCameraOpen ? (
          <div className="rounded-lg border border-[#2A3640] bg-[#0B0F12] overflow-hidden">
            <div className="aspect-[4/3] w-full bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-3 flex items-center justify-between gap-3 border-t border-[#232D35]">
              <span className="text-xs text-slate-400">
                Position your subject and capture a frame
              </span>
              <button
                type="button"
                onClick={capturePhoto}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-md bg-[#047857] text-white text-xs font-semibold hover:bg-[#059669] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Capture Snapshot</span>
              </button>
            </div>
          </div>
        ) : (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative rounded-lg border transition-colors overflow-hidden ${
              isDraggingFile
                ? "border-emerald-400 bg-emerald-500/10"
                : activeImage
                  ? "border-[#232D35] bg-[#070A0C]"
                  : "border-dashed border-[#2F3B45] bg-[#0B0F12] hover:border-slate-500"
            }`}
          >
            {activeImage ? (
              <div
                ref={imageSurfaceRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className={`relative aspect-[4/3] w-full flex items-center justify-center bg-[#070A0C] select-none ${
                  isFocusMode ? "cursor-crosshair" : ""
                }`}
              >
                <img
                  src={activeImage.src}
                  alt={activeImage.name}
                  referrerPolicy="no-referrer"
                  draggable={false}
                  className={`w-full h-full transition-all ${
                    fitContain ? "object-contain" : "object-cover"
                  }`}
                />

                {displayedBox && displayedBox.width > 0.01 && (
                  <div
                    className="absolute border-2 border-emerald-400 bg-emerald-500/15 pointer-events-none"
                    style={{
                      left: `${displayedBox.x * 100}%`,
                      top: `${displayedBox.y * 100}%`,
                      width: `${displayedBox.width * 100}%`,
                      height: `${displayedBox.height * 100}%`,
                    }}
                  />
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-[4/3] w-full flex flex-col items-center justify-center p-8 text-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400"
              >
                <div className="w-12 h-12 rounded-lg bg-[#13191D] border border-[#232D35] flex items-center justify-center text-emerald-400 mb-3">
                  <ImagePlus className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-slate-100">
                  Click to upload or drag an image here
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  PNG, JPEG, WEBP, or GIF up to 10 MB
                </p>
              </button>
            )}
          </div>
        )}

        {/* Unboxed Metadata Strip */}
        {activeImage && !isCameraOpen && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="font-medium text-slate-200 truncate max-w-[200px]">
                {activeImage.name}
              </span>
              {activeImage.width && activeImage.height && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {activeImage.width} × {activeImage.height}
                  </span>
                </>
              )}
              {activeImage.sizeBytes ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {formatBytes(activeImage.sizeBytes)}
                  </span>
                </>
              ) : null}
              {focusBox && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-400 font-medium">
                    Region focused
                  </span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer whitespace-nowrap shrink-0"
            >
              Replace image
            </button>
          </div>
        )}

        {/* Contextual Starter Questions for Active Sample */}
        {activeSample && !isCameraOpen && (
          <div className="mt-4 pt-4 border-t border-[#232D35]">
            <p className="text-xs font-medium text-slate-300 mb-2">
              Suggested questions for {activeSample.title}
            </p>
            <div className="flex flex-col gap-1.5">
              {activeSample.suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onQuickPrompt(prompt)}
                  className="text-left text-xs text-slate-300 hover:text-emerald-300 hover:bg-[#192127] px-2.5 py-2 rounded-md border border-[#232D35] transition-colors cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sample Scenes Gallery */}
      <section
        id="samples"
        className="bg-[#13191D] border border-[#232D35] rounded-xl p-5"
      >
        <div className="mb-4">
          <h2 className="font-display text-base font-semibold text-slate-100">
            Sample Scenes
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Test OCR translation, object counting, and region focus instantly
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SAMPLE_SCENES.map((scene) => {
            const isSelected = activeSample?.id === scene.id;
            const isBroken = brokenSampleIds[scene.id];
            return (
              <button
                key={scene.id}
                type="button"
                onClick={() => {
                  stopCamera();
                  onSelectSample(scene);
                }}
                className={`group text-left rounded-lg border overflow-hidden transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                  isSelected
                    ? "border-emerald-500/70 bg-emerald-500/10"
                    : "border-[#232D35] bg-[#0B0F12] hover:border-slate-500"
                }`}
              >
                <div className="aspect-[4/3] w-full bg-[#070A0C] overflow-hidden">
                  {isBroken ? (
                    <div className="w-full h-full flex flex-col items-center justify-center p-3 bg-gradient-to-br from-[#13191D] to-[#0B0F12] text-slate-400">
                      <Sparkles className="w-5 h-5 mb-1" />
                      <span className="text-xs font-medium text-center">
                        {scene.title}
                      </span>
                    </div>
                  ) : (
                    <img
                      src={scene.imageUrl}
                      alt={scene.title}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setBrokenSampleIds((prev) => ({
                          ...prev,
                          [scene.id]: true,
                        }))
                      }
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                    />
                  )}
                </div>
                <div className="p-2.5">
                  <p
                    className={`text-xs font-semibold truncate ${
                      isSelected ? "text-emerald-300" : "text-slate-100"
                    }`}
                  >
                    {scene.title}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {scene.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};
