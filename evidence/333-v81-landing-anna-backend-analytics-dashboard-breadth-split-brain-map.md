# V8.1 Evidence - Landing Anna backend analytics / dashboard breadth split-brain map

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: `Landing Anna backend analytics / dashboard breadth`
Status: `active`

## Why this lane is now active

The accepted `Landing Anna multilingual expansion` lane closed the bounded public-language cut for Anna on the live landing surface.

What remains is no longer language or prompt work. It is backend analytics / dashboard breadth for the already-visible Anna funnel.

## Current split-brain

The public Anna analytics path still mixes client truth and backend truth:

1. `src/components/Landing/AnnaAssistantWidget.tsx` already emits `landing_anna_widget_opened`, `landing_anna_message_sent`, `landing_anna_fallback_shown`, and `landing_anna_handoff_clicked`
2. `src/services/funnelAnalytics.ts` stores those events in browser session storage and may forward them to optional browser analytics integrations
3. the public landing path still lacks durable anonymous backend ingest for that Anna funnel event set
4. existing backend Anna conversation analytics are partial and worker-centric, not a full public funnel summary

This creates a visible analytics split-brain:

1. the live widget appears instrumented
2. but operator/backend truth for public Anna funnel behavior is incomplete
3. so Anna analytics cannot yet be trusted as an end-to-end backend-backed slice

## Smallest honest first packet

The first bounded packet is:

`Landing Anna public funnel ingest continuity`

It is the smallest honest packet because it:

1. closes the missing backend truth seam for the already-shipped public Anna event set
2. reuses existing analytics storage instead of inventing a new analytics subsystem
3. adds one thin operator-facing read summary without broadening into full dashboard productization
4. preserves broader voice-product, BI, and marketing redesign work as separate backlog

## Explicitly not this packet

This split-brain map does not activate:

1. a full Anna analytics UI/dashboard module
2. broad authenticated journey analytics redesign
3. broader Anna voice UX / architecture work
4. broader landing redesign work
