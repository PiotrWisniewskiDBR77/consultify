# DBR77 LP Editorial Rewrite Standard

## Purpose

This file defines how existing knowledge-base articles should be rewritten when they feel like bullet-point slides instead of readable decision articles.

It is the editorial SSOT for batch rewrites, manual rewrites, and QA.

## Core Principle

The article should feel like a leader is being guided through a decision, not like they are reading workshop notes.

Default ratio:

- roughly `80%` prose
- roughly `20%` structured decision tools

## Reader Promise

Every public article should do four things:

1. make the problem feel real
2. explain the logic in readable prose
3. give the buyer a compact decision tool
4. connect the insight to the product without sounding pasted on

## Rewrite Rules

### 1. Metadata is operational, not editorial

Keep these lines available for production operations when needed:

- `Target persona`
- `Funnel stage`
- `Core problem`
- `Main promise`

But do not let them define the public reading rhythm.

### 2. Open with narrative

Every article should begin with:

- a short tension statement or consequence
- one or two explanatory paragraphs
- one mini-case or concrete decision context when available

Avoid opening with:

- a list
- a framework inventory
- a checklist
- a metadata block for the reader

### 3. Convert list-heavy logic into prose

When a list only names ideas, rewrite it as prose.

Examples:

- replace “they fail because:” plus `4-6` bullets with one paragraph that carries the sequence naturally
- replace “pause until you can state:” plus bullets with one sentence that names all required artifacts
- replace repeated one-line sections with one compact paragraph

### 4. Keep only high-value lists

Lists are valid when they are directly useful:

- vendor questions
- scorecards
- checklists
- red flags
- leadership outputs
- short frameworks with named elements

If the reader could understand the section better as a paragraph, use a paragraph.

### 5. Compress deck rhythm

Rewrite these patterns:

- many one-sentence paragraphs in a row
- heading followed by one short fragment
- several “reality check” style lines stacked vertically

Target rhythm:

- paragraphs of `2-5` sentences
- one idea per paragraph
- short sections, but not telegraphic ones

### 6. Decision tools come late

`Good answer`, `Red flag`, `What leadership gets`, and `Next step` should appear near the end or as compact summary blocks.

They are not the article body.

### 7. Product bridge is earned

The product bridge must answer:

- why the product matters in this exact problem
- what operational gap it closes
- what leadership actually receives

Do not use generic bridge language that could fit any article.

## Archetype Defaults

### Listicle decision article

- prose for the argument under each item
- one compact decision tool at the end of each major item if needed

### Framework article

- explain the framework in prose first
- each framework element gets a short paragraph, not only a label

### Red-flag article

- keep each red flag explicit
- always explain the business consequence of ignoring it

### Comparison or table-heavy article

- set up the comparison in narrative first
- use the table only as compression after the argument is established

## Before / After Guidance

### Before

- “Pause automation buying when any of these are true:” followed by `5` bullets

### After

- one paragraph that explains when a pause is justified, followed by a short checklist only if the checklist adds clarity

### Before

- “These shifts are common:” followed by `4` bullets

### After

- one paragraph that walks through the shift sequence in business language

## QA Heuristic

The rewrite is probably good when:

- the first screen can be read like an article
- the reader can follow the argument without scanning bullets
- the remaining lists feel useful, not lazy
- the product bridge feels specific
- the bottom line sounds like a conclusion, not a slide footer
