---
title: Adversarial Review — Architecture Spine (local-gemma-chat)
reviewed: architecture-local-ai-with-bmad-2026-07-09/ARCHITECTURE-SPINE.md
method: pairwise-incompatibility construction (two AD-compliant units built one level down, checked for collision)
date: 2026-07-09
---

# Adversarial Review: Architecture Spine

## Method

For each area of ambiguity, I constructed two hypothetical implementers ("Dev A" / "Dev B", or "PR A" / "PR B") who each read the spine, follow every stated AD to the letter, and make the most natural implementation choice consistent with it — then checked whether their outputs can coexist in the same SQLite file / same running app. Every pair that produces incompatible shapes, dual ownership, or diverging state-mutation paths is logged as a finding, with a proposed AD (new or tightened) that would force convergence.

Overall verdict: **the spine's diagram and prose are directionally sound, but the entity schema (AD-3) and the AD-7/AD-8 boundary conditions are under-specified enough that two compliant PRs will not interoperate out of the box.** Six holes found — three HIGH, two MEDIUM, one LOW.

---

## Finding 1 — HIGH: `MESSAGE.content` encoding for multimodal turns is unspecified

**The two units:** Dev A builds `/api/chat` so `MESSAGE.content` stores only the plain text/caption portion of a turn; on send, image/audio parts are reconstructed at read-time by joining `ATTACHMENT` rows for that `message_id` back into OpenAI `image_url`/`input_audio` content-parts. Dev B, reading AD-1 ("contract... is OpenAI-compatible chat completions, nothing bespoke") and AD-6 ("images and audio are sent as additional content-part types... on the existing contract"), takes the more literal path: serialize the *entire* OpenAI content-parts array (text + `image_url` + `input_audio`, potentially including base64/data-URI payloads) as a JSON string into `content`, since that's the literal wire shape AD-1/AD-6 describe.

**Why both are AD-compliant:** Nothing in AD-3 or the ER diagram says `content` is caption-only vs. full-wire-format. `text content` is consistent with either a plain string or a JSON-string-of-parts.

**Where they clash:** Dev B's rows duplicate binary/near-binary payloads that already live as BLOBs in `ATTACHMENT` — two sources of truth for the same image that can drift (e.g., if an attachment BLOB is later re-processed/compressed but the JSON snapshot in `content` isn't). Any downstream feature built against Dev A's assumption (content = display text, attachments = binary truth) will render garbage or double-render media against a Dev B database, and vice versa. This is a genuine shared-data-shape collision, not a stylistic one.

**Proposed AD (tighten AD-3):**
> `MESSAGE.content` holds exactly the text/caption portion of a turn as a plain UTF-8 string (empty string if the turn is media-only). It must never contain a serialized content-parts array, base64 payload, or any duplicate of ATTACHMENT.data. ATTACHMENT rows are the sole source of truth for binary/media content; `image_url`/`input_audio` parts are reconstructed at request-build time by joining ATTACHMENT rows for the message.

---

## Finding 2 — HIGH: PDF-rendered page images vs. native image attachments — no shared tagging/shape rule

**The two units:** Dev A implements AD-7 literally — "PDF path converts pages to images... before sending them as `image_url` parts, **identical to a native image attachment**" — and therefore stores each rendered page as its own `ATTACHMENT` row with `kind = 'image'`, indistinguishable from an FR-6 direct upload, one row per page (N rows for an N-page render). Dev B reads the same AD-7 sentence but weighs *provenance* higher, tagging rendered pages `kind = 'pdf-page'` (or `'pdf'`) so the UI can later show "3 pages from resume.pdf" instead of three anonymous images — and, to avoid schema bloat, stores all rendered pages for one PDF as a single `ATTACHMENT` row with a multi-image blob (e.g., a zip or JSON array of PNG buffers) rather than one row per page.

**Why both are AD-compliant:** AD-7 mandates *behavioral* identity toward the model (sent as `image_url` parts) but says nothing about *storage* identity. The ER diagram's `ATTACHMENT.kind` is an unconstrained `text` field with no enum, and there is no stated cardinality rule (one row per page vs. one row per source file).

