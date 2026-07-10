---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-local-ai-with-bmad-2026-07-09/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-local-ai-with-bmad-2026-07-09/ARCHITECTURE-SPINE.md
---

# local-gemma-chat - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for local-gemma-chat, decomposing the requirements from the PRD and Architecture Spine into implementable stories. No UX design document exists for this project — the PRD is shaped as a single-operator capability spec (no personas, no user journeys), consistent with a hobby/solo reference app.

## Requirements Inventory

### Functional Requirements

FR1: A Docker Compose service runs a llama.cpp server container, serving the `gemma-4-E2B-it-GGUF` model, exposing an OpenAI-compatible chat-completions endpoint on `localhost:8080/v1`.
FR2: A Next.js route (`/api/chat`) accepts a message list, calls the local endpoint via AI SDK's `streamText` (OpenAI-compatible provider pointed at `baseURL: http://localhost:8080/v1`), and streams the response back to the client.
FR3: A single page composed of AI Elements components (`Conversation`, `Message`, `PromptInput`) plus shadcn/ui shell: message history, a text input, a send action, and streamed assistant output rendered incrementally.
FR4: The UI surfaces, at a glance, whether the local model server is reachable (e.g. a simple indicator), so "nothing happens" isn't the only signal of a down container.
FR5: No code path calls an external LLM API. The only network dependency at runtime is the local Docker container(s).
FR6: The chat UI lets a user attach a JPEG, PNG, or PDF to a message. The attachment's content is passed to the model as part of a multimodal request (not pre-summarized by a separate cloud service), so the assistant's reply can reference what's in the file.
FR7: The chat UI lets a user record speech via microphone; the audio is transcribed to text by a locally-running speech-to-text model and the result populates (or is appended to) the message input for the user to review and send.
FR8: Every conversation (messages, attachment references, timestamps) is written to a local SQLite database so it survives restarting the web app or the browser.
FR9: The UI provides a way to list past conversations, switch to (resume) any of them, and delete one. Opening the app resumes the most recent conversation by default; the history list is reachable via a visible affordance at any time, not only at startup.

### NonFunctional Requirements

NFR1: Simplicity over robustness — no retry queues, no circuit breakers. Errors surface plainly (e.g. a visible error state in chat) rather than being engineered around.
NFR2: Startup transparency — anyone cloning the repo should be able to go from zero to a working chat using only the README, no tribal knowledge.
NFR3: Portability — runs on any machine with Docker + Node; no dependency on a specific GPU/OS beyond what Docker and llama.cpp themselves require.
NFR4: Local-only extends to new capabilities — attachment interpretation (FR6) and voice transcription (FR7) must not introduce a cloud dependency; they run against the same local Docker-hosted stack (or an additional local-only service alongside it), consistent with FR5.
NFR5: History is a single-file local store — the SQLite database is a plain file on the local machine; no server-side database process, no external hosting.

### Additional Requirements

