# Light-Mode Legibility / Contrast Audit — Consultify

Date: 2026-06-03
Scope: `src/**/*.{tsx,ts,jsx}` className strings. Read-only audit. Goal: find text/shapes that are too light on light/white backgrounds in **light mode** and map them to darker tokens. Target WCAG AA (body/normal text ≥ 4.5:1; large text & UI/graphics ≥ 3:1).

## TL;DR

Light mode is at serious risk of looking washed-out. The dominant problem is **`text-slate-400` used as real body/label/value text** (not just captions) on white/off-white surfaces, plus **faint `border-slate-100` / `divide-slate-100` hairlines** that nearly vanish. These are unprefixed (light-mode) classes, so they render in light mode.

- **`text-slate-400` (light): ~5,744 occurrences** — the single biggest offender. Used pervasively as `<p>`, `<span>` labels and table headers, frequently with no darker pairing.
- **`text-slate-300` (light): ~803** — even lighter; mostly icons/dividers but also some text.
- **`border-slate-100`: ~614** and **`divide-slate-100`: ~118** — near-invisible hairlines.
- **Files affected (text classes): ~1,375**; (faint borders): ~384; **total unique files with any flagged pattern: ~1,444**.

The codebase still uses raw `slate-*`/`gray-*` almost everywhere; the new semantic tokens (`text-c-text-muted` etc.) are used only ~11 times. So the fix is largely a class-level remap (codemod) of slate/gray utilities to darker values or `c.*` tokens.

---

## Contrast math (worst offenders)

Backgrounds: `--c-surface #ffffff` and `--c-bg #fafaf9` (≈ identical for contrast).

| Color | Hex | Ratio vs #fff | Body (≥4.5) | Large/UI (≥3.0) |
|---|---|---|---|---|
| slate-300 | `#cbd5e1` | ~1.5:1 | FAIL | FAIL |
| slate-400 | `#94a3b8` | **~2.6:1** | **FAIL** | **FAIL** |
| gray-400 | `#9ca3af` | ~2.8:1 | FAIL | FAIL |
| slate-500 | `#64748b` | ~4.6:1 | PASS (borderline) | PASS |
| slate-600 | `#475569` | ~7.0:1 | PASS | PASS |
| slate-700 | `#334155` | ~9.6:1 | PASS | PASS |

Key finding: **slate-400 (~2.6:1) fails BOTH body AND large/UI thresholds** — it is not even safe as large caption text or as a meaningful icon color. slate-300 is far worse. Anything carrying meaning at slate-300/400 must be darkened. The semantic muted token `--c-text-muted #64748b` is exactly slate-500 (~4.6:1) — the minimum acceptable for muted body text.

Borders (graphic objects need ≥3:1 against adjacent color *only if* they convey state; structural hairlines are typically allowed to be subtle, but these are below the visibility floor):

| Border | Hex | Ratio vs #fff |
|---|---|---|
| border-slate-100 | `#f1f5f9` | ~1.1:1 (effectively invisible) |
| border-slate-200 | `#e2e8f0` | ~1.3:1 |
| `--c-border #e2e5e9` | | ~1.25:1 |

`border-slate-100` is below even the new `--c-border` baseline — it should be promoted to `border-c-border` (≈ slate-200) at minimum.

---

## Pattern counts (light-mode, variant-prefixed `dark:`/`hover:` excluded)

### 1. Too-light TEXT on light bg
| Class | Count | Verdict |
|---|---|---|
| `text-slate-400` | 5,744 | FAIL — primary offender |
| `text-slate-300` | 803 | FAIL (worse) |
| `text-gray-400` | 235 | FAIL |
| `text-gray-300` | 27 | FAIL |
| `text-zinc-400` | 9 | FAIL |
| `text-zinc-300` | 1 | FAIL |
| `text-neutral-300/400` | 0 | — |

For comparison (NOT flagged — these are dark-mode values): `dark:text-slate-400` ~11,555, `dark:text-slate-300` ~4,627. Most light usages do co-exist with a `dark:` override on the same element, but the **light value itself is too light** and must change.

### 2. Borderline / acceptable-if-muted
- `text-slate-500` (~11,213): ~4.6:1, passes as muted body. Leave, or map to `text-c-text-muted` for consistency. Do NOT lighten.

### 3. Faint borders / dividers
| Class | Count |
|---|---|
| `border-slate-100` | 614 |
| `divide-slate-200` | 143 |
| `divide-slate-100` | 118 |
| `border-gray-100` | 38 |
| `border-slate-50` | 6 |
| `divide-gray-100` | 5 |
| `border-gray-50` | 2 |

`divide-slate-200` is the baseline-acceptable divider; `*-100`/`*-50` variants are too faint.

