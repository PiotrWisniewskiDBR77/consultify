# Consultify — Detailed Color Usage Audit (post-palette-remap)

**Date:** 2026-06-04
**Scope:** read-only audit of `src/` (`.tsx` / `.ts`) against the central palette.
**Source of truth:** `tailwind.config.js` + `src/index.css`.
**Method:** ripgrep occurrence counts (every match, not file-deduped) unless noted.

> TL;DR: The central remap is working — the dominant utility families (`primary`, `slate`,
> `navy`, plus the remapped `blue/green/amber/emerald/indigo/rose`) are **token-backed**,
> so the app already recolors to Harvard hues without call-site edits. The remaining problems
> are **~2,262 raw hex literals** and **~579 inline-style literal colors** that bypass the
> remap entirely (many are *old* Tailwind-default hexes like `#7c3aed`, `#6366f1`, `#f59e0b`
> still rendering off-brand), plus **~370 decorative purple/indigo gradient stops** and a
> **crimson over-application** risk (`bg-primary-*` solid fills = 6,161). Dirtiest modules:
> **Reports, MyWork, Presentations, settings, Landing**.

---

## 1. Token Source-of-Truth Dump

### 1a. `tailwind.config.js` — color scales

**Brand accent — Harvard Crimson** (`crimson`, and `primary`/`brand` re-pointed to it):

| stop | crimson / primary / brand |
|---|---|
| DEFAULT | `#A51C30` (brand canonical CTA) |
| 50 | `#FDF2F3` |
| 100 | `#FBDDE0` |
| 200 | `#F6B8BE` |
| 300 | `#EF8A94` |
| 400 | `#E45868` |
| 500 | `#D42B3D` (AA on white) |
| 600 | `#A51C30` (brand) |
| 700 | `#851627` |
| 800 | `#651120` |
| 900 | `#450C16` |
| 950 | `#2B070D` |

`primary` also has `hover:#851627`, `light:#D42B3D`, `surface:rgba(165,28,48,.1)`.
`brand` is a legacy alias re-pointed crimson (was violet `#7C3AED`).

**Neutral — `navy`** (structural, NOT remapped):
`950 #0A0F1E · 900 #0F172A · 850 #111827 · 800 #151E32 · 700 #2A3655 · 600 #374151 · 500 #475569 · 400 #64748B · 300 #94A3B8 · 200 #CBD5E1 · 100 #E2E8F0 · 50 #F1F5F9`

**`secondary`** (navy-blue): DEFAULT `#1E3A5F`, hover `#0F2744`, light `#2E4A6F`, surface `rgba(30,58,95,.1)`, 900→50 `#0F2744 … #F0F5FF`.

**Semantic `danger`** (HBS Red, kept distinct from crimson): DEFAULT `#E80538`, hover `#C1042F`, light `#ED5541`, 700 `#910A28` (AA text), … 50 `#FDF1ED`.
**Semantic `success`** (HBS Green): DEFAULT `#52A52E`, hover `#388A22`, light `#9EC44D`, 700 `#026833` (AA text), … 50 `#F3FAEC`.

**`dbr77`**: DEFAULT `#0B1121`, light `#151E32`, lighter `#1E293B`.

**Harvard complementary (`hbs-*`)** — official HBS anchors, AA-legible 700/800:

| family | 500 (mid) | 700 (dark, AA) |
|---|---|---|
| hbs-blue | `#6578B4` | `#3B2883` |
| hbs-green | `#52A52E` | `#026833` |
| hbs-teal | `#00979D` | `#006085` |
| hbs-orange | `#E87D1E` | `#AE6429` |
| hbs-gold | `#EBCD00` | `#C29D00` |
| hbs-purple | `#80408D` | `#57116A` |
| hbs-magenta | `#C9006B` | `#78244C` |
| hbs-red | `#E80538` | `#910A28` |

**CENTRAL REMAP — Tailwind accent families re-pointed to HBS hues** (zero call-site edits):

| Tailwind family | mapped to | 500 | 700 |
|---|---|---|---|
| `indigo` / `violet` / `purple` | HBS Purple | `#80408D` | `#57116A` |
| `fuchsia` / `pink` | HBS Magenta | `#C9006B` | `#78244C` |
| `blue` / `sky` | HBS Blue | `#6578B4` | `#3B2883` |
| `emerald` / `green` / `lime` | HBS Green | `#52A52E` | `#026833` |
| `teal` / `cyan` | HBS Teal | `#00979D` | `#006085` |
| `amber` / `orange` | HBS Orange | `#E87D1E` | `#AE6429` |
| `yellow` | HBS Gold | `#EBCD00` | `#C29D00` |
| `rose` / `red` | HBS Red | `#E80538` | `#910A28` |

