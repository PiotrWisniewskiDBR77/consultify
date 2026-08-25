# Interview Sesje/Inicjatywy preview — canon rebuild evidence (2026-08-25)

DEC-2026-08-25-53: the Interview module's single-click preview panes on the
"Sesje" and "Inicjatywy" tabs were rebuilt onto `TABLE_AND_PREVIEW_CANON.md`
§7 after the owner flagged them as non-compliant with the canon.

## What changed

- `src/components/Interview/InterviewInitiativePreview.tsx` — added
  `InterviewInitiativePreviewBody`, replacing the bespoke hand-rolled meta
  row + Details block (no local kebab at all) that used to live inline in
  `InterviewHub.tsx` (`renderInitiativePreview`). The new Body uses the
  shared `PreviewMetaCard` / `PreviewDetailsSection` / `EntityStatusChip` /
  `PriorityChip` building blocks — the same pattern already used by
  `InterviewSessionPreviewBody` and `InterviewInsightPreviewBody`. Details
  now always renders its local kebab (Rozwiń/Zwiń · Kopiuj szczegóły ·
  Kopiuj ID), matching canon §7.3 pkt 3 (MUST).
- `src/components/Interview/InterviewHub.tsx` — wires the new Body in,
  removes the bespoke JSX, adds `initiativePreviewDetailsExpanded` state.
  Also fixed the Sesje preview footer's Relations block: `Assignee: —` /
  `Szablon: —` placeholder pills (no real value) no longer render at all —
  same "don't show a relation without a real value" rule the code already
  applied to the Org chip, now applied consistently to all three.
- `public/locales/{pl,en}/translation.json` —
  `interview.initiativePreview.openInitiativeDocument` shortened
  ("Otwórz dokument inicjatywy" → "Otwórz dokument" / "Open initiative
  document" → "Open document") to fix defect `INT-C05-A` from the prior
  exact-SHA evidence run (`exact-sha-0050bad8-2026-08-25/interview/
  EVIDENCE_INDEX.md`): the 3-word label wrapped to 3 lines inside the fixed
  `h-9` action pill and was clipped by the panel edge. Added
  `expand`/`collapse`/`copyDetails` keys for the new Details kebab.
- `src/components/Interview/__tests__/InterviewInitiativePreviewBody.canon.test.tsx`
  (new) — locks in shared-component usage, the always-present Details
  kebab, the draft-note visibility rule, and a regression guard on the
  footer pill label length.

## Screens captured

Harness: `dev-render/screens/interview-preview-canon.tsx` (new; registered
in `dev-render/main.tsx` as `interview-preview-canon`), mounting the REAL
`TableWithPreviewLayout` + `Interview{Session,Initiative}PreviewBody/Footer`
production components with mock Polish data — no login, no backend.
`node dev-render/shot.mjs <out> <url> --w=1440 --h=900`.

| File | What it shows |
|---|---|
| `01-sesja-dark.png` / `02-sesja-light.png` | Sesje preview: header (title · pin · Otwórz · ×), status chip, meta pills, PRZEBIEG properties table with kebab, AI card, POWIĄZANIA (3 real relations, no more `—` placeholders), footer actions ("Generuj wnioski" + overflow). |
| `03-sesja-dark-kebab.png` | Same, Details (⋮) kebab open: Rozwiń · Kopiuj metryki · Kopiuj ID. |
| `04-inicjatywa-dark.png` / `05-inicjatywa-light.png` | Inicjatywy preview: status+priority chips, meta pills (Insight badge, date), SZCZEGÓŁY with real description + `~35 słów` word count + kebab (previously: no kebab, "Brak opisu" bespoke block), draft banner, AI/Relations, footer pills — "Otwórz dokument" no longer clips (INT-C05-A fixed). |
| `06-inicjatywa-dark-kebab.png` | Same, Details (⋮) kebab open: Rozwiń · Kopiuj szczegóły · Kopiuj ID. |

## Self-check vs consultify-preview checklist

- [x] 6-block order preserved (header → meta → details → AI → relations →
      actions); no block-without-data rendered as an empty box.
- [x] Header: exactly one "Otwórz"; "×" last.
- [x] Details: word count shown when content > 0 (Sesje's PRZEBIEG is a
      properties table, not prose — `showWordCount={false}`, as documented
      in `InterviewSessionPreviewBody`); local kebab present on both,
      always, with the full action set (session: Rozwiń/Zwiń · Kopiuj
      metryki · Kopiuj ID; initiative: Rozwiń/Zwiń · Kopiuj szczegóły ·
      Kopiuj ID — no Export/Pobierz, neither entity has an export target).
- [x] No "Co dalej" strip on either — correct per §7.3c: Sesja doesn't
      convert to another module's artifact type; Initiative *is* already
      the target artifact (single-click never routes to the Initiatives
      module per §7.1, "Otwórz dokument" stays a footer action, not a
      create-strip).
- [x] Footer pills: zero inline `bg-*`/`rounded-lg`; all through
      `actionPillClass()`/`PreviewActionBar`.
- [x] No duplicate Open/export between header, Details kebab and footer.
- [x] Dark + light both captured; focus tokens are `c-focus` (unchanged,
      not modified in this pass); zero crimson on any data/action surface.

Not touched (out of scope, still correct as-is): the panel header/shell
(Pin · Otwórz · ×) comes from `TableWithPreviewLayout` →
`PreviewPaneShell`, shared by every Interview tab — already canon-compliant
before this change, confirmed unchanged by inspection.

`← Lista` / `Uwagi` visible at the bottom-right of every screenshot are
dev-render harness chrome (back-to-list affordance + owner-notes panel),
not part of the production preview pane.
