# Tools Library & Detail View — UI/UX Standard

> **SSOT** for the Tools module: visual language, layout, color system, typography, badge taxonomy, and content structure.
> Applies to: `KnownToolDetailView`, `KnownToolPreviewV3`, `DynamicSwotLibraryGraphic`, and all future tool detail/library surfaces.
>
> **Established:** 2026-03-19
> **Last updated:** 2026-03-19
> **Status:** FROZEN — changes require conscious decision and this document update.

---

## 1. Detail view shell

Tools use the standard `NModeShell`:

- `NModeHeader` — title, artifact ID, status dot, save/close.
- `NModePropertiesStrip` — tool type, category, consulting stage.
- `NModeLeftNav` — 4 canonical sections (see §2).
- **Actions:** "Startuj sesję" (primary), "How to / Baza wiedzy" (secondary).

---

## 2. Canonical sections (left nav)

Every tool detail view MUST have exactly 4 sections in this order:

| # | id | Label PL | Label EN | Icon |
|---|---|---|---|---|
| 1 | `goal` | Cel | Goal | `Target` |
| 2 | `process` | Proces | Process | `CheckCircle2` |
| 3 | `outcomes` | Rezultat | Outcomes | `Lightbulb` |
| 4 | `example` | Przykład | Example | `FileText` |

Rules:

- Section labels MUST be translated (PL + EN).
- Section order is FROZEN.
- All 4 sections MUST be present for every tool, including inactive tools.

---

## 3. Global color semantics

These semantic colors apply across all 4 tabs and all tool graphics:

| Color family | Semantic meaning | Use cases |
|---|---|---|
| **Emerald** | Positive / affirmative | "what it does", "when to use", strengths, moves, output bridge |
| **Rose** | Negative / warning | "what it's not", "when not to use", threats, execution risk |
| **Violet** | Differentiator / USP / insight | tool uniqueness, decision logic, tension interpretation |
| **Amber** | Caution / attention / working notes | weaknesses, tips, strategic tensions |
| **Sky** | Evidence / neutral-positive | signals, evidence quality, opportunities |
| **White + border** | Neutral / preparatory | preparation blocks, notes, context |
| **Slate** | Structural / meta | badges (TOOL, PROCESS, MATRIX), legends |

---

## 4. Global badge taxonomy

Every major content block has a badge in the **top-right corner**, on the same line as the block title.

| Badge | Color family | Used in |
|---|---|---|
| `TOOL` | Slate | Graphic header |
| `PROCESS` | Slate | Graphic process steps; Process tab header |
| `MATRIX` | Slate | Graphic factor matrix |
| `INSIGHT` | Amber/Violet | Graphic tensions; "4 decision situations" block |
| `DECISION` | Violet | Graphic recommended moves |
| `OUTPUT` | Emerald | Graphic outputs; Outcomes tab header |
| `TIPS` | Amber | "Working notes" block |
| `QUALITY` | Emerald | Session quality card, outcome quality card |

Badge CSS: `rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em]`.

Neutral badges: `border-slate-300/50 bg-white/70 text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200`.

Colored badges match their section's color family (e.g. amber border/text for INSIGHT).

---

## 5. Tab 1: Cel (Goal)

### 5.1 Positioning statement

- Full-width `rounded-2xl` block, `p-5`.
- Eyebrow: `POZYCJONOWANIE NARZĘDZIA` / `TOOL POSITIONING` — `text-[11px] uppercase tracking-[0.18em] text-slate-400`.
- Headline: `text-lg font-semibold` — bold tool positioning statement.
- Body: `text-sm leading-relaxed` — expanded explanation.

### 5.2 Content blocks — 3 rows × 2 columns

```
Row 1:  [Co to narzędzie naprawdę robi]  [Czym to narzędzie nie jest]
Row 2:  [Kiedy użyć]                     [Kiedy nie zaczynać od ...]
Row 3:  [Co przygotować przed startem]    [Co sprawia, że ... jest dynamiczny]
```