> Structural neutrals (`slate`, `gray`, `zinc`, `neutral`, `stone`) and brand
> (`crimson`, `primary`, `navy`) are **NOT** remapped — Tailwind defaults apply for slate/gray/zinc.

**Brand box-shadows / gradients re-pointed crimson:** `shadow-glow`, `shadow-hig-focus`,
`token-focus` all use `rgba(165,28,48,…)`. `bg-hig-primary` = solid `#A51C30` (no gradient).

### 1b. `src/index.css` — CSS variables

**shadcn vars `:root` (light)** — `--primary`, `--accent`, `--ring` re-pointed crimson:
```
--background 0 0% 100%   --foreground 222.2 84% 4.9%
--card 0 0% 100%         --card-foreground 222.2 84% 4.9%
--popover 0 0% 100%      --popover-foreground 222.2 84% 4.9%
--primary 358 71% 38%    (crimson-600 #A51C30; was blue 221.2 83.2% 53.3%)
--primary-foreground 0 0% 100%
--secondary 210 40% 96.1%   --secondary-foreground 222.2 47.4% 11.2%
--muted 210 40% 96.1%       --muted-foreground 215.4 16.3% 46.9%
--accent 358 71% 38%        --accent-foreground 0 0% 100%
--accent-hover 350 71% 30%  --accent-surface 354 73% 97%
--destructive 0 84.2% 60.2% --destructive-foreground 210 40% 98%
--border 214.3 31.8% 91.4%  --input 214.3 31.8% 91.4%
--ring 358 71% 38%          --radius 0.75rem (hig-md 12px)
```

**Canonical `--c-*` tokens `:root` (light):**
```
--c-bg #fafaf9            --c-surface #ffffff       --c-surface-raised #ffffff
--c-border-subtle #eef0f2 --c-border #e2e5e9
--c-text #0f172a          --c-text-secondary #475569 --c-text-muted #64748b
--c-accent #a51c30        --c-accent-soft rgba(165,28,48,.08)  --c-focus rgba(165,28,48,.35)
--c-success #026833       --c-warning #ae6429       --c-danger #e80538   --c-info #3b2883
```

**shadcn vars `.dark`** (crimson lifted for contrast):
```
--background 222.2 84% 4.9%   --foreground 210 40% 98%
--primary 354 72% 62%   (crimson-400 #E45868)   --accent 354 72% 62%
--accent-hover 354 65% 53%    --accent-surface 350 60% 13%
--destructive 0 62.8% 30.6%   --border 217.2 32.6% 17.5%   --ring 354 72% 62%
(muted-foreground 215 20.2% 65.1%)
```

**Canonical `--c-*` tokens `.dark`:**
```
--c-bg #0b1220           --c-surface #0f172a       --c-surface-raised #15213b
--c-border-subtle rgba(255,255,255,.06)  --c-border rgba(255,255,255,.1)
--c-text #f1f5f9         --c-text-secondary #94a3b8 --c-text-muted #64748b
--c-accent #c8324a       --c-accent-soft rgba(200,50,74,.14)  --c-focus rgba(165,28,48,.35)
--c-success #9ec44d      --c-warning #f7c76b       --c-danger #ed5541   --c-info #aac8eb
```

---

## 2. App-wide Usage Inventory

Occurrence counts in `src/` className strings (every match). "Token-backed" = the family
resolves through `tailwind.config.js`/`index.css` to a brand/HBS hue.

### 2a. Utility families with numeric stops (`bg/text/border/ring/from/via/to/fill/stroke/divide/placeholder/decoration/outline/accent/caret`)

| Family | Count | Backing |
|---|---:|---|
| **slate** | 82,684 | Tailwind default (neutral) — token-backed, intentional |
| **navy** | 24,441 | config neutral — token-backed |
| **primary** | 17,471 | config → crimson — **token-backed (brand)** |
| **amber** | 9,835 | remapped → HBS Orange |
| **rose** | 9,462 | remapped → HBS Red |
| **blue** | 8,592 | remapped → HBS Blue |
| **emerald** | 6,551 | remapped → HBS Green |
| **gray** | 4,247 | Tailwind default (neutral) |
| **green** | 3,690 | remapped → HBS Green |
| **indigo** | 2,379 | remapped → HBS Purple |
| **yellow** | 753 | remapped → HBS Gold |
| **sky** | 599 | remapped → HBS Blue |
| **pink** | 300 | remapped → HBS Magenta |
| **zinc** | 257 | Tailwind default (neutral) |
| **crimson** | 229 | config → brand — token-backed |
| **fuchsia** | 86 | remapped → HBS Magenta |
| **red** | 64 | remapped → HBS Red |
| **brand** | 56 | alias → crimson |
| **secondary** | 42 | config navy-blue |
| **orange** | 32 | remapped → HBS Orange |
| **violet** | 20 | remapped → HBS Purple |
| **lime** | 19 | remapped → HBS Green |
| **purple** | 16 | remapped → HBS Purple |
| **teal / cyan / emerald-dup** | 6 / 6 | remapped → HBS Teal/Green |
| neutral / stone / gold / magenta / hbs-* | 0 | (hbs-* used only as remap target, not directly) |

