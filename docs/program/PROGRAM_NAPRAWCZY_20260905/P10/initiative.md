# Inicjatywa

> Runda 2: poniższa tabela rundy 1 zostaje jako baseline. Uzupełnienie pochodzi z pełnego raportu K1 scalonego w `K1_WNIOSKI_INICJATYWY_RAPORT.md`; nie zastępuje wcześniejszych wierszy.

Raportu K1 nie było na bazowym `origin/staging`; karta została zinwentaryzowana samodzielnie. Zrzut: `evidence/p10-karty-n/initiative/initiative-loaded.png`; hub pozostał na „Ładowanie narzędzi…”.

| sekcja | kontrakt mówi (plik:linia / „brak kontraktu”) | ekran pokazuje (plik:linia + zrzut) | źródło danych (API pole → writer server/src plik:linia / „MARTWE: brak writera”) | rozjazd | waga |
|---|---|---|---|---|---|
| Przegląd–Pilotaż (14 sekcji) | `initiativeCardContract.ts:64-340` | `InitiativeDocumentView.tsx`; brak dowodu runtime | profil/sekcje → `server/src/services/initiative/*` | brak | kosmetyka |
| Komentarze, Historia aktywności | `initiativeCardContract.ts:341-383` | jw. | komentarze/log zdarzeń → serwisy Initiative | brak | kosmetyka |
| Sterowanie–Wnioski i lekcje (20 sekcji) | `initiativeCardContract.ts:384-742` | jw.; brak rekordu | sekcje Initiative → serwisy/repozytoria Initiative | brak | kosmetyka |

## Uzupełnienie K1 po scaleniu

| sekcja / pole | kontrakt mówi | ekran pokazuje | źródło danych | rozjazd | waga |
|---|---|---|---|---|---|
| Zakres inicjatywy | `overview` + `problemDefinition` osobno | jedna scalona sekcja `initiative-definition` | dane profilu inicjatywy | kolejność inna | kosmetyka |
| Stan docelowy / Zakres | dwie karty `targetState` + `scope` | jedna sekcja `target-state-scope` pod etykietą „Kryteria sukcesu” | sekcje inicjatywy | etykieta inna | blokuje MVP |
| Wymagania kompetencyjne | karta `competencyRequirements` z promptem | brak renderu w `InitiativeDocumentView` | route `skills-gap.routes.ts` + `skillsGapService.ts` | sekcja z kontraktu nieobecna | blokuje MVP |
| Luka kompetencyjna | karta `skillsGap` z promptem | osierocony `SkillsGapSection.tsx`, zero importów | route `skills-gap.routes.ts` + `skillsGapService.ts` | sekcja z kontraktu nieobecna | blokuje MVP |
| RACI | alias `governance` → `raci` | osobna pozycja „RACI” | sekcja inicjatywy | brak | kosmetyka |

Dowód runtime K1 wskazuje realny rekord „Supply Chain Optimization”; runda 2 powtarza odbiór na własnym Vite i nie uznaje samego komponentu osieroconego za render.
