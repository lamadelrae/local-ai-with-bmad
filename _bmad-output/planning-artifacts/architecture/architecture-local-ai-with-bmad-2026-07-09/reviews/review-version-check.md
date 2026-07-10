---
title: Reality-check review — ARCHITECTURE-SPINE.md
status: complete
reviewed: 2026-07-09
reviewer: web-research verification pass
---

# Reality-Check Review: architecture-local-ai-with-bmad-2026-07-09

Scope: verify every named technology/version/behavior claim in `ARCHITECTURE-SPINE.md` against live web sources rather than trusting training-data recall. Each item below is marked **CONFIRMED** (checked against a live source and matches), **PARTIALLY CONFIRMED** (checked, mostly right but a caveat exists that the spine doesn't surface), or **UNVERIFIED** (could not be confirmed from available sources — flagged as a risk, not asserted as wrong).

## Overall verdict

The spine's central, most-surprising claim — `unsloth/gemma-4-E2B-it-GGUF` — is **real and accurate**. This is notable because "Gemma 4" postdates typical model-family knowledge; it was independently confirmed as a real Google DeepMind release (April 2026) with the exact E2B/E4B naming and mmproj files the spine describes. The rest of the stack (llama.cpp mtmd, the ghcr.io image, Drizzle+better-sqlite3, Next.js/AI SDK/AI Elements/shadcn) all check out as currently real and maintained. The spine is in noticeably good shape for a document making forward-looking technical claims. The one gap worth closing: the spine doesn't call out that `better-sqlite3` requires the Node.js runtime (not Edge) in Next.js route handlers — a one-line addition would close a real footgun.

## Detailed findings

### 1. `unsloth/gemma-4-E2B-it-GGUF` ships `mmproj-{BF16,F16,F32}.gguf` — **CONFIRMED**

- Verified via HF collection listing (`huggingface.co/collections/unsloth/gemma-4`) and direct repo file listing (`huggingface.co/unsloth/gemma-4-E2B-it-GGUF/tree/main`).
- Repo exists, contains exactly `mmproj-BF16.gguf` (987MB), `mmproj-F16.gguf` (986MB), `mmproj-F32.gguf` (1.9GB), plus the expected quantized model files (Q3_K_M through Q8_0, BF16) and an `mtp-gemma-4-E2B-it.gguf` file.
- Cross-checked that Gemma 4 itself is a real, current release: Google DeepMind released Gemma 4 in April 2026 (Apache 2.0 license), with E2B/E4B "effective parameter" edge variants supporting native image+audio+video input, consistent with the spine's framing. Sibling repos (`gemma-4-E4B-it-GGUF`, `-qat-GGUF` variants, 12B/26B-A4B/31B) also exist, so the naming pattern is a stable convention, not a one-off.
- Severity if wrong: N/A — confirmed correct. This was the claim most likely to be a training-data hallucination (a "Gemma 4" model name reads like an extrapolation), so it's good the spine already flagged it for build-time re-confirmation ("re-confirm exact repo/tag at build time since naming can shift") — keep that caveat, repo layouts do still shift.

### 2. llama.cpp server `mtmd` accepts `image_url` and `input_audio` via OpenAI-compatible endpoint — **CONFIRMED, with one nuance**

- Verified against `ggml-org/llama.cpp` `tools/server/README.md` and `docs/multimodal.md` (GitHub, master branch).
- `/v1/chat/completions` content parts: `image_url.url` accepts remote URL, base64, or local path; `input_audio.data`/`input_audio.url` accepts the same. This matches AD-6/AD-8 exactly.
- The `-hf` flag auto-downloads a matching mmproj file (`--no-mmproj` to disable) — matches the spine's "no separate download/wiring step" claim.
- Gemma 4 is explicitly listed in llama.cpp's multimodal docs among the "mixed modality models" supporting both audio and vision — i.e., llama.cpp's own docs name-check this exact model family for mtmd.
- **Nuance not surfaced in the spine:** llama.cpp's own docs describe audio input support generally, and some *other* audio-only architectures (Qwen2-Audio, SeaLLM-Audio) are called out as having "very poor results" in GGUF form. This caveat applies to those specific models, not confirmed to apply to Gemma 4's audio path — but the spine's AD-8 presents audio transcription as a settled, low-risk feature without noting that llama.cpp audio support is newer/less battle-tested than its image support. Worth a one-line risk note, severity low.

### 3. `ghcr.io/ggml-org/llama.cpp:server` is a current, valid image — **CONFIRMED**

- Verified via `github.com/ggml-org/llama.cpp/blob/master/docs/docker.md` and the GitHub Container Registry package page (`github.com/orgs/ggml-org/packages/container/package/llama.cpp`).
- The `server` tag is a real, actively published variant (CPU-only), alongside `server-cuda`, `server-cuda13`, `server-rocm`, `server-vulkan`, etc. Platforms: linux/amd64, linux/arm64, linux/s390x — fine for the spine's CPU-inference, hobby-scale scope.

### 4. Drizzle ORM + `better-sqlite3` as a current, compatible pairing for Next.js App Router — **PARTIALLY CONFIRMED**

- Confirmed Drizzle has first-class `drizzle-orm/better-sqlite3` support and is broadly described (multiple 2026-dated sources) as a common/default choice for new Next.js projects — actively maintained, not a legacy pairing.
- **Gap the spine doesn't address:** `better-sqlite3` is a native (compiled) Node module and does **not** work under the Next.js Edge runtime — only the Node.js runtime. Since the spine's `/api/chat` and `/api/transcribe` routes will read/write the DB directly (per AD-3 and the diagram), those route handlers must not opt into `export const runtime = 'edge'` (or must explicitly set `runtime = 'nodejs'`, which is the default but worth stating given Next.js has shifted defaults across versions). This is a real, well-documented footgun (confirmed via Next.js's own edge-runtime docs and GitHub issues on the topic), not a hypothetical. Recommend adding a line to AD-3 or the Seed section pinning the Node.js runtime for these routes. Severity: low-medium — easy to fix once known, but silently breaks if someone (or a scaffolding tool) defaults a route to edge.

### 5. Next.js (App Router) / Vercel AI SDK / AI Elements / shadcn/ui as currently-maintained choices — **CONFIRMED**

- Next.js: current stable is the 16.x line (16.2.x as of ~June 2026), App Router is the recommended default, Pages Router is in maintenance mode — confirms the spine's choice is the actively-recommended path, not a legacy one.
- Vercel AI SDK: v5 is current, `streamText` is a live core API, `@ai-sdk/openai-compatible` exists on npm with the exact `createOpenAICompatible({ baseURL, apiKey, name })` shape the spine relies on (AD-1).
- AI Elements: confirmed real, actively maintained Vercel project (`vercel/ai-elements` on GitHub), built on shadcn/ui, installed via `npx ai-elements@latest add <component>` — matches the spine's Seed section exactly.
- shadcn/ui: confirmed as the underlying dependency for AI Elements, still the standard component-registry approach as of 2026.

## Items not independently re-verified

- Exact current *version numbers* to pin in `package.json` (e.g., specific Next.js patch, AI SDK minor, Drizzle version) were not pinned by the spine itself (it correctly leaves this to implementation time), so there was nothing further to verify beyond "the packages still exist and are maintained," which is confirmed above.
- Whether Gemma 4's audio transcription quality specifically (as opposed to general mtmd audio support) is production-ready was not independently benchmarked — only that llama.cpp's docs list Gemma 4 as a supported mixed-modality model. Flagged in finding #2 as a nuance, not a blocker.

## Recommendation

No corrections needed to the core technology claims — they hold up against live sources, including the one claim (Gemma 4) most likely to be a hallucination risk. Two small additions worth making before/at implementation time:
1. Add a one-line note pinning `/api/chat` and `/api/transcribe` to the Node.js runtime (not Edge) because of `better-sqlite3`.
2. Soften AD-8's audio-transcription framing slightly to acknowledge llama.cpp's audio mtmd path is newer/less proven than its image path, even though Gemma 4 itself is explicitly supported.
