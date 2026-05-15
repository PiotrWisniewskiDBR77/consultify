# AI Chat Stabilization Acceptance Matrix

This matrix is the fixed acceptance baseline for the AI Chat stabilization work. It converts the tester findings into repeatable pass/fail checks that must be rerun before staging sign-off.

## Scope

- Regular chat response quality and latency.
- Citations, source trust, and source rendering.
- DBR77 / Consultify / Marketplace product knowledge.
- Deep Thinking and show-reasoning behavior.
- Conversation history, folders, renaming, and refresh stability.
- Attachments and document analysis.

## Golden Prompts

### Basic Product Chat

| ID | Prompt | Expected result |
| --- | --- | --- |
| BASIC-01 | `Opowiedz mi o DBR77` | Uses approved DBR77 knowledge, shows the user question, avoids unrelated web results, no internal policy ledger. |
| BASIC-02 | `Podsumuj czym jest Consultify` | Explains Consultify from product knowledge, with concise professional tone and valid citations when sources are used. |
| BASIC-03 | `Wyjaśnij różnicę między DBR77 a Consultify` | Clearly distinguishes DBR77 from Consultify without calling DBR77 an incorrect technology ecosystem unless approved product copy says so. |
| BASIC-04 | `Powiedz coś więcej o marketplace DBR77` | Uses DBR77 marketplace knowledge, not unrelated `consultify` domains or literal query matches. |

### Research / Web

| ID | Prompt | Expected result |
| --- | --- | --- |
| WEB-01 | `Wskaż obecnie największą konkurencję dla DBR77 na rynku polskim i na rynku USA` | Separates DBR77 internal knowledge from web research, cites credible sources, and avoids unsupported claims. |
| WEB-02 | `Znajdź informacje o konkurencji DBR77` | Uses web only as research evidence, not as product truth; communicates missing reliable evidence clearly. |
| WEB-03 | `Sprawdź bieżące trendy w konsultingu` | Performs web/freshness retrieval when enabled and labels sources as external research. |

### Deep Thinking / Reasoning

| ID | Prompt | Expected result |
| --- | --- | --- |
| DEEP-01 | `Przeanalizuj pozycjonowanie DBR77` | Deep mode produces a structured analysis with assumptions, risks, and recommendation; no repeated clarification loop. |
| DEEP-02 | `Porównaj możliwe kierunki rozwoju marketplace DBR77` | Show-reasoning/deep mode does not leak raw `artifact:*` blocks or JSON into the visible answer. |

### Product Assistant

| ID | Prompt | Expected result |
| --- | --- | --- |
| PROD-01 | `Jak działa moduł feedbacku?` | Answers as a product assistant and references product documentation or implemented feature behavior. |
| PROD-02 | `Gdzie w systemie znajdę marketplace?` | Gives concrete navigation/product guidance, not generic marketplace knowledge. |
| PROD-03 | `Jak dodać nowy element w tym obszarze?` | Gives practical product steps or clearly states when the action is not available. |

## Conversation History Flow

| ID | Action | Expected result |
| --- | --- | --- |
| HIST-01 | Create a new conversation | It appears immediately in the history list. |
| HIST-02 | Switch to another conversation and back | The selected conversation opens without endless loading. |
| HIST-03 | Rename a conversation | The new title persists after navigation and refresh. |
| HIST-04 | Create a personal folder | Folder appears and can contain conversations. |
| HIST-05 | Create a conversation while a folder is active | Conversation is assigned to that folder through `chatProjectId`, not PMO `projectId`. |
| HIST-06 | Refresh the page | Conversations, folder assignments, and active conversation state remain stable. |

## Attachments

| ID | File | Prompt | Expected result |
| --- | --- | --- | --- |
| FILE-01 | Text PDF | `Przeanalizuj załączony plik i wyciągnij najważniejsze wnioski w kontekście mojego przedsiębiorstwa` | Extracts document text and cites the attachment. |
| FILE-02 | Scanned or difficult PDF | Same as above | Clearly reports OCR/extraction limitation and does not hallucinate contents. |
| FILE-03 | Empty or corrupt PDF | Same as above | Gives a precise file-read failure, not a generic refusal. |

## Global Pass Criteria

- No user-visible `Source ledger`, `cross_tenant`, `other_user_private`, `organization_data`, or similar internal policy labels in normal answers.
- No `No cited sources` when inline citations or source cards are present.
- No `rag_1`, `Source 1`, or raw `[1]` source labels shown as final user-facing source titles.
- No raw `artifact:comparison`, raw artifact JSON, or structured envelope leakage in chat bubbles.
- Product questions about DBR77/Consultify/Marketplace must prioritize approved DBR77 knowledge.
- Web search sources must be labeled as external research and cannot override product truth.
- Regular chat should be materially faster and simpler than Deep Thinking.

## Result Format

Each retest item must be marked:

- `PASS`
- `PASS with known limitation`
- `FAIL`

A staging release candidate cannot pass if any P0 item in history, citations/source trust, DBR77 product truth, raw artifact leakage, or text-PDF attachment analysis is marked `FAIL`.