- **Brownfield foundation, not a fresh scaffold.** The repo already has a working Next.js App Router codebase: `app/page.tsx`, `app/api/chat/route.ts` (FR2), `app/api/status/route.ts` (FR4), AI Elements components (`conversation.tsx`, `message.tsx`, `prompt-input.tsx`), shadcn/ui components, and `docker-compose.yml` (FR1, already running `ghcr.io/ggml-org/llama.cpp:server` with `-hf ggml-org/gemma-4-E2B-it-GGUF`). Epic 1 should ratify/extend this existing foundation, not scaffold from scratch — FR1–FR5 are largely already implemented.
- **New dependencies:** Drizzle ORM + `better-sqlite3` (AD-3, AD-9) for persistence; a PDF-to-image rendering library (AD-7, exact package not yet pinned).
- **New routes required:** `app/api/transcribe/route.ts` (AD-8, FR7), `app/api/conversations/route.ts` + `app/api/conversations/[id]/route.ts` (AD-3/AD-9, FR9 — `GET` lists, `DELETE :id` removes).
- **Runtime constraint:** any route touching SQLite (`/api/chat`, `/api/transcribe`) must set `export const runtime = "nodejs"` — `better-sqlite3` requires Node native bindings, not the Edge runtime.
- **Migration strategy:** Drizzle migrations live in `db/migrations/` and must auto-apply on app startup (checked/run lazily on first DB access from `lib/db.ts`), not a manual step — preserves the PRD's two-command startup goal (NFR2).
- **ID convention:** every entity primary key uses `nanoid()` (already a project dependency) — no auto-increment integers, no UUIDs.
- **Entity schema (AD-9):** `CONVERSATION` (id, title, created_at, updated_at) → `MESSAGE` (id, conversation_id, role, content, created_at; `role` constrained to `'user'|'assistant'`; `content` is always plain display text, never a serialized parts array) → `ATTACHMENT` (id, message_id, kind, page_index, data BLOB, filename; `kind` constrained to `'image'|'pdf-page'`, `page_index` set only when `kind='pdf-page'`). Attachments are stored as BLOBs inside the same SQLite file, not on a separate filesystem path.
- **PDF handling (AD-7):** PDF attachments are rendered to page images before being sent to the model or persisted — never OCR'd/text-extracted. Only the rendered page images persist (as `'pdf-page'` `ATTACHMENT` rows); original PDF bytes are not kept. Only a bounded number of leading pages are rendered per attachment (exact cap: open item, decide during story sizing).
- **Voice-to-text build-blocking risk (AD-6/AD-8):** whether llama.cpp's `input_audio` path actually works end-to-end against the running `ggml-org/gemma-4-E2B-it-GGUF` container is unverified — architecture research found active, recently-reported bugs in this exact area of llama.cpp. FR7's story work must include a smoke-test spike *before* full implementation. If the smoke test fails, the fallback is a second local STT container (e.g. whisper.cpp-class) added to `docker-compose.yml` — the one sanctioned exception to AD-4's one-model rule, requiring a new AD to be logged if triggered, not silently added.
- **`/api/transcribe` persistence boundary (AD-8):** the route is ephemeral — it must not create any `CONVERSATION`, `MESSAGE`, or `ATTACHMENT` row, and must not persist the raw audio. Only `/api/chat`'s existing path creates `MESSAGE` rows; there is exactly one code path that writes a message.
- **Image/audio input mechanism (AD-6):** both ride the *existing* `/api/chat` OpenAI-compatible contract via llama.cpp's `mtmd`/`mmproj` support — no second vision model/container. Image input is confirmed mature; audio is the open item above.

### UX Design Requirements

No UX design document exists for this project. The PRD is a capability spec for a single-operator hobby app — no personas, no user journeys, no design tokens to source-extract. This section is intentionally empty.

### FR Coverage Map

FR1: Epic 1 - Inference server (Docker Compose, llama.cpp, gemma-4-E2B-it-GGUF)
FR2: Epic 1 - Chat API route (/api/chat, streamText)
FR3: Epic 1 - Chat UI (AI Elements + shadcn/ui)
FR4: Epic 1 - Server status affordance
FR5: Epic 1 - Local-only guarantee
FR6: Epic 3 - Multimodal file attachment (JPEG/PNG/PDF)
FR7: Epic 4 - Local voice-to-text
FR8: Epic 2 - Persistent conversation storage (SQLite)
FR9: Epic 2 - Conversation history management (list/switch/delete)

## Epic List

### Epic 1: Foundational Local Chat
Users can have a real-time, streamed conversation with the local Gemma model, see at a glance whether the model server is up, and know nothing ever leaves their machine.
**FRs covered:** FR1, FR2, FR3, FR4, FR5
**Implementation note:** Mostly already built (`app/api/chat/route.ts`, `app/api/status/route.ts`, AI Elements components, `docker-compose.yml` all exist). Stories here verify/complete this existing foundation rather than building from zero.

### Epic 2: Persistent Conversation History
Users' conversations survive restarting the app or browser; they can browse past conversations, resume any of them, and delete one.
**FRs covered:** FR8, FR9
**Implementation note:** Introduces the SQLite schema (`CONVERSATION`/`MESSAGE`/`ATTACHMENT`, Drizzle + `better-sqlite3`, per AD-3/AD-9). Epic 3 builds on this schema's `ATTACHMENT` table — an allowed forward dependency (later epic depends on earlier, never the reverse).

### Epic 3: Multimodal File Attachments
Users can attach a JPEG, PNG, or PDF to a message and get a response informed by its content.
**FRs covered:** FR6
**Implementation note:** Depends on Epic 2's schema for storing attachment BLOBs. Includes the PDF-to-page-image rendering path (AD-7).

### Epic 4: Local Voice-to-Text
Users can dictate a message via microphone instead of typing, review the transcription, and send.
**FRs covered:** FR7
**Implementation note:** Deliberately isolated — the one genuine risk boundary in this build. `input_audio` support in llama.cpp for this exact model is unverified (open bug reports). First story is a smoke-test spike; its outcome (native audio works vs. needs a fallback STT container) could change this epic's approach without touching Epics 1–3.

