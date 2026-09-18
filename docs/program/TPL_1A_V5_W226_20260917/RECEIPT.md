# TPL-1a v5 — Source w Menu 2

Data: 2026-09-17

Wykonawca: `[B] Codex-2`

Baza i aktualna linia po `git fetch origin`: `e05ea74752eee242ad38f64c036cf50f4b2e3f73`

## Werdykt

**READY FOR CTO REVIEW.** Filtr źródła Biblioteki wzorców został przeniesiony z Menu 3
do rozwijanego filtra **Source** w Menu 2, bez zmian danych i bez migracji.

## Zachowanie

- Menu 3 Biblioteki zawiera wyłącznie formaty: All formats, Reports, Sheets i Presentations.
- Menu 2 zawiera Source obok Status, z opcjami All sources, Personal, Application,
  Organization i Unknown oraz licznikami dla każdej opcji.
- Liczniki źródeł uwzględniają aktywny format, a liczniki formatów uwzględniają aktywne źródło.
- Wybór Source zasila istniejący filtr `scope`, zawęża ten sam zbiór, który renderuje
  `TemplatesTabContent`, i zapisuje się jako `source=<scope>` w URL.
- Zimne wejście z `?tab=templates&source=system` odtwarza dropdown i listę. Usunięcie
  chipa aktywnego filtra albo Clear usuwa parametr URL.
- Etykieta filtra ma jawne tłumaczenia EN `Source` i PL `Źródło`.

## Bramka

| Kontrola | Wynik |
|---|---|
| Kontrakt Menu 2/3 + URL + zawężenie listy | **22/22 PASS**, RC=0 |
| Mutacja: przywrócenie chipa `scope-personal` w Menu 3 | **1/1 RED**, RC=1 |
| Powrót po mutacji | **22/22 PASS**, RC=0 |
| `scripts/check-list-canon.sh` | RC=0; naruszenia **346 → 345**, brak wzrostu |
| ESLint plików TSX paczki | RC=0; 0 błędów, 6 zastanych ostrzeżeń |
| Frontend TypeScript na pierwszym planie | RC=2; **156 → 156** wg rejestru W228; 0 diagnostyk w plikach paczki |
| JSON locale EN/PL | oba parsują się poprawnie |
| `git diff --check` | RC=0 |
| Migracje / dane / pliki toru A | **0 / 0 / 0** |

Pełne wyjścia są w `evidence/`. Typecheck nie jest meldowany jako zielony: repo ma 156
zastanych diagnostyk, a ta paczka nie dodaje diagnostyki we własnych plikach.

## Dowód wizualny

Realny `ReportsAndPresentationsHub` został uruchomiony w istniejącym harnessie Day267.
Oba obrazy mają 1440×900, locale EN i otwartą rozwijkę Source. Oględziny potwierdziły:
pełne pięć opcji z licznikami, brak chipów źródeł w Menu 3, brak łamania paska i poprawny
kontrast obu motywów.

- `evidence/tpl1a-v5-source-open-en-light-1440x900.png`

  SHA-256 `c6d655e981854a863f05b6a3dce80cb4c0cdafb888eb9254128cc17c3d4674ca`
- `evidence/tpl1a-v5-source-open-en-dark-1440x900.png`

  SHA-256 `91e3cb69ae29a6cb9eacd87ddd4d70975a2e950391a8e59254933b7c3d526963`

`evidence/visual-capture-metadata.txt` zapisuje URL, viewport, opcje z licznikami
i pomiar `menu3Scopes=0` dla obu motywów.

## Zakres i przegląd

Zmiana dotyka wyłącznie Huba Materiałów, jego kontraktu i dwóch plików locale. Nie zmienia
`artifactNavigation.ts`, `OutputsAggregateTabContent.tsx` ani `artifactRegistryService.ts`.
Przegląd końcowy nie wykazał otwartego defektu w zakresie DEC-631.

## v5b — Wpis 235 i dług D-95

- Zaktualizowano stary kontrakt DEC-423: trzeci kanoniczny `Menu2PresetDropdown`
  jest filtrem Source wymaganym przez DEC-631 (`toHaveLength(3)`).
- **D-95:** test renderu dokumentu broni wszystkich włączonych bloków i ich kolejności;
  dodatkowy guard wiąże canvas Review/Publish z pełną kolekcją `blocks`.
- **D-95:** `BlockCard.navV2.test.tsx` broni jednego aktywnego Regenerate oraz jednego
  kebaba z Configure, AI i Comments.
- Focused GREEN: 3 pliki / 7 testów PASS; ESLint nowych i zmienionych testów/kontraktu: 0 błędów; `git diff --check`: PASS.
- Mutacje: licznik dropdownów 3→2 = RED; Publish `blocks.slice(0, 1)` = RED; usunięcie Comments z kebaba = RED (każda RC=1).
- Zgodnie z Wpisem 235 nie powtarzano odbioru wizualnego ani wcześniejszych pomiarów.
