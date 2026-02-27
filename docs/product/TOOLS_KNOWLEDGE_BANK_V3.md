# Tool Knowledge Bank v3 (SSOT) — “Consultant Expert” RAG for all tools

> **Status:** Draft (v3 SSOT)  
> **Goal:** create a **single, scalable mechanism** to store compressed, pre-arranged knowledge about *all consulting tools* and make it usable by:
> - tool UIs (questions, examples, evidence prompts),
> - AI assistants (RAG retrieval with citations),
> - report/roadmap generation (propose→accept),
> while staying aligned with the Evidence Ledger system.

---

## 1) What the Knowledge Bank is (and is not)

### 1.1 Is

- **Curated knowledge packs** per tool, versioned, bilingual-ready (PL/EN).
- Stored as **human-readable files** in the repo (SSOT), then ingested into RAG (`knowledge_docs`, `knowledge_chunks`).
- Designed to support:
  - structured Q&A (assessment questions per dimension/level),
  - evidence-first scoring,
  - consistent roadmap generation (gap → initiatives),
  - tool explanations and guardrails (“don’t guess”, “require evidence”).

### 1.2 Is not

- Not a “Wikipedia”. Anything verbose and unstructured will degrade retrieval.
- Not a replacement for licensed methodology PDFs. Those remain Methodology SSOT.
- Not user/project-specific notes. Those belong to assessment sessions and artifacts.

---

## 2) The “Consultant Expert” concept (specialized RAG agent)

We define a standard agent persona per tool family:

### 2.1 Responsibilities

- **Assess (assist)**: guide the user through scoring with a consistent question bank.
- **Evidence discipline**: enforce Evidence Ledger principles (claim → snippet/evidence).
- **Synthesize**: create narrative summaries and executive views with citations.
- **Roadmap**: convert gaps into initiatives (proposals), with owners, KPIs, sequencing.

### 2.2 Guardrails (MUST)

- **Propose → accept**: initiatives and score changes are always proposals unless accepted.
- **No guessing**: if evidence is missing, mark as “unknown / needs evidence”, not as a score.
- **Traceability**: outputs must preserve provenance:
  - methodology source (pdf/whitepaper),
  - tool pack section,
  - user-provided evidence (attachments/links).

### 2.3 Retrieval contract (RAG)

RAG retrieval must be **tool-scoped**:

- query is expanded with `{tool_slug, tool_version, language}` where possible
- retrieval uses `knowledge_docs` metadata to filter packs (see §4.4)
- returned chunks must include stable `source` labels (doc name + section id)

---

## 3) DRD-like mechanics: standard Assessment Editor contract

Every “assessment-style tool” editor must implement:

### 3.1 Navigation (right side)

- hierarchy levels:
  - **Group** (axis / building block / pillar)
  - **Area** (dimension / subarea)
  - **Level** (maturity levels)
- show **progress** per group and overall completion
- allow direct jump to an Area + Level

### 3.2 Work area (center)

- “Questions” panel:
  - minimum **3 yes/no** questions per (area × level)
  - answers drive confidence and help consistency
- “Evidence” panel:
  - links + attachments + short rationale text
- “Notes” panel:
  - what’s true *today* and why
  - target intent (future state) separately

### 3.3 Graphic mirror (left / main workspace)

At least one visualization must reflect the current state:

- matrix (area × level) — DRD-style
- radar / spider — dimensions
- gap bars (current vs target)
- prioritisation map (e.g., SIRI PM) when applicable

The visualization is not SSOT; it renders SSOT data.

---

## 4) Tool Knowledge Pack (canonical file format)

### 4.1 Why a pack

Current `src/services/assessmentKnowledge/*Knowledge.ts` embeds knowledge in code.
That is workable for MVP, but not scalable for “all tools” and RAG ingestion.

We therefore define a **pack** as a content artifact:

- easy to author/review in PRs,
- easy to ingest into RAG,
- easy to keep consistent across tools.

### 4.2 Pack types

