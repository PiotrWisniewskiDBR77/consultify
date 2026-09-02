---
module_id: MODULE_FINANCE
truth_type: product-target
status: canonical
owner: product
last_reviewed: 2026-07-30
---

# Finance — aktualny kontrakt funkcjonalny

## Cel

Finance jest właścicielem modeli finansowych, założeń, okresów, scenariuszy,
forecastów, analiz i wycen. Dostarcza finansowy obraz decyzji, nie zastępuje
księgowości źródłowej ani nie przejmuje KPI operacyjnego z Results.

Samodzielny business case inwestycji może liczyć NPV, IRR, ROI i payback bez
pełnego modelu finansowego przedsiębiorstwa. Po decyzji Finance zamraża
approved baseline i rozlicza go post factum z kosztami Execution oraz efektami
Results przez Benefits Realization Ledger i post-investment review.

Initiative może linkować do modeli i wartości Finance oraz do KPI Results w
celu śledzenia realizacji, ale nie przejmuje prawdy żadnej z tych domen.

Finance nie ma osobnej zakładki Overview. Zatwierdzone wnioski z analizy,
scenariusza, wyceny albo post-investment review mogą zostać przekształcone
w kontrolowany Initiative Candidate Pack i przekazane do Initiatives.

## Funkcje

| ID | Funkcja | Stan |
| --- | --- | --- |
| `FIN-F-001` | Hub finansowy | AS-IS beta |
| `FIN-F-002` | Sprawozdania i import danych | AS-IS / partial |
| `FIN-F-003` | Modele i założenia | AS-IS |
| `FIN-F-004` | Analizy i scenariusze | AS-IS |
| `FIN-F-005` | Forecast, ROI i wycena | AS-IS / partial |
| `FIN-F-006` | Review, eksport i raportowanie | partial |
| `FIN-F-007` | Samodzielny Investment Case | AS-IS / partial |
| `FIN-F-008` | Benefits realization i post-investment review | partial / target |
| `FIN-F-009` | Finance conclusion → Initiative Candidate | partial / target |

## Przepływ i dane

Użytkownik importuje lub wprowadza dane, mapuje okresy i jednostki, buduje
model, definiuje założenia i scenariusze, oblicza wynik, przeprowadza review i
publikuje raport. Każdy wynik musi wskazywać model, wersję, walutę, okres i
założenia.

## AI, role i integracje

AI może wyjaśniać odchylenia, proponować mapowanie i scenariusze, lecz operacje
finansowe pozostają deterministyczne oraz możliwe do odtworzenia. Autor modelu,
reviewer i odbiorca mają rozdzielone prawa. Initiatives dostarcza business case,
Results — efekty, Materials — publikację.

## AS-IS

`/finance` jest trasą kanoniczną. Stara trasa i nazwa widoku nadal istnieją
w kodzie jako dług migracyjny; wymagają mapy zależności, przekierowania i
bezpiecznej zmiany nazw. Nie są alternatywną nazwą produktu. Istnieją szczegóły
statements, models i analyses. Runtime ma tryb V8 oraz przełączniki fallback do
starszych powierzchni. Menu oznacza Finance jako beta.

**Pomiar 2026-09-01** (pełne cytaty:
`docs/functional/POMIAR_2026-09-01_FINANSE_WYNIKI_MATERIALY.md`, sekcja 1):
w warsztacie wyceny **18 z 21 paneli** woła realny endpoint backendu (trzy
pozostałe są celowo lokalne — `DriverPlannerPanel`, `EvBasketFootballField`,
`ValuationVisualsPanel`, nie luka). Na domyślnych ustawieniach **25 z 26
ekranów modułu jest zamkniętych za flagami** — to jest zamierzony,
kontrolowany rollout wizualny, nie usterka. „Management report" wyceny
**nie istnieje w kodzie**; `ExportStep.tsx` jest uczciwym placeholderem
(decyzja w MVP/poza MVP wciąż otwarta, patrz `FIN-F-006` niżej).

## TO-BE i luki

Jednoznaczny, wersjonowany i audytowalny workbench finansowy, w którym wynik
jest zawsze odtwarzalny z danych oraz założeń.

- stosować Finance jako jedyną nazwę w UI, dokumentacji i nowych kontraktach;
- zinwentaryzować i bezpiecznie zmigrować stare trasy oraz identyfikatory;
- potwierdzić aktualny model encji, jednostek, walut i okresów;
- zweryfikować import, walidację, mapping i rollback;
- ustalić kanoniczny runtime V8 i zakres fallbacków;
- udowodnić wersjonowanie, approval i izolację organizacji;
- dodać golden tests obliczeń oraz E2E import → model → analiza → raport.

Ocena: `B / beta`. Dowody: `STATUS.md`, `CODEMAP.md`, szczegółowe trasy
Finance, API i dokumentacja modeli danych.
