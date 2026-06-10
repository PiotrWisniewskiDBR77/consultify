# S1 Contract Readiness Matrix - 2026-05-28

Status: `active_s1_tracking`

Owner: CTO / Delivery Owner

Purpose: monitor gotowosci kontraktowej wszystkich 19 modulow przed execution.

---

## 1) Readiness criteria

Kontrakt modulu jest `READY_FOR_EXECUTION` tylko gdy:

- contract completeness = `YES`
- open questions <= 3
- plan approval = `APPROVED`
- validation matrix = `COMPLETE`
- risk register = `COMPLETE`

---

## 2) Matrix (all modules)

| Module | Contract completeness | Open questions <=3 | Validation matrix | Risk register | Plan approval | Readiness | Blocker | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 01 Czat | YES | YES | COMPLETE | COMPLETE | IN_REVIEW | READY_FOR_APPROVAL | Open questions pending closure | Close open questions and approve packet |
| 02 Moja Praca | YES | YES | COMPLETE | COMPLETE | IN_REVIEW | READY_FOR_APPROVAL | Open questions pending closure | Close open questions and approve packet |
| 03 Wywiad | PARTIAL | YES | PARTIAL | PARTIAL | PENDING | NOT_READY | Assignment and review acceptance depth | Finalize S1 contract sections |
| 04 Narzedzia | PARTIAL | YES | PARTIAL | PARTIAL | PENDING | NOT_READY | Cross-tool integration acceptance | Finalize S1 contract sections |
| 05 Inicjatywy | YES | YES | COMPLETE | COMPLETE | IN_REVIEW | READY_FOR_APPROVAL | Open questions pending closure | Close open questions and approve packet |
| 06 Realizacja | YES | YES | COMPLETE | COMPLETE | IN_REVIEW | READY_FOR_APPROVAL | Open questions pending closure | Close open questions and approve packet |
| 07 Rezultaty | PARTIAL | YES | PARTIAL | PARTIAL | PENDING | NOT_READY | KPI/ROI acceptance detail | Finalize S1 contract sections |
| 08 Finanse | PARTIAL | YES | PARTIAL | PARTIAL | PENDING | NOT_READY | Finance mutation acceptance detail | Finalize S1 contract sections |
| 09 Outputs | PARTIAL | YES | PARTIAL | PARTIAL | PENDING | NOT_READY | Artifact lineage acceptance detail | Finalize S1 contract sections |
| 10 Dokumenty | PARTIAL | YES | PARTIAL | PARTIAL | PENDING | NOT_READY | Document workflow acceptance depth | Finalize S1 contract sections |
| 11 Tabele | PARTIAL | YES | PARTIAL | PARTIAL | PENDING | NOT_READY | Table relational/runtime acceptance | Finalize S1 contract sections |
| 12 Prezentacje | PARTIAL | YES | PARTIAL | PARTIAL | PENDING | NOT_READY | Export and governance acceptance depth | Finalize S1 contract sections |
| 13 Meeting | PARTIAL | YES | PARTIAL | PARTIAL | PENDING | NOT_READY | Meeting workflow acceptance scope | Finalize S1 contract sections |
| 14 MCP IRIS | PARTIAL | YES | PARTIAL | PARTIAL | PENDING | NOT_READY | Integration and ACL acceptance detail | Finalize S1 contract sections |
| 15 MCP Marketplace | PARTIAL | YES | PARTIAL | PARTIAL | PENDING | NOT_READY | Connector governance acceptance detail | Finalize S1 contract sections |
| 16 Organizacja | PARTIAL | YES | PARTIAL | PARTIAL | PENDING | NOT_READY | Org context safety acceptance depth | Finalize S1 contract sections |
| 17 Panel Administratora | PARTIAL | YES | PARTIAL | PARTIAL | IN_REVIEW | NOT_READY | Needs final G1-aligned contract lock | Run G1 then close S1 items |
| 18 Ustawienia | PARTIAL | YES | PARTIAL | PARTIAL | IN_REVIEW | NOT_READY | Needs final G1-aligned contract lock | Run G1 then close S1 items |
| 19 Portal Partnerski | PARTIAL | YES | PARTIAL | PARTIAL | PENDING | NOT_READY | Partner workflow acceptance breadth | Finalize S1 contract sections |

---

## 2.1 S1 completion checklist by module (all 19)

Legend:

- Scope map = create/update/untouched
- AC = acceptance criteria
- VM = validation matrix
- RM = risk matrix/register
- AP = approval-ready packet

