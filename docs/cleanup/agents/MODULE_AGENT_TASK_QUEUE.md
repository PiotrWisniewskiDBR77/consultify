# Consultify — kolejka pracy 16 agentów modułowych

Wersja kolejki: `1.0.0`

Wspólny kontekst: `SHARED_CONTEXT_16_MODULE_AGENTS.md`

Product authority: `6e31012fbe3458dd6a3faccde2e6540f7837d613`

Acceptance authority: `14c8852a71cdc5c8bf723a9b21f5e1cc00a467f5`

Stan startowy: `UNASSIGNED / DEPLOY_NOT_AUTHORIZED`

## 1. Jak uruchamiać agentów

Każdy agent dostaje:

1. pełny wspólny kontekst;
2. dokładnie jedną kartę `M01…M16` z tego pliku;
3. exact baseline wskazany przez integratora;
4. krótki lease, nazwany worktree i allowlist;
5. informację, czy pracuje w `PREDEPLOY`, czy `DEPLOYED_PARITY`.

Domyślny tryb to `PREDEPLOY_READ_ONLY`: agent odtwarza chain, sprawdza packet,
fixture i komendy, ale nie zmienia produktu. Po autoryzowanym deployu integrator
ustawia `DEPLOYED_PARITY` i podaje URL, product SHA, fixture authority oraz
zakres czasowy. Agent nie deployuje samodzielnie.

Każdy agent kończy jednym z werdyktów:

- `DONE` — wszystkie wymagane dowody łącznie z P;
- `FIX_REQUIRED` — reprodukowalny błąd z minimalnym defect packetem;
- `BLOCKED_ON_RELEASE` — brak deployu/URL/SHA/fixture, zero zmian produktu;
- `BLOCKED_ON_POLICY_OWNER` — brakuje jawnej decyzji biznesowej;
- `POST_MVP` — poza zakresem release, bez implementacji.

## 2. Globalne zadania integratora

### `MYW-REALDB-FIXTURE-AUTH-001`

- Cel: materialnie zamknąć jedyny jawny pending finalnego realDB gate.
- In-scope: ustalić ownera positive-control fixture My Work, uruchomić go na
  świeżym PG 719 albo zapisać formalną, source-backed dyspozycję non-product.
- Zakaz: nie zmieniać produktu, dopóki test nie reprodukuje błędu runtime.
- DONE: test wykonany i PASS albo zaakceptowana dyspozycja z ownerem,
  uzasadnieniem i replacement evidence; finalny realDB nie ma niewyjaśnionego
  pending.

### `REL-001-T01`

- Cel: deploy dokładnego product SHA i uzyskanie `P` dla wszystkich modułów.
- Wejście: jawna autoryzacja push/deploy, snapshot/rollback, produkt `6e3` albo
  formalnie nowszy zatwierdzony product SHA.
- Kroki: push nazwanej gałęzi bez force → predeploy migration gate → deploy →
  server/client SHA → DB ledger → flag/data readback → 16 BVP → rollback.
- DONE: wszystkie moduły mają `P=PASS` na tym samym SHA; rollback rehearsal
  PASS; demo nie ma pending/failed/skipped/drift.

## 3. Karty 16 agentów

### M01 — Chat / `CHAT-BVP-001`

- Stan kodu: zintegrowany; nie otwierać `CHAT-001…003`.
- Scope: `/chat`, `UnifiedChatPanel.tsx`, `useAIStream.ts`, `api.ts`,
  `/api/ai/chat/stream`, V8 chat, conversations/messages/attachments/receipts.
- Scenariusz: wiadomość + attachment + URL → citation → proposal → approve →
  jeden receipt → reload/cold reopen.
- Negatywy: tenant, reject/retry, duplicate/concurrent approval, provider/empty
  stream fail-closed, brak silent mutation.
- Zakaz: zmiana public contractu, legacy fallback, przejęcie Idea/Initiative/
  artifact ownership.
- DONE: deployed S/D/B/V/P, stabilna conversation i jeden owner receipt;
  rollback flag/SHA PASS.

### M02 — My Work + Agent / `MYW-AGT-BVP-001`

