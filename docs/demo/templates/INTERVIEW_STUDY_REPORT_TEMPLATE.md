# {{CLIENT_NAME}} - Interview Study Report Template (BCG-Style)

Version: {{VERSION}}
Date: {{REPORT_DATE}}
Prepared by: {{AUTHOR_OR_TEAM}}
Document type: Method and data-quality report (pre-insight gate)

## A. Standard Requirements (Must-Have)

### A1. Length and structure
- Target: **18-24 slides** (or equivalent markdown sections).
- Max: **28 slides**; if exceeded, move details to appendix.
- Reading time: **20-30 minutes**.

### A2. Purpose
- Prove study credibility.
- Show whether the response base is decision-grade.
- Explicitly declare GO / NO-GO for full insight synthesis.

### A3. Writing quality bar
- No generic statements without numbers.
- Every claim must have a metric, table, or explicit assumption tag.
- Use concise consulting language: conclusion first, evidence second.

## B. Slide-by-Slide Blueprint

> Use this sequence exactly. Add slides only if necessary and label as optional.

### Slide 1 - Cover
- Client, scope, period, version, confidentiality label.

### Slide 2 - Executive headline
- 3 bullets: study status, confidence level, recommendation (GO/NO-GO).

### Slide 3 - Why this study
- Business context, decision needed, what this study de-risks.

### Slide 4 - Scope boundaries
- Included org units, geographies, functions, packs, languages.
- Explicit exclusions.

### Slide 5 - Method architecture
- Invite -> response -> validation -> freeze workflow.
- Diagram required.

### Slide 6 - Respondent design
- Target respondent matrix (role x site x process).
- Planned vs reached.

### Slide 7 - Participation funnel
- Invited, started, submitted, active, dropped.
- Conversion percentages per stage.

### Slide 8 - Completion quality
- Avg completion, median completion, distribution by respondent.

### Slide 9 - Response depth quality
- Answer length distribution, empty-rate, attachment/evidence usage.

### Slide 10 - Coverage quality
- Coverage by function/site/process (heatmap preferred).

### Slide 11 - Identity integrity and filtering
- Domain rules, excluded users, reasons, impact on sample.

### Slide 12 - Data cleaning and QA checks
- Duplicate logic, outlier handling, malformed payload checks.

### Slide 13 - Bias risk assessment
- Selection, role overrepresentation, recency, non-response bias.

### Slide 14 - Confidence framework
- Confidence scoring model (High/Medium/Low) and thresholds.

### Slide 15 - What can be concluded now
- 3-5 validated readiness-level observations.

### Slide 16 - What cannot be concluded yet
- Open risks, missing segments, pending sessions.

### Slide 17 - GO/NO-GO decision
- Decision + rationale + conditions.

### Slide 18 - Immediate actions
- 0-7 day action plan with owner and due date.

### Slide 19-24 (Appendix core)
- Respondent list (anonymized if required),
- Session table,
- Exclusion log,
- Metric definitions.

## C. Required Tables and Visuals

- Funnel table (counts + percentages).
- Coverage matrix (role/site/function).
- Completion histogram.
- Bias risk register (risk, impact, mitigation, owner).
- Exclusion ledger (who, why, where removed).

## D. Mandatory Metrics Block

Include all metrics below in one summary slide:
- `{{INVITED_TOTAL}}`
- `{{SESSIONS_STARTED}}`
- `{{SESSIONS_SUBMITTED}}`
- `{{SESSIONS_ACTIVE}}`
- `{{COMPLETION_RATIO}}`
- `{{AVG_Q_PER_SESSION}}`
- `{{MEDIAN_ANSWER_LENGTH}}`
- `{{EVIDENCE_USAGE_RATE}}`
- `{{FILTERED_RESPONDENTS_COUNT}}`
- `{{FINAL_ANALYTICAL_SAMPLE_SIZE}}`

## E. QA Gate Before Approval

Mark each item PASS/FAIL:
1. Every headline supported by data.
2. No non-client respondents in analytical sample.
3. Confidence model explained and applied consistently.
4. GO/NO-GO includes explicit conditions and owner actions.
5. Appendix contains reproducible metric definitions.

## F. Reusable Placeholder Pack

- `{{CLIENT_NAME}}`, `{{BUSINESS_SCOPE}}`, `{{PERIOD_START}}`, `{{PERIOD_END}}`
- `{{TARGET_PROFILES}}`, `{{INCLUDED_DOMAINS}}`, `{{EXCLUDED_DOMAINS}}`
- `{{INTERVIEW_PACKS}}`, `{{QUESTIONS_PER_PACK}}`, `{{LANGUAGES}}`
- `{{DUPLICATE_RULES}}`, `{{FILTER_RULES}}`, `{{PARTIAL_POLICY}}`, `{{AUDIT_POLICY}}`
- `{{CONFIDENCE_LEVEL}}`, `{{GO_NO_GO}}`, `{{GO_NO_GO_REASON_1}}`, `{{GO_NO_GO_REASON_2}}`

## G. Output Handoff Standard

The final slide must include:
- Hand-off decision to full consulting report (YES/NO),
- Exact dataset freeze timestamp,
- Known limitations passed to next report,
- Owner responsible for next synthesis step.
