---
doc_id: funkcje-znalezisko-martwy-katalog-migracji
status: canonical
owner: piotr
truth_type: runtime
established: 2026-09-01
---

# SZÓSTY kłamiący dokument — i tym razem kłamie README, które kieruje ludzi w ślepy zaułek

## Co mówi dokument
`server/migrations/README.md`, dwa pierwsze wiersze:
> **„DEPRECATED - Migrations moved. New migrations live in `server/migrations-v2/`."**

Drugi README w archiwum mówi to samo. Oba datowane 15.04.

## Co mówi kod — zmierzone
- **Katalog `server/migrations-v2/` jest wykluczony z wdrożenia.** `.railwayignore:96-97`
  wyklucza go w całości. **Nic z niego nigdy nie trafia na serwer.**
- Realnie uruchamiany mechanizm migracji czyta `server/migrations/` — czyli **dokładnie ten
  katalog, którego README twierdzi, że jest porzucony.**

**Czyli README kieruje każdego, kto go przeczyta, do katalogu, który nigdy się nie wykonuje.**
Nowa migracja napisana zgodnie z tą instrukcją **nie zadziałałaby nigdzie** — ani lokalnie,
ani na demo, ani na produkcji. **I nie byłoby żadnego błędu; po prostu nic by się nie stało.**

To jest **szósty potwierdzony przypadek** dokumentu lub komentarza, który kłamie o kodzie —
i **pierwszy, który mógłby kosztować cały dyżur zmarnowanej pracy bez żadnego sygnału ostrzegawczego.**

## ★ SPROSTOWANIE do raportu, który to znalazł
Autor napisał, że tabele dowodów oceny **istnieją wyłącznie** w martwym katalogu, więc
**mogą nie istnieć** na poprawnie zbudowanej bazie, mimo że kod produkcyjny je odpytuje.

**Sprawdziłem — to jest nieprawda.** `assessment_evidence` jest zdefiniowana także
w **kanonicznych** migracjach: `20260719_baseline_gap.sql` i
`20260801_asm005_007_evidence_quality_output.sql`. Tabele najprawdopodobniej **istnieją**.

**To już trzeci raz dzisiaj, kiedy raport podaje jako fakt coś, czego nie ma:**
powołanie na nieistniejący plik (panele finansowe) · rzekomo brakująca zależność, która była
zadeklarowana · a teraz „tabele tylko w martwym katalogu". **Wszystkie trzy wyszły dopiero
przy sprawdzeniu, żaden nie został wyłapany przez autora.**

## Rzecz, którą znalazłem przy sprawdzaniu, i która jest ciekawsza od samego sprostowania
`AssessmentController.ts:1486` zawiera komentarz:
> `/* assessment_evidence table may not exist */`

**Kod sam się asekuruje na wypadek, że tabeli nie ma.** Czyli ktoś kiedyś miał ten sam
niepokój — i zamiast go rozstrzygnąć, **obudował go obejściem**. To jest ślad po
niepewności, która nigdy nie została domknięta, i dokładnie taką rzecz ma zmierzyć
dyżur 240 na bazie zbudowanej od zera.

## Zadania
1. **Usunąć albo poprawić oba README** — dziś aktywnie szkodzą. To zmiana na kilka minut
   i powinna wejść przy najbliższej okazji.
2. **Rozstrzygnąć los katalogu `migrations-v2`**: skasować albo oznaczyć w środku, że jest
   wykluczony z wdrożenia. Katalog, który wygląda na żywy, a nigdy się nie wykonuje,
   jest pułapką dla każdego nowego wykonawcy.
3. **Dyżur 240 ma zmierzyć na bazie od zera**, które tabele oceny realnie powstają —
   i czy asekuracja z komentarza wyżej jest dziś potrzebna, czy jest zabytkiem.
