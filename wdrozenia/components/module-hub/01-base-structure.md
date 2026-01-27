# 🧩 ModuleHub – 01 Base structure

## Cel
Ustandaryzować „szkielet” modułów listowych w Consultify (spójna nawigacja, search, view-modes, primary CTA).

## Źródło prawdy
`wdrozenia/UI_UX_GOLDEN_STANDARD.md` (sekcje: architektura komponentów, props, checklist)

## Wymagania MUST
- `ModuleHub` jako kontener
- `ModuleNavBar` (tabs + search + view toggle + primary CTA)
- `DynamicTabs` (max 6 otwartych dokumentów)
- `ActiveFilters` (chips)
- Content area: table/grid (+ opcjonalnie kanban/timeline/calendar)

## DoD
- Brak mock fallbacków (loading/error/empty + retry)
- Spójne statusy i badge
- Dane z real API

