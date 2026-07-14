# Presentation Buddy

Presentation Buddy is a Next.js + Mastra application for turning a presentation brief into a browser-ready HTML slide deck. The main flow is:

1. **Brief**: the user submits a presentation topic, audience, goals, and constraints in the studio UI.
2. **Outline review**: the Mastra workflow asks an outline agent to propose slide structure and pauses so the outline can be reviewed or adjusted.
3. **HTML deck generation**: after approval, a generation agent creates a complete HTML deck and saves it under the app's public assets.

## Local development

Install dependencies first:

```bash
pnpm install
```

Run the Next.js web application:

```bash
pnpm dev
```

Open <http://localhost:3000> to use the presentation studio.

If you want to run or inspect Mastra workflows directly, start the Mastra development server in a separate terminal:

```bash
pnpm mastra
```

## Environment variables and model provider

Create a `.env.local` file in the repository root. Presentation agents use the shared provider helper in `src/utils/model-provider.ts`, so the model provider can be selected without code changes.

```bash
# Optional. Defaults to openrouter. Supported values: openrouter, openai, google,
# and openai-compatible. Individual agents can override this with
# PRESENTATION_OUTLINE_PROVIDER or PRESENTATION_HTML_PROVIDER.
MODEL_PROVIDER=openrouter

# Required by the selected provider. You can use MODEL_API_KEY for any provider,
# or provider-specific keys such as OPENROUTER_API_KEY, OPENAI_API_KEY,
# GOOGLE_GENERATIVE_AI_API_KEY, or GOOGLE_API_KEY.
MODEL_API_KEY=your-provider-api-key

# Optional. Useful for OpenAI-compatible providers or proxies. Provider-specific
# alternatives such as OPENROUTER_BASE_URL, OPENAI_BASE_URL, and
# GOOGLE_GENERATIVE_AI_BASE_URL are also supported.
MODEL_BASE_URL=https://your-provider-base-url.example/v1

# Optional. Defaults to google/gemini-3-flash-preview.
PRESENTATION_OUTLINE_MODEL=google/gemini-3-flash-preview
PRESENTATION_OUTLINE_PROVIDER=openrouter

# Optional. Defaults to google/gemini-3-flash-preview.
PRESENTATION_HTML_MODEL=google/gemini-3-flash-preview
PRESENTATION_HTML_PROVIDER=openrouter

# Optional. Maximum output budget for full-deck HTML generation. Defaults to 32768.
PRESENTATION_HTML_MAX_OUTPUT_TOKENS=32768

# Optional. Use a dedicated Mastra model/provider for frontend-slides generation.
# When omitted, PRESENTATION_HTML_MODEL / PRESENTATION_HTML_PROVIDER are used.
FRONTEND_SLIDES_MASTRA_MODEL=google/gemini-3-flash-preview
FRONTEND_SLIDES_MASTRA_PROVIDER=openrouter
```

Model values may be raw provider model IDs such as `google/gemini-3-flash-preview`. For backward compatibility, the helper also accepts `openrouter/`, `openai/`, `google/`, and `google-generative-ai/` prefixes and strips them before sending the model ID to the selected provider.

The presentation workflow always generates the final deck through the Mastra `frontendSlidesComposerAgent` with the full `frontend-slides` skill context. Output must be a complete document with exactly the approved slide count. If the first attempt fails or is incomplete, the same frontend-slides agent performs one full regeneration; the workflow never switches to another HTML generator.

## Main directories and files

- `src/app/api/analyze/route.ts`: Next.js API route that accepts presentation chat/workflow requests, validates user input, starts or resumes the presentation workflow, and streams workflow events back to the client.
- `src/mastra/workflows/`: Mastra workflow definitions. The presentation workflow handles the brief → outline review → HTML generation sequence.
- `src/mastra/agents/frontend-slides-composer-agent.ts`: The only agent used to generate final presentation HTML.
- `src/services/frontend-slides/`: Loads the complete `.claude/skills/frontend-slides` contract, builds generation prompts, and validates fixed-stage output.
- `src/utils/outline-to-slides-mapper.ts`: Converts approved presentation outlines into structured frontend-slides input.
- `src/components/presentation-studio/`: React components for the presentation creation UI, including the brief form, outline review panel, processing view, and HTML preview.

## Generated slide output

By default, generated HTML decks are written to:

```text
public/generated-slides/
```

The returned deck URL is served from the public path, for example `/generated-slides/<file-name>.html`.

Production deployments can override the output directory:

```bash
# Recommended for Zeabur or other container platforms with a mounted volume.
GENERATED_SLIDES_DIR=/data/generated-slides
```

When `GENERATED_SLIDES_DIR` is set, or when `VERCEL=1`, decks are served through the preview API because they are not under `public/`:

```text
/api/preview/<file-name>.html
```

For Zeabur, mount a persistent volume such as `/data`, then set `GENERATED_SLIDES_DIR=/data/generated-slides`. Without a volume, generated files can be lost after redeploys or restarts.

For Vercel, the app writes generated decks to `/tmp/generated-slides` and exports `maxDuration = 300` on the analyze route. This is only suitable for short-lived previews; files in `/tmp` are not durable and may disappear after function restarts. For durable production history on serverless platforms, use object storage such as S3, R2, or GCS.
