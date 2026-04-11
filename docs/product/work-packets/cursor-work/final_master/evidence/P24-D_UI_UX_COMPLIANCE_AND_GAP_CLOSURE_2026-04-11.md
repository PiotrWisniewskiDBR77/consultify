# P24-D — UI/UX compliance audit + gap closure (2026-04-11)

Packet: **P24-D** (post-verification hardening)
Depends on: **P24-C verified(evidence)** (`98bf75bf8a`)

## 1) Audit scope

Full UI/UX Golden Standard V3 compliance audit of the Templates tab in Outputs hub,
plus contract gap closure for deprecation flow (§2.3.3) and error handling parity.

Reference: `docs/ui-standards/UI_UX_CANON_V3.md`, `golden-standard-table-cards-preview-v3.md`

## 2) Issues identified and resolved

### U1 + U10: Status column — custom render with TEMPLATE_STATUS_META

**Before:** No custom render on status column; `FilterableTable` default `StatusBadge` used — English-only, no semantic dot.
**After:** Added `TEMPLATE_STATUS_META` to `types.ts` (active/draft/deprecated/archived with PL/EN labels and dot colors). Custom render in `TemplatesTabContent` matches Reports/Presentations pattern.

Files: `types.ts`, `TemplatesTabContent.tsx`

### U2: Grid status mapping (ACTIVE → DRAFT bug)

**Before:** `item.status.toUpperCase()` yielded `ACTIVE` — missing from `GridView.STATUS_CONFIG`, fell back to `DRAFT`.
**After:** Explicit `gridStatusMap` translates template statuses to valid `STATUS_CONFIG` keys (`active→READY`, `draft→DRAFT`, `deprecated→ARCHIVED`, `archived→ARCHIVED`).

File: `TemplatesTabContent.tsx`

### U3: Grid card actions integration

**Before:** `GridView` received no `onItemAction` — card menu used default stubs disconnected from template flows.
**After:** `onItemAction` wired with template-specific handlers (open/duplicate/edit) for both report and presentation types.

File: `TemplatesTabContent.tsx`

### U4: TemplatePreview i18n

**Before:** Hardcoded English labels ("Scope:", raw `type`/`status`).
**After:** Full `useTranslation` integration with PL/EN labels, semantic status/type dots, structured key-value layout, and localized date formatting.

File: `previews/TemplatePreview.tsx`

### U6: Row actions completeness

**Before:** Clone only navigated for presentation; Edit only navigated for report. Other type had no-op handlers.
**After:** Both actions work for both types — report clone navigates to builder with templateArtifactId; presentation edit navigates to wizard with edit flag.

File: `TemplatesTabContent.tsx`

### U8 + G4: Deprecation flow

**Before:** `deprecated` status collapsed to `archived` in `mapTemplateStatus`; no deprecation badge, no `migrationHint`, no backend endpoint.
**After:**
- `TemplateStatus` type extended with `deprecated`
- `TemplateItem` extended with `deprecationReason?` and `migrationHint?`
- `mapTemplateStatus` preserves `deprecated` as distinct status
- `mapCanonicalTemplateArtifact` propagates deprecationReason + migrationHint from originSummary
- `TemplatePreview` shows amber deprecation banner with reason + migration hint
- `POST /api/artifacts/:id/deprecate` endpoint added (admin/owner only, updates originSummary)
- Filter options include `deprecated` state

Files: `types.ts`, `useRapData.ts`, `TemplatePreview.tsx`, `TemplatesTabContent.tsx`, `artifacts.routes.ts`

### U11: useTemplates error handling

**Before:** When both report and presentation template fetches returned non-OK, `setError(null)` was called with empty merged array — silent failure.
**After:** Explicit check for both-failed case sets descriptive error message.

File: `useRapData.ts`

## 3) Grid/table status mapping summary

| TemplateStatus | Table dot color | Table label (EN/PL) | Grid STATUS_CONFIG key |
|---|---|---|---|
| `active` | `bg-emerald-400` | Active / Aktywny | `READY` |
| `draft` | `bg-slate-400` | Draft / Szkic | `DRAFT` |
| `deprecated` | `bg-amber-500` | Deprecated / Wycofany | `ARCHIVED` |
| `archived` | `bg-slate-500` | Archived / Zarchiwizowany | `ARCHIVED` |

## 4) Deprecation endpoint contract

```
POST /api/artifacts/:id/deprecate
Authorization: Admin / Owner / Superadmin
Body: { reason?: string, migrationHint?: string }
Response 200: { data: { artifactId, status: 'deprecated', deprecationReason, migrationHint } }
Response 403: insufficient role
Response 404: artifact not found
Response 409: not a template artifact
```

## 5) Remaining bounded gaps (P1 — documented, not blocking)

