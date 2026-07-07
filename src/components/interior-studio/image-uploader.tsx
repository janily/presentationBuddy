"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, ImagePlus, Sparkles, Loader2 } from "lucide-react";

interface ImageUploaderProps {
  onImageUpload: (imageUrl: string) => void;
}

export default function ImageUploader({ onImageUpload }: ImageUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setUploadError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/source-materials", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to upload");
        }

        const data = await response.json();

        onImageUpload(data.url);
      } catch (error) {
        console.error("Upload error:", error);
        setUploadError(
          error instanceof Error ? error.message : "Failed to upload image",
        );
      } finally {
        setIsUploading(false);
      }
    },
    [onImageUpload],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      if (files?.[0]) {
        const file = files[0];
        uploadFile(file);
      }
    },
    [uploadFile],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files?.[0]) {
        const file = files[0];
        uploadFile(file);
      }
    },
    [uploadFile],
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-6 paper-texture">
      <div className="w-full max-w-2xl animate-fade-in-up">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-card)] border border-[var(--border-light)] mb-6 animate-fade-in-down">
            <Sparkles className="w-4 h-4 text-[var(--accent-brass)]" />
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              AI-Powered Design
            </span>
          </div>
          <h1
            className="text-4xl md:text-5xl font-display text-[var(--text-primary)] mb-4"
            style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}
          >
            Interior Design Studio
          </h1>
          <p className="text-lg text-[var(--text-secondary)] max-w-md mx-auto">
            Transform your space with AI. Upload a room photo and watch the
            magic happen.
          </p>
        </div>

        {/* Upload Zone - using label for better accessibility */}
        <label
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          className={`
            dropzone relative cursor-pointer p-8 md:p-12 block
            ${isDragOver ? "dragover" : ""}
            ${isHovering || isDragOver ? "animate-border-glow" : ""}
            ${isUploading ? "pointer-events-none opacity-70" : ""}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.txt,.md,.pdf,.ppt,.pptx,.doc,.docx,text/plain,text/markdown,application/pdf"
            onChange={handleFileSelect}
            className="sr-only"
          />

          {/* Floating Room Illustration */}
          <div className="relative flex flex-col items-center">
            {/* Room SVG Animation */}
            <div
              className={`
              relative w-40 h-40 mb-8 transition-transform duration-500
              ${isHovering || isDragOver ? "scale-110" : ""}
              ${isDragOver ? "" : "animate-float"}
            `}
            >
              {/* Room outline SVG */}
              <svg
                viewBox="0 0 160 160"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full"
                aria-hidden="true"
              >
                <title>Room illustration</title>
                {/* Room frame */}
                <rect
                  x="20"
                  y="30"
                  width="120"
                  height="100"
                  rx="4"
                  stroke="var(--accent-terracotta)"
                  strokeWidth="2"
                  strokeDasharray={isDragOver ? "0" : "6 4"}
                  fill="none"
                  className="transition-all duration-300"
                  style={{
                    opacity: isDragOver ? 1 : 0.6,
                  }}
                />

                {/* Window */}
                <rect
                  x="35"
                  y="45"
                  width="35"
                  height="40"
                  rx="2"
                  stroke="var(--accent-sage)"
                  strokeWidth="1.5"
                  fill="none"
                  opacity={isHovering || isDragOver ? "0.8" : "0.4"}
                  className="transition-opacity duration-300"
                />
                <line
                  x1="52.5"
                  y1="45"
                  x2="52.5"
                  y2="85"
                  stroke="var(--accent-sage)"
                  strokeWidth="1.5"
                  opacity={isHovering || isDragOver ? "0.8" : "0.4"}
                />
                <line
                  x1="35"
                  y1="65"
                  x2="70"
                  y2="65"
                  stroke="var(--accent-sage)"
                  strokeWidth="1.5"
                  opacity={isHovering || isDragOver ? "0.8" : "0.4"}
                />

                {/* Sofa */}
                <path
                  d="M45 105 L115 105 L115 120 Q115 125 110 125 L50 125 Q45 125 45 120 Z"
                  stroke="var(--accent-brass)"
                  strokeWidth="1.5"
                  fill="none"
                  opacity={isHovering || isDragOver ? "0.9" : "0.5"}
                  className="transition-opacity duration-300"
                />
                <rect
                  x="50"
                  y="110"
                  width="60"
                  height="10"
                  rx="2"
                  stroke="var(--accent-brass)"
                  strokeWidth="1.5"
                  fill="none"
                  opacity={isHovering || isDragOver ? "0.9" : "0.5"}
                />

                {/* Lamp */}
                <circle
                  cx="100"
                  cy="55"
                  r="12"
                  stroke="var(--accent-terracotta)"
                  strokeWidth="1.5"
                  fill="none"
                  opacity={isHovering || isDragOver ? "1" : "0.4"}
                  className="transition-opacity duration-300"
                />
                <line
                  x1="100"
                  y1="67"
                  x2="100"
                  y2="90"
                  stroke="var(--accent-terracotta)"
                  strokeWidth="1.5"
                  opacity={isHovering || isDragOver ? "1" : "0.4"}
                />

                {/* Plant */}
                <ellipse
                  cx="125"
                  cy="95"
                  rx="10"
                  ry="15"
                  stroke="var(--accent-sage)"
                  strokeWidth="1.5"
                  fill="none"
                  opacity={isHovering || isDragOver ? "0.9" : "0.4"}
                  className="transition-opacity duration-300"
                />
                <rect
                  x="118"
                  y="108"
                  width="14"
                  height="17"
                  rx="2"
                  stroke="var(--accent-sage)"
                  strokeWidth="1.5"
                  fill="none"
                  opacity={isHovering || isDragOver ? "0.9" : "0.4"}
                />
              </svg>

              {/* Sparkle effects */}
              {(isHovering || isDragOver) && (
                <>
                  <div
                    className="absolute top-2 right-8 w-2 h-2 bg-[var(--accent-brass)] rounded-full animate-pulse-subtle"
                    style={{ animationDelay: "0ms" }}
                  />
                  <div
                    className="absolute top-10 left-4 w-1.5 h-1.5 bg-[var(--accent-terracotta)] rounded-full animate-pulse-subtle"
                    style={{ animationDelay: "300ms" }}
                  />
                  <div
                    className="absolute bottom-12 right-4 w-2 h-2 bg-[var(--accent-sage)] rounded-full animate-pulse-subtle"
                    style={{ animationDelay: "600ms" }}
                  />
                </>
              )}
            </div>

            {/* Upload Icon */}
            <div
              className={`
              w-14 h-14 rounded-full flex items-center justify-center mb-6
              transition-all duration-300
              ${
                isUploading
                  ? "bg-[var(--accent-brass)] text-[var(--text-inverse)]"
                  : isDragOver
                    ? "bg-[var(--accent-terracotta)] text-[var(--text-inverse)] scale-110"
                    : "bg-[var(--bg-secondary)] text-[var(--accent-terracotta)]"
              }
            `}
            >
              {isUploading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : isDragOver ? (
                <ImagePlus className="w-6 h-6" />
              ) : (
                <Upload className="w-6 h-6" />
              )}
            </div>

            {/* Text */}
            <h3
              className={`
              text-xl font-medium mb-2 transition-colors duration-300
              ${isDragOver ? "text-[var(--accent-terracotta)]" : "text-[var(--text-primary)]"}
            `}
            >
              {isUploading
                ? "Uploading..."
                : isDragOver
                  ? "Release to upload"
                  : "Drop your room photo here"}
            </h3>
            <p className="text-[var(--text-muted)] text-center mb-6">
              {isUploading
                ? "Please wait while we process your image"
                : "or click to browse from your device"}
            </p>

            {/* Error message */}
            {uploadError && (
              <p className="text-red-500 text-sm text-center mb-4">
                {uploadError}
              </p>
            )}

            {/* Supported formats */}
            <div className="flex flex-wrap justify-center gap-2">
              {["JPG", "PNG", "WEBP"].map((format) => (
                <span
                  key={format}
                  className="px-3 py-1 text-xs font-medium rounded-full bg-[var(--bg-secondary)] text-[var(--text-muted)]"
                >
                  {format}
                </span>
              ))}
            </div>
          </div>

          {/* Corner decorations */}
          <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-[var(--border-medium)] rounded-tl-lg opacity-50" />
          <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-[var(--border-medium)] rounded-tr-lg opacity-50" />
          <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-[var(--border-medium)] rounded-bl-lg opacity-50" />
          <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-[var(--border-medium)] rounded-br-lg opacity-50" />
        </label>

        {/* Tips */}
        <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-[var(--text-muted)]">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-sage)]" />
            Well-lit photos work best
          </span>
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-terracotta)]" />
            Show the full room
          </span>
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-brass)]" />
            Landscape orientation
          </span>
        </div>
      </div>
    </div>
  );
}
