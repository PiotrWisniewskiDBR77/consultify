---
document_id: INITIATIVE-END-TO-END-LIFECYCLE
module: Initiatives
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Pełna ścieżka zarządzania Initiative

## 1. Zasada

Initiative przechodzi przez cztery domeny odpowiedzialności:

`Source module → Initiatives → Execution → Results`

Przejścia są handoffami między właścicielami prawdy, nie kopiowaniem obiektu.
Jedno lineage łączy Proposal Draft, Registered Initiative, Execution Case i
Benefit/KPI Supervision.

## 2. Lifecycle, widoczność i odpowiedzialność

| Faza | Status | Gdzie żyje prawda | Widoczność | Accountable | Co wolno robić | Bramka wyjścia |
| --- | --- | --- | --- | --- | --- | --- |
| Koncepcja | `PROPOSAL_DRAFT` | Zakładka Initiatives w module źródłowym | Autorzy, source owner, reviewerzy | Proposal Owner | Edytować koncepcję, evidence, rezultat, scope; Teresa przygotowuje draft. | Wysłanie do source validation. |
| Walidacja źródłowa | `PROPOSAL_IN_VALIDATION` | Moduł źródłowy | Jak wyżej + wskazany validator | Source Validator | Sprawdzić wartość dalszej analizy, evidence, duplikaty i widoczność. | Register, merge, extend, return, defer albo dismiss. |
| Rejestracja | `REGISTERED_DRAFT` | Initiatives | Zespół projektu/organizacji według policy | Initiative Owner | Skonfigurować profil kart, projekt, role i dalszą pracę. | Definition Gate. |
| Definicja | `DEFINED` | Initiatives | Uprawniony zespół + konsultowani | Initiative Owner | Doprecyzować scope, outcomes, success, options, stakeholders i RACI. | Definition zaakceptowana. |
| Analiza | `ANALYZING` | Initiatives + linki Finance/Results | Zespół, eksperci, decydenci | Initiative Owner | Feasibility, capacity, risk, change, finance, KPI, dependencies; delegować Task/Decision. | Analysis Gate bez blockerów lub z jawnymi wyjątkami. |
| Decyzja portfelowa | `READY_FOR_DECISION` | Initiatives/Portfolio | Decydenci i właściwy zespół | Portfolio Decision Owner | Porównać inicjatywy i scenariusze; approve, reject, defer, merge, return. | Wersjonowana Decision z rationale. |
| Zatwierdzony backlog | `APPROVED_BACKLOG` | Initiatives | Portfolio + przyszły zespół wykonawczy | Sponsor | Initiative ma mandat i warunki, ale nie ma jeszcze zgody na start. | Schedule/Capacity Gate. |
| Zobowiązanie czasowe | `SCHEDULED` | Initiatives + project/roadmap | Zespół wykonawczy i interesariusze | Sponsor + Execution Manager | Zatwierdzić projekt, role, capacity, baseline window, tolerancje i handoff. | Utworzenie/połączenie Execution Case. |
| Wdrożenie | `IN_EXECUTION` | Execution | Zespół realizacyjny; read-back w Initiative | Execution Manager | Zarządzać taskami, milestones, decyzjami, ryzykiem, zasobami, czasem i budżetem. | Delivery Acceptance lub Stop Decision. |
| Dostarczenie | `DELIVERED` | Execution; Initiative read-back | Zespół i Benefit Owner | Execution Manager | Potwierdzić deliverables, acceptance evidence, otwarte ryzyka i przekazanie operacyjne. | Benefits Handoff. |
| Nadzór rezultatów | `BENEFITS_TRACKING` | Results/KPI | KPI/Benefit Owner, sponsor, uprawnieni odbiorcy | Business/Benefit Owner | Monitorować KPI, adopcję, ROI/NPV actual, deviations i corrective actions. | Effectiveness Review po oknie pomiarowym. |
| Zamknięcie efektu | `EFFECTIVENESS_CONFIRMED` / `PARTIAL` / `NOT_ACHIEVED` | Results + history Initiative | Zgodnie z policy | Business/Benefit Owner | Ocenić osiągnięcie, wyjaśnić różnice, uruchomić corrective/new Initiative. | Formal Closure Decision. |
| Historia | `CLOSED` / `ARCHIVED` | Initiative lineage | Read-only według policy | Governance Owner | Przeglądać decyzje, dowody, wersje i lessons learned. | Brak zwykłego wyjścia. |

