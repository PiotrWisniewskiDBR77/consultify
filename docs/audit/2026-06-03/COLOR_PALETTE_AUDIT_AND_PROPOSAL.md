# Color Palette Audit & Proposal
**Date:** 2026-06-03 | **Branch:** feat/wave1-foundations | **Scope:** Light + Dark + Landing Page

---

## 1. Current Token Definitions

### tailwind.config.js scales
| Scale | Key values | Role (declared) |
|---|---|---|
| `crimson` | 50–950, DEFAULT=`#A51C30` | Brand accent / Harvard Crimson |
| `navy` | 50–950 (no 50 listed, 50=`#F1F5F9`) | Neutral structure, dark surfaces |
| `primary` | DEFAULT=`#7C3AED` (violet), 50–950 | Primary actions, links, focus |
| `secondary` | DEFAULT=`#1E3A5F`, 50–900 | Secondary nav |
| `danger` | DEFAULT=`#DC2626`, 50–900 | Errors |
| `success` | DEFAULT=`#059669`, 50–900 | Positive status |
| `brand` | mirrors `primary` (violet) — legacy alias | Backwards-compat only |
| `dbr77` | `#0B1121`/`#151E32`/`#1E293B` | Legacy deep-dark aliases |

### src/index.css :root / .dark CSS variables
- `--background`, `--foreground`, `--card`, `--popover`, `--muted` — shadcn defaults (HSL)
- `--accent` → crimson-600 light / crimson-400 dark (correctly set)
- `--ring` → crimson focus ring (correctly set)
- `--primary` → blue (shadcn default; **NOT violet, NOT crimson**) — inconsistent with Tailwind scale
- `--border`, `--input` → slate-200-ish HSL defaults
- Shadow tokens still hardcode `rgba(124, 58, 237, 0.3)` for `hig-focus` (violet)
- `hig-primary` / `hig-primary-hover` gradient = violet `#7C3AED → #8B5CF6` — no crimson equivalent

---

## 2. Actual Usage — The Drift

### Class counts across `src/**` (tsx/ts/jsx/js/css)
| Token family | Count | Verdict |
|---|---|---|
| `slate-*` | **83,951** | Dominant structural neutral — no semantic name |
| `navy-*` | **24,577** | Dark mode surfaces, correct-ish |
| `primary-*` (violet) | **17,707** | Primary actions — but brand is crimson |
| `bg-hig-primary` / HIG gradients | **880** | All violet, off-brand |
| Hardcoded `#rrggbb` hex | **2,546** | Scattered, many violet (`#7c3aed`, `#a855f7`) |
| `crimson-*` | **231** | Under-used vs intent |
| `bg-primary` / `bg-brand` (violet CTAs) | **6,336** | vs 99 `bg-crimson`/`bg-accent` — 64× gap |
| `rgba(124, 58, 237…)` violet in code | **7** in CSS, many more inline | Leaked hardcoded violet |

**Key finding:** Violet (`primary`/`brand`) dominates interactive elements at 17K+ tokens. Crimson is cosmetically present (231 uses) but crimson CTAs are 64× rarer than violet CTAs. The brand intent (Harvard Crimson) is not reflected in the actual interaction layer.

### Dark mode surfaces (top `dark:` classes)
| Class | Count |
|---|---|
| `dark:text-slate-400` | 11,547 |
| `dark:border-navy-700` | 7,197 |
| `dark:text-slate-300` | 4,622 |
| `dark:bg-navy-900` | 4,192 |
| `dark:bg-navy-800` | 3,465 |
| `dark:text-primary-400` | 1,121 |

Dark surfaces correctly use `navy-*`; text mixes `slate-*` (no semantic name) with navy. Violet (`primary-400`) still leaks as dark interactive text.

### Light mode surfaces
`bg-slate-50`, `bg-slate-100`, `bg-white` dominate (~19K hits) with zero semantic wrapper — any palette change requires grep-replace across 1,900+ files.

---

## 3. Landing Page Colors — Off-Brand Inventory

**Files:** `src/components/Landing/**`, `src/views/PublicLandingPage.tsx`, `PricingLandingPage.tsx`, `EnterprisePage.tsx`

