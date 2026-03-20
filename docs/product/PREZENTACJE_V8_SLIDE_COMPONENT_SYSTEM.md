# Prezentacje v8 - Slide component system

> Status: Draft v8
> Cel: Zdefiniowac kanoniczny system komponentow slajdu dla `v8`: intents, layouts, blocks, allowed combinations i quality constraints.

---

## 1. Zasada nadrzedna

LLM nie projektuje dowolnego slajdu.
LLM planuje tresc i komponenty, a system sklada slajd z kontrolowanego zestawu:
- `SlideIntent`
- `LayoutFamily`
- `BlockType`
- quality constraints

To jest glowny mechanizm, ktory ma dac:
- Gamma-like speed,
- Beautiful.ai-like discipline,
- bez budowy wolnego design toola.

---

## 2. Core model

### 2.1 SlideIntent

Minimalny baseline `v8`:
- `cover`
- `executive_summary`
- `section_divider`
- `content`
- `data`
- `comparison`
- `timeline`
- `process`
- `kpi_dashboard`
- `risk_overview`
- `recommendation`
- `next_steps`
- `quote`
- `thank_you`

### 2.2 LayoutFamily

Minimalne rodziny layoutow:
- `hero_cover`
- `title_body`
- `two_column`
- `three_panel`
- `metric_strip`
- `chart_focus`
- `table_focus`
- `comparison_split`
- `timeline_flow`
- `process_flow`
- `quote_hero`
- `cta_next_steps`
- `section_break`
- `evidence_stack`

### 2.3 BlockType

Minimalny baseline `v8`:
- `heading`
- `paragraph`
- `bullet_list`
- `numbered_list`
- `table`
- `chart`
- `image`
- `icon_row`
- `kpi_widget`
- `smart_layout`
- `smart_diagram`
- `callout`
- `quote_block`
- `timeline_block`
- `metric_strip`
- `artifact_embed`
- `divider`

---

## 3. Intent -> layout -> block matrix

| Intent | Preferred layouts | Allowed blocks | Required blocks | Disallowed emphasis |
|---|---|---|---|---|
| `cover` | `hero_cover` | `heading`, `paragraph`, `image`, `callout` | `heading` | dense tables, busy multi-chart |
| `executive_summary` | `title_body`, `three_panel`, `evidence_stack` | `heading`, `bullet_list`, `metric_strip`, `callout` | `heading`, `bullet_list` or `metric_strip` | decorative image overload |
| `section_divider` | `section_break` | `heading`, `paragraph`, `image` | `heading` | tables, long bullets |
| `content` | `title_body`, `two_column`, `three_panel` | all text-centric blocks, `image`, `callout`, `artifact_embed` | `heading` + 1 content block | too many metrics at once |
| `data` | `chart_focus`, `table_focus`, `metric_strip` | `chart`, `table`, `metric_strip`, `callout`, `heading` | one of `chart` or `table` or `metric_strip` | decorative photos as main payload |
| `comparison` | `comparison_split`, `two_column` | `heading`, `bullet_list`, `table`, `callout`, `chart` | comparative structure in at least 2 zones | unstructured paragraph-only |
| `timeline` | `timeline_flow` | `timeline_block`, `callout`, `heading`, `icon_row` | `timeline_block` | decorative unrelated image |
| `process` | `process_flow` | `smart_diagram`, `bullet_list`, `callout`, `heading` | `smart_diagram` or ordered process structure | random freeform blocks |
| `kpi_dashboard` | `metric_strip`, `chart_focus` | `kpi_widget`, `metric_strip`, `chart`, `callout` | `kpi_widget` or `metric_strip` | narrative-only slide |
| `risk_overview` | `two_column`, `three_panel`, `evidence_stack` | `callout`, `bullet_list`, `table`, `smart_layout` | risk list or structured risk matrix | decorative filler image |
| `recommendation` | `title_body`, `three_panel`, `cta_next_steps` | `heading`, `bullet_list`, `callout`, `smart_layout` | recommendation statement | raw data dump |
| `next_steps` | `cta_next_steps`, `timeline_flow` | `numbered_list`, `timeline_block`, `callout`, `heading` | ordered action structure | decorative image as core content |
| `quote` | `quote_hero` | `quote_block`, `heading`, `paragraph`, `image` | `quote_block` | charts and tables |
| `thank_you` | `cta_next_steps`, `hero_cover` | `heading`, `paragraph`, `image`, `callout` | `heading` | dense analytical content |

