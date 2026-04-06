# Publish Instructions

## Page goal

Turn this article into a pre-mobilization risk gate page that:

- gives sponsors a defensible pause framework
- supports AI extraction of triggers and the bounded protocol
- connects to Marketplace scope and comparability discipline

## Machine-readable page order

1. `category_label`: Marketplace
2. `h1`: article title from `article_EN.md`
3. `direct_answer_box`: 2 to 4 sentences; triggers and partial versus full pause
4. `hero_image`: prompt `Hero` from `image-prompts.md`
5. `lead`: opening through "Direct answer"
6. `section`: Pause trigger comparison (quick scan)
7. `analytical_image`: prompt `Analytical` from `image-prompts.md`
8. `section`: Bounded pause protocol (forty-eight to seventy-two hours decision window)
9. `mid_cta`: intent Compare offers; after bounded protocol section
10. `section`: What a pause is not
11. `section`: What this means for DBR77 Marketplace
12. `section`: Bottom line
13. `strong_cta`: intent Start manufacturer demo; after final paragraph
14. `faq_block`: optional; use FAQ_PROMPTS below

## FAQ prompts (machine-readable)

```yaml
faq_prompts:
  - When should a manufacturer pause automation mobilization?
  - What is the difference between a full mobilization pause and a partial hold?
  - How do you document exit criteria for a mobilization pause?
  - What scope signals mean fabrication should not start yet?
  - How do you pause without reopening supplier selection unfairly?
```

## CTA placement notes

- Mid CTA: compare offers and scope artifacts when schedule pressure rises
- Strong CTA: demo for organizations running repeated automation programs

## Implementation notes for Cursor

- preserve comparison table headers for FAQ mapping
- hour window is illustrative; adjust in implementation without renaming the protocol section
