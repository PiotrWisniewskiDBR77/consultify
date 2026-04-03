# Article Package Template

Use this structure inside each topic folder in a product `Blog` directory.

English is the source language.
Polish and German are localizations built from the approved English master.

## Recommended Folder Pattern

`NN_topic_slug/`

Inside:

- `article_EN.md`
- `article_PL.md`
- `article_DE.md`
- `seo.md`
- `cta.md`
- `image-prompts.md`
- `publish.md`
- `social.md`
- `sources.md`

## Editorial Rule

Public knowledge-base articles must read like decision articles, not slide notes.

That means:

- narrative first
- decision tools second
- metadata treated as an operational header, not part of the reading experience
- bullets used only when they genuinely improve decision clarity

Use the article body to create reading momentum, not deck rhythm.

## `article_EN.md`

Should contain:

- working title
- target persona
- funnel stage
- core problem
- main promise
- narrative opening
- article body
- decision block
- legacy production-note markers for CTA placement

Recommended structure:

- title
- target persona / funnel / problem / promise as operational header
- 2-4 paragraph opening that creates tension and context
- one short mini-case, concrete example, or consequence paragraph
- main sections in logical question order written primarily as prose
- at least one quotable framework, comparison, or checklist when relevant
- one decision block near the end
- close with practical takeaway and CTA bridge

### Public article rhythm

Default body rhythm:

1. opening narrative
2. tension / mini-case
3. main argument in prose
4. compact decision tool
5. product bridge
6. bottom line
7. CTA

### What must be prose

The following parts should usually be written as paragraphs, not bullets:

- opening hook
- direct answer
- explanation of why the problem matters
- product logic
- final takeaway

### Where bullets are allowed

Bullets are allowed only when they make the article easier to use:

- vendor questions
- scorecards
- checklists
- red flags
- leadership outputs
- compact frameworks with named parts

### Avoid these patterns

Do not build articles from:

- long stacks of one-line bullets
- repeated one-sentence slide fragments
- section after section that only names items without explaining them
- more than one heavy checklist before the article earns the right to summarize

### Decision block pattern

Near the end of the article, use one compact decision block when relevant:

- `Good answer`
- `Red flag`
- `What leadership gets`
- `Next step`

Keep that block short. It should summarize the decision, not replace the article.

### Archetype guidance

Common article archetypes should follow these defaults:

- listicle decision article: prose for the argument, bullets only for the final question/check block
- framework article: introduce the framework in prose, then explain each element in short readable paragraphs
- red-flag article: keep each red flag compact, but frame the cost of ignoring it in prose
- comparison article: use tables only after the narrative establishes what the reader should compare

## `article_PL.md` and `article_DE.md`

Should contain:

- localized title
- same persona and funnel logic as the English master
- adapted phrasing for local readability, not mechanical translation
- the same CTA intent unless a local market reason requires a change
- the same editorial rhythm as the English master

### Locale rule

`PL` and `DE` should preserve the same narrative structure as `EN`.

Translate meaning and reading rhythm, not only sentences.

## `seo.md`

Should contain:

- slug
- meta title
- meta description
- primary keyword
- secondary keywords
- search intent
- core question to answer
- question variants
- direct answer snippet
- entity/context notes
- internal links to add

Purpose:

- support classic search visibility
- support discoverability in AI chat answers and answer engines

Recommended `seo.md` logic:

- `core question to answer` = the main buyer question this article resolves
- `question variants` = 3-6 natural-language versions users may type into Google or ask in ChatGPT, Gemini, Perplexity, or other assistants
- `direct answer snippet` = a short 2-4 sentence answer that can stand alone if quoted by a search engine or AI assistant
- `entity/context notes` = exact product, persona, geography, industry, and use-case context that reduces ambiguity

## `cta.md`

Should contain:

- primary CTA
- secondary CTA
- product bridge
- objection to handle
- suggested lead magnet or next step

## `image-prompts.md`

Should contain 2-3 prompts:

- `Hero`
- `Analytical`
- `Social`

Each prompt should include:

- objective
- scene
- visual style
- brand mood
- negative prompts

## `publish.md`

Should contain:

- target page goal
- recommended page structure
- section-by-section layout notes
- image placement instructions
- CTA placement instructions
- component suggestions for the website builder or Cursor agent
- optional FAQ, comparison table, checklist, or pull-quote notes

Recommended logic:

- write this file as operational instructions for the agent that will place the article on the website
- reference image roles by name: `Hero`, `Analytical`, `Social`
- specify where each asset belongs relative to sections
- define whether a block should be full-width, inline, two-column, callout, table, bullets, or quote
- use precise notes such as “place analytical image after section 2” rather than vague styling wishes

Suggested `publish.md` structure:

- `Page goal`
- `Page components in order`
- `Image placement`
- `CTA placement`
- `FAQ / answer blocks`
- `Implementation notes for Cursor`

## `social.md`

Should contain:

- LinkedIn post
- short teaser
- email angle or hook
- primary publishing face
- voice notes for that face
- optional secondary face adaptation if the same theme should appear under another expert
- channel language note

Default rule:

- start from English master copy
- then localize into publishing variants if needed for PL or DE channels
- LinkedIn can stay in English when the post is meant to build cross-border authority
- adapt the wording to the chosen brand face rather than publishing the same copy under every profile

Recommended `social.md` logic:

- `primary publishing face` = the person who should own the first distribution of the idea
- `voice notes for that face` = short reminders on tone, sentence rhythm, angle, and credibility style
- `optional secondary face adaptation` = how to retell the same thesis for another person without copying the post
- `channel language note` = whether the default publishing language should be EN, PL, or DE

## `sources.md`

Should contain:

- source files used from `Texts`
- relevant live product pages
- proof points that need verification
- notes on what was borrowed structurally vs. what is product truth
