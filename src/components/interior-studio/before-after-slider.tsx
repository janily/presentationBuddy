"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import {
  Play,
  Pause,
  Download,
  RefreshCw,
  Share2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Check,
} from "lucide-react";

interface AppliedChange {
  id: string;
  text: string;
}

interface BeforeAfterSliderProps {
  beforeImage: string;
  afterImage: string;
  appliedChanges: AppliedChange[];
  onRedo?: () => void;
  onTryDifferent?: () => void;
  onShare?: () => void;
  onDownload?: () => void;
}

// Pre-compute confetti positions to avoid Math.random during render
const confettiParticles = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  left: 10 + ((i * 4.2) % 80),
  top: (i * 7.3) % 100,
  colorIndex: i % 4,
  duration: 1.5 + (i % 3) * 0.3,
  delay: (i % 5) * 0.1,
  rotation: (i * 18) % 360,
}));

export default function BeforeAfterSlider({
  beforeImage,
  afterImage,
  appliedChanges,
  onRedo,
  onTryDifferent,
  onShare,
  onDownload,
}: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [showConfetti, setShowConfetti] = useState(true);
  const [hoveredChange, setHoveredChange] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);
  const sliderPositionRef = useRef(sliderPosition);

  // Keep ref in sync with state
  useEffect(() => {
    sliderPositionRef.current = sliderPosition;
  }, [sliderPosition]);

  // Hide confetti after initial reveal
  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Auto-reveal animation on mount
  useEffect(() => {
    const revealAnimation = async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Animate from 0 to 75
      let pos = 0;
      const animate = () => {
        pos += 2;
        if (pos <= 75) {
          setSliderPosition(pos);
          requestAnimationFrame(animate);
        }
      };
      animate();
    };

    revealAnimation();
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setIsAutoPlaying(false);
  }, []);

  const handleTouchStart = useCallback(() => {
    setIsDragging(true);
    setIsAutoPlaying(false);
  }, []);

  const updateSliderPosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      updateSliderPosition(e.clientX);
    },
    [isDragging, updateSliderPosition],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging) return;
      updateSliderPosition(e.touches[0].clientX);
    },
    [isDragging, updateSliderPosition],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove);
      window.addEventListener("touchend", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setSliderPosition((prev) => Math.max(0, prev - 5));
        setIsAutoPlaying(false);
      } else if (e.key === "ArrowRight") {
        setSliderPosition((prev) => Math.min(100, prev + 5));
        setIsAutoPlaying(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Auto-play animation
  useEffect(() => {
    if (isAutoPlaying) {
      let direction = 1;
      let pos = sliderPositionRef.current;

      autoPlayRef.current = setInterval(() => {
        pos += direction * 0.5;
        if (pos >= 95) direction = -1;
        if (pos <= 5) direction = 1;
        setSliderPosition(pos);
      }, 16);
    }

    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
      }
    };
  }, [isAutoPlaying]);

  const toggleAutoPlay = () => {
    setIsAutoPlaying((prev) => !prev);
  };

  const confettiColors = useMemo(
    () => [
      "var(--accent-terracotta)",
      "var(--accent-brass)",
      "var(--accent-sage)",
      "var(--accent-terracotta-light)",
    ],
    [],
  );

  return (
    <div className="min-h-screen paper-texture p-4 md:p-8">
      <div className="max-w-5xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-terracotta)] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1
                className="text-2xl md:text-3xl font-semibold text-[var(--text-primary)]"
                style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}
              >
                Your HTML Presentation
              </h1>
              <p className="text-sm text-[var(--text-muted)]">
                Drag to compare before & after
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDownload}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl
                         bg-[var(--bg-card)] border border-[var(--border-light)]
                         text-[var(--text-secondary)] text-sm font-medium
                         hover:border-[var(--accent-terracotta)] hover:text-[var(--accent-terracotta)]
                         transition-all duration-200"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download</span>
            </button>
            <button
              type="button"
              onClick={onRedo}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl
                         bg-[var(--bg-card)] border border-[var(--border-light)]
                         text-[var(--text-secondary)] text-sm font-medium
                         hover:border-[var(--accent-sage)] hover:text-[var(--accent-sage)]
                         transition-all duration-200"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Redo</span>
            </button>
          </div>
        </div>

        {/* Main Slider Container */}
        <div className="relative bg-[var(--bg-card)] rounded-3xl border border-[var(--border-light)] overflow-hidden shadow-xl">
          {/* Confetti Effect */}
          {showConfetti && (
            <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
              {confettiParticles.map((particle) => (
                <div
                  key={particle.id}
                  className="absolute w-2 h-2 rounded-sm"
                  style={{
                    left: `${particle.left}%`,
                    top: `${particle.top}%`,
                    backgroundColor: confettiColors[particle.colorIndex],
                    animation: `confetti ${particle.duration}s ease-out forwards`,
                    animationDelay: `${particle.delay}s`,
                    transform: `rotate(${particle.rotation}deg)`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Slider Container */}
          <div
            ref={containerRef}
            className="relative aspect-[16/10] cursor-ew-resize select-none"
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            role="slider"
            aria-valuenow={Math.round(sliderPosition)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Before and after comparison slider"
            tabIndex={0}
          >
            {/* Before deck (full) */}
            <div className="absolute inset-0">
              <Image
                src={beforeImage}
                alt="Before"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 1024px"
                priority
              />
              {/* Before Label */}
              <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm text-white text-sm font-medium">
                Before
              </div>
            </div>

            {/* HTML presentation (clipped) */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
            >
              <Image
                src={afterImage}
                alt="After"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 1024px"
                priority
              />
              {/* After Label */}
              <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-[var(--accent-terracotta)] text-white text-sm font-medium flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                After
              </div>
            </div>

            {/* Slider Handle */}
            <div
              className={`
                absolute top-0 bottom-0 w-1 bg-white
                transform -translate-x-1/2 z-10
                transition-shadow duration-200
                ${isDragging ? "shadow-[0_0_30px_rgba(255,255,255,0.5)]" : "shadow-lg"}
              `}
              style={{ left: `${sliderPosition}%` }}
            >
              {/* Handle Button */}
              <div
                className={`
                  absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                  w-12 h-12 rounded-full bg-white shadow-xl
                  flex items-center justify-center gap-0.5
                  transition-all duration-200
                  ${isDragging ? "scale-110" : "hover:scale-105"}
                `}
              >
                <ChevronLeft className="w-4 h-4 text-[var(--text-primary)]" />
                <ChevronRight className="w-4 h-4 text-[var(--text-primary)]" />
              </div>

              {/* Percentage indicator */}
              <div
                className={`
                  absolute -bottom-10 left-1/2 -translate-x-1/2
                  px-3 py-1 rounded-full bg-[var(--text-primary)] text-white text-xs font-medium
                  transition-opacity duration-200
                  ${isDragging ? "opacity-100" : "opacity-0"}
                `}
              >
                {Math.round(sliderPosition)}%
              </div>
            </div>

            {/* Drag instruction (fades after interaction) */}
            <div
              className={`
                absolute bottom-4 left-1/2 -translate-x-1/2
                flex items-center gap-2 px-4 py-2 rounded-full
                bg-black/40 backdrop-blur-sm text-white text-sm
                transition-opacity duration-500
                ${isDragging ? "opacity-0" : "opacity-100"}
              `}
            >
              <ChevronLeft className="w-4 h-4 animate-pulse" />
              <span>Drag to compare</span>
              <ChevronRight className="w-4 h-4 animate-pulse" />
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex items-center justify-between p-4 bg-[var(--bg-elevated)] border-t border-[var(--border-light)]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleAutoPlay}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                  transition-all duration-200
                  ${
                    isAutoPlaying
                      ? "bg-[var(--accent-terracotta)] text-white"
                      : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)]"
                  }
                `}
              >
                {isAutoPlaying ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Auto Reveal</span>
                  </>
                )}
              </button>
            </div>

            <div className="text-xs text-[var(--text-muted)]">
              Use{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] font-mono">
                ←
              </kbd>{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] font-mono">
                →
              </kbd>{" "}
              keys
            </div>
          </div>
        </div>

        {/* Applied Slide Updates Panel */}
        <div className="mt-6 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-light)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border-light)]">
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-[var(--success)]" />
              <h3
                className="text-lg font-semibold text-[var(--text-primary)]"
                style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}
              >
                Applied Slide Updates
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-[var(--success-bg)] text-[var(--success)] text-xs font-medium">
                {appliedChanges.length} improvements
              </span>
            </div>
          </div>

          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {appliedChanges.map((change, index) => (
                <article
                  key={change.id}
                  className={`
                    flex items-start gap-3 p-3 rounded-xl
                    transition-all duration-200
                    ${
                      hoveredChange === change.id
                        ? "bg-[var(--success-bg)]"
                        : "bg-[var(--bg-secondary)] hover:bg-[var(--bg-elevated)]"
                    }
                  `}
                  style={{
                    animationDelay: `${index * 100}ms`,
                  }}
                  onMouseEnter={() => setHoveredChange(change.id)}
                  onMouseLeave={() => setHoveredChange(null)}
                >
                  <div
                    className={`
                      w-6 h-6 rounded-full flex items-center justify-center shrink-0
                      transition-colors duration-200
                      ${
                        hoveredChange === change.id
                          ? "bg-[var(--success)] text-white"
                          : "bg-[var(--success)]/20 text-[var(--success)]"
                      }
                    `}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                    {change.text}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
          <button
            type="button"
            onClick={onTryDifferent}
            className="flex items-center gap-2 px-6 py-3 rounded-xl
                       bg-[var(--bg-card)] border border-[var(--border-medium)]
                       text-[var(--text-primary)] font-medium
                       hover:border-[var(--accent-terracotta)] hover:shadow-md
                       transition-all duration-200"
          >
            <RefreshCw className="w-5 h-5" />
            Try Different Slide Suggestions
          </button>
          <button
            type="button"
            onClick={onShare}
            className="flex items-center gap-2 px-6 py-3 rounded-xl
                       bg-[var(--accent-terracotta)] text-white font-medium
                       hover:bg-[var(--accent-terracotta-light)] hover:shadow-lg hover:-translate-y-0.5
                       transition-all duration-200"
          >
            <Share2 className="w-5 h-5" />
            Share Result
          </button>
        </div>

        {/* Keyboard shortcut hint */}
        <p className="text-center text-sm text-[var(--text-muted)] mt-6">
          Pro tip: Use arrow keys for precise control
        </p>
      </div>
    </div>
  );
}
