# DBR77 LP Package Copy Contract

## Purpose

This file freezes the exact copy contract from `consultify/Blogs` into product LP repositories.

Treat it as the operational rule for moving content from the content source-of-truth into any LP repo.

## Source Of Truth

Canonical editorial source:

- `Blogs/<Product>/Blog/<NN_topic_slug>/`

Canonical manifest source:

- `Blogs/_LP_KB_READY/<Product>/`

## Allowed Copy Scope

For LP repo transfer, copy only:

- `Blogs/<Product>/Blog/<NN_topic_slug>/`

Where `NN_topic_slug` is an article folder listed in:

- `Blogs/_LP_KB_READY/<Product>/knowledge_base_manifest.json`

Do not copy the whole `Blog/` root blindly.

## Required Files Per Article Folder

Every copied article folder must contain exactly the content package below:

- `article_EN.md`
- `article_PL.md`
- `article_DE.md`
- `seo.md`
- `cta.md`
- `publish.md`
- `social.md`
- `sources.md`
- `image-prompts.md`

Optional:

- `assets/images/` only when real source assets exist

## Explicit Exclusions

Never copy any of the following into LP repos:

- `00_*`
- `_archive_*`
- `*.csv`
- product strategy files at `Blog/` root
- duplicate article variants such as `article_EN 2.md`, `article_PL 2.md`, `article_DE 2.md`
- any file not part of the required package unless the LP program explicitly expects it

## Copy Rule

The copy operation must be manifest-driven.

That means:

1. read `knowledge_base_manifest.json`
2. resolve the expected `slug` list
3. copy only matching `NN_*` folders
4. inside each folder, copy only the required filenames
5. fail if any required file is missing

## Release Rule

Do not treat a product as LP-copy-ready unless:

- exactly `50` manifest articles exist
- every manifest slug resolves to one article folder
- every folder has all `9` required files
- no duplicate `* 2.md` files remain in the copied payload
- no operational `00_*` files enter the payload

## Why This Exists

The `Blog/` roots also contain process files, QA sheets, and historical duplicates.

LP repos should receive only the deterministic article package, not the full editorial workspace.
