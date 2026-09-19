# D-120 KROK 0 — `reportLocale.resources.test.ts` 43 vs 42: pomiar premisy

Data: 2026-09-19 CDT · Stanowisko C (Qoder) · Linia: `2bdf2c4076` (okno 15)
Zlecenie: DLUG-PO-MVP.md D-120 (P2, przyrząd, rodzina D-118) — „reportLocale.resources.test.ts
CZERWONY na linii: 43 klucze vs oczekiwane 42; nowy klucz `executionReports.workAnalysis.emptySnapshot`
z `3ca97b51f8` (Codex). Zaktualizować oczekiwanie z adresem commitu."

## Werdykt KROK 0: premisa NIEPEŁNA — „zaktualizować oczekiwanie" (sam count) NIE zazielenia testu

Test czerwony, klucz z `3ca97b51f8`, count 43 vs 42 — TE trzy faktu są PRAWDA. Ale przepisana
naprawa („update expectation") jest NIEWYSTARCZALNA: klucz nie ma lustra w frontendowym
`public/locales/{en,pl}/translation.json`, więc podbicie samej liczby zostawia test CZERWONY na
DWÓCH asercjach. Wymagana decyzja CTO (opcja A vs B niżej).

## Pomiar 1 — stan zastany (HEAD `2bdf2c4076`, bez zmian)

`npx vitest run server/src/services/report/__tests__/reportLocale.resources.test.ts --retry=0`
→ **2 failed**:
- `toHaveLength(42)`: „expected [ …(43) ] to have a length of 42 but got 43" (linia 32).
- identical-list (linia 51): „expected [ 'executionReports.kpi', …(3) ] to deeply equal
  [ 'executionReports.kpi', …(2) ]" — actual 4 elementy, oczekiwane 3.

## Pomiar 2 — mutacja „tylko count" (dowód, że przepisana naprawa nie działa)

Tymczasowo `toHaveLength(42)` → `toHaveLength(43)` (jedyna zmiana), run → **NADAL 2 failed**:
- `missing EN resource: executionReports.workAnalysis.emptySnapshot: expected undefined to deeply equal Any<String>` (linia 38).
- identical-list: nadal 4 vs 3 — bo klucz BEZ lustra daje `readKey(en)===readKey(pl)` →
  `undefined===undefined` → `true`, więc wpada do listy „identical" (fałszywy pozytyw).

Cofnięte (`git diff` pusty) — pomiar, nie naprawa.

## Przyczyna źródłowa (plik:linia)

- `3ca97b51f8` („[ODMROŻENIE 06_EXECUTION DEC-607] Align execution work task source", Codex/Piotr,
  17.09) dodał klucz do SERWEROWEGO rejestru `server/src/services/report/reportLocale.ts:34-37`:
  ```
  'executionReports.workAnalysis.emptySnapshot': {
    en: 'The analysis was not saved because Consultify found work records but could not assemble a report snapshot. Refresh the Work tab and try again.',
    pl: 'Analiza nie została zapisana, ponieważ Consultify znalazł zadania, ale nie złożył migawki raportu. Odśwież zakładkę Praca i spróbuj ponownie.',
  },
  ```
  `REPORT_MESSAGE_KEYS = Object.keys(MESSAGES)` (reportLocale.ts:112) → 42 → **43**.
- Commit NIE dodał lustra w `public/locales/{en,pl}/translation.json`:
  `t.executionReports.workAnalysis` = `undefined` (EN i PL), brak też płaskiego klucza
  `'executionReports.workAnalysis.emptySnapshot'` (top-level keys z `workAnalysis` = `[]`).
- Test (`reportLocale.resources.test.ts:10-14,35-36`) czyta LUSTRO z frontendowego
  `public/locales/{locale}/translation.json` i wymaga, by KAŻDY serwerowy klucz raportu był tam
  opublikowany jako niepusty EN+PL string z zgodnymi placeholderami. Konwencja dotyczy 42/43
  istniejących kluczy, np. `executionReports.kpi`="KPI", `executionReports.level.PMO`="PMO"
  (obecne w translation.json, choć frontend ich nie woła przez `t()` bezpośrednio).
- Osobny fakt: frontend renderuje analizę pracy przez INNĄ przestrzeń nazw —
  `t('execution.workAnalysis.*')` (`src/components/Execution/reports-intelligence/WorkIntelligenceReport.tsx:358,364,372,449,454,459,489,495`),
  NIE `executionReports.workAnalysis.*`. Czyli nowy klucz serwera może być treścią wyłącznie
  raportu (server-side), bez odpowiednika w UI.

## Dwie uczciwe naprawy — DECYZJA CTO

**Opcja A — przywróć konwencję lustra (rekomendowana, mechaniczna):**
dodaj `executionReports.workAnalysis.emptySnapshot` do `public/locales/en/translation.json` i
`public/locales/pl/translation.json` (stringi JUŻ istnieją i są zatwierdzone w
`reportLocale.ts:35-36` — przepisac 1:1) + podbij `toHaveLength(42)`→`43`.
- Wtedy: count 43 ✓; zasoby obecne, niepuste ✓; placeholdery EN/PL = `[]`==`[]` ✓;
  identical-list ZOSTAJE 3 (en≠pl, więc klucz NIE jest „identical") — asercja 2 self-corrects,
  bez zmiany jej literału.
- Zakres: `public/locales/{en,pl}/translation.json` (frontend i18n) + plik testu. Dotyka
  zamrożonego `06_EXECUTION` (DEC-607) i współdzielonego i18n; wpływa na bramkę językową
  (`check:jezyk`) i parzystość kluczy en/pl. Marker: `[ODMROŻENIE 06_EXECUTION DEC-607]`
  (jak commit źródłowy) lub `WSPOLNE` dla translation.json — do potwierdzenia przez CTO.
- Ryzyko: jeśli klucz jest celowo server-only, dodanie lustra publikuje w i18n zasób, którego
  UI nigdy nie renderuje (ale 42 rodzeństwa już tak ma — konwencja).

**Opcja B — klucz server-only, test za szeroki:**
jeśli `executionReports.workAnalysis.emptySnapshot` ma być TREŚCIĄ RAPORTU bez lustra w UI
(frontend i tak używa `execution.workAnalysis.*`), to asercja „każdy klucz serwera musi być w
translation.json" jest za szeroka dla kluczy server-only. Naprawa = zmiana DESIGNU testu
(wyklucz klucze server-only jawną listą, albo przenieś klucz poza `REPORT_MESSAGE_KEYS`),
NIE product change w i18n. To decyzja architektoniczna — wymaga CTO.

## Rekomendacja

Opcja A: 42/43 rodzeństwa przestrzega konwencji lustra, stringi są już zatwierdzone w
`reportLocale.ts`, a naprawa jest mechaniczna i zazielenia obie asercje (identical-list sama się
koryguje, bo en≠pl). Opcja B tylko, gdy CTO potwierdzi, że klucz jest świadomie server-only.

## ROZSTRZYGNIĘCIE — Wpis 217 (CTO, 2026-09-19 04:12 CDT): opcja A, NIE STOP

CTO domknął decyzję A-vs-B regułą: „oczekiwanie testu `reportLocale.resources` z ADRESEM commitu
`3ca97b51f8` i klucza, nie »dopasować liczbę«; **jeśli klucz bez pary PL/EN → STOP**". Klucz
`executionReports.workAnalysis.emptySnapshot` MA parę PL/EN (`reportLocale.ts:35-36`) → gałąź STOP
NIE zachodzi → wykonana opcja A (przywrócenie konwencji lustra), zgodnie z rekomendacją powyżej.

Dostarczona naprawa (3 pliki):
- `public/locales/en/translation.json`: pod TOP-LEVEL `executionReports` (ścieżka, którą czyta test)
  dodany obiekt `workAnalysis` z liściem `emptySnapshot` (string 1:1 z `reportLocale.ts:35`),
  bezpośrednio po `noKpiResults`. UWAGA: istniejący `workAnalysis` UI (linia ~18673) żyje pod INNĄ
  przestrzenią (`execution.workAnalysis.*`, zob. Pomiar przyczyny 51-54) — lustro konwencyjne trafiło
  więc do `executionReports.workAnalysis`, tak jak 42 rodzeństwa (`executionReports.kpi` itp.).
- `public/locales/pl/translation.json`: to samo, string 1:1 z `reportLocale.ts:36`, po `noKpiResults`.
- `reportLocale.resources.test.ts`: oczekiwanie z adresem commitu i kluczem, NIE sama liczba —
  `toContain('executionReports.workAnalysis.emptySnapshot')` + `toHaveLength(43)` + komentarz z SHA
  `3ca97b51f8`. Identical-list (asercja 2) self-corrects: en≠pl, więc klucz nie jest „identical"
  (zostaje 3), bez zmiany jej literału.

Wynik: `npx vitest run …reportLocale.resources.test.ts --retry=0` → **2 passed (2)** (baseline: 2 failed).

Dowody mutacyjne (cofnij naprawę → RED → przywróć):
- Mutacja A — odpublikuj lustro EN (rename liścia `emptySnapshot`→`emptySnapshotMUTANT`): RED
  „missing EN resource: executionReports.workAnalysis.emptySnapshot: expected undefined to deeply
  equal Any<String>". Przywrócone, JSON valid.
- Mutacja B — cofnij strażnik count (`toContain`+`43` → samo `toHaveLength(42)`): RED „expected
  [ …(43) ] to have a length of 42 but got 43". Przywrócone.

## Stan drzewa (po dostawie)

Gałąź `qoder/c-d120-reportlocale-keys-20260919` od `2bdf2c4076` (okno 15). Zmiana produktu:
2× `public/locales/{en,pl}/translation.json` (+3 linie każdy, własny klucz D-120) + 1 plik testu
(+8/-1). Ten plik evidence = rekord KROK 0 + rozstrzygnięcie. Zero migracji, zero zapisu do bazy,
kontenerów nie uruchamiałem.