- Zależność: `MYW-REALDB-FIXTURE-AUTH-001` musi być rozstrzygnięty.
- Scope: `/my-work/*`, `MyWorkHub.tsx`, `AgentHubShell.tsx`, `/api/v8/my-work`,
  `/api/v8/transformation-cases`, My Work tables, `transformation_cases`.
- Scenariusz: event → inbox → decision/notebook/idea; conversation → ten sam
  case/plan → reload/reopen.
- Negatywy: tenant, stale Notebook CAS, role, retry/concurrency, stable IDs,
  canonical-only materialization.
- Zakaz: writer do `case_core` lub `ai_agent_plans`.
- DONE: fixture pending zamknięty, deployed P, stable IDs/readback i rollback.

### M03 — Interview / `INT-BVP-001`

- Scope: `/interview`, `/discovery`, `InterviewHub`, interview routes/services/
  assignments/answers/evidence/insights.
- Scenariusz: publish → invite → respond → resume → submit → approve insight →
  dokładnie jeden candidate → cold reopen.
- Negatywy: expiry/revoke, respondent wall, tenant, stale, retry/no-orphan,
  concurrent accept.
- Zakaz: nowy client rewrite lub drugi initiative writer.
- DONE: immutable answers i lineage, S/D/B/V/P, rollback zachowuje evidence.

### M04 — Tools / `TLS-BVP-001`

- Zakres release: wyłącznie Dynamic SWOT.
- Scope: `/discovery-tools`, `DiscoveryToolsHub.tsx`, `ToolController`,
  `ToolOutputsController`, `ToolInitiativeService`, sessions/outputs/reports.
- Scenariusz: mission/cards/evidence → review → approve immutable output →
  report/presentation/candidate → reopen.
- Negatywy: 409/428, tenant, race, replay, nonempty frozen output.
- Zakaz: implementowanie kolejnych Tools albo Initiative ownership.
- DONE: nonempty lineage i deployed S/D/B/V/P; pozostałe tools = POST_MVP.

### M05 — Assessment / `ASM-BVP-001`

- Zakres release: wyłącznie DRD.
- Scope: `/assessment/*`, `AssessmentHub`, `AssessmentSessionEditorView`, V8/
  workflow-v2/report services, method/session/report tables.
- Scenariusz: Library → session → answers/evidence → review/freeze → immutable
  report → initiative batch → cold reopen.
- Negatywy: tenant/role, stale/replay, duplicate batch, correct version owner.
- Zakaz: rich SIRI/ADMA viewers, drugi registry/writer, runtime DDL.
- DONE: dokładnie jedna metodologia/version/batch oraz deployed S/D/B/V/P.

### M06 — Initiatives / `INI-BVP-001`

- Scope: `/initiatives`, `InitiativesHub`, initiatives/PMO controllers/services,
  initiatives/history/gates/receipts.
- Scenariusz: approved candidate → jedna Initiative → gate → jeden Execution
  handoff → reopen.
- Negatywy: wymagany tenant project, capability/role, stale, retry/concurrency,
  payload collision.
- Zakaz: nowy producer lub drugi lifecycle writer.
- DONE: jedna row/receipt/downstream ID, deployed S/D/B/V/P, rollback.

### M07 — Execution / `EXE-BVP-001`

- Scope: `/execution`, `ExecutionHub`, execution/control APIs, PMO services,
  execution/work/gates/evidence tables.
- Scenariusz: Initiative card → case → work/resource/control/report → approved
  delivery evidence → dokładnie jeden Results signal → reload.
- Negatywy: blocked/recovery, tenant, role, replay/concurrency, evidence
  niezależne od task status.
- Zakaz: retired light shell i techniczna tabela jako główny UX.
- DONE: jeden health model, append-only result, deployed S/D/B/V/P.

### M08 — Results / `RES-BVP-001`

- Scope: `/results/kpi|roi|okr`, ResultsVNext, `/api/vnext/results/*`, RVN data.
- Scenariusze: KPI observation→deviation→plan→effectiveness; ROI baseline→
  actual→variance→PIR; OKR objective/KR→check-in→reflection.
- Negatywy: tenant/visibility, self-approval, stale, replay/concurrency,
  append-only history.
- Dodatkowo: deployed flag registry/readback, bez query/localStorage.
- Zakaz: legacy shell lub nowe Results ownership.
- DONE: trzy flows i exact flags na deployed SHA; rollback flag/SHA.

