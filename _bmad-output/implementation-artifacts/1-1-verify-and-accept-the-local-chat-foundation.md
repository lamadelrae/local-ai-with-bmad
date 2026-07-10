---
baseline_commit: 8ca48819e230a77434d03f089617c04ee8b7eb00
---

# Story 1.1: Verify and Accept the Local Chat Foundation

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a solo builder,
I want the existing local chat foundation (inference server, chat API, chat UI, server status, local-only guarantee) formally verified end-to-end,
so that later epics can build on a confirmed-working base instead of re-deriving it.

## Acceptance Criteria

1. **Given** `docker compose up -d` has started the `llama-server` container and it reports healthy, **When** I run `curl http://localhost:8080/v1/chat/completions` with a sample message, **Then** it returns a valid chat completion. (FR1)
2. **Given** the Next.js app is running via `npm run dev`, **When** I open the chat page and send a message, **Then** `/api/chat` streams a response and the UI renders it token-by-token, incrementally. (FR2, FR3)
3. **Given** the model server is running, **When** I load the chat page, **Then** the header shows "Model server online" within one status-check interval. (FR4)
4. **Given** the model server is stopped (`docker compose down`), **When** I reload the chat page, **Then** the header shows "Model server offline" — not a silent hang. (FR4, NFR1)
5. **And** a search of the codebase finds no network call to anything other than `localhost`/`LOCAL_MODEL_BASE_URL`, confirming FR5's local-only guarantee.
6. **And** following the README's "Running it" steps exactly, with no undocumented gaps, produces a working chat. (NFR2)

## Tasks / Subtasks

- [x] Task 1: Verify inference server reachability (AC: 1)
  - [x] Run `docker compose up -d`, wait for the healthcheck to pass (`docker compose logs -f llama-server` until `model loaded` / `listening on http://0.0.0.0:8080`)
  - [x] Run `curl http://localhost:8080/v1/chat/completions -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"hi"}]}'`, confirm a valid OpenAI-compatible completion is returned
- [x] Task 2: Verify end-to-end chat streaming (AC: 2)
  - [x] Run `npm run dev`, open `http://localhost:3000`
  - [x] Send a message via the prompt input, confirm the assistant reply streams incrementally into the conversation view (not all-at-once)
- [x] Task 3: Verify server status indicator (AC: 3, 4)
  - [x] With the model server running, confirm the header shows "Model server online" (green dot) within 10s of page load
  - [x] Run `docker compose down`, reload the page, confirm the header shows "Model server offline" (red dot) rather than hanging or showing nothing
- [x] Task 4: Verify local-only guarantee (AC: 5)
  - [x] Search the codebase (`rg` or equivalent) for `fetch(`, HTTP client imports, or SDK calls; confirm every network call targets `localhost` / `LOCAL_MODEL_BASE_URL` only — none reach an external host
- [x] Task 5: Verify README accuracy for startup (AC: 6)
  - [x] Follow the README's "Running it" section literally, from a clean state if possible; note any deviation between documented and actual behavior
- [x] Task 6: Record verification outcome
  - [x] If any AC fails, root-cause and fix the specific gap only — this is a brownfield app; don't rewrite working code "to improve it"
  - [x] Document pass/fail per AC and any fixes made in Dev Agent Record → Completion Notes List

## Dev Notes

