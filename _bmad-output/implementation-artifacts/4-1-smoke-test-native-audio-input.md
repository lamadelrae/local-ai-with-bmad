---
baseline_commit: 8ca48819e230a77434d03f089617c04ee8b7eb00
---

# Story 4.1: Smoke-Test Native Audio Input

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the builder,
I want to know definitively whether `input_audio` works end-to-end against the running `ggml-org/gemma-4-E2B-it-GGUF` container before building on it,
so that Story 4.2 isn't built on an unverified foundation.

## Acceptance Criteria

1. **Given** the running llama.cpp container (model + `mmproj`), **When** a short sample recording is sent to `/v1/chat/completions` as an `input_audio` content part, **Then** the response is inspected for a valid, coherent transcription — vs. an error, assert, or hang.
2. **Given** the smoke test succeeds, **When** Story 4.2 begins, **Then** it proceeds against the native `input_audio` path.
3. **Given** the smoke test fails, **When** Story 4.2 begins, **Then** it targets a fallback local STT container instead (e.g. whisper.cpp-class, added to `docker-compose.yml`), and a new AD is logged capturing this exception to AD-4's one-model rule.
4. **And** the smoke test's outcome and evidence are recorded so the decision isn't lost.

## Tasks / Subtasks

- [x] Task 1: Prepare a sample recording (AC: 1)
  - [x] Record or source a short (~5-10s) WAV/audio sample with clear speech
- [x] Task 2: Run the smoke test (AC: 1)
  - [x] With `docker compose up -d` running, send a direct request to `http://localhost:8080/v1/chat/completions` with an `input_audio` content part (base64-encoded audio + format) and a transcription-style prompt — a raw `curl`/script call is sufficient, this does NOT need any app code
  - [x] Observe: does it return a valid, coherent transcription, an error, an assert/crash, or a hang?
- [x] Task 3: Record the outcome (AC: 4)
  - [x] Write the result (pass/fail, exact error if any, response snippet if it passed) into this story's Completion Notes List — this is the durable record the architecture asked for
- [x] Task 4: Branch based on outcome (AC: 2, 3)
  - [x] **If it passes:** no further action needed here — Story 4.2 proceeds against the native path as designed
  - [ ] ~~If it fails: add a fallback STT service...~~ — not applicable, smoke test passed cleanly

## Dev Notes

- **This story does not touch app code.** It's a pure infrastructure/research spike against the running Docker container. Resist the urge to start building `/api/transcribe` here — that's Story 4.2, and it depends on this story's outcome.
- **Why this exists**: architecture research (during `bmad-architecture`) found multiple open/recently-fixed llama.cpp GitHub issues specifically about Gemma-4 audio input (routing gaps, assert errors, a reported regression) — all within about the last month as of the architecture's authoring date. Image `mtmd` is mature; audio `mtmd` is not proven. This story exists to convert "architecturally uncertain" into "verified one way or the other" before Story 4.2 commits code to a specific path.
- If the smoke test is ambiguous (e.g. partial/garbled transcription rather than a clean pass or hard failure), treat it as a fail and take the fallback branch — don't build Story 4.2 on a shaky foundation hoping it improves.

### Project Structure Notes

- No new files expected unless the fallback branch is taken, in which case: `docker-compose.yml` gains a second service, and `ARCHITECTURE-SPINE.md` gains a new `AD-10`.

### References

- [Source: _bmad-output/planning-artifacts/architecture/architecture-local-ai-with-bmad-2026-07-09/ARCHITECTURE-SPINE.md#AD-6, AD-8, Deferred] the exact risk and fallback this story resolves
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4, Story 4.1]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- Generated sample audio via macOS `say -v Samantha` → `afconvert` to 16-bit mono PCM WAV @ 16kHz (`"The quick brown fox jumps over the lazy dog near the riverbank."`)
- `POST http://localhost:8080/v1/chat/completions` with an `input_audio` content part (base64 WAV, `format: "wav"`) alongside a transcription-instruction text part → `HTTP_STATUS:200`

### Completion Notes List

- **SMOKE TEST RESULT: PASS.** Native `input_audio` support works end-to-end against the running `ggml-org/gemma-4-E2B-it-GGUF` + llama.cpp container. No error, no assert, no hang.
- Returned transcription: `"the quick brown fox jumps over the lazy dog near the riverbank"` — verbatim match to the source text (case/punctuation normalized, which is expected/correct transcription behavior, not an error).
- **Decision for Story 4.2: proceed against the native `input_audio` path.** No fallback STT container needed, no new AD required — this resolves the architecture's flagged risk (AD-6/AD-8, and the corresponding Deferred item) in the positive direction.
- This story did not touch any app code, per its Dev Notes — verification only, via a direct `curl`/Python-scripted request against the shared Docker container.

### File List

(none — this story makes no code changes, per its own scope)
