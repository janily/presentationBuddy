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

Create a `.env.local` file in the repository root. The presentation agents currently use the shared OpenRouter provider helper in `src/utils/openrouter.ts`, so OpenRouter credentials are required unless you change the provider implementation in code.

```bash
# Required for the current OpenRouter provider configuration.
OPENROUTER_API_KEY=your-openrouter-api-key

# Optional. Defaults to google/gemini-3-flash-preview.
PRESENTATION_OUTLINE_MODEL=google/gemini-3-flash-preview

# Optional. Defaults to google/gemini-3-flash-preview.
PRESENTATION_HTML_MODEL=google/gemini-3-flash-preview
```

Model values may be raw OpenRouter model IDs such as `google/gemini-3-flash-preview`. The helper also accepts the legacy `openrouter/` prefix and strips it before sending the model ID to OpenRouter.

To use a different model provider, update the provider helper and the presentation agents that call it, then replace `OPENROUTER_API_KEY` with the credential required by that provider.

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
