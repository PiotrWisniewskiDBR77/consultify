# EPIC-4 — Integration, Intent Routing, i18n, A11y

**Owner:** Agent D (orchestrator + integration lead)
**Sprint:** Sprint 4 (orchestrator) + Sprint 5 (intent routing + i18n)
**Status:** `PLANNED`
**Depends on:** EPIC-1 (lane scaffolding), EPIC-2 (preview components), EPIC-3 (relations/explain endpoint)
**Blocks:** Sprint 6 (validation matrix), Sprint 7 (closeout)

## Epic goal

Wire the Tabele lane end-to-end: build the `TabeleView` orchestrator (mirror of `PrezentacjeView`), implement the chat intent-routing patterns, deliver the builder deep-link with transition toast (Option A per D3 working assumption), and complete EN+PL i18n + a11y. Output: a Tabele lane that a user can drive from chat to materialized table to opened builder, with intent commands fully working.

## Acceptance criteria (epic-level)

- AC-4.0.1 `/tabele` end-to-end: home → goal → split-screen Word-canvas → governance proposals visible → builder deep link → transition toast.
- AC-4.0.2 6 intent-routing patterns work in chat (`/export`, `/add column`, `/summarize`, `/open builder`, `/explain relation`, `/propose schema`).
- AC-4.0.3 ~25 EN+PL i18n keys present in `locales/{en,pl}/translation.json`; `npm run i18n:check` passes.
- AC-4.0.4 a11y: keyboard nav on canvas sections + chips; aria labels; reduced-motion respected.
- AC-4.0.5 Reopen-from-library deep link `?artifactId=...` hydrates preview correctly.
- AC-4.0.6 Component test grid green (L3.1).
- AC-4.0.7 E2E smoke green (L5.1, L5.2, L5.3).

## User stories

### US-4.1 — `tabeleSystemPrompt.ts`

**Files**
- `consultify/src/components/AIChat/KimiWorkspace/tabeleSystemPrompt.ts` (CREATE)

**Content (English; analogue of `EXCELE_SYSTEM_PROMPT` and `PREZENTACJE_SYSTEM_PROMPT` in their respective views)**

```typescript
export const TABELE_SYSTEM_PROMPT = `You are an operational table architect in Consultify Table Studio.
Your role is to help users design relational tables that operate as living organizational systems:
master data registries, role tables, OKR sets, decision logs, incident logs, vendor masters, and more.

When the user describes a table they want:
1. Understand the entity, columns, relations, and operating rules.
2. Propose a schema (fields + types + relations + governance state) — every schema-altering action goes through proposal → approval → execution → audit.
3. Propose initial seed records when relevant.
4. Surface governance state explicitly: "I'll create a proposal for this. Approve to execute."
5. Show your work: cite source artifacts; never auto-execute schema changes.

You can reference:
- Linked tables (relations) — every link is explainable.
- Existing organizational context (workspace, projects, prior tables).
- Schema proposals already pending approval.

When the user provides a prompt, briefly state your plan, propose a schema, and let governance approve.
If the user gives an instruction, suggest the proposed change and surface the proposal id for review.`;
```

**Acceptance criteria**
- AC-4.1.1 Module-scoped constant; no logic.
- AC-4.1.2 Mentions governance invariant explicitly.
- AC-4.1.3 No record-body interpolation (no XSS / injection vector).

**Estimate:** 0.25 d

---

### US-4.2 — `TabeleView.tsx` orchestrator

**Files**
- `consultify/src/components/AIChat/KimiWorkspace/TabeleView.tsx` (CREATE)
- `consultify/src/components/AIChat/KimiWorkspace/index.ts` (UPDATE — re-export)

**Skeleton (mirror `PrezentacjeView.tsx` exactly)**

- `useKimiArtifactPipeline('tabele')`
- `useSearchParams` for `artifactId`, `templateArtifactId`, `templatePrompt`, `view=new`
- `showHome` gating identical to siblings
- Auto-trigger ladder: `templatePrompt` → `templateArtifactId` (via `Api.get('/artifacts/:id')`) → `activeMessages` heuristic
- Reopen-from-library effect: `Api.get('/table-platform/tables/:tableId')` + `listRecords` + `listSchemaProposals` + (lazy) `explainRelation` for chip rationale
- Post-generation chat intent routing (US-4.3)
- `effectivePreview = pipeline.preview || reopenPreview`
- `effectiveCompleted = pipeline.isCompleted || (!!reopenPreview && !pipeline.currentRun)`
- `handlePreviewFile` → opens `/my-work/sheets/:workspaceId/tables/:tableId` (Option A) in new tab
- `handleAllFiles` → opens `/presentations?tab=sheets` (existing pattern)
- `handleDownload` → `tabeleArtifactOpen.downloadTabeleArtifactCsv(tableId)`
- Returns either `<ArtifactModuleHome lane="tabele" />` or `<KimiWorkspaceShell lane="tabele" ... />`