### 4. Low-opacity text (light-mode)
| Class | Count | Notes |
|---|---|---|
| `opacity-50` | 271 | mixed (some on text → cuts contrast further) |
| `opacity-40` | 68 | |
| `text-slate-400/xx` | 16 | slate-400 already fails; opacity makes it worse |
| `text-slate-500/xx` | 6 | |

### 5. `text-white/xx` and `border-white/xx`
| Class family | Count |
|---|---|
| `text-white/xx` (total) | 255 (top: /50=51, /80=43, /70=38) |
| `border-white/xx` (total) | 787 (top: /10=482, /5=229) |

**Mostly NOT a light-mode bug.** Sampling shows these sit on colored gradients / dark hero cards (e.g. `bg-gradient-to-r … text-white/90`, dark report headers). They are intentional on dark backgrounds. **Case-by-case only** — flag any `text-white/xx` that lands on a white/`c-surface` background; the bulk are safe.

---

## Top files (file:line of worst concentrations)

### `text-slate-400` (light) — top 20
```
src/views/partner/PartnerPortalView.tsx:64
src/components/Interview/InsightViewer.tsx:57
src/components/Admin/UnifiedSyncHub.tsx:45
src/components/MyWork/IdeaTableTool.tsx:43
src/views/superadmin/revenue/PartnerSettlementsView.tsx:39
src/components/MyWork/NotificationDetailView.tsx:39
src/views/partner/sections/EarningsSection.tsx:34
src/views/superadmin/partners/PartnerProgramConfig.tsx:29
src/views/superadmin/AIConfigurationView.tsx:29
src/components/shared/NModeSections/AttachmentsLinksCanvas.tsx:28
src/components/Initiatives/InitiativeDocumentView.tsx:28
src/components/Reports/Management/ReportingAutomationWorkspace.tsx:27
src/components/SuperAdmin/system/EnterpriseApiManagement.tsx:26
src/components/settings/AISettings.tsx:25
src/components/MyWork/table/RowDetailPanel.tsx:25
src/components/Initiatives/sections/TimelineSection.tsx:25
src/components/SuperAdmin/system/EnterpriseFeatureFlags.tsx:24
src/components/SuperAdmin/billing/InvoicesPanel.tsx:24
src/components/MyWork/IdeaNodeDetailDrawer.tsx:24
src/views/partner/sections/ReferralToolsSection.tsx:23
```

Representative offending lines in `src/views/partner/PartnerPortalView.tsx` (all real text, not captions):
- `337: <p className="text-slate-400">` (body)
- `362: <span className="text-sm text-slate-400">{stat.label}</span>` (stat label)
- `815: <p className="text-sm text-slate-400 mb-2">{metric.label}</p>` (metric label)
- `1153: <th className="… text-xs font-medium text-slate-400 uppercase …">` (table header)
- `390: <action.icon className="w-6 h-6 text-slate-400 …" />` (meaningful icon)

### `text-slate-300` (light) — top files
```
src/components/Admin/UnifiedSyncHub.tsx:25
src/components/SuperAdmin/security/SecurityPoliciesPanel.tsx:14
src/components/SuperAdmin/system/EnterpriseApiManagement.tsx:12
src/components/Reports/Management/ReportsHub.tsx:12
src/components/Admin/SecuritySettings.tsx:12
src/components/SuperAdmin/EmailTemplateEditor.tsx:11
src/components/SuperAdmin/EmailConfigurationPanel.tsx:11
src/components/SuperAdmin/FeatureFlagsPanel.tsx:10
src/components/MyWork/Home/HomeView.tsx:10
src/components/SuperAdmin/integrations/WebhooksPanel.tsx:9
```

### `text-gray-400` (light) — top files
```
src/components/CV/CandidateProfileView.tsx:13
src/components/Knowledge/MediaUploader.tsx:11
src/components/MyWork/table/FormBuilder.tsx:9
src/components/Interview/InsightPackView.tsx:9
src/views/reports/PublicReportBuilderView.tsx:8
src/components/Survey/SurveyShell.tsx:8
src/views/PublicMiniAssessmentView.tsx:7
src/components/settings/security/WebAuthnSettings.tsx:7
```

### `border-slate-100` — top files
```
src/components/MyWork/shared/DependenciesSection.tsx:13
src/components/shared/NModeSections/AttachmentsLinksCanvas.tsx:10
src/components/SuperAdmin/SuperAdminStatusIndicators.tsx:9
src/components/MyWork/table/governed/GovernedModelsDashboard.tsx:9
src/components/MyWork/table/GridView.tsx:9
src/views/ContextBuilder/modules/SynthesisSummary.tsx:8
src/components/settings/WorkPreferencesSettings.tsx:8
src/components/Portfolio/InitiativeSidePanel.tsx:8
```

---

## Prioritized fix list

### P0 — Body/label/value text (global, high-confidence remap)
These fail AA and are read as content. Darken the **light value only**; leave any `dark:` sibling untouched.