| # | Gap | Bounded by | Follow-up |
|---|-----|-----------|-----------|
| G1 | `brandDefaults.source: 'org'` not wired to P30 at generation time | P24-B scope | P30 convergence wave |
| G2 | `qualityRules` not stored/enforced | P24-B scope | Template QA phase |
| G3 | `sampleContentPolicy` not implemented in save-as-template | P24-B scope | Full save-as-template doctrine |
| G5 | `PairedOutputTemplateFamily` uses form refs, not template IDs | Partial impl via TemplateFamily | Harmonize with existing reportsPresModelService |
| G6 | `logoUrl`/`fontFamily` missing from ResolvedOrganizationContext | P30 scope | P30 profile extension |
| G7 | Full schema fields (audienceDefaults, sourceExpectations, generationHints) | Progressive rollout | Next template schema wave |
| U5 | Category filter labels hardcoded EN | Cosmetic | i18n sweep |
| U7 | Double-click open not wired | Feature parity | Hub interaction sweep |
| U9 | Preview depth (Entity Meta Bar pattern) | Class-wide gap across all RAP tabs | Shared preview enrichment |
| U12 | Demo fallback unused in useTemplates | Feature parity | Demo data sweep |

## 6) P1 known limits — bounded by contract, not blocking verified status

These are explicitly bounded items per P24-B scope that remain as documented known limits.
They do not block the `verified(evidence)` status of P24-A/B/C/D.

### G1: brandDefaults.source: 'org' wiring (§2.3.4)
**Current state:** Presentations read brand kit from `/presentations/brand-kit` (separate endpoint). Reports do not apply org-level brand colors. `ResolvedOrganizationContext.profile` has `brandColor`/`accentColor` but no wiring to template generation flow.
**Follow-up:** P30 convergence wave — unify brand-kit resolution through `ResolvedOrganizationContext`.

### G2: qualityRules storage + enforcement (§2.3.1)
**Current state:** `qualityRules` field is defined in the contract schema but not stored in `originSummary.template` or enforced during generation.
**Follow-up:** Template QA phase — implement quality rule storage and pre-generation validation.

### G3: sampleContentPolicy (§2.3.1)
**Current state:** Save-as-template (`POST /artifacts/:id/save-as-template`) performs structural copy of sections/outline without applying strip/anonymize/preserve policy.
**Follow-up:** Full save-as-template doctrine — implement content stripping policies.

### G5: PairedOutputTemplateFamily with template IDs (§2.3.1)
**Current state:** `TemplateFamily` exists in `reportsPresModelService` with `formRefs` array. The contract requires `PairedOutputTemplateFamily` with explicit `reportTemplateId` + `presentationTemplateId` linking.
**Follow-up:** Harmonize with existing TemplateFamily, adding artifact-level template ID pairing.

### G6: logoUrl/fontFamily in ResolvedOrganizationContext (P30)
**Current state:** `ResolvedOrganizationContext.profile` has `brandColor` and `accentColor` only. `logoUrl` and `fontFamily` are not yet on the profile.
**Follow-up:** P30 profile extension.

### G7: Full schema fields (§2.3.1)
**Current state:** `audienceDefaults`, `sourceExpectations`, `generationHints` are defined in the contract. `originSummary.template` stores a subset (description, scope, structureBlueprint, metadata).
**Follow-up:** Progressive schema rollout in next template wave.

### U5: Category filter label i18n
**Current state:** Category filter options (R1-R4, executive_update, etc.) are English-only in `TemplatesTabContent`.
**Follow-up:** i18n sweep across all category labels.

### U7: Double-click row open
**Current state:** `onRowDoubleClick` not wired (Reports/Presentations have it).
**Follow-up:** Hub interaction sweep.

### U9: Preview depth (Entity Meta Bar pattern)
**Current state:** TemplatePreview shows title, type, status, scope, category, section/slide counts, deprecation banner. Missing full Entity Meta Bar (6.10a) with action targets, governance summary.
**Follow-up:** Class-wide shared preview enrichment across all RAP tabs.

### U12: Demo data fallback
**Current state:** `allowDemoData` is passed to `useTemplates` but unused in function body. Reports/Presentations have demo fallback paths.
**Follow-up:** Demo data sweep.

## 7) Verification

### Automated tests

```bash
npx vitest run \
  tests/integration/routes/artifacts.routes.test.ts \
  tests/unit/hooks/useTemplates.canonicalArtifacts.test.tsx
```

### Manual verification checklist

- [ ] Templates tab: status column shows semantic dots with PL/EN labels
- [ ] Grid view: active templates show as "READY" (green), not "DRAFT"
- [ ] Grid view: card actions (open/duplicate/edit) navigate correctly for both report and presentation
- [ ] Table: clone action works for report templates (navigates to builder)
- [ ] Table: edit action works for presentation templates (navigates to wizard)
- [ ] Preview: shows localized type/status/scope labels
- [ ] Preview: deprecated template shows amber banner with migrationHint
- [ ] Error: when artifact registry unavailable, error message appears (not silent empty)
- [ ] Filter: deprecated filter option visible in status column filters
