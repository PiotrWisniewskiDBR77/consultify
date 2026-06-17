# HARVARD 2 — i18n owner (Faza 4, wyłączny właściciel locales)
**Fala:** 3 (rebalans 2026-06-17) | **Branch:** Londyn

Cześć. Jesteś **Harvard 2**, jedna z 5 równoległych sesji. Twoja rola = **jedyny agent dotykający tłumaczeń**. To celowo jeden owner, bo `public/locales/*.json` to wspólny plik — split = merge-hell. **Pełna pula tokenów — fan-out na sub-agenty (np. jeden sub-agent per moduł na swap inline→t()).**

## NAJPIERW PRZECZYTAJ
1. `Harvard/wdrozenie-100/_KONTYNUACJA.md` (§6 backlog i18n, §3 strefy)
2. `Harvard/wdrozenie-100/AGENT_MAP.md` — „FALA 3" (twój wiersz)
3. §03 teczek modułów z luką i18n (niżej)

## ZAKRES — 9 luk i18n, ~2400 stringów
Zlikwiduj `isPolish`/`tr(en,pl)`/inline-hardkody → pełne `t()` z PL/EN. Klucze dodaj do **wszystkich** locale (`pl, en, de, es, jp, ar`) — minimum PL+EN realnie przetłumaczone, reszta = EN fallback dopóki landing-agent nie uzupełni.

| Luka | Moduł | Zakres (grep) | Pliki |
|------|-------|---------------|-------|
| M13 L-11a | Inicjatywy | **~1820×** (największe) | `src/components/Initiatives/` (`InitiativeDocumentView`, `sections/*`) |
| M21 L-06 | Meeting | 79× `isPolish` (+109× już `t()`) | `src/components/Meeting/` |
| M12 L-07 | Audyty | ~96× (`Wizard 45 + Hub 48 + presets 3`) | `src/components/Audit/` |
| M17 L-09 | Outputs | 96× `isPolish` | `ReportsAndPresentations/*` |
| M01 L-10 | Czat | 305× inline | `src/components/AIChat/` |
| M19 L-05 | Prezentacje | 30× `isPolish` | `src/components/Presentations/` |
| M18 L-09 | Dokumenty | EN-only (tylko 2 pliki z `useTranslation`) | `src/components/Documents/` |
| M20 L-09 | Tabele | PublicViewPage EN-only | `PublicViewPage` |
| M02 L-11 | Canvas | 28 hardkodów, 0× `useTranslation` | `src/components/AIChat/WorkCanvasDocumentPanel.tsx` |

## METODA (kolejność: największe → najmniejsze)
1. Per moduł: sub-agent grepuje `isPolish|tr\(|'[A-Z][a-z].*'` w katalogu, zbiera listę stringów.
2. Generuje klucze (namespacing per moduł, np. `initiatives.section.title`), wpisuje do `pl`+`en`.
3. Swap w komponentach: inline → `t('klucz')`; usuń `isPolish` i potrójne `tr(en,pl)`.
4. Dowód: render w preview PL i EN (przełącz język), screenshot — brak gołego EN w PL i odwrotnie.

## GRANICA (anty-kolizja)
- **TYLKO TY** ruszasz `public/locales/*`. Inni agenci dodają `t('klucz')` i zgłaszają ci klucze — ty je realizujesz.
- Komponenty: edytujesz tylko miejsca z hardkodami i18n; logikę zostaw nietkniętą (gdyby kolidowała ze strefą innego agenta — uzgodnij, commituj wąsko).
- `git fetch` często — pliki komponentów dzielisz z agentami modułowymi; trzymaj zmiany i18n-only.

## FAN-OUT
Sub-agent per moduł (Agent tool): zwraca (a) patch do `pl/en` JSON, (b) patch swapów w komponentach, (c) listę kluczy. Ty scalasz JSON **sekwencyjnie** (jeden zapis pliku locale na raz — żeby nie nadpisać), komponenty commitujesz per moduł.

## GIT
`git fetch origin Londyn` przed commitem; **NIGDY `git add -A`**; commit `fix(M13/L-11a): i18n sweep Initiatives`. Locale i komponenty w osobnych commitach per moduł.

## DONE
- [ ] 9 luk i18n → `ZAMKNIĘTA <data> <SHA>`; 0× `isPolish`/`tr(en,pl)` w objętych katalogach (grep dowód)
- [ ] PL i EN renderują się poprawnie (screenshot per moduł), pozostałe locale = EN fallback bez crasha
- [ ] 0 nowych błędów `tsc`; raport z licznikami przed/po

Nie ruszaj prod. `de/es/jp/ar` pełne tłumaczenia = oddzielny agent landingu (nie ty) — ty tylko klucze + PL/EN.
