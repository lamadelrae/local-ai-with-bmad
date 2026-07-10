---
title: Product Brief — local-gemma-chat
status: final
created: 2026-07-09
updated: 2026-07-09
---

# Product Brief: local-gemma-chat

## Executive Summary

local-gemma-chat is a minimal, fully local chat application: a Next.js web UI talking to Gemma 4 E2B — Google's ~2B-parameter edge model — served entirely on the user's own machine via a Dockerized llama.cpp server. No cloud API keys, no per-token billing, no data leaving the laptop. The point isn't to out-chat GPT; it's to have a working, inspectable reference for "AI SDK + AI Elements UI talking to a local OpenAI-compatible endpoint," and to build it end-to-end through the BMAD Method so the human running it gets to observe agent-driven, role-based development (Analyst → PM → Architect → Dev) in practice.

## The Problem

Wiring a chat UI to a *local* model is more fiddly than it should be: most tutorials assume a cloud provider (OpenAI, Anthropic) and a hosted API key. The pieces that make "local" easy — Ollama — are exactly what this project wants to avoid, in order to see how the OpenAI-compatible-endpoint pattern works without that abstraction layer. Separately, there's no small, concrete example of running the BMAD Method against a real (if tiny) build, so it's hard to know what the workflow actually feels like before committing to it on something bigger.

## The Solution

A single-page chat app (AI SDK `streamText` + AI Elements + shadcn/ui) pointed at `http://localhost:8080/v1`, backed by a `llama.cpp` server container serving the Gemma 4 E2B GGUF. `docker compose up` starts the model server; `npm run dev` starts the web app. Two commands, no accounts, no keys.

## What Makes This Different

Nothing here is novel technology — the value is in the combination being small, transparent, and Ollama-free. Using the llama.cpp server directly (rather than a wrapping daemon) keeps the inference layer legible: one container, one OpenAI-compatible port, no hidden model management.

## Who This Serves

A single user (the builder) who wants (a) a local chat reference app they understand top to bottom, and (b) a firsthand look at the BMAD Method's persona-gated workflow on a project small enough to finish in a sitting.

## Success Criteria

- `docker compose up` serves Gemma 4 E2B at `localhost:8080/v1` and responds to a raw curl chat-completions request.
- The Next.js chat page sends a message and streams a real model response end-to-end in the browser.
- No Ollama, no auth, no cloud database or hosted persistence — conversation history lives in a single local SQLite file, nothing leaves the machine.

## Scope

**In:** chat UI (message list, input, send), `/api/chat` route using AI SDK against the local endpoint, Docker Compose for the llama.cpp server, README covering the two-command startup, multimodal file attachments (JPEG/PNG/PDF), local voice-to-text, and persistent SQLite conversation history with session management.

**Out:** auth, multi-user, cloud fallback, Ollama, model fine-tuning, conversation export.

## Vision

If it succeeds as a reference, the same pattern (Docker-hosted OpenAI-compatible endpoint + AI SDK + AI Elements) becomes the starting point for future local-first AI experiments — swapping in different GGUF models or adding tool calls — without ever needing to touch a cloud provider.