Top LP color classes:
```
text-slate-500   54   text-primary-600  30   bg-primary-500  29
text-primary-300 23   text-primary-400  21   border-primary-500 21
bg-blue-500       9   from-primary-600   7   to-pink-600      4
```

Hardcoded in LP components:
- `#7c3aed` × 11, `#a855f7` × 10 (violet gradient CTA in EpicHeroSection:282)
- `#0A0A1F`, `#0D0828`, `#12082E` × 5 (deep near-black, non-navy scale)
- `rgba(124,58,237,…)` × 18 (glow/shadow)
- `background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #c026d3 100%)'` — hero CTA button (EpicHeroSection:282) — fully off-brand violet/fuchsia

The LP hero CTA is violet-to-fuchsia, not crimson. The LP is the highest-visibility brand moment; this is the most critical misalignment.

---

## 4. Dark Mode Implementation

- **Mechanism:** `darkMode: 'class'` in tailwind.config.js — `<html class="dark">` toggle.
- **Dark surfaces:** `navy-950` (`#0A0F1E`) = app bg, `navy-900` (`#0F172A`) = panel, `navy-800` (`#151E32`) = card — correctly defined, widely used.
- **Contrast issues:**
  - `dark:text-slate-400` on `navy-900` ≈ 4.1:1 (WCAG AA pass, but barely)
  - Violet `primary-400` (`#A78BFA`) on `navy-900` ≈ 5.8:1 (passes) — but wrong brand
  - Crimson `crimson-400` (`#E45868`) on `navy-900` ≈ 4.5:1 (passes AA, tighter than violet)
  - `dark:text-slate-500` on `navy-800` ≈ 3.6:1 — **WCAG AA fail** for body text

---

## 5. Proposed Canonical Semantic Palette

### Design Principles
- Neutral base = warm-tinted navy (not cold slate-gray, not pure black)
- Brand accent = Harvard Crimson `#A51C30` — **CTAs, brand moments, focus rings only** (not structural)
- Interactive/primary = navy-derived blue-gray in light; white in dark — NOT violet
- Violet `primary`/`brand` scale DEPRECATED for new work; existing violet cleaned in migration

### Semantic Token Table

