---
doc_id: funkcje-bramki-partia-2
status: canonical
owner: piotr
truth_type: status
established: 2026-08-31
---

# Bramki — partia 2 (pozycje 6-10 z 34)

Kontynuacja programu z FIX-212. Reguła: *zabezpieczenie bez testu, który
czerwienieje po jego usunięciu, jest nieudowodnione.*

| # | bramka | co przecieka po złamaniu | GREEN → RED |
| --- | --- | --- | --- |
| 6 | `ai/agent-plan.routes.ts:206` `assertPlanInOrg` | cały plan agenta obcej organizacji (kroki, wejścia narzędzi) do odczytu **i zapisu** | 3/3 → 2 failed |
| 7 | `ideaBusinessCase.routes.ts:89` `assertIdeaInOrg` | odczyt i **nadpisanie** business case'u (liczby inwestycyjne) | 3/3 → 3/3 failed |
| 8 | `ideaFinancialCase.routes.ts:104` `assertIdeaInOrg` | odczyt i **nadpisanie** modelu finansowego (waluta, stopa dyskonta, szeregi) | 3/3 → 3/3 failed |
| 9 | `initiativeClosureService.ts:234` `assertInitiativeInOrg` | **zapis** — otwarcie workflow zamknięcia cudzej inicjatywy | 2/2 → 1 failed |
| 10 | `canvasMaterialize.ts:116` `assertOrgScopedReferences` | **zapis** decyzji/zadania wskazującego projekt obcej organizacji | 2/2 → 1 failed |

Wszystkie testy przez realną warstwę: cztery przez HTTP z realnym tokenem, jeden
przez bezpośrednie wywołanie serwisu (uzasadnione — otaczająca trasa ma dodatkowe,
niezwiązane bramki uprawnień). Zero atrap. Realny Postgres, pełny łańcuch migracji.

## ★ Znalezisko: złamanie bramki może TRWALE PORWAĆ zasób właścicielowi

Pozycje 7 i 8: po usunięciu bramki trasy czerwienieją **wszystkie trzy** testy, nie
tylko dwa „atakowe". Przyczyna udokumentowana w kodzie: obie trasy mają drugi
strażnik na poziomie usługi. Gdy bramka trasy jest wyłączona, fałszywy zapis obcej
organizacji trafia do bazy jako wiersz oznaczony **jej** identyfikatorem pod cudzym
zasobem — a następny, **legalny** zapis prawdziwego właściciela dostaje odmowę, bo
drugi strażnik widzi wiersz obcej organizacji.

Czyli obejście tej bramki nie tylko ujawnia dane: **odbiera właścicielowi dostęp do
własnego zasobu na stałe.** Zgłoszone, świadomie niezałatane (dyżur dokłada dowody,
nie zmienia zachowania).

## Trzy pozycje ODRZUCONE po weryfikacji — i to jest dobra robota

Wykonawca nie dopchał liczby do pięciu na siłę, tylko sprawdził i odrzucił:
- `handlerHelpers.ts:29` — **redundantna**: zewnętrzna bramka w tym samym routerze
  blokuje wcześniej identycznym zapytaniem, więc test nie zaczerwieniłby się;
- `governedRetrievalService.ts:741` — **to nie jest granica dzierżawy**, tylko czysta
  funkcja przepisująca identyfikator; realną granicą jest kontrola dostępu niżej;
- `workspaceCrossModuleService.ts:137` — funkcje zapisujące **nie mają dziś żadnego
  wołacza** w trasach; złamanie nie ma realnego skutku.

Inwentarz 34 pozycji zawierał więc trzy, które nie są zabezpieczeniami. To jest
informacja o samym inwentarzu, warta zapisania: **nazwa `assertXInOrg` nie dowodzi,
że coś jest granicą.**

## Stan programu
**10 z 34 pokrytych.** Zostaje 24 — partiami po pięć.
