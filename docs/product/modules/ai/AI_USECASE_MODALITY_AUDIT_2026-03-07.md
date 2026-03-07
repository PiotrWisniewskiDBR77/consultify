# AI Use-Case And Modality Audit

Date: `2026-03-07`

## Objective
This document verifies whether the main AI use-cases are connected to the right model classes and whether each one is truly complete end-to-end.

## Canonical Use-Case Catalog
The current product-level AI catalog is defined in:

- `server/src/services/ai/aiTaskCatalog.ts`

Primary executive use-cases:
- `chat`
- `document_understanding`
- `reports`
- `presentations`
- `visuals`

## Modality Rules
For audit purposes, the expected model fit is:

- `text chat`: text LLM
- `chat with PDFs/files`: text LLM with grounding and, where required, vision support
- `report drafting/synthesis`: text LLM optimized for structured synthesis and reasoning
- `presentation copy and outline`: text LLM
- `presentation visual generation`: image model
- `visual QA`: text/vision-capable model

## Use-Case Scorecard
| Use-case | Expected modality | Current runtime evidence | Completeness | Score | Verdict |
| --- | --- | --- | --- | --- | --- |
| Chat | Text LLM | `UnifiedChatPanel` -> `/api/ai/chat/stream` -> `AIPipeline` -> `modelRouter` | Strong | 3 | Correctly mapped and meaningfully deployed. |
| Document understanding | Text LLM + grounding, optional vision | attachment ingest, `attachmentDocIds`, retrieval injection, purpose inference for `chat_with_pdf` | Strong | 3 | Correctly routed and grounded. |
| Reports | Text LLM with reasoning/synthesis | report builder routes and `reportGenerationService` using report purposes | Strong | 3 | Good text-model fit and real delivery path. |
| Presentations | Text LLM for outline/copy + vision QA | presentation generator and slide-copy purposes | Strong | 3 | Correctly split between copy and QA flows. |
| Visuals | Image model + optional QA model | `deckVisualsService` and image purposes | Partial-to-strong | 2 | Correct provider type exists, but strongest coverage is still embedded inside presentations. |
| Internal process support | Mostly text LLM | multiple AI helper routes and capability-driven services | Partial | 2 | Useful but less unified; weaker governance visibility than executive use-cases. |

## Detailed Assessment

### 1. Chat
Expected model type:
- text LLM

Current evidence:
- canonical chat uses `UnifiedChatPanel`
- backend uses `/api/ai/chat/stream`
- execution goes through `AIPipeline`
- routing is purpose-aware and policy-aware

Assessment:
- this is a real production path
- model fit is correct
- main remaining issue is front-end consistency, not model misfit

### 2. Document Understanding
Expected model type:
- text LLM with grounding
- vision capability where extraction/comparison needs it

Current evidence:
- purpose catalog contains `chat_with_pdf`, `chat_with_files`, `document_extract`, `document_compare`, `document_answer`
- `ai.routes.ts` and `AIPipeline.ts` carry `attachmentDocIds`
- attachment chunks are injected or retrieved for grounded answering

Assessment:
- this is one of the best aligned areas in the system
- the model-to-task mapping is correct
- the main remaining gap is scaling grounding and external RAG maturity

### 3. Reports
Expected model type:
- text LLM for drafting
- stronger reasoning model for synthesis and evidence validation

Current evidence:
- report purposes are explicitly defined in `aiTaskCatalog`
- report generation service uses report-specific purposes
- report flow is materially present in dedicated report builder routes and services

Assessment:
- model fit is good
- business flow is real
- some quality functions remain partly mixed between LLM-assisted logic and deterministic/rule-based checks

### 4. Presentations
Expected model type:
- text LLM for structure and copy
- image model for visual generation
- vision/text reasoning for QA

Current evidence:
- `presentation_deck_outline`
- `presentation_slide_copy`
- `presentation_visual_generation`
- `presentation_vision_qc`

Assessment:
- this is the clearest multimodal use-case in the system
- modality separation is conceptually correct
- strongest remaining gap is making visual generation and QA not only strong inside deck generation, but also formally governed as reusable product capabilities

### 5. Visuals
Expected model type:
- image model

Current evidence:
- image purposes are defined correctly
- `deckVisualsService` uses image-generation logic

Assessment:
- capability exists
- the gap is product completeness, not provider mismatch
- visuals are strongest as part of presentations, weaker as a standalone managed AI surface

### 6. Internal Process Support
Expected model type:
- mostly text LLM

Current evidence:
- several helper APIs and execution-support flows exist
- however, a noticeable portion of these flows is still capability-driven rather than use-case-governed

Assessment:
- many useful functions exist
- model fit is generally acceptable
- governance, scorecard coverage, and use-case clarity are weaker here than for chat/reports/presentations

## What Is Already Correctly Matched
- `text tasks -> text models`: yes, for chat, reports, and presentation copy.
- `document tasks -> grounded text/vision-capable models`: yes, at a strong partial-to-strong level.
- `visual asset generation -> image models`: yes.
- `visual QA -> reasoning/vision-capable models`: yes, by architecture.

## What Is Only Partially Complete
- standalone `visuals` as a first-class governed product capability
- `internal process support` as one clearly cataloged, measured, and governed AI domain
- `external RAG` and richer multimodal ingestion beyond the strongest current document flow

## Final Verdict
The system is already correctly oriented in terms of model class selection:

- text work is mostly on text-capable LLM paths
- grounded document work is on grounded/vision-aware paths
- image generation is on image-capable paths
- presentation flows properly mix text, image, and QA logic

The main blocker to `100%` is no longer basic model mismatch. It is completeness:

- not every declared use-case is equally governed
- not every runtime is equally canonical
- not every multimodal promise is equally production-ready
