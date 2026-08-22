# Partners — evidence index

Evidence class: `DIAGNOSTIC_REFERENCE + TECHNICAL_IMPLEMENTATION_EVIDENCE`.

The original evidence remains a diagnostic intake reference. PAR-OWN-001 now also
has a source candidate, claim matrix, focused tests and browser replay. None of
these artifacts constitutes commercial approval or owner acceptance.

| ID | Durable file | Visible area | Bytes | SHA-256 | Source comparison | Status |
|---|---|---|---:|---|---|---|
| `PAR-EVD-001` | [`evidence/PAR-EVD-001_Screenshot_2026-08-22_05.53.12.png`](evidence/PAR-EVD-001_Screenshot_2026-08-22_05.53.12.png) | Partner Program overview: hero, four value cards and top of beta success stories | 477563 | `5638e47ad88c8e4409ac4ed3aea42822fe9745765d1634c91a7171acff5adc3d` | `MATCH` | `DIAGNOSTIC_REFERENCE_CAPTURED` |

## PAR-EVD-002 — implementation evidence

- UI candidate: `864c4a9da9` (content base: `6cfdf6f1e5`)
- Claim matrix:
  [`PAR_OWN_001_CONTENT_MATRIX.md`](PAR_OWN_001_CONTENT_MATRIX.md)
- Partner regression replay: `127/127 PASS` across `30/30` test files
- Typecheck: `PASS`
- Browser routes:
  - `/become-partner` — six role paths, five models and first-deal journey;
  - `/partner/pricing` — canonical replace to
    `/become-partner#commercial-framework`;
  - `/partner?tab=partner-home` — controlled local authenticated fixture replay
    covered verified zero-step, partial `3/4`, completed `4/4`, and read-error
    states. Each rendered exactly one primary CTA: start onboarding, continue
    onboarding, open workspace, or retry. The fixture was API-controlled and
    non-persistent; it is not a durable database-readback claim.
- Responsive replay: `1440×1000`, `1024×768`, `390×844` and effective 200%
  (`720×900`); each had one H1, no horizontal overflow, no fictional proof and
  no prohibited commercial value.
- Six role tabs: `6/6` selected correctly and exposed role outcome,
  contribution split, recommended models and first practical step.
- PL/EN replay: public content switched from English to Polish on the exact
  candidate with no horizontal overflow; the Polish role labels, models,
  first-deal journey and FAQ were present. Keyboard replay confirmed
  `ArrowRight` selection/focus transfer and the stable `tab` → `tabpanel`
  relationship.
- Scope limitation: no application submission, agreement acceptance, payout,
  external contact or other persistence-changing action was executed.
- Status: `TECHNICAL_PASS / OWNER_ACCEPTANCE_REQUIRED`.

Source at intake:
`/var/folders/pb/sc90m9b12_966jx4l2klt5br0000gn/T/TemporaryItems/NSIRD_screencaptureui_js3X3H/Screenshot 2026-08-22 at 05.53.12.png`

Source and durable hashes were calculated independently after copying. `MATCH`
means only byte identity at intake; it does not establish runtime, route,
commercial truth, testimonial authenticity or owner acceptance.
