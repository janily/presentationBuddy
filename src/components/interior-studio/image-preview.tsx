"use client";

import { useState } from "react";
import Image from "next/image";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface ImagePreviewProps {
  imageUrl: string;
  highlightedZone: string | null;
}

export default function ImagePreview({
  imageUrl,
  highlightedZone,
}: ImagePreviewProps) {
  const [scale, setScale] = useState(1);

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 2));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleReset = () => {
    setScale(1);
  };

  return (
    <div className="relative h-full flex flex-col bg-[var(--bg-card)] rounded-2xl border border-[var(--border-light)] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--border-light)] bg-[var(--bg-elevated)]">
        <span className="text-sm font-medium text-[var(--text-secondary)]">
          Room Preview
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="px-2 text-xs font-medium text-[var(--text-muted)] min-w-[3rem] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= 2}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-[var(--border-light)] mx-1" />
          <button
            type="button"
            onClick={handleReset}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all duration-200"
            aria-label="Reset zoom"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Image Container */}
      <div className="relative flex-1 overflow-hidden bg-[var(--bg-secondary)]">
        <div
          className="absolute inset-0 flex items-center justify-center transition-transform duration-300 ease-out"
          style={{ transform: `scale(${scale})` }}
        >
          {/* Image */}
          <div className="relative w-full h-full">
            <Image
              src={imageUrl}
              alt="Room preview"
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 50vw"
            />

            {/* Highlight Overlay - only shown when highlightedZone is set from parent */}
            {highlightedZone && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-black/20 transition-opacity duration-300" />
                <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-[var(--accent-terracotta)] text-white text-sm font-medium shadow-lg animate-fade-in">
                  {highlightedZone}
                </div>
              </div>
            )}

            {/* Scanning effect line when analyzing */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-0 group-data-[analyzing=true]:opacity-100">
              <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[var(--accent-terracotta)] to-transparent animate-scan" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
