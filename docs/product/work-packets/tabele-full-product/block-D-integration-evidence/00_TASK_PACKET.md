# Task Packet — Block D: Integration & Evidence

**Block ID:** `TABELE_BLOCK_D_INTEGRATION_EVIDENCE`
**Template:** `.cursor/TASK_PACKET_TEMPLATE.md`
**Created:** 2026-05-07
**Status:** `PLANNED`

---

## 1) Goal

Tie Tabele to the rest of Consultify: from any Tabele table the user can convert to Wordy document or Prezentacje deck respecting V8 snapshot + provenance + QA report; convert any Tabele Form into an external-facing intake app that writes records back with provenance. Run Anygravity P0 trial #2 against the full product surface. Compile full manual evidence pack and final program closeout.

## 2) Non-Goals

- No new template content (Block A).
- No record provenance schema changes (Block B).
- No new AI editor levels (Block C).
- No mobile-native apps (out of program).
- No external-system integrations beyond URL+JWT-link forms (out of program).

## 3) Constraints

### Technical
- Reuse existing `WordyArtifactService` and `PrezentacjeArtifactService` for the conversion targets; add `TableArtifactConversionService` as bridge.
- V8 snapshot from `SourcePackService` is the canonical input to the conversion service.
- Form intake reuses existing `FormService`; new `Form.embedTargetTableId` config + JWT-tokenized public link.
- All new endpoints: cross-tenant 403; rate-limited per existing pattern.
- Foundation Block files untouched except: `KimiWorkspaceShell` Menu 3 right-slot adds 1–2 buttons.

### Product / UX
- "Convert to Document" / "Convert to Presentation" buttons live in Menu 3 right-slot of `KimiWorkspaceShell` when lane=tabele.
- Conversion shows toast "Generating Wordy document…" → opens new lane on success; deep-link preserved.
- Form-to-intake conversion: button "Create intake form" in `TabeleView` opens dialog → publishes form → returns shareable link.
- Form submission lands as `tp_records` row with sources type `form_submission`.
- All copy in EN + PL.

### Safety / security
- JWT-link forms: token expiry; tenant scoped; field-level allow-list for public submissions.
- Conversion service never reads records actor cannot see.
- AI assist on Form responses (optional in this block) goes through proposal queue.

## 4) Scope

### In scope — files to CREATE

**Backend**
- `consultify/server/src/services/tablePlatform/TableArtifactConversionService.ts`
- `consultify/server/src/services/tablePlatform/FormIntakeService.ts`
- `consultify/server/src/services/tablePlatform/migrations/2026_05_block_d_form_intake.sql` (extends existing `tp_forms` with `embed_target_table_id`, `public_jwt_secret`, `field_allow_list`)
- `consultify/server/src/routes/table-platform.conversion.routes.ts`
- `consultify/server/src/routes/table-platform.form-intake.routes.ts`
- `consultify/server/src/routes/table-platform.form-public.routes.ts` (public-facing JWT-validated submit endpoint)
- Tests for everything above.

**Frontend**
- `consultify/src/components/AIChat/KimiWorkspace/conversion/TabeleConvertButton.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/conversion/ConversionToast.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/formIntake/CreateIntakeFormDialog.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/formIntake/IntakeFormPreview.tsx`
- Public-facing intake form: `consultify/src/components/PublicIntakeForm/PublicIntakeForm.tsx` (lives at `/public/forms/:token`)
- Component tests.

**Docs**
- This packet folder.
- `consultify/docs/product/TABLE_TO_ARTIFACT_CONVERSION_V1.md`.
- `consultify/docs/product/FORM_AS_INTAKE_APP_V1.md`.

### In scope — files to UPDATE (additive only)

- `consultify/server/src/services/tablePlatform/FormService.ts` — add `embedTargetTableId`, `publicJwtSecret`, `fieldAllowList` config; add `submitFromPublic` path.
- `consultify/server/src/index.ts` — mount new route modules.
- `consultify/src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx` — Menu 3 right-slot adds "Convert to Document" / "Convert to Presentation" / "Create intake form" buttons (lane=tabele).
- `consultify/src/components/AIChat/KimiWorkspace/TabeleView.tsx` — embeds intake-form dialog launcher.
- `consultify/src/AppRoutes.tsx` — adds `/public/forms/:token` route (no auth required, JWT validated).
- `consultify/public/locales/{en,pl}/translation.json` — ~40 keys.

### Files explicitly OUT OF SCOPE

- `useKimiArtifactPipeline.ts`, `TabelePreviewLayout.tsx`, `RelationExplainabilityService.ts` (Foundation Block).
- All Block A / B / C owned files (only consumed via documented APIs).
- All Wordy / Excele / Prezentacje internals (only consumed via existing artifact creation services).

## 5) Definition Of Done

### Functional
- [ ] "Convert to Document" produces Wordy artifact reflecting Tabele V8 snapshot + provenance.
- [ ] "Convert to Presentation" produces Prezentacje artifact same way.
- [ ] "Create intake form" publishes a form with shareable JWT link.
- [ ] Public form submission lands record with sources `[{type:'form_submission', source_ref: form_id}]`.
- [ ] Anygravity P0 trial #2 PASS on full product surface.
- [ ] Manual evidence pack compiled.
- [ ] EN + PL i18n complete.

### Validation
- [ ] All lint / typecheck clean.
- [ ] All tests green.
- [ ] Cross-tenant 403 on every new endpoint.
- [ ] JWT-link tokens have hard expiry.
- [ ] Public form rate-limited.

### Evidence
- All filled in `03_BLOCK_CLOSEOUT.md`.
- Demo recording: full e2e (open Tabele → AI Editor edit → QA report → convert to Wordy → publish intake form → external user submits).
- Final program closeout: `TABLE_STUDIO_FULL_PRODUCT_CLOSEOUT.md`.

## 6) Risk Notes

See `02_RISK_REGISTER.md`. Top risks:

- **D-T1** Conversion to Wordy/Prezentacje uses different V8 snapshot shape; shape drift kills round-trip. Mitigation: shared V8 snapshot service + contract tests.
- **D-S1** Public JWT-link form leaks tenant data via field harvest. Mitigation: field allow-list + token expiry + rate limit.
- **D-P1** Conversion takes too long; user closes tab before completion. Mitigation: async job + email/notification on complete.
- **PR3 / Anygravity #2** Trial reveals integration breakage. Mitigation: trial scheduled with dedicated 0.5-day buffer in S6.

### Rollback strategy

- Tier 1: feature flag `featureTabeleIntegrationEnabled=false` → conversion buttons hidden, intake forms refuse public submissions.
- Tier 2: code revert.
- Tier 3: migration rollback (drop new `tp_forms` columns).

---

## Sign-off

- Block lead: ___ (waiting for Block C `GO`)
- UI/UX reviewer: ___
- Security reviewer: ___
- Date: ___
