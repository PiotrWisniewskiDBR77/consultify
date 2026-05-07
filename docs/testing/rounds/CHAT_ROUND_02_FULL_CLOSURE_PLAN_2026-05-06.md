# Chat Round 02 — Full Closure Plan (100%)

Round ID: `ROUND-CHAT-2026-05-06-02`  
Goal: zamknac obszar Chat na 100% (bez otwartych P0/P1 i bez niezweryfikowanych sciezek funkcjonalnych).  
Environment: `https://demo.consultify.ai`  
Account: `piotr.wisniewski@dbr77.com` (Owner/Admin)

---

## 1) Scope — all Chat functionalities

Round covers:
1. Basic chat quality and trust.
2. Deep Thinking / Co-Thinker.
3. Show Reasoning.
4. Attachments (readable + broken/scanned).
5. Web/deep search.
6. Conversation history/folders/rename.
7. Product assistant behavior.
8. Follow-up context chain.
9. Trust/Sources panel.
10. Teresa proposal + approve/reject flow.
11. Chat actions/navigation cards.
12. Refresh resilience and route persistence.

---

## 2) Mandatory preflight (automation first)

Manual round starts only after all commands below pass.

```bash
npm run lint
npm run type-check
npx vitest run "src/components/AIChat/__tests__/TrustBadge.test.tsx"
npx vitest run "tests/components/AIChat/MessageRenderer.policy.test.tsx"
npm run test:runtime-gate
npm run test:aios:wave-1
```

If capacity allows, add:

```bash
npm run test:e2e:tier0
npm run test:e2e:smoke
```

---

## 3) Detailed manual matrix (execution order)

### A. Core chat response quality

Prompts:
- `Opowiedz mi o DBR77`
- `Podsumuj czym jest Consultify`
- `Wyjasnij roznice miedzy DBR77 a Consultify`

Must pass:
- response starts fast and completes without runtime error,
- no raw internals: `Source ledger`, `Blocked scopes`, `rag_*`, `artifact:*`,
- no `No cited sources` line in user-visible body.

Evidence:
- 1 UI screenshot/prompt,
- 1 Sources/Trust screenshot.

### B. Deep Thinking and Show Reasoning

Prompt:
- `Porownaj trzy kierunki rozwoju marketplace DBR77 i zaproponuj plan 30/60/90 dni`

Must pass:
- no confirm loop,
- deep flow yields structured analysis,
- reasoning panel loads and is coherent,
- no raw JSON artifact rendering.

Evidence:
- confirm step screenshot,
- final deep answer screenshot,
- reasoning panel screenshot.

### C. Attachments and truthful degradation

Cases:
1. Attach readable TXT/PDF and ask summary.
2. Attach broken/scanned PDF and ask summary.

Must pass:
- readable file is used in answer,
- broken file returns explicit recoverable degraded message,
- no hallucinated details from unreadable file.

Evidence:
- upload toast screenshot,
- response screenshot,
- network response status/code screenshot.

### D. Web research integrity

Prompts:
- `Znajdz aktualne trendy AI consulting 2026`
- `Znajdz konkurencje DBR77 na rynku USA`

Must pass:
- deep search sources appear when expected,
- sources are relevant to the question/context,
- no random literal junk domains.

Evidence:
- answer screenshot,
- sources list screenshot.

### E. History, folders, rename, refresh

Flow:
1. Create chat.
2. Send 2 messages.
3. Rename chat.
4. Move to folder.
5. Switch to another chat and back.
6. Refresh page.
7. Re-open moved chat.

Must pass:
- no loading deadlock,
- no missing messages,
- rename and folder persist after refresh.

Evidence:
- sidebar screenshot before/after refresh,
- opened conversation screenshot.

### F. Product assistant usefulness

Prompts:
- `Jak dziala modul feedbacku?`
- `Gdzie znajde marketplace w systemie?`
- `Jak dodac nowy element w tym obszarze?`

Must pass:
- practical product-oriented answers,
- no generic off-topic coaching output,
- clear next steps when unsure.

Evidence:
- 3 screenshots of Q/A.

### G. Follow-up context chain

Chain:
1. `Opowiedz mi o DBR77`
2. `Rozwin punkt o marketplace`
3. `Jakie ryzyka widzisz?`
4. `Daj plan ograniczenia tych ryzyk`

Must pass:
- context retained across all steps,
- no reset-like behavior.

Evidence:
- chain screenshot showing all 4 prompts and coherent continuity.

### H. Trust/Sources panel UX hardening

Must pass:
- no `No cited sources` leakage in answer body,
- no broken source labels (`Source 1`, `rag_1`, `"[1]"`),
- links clickable and valid.

Evidence:
- trust panel screenshot,
- clicked source screenshot.

### I. Teresa proposals / governed action flow

Flow:
1. Trigger Teresa proposal from actionable request.
2. Verify proposal card.
3. Approve and execute.
4. Open generated output.

Must pass:
- explicit proposal -> approval -> execution,
- operation completes without dead end.

Evidence:
- proposal card screenshot,
- post-approval result screenshot.

### J. Route and refresh resilience

Must pass:
- `/chat` and `/chat/:id` transitions stable,
- refresh does not corrupt active chat state.

Evidence:
- URL and UI screenshots before/after refresh.

---

## 4) Scoring and release decision

Status values:
- `PASS`
- `BLOCKED_P0`
- `BLOCKED_P1`
- `PASS_WITH_P2`
- `INCONCLUSIVE`

Release rule:
- any `P0` => `NO-GO`
- 2+ `P1` => `NO-GO`
- max 1 `P1` => `GO_WITH_RISK`
- no `P0/P1` => `GO`

---

## 5) Post-round mandatory deployment loop

After round completion:
1. Register defects with owner+ETA.
2. Implement fixes.
3. Re-run impacted automation.
4. Deploy to demo/stage.
5. Run smoke:
   - `npm run smoke:b02-chat-actions`
   - `npm run smoke:ai:research-ledger`
6. Execute focused retest for changed areas.

No deploy => no valid retest closure.

---

## 6) Round report template (fill during execution)

| Area | Status | Key finding | Defect ID | Evidence |
| --- | --- | --- | --- | --- |
| A. Core chat |  |  |  |  |
| B. Deep/Reasoning |  |  |  |  |
| C. Attachments |  |  |  |  |
| D. Web research |  |  |  |  |
| E. History/folders |  |  |  |  |
| F. Product Q&A |  |  |  |  |
| G. Follow-up |  |  |  |  |
| H. Trust/Sources |  |  |  |  |
| I. Teresa proposals |  |  |  |  |
| J. Route/refresh |  |  |  |  |

Global decision: `GO / GO_WITH_RISK / NO-GO`

