# Cursor Publishing Standard

Use this standard when a blog package is being turned into a website page by Cursor.

The goal is simple:

- the article should already know how it wants to be published
- Cursor should not have to invent the layout from scratch
- images should support the argument, not act as decoration

## Source Of Truth

- `article_EN.md` = source article
- `article_PL.md` and `article_DE.md` = localized article variants
- `image-prompts.md` = visual generation guidance
- `seo.md` = search and answer-engine intent
- `cta.md` = conversion logic
- `publish.md` = website implementation instructions for Cursor

## Default Page Order

Use this order unless the article clearly needs a different structure:

1. eyebrow or category label
2. `H1`
3. short direct-answer intro block
4. hero image
5. lead section
6. main body sections
7. analytical image near the first complex section
8. comparison, framework, checklist, or table block if relevant
9. soft CTA block in the middle
10. final sections
11. strong CTA block
12. FAQ or short answer recap if useful

## Direct-Answer Block

Place a short answer block near the top of the page.

Purpose:

- help Google understand the page faster
- make the article easier to cite in AI answers
- give the visitor clarity before they scroll

Recommended size:

- 2 to 4 sentences
- one clear statement
- one consequence or implication

## Section Design Rules

- every `H2` should answer a meaningful sub-question
- each section should be understandable without the full article context
- avoid giant walls of text
- prefer short paragraphs and meaningful bullet lists
- use tables only when comparing options, trade-offs, or decision criteria
- use callout boxes for key warnings, myths, or “what this really means”

## Image Rules

### Hero

Use for:

- opening impact
- category framing
- emotional or strategic tone

Placement:

- below the direct-answer block
- above the first long section

Preferred layout:

- full-width or wide landscape
- 16:9 or similarly horizontal ratio

### Analytical

Use for:

- diagrams
- comparisons
- system flow
- before/after logic
- framework visualization

Placement:

- after the first or second major explanatory section
- never too early if the reader does not yet understand the concept

Preferred layout:

- full-width if diagram-heavy
- inline if compact and section-specific

### Social

Use for:

- article card
- preview thumbnail
- email header
- quote-share graphic

Placement:

- usually not required inside the article body
- can support a pull-quote or recap block if visually strong

## Alt Text And Captions

- alt text should describe the actual visual and its business meaning
- captions should add interpretation, not restate the alt text
- bad caption: “Consulting dashboard image”
- good caption: “The article argues that execution systems create more value than static consulting deliverables.”

## Layout Components Cursor Can Reuse

Recommended components:

- `Direct answer box`
- `Key takeaway callout`
- `Comparison table`
- `Checklist block`
- `Myth vs reality block`
- `FAQ accordion`
- `Mid-page soft CTA`
- `End-of-article CTA`

## Markdown Convention For Cursor

Use `publish.md` as the main instruction file.

If inline notes are needed inside article markdown, use HTML comments so they do not render on the live page:

```md
<!-- CURSOR: Insert Hero image here. Use Hero prompt. Full-width. -->
<!-- CURSOR: After this section, add comparison table: old model vs system model. -->
```

Keep inline comments minimal.
Use `publish.md` for the full structure.

## FAQ And Answer Blocks

Add a short FAQ block when:

- the topic has obvious follow-up questions
- the query set is strongly informational
- the article should capture more long-tail search demand

Good FAQ questions:

- what is it?
- why does it fail?
- when should you use it?
- when should you not use it?
- how does DBR77 fit?

## Conversion Placement

- top-of-funnel pages should use soft CTA first, strong CTA last
- do not place hard sales CTA before the article proves the point
- the stronger the educational intent, the later the CTA should appear

## Minimum Publishing-Ready Standard

An article package is publishing-ready when:

- the article is complete
- `seo.md` includes core question and direct answer snippet
- `image-prompts.md` includes usable visual prompts
- `publish.md` defines structure and placements
- `cta.md` defines both soft and strong CTA logic
