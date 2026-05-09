# Instrukcja kontraktu — katalog modułów

Cel: zamieniać surowe wymagania autora na **powtarzalną, transparentną dokumentację modułową**.

Ta instrukcja definiuje, jak układamy wiedzę w `DRD/consultify/docs/modules/NN_<slug>/`.

## 1) Zasada pracy

- Ty wrzucasz surowe notatki/wymagania.
- Ja przepisuję je do formatu kontraktowego.
- Każdy moduł ma ten sam układ plików i te same sekcje.
- Każda zmiana zachowania modułu trafia do `CHANGELOG.md` modułu.

## 2) Obowiązkowy układ każdego modułu

W każdym folderze `NN_<slug>/` utrzymujemy:

- `README.md` (entrypoint, skrót + linki — nie duplikuje kontraktu)
- `SSOT.md` (priorytet źródeł + linki)
- `CODEMAP.md` (route, komponenty, backend)
- `STATUS.md` (shipped/wkrótce + ryzyka)
- `00_META.md`
- `01_PURPOSE.md`
- `02_SCOPE.md`
- `03_BEHAVIOR.md`
- `04_UI_UX.md`
- `05_DATA_AND_INTEGRATIONS.md`
- `06_PERMISSIONS_AND_SECURITY.md`
- `07_ACCEPTANCE_AND_TESTS.md`
- `CHANGELOG.md`
- `RAW_INPUT.md` (Twoje surowe notatki, bez redakcji)

### Zasada anty-duplikacji

- `README.md` / `STATUS.md` mogą streszczać kontrakt, ale **nie mogą** być miejscem, gdzie definiujemy nowe wymagania.
- Nowe wymagania zawsze lądują w `RAW_INPUT.md`, a ich kanoniczna forma trafia do `00-07`.

## 3) Kolejność przetwarzania informacji

Gdy dodajesz nowe wymaganie:

1. Dopisujemy je do `RAW_INPUT.md` z datą.
2. Klasyfikujemy: `behavior`, `ui`, `data`, `permissions`, `workflow`, `copy`.
3. Przepisujemy do właściwego pliku kontraktowego (`03-07`).
4. Dodajemy wpis do `CHANGELOG.md` (co się zmieniło i dlaczego).
5. Aktualizujemy `07_ACCEPTANCE_AND_TESTS.md` (jak sprawdzić zmianę).

## 4) Reguły redakcyjne (muszą być stałe)

- Używamy języka normatywnego: `MUST`, `MUST NOT`, `SHOULD`.
- Każdy wymóg ma **jednoznaczny efekt** (co user widzi / co system robi).
- Nie mieszamy “jak ma działać” z “jak to zakodować”.
- Gdy coś jest niepewne, zapisujemy jako `OPEN_QUESTION` (max 3 na plik).
- Jeśli coś jest wyłączone z zakresu, zapisujemy to jawnie w `02_SCOPE.md`.

## 5) Minimalny front-matter każdego pliku

```md
---
module_id: MODULE_<NAME>
doc_kind: <META|PURPOSE|SCOPE|BEHAVIOR|UI_UX|DATA|PERMISSIONS|TESTS>
version: 1.0
owner: user
status: canonical
last_updated: YYYY-MM-DD
---
```

## 6) Wymagany format sekcji

Każdy plik kontraktowy (`01-07`) powinien mieć:

- `## Purpose`
- `## Must`
- `## Must Not`
- `## Should`
- `## Acceptance Criteria`
- `## Related Sources`

## 7) Jak wrzucać surowe wymagania (Twoja część)

W `RAW_INPUT.md` używaj prostego bloku:

```md
## 2026-05-09

### Context
<co zmieniamy i dlaczego>

### Raw requirement
<swobodny opis>

### Priority
<P0/P1/P2/P3>
```

## 8) Jak ja to transformuję (moja część)

Z każdego wpisu `RAW_INPUT.md` robię:

- zwięzłe wymaganie kontraktowe,
- przypisanie do pliku docelowego (`03-07`),
- kryterium akceptacji testowalne,
- wpis do `CHANGELOG.md`.

## 9) Definicja “transparentnej dokumentacji”

Dokumentacja jest transparentna, gdy:

- wiadomo co jest wymaganiem autora, a co interpretacją,
- wiadomo kiedy i dlaczego coś zmieniono,
- da się sprawdzić wymaganie testem,
- widać co jest poza zakresem.

