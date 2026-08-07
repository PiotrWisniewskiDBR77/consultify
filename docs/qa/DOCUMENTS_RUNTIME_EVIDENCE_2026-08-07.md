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