### M09 — Finance / `FIN-BVP-001`

- Status: bounded/post-MVP; nie otwierać `FIN-001…003`.
- Scope: `/finance`, `FinanceHub`, finance-v2/v3 bridge, five workspaces,
  finance-v3 entities.
- Scenariusz: statement → baseline → prediction → analysis → valuation →
  approve/export/reopen.
- Negatywy: unresolved IDs=0, missing-vs-zero, precision, RLS/tenant, replay,
  persisted Base/Bull/Bear workbook.
- Zakaz: rozszerzenie Finance lub przejęcie Results Actual.
- DONE: bounded deployed D/B/V/P, stabilne export IDs i rollback.

### M10 — Materials / `MAT-BVP-001`

- Scope: launcher → Document Studio/Presentations/Excele; artifact registry,
  native routes/services/versions.
- Scenariusz: otwórz istniejący real DOC/PPT/XLSX → edit → version → export →
  reopen; zachowaj format/formuły/lineage.
- Negatywy: provider unavailable, lease/CAS, four-eyes, tenant/concurrency,
  przegrany autosave nie zapisuje snapshotu.
- Zakaz: revival starych Studio/Wizard/provider implementations.
- DONE: trzy edytowalne pliki i deployed S/D/B/V/P; provider rollback.
- Policy: `MAT-POL-001` pozostaje `BLOCKED_ON_POLICY_OWNER`.

### M11 — Audits / `AUD-BVP-001`

- Zakres release: bounded beta `/audit-programs`.
- Scenariusz: create → save → cold reopen → delete; route/menu/badge/API są
  zgodne.
- Negatywy: tenant/role, stale/replay, ordinary member read-only.
- Zakaz: scalanie `/api/audit` i `/api/audits`, claim pełnego Method Audit.
- DONE: beta-only deployed S/D/B/V/P oraz rollback route flag/SHA.
- Post-MVP: `AUD-002` bez implementacji w tej fali.

### M12 — Meeting / `MTG-BVP-001`

- Scope: `/meeting`, `MeetingHub`, meeting API/service, meetings/participants/
  notes/outputs/idempotency/audit.
- Scenariusz: create → agenda/materials → notes → proposal → approve → dokładnie
  jeden task + decision + material → reopen.
- Negatywy: consent, tenant, role, stale/replay/concurrency, audit retention.
- Zakaz: przejęcie Task/Decision ownership.
- DONE: dokładna cardinality/readback i deployed S/D/B/V/P.
- Policy: `MTG-POL-001` wymaga decyzji consent/retention.

### M13 — Organization / `ORG-BVP-001`

- Scope: `/organization/*`, Organization views, context/claims/profile/KG
  services, org/claims/sources/snapshots.
- Scenariusz: document → claim proposal → approve → immutable snapshot → Chat
  request z exact refs → reopen.
- Negatywy: conflict, source deletion, tenant/confidentiality, no draft leak.
- Zakaz: nowy KG model lub drugi profile writer.
- DONE: snapshot/reference equality i deployed S/D/B/V/P.

### M14 — Admin / `ADM-BVP-001`

- Scope: `/admin/*`, IAM/invite/role/revoke/security/audit; `/superadmin/*` poza
  tym taskiem.
- Scenariusz: invite → accept → role → revoke → new session.
- Negatywy: last-owner, cross-org, stale role, no-capability, hidden controls,
  audit before/after.
- Zakaz: zmiana capability policy i przejęcie Settings/SuperAdmin ownership.
- DONE: każda mutacja scoped/audited, deployed S/D/B/V/P i rollback.

### M15 — Settings / `SET-BVP-001`

- Scope: `/settings/*`, profile/language/theme/notifications/AI preferences,
  storage i secret non-readback.
- Scenariusz: save → DB readback → reload → new session → widoczny efekt.
- Negatywy: tenant-forced lock, no-op/error bez fake success, secret nie wraca,
  mobile/a11y.
- Zakaz: tenant policy; OAuth/MFA/export/delete pozostają `SET-002 POST_MVP`.
- DONE: cross-session effect i deployed S/D/B/V/P, kompatybilny rollback.

### M16 — Partner Portal / `PRT-BVP-001`

