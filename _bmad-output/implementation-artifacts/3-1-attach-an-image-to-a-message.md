---
baseline_commit: 8ca48819e230a77434d03f089617c04ee8b7eb00
---

# Story 3.1: Attach an Image to a Message

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to attach a JPEG or PNG to my message,
so that the assistant can answer questions about what's in the image.

## Acceptance Criteria

1. **Given** no `ATTACHMENT` table exists yet, **When** this story's migration runs, **Then** an `ATTACHMENT` table is created (`id`, `messageId` FK, `kind`, `pageIndex`, `data` BLOB, `filename`) per AD-9, `kind` constrained to `'image'|'pdf-page'`.
2. **Given** I'm composing a message, **When** I attach a JPEG or PNG, **Then** it shows as a preview/chip in the input before I send.
3. **Given** I send a message with an attached image, **When** the request reaches `/api/chat`, **Then** the image is sent as an `image_url` content part alongside my text, and the assistant's reply demonstrably references the image's content.
4. **Given** the message was sent with an attachment, **When** it's persisted, **Then** a `MESSAGE` row is created with `content` = my typed text only — never the image data — and a linked `ATTACHMENT` row (`kind='image'`) stores the image bytes as a BLOB.
5. **Given** I reload the conversation, **When** the history renders, **Then** the attached image is redisplayed alongside its message, read back from the `ATTACHMENT` BLOB.

## Tasks / Subtasks

- [x] Task 1: Add the `ATTACHMENT` table (AC: 1)
  - [x] Add `attachment` table to `db/schema.ts`: `id` (nanoid PK), `messageId` (FK to `message.id`, `ON DELETE CASCADE`), `kind` (text, app-level constrained to `'image'|'pdf-page'`), `pageIndex` (integer, nullable — set only for `'pdf-page'`), `data` (blob), `filename` (text)
  - [x] Generate and let the migration auto-apply (same lazy-migration mechanism from Story 2.1 — don't build a second migration path)
- [x] Task 2: Attachment UI in the prompt input (AC: 2)
  - [x] **Read `components/ai-elements/prompt-input.tsx` in full before touching it.** This story is the one that activates the file's existing (but currently unused, per Story 1.1's dev notes) attachment/screenshot-action code paths, and where the pre-existing type mismatch (AI Elements registry vs. installed `@base-ui/react`) becomes directly relevant. Confirm on the actual code whether that mismatch blocks compilation of the attachment path specifically, or is confined to unrelated hover-card/screenshot code — fix only what actually blocks this story's feature, don't do a speculative version-bump of `@base-ui/react` as a side quest
  - [x] Add a file-picker control restricted to `image/jpeg`, `image/png`; show a preview chip before send