| Block | Semantic | Background | Border | Title color |
|---|---|---|---|---|
| Co to narzędzie naprawdę robi | Positive | `bg-emerald-500/5` | `border-emerald-200/70` | `text-emerald-700` |
| Czym to narzędzie nie jest | Negative | `bg-rose-500/5` | `border-rose-200/70` | `text-rose-700` |
| Kiedy użyć | Positive | `bg-emerald-500/5` | `border-emerald-200/70` | `text-emerald-700` |
| Kiedy nie zaczynać | Negative | `bg-rose-500/5` | `border-rose-200/70` | `text-rose-700` |
| Co przygotować przed startem | Neutral | `bg-white/80` | `border-slate-200/70` | `text-slate-500` |
| Co sprawia, że ... dynamiczny | USP | `bg-violet-500/5` | `border-violet-200/70` | `text-violet-700` |

Each block: `rounded-2xl p-4`. Title: `text-[11px] font-semibold uppercase tracking-wide`.

### 5.3 Graphic block

Below the 6 content blocks — the tool's primary explainer graphic component.
Uses `variant="process"` in Goal (descriptive), `variant="example"` in Example (case-based).

---

## 6. Tab 2: Proces (Process)

### 6.1 Header

- Title: `text-lg font-semibold` — "Logika pracy" / "Work logic".
- Badge: `PROCESS` in top-right corner.
- Body: 1 paragraph explaining the flow at a high level.
- No card wrapper — sits directly on the canvas.

### 6.2 Stepper (interactive accordion)

Steps are presented as a **compact interactive stepper** (accordion), not a wall of text.

Structure per step:

