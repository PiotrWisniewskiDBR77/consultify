# MyWork Radar Signal Pipeline And Runtime v8

> Status: Draft v8
> Owner: Product + Engineering
> Purpose: zdefiniowac kanoniczny runtime `Radar` od zrodla do sygnalu, od sygnalu do insight card, i od insight card do action handoff.

---

## 1. Why this document exists

Zeby `Radar` byl leader-grade, nie wystarczy miec ranking kart na ekranie.

Potrzebny jest jeden kanoniczny flow:

- skad sygnal pochodzi,
- jak jest przetwarzany,
- jak unika sie duplikatow,
- jak staje sie spersonalizowanym insightem,
- i jak przechodzi do kolejnego ruchu w systemie.

---

## 2. Inherited truth

This document inherits:

- `MYWORK_RADAR_V8_SSOT.md`
- `MYWORK_HOME_V1_SSOT.md`
- `AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md`
- `AI_OUTPUT_TRUST_ARCHITECTURE_V8.md`

Runtime truth today is anchored in:

- `server/migrations/734_radar_v2_foundation.sql`
- `server/src/services/radar/radarService.ts`
- `server/src/services/radar/radarRankingService.ts`
- `server/src/services/radar/radarInsightService.ts`
- `server/src/services/radar/radarActionService.ts`
- `server/src/services/radar/radarTypes.ts`

---

## 3. Canonical runtime path

The canonical runtime is:

`source registry -> ingestion -> raw item -> processing -> processed signal -> ranking -> insight enhancement -> localization -> briefing assembly -> user actions -> learning loop`

This is the minimum Radar spine.

---

## 4. Canonical runtime objects

### 4.1 `RadarSource`

Represents one registered input source.

Baseline classes:

- `rss`
- `blog`
- `news_provider`
- `company_newsroom`
- `documentation_feed`
- `analyst_source`
- `manual`

### 4.2 `RadarRawItem`

Represents fetched source content before interpretation.

Baseline fields:

- title
- raw text or raw html
- canonical url
- author
- published at
- content hash

### 4.3 `RadarProcessedSignal`

Represents normalized and scored signal after classification and summarization.

It must include:

- normalized title
- summary short and summary long
- content type
- domain tags
- topic tags
- entity tags
- business impact
- actionability
- freshness
- trust
- duplicate cluster
- signal kind

### 4.4 `RadarRankedSignal`

Represents per-user prioritization.

It must include:

- final score
- relevance breakdown
- why you see this
- why it matters
- suggested next step
- impact type
- confidence score
- related projects and context

### 4.5 `RadarSignalCard`

Represents the final user-facing unit.

This is the baseline payload sent to UI and chat bridge.

---

## 5. Processing stages

### 5.1 Ingestion

The system should:

- fetch from active sources
- preserve canonical url
- preserve source metadata
- dedupe at raw content level where possible

### 5.2 Classification

The system should assign:

- topic and domain tags
- content type
- impact and actionability
- relevance scope
- signal kind

### 5.3 Summarization

The system should derive:

- short summary
- longer interpretive summary
- stable normalized title

### 5.4 User-specific ranking

The system should combine:

- role and industry
- live work context
- project and initiative overlap
- watchlist and profile
- behavior feedback
- freshness and trust

### 5.5 Insight enhancement

Top signals may be enhanced with:

- `why you see this`
- `why it matters`
- `suggested next step`
- `impact type`
- `confidence score`

### 5.6 Localization

User-visible copy must respect active app language.
Mixed-language UI is not allowed as a stable user state.

---

## 6. Duplicate and freshness doctrine

Radar must not let users drown in repeated variants of the same story.

The runtime therefore needs:

- canonical url normalization
- content hash awareness
- duplicate cluster semantics
- freshness scoring
- durability classes

Durability classes:

- `hot`
- `current`
- `evergreen`

Rule:

`freshness affects urgency, durability affects shelf life`

---

## 7. Signal kinds

The runtime should support these signal kinds:

- `external`
- `educational`
- `internal`

This allows Radar to blend:

- market and vendor change
- how-to and playbook content
- future internal workspace or org signals

without pretending they are all the same class of evidence.

---

## 8. Runtime outputs

The baseline assembled view should expose:

- `dailyBriefing`
- `whatChanged`
- `whyItMattersToMe`
- `whatToDoNext`
- `learnImprove`
- `watchlist`
- `metrics`
- `localization`

This output package is the runtime contract for `My Work > Home`.

---

## 9. Action loop

Radar runtime does not end at rendering.

The action loop is:

`view -> open -> ask AI or create artifact -> record action -> update preference profile -> affect future ranking`

That means:

- action telemetry is part of product learning
- behavior feedback is part of relevance
- Radar is adaptive by design

---

## 10. Runtime anti-patterns

- article fetched but no normalized signal exists
- ranking happens without live work context
- duplicate stories flood the top of the feed
- localization creates unstable mixed-language cards
- user actions do not feed back into future relevance
- source object and final signal cannot be traced back to each other

---

## 11. Acceptance criteria

- one clear source-to-signal-to-insight runtime exists
- Radar supports dedupe, freshness and durability as first-class concerns
- user-visible cards remain traceable to processed signals and sources
- action logging is part of the loop, not a side channel
