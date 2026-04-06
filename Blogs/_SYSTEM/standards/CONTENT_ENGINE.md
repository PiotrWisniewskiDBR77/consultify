# DBR77 Content Engine

This folder is the publishing system for all DBR77 product libraries.

## Core Rule

- `Texts` = source library, research, scraped articles, external inspiration, raw notes
- `Blog` = final DBR77-ready article packages
- `Archive` = older drafts worth mining, not publishing as-is

## Language Rule

- `EN` is the source language and approval base
- `PL` and `DE` are required localizations for priority content
- localizations should preserve the argument and CTA logic, but read naturally in-market
- LinkedIn distribution can default to `EN` when the goal is wider reach, international authority, or cross-region consistency

## Channel Language Rule

- website flagship articles should be prepared in `EN`, `PL`, and `DE` for priority assets
- LinkedIn posts may be published in `EN` even when the expert is based in Poland or DACH, if the strategic goal is international visibility
- email and outbound language should follow region, persona, and sales context
- company page language can be mixed by campaign, but should stay consistent within one distribution sequence

## Product Libraries

- `Consultify` = transformation, consulting replacement, ROI, governance, execution
- `IoT` = machine data, OEE, downtime, retrofit, edge, operator visibility
- `IRIS` = plant operating system, execution loops, AI tasking, MES/WMS/QMS/CMMS
- `DT` = simulation, scenario testing, layout, flow, CAPEX decisions
- `Marketplace` = automation selection, vendor comparison, challenge workflow, deployment
- `Vector` = industrial AI, security, deployment, model governance, private infrastructure

## Publishing Philosophy

We are not building "blogs for the sake of blogs."

We are building:

1. authority
2. category education
3. buyer confidence
4. product relevance
5. sales enablement

Every article should feel like a mini decision tool.

## Discovery Rule

Content must work in two discovery layers:

1. classic search (`SEO`)
2. answer engines and AI chats (`AEO` / `GEO`)

That means every article should be easy to:

- rank
- quote
- summarize
- cite
- extract into a direct answer

## Article Types

Use these formats across all products:

- `Problem teardown`
- `How it works`
- `Buyer guide`
- `Common mistakes`
- `Implementation roadmap`
- `ROI / business case`
- `Case-led article`
- `Executive point of view`

## Required Output For Each Final Article

Each publishable article in a `Blog` folder should eventually contain:

- `article_EN.md`
- `article_PL.md`
- `article_DE.md`
- `seo.md`
- `cta.md`
- `image-prompts.md`
- `publish.md`
- `social.md`
- `sources.md`

## Tone Rules

- Write for decision-makers, not for content marketers
- Prefer clarity over hype
- Use real operational language
- Explain trade-offs
- Avoid generic AI buzzwords unless grounded in a real use case
- Show what goes wrong, not only what looks good
- Bridge naturally to the product; never hard-sell too early
- answer the core question early and explicitly
- use clean definitions that a chat engine can lift into an answer

## Brand Voice Rule

- every article package should identify the most credible brand face for the topic
- social distribution should be adapted to the natural voice of that face, not cloned across all profiles
- a founder voice, operator voice, architect voice, and commercial voice should not sound interchangeable

## SEO And Chat Search Rules

- target one clear primary query per article
- include natural-language question variants in headings
- answer the core query in the introduction within the first short section
- use strong definitions, comparisons, frameworks, and lists
- keep claims attributable and tied to evidence
- avoid vague wording that is hard to quote or summarize
- write with enough specificity that a buyer or chat engine can extract a precise answer
- prefer plain-language phrasing over jargon-stacked phrasing
- include entity clarity: product, use case, persona, industry context
- structure articles so single sections can stand alone as useful answers
- include a short direct-answer block that can be quoted by search engines or AI assistants
- include at least one comparison, framework, checklist, or step sequence when relevant
- include “when this works” or “when this fails” logic when relevant
- make sure each article can satisfy a long-tail query without requiring the user to search again

## CTA Ladder

- Top of funnel: learn, benchmark, understand, assess
- Middle of funnel: compare, evaluate, simulate, scope
- Bottom of funnel: demo, pilot, workshop, challenge submission

## Proof Rules

Every strong claim should be treated as one of:

- `verified`
- `illustrative`
- `hypothesis`

Do not mix them carelessly in final articles.

## Trust Signal Rules

- every publishable article should have a clear author or expert owner at website level
- use real product, operational, or strategic language that signals first-hand understanding
- include source-backed claims where possible
- do not change publication or update dates unless the content was materially improved
- when useful, add FAQ, comparison blocks, or methodology notes that show how conclusions were formed

## Graphics Rules

Every article should get 2-3 prompts:

- `Hero`
- `Analytical`
- `Social`

Graphics should reinforce the business idea of the article, not decorate it.

## Image Placement Rules

- every article page should have a `Hero` image near the top of the page
- every substantive article should have at least one `Analytical` image placed near the section where complexity increases
- `Social` images are primarily for distribution assets, but can also support inline pull-quote or share blocks if the page design allows it
- images must have useful alt text written for the content, not generic accessibility filler
- captions should add context, not repeat the alt text
- never place an image only to break text visually; it must clarify, compare, explain, or intensify the main thesis
- avoid decorative stock visuals that weaken trust
- prefer diagrams, split-comparisons, process visuals, control-room scenes, plant contexts, and decision visuals over generic “technology” art

## Publishing Layout Rules

Every flagship article should be easy to publish by another agent or editor.

That means the article package must define:

- page order
- where each image goes
- what component style is intended
- where CTA blocks appear
- where callout boxes, tables, or comparison blocks should be inserted

Use `publish.md` for this instruction layer.

## Cursor Publishing Rule

Assume the final website implementation may be done by Cursor from markdown files.

So article packages should include machine-readable publishing guidance:

- exact section order
- image placement instructions
- preferred layout blocks
- optional component notes
- suggested anchor links or FAQ blocks

Keep these instructions in markdown so they are easy to reuse in future publishing workflows.