**Where they clash:** Any code that reconstructs `image_url` parts for conversation replay by doing `SELECT * FROM attachment WHERE kind = 'image'` will silently drop Dev B's PDF pages (wrong kind, and wrong blob shape — a zip isn't a decodable image). Conversely, a UI attachment gallery built against Dev A's one-row-per-page model will crash or mis-render against Dev B's one-row-per-file multi-image blob. This is the clearest "two owners disagree on one entity's shape" case in the spine.

**Proposed AD (tighten AD-7 + AD-3):**
> Each rendered PDF page is inserted as its own `ATTACHMENT` row with `kind = 'image'` — bit-for-bit the same `kind` value and single-image BLOB shape as a native FR-6 image attachment. Provenance (that a row came from a PDF, and which page) is carried only in `filename` (convention: `<original-filename>#page=<n>`), never in `kind` and never by batching multiple pages into one row.

---

## Finding 3 — HIGH: `/api/transcribe` persistence boundary is undefined, forcing incompatible DB semantics

**The two units:** Dev A reads AD-8's binding closely — "the returned text populates the message input box... it is never auto-submitted as a message" — and concludes the entire transcribe flow is ephemeral to the request/response cycle: no `MESSAGE`, `CONVERSATION`, or `ATTACHMENT` row is ever written by `/api/transcribe`; persistence only happens later, if/when the user edits and hits send through the ordinary `/api/chat` path. Dev B reads AD-3's binding — "every conversation, message, and attachment... is written to one SQLite file" — as an unconditional rule and concludes the recorded audio itself must be captured for audit/replay (e.g., "regenerate transcription" UX). Since `ATTACHMENT` has a mandatory `message_id` FK and there is no message yet at transcribe time, Dev B is forced to invent a placeholder `MESSAGE` row (e.g., `role = 'user'`, empty/null `content`, `kind = 'audio'` attachment hanging off it) — and, if no conversation exists yet, a placeholder `CONVERSATION` row too.

**Why both are AD-compliant:** AD-8 never states whether the route is DB-write-free; AD-3's "every message... is written" is phrased as a description of what conversations/messages *are* once they exist, not an instruction that every user interaction must produce a message row. Nothing forbids Dev B's reading.

**Where they clash:** Dev B's phantom/placeholder messages pollute conversation history with rows that have no real chat content, break any invariant the UI relies on ("every MESSAGE row is a real, renderable turn"), and — worse — create a second, uncoordinated code path that can create `CONVERSATION` rows (alongside whatever "first message creates the conversation" logic `/api/chat` owns). Two independent conversation-creation paths racing on a fresh chat is a textbook dual-ownership bug. Dev A's database simply never has these rows. Merge the two code paths (plausible in a solo/hobby repo where both routes get built in separate sessions) and you get orphaned placeholder messages with no matching UI affordance, or a title-generation race between the two conversation-creators.

**Proposed AD (new, or fold into AD-8):**
> `/api/transcribe` performs no SQLite writes of any kind — no CONVERSATION, MESSAGE, or ATTACHMENT row, and no raw-audio persistence. The recording and its transcript live only in browser/request memory. If the user edits and sends the transcribed text via `/api/chat`, it is persisted exactly like any other typed message, through `/api/chat`'s single write path — `/api/chat` is the only route permitted to create a CONVERSATION or MESSAGE row.

---

## Finding 4 — MEDIUM: Assistant-message write timing during streaming is unspecified

**The two units:** Dev A writes the assistant `MESSAGE` row once, after `streamText` completes, with the final accumulated content — matching AD-5's "errors surface, not engineered around" (a dropped stream simply means nothing was persisted). Dev B, wanting the partial answer visible on page refresh mid-stream, inserts an empty/partial assistant row at stream start and updates `content` on each chunk (or on a throttled interval).