- **This is a verification story, not a build story.** FR1–FR5 are already implemented. Confirmed by direct code review during story creation — do not re-architect any of this, only verify and fix genuine gaps:
  - `docker-compose.yml`: `llama-server` service, image `ghcr.io/ggml-org/llama.cpp:server`, command `-hf ggml-org/gemma-4-E2B-it-GGUF --port 8080 --host 0.0.0.0 -c 8192`, healthcheck via `curl -sf http://localhost:8080/health`.
  - `lib/model.ts`: `createOpenAICompatible({ name: "llama-cpp", baseURL: LOCAL_MODEL_BASE_URL, apiKey: "not-needed" })`, exports `localModel = localProvider.chatModel("gemma-4-E2B-it")`. `LOCAL_MODEL_BASE_URL` defaults to `http://localhost:8080/v1`.
  - `app/api/chat/route.ts`: `POST` handler — `streamText({ model: localModel, messages: await convertToModelMessages(messages) })`, returns `result.toUIMessageStreamResponse()`.
  - `app/api/status/route.ts`: `GET` handler — fetches `new URL("/health", LOCAL_MODEL_BASE_URL)`, which correctly resolves to `http://localhost:8080/health` (an absolute path replaces the base URL's path, so the `/v1` segment is dropped as intended) — returns `{ online: boolean }`.
  - `app/page.tsx`: client component, `useChat()` from `@ai-sdk/react`, renders `Conversation`/`Message`/`PromptInput` (AI Elements) plus a `ServerStatus` sub-component polling `/api/status` every 10s.
- **Known, pre-existing, out-of-scope issue** (already documented in README): `npx tsc --noEmit` reports type errors inside the vendored `components/ai-elements/prompt-input.tsx`, caused by a version mismatch between the AI Elements registry output and the installed `@base-ui/react`. These are confined to attachment/screenshot-action features that neither this story nor the rest of Epic 1 uses. **Do not fix these here** — they don't affect `npm run dev` runtime behavior. Epic 3 (Multimodal File Attachments) will need to revisit this exact file when it wires up attachment UI, at which point this pre-existing mismatch becomes directly relevant — flag it forward, don't absorb it into this story's scope.
- Gemma 4 emits an internal reasoning/thinking pass before its final answer (per README) — expect a multi-second delay before the first streamed token appears on CPU-only hardware. This is expected, not a bug, when checking AC 2's "streams incrementally" behavior.
- README's "How it fits together" section states "Non-goals (by design): auth, a database, multi-user support, cloud fallback, Ollama." This is still accurate for Epic 1's scope (no persistence work has landed yet) but will go stale the moment Epic 2 ships SQLite. **Do not edit this line now** — it's correct today; flag it for Epic 2's dev agent to update when persistence actually lands, to avoid an update racing ahead of the code it describes.
- No automated test framework is configured in this repo (no test runner in `package.json` devDependencies), and architecture's NFR1 ("simplicity over robustness") doesn't mandate one. Verification for this story is manual, driven directly by the ACs above (curl, browser interaction, grep) — not a unit/integration test suite.

### Project Structure Notes

- No new files expected from this story. Touches (read/verify only): `docker-compose.yml`, `lib/model.ts`, `app/api/chat/route.ts`, `app/api/status/route.ts`, `app/page.tsx`, `README.md`.
- File layout matches the Architecture Spine's Seed section exactly — no variance to reconcile.

### References

- [Source: _bmad-output/planning-artifacts/prds/prd-local-ai-with-bmad-2026-07-09/prd.md#Functional Requirements] FR1–FR5
- [Source: _bmad-output/planning-artifacts/architecture/architecture-local-ai-with-bmad-2026-07-09/ARCHITECTURE-SPINE.md#Invariants (Architecture Decisions)] AD-1 (OpenAI-compatible contract), AD-2 (separate processes), AD-4 (no Ollama), AD-5 (errors surface plainly)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-local-ai-with-bmad-2026-07-09/ARCHITECTURE-SPINE.md#Seed] Stack, inference image, app location
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Foundational Local Chat] Story 1.1 source
- [Source: README.md#How it fits together] Stale non-goals line, pre-existing AI Elements type-error note

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- `curl http://localhost:8080/v1/chat/completions` → valid completion, confirms `reasoning_content` field behavior noted in README (internal reasoning pass before final answer)
- `POST /api/chat` network capture → genuine SSE `text-delta` stream (11 incremental deltas for a 6-word reply), not a single chunk
- `npx tsc --noEmit` → 7 pre-existing errors, all confined to `components/ai-elements/prompt-input.tsx` (BaseUI/AI-Elements version mismatch), matching the README's documented claim exactly

### Completion Notes List

- All 6 ACs verified PASS. No gaps found — FR1–FR5 work exactly as documented. No code changes were needed.
- AC1: `curl` against `localhost:8080/v1/chat/completions` returned a valid OpenAI-compatible completion.
- AC2: sent a message via the UI; `preview_network` inspection of the `/api/chat` response confirmed genuine token-by-token SSE streaming (`text-delta` events), not an all-at-once response.
- AC3/AC4: with the server up, header showed "Model server online"; after `docker compose down` + reload, header correctly showed "Model server offline" (no hang).
- AC5: grepped for `fetch(`/HTTP client usage — 3 call sites found (`app/page.tsx`, `app/api/status/route.ts`, `components/ai-elements/prompt-input.tsx`). First two target `localhost` only; the third (`convertBlobUrlToDataUrl`) fetches a browser-local `blob:` URL to convert a local file to a data URL — not a network call. Local-only guarantee holds.
- AC6: followed README's "Running it" section exactly (`docker compose up -d` → `npm run dev` → open `localhost:3000`) — matched documented behavior with no gaps.
- Environment note: had to resolve a port-3000 conflict with another chat session's stale `next dev` process (killed on user confirmation) and added `"autoPort": true` to `.claude/launch.json` for future resilience to this — not a story-scope change, just local dev tooling.
- Per Dev Notes: did not touch `prompt-input.tsx`'s pre-existing type errors (confirmed still present, still confined to unused attachment/preview-card code) and did not touch the README's "no database" non-goals line (still accurate pending Epic 2) — both correctly out of scope for this story.

### File List

- `.claude/launch.json` (added `autoPort: true` — local dev tooling only, not app code)
