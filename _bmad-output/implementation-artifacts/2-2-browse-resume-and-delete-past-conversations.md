---
baseline_commit: 8ca48819e230a77434d03f089617c04ee8b7eb00
---

# Story 2.2: Browse, Resume, and Delete Past Conversations

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to see a list of my past conversations, switch between them, start a new one, or delete one,
so that I can manage more than just my single most-recent chat.

## Acceptance Criteria

1. **Given** I have multiple conversations in the database, **When** I open the history list (a visible affordance, reachable any time — not just at startup), **Then** I see all conversations, most recently updated first.
2. **Given** the history list is open, **When** I select a past conversation, **Then** the chat view switches to that conversation's full message thread, and new messages I send are appended to it, not to a new conversation.
3. **Given** the history list is open, **When** I delete a conversation, **Then** it's removed from the list and its `MESSAGE` rows are removed too (`DELETE /api/conversations/[id]`); if it was the active conversation, the UI falls back to the next most recent (or a fresh empty conversation if none remain).
4. **Given** I want to start something new, **When** I trigger "new conversation," **Then** an empty conversation becomes active, ready to receive the first message (creating its `CONVERSATION` row on first send, not on click, to avoid empty orphan rows).

## Tasks / Subtasks

- [x] Task 1: List conversations (AC: 1)
  - [x] `GET /api/conversations` — return all conversations ordered by `updatedAt` desc (id, title, updatedAt); set `runtime = "nodejs"`
  - [x] Add a history list UI (sidebar or dropdown — pick whichever fits the existing shadcn/ui components already in `components/ui/`, e.g. `dropdown-menu.tsx` or a simple sheet) reachable from the header at any time
- [x] Task 2: Switch conversations (AC: 2)
  - [x] `GET /api/conversations/[id]` — return the full message thread for one conversation
  - [x] On selecting a conversation in the list, fetch its messages and set it as the active conversation (update whatever client-side "active conversation id" state Story 2.1 introduced); subsequent sends target this id