| From (light) | To | Rationale |
|---|---|---|
| `text-slate-400` (as `<p>`/`<span>`/`<td>`/`<th>`/label/value) | `text-slate-600` or `text-c-text-secondary` (#475569, ~7:1) | body/labels need ≥4.5:1 |
| `text-gray-400` (text) | `text-slate-600` / `text-c-text-secondary` | same |
| `text-slate-300` (text) | `text-slate-600` (or `slate-500` min) | far below floor |
| `text-zinc-400/300` (text) | `text-slate-600` | normalize |

Muted/secondary content that should stay visibly lighter (timestamps, hints) → `text-slate-500` / `text-c-text-muted` (#64748b, ~4.6:1) is the **lowest** acceptable. Never below slate-500 for text.

### P1 — Meaningful icons currently at slate-300/400
Icons that convey state/action (e.g. `<action.icon className="text-slate-400">`) → `text-slate-500` minimum, `text-slate-600` preferred. Purely decorative icons may stay lighter but should still target ≥3:1 (so ≥ slate-500).

### P1 — Faint borders / dividers
| From | To |
|---|---|
| `border-slate-100`, `border-gray-100`, `border-slate-50`, `border-gray-50` | `border-c-border` (≈ slate-200) |
| `divide-slate-100`, `divide-gray-100` | `divide-c-border` / `divide-slate-200` |

`divide-slate-200` / `border-slate-200` are acceptable; align them to `c-border` for token consistency but they are not legibility blockers.

### P2 — Low-opacity text
- Replace `text-slate-400/xx` and `text-slate-500/xx` with a solid darker token (drop the opacity).
- Audit `opacity-40`/`opacity-50` occurrences that sit on **text** elements in light mode; convert to a darker solid color instead of opacity.

### P3 — `text-white/xx` on light backgrounds (case-by-case)
Bulk is on dark/gradient surfaces and is fine. Only fix instances rendered on white/`c-surface`.

---

## Codemod guidance: global-safe vs case-by-case

**Global-safe (can be batch-replaced with low risk):**
- `text-slate-300` → `text-slate-600` (it is too light for *any* text/meaningful icon).
- `text-gray-300` / `text-gray-400` → `text-slate-600` (also normalizes gray→slate palette).
- `text-zinc-300` / `text-zinc-400` → `text-slate-600`.
- `border-slate-100` / `border-gray-100` / `border-slate-50` / `border-gray-50` → `border-c-border`.
- `divide-slate-100` / `divide-gray-100` → `divide-slate-200` (or `divide-c-border`).
- Opacity-on-text utilities `text-slate-400/xx`, `text-slate-500/xx` → solid `text-slate-600`.

**Case-by-case (do NOT blind-replace — semantics matter):**
- `text-slate-400` (5,744): the largest bucket. Most are body/labels → `slate-600`/`c-text-secondary`, but a minority are genuinely-muted captions (timestamps, "/ 100" suffixes) that may go to `slate-500`/`c-text-muted` instead. Default the codemod to `text-slate-600` and spot-review captions; OR safer default `text-slate-500` (passes AA) then promote primary labels to slate-600. Either way, **never leave at 400**.
- `opacity-40` / `opacity-50` (339 total): used on containers, overlays, disabled states, AND text. Only the text ones are bugs.
- `text-white/xx` / `border-white/xx` (1,042 total): overwhelmingly on dark/colored surfaces — leave unless background is light.

**Important:** apply remaps only to the **light (unprefixed) value**. Do not touch `dark:text-slate-400`, `dark:text-slate-300`, etc. — those are correct dark-mode values. A naive global `s/text-slate-400/text-slate-600/` WILL corrupt `dark:text-slate-400` (→ `dark:text-slate-600`), so the codemod must use a boundary that excludes a preceding `:` (variant prefix). The scans in this report used `(?:^|[\s"'\`(])` to enforce that.

---

## Effort estimate

- **Files touched (text remaps):** ~1,375 unique files.
- **Files touched (border/divider remaps):** ~384 unique files.
- **Total unique files with at least one flagged pattern:** ~1,444.
- **Total flagged occurrences (text + faint borders + opacity-on-text):** roughly **7,500–8,000** edits, dominated by the ~5,744 `text-slate-400` instances.

Recommended sequencing:
1. Batch the global-safe maps (slate-300, gray-300/400, zinc, faint borders/dividers, opacity-on-text) — large win, low risk.
2. Run the `text-slate-400` remap with the variant-prefix-safe boundary, defaulting to `text-slate-600`, then spot-review captions to demote selected ones to `slate-500`/`c-text-muted`.
3. Sweep meaningful icons at slate-300/400 → slate-600.
4. Manual pass on `text-white/xx` only where the surface is light.

Longer-term: migrate raw slate/gray utilities to the `c.*` semantic tokens (`c-text`, `c-text-secondary`, `c-text-muted`, `c-border`) so future palette changes are one place — currently semantic tokens are used only ~11 times.
