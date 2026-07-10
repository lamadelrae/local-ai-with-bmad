# PRD Quality Review — local-gemma-chat

## Overall verdict

This is a well-calibrated hobby-scale PRD: it states a coherent local-only thesis, avoids persona/NFR/vision theater, and — notably — self-reports a real architectural contradiction rather than smoothing it over. What's at risk is downstream precision on the three newly added capabilities (FR-6 through FR-9): a couple of FRs and Success Metrics carry unfalsifiable or ambiguous language that an engineer would have to interpret rather than verify, and the PRD has no Glossary despite explicitly feeding an Architecture Spine.

## Decision-readiness — adequate

The `[NOTE FOR PM]` at line 84 is the standout: it names a genuine, unresolved tension — this PRD's persistence scope directly contradicts the companion Brief's "no database, anywhere in the stack" and the Architecture Spine's AD-3 — and states what needs to happen next (Brief revision, new architecture decision superseding AD-3) rather than papering over it. That's exactly the kind of honest surfacing the rubric rewards.

Where it's weaker: the "Open Questions / Assumptions" section contains no actual open questions — everything is an `[ASSUMPTION]` or the one `[NOTE FOR PM]`. For a PRD that just tripled its FR count with capabilities carrying real technical uncertainty (mmproj availability, PDF handling mechanism, audio chunking), it's plausible there are genuine open questions being implicitly resolved by assumption rather than left open for the reader to weigh in on — e.g., "should PDF support ship in v1 if only text-extraction fallback works, or should PDF be cut?" is a real decision, currently pre-resolved by assumption rather than posed as a choice.

### Findings
- **low** No question is actually posed as open (§ Open Questions / Assumptions) — every item is an assumption or PM note, none is a genuine "which way should we go" choice, even though FR-6's PDF-handling mechanism is explicitly undecided ("architecture phase will decide the mechanism," line 83). *Fix:* consider adding one explicit Open Question naming the PDF fallback trade-off (image-rendering vs. text-extraction) as a decision point rather than folding it entirely into an assumption.

## Substance over theater — strong

No personas (appropriately — see Shape fit). NFRs are product-specific, not boilerplate: "no retry queues, no circuit breakers — this is a toy" (line 60) and "Local-only extends to new capabilities... consistent with FR-5" (line 63) are concrete, falsifiable commitments, not generic "must be reliable" filler. The Summary (line 14) names specific technology choices (Gemma 4 E2B, llama.cpp, Vercel AI SDK, AI Elements) and couldn't swap into another PRD unchanged. No findings.

## Strategic coherence — adequate

The thesis — a fully local, self-contained, single-user reference app, with "local-only" as the load-bearing constraint — is real and threads through FR-5 through FR-9 and their supporting NFR (line 63). Success Metrics are behavioral/activity checks appropriate to a reference app, not vanity metrics, and a Counter-metric is present (line 75) guarding against scope creep into a "general-purpose document-management system."

What's thinner: the PRD bundles three substantial new capabilities (multimodal attachment, voice-to-text, persistent history) into one update with no stated prioritization or sequencing among them, and no acknowledgment of why persistence — which serves user convenience, not the "local-only" thesis in the same direct way multimodal/voice do — belongs in the same wave as the other two. The NFR at line 64 retroactively ties persistence to "local-only," but the Summary's framing ("Beyond plain text chat, users can...") reads as an additive list rather than a reasoned expansion.

### Findings
- **low** No sequencing or priority signal across FR-6/7/8/9 (§ Functional Requirements) — if hobby time runs out, it's not clear which of the three new capabilities is expendable. *Fix:* a one-line priority note (even "all three are independent and can ship in any order") would remove ambiguity for a solo implementer triaging scope.

## Done-ness clarity — thin

Most FRs are concretely testable: FR-1/FR-2/FR-3/FR-5/FR-8 name specific endpoints, routes, components, and storage mechanisms an engineer can verify directly. The newly added FRs are softer:

