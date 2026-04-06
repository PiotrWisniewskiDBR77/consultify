# DBR77 LP Pre-Go Decisions

## Purpose

This file closes the default import decisions for tomorrow's LP upload unless the LP platform forces a different rule.

Use these defaults so the team does not have to decide core import behavior in the middle of the upload wave.

## Default Decisions

### Content Unit

Default:

- import only article body markdown from `article_EN.md`, `article_PL.md`, and `article_DE.md`

Do not import:

- package metadata
- CTA files
- publish instructions
- SEO files
- image prompt files

### Locale Rule

Default:

- treat `EN`, `PL`, and `DE` as language variants of the same article record

Do not treat locales as:

- separate products
- separate LP sections
- separate content types

### Slug Rule

Default:

- use the article folder name as the canonical slug

Reason:

- folder naming is already stable across all six products
- the folder name matches package identity better than a manually rewritten title

### Section Assignment Rule

Default:

- perform section assignment after content import unless the LP platform makes section mapping mandatory at import time

Reason:

- it reduces upload risk
- it keeps locale handling simpler
- it prevents section-mapping mistakes from blocking base content loading

### Marketplace Exception Rule

Default:

- ignore every folder inside `_archive_marketplace_43_49_pre_collision_packages/`

Reason:

- these are archive collision packages, not the canonical live library

## Pre-Go Questions To Confirm On The Platform

Before the first batch, confirm only these four things:

1. Does the LP system expect markdown body only?
2. Are locales variants on one record or separate records?
3. Does the platform require section assignment during import?
4. Does the platform preserve folder-slug naming?

## Fallback Rule

If the platform behavior is unclear in the moment:

1. import one test article from `Consultify`
2. validate body rendering
3. validate locale handling
4. validate slug handling
5. only then start batch `1`
