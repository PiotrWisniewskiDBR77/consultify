---
module_id: MODULE_RESULTS
truth_type: product-target
status: canonical
owner: product
last_reviewed: 2026-07-31
---

# Results — aktualny kontrakt funkcjonalny

## Cel

Results pokazuje, czy wykonana zmiana przynosi oczekiwany rezultat. Jest
właścicielem KPI, wartości bazowych i docelowych, pomiarów, korzyści,
odchyleń oraz narracji value realization.

Ukończenie Initiative lub prac Execution nie oznacza automatycznie osiągnięcia
rezultatu. Results zachowuje różnicę między wykonaniem pracy, rzeczywistym
pomiarem i potwierdzoną korzyścią.

Finance pozostaje właścicielem modeli, założeń i wartości finansowych.
Initiative może łączyć się z KPI Results i modelami Finance, aby pokazać pełny
łańcuch realizacji bez duplikowania ich danych.

Docelowy KPI może zostać zdefiniowany na poziomie Initiative. Po zatwierdzeniu
trafia do wspólnego rejestru Results i może być przypisany do wielu kart
wyników. Results prowadzi jego lifecycle, pomiary, alerty i review.

## Funkcje

| ID | Funkcja | Stan |
| --- | --- | --- |
| `RES-F-001` | Hub wyników i przegląd korzyści | AS-IS beta |
| `RES-F-002` | KPI/OKR i pomiary | AS-IS / partial |
| `RES-F-003` | Baseline, target i trend | AS-IS / partial |
| `RES-F-004` | Korzyści i value realization | AS-IS / partial |
| `RES-F-005` | Odchylenia, komentarze i decyzje | partial |
| `RES-F-006` | Raport i przekazanie do Finance/Materials | partial |
| `RES-F-007` | Przypadek odchylenia, RCA i działanie korygujące | AS-IS / partial |
| `RES-F-008` | Review i potwierdzenie korzyści dowodem | partial |
| `RES-F-009` | Wspólna tabela wielu KPI i wiele kart wyników | partial |
| `RES-F-010` | Progi, alerty, powiadomienia i eskalacje KPI | AS-IS / partial |
| `RES-F-011` | KPI Recovery Card i weryfikacja skuteczności | partial |
| `RES-F-012` | Teresa OKR Definition Workshop i metric quality review | target |
| `RES-F-013` | Widoczność i role Objective/KR | partial / target |

## Przepływ i dane

Cel inicjatywy lub wykonania otrzymuje miernik, baseline, target, częstotliwość
i właściciela. Pomiary tworzą trend i odchylenie; reviewer zatwierdza wynik,
a raport trafia do Finance lub Materials. Brak danych musi być widoczny, nie
zamieniany automatycznie w zero.

## AI, role i integracje

Teresa może objaśniać trend i proponować przyczynę lub działanie, ale nie
fabrykuje pomiarów. Właściciel KPI wprowadza dane, reviewer je zatwierdza,
odbiorca raportu tylko czyta. Execution dostarcza postęp, Finance wycenia
efekt, Materials prezentuje raport.

## AS-IS

Kanoniczną nazwą produktu jest Results. `/benefits` montuje `ResultsHub`;
aktywna pozostaje także trasa `/kpi-okr`. Obie stare trasy wymagają
kompatybilnego przekierowania do docelowego `/results`.
API V8 Results istnieje. Moduł jest oznaczony w menu jako beta, a dokumentacja
nie ma jeszcze kompletnego dowodu lifecycle KPI i ROI.

**Pomiar 2026-09-01** (pełne cytaty:
`docs/functional/POMIAR_2026-09-01_FINANSE_WYNIKI_MATERIALY.md`, sekcja 2):
★ na realnym `demo.consultify.ai` KPI, OKR i ROI **SĄ widoczne** — zmienna
środowiskowa `VITE_DEMO_ACCEPTANCE` działa jako wczesny `return true`, który
omija logikę flag (potwierdził właściciel w Railway 28.08,
`DEC-2026-08-28-216`; ta sama zmienna omija też 5 rodzin flag w obszarze
pomysłów/studia artefaktów). Na gołym kodzie bez zmiennych `24/33` elementów
jest nieosiągalnych; na realnym demo `0/33`. Wcześniejsze twierdzenie
„OKR i ROI niewidoczne na demo, ~22/33" jest **obalone 1.09** — pełne
sprostowanie: `docs/program/funkcje/SPROSTOWANIE_WIDOCZNOSC_WYNIKOW.md`.
Mianownik pokrycia tras `135` jest wycofany (nieodtwarzalny); reprodukowalne
są `130`/`146`/`152` zależnie od metody liczenia — kanoniczny wybór między
146 a 152 pozostaje otwarty. Mechanizm crosswalk/backfill KPI ma dziś zero
wołaczy produktowych (biblioteka bez wywołania).

## TO-BE i luki

Wiarygodny rejestr efektów z provenance każdego pomiaru, jawną jakością danych,
wersjonowanym targetem i powiązaniem z inicjatywą oraz wykonaniem.

- potwierdzić model KPI/OKR, korzyści i statusy;
- zweryfikować importy, ręczne pomiary i zatwierdzenia;
- rozdzielić prognozę, cel i wartość rzeczywistą;
- udowodnić powiązanie Results ↔ Finance bez podwójnej prawdy;
- rozdzielić realized value w Results od obliczeń ROI i NPV w Finance;
- scalić ResultsHub, BenefitsHub i Benefits Register w jeden lifecycle;
- domknąć handoff KPI z Initiative do rejestru Results;
- zastąpić pojedynczą kartę tabelą KPI i katalogiem wielu scorecards;
- traktować Balanced Scorecard jako opcjonalny template;
- połączyć przekroczenia progów z notification, My Work i eskalacją;
- domknąć KPI Recovery Card oraz effectiveness review;
- wdrożyć prowadzoną przez Teresę definicję Objective i mierzalnych KR;
- oddzielić Key Results od zadań i Initiative;
- domknąć widoczność Organization/Team/Participants/Restricted/Executive;
- zapewnić bezpieczny roll-up bez ujawniania chronionych wartości;
- udowodnić deviation → RCA → action → effectiveness check;
- dodać testy pustych danych, korekt, uprawnień i raportowania.

Ocena: `B / beta`. Dowody: `STATUS.md`, `CODEMAP.md`, API V8 Results i
`INTEGRATION_REPORT.md`.