---

## 4. Composition rules

### 4.1 Global rules

- One slide must have one dominant message.
- Maximum one dominant chart or table per slide unless layout family explicitly supports more.
- A slide should prefer 2-5 blocks, not arbitrary density.
- Decorative image cannot replace the content payload.
- `artifact_embed` is allowed only when source context materially improves trust or comprehension.

### 4.2 Text density rules

- `SHOW`
  prefer fewer words, stronger headings, more notes
- `DOCUMENT`
  can carry denser bullets, short paragraphs, tables
- `BRIEFING`
  concise status-like density
- `WORKSHOP`
  lower narrative density, more frameworks and prompts

### 4.3 Image rules

- `data`, `kpi_dashboard`, `timeline`, `process`
  default to low decorative imagery
- `cover`, `section_divider`, `quote`
  can use strong visual emphasis
- `executive_summary`
  visuals support, but must not overshadow message clarity

---

## 5. Layout family contracts

### `hero_cover`

Purpose:
- strong opening

Structure:
- hero zone
- title zone
- optional subheadline

### `title_body`

Purpose:
- clear statement + supporting content

Structure:
- title band
- main body area

### `two_column`

Purpose:
- comparison or split narrative

Structure:
- left/right balanced zones

### `three_panel`

Purpose:
- 3 recommendations, themes, or grouped evidence

Structure:
- 3 equal or weighted panels

### `metric_strip`

Purpose:
- fast KPI read

Structure:
- top headline
- strip of 3-5 metrics

### `chart_focus`

Purpose:
- one dominant chart with commentary

Structure:
- chart area
- commentary zone

### `table_focus`

Purpose:
- analytical tabular content

Structure:
- compact title
- readable table
- optional note/callout

### `comparison_split`

Purpose:
- before/after, option A/B, plan vs actual

Structure:
- symmetrical comparison zones

### `timeline_flow`

Purpose:
- sequence in time

Structure:
- ordered progression with milestones

### `process_flow`

Purpose:
- step logic, workflow, operating model

Structure:
- directional process or diagram-led composition

### `quote_hero`

Purpose:
- statement slide

Structure:
- large quote
- source attribution or supporting line

### `cta_next_steps`

Purpose:
- close with action

Structure:
- clear action statement
- ordered action list or next-step grid

### `section_break`

Purpose:
- introduce section transition

Structure:
- large heading
- minimal support line or visual

### `evidence_stack`

Purpose:
- stack of proof points

Structure:
- headline
- layered callouts/evidence items

---

## 6. Allowed and forbidden combinations

### Allowed strong combinations

- `executive_summary` + `metric_strip` + `callout`
- `data` + `chart` + `callout`
- `comparison` + `comparison_split` + `bullet_list`
- `process` + `smart_diagram` + `callout`
- `next_steps` + `numbered_list` + `callout`

### Forbidden or discouraged combinations

- `cover` + `table`
- `section_divider` + dense `bullet_list`
- `quote` + `chart_focus`
- `data` + large decorative `image` as the dominant element
- `kpi_dashboard` + multiple long paragraphs

---

## 7. Planning implications for AI

AI may choose:
- intent
- preferred layout family
- block set
- ordering of blocks
- content depth inside allowed guardrails

AI may not:
- invent arbitrary unsupported block types,
- ignore intent/layout compatibility,
- overload slides beyond density rules,
- choose decorative visuals where data-first semantics should dominate.

---

## 8. Builder implications

Builder should expose:
- current intent,
- current layout family,
- blocks on slide,
- whether current composition is valid,
- whether current composition violates quality rules.

Builder may allow manual override, but:
- out-of-contract combinations should raise warnings,
- generated slides should start from valid compositions by default.

---

## 9. What is still out of scope

- full catalog of 50-80 production layouts,
- pixel-level design tokens per layout,
- final renderer mapping for every block/layout permutation.

This document defines the canonical system,
not the full asset library.

---

## 10. Acceptance checklist

- Every generated slide has a valid `intent`.
- Every generated slide maps to a valid `layout family`.
- Every generated slide uses only supported `BlockType`s.
- The team has a shared rulebook for allowed and forbidden slide compositions.
- AI planning can target a controlled slide system instead of open-ended slide authoring.
