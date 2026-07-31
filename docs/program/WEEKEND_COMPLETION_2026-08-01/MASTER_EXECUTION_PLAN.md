---
doc_id: master-execution-plan-bottom-up
truth_type: delivery-status
status: canonical
owner: codex
business-owner: piotr
last_reviewed: 2026-07-31
---

# Master plan wykonawczy — bottom-up

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

## Fala 1 — Partner, Organization, Meeting, Audits

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

| Kolejność | Pakiet | Rezultat | Stan wejścia |
| ---: | --- | --- | --- |
| 1 | `MAT-001` | jeden model artifact/version/approval/source | product decision |
| 2 | `MAT-002` | hub bez produkcyjnej zależności od mock data | implement |
| 3 | `MAT-003` | Excel/Table: edycja, zapis, reopen i eksport | integrate |
| 4 | `MAT-004` | generatory i lifecycle szablonów Excel | concept + integrate |
| 5 | `MAT-005` | Document save/reopen/version/export | integrate |
| 6 | `MAT-006` | Presentation save/reopen/version/export | integrate |
| 7 | `MAT-007` | PDF i wspólna jakość eksportów | integrate |
| 8 | `MAT-008` | wspólna biblioteka, archive/delete/share | integrate |
| 9 | `FIN-001` | kanon Finance API i modelu danych | discovery/decision |
| 10 | `FIN-002` | statement import/map/validation | integrate |
| 11 | `FIN-003` | model/scenario/version/result | integrate |
| 12 | `RES-001` | Results vs Benefits ownership i kanon API | discovery/decision |
| 13 | `RES-002` | KPI lifecycle z measurement i deviation | integrate |
| 14 | `RES-003` | Initiative ↔ Finance ↔ KPI golden thread | integrate |

Wyjście: trzy główne moduły przestają być kolekcją ekranów i realizują
odtwarzalne procesy.

## Fala 3 — Execution i Initiatives

| Kolejność | Pakiet | Rezultat |
| ---: | --- | --- |
| 1 | `EXE-001` | wybór między FullExecutionView i ExecutionHub |
| 2 | `EXE-002` | jeden lifecycle plan/task/risk/change |
| 3 | `INI-001` | jeden initiative write-truth i router order |
| 4 | `INI-002` | candidate → approve → portfolio |
| 5 | `FLOW-001` | initiative → execution → results E2E |

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

Wszystkie fale kończą się odbiorem na staging. Produkcja nie jest automatycznym
następnym krokiem; wymaga osobnej bramki i decyzji Piotra.
