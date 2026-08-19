---
doc_id: master-execution-plan-bottom-up
truth_type: delivery-status
status: canonical
owner: codex
business-owner: piotr
last_reviewed: 2026-08-01
---

# Master plan wykonawczy — bottom-up

> **Aktualna kolejność wykonawcza:** ten dokument zachowuje pełną architekturę
> fal produktu, ale bieżącym SSOT kolejki jest
> [`CURRENT_MVP_CONTROL.md`](CURRENT_MVP_CONTROL.md). W szczególności poniższa
> historyczna Fala 1 Partner/Organization/Meeting/Audits nie jest aktywną falą
> MVP. Meeting i Audits są poza MVP zgodnie z `WK-D-017` i `WK-D-027`, a Referral
> i Meeting mogą działać wyłącznie jako zatwierdzone, limitowane wyjątki D/E.

## Zatwierdzony proces domknięcia — siedem etapów

1. Zamknąć pytania decyzyjne i przedstawić rekomendowane odpowiedzi Piotrowi.
2. Wykonać końcowy audyt spójności nazw, statusów, ról, artefaktów, danych, Teresy, Canvasu, Initiatives i Execution.
3. Zbudować jedną mapę golden flows: `Materials → Finance → Results/KPI → Execution → Initiatives → Assessment → Tools → Interview → My Work → Chat`.
4. Porównać dokumentację z kodem i nadać każdej funkcji status `działa / częściowa / atrapa / niepodłączona / brak`.
5. Zbudować jednoznaczny execution backlog dla agentów Claude'a z plikami, testami, kryteriami i non-regression scope.
6. Realizować paczki falami; Codex wykonuje review i wydaje werdykt `GO / FIX / NO-GO`.
7. Przeprowadzić pełny odbiór stagingu na rzeczywistych golden flows.

Przed etapem 1 obowiązuje [`UI_UX_GATE_0.md`](UI_UX_GATE_0.md): UX jest stałą bramką każdej paczki, a nie oddzielnym big-bang refaktorem.

## Bramka wejścia

Przed falami domenowymi:

| Pakiet | Wynik |
| --- | --- |
| `WK-P0-001` | baseline revision, build i testy |
| `WK-P0-015` | mapa fragmentów 16 modułów |
| `WK-P0-016` | decyzje keep/merge/redirect/archive |
| `WK-DATA-001` | mapa encji i ownerów |
| `WK-AUTH-001` | minimalna macierz guardów domenowych |
| `UI-UX-GATE-0` | component ID, brak nowych forków, malejący baseline i visual/behavioral evidence |

## Historyczna fala platformowa — Partner, Organization, Meeting, Audits

Status: `NOT_ACTIVE_FOR_CURRENT_MVP`. Tabela pozostaje roadmapą po MVP, nie
bieżącą kolejką dla agentów.

| Kolejność | Pakiet | Rezultat | Stan wejścia |
| ---: | --- | --- | --- |
| 1 | `PAR-001` | partner API V8/legacy map i wybór kanonu | discovery |
| 2 | `PAR-002` | referral → client status → commission | implement |
| 3 | `ORG-001` | Organization/Context ownership map | discovery |
| 4 | `ORG-002` | context update → persisted version → consumer | implement |
| 5 | `MET-001` | odbiór realnego MeetingHub i korekta badge | runtime test |
| 6 | `MET-002` | meeting → approved decisions/follow-ups | concept + implement |
| 7 | `AUD-001` | public showcase vs audit-programs vs stub | discovery |
| 8 | `AUD-002` | program → evidence → finding → action/report | implement |

Wyjście: cztery golden flows i usunięta nieuczciwość statusów.

## Fala 2 — Materials, Finance, Results/KPI

### Stan wykonania 2026-08-01

Fundament `CORE-ART-001..007` jest **ACCEPTED**: jeden registry/envelope, kanoniczne typy,
materialization preflight, content read-back z ETag, adaptery report/presentation/sheet,
kanoniczny Canvas, kwarantanna Wave5 mirrors oraz fail-closed quorum publikacji.

Przyjęte paczki domenowe: `MAT-002`, `MAT-003A`, `MAT-005A`, `MAT-006A`,
`MAT-006B` jako contract slice, `FIN-001`, `RES-001A`, `EXE-001`, route slice
`INI-001` oraz backend A1 `EXE-002`.
Fala pozostaje w realizacji; status ten nie jest równoznaczny z odbiorem całego Materials
lub Finance.

