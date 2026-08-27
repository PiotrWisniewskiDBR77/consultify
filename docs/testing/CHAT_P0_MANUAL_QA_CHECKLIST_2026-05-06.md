# Chat P0 Manual QA Checklist (2026-05-06)

Scope: final manual verification for Chat P0 Recovery before client-facing testing.

Environment:
- URL: `https://demo.consultify.ai`
- User: `piotr.wisniewski@dbr77.com`
- Password: `<HASLO>`

Status vocabulary:
- `PASS`: expected behavior confirmed.
- `BLOCKED_P1`: blocker or severe regression.
- `INCONCLUSIVE`: test could not be completed (network/env/user state ambiguity).

---

## 1) Basic Chat + DBR77 Source Gate

### Steps
1. Open `/chat`.
2. Ask: `Opowiedz mi o DBR77`.
3. Ask: `Podsumuj czym jest Consultify`.
4. Ask: `Różnica DBR77 vs Consultify`.

### Expected
- Responses are product-specific, concrete, and professional.
- No raw internal lines in visible text:
  - `Source ledger`
  - `Blocked scopes`
  - `rag_1` / `rag_*`
  - `artifact:comparison:{...}`
- No fake/noisy `No cited sources` row in normal replies.
- For DBR77/Consultify prompts, no random external domains unless user explicitly asks for web research.

### Evidence to capture
- Screenshot of each response.
- If citations are visible, screenshot citation cards/links.
- If external sources appear unexpectedly, capture the exact domain and response snippet.

---

## 2) Conversation History Gate (create/switch/refresh/rename/folder)

### Steps
1. Create a new conversation.
2. Send one user message and wait for one AI response.
3. Switch to another conversation.
4. Switch back to the new one.
5. Refresh browser.
6. Rename conversation.
7. Create/select folder and move conversation into folder.
8. Refresh browser again.

### Expected
- Conversation appears immediately in sidebar.
- Switching does not hang on `Loading conversation...`.
- Messages persist after switch and refresh.
- Rename persists after refresh.
- Folder assignment persists after refresh.

### Evidence to capture
- Sidebar before and after refresh.
- Conversation content after switch and after refresh.
- Rename/folder state after refresh.

---

## 3) Deep Thinking Gate

### Steps
1. Enable Deep Thinking.
2. Ask a strategic prompt (example): `Przeanalizuj strategię DBR77 dla rynku usług AI przemysłowego B2B.`
3. Confirm once in the confirm-understanding step.
4. Wait for full analysis.

### Expected
- Single confirm-understanding step (no repeated confirmation loop).
- After confirmation, analysis starts and completes.
- No raw artifact JSON in output (`artifact:comparison:{json}`).
- No raw internal/debug policy lines in output.

### Evidence to capture
- Confirm card screenshot.
- Final answer screenshot.
- Any repeated confirmation or malformed output (if present).

---

## 4) Attachments/PDF Gate

### A. Text attachment
Steps:
1. Attach a readable TXT or text-based PDF.
2. Ask: `Co mówi załącznik?`

Expected:
- Assistant references attachment content.
- Attachment citations are visible/clickable when present.

### B. Scanned/corrupted PDF
Steps:
1. Attach a scanned or corrupted PDF.

Expected:
- Honest degraded state message (not fake success).
- Clear reason and recoverable guidance (OCR/re-upload suggestion).
- Assistant does not hallucinate unseen file content.

### Evidence
- Upload toast(s).
- Chat message showing degraded state.
- Follow-up answer behavior after failed extraction.

---

## 5) Product Assistant Behavior Gate

### Steps
Ask product questions:
- `Jak działa moduł feedbacku?`
- `Jak działa marketplace w Consultify?`
- `Jak działają moduły aplikacji w Consultify?`

### Expected
- Answers are product-grounded and actionable.
- No generic “LLM encyclopedia” style detours.
- If something is unknown, assistant is explicit and proposes next verification steps.

### Evidence
- Screenshot for each question + answer.

---

## Manual QA Prompt (copy-ready)

Use this in tester handoff:

`Przetestuj Chat P0 na demo.consultify.ai według checklisty: (1) Basic Chat + DBR77 source gate, (2) history create/switch/refresh/rename/folder, (3) Deep Thinking confirm-once + analiza bez raw JSON, (4) attachments: readable file + corrupted/scanned PDF with honest degraded state, (5) product assistant behavior. Dla każdego punktu zwróć status PASS/BLOCKED_P1/INCONCLUSIVE oraz evidence (screenshoty i krótki opis).`