## Epic 1: Foundational Local Chat

Users can have a real-time, streamed conversation with the local Gemma model, see at a glance whether the model server is up, and know nothing ever leaves their machine.

**FRs covered:** FR1, FR2, FR3, FR4, FR5

### Story 1.1: Verify and Accept the Local Chat Foundation

As a solo builder,
I want the existing local chat foundation (inference server, chat API, chat UI, server status, local-only guarantee) formally verified end-to-end,
So that later epics can build on a confirmed-working base instead of re-deriving it.

**Acceptance Criteria:**

**Given** `docker compose up -d` has started the `llama-server` container and it reports healthy
**When** I run `curl http://localhost:8080/v1/chat/completions` with a sample message
**Then** it returns a valid chat completion (FR1)

**Given** the Next.js app is running via `npm run dev`
**When** I open the chat page and send a message
**Then** `/api/chat` streams a response and the UI renders it token-by-token, incrementally (FR2, FR3)

**Given** the model server is running
**When** I load the chat page
**Then** the header shows "Model server online" within one status-check interval (FR4)

**Given** the model server is stopped (`docker compose down`)
**When** I reload the chat page
**Then** the header shows "Model server offline" — not a silent hang (FR4, NFR1)

**And** a search of the codebase finds no network call to anything other than `localhost`/`LOCAL_MODEL_BASE_URL`, confirming FR5's local-only guarantee
**And** following the README's "Running it" steps exactly, with no undocumented gaps, produces a working chat (NFR2)

## Epic 2: Persistent Conversation History

Users' conversations survive restarting the app or browser; they can browse past conversations, resume any of them, and delete one.

**FRs covered:** FR8, FR9

### Story 2.1: Persist and Resume the Current Conversation

As a user,
I want my conversation saved automatically and reloaded when I reopen the app,
So that my chat history survives restarts.

**Acceptance Criteria:**

**Given** no existing database file
**When** the app starts (`npm run dev`)
**Then** Drizzle migrations auto-apply, creating the SQLite file with `CONVERSATION` and `MESSAGE` tables (AD-9 conventions: `nanoid()` PKs, `role` constrained to `'user'|'assistant'`, `content` plain text)

**Given** a running chat
**When** I send a message and receive an assistant reply
**Then** both are persisted as `MESSAGE` rows linked to a `CONVERSATION` row

**Given** I've chatted and reload the browser (app/Docker still running)
**When** the page loads
**Then** it fetches and renders the persisted conversation's full message history — not a blank page

**Given** I restart `npm run dev` (or the machine) and reopen the app
**When** the page loads
**Then** the most recent conversation's messages are still there (FR8; satisfies FR9's "resume most recent by default")

**Given** a `CONVERSATION` row is created (its first message is being sent)
**When** that first message is persisted
**Then** `CONVERSATION.title` is set once to the first ~50 characters of that message's text (never updated afterward)

**Given** any message (user or assistant) is added to a `CONVERSATION`
**When** it's persisted
**Then** `CONVERSATION.updated_at` is bumped to the current time — this is what Story 2.2's "most recently updated first" sort depends on

**And** `/api/chat` sets `export const runtime = "nodejs"` per the architecture's SQLite runtime constraint

### Story 2.2: Browse, Resume, and Delete Past Conversations

As a user,
I want to see a list of my past conversations, switch between them, start a new one, or delete one,
So that I can manage more than just my single most-recent chat.

**Acceptance Criteria:**

**Given** I have multiple conversations in the database
**When** I open the history list (a visible affordance, reachable any time — not just at startup)
**Then** I see all conversations, most recently updated first

**Given** the history list is open
**When** I select a past conversation
**Then** the chat view switches to that conversation's full message thread, and new messages I send are appended to it, not to a new conversation

**Given** the history list is open
**When** I delete a conversation
**Then** it's removed from the list and its `MESSAGE` rows are removed too (`DELETE /api/conversations/[id]`); if it was the active conversation, the UI falls back to the next most recent (or a fresh empty conversation if none remain)

**Given** I want to start something new
**When** I trigger "new conversation"
**Then** an empty conversation becomes active, ready to receive the first message (creating its `CONVERSATION` row on first send, not on click, to avoid empty orphan rows)

## Epic 3: Multimodal File Attachments

Users can attach a JPEG, PNG, or PDF to a message and get a response informed by its content.

**FRs covered:** FR6

### Story 3.1: Attach an Image to a Message

As a user,
I want to attach a JPEG or PNG to my message,
So that the assistant can answer questions about what's in the image.

