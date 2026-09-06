# Wniosek

> Runda 2: poniższa tabela rundy 1 zostaje jako baseline. Uzupełnienie pochodzi z pełnego raportu K1 scalonego w `K1_WNIOSKI_INICJATYWY_RAPORT.md`; nie zastępuje wcześniejszych wierszy.

Raportu K1 nie było na bazowym `origin/staging`; karta została zinwentaryzowana samodzielnie. Brak realnego rekordu (zrzut listy: `evidence/p10-karty-n/interview/interview-loaded.png`).

| sekcja | kontrakt mówi (plik:linia / „brak kontraktu”) | ekran pokazuje (plik:linia + zrzut) | źródło danych (API pole → writer server/src plik:linia / „MARTWE: brak writera”) | rozjazd | waga |
|---|---|---|---|---|---|
| Rezultaty | `insightCardContract.ts:110-128` | `InsightViewer.tsx`; brak dowodu runtime | artifact actions → writer handoffów | brak | kosmetyka |
| Podsumowanie | `insightCardContract.ts:129-146` | jw. | content/materialization → `InterviewInsightService.ts:2223-2700` | brak | kosmetyka |
| Odczyt konsultingowy | `insightCardContract.ts:147-164` | jw. | content → `InterviewInsightService.ts` | brak | kosmetyka |
| Tematy–Jakość i zaufanie (18 sekcji) | `insightCardContract.ts:165-515` | jw.; brak rekordu | content JSON → `InterviewInsightService.ts:2223-2700` | brak | kosmetyka |
| Kluczowe wnioski–Narracja konsultingowa (10 sekcji) | `insightCardContract.ts:529-700` | jw.; brak rekordu | content JSON → `InterviewInsightService.ts` | brak | kosmetyka |

## Uzupełnienie K1 po scaleniu

| sekcja / pole | kontrakt mówi | ekran pokazuje | źródło danych | rozjazd | waga |
|---|---|---|---|---|---|
| Rezultaty (`artifact-actions`) | rdzeń lewej kolumny | przeniesione do prawego panelu „Rezultaty” | akcje artefaktu w `InsightViewer.tsx` | sekcja poza kontraktem | kosmetyka |
| Executive memo | usunięte z `INSIGHT_CARDS` po deduplikacji | nadal renderowane przez `INSIGHT_SECTIONS` | content JSON → `InterviewInsightService.ts` | sekcja poza kontraktem | kosmetyka |
| Rekomendacje | usunięte z `INSIGHT_CARDS` po deduplikacji | nadal renderowane przez `INSIGHT_SECTIONS` | content JSON → `InterviewInsightService.ts` | sekcja poza kontraktem | kosmetyka |
| Pytanie przewodnie | brak sekcji wyniku | nieobecne na karcie | `leading_question` zapisuje i podaje do promptu `InterviewInsightService.ts` | sekcja z kontraktu nieobecna | blokuje MVP |
| Notatka konsultanta | brak sekcji wyniku | nieobecna na karcie | `consultant_note` zapisuje i podaje do promptu `InterviewInsightService.ts` | sekcja z kontraktu nieobecna | blokuje MVP |

Dowód runtime K1 wskazuje realny rekord `seed_ii_..._bottleneck`; runda 2 powtarza odbiór na własnym Vite i nie uznaje samych ścieżek źródłowych za dowód zachowania.
