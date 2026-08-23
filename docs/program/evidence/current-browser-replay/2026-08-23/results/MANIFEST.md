# Results local browser replay — 2026-08-23

Scope: current local technical replay only. This packet is **not** owner acceptance, production evidence, or durable database readback.

- Integration source baseline before the menu fix: `aa0cefc3476d75ecb6cd3777005140ca9f099bc3`.
- Visible local runtime marker in the screenshots: `LOCAL @cc8848eb7d33`.
- Route flags: `ff_wave3ResultsOwnerReview=1&sampleData=results-vnext`.

| File | SHA-256 | Evidence |
|---|---|---|
| `01-kpi-register.png` | `f36065a7fe763c0b9100dc8164f3efb42ec78111cbef776be37f701c0a3f652f` | KPI registry with four deterministic review rows and domain-specific CTA. |
| `02-okr-row-menu.png` | `b2ad51e76e838e0447102bfd7ea36204fb794433461a4f2e684366401d8cba6f` | OKR registry after removal of the misleading registry-level lifecycle action. |
| `03-roi-row-menu.png` | `b2f207156c8cb1dd33af83beb3ef2fdd833aada64bfc2d77904b2af6c3127141` | ROI registry after removal of the full lifecycle state machine from the row menu. |

Open gates: full KPI/OKR/ROI tool owner review, backend persistence/readback, tablet, EN, alternate theme, systematic keyboard/a11y, clean console/HTTP.
