# Assessment Interview level card — three-skeptic synthesis

Date: `2026-08-23`

Status: `DESIGN CANDIDATE 9.2/10 / OWNER REVIEW REQUIRED / NOT IMPLEMENTED`

Scope: the collapsed/expanded maturity-level card inside DRD Interview. This
review does not authorize scoring semantics, implementation completion or owner
acceptance.

Canonical content source: DRD QBank v2 under
`knowledge/tool-kb/drd/qbank/v2/` (7 axes, 39 areas, 233 area-level pairs and
699 evidentiary question prompts).

## Independent skeptical verdicts

| Skeptic | Independent result | Blocking objection |
| --- | ---: | --- |
| Senior transformation consultant | `9.2/10` after corrections; `7.1/10` without them | A user declaration must be separated from evidence validation; clicking a level cannot establish achievement. |
| Principal B2B UX designer | `9.3/10` after corrections; `6.8/10` as initially described | The whole-card click cannot simultaneously expand and score; progressive disclosure, focus and save/error behavior must be deterministic. |
| Survey/maturity-measurement methodologist | `9.0/10` only with mandatory methodological gates | Verdict, respondent knowledge and evidence status are different constructs; QBank questions cannot be counted as three survey points. |

Consensus design score: `9.2/10`, conditional on every mandatory gate below.

## Final interaction formula

### Collapsed card

One compact row/card per `area × level` contains:

1. canonical level number and short name;
2. one-sentence canonical level criterion/description;
3. a read-only verdict badge;
4. a separate evidence-status badge;
5. confidence only when it has a traceable derivation;
6. CTA `Sprawdź kryteria`; after work exists, `Kontynuuj ocenę` or
   `Edytuj ocenę`;
7. an explicit expand/collapse chevron.

`Tell me more` and `Go deeper` are rejected as the primary labels because they
do not tell the user that an assessment workspace will open. Clicking the card
header may expand it, but never changes the score. The collapsed card exposes
saved state as text/icon/color; it does not expose a misleading radio control.

### Expanded card

Expansion is inline and full-width within the Interview content column. It does
not open a modal or replace the session. Only one level card within the current
area is expanded at a time.

The standard order is:

1. full criterion and QBank signal/threshold, with pinned source version;
2. the three canonical QBank prompts, presented sequentially rather than as
   three simultaneous survey scores;
3. canonical `Dowód / przykład` guidance;
4. concise interview response/context note;
5. evidence capture:
   - file attachment,
   - URL,
   - external/manual reference,
   - short description,
   - source/owner/respondent,
   - relevant date or covered period;
6. suggested technologies as help only, never a maturity proxy;
7. three separate governed state fields;
8. assessment rationale, assessor, timestamp and QBank/method version;
9. local save/error state plus `Zapisz i przejdź dalej`.

### Three independent state dimensions

Do not use one flat six-option dropdown.

1. **Merytoryczny werdykt**
   - `Nieoceniony`
   - `Osiągnięty`
   - `Częściowo`
   - `Nieosiągnięty`
   - `Nie dotyczy` (mandatory rationale and assessor approval)
2. **Wiedza respondenta**
   - `Wiem / mogę odpowiedzieć`
   - `Nie wiem / potrzebuję pomocy`
3. **Stan dowodu**
   - `Brak`
   - `Zadeklarowany lub dostarczony — niezweryfikowany`
   - `Zweryfikowany`
   - `Sprzeczny`
   - `Odrzucony`

Fields may use professional selects or compact segmented controls inside the
expanded card. In collapsed state they are summarized as badges, not editable
controls.

## Defensible scoring boundary

- The unit of judgment is one `area × level`, not one question.
- The three QBank questions are evidence prompts. Never calculate `2 of 3` or
  turn their answers directly into a score.
- A respondent choice is provisional.
- `Osiągnięty` requires the canonical level criterion, adequate evidence with
  provenance, no unresolved conflicting evidence and approval by an authorized
  assessor.
- An oral statement without evidence remains unverified and cannot establish
  achieved maturity.
- `Częściowo`, unknown, missing evidence and conflicting evidence do not raise
  the achieved score.
- Confidence describes evidence quality; it never substitutes for evidence.
- Do not automatically mark every lower level achieved. QBank contains
  qualitatively different and sometimes negative lower-level culture states,
  so naive cumulative scoring can be false. Until the method owner approves a
  formal aggregation rule, persist every level independently and show the
  highest evidenced level together with gaps below it.

## Shared Interview–Matrix state

Interview and Matrix read one canonical persisted record. They do not synchronize
two client-side copies. The shared record retains:

- area and level identity;
- verdict, knowledge state and evidence state;
- evidence references and provenance;
- rationale and confidence derivation;
- actor/assessor and timestamp;
- method/QBank version;
- append-only old-to-new decision history.

After a successful durable write, Interview and Matrix show the same level
color, text and icon. Unsaved edits may show an explicitly labelled provisional
preview, but must not recolor canonical Matrix state. Color is never the sole
signal.

## Interaction and accessibility

- Opening a new card closes the prior card only after preserving its draft or
  resolving save/discard/stay.
- Focus moves to the expanded region heading, not unexpectedly into an input.
- On collapse, focus returns to the opener.
- `Enter`/`Space` expands; `Esc` collapses only when no unresolved edit would be
  lost.
- The active card scrolls below the sticky Level 3 toolbar without jumping the
  entire page.
- Use `button`, `aria-expanded`, `aria-controls` and `aria-live` save/error
  announcements.
- On smaller desktop/tablet, the second navigation column may become a drawer;
  mobile uses one `Obszar i jednostka` entry point and retains a visible active
  location.

## Mandatory gates for score >= 9/10

1. Separate verdict, respondent knowledge and evidence status.
2. Never derive achievement from card click, question majority or technology.
3. Require adequate evidence and authorized validation for `Osiągnięty`.
4. Do not invent cumulative scoring; preserve independent levels and gaps until
   formal method-owner approval.
5. Preserve evidence provenance, durable attachments/references and append-only
   decision history.
6. Make Interview and Matrix projections of the same backend record.
7. Prevent draft loss, optimistic success and silent version-conflict overwrite.
8. Test achieved-without-evidence, partial-with-strong-evidence, unknown,
   missing, conflicting, not-applicable, a higher-level outlier with lower gaps,
   and a QBank version change.

Failure of any of gates 1–6 caps the design below `9/10` regardless of visual
quality.