- [x] Task 3: Send image as multimodal content (AC: 3)
  - [x] On send, encode the image (base64) and add an `image_url` (or the AI SDK's current equivalent multimodal part type — confirm against the installed `ai` package version's message-part API) content part to the outgoing message alongside the text part
  - [x] Confirm against the running `llama-server` (verify with a manual request first, or lean on Story 4.1's smoke-test pattern if it lands first) that `image_url` parts work end-to-end for this exact model+mmproj combination before considering this AC met — this is architecturally expected to work (AD-6 calls image support "mature"), but confirm on the actual running container, not from the architecture doc alone
- [x] Task 4: Persist image attachments (AC: 4)
  - [x] On message persist (reusing Story 2.1's persistence path in `/api/chat`), if the incoming message includes an image part, insert an `ATTACHMENT` row (`kind='image'`) linked to the new `MESSAGE` row, storing the raw image bytes as the BLOB — `MESSAGE.content` stays text-only per AD-9
- [x] Task 5: Redisplay on reload (AC: 5)
  - [x] When Story 2.1/2.2's message-loading fetch runs, also fetch each message's `ATTACHMENT` rows and render them (e.g. `data:` URL from the BLOB) alongside the message

## Dev Notes

- **AD-6**: image input rides the *existing* `/api/chat` container via llama.cpp's `mtmd`/`mmproj` — no second vision service. This is the mature, low-risk half of AD-6 (audio is the risky half, owned by Epic 4 — not this story's concern).
- **AD-9** (already enforced in Story 2.1's schema): `MESSAGE.content` is plain text only, never inlined attachment data. This story is the first to actually populate `ATTACHMENT` rows — get the `kind`/`pageIndex` constraint right now, since Story 3.2 depends on this table shape without revisiting it.
- Do not build PDF handling here — that's Story 3.2, layered on top of this story's table and UI.
- **File-overlap alert**: this story and Story 2.2 both touch `app/page.tsx`. Per the implementation-readiness assessment, this overlap is accepted as incidental (distinct capabilities sharing a file), not a sign the stories should merge — but if both are implemented concurrently rather than in sequence, coordinate on `app/page.tsx` to avoid clobbering each other's changes (see: this batch is being run with Epic 3 sequenced *after* Epic 2 completes, specifically to avoid this).

### Project Structure Notes

- New: nothing (attachment upload lives inside existing `prompt-input.tsx`/`app/page.tsx`).
- Modified: `db/schema.ts` (new `attachment` table), `components/ai-elements/prompt-input.tsx`, `app/api/chat/route.ts` (multimodal content part handling + attachment persistence), `app/page.tsx` (attachment redisplay).

### References

- [Source: _bmad-output/planning-artifacts/architecture/architecture-local-ai-with-bmad-2026-07-09/ARCHITECTURE-SPINE.md#AD-6, AD-9, Entities] image mechanism, schema constraints
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3, Story 3.1]
- [Source: _bmad-output/implementation-artifacts/1-1-verify-and-accept-the-local-chat-foundation.md] flagged the pre-existing `prompt-input.tsx` type mismatch as relevant here
- [Source: _bmad-output/implementation-artifacts/2-1-persist-and-resume-the-current-conversation.md] persistence path this story extends

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- Read `components/ai-elements/prompt-input.tsx` in full before touching it, per the story's instruction. Found it already has complete attachment infrastructure ready to reuse: `usePromptInputAttachments()` (files/add/remove/openFileDialog), `PromptInputActionAddAttachments`, and — critically — `PromptInput`'s own `handleSubmit` already converts attached files' `blob:` URLs to `data:` URLs (via `convertBlobUrlToDataUrl`, the exact function flagged as relevant back in Story 1.1) before calling `onSubmit({files, text})`. This meant no custom file-to-base64 conversion code was needed anywhere in this story — just wiring existing pieces together.
- The pre-existing type error at line 432 (`PromptInputActionAddAttachments`'s `onSelect`) is exactly the attachment code path this story activates. Left as-is per the story's instruction — confirmed at runtime it doesn't block anything (the handler only calls `e.preventDefault()`, which both the expected and actual event types support).
- **Schema addition beyond the architecture's exact column list**: added `mediaType` (e.g. `"image/png"` vs `"image/jpeg"`) to the `attachment` table. AD-9's column list didn't include it, but without it there's no way to correctly rebuild a `data:` URL for redisplay (`kind='image'` alone doesn't distinguish PNG from JPEG). This is a practical necessity, not a new architectural decision.
- **Confirmed via source inspection** (not assumed): `useChat`'s `sendMessage({text, files: FileUIPart[]})` is directly supported by the installed AI SDK version, and `@ai-sdk/openai-compatible`'s compiled source shows a `{type:'file', mediaType:'image/*', ...}` part maps straight to an `image_url` content part — no manual request-shaping needed.
- **A real, reproducible finding, NOT an app bug**: while verifying AC3, repeated testing with the *same* synthetic test image (sent ~20 times across manual debugging) caused the model to start consistently claiming no image was present, even though the exact same HTTP request (byte-identical, confirmed via a temporary raw-body logging shim on the provider's `fetch`) had succeeded earlier and a `docker compose restart` of the model container didn't fix it. Switching to a genuinely new, never-before-sent image immediately restored correct behavior (3/3 raw curl trials, then confirmed live in the browser). This points to a llama.cpp-level flakiness/caching quirk specific to repeated identical multimodal inputs — worth knowing about for future debugging (don't chase phantom app bugs if the same image has been sent many times in a session), but out of scope to fix here (it's in the inference engine, not this app). AC3 is confirmed working correctly with a fresh image.
- Full browser verification via MCP preview tools against the real llama.cpp container: attached an image, confirmed preview chip (AC2); sent it with a question, confirmed the assistant's reply correctly named the image's actual colors (AC3); confirmed via direct DB read that `MESSAGE.content` held only the typed text and a linked `ATTACHMENT` row held the image BLOB (AC4); reloaded the page and confirmed the image redisplayed from the persisted BLOB (AC5), and fixed a minor ordering inconsistency (image now appears before text on reload, matching live-send order).
- `npx tsc --noEmit` and `npm run lint`: zero new errors/warnings (only the 7 pre-existing `prompt-input.tsx` errors + 1 warning remain).

### Completion Notes List

- All 5 ACs pass, fully verified live against the real model server.
- Reused, rather than duplicated, `prompt-input.tsx`'s existing attachment infrastructure — this story is almost entirely wiring, not new component-building.
- `MESSAGE.content` stays text-only (AD-9); attachments are always separate `ATTACHMENT` rows, `kind='image'`.
- Documented a genuine inference-layer flakiness finding (repeated-identical-image caching quirk) discovered during AC3 verification — not an app bug, no code change made for it.

### File List

- New: nothing (attachment UI lives inside existing `prompt-input.tsx`/`app/page.tsx`), `db/migrations/0002_graceful_black_panther.sql` (+ Drizzle meta), `lib/wav-encode.ts` and `app/api/transcribe/route.ts` are Story 4.2's, not this story's — not listed here.
- Modified: `db/schema.ts` (new `attachment` table incl. `mediaType`), `lib/chat-messages.ts` (`extractImageAttachments`, `getAttachmentsByMessageIds`, attachment-aware `rowsToUIMessages`), `app/api/chat/route.ts` (persist attachments on POST, include in GET), `app/api/conversations/[id]/route.ts` (include attachments in GET), `app/page.tsx` (attach button, chip preview, image redisplay, submit-button attachment awareness)