| Token | Light | Dark | Usage |
|---|---|---|---|
| **BACKGROUNDS** | | | |
| `--c-bg-app` | `#F8FAFC` | `#0A0F1E` | Root app background |
| `--c-bg-surface` | `#FFFFFF` | `#0F172A` | Cards, panels |
| `--c-bg-surface-raised` | `#FFFFFF` | `#151E32` | Elevated cards (modal-level) |
| `--c-bg-surface-overlay` | `rgba(248,250,252,0.95)` | `rgba(10,15,30,0.95)` | Popovers, dropdowns |
| `--c-bg-subtle` | `#F1F5F9` | `#111827` | Tinted inset, code blocks |
| `--c-bg-hover` | `#E9EEF5` | `#1A2440` | Row/item hover state |
| **BORDERS** | | | |
| `--c-border-subtle` | `#EDF0F5` | `rgba(255,255,255,0.04)` | Hairline separators |
| `--c-border-default` | `#D8DFE9` | `rgba(255,255,255,0.08)` | Card borders, inputs |
| `--c-border-strong` | `#B0BCCC` | `rgba(255,255,255,0.18)` | Emphasized borders |
| **TEXT** | | | |
| `--c-text-primary` | `#0F172A` | `#F1F5F9` | Body, headings |
| `--c-text-secondary` | `#374151` | `#CBD5E1` | Subtext, labels |
| `--c-text-muted` | `#64748B` | `#94A3B8` | Hints, placeholders |
| `--c-text-inverse` | `#FFFFFF` | `#0F172A` | Text on dark/crimson bg |
| `--c-text-disabled` | `#A8B4C4` | `#3A4A60` | Disabled UI |
| **BRAND ACCENT — Harvard Crimson** | | | |
| `--c-accent` | `#A51C30` | `#E45868` | Primary CTA bg, active nav pip |
| `--c-accent-hover` | `#851627` | `#D42B3D` | CTA hover |
| `--c-accent-subtle` | `#FDF2F3` | `rgba(165,28,48,0.15)` | Accent tint background |
| `--c-accent-text` | `#A51C30` | `#E45868` | Crimson text on neutral bg |
| `--c-accent-on` | `#FFFFFF` | `#FFFFFF` | Text on crimson button |
| **INTERACTIVE (non-CTA)** | | | |
| `--c-interactive` | `#1E3A5F` | `#94A3B8` | Links, secondary actions |
| `--c-interactive-hover` | `#0F2744` | `#CBD5E1` | Link hover |
| `--c-focus-ring` | `rgba(165,28,48,0.35)` | `rgba(228,88,104,0.40)` | Focus ring (crimson) |
| **STATUS** | | | |
| `--c-success` | `#059669` | `#34D399` | Positive status |
| `--c-success-subtle` | `#ECFDF5` | `rgba(5,150,105,0.12)` | Success bg |
| `--c-warning` | `#D97706` | `#FBBF24` | Warning state |
| `--c-warning-subtle` | `#FFFBEB` | `rgba(217,119,6,0.12)` | Warning bg |
| `--c-danger` | `#DC2626` | `#F87171` | Error/destructive |
| `--c-danger-subtle` | `#FEF2F2` | `rgba(220,38,38,0.12)` | Error bg |
| `--c-info` | `#0284C7` | `#38BDF8` | Informational |
| `--c-info-subtle` | `#F0F9FF` | `rgba(2,132,199,0.12)` | Info bg |
| **CHART PALETTE** (6-color) | | | |
| `--c-chart-1` | `#A51C30` | `#E45868` | Crimson — series 1 |
| `--c-chart-2` | `#1E3A5F` | `#6E8AAF` | Navy — series 2 |
| `--c-chart-3` | `#059669` | `#34D399` | Emerald — series 3 |
| `--c-chart-4` | `#D97706` | `#FBBF24` | Amber — series 4 |
| `--c-chart-5` | `#0284C7` | `#38BDF8` | Blue — series 5 |
| `--c-chart-6` | `#7C3AED` | `#A78BFA` | Violet — series 6 only |

> Crimson rule: use `--c-accent` ONLY on ≤3 interactive elements visible simultaneously. Never on structural/information color.

---

## 6. Central Implementation Recommendation

### Step 1 — Extend `:root` / `.dark` in `src/index.css`

```css
:root {
  /* Backgrounds */
  --c-bg-app:            #F8FAFC;
  --c-bg-surface:        #FFFFFF;
  --c-bg-surface-raised: #FFFFFF;
  --c-bg-subtle:         #F1F5F9;
  --c-bg-hover:          #E9EEF5;
  /* Borders */
  --c-border-subtle:     #EDF0F5;
  --c-border-default:    #D8DFE9;
  --c-border-strong:     #B0BCCC;
  /* Text */
  --c-text-primary:      #0F172A;
  --c-text-secondary:    #374151;
  --c-text-muted:        #64748B;
  --c-text-disabled:     #A8B4C4;
  --c-text-inverse:      #FFFFFF;
  /* Accent */
  --c-accent:            #A51C30;
  --c-accent-hover:      #851627;
  --c-accent-subtle:     #FDF2F3;
  --c-accent-on:         #FFFFFF;
  /* Interactive */
  --c-interactive:       #1E3A5F;
  --c-focus-ring:        rgba(165,28,48,0.35);
}

.dark {
  --c-bg-app:            #0A0F1E;
  --c-bg-surface:        #0F172A;
  --c-bg-surface-raised: #151E32;
  --c-bg-subtle:         #111827;
  --c-bg-hover:          #1A2440;
  --c-border-subtle:     rgba(255,255,255,0.04);
  --c-border-default:    rgba(255,255,255,0.08);
  --c-border-strong:     rgba(255,255,255,0.18);
  --c-text-primary:      #F1F5F9;
  --c-text-secondary:    #CBD5E1;
  --c-text-muted:        #94A3B8;
  --c-text-disabled:     #3A4A60;
  --c-text-inverse:      #0F172A;
  --c-accent:            #E45868;
  --c-accent-hover:      #D42B3D;
  --c-accent-subtle:     rgba(165,28,48,0.15);
  --c-accent-on:         #FFFFFF;
  --c-interactive:       #94A3B8;
  --c-focus-ring:        rgba(228,88,104,0.40);
}
```

