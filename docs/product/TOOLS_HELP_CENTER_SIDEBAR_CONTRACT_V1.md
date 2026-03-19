# Tools Help Center Sidebar Contract V1

> Status: proposed foundation  
> Scope: tool-specific Help Center entries shown in the right sidebar

---

## 1. Purpose

This document defines the deterministic contract between:

- a tool in the `Tools` module,
- its Known Tools metadata,
- its Help Center article in `kb_articles`.

The goal is simple:

> every tool has one canonical sidebar article and the system can resolve it predictably.

---

## 2. Canonical source

For sidebar Help Center content, the canonical source is:

- `kb_articles`
- `kb_article_translations`

Repo docs, tool specs, and external research may be used to author content, but the final sidebar-facing article must be published through the knowledge base tables and API.

---

## 3. Deterministic identity

For every tool:

- article slug must be `tools-<toolType>-how-to`
- `related_modules` must contain exactly the tool type
- the article must exist in EN and PL

Example:

- tool type: `dynamic-swot`
- slug: `tools-dynamic-swot-how-to`
- related modules: `[\"dynamic-swot\"]`

---

## 4. Known Tools linkage

Known Tools metadata must expose a deterministic article pointer:

- `kbArticleSlug = tools-<toolType>-how-to`

This is already the correct product direction and should be treated as mandatory behavior for every tool.

Known Tools remains the place for:

- preview metadata,
- library copy,
- expected outputs,
- entry-point actions.

Help Center remains the place for:

- explainers,
- usage guidance,
- stage interpretation,
- quick operating checklist.

---

## 5. Resolution contract

When a tool opens Help Center:

1. the tool passes `toolType` as context,
2. Help Center resolves contextual articles for that tool,
3. the canonical article for the tool must be present in that result set,
4. the canonical article should be treated as the primary article for that tool.

Preferred product behavior:

- exact slug is known,
- contextual list is still allowed,
- but the exact article identity is deterministic and stable.

---

## 6. Required article fields

Each tool Help Center entry must contain:

- title,
- summary,
- content,
- related_modules,
- target_audience,
- reading_time_minutes.

Recommended:

- video_script,
- thumbnail_url,
- video_teaser_url,
- video_url.

---

## 7. Minimum content structure

Each tool article must include:

1. purpose / when to use,
2. required inputs,
3. runtime stages,
4. interpretation guidance,
5. common mistakes,
6. example,
7. outputs in Consultify,
8. quick checklist.

Runtime stages in the article should mirror the consulting flow used in product:

- `Entry / Purpose`
- `Conversation / Capture`
- `Context Ingestion`
- `Analysis / Benchmarking`
- `Applied Conclusions`
- `Final Source Summary`
- `Outputs`

---

## 8. Required implementation rule for new tools

A new tool is not content-ready unless:

- a `kb_articles` row exists,
- a translation exists for EN and PL,
- `related_modules` includes the exact `toolType`,
- `kbArticleSlug` is available from Known Tools metadata,
- the article is aligned with the actual runtime stages and output layer.

---

## 9. Dynamic SWOT as reference

`Dynamic SWOT` is the first reference implementation of this contract.

Its canonical article identity is:

- slug: `tools-dynamic-swot-how-to`
- module binding: `dynamic-swot`

The article content should describe the new runtime model:

- light entry,
- conversation-first,
- AI mentor behavior,
- multi-source context,
- structured cards,
- tensions,
- applied conclusions,
- final source summary,
- recommended moves,
- outputs.

---

## 10. DoD

The sidebar contract is considered adopted for a tool when:

- one canonical KB article exists,
- the article is discoverable contextually by tool type,
- Known Tools points to the same slug,
- the content is complete and bilingual,
- Help Center behavior is deterministic enough that product and content teams know exactly which article belongs to which tool.