- [x] Task 3: Delete a conversation (AC: 3)
  - [x] `DELETE /api/conversations/[id]` — delete the `CONVERSATION` row and cascade-delete its `MESSAGE` rows (and `ATTACHMENT` rows once Story 3.1 exists — use `ON DELETE CASCADE` in the schema now so this doesn't need revisiting)
  - [x] If the deleted conversation was active, fall back to the next most recent conversation, or a fresh empty one if the list is now empty
- [x] Task 4: Start a new conversation (AC: 4)
  - [x] Add a "new conversation" action that clears the active view client-side WITHOUT writing a `CONVERSATION` row yet
  - [x] The row gets created on the first message send against this "new" conversation — reuse Story 2.1's existing "create on first message" logic, don't build a second path

## Dev Notes

- This story is pure additive surface on top of Story 2.1's schema and persistence flow — no schema changes needed beyond adding `ON DELETE CASCADE` to `message.conversationId` (and later `attachment.messageId` in Story 3.1) if not already present from 2.1.
- **AD-9**: `CONVERSATION.title` and `updatedAt` maintenance is Story 2.1's responsibility (already specified there) — this story only *reads* those fields for the list sort/display, it doesn't set them.
- Keep the "active conversation" state model simple and singular (one active id at a time) — this app has no tabs/split-view requirement per the PRD.
- No story addresses UI behavior when switching conversations mid-stream (an assistant response still streaming) — out of scope per the implementation readiness assessment; don't build special handling for it unless it visibly breaks.

### Project Structure Notes

- New: `app/api/conversations/route.ts`, `app/api/conversations/[id]/route.ts`.
- Modified: `app/page.tsx` (history list UI, active-conversation switching), `db/schema.ts` (cascade delete if not already set in 2.1).

### References

- [Source: _bmad-output/planning-artifacts/architecture/architecture-local-ai-with-bmad-2026-07-09/ARCHITECTURE-SPINE.md#Seed] route locations (`app/api/conversations/route.ts` + `[id]/route.ts`)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2, Story 2.2]
- [Source: _bmad-output/implementation-artifacts/2-1-persist-and-resume-the-current-conversation.md] schema and persistence flow this story builds on

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- Added `ON DELETE CASCADE` to `message.conversationId` in `db/schema.ts`; generated migration `db/migrations/0001_icy_deathstrike.sql` via `drizzle-kit generate`. Also had to add `sqlite.pragma("foreign_keys = ON")` in `lib/db.ts` — SQLite silently ignores FK constraints (including cascade) unless enabled per-connection; without this the migration would have been a no-op at runtime.
- Extracted `extractText`/`rowsToUIMessages` out of `app/api/chat/route.ts` into a new shared `lib/chat-messages.ts` so `app/api/conversations/[id]/route.ts` reuses the same message-row-to-UIMessage mapping instead of duplicating it.
- `app/api/chat/route.ts` POST handler required a real (not story-file-anticipated) change beyond what was listed: it previously always operated on "the most recently updated conversation," which breaks the moment a user *views* an older, non-most-recent conversation and then sends a message — it would silently misfile that message into whatever conversation happens to be most recent, not the one on screen. Added an explicit `conversationId` field to the request body (via a per-conversation `DefaultChatTransport`) so the server always knows exactly which conversation a message belongs to. Also changed how new conversations get their id: the client now pre-generates one with `nanoid()` (already a project dependency) before the first send, rather than the server minting one and the client having no way to learn it from a streamed response.
- Full browser verification via MCP preview tools against the real llama.cpp container: created 2 conversations, confirmed they're stored as distinct rows with correct message counts; switched from conversation 2 back to conversation 1 and sent a message — confirmed via direct DB read that it appended to conversation 1 (2→4 messages) and did not touch conversation 2, proving the conversationId-targeting fix actually works; deleted a non-active conversation — confirmed cascade-deleted with zero orphan messages; deleted the *active* (and only remaining) conversation — confirmed correct fallback to a fresh empty conversation, confirmed the open history menu itself refreshed to "No past conversations" (a real gap I found and fixed — the menu wasn't refreshing after delete, only on open); sent a message in the fallback conversation and confirmed it worked end-to-end.
- One MCP-preview-tool artifact encountered and ruled out as a false alarm: after a `key`-driven remount (switching to a freshly-generated conversation post-delete), `preview_fill` left the submit button showing `disabled: true` even though the DOM value was set. Verified via `preview_eval` (native value setter + manually dispatched `input` event) that the real app updates its controlled state and enables the button correctly — this was a stale-element-handle artifact in the test tooling around the remount, not an app bug. No code changes were made for this.
- `npx tsc --noEmit` and `npm run lint`: zero new errors/warnings (only the 7 pre-existing `prompt-input.tsx` errors + 1 warning remain, unrelated to this story).

### Completion Notes List

- All 4 ACs pass, fully verified live against the real model server (not mocked).
- List (AC1): `GET /api/conversations`, dropdown menu (Base UI, matching existing component conventions) reachable from the header at any time, sorted by `updatedAt` desc.
- Switch (AC2): `GET /api/conversations/[id]` loads a specific thread; `ChatView` is keyed by `conversationId` so switching cleanly remounts with the right history; the `/api/chat` fix above ensures subsequent sends target the right conversation.
- Delete (AC3): `DELETE /api/conversations/[id]`, cascade-deletes messages, correct fallback to next-most-recent or a fresh conversation; menu refreshes itself after a delete.
- New (AC4): client pre-generates the id, no `CONVERSATION` row is written until the first message actually sends — no orphan rows.

### File List

- New: `app/api/conversations/route.ts`, `app/api/conversations/[id]/route.ts`, `lib/chat-messages.ts`, `db/migrations/0001_icy_deathstrike.sql` (+ Drizzle meta)
- Modified: `db/schema.ts` (cascade FK), `lib/db.ts` (`foreign_keys` pragma), `app/api/chat/route.ts` (explicit `conversationId` targeting, refactored to use `lib/chat-messages.ts`), `app/page.tsx` (history menu, switch/delete/new-conversation flows)