### 2b. Non-numeric / semantic utilities

| Token | Count | Notes |
|---|---:|---|
| `*-white` | 25,599 | structural |
| `*-black` | 595 | structural |
| `*-transparent` | 725 | structural |
| `*-current` | 79 | structural |
| `bg/text/...-primary` (DEFAULT, no stop) | ~10 | shadcn `--primary` (crimson) |
| `*-muted` / `-muted-foreground` | 31 / 15 | shadcn |
| `*-secondary` (DEFAULT) | ~55 | shadcn |
| `*-accent` / `-accent-foreground` | 12 / 4 | shadcn crimson |
| `*-destructive` | 7 | shadcn |
| `*-background/-foreground/-card/-popover/-border/-input/-ring` | 9/9/2/8/1/3/10 | shadcn |

### 2c. Canonical `c-*` token adoption (low — opportunity)

`text-c-text` 33 · `text-c-accent`/`bg-c-accent` 17 (11 bg) · `text-c-text-muted` 12 ·
`*-c-warning` 10 · `*-c-danger` 10 · `border-c-border` 7 · `c-text-secondary` 7 ·
`c-accent-soft` 6 · `c-success` 5 · `c-info` 5 · `c-surface` 3 · `c-surface-raised` 3 ·
`c-border-subtle` 2 · `c-bg` 0 · `c-focus` 0.
**Total `c-*` className uses ≈ 130** — the canonical namespace is shipped but barely adopted;
the app still leans on raw `slate/navy/primary` utilities.

**Verdict:** the vast majority of color utilities are **token-backed** (brand crimson via
`primary`, HBS via remapped families, neutrals via slate/navy). The leakage is in **raw hex /
inline styles / arbitrary brackets** (Section 3) — not in the utility classes.

---

## 3. OFF-STANDARD Offenders (actionable)

### 3a. Raw hex `#rrggbb` / `#rgb` in `.tsx` / `.ts`

- **Total occurrences: 2,262** across **232 files**.

Top offender files:

| Count | File |
|---:|---|
| 182 | `src/components/Presentations/wizard/types.ts` |
| 93 | `src/components/MyWork/table/tableTypes.ts` |
| 82 | `src/components/settings/ConnectedAppsSettings.tsx` |
| 78 | `src/components/MyWork/IdeaRecommendationMap.tsx` |
| 65 | `src/components/MyWork/IdeaTemplateGallery.tsx` |
| 52 | `src/components/MyWork/mindmap/floating-toolbar/ColorPickerPopover.tsx` |
| 51 | `src/components/MyWork/NotebookContent.tsx` |
| 50 | `src/components/Reports/AreaDetailCard.tsx` |
| 42 | `src/components/ReportBuilder/blocks/ChartRenderer.tsx` |
| 39 | `src/components/Reports/AreaMatrixTable.tsx` |
| 38 | `src/components/Reports/AxisReportSection.tsx` |
| 35 | `src/components/MyWork/table/FrameworkGenerator.tsx` |
| 32 | `src/components/MyWork/mindmap/MindmapInspector.tsx` |
| 25 each | `Reports/ProgressRing.tsx`, `MyWork/processflow/LaneSystem.tsx`, `Admin/BrandingSettingsPanel.tsx` |

**LEGIT (call out separately, leave alone):**
- **3rd-party brand logos / SVG icons** — `fill="#…"` / `stroke="#…"` = **263 occurrences**.
  Top: `settings/ConnectedAppsSettings.tsx` (78 — Google `#EA4335`, MS `#0078D4`, Slack `#E01E5A`…),
  `MyWork/table/connectors/ConnectorIcons.tsx` (23), `settings/IntegrationAnalyticsSettings.tsx` (15).
