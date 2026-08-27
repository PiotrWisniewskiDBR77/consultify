# AI Chat — Smoke Tests (local dev)

> **Document:** `docs/testing/AI_CHAT_SMOKE_TESTS.md`  
> **Purpose:** Quick end-to-end verification of AI Chat, Deep Research confirm flow, and chat attachments RAG.  
> **Last Updated:** 2026-02-07

---

## Prerequisites

- Dev servers:

```bash
npm run dev:stable
```

- Demo credentials:

```bash
npm run fix:credentials
```

This prints known dev accounts (e.g. `piotr.wisniewski@dbr77.com / <HASLO>`).

- You need a valid JWT token (e.g. from browser localStorage `token`).

---

## 1) Deep Research gate (Confirm required)

Verify that Deep Research is blocked until confirmation is done.

```bash
TOKEN="...jwt..."
curl -sS -i "http://localhost:3001/api/ai/chat/stream" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @- <<'JSON'
{
  "message": "Przetestuj deep research",
  "history": [],
  "language": "pl",
  "conversationId": "smoke-dt-gate",
  "context": { "conversationId": "smoke-dt-gate" },
  "aiModes": { "deepResearch": true, "webSearch": false, "showReasoning": false }
}
JSON
```

Expected:

- HTTP 400
- JSON includes `code: "DEEP_THINKING_CONFIRM_REQUIRED"`

---

## 2) Confirm Understanding (structured)

```bash
TOKEN="...jwt..."
curl -sS "http://localhost:3001/api/ai/chat/confirm" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @- <<'JSON'
{
  "message": "Chcę zrobić analizę rynku dla produktu X, skup się na ryzykach i planie działań.",
  "history": [],
  "language": "pl",
  "conversationId": "smoke-dt-confirm"
}
JSON
```

Expected:

- JSON with `confirm.understanding`, `confirm.missingInfoQuestions`, `confirm.researchPlanItems`

---

## 3) Deep Research stream after confirm

```bash
TOKEN="...jwt..."
curl --http1.1 -sS -N "http://localhost:3001/api/ai/chat/stream" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @- <<'JSON'
{
  "message": "OK, potraktuj produkt X jako SaaS dla działów compliance w UE. Zrób analizę rynku: segmenty, konkurencja, 5 ryzyk i plan 30/60/90 dni.",
  "history": [],
  "language": "pl",
  "conversationId": "smoke-dt-confirm",
  "context": { "conversationId": "smoke-dt-confirm", "deepThinkingConfirmed": true },
  "aiModes": { "deepResearch": true, "webSearch": false, "showReasoning": false }
}
JSON
```

Expected:

- SSE events with `dt_state` and response chunks (`{"text":"..."}`)
- `data: [DONE]` at end

---

## 4) Chat attachments ingestion + conversation-scoped RAG

### 4.1 Ingest attachment

You can ingest a Markdown file (force mimetype if needed):

```bash
TOKEN="...jwt..."
curl -sS -X POST "http://localhost:3001/api/ai/attachments/ingest" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@README.md;type=text/markdown"
```

Expected: JSON with `docId`.

### 4.2 Ask question grounded on the attachment

```bash
TOKEN="...jwt..."
DOC="...docId..."
curl --http1.1 -sS -N "http://localhost:3001/api/ai/chat/stream" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @- <<JSON
{
  "message": "W załączniku, pod nagłówkiem 'Consultinity', jaki jest podtytuł? Odpowiedz krótko i zacytuj [A1].",
  "history": [],
  "language": "pl",
  "conversationId": "smoke-attach-readme",
  "context": {
    "conversationId": "smoke-attach-readme",
    "focusMode": "all",
    "attachmentDocIds": ["$DOC"]
  },
  "aiModes": { "deepResearch": false, "webSearch": false, "showReasoning": false }
}
JSON
```

Expected:

- Answer should match content from the attachment (retrieved via BM25/hybrid)
- NOTE: model may omit the `[A1]` citation even if it used the attachment; treat citation format as best-effort.

---

## Known issues / notes

- If OpenAI embedding key is invalid/unavailable, vector search will be skipped; BM25-based retrieval can still work.
- In minimal SQLite schemas, `knowledge_docs` may not have `organization_id`. RAG queries must guard this column (implemented in `ragService`).
