# AI Support Inventory And Scorecard

Date: `2026-03-07`

## Purpose
This document is the canonical inventory of the current AI support layer in the application. It answers three questions:

1. Which AI areas are already meaningfully developed.
2. Which business use-cases are truly wired end-to-end.
3. Which gaps still block a real `100% production-ready` state.

## Scoring Model
- `0`: only defined in catalog or conceptually present.
- `1`: model routing or assignment exists, but no real entrypoint.
- `2`: UI/API/runtime exists, but quality, governance, or observability is incomplete.
- `3`: real end-to-end flow exists and produces useful output.
- `4`: end-to-end flow exists with governance, evaluation, budget, fallback, and operational ownership.

## AI Capability Inventory
| Area | Current state | Score | Source of truth | Notes |
| --- | --- | --- | --- | --- |
| LLM provider runtime | Strong | 3 | `server/src/services/ai/llmService.ts` | Multi-provider adapters exist for major vendors. |
| Provider config and activation | Strong | 3 | `server/src/services/ai/llmConfigService.ts` | DB and env-backed configuration exists. |
| Purpose-based routing | Strong | 3 | `server/src/services/ai/modelRouter.ts` | Tiering, fallback, org overrides, policy gating, soft caps. |
| Model registry and purpose assignments | Strong | 3 | `server/src/services/ai/modelRegistryService.ts` | Good admin control, but not every runtime path is fully registry-first yet. |
| Circuit breaker and recovery | Complete | 4 | `server/src/services/ai/circuitBreaker.ts` | Real breaker state, recovery, persistence, and health-driven behavior. |
| Runtime pipeline | Strong | 3 | `server/src/services/ai/AIPipeline.ts` | Validation, prompt assembly, budgets, routing, streaming, logging. |
| Prompt SSOT and prompt assembly | Strong | 3 | `server/src/routes/ai-prompts.routes.ts`, `server/src/services/ai/promptAssembler.ts` | Canonical path exists and is used by pipeline. |
| Prompt lifecycle governance | Partial | 2 | `server/src/services/ai/evalHarnessService.ts`, `server/src/routes/llm.routes.ts` | Release bundles exist, but publish is not yet atomic across prompt/model/policy. |
| Org AI policy and RBAC | Strong | 4 | `server/src/routes/llm.routes.ts` | Draft/history/rollback/RBAC are already in place. |
| Eval harness and regression gates | Strong | 3 | `server/src/services/ai/evalHarnessService.ts` | Good structural foundation; rollout control is still partial. |
| FinOps and executive AI cockpit | Strong | 4 | `server/src/services/ai/llmFinOpsService.ts`, `server/src/routes/llm.routes.ts` | Forecast, anomalies, vendor concentration, risk feed. |
| Chat runtime | Strong | 3 | `src/components/AIChat/UnifiedChatPanel.tsx`, `server/src/routes/ai.routes.ts` | Modern streaming path is real and production-oriented. |
| Chat with PDFs and files | Strong | 3 | `server/src/routes/ai.routes.ts`, `server/src/services/ragService.ts` | Attachment grounding and retrieval are wired. |
| Reports AI | Strong | 3 | `server/src/services/reportGenerationService.ts`, `server/src/routes/report-builder.routes.ts` | End-to-end report generation exists. |
| Presentations AI | Strong | 3 | `server/src/services/presentationGeneratorService.ts`, `server/src/routes/presentations.routes.ts` | Outline, deck generation, visuals, QA, export exist. |
| Image generation | Partial-to-strong | 2 | `server/src/services/ai/deckVisualsService.ts` | Strong inside presentations, weaker as standalone product surface. |
| RAG and document governance | Partial | 2 | `server/src/services/ragService.ts`, `server/src/services/ai/documentGovernance.ts` | Local retrieval is real, external RAG provider remains incomplete. |
| Multimodal ingestion | Partial | 1 | `server/src/services/ai/mediaIngestionService.ts`, `server/src/services/ai/speechToTextService.ts` | Declared surface is ahead of runtime completeness. |
| AI observability and quality telemetry | Partial | 2 | `server/src/routes/llm.routes.ts`, `server/src/services/ai/providerSentinel.ts` | Good fragments exist, but telemetry is still fragmented. |

