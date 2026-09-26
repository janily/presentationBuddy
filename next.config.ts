import type { NextConfig } from "next";
import { GENERATED_HTML_HEADERS } from "./src/utils/generated-html-security";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@mastra/*"],
  outputFileTracingIncludes: {
    "/api/analyze": [
      "./.claude/skills/frontend-slides/*.md",
      "./.claude/skills/frontend-slides/viewport-base.css",
      "./.claude/skills/frontend-slides/bold-template-pack/templates/*/design.md",
    ],
    "/api/style-discovery": [
      "./.claude/skills/frontend-slides/SKILL.md",
      "./.claude/skills/frontend-slides/STYLE_PRESETS.md",
    ],
  },
  async headers() {
    return [{
      // Local/self-hosted saves use public/, bypassing the API route.
      source: "/generated-slides/:path*",
      headers: Object.entries(GENERATED_HTML_HEADERS).map(([key, value]) => ({ key, value })),
    }];
  },
};

export default nextConfig;
