"use client";

import { useState, useCallback } from "react";
import { RotateCcw } from "lucide-react";
import ImageUploader from "./ImageUploader";
import ImagePreview from "./ImagePreview";
import SuggestionPanel from "./SuggestionPanel";
import ProcessingView from "./ProcessingView";
import BeforeAfterSlider from "./BeforeAfterSlider";
import type { Suggestion } from "./SuggestionCard";

type WorkflowStep = "upload" | "suggestions" | "processing" | "reveal";

// Demo suggestions that would come from AI analysis
const demoSuggestions: Suggestion[] = [
  {
    id: "1",
    text: "Add warm pendant lighting over the seating area",
    selected: true,
    zone: "Lighting area",
  },
  {
    id: "2",
    text: "Replace curtains with sheer linen for better natural light",
    selected: true,
    zone: "Window area",
  },
  {
    id: "3",
    text: "Add indoor plants near the window for a natural touch",
    selected: false,
    zone: "Plants area",
  },
  {
    id: "4",
    text: "Update throw pillows with textured fabrics in earth tones",
    selected: false,
    zone: "Seating area",
  },
  {
    id: "5",
    text: "Add a statement piece of artwork above the sofa",
    selected: true,
    zone: "Wall area",
  },
];

export default function DesignStudio() {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>("upload");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [highlightedZone, setHighlightedZone] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Handle image upload
  const handleImageUpload = useCallback((imageUrl: string) => {
    setUploadedImage(imageUrl);
    // Simulate AI analysis delay
    setTimeout(() => {
      setSuggestions(demoSuggestions);
      setCurrentStep("suggestions");
    }, 500);
  }, []);

  // Toggle suggestion selection
  const handleToggleSuggestion = useCallback((id: string) => {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s)),
    );
  }, []);

  // Edit suggestion text
  const handleEditSuggestion = useCallback((id: string, newText: string) => {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, text: newText } : s)),
    );
  }, []);

  // Delete suggestion
  const handleDeleteSuggestion = useCallback((id: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // Add new suggestion
  const handleAddSuggestion = useCallback((text: string, zone?: string) => {
    const newSuggestion: Suggestion = {
      id: `custom-${Date.now()}`,
      text,
      selected: true,
      zone: zone || "Custom",
    };
    setSuggestions((prev) => [...prev, newSuggestion]);
  }, []);

  // Handle generate
  const handleGenerate = useCallback(() => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setCurrentStep("processing");
    }, 500);
  }, []);

  // Handle processing complete
  const handleProcessingComplete = useCallback(() => {
    setCurrentStep("reveal");
  }, []);

  // Start over
  const handleStartOver = useCallback(() => {
    setCurrentStep("upload");
    setUploadedImage(null);
    setSuggestions([]);
    setHighlightedZone(null);
    setIsGenerating(false);
  }, []);

  // Try different suggestions
  const handleTryDifferent = useCallback(() => {
    setCurrentStep("suggestions");
  }, []);

  // Download result
  const handleDownload = useCallback(() => {
    // In real app, would trigger download of the after image
    console.log("Downloading result...");
  }, []);

  // Share result
  const handleShare = useCallback(() => {
    // In real app, would open share dialog
    console.log("Sharing result...");
  }, []);

  // Get selected suggestions for processing view
  const selectedSuggestions = suggestions
    .filter((s) => s.selected)
    .map((s) => s.text);

  // Applied changes for reveal screen
  const appliedChanges = suggestions
    .filter((s) => s.selected)
    .map((s) => ({ id: s.id, text: s.text }));

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Upload Screen */}
      {currentStep === "upload" && (
        <ImageUploader onImageUpload={handleImageUpload} />
      )}

      {/* Suggestions Screen */}
      {currentStep === "suggestions" && uploadedImage && (
        <div className="min-h-screen paper-texture">
          {/* Header */}
          <header className="sticky top-0 z-20 glass border-b border-[var(--border-light)]">
            <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
              <h1
                className="text-xl font-semibold text-[var(--text-primary)]"
                style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}
              >
                Interior Design Studio
              </h1>
              <button
                type="button"
                onClick={handleStartOver}
                className="flex items-center gap-2 px-4 py-2 rounded-xl
                           bg-[var(--bg-card)] border border-[var(--border-light)]
                           text-[var(--text-secondary)] text-sm font-medium
                           hover:border-[var(--accent-terracotta)] hover:text-[var(--accent-terracotta)]
                           transition-all duration-200"
              >
                <RotateCcw className="w-4 h-4" />
                Start Over
              </button>
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto p-4 md:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-120px)]">
              {/* Image Preview */}
              <div className="h-full min-h-[400px]">
                <ImagePreview
                  imageUrl={uploadedImage}
                  highlightedZone={highlightedZone}
                />
              </div>

              {/* Suggestion Panel */}
              <div className="h-full min-h-[400px]">
                <SuggestionPanel
                  suggestions={suggestions}
                  onToggle={handleToggleSuggestion}
                  onEdit={handleEditSuggestion}
                  onDelete={handleDeleteSuggestion}
                  onAdd={handleAddSuggestion}
                  onHoverZone={setHighlightedZone}
                  onGenerate={handleGenerate}
                  isGenerating={isGenerating}
                />
              </div>
            </div>
          </main>
        </div>
      )}

      {/* Processing Screen */}
      {currentStep === "processing" && uploadedImage && (
        <ProcessingView
          imageUrl={uploadedImage}
          suggestions={selectedSuggestions}
          onComplete={handleProcessingComplete}
        />
      )}

      {/* Reveal Screen */}
      {currentStep === "reveal" && uploadedImage && (
        <BeforeAfterSlider
          beforeImage={uploadedImage}
          afterImage={uploadedImage} // In real app, this would be the AI-generated image
          appliedChanges={appliedChanges}
          onRedo={handleStartOver}
          onTryDifferent={handleTryDifferent}
          onDownload={handleDownload}
          onShare={handleShare}
        />
      )}
    </div>
  );
}
