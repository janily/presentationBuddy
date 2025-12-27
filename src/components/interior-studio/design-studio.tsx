"use client";

import { useState, useCallback, useMemo } from "react";
import { RotateCcw } from "lucide-react";
import { useInteriorWorkflow } from "@/src/hooks/use-interior-workflow";
import BeforeAfterSlider from "./before-after-slider";
import ImagePreview from "./image-preview";
import ImageUploader from "./image-uploader";
import ProcessingView from "./processing-view";
import { Suggestion } from "./suggestion-card";
import SuggestionPanel from "./suggestion-panel";

type WorkflowStep =
  | "upload"
  | "analyzing"
  | "suggestions"
  | "processing"
  | "reveal";

export default function DesignStudio() {
  const {
    sendInteriorImage,
    approveChanges,
    status,
    suspenseData,
    suggestionStep,
    improvementStep,
  } = useInteriorWorkflow();

  // Local state only for things the user directly modifies
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [userModifiedSuggestions, setUserModifiedSuggestions] = useState<
    Suggestion[] | null
  >(null);
  const [highlightedZone, setHighlightedZone] = useState<string | null>(null);
  const [hasApprovedChanges, setHasApprovedChanges] = useState(false);

  // Derive suggestions from workflow data or user modifications
  const suggestions = useMemo((): Suggestion[] => {
    // If user has modified suggestions, use those
    if (userModifiedSuggestions !== null) {
      return userModifiedSuggestions;
    }

    // First check streaming suggestions
    if (suggestionStep?.data) {
      const { changes } = suggestionStep.data as {
        changes?: string[];
        status: "streaming" | "completed";
      };

      if (changes && changes.length > 0) {
        return changes.map((text, index) => ({
          id: `suggestion-${index}`,
          text,
          selected: true,
          zone: undefined,
        }));
      }
    }

    // Then check suspend data
    if (suspenseData && suspenseData.suggestedChanges.length > 0) {
      return suspenseData.suggestedChanges.map(
        (text: string, index: number) => ({
          id: `suggestion-${index}`,
          text,
          selected: true,
          zone: undefined,
        }),
      );
    }

    return [];
  }, [suggestionStep, suspenseData, userModifiedSuggestions]);

  // Derive current step from workflow state
  const currentStep = useMemo((): WorkflowStep => {
    // If no image uploaded yet
    if (!uploadedImage) {
      return "upload";
    }

    // Check if improvement is complete
    if (improvementStep?.data) {
      const { status: improvementStatus, url } = improvementStep.data as {
        status: "in-progess" | "completed";
        url: string;
      };

      if (improvementStatus === "completed" && url) {
        return "reveal";
      }

      if (improvementStatus === "in-progess" || hasApprovedChanges) {
        return "processing";
      }
    }

    // If user has approved changes, show processing
    if (hasApprovedChanges) {
      return "processing";
    }

    // Check if we have suggestions (streaming or suspended)
    if (suggestions.length > 0) {
      return "suggestions";
    }

    // If we're streaming or waiting, show analyzing
    if (status === "streaming" || status === "submitted") {
      return "analyzing";
    }

    // Default to analyzing if image is uploaded but no suggestions yet
    return "analyzing";
  }, [
    uploadedImage,
    improvementStep,
    hasApprovedChanges,
    suggestions.length,
    status,
  ]);

  // Check if improvement is complete
  const isImprovementComplete = useMemo(() => {
    if (improvementStep?.data) {
      const { status: improvementStatus } = improvementStep.data as {
        status: "in-progess" | "completed";
      };
      return improvementStatus === "completed";
    }
    return false;
  }, [improvementStep]);

  // Get the improved image URL
  const improvedImageUrl = useMemo(() => {
    if (improvementStep?.data) {
      const { url } = improvementStep.data as { url: string };
      return url || uploadedImage || "";
    }
    return uploadedImage || "";
  }, [improvementStep, uploadedImage]);

  // Handle image upload
  const handleImageUpload = useCallback(
    (imageUrl: string) => {
      setUploadedImage(imageUrl);
      setUserModifiedSuggestions(null);
      setHasApprovedChanges(false);
      sendInteriorImage(imageUrl);
    },
    [sendInteriorImage],
  );

  // Toggle suggestion selection
  const handleToggleSuggestion = useCallback(
    (id: string) => {
      const currentSuggestions = userModifiedSuggestions ?? suggestions;
      setUserModifiedSuggestions(
        currentSuggestions.map((s) =>
          s.id === id ? { ...s, selected: !s.selected } : s,
        ),
      );
    },
    [userModifiedSuggestions, suggestions],
  );

  // Edit suggestion text
  const handleEditSuggestion = useCallback(
    (id: string, newText: string) => {
      const currentSuggestions = userModifiedSuggestions ?? suggestions;
      setUserModifiedSuggestions(
        currentSuggestions.map((s) =>
          s.id === id ? { ...s, text: newText } : s,
        ),
      );
    },
    [userModifiedSuggestions, suggestions],
  );

  // Delete suggestion
  const handleDeleteSuggestion = useCallback(
    (id: string) => {
      const currentSuggestions = userModifiedSuggestions ?? suggestions;
      setUserModifiedSuggestions(currentSuggestions.filter((s) => s.id !== id));
    },
    [userModifiedSuggestions, suggestions],
  );

  // Add new suggestion
  const handleAddSuggestion = useCallback(
    (text: string, zone?: string) => {
      const newSuggestion: Suggestion = {
        id: `custom-${Date.now()}`,
        text,
        selected: true,
        zone: zone || undefined,
      };
      const currentSuggestions = userModifiedSuggestions ?? suggestions;
      setUserModifiedSuggestions([...currentSuggestions, newSuggestion]);
    },
    [userModifiedSuggestions, suggestions],
  );

  // Handle generate - approve selected changes
  const handleGenerate = useCallback(() => {
    const selectedChanges = suggestions
      .filter((s) => s.selected)
      .map((s) => s.text);

    if (selectedChanges.length === 0) return;

    setHasApprovedChanges(true);
    approveChanges(selectedChanges);
  }, [suggestions, approveChanges]);

  // Handle processing complete
  const handleProcessingComplete = useCallback(() => {
    // This is now handled by the derived state
  }, []);

  // Start over
  const handleStartOver = useCallback(() => {
    setUploadedImage(null);
    setUserModifiedSuggestions(null);
    setHighlightedZone(null);
    setHasApprovedChanges(false);
    // Note: This doesn't reset the workflow hook - you might want to reload the page
    // or implement a reset function in the hook
    window.location.reload();
  }, []);

  // Try different suggestions
  const handleTryDifferent = useCallback(() => {
    setHasApprovedChanges(false);
    setUserModifiedSuggestions(null);
  }, []);

  // Download result
  const handleDownload = useCallback(() => {
    if (improvementStep?.data) {
      const { url } = improvementStep.data as { url: string };
      if (url) {
        const link = document.createElement("a");
        link.href = url;
        link.download = "improved-interior.png";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  }, [improvementStep]);

  // Share result
  const handleShare = useCallback(() => {
    if (improvementStep?.data) {
      const { url } = improvementStep.data as { url: string };
      if (url && navigator.share) {
        navigator.share({
          title: "My Interior Design",
          text: "Check out my AI-improved interior design!",
          url: url,
        });
      }
    }
  }, [improvementStep]);

  // Get selected suggestions for processing view
  const selectedSuggestions = useMemo(
    () => suggestions.filter((s) => s.selected).map((s) => s.text),
    [suggestions],
  );

  // Applied changes for reveal screen
  const appliedChanges = useMemo(
    () =>
      suggestions
        .filter((s) => s.selected)
        .map((s) => ({ id: s.id, text: s.text })),
    [suggestions],
  );

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Upload Screen */}
      {currentStep === "upload" && (
        <ImageUploader onImageUpload={handleImageUpload} />
      )}

      {/* Analyzing Screen - show loading while waiting for AI suggestions */}
      {currentStep === "analyzing" && uploadedImage && (
        <div className="min-h-screen flex items-center justify-center p-6 paper-texture">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[var(--accent-terracotta)]/10 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-[var(--accent-terracotta)] border-t-transparent rounded-full animate-spin" />
            </div>
            <h2
              className="text-2xl font-semibold text-[var(--text-primary)] mb-2"
              style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}
            >
              Analyzing your room...
            </h2>
            <p className="text-[var(--text-secondary)]">
              Our AI is studying your space to suggest improvements
            </p>
          </div>
        </div>
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
                  isGenerating={status === "streaming"}
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
          isComplete={isImprovementComplete}
        />
      )}

      {/* Reveal Screen */}
      {currentStep === "reveal" && uploadedImage && (
        <BeforeAfterSlider
          beforeImage={uploadedImage}
          afterImage={improvedImageUrl}
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
