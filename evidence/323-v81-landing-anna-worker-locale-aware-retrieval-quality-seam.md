# V8.1 Evidence - Landing Anna worker locale-aware retrieval quality seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: `Landing Anna prompt-quality / retrieval-quality`
Packet: `Landing Anna worker locale-aware retrieval quality`
Status: `landed`

## Seam closed

The fourth bounded quality packet now closes the locale-aware retrieval seam for worker-backed public Anna.

## What changed

1. `server/src/services/ai/virtualWorkerKnowledgeService.ts` now prefers locale-matching and language-neutral worker knowledge docs before cross-language fallback
2. worker-backed retrieval still preserves bounded fallback to other-language docs when the preferred-language search returns no hits
3. result ordering inside the worker knowledge seam now prefers the visitor language before lower-priority cross-language hits
4. `server/src/services/ai/__tests__/virtualWorkerKnowledgeService.test.ts` adds focused regression for locale preference and fallback behavior on the worker-backed Anna path

## Why this packet matters

Before this packet:

1. the main Anna public retrieval seam honored locale-aware preference
2. but the worker-backed Anna path could still mix in other-language worker docs first
3. that left a real answer-quality split-brain between default Anna and worker-configured Anna

After this packet:

1. both public Anna retrieval paths now follow the same locale-aware discipline
2. the visitor gets more language-consistent worker-backed answers without broadening into multilingual expansion
3. the active lane stays inside bounded prompt/retrieval quality work instead of leaking into broader Anna scope

## Lane state after this packet

The broader `Landing Anna prompt-quality / retrieval-quality` lane remains active.

The next step is to assess the next smallest prompt or retrieval quality residual after:

1. locale-aware retrieval quality
2. follow-up retrieval continuity
3. worker prompt merge continuity
4. worker locale-aware retrieval quality

are all landed.
