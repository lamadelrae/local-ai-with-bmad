# Test Suite

End-to-end tests for local-gemma-chat, built on Playwright + [`@seontechnologies/playwright-utils`](https://github.com/seontechnologies/playwright-utils).

## Setup

```bash
npm install
npx playwright install --with-deps chromium
cp .env.example .env   # optional overrides: TEST_ENV, BASE_URL, API_URL
```

## Running tests

```bash
npm run test:e2e            # headless, spins up `npm run dev` automatically
npm run test:e2e:headed     # headed, watch the browser
npm run test:e2e:ui         # Playwright UI mode (best for debugging)
npm run test:e2e:report     # open the last HTML report
```

`playwright.config.ts` auto-starts the Next.js dev server (`webServer`) against `BASE_URL` (default `http://localhost:3000`) and reuses an already-running one locally. You do **not** need to run `npm run dev` yourself first.

The Docker model container (`docker compose up`) is **not** required for the current suite — see Coverage below.

## Architecture

```
tests/
├── e2e/                          # Test specs
│   ├── api-status.spec.ts
│   └── chat-shell.spec.ts
├── support/
│   ├── fixtures/
│   │   └── merged-fixtures.ts    # mergeTests() — single `test`/`expect` import for all specs
│   └── factories/
│       └── message-factory.ts    # createMessage(overrides) — mirrors db/schema.ts
└── README.md
```

- **Fixtures** (`support/fixtures/merged-fixtures.ts`): merges `apiRequest`, `recurse`, `interceptNetworkCall`, and `networkErrorMonitor` from playwright-utils into one `test` object. Import `test`/`expect` from here in every spec, not from `@playwright/test` directly.
- **Factories** (`support/factories/`): plain functions returning objects with sensible defaults + `faker`-generated fields, overridable per test. Seed data via API, never via UI.
- **No `auth-session` fixture**: this app has no auth layer (single-user hobby project). Add one if that changes.

## Coverage

| Spec | What it covers | Requires Docker model server? |
| --- | --- | --- |
| `api-status.spec.ts` | `/api/status` always returns `200` with an `online` boolean, whether or not the model container is reachable | No |
| `chat-shell.spec.ts` | Chat page loads, composer accepts input, submit control renders | No |

**Not yet covered** (needs the llama.cpp Docker container running as part of the test environment): actually sending a message through `/api/chat` and asserting a streamed reply, image/PDF attachment flows, and audio transcription via `/api/transcribe`. Use `*atdd` or `*automate` to add these once that's wired into CI.

## Best practices

- **Selectors**: the app currently has no `data-testid` attributes — tests use accessible locators (`getByRole`, `getByPlaceholder`, `getByLabel`). Prefer `data-testid` for anything without a stable accessible name if you add one later.
- **Isolation**: seed test data via API calls or factories, never by driving the UI to create prerequisite state.
- **Network-first**: when intercepting, call `interceptNetworkCall` *before* the action that triggers the request (see `resources/knowledge/intercept-network-call.md` in the `bmad-testarch-framework` skill for patterns).
- **Network error monitoring**: any test hitting an endpoint that returns 4xx/5xx will fail automatically unless annotated `{ annotation: [{ type: 'skipNetworkMonitoring' }] }` — use that for tests that intentionally exercise error paths.

## CI integration

No CI pipeline exists yet. Run the `bmad-testarch-ci` skill (Murat's `CI` menu item) to scaffold a GitHub Actions workflow that runs `npm run test:e2e` on PRs.

## Knowledge base

Full pattern references live in `.claude/skills/bmad-testarch-framework/resources/knowledge/` and `.claude/skills/bmad-testarch-*/resources/knowledge/` — fixtures composition, API requests, auth sessions, polling (`recurse`), logging, burn-in test selection, network interception, and data factories.
