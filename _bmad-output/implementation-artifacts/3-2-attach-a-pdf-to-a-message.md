---
baseline_commit: 8ca48819e230a77434d03f089617c04ee8b7eb00
---

# Story 3.2: Attach a PDF to a Message

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to attach a PDF to my message,
so that the assistant can answer questions about the document's content.

## Acceptance Criteria

1. **Given** I attach a PDF, **When** it's processed before sending, **Then** its pages are rendered to images, capped at the first 5 pages.
2. **Given** the PDF has been rendered, **When** the message is sent, **Then** each rendered page is sent as a separate `image_url` content part — same mechanism as Story 3.1's native images — and the assistant's reply can reference the document's content.
3. **Given** the message is persisted, **When** attachment rows are written, **Then** one `ATTACHMENT` row per rendered page is created with `kind='pdf-page'` and an incrementing `pageIndex`; the original PDF bytes are never stored.
4. **Given** the PDF has more than 5 pages, **When** it's rendered, **Then** only the first 5 are sent/stored, and the UI visibly indicates the attachment was truncated.
5. **Given** I reload the conversation, **When** the history renders, **Then** the rendered PDF pages redisplay as image attachments on their message, same as Story 3.1.

## Tasks / Subtasks

- [x] Task 1: Pick and add a PDF-to-image rendering dependency (AC: 1)
  - [x] Architecture left the exact library unpinned — evaluate `pdfjs-dist` (renders to canvas, works client-side in the browser, avoids adding server-side native deps) vs. a server-side `pdf-to-img`-class package. Lean toward client-side rendering (canvas → PNG blob) since it avoids adding a native/server dependency to a hobby app that's otherwise dependency-light — but confirm current, actively-maintained package choice on the web before committing, per architecture's "verify any named technology" standard
  - [x] Implement page rendering capped at 5 pages
- [x] Task 2: Extend attachment UI for PDFs (AC: 1, 4)
  - [x] Extend Story 3.1's file picker to also accept `application/pdf`
  - [x] On PDF selection, render pages client-side, show all resulting page-image previews as chips (reuse Story 3.1's preview UI, don't build a parallel one)
  - [x] If the PDF has more than 5 pages, show a truncation indicator (e.g. "showing first 5 of N pages") in the preview area
- [x] Task 3: Send rendered pages as multimodal parts (AC: 2)
  - [x] Send each rendered page image as its own `image_url` content part, identical to Story 3.1's native-image path — do not introduce a different content-part shape for PDF-derived images
- [x] Task 4: Persist as `pdf-page` attachments (AC: 3)
  - [x] Insert one `ATTACHMENT` row per rendered page (`kind='pdf-page'`, `pageIndex` = 0-based page number), reusing Story 3.1's persistence path — never store the original PDF bytes anywhere
- [x] Task 5: Redisplay on reload (AC: 5)
  - [x] Reuse Story 3.1's attachment-redisplay logic as-is — `pdf-page` attachments render exactly like `image` attachments (both are just images by the time they're in `ATTACHMENT.data`); no special-casing needed in the redisplay path

## Dev Notes

- **AD-7**: PDF attachments are rendered to page images, never OCR'd or text-extracted — this story implements exactly that, no fallback text-extraction path. Original PDF bytes are never persisted.
- This story is intentionally a thin layer on top of Story 3.1: same `ATTACHMENT` table, same `image_url` send mechanism, same redisplay logic. The only new work is PDF→image rendering and the page cap/truncation UI. If you find yourself duplicating Story 3.1's send/persist/redisplay code paths instead of reusing them, stop — that's the anti-pattern this note exists to prevent.
- The 5-page cap is a firm product decision (set during implementation-readiness review, not an architecture placeholder) — don't make it configurable or raise it without checking with the user first.

### Project Structure Notes

- New: PDF rendering utility (exact file location depends on the library chosen in Task 1 — e.g. `lib/pdf-render.ts`).
- Modified: `components/ai-elements/prompt-input.tsx` (accept PDFs), reuses Story 3.1's `/api/chat` and redisplay code otherwise unchanged.

### References