**Why both are AD-compliant:** AD-3 says messages "are written to one SQLite file" but is silent on write cadence; AD-5 talks about *error* surfacing, not write timing, so it doesn't clearly forbid Dev B's incremental-upsert approach.

**Where they clash:** Dev B's approach means a crashed/killed dev server can leave a permanent partial-content row with no marker that it's incomplete (looks like a truncated real answer, not an error) — arguably violating the *spirit* of AD-5 even though no AD explicitly bars it. Dev A's approach means concurrent readers (e.g., a hypothetical second browser tab) see nothing until the stream finishes. If both patterns end up implemented in different code paths over time, the DB accumulates rows with two different completeness semantics that downstream code (e.g., "resume this generation") can't distinguish.

**Proposed AD (tighten AD-3 or AD-5):**
> Assistant `MESSAGE` rows are inserted exactly once, after the model stream completes successfully, containing the final content. A stream that errors or disconnects mid-generation writes nothing — consistent with AD-5's "errors surface, not engineered around." No partial-content row is ever visible in the database.

---

## Finding 5 — MEDIUM: `ATTACHMENT.kind` and `MESSAGE.role` are unconstrained free text

**The two units:** Beyond the PDF/image collision in Finding 2, nothing stops one code path from writing `kind = 'image/png'` (MIME-style) while another writes `kind = 'image'` (category-style), or `role = 'human'`/`'bot'` vs. the OpenAI-standard `'user'`/`'assistant'`/`'system'`/`'tool'`. Both are "AD-compliant" since the ER diagram declares these as plain `text` columns with no enum or CHECK constraint.

**Where they clash:** Any filter/branch keyed on these values (`WHERE kind = 'image'`, `switch(role)`) silently misses rows written by the other convention — same failure mode as Finding 2, generalized.

**Proposed AD (tighten AD-3):**
> `ATTACHMENT.kind` is a closed enum: `'image' | 'audio'` (PDF pages use `'image'`, per Finding 2's tightened AD-7). `MESSAGE.role` is a closed enum matching the roles actually emitted on this contract: `'user' | 'assistant'`. Enforce via Drizzle enum/CHECK constraint, not convention alone.

---

## Finding 6 — LOW: No stated ID-generation convention for `text` primary keys

**The two units:** Dev A uses `crypto.randomUUID()`; Dev B uses a Drizzle-recommended `nanoid`/`cuid2` helper. Both produce opaque unique `text` PKs, so this doesn't break correctness — but it's an avoidable inconsistency (mixed ID formats across tables/migrations, harder to eyeball-debug, minor risk if any future code assumes a fixed ID length/format e.g. for URL-safety or sorting-by-creation-order-via-ID).

**Proposed AD (optional, tighten Seed section):**
> All `text id` primary keys are generated with a single named helper (e.g. `nanoid()`) imported from one module — no ad hoc `crypto.randomUUID()` call sites.

---

## Summary Table

| # | Finding | Severity | Collision type |
|---|---|---|---|
| 1 | `MESSAGE.content` encoding unspecified (caption-only vs. full parts-array JSON) | HIGH | Shared-data-shape clash + duplicate-source-of-truth drift |
| 2 | PDF-page vs. native-image attachment tagging/cardinality unspecified | HIGH | Shared-data-shape clash |
| 3 | `/api/transcribe` persistence boundary undefined | HIGH | Dual ownership of CONVERSATION/MESSAGE creation + phantom rows |
| 4 | Assistant-message write timing (once vs. incremental) unspecified | MEDIUM | Conflicting state-mutation paths |
| 5 | `ATTACHMENT.kind` / `MESSAGE.role` unconstrained free text | MEDIUM | Shared-data-shape clash (generalized) |
| 6 | No ID-generation convention | LOW | Cosmetic inconsistency |

All six are closable with AD tightenings (proposed above) rather than new architectural surface — the spine's overall shape (two processes, one SQLite file, OpenAI-compat wire contract) is not in question; its entity-level and route-boundary specificity is what's missing.
