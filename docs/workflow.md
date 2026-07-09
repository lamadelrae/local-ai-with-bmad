---
title: Development Workflow — local-gemma-chat
status: final
created: 2026-07-09
updated: 2026-07-09
---

# How local-gemma-chat Was Built (and What BMAD Actually Is)

**TL;DR:** BMAD is a method for building software in stages, using a different AI "specialist" for each stage (vision → requirements → architecture → backlog → sprints), so nothing gets built on vibes alone. This project used BMAD's document *templates*, but not its live interactive coaching — a one-time tooling quirk (explained in Part 2) meant the coaching skills weren't switched on yet. So: real BMAD-shaped documents, produced by a shortcut instead of the real conversation.

**Map of this doc — jump to what you need:**

- **Part 1** → what BMAD is, in plain terms (read this if you've never touched BMAD)
- **Part 2** → what actually happened building this project, step by step
- **Part 3** → a table of where this project's process differed from "by-the-book" BMAD

---

# Part 1 — What BMAD Actually Is

## The one-sentence version

BMAD splits "build me an app" into a relay race of narrow, specialist stages instead of one giant free-for-all request.

## Why it exists

Ask an AI to "build me an app" in one shot, and it has to guess your vision, your requirements, your architecture, and your code all at once — with no way to catch a bad guess early. BMAD forces a stop at each layer, produces a document you can actually read and correct, and only then moves to the next layer.

## The five stages

Each stage below is its own separate "skill" (BMAD's word for a specialist AI persona). Each skill has exactly one job and hands its output to the next stage.

| # | Stage | What it produces | The skill's name |
|---|---|---|---|
| 1 | **Brief** | The vision: why, for whom, what "winning" looks like | `bmad-product-brief` |
| 2 | **PRD** | The requirements: specific, numbered features | `bmad-prd` |
| 3 | **Architecture** | The rules: the handful of decisions that keep the codebase consistent | `bmad-architecture` |
| 4 | **Epics & Stories** | The backlog: requirements chopped into buildable chunks | `bmad-create-epics-and-stories` |
| 5 | **Sprints** | The execution: stories tracked, built, checked off | `bmad-sprint-planning`, `bmad-dev-story` |

Nothing skips ahead. Stage 2 needs Stage 1's output. Stage 4 needs Stage 2 and 3's output. And so on.

## Quick glossary

Keep this nearby — these terms repeat constantly below.

| Term | Plain-English meaning |
|---|---|
| **Skill / Agent** | One specialist AI persona, one job (e.g. "the PM," "the Architect") |
| **Brief** | The vision doc: why, for whom, in/out at a high level |
| **PRD** | The requirements doc: numbered features (`FR-1`, `FR-2`, ...) |
| **Architecture Spine** | The rules doc: a *short* list of decisions (`AD-1`, `AD-2`, ...) that must never get silently broken |
| **Memlog** | A running decision log kept live during the conversation — this, not the pretty document, is the real record |
| **Epic / Story** | A chunk of PRD work, broken down small enough to actually build |
| **Sprint status** | A tracking file: which stories are done / in progress / blocked |
| **FR-ID / AD-ID** | The permanent ID stamped on each requirement/decision so it can be traced from document to document forever |

## Two habits that show up at every stage

**1. The memlog is the real record — the document is just a clean copy of it.**

While you talk to a BMAD skill, it logs every decision to a running file (`.memlog.md`) as you go. Only at the end does it write the polished document (Brief, PRD, or Architecture Spine) *from* that log. If you stop halfway through a conversation, the memlog is what lets you resume later without losing anything.

**2. Nothing gets marked "done" without a review pass.**

Before a document flips to `status: final`, BMAD runs reviewer checks against it first. Only then does it close.

## Brief vs. PRD — the difference that trips people up

- **Brief = why.** Vision, problem, who it's for, rough in/out scope. Written once, near the start. Barely touched again.
- **PRD = what, exactly.** Numbered, specific requirements. A *living* document — updated as the project grows, and every requirement keeps its ID forever so nothing quietly disappears.

Architecture works like the PRD: it's also living, also updatable, also ID-tagged (`AD-1`, `AD-2`...) — just for structural rules instead of features.

## How a growing project stays maintained (not just built once)

Once a PRD and Architecture Spine exist:

1. **Epics & stories** — requirements get chopped into buildable chunks, each with acceptance criteria.
2. **A readiness check** — before coding starts, a gate confirms every single requirement actually made it into a story. Nothing quietly dropped.
3. **Sprint tracking** — stories get tracked in a status file and built one at a time.
4. **Mid-sprint changes** — if something significant changes while work is underway, a dedicated skill (`bmad-correct-course`) steps in:
   - reads the PRD, epics, and architecture together
   - proposes exact before/after edits to whichever documents are affected
   - labels the change **Minor** (dev just fixes it directly), **Moderate** (backlog gets reshuffled), or **Major** (bounces back up to PM/Architect to replan)

The point of that last step: small changes stay small and don't touch the PRD. Big changes loop back *into* the PRD/Architecture instead of quietly drifting away from what's written down.

---

# Part 2 — What Actually Happened Building This Project

Everything below is the retrospective: what ran for real, what snags came up, and how they got resolved.

## Starting point

The brief arrived pre-written, in one message: a full scope of work, an architecture sketch, explicit non-goals, and a six-stage BMAD plan. The project folder was empty — no git repo yet.

## Step 1 — Install BMAD

```bash
git init
npx bmad-method install --directory . --modules bmm --tools claude-code --yes
```

This installed BMAD's engine (`_bmad/`) and, importantly, **46 skills** into `.claude/skills/` — `bmad-help`, `bmad-prd`, `bmad-architecture`, `bmad-product-brief`, and the rest of the catalog described in Part 1.

**The snag:** Claude Code only loads its list of available skills once, at the *start* of a session. Skills installed mid-conversation don't become callable until a fresh session starts. Trying `bmad-help` right after install confirmed this — it came back "unknown skill."

**What that meant in practice:** the live, conversational coaching stages (Analyst/PM/Architect walking through questions with the user) couldn't run in this same conversation.

**What happened instead:** the installed skill files were read directly (their templates and rules), and the three planning documents were hand-authored in one pass, following those rules but without the live conversation. Reasonable stand-in for the shape of the output — **not** the same as the real process. Nobody actually got walked through the questions a real BMAD session would ask.

> **Want to see the real thing?** Start a brand-new Claude Code session in this folder and run `bmad-help` or `bmad-prd` directly — the skills are installed and ready. Only the same-session timing quirk got in the way here.

## The honest gap

What's missing isn't quality in the documents — it's the *conversation*:

- No real stakes calibration (hobby vs. internal vs. launch was inferred, not asked)
- No choice offered between Fast path and Coaching path
- No actual elicitation — the user's own words never got pulled out turn by turn
- No memlog
- No reviewer gate before finalizing

Running `bmad-prd` or `bmad-architecture` for real, in a fresh session, would likely change both documents.

## Step 2 — The three planning documents produced

- [`docs/brief.md`](brief.md) — Product Brief, following `bmad-product-brief`'s template.
- [`docs/prd.md`](prd.md) — PRD with numbered requirements `FR-1`–`FR-5`, non-functional requirements, `[ASSUMPTION]` tags where something was inferred.
- [`docs/architecture.md`](architecture.md) — Architecture Spine with five `AD-n` decisions, a diagram, a "Seed" section (facts true at cold start), and a "Deferred" section (consciously left undecided: GPU tuning, persistence, model swapping).

The brief's non-goals (no auth, no database, no multi-user, no cloud fallback, no Ollama) became `AD-3` and `AD-4` — numbered decisions a future change would have to consciously break, not just drift past.

## Step 3 — Getting Gemma running locally

`docker-compose.yml` runs a `llama.cpp` server container, which pulls the Gemma 4 E2B model itself on first start and caches it in a Docker volume so it doesn't re-download every restart.

**Three snags hit along the way:**

- **Snag — image pull denied.** Docker's credential helper had a stale, expired GitHub login cached for `ghcr.io` from something unrelated, so it tried (and failed) authenticated pulls instead of just pulling the public image anonymously. Fixed with `docker logout ghcr.io`.
- **Snag — unfamiliar model/tooling.** "Gemma 4" and its packaged format postdate this assistant's training data, so the exact Hugging Face repo name and Docker image tag were verified live (web search + a direct registry API check) instead of guessed from memory.
- **Health check tuning.** The container's health check was given a generous 120-second startup window, since the first run spends most of its time downloading the model, not starting the server.

Verified directly with a raw `curl` to the model server before any app code touched it.

## Step 4 — Building the app shell

**Snag — directory conflict.** `create-next-app` refused to scaffold in place because the folder already had BMAD's files in it. Worked around by scaffolding into a scratch folder and merging the results in.

Then, in order:

```bash
npx shadcn@latest init -y -d
npm install ai @ai-sdk/openai-compatible @ai-sdk/react zod
npx ai-elements@latest        # installed all 47 registry components by default
```

**Snag — way more than needed.** Running `ai-elements` with no arguments installs its *entire* component catalog — far beyond what a simple chat needs — dragging in heavy extra packages along with it. Since the brief's whole point was staying minimal, everything except the three components actually used (`conversation`, `message`, `prompt-input`) was deleted and re-installed cleanly, and the extra packages were trimmed from `package.json`. Cut 36 unused packages.

**Snag — unfamiliar library version.** The installed AI SDK was a major version well past this assistant's training data. Rather than write code from memory, the actual installed type definitions were read directly to confirm real function signatures first. That caught a real breaking change (a function that used to run instantly now returns a promise) before it became a bug.

## Step 5 — Wiring the chat together

- [`lib/model.ts`](../lib/model.ts) — points the AI SDK at the local model server.
- [`app/api/chat/route.ts`](../app/api/chat/route.ts) — streams the model's response back to the browser.
- [`app/api/status/route.ts`](../app/api/status/route.ts) — checks whether the local model server is reachable, for the UI's status dot.
- [`app/page.tsx`](../app/page.tsx) — the actual chat page: message list, input box, status dot.

## Step 6 — Proving it actually works

Not just type-checked — actually driven end-to-end in a real browser:

1. Confirmed the raw model server answers a real question via `curl`.
2. Loaded the app, confirmed the "online" status dot and empty chat state.
3. Typed a real message, watched it stream back a real answer (noticed Gemma "thinks" internally before answering out loud — that's why a reply takes a few seconds to appear).
4. Stopped the Docker container mid-session and confirmed the status dot flipped to "offline" live, then restarted it and confirmed it flipped back.

**One known, accepted loose end:** a type-checker (`tsc`) flags a handful of pre-existing errors inside a vendored component file, caused by a version mismatch between two third-party libraries. They're confined to features this app doesn't use (screenshots, hover cards) and don't affect the running app. Left as-is and noted in the README rather than silently ignored.

---

# Part 3 — Where This Project Differed From "By-the-Book" BMAD

| Planned (six BMAD stages) | What actually happened here |
|---|---|
| Analyst phase | Skipped — the brief arrived already written. |
| PM phase → PRD, live coaching | PRD written directly from the template, not through a live conversation (see the Step 1 snag). |
| Architect phase, live coaching | Same — Architecture Spine written directly, not coached. |
| UX phase | Skipped — the plan itself flagged this as optional for a simple chat UI. |
| Dev phase | Done as direct engineering, not through BMAD's dev skills — no epics/stories were generated, since a single-page app doesn't need a backlog. |
| Test Architect phase | Skipped — the plan itself flagged this as optional for a learning project. |

**The net effect:** the *documents* BMAD would have produced (Brief, PRD, Architecture Spine) exist, and they follow BMAD's real templates and rules. The *process* that normally produces them — a live, coached conversation with real elicitation and a reviewer gate — didn't run, purely because of a tooling timing quirk. That gap is fully recoverable any time: the skills are installed and waiting for a fresh session.
