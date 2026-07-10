---
baseline_commit: 8ca48819e230a77434d03f089617c04ee8b7eb00
---

# Story 2.1: Persist and Resume the Current Conversation

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want my conversation saved automatically and reloaded when I reopen the app,
so that my chat history survives restarts.

## Acceptance Criteria

1. **Given** no existing database file, **When** the app starts (`npm run dev`), **Then** Drizzle migrations auto-apply, creating the SQLite file with `CONVERSATION` and `MESSAGE` tables (AD-9 conventions: `nanoid()` PKs, `role` constrained to `'user'|'assistant'`, `content` plain text).
2. **Given** a running chat, **When** I send a message and receive an assistant reply, **Then** both are persisted as `MESSAGE` rows linked to a `CONVERSATION` row.
3. **Given** I've chatted and reload the browser (app/Docker still running), **When** the page loads, **Then** it fetches and renders the persisted conversation's full message history — not a blank page.
4. **Given** I restart `npm run dev` (or the machine) and reopen the app, **When** the page loads, **Then** the most recent conversation's messages are still there.
5. **Given** a `CONVERSATION` row is created (its first message is being sent), **When** that first message is persisted, **Then** `CONVERSATION.title` is set once to the first ~50 characters of that message's text (never updated afterward).
6. **Given** any message (user or assistant) is added to a `CONVERSATION`, **When** it's persisted, **Then** `CONVERSATION.updated_at` is bumped to the current time.
7. **And** `/api/chat` sets `export const runtime = "nodejs"`.

## Tasks / Subtasks

- [x] Task 1: Add persistence dependencies (AC: 1)
  - [x] `npm install drizzle-orm better-sqlite3` and `npm install -D drizzle-kit @types/better-sqlite3`
- [x] Task 2: Define schema and migration setup (AC: 1)
  - [x] Create `db/schema.ts`: `conversation` table (`id` text PK, `title` text, `createdAt`, `updatedAt`), `message` table (`id` text PK, `conversationId` FK, `role` text constrained via app-level check to `'user'|'assistant'`, `content` text, `createdAt`) — per AD-9. Do NOT create an `attachment` table yet (Story 3.1 owns that).
  - [x] Create `drizzle.config.ts` pointing at `db/schema.ts`, output migrations to `db/migrations/`
  - [x] Generate the initial migration (`drizzle-kit generate`)
- [x] Task 3: Wire up the DB client with auto-migration (AC: 1)
  - [x] Create `lib/db.ts`: instantiate `better-sqlite3` against a fixed local path (e.g. `data/local-gemma-chat.db`, gitignored — add to `.gitignore` if not already), run pending Drizzle migrations lazily on first import/access (module-level side effect is fine here — keeps `npm run dev` a true one-command start, no separate migrate step)
