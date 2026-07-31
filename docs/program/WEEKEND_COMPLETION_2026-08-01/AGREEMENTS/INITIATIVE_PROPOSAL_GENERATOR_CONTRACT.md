---
document_id: INITIATIVE-PROPOSAL-GENERATOR-CONTRACT
scope: cross-application
primary_module: Initiatives
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Initiative Proposal Generator — kontrakt produktu

## 1. Zadanie

Generator zamienia zatwierdzone findingi, insighty, outputs albo odchylenia w
niewielki zestaw `Initiative Proposal Drafts`. Draft jest hipotezą zmiany do
walidacji w Candidates, a nie zatwierdzonym projektem ani listą wygenerowanych
zadań.

## 2. Miejsca użycia

| Źródło | Typowy trigger | Generator wykorzystuje |
| --- | --- | --- |
| Interview | approved insight | problem, stakeholders, quotes/evidence |
| Assessment | maturity gap/finding | actual/target, dimension, evidence |
| Tools | accepted output/move | analiza, recommendation, chosen direction |
| Audits | accepted finding/nonconformity | requirement, evidence, severity, corrective need |
| Finance | zaakceptowany investment finding/scenario | value hypothesis, assumptions, constraints |
| Results/KPI | trwałe odchylenie lub failed benefit | metric gap, trend, owner, prior actions |
| Meeting | approved decision/finding | decision context, rationale, owner |
| Ideas | rozwinięta i zatwierdzona idea | opportunity, user value, evidence |

Wszystkie miejsca używają jednego generatora i adapterów wejścia. Moduły nie
implementują własnych, niezgodnych formatów inicjatywy.

## 3. Wejście i przygotowanie

Użytkownik wybiera źródła i określa:

- problem/opportunity do rozwiązania;
- oczekiwany outcome, nie gotową listę działań;
- scope organizacyjny i projekt, jeśli znany;
- constraints, time horizon i strategic context;
- czy generator ma proponować warianty, grupować źródła lub aktualizować
  istniejącą inicjatywę;
- kryterium ograniczające liczbę propozycji.

Przed generacją system porównuje źródła z istniejącymi Proposal Drafts i
Registered Initiatives.

## 4. Analiza

Teresa:

1. rozdziela problem, przyczynę, symptom, rozwiązanie i outcome;
2. grupuje źródła dotyczące tej samej zmiany;
3. wykrywa duplicate, overlap, extension, conflict i dependency;
4. proponuje alternatywy, w tym `do nothing`;
5. ocenia wstępnie value, feasibility, urgency i uncertainty;
6. wskazuje potrzebne Finance, KPI, Risks, Decisions, role i evidence;
7. proponuje jeden draft, kilka wariantów albo brak inicjatywy;
8. pokazuje koszt błędu i brakujące walidacje.

Generator nie optymalizuje liczby inicjatyw przez produkowanie wielu podobnych
kart. Domyślnie preferuje najmniejszy sensowny zestaw zmian.

## 5. Initiative Proposal Draft

Każdy draft zawiera minimum:

- proposed title i concise summary;
- problem/opportunity i affected users/process;
- source findings/insights/outputs z wersjami;
- evidence za i przeciw;
- proposed outcome i preliminary success signals;
- candidate scope in/out;
- solution hypothesis oraz alternatives;
- strategic linkage, jeśli istnieje;
- preliminary value, urgency, feasibility i risk;
- assumptions, unknowns i questions to validate;
- duplicate/overlap/dependency relations;
- suggested Proposal Owner, project i visibility bez automatycznego nadania;
- recommended next step;
- confidence i generator provenance.

Draft nie wymaga pełnego business case, capacity plan ani dat realizacji. Musi
jednak jasno pokazać, czego brakuje do Source Validation.

## 6. Workspace i decyzje użytkownika

Na każdej karcie użytkownik może:

- otworzyć źródła i uzasadnienie;
- edytować bez utraty treści pierwotnej;
- merge/split proposal;
- porównać z istniejącą inicjatywą;
- wybrać `Create Draft`, `Extend Existing`, `Link as Evidence`, `Defer`,
  `Dismiss` albo `Needs clarification`;
- zaakceptować wybrane karty zbiorczo po przejściu walidacji;
- wysłać draft do Source Validation/Candidates.

Generator nie wykonuje `Register`, `Go`, `Schedule` ani `Start Execution`.

## 7. Quality Gate Proposal Draft

Do utworzenia draftu wymagane są:

- konkretny problem/opportunity, nie tylko nazwa rozwiązania;
- co najmniej jedno dozwolone źródło;
- proposed outcome odróżniony od deliverable;
- jawne assumptions i unknowns;
- wynik deduplikacji;
- source owner/proposal owner do dalszej walidacji;
- określony next step;
- brak policy blockera.

Niepewność nie blokuje draftu, ale musi być widoczna. Brak evidence może być
powodem `Needs evidence`, nie pretekstem do jego wygenerowania.

## 8. Relacja do lifecycle Initiatives

`Source objects → Generated Proposal → Accepted Proposal Draft → Candidates →
Source Validation → Registered Initiative → Definition/Portfolio/Roadmap/
Decisions → Execution`

Po rejestracji źródłowy moduł pokazuje projekcję statusu, ale właścicielem
obiektu staje się Initiatives. Lineage pozostaje dwukierunkowe.

## 9. Rola Teresy i człowieka

Teresa przygotowuje rekomendacje, alternatywy i quality review. Użytkownik
źródłowy akceptuje powstanie Proposal Draft. Uprawniona rola w Initiatives
decyduje o Register/Merge/Extend/Dismiss. AI nigdy nie staje się Proposal Owner,
Initiative Owner ani approverem.

## 10. Antywzorce

- jedna inicjatywa na każdy insight/finding;
- tytuł rozwiązania bez problemu i outcome;
- kopiowanie insightu jako pełnej karty inicjatywy;
- automatyczne nadawanie ownera, projektu, budżetu lub terminu;
- ignorowanie istniejącej inicjatywy o tym samym celu;
- generowanie tasków przed wyborem wariantu i zatwierdzeniem scope;
- deklarowanie ROI/KPI bez linku do właściciela danych;
- rejestracja poza Candidates i Source Validation.

## 11. Test odbiorczy

Golden flow:

`approved source → select scope → duplicate scan → generation brief → generate
small proposal set → inspect evidence/alternatives → merge/edit → accept selected
Proposal Drafts → Candidates → Source Validation with full lineage`
