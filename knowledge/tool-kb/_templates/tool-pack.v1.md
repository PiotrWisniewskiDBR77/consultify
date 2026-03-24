# Tool Knowledge Pack (v1 template)

> Copy this file into `knowledge/tool-kb/<tool_slug>/<pack_type>/v1/<name>.<lang>.md`

---

## Pack meta

- **tool_slug**: `<tool_slug>`
- **pack_type**: `<methodology|qbank|initiatives|benchmarks|help>`
- **pack_version**: `1.0.0`
- **language**: `<en|pl>`
- **source_kind**: `tool_pack`

## Provenance (sources)

List canonical sources used to create this pack.

Recommended order:

1. product SSOT
2. runtime contract
3. external or archived reference sources

- `<repo doc path or PDF path or URL>`

## Audience + use

- **Used by**: `<UI|AI|Reports|Help|All>`
- **Do not use for**: `<what this pack should not be used for>`

---

## Sections (chunk-friendly)

### [section_id:overview] Overview

- **Purpose**: …
- **When to use**: …
- **When not to use**: …
- **Outputs**: …
- **Common pitfalls**: …

### [section_id:application_mapping] Application mapping

Describe how this tool should show up in the product.

- **Library preview should show**: …
- **Main work surface should show**: …
- **Help / AI surface should show**: …
- **Outputs surface should show**: …

### [section_id:evidence] Evidence and acceptance rules

- **Evidence principle**: …
- **Unknown / needs evidence rule**: …
- **Propose -> accept rule**: …
- **Traceability note**: …

### [section_id:content] Main content

Use the section pattern that matches the pack type below.

---

## Pack-type guidance

### If `pack_type=methodology`

Add sections such as:

- `framework logic`
- `stage-by-stage flow`
- `interpretation rules`
- `comparisons`
- `anti-patterns`

Suggested subsection shape:

#### [stage_id:<id>] <Stage name>

- **Goal**: …
- **What good looks like**: …
- **What weak looks like**: …
- **Evidence to ask for**: …
- **AI guidance**: …

### If `pack_type=qbank`

Use one subsection per stage / area / level.

#### [area_id:<id>] <Area name>

##### [level:<n_or_band>] Level <n_or_band> — meaning

- **Meaning**: …
- **Core questions**:
  - Q1: …
  - Q2: …
  - Q3: …
- **Follow-up probes**:
  - …
- **Example of a strong answer**: …
- **Evidence guidance**: …
- **Common mistakes**:
  - …

### If `pack_type=initiatives`

Describe “signal / tension / gap -> move -> initiative” patterns:

#### [pattern_id:<id>] <Pattern name>

- **Gap signal / tension**: …
- **Likely root causes**: …
- **Recommended move**: …
- **Initiative pattern**: …
- **Why now**: …
- **KPIs to track**: …
- **Dependencies**: …
- **First step**: …

### If `pack_type=benchmarks`

Organize external and adjacent references into reusable chunks:

#### [benchmark_id:<id>] <Benchmark or source cluster>

- **Type**: `<comparison|example|case|visual|context>`
- **What it is useful for**: …
- **Key takeaway**: …
- **How to use in the app / AI**: …
- **Source note**: …

### If `pack_type=help`

Organize practical user guidance:

#### [help_id:<id>] <Help section>

- **User goal**: …
- **Short guidance**: …
- **What AI should say / ask**: …
- **When to suggest outputs**: …
- **What not to imply**: …

