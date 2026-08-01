---
doc_id: conceptual-work-protocol
truth_type: product-target
status: canonical
owner: piotr-codex
last_reviewed: 2026-07-30
---

# Proces pracy koncepcyjnej

## Kiedy zatrzymujemy implementację

Narzędzie trafia do `CONCEPT`, gdy:

- nie wiadomo, jaki rezultat ma dać użytkownikowi;
- ekran ma wiele funkcji, ale nie domyka żadnej pracy;
- AI generuje treść bez decyzji lub kolejnego kroku;
- istnieją konkurujące modele obiektu/lifecycle;
- nie wiadomo, kto jest właścicielem danych;
- „naprawa” wymaga wyboru produktu, a nie usunięcia błędu.

## Karta koncepcyjna narzędzia

Każde narzędzie odpowiada na pytania:

1. Kto je otwiera i z jakim problemem?
2. Jaki konkretny wynik ma po zakończeniu?
3. Jakie minimum danych jest potrzebne?
4. Co robi człowiek, co Teresa, a co automat?
5. Jak użytkownik rozpoznaje jakość wyniku?
6. Jaki obiekt powstaje i kto jest jego właścicielem?
7. Dokąd wynik przechodzi dalej?
8. Jak wygląda błąd, brak danych i przerwanie?
9. Co jest świadomie poza zakresem?
10. Jaki jeden scenariusz udowadnia wartość?

## Sekwencja

`problem → rezultat → użytkownik → obiekt → przepływ → decyzje → AI →
uprawnienia → kryteria jakości → MVP → prototyp/kontrakt → implementacja`

Nie zaczynamy od listy przycisków ani od tego, co już przypadkiem istnieje w
kodzie.

## Ocena narzędzia

| Wymiar | Pytanie |
| --- | --- |
| użyteczność | czy rozwiązuje realny problem? |
| domknięcie | czy prowadzi od wejścia do wyniku? |
| prawda | czy wynik opiera się na danych i źródłach? |
| sterowalność | czy użytkownik rozumie i kontroluje AI? |
| integracja | czy wynik trafia do właściwego modułu? |
| bezpieczeństwo | czy role i dane są chronione? |
| prostota | czy UI pokazuje tylko potrzebne decyzje? |
| mierzalność | czy można jednoznacznie odebrać rezultat? |

Wymiar krytyczny poniżej akceptowalnego poziomu blokuje implementację
rozszerzeń. Najpierw poprawiamy rdzeń wartości.

## Wynik sesji koncepcyjnej

- zatwierdzona obietnica;
- mapa funkcji MVP;
- główny flow i błędy;
- model obiektu;
- decyzje AI/human;
- kryteria akceptacji;
- lista późniejszych rozszerzeń;
- wpis w `DECISION_REGISTER.md`;
- pakiet dla Claude.