- [x] Task 4: Persist messages from the chat flow (AC: 2, 5, 6, 7)
  - [x] Add `export const runtime = "nodejs";` to `app/api/chat/route.ts`
  - [x] On each `POST /api/chat`: resolve or create the active `CONVERSATION` (client passes a `conversationId`, or the route creates one on first message — coordinate with Story 2.2's "new conversation" flow, but this story only needs a single always-active conversation to satisfy its own ACs), insert the incoming user `MESSAGE`, set `title` if this is the conversation's first message, bump `updatedAt`
  - [x] After `streamText` completes, insert the assistant's final text as a `MESSAGE` row, bump `updatedAt` again (see Dev Notes on `onFinish`)
- [x] Task 5: Load and render persisted history on page load (AC: 3, 4)
  - [x] Add a way for `app/page.tsx` to fetch the current/most-recent conversation's messages on mount (a small `GET` — this can live in `/api/chat` as a `GET` handler, or a minimal dedicated route; Story 2.2 will add the full `/api/conversations` routes, this story only needs "give me the active one")
  - [x] Pass fetched messages as `useChat`'s initial messages so the UI shows history immediately, not a blank state

## Dev Notes

- **AD-3 (amended)**: persistence is a single local SQLite file, owned directly by the Next.js server process — no new service, no Docker volume. **AD-9**: `MESSAGE.content` is always plain display text (never a serialized parts array); attachments (not built until Story 3.1) are always separate rows, never inlined.
- **Current `app/api/chat/route.ts`** (read during story creation):
  ```ts
  import { convertToModelMessages, streamText, type UIMessage } from "ai";
  import { localModel } from "@/lib/model";

  export async function POST(req: Request) {
    const { messages }: { messages: UIMessage[] } = await req.json();
    const result = streamText({ model: localModel, messages: await convertToModelMessages(messages) });
    return result.toUIMessageStreamResponse();
  }
  ```
  Use AI SDK's `streamText`'s `onFinish` callback (or `toUIMessageStreamResponse`'s equivalent hook) to capture the assistant's final text for persistence — don't try to re-derive it by re-reading the stream after the fact.
- **Current `app/page.tsx`** uses `useChat()` from `@ai-sdk/react` with local `messages`/`sendMessage`/`status`. Check the installed `ai`/`@ai-sdk/react` version's API for passing initial messages (e.g. `useChat({ messages: initialMessages })` or the current equivalent) — confirm against the installed version rather than assuming, since AI SDK's message-loading API has shifted across versions.
- **Consistency Conventions (Architecture Spine)**: every PK via `nanoid()` (already in `package.json`). Migrations auto-apply on startup — no manual `npm run db:migrate` step, to preserve the two-command startup goal (NFR2).
- Do not build conversation list/switch/delete UI here — that's Story 2.2. This story only needs one active conversation to persist and reload correctly.
- Do not create the `ATTACHMENT` table — Story 3.1 creates it when it's actually needed (architecture's "don't create tables before they're needed" rule, already validated in the implementation-readiness check).

### Project Structure Notes

- New: `db/schema.ts`, `db/migrations/`, `drizzle.config.ts`, `lib/db.ts`, `data/` (gitignored DB file location).
- Modified: `app/api/chat/route.ts` (persistence + `runtime="nodejs"`), `app/page.tsx` (load initial history).

### References

- [Source: _bmad-output/planning-artifacts/architecture/architecture-local-ai-with-bmad-2026-07-09/ARCHITECTURE-SPINE.md#AD-3, AD-9, Consistency Conventions, Entities] schema, runtime, migration strategy
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2, Story 2.1]
- [Source: _bmad-output/implementation-artifacts/1-1-verify-and-accept-the-local-chat-foundation.md] confirmed current `/api/chat/route.ts` and `app/page.tsx` shape

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (implemented in an isolated worktree; independently re-verified in the main tree after merge)

### Debug Log References

- Implemented in worktree `worktree-agent-a505e8d9f16651120` — merged into main tree, worktree removed after merge (nothing was committed there, so no history was lost).
- Post-merge verification in the main tree: `npm install` (native `better-sqlite3` binding compiles cleanly — confirmed via a standalone `node -e` smoke check), `npx tsc --noEmit` (only the 7 pre-existing `prompt-input.tsx` errors remain), `npm run lint` (only the 1 pre-existing warning remains).
- Live browser verification (main tree, via MCP preview tools): sent "Reply with just the word: persisted" through the real UI against the real llama.cpp container; read `data/local-gemma-chat.db` directly with `better-sqlite3` afterward — confirmed one `conversation` row (title = full message text, under 50 chars) and two `message` rows (`role='user'`/`role='assistant'`, `content` plain text, `nanoid()` ids); reloaded the page and confirmed the same history rendered from persistence, not a blank state.

### Completion Notes List

- All 7 ACs pass. Added SQLite persistence (Drizzle ORM + `better-sqlite3`) on top of the existing chat flow without rewriting anything that already worked.
- `db/schema.ts`: `conversation` + `message` tables per AD-9, `nanoid()` PKs. No `attachment` table (correctly deferred to Story 3.1).
- `lib/db.ts`: migrations run lazily on module load — `npm run dev` remains a true one-command start (NFR2), no separate migrate step.
- `app/api/chat/route.ts`: `runtime = "nodejs"` set; `POST` persists both sides of the exchange (assistant text captured via `onFinish`), sets `title` once, bumps `updatedAt`; new `GET` returns the active conversation's history.
- `app/page.tsx`: fetches persisted history on mount, feeds it into `useChat` so reloads show history immediately.
- Deliberately did not build multi-conversation switching (`conversationId` plumbing) — out of this story's scope per its own Dev Notes; the server always operates on "the most recently updated conversation," creating one if none exists. Story 2.2 adds real switching.
- **Merge note**: this story was implemented in an isolated git worktree (parallel to Story 4.1). The worktree lacked `_bmad-output/` (uncommitted in the main tree at branch time), so its copy of this story file and `sprint-status.yaml` diverged from the main tree's. Resolved by merging only the code changes (app/db/lib files, `package.json` dependency additions, `.gitignore`) into the main tree and re-applying this status update directly here, rather than overwriting the main tree's tracking files with the worktree's stale copies. `package-lock.json` was regenerated via `npm install` in the main tree rather than copied, to avoid divergence. The worktree is now removed (nothing was committed in it, so removal lost no history).

### File List

- New: `db/schema.ts`, `db/migrations/0000_known_marvel_boy.sql` (+ Drizzle meta), `drizzle.config.ts`, `lib/db.ts`
- Modified: `app/api/chat/route.ts`, `app/page.tsx`, `package.json`, `package-lock.json` (regenerated), `.gitignore`