- **Methodology Pack**: structured, compact representation of a licensed/internal methodology (no proprietary leakage; references instead of full copying if required).
- **Assessment QBank Pack**: questions/examples/evidence patterns per area×level.
- **Initiatives Pack**: canonical initiative patterns per gap (library of “what typically fixes this”).
- **Benchmarks Pack**: external benchmark datasets (versioned + provenance).

### 4.3 Minimal schema (Tool Knowledge Pack v1)

Each pack must declare:

- **Identity**
  - `tool_slug` (e.g. `drd`, `siri`, `adma`, `balanced_scorecard`)
  - `pack_type` (qbank / methodology / initiatives / benchmarks)
  - `version` (semantic version, e.g. `1.0.0`)
  - `language` (`en` / `pl`)
- **Provenance**
  - `sources[]`: list of canonical references (repo docs, PDFs, URLs)
  - `license_notes?`: if content is derived from licensed material
- **Structure**
  - `sections[]` with stable ids
  - each section has compact paragraphs designed for chunking
- **Evidence discipline**
  - evidence patterns and common mistakes per scoring level

### 4.4 Repo location (SSOT)

Canonical location for packs:

- `knowledge/tool-kb/<tool_slug>/<pack_type>/v<major>/...`

Example:

- `knowledge/tool-kb/siri/qbank/v1/siri-qbank.en.md`
- `knowledge/tool-kb/siri/qbank/v1/siri-qbank.pl.md`

### 4.5 RAG ingestion mapping (runtime)

Packs are ingested into:

- `knowledge_docs` (one row per pack file)
  - metadata fields (recommended): `tool_slug`, `pack_type`, `pack_version`, `language`, `source_kind='tool_pack'`
- `knowledge_chunks` (chunked sections with embeddings)

Chunking MUST:

- keep stable anchors: `section_id`, `dimension_id`, `level`, etc. in chunk metadata
- keep chunks small enough for retrieval quality (rule of thumb: 300–1200 tokens)

---

## 5) How this connects to Evidence Ledger (AI Deep Research SSOT)

Tool knowledge packs are **not evidence**.

They are:

- **rules + prompts + patterns** for:
  - which evidence to ask for,
  - what “Level 3” means in practice,
  - typical pitfalls.

When an AI agent produces claims (e.g. “current level is 3 because…”), it must link to:

- user-provided evidence (attachments/links/notes), and
- methodology references (pack provenance).

---

## 6) Implementation checklist (what becomes “done”)

For each new tool we add to the Knowledge Bank:

- **Pack files exist** for QBank (min) in EN or PL (prefer both).
- **RAG ingestion** loads them into `knowledge_docs` / `knowledge_chunks` with metadata.
- **Tool UI** uses:
  - QBank questions in the center panel,
  - right navigation contract,
  - evidence capture,
  - a graphic mirror.
- **AI assistant** can retrieve tool-scoped chunks and cite them.

---

## 7) Immediate next step (repo scaffolding)

We start by adding:

- `knowledge/tool-kb/README.md` (authoring rules)
- `_templates/` with the v1 pack template
- first packs for **DRD / SIRI / ADMA** derived from existing `*Knowledge.ts` (as a bridge)

---

## 8) Operational runbook (ingestion + reindex)

### 8.1 Canonical ingestion source

- **SSOT folder**: `knowledge/tool-kb/**`
- **Runtime DB tables (RAG)**: `knowledge_docs`, `knowledge_chunks`

### 8.2 Indexing endpoint (SuperAdmin/Admin)

We expose an operations endpoint to ingest packs into the RAG database:

- **Endpoint**: `POST /api/ai-operations/knowledge/tool-packs/index`
- **Body**:
  - `forceReindex?: boolean` — when `true`, deletes and rebuilds the indexed docs/chunks for these files.

### 8.3 What gets written to DB

For each pack file:

- `knowledge_docs`:
  - `source_type = 'tool_pack'`
  - `filepath = <repo-relative file path>`
  - `metadata` (JSON) includes at minimum:
    - `tool_slug`
    - `pack_type`
    - `pack_major`
    - `language`
    - `source_kind = 'tool_pack'`
