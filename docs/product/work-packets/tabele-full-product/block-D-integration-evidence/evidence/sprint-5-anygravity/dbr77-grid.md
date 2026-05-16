# DBR77 Tone Grid — Tabele Studio Full Product Surface

**Sprint:** D-S5 · 2026-05-08
**Audit type:** Code-side static scan + tone classification.
**Verdict:** `PASS` — zero raw hex literals across the new Tabele lane and
forms surfaces.

## What DBR77 governs

- No raw hex colors (`#abcdef`) anywhere in the new component tree.
- All colors flow through Tailwind utility tokens (`bg-emerald-50`,
  `text-rose-700`, `border-slate-300`, etc.) so the dark-mode and brand
  palette can pivot without code change.
- Semantic accents: `emerald` for success, `rose` for failure, `sky` for
  in-flight, `slate` for neutral, `amber` for soft warnings.

## Static scan results

Run from repo root:

```
Grep pattern: '#[0-9a-fA-F]{3,6}\b'
```

| Path | Hits | Status |
|---|---|---|
| `src/components/AIChat/KimiWorkspace/tabeleShell/` | 0 | PASS |
| `src/components/MyWork/table/forms/` | 0 | PASS |
| `src/utils/tabeleAiEditorFlag.ts` | 0 | PASS |
| `src/utils/tabeleQaFlag.ts` | 0 | PASS |
| `src/utils/tabeleSourcePackFlag.ts` | 0 | PASS |
| `src/utils/tabeleConversionsFlag.ts` | 0 | PASS |
| `src/utils/tabeleFormIntakeFlag.ts` | 0 | PASS |

> **Caveat.** The pre-existing `PublicFormPage` (slug surface) is the only
> file under audit that mixes Tailwind palettes (`bg-blue-600`,
> `text-rose-500`) with the legacy `bg-gray-*` tokens. We retained the
> legacy palette for backward compatibility; D-S6 polish will harmonize
> both pages onto the slate / sky palette family used by `IntakeJwtPanel`
> and `PublicJwtFormPage`.

## Tone classification (semantic accents in shipped components)

| Component | Accent / state | Tailwind tokens used |
|---|---|---|
| `TabeleSharePanel` (D-S3) | success badge | `bg-emerald-50`, `text-emerald-700` (light) / `bg-emerald-950`, `text-emerald-200` (dark) |
| `TabeleSharePanel` | failed badge | `bg-rose-50`, `text-rose-700` (light) / `bg-rose-950`, `text-rose-200` (dark) |
| `TabeleSharePanel` | running badge | `bg-sky-50`, `text-sky-700` (light) / `bg-sky-950`, `text-sky-200` (dark) |
| `TabeleSharePanel` | queued / cancelled | `bg-slate-100`, `text-slate-700` (light) / `bg-slate-800`, `text-slate-200` (dark) |
| `IntakeJwtPanel` | header glyph | `text-emerald-500` (success indicator) |
| `IntakeJwtPanel` | issue button | `bg-emerald-600`, `hover:bg-emerald-700` |
| `IntakeJwtPanel` | issued banner | `border-emerald-200`, `bg-emerald-50` (light) / `border-emerald-900`, `bg-emerald-950/50` (dark) |
| `IntakeJwtPanel` | unpublished warning | `text-rose-500` |
| `PublicJwtFormPage` | expiry banner | `border-amber-200`, `bg-amber-50`, `text-amber-700` |
| `PublicJwtFormPage` | error banner | `border-rose-200`, `bg-rose-50`, `text-rose-700` |
| `PublicJwtFormPage` | submitted banner | `border-green-200`, `text-green-500` (legacy parity with slug page) |

## Recommendations for the manual sweep

1. Open the Tabele lane on staging and walk through every right-rail
   panel, verifying each badge / pill matches the table above.
2. Open `IntakeJwtPanel` on a published form and confirm the issued
   banner uses the emerald palette in both light and dark themes.
3. Open `/public/forms/jwt/<token>` in incognito and confirm the expiry
   warning appears in amber when the hard expiry is < 7 days.

## Follow-ups

- `TBL-FU-D-7` — Harmonize the legacy slug `PublicFormPage` palette with
  the new `PublicJwtFormPage` so both surfaces use slate / sky neutrals.
- `TBL-FU-D-8` — Replace the `bg-green-200` border on the submitted
  banner with `bg-emerald-200` to align with the success accent used
  elsewhere in the Tabele lane.

## Verdict

`PASS`. The surface is DBR77-compliant on the static-scan axis; the manual
sweep should confirm tone fidelity against the documented palette.