| Module | Scope map | AC | VM | RM | AP | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| 01 Czat | DONE | DONE | DONE | DONE | IN_REVIEW | CTO / Delivery Owner |
| 02 Moja Praca | DONE | DONE | DONE | DONE | IN_REVIEW | CTO / Delivery Owner |
| 03 Wywiad | TODO | TODO | TODO | TODO | TODO | CTO / Delivery Owner |
| 04 Narzedzia | TODO | TODO | TODO | TODO | TODO | CTO / Delivery Owner |
| 05 Inicjatywy | DONE | DONE | DONE | DONE | IN_REVIEW | CTO / Delivery Owner |
| 06 Realizacja | DONE | DONE | DONE | DONE | IN_REVIEW | CTO / Delivery Owner |
| 07 Rezultaty | TODO | TODO | TODO | TODO | TODO | CTO / Delivery Owner |
| 08 Finanse | TODO | TODO | TODO | TODO | TODO | CTO / Delivery Owner |
| 09 Outputs | TODO | TODO | TODO | TODO | TODO | CTO / Delivery Owner |
| 10 Dokumenty | TODO | TODO | TODO | TODO | TODO | CTO / Delivery Owner |
| 11 Tabele | TODO | TODO | TODO | TODO | TODO | CTO / Delivery Owner |
| 12 Prezentacje | TODO | TODO | TODO | TODO | TODO | CTO / Delivery Owner |
| 13 Meeting | TODO | TODO | TODO | TODO | TODO | CTO / Delivery Owner |
| 14 MCP IRIS | TODO | TODO | TODO | TODO | TODO | CTO / Delivery Owner |
| 15 MCP Marketplace | TODO | TODO | TODO | TODO | TODO | CTO / Delivery Owner |
| 16 Organizacja | TODO | TODO | TODO | TODO | TODO | CTO / Delivery Owner |
| 17 Panel Administratora | IN_PROGRESS | IN_PROGRESS | IN_PROGRESS | IN_PROGRESS | IN_REVIEW | CTO / Delivery Owner |
| 18 Ustawienia | IN_PROGRESS | IN_PROGRESS | IN_PROGRESS | IN_PROGRESS | IN_REVIEW | CTO / Delivery Owner |
| 19 Portal Partnerski | TODO | TODO | TODO | TODO | TODO | CTO / Delivery Owner |

---

## 2.2 Required S1 packet files per module

For each module create/update:

1. `<MODULE>_S1_SCOPE_MAP.md`
2. `<MODULE>_S1_ACCEPTANCE_CRITERIA.md`
3. `<MODULE>_S1_VALIDATION_MATRIX.md`
4. `<MODULE>_S1_RISK_REGISTER.md`
5. `<MODULE>_S1_APPROVAL_PACKET.md`

Current packet policy:

- active now: modules `17` and `18`
- next wave: `01`, `02`, `05`, `06`, `07`, `08`

---

## 3) Priority closure order for S1 readiness

1. 18 Ustawienia
2. 17 Panel Administratora
3. 01 Czat
4. 02 Moja Praca
5. 05 Inicjatywy
6. 06 Realizacja
7. 07 Rezultaty
8. 08 Finanse
9. 16 Organizacja
10. 04 Narzedzia
11. 11 Tabele
12. 03 Wywiad
13. 09 Outputs
14. 10 Dokumenty
15. 12 Prezentacje
16. 13 Meeting
17. 14 MCP IRIS
18. 15 MCP Marketplace
19. 19 Portal Partnerski

---

## 4) Decision register

| Date | Module | Decision | Reason | Owner | Next step |
| --- | --- | --- | --- | --- | --- |
| 2026-05-28 | 18 Ustawienia | IN_REVIEW | Active WIP with G1 prep | CTO / Delivery Owner | Execute G1 check-run |
| 2026-05-28 | 17 Panel Administratora | IN_REVIEW | Active WIP with G1 prep | CTO / Delivery Owner | Execute G1 check-run |
| 2026-05-28 | GLOBAL | PARTIAL_READY | S1 framework complete, per-module packets pending | CTO / Delivery Owner | Build packets in wave order |
| 2026-05-28 | 01 Czat | IN_REVIEW | S1 packet created, open questions remain | CTO / Delivery Owner | Resolve open questions and approve |
| 2026-05-28 | 02 Moja Praca | IN_REVIEW | S1 packet created, open questions remain | CTO / Delivery Owner | Resolve open questions and approve |
| 2026-05-28 | 05 Inicjatywy | IN_REVIEW | S1 packet created, open questions remain | CTO / Delivery Owner | Resolve open questions and approve |
| 2026-05-28 | 06 Realizacja | IN_REVIEW | S1 packet created, open questions remain | CTO / Delivery Owner | Resolve open questions and approve |

