# Tabele Studio — 5-Minute Demo Storyboard

**Sprint:** D-S6 · 2026-05-08
**Audience:** Internal stakeholders (CTO, Head of Product, Anygravity ops).
**Surface:** `staging.consultify.ai` with all kill switches flipped on.
**Recorder:** Agent C (operator).
**Output:** `evidence/sprint-6-demo/full-walkthrough.mp4` (deferred to
operator capture).

The storyboard below scopes the demo to exactly five minutes and lists
every shot with its purpose, screen, and expected verbal beat. Operator
should follow the order verbatim; deviations should be noted in the
verdict file.

## Setup before recording (≈ 30 s, off-camera)

1. Open `staging.consultify.ai` and sign in as the demo operator.
2. Confirm the URL has all five kill switches flipped:
   `?ff_tabeleAiEditor=1&ff_tabeleQa=1&ff_tabeleSourcePack=1&ff_tabeleConversions=1&ff_tabeleFormIntake=1`.
3. Pre-load a workspace with ≥ 50 records and at least one published
   form with ≥ 2 fields.
4. Start the screen recorder and wait for "live".

## Scene 1 — Specialized field types & provenance (45 s)

- Open the Tabele lane; show the canvas with 5 specialized fields
  rendered (`risk_score`, `priority`, `ai_summary`, `ai_classification`,
  `source_reference`).
- Click any record; open the right-rail provenance drawer. Show the
  audit ledger.
- Trigger a `manual_override = true` on an `ai_summary` field. Show the
  audit row that records the override.

## Scene 2 — AI Editor 8 levels (90 s)

- Click the right-rail `Sparkles` icon. Open `TabeleAiEditorPanel`.
- Walk the level picker top-to-bottom: cell → record → column →
  structure → view → relational → methodological → source. Pause briefly
  on each. The methodological + source levels should show the
  super-admin-only badge.
- Pick `column`, type "Fill missing values from sources", click Propose.
  Wait for the proposal envelope. Click Approve.
- Show the budget banner ticking up after the proposal.

## Scene 3 — QA Report (45 s)

- Click `ShieldCheck` (QA Report). Open `TabeleQaPanel`.
- Show all 5 axes with scores. Click a suggestion → "Open in AI Editor".
  Show the AI Editor panel rehydrating with the preset prompt + level.

## Scene 4 — Source Pack (45 s)

- Click `BookOpen` (Source Pack). Open `TabeleSourcePackPanel`.
- Curate a pack of ≥ 5 records via the candidate ranker. Save the pack.
- Click "Use in AI Editor" to hand the pack to AI Editor (column-fill).

## Scene 5 — Convert to Document / Presentation (60 s)

- Click `Share2` (Share). Open `TabeleSharePanel`.
- Pick the saved source pack as the snapshot, target = Document, type a
  title. Click Convert.
- Show the optimistic refresh of the recent-conversions list, the
  "succeeded" pill, and the deep link icon.
- Repeat with target = Presentation.

## Scene 6 — Form intake JWT round-trip (60 s)

- Navigate to `My Work → Forms` for the same workspace.
- Pick a published form; click the new `KeyRound` action. Open
  `IntakeJwtPanel`.
- In the allow-list editor, narrow the form to 2 fields. Save.
- In the issuance section, type a recipient subject + 7-day TTL. Issue.
  Copy the recipient URL.
- Switch to an incognito window; paste the URL. Show the recipient page,
  with only the allow-listed fields visible. Submit.
- Switch back to the operator window; refresh the form; show the new
  submission row with `intake_kind = jwt`.

## Scene 7 — Compliance close (15 s)

- Show the Tabele canvas one more time. Verbally call out:
  - "Every AI button lives in the right rail."
  - "Every action writes an audit row."
  - "Every kill switch defaults off."
- Stop recording.

## Total runtime

≈ 4 min 50 s. Buffer is intentional so the operator can pause if
necessary.

## Verdict file format

After capture, the operator writes
`evidence/sprint-6-demo/run-verdict-2026-MM-DD.md` with:

- A 1-paragraph summary of the run.
- Any deviations from the storyboard.
- Any visual / copy issues spotted (open hotfix tickets for each).
- A final `PASS` / `PASS_WITH_P2` / `FAIL` verdict.
