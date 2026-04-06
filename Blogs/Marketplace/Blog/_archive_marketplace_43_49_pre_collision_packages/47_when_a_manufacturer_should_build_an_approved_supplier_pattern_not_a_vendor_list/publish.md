# Publish Instructions

## Page goal

Turn this article into a supplier-governance design page that:

- reframes approved lists into capability patterns
- supports AI extraction of comparison table and checklist
- connects pattern thinking to Marketplace trust-layer positioning

## Machine-readable page order

1. `category_label`: Marketplace
2. `h1`: article title from `article_EN.md`
3. `direct_answer_box`: 2 to 4 sentences; when to use patterns and what they contain
4. `hero_image`: prompt `Hero` from `image-prompts.md`
5. `lead`: opening through "Direct answer"
6. `section`: Vendor list versus pattern (comparison)
7. `analytical_image`: prompt `Analytical` from `image-prompts.md`
8. `section`: Minimum pattern contents (checklist)
9. `mid_cta`: intent Describe your challenge; after checklist section
10. `section`: When a simple list is still acceptable
11. `section`: What this means for DBR77 Marketplace
12. `section`: Bottom line
13. `strong_cta`: intent Start manufacturer demo; after final paragraph
14. `faq_block`: optional; use FAQ_PROMPTS below

## FAQ prompts (machine-readable)

```yaml
faq_prompts:
  - What is an approved supplier pattern in manufacturing automation buying?
  - How is a supplier pattern different from an approved vendor list?
  - What minimum contents should a supplier pattern include?
  - When is a vendor list still acceptable for automation sourcing?
  - How do you refresh an approved supplier roster without politics?
```

## CTA placement notes

- Mid CTA: challenge intake when rebuilding supplier governance
- Strong CTA: demo for multi-site procurement modernization

## Implementation notes for Cursor

- preserve comparison table row labels for FAQ mapping
- scope class examples are illustrative; adjust in implementation without removing the pattern concept
