"use client";

import { CheckCircle2, Circle, FileCode2, LayoutTemplate, Loader2, RefreshCcw, Sparkles } from "lucide-react";
import Image from "next/image";
import HtmlPreview from "./html-preview";
import type { HtmlGenerationStepData, OutlineStepData } from "@/src/types/presentation-workflow";
import type { SlideOutlineItem } from "./presentation-outline-utils";
import type { FrontendSlidesStylePreview, FrontendSlidesStyleSpec } from "@/src/services/frontend-slides/style-catalog";

type PreviewPaneStep = "brief" | "outlining" | "review" | "generating" | "preview";

interface PresentationPreviewPaneProps {
  step?: PreviewPaneStep;
  currentStep?: PreviewPaneStep;
  html?: string;
  generatedHtml?: string;
  outline: SlideOutlineItem[];
  outlineGeneration?: OutlineStepData;
  htmlGeneration?: HtmlGenerationStepData;
  preservePreviewDuringGeneration?: boolean;
  stylePreviews?: FrontendSlidesStylePreview[];
  selectedStyleId?: string;
  isDiscoveringStyles?: boolean;
  styleBatch?: number;
  remainingStyleCount?: number;
  onSelectStyle?: (style: FrontendSlidesStyleSpec) => void;
  onMoreStyles?: () => void;
}

