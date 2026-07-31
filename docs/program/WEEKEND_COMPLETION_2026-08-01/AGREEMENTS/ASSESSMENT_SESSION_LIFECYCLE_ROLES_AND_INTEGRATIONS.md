---
document_id: ASSESSMENT-LIFECYCLE-ROLES-INTEGRATIONS
module: Assessment
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Assessment — lifecycle, role i integracje

## 1. Lifecycle

`Draft → Prepared → In interview → Evidence pending → Consolidation → In
review → Ready to freeze → Score frozen → Output published → Closed →
Reassessment due → Archived`

Statusy są stanami jednego Assessment Process widocznego w Processes, nie
oddzielnymi ekranami ani tabelami.

## 2. Role procesu

- Assessment Owner — cel, scope i zamknięcie;
- Lead Assessor — metoda i jakość;
- Assessor — proposals i score decisions;
- Respondent — odpowiedzi i evidence;
- Evidence Owner — dostarczenie/aktualność artefaktu;
- Reviewer — calibration i kontrola;
- Approver — freeze/output approval;
- Observer — kontrolowany odczyt.

Role procesu są nakładane na role aplikacji i role projektu opisane w
[`PROJECT_TEAM_ROLES_AND_PIPELINE_GOVERNANCE.md`](PROJECT_TEAM_ROLES_AND_PIPELINE_GOVERNANCE.md).
Workbench nie tworzy własnego katalogu osób ani niezależnego „zespołu”.

## 3. Prosty default governance

- Assessment Owner zatwierdza brief/scope;
- Lead Assessor uruchamia i odpowiada za metodę;
- Assessor przygotowuje score proposals;
- Reviewer rozwiązuje wyjątki;
- Approver zamraża baseline;
- ta sama osoba może łączyć role w małym projekcie, jeśli policy pozwala i
  konflikt jest jawny.

Konfiguracja organizacji może zaostrzyć workflow, ale default nie wymaga
budowania osobnego komitetu.

## 4. Integracje zamiast duplikatów

| Potrzeba | System prawdy |
| --- | --- |
| osoby, jednostki, uprawnienia | Organization/Admin |
| projekt i zespół | Projects/project roles |
| osobiste zadania i decyzje | My Work |
| pliki i raporty | Materials |
| rozmowy źródłowe | Interview |
| Proposal Drafts | Assessment/Initiatives tab |
| zarejestrowane inicjatywy | Initiatives |
| KPI efektów | Results |
| notyfikacje | wspólny Notification service |
| activity/version history | wspólne utilities i audit log |

Assignments istnieją jako widoki w Processes/Workbench oraz projekcje My Work,
nie jako szósta zakładka Assessment.

## 5. Permissions

Permissions rozdzielają scope Assessmentu, jednostki oceny, evidence i output.
Respondent może otrzymać dostęp tylko do przypisanych jednostek. Widoczność
końcowego score przed freeze jest polityką procesu. Teresa respektuje te same
permissions co wywołujący użytkownik.