```
┌──────────────────────────────────────────────────┐
│ [N]  Step title                    [●] [▼]       │  ← Collapsed: number + title + one-liner + chevron
│      One-line description (visible when closed)  │
├──────────────────────────────────────────────────┤
│      • bullet 1                                  │  ← Expanded: details + note
│      • bullet 2                                  │
│      • bullet 3                                  │
│      ┌──────────────────────────────────────┐    │
│      │ Note in bordered box                 │    │
│      └──────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

Rules:

- Only **one step open at a time** (click opens, click again closes).
- Closed state: number + title + one-liner subtitle + color dot + chevron.
- Open state: full details (bullets + note in bordered box) below the header.
- Each step has its own **gradient tone** and **accent color dot**:

| Step | Gradient | Accent |
|---|---|---|
| 1 — Mission Brief | `from-violet-500/12 to-fuchsia-500/5` | `bg-violet-500` |
| 2 — Signals & evidence | `from-sky-500/12 to-cyan-500/5` | `bg-sky-500` |
| 3 — Matrix build | `from-emerald-500/12 to-teal-500/5` | `bg-emerald-500` |
| 4 — Strategic tensions | `from-amber-500/15 to-orange-500/5` | `bg-amber-500` |
| 5 — Moves & outputs | `from-violet-500/15 to-indigo-500/5` | `bg-violet-600` |

Step card CSS: `rounded-2xl border transition-all duration-200`.
Open state: gradient background + `border-slate-300/70 shadow-sm`.
Closed state: `bg-slate-50/50 border-slate-200/50` with hover effect.

Number badge: `h-7 w-7 rounded-lg bg-slate-900 text-[11px] font-bold text-white`.
Title: `text-sm font-semibold`.
One-liner: `text-xs text-slate-500`.

### 6.3 Session quality card

Below the stepper — **standard semantic card** (NOT a `Callout` component).

Card uses **emerald** color family with badge `Quality` to match outcome/quality blocks throughout the module:

- Container: `rounded-2xl border border-emerald-200/70 bg-emerald-500/5 p-4 dark:border-emerald-900/40`.
- Title: `text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700` — "Jak wygląda dobra sesja końcowa".
- Badge: `Quality` in emerald, top-right corner on same line as title.
- Content: bulleted list (`<ul>`) with emerald dots (`bg-emerald-500`) and `text-sm text-slate-700`.

**IMPORTANT:** Do NOT use `Callout` from NModeBlocks for these blocks. All content blocks within the 4 tool detail tabs use the standard card pattern with semantic colors and badge taxonomy.

### 6.4 Decision situations block

`rounded-2xl` card with violet background + badge `INSIGHT`.

- Intro paragraph explaining the concept (1-2 sentences).
- **Grid 2×2** with 4 colored mini-cards:

| Card | Color | Logic |
|---|---|---|
| Siła + Szansa | Emerald | Advantage + opportunity → play offensively |
| Słabość + Szansa | Sky | Gap blocks opportunity → fix first, then enter |
| Siła + Zagrożenie | Amber | Risk rising but advantage exists → defend position |
| Słabość + Zagrożenie | Rose | Weakness increases exposure → reduce weakness first |

Each mini-card: `rounded-xl border p-3` with semantic color.
Title: `text-xs font-semibold` in section color.
Description: `text-[13px] leading-relaxed`.

### 6.5 Working notes block

`rounded-2xl` card with amber background + badge `TIPS`.

- 6 bullets with practical guidance for facilitators and users.
- Bullet dot: `bg-amber-500`.

---

## 7. Tab 3: Rezultat (Outcomes)

### 7.1 Header

- Title: `text-lg font-semibold` — "Co wychodzi z sesji" / "What the session produces".
- Badge: `OUTPUT` in top-right corner.
- Body: 1 paragraph framing the output quality.

### 7.2 Outcome cards (stacked)

**5 semantic cards** stacked vertically, each representing one output block:

| Card | Badge | Color family |
|---|---|---|
| Rama decyzji | `Decision` | Violet |
| Obraz czynników i evidence | `Evidence` | Sky |
| Napięcia strategiczne | `Tensions` | Amber |
| Rekomendowane ruchy | `Moves` | Emerald |
| Most do działania | `Execution` | Rose |

Each card structure:

```
┌──────────────────────────────────────────────────┐
│  TITLE                                  [BADGE]  │
│                                                  │
│  CO ZAWIERA        DLACZEGO WAŻNE     CO DALEJ   │  ← 3-column grid inside
│  text              text               text       │
└──────────────────────────────────────────────────┘
```

Card CSS: `rounded-2xl border p-4` with semantic color (`bg-{color}-500/5 border-{color}-200/70`).
Title: `text-[11px] font-semibold uppercase tracking-[0.16em]` in section color.
Badge: same badge CSS as §4, color-matched.
Inner grid: `grid grid-cols-3 gap-3 mt-3`.
Column headers: `text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400`.
Column text: `text-sm leading-relaxed`.
"Co dalej" column: `text-slate-900` (bold emphasis — this is the actionable part).

### 7.3 Quality card

**Standard semantic card** (NOT a `Callout` component) — same pattern as §6.3.

- Container: `rounded-2xl border border-emerald-200/70 bg-emerald-500/5 p-4 dark:border-emerald-900/40`.
- Title: `text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700` — "Jak wygląda dobry wynik".
- Badge: `Quality` in emerald, top-right corner on same line as title.
- Content: 1 paragraph `text-sm leading-relaxed text-slate-700` — selective, evidence-backed, decision-oriented.

---

## 8. Tab 4: Przykład (Example)

### 8.1 Header

- Title: `text-lg font-semibold` — "Przykład" / "Example".
- Body: 1 paragraph setting the context.
- Wrapped in `rounded-2xl border bg-white/80 p-4`.

### 8.2 Content blocks — 2 columns

```
Row 1:  [Sytuacja i pytanie decyzyjne]   [Kluczowe sygnały]
Row 2:  [Najważniejsze napięcia]          [Rekomendowane ruchy i outputy]
```

Color mapping:

| Block | Style |
|---|---|
| Sytuacja i pytanie | Neutral `bg-slate-50/70` |
| Kluczowe sygnały | Neutral `bg-slate-50/70` |
| Napięcia | Amber `bg-amber-500/5 border-amber-200/70` |
| Ruchy i outputy | Emerald `bg-emerald-500/5 border-emerald-200/70` |

### 8.3 Case summary callout

Emerald callout at the bottom — explaining what makes this a strong case.

### 8.4 Example graphic

The tool's graphic component with `variant="example"` — showing the case, not the methodology.

---

## 9. Graphic component — internal structure

### 9.1 Layout

```
┌─────────────────────────────────────────────────────┐
│  [DYNAMIC SWOT]  [OŚ PRACY]              [TOOL]    │  Header
│  Title + Subtitle                                   │
├─────────────────────────────────────────────────────┤
│  [Punkt wyjścia]          │  [Efekt sesji]          │  Context row (2 cols)
├─────────────────────────────────────────────────────┤
│  N KROKÓW PRACY                         [PROCESS]   │
│  Legend                                             │
│  ┌─────┐  ┌─────┐  ┌─────┐                         │  Steps 1-3 (grid-cols-3)
│  ┌───────────┐  ┌───────────┐                       │  Steps 4-5 (grid-cols-2)
├─────────────────────────────────────────────────────┤
│  MACIERZ CZYNNIKÓW                      [MATRIX]    │
│  2×2 grid (S/W/O/T) + note                         │
├─────────────────────────────────────────────────────┤
│  NAPIĘCIE STRATEGICZNE                  [INSIGHT]   │  Full width
├─────────────────────────────────────────────────────┤
│  REKOMENDOWANY RUCH                     [DECISION]  │  Full width
├─────────────────────────────────────────────────────┤
│  MOST DO OUTPUTÓW                       [OUTPUT]    │  Full width + chips
├─────────────────────────────────────────────────────┤
│  LEGEND                                             │
└─────────────────────────────────────────────────────┘
```

### 9.2 SWOT matrix quadrant colors

| Quadrant | Color |
|---|---|
| Strengths | Emerald |
| Weaknesses | Amber |
| Opportunities | Sky |
| Threats | Rose |

### 9.3 Graphic variant behavior

- `variant="process"` — descriptive text in quadrants (what kind of factors go here).
- `variant="example"` — concrete case data in quadrants (real examples).

---

## 10. Typography reference

| Element | Size | Weight | Tracking | Case |
|---|---|---|---|---|
| Tab header title | `text-lg` | `font-semibold` | — | normal |
| Section eyebrow | `text-[11px]` | `font-semibold` | `tracking-[0.16em]` or `tracking-[0.18em]` | `uppercase` |
| Block title (in colored card) | `text-[11px]` | `font-semibold` | `tracking-wide` or `tracking-[0.16em]` | `uppercase` |
| Body text | `text-sm` | normal | — | normal |
| Badge | `text-[9px]` | `font-semibold` | `tracking-[0.16em]` | `uppercase` |
| Chip | `text-[10px]` | `font-semibold` | `tracking-[0.16em]` | `uppercase` |
| Step number (stepper) | `text-[11px]` | `font-bold` | — | — |
| Step title (stepper) | `text-sm` | `font-semibold` | — | normal |
| Step one-liner (stepper) | `text-xs` | normal | — | normal |
| Step description (stepper expanded) | `text-sm` | normal | — | normal |
| Column sub-header (outcome card) | `text-[10px]` | `font-semibold` | `tracking-[0.14em]` | `uppercase` |
| Mini-card title (decision sit.) | `text-xs` | `font-semibold` | — | normal |
| Mini-card body (decision sit.) | `text-[13px]` | normal | — | normal |
| Legend | `text-[10px]` | normal | `tracking-[0.18em]` | `uppercase` |
| Graphic main title | `text-lg` | `font-semibold` | — | normal |
| Graphic subtitle | `text-sm` | normal | — | normal |

---

## 11. Spacing and radius reference

| Element | Radius | Padding |
|---|---|---|
| Outer graphic container | `rounded-[30px]` | — |
| Major graphic section | `rounded-[26px]` | `p-4` |
| Inner graphic card (quadrant, step) | `rounded-[22px]` or `rounded-2xl` | `p-3` to `p-4` |
| Content block in tabs | `rounded-2xl` | `p-4` |
| Mini-card (decision situations) | `rounded-xl` | `p-3` |
| Badge | `rounded-full` | `px-2 py-0.5` |
| Chip | `rounded-full` | `px-2.5 py-1` |
| Note box (inside stepper) | `rounded-xl` | `px-3 py-2` |

Gaps: `space-y-6` between major blocks; `gap-3` or `gap-4` inside grids.

---

## 12. Inactive tool treatment

When `isActive === false`:

- Tool name in library list: `text-slate-400 dark:text-slate-500` (dimmed).
- "Startuj sesję" action: blocked with toast error.
- All 4 sections remain visible and readable (preview mode).
- No badge or overlay needed — the dimmed name is sufficient signal.

---

## 13. Preview pane (single-click)

When a user single-clicks a tool row in the library list, the right-hand **preview pane** opens (Outlook-style, standard `TableWithPreviewLayout`). The preview is split into **Header → Body → Footer** (the canonical preview anatomy from `docs/ui-standards/`).

**Cardinal rule: NO SCROLLING.** The entire preview (header + body + footer) MUST fit in a single viewport without scrolling. This means:

- Body text is compact (`text-xs`, not `text-sm`).
- Details section shows exactly 5 snippet rows, not paragraphs or multi-block summaries.
- Spacing between sections is tight (`space-y-3` in body, `my-2` between footer zones).
- Everything detailed (process, outputs, examples) lives in the **detail view** (double-click / Open).

### 13.1 Header (rendered by `DiscoveryToolsHub`)

Standard `PreviewHeader` with:

- **Title:** tool name.
- **Subtitle:** tool description (first sentence, clamped).
- **Status dot:** emerald if `isActive`, rose if inactive.

### 13.2 Body (`KnownToolPreviewV3Body`)

```
┌─────────────────────────────────────────────┐
│  META PILLS                       [date]    │  ← PreviewMetaCard
│  Category · License · Active/Inactive       │
├─────────────────────────────────────────────┤
│  SZCZEGÓŁY / DETAILS                  [⋮]   │  ← PreviewDetailsSection (compact)
│  CEL           1 sentence                   │     5 snippet rows via children
│  REZULTAT      1 sentence                   │
│  TEAM          org functions needed         │
│  ROLA AI       what AI does in session      │
│  CZAS          estimate                     │
└─────────────────────────────────────────────┘
```

#### 13.2.1 Meta pills (`PreviewMetaCard`)

| Pill | Source | Style |
|---|---|---|
| **Category** | `libraryCategory` → "Strategia" / "Operacje" / "Digital" | `border border-slate-200/70 bg-transparent text-slate-700` |
| **License** | `isLicensed` → "Licencja" / "Darmowe" | `bg-slate-100 text-slate-600` |
| **Active / Inactive** | `isActive` | Active: `bg-emerald-50 text-emerald-700`; Inactive: `bg-rose-50 text-rose-700` |
| **Coming soon** (optional) | `isComingSoon` | `bg-slate-100 text-slate-600` |

Trailing: creation date formatted as `MMM D, YYYY`.

#### 13.2.2 Details section (`PreviewDetailsSection`)

- Label: "Szczegóły" / "Details" (default).
- **`compact` mode: ON** — uses `text-xs` instead of `text-sm`.
- **`children` slot** — structured snippet rows rendered below the header/kebab, replacing the default text block.
- Default text block is **empty** (`text=""`) — all content goes through the snippet rows.
- Kebab menu (⋮): Expand (AI), Summarize (AI), Copy, Copy as Markdown, Copy for Slack.

**Content: 5 snippet rows**

The preview shows exactly **5 labeled rows** in this fixed order:

```
CEL          1 sentence — what the tool does and why it matters
REZULTAT     1 sentence — what the session produces
TEAM         organizational functions needed (not names)
ROLA AI      what AI does during the session
CZAS         estimated duration (e.g. "60-90 min")
```

Layout per row:

| Element | Style |
|---|---|
| Label | `w-[56px] text-[10px] font-semibold uppercase tracking-wider text-slate-400` |
| Value | `text-xs leading-snug text-slate-700` |

Row container: `flex items-start gap-2`, rows stacked with `space-y-3`.

**Fixed row heights** ensure labels always land at the same vertical position regardless of value length:

| Row | `min-h` |
|---|---|
| Cel | `min-h-[40px]` |
| Rezultat | `min-h-[40px]` |
| Team | `min-h-[28px]` |
| Rola AI | `min-h-[28px]` |
| Czas | `min-h-[20px]` |

**Content rules:**

- **Cel:** 1 sentence, max ~120 chars. Answers: "What does this tool do?" Consulting-grade, no filler.
- **Rezultat:** 1 sentence, max ~120 chars. Answers: "What do I walk away with?" Lists key outputs.
- **Team:** Organizational functions, NOT names. For strategic tools: "C-level / właściciele, lider strategii lub dyrektor operacyjny". For operational: "kierownik operacyjny, lider procesu". Always describe roles/functions in the organization.
- **Rola AI:** What AI does in this specific tool session. E.g. "Moderator sesji, analityk evidence, generator napięć i rekomendacji". Describes the AI's active contribution, not just "assists".
- **Czas:** Short estimate without "(sesja z AI)" suffix — the AI role is already described above. E.g. "60-90 min", "2-4h", "Zależy od zakresu".
- For **inactive / undeveloped tools**: Cel falls back to `description`, Rezultat to `whatYouGet[]`, Team/Rola AI/Czas to generic placeholders.

**Anti-pattern:** Do NOT put multi-section summaries, bullets, or long paragraphs in the preview. That forces scrolling and duplicates the detail view. The preview is a **5-row card**, not a mini detail view.

### 13.3 Footer (`KnownToolPreviewV3Footer`)

```
┌─────────────────────────────────────────────┐
│  ✦ AI                                  [⋮]  │  ← PreviewAIHintStrip
│  [Kiedy użyć] [Pierwsze kroki] [Błędy]     │     3 hint chips
│  (AI result text, if generated)             │
├─────────────────────────────────────────────┤
│  tag1 · tag2 · tag3 · tag4 · +N            │  ← PreviewRelations (tags)
├─────────────────────────────────────────────┤
│  [Start sesji  S]  [Open  O]               │  ← PreviewActionBar row 1 (2-col grid)
│  [Czat  C]                                  │  ← PreviewActionBar row 2
└─────────────────────────────────────────────┘
```

#### 13.3.1 AI Hint Strip

- 3 static hint chips: "Kiedy użyć" / "Pierwsze kroki" / "Błędy" (PL) or "When to use" / "First steps" / "Mistakes" (EN).
- Clicking a chip triggers an AI call (`runKnownToolAi`) that generates 5-8 bullet response in plain text.
- Kebab: Regenerate, Copy, Clear.
- Wrapped in `rounded-xl border border-slate-200/70 bg-slate-50/60 p-2.5`.

#### 13.3.2 Relations (tags)

- Shows up to 6 tags from `tool.tags[]` as `PreviewRelations` chips.
- Overflow: `+N` chip.
- Empty state: "Brak powiązań" / "No relations".

#### 13.3.3 Action bar

| Row | Buttons | Layout |
|---|---|---|
| 1 | **Start sesji** (`primary`, shortcut `S`) · **Open** (`primary`, shortcut `O`) | `grid-cols-2` |
| 2 | **Czat** (`neutral`, shortcut `C`) | single button |

Disabled rules:

| Button | Disabled when |
|---|---|
| Start sesji | `isComingSoon` OR `!isActive` |
| Open | `!isActive` |
| Czat | `!isActive` |

#### 13.3.4 Inactive tool footer

When `isActive === false`, the entire footer is replaced with a single info box:

```
┌─────────────────────────────────────────────┐
│  To narzędzie jest jeszcze nieaktywne.       │
│  W preview możesz zobaczyć tylko opis,       │
│  ale nie otworzysz jeszcze pełnego widoku    │
│  ani sesji.                                  │
└─────────────────────────────────────────────┘
```

Style: `rounded-xl border border-slate-200/70 bg-slate-50/60 p-2.5 text-xs text-slate-600`.

No AI hints, no tags, no action buttons — only the explanation.

---

## 14. Library table — column layout and density

The library list uses `FilterableTable` with `density="compact"` and `table-fixed` layout. Every column has an explicit `width` to guarantee uniform row height across all tools.

### 14.1 Column definitions

```
┌──────────────┬────────────┬─────────────────────┬──────────┬──────────┐
│  NARZĘDZIE   │ KATEGORIA  │       TAGI           │ LICENCJA │  STATUS  │
│   200px      │   110px    │      200px           │  100px   │  120px   │
└──────────────┴────────────┴─────────────────────┴──────────┴──────────┘
```

| Column | `id` | `width` | Filterable | Render notes |
|---|---|---|---|---|
| **Narzędzie** | `name` | `200px` | — | `text-sm font-medium truncate`. Inactive: `text-slate-400`. Optional "Soon" badge: `h-5 text-[10px]`. |
| **Kategoria** | `libraryCategory` | `110px` | Yes (Strategy, Operations, Digital…) | `text-xs font-medium` with category color class. |
| **Tagi** | `tags` | `200px` | — | Single-line, no wrap. Max **3 chips** + overflow `+N`. |
| **Licencja** | `license` | `100px` | Yes (Licensed / Free) | `text-xs font-medium`. Licensed: `text-amber-500`. Free: `text-emerald-500`. |
| **Status** | `availability` | `120px` | Yes (Active / Inactive) | Pill badge: emerald for active, rose for inactive. |

### 14.2 Tag chip styling (single-line rule)

Tags are the primary source of row height inconsistency. These rules are **FROZEN**:

- Container: `flex items-center gap-1 overflow-hidden` — **NO `flex-wrap`**.
- Max visible: **3 chips**. Overflow: `+N` in `text-[10px] text-slate-400`.
- Chip CSS: `shrink-0 px-1.5 py-px rounded text-[10px] bg-slate-100 border border-slate-200/70 text-slate-600 truncate max-w-[80px]`.
- Each chip has `title={tag}` for hover tooltip on truncated text.

**Anti-pattern:** Never use `flex-wrap` on the tags container. Never show more than 3 chips. Never use `rounded-full` or `py-0.5` on table chips — those are for preview pills, not table cells.

### 14.3 Row density

- `density="compact"` → cell padding: `px-3 py-2`.
- All rows MUST have the same visual height. This is achieved by:
  1. Fixed column widths (`table-fixed`).
  2. Single-line tags (no wrap).
  3. `truncate` on tool name.
  4. No multi-line content in any cell.

### 14.4 Row interactions

| Action | Behavior |
|---|---|
| Single click | Opens preview pane (§13) |
| Double click | Opens full detail view (§1-§8) |
| Kebab (⋮) | Open, Start session, Chat |

Row actions respect `isActive` — disabled for inactive tools (except Open for preview).

---

## 15. No Callout components in tool detail

The `Callout` component from `NModeBlocks` is **NOT used** inside the 4 tool detail tabs (Cel, Proces, Rezultat, Przykład).

All informational and quality blocks use the **standard semantic card pattern**:

```
rounded-2xl border border-{color}-200/70 bg-{color}-500/5 p-4
```

with a title (uppercase eyebrow), a badge in the top-right corner, and body content below. This ensures visual consistency — every block follows the same card → title + badge → content anatomy.

---

## 16. Building a new tool — checklist

1. Create all 4 sections in left nav (Cel, Proces, Rezultat, Przykład).
2. **Cel tab:** positioning statement + 6 content blocks (3×2 grid) with semantic colors + graphic component with `variant="process"`.
3. **Proces tab:** header with badge `PROCESS` + interactive stepper (accordion, 1 open at a time) + session quality callout + decision situations block (2×2 mini-cards) + working notes with badge `TIPS`.
4. **Rezultat tab:** header with badge `OUTPUT` + stacked outcome cards (each with 3-column inner grid) + quality callout.
5. **Przykład tab:** header + 2×2 content blocks + case summary callout + graphic component with `variant="example"`.
6. **Graphic component:** badge taxonomy (TOOL, PROCESS, MATRIX, INSIGHT, DECISION, OUTPUT) + steps layout (3+2 grid) + SWOT matrix (2×2) + stacked bottom sections.
7. Apply semantic colors consistently (emerald = positive, rose = negative, violet = USP/insight, amber = caution/tips, sky = evidence, white = neutral).
8. Translate all labels and content (PL + EN).
9. Set `isActive` flag — dimmed name for inactive tools.
10. **Preview pane:** author 5 snippet rows (Cel, Rezultat, Team, Rola AI, Czas) in `PreviewSnippet`. Define 3 AI hint intents. Configure action bar (Start / Open / Chat) with correct disabled rules.
11. **Library table:** ensure tags are authored (max 3 visible in table). Verify row renders in single-line height.

---

## 17. File mapping

| Surface | File |
|---|---|
| Detail view (all 4 tabs) | `src/components/DiscoveryTools/KnownToolDetailView.tsx` |
| Preview pane (Body + Footer) | `src/components/DiscoveryTools/KnownToolPreviewV3.tsx` |
| Shared preview building blocks | `src/components/shared/PreviewPane/` (MetaCard, DetailsSection, AIHintStrip, Relations, ActionBar) |
| Tool graphic (Dynamic SWOT) | `src/components/DiscoveryTools/DynamicSwotLibraryGraphic.tsx` |
| Library hub (columns, filters, actions) | `src/components/Discovery/DiscoveryToolsHub.tsx` |
| Shared table component | `src/components/shared/ModuleHub/FilterableTable.tsx` |
| Backend tool data + fallback | `server/src/services/KnownToolsService.ts` |
| UI standard (this file) | `docs/ui-standards/03-modules/tools-library-detail-standard.md` |
| Content authoring rules | `knowledge/tool-kb/README.md` |