| Kolejność | Pakiet | Rezultat | Stan wejścia |
| ---: | --- | --- | --- |
| 1 | `CORE-ART-001..007` | jeden model artifact/version/content/review/source | **ACCEPTED** |
| 2 | `MAT-001` | jeden owner/gate Materials i kompletne akcje Library | implement |
| 3 | `MAT-002` | Document Library → real share panel | **ACCEPTED** |
| 4 | `MAT-003A` | Workbook real-route round-trip i XLSX read-back | **ACCEPTED** |
| 5 | `MAT-003B..D` | concurrency, minimal edit i workbook versions | integrate |
| 6 | `MAT-004A..C` | generatory, lifecycle templates i fidelity matrix | concept + integrate |
| 7 | `MAT-005A` | Document checkpoint/restore/read-back | **ACCEPTED** |
| 8 | `MAT-005B` | pełny Document lifecycle E2E i share management | integrate |
| 9 | `MAT-006A` | Presentation restore z CAS i canonical read-back | **ACCEPTED** |
| 10 | `MAT-006B` | **ACCEPTED_CONTRACT_SLICE** — history unavailable i kontrakty składowe; pełny staging E2E pozostaje bramką | staging acceptance |
| 11 | `MAT-007` | immutable PDF export receipt i wspólna jakość | integrate |
| 12 | `FIN-001` | `/finance` owner, `/economics` redirect-only | **ACCEPTED** |
| 13 | `FIN-002` | trwały Investment Case: ROI/scenario/baseline/actual | concept + integrate |
| 14 | `FIN-003` | statement import/map/validation | integrate |
| 15 | `FIN-004` | Finance → kanoniczny Candidate Pack | integrate |
| 16 | `RES-001A` | `/results` owner, `/benefits` i `/kpi-okr` redirect-only | **ACCEPTED** |
| 17 | `RES-001B` | jeden owner store scorecardów KPI | integrate |
| 18 | `RES-002` | KPI lifecycle z measurement i deviation | integrate |
| 19 | `RES-003` | Initiative ↔ Finance ↔ KPI golden thread | integrate |

Wyjście: trzy główne moduły przestają być kolekcją ekranów i realizują
odtwarzalne procesy.

## Fala 3 — Execution i Initiatives

| Kolejność | Pakiet | Rezultat |
| ---: | --- | --- |
| 1 | `EXE-001` | **ACCEPTED** — `/execution` owner; legacy aliases redirect-only |
| 2 | `EXE-002` | jeden lifecycle plan/task/risk/change |
| 3 | `INI-001` | **ACCEPTED_ROUTE_SLICE** — `/initiatives` owner, alias redirects i default List/table; lifecycle/write-path audit pozostaje |
| 4 | `INI-002` | candidate → dedupe/merge → DRAFT z recovery i lineage |
| 5 | `INI-003` | project scope, role resolution i prosty approval profile |
| 6 | `INI-004` | wspólny Portfolio/resources/Roadmap/time/capacity read model |
| 7 | `INI-005` | Decision GO/NO-GO → same-ID handoff do Execution |
| 8 | `INI-006` | deterministyczne dynamic cards z persisted reopen |
| 9 | `FLOW-001` | initiative → execution → results E2E |

## Fala 4 — Assessment, Tools, Interview

| Kolejność | Pakiet | Rezultat |
| ---: | --- | --- |
| 1 | `ASM-001` | kanon assessment instance/session/score/report |
| 2 | `ASM-002` | jeden framework golden flow |
| 3 | `TLS-001` | zatwierdzenie pełnego kontraktu SWOT |
| 4 | `TLS-002` | pełny lifecycle sesji SWOT |
| 5 | `INT-001` | authoring/V8/enterprise ownership |
| 6 | `INT-002` | publish → assignment → response → approval |
| 7 | `FLOW-002` | evidence/insight/score → initiative E2E |

## Fala 5 — My Work i Chat

| Kolejność | Pakiet | Rezultat |
| ---: | --- | --- |
| 1 | `MW-001` | mapa agregatów i obiektów właścicielskich |
| 2 | `MW-002` | assigned work → source action → read-back |
| 3 | `MW-003` | ujednolicenie Notebook generations |
| 4 | `CHAT-001` | naprawa czterech regresji |
| 5 | `CHAT-002` | proposal → approval → owner object |
| 6 | `CHAT-003` | elastyczny Canvas: współpraca, wersja, akceptacja i handoff |

## Fala 6 — Settings, Admin, SuperAdmin

| Kolejność | Pakiet | Rezultat |
| ---: | --- | --- |
| 1 | `SET-001` | user preference vs org policy |
| 2 | `ADM-001` | tenant Admin capabilities i audit |
| 3 | `SADM-001` | SuperAdmin boundary i regresje |
| 4 | `SEC-001` | globalny tenant/RBAC/security gate |
| 5 | `OPS-001` | migration, backup, restore, monitoring, rollback |
| 6 | `REL-001` | globalny smoke i decyzja release |

## Reguła uruchamiania

Pakiet ma status `READY` tylko gdy:

- poprzednie zależności są zaakceptowane;
- kontrakt danych/API jest zamrożony;
- nie ma kolizji plików z innym agentem;
- decyzje koncepcyjne są zamknięte;
- istnieją kryteria akceptacji i niezależny reviewer.

## Priorytet w weekend

Jeśli pełen plan przekracza okno weekendowe, nie rozpraszamy pracy. Kolejność:

1. baseline i mapa;
2. szybkie domknięcia istniejącego backendu do UI;
3. Fala 2 — Materials, Finance, Results/KPI;
4. jeden golden flow Initiative → Execution → Results;
5. globalna stabilizacja.

Pozostałe elementy otrzymują zaakceptowany backlog, nie pozorny status `done`.

## Środowisko docelowe

Wszystkie fale kończą się wyłącznie odbiorem na Railway project `consultify`,
environment `demo`, pod `https://demo.consultify.ai`, z PostgreSQL tego samego
environment. Lokalne środowisko nie jest targetem odbioru. Produkcja nie jest
automatycznym następnym krokiem; wymaga osobnej bramki i decyzji Piotra.