- **Color-picker swatch palettes** — `MyWork/mindmap/floating-toolbar/ColorPickerPopover.tsx`,
  `MyWork/table/RowTemplatePicker.tsx`, `MyWork/mindmap/tagColorMapping.ts`,
  `settings/appearance/VisualCustomizationSettings.tsx` (theme swatches).
- **Chart series data** — `Charts/RadarChart.tsx`, `Charts/ComparisonRadarChart.tsx`,
  `RadarChart.tsx`, `ROIPaybackChart.tsx`, `Reports/RadarChart.tsx`,
  `ReportBuilder/blocks/ChartRenderer.tsx`. (Recharts/SVG need literal colors.)
- **`Presentations/wizard/types.ts`** (182) — deck theme presets; these are *already* on-brand
  (`#A51C30`, HBS hues) so they are correct data, not className offenders.

**TRUE OFFENDERS inside the raw-hex total — OLD Tailwind-default hexes that escaped the remap**
(these render off-brand because they are literal pre-remap values, not utility classes):

| Old hex(es) | meaning | occurrences |
|---|---|---:|
| `#7c3aed` / `#a855f7` / `#8b5cf6` / `#a78bfa` | **old brand violet** (demoted!) | 47+ |
| `#6366f1` | old indigo | 115 |
| `#f43f5e` / `#fb7185` | old rose | 105 |
| `#f59e0b` / `#fbbf24` | old amber | 139 |
| `#10b981` / `#34d399` / `#22c55e` | old emerald/green | 165 |
| `#3b82f6` / `#2563eb` / `#60a5fa` | old blue | 179 |

These are the highest-value cleanup: e.g. `Reports/AreaDetailCard.tsx:99-102` returns
`color:'#f43f5e'`, `'#f59e0b'`, `'#eab308'`, `'#22c55e'` for severity — should reference
`--c-danger / --c-warning / --c-success`. `MyWork/table/tableTypes.ts:139-142` status colors
use `#e0e7ff/#fef3c7/#d1fae5/#fee2e2` (old defaults). `IdeaRecommendationMap.tsx:304-339`
edge colors use `#fb7185/#34d399/#fbbf24/#38bdf8/#a78bfa/#22d3ee` (all old defaults).