function StyleDiscovery({ previews, selectedStyleId, isLoading, batch, remaining, onSelect, onMore }: {
  previews: FrontendSlidesStylePreview[];
  selectedStyleId?: string;
  isLoading: boolean;
  batch: number;
  remaining: number;
  onSelect?: (style: FrontendSlidesStyleSpec) => void;
  onMore?: () => void;
}) {
  return (
    <div className="h-full min-h-[620px] overflow-auto bg-[#f5f2ec] p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent-terracotta)]">Frontend Slides · Style Discovery</p>
          <h2 className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">请选择一个真实视觉方向</h2>
          <p className="mt-2 text-[var(--text-secondary)]">每个选项都是按当前演示主题生成的标题页，而不是抽象风格名称。</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">第 {batch} 批{remaining > 0 ? ` · 还有 ${remaining} 种可看` : " · 已展示全部可用方向"}</p>
        </div>
        {isLoading ? (
          <div className="flex min-h-96 items-center justify-center rounded-3xl border border-[var(--border-light)] bg-white">
            <Loader2 className="h-7 w-7 animate-spin text-[var(--accent-terracotta)]" />
            <span className="ml-3 text-[var(--text-secondary)]">正在应用 frontend-slides 设计系统…</span>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-3">
            {previews.map(({ style, previewImage }) => {
              const selected = selectedStyleId === style.id;
              return (
                <button key={style.id} type="button" onClick={() => onSelect?.(style)} className={`overflow-hidden rounded-2xl border-2 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${selected ? "border-[var(--accent-terracotta)] ring-4 ring-[var(--accent-terracotta)]/10" : "border-transparent"}`}>
                  <div className="aspect-video w-full overflow-hidden bg-black">
                    <Image src={previewImage} alt={`${style.name} 风格预览`} width={960} height={540} className="h-full w-full object-cover" />
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-[var(--text-primary)]">{style.name}</h3>{selected ? <CheckCircle2 className="h-5 w-5 text-[var(--accent-terracotta)]" /> : null}</div>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">{style.vibe}</p>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">{style.typography.display} · {style.signatureElements.slice(0, 2).join(" · ")}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {!isLoading ? (
          <div className="mt-6 flex justify-center">
            <button type="button" onClick={onMore} disabled={remaining === 0} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--border-light)] bg-white px-4 text-sm font-medium text-[var(--text-secondary)] transition hover:border-[var(--accent-terracotta)] hover:text-[var(--accent-terracotta)] disabled:cursor-not-allowed disabled:opacity-45">
              <RefreshCcw className="h-4 w-4" />
              {remaining > 0 ? "换一批" : "已展示全部风格"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const generationSteps = [
  { id: "structure", text: "正在组织已选定的幻灯片…", icon: LayoutTemplate },
  { id: "html", text: "正在编写语义化 HTML…", icon: FileCode2 },
  { id: "styles", text: "正在应用演示样式…", icon: Sparkles },
  { id: "bundle", text: "正在准备预览文档…", icon: FileCode2 },
] as const;

function EmptyPreview() {
  return (
    <div className="flex h-full min-h-[620px] items-center justify-center p-8 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent-terracotta)]/10 text-[var(--accent-terracotta)]">
          <Sparkles className="h-8 w-8" />
        </div>
        <h2 className="text-3xl font-semibold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}>你的演示文稿将在这里实时预览</h2>
        <p className="mt-4 text-[var(--text-secondary)]">在右侧告诉我你的想法，大纲和成片都会在这里出现。</p>
      </div>
    </div>
  );
}

function WorkflowStepList({ steps }: { steps: Array<{ id: string; label: string; status: "pending" | "active" | "completed"; detail?: string }> }) {
  return (
    <div className="grid gap-3">
      {steps.map((step) => {
        const StepStateIcon = step.status === "completed" ? CheckCircle2 : step.status === "active" ? Loader2 : Circle;

        return (
          <div
            key={step.id}
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${
              step.status === "pending"
                ? "border-[var(--border-light)] bg-[var(--bg-elevated)] text-[var(--text-muted)]"
                : "border-[var(--accent-terracotta)]/25 bg-[var(--accent-terracotta)]/5 text-[var(--text-primary)]"
            }`}
          >
            <StepStateIcon className={`mt-0.5 h-4 w-4 shrink-0 ${
              step.status === "completed"
                ? "text-emerald-600"
                : step.status === "active"
                  ? "animate-spin text-[var(--accent-terracotta)]"
                  : "text-[var(--border-medium)]"
            }`} />
            <div className="min-w-0">
              <p className="text-sm font-medium">{step.label}</p>
              {step.detail && step.status === "active" ? (
                <p className="mt-1 text-sm text-[var(--text-muted)]">{step.detail}</p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OutlineProgress({ outlineGeneration }: { outlineGeneration?: OutlineStepData }) {
  const progress = outlineGeneration?.progress ?? 12;
  const message = outlineGeneration?.message ?? "正在准备大纲工作流…";
  const steps = outlineGeneration?.steps ?? [
    { id: "prepare", label: "正在阅读你的需求", status: "active" as const },
    { id: "analyze", label: "识别受众与目标", status: "pending" as const },
    { id: "structure", label: "规划整体结构", status: "pending" as const },
    { id: "detail", label: "撰写每页详细内容", status: "pending" as const },
    { id: "review", label: "准备大纲供确认", status: "pending" as const },
  ];

  return (
    <div className="rounded-3xl border border-[var(--border-light)] bg-white/90 p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-terracotta)]/10 text-[var(--accent-terracotta)]">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-semibold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}>
            正在起草大纲…
          </h3>
          <p className="mt-2 text-[var(--text-secondary)]">{message}</p>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--bg-secondary)]">
            <div className="h-full rounded-full bg-[var(--accent-terracotta)] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-sm text-[var(--text-muted)]">{progress}% 已完成</p>
        </div>
      </div>
      <div className="mt-6">
        <WorkflowStepList steps={steps} />
      </div>
    </div>
  );
}

function OutlinePreview({ outline, isLoading, outlineGeneration }: { outline: SlideOutlineItem[]; isLoading: boolean; outlineGeneration?: OutlineStepData }) {
  return (
    <div className="h-full min-h-[calc(100vh-112px)] overflow-auto bg-[linear-gradient(135deg,#faf7f1_0%,#fff_60%,#f7efe5_100%)] p-6">
      <div className="mx-auto max-w-5xl space-y-4 pb-8">
        <div className="rounded-3xl border border-[var(--border-light)] bg-white/85 p-6 shadow-sm backdrop-blur">
          <h2 className="text-2xl font-semibold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}>
            {isLoading ? "正在起草大纲…" : `请确认大纲（${outline.length} 页）——在右侧点击生成，或直接说修改意见`}
          </h2>
        </div>
        {isLoading && outline.length === 0 ? <OutlineProgress outlineGeneration={outlineGeneration} /> : null}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {outline.map((slide, index) => (
            <article key={slide.id} className="min-h-44 rounded-2xl border border-[var(--border-light)] bg-white/90 p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="rounded-full bg-[var(--accent-terracotta)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent-terracotta)]">{index + 1}</span>
                {isLoading ? <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent-terracotta)]" /> : null}
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">{slide.title}</h3>
              <p className="mt-3 line-clamp-4 text-sm text-[var(--text-secondary)]">{slide.notes}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function GenerationProgress({ htmlGeneration }: { htmlGeneration?: HtmlGenerationStepData }) {
  const activeIndex = htmlGeneration?.phase ? Math.max(0, generationSteps.findIndex((step) => step.id === htmlGeneration.phase)) : 0;
  const progress = htmlGeneration?.progress ?? 25;
  const ActiveIcon = generationSteps[activeIndex]?.icon ?? Sparkles;
  const progressSteps = htmlGeneration?.steps ?? [];
  const generatorLabel = htmlGeneration?.generator === "frontend-slides" ? "frontend-slides" : null;

  return (
    <div className="flex h-full min-h-[620px] items-center justify-center bg-[linear-gradient(135deg,#faf7f1_0%,#fff_56%,#f7efe5_100%)] p-8">
      <div className="w-full max-w-xl rounded-3xl border border-[var(--border-light)] bg-[var(--bg-card)]/95 p-8 shadow-lg backdrop-blur">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-terracotta)]/10 text-[var(--accent-terracotta)]">
          <ActiveIcon className="h-7 w-7 animate-pulse" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-3xl font-semibold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}>
            正在生成你的演示文稿…
          </h2>
          <p className="mt-3 text-[var(--text-secondary)]">{htmlGeneration?.message ?? generationSteps[activeIndex]?.text}</p>
          {generatorLabel ? (
            <div className="mt-4 rounded-2xl border border-[var(--border-light)] bg-white/70 px-4 py-3 text-sm text-[var(--text-secondary)]">
              <span className="font-semibold text-[var(--text-primary)]">Generator:</span> {generatorLabel}
              {htmlGeneration?.regenerationReason ? (
                <p className="mt-1 text-[var(--text-muted)]">首次生成未通过完整性检查，已使用 frontend-slides 重新生成。</p>
              ) : null}
            </div>
          ) : null}
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-[var(--bg-secondary)]">
            <div className="h-full rounded-full bg-[var(--accent-terracotta)] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-3 text-sm text-[var(--text-muted)]">{progress}% 已完成</p>
          {progressSteps.length > 0 ? (
            <div className="mt-6 grid gap-3">
              <WorkflowStepList steps={progressSteps} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function PresentationPreviewPane({ step, currentStep, html, generatedHtml, outline, outlineGeneration, htmlGeneration, preservePreviewDuringGeneration = false, stylePreviews = [], selectedStyleId, isDiscoveringStyles = false, styleBatch = 1, remainingStyleCount = 0, onSelectStyle, onMoreStyles }: PresentationPreviewPaneProps) {
  const activeStep = currentStep ?? step ?? "brief";
  const activeHtml = generatedHtml ?? html ?? "";

  if (isDiscoveringStyles || stylePreviews.length > 0) {
    return <StyleDiscovery previews={stylePreviews} selectedStyleId={selectedStyleId} isLoading={isDiscoveringStyles} batch={styleBatch} remaining={remainingStyleCount} onSelect={onSelectStyle} onMore={onMoreStyles} />;
  }

  if (activeStep === "preview" && activeHtml) {
    return <HtmlPreview html={activeHtml} />;
  }

  if (activeStep === "generating") {
    if (preservePreviewDuringGeneration && activeHtml) {
      return (
        <div className="relative h-full min-h-[620px] overflow-hidden">
          <HtmlPreview html={activeHtml} />
          <div className="absolute left-1/2 top-4 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-lg border border-[var(--border-light)] bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--accent-terracotta)]" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary)]">正在生成新版本</p>
              <p className="truncate text-xs text-[var(--text-muted)]">{htmlGeneration?.message ?? "正在保留当前预览并应用修改…"}</p>
            </div>
          </div>
        </div>
      );
    }

    return <GenerationProgress htmlGeneration={htmlGeneration} />;
  }

  if (activeStep === "outlining" || activeStep === "review") {
    return <OutlinePreview outline={outline} isLoading={activeStep === "outlining"} outlineGeneration={outlineGeneration} />;
  }

  return <EmptyPreview />;
}
