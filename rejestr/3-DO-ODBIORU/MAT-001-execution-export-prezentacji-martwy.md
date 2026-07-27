---
id: MAT-001
tytul: Execution „Otwórz kreator prezentacji" gubił treść raportu — naprawione
typ: zadanie
waga: wysoka
obszar: MAT
stan: do-odbioru
wlasciciel: piotr
blokuje: []
zablokowane_przez: []
zrodlo: "Harvard/wdrozenie-100/_PLAN_DOKONCZENIA_MATERIALOW_2026-07-26.md (sekcja DOPISKI), audyt 2026-07-26"
ekran: execution-export-prezentacja
klik: "Zakładka „export" → „Otwórz kreator prezentacji" — ekran sam przejdzie do Prezentacji i auto-startuje generację Z AI z treścią raportu (pipeline celowo zamrożony na mocku, chodzi o start z treścią, nie o wynik generacji)."
wysokosc: 900
utworzone: 2026-07-27
---

# MAT-001 — Eksport raportu Execution do prezentacji: martwa funkcja naprawiona

- **Stan:** DO ODBIORU (2026-07-27)
- **Gałąź:** `fix/execution-export-prezentacje` (baza `origin/demo` = `24e36500cb`), NIE pushowane

## 1. PROBLEM

Przycisk „Otwórz kreator prezentacji" przy raportach Execution
(`ReportCompactPanel.tsx:111`, `ReportDocumentView.tsx:1749`) nawigował do
`/prezentacje?sourceType=execution_report&sourceName=…&content=…`,
ale `PrezentacjeView` NIE czytał żadnego z tych parametrów. Efekt: klik
otwierał goły hub Prezentacji, treść raportu ginęła — martwa funkcja
udająca działającą.

## 2. PRZYCZYNA

Nadawca (Execution) i odbiorca (PrezentacjeView) nigdy nie zostali spięci —
parametry `sourceType/sourceName/content` nie występowały nigdzie po stronie
odbiorcy (potwierdzone grepem na świeżym `origin/demo` 2026-07-27).

## 3. ROZWIĄZANIE

Wariant „podłączyć konsumpcję" (zgodny z tri-mode, preferowany w zgłoszeniu):
`PrezentacjeView` czyta `sourceType=execution_report` + `content` (+opcjonalnie
`sourceName`) i auto-startuje pipeline „Z AI" z promptem zawierającym pełny
markdown raportu — tym samym mechanizmem co istniejący `templatePrompt`
(fire-once ref). Hub (`showHome`), tri-chooser i auto-trigger z czatu dostały
wykluczenie `sourcePrompt`, więc nie ścigają się z nową ścieżką. Bez `content`
zachowanie bez zmian (hub jak dotąd).

Zmiany: `src/components/AIChat/KimiWorkspace/PrezentacjeView.tsx` (+37 linii).
Harness: `dev-render/screens/execution-export-prezentacja.tsx` (2 fazy,
produkcyjny klik → produkcyjny odbiorca).

## 4. KRYTERIUM ODBIORU

Klik „Otwórz kreator prezentacji" przy raporcie Execution → Prezentacje
startują generację Z AI z treścią raportu (a nie goły hub).

## 5. DOWODY

Test z wejścia produkcyjnego (harness `?screen=execution-export-prezentacja`,
realny `ReportCompactPanel` → realny `PrezentacjeView`, klik w realny przycisk):

- Produkcyjny handler wygenerował URL: `…?screen=…&sourceType=execution_report&sourceName=Raport%20tygodniowy%20transformacji&content=%23%20Raport…` (przeniesiony 1:1, nie sfabrykowany).
- `PrezentacjeView` skonsumował parametry i wystartował pipeline: przechwycone `createConversation` → `captureSnapshot` → `createFromChat` z `goal` długości 1262 znaków, zawierającym sekcję raportu „Postęp inicjatyw" (`goalContainsReportSection: true`, zapis w `window.__EXPORT_PREZ_TEST__`).
- UI po kliku = workspace generacji („Wykonywanie zadania… 0/8 · Generowanie… · Tworzenie prezentacji"), NIE hub. Zrzuty: `rejestr/_zrzuty/MAT-001-faza1-panel-export.png`, `MAT-001-faza2-generacja-z-raportu.png`.
- Regresja: `sourceType` bez `content` → hub renderuje się jak dotąd (zrzut `MAT-001-regresja-bez-content-hub.png`).
- Bramki: esbuild 0 błędów, eslint 0 errorów (warningi `any` pre-istniejące) na obu plikach.

## 6. DZIENNIK

**2026-07-27** — potwierdzenie grepem na świeżym `origin/demo` (`24e36500cb`); wybór wariantu „konsumpcja parametrów" (tryb Z AI z prefil-em, zgodnie z preferencją ze zgłoszenia); implementacja + harness 2-fazowy + dowody Playwright; do odbioru.
