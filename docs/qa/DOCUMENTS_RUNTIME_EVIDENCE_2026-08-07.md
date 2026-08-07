# Documents / Templates runtime evidence — 2026-08-07

This register records deployed runtime checks. A local test or build is not a
substitute for an entry here.

## PowerPoint — manual edit, autosave and cold reopen

- Railway deployment: `479e0f24-d165-4f5d-8c45-2c9773652e87` (`SUCCESS`)
- Commit: `44d66f5409` (`fix(presentations): persist manual deck rename`)
- Deck: `cf77e2d0a502413593765c1ea9e2b248`
- URL: `https://demo.consultify.ai/presentations/builder/cf77e2d0a502413593765c1ea9e2b248`
- Entry mode: **Clean / manual**, no Teresa generation.
- Steps: create blank deck; rename it to `Board Transformation Update — Manual QA`;
  insert a Heading and Paragraph block; enter the executive message; wait for
  `Saved`; reload the exact URL.
- Cold reopen: **PASS**. The title, `Transformation at a decision point`, full
  paragraph content, deck ID and `Saved` state all returned.
- Defect found and fixed: slide content persisted but the deck title reverted
  because autosave updated `deck_json` without updating `presentation_decks.title`.

## PowerPoint — template to grounded artifact

- Railway deployment: `fba38bd8-3d83-417c-8e77-081bfd120ba6` (`SUCCESS`)
- Commit: `5fd73c2bec` (`fix(presentations): ground template decks in brief`)
- Template Library artifact: `d59b4cee-9f75-4584-a59b-66bc2431819e`
- Template: `Steering Committee Update`
- Result deck: `5baa656fc9b3467fb6c5f1aafae55322`
- URL: `https://demo.consultify.ai/presentations/builder/5baa656fc9b3467fb6c5f1aafae55322`
- Result: **PASS**, 8 slides, independent deck ID and title
  `Steering Committee Update — Grounded QA`.
- Grounding assertions visible in the editor and retained after cold reopen:
  `EUR 2.2m`, `EUR 1.08m`, `data migration delay`, `parallel reconciliation`,
  `lock phase-two scope by 15 August`, and `confirm Operations owner`.
- Autosave/cold reopen: **PASS** on the exact result URL.
- Defect found and fixed: prose briefs were split only on semicolons/newlines;
  risk and decision slides also used canned rows. Sentence-aware parsing and
  deterministic risk/mitigation/decision materialization now preserve the brief.

## Verification

- Presentation autosave regression plus hook suite: 13/13 PASS.
- Template runtime and route wiring suites: 21/21 PASS.
- Frontend production build: PASS.
- Backend production build: PASS.

These entries close the tested PowerPoint slices only. They do not by themselves
constitute acceptance of the complete Documents / Templates DoD.

## Word — clean/manual authoring, autosave and cold reopen

- Artifact: `artifact-6f56477e-fde6-4321-b1c9-0f9ec71d4445`
- URL: `https://demo.consultify.ai/document-studio/artifact-6f56477e-fde6-4321-b1c9-0f9ec71d4445`
- Entry mode: **Clean / manual**, without Teresa.
- Steps: create blank document; rename to
  `Board Transformation Decision Brief — Manual QA`; enter a substantive Program
  Atlas board brief; insert a quote attributed to `Transformation Office`; insert
  chart `Program delivery versus plan` with Plan 75 and Wykonanie 72; wait for
  autosave; reopen the exact artifact URL.
- Autosave/cold reopen: **PASS**. Title, prose, quote, attribution, chart and saved
  state all returned.

## Word — approved template to grounded artifact and native DOCX export

- Railway code deployment: `ad126b80-b517-4c7e-906b-0e9922d1593b` (`SUCCESS`)
- Railway export-entitlement deployment:
  `c837c379-7444-42c7-ad5c-222ca2561a6a` (`SUCCESS`)
- Commit: `2f2e2f3b52` (`fix(documents): align executive QA with decision lists`)
- Template Library artifact: `46301065-b8eb-4147-800e-4f3895643066`
- Template: `[System] board report (EN)`
- Result artifact: `artifact-930ca3f2-e9bd-4070-b4aa-df2b9ee9f012`
- URL: `https://demo.consultify.ai/document-studio/artifact-930ca3f2-e9bd-4070-b4aa-df2b9ee9f012`
- Source pack: period KPIs, decisions required and risks. Exact retained facts
  include `72% vs 75%`, `EUR 2.2m`, `EUR 1.08m`, phase-two scope by 15 August,
  Operations ownership, data-migration risk and parallel reconciliation.
- Autosave/cold reopen: **PASS** on the exact result URL; title, recommendation,
  KPIs, decisions and risks all returned.
- Runtime QA: **All clear**; Executive QA **100/100**, completeness **100/100**,
  sources **100/100**, risk **100/100**, data **100/100**, format **100/100**.
  Low-severity density, manual-source pinning and absent-appendix-style findings
  remain advisory and did not block export.
- Native DOCX export without QA override: **PASS**. Runtime displayed
  `DOCX exported — the download has started.`
- Download readback:
  `/Users/piotrwisniewski/Downloads/program_atlas_board_decision_report_qa_clean.docx`.
  `unzip -t` reported no compressed-data errors. Independent extraction of
  `word/document.xml` confirmed the recommendation, all KPIs, decisions, risks
  and mitigations.
- Defects found and fixed: source bodies were previously encoded only in a
  `sourceId` and not supplied to prose grounding; structured decision/risk blocks
  remained placeholders; Executive QA counted a three-item numbered list as one
  action. The trial export policy itself was preserved; the existing
  `TRIAL_EXPORT_ENABLED=true` capability was enabled only in the Railway demo
  environment, while DEMO/TRIAL_ENTRY/UNKNOWN scopes remain deny-by-default.

These entries close the tested Word manual, template-to-artifact and native DOCX
export slices. They do not by themselves constitute acceptance of the complete
Documents / Templates DoD.
