# TBL-FU-C5-1 — Tabele AI Editor + QA panel i18n (EN + PL)

**Filed during:** C-S5 (Block C · AI Operator frontend)
**Priority:** P1
**Owner:** Frontend
**Status:** OPEN

## Context

C-S5 shipped the new right-rail panels (`<TabeleAiEditorPanel>` +
`<TabeleQaPanel>` + `<ProposalDiffCard>` + axis / suggestion / health-bar
sub-components) with English-only copy so the functional pipeline could
land in the same session as the backend (C-S0…C-S4).

The right-rail tool labels (`AI Editor`, `QA Report`, `Source Pack` …)
already use `t()` from prior MELS sprints, so the icon strip is
already PL-ready. What remains is the **inside** of each panel.

## Scope

Replace the hard-coded English strings inside the new panel components
with `useTranslation()`-driven keys, and add EN + PL translations.

### Strings that need keys

`TabeleQaPanel.tsx`:
- "QA Report" (header)
- "Recompute" / "Recompute QA report" aria-label
- "Suggestions" (h4)
- toast: "QA report refreshed", "Failed to load QA report: …",
  "Failed to recompute: …", "Suggestion marked not applicable",
  "Failed to dismiss: …"

`QaHealthBar.tsx`:
- "Health" / band labels (`green` / `amber` / `red`)
- "No QA report yet — run a recompute."
- "Overall QA score N percent" aria-label

`QaAxisCard.tsx`:
- 5 axis labels (Completeness, Freshness, Source coverage,
  Methodology, Formula consistency)

`QaSuggestionList.tsx`:
- "No actionable suggestions. Table is in great shape."
- "Open in AI Editor"
- "Mark not applicable"
- 8 level short labels (cell / record / column / structure / view /
  relations / methodology / sources)

`TabeleAiEditorPanel.tsx`:
- "AI Editor" (header)
- "{level} prompt" label
- 8 level descriptions in `levelMeta.ts`
- "AI never executes. You always review the diff and approve."
- "Propose"
- toast: "Prompt is required", "Failed to propose: …",
  "Soft warning: AI budget at 70 %.", "Applied: …", "Apply failed: …",
  "Proposal rejected", "Reject failed: …"

`ProposalDiffCard.tsx`:
- "live" / "stub"
- "AI token budget approaching daily limit (soft warn)."
- "Prompt"
- "Proposed operations"
- "No operations preview available. Use the workspace audit log for full diff."
- "+N more"
- "Apply" / "Reject"

## Acceptance criteria

- All hard-coded English strings inside the new C-S5 components are
  replaced with `t()` keys.
- `public/locales/en/translation.json` extended with a `tabele.aiEditor.*`
  and `tabele.qa.*` namespace.
- `public/locales/pl/translation.json` carries Polish translations for
  every new key.
- A snapshot test verifies that switching `i18n.language` between
  `en` and `pl` flips the visible labels.

## Effort estimate

~0.5 day. Mostly mechanical.

## Out of scope

- Re-translating existing right-rail tool labels.
- A dedicated translation review pass — that lives at the program
  closeout (D-S7).
