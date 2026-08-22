# Partners — evidence index

Evidence class: `DIAGNOSTIC_REFERENCE + TECHNICAL_IMPLEMENTATION_EVIDENCE`.

The original evidence remains a diagnostic intake reference. PAR-OWN-001 now also
has a source candidate, claim matrix, focused tests and browser replay. None of
these artifacts constitutes commercial approval or owner acceptance.

| ID | Durable file | Visible area | Bytes | SHA-256 | Source comparison | Status |
|---|---|---|---:|---|---|---|
| `PAR-EVD-001` | [`evidence/PAR-EVD-001_Screenshot_2026-08-22_05.53.12.png`](evidence/PAR-EVD-001_Screenshot_2026-08-22_05.53.12.png) | Partner Program overview: hero, four value cards and top of beta success stories | 477563 | `5638e47ad88c8e4409ac4ed3aea42822fe9745765d1634c91a7171acff5adc3d` | `MATCH` | `DIAGNOSTIC_REFERENCE_CAPTURED` |

## PAR-EVD-002 — implementation evidence

- UI candidate: `6cfdf6f1e5`
- Claim matrix:
  [`PAR_OWN_001_CONTENT_MATRIX.md`](PAR_OWN_001_CONTENT_MATRIX.md)
- Focused source replay: `30/30 PASS`
- Typecheck: `PASS`
- Browser routes:
  - `/become-partner` — six role paths, five models and first-deal journey;
  - `/partner/pricing` — canonical replace to
    `/become-partner#commercial-framework`;
  - `/partner?tab=partner-home` — authentication boundary reached without
    transmitting credentials; state variants remain covered by source fixtures.
- Responsive replay: `1440×1000`, `1024×768`, `390×844` and effective 200%
  (`720×900`); each had one H1, no horizontal overflow, no fictional proof and
  no prohibited commercial value.
- Six role tabs: `6/6` selected correctly and exposed role outcome,
  contribution split, recommended models and first practical step.
- Scope limitation: no application submission, agreement acceptance, payout,
  external contact or other persistence-changing action was executed.
- Status: `TECHNICAL_PASS / OWNER_ACCEPTANCE_REQUIRED`.

Source at intake:
`/var/folders/pb/sc90m9b12_966jx4l2klt5br0000gn/T/TemporaryItems/NSIRD_screencaptureui_js3X3H/Screenshot 2026-08-22 at 05.53.12.png`

Source and durable hashes were calculated independently after copying. `MATCH`
means only byte identity at intake; it does not establish runtime, route,
commercial truth, testimonial authenticity or owner acceptance.
