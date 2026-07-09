---
title: PRD — local-gemma-chat
status: final
created: 2026-07-09
updated: 2026-07-09
---

# PRD: local-gemma-chat

Stakes: hobby/solo. This PRD is intentionally short — see `docs/brief.md` for narrative context.

## Summary

A single-page chat app that streams responses from a locally-hosted Gemma 4 E2B model, served via a Dockerized llama.cpp server exposing an OpenAI-compatible `/v1` endpoint. Built with Next.js, Vercel AI SDK, AI Elements, and shadcn/ui.

## Goals

- Two-command startup: `docker compose up` (model server) + `npm run dev` (web app).
- A working chat conversation, streamed token-by-token, against a fully local model — zero cloud calls.
- Small enough to read end-to-end in one sitting; a reference, not a product.

## Non-Goals

- Auth / user accounts
- Persistence or a database (chat history lives only in browser/session memory)
- Multi-user support
- Cloud-model fallback if the local server is unavailable
- Ollama, in any form

## Users

Single user: the person running this on their own laptop for a self-contained local chat and to see the BMAD workflow in action.

## Functional Requirements

**FR-1 Inference server** — A Docker Compose service runs a llama.cpp server container, serving the `gemma-4-E2B-it-GGUF` model, exposing an OpenAI-compatible chat-completions endpoint on `localhost:8080/v1`.

**FR-2 Chat API route** — A Next.js route (`/api/chat`) accepts a message list, calls the local endpoint via AI SDK's `streamText` (using an OpenAI-compatible provider pointed at `baseURL: http://localhost:8080/v1`), and streams the response back to the client.

**FR-3 Chat UI** — A single page composed of AI Elements components (`Conversation`, `Message`, `PromptInput`, or current equivalents) plus shadcn/ui shell: message history, a text input, a send action, and streamed assistant output rendered incrementally.

**FR-4 Server status affordance** — The UI surfaces, at a glance, whether the local model server is reachable (e.g. a simple indicator), so "nothing happens" isn't the only signal of a down container.

**FR-5 Local-only guarantee** — No code path calls an external LLM API. The only network dependency at runtime is the local Docker container.

## Non-Functional Requirements

- **Simplicity over robustness.** No retry queues, no circuit breakers — this is a toy. Errors can surface plainly (e.g. a visible error state in chat) rather than being engineered around.
- **Startup transparency.** Anyone cloning the repo should be able to go from zero to a working chat using only the README, no tribal knowledge.
- **Portability.** Runs on any machine with Docker + Node; no dependency on a specific GPU/OS beyond what Docker and llama.cpp themselves require.

## Success Metrics

- `curl localhost:8080/v1/chat/completions` returns a valid completion after `docker compose up`.
- A message typed in the browser produces a streamed, visibly-token-by-token assistant reply.

**Counter-metric:** don't let "make it robust" scope-creep into auth, persistence, or multi-model support — that would defeat the point of a minimal reference.

## Open Questions / Assumptions

- `[ASSUMPTION]` Model file is pulled by the llama.cpp Docker image itself (via `-hf` flag) rather than pre-downloaded and bind-mounted, to keep the compose file self-contained.
- `[ASSUMPTION]` No GPU acceleration is assumed/required; CPU inference on E2B is acceptable for a toy chat (may be slow on constrained hardware — acceptable per non-goals).
