---
title: Sprint Change Proposal — local-gemma-chat
date: 2026-07-09
status: approved
scope: minor
---

# Sprint Change Proposal: local-gemma-chat

## 1. Issue Summary

The Product Brief (`_bmad-output/planning-artifacts/briefs/brief-local-ai-with-bmad-2026-07-09/brief.md`) contradicted the current PRD and Architecture Spine. During a `bmad-prd` update on 2026-07-09, the user requested three new capabilities — multimodal file attachment (JPEG/PNG/PDF), local voice-to-text, and persistent SQLite conversation history — which were correctly folded into the PRD (FR-6–FR-9) and the Architecture Spine (AD-3 amended in place, AD-6–AD-9 added). The Brief, however, was left untouched and still declared:

- Success Criteria: *"No Ollama, no auth, no database, anywhere in the stack."*
- Scope/Out: *"...persistence/history beyond in-memory session state..."*

This was caught and explicitly flagged as a `[NOTE FOR PM]` during the PRD update, not discovered later — the fix was simply deferred to this session. No implementation exists yet (epics.md is mid-draft, no stories, no sprint), so the blast radius is documentation-only.

## 2. Impact Analysis

- **Epic Impact:** None. Epic breakdown had not yet started when this was caught, so no epics or stories carry the stale assumption forward.
- **Story Impact:** None — no stories exist yet.
- **Artifact Conflicts:**
  - PRD: no conflict, already correct and final.
  - Architecture Spine: no conflict, already correct and final (AD-3 already supersedes the "no persistence" stance).
  - Product Brief: conflicted — Success Criteria and Scope/Out sections were stale. **Resolved by this proposal.**
  - UX: N/A, no UX document exists for this project.
- **Technical Impact:** None. This is a planning-artifact consistency fix; no code, infrastructure, or deployment implications.

## 3. Recommended Approach

**Selected: Direct Adjustment (Option 1).** Edit the Brief's Success Criteria and Scope sections to match the PRD's actual, already-approved scope. Rollback (Option 2) doesn't apply — nothing was built on the stale assumption. MVP Review (Option 3) doesn't apply — the MVP itself is unaffected; this was never a feasibility question, only a documentation-sync gap.

- **Effort:** Low (two short edits, both already drafted and approved with the user).
- **Risk:** Low (no downstream artifact depended on the stale Brief text; PRD and Architecture were already the sources of truth).
- **Timeline impact:** None.

## 4. Detailed Change Proposals

### Product Brief (`brief.md`)

**Section: Success Criteria**

OLD:
> No Ollama, no auth, no database, anywhere in the stack.

NEW:
> No Ollama, no auth, no cloud database or hosted persistence — conversation history lives in a single local SQLite file, nothing leaves the machine.

Rationale: preserves the local-only intent the original line was protecting, without contradicting FR-8/FR-9.

**Section: Scope**

OLD In:
> chat UI (message list, input, send), `/api/chat` route using AI SDK against the local endpoint, Docker Compose for the llama.cpp server, README covering the two-command startup.

NEW In:
> chat UI (message list, input, send), `/api/chat` route using AI SDK against the local endpoint, Docker Compose for the llama.cpp server, README covering the two-command startup, multimodal file attachments (JPEG/PNG/PDF), local voice-to-text, and persistent SQLite conversation history with session management.

OLD Out:
> auth, persistence/history beyond in-memory session state, multi-user, cloud fallback, Ollama, model fine-tuning, conversation export.

NEW Out:
> auth, multi-user, cloud fallback, Ollama, model fine-tuning, conversation export.

Rationale: the Brief's In/Out lists now match what the PRD actually scopes; "persistence/history beyond in-memory session state" is removed from Out since it's now explicitly In.

**Status: Applied.** Both edits were approved and written to `brief.md` in this session.

## 5. Implementation Handoff

**Scope classification: Minor.** This was a direct documentation edit with no code, epic, or story impact — no further handoff is required. No Developer agent, Product Owner, or Architect action is needed as a result of this change.

**Success criteria:** `brief.md` no longer contradicts `prd.md` or `ARCHITECTURE-SPINE.md` on persistence, attachments, or voice-to-text. Confirmed by direct comparison above.
