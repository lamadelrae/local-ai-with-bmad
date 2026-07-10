---
title: PRD — local-gemma-chat
status: final
created: 2026-07-09
updated: 2026-07-09
---

# PRD: local-gemma-chat

Stakes: hobby/solo. This PRD is intentionally short — see the companion Product Brief (`_bmad-output/planning-artifacts/briefs/brief-local-ai-with-bmad-2026-07-09/brief.md`) for narrative context.

## Summary

A single-page chat app that streams responses from a locally-hosted Gemma 4 E2B model, served via a Dockerized llama.cpp server exposing an OpenAI-compatible `/v1` endpoint. Built with Next.js, Vercel AI SDK, AI Elements, and shadcn/ui. Beyond plain text chat, users can attach images (JPEG/PNG) or PDFs for the model to read, dictate messages via local voice-to-text, and have every conversation persisted locally in SQLite so history survives restarts — all without any call leaving the machine.

## Goals

- Two-command startup: `docker compose up` (model server) + `npm run dev` (web app).
- A working chat conversation, streamed token-by-token, against a fully local model — zero cloud calls.
- Attach a JPEG, PNG, or PDF to a message and get a response informed by its content — no cloud vision/OCR API.
- Speak a message via microphone and have it transcribed locally to text — no cloud STT API.
- Conversation history persists across restarts in a local SQLite database, with the ability to browse and resume past conversations.
- Small enough to read end-to-end in one sitting; a reference, not a product.

## Non-Goals

- Auth / user accounts
- Multi-user support
- Cloud-model fallback if the local server is unavailable
- Ollama, in any form
- Cloud-based vision, OCR, or speech-to-text services of any kind — all new capabilities stay local
- Cross-device sync or sharing of history — a single local SQLite file, tied to this machine

## Users

Single user: the person running this on their own laptop for a self-contained local chat and to see the BMAD workflow in action.

## Functional Requirements

**FR-1 Inference server** — A Docker Compose service runs a llama.cpp server container, serving the `gemma-4-E2B-it-GGUF` model, exposing an OpenAI-compatible chat-completions endpoint on `localhost:8080/v1`.

**FR-2 Chat API route** — A Next.js route (`/api/chat`) accepts a message list, calls the local endpoint via AI SDK's `streamText` (using an OpenAI-compatible provider pointed at `baseURL: http://localhost:8080/v1`), and streams the response back to the client.

**FR-3 Chat UI** — A single page composed of AI Elements components (`Conversation`, `Message`, `PromptInput`, or current equivalents) plus shadcn/ui shell: message history, a text input, a send action, and streamed assistant output rendered incrementally.

**FR-4 Server status affordance** — The UI surfaces, at a glance, whether the local model server is reachable (e.g. a simple indicator), so "nothing happens" isn't the only signal of a down container.

**FR-5 Local-only guarantee** — No code path calls an external LLM API. The only network dependency at runtime is the local Docker container(s).

*(FR-6 through FR-9 are independent and can be built/shipped in any order.)*

**FR-6 Multimodal file attachment** — The chat UI lets a user attach a JPEG, PNG, or PDF to a message. The attachment's content is passed to the model as part of a multimodal request (not pre-summarized by a separate cloud service), so the assistant's reply can reference what's in the file.

**FR-7 Local voice-to-text** — The chat UI lets a user record speech via microphone; the audio is transcribed to text by a locally-running speech-to-text model and the result populates (or is appended to) the message input for the user to review and send.

**FR-8 Persistent conversation storage** — Every conversation (messages, attachment references, timestamps) is written to a local SQLite database so it survives restarting the web app or the browser.

**FR-9 Conversation history management** — The UI provides a way to list past conversations, switch to (resume) any of them, and delete one. Opening the app resumes the most recent conversation by default (a single-user reference app has no reason to force a choice screen); the history list is reachable via a visible affordance at any time, not only at startup.

## Non-Functional Requirements