## Areas Already Properly Developed
These are the parts that can already be treated as mature foundations rather than early experiments:

- `Provider and routing core`: the system already knows how to choose, filter, and fail over LLMs based on purpose, health, tier, cost, and org policy.
- `Circuit breaker and health control`: provider instability is not unmanaged anymore; breaker state and health monitoring are part of the runtime story.
- `Prompt SSOT foundation`: canonical prompt CRUD, versioning, restore/rollback, and prompt assembly exist and are already consumed by the pipeline.
- `Governance and executive control`: policy versioning, FinOps, release bundles, and executive risk overview are already present in the platform.
- `Chat + grounded documents`: core chat, streaming, attachments, and PDF/file grounding are genuinely implemented.
- `Reports and presentations`: both are beyond prototype state and already have meaningful AI delivery paths.

## Executive Use-Case Scorecard
| Use-case | Main purposes | Entrypoint | Current maturity | Score | Key note |
| --- | --- | --- | --- | --- | --- |
| Chat | `chat_simple`, `chat_complex`, `chat_confirm` | `src/components/AIChat/UnifiedChatPanel.tsx` -> `/api/ai/chat/stream` | End-to-end | 3 | Strong runtime, but front-end surface is split across modern and legacy chat. |
| Document understanding | `chat_with_pdf`, `chat_with_files`, `document_extract`, `document_compare`, `document_answer` | Attachments -> `/api/ai/attachments/ingest` -> `/api/ai/chat/stream` | End-to-end | 3 | Grounding path is real and attachment-aware. |
| Reports | `report_section_draft`, `report_executive_synthesis`, `report_evidence_validation`, `report_quality_gate` | Report builder routes and generation services | End-to-end | 3 | Business flow exists; some quality layers are still mixed between LLM and rule-based checks. |
| Presentations | `presentation_deck_outline`, `presentation_slide_copy`, `presentation_vision_qc` | Presentation generator routes and services | End-to-end | 3 | Strong delivery path, including export and QA. |
| Visuals | `presentation_visual_generation`, `image_cover`, `image_diagram`, `image_slide_asset` | Mostly via presentation generation | Partial product surface | 2 | Strong inside deck creation, not equally mature as standalone experience. |
| Internal process support | Mixed capability-first flows | Scattered initiative/execution APIs | Partial | 2 | Useful functions exist, but the use-case is less unified in catalog/governance terms. |

## Runtime Truth Inventory
| Layer | Canonical file | What it currently does |
| --- | --- | --- |
| Use-case definition | `server/src/services/ai/aiTaskCatalog.ts` | Defines purposes, use-cases, owners, tiers, requirements, fallback purposes. |
| Routing | `server/src/services/ai/modelRouter.ts` | Selects candidates and evaluates policy, breaker, health, and cost. |
| Model assignment | `server/src/services/ai/modelRegistryService.ts` | Resolves active purpose-to-model assignments. |
| Runtime execution | `server/src/services/ai/AIPipeline.ts` | Builds prompt, selects model, executes provider call, logs and fails over. |
| Governance | `server/src/routes/llm.routes.ts` | Exposes policy, release bundles, use-case overview, registry, pricing, and health/admin endpoints. |
| Prompt assembly | `server/src/services/ai/promptAssembler.ts` | Assembles final prompt from canonical prompt sources. |

## What Prevents A 4/4 State Today
- `Dual runtime surfaces`: modern AI runtime is stronger than some legacy entrypoints and legacy chat surfaces.
- `Dual prompt stack`: canonical prompt API exists, but legacy prompt API still exists and causes governance drift.
- `Promotion is not atomic`: prompt version, assignment, policy version, and release bundle are not published as one controlled transaction.
- `External RAG is unfinished`: local document grounding works, but production-grade external vector backend integration is still incomplete.
- `Multimodal promises exceed implementation`: voice and some file/media flows are more visible in UI than truly production-ready in runtime.
- `Operational telemetry is not fully unified`: observability exists, but not every AI path is measured in one consistent way.

## Recommended Definition Of Done For “AI Support Complete”
The system should only be called complete when every critical use-case has:

- one canonical UI entrypoint
- one canonical runtime path
- one prompt source of truth
- one policy + eval + publish flow
- verified model-modality fit
- fallback and health coverage
- usage, cost, and risk visibility
- a clear business owner
