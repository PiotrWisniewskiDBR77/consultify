---
doc_id: mvp-golden-flow-master-map
truth_type: product-acceptance
status: canonical
owner: codex
business_owner: piotr
last_reviewed: 2026-07-31
---

# Jedna mapa golden flows MVP

## Kolejność odbioru

`Materials → Finance → Results/KPI → Execution → Initiatives → Assessment → Tools → Interview → My Work → Chat`.

Kolejność odbioru jest bottom-up. Przepływ biznesowy może przebiegać w przeciwnym kierunku lub tworzyć pętlę.

## Golden flows modułów

| ID | Moduł | Start | Kroki krytyczne | Zakończenie i read-back | UI families |
| --- | --- | --- | --- | --- | --- |
| `GF-MAT-01` | Materials | Generation Brief lub istniejący plik | create/import → edit → save → reopen → version → review/approve → preview | download/share link ponownie otwiera tę samą wersję | Hub, Artifact Shell, Editor/Sheet/Deck, Preview |
| `GF-FIN-01` | Finance | założenia Investment Case lub statement | validate inputs → calculate NPV/IRR/ROI/payback → scenario → decision baseline → link Initiative | reopen pokazuje wersję i numerical lineage; post-investment actuals możliwe | Hub, Table, Workbook, Preview |
| `GF-RES-01` | Results/KPI | KPI z Initiative albo utworzone ręcznie | define Objective/KR/KPI → baseline/target/source/owner → measurement → threshold breach → Deviation/Recovery | actual i corrective loop widoczne po reopen; roll-up respektuje scope | Hub, Table, KPI Card, Preview, Notification |
| `GF-EXE-01` | Execution | Initiative `Ready for Execution` | plan → roles/resources → tasks/milestones → risks/issues/changes/decisions → progress/reforecast | closure wymaga evidence i przekazuje actuals do Results/Finance | Hub, Table, N-mode, Timeline, Preview |
| `GF-INI-01` | Initiatives | Candidate z modułu źródłowego | dedupe/merge → AI completeness/feasibility → portfolio/resources → roadmap → approvals/go-no-go | approved + scheduled Initiative ma team, KPI hypothesis i handoff snapshot | Hub, Table, N-mode cards, Preview |
| `GF-ASM-01` | Assessment | DRD z Library | create session → guided interview → evidence/help → matrix round-trip → quality review → output/report | zaakceptowany output jest immutable i generuje Candidate Pack z lineage | Library Hub, Wizard, Matrix, Question, Preview |
| `GF-TLS-01` | Tools | SWOT z Library | start/resume session → ręcznie lub Teresa → navigate/back/edit → quality review → finalize output → report | output/report reopen; candidates powstają ze wskazanych wniosków | Library Hub, Tool Workspace, Artifact, Preview |
| `GF-INT-01` | Interview | opublikowany template | assign → respondent answers with Teresa → quality verification → submit → manager accept/return → insights/candidates | odpowiedzi, review i wygenerowane obiekty zachowują lineage | Hub, Question, Preview, Generator |
| `GF-MW-01` | My Work | assignment/alert/decision/task z owner module | Inbox triage → task/decision action → calendar/time → note/context → owner object update | source module read-back; My Work nie utrzymuje konkurencyjnej kopii | Hub, Table, Preview, Calendar, N-mode |
| `GF-CHAT-01` | Chat/Teresa | rozmowa z projektem i dozwolonym kontekstem | clarify → retrieve/cite → propose → Canvas iterate → approval → materialize | nowy owner object otwiera się w module, a chat zapisuje receipt i link | Chat, Proposal, Canvas, Artifact handoff |

## Golden thread przekrojowy

`Assessment/Tools/Interview/Finance → Candidate Initiative → Initiative → Execution → Results/KPI → Finance post-investment review → Materials report`.

Wymagane identyfikatory: `sourceArtifactRef`, `candidateId`, `initiativeId`, `executionId`, `kpiId/resultId`, `financeCaseId`, `materialId/versionId`. Brak któregoś identyfikatora oznacza zerwane lineage i `NO-GO`.

## Wspólne bramki każdego flow

- tenant/project access i role negatywne;
- loading/empty/error/degraded/no-access;
- zapis, server read-back, reopen i idempotency;
- source/evidence i audit event;
- Teresa pokazuje current/proposed i approval;
- UI Gate 0: standard component IDs, dark/light, keyboard i responsive;
- retry/rollback albo uczciwy recovery path;
- zero mock/fake success w zamontowanym staging flow.

## Poza MVP

Audits i Meeting nie blokują mapy. Settings/Admin/Superadmin są warstwą platformową odbieraną po flow produktowych, ale ich auth/policy nie może blokować ani rozszczelniać testów.
