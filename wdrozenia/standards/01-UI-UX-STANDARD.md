# 🎨 UI/UX Standard (kanoniczny)

## Cel
Zapewnić spójny UI/UX we wszystkich modułach (ModuleHub pattern + wspólne stany + brak mock fallbacków).

## Źródła prawdy
- Golden Standard: `wdrozenia/UI_UX_GOLDEN_STANDARD.md`
- (Legacy) `wdrozenia/standards/UI-UX-STANDARD 2.md` – **nie jest kanoniczny**

## Wymagania MUST (minimum)
- **ModuleHub** dla modułów listowych (tabs, search, view-modes, primary CTA).
- **Stany**: loading / error / empty (z retry) – zamiast „udawania danych”.
- **Spójny StatusBadge** i mapowanie kolorów.
- **Wspólne wzorce**: drawer 50% + „open wider” tam gdzie to ma sens.

## UI stany (kanon)
- **Loading**: skeleton/spinner, blokada akcji zależnych od danych.
- **Error**: czytelny komunikat + przycisk retry (bez fallback danych).
- **Empty**: komunikat + CTA „Create / New …”.

## i18n (jeśli włączone w danym obszarze)
Nie hardcodujemy tekstów w komponentach. Teksty idą przez warstwę tłumaczeń.

## Historia zmian
- 2026-01-26: utworzono kanoniczny plik, wskazano źródła i minimum MUST

