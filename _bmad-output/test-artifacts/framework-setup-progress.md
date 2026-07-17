---
stepsCompleted: ['step-01-preflight', 'step-02-select-framework', 'step-03-scaffold-framework', 'step-04-docs-and-scripts', 'step-05-validate-and-summary']
lastStep: 'step-05-validate-and-summary'
lastSaved: '2026-07-16T12:58:00Z'
---

# Test Framework Setup — Progress

## Step 1: Preflight Checks

**Detected stack:** `frontend`

- No explicit `test_stack_type` override — config resolved to `auto`, detection ran.
- `package.json` present at project root — Next.js 16.2.10, React 19.2.4, TypeScript.
- No existing E2E framework config found (`playwright.config.*`, `cypress.config.*`, `cypress.json` all absent).
- Prerequisites satisfied — proceeding.

**Project context:**

- Project type: Next.js App Router web app ("local-gemma-chat") — chat UI over a local llama.cpp inference container.
- Key deps: `ai` / `@ai-sdk/react` / `@ai-sdk/openai-compatible` (streaming chat), `drizzle-orm` + `better-sqlite3` (local SQLite persistence), `zod`, `pdfjs-dist` (client-side PDF rendering), shadcn/radix UI components.
- No backend project manifest — single-process frontend+API-routes app, so stack is `frontend` (not `fullstack`).
- Architecture doc found: `_bmad-output/planning-artifacts/architecture/architecture-local-ai-with-bmad-2026-07-09/ARCHITECTURE-SPINE.md`
  - Two-process system: Next.js app (`/api/chat`, `/api/transcribe` routes) talks to a Dockerized llama.cpp server over an OpenAI-compatible `/v1/chat/completions` contract.
  - Persistence: single SQLite file via Drizzle, conversations/messages/attachments.
  - No auth layer documented (hobby/local project, single user).
- No CI config present (`.github/workflows` absent).

## Step 2: Framework Selection

**Selected: Playwright**

Rationale:
- `{detected_stack}` = `frontend`, browser-based testing applies — Playwright is the default.
- TEA install already opted into `tea_use_playwright_utils: true` — reinforcing this choice.
- The app has heavy API+UI integration worth covering with real network behavior: streaming SSE responses from `/api/chat`, file/PDF/image upload flows, and audio recording via `MediaRecorder` for `/api/transcribe`. Playwright's network interception and multi-context support fit this better than Cypress.
- No strong countervailing reason for Cypress (no component-testing-first requirement, no existing Cypress usage).

## Step 3: Scaffold Framework

**Execution mode:** sequential (no subagent/agent-team orchestration needed for a scaffold of this size).

**Created:**

- `playwright.config.ts` — testDir `tests/e2e`, action/nav/test timeouts per spec, HTML+JUnit+list reporters, trace/screenshot/video on failure, `webServer` block that boots `npm run dev` automatically.
- `.env.example` — `TEST_ENV`, `BASE_URL`, `API_URL`.
- `.nvmrc` — Node 24 (matches installed toolchain).
- `tests/support/fixtures/merged-fixtures.ts` — `mergeTests` of `apiRequest`, `recurse`, `interceptNetworkCall`, `networkErrorMonitor` from `@seontechnologies/playwright-utils`. **`auth-session` deliberately omitted** — this app has no auth layer (confirmed via architecture spine: single-user hobby project).
- `tests/support/factories/message-factory.ts` — `createMessage(overrides)` factory mirroring `db/schema.ts`'s `message` table (role/content/conversationId; id and timestamps are DB-generated).
- `tests/e2e/api-status.spec.ts` — pure API test against `/api/status`, which always returns 200 regardless of whether the Docker model container is running.
- `tests/e2e/chat-shell.spec.ts` — UI smoke test: page loads, composer (`getByPlaceholder("Message Gemma...")`) accepts input, submit button is visible. **Does not submit a message** — full chat send/receive is deferred to a future `*atdd`/`*automate` pass once the llama.cpp container is part of the test environment, since it requires the Docker model server to be up.
- `package.json` — added `test:e2e`, `test:e2e:ui`, `test:e2e:headed`, `test:e2e:report` scripts; devDependencies `@playwright/test`, `@seontechnologies/playwright-utils`, `@faker-js/faker`.
- Ran `npm install` and `npx playwright install --with-deps chromium`.

**Known gap:** the app currently has no `data-testid` attributes; sample test uses accessible role/placeholder locators instead (Playwright best practice, and the only option available). Flagged, not silently worked around.

**Verification:** ran `npx playwright test` — both specs passed (2 passed, ~10s), dev server auto-started via `webServer` config.

## Step 4: Documentation & Scripts

- Wrote `tests/README.md` — setup, running tests, architecture, coverage table (what's covered vs. deferred pending Docker model server in test env), best practices, CI note pointing at `bmad-testarch-ci`.
- Scripts already added in Step 3 (`test:e2e`, `test:e2e:ui`, `test:e2e:headed`, `test:e2e:report`).

## Step 5: Validate & Summary

**Checklist deviations (intentional, documented):**
- Fixed `trace: "retain-on-first-failure"` → `"retain-on-failure-and-retries"` per checklist spec.
- Selector strategy uses accessible roles/placeholders, not `data-testid` (app has none yet — flagged as a gap, not silently worked around).
- Factories live at `tests/support/factories/` (sibling to `fixtures/`), matching the knowledge base's own `test-utils/factories/` convention, rather than nested under `fixtures/factories/`.
- `tests/support/helpers/` created but empty — playwright-utils fixtures (`apiRequest`, `recurse`, `interceptNetworkCall`) cover current needs directly; no custom helper needed yet.
- No auth helper/fixture — app has no auth layer.
- Page-objects directory skipped — single-page app, not warranted yet.

**Verification re-run after the trace fix:** `npx playwright test` → 2 passed. `npx tsc --noEmit` → no errors in any new file (pre-existing unrelated errors in `components/ai-elements/prompt-input.tsx` predate this workflow).

**Completion summary:**
- Framework: **Playwright** (TypeScript), with `@seontechnologies/playwright-utils` fixtures merged in.
- Created: `playwright.config.ts`, `.env.example`, `.nvmrc`, `tests/e2e/{api-status,chat-shell}.spec.ts`, `tests/support/fixtures/merged-fixtures.ts`, `tests/support/factories/message-factory.ts`, `tests/README.md`; `package.json` scripts + devDependencies.
- Next steps: `cp .env.example .env` (optional), `npm run test:e2e` to run again anytime, `npm run test:e2e:ui` to debug interactively.
- Recommended follow-ups: `bmad-testarch-ci` (scaffold GitHub Actions), `bmad-testarch-atdd`/`bmad-testarch-automate` once the Docker model server is part of the test environment to cover real chat send/receive.
- Knowledge fragments applied: overview, fixtures-composition, api-request, intercept-network-call, data-factories, network-error-monitor, log, burn-in, auth-session (loaded, deliberately unused), recurse.