**Acceptance criteria**
- AC-4.2.1 Component compiles and renders.
- AC-4.2.2 Auto-trigger ladder behaves identically to `PrezentacjeView` (same effect order, same guards).
- AC-4.2.3 Reopen path tolerates missing relations / proposals gracefully.
- AC-4.2.4 `chatSystemPrompt={TABELE_SYSTEM_PROMPT}` passed.
- AC-4.2.5 Component test (L3.1): home renders → goal triggers `startGeneration` → after pipeline completion, `<TabelePreviewLayout>` is rendered.

**Estimate:** 1.5 d

---

### US-4.3 — Intent routing patterns

**Files**
- `consultify/src/components/AIChat/KimiWorkspace/TabeleView.tsx` (UPDATE — add intent routing useEffect)
- `consultify/src/utils/tabeleArtifactOpen.ts` (CREATE — utility)

**Patterns (mirror `PrezentacjeView.tsx` lines 247–304)**

| Pattern (regex) | Handler |
|---|---|
| `/export\s*csv\|pobierz\s*csv\|download\s*csv/` | `window.open(/api/table-platform/tables/:id/export.csv)` |
| `/export\s*xlsx\|pobierz\s*xlsx\|download\s*xlsx/` | `window.open(/api/workbook/:id/download)` (existing path) |
| `/export\s*json\|pobierz\s*json/` | `window.open(/api/table-platform/tables/:id/export.json)` |
| `/add\s*column.*\|dodaj\s*kolumn/` | `Api.post('/api/table-platform/schema/proposals', { workspaceId, intent: lastUserMsg })` then surface proposal id toast |
| `/summari[sz]e\|podsum/` | `Api.post('/api/table-platform/schema/proposals', { workspaceId, intent: 'Summarize this table' })` |
| `/open\s*builder\|otwórz\s*builder\|edytuj/` | `window.open('/my-work/sheets/:workspaceId/tables/:tableId')` + transition toast |
| `/explain\s*relation\|wyjaśnij\s*relacj/` | `Api.get('/api/table-platform/tables/:id/records/:rid/relations/explain')` then post rationale to chat |
| `/propose\s*schema\|zaproponuj\s*schemat/` | `Api.post('/api/table-platform/schema/proposals', { workspaceId, intent: lastUserMsg })` |

**Acceptance criteria**
- AC-4.3.1 Each pattern matches the listed regex (case-insensitive, EN + PL).
- AC-4.3.2 Each handler surfaces a toast (success / error) with i18n message.
- AC-4.3.3 Last-routed-msg ref prevents double-firing on re-renders (mirror Prezentacje pattern).
- AC-4.3.4 Intent routing is gated by `pipeline.isCompleted` AND `tableId` resolved.
- AC-4.3.5 Component test exercises 3 of the 8 patterns (export csv, open builder, explain relation).

**Estimate:** 1.5 d

---

### US-4.4 — Builder deep-link with transition toast (Option A)

**Files**
- `consultify/src/utils/tabeleArtifactOpen.ts` (CREATE — also serves US-4.3)

**Utility shape**

```typescript
import { resolveTablePlatformWorkspaceIdForTable } from './sheetArtifactOpen';

export async function buildTableBuilderOpenPath(tableId: string): Promise<string | null> {
  const workspaceId = await resolveTablePlatformWorkspaceIdForTable(tableId);
  if (!workspaceId) return null;
  return `/my-work/sheets/${workspaceId}/tables/${tableId}`;
}

export async function openTableBuilderInNewTab(tableId: string, t: TFunction): Promise<boolean> {
  const path = await buildTableBuilderOpenPath(tableId);
  if (!path) {
    toast.error(t('tabele.builderUnreachable', 'Could not resolve workspace for this table'));
    return false;
  }
  toast.success(t('tabele.openingBuilder', 'Opening Table Builder…'), { duration: 2000 });
  window.open(path, '_blank', 'noopener,noreferrer');
  return true;
}

export async function downloadTabeleArtifactCsv(tableId: string): Promise<boolean> {
  // delegates to existing /api/table-platform/tables/:id/export.csv if present;
  // falls back to existing downloadSheetArtifactXlsx pattern
}
```

**Acceptance criteria**
- AC-4.4.1 `openTableBuilderInNewTab` always opens in `_blank` with `noopener,noreferrer`.
- AC-4.4.2 Toast appears BEFORE `window.open` (so user sees feedback even if popup blocker fires).
- AC-4.4.3 Failure path surfaces a friendly error toast.
- AC-4.4.4 Reuses `resolveTablePlatformWorkspaceIdForTable` from existing `sheetArtifactOpen.ts` (no duplicate logic).
- AC-4.4.5 Component test stubs `window.open` and asserts call args.

**Estimate:** 0.5 d

---

### US-4.5 — i18n EN + PL (~25 keys)

**Files**
- `consultify/public/locales/en/translation.json` (UPDATE — additive)
- `consultify/public/locales/pl/translation.json` (UPDATE — additive)

**Keys (canonical list)**

