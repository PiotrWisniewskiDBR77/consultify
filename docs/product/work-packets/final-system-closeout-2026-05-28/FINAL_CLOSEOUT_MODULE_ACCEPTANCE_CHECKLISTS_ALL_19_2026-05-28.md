# Final Closeout Module Acceptance Checklists - All 19 Modules (2026-05-28)

Status: `operational_checklist_canonical_for_closeout`

Owner: CTO / Delivery Owner

Purpose: jedna lista odbiorowa modul po module, gotowa do execution.

---

## 1) How to use

Dla kazdego modulu wykonaj:

1. Checkliste globalna (sekcja 2)
2. Checklistę modulowa (sekcja 3)
3. Wydaj werdykt:
   - `PASS`
   - `PASS_WITH_P2`
   - `BLOCKED_P1`
   - `NO_GO`

---

## 2) Global checklist (must pass for every module)

- [ ] G0 Contract Gate PASS
- [ ] G1 API/DB/UI hard gate PASS
- [ ] G2 Functional Gate PASS
- [ ] G3 UX Trust Gate PASS
- [ ] G4 Security/Tenant Gate PASS
- [ ] G5 Evidence/Decision Gate PASS
- [ ] Core action works
- [ ] Save/read-back/refresh works
- [ ] Honest loading/error/empty/degraded states
- [ ] No raw internals
- [ ] No silent execution / hidden learning
- [ ] Evidence pack complete

---

## 3) Module-specific acceptance checklists

## 01 Czat

- [ ] Send/response loop stable
- [ ] Conversation continuity after refresh
- [ ] Attachment/context flow stable
- [ ] AI actions follow proposal/approval/audit

## 02 Moja Praca

- [ ] Home blocks load correctly
- [ ] Personal workflow shortcuts work
- [ ] Inbox/tasks links are stable
- [ ] Refresh keeps expected state

## 03 Wywiad

- [ ] Session list/detail works
- [ ] Assignment flow works (start/submit/review)
- [ ] Review/approval loop works
- [ ] Evidence and status trace is complete

## 04 Narzedzia

- [ ] Tool entry and shell continuity
- [ ] Save/read-back in active tools
- [ ] Cross-tool context does not break
- [ ] Error/degraded states are honest

## 05 Inicjatywy

- [ ] Initiative create/read/update works
- [ ] Dependency and readiness views load
- [ ] Decision chain visibility works
- [ ] Governance traces are present

## 06 Realizacja

- [ ] Execution dashboard loads
- [ ] Risk/delay signals are visible
- [ ] Key operator action path works
- [ ] Read-back and refresh are stable

## 07 Rezultaty

- [ ] KPI and ROI summary loads
- [ ] Cross-tab continuity is stable
- [ ] Key metric flows are coherent
- [ ] No misleading status signals

## 08 Finanse

- [ ] Finance dashboard loads
- [ ] Analysis create/read/update works
- [ ] Critical finance actions are auditable
- [ ] Degraded behavior is honest

## 09 Outputs

- [ ] Outputs library loads and filters
- [ ] Artifact lineage/readback is visible
- [ ] Review/publish state is coherent
- [ ] Refresh keeps artifact state

## 10 Dokumenty

- [ ] Create/edit/save document flow works
- [ ] Save state vs lifecycle is clear
- [ ] Reopen and export flow works
- [ ] QA/readback path is stable

## 11 Tabele

- [ ] Table CRUD core flow works
- [ ] Relation/view behavior is stable
- [ ] Data persists after refresh
- [ ] Export path is reliable

## 12 Prezentacje

- [ ] Deck create/edit flow works
- [ ] Theme/layout interactions stable
- [ ] Save/reopen works
- [ ] Export/review flow is stable

## 13 Meeting

- [ ] Meeting list/detail flow works
- [ ] Core actions (create/update/state) work
- [ ] Linked outputs/handoffs work
- [ ] Audit/readback is visible

## 14 MCP IRIS

- [ ] Module access and auth are stable
- [ ] Core MCP interactions are stable
- [ ] Errors/degraded states are honest
- [ ] ACL/tenant boundaries hold

## 15 MCP Marketplace

- [ ] Provider catalog/listing works
- [ ] Core connector action flow works
- [ ] Status and recovery messaging is clear
- [ ] Governance controls are visible

## 16 Organizacja

- [ ] Org context reads/writes are stable
- [ ] Access by role is correct
- [ ] Context ingestion/readback is coherent
- [ ] Audit trail exists for critical changes

## 17 Panel Administratora

- [ ] Core admin controls work
- [ ] Denied states are correct
- [ ] Admin mutations are traceable
- [ ] No cross-tenant visibility leaks

## 18 Ustawienia

- [ ] User settings save/read-back works
- [ ] Org-level settings behave correctly
- [ ] Refresh keeps saved values
- [ ] No fake success in save feedback

## 19 Portal Partnerski

- [ ] Dashboard and metrics load
- [ ] Key partner actions work (campaign/payout/request)
- [ ] Profile/config workflows are stable
- [ ] Governance/audit path is present

---

## 4) Decision log template (per module)

- Module:
- Date:
- Gate result:
- Critical findings:
- Residual risks:
- Evidence references:
- Next step:

