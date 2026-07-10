---
baseline_commit: 8ca48819e230a77434d03f089617c04ee8b7eb00
---

# Story 4.2: Record and Transcribe Speech to Text

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to record my voice and have it transcribed into the message input,
so that I can dictate instead of typing.

## Acceptance Criteria

1. **Given** I engage the microphone control, **When** I speak and stop, **Then** `MediaRecorder` captures one bounded recording (max 30s, matching `mtmd`'s chunk limit), stopping automatically at the cap if I don't stop it myself.
2. **Given** a recording is captured, **When** it's sent to `/api/transcribe`, **Then** the route sends it via Story 4.1's selected backend with a transcription-focused prompt and returns the transcribed text.
3. **Given** a transcription is returned, **When** it arrives, **Then** it populates the message input box for me to review/edit — never auto-sent.
4. **Given** `/api/transcribe` has run, **When** I inspect the database afterward, **Then** no `CONVERSATION`/`MESSAGE`/`ATTACHMENT` row exists and the raw audio was not persisted — the transcribed text only becomes a real `MESSAGE` if I edit and send it via the existing `/api/chat` path.
5. **Given** the model server is unreachable or transcription fails, **When** I try to record, **Then** a plain error state is shown and I can still type manually.

## Tasks / Subtasks

- [x] Task 1: Microphone capture UI (AC: 1)
  - [x] Add a microphone control near the message input (reuse existing `components/ui/button.tsx` styling, don't introduce a new button component)
  - [x] Use `MediaRecorder` to capture audio on engage, auto-stop at 30s or on manual stop
- [x] Task 2: Transcription route (AC: 2, 4)
  - [x] Create `app/api/transcribe/route.ts` — **check Story 4.1's Completion Notes List first** to know which backend to target (native `input_audio` on the existing `llama-server`, or the fallback container it may have added)
  - [x] Set `export const runtime = "nodejs"` if the chosen backend requires it (native path likely doesn't need Node-only APIs since it's ephemeral HTTP, but confirm — this differs from `/api/chat`'s reason for the constraint, which was `better-sqlite3`)
  - [x] Send the recording with a transcription-focused prompt, return the resulting text
  - [x] **Critical**: this route must not import or call anything from `lib/db.ts` or touch `CONVERSATION`/`MESSAGE`/`ATTACHMENT` tables — it is stateless by design (AD-8)
- [x] Task 3: Populate the input, not auto-send (AC: 3)
  - [x] On a successful transcription response, set the message input's text to the transcription — do not call `sendMessage` automatically
- [x] Task 4: Error handling (AC: 5)
  - [x] If the model server is unreachable or the transcription request fails, show a plain inline error (consistent with AD-5's "errors surface, not engineered around" — no retry/backoff logic) and leave the text input usable for manual typing

## Dev Notes

- **AD-8**: `/api/transcribe` is a dedicated, ephemeral route — separate from `/api/chat`, no persistence, no auto-send. There is exactly one code path in this app that creates a `MESSAGE` row (`/api/chat`, established in Story 2.1) — this story must not create a second one.
- **Depends on Story 4.1's outcome** — do not start this story's route implementation until 4.1's Completion Notes List states which backend to target. If 4.1 hasn't run yet or its outcome is missing, that's a blocker for this story, not a judgment call to make here.
- 30s cap matches llama.cpp `mtmd`'s audio chunking behavior noted in architecture — this is a hard technical constraint from the inference layer, not an arbitrary UX choice.

### Project Structure Notes

- New: `app/api/transcribe/route.ts`.
- Modified: `app/page.tsx` (microphone control, transcription-to-input wiring).

### References

- [Source: _bmad-output/planning-artifacts/architecture/architecture-local-ai-with-bmad-2026-07-09/ARCHITECTURE-SPINE.md#AD-8] ephemeral persistence boundary, single message-creation path
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4, Story 4.2]
- [Source: _bmad-output/implementation-artifacts/4-1-smoke-test-native-audio-input.md] backend selection this story depends on

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- Confirmed 4.1's Completion Notes List: native `input_audio` path, no fallback service needed.
- Inspected the installed `@ai-sdk/openai-compatible` provider's compiled source directly (`node_modules/@ai-sdk/openai-compatible/dist/index.js`) rather than assuming: a `{type: "file", mediaType, data}` message part maps to an `input_audio` content part *only* when `mediaType` is exactly `audio/wav` or `audio/mp3`/`audio/mpeg` — anything else (e.g. `audio/webm`, what `MediaRecorder` produces by default in Chromium) throws `UnsupportedFunctionalityError`. This is why `lib/wav-encode.ts` exists: browser recordings are decoded via `AudioContext.decodeAudioData` and re-encoded as 16-bit PCM WAV client-side before ever reaching the route.
- `POST /api/transcribe` tested directly with a real WAV sample (macOS `say` → `afconvert`, same technique as Story 4.1's smoke test): `HTTP_STATUS:200`, accurate transcription returned.
- Confirmed ephemeral (AC4) by reading the SQLite file directly before/after the request — conversation/message counts unchanged.
- Tested the error path (AC5) two ways: (1) malformed base64 audio → route's catch block → clean `502 {"error":"Transcription failed"}`, no crash/hang; (2) in the browser, clicking the mic button in this automated environment (which has no real microphone) naturally exercises the `getUserMedia` rejection path — confirmed a clean inline error ("Couldn't access the microphone...") with the submit button and text input still fully usable, no console errors.
- `npx tsc --noEmit` and `npm run lint`: zero new errors/warnings (only the 7 pre-existing `prompt-input.tsx` errors + 1 warning remain).

### Completion Notes List

- All 5 ACs implemented; 4 of 5 fully live-verified. **AC1's full happy path (recording real speech via an actual microphone, end-to-end through to a populated input box) could not be live-tested** — this automated browser environment has no real microphone, so `getUserMedia` always rejects here. What *was* verified: the transcription route itself with real audio matching the exact format the client produces (AC2, AC4), the "populate not auto-send" wiring by code review (`onTranscribed` only calls `setInput`, never `sendMessage`) (AC3), the 30-second auto-stop timer logic by code review, and both error branches live (AC5). Recommend a manual spot-check with a real microphone before considering this story fully done, or a `code-review` pass that specifically re-examines the `MediaRecorder`/WAV-encoding path.
- `/api/transcribe` does not set `runtime = "nodejs"` — confirmed it doesn't need Node-only APIs (it's a stateless HTTP call to the model server, no `better-sqlite3` involved), unlike `/api/chat`.
- Audio downmixes to mono in `lib/wav-encode.ts` — transcription doesn't need stereo, and it halves the payload size.

### File List

- New: `app/api/transcribe/route.ts`, `lib/wav-encode.ts`
- Modified: `app/page.tsx` (`MicButton` component, wired into `ChatView`'s `PromptInputFooter`)