**Acceptance Criteria:**

**Given** no `ATTACHMENT` table exists yet
**When** this story's migration runs
**Then** an `ATTACHMENT` table is created (`id`, `message_id` FK, `kind`, `page_index`, `data` BLOB, `filename`) per AD-9, `kind` constrained to `'image'|'pdf-page'`

**Given** I'm composing a message
**When** I attach a JPEG or PNG
**Then** it shows as a preview/chip in the input before I send

**Given** I send a message with an attached image
**When** the request reaches `/api/chat`
**Then** the image is sent as an `image_url` content part alongside my text (AD-6), and the assistant's reply demonstrably references the image's content

**Given** the message was sent with an attachment
**When** it's persisted
**Then** a `MESSAGE` row is created with `content` = my typed text only — never the image data (AD-9) — and a linked `ATTACHMENT` row (`kind='image'`) stores the image bytes as a BLOB

**Given** I reload the conversation (Story 2.1's persistence)
**When** the history renders
**Then** the attached image is redisplayed alongside its message, read back from the `ATTACHMENT` BLOB

### Story 3.2: Attach a PDF to a Message

As a user,
I want to attach a PDF to my message,
So that the assistant can answer questions about the document's content.

**Acceptance Criteria:**

**Given** I attach a PDF
**When** it's processed before sending
**Then** its pages are rendered to images (AD-7), capped at the first 5 pages

**Given** the PDF has been rendered
**When** the message is sent
**Then** each rendered page is sent as a separate `image_url` content part — same mechanism as Story 3.1's native images — and the assistant's reply can reference the document's content

**Given** the message is persisted
**When** attachment rows are written
**Then** one `ATTACHMENT` row per rendered page is created with `kind='pdf-page'` and an incrementing `page_index`; the original PDF bytes are never stored (AD-7)

**Given** the PDF has more than 5 pages
**When** it's rendered
**Then** only the first 5 are sent/stored, and the UI visibly indicates the attachment was truncated

**Given** I reload the conversation
**When** the history renders
**Then** the rendered PDF pages redisplay as image attachments on their message, same as Story 3.1

## Epic 4: Local Voice-to-Text

Users can dictate a message via microphone instead of typing, review the transcription, and send.

**FRs covered:** FR7

### Story 4.1: Smoke-Test Native Audio Input

As the builder,
I want to know definitively whether `input_audio` works end-to-end against the running `ggml-org/gemma-4-E2B-it-GGUF` container before building on it,
So that Story 4.2 isn't built on an unverified foundation.

**Acceptance Criteria:**

**Given** the running llama.cpp container (model + `mmproj`)
**When** a short sample recording is sent to `/v1/chat/completions` as an `input_audio` content part
**Then** the response is inspected for a valid, coherent transcription — vs. an error, assert, or hang

**Given** the smoke test succeeds
**When** Story 4.2 begins
**Then** it proceeds against the native `input_audio` path (AD-6/AD-8 as written)

**Given** the smoke test fails
**When** Story 4.2 begins
**Then** it targets a fallback local STT container instead (e.g. whisper.cpp-class, added to `docker-compose.yml`), and a new AD is logged capturing this exception to AD-4's one-model rule — per the architecture's explicit instruction, not silently added

**And** the smoke test's outcome and evidence are recorded (e.g. as a note in this epic) so the decision isn't lost

### Story 4.2: Record and Transcribe Speech to Text

As a user,
I want to record my voice and have it transcribed into the message input,
So that I can dictate instead of typing.

**Acceptance Criteria:**

**Given** I engage the microphone control
**When** I speak and stop
**Then** `MediaRecorder` captures one bounded recording (max 30s, matching `mtmd`'s chunk limit), stopping automatically at the cap if I don't stop it myself

**Given** a recording is captured
**When** it's sent to `/api/transcribe`
**Then** the route sends it via Story 4.1's selected backend with a transcription-focused prompt and returns the transcribed text

**Given** a transcription is returned
**When** it arrives
**Then** it populates the message input box for me to review/edit — never auto-sent (AD-8)

**Given** `/api/transcribe` has run
**When** I inspect the database afterward
**Then** no `CONVERSATION`/`MESSAGE`/`ATTACHMENT` row exists and the raw audio was not persisted (AD-8's ephemeral boundary) — the transcribed text only becomes a real `MESSAGE` if I edit and send it via the existing `/api/chat` path

**Given** the model server is unreachable or transcription fails
**When** I try to record
**Then** a plain error state is shown (NFR1 — no retry engineering) and I can still type manually
