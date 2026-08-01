---
packet_id: WK-P0-015
module: cross-cutting
priority: P0
status: READY_AFTER_BASELINE
owner: codex
implementer: claude
last_reviewed: 2026-07-30
---

# WK-P0-015 — wykonawcza mapa fragmentów

## Problem

Repo zawiera równoległe widoki, aliasy, fallbacki oraz backend i frontend o
różnym poziomie ukończenia. Brak jednej mapy powoduje dokładanie nowych wersji
zamiast scalania.

## Oczekiwany rezultat

Powstaje generowany i ręcznie zweryfikowany wykaz dla 16 pozycji menu,
łączący wejście, frontend, API, guard, service, dane, flagę, test i decyzję o
losie alternatywnych implementacji.

## Zakres

- przeanalizować `routeConfig.ts`, `AppRoutes.tsx` i sidebar;
- wykryć komponenty montowane oraz importowane wyłącznie jako redirect/legacy;
- zmapować wywołania API i trasy backendu;
- wskazać auth/org/capability guard;
- wskazać owner service i encje;
- znaleźć testy i feature flags;
- sklasyfikować fragmenty zgodnie z `INTEGRATION_CONSOLIDATION_PROGRAM.md`;
- przygotować priorytety pionowych slice’ów.

## Poza zakresem

- implementowanie brakujących części;
- usuwanie legacy;
- zmiana routingu;
- zmiana modelu danych;
- automatyczne uznawanie nieużywanego importu za martwy kod.

## Format rekordu

| Pole | Wartość |
| --- | --- |
| module/function ID | |
| canonical route | |
| mounted UI | |
| alternate UI | |
| API | |
| backend guard | |
| owner service | |
| tables/entities | |
| flags | |
| tests | |
| fragment class | |
| decision proposal | |
| confidence/evidence | |

## Kryteria akceptacji

1. 16/16 pozycji menu ma przynajmniej rekord poziomu modułu.
2. Wszystkie P0 boardu mają rekord funkcji.
3. Każde `PARALLEL` wskazuje co najmniej dwie konkretne implementacje.
4. Każde `BACKEND_ONLY` i `UI_ONLY` ma dowód.
5. Lista nie zmienia kodu produktu.
6. Codex ręcznie weryfikuje wszystkie rekomendacje P0.

## Raport implementatora

Claude zwraca wygenerowany artefakt, użyte reguły, ograniczenia skanu,
nierozstrzygnięte dopasowania i propozycję pierwszych trzech pionowych slice’ów.
