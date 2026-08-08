# Documents / Templates acceptance matrix — 2026-08-07

This matrix separates four different claims that must not be conflated:

1. the reusable template exists in the deployed library;
2. `Use template` opens the correct template-to-artifact generator with lineage;
3. the reusable template itself is editable through the correct template builder;
4. the generated independent artifact passes content, visual, persistence and
   native-export acceptance.

`PASS` is used only where deployed runtime evidence exists. `OPEN` means that a
required acceptance claim has not yet been proven.

## Nine-template qualification set

| Type | Template | Runtime status | Template artifact / builder ID | Use-template route | Generator + lineage | Builder acceptance | Visual/content acceptance |
|---|---|---:|---|---|---:|---:|---:|
| Word | `[System] board report (EN)` | Approved | `46301065-b8eb-4147-800e-4f3895643066` | `/document-studio?entry=template&templateArtifactId=46301065-b8eb-4147-800e-4f3895643066` | PASS | PASS | PASS — 7 guided board sections, 5 sources |
| Word | `[System] business case (EN)` | Approved | `fe66b811-70ba-48ad-830a-51ae3b00343a` | `/document-studio?entry=template&templateArtifactId=fe66b811-70ba-48ad-830a-51ae3b00343a` | PASS | PASS | PASS — 9 guided investment sections, 5 sources |
| Word | `[System] decision memo (EN)` | Approved | `b7680449-bbf3-4335-88ad-9ed61654d43d` | `/document-studio?entry=template&templateArtifactId=b7680449-bbf3-4335-88ad-9ed61654d43d` | PASS | PASS | PASS — 6 guided decision sections, 5 sources |
| Excel | `Dashboard KPI` | Approved | `f5da6891-de3e-431d-8bc8-10e97b01609a` | `/presentations?tab=workbook_templates&workbookTemplateId=f5da6891-de3e-431d-8bc8-10e97b01609a` | PASS | PASS | PASS — safe formula, governance and cold reopen |
| Excel | `Rejestr ryzyk` | Approved | `3f36a34d-51d2-455e-a952-c984cc91853c` | `/presentations?tab=workbook_templates&workbookTemplateId=3f36a34d-51d2-455e-a952-c984cc91853c` | PASS | PASS | PASS — 9 columns, exposure formula and controls |
| Excel | `Product Roadmap` | Approved | `510a84dd-c9c9-4294-ac4a-20616792c785` | `/presentations?tab=workbook_templates&workbookTemplateId=510a84dd-c9c9-4294-ac4a-20616792c785` | PASS | PASS | PASS — 10 columns, schedule formula and controls |
| PowerPoint | `Steering Committee Update` | Published | `d59b4cee-9f75-4584-a59b-66bc2431819e` | `/prezentacje?templateArtifactId=d59b4cee-9f75-4584-a59b-66bc2431819e` | PASS | PASS | PASS — 8 thesis-led decision slides |
| PowerPoint | `Assessment Summary` | Approved in Architect | `d00a34b9-71c7-41aa-a4c1-a2543f5dbaa1` | `/prezentacje?templateArtifactId=d00a34b9-71c7-41aa-a4c1-a2543f5dbaa1` | PASS | PASS | PASS — 9 evidence-led assessment slides |
| PowerPoint | `Valuation Pack` | Approved in Architect | `1710cef4-24ee-4f22-ab62-976045f10371` | `/prezentacje?templateArtifactId=1710cef4-24ee-4f22-ab62-976045f10371` | PASS | PASS | PASS — 9 valuation and decision slides |

### Runtime observations

- On deployment `4d1b56ed-d978-47bd-85c9-569a99b34371`, the default library
  contains 91 templates: 53 `Approved`, 38 `Published`, 0 `Draft`. Enabling
  `Show drafts` exposes 99 templates: the same 53 `Approved` and 38 `Published`
  plus 8 `Draft`.
- All nine selected templates are visible in the authenticated deployed library.
- The three Word routes open the template-entry Document Studio and expose
  template-specific required source fields. Board report requires period KPIs,
  decisions and risks; business case requires investment cost and expected
  benefits; decision memo requires a one-sentence decision, options and a
  recommendation.
- The three Excel routes open the workbook-template builder with the exact
  `workbookTemplateId` retained in the URL.
- The three PowerPoint routes open the presentation brief form. Runtime states
  that the published template structure and origin will be preserved and shows
  the exact `Template lineage` ID.
- The three blank builder entries route to distinct authoring surfaces: Document
  Template Architect (`/document-studio?tab=templates`), the three-step workbook
  template wizard, and Deck Template Architect
  (`/presentations?tab=template_architect`). Full independent builder round trips
  are now **PASS** for all three types: create, edit, save, cold reopen, validate
  where applicable, approve and deprecate. Excel formula/schema/theme persistence
  passed; Word and PowerPoint governance removed draft deletion after approval.
  PowerPoint deprecation uses a governed reason modal rather than a native
  browser prompt on deployment `2be6062b-be32-457a-a0d9-3df951e926a8`.
- The Deck Template Architect exposed a governance discrepancy: Recommendation
  Deck and Investor Pitch were `Draft` there while the unified Library labelled
  them `Published`. They were rejected from this qualification set and replaced
  by genuinely `Approved` Architect templates. The server-side lifecycle
  projection fix is deployed and runtime-verified: both rows now appear only
  after `Show drafts` and both render as `Draft`.

These observations prove inventory, generator routing, all three builder
lifecycle contracts and the board-ready content qualification of the exact nine
templates. Runtime materialization confirms that template use creates an
independent artifact and does not mutate its reusable source.

## Six final artifact set

| Type | Entry mode | Independent artifact | Autosave + cold reopen | Native export + readback | Quality / visual result |
|---|---|---|---:|---:|---:|
| Word | Clean/manual | `artifact-6f56477e-fde6-4321-b1c9-0f9ec71d4445` | PASS | PASS | PASS |
| Word | Template | `artifact-930ca3f2-e9bd-4070-b4aa-df2b9ee9f012` | PASS | PASS DOCX | 100/100 |
| Excel | Clean/manual | `59ef4ce7-01c3-492d-8787-69866887c00e` | PASS | PASS XLSX | PASS incl. formulas/chart |
| Excel | Template | `f6d4613c-f018-4ed1-8baa-1a9e60c0cdf6` | PASS | PASS XLSX | PASS incl. formulas/chart |
| PowerPoint | Clean/manual | `cf77e2d0a502413593765c1ea9e2b248` | PASS | PASS PPTX | 90/100, no overflow |
| PowerPoint | Template | `5baa656fc9b3467fb6c5f1aafae55322` | PASS | PASS PPTX | 90/100, P0=0, P1=0, no overflow |

The detailed URLs, steps, deployment IDs and independent readbacks are recorded
in `docs/qa/DOCUMENTS_RUNTIME_EVIDENCE_2026-08-07.md`.

## Final release gate

- Final code HEAD: `a11c20995f`.
- Final runtime deployment: `6aa14696-61ef-42e1-91b0-9174f32f87f0`
  (`SUCCESS`, image digest
  `sha256:8004cf6e7b3f13bd0e52299a1896824a0acaf4390e10b10a5c686ac54c0e3550`).
- Final Dashboard materialization and cold reopen:
  `1515adbc-7b82-4cac-a781-e225cd12537c`, `Model verified (0 notes)`, no formula
  errors.
- Six-artifact authenticated cold-reopen smoke: **PASS** on the final deployment.
- Remaining acceptance work: **none for the agreed Documents / Templates DoD**.