**Raw crimson literal `#A51C30`** = 24 occurrences across 15 files (Landing/*, `Meeting/MeetingHub.tsx`,
`Economics/AnalysisCompareView.tsx`, `Execution/RolloutTab.tsx`, …). On-brand value but should be
the `--c-accent` / `crimson` token, not a hard-coded literal.

### 3b. Arbitrary Tailwind color brackets `bg-[#…]` / `text-[#…]` / `border-[#…]`

- **Total: 68 occurrences** across **30 files**.

Top files: `Landing/EntryFooter.tsx` (12), `views/knowledge/KnowledgeBaseHomePage.tsx` (5),
`Meeting/MeetingHub.tsx` (5), `views/knowledge/KnowledgeBaseCategoryPage.tsx` (4),
`AIChat/WorkCanvasDocumentPanel.tsx` (4), `MyWork/Home/HomeView.tsx` (3),
`Landing/AnnaAssistantWidget.tsx` (3), `Interview/TemplateBuilder.tsx` (3).

**Sub-categories:**
- **Social-brand logo colors (LEGIT)** — `Landing/EntryFooter.tsx`: `bg-[#0077B5]` (LinkedIn),
  `bg-[#FF0000]` (YouTube), `bg-[#1877F2]` (Facebook), `bg-[#1DB954]` (Spotify),
  `from-[#F58529] via-[#DD2A7B] to-[#8134AF]` (Instagram). Keep.
- **Crimson in brackets (OFFENDER → token)** — `Meeting/MeetingHub.tsx`: `text-[#A51C30]`,
  `bg-[#A51C30] hover:bg-[#8a1828]` (×2); `DiscoveryTools/tools/Digital/GenericDomainStep.tsx`:
  `bg-[#A51C30] hover:bg-[#8e1729]`. Replace with `bg-crimson` / `text-c-accent`.
- **Off-brand dark-surface hexes (OFFENDER → navy/c-surface tokens)** — dark-purple-tinted
  surfaces not in palette: `views/knowledge/KnowledgeBaseHomePage.tsx` `dark:bg-[#0D0828]`,
  `dark:from-[#0D0828] dark:to-[#12082E]`; `KnowledgeBaseCategoryPage.tsx` same;
  `Landing/AIOsProductMapSection.tsx` `dark:bg-[#0F0A2B]`; `Landing/EntryFooter.tsx`
  `dark:bg-[#0B0A23]`; `views/ProductEntryPage.tsx` `dark:bg-[#0A0A1F]`;
  `Landing/MarketingLayout.tsx` `dark:bg-[#0A0F1E]` (= navy-950, should be `dark:bg-navy-950`);
  `MyWork/Home/HomeView.tsx` `dark:bg-[#060B18]` (×3); `Interview/TemplateBuilder.tsx`
  `dark:bg-[#1b2440]`, `dark:bg-[#0b1324]`; `AIChat/WorkCanvasDocumentPanel.tsx` `dark:bg-[#1a1d25]` (×2).

### 3c. Inline `style={{ color/background/border… }}` with literal colors

- **Total: 579 occurrences** across **86 files** (literal `#hex` or `rgb()/rgba()` in style props).

Top files:

| Count | File | Note |
|---:|---|---|
| 52 | `MyWork/NotebookContent.tsx` | mixed (some chart/swatch, some decorative) |
| 43 | `Reports/AreaDetailCard.tsx` | severity colors — OLD defaults → c-tokens |
| 32 | `Reports/AreaMatrixTable.tsx` | OLD defaults |
| 29 | `Reports/AxisReportSection.tsx` | OLD defaults |
| 20 | `MyWork/IdeaTemplateGallery.tsx` | template thumbnails (semi-legit) |
| 16 | `src/index.tsx` | bootstrap loader styles |
| 16 | `ReportBuilder/blocks/ChartRenderer.tsx` | chart (legit) |
| 14 | `views/HowItWorksPage.tsx` | **OLD brand violet `#7c3aed`/`#a855f7` decorative** |
| 13 | `Presentations/wizard/types.ts` | on-brand deck data |
| 13 | `MyWork/IdeaRecommendationMap.tsx` | OLD defaults |
| 12 | `settings/appearance/VisualCustomizationSettings.tsx` | theme swatches (legit data, but mislabeled — `id:'violet'` maps to `#6366F1`) |
| 10 each | `EnterprisePage.tsx`, `MyWork/table/RowTemplatePicker.tsx`, `MyWork/mindmap/tagColorMapping.ts`, `MyWork/mindmap/ExportPowerPoint.tsx` | mixed |

**Highest-value offenders:** `views/HowItWorksPage.tsx` decorative tiles use the **demoted brand
violet** as inline `color`/`background`/`glow`:
`color:'#7c3aed'`, `'#a855f7'`, `background:'linear-gradient(135deg, #7c3aed, #a855f7)'`,
`glow:'rgba(124,58,237,0.30)'` — these are literally the pre-remap brand color and render
off-brand purple. `#7c3aed`/`#a855f7` also appear in `views/ForWhomPage.tsx`,
`views/VectorPage.tsx`, `views/legal/ContactView.tsx`, `MyWork/Calendar/CalendarGrid.tsx`,
`MyWork/NotebookContent.tsx`, `Help/FloatingHelpWidget.tsx`, `shared/InfoButton.tsx`,
`views/knowledge/KnowledgeBaseArticlePage.tsx`.

### 3d. Gradients (`bg-gradient-*` with color stops)

- **`bg-gradient-*` utility uses: 874** occurrences across **460 files**.

Color-stop families (`from-/via-/to-<family>`):

| Family | stops | brand status |
|---|---:|---|
| `primary` | 801 | ✅ crimson |
| `slate` | 212 | ✅ neutral |
| `navy` | 181 | ✅ neutral |
| `blue` | 517 | remapped HBS Blue |
| `amber` | 282 | remapped HBS Orange |
| `indigo` | 317 | remapped HBS Purple — decorative purple ⚠ |
| `emerald` | 185 | remapped HBS Green |
| `white` | 116 | structural |
| `rose` | 99 | remapped HBS Red |
| `green` | 66 | remapped HBS Green |
| `pink` | 49 | remapped HBS Magenta — decorative ⚠ |
| `brand` | 19 | ✅ crimson alias |
| `crimson` | 14 | ✅ |
| `sky` | 17 · `black` 18 · `yellow` 7 · `fuchsia` 4 · `lime` 4 · `red` 1 | mixed |

**Decorative purple/indigo/violet/fuchsia/pink gradient stops = 370 total.** Although the families
are *remapped* to HBS hues (so they no longer render true violet/fuchsia), they still read as
**purple decorative gradients** which is off the "crimson is the sole accent, used lightly" brief.

**Most concerning pattern — `from-primary-* to-indigo-*` (crimson→purple two-tone CTAs):**
`views/AuthView.tsx` (`from-primary-600 to-indigo-600` sign-in button),
`components/demo/DemoTrialButton.tsx`, `components/demo/DemoUpgradePrompt.tsx` (several),
`components/demo/DemoSessionManager.tsx`, `layouts/DocsLayout.tsx`. These render a
crimson→HBS-purple blend on primary CTAs — should be flat crimson per `bg-hig-primary`.

Top files by decorative purple/indigo/pink gradient stops:
`views/LegalIndexView.tsx` (10), `views/LegalDocumentView.tsx` (8),
`ReportBuilder/ReportEditor/BlockPalette.tsx` (7), `Profile/MFASetup.tsx` (7),
`MyWork/Focus/FocusBoard.tsx` (7), `views/partner/ProviderHomeView.tsx` (6),
`views/ToolsShowcasePage.tsx` (6), `components/demo/DemoUpgradePrompt.tsx` (6),
`components/ai/MAXModeToggle.tsx` (6), `MyWork/shared/EmptyState.tsx` (6),
`MyWork/NotebookContent.tsx` (6).

### 3e. Direct `dark:` contrast risks

| Pattern | Count | Risk |
|---|---:|---|
| `dark:text-slate-500` | 3,421 | borderline — slate-500 `#64748B` on dark surfaces ≈ 3.5:1 (fails AA body, OK for muted/secondary) |
| `dark:text-slate-600` | 300 | **too dark** on dark surfaces (`#475569`, ~2.5:1) — fails |
| `dark:text-navy-500/600` | 40 | too dark on dark |
| `dark:text-gray-500/600` | 120 | gray-600 too dark on dark |

| Light-mode too-light body text | Count | Risk |
|---|---:|---|
| `text-slate-400` (non-`dark:`) | ~180 | `#94A3B8` on white ≈ 2.5:1 — fails AA body; escaped contrast codemod |
| `text-slate-300` (non-`dark:`) | ~374 | `#CBD5E1` on white — fails badly; should be ≥ slate-600 for body text |
| `text-navy-300/400` (non-`dark:`) | 4 | same |
| `text-gray-300/400` (non-`dark:`) | 11 | same |

> Note: `text-slate-400` total incl. `dark:` = 11,662 (11,482 are `dark:` — correct usage).
> `text-slate-300` total = 4,989 (4,615 are `dark:`). The actionable residue is the
> **non-`dark:`** uses (≈554 across slate-300/400) plus the **`dark:text-slate-600` (300)**.

Top files for non-dark `text-slate-400`: `Initiatives/sections/TimelinePlanner.tsx` (22),
`MyWork/IdeaNodeDetailDrawer.tsx` (8), `Landing/InfoSections.tsx` (7), `TaskDetailModal.tsx` (6),
`MyWork/DecisionsPanel.tsx` (6).

### 3f. `primary` / `bg-primary` over-use (is crimson over-applied?)

| Metric | Count |
|---|---:|
| `bg-primary-<n>` solid fills | **6,161** |
| `bg-primary` (DEFAULT solid) | 6 |
| `bg-crimson-<n>` solid fills | 91 |
| `bg-crimson` (DEFAULT) | 0 |
| `from/via/to-primary` gradient stops | 801 |
| all `primary-*` utilities (any prop) | 17,471 |
| `text-primary` DEFAULT | 4 |
| `bg-c-accent` (canonical token) | 11 |

**Finding: YES — crimson is over-applied as solid fills.** **~6,250 solid bright-crimson
backgrounds** (`bg-primary-*` + `bg-crimson-*`) is far beyond "single accent used lightly".
The brief wants crimson reserved for *key* CTAs / brand moments with neutral surfaces dominating.
6k+ solid crimson fills means crimson is being used for chips, badges, icon backgrounds, hovers,
section accents, etc. Recommend triage: keep crimson for primary CTAs + active/selected states;
demote secondary surfaces to `bg-crimson-50/100` tints or neutral `bg-c-surface`, and route
status colors to `success/warning/danger` rather than primary.

---

## 4. Per-Module Offender Breakdown

Counts = occurrences in each dir. `purpGrad` = `from/via/to-(indigo|violet|purple|fuchsia|pink)-N`.
(macOS case-insensitive FS: `Assessment` == `assessment`.)

| Module | raw-hex | bracket-`[#]` | inline-style color | purple/indigo gradient |
|---|---:|---:|---:|---:|
| **Reports** | 224 | 0 | 135 | 15 |
| **MyWork** | 904 | 4 | 208 | 81 |
| **Presentations** | 197 | 0 | 14 | 2 |
| **settings** | 118 | 5 | 15 | 11 |
| **Landing** | 78 | 20 | 19 | 4 |
| **AIChat** | 69 | 11 | 7 | 9 |
| **Economics** | 54 | 0 | 20 | 6 |
| **ReportBuilder** | 49 | 1 | 16 | 33 |
| **Admin** | 43 | 0 | 1 | 0 |
| **Assessment / assessment** | 32 | 0 | 14 | 12 |
| **DiscoveryTools** | 21 | 2 | 5 | 2 |
| **Initiatives** | 15 | 0 | 1 | 13 |
| **Organization** | 15 | 0 | 2 | 0 |
| **shared** | 17 | 1 | 0 | 1 |
| **ui** | 9 | 0 | 0 | 0 |
| **Execution** | 7 | 0 | 0 | 0 |
| **Meeting** | 5 | 5 | 0 | 0 |
| **Interview** | 4 | 4 | 1 | 4 |
| **Decisions** | 0 | 0 | 0 | 1 |
| **Results** | 0 | 0 | 0 | 0 |
| **ReportsAndPresentations** | 0 | 0 | 0 | 0 |
| **Chat** | 0 | 0 | 0 | 0 |
| **PresentationStudio** | 0 | 0 | 0 | 0 |
| **DocumentStudio** | 0 | 0 | 0 | 0 |
| **src/views** | 210 | 15 | 51 | 76 |

> **Dirtiest:** MyWork (much of it legit mindmap/table/canvas color data, but also real
> offenders), Reports (severity/score color logic on OLD defaults), Presentations (mostly
> on-brand deck data), views (Legal*/knowledge/HowItWorks decorative purple), settings, Landing.
> **Cleanest (already token-only):** Chat, Results, ReportsAndPresentations, PresentationStudio,
> DocumentStudio, Decisions.