Statusy wyjątkowe `DEFERRED`, `REJECTED`, `MERGED`, `STOPPED` i `CANCELLED`
mogą wystąpić w odpowiednich fazach. Każdy wymaga reason, decydenta, daty,
snapshotu oraz — dla defer — review trigger.

## 3. Pięć bramek zarządczych

### Gate 0 — Source Validation

Rozstrzyga, czy koncepcja zasługuje na miejsce we wspólnym pipeline. Nie
rozstrzyga jeszcze, czy organizacja ją wykona.

### Gate 1 — Definition

Rozstrzyga, czy zespół rozumie problem, wynik, scope, opcje, odpowiedzialność i
kryteria sukcesu na tyle, aby inwestować w analizę.

### Gate 2 — Analysis / Portfolio Decision

Rozstrzyga, czy Initiative ma sens w porównaniu z alternatywami i portfelem:
wartość, finanse, ryzyko, wykonalność, capacity, change impact i mierzalność.

### Gate 3 — Schedule and Capacity Commitment

Rozstrzyga, czy można bezpiecznie zobowiązać organizację do terminu. Wymaga
projektu, accountable roles, dostępności krytycznych zasobów, baseline,
zależności, tolerancji i warunków handoff. To ostatnia zgoda przed Execution.

### Gate 4 — Delivery and Benefits Handoff

Rozdziela `zrobiliśmy` od `osiągnęliśmy rezultat`. Execution potwierdza
dostarczenie; Results przejmuje KPI i benefit tracking. Initiative pozostaje
lineage i kontekstem decyzji.

### Gate 5 — Effectiveness Closure

Rozstrzyga, czy zakładany rezultat osiągnięto: confirmed, partial albo not
achieved. Odchylenie może tworzyć corrective Task, Decision, Risk albo nowy
Initiative Proposal Draft.

## 4. Granice modułów źródłowych

Tools, Assessment, Audits, Interview, Finance i Results/KPI stosują wspólny
`Initiative Proposal Draft Contract`, ale zachowują własny kontekst:

- **Tools** — propozycje z wniosków narzędzia i evidence sesji;
- **Assessment** — propozycje z gapów dojrzałości i rekomendacji;
- **Audits** — corrective/improvement proposals z findings i requirements;
- **Interview** — propozycje z zatwierdzonych insightów;
- **Finance** — propozycje z analizy wartości, kosztów, wariantów lub odchyleń;
- **Results/KPI** — corrective/improvement proposals z deviation case.

Zakładka `Initiatives` modułu źródłowego pozwala: wygenerować, edytować,
połączyć z findingiem, porównać z istniejącym portfelem, zwalidować i wykonać
handoff. Po rejestracji pokazuje link oraz status read-back, ale zarządzanie
pełną kartą odbywa się w Initiatives.

## 5. Widoczność

Widoczność rozszerza się dopiero po walidacji:

1. Proposal Draft — source-private;
2. In Validation — named reviewers;
3. Registered — project/team visibility;
4. Portfolio Decision — governance visibility;
5. Scheduled/Execution — delivery visibility;
6. Results — KPI visibility policy, potencjalnie szersza niż delivery.

Rejestracja wymaga jawnego wyboru projektu i visibility classification. Teresa
może rekomendować, lecz nie może samodzielnie ujawnić danych szerszej grupie.

## 6. Reguły ciągłości

- jedno `lineageId` od propozycji do efektu;
- immutable snapshot przy każdej bramce;
- handoff idempotentny i z read-backiem;
- zmiana zatwierdzonego scope/term/budget/KPI tworzy impact assessment;
- lokalne źródło nie edytuje Registered Initiative po handoff — proponuje
  Suggested Change;
- `DELIVERED` nie oznacza `BENEFIT ACHIEVED`;
- zamknięcie bez Effectiveness Review wymaga jawnego wyjątku i decydenta;
- Teresa utrzymuje kontekst, ale każda domena zachowuje swoją prawdę.

## 7. Minimalne zdarzenia systemowe

`proposal.created`, `proposal.submitted`, `proposal.returned`,
`initiative.registered`, `initiative.merged`, `gate.requested`,
`gate.decided`, `initiative.scheduled`, `execution.started`,
`delivery.accepted`, `benefits.tracking_started`, `kpi.deviated`,
`effectiveness.reviewed`, `initiative.closed`.

Każde zdarzenie ma actor, timestamp, source/version, decision/evidence refs,
visibility i correlation/lineage ID. Powiadomienia i automatyzacje subskrybują
zdarzenia; nie rekonstruują lifecycle z nazw ekranów.