- `knowledge_chunks`:
  - chunked text with embeddings
  - chunk metadata inherits pack metadata + `chunkIndex`

### 8.4 Definition of Done (DoD) for a new tool pack

- Pack file exists in the canonical folder structure.
- Provenance section lists the canonical sources.
- Ingestion endpoint indexes it successfully (non-zero chunks embedded).
- Tool-scoped retrieval can find it (by `tool_slug` + `pack_type` + `language`).

---

## 9) External RAG (staging → production) — SSOT contract

**Why:** docelowo Knowledge Bank nie może być “lokalną bazą w aplikacji”. Musi działać:

- na **stagingu** (szybkie iteracje),
- na **produkcji** (stabilne indeksy, audyt, izolacja tenantów, polityki danych),
- przez **API** (żeby niezależnie skalować wektorową wyszukiwarkę).

**SSOT decision (v3):**

- Repo `knowledge/tool-kb/**` pozostaje kanonicznym źródłem treści (human-reviewed).
- Indexer (ops endpoint) pozostaje kanonicznym sposobem budowy indeksu.
- Docelowy storage embeddings może być:
  - wewnętrzny (Postgres/pgvector) jako staging/MVP, albo
  - zewnętrzny (vector DB / search service) przez API jako production target.

### 9.1 Minimalny “Knowledge Provider API” (kontrakt)

Każdy zewnętrzny provider wiedzy musi wspierać:

- **Upsert document**
  - idempotent po `doc_key = filepath` (repo-relative)
  - metadane: `tool_slug`, `pack_type`, `language`, `pack_major`, `source_kind='tool_pack'`
- **Upsert chunks**
  - chunk metadata musi przenieść pack metadata + `chunkIndex` + (opcjonalnie) `section_id`
- **Delete by doc_key** (forceReindex)
- **Search**
  - query + `limit`
  - filtry: `tool_slug?`, `pack_type?`, `language?`, `organization_id?` (gdy kiedyś dojdą private packs)
  - zwrot: chunk text + `source` + `relevance`
- **Health** + metryki indeksu (ile docs/chunks)

### 9.2 Security / tenancy (MUST)

- public tool packs: globalne (bez orgId)
- private knowledge (case/client): zawsze z `organization_id` + polityką dostępu
- provider musi umożliwiać izolację tenantów na poziomie filtrów lub indeksów

---

## 10) Wzbogacanie wiedzy z case’ów / użytkowników / klientów (closed loop)

**Cel:** Knowledge Bank ma rosnąć na bazie realnych wdrożeń, ale bez mieszania:

- kanonu metodologii,
- wiedzy narzędziowej (global),
- wiedzy klienta (private).

### 10.1 Typy wiedzy (SSOT partitioning)

- **Tool knowledge (global)**: trafia do `knowledge/tool-kb/<tool>/**` (po review).
- **Case learnings (private)**: trafiają do osobnej kolekcji “case knowledge” (nie do global packs).
- **User feedback / suggestions**: trafiają do kolejki review jako “propozycje” (propose→accept).

### 10.2 Pipeline (propose → review → publish)

1) **Capture**: user/consultant zapisuje insight (tekst + evidence link + tagi: tool, dimension, industry).
2) **Review queue**: PMO/Owner ocenia:
   - czy nie ma PII / tajemnicy przedsiębiorstwa,
   - czy insight jest uogólnialny,
   - czy ma dowody.
3) **Publish**:
   - jeśli global: PR do packa `tool-kb` (nowa sekcja / poprawka),
   - jeśli private: zapis jako doc w “case knowledge” z `organization_id`.
4) **Index**: reindex tool packs + (opcjonalnie) reindex case docs do provider API.

### 10.3 Definition of Done dla “knowledge capture”

- istnieje forma/endpoint do zgłoszeń,
- istnieje status workflow (new → triaged → accepted/rejected → published),
- istnieje polityka redakcji danych,
- retrieval wspiera filtry (global vs private).