- **Simplicity over robustness.** No retry queues, no circuit breakers — this is a toy. Errors can surface plainly (e.g. a visible error state in chat) rather than being engineered around.
- **Startup transparency.** Anyone cloning the repo should be able to go from zero to a working chat using only the README, no tribal knowledge.
- **Portability.** Runs on any machine with Docker + Node; no dependency on a specific GPU/OS beyond what Docker and llama.cpp themselves require.
- **Local-only extends to new capabilities.** Attachment interpretation (FR-6) and voice transcription (FR-7) must not introduce a cloud dependency — they run against the same local Docker-hosted stack (or an additional local-only service alongside it), consistent with FR-5.
- **History is a single-file local store.** The SQLite database is a plain file on the local machine — no server-side database process, no external hosting.

## Success Metrics

- `curl localhost:8080/v1/chat/completions` returns a valid completion after `docker compose up`.
- A message typed in the browser produces a streamed, visibly-token-by-token assistant reply.
- Attaching a JPEG or PNG to a message and asking about it produces a reply that accurately reflects the image's content (verified by manual eyeball check, not an automated metric).
- Attaching a PDF and asking about it produces a reply that accurately reflects the document's content (manual eyeball check).
- Speaking a sentence into the microphone produces an accurate text transcription in the input box, with no network call leaving the machine (manual eyeball check).
- Restarting the browser (or the app) and reopening it shows the prior conversation(s) in a history list, and resuming one restores its full message thread.

**Counter-metric:** don't let "make it robust" scope-creep into auth, multi-user support, or a general-purpose document-management system — history and attachments serve this one user's own chat, not a knowledge base product.

## Glossary

- **Conversation** — one persisted thread of messages (user + assistant), stored as a unit in SQLite; equivalent to what FR-9 calls "history."
- **Attachment** — a JPEG, PNG, or PDF file attached to a single message (FR-6); not itself persisted as a separate entity beyond its reference in the conversation.
- **Local-only guarantee** — no runtime network call leaves the machine for any capability (chat, attachments, voice), per FR-5 and its extension in the Non-Functional Requirements.

## Open Questions / Assumptions

- `[OPEN QUESTION]` If the chosen Gemma 4 E2B GGUF lacks a working PDF-to-vision path, should PDF support ship v1 as text-extraction-only (weaker: loses layout/images in the PDF) or be cut from v1 entirely and revisited once native handling is confirmed? Currently unresolved — pick at architecture time.
- `[ASSUMPTION]` Model file is pulled by the llama.cpp Docker image itself (via `-hf` flag) rather than pre-downloaded and bind-mounted, to keep the compose file self-contained.
- `[ASSUMPTION]` No GPU acceleration is assumed/required; CPU inference on E2B is acceptable for a toy chat (may be slow on constrained hardware — acceptable per non-goals).
- `[ASSUMPTION]` Gemma 4 E2B/E4B natively supports image and audio input in llama.cpp via `mtmd` (a companion `mmproj` file), through the same endpoint — so FR-6 and FR-7 likely need no separate vision/STT service. Confirm the published GGUF repo ships `mmproj` at build time.
- `[ASSUMPTION]` Audio input in llama.cpp's `mtmd` support is processed in fixed ~30-second chunks; for voice-to-text as a dictation feature (short utterances) this should be sufficient, but architecture should confirm behavior for longer recordings.
- `[ASSUMPTION]` PDFs are not natively consumable by a vision model the way an image is; the architecture phase will decide the mechanism (e.g. rendering PDF pages to images before multimodal input, or text extraction as a fallback) to satisfy FR-6's "no separate OCR pipeline" preference as closely as feasible.
- `[NOTE FOR PM]` This PRD now contradicts the companion Product Brief's Non-Goals ("Persistence or a database" / "no database, anywhere in the stack") and the Architecture Spine's AD-3 ("No persistence layer"). The Brief should be revised via `bmad-product-brief` to match, and the Architecture Spine will need a new decision superseding AD-3 when `bmad-architecture` is next run.
