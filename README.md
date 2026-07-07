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
```

Model values may be raw provider model IDs such as `google/gemini-3-flash-preview`. For backward compatibility, the helper also accepts `openrouter/`, `openai/`, `google/`, and `google-generative-ai/` prefixes and strips them before sending the model ID to the selected provider.

## Main directories and files

- `src/app/api/analyze/route.ts`: Next.js API route that accepts presentation chat/workflow requests, validates user input, starts or resumes the presentation workflow, and streams workflow events back to the client.
- `src/mastra/workflows/`: Mastra workflow definitions. The presentation workflow handles the brief → outline review → HTML generation sequence.
- `src/components/presentation-studio/`: React components for the presentation creation UI, including the brief form, outline review panel, processing view, and HTML preview.

## Generated slide output

Generated HTML decks are written to:

```text
public/generated-slides/
```

The returned deck URL is served from the public path, for example `/generated-slides/<file-name>.html`.

## Current limitations

- Generated presentation HTML is saved to the local `public/generated-slides/` directory.
- The generated files are **not** stored in durable object storage. In production or serverless environments, local files may be lost across deploys, restarts, or instances.
- For persistent production use, replace the local file writer with object storage such as S3, R2, GCS, or another durable asset store and return the stored asset URL.
