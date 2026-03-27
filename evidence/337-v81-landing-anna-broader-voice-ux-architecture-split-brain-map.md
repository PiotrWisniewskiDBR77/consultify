# V8.1 Evidence - Landing Anna broader voice UX / architecture split-brain map

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: `Landing Anna` broader voice UX / architecture
Status: `active`

## Why this lane is now active

The accepted Anna analytics lane closed the bounded backend/operator truth seam for the public Anna funnel.

What remains is no longer analytics, language, or prompt work. It is broader voice UX / architecture breadth on the live public Anna surface.

## Current split-brain

The public Anna voice path still mixes truth across browser runtime, backend seams, and the typed Anna path:

1. `src/components/Landing/AnnaAssistantWidget.tsx` runs live voice directly in the browser against Gemini Live with fixed model/voice constants
2. typed Anna uses server-mediated `POST /api/public/anna/chat`, while voice uses `GET /api/public/anna/voice-context` plus a direct browser voice session
3. public voice reports only bounded post-session metrics through `/api/public/anna/voice-event`, not a shared typed+voice conversation history
4. the current widget preserves continuity and safe teardown, but live voice still behaves as a separate architecture rather than a productized extension of the typed Anna session

This creates a visible voice split-brain:

1. Anna appears as one assistant on the public surface
2. but typed and voice operate through materially different runtime and session paths
3. so broader public Anna voice UX remains unresolved even after bounded continuity work is complete

## Smallest honest first packet

The first bounded packet is:

`Landing Anna voice architecture split-brain map`

It is the smallest honest packet because it:

1. names the real residual architecture instead of pretending there is one obvious tiny fix
2. avoids silently broadening into a full public voice redesign
3. preserves already accepted continuity packets as closed work
4. prepares the next real bounded voice packet only after the structural seams are explicit

## Explicitly not this packet

This split-brain map does not activate:

1. a full public voice redesign
2. prompt-quality, multilingual, or analytics work
3. broader landing redesign work
4. authenticated Teresa voice behavior
