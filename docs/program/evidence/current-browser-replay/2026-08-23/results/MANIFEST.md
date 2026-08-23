# Results local browser replay — 2026-08-23

Scope: current local technical replay only. This packet is **not** owner acceptance, production evidence, or durable database readback.

- Integration source checkpoint after the registry-menu fix: `d157ea8fa73e55ba3af3f2e5efa877e43029c9b8`.
- Visible local runtime marker in the screenshots: `LOCAL @cc8848eb7d33`.
- Route flags: `ff_wave3ResultsOwnerReview=1&sampleData=results-vnext`.

| File | SHA-256 | Evidence |
|---|---|---|
| `01-kpi-register.png` | `f36065a7fe763c0b9100dc8164f3efb42ec78111cbef776be37f701c0a3f652f` | KPI registry with four deterministic review rows and domain-specific CTA. |
| `02-okr-row-menu.png` | `b2ad51e76e838e0447102bfd7ea36204fb794433461a4f2e684366401d8cba6f` | OKR registry after removal of the misleading registry-level lifecycle action. |
| `03-roi-row-menu.png` | `b2f207156c8cb1dd33af83beb3ef2fdd833aada64bfc2d77904b2af6c3127141` | ROI registry after removal of the full lifecycle state machine from the row menu. |
| `04-kpi-full-tool-current.png` | `0f1602a454595cb73215983da5a4a5a4586a923feb331a2817158303c8fc4b1a` | Current KPI full tool: Performance plus Contract, Measurements, Deviations, Corrective actions, affected Initiatives, Scorecards/contexts and lineage. |
| `05-okr-full-tool-current.png` | `3ccba353f1f2c3a761e968acb0ab28eb073a62b8b46a2b0adb0d8d694c99f903` | Current OKR full tool: Overview, Objectives/KRs, Alignment, Conversations/support, Review/reflection and History. |
| `06-roi-full-tool-current.png` | `e114ff593cbb6e5a023cd4a1dad9f88fb234eedfb64cc9fa2fb5ef7664926e2e` | Current ROI full tool: Baseline/policy, Assumptions, Cost lines, Benefit lines, Scenarios and Calculation runs. |

The three full tools are technically mounted and deterministic sample-detail reads succeed. This proves that the code and route connections exist; it does **not** prove owner acceptance, complete workflow quality or durable database persistence.

Open gates: full KPI/OKR/ROI owner review and remediation, creation/edit flows, backend persistence/readback, tablet, EN, alternate theme, systematic keyboard/a11y, clean console/HTTP.
