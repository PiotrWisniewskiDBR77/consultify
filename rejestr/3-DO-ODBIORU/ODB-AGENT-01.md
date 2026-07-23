---
id: ODB-AGENT-01
tytul: Agent — generator procesu: gotowy schemat klasyczny 5-fazowy (przestawialny) + start z pustego
typ: odbior-wizualny
waga: wysoka
obszar: AGT
stan: do-odbioru
wlasciciel: piotr
partia: 2026-07-23
narzedzie: Agent (generator procesu)
flaga: ff_agentPlan (istniejąca, ON)
zrzut: rejestr/_zrzuty/ODB-AGENT-01.png
zrzut_dark: rejestr/_zrzuty/ODB-AGENT-01-dark.png
utworzone: 2026-07-23
---

## 1. CO SIĘ ZMIENIŁO

„Run agent" przestał być katalogiem 31 gotowych analiz — stał się **generatorem procesu**. Dwie ścieżki na jednym ekranie:
- **① AI proponuje** — agent kładzie gotowy **klasyczny 5-fazowy proces konsultingowy** (Kubr/ILO): Wejście/Kontraktowanie → Diagnoza → Rekomendacje → Wdrożenie → Zamknięcie. Każdy klocek ma typ, strzałki do przestawiania i kosz.
- **② Ręcznie z klocków** — pusty schemat, budujesz od zera.

Plan **czeka na „Uruchom"** — nie startuje sam (wcześniej dispatchował się natychmiast, więc nie było kiedy go edytować). Domyślny proces ma **dwie bramki akceptu**: Rekomendacje i Zamknięcie (decyzja z 23.07). DRD 4-krokowy został jako wariant w bibliotece.

## 2. NA CO PATRZEĆ

Czy pięć faz to właściwy domyślny proces dla nowego projektu? Czy nazwy faz brzmią jak język konsultanta? Czy przestawianie **strzałkami** wystarcza (świadomie zamiast drag&drop — brak biblioteki, pełna obsługa klawiaturą), czy chcesz przeciąganie?

## 3. RYZYKO / ZNANE OGRANICZENIA

- **Zakładki Vault i Agent w My Work NIE są na zrzucie** — ekran My Work nie montuje się w harnessie bez backendu i danych. To jedyny element wdrożony bez wcześniejszego zrzutu; wymaga sprawdzenia na żywym demo (jest już wdrożony).
- **Nowo dodany klocek jest „uboższy"** — dostaje domyślne narzędzie; przestawianie i usuwanie istniejących zachowuje pełne parametry. Bogatszy model klocka = AGT-008, zaplanowane po tym odbiorze (Twoja decyzja).
- Punkt wejścia generatora w UI musi wołać tryb „draft", żeby plan trafił w edytowalny stan — dla ścieżki `processId` jest to już domyślne.

## 4. JAK ZWERYFIKOWANO

Harness Playwright (dev-render, mock, bez logowania), light+dark, zero błędów konsoli. **57/57 testów** na scalonej bazie: generator zwraca 5 faz w kolejności z modułami i produktami, plan zostaje w stanie edycji do „Uruchom", przestawione kroki zapisują się, dwie bramki akceptu. Wdrożone na demo (`7b1ba021c2`, health OK).
