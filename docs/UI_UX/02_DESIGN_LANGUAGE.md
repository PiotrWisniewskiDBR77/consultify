---
uiux_doc_id: UIUX_DESIGN_LANGUAGE
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Design language — DBR77 Tech Sexy 2027

## Purpose

Zamknąć nadrzędny kierunek wizualny aplikacji: “quiet, premium, technical, enterprise calm”, bez lokalnych wariantów per moduł.

## Applies To

Cała aplikacja (wszystkie moduły i ekrany; w tym Admin/SuperAdmin/Settings, portal partnerski, AI OS).

## Must

- **MUST**: Jedna aplikacja = jeden język wizualny. Ekrany modułów nie “posiadają” własnego designu — kompozycją składają zatwierdzone shell’e, komponenty i wzorce.
- **MUST**: Monochromatyczne chrome (sidebar/topbary/header/toolbar) — na ekranie jest **maksymalnie 1 kolorowy element**: Primary CTA. Kolory semantyczne są sygnałem danych/statusów, nie dekoracją.
- **MUST**: Dark mode jest first‑class; light mode ma być czytelny (nie “wyprany”).
- **MUST**: Separacja przez tło + spacing + typografię; bordery są ostatecznością.
- **MUST**: Brak gradientów w operational controls; brak ciężkich shadow na kartach treści; shadow jest dla floating UI.
- **MUST**: Komponenty i wzorce mają dyscyplinę: jeden family buttonów/controlek w jednym rzędzie, brak ad‑hoc toolbarów.

## Must Not

- **MUST NOT**: Tworzyć per‑modułowych palet, ramek i “lokalnych kart”.
- **MUST NOT**: Używać pure black (`#000`) jako tła ani pure white (`#fff`) jako tekstu w dark mode.
- **MUST NOT**: Mieszać rodzin przycisków i radiusów w jednym ekranie.

## Should

- **SHOULD**: Używać warstw tła (Layer 0–3) zgodnie z DBR77 (sidebar ciemniejszy od content; karty jako Layer 2; modale jako Layer 3).
- **SHOULD**: Trzymać “pack nav, breathe content”: nawigacja gęsta, content z oddechem.

## Acceptance Criteria

- [ ] UI spełnia non-negotiables z `CONSULTIFY_UI_UX_GOLDEN_STANDARD.md` i `visual-language.md`.
- [ ] Każdy nowy ekran używa zatwierdzonych tokens i nie wprowadza lokalnych stylów.

## Related Sources

- `DRD/consultify/docs/ui-standards/CONSULTIFY_UI_UX_GOLDEN_STANDARD.md`
- `DRD/consultify/docs/ui-standards/00-foundation/visual-language.md`
- `DRD/consultify/docs/ui-standards/00-foundation/color-system.md`
- `DRD/consultify/docs/ui-standards/00-foundation/canvas-mode.md` (rozszerzenie tylko dla “experience surfaces”)

