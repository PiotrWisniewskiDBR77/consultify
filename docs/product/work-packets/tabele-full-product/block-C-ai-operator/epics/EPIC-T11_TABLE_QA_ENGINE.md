# EPIC-T11 — Table QA Engine

**Block:** C — AI Operator
**Status:** `PLANNED`
**Spec source:** Consultify Table Studio specification, section 5J + section 11 (governance).
**Owner agent:** A (backend) + B (frontend)

---

## Goal

Continuously evaluate every Tabele table against a 5-axis health model: completeness, freshness, source coverage, methodology compliance, formula consistency. Persist reports in `tp_qa_reports`. Surface in `TabeleQaPanel` accessible from Menu 3 right-slot when lane=tabele.

## The 5 axes

| Axis | Inputs | Score 0–1 |
|---|---|---|
| **Completeness** | required-field fill rate, low-confidence record count | 1.0 = all required fields filled across all records |
| **Freshness** | days since last record write, days since last user verification | 1.0 = recent activity (<7 days) |
| **Source coverage** | percentage of records with ≥1 verified source | 1.0 = all records have verified sources |
| **Methodology** | template `governance_rules` compliance (e.g. all approval-required fields filled, min_records_for_publish met) | 1.0 = no rule violations |
| **Formula consistency** | formula evaluation success rate, downstream relation integrity | 1.0 = no formula errors |

Overall health = weighted mean (default 0.25 / 0.15 / 0.25 / 0.20 / 0.15).

## Acceptance criteria

- `TableQaService.computeReport(tableId, actor)` returns `QaReport` and persists to `tp_qa_reports`.
- Report schema:
  ```ts
  type QaReport = {
    id: string;
    tableId: string;
    organizationId: string;
    computedAt: ISODateString;
    overallScore: number;
    axes: { completeness: AxisDetail; freshness: AxisDetail; sourceCoverage: AxisDetail; methodology: AxisDetail; formulaConsistency: AxisDetail; };
    suggestions: QaSuggestion[];
  };
  type AxisDetail = { score: number; band: 'red'|'amber'|'green'; details: { metric: string; value: unknown }[] };
  type QaSuggestion = { id: string; axis: AxisName; description: string; recommendedAction: { kind: 'open_ai_editor'; level: ProposalLevel; payload: unknown }; severity: 'low'|'medium'|'high'; };
  ```
- Recompute trigger: on-demand (button click) + async debounced job after record writes (5 min window).
- `TabeleQaPanel` UI with `<QaHealthBar>` and `<QaSuggestionList>`.
- Each suggestion card has "Open in AI Editor" button → launches level handler with prefilled payload.
- "Why this score?" expansion shows axis details.
- "Mark not applicable" with reason persists, suppressing the suggestion.
- EN + PL i18n.

## In scope

### Backend
- `TableQaService.ts` with `computeReport`, `getLatestReport`, `markSuggestionInapplicable`.
- Migration adds `tp_qa_reports` table.
- Routes: `POST /tables/:id/qa/recompute`, `GET /tables/:id/qa/latest`, `POST /tables/:id/qa/suggestions/:sid/inapplicable`.
- Recompute scheduling via existing job queue.
- Unit + integration tests.

### Frontend
- `TabeleQaPanel.tsx`, `QaHealthBar.tsx`, `QaSuggestionList.tsx`, `QaAxisCard.tsx`.
- Menu 3 button "QA Report" launches panel.
- Component tests.

## Out of scope

- Real-time QA streaming (debounced async only).
- Custom user-authored axes (out of program).

## Dependencies

- Block A `template.governance_rules` for methodology axis.
- Block B `confidence_score`, `validation_status` for completeness + source coverage axes.
- Existing formula service for formula consistency axis.

## Estimated effort

- S4 (1 day): backend service + migration + tests.
- S5 (0.5 day): frontend panel.