- FR-9 (line 56): "Opening the app resumes the most recent conversation **or** offers the list, rather than always starting blank." This is a genuine either/or with no resolution — an engineer implementing this doesn't know which behavior to build.
- FR-4 (line 46): "surfaces, at a glance, whether the local model server is reachable (e.g. a simple indicator)" — acceptable looseness for hobby stakes, but "at a glance" carries no bound (polling interval? on load only? live?).
- Success Metrics for FR-6/FR-7 (lines 70–72) use "produces a reply that **accurately reflects**" and "produces an **accurate** text transcription" — these read as testable but have no way to fail gracefully-but-wrong; there's no threshold or example-based check, so "accurately" is doing unfalsifiable work. Given hobby stakes this is defensible as a human-eyeball test, but it's worth being explicit that's the intended verification method rather than leaving "accurately" to imply a bar that doesn't exist.

### Findings
- **medium** FR-9's opening-behavior is stated as an unresolved either/or ("resumes the most recent conversation or offers the list") (§ FR-9, line 56) — a solo implementer will have to invent the answer. *Fix:* pick one (recommend: resume most recent, since a single-user reference app has no reason to force a choice screen) or explicitly mark it `[NOTE FOR PM]` as a deferred UI decision.
- **low** SM language "accurately reflects" / "accurate text transcription" (§ Success Metrics, lines 70–72) has no stated verification method (spot-check by eye vs. any quantitative bar). *Fix:* one clause noting these are manually eyeballed acceptance checks, not automated metrics, would remove any implied rigor that isn't there.

## Scope honesty — strong

Non-Goals (lines 27–32) are specific and do real work, including two items added specifically to bound the new capabilities ("Cloud-based vision, OCR, or speech-to-text services of any kind," "Cross-device sync or sharing of history"). Assumptions are consistently tagged and indexed together at the end. Most notably, the `[NOTE FOR PM]` at line 84 is scope honesty at its best: rather than silently letting FR-8/FR-9 stand alongside a Brief and Architecture Spine that explicitly forbid persistence, the PRD calls out its own contradiction and names the follow-up work required. Open-items density (5 assumptions + 1 PM note) is proportionate to a hobby PRD that just added three capabilities — not excessive. No findings.

## Downstream usability — thin

This PRD is chain-top (it explicitly references and is meant to be reconciled with a companion Brief and an Architecture Spine, line 10 and line 84), so this dimension carries more weight than it would for a standalone PRD. FR IDs are contiguous and unique (FR-1–FR-9), and terminology ("conversation," "attachment," "local-only") is used consistently across Goals, FRs, NFRs, and Success Metrics with no drift observed. However, there is no Glossary section at all — for a document that hands off to `bmad-architecture`, a short glossary (e.g., defining "conversation" vs. "session," "attachment," "local-only guarantee") would let the architecture phase source-extract terms without re-deriving intent from prose.

### Findings
- **medium** No Glossary section, despite the PRD explicitly feeding a downstream Architecture Spine (§ whole document; cf. line 10, line 84). *Fix:* add a short Glossary defining "conversation," "attachment," and "local-only guarantee" so architecture and any future story-creation pass can cite terms rather than re-reading prose.

## Shape fit — strong

Hobby/solo stakes are honored throughout: no personas, no UJs, capability-spec-style FRs instead of user-journey scaffolding — appropriate for a single-operator reference app (line 36, "Single user: the person running this on their own laptop"). The PRD isn't over-formalized (no UJ density for a one-person tool) or under-formalized (Non-Goals, Assumptions, and NFRs are all present and doing real work despite the short format). This is the right shape for the stated stakes. No findings.

## Mechanical notes

- No glossary drift observed — "conversation," "attachment," "local-only" are used identically across Goals, FRs, NFRs, and Success Metrics.
- FR IDs (FR-1 through FR-9) are contiguous, unique, with no gaps or duplicates.
- Assumptions Index roundtrip: all 5 `[ASSUMPTION]` tags and the 1 `[NOTE FOR PM]` are inline in the same "Open Questions / Assumptions" section (no separate index to check for drift); all resolve cleanly.
- No UJs present — consistent with Shape fit judgment above (single-operator capability spec, not a UJ-driven document).
- Non-Goals section uses plain bullets rather than `[NON-GOAL for MVP]` callout tags — cosmetic only, content is equally explicit either way.