- Zakres release: bounded authenticated V8 connect/read.
- Scope: `/partner/*`, Partner shell, V8 partner routes/services, partner/
  referral/ledger data.
- Scenariusz: register/connect → certification → code → read attribution →
  reopen.
- Negatywy: expiry, tenant/partner isolation, retry/concurrency, zero fabricated
  payout i zero legacy fallbacku.
- Zakaz: nowa implementacja partnera lub payout bez policy.
- DONE: bounded deployed S/D/B/V/P i rollback; nie claimuje full payout.
- Policy/post-MVP: `PRT-POL-001`, pełny `PRT-002/003`.

## 4. Rejestr lease i wyników

Integrator uzupełnia przed startem. Dwa wiersze nie mogą rezerwować tego samego
shared path ani migration slotu.

| Agent | Task            | Tryb       | Baseline | Worktree/branch | Allowlist hash | Lease | Wynik | Commit | Evidence | Integracja |
| ----- | --------------- | ---------- | -------- | --------------- | -------------- | ----- | ----- | ------ | -------- | ---------- |
| M01   | CHAT-BVP-001    | UNASSIGNED | —        | —               | —              | —     | —     | —      | —        | —          |
| M02   | MYW-AGT-BVP-001 | UNASSIGNED | —        | —               | —              | —     | —     | —      | —        | —          |
| M03   | INT-BVP-001     | UNASSIGNED | —        | —               | —              | —     | —     | —      | —        | —          |
| M04   | TLS-BVP-001     | UNASSIGNED | —        | —               | —              | —     | —     | —      | —        | —          |
| M05   | ASM-BVP-001     | UNASSIGNED | —        | —               | —              | —     | —     | —      | —        | —          |
| M06   | INI-BVP-001     | UNASSIGNED | —        | —               | —              | —     | —     | —      | —        | —          |
| M07   | EXE-BVP-001     | UNASSIGNED | —        | —               | —              | —     | —     | —      | —        | —          |
| M08   | RES-BVP-001     | UNASSIGNED | —        | —               | —              | —     | —     | —      | —        | —          |
| M09   | FIN-BVP-001     | UNASSIGNED | —        | —               | —              | —     | —     | —      | —        | —          |
| M10   | MAT-BVP-001     | UNASSIGNED | —        | —               | —              | —     | —     | —      | —        | —          |
| M11   | AUD-BVP-001     | UNASSIGNED | —        | —               | —              | —     | —     | —      | —        | —          |
| M12   | MTG-BVP-001     | UNASSIGNED | —        | —               | —              | —     | —     | —      | —        | —          |
| M13   | ORG-BVP-001     | UNASSIGNED | —        | —               | —              | —     | —     | —      | —        | —          |
| M14   | ADM-BVP-001     | UNASSIGNED | —        | —               | —              | —     | —     | —      | —        | —          |
| M15   | SET-BVP-001     | UNASSIGNED | —        | —               | —              | —     | —     | —      | —        | —          |
| M16   | PRT-BVP-001     | UNASSIGNED | —        | —               | —              | —     | —     | —      | —        | —          |

## 5. Szablon finalnej odpowiedzi agenta

```text
TASK_ID:
AGENT_ID:
BASELINE_SHA:
PRODUCT_SHA_TESTED:
MODE: PREDEPLOY_READ_ONLY | DEPLOYED_PARITY
VERDICT: DONE | FIX_REQUIRED | BLOCKED_ON_RELEASE | BLOCKED_ON_POLICY_OWNER | POST_MVP

MOUNTED_CHAIN_VERIFIED:
OWNER_TABLES_AND_WRITERS:
INVARIANTS_PROVED:
NEGATIVES_PROVED:

COMMANDS_AND_EXIT_CODES:
DB_LEDGER_AND_FIXTURE_IDS:
BROWSER_VISUAL_EVIDENCE:
ARTIFACT_SHA256:

FILES_CHANGED:
COMMIT_SHA:
ALLOWLIST_DIFF:
ROLLBACK_RESULT:
CLEANUP_RESULT:

OPEN_ITEMS:
INTEGRATOR_ACTION:
```

Agent nie kończy odpowiedzi słowem „gotowe” bez wypełnienia wszystkich pól.