```
sidebar.tabele                           "Table Studio"  /  "Tabele Studio"
kimi.laneTabele                          "Tabele"  /  "Tabele"
kimi.emptyTabele                         "Your operational table will appear here"  /  "Twoja tabela operacyjna pojawi się tutaj"
kimi.generateTable                       "Generate Table"  /  "Wygeneruj tabelę"
kimi.generatingTable                     "Building your operational table"  /  "Buduję tabelę operacyjną"
kimi.openInBuilder.tabele                "Open in Table Builder"  /  "Otwórz w Builderze tabel"
tabele.kpi.rows                          "Rows"  /  "Wiersze"
tabele.kpi.columns                       "Columns"  /  "Kolumny"
tabele.kpi.status                        "Status"  /  "Status"
tabele.kpi.format                        "Format"  /  "Format"
tabele.section.schema                    "Schema"  /  "Schemat"
tabele.section.records                   "Records"  /  "Rekordy"
tabele.section.relations                 "Relations"  /  "Relacje"
tabele.section.rationale                 "AI Rationale"  /  "Uzasadnienie AI"
tabele.governance.committed              "Committed"  /  "Zatwierdzone"
tabele.governance.proposed               "Proposed"  /  "Zaproponowane"
tabele.governance.rejected               "Rejected"  /  "Odrzucone"
tabele.proposalStatus.pending            "Pending"  /  "Oczekujące"
tabele.proposalStatus.approved           "Approved"  /  "Zatwierdzone"
tabele.proposalStatus.rejected           "Rejected"  /  "Odrzucone"
tabele.tooltip.relationLoading           "Loading rationale…"  /  "Ładuję uzasadnienie…"
tabele.tooltip.aclDenied                 "Insufficient permissions"  /  "Brak uprawnień"
tabele.openingBuilder                    "Opening Table Builder…"  /  "Otwieram Builder tabel…"
tabele.builderUnreachable                "Could not resolve workspace for this table"  /  "Nie udało się odnaleźć workspace'u tabeli"
tabele.intentRouted.exportCsv            "CSV export started"  /  "Eksport CSV uruchomiony"
tabele.intentRouted.proposalQueued       "Proposal queued for review"  /  "Propozycja dodana do kolejki"
tabele.intentRouted.failed               "Could not process that instruction"  /  "Nie udało się przetworzyć polecenia"
```

**Acceptance criteria**
- AC-4.5.1 Both files updated; `npm run i18n:check` passes.
- AC-4.5.2 No hardcoded English/Polish in source code; every visible string via `t(key, defaultValue)`.
- AC-4.5.3 Existing keys unchanged.

**Estimate:** 0.5 d

---

### US-4.6 — A11y on canvas + chips

**Acceptance criteria**
- AC-4.6.1 Every section header is `<h2 id="..."><section aria-labelledby="...">` (US-2.1).
- AC-4.6.2 Every chip is `<button>` with keyboard activation (Enter/Space) (US-2.3).
- AC-4.6.3 Tooltip rendered with `role="tooltip"` and `aria-describedby` linkage.
- AC-4.6.4 Reduced-motion CSS active when `prefers-reduced-motion: reduce`.
- AC-4.6.5 Color-only state indicators have a paired text label or icon (governance pills).
- AC-4.6.6 Manual smoke with VoiceOver / NVDA screen reader (recorded in closeout).

**Estimate:** 0.75 d

---

### US-4.7 — E2E smoke spec

**Files**
- `consultify/tests/e2e/smoke/tabele-foundation.spec.ts` (CREATE)

**Scenarios**
1. Login → navigate to `/tabele` → ArtifactModuleHome renders → 8 builtin templates visible.
2. Click "Start new" → split-screen Word-canvas appears → goal input shown.
3. Enter goal → pipeline kicks off → preview eventually shows tabele type.
4. Click "Open in Builder" → new tab opens to `/my-work/sheets/:workspaceId/tables/:tableId` → transition toast appeared.
5. Reopen-from-library: navigate to `/tabele?artifactId=:tableId` → preview hydrates from library data without pipeline.

**Acceptance criteria**
- AC-4.7.1 Spec runs against staging or mocked backend.
- AC-4.7.2 All 5 scenarios PASS.
- AC-4.7.3 Spec is hermetic (no leaked state between scenarios).

**Estimate:** 1 d

---

## Sprint mapping

- **Sprint 4 (Agent D):** US-4.1, US-4.2, US-4.4 (orchestrator + builder deep-link).
- **Sprint 5:** US-4.3, US-4.5, US-4.6, US-4.7 (intent routing + i18n + a11y + e2e).

## Total estimate

~6 d single-agent, split across two sprints.

## Dependencies on other epics

- **EPIC-1** US-1.5 (lane mapping in pipeline) MUST be merged before US-4.2.
- **EPIC-2** US-2.1–US-2.5 MUST be merged before US-4.2.
- **EPIC-3** US-3.2 (route) MUST be merged before US-4.3 (`/explain relation` pattern).

## Out of scope (do NOT do in this epic)

- Building preview components → EPIC-2.
- Building backend service/route → EPIC-3.
- Persistent caching of relation explain results → TBL-FU-1.
- Real schema proposal review UI inside the Tabele canvas (only status pill + link to existing review surface).