---

## 5. Prioritized Fix List (top ~30)

### A. Safe codemod (mechanical, low-judgment — literal → token)

1. `views/HowItWorksPage.tsx` (multiple lines) — `#7c3aed`/`#a855f7` decorative inline color +
   `linear-gradient(135deg,#7c3aed,#a855f7)` + `glow rgba(124,58,237,…)` → crimson token
   (`var(--c-accent)`) / `rgba(165,28,48,…)`. **(demoted brand violet — highest priority)**
2. Global: replace literal **`#7c3aed` / `#a855f7` / `#8b5cf6` / `#a78bfa`** (47+ occ) with
   `var(--c-accent)` or HBS-purple per context (ForWhomPage, VectorPage, ContactView,
   CalendarGrid, NotebookContent, InfoButton, FloatingHelpWidget, KnowledgeBaseArticlePage).
3. `Meeting/MeetingHub.tsx` — `bg-[#A51C30] hover:bg-[#8a1828]` (×2) + `text-[#A51C30]` → `bg-crimson hover:bg-crimson-700` / `text-c-accent`.
4. `DiscoveryTools/tools/Digital/GenericDomainStep.tsx` — `bg-[#A51C30] hover:bg-[#8e1729]` → `bg-crimson hover:bg-crimson-700`.
5. Global crimson literal `#A51C30` (24 occ, Landing/*, Economics/AnalysisCompareView, Execution/RolloutTab) → `var(--c-accent)` / `text-c-accent`.
6. `Landing/MarketingLayout.tsx` — `dark:bg-[#0A0F1E]` → `dark:bg-navy-950` (exact match).
7. `MyWork/Home/HomeView.tsx` — `dark:bg-[#060B18]` (×3) → `dark:bg-c-bg` / `dark:bg-navy-950`.
8. `Interview/TemplateBuilder.tsx` — `dark:bg-[#1b2440]`, `dark:bg-[#0b1324]` → navy-800/950 tokens.
9. `AIChat/WorkCanvasDocumentPanel.tsx` — `dark:bg-[#1a1d25]` (×2) → `dark:bg-c-surface-raised`.
10. `MyWork/table/tableTypes.ts:139-142` — status colors `#e0e7ff/#fef3c7/#d1fae5/#fee2e2` → `info/warning/success/danger-100` tokens.
11. `MyWork/IdeaRecommendationMap.tsx:304-339` — edge colors `#fb7185/#34d399/#fbbf24/#38bdf8/#a78bfa/#22d3ee` → remapped 500-token hexes.
12. `dark:text-slate-600` (300 occ) → `dark:text-slate-400` (codemod, contrast).
13. Non-`dark:` `text-slate-300` (~374 occ) → `text-slate-600` for body text (codemod).
14. Non-`dark:` `text-slate-400` (~180 occ) → `text-slate-600` (codemod).
15. `dark:text-gray-600` / `dark:text-navy-600` (~80 occ) → lighter dark-mode tokens.

### B. Decorative-gradient cleanup (semi-mechanical)

16. `views/AuthView.tsx` — sign-in CTA `from-primary-600 to-indigo-600` → flat `bg-primary-600` / `bg-hig-primary`.
17. `components/demo/DemoUpgradePrompt.tsx` / `DemoTrialButton.tsx` / `DemoSessionManager.tsx` — `from-primary-* to-indigo-*` CTAs → flat crimson.
18. `layouts/DocsLayout.tsx` — `from-primary-500 to-indigo-600` logo tile → flat crimson.
19. `views/LegalIndexView.tsx` / `LegalDocumentView.tsx` — decorative indigo/purple gradient headers (18 stops) → navy or crimson-tint.
20. `ReportBuilder/ReportEditor/BlockPalette.tsx` / `BlockCard.tsx`, `ai/MAXModeToggle.tsx`, `MyWork/Focus/FocusBoard.tsx`, `MyWork/shared/EmptyState.tsx` — purple decorative gradients → neutral/crimson-tint.

### C. Needs judgment (data/logic, verify intent before touching)

21. `Reports/AreaDetailCard.tsx:99-102` (+ AreaMatrixTable, AxisReportSection) — severity
    color logic on OLD defaults (`#f43f5e/#f59e0b/#eab308/#22c55e`) → `--c-danger/-warning/-success`.
    Verify the gap→severity mapping is preserved.
22. `Reports/ProgressRing.tsx`, `ReportBuilder/blocks/ChartRenderer.tsx`, `RadarChart`/`ROIPaybackChart`/`Charts/*` —
    decide a shared chart palette constant sourced from HBS hexes vs leaving as chart-data (legit).
23. `settings/appearance/VisualCustomizationSettings.tsx` — theme-swatch labels mismatch values
    (`id:'violet'`→`#6366F1`, `id:'teal'`→`#3B82F6`, `id:'cyan'`→`#3B82F6`). Decide whether to
    align swatch hexes to remapped HBS values (so picker preview matches rendered theme).
24. `Presentations/wizard/types.ts` (182 hex) — deck theme presets; **mostly already on-brand**,
    audit only for any stray old-default hexes; otherwise leave (legit deck data).
25. `MyWork/mindmap/tagColorMapping.ts`, `ColorPickerPopover.tsx`, `RowTemplatePicker.tsx` —
    user-facing swatch palettes; decide whether to re-anchor swatches to HBS hues (brand
    coherence) vs keep broad palette (user freedom). **Likely keep** but call out.
26. `Admin/BrandingSettingsPanel.tsx` (25 hex) — org branding config (tenant-defined colors) — **legit**, confirm.
27. `MyWork/processflow/LaneSystem.tsx` / `nodes/*` — BPMN node colors; decide canonical set.
28. `views/knowledge/*` + `Landing/AIOsProductMapSection.tsx` / `EntryFooter.tsx` + `ProductEntryPage.tsx` —
    off-palette dark surfaces (`#0D0828/#12082E/#0F0A2B/#0B0A23/#0A0A1F`) → unify on `navy-950`/`--c-bg`;
    verify these aren't intentional landing-art backgrounds.
29. `Landing/EntryFooter.tsx` social bracket colors — **keep** (3rd-party brand), but extract to a
    `SOCIAL_BRAND` constant for clarity.
30. **Crimson over-use triage** (Section 3f): audit the ~6,250 `bg-primary-*`/`bg-crimson-*` solid
    fills; demote non-CTA surfaces to `bg-crimson-50/100` tints or neutral surfaces so crimson reads
    as a *light* accent. Highest-density modules first (MyWork, Reports, Initiatives).

---

### Appendix — "Legit, leave alone" callouts

- **3rd-party brand logos** (`fill="#…"`, social `bg-[#…]`): ConnectedAppsSettings,
  ConnectorIcons, IntegrationAnalyticsSettings, EntryFooter social icons. (≈263 fill/stroke + social brackets)
- **Chart/data-viz series colors**: Charts/*, RadarChart*, ROIPaybackChart, ChartRenderer,
  AssessmentReportVisualizations — Recharts/SVG require literal colors.
- **Color-picker / swatch palettes**: ColorPickerPopover, tagColorMapping, RowTemplatePicker,
  VisualCustomizationSettings (theme swatches), mindmap inspector.
- **Tenant/org branding config**: Admin/BrandingSettingsPanel, CustomStatusesManager.
- **On-brand deck presets**: Presentations/wizard/types.ts (already crimson + HBS).
