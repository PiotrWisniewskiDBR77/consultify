# V8.1 Evidence - Landing Anna multilingual expansion split-brain map

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: `Landing Anna multilingual expansion`
Status: `active`

## Why this lane is now active

The accepted `Landing Anna prompt-quality / retrieval-quality` lane closed the small answer-quality seams on the current public Anna path.

What remains is no longer prompt-quality work. It is broader public-language breadth on the live landing surface.

## Current split-brain

The public landing surface now mixes truth across the app locale system and Anna's live behavior:

1. `src/i18n.ts` already exposes public app locales beyond PL/EN, including `es`
2. `src/components/Landing/EntryTopBar.tsx` already surfaces those public locale choices on the marketing shell
3. `src/components/Landing/AnnaAssistantWidget.tsx` still collapses runtime copy to PL or EN only
4. `server/src/routes/public-anna.routes.ts` still routes Spanish-looking messages into unsupported-language fallback

This creates a visible multilingual split-brain:

1. the public site can appear Spanish-enabled at shell level
2. but Anna still behaves as if Spanish is unsupported
3. so the landing assistant remains behind the rest of the public locale surface

## Smallest honest first packet

The first bounded packet is:

`Landing Anna Spanish public continuity`

It is the smallest honest packet because it:

1. uses a language already present in the public app locale system
2. improves the live visible Anna surface, not just hidden routing
3. avoids opening all remaining multilingual breadth at once
4. stays inside one LTR public-language cut instead of mixing in RTL or script-heavy expansion

## Explicitly not this packet

This split-brain map does not activate:

1. simultaneous rollout for `de`, `ar`, and `jp`
2. broader voice architecture work
3. Anna analytics/dashboard breadth
4. broader landing redesign work
