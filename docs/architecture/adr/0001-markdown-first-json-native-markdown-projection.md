# ADR 0001: Markdown-First, JSON-Native, Markdown Projection

Status: Accepted
Date: 2026-05-02
Owners: Product + Engineering

## Context

Canvas is becoming the work area next to Teresa chat. It must support business documents, research reports, decisions, tables, presentations, diagrams, mind maps, whiteboards and process flows without becoming a set of disconnected tools.

The product also needs MCP-friendly and AI-friendly content. Markdown is the simplest durable language for chat context, knowledge packs, review, diffing, search, RAG and human-readable documentation. At the same time, tables, decks, diagrams and boards need structured JSON to behave like native tools.

## Decision

Consultify adopts the following content contract:

1. Natural documents use Markdown as the canonical source.
2. Native structured artifacts use JSON as the canonical source.
3. Every artifact has a Markdown projection for Canvas preview, chat, MCP, review, search and lightweight export.
4. Business UI must not default to raw JSON. Raw JSON is allowed only in explicit source, export, admin or developer contexts.
5. JSON-native artifacts may expose editable Markdown only through a proposal/patch flow that updates the canonical JSON.

## Content Envelope

The shared contract is:

```ts
type CanonicalFormat = 'markdown' | 'json';
type ProjectionStatus = 'synced' | 'stale' | 'failed' | 'missing';

interface ArtifactContentEnvelope {
  canonicalFormat: CanonicalFormat;
  artifactType: string;
  contentMd: string;
  contentJson?: unknown;
  contentSchemaVersion?: string;
  markdownProjectionStatus: ProjectionStatus;
  markdownProjectedAt?: string;
  projectionError?: string;
}
```

## Examples

- Note, brief, decision memo, research report and implementation plan: `canonicalFormat='markdown'`, `contentMd` is the source of truth.
- Table, deck, mind map, whiteboard and process flow: `canonicalFormat='json'`, `contentJson` is the source of truth, `contentMd` is the projection.
- Research report: Markdown report remains the business readout; evidence, citations and graph remain structured JSON behind it.

## Consequences

- Work Canvas, Wave 5 artifacts, research artifacts and knowledge documents need additive content fields.
- APIs must preserve legacy `content` fields while returning the envelope.
- Canvas preview and MCP should prefer Markdown projection.
- Native editors should read/write JSON canonical content.
- Projectors must be tested so projection never degrades into `JSON.stringify`.

## Non-Goals

- Markdown will not replace native slide, table, diagram or whiteboard models.
- JSON will not become the default business-facing readout.
- This ADR does not define every renderer; it defines the storage and interchange contract.

## Acceptance Rules

- Every durable artifact can provide Markdown to chat/MCP.
- Every JSON-native artifact declares whether the projection is `synced`, `stale`, `failed` or `missing`.
- Stale or failed projections show honest degraded UI.
- Hidden mutation of JSON canonical content is forbidden; AI changes require proposal, approval and audit when business-significant.

