# local-gemma-chat

A minimal chat UI (Next.js + Vercel AI SDK + AI Elements + shadcn/ui) talking to a locally-hosted **Gemma 4 E2B** model, served entirely on your own machine via a Dockerized `llama.cpp` server. No cloud API keys, no Ollama, no persistence — everything runs on `localhost`.

See [docs/brief.md](docs/brief.md), [docs/prd.md](docs/prd.md), and [docs/architecture.md](docs/architecture.md) for the full BMAD-produced product brief, PRD, and architecture spine behind this build, and [docs/workflow.md](docs/workflow.md) for a full retrospective on how it was actually built — every step, snag, and divergence from the original BMAD plan.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running)
- Node.js 22+

## Running it

**1. Start the model server:**

```bash
docker compose up -d
```

This pulls `ghcr.io/ggml-org/llama.cpp:server` and downloads the `gemma-4-E2B-it-GGUF` weights (~5GB) into a Docker volume on first run — that first start can take a few minutes. Check readiness with:

```bash
docker compose logs -f llama-server
```

Once you see `model loaded` / `listening on http://0.0.0.0:8080`, the server is ready. Verify directly:

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hi"}]}'
```

**2. Start the app:**

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The header shows a live "Model server online/offline" indicator polling the local server's health.

## Stopping

```bash
docker compose down       # stop and remove the container (keeps the cached model volume)
docker compose down -v    # also delete the cached model (next start re-downloads it)
```

## How it fits together

- **Inference**: `docker-compose.yml` runs `llama.cpp`'s server image, serving Gemma 4 E2B behind an OpenAI-compatible `/v1` endpoint on `localhost:8080`.
- **App**: [lib/model.ts](lib/model.ts) points AI SDK's `createOpenAICompatible` at that endpoint; [app/api/chat/route.ts](app/api/chat/route.ts) streams responses via `streamText`; [app/page.tsx](app/page.tsx) renders the conversation with AI Elements + shadcn/ui.
- **Status check**: [app/api/status/route.ts](app/api/status/route.ts) proxies the model server's `/health` endpoint for the UI indicator.

Non-goals (by design): auth, a database, multi-user support, cloud fallback, Ollama.

## Notes

- Gemma 4 emits an internal reasoning/thinking pass before its final answer; the UI only renders the final text parts, so a reply can take a few seconds to appear on CPU-only hardware.
- `npx tsc --noEmit` reports a handful of pre-existing type errors inside the vendored `components/ai-elements/prompt-input.tsx` (a version mismatch between the AI Elements registry output and the installed `@base-ui/react`), confined to features this app doesn't use (attachments/screenshot actions, hover cards). They don't affect `npm run dev` at runtime.
