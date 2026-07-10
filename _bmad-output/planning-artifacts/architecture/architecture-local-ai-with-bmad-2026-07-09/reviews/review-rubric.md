---
title: Architecture Spine Review — local-gemma-chat
reviewed_file: ../ARCHITECTURE-SPINE.md
reviewed_against: /Users/matthewalmeida/Source/hobbying/local-ai-with-bmad/_bmad-output/planning-artifacts/prds/prd-local-ai-with-bmad-2026-07-09/prd.md
date: 2026-07-09
---

# Architecture Spine Review

## Overall Verdict

**Pass with fixes.** The spine is well-formed as a document: the AD/Prevents pairing is consistently applied, AD-3's amendment respects the BMad "never renumber, amend in place" convention, and the Operational Envelope section exists and is appropriately thin for a hobby/solo local-only project. However, one AD contradicts the actual brownfield code it's supposed to govern, and two real divergence points for FR-9 and for schema-migration startup are left completely silent rather than decided/deferred/open-questioned. These are fixable without restructuring the spine.

## Checklist Walkthrough

### 1. Fixes the real divergence points for the level below; misses none

Mostly yes for FR-1–FR-8. **Gap: FR-9** (list past conversations, switch/resume, delete, default-resume-most-recent) has no AD and no seed entry naming *how* these operations are exposed (REST route under `app/api/conversations`? Next.js Server Actions? direct DB reads in a Server Component?). This is a genuine divergence point — the Seed section is otherwise careful to name exact route files for FR-2 (`app/api/chat/route.ts`) and FR-8's write side (`app/api/transcribe/route.ts`), but the read/list/delete side of AD-3's own entities is uncovered. Two implementers (or two BMad agent runs) could reasonably pick different mechanisms, which is exactly what a spine exists to prevent.

**Gap: migration application strategy.** AD-3/Seed say Drizzle schema/migrations live under `db/`, but nothing states how/when they're applied to the SQLite file — automatically on app boot, via a documented `npm run db:migrate` step, or via `drizzle-kit push` run manually. This directly touches the PRD's explicit "Two-command startup" goal and "Startup transparency" NFR: if migrations require an undocumented third step, the goal is silently broken. This is a dimension the spine owns (it already owns "Compose file location," "App location," "Config surface" at the same level of specificity) and left undecided.

### 2. Every AD's Rule is enforceable and actually prevents its stated divergence

Yes, all eight ADs pass this test individually:
- AD-1–AD-2: enforceable and already respected by the existing code (`lib/model.ts` uses `createOpenAICompatible`, no in-process inference bindings in `package.json`).
- AD-3: enforceable ("one file," BLOBs not disk files) — clear pass/fail check.
- AD-4–AD-8: each has a crisp Binds/Prevents pair with an unambiguous violation condition (introducing Ollama, adding a second vision/STT model, adding an OCR path, adding streaming/inline dictation).

No AD is vague enough to be unfalsifiable.

### 3. Nothing under Deferred could let two units diverge

Acceptable. The two "decide at implementation time" items (PDF page cap, PDF rendering library choice) are single-code-path decisions in a solo/single-app codebase, not decisions two independently-built units could disagree on — low risk at this altitude and stakes. No finding here.

### 4. Named tech is verified-current

Checked via web search: both `unsloth/gemma-4-E2B-it-GGUF` and `ggml-org/gemma-4-E2B-it-GGUF` are real, current Hugging Face repos with `mmproj` support via llama.cpp's `mtmd`, consistent with AD-6's claims. Drizzle ORM + `better-sqlite3` are real, current, standard choices. No fabricated tech found. **But see Finding 1 below** — verified-current is not the same as verified-*consistent-with-the-repo-you're-actually-building-on*.

### 5. Ratifies rather than contradicts a brownfield codebase

**Fails on one point (Finding 1).** The existing `docker-compose.yml` at the repo root already runs `-hf ggml-org/gemma-4-E2B-it-GGUF`. The spine's Seed section instead specifies `-hf unsloth/gemma-4-E2B-it-GGUF` — a different HF org/repo entirely, not a typo of the same one. Both repos are real and both plausible, but the spine should describe the system that exists, or explicitly call out and justify a change to it. As written, an implementer following the spine's Seed literally would edit a working, already-configured `docker-compose.yml` to point at a different (unverified-identical) quantization source, with no rationale given.

Everything else ratifies the brownfield: `app/api/chat/route.ts` and `lib/model.ts` already match AD-1's contract shape; `package.json` has no persistence deps yet, consistent with AD-3 being new work, not already-contradicted work.

**Secondary, lower-severity note:** `app/api/status/route.ts` already exists and implements FR-4 (hits `/health` on `LOCAL_MODEL_BASE_URL`), but it appears nowhere in the spine's Diagram or Seed route list, which names only `app/api/chat/route.ts` and `app/api/transcribe/route.ts`. Not contradicted, just silently absent from the system picture — a minor completeness gap in an otherwise-detailed Seed.

### 6. Covers the driving spec's capabilities (FR-1 through FR-9)

FR-1 through FR-8 are each traceable to a specific AD or Seed line. **FR-9 is only partially covered** — AD-3/the ERD cover persistence of the data FR-9 operates on, but not the list/switch/delete/resume-default mechanism itself (see Finding 2, same gap as checklist item 1).

### 7. Parent spine inheritance

Not applicable — this is a whole-system-altitude spine with no parent spine; AD-1/2/4/5 being carried forward unchanged from the prior version of *this same* document is an in-place continuity, not parent/child inheritance. No weakening detected relative to the prior state of the document itself.

### 8. Every dimension the altitude owns is decided/deferred/open

Operational Envelope is present and covers Environments, Deployment, and Provider strategy adequately for hobby stakes. The one silent dimension is the migration-application step noted above (Finding 3) — everything else that's plausibly in scope (GPU, retry logic, DB growth, model-swap UI) is explicitly named in Deferred, which is exactly the right move.

## Findings

**Finding 1 — HIGH.** Spine's Seed (`ARCHITECTURE-SPINE.md` line 78) specifies `-hf unsloth/gemma-4-E2B-it-GGUF`, contradicting the brownfield `docker-compose.yml` (repo root, line ~9) which already runs `-hf ggml-org/gemma-4-E2B-it-GGUF`. Both repos exist and are current, but the spine describes a system different from the one that's actually running. Fix: either update the Seed to match the existing `ggml-org` repo, or add an explicit rationale/migration note if the switch to `unsloth` is intentional.

**Finding 2 — MEDIUM.** FR-9 (conversation list/switch/delete/default-resume) has no AD or Seed entry naming the mechanism (API route vs. Server Action vs. direct RSC query). Real divergence risk for a genuine PRD-required capability. Fix: add a Seed line naming the route(s)/mechanism, or fold into AD-3's Binds clause.

**Finding 3 — MEDIUM.** No stated migration-application strategy for the Drizzle/SQLite schema (auto-run on boot vs. manual command), which bears directly on the PRD's "Two-command startup" goal and "Startup transparency" NFR. Fix: one sentence in Seed or Operational Envelope naming the mechanism.

**Finding 4 — LOW.** `app/api/status/route.ts` (existing, implements FR-4) is absent from the spine's Diagram and Seed route list. Fix: add it alongside the other two named routes for an accurate system picture.

**Finding 5 — LOW.** The ATTACHMENT/MESSAGE ERD doesn't clarify whether original PDF bytes are retained in addition to AD-7's rendered page images, which affects what FR-9's conversation-resume actually replays for a PDF attachment. Fix: one clause in AD-3 or AD-7 stating whether the source PDF is persisted or only its rendered derivatives.
