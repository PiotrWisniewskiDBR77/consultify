# P4 — kody techniczne poza UI

Punkt odniesienia PRZED: `210ec9dbc3afabd98e1fc81ccb3c8d4c6936a0ba` (`origin/staging` pobrany przed utworzeniem worktree). Pomiar PO: HEAD gałęzi `codex/p4-kody` wraz z końcowym commitem dowodowym.

## Słowniki SSOT

| Słownik | Liczba wartości | Polski fallback |
|---|---:|---|
| `src/labels/ideaSourceLabels.ts` | 2 | Nieznane źródło |
| `src/labels/interviewCategoryLabels.ts` | 13 | Inna kategoria |
| `src/labels/capacityUnitLabels.ts` | 4 | nieznana jednostka |
| `src/labels/fileFormatLabels.ts` | 5 | — |
| `src/services/api/errorMessageMapper.ts` | 3 kody | Nie udało się wykonać operacji. |

Wartości polskie w słownikach nie zawierają angielskich surowych wartości domenowych. Skróty formatów plików (`DOCX`, `PDF`, `XLSX`, `PPTX`) pozostają nazwami formatów, nie surowymi enumami prezentowanymi zamiast etykiety.

## Liczby PRZED / PO

| Obszar | PRZED | PO |
|---|---:|---:|
| `String(idea.sourceType)` w UI pomysłu | 1 | 0 |
| Ścieżki renderujące kategorię Interview przez normalizator | 0 | 7 |
| Ścieżki renderujące jednostkę okresu przez słownik | 0 | 5 |
| Ścieżki renderujące/filtrujące format materiału przez słownik | 0 | 4 |
| Wystąpienia `shortKpiScorecardId` w module kart KPI | 10 | 0 |
| Polskie komunikaty OKR ujawniające `kod serwera:` lub nazwę funkcji | 3 | 0 |
| Ekrany z UUID / `Unknown` / `manual` / nazwą funkcji serwera w tekście `body` | nie mierzono | 0/7 |
| Ekrany z błędami konsoli | nie mierzono | 0/7 |

Identyfikatory członków i encji są rozwiązywane przez `useOrganizationMemberNames` oraz `useResultsEntityNames`. Brak nazwy kończy się bezpieczną etykietą, a nie skróconym UUID. Kod błędu jest dostępny tylko jako diagnostyczny `title`; tekst dla użytkownika jest lokalizowany przez jeden mapper.

## Dowód siedmiu ekranów

Każdy plik JSON powstał przez `scripts/dev/odbior-zywo/zrzut.mjs --dom=body`, zawiera pełne `tekst` oraz `bledyKonsoli`.

| # | Ekran | JSON | Błędy konsoli | UUID / `Unknown` / `manual` / funkcja serwera |
|---:|---|---|---:|---:|
| 1 | Pomysły — podgląd | `01-pomysly.png.json` | 0 | 0 |
| 2 | Wywiad | `02-wywiad.png.json` | 0 | 0 |
| 3 | Realizacja — Obciążenie | `03-realizacja.png.json` | 0 | 0 |
| 4 | Materiały — rejestr | `04-materialy.png.json` | 0 | 0 |
| 5 | KPI — zestawienia | `05-kpi-zestawienia.png.json` | 0 | 0 |
| 6 | KPI — nowe zestawienie | `06-kpi-nowe-zestawienie.png.json` | 0 | 0 |
| 7 | OKR — blokada edycji | `07-okr-blokada.png.json` | 0 | 0 |

Na ekranie 7 widoczny jest komunikat: „Cele i Kluczowe Rezultaty można dodawać i edytować tylko, gdy zestaw OKR ma status „Szkic” lub „Wymaga poprawek”.” Nie zawiera kodu serwera ani nazwy funkcji.

## Strażnik i mutacje RED → GREEN

`tests/unit/ui/noRawTechnicalValues.test.ts` kontroluje siedem reprezentatywnych tekstów ekranów oraz zabrania bezpośredniego renderowania pól identyfikatorów w presenterze i modalu KPI.

Wykonane pojedyncze mutacje, każdorazowo przywrócone po uzyskaniu RED:

- usunięcie mapowania `manual`;
- usunięcie mapowania `commercial`;
- usunięcie mapowań `MONTH` i `UNKNOWN` formatu;
- przywrócenie surowego `row.addedBy`;
- usunięcie mapowania `SET_NOT_EDITABLE`;
- bezpośrednie wyrenderowanie `row.ownerId`.

Każda mutacja złamała właściwy test; po przywróceniu test przeszedł GREEN.

## Zakres i ograniczenia

Finanse oraz słownik statusów raportów pozostają poza zakresem P4 zgodnie z instrukcją. Pełny `npm run type-check` nadal raportuje 96 odziedziczonych błędów na bazie; filtrowanie wyjścia po plikach zmienionych w P4 nie wykazało błędu P4. Nie użyto `git stash`, `--no-verify` ani push.
