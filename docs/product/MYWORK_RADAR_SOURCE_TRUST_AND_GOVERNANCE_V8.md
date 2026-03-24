# MyWork Radar Source Trust And Governance v8

> Status: Draft v8
> Owner: Product + Engineering
> Purpose: zdefiniowac jak `Radar` ocenia zrodla, pilnuje swiezosci, zachowuje source honesty i nie promuje slabych sygnalow jako mocnych rekomendacji.

---

## 1. Why this document exists

Jesli `Radar` ma byc systemem decyzyjnym, nie moze opierac sie tylko na:

- ciekawych artykulach,
- glosnych markach,
- albo przypadkowych sygnalach z internetu.

Potrzebuje wyraznego kontraktu dla:

- source quality,
- freshness,
- dedupe,
- confidence,
- citation honesty,
- i policy boundaries.

---

## 2. Inherited truth

This document inherits:

- `MYWORK_RADAR_V8_SSOT.md`
- `MYWORK_RADAR_SIGNAL_PIPELINE_AND_RUNTIME_V8.md`
- `AI_OUTPUT_TRUST_ARCHITECTURE_V8.md`
- `AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md`
- `CHAT_V8_ATTACHMENTS_AND_RETRIEVAL.md`

Rule:

`Radar may be action-oriented, but it must remain honest about what kind of source and evidence actually support the recommendation`

---

## 3. Source classes

Baseline source classes include:

- `rss`
- `blog`
- `news_provider`
- `company_newsroom`
- `documentation_feed`
- `analyst_source`
- `manual`

These classes are not interchangeable.

Examples:

- `documentation_feed` is usually stronger for product-change truth
- `company_newsroom` is stronger for official announcements but weaker for neutral interpretation
- `blog` may be useful but often requires stronger skepticism

---

## 4. Trust score doctrine

Every source should carry a trust score.

But trust score alone is not enough.
Radar should reason on at least these axes:

- source trust
- content freshness
- duplicate density
- actionability
- domain fit
- relevance to current user context

Rule:

`trusted but irrelevant should still rank low`

and

`relevant but weakly trusted should stay visibly cautious`

---

## 5. Freshness doctrine

Freshness is part of value, not decoration.

Radar should distinguish:

- breaking but unstable
- current and meaningful
- evergreen and educational

It should not present stale content as urgent.

Freshness should influence:

- top-of-screen priority
- notification eligibility
- recommendation tone
- whether the item belongs in `what changed` or `learn and improve`

---

## 6. Duplicate doctrine

Many external sources echo the same move.

Radar must therefore:

- detect duplicate clusters
- avoid flooding the user with near-identical items
- keep the best representative of the cluster
- preserve traceability to all supporting source variants where useful

The user should see:

- one strong signal

not:

- five repeated versions of the same announcement

---

## 7. Citation and source honesty

Radar should preserve user trust through source honesty.

That means:

- do not collapse all evidence into generic prose
- keep source name visible
- keep canonical url traceable
- distinguish official source from interpreted explanation
- distinguish signal summary from user-specific recommendation

If the recommendation goes beyond what the source literally says, Radar should do so openly as interpretation, not disguised citation.

---

## 8. Confidence doctrine

Confidence in Radar should reflect:

- source credibility
- signal clarity
- duplicate agreement or contradiction
- quality of user-context match
- stability of derived interpretation

High confidence does not mean:

- guaranteed truth
- guaranteed business outcome

It means:

- strong enough signal quality to justify user attention and likely action

---

## 9. Allowed recommendation strength

Recommendation strength should vary by evidence class.

Allowed:

- strong educational next step from `documentation_feed` or `how_to`
- medium-confidence commercial question from aggregated market sources
- cautious compliance warning from early regulation signals

Not allowed:

- hard decision-grade recommendation from weak source with no corroboration
- aggressive action language from rumor-like or noisy content

---

## 10. Internal and external blending

Radar may blend:

- external sources
- internal workspace context
- user profile

But it must not pretend that internal fit makes weak external evidence stronger than it is.

`personal relevance` and `source truth` are separate dimensions.

---

## 11. Governance controls

Operator and admin governance should eventually support:

- source activation and deactivation
- refresh frequency rules
- trust score maintenance
- blocked or muted source classes
- inspection of duplicate and stale behavior

These controls may mature later in code, but the doctrine is already canonical.

---

## 12. Risks and anti-patterns

- loud vendor content dominates because it is fresh
- duplicated stories inflate apparent importance
- weak sources produce strong recommendation tone
- user-specific framing hides low evidence quality
- educational content and market change are treated as equal evidence classes

---

## 13. Acceptance criteria

- Radar distinguishes source class, freshness and trust as separate concerns
- duplicated content does not dominate the user experience
- source honesty is preserved from signal to recommendation
- recommendation strength stays proportional to evidence quality