### Step 2 — Add semantic token names to `tailwind.config.js`

```js
colors: {
  // ... existing scales kept for migration ...
  c: {
    'bg-app':            'var(--c-bg-app)',
    'bg-surface':        'var(--c-bg-surface)',
    'bg-surface-raised': 'var(--c-bg-surface-raised)',
    'bg-subtle':         'var(--c-bg-subtle)',
    'bg-hover':          'var(--c-bg-hover)',
    'border-subtle':     'var(--c-border-subtle)',
    'border-default':    'var(--c-border-default)',
    'border-strong':     'var(--c-border-strong)',
    'text-primary':      'var(--c-text-primary)',
    'text-secondary':    'var(--c-text-secondary)',
    'text-muted':        'var(--c-text-muted)',
    'text-inverse':      'var(--c-text-inverse)',
    'accent':            'var(--c-accent)',
    'accent-hover':      'var(--c-accent-hover)',
    'accent-subtle':     'var(--c-accent-subtle)',
    'accent-on':         'var(--c-accent-on)',
    'interactive':       'var(--c-interactive)',
  },
}
```

Usage: `bg-c-bg-surface`, `text-c-text-muted`, `bg-c-accent`, `border-c-border-default`.

---

## 7. Migration Approach

### Phase 0 — No-drift (do now, ~1 day)
1. Add all CSS variables to `:root`/`.dark` — zero app change.
2. Add `c` Tailwind namespace — zero app change.
3. Fix focus ring: `hig-focus` shadow in `tailwind.config.js` from `rgba(124,58,237,0.3)` → `rgba(165,28,48,0.30)`.

### Phase 1 — Landing Page (highest brand ROI, ~1 day)
- `EpicHeroSection.tsx:282` — replace violet/fuchsia gradient CTA with `bg-c-accent` + hover `bg-c-accent-hover`
- Replace all `bg-primary-*`, `text-primary-*`, `from-primary-*` in `src/components/Landing/**` → crimson equivalents or `c-*` semantic tokens
- Remove `#7c3aed`, `#a855f7`, `#c026d3`, `#0A0A1F`/`#0D0828` hardcoded hex

### Phase 2 — Global interactive elements (~3 days)
- Replace `bg-primary` / `bg-hig-primary` / `bg-brand` (6,336 occurrences) → `bg-c-accent` for primary CTAs; `bg-c-interactive` for secondary actions
- `hig-primary` gradient: create `hig-accent` gradient = `linear-gradient(135deg, #A51C30 0%, #D42B3D 100%)`

### Phase 3 — Structural neutrals (ongoing)
- Replace `bg-slate-50` → `bg-c-bg-subtle`, `bg-white` → `bg-c-bg-surface`, `dark:bg-navy-900` → `bg-c-bg-surface`
- Replace `text-slate-400` → `text-c-text-muted` etc.
- 83K slate tokens = codemods, not manual — use: `npx ts-node scripts/migrate-slate-tokens.ts`

### Deprecation timeline
- `primary`/`brand` (violet) scale: frozen after Phase 2, removed in v1.1
- `dbr77` scale: remove immediately after Phase 0
- Hardcoded `rgba(124,58,237,…)`: grep replace in Phase 2

---

## 8. Key Evidence References

| Finding | File:line |
|---|---|
| Violet LP hero CTA gradient | `src/components/Landing/EpicHeroSection.tsx:282` |
| Crimson `--accent` correctly set in CSS | `src/index.css:20-23` |
| `hig-primary` still violet | `tailwind.config.js:250-251` |
| `hig-focus` shadow still violet | `tailwind.config.js:207` |
| `dark:text-slate-500` WCAG fail risk | `src/index.css:119` pattern |
| `brand` scale = violet alias (stale) | `tailwind.config.js:149-164` |

**TL;DR:** Crimson is correctly declared but functionally absent — violet dominates at 64× the CTA usage. Fix the LP hero first (1 file, immediate brand impact), then gate all new interactive work on `c-accent` (crimson), freeze violet.