- [Source: _bmad-output/planning-artifacts/architecture/architecture-local-ai-with-bmad-2026-07-09/ARCHITECTURE-SPINE.md#AD-7, Deferred] page cap, rendering mechanism left open
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3, Story 3.2]
- [Source: _bmad-output/implementation-artifacts/3-1-attach-an-image-to-a-message.md] the exact mechanism this story extends — do not duplicate

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- Verified `pdfjs-dist` currency via web search before committing: v6.1.200, Mozilla's official PDF.js, released ~12 days prior — current and actively maintained. Installed.
- **Real bug caught and fixed during implementation**: `pdfjs-dist` imported at module top level in a `"use client"` file broke Next.js's SSR pass with `ReferenceError: DOMMatrix is not defined` — pdfjs-dist's `canvas.js` submodule runs `new DOMMatrix()` at module-evaluation time, which doesn't exist in Node. "use client" only marks a hydration boundary; Next.js still evaluates the module graph once server-side. Fixed by dynamically `import("pdfjs-dist")` *inside* `renderPdfToImages()`, so the import (and its browser-only side effects) only happens when a user actually attaches a PDF, client-side. Confirmed the dev-tools "1 Issue" overlay cleared and no console errors after the fix.
- **Local-only guarantee preserved for the PDF worker**: `pdfjs-dist` requires a separate worker script; pointed `GlobalWorkerOptions.workerSrc` at the bundled local copy via `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)` rather than a CDN URL (the common pdfjs-dist quickstart pattern uses a CDN, which would have violated FR5).
- **Server can't tell a PDF-rendered page apart from a native image upload from content alone** (both arrive as plain `image/png` file parts by the time the model sees them, per AD-6). Solved with a filename convention (`lib/pdf-page-marker.ts`'s `__pdfpage-N` marker, stamped by the renderer, parsed server-side in `extractImageAttachments`) rather than changing the wire format — keeps AD-6's "PDF pages ride the same mechanism as native images" invariant intact while still letting `/api/chat` correctly tag `kind='pdf-page'` + `pageIndex` on persist.
- Extracted the marker constant into its own tiny file (`lib/pdf-page-marker.ts`, no `"use client"`, no pdfjs-dist import) rather than importing it from `lib/pdf-render.ts` directly — avoids pulling browser-only rendering code into server-only `lib/chat-messages.ts`.
- Full browser verification via MCP preview tools against the real llama.cpp container, using a hand-constructed 7-page test PDF (raw PDF syntax, each page a distinct colored square labeled "Page N" — no external tools/dependencies needed to generate it): attached the PDF, confirmed exactly 5 preview chips plus a "Showing first 5 of 7 pages" truncation notice (AC1, AC4); sent it with a question — the model correctly identified both the visible page-1 text ("Page 1") and its color ("red square"), confirming all 5 rendered pages actually reached the model (AC2); confirmed via direct DB read that 5 `ATTACHMENT` rows were created with `kind='pdf-page'` and `page_index` 0–4, filenames cleaned of the marker suffix, and no PDF bytes anywhere (AC3); reloaded and confirmed all 5 pages redisplayed correctly from their persisted BLOBs (AC5).
- `npx tsc --noEmit` and `npm run lint`: zero new errors/warnings.

### Completion Notes List

- All 5 ACs pass, fully verified live against the real model server with a genuinely multi-page PDF.
- This story stayed a thin layer on Story 3.1 as intended: no duplicated send/persist/redisplay logic — the only new code is PDF-specific (rendering, the filename-marker convention, the truncation UI).
- 5-page cap enforced exactly as specified; not made configurable.

### File List

- New: `lib/pdf-render.ts`, `lib/pdf-page-marker.ts`
- Modified: `app/page.tsx` (`PdfAttachItem`, `AttachButton` extended, truncation notice UI), `lib/chat-messages.ts` (`extractImageAttachments` now detects `pdf-page` via filename marker), `app/api/chat/route.ts` (persists `kind`/`pageIndex` from the extraction result instead of hardcoding `kind: "image"`), `db/schema.ts` / migration (unchanged from Story 3.1 — `pageIndex` column already existed, just unused until now), `package.json` (`pdfjs-dist` dependency)
