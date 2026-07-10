import type { RevisionSpec } from "@/src/types/presentation-workflow";

export type AgentQuickCommand = "make-concise" | "change-style" | "change-palette";

export type AgentQuickActionChoice = {
  id: string;
  label: string;
  description: string;
  swatches?: string[];
  revision: RevisionSpec;
};

export type AgentQuickActionDefinition = {
  command: AgentQuickCommand;
  userText: string;
  assistantText: string;
  choices: AgentQuickActionChoice[];
};

const quickActions: Record<AgentQuickCommand, AgentQuickActionDefinition> = {
  "change-style": {
    command: "change-style",
    userText: "换一种视觉风格",
    assistantText: "选择一个方向，我会保留现有内容并直接生成新版本。",
    choices: [
      {
        id: "modern-clean",
        label: "现代清爽",
        description: "明亮留白、清晰网格和克制动效",
        revision: {
          kind: "style",
          instruction: "保留现有内容与页序，将整份演示文稿改为现代清爽风格，使用明亮留白、清晰网格和克制动效。",
          style: "现代清爽",
          requiresOutlineReview: false,
        },
      },
      {
        id: "professional-dark",
        label: "专业深色",
        description: "深色背景、严谨层级和精细数据表达",
        revision: {
          kind: "style",
          instruction: "保留现有内容与页序，将整份演示文稿改为专业深色风格，强化信息层级和数据表达。",
          style: "专业深色",
          requiresOutlineReview: false,
        },
      },
      {
        id: "high-contrast-tech",
        label: "高对比科技",
        description: "高对比色、代码感细节和更强视觉节奏",
        revision: {
          kind: "style",
          instruction: "保留现有内容与页序，将整份演示文稿改为高对比科技风格，突出技术感、代码细节和视觉节奏。",
          style: "高对比科技",
          requiresOutlineReview: false,
        },
      },
    ],
  },
  "change-palette": {
    command: "change-palette",
    userText: "修改配色",
    assistantText: "选择一套配色，我会保持版式和内容不变。",
    choices: [
      {
        id: "ink-cyan-violet",
        label: "墨黑 / 青蓝 / 紫罗兰",
        description: "适合技术与产品主题",
        swatches: ["#0b1020", "#12bde8", "#7c3aed"],
        revision: {
          kind: "palette",
          instruction: "保持现有内容与布局，统一改用墨黑、青蓝和紫罗兰配色，确保文字对比度充足。",
          palette: ["#0b1020", "#12bde8", "#7c3aed"],
          requiresOutlineReview: false,
        },
      },
      {
        id: "white-graphite-coral",
        label: "白色 / 石墨 / 珊瑚红",
        description: "适合商务叙事与清晰阅读",
        swatches: ["#ffffff", "#24262b", "#d35b3f"],
        revision: {
          kind: "palette",
          instruction: "保持现有内容与布局，统一改用白色、石墨色和珊瑚红配色，保持克制的商务观感。",
          palette: ["#ffffff", "#24262b", "#d35b3f"],
          requiresOutlineReview: false,
        },
      },
      {
        id: "navy-mint-yellow",
        label: "海军蓝 / 薄荷绿 / 明黄",
        description: "适合活力型教程和团队分享",
        swatches: ["#102a43", "#35c7a5", "#f6c945"],
        revision: {
          kind: "palette",
          instruction: "保持现有内容与布局，统一改用海军蓝、薄荷绿和明黄色配色，兼顾活力与可读性。",
          palette: ["#102a43", "#35c7a5", "#f6c945"],
          requiresOutlineReview: false,
        },
      },
    ],
  },
  "make-concise": {
    command: "make-concise",
    userText: "整体更简洁",
    assistantText: "我会保留页数和叙事结构，精简每页文案与视觉元素。",
    choices: [
      {
        id: "concise-copy",
        label: "开始精简",
        description: "保留页数，压缩文案并减少装饰",
        revision: {
          kind: "content",
          instruction: "保持页数、核心观点和页序不变，精简每页文案，减少重复表达与非必要装饰，使整份演示更利落。",
          requiresOutlineReview: false,
        },
      },
    ],
  },
};

export function getQuickActionDefinition(command: AgentQuickCommand) {
  return quickActions[command];
}
