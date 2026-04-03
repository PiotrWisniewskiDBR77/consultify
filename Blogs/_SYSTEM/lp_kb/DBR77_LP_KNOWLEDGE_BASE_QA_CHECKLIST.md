# DBR77 LP Knowledge Base QA Checklist

## Purpose

This checklist verifies the LP knowledge-base module itself, not only the raw article upload.

Use it after the LP repo program builds the module from manifests.

## Input QA

- [ ] product package contains exactly `50` article folders
- [ ] `EN`, `PL`, and `DE` variants exist for every article
- [ ] `knowledge_base_manifest.json` exists
- [ ] `renderer_manifest.json` exists
- [ ] `relation_manifest.json` exists
- [ ] `qa_manifest.json` exists

## Structure QA

- [ ] LP opens with one clear hero knowledge entry
- [ ] problem reality block is visible before article clusters
- [ ] decision or use-case paths are visible
- [ ] at least `3` grouped knowledge sections exist
- [ ] every section has featured and deeper knowledge
- [ ] proof block is visible
- [ ] CTA ladder covers low, mid, and high commitment
- [ ] one controlled cross-product bridge exists

## Data QA

- [ ] every article card has title
- [ ] every article card has summary line
- [ ] every article card has persona
- [ ] every article card has funnel stage
- [ ] every article card has knowledge layer
- [ ] every article card has locale availability

## Editorial QA

- [ ] public article body opens with narrative, not metadata or a long list
- [ ] first screen reads like an article, not a slide deck
- [ ] direct answer is readable prose rather than a compressed block of fragments
- [ ] bullet lists are used only where they genuinely improve decision clarity
- [ ] there is at least one mini-case, tension paragraph, or concrete consequence statement
- [ ] product bridge appears after the argument is earned
- [ ] `Good answer` / `Red flag` style blocks are compact summary tools, not the dominant format
- [ ] bottom line closes the article in prose

## Relation QA

- [ ] same-section relations exist
- [ ] featured-to-deeper relations exist
- [ ] MVA path exists
- [ ] cross-product bridges point to the intended next product
- [ ] there are no random or duplicate bridge loops

## Locale QA

- [ ] locale switch does not change section assignment
- [ ] locale switch does not create duplicate article identities
- [ ] locale switch preserves related-article recommendations

## Final Release Rule

Do not mark the LP knowledge base module ready unless:

- there are no blocking errors in `qa_manifest.json`
- there are no broken locale variants
- there are no broken featured clusters
- the CTA ladder is visible and stage-appropriate
- top-priority articles pass editorial QA, not only structural QA

