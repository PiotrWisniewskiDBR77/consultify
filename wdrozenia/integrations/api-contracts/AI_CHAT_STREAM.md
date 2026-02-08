# API Contract: AI Chat Stream (`/api/ai/chat/stream`)

## Cel

Utrzymać spójny, **jawnie walidowany** kontrakt dla streamingu odpowiedzi AI (SSE) oraz zapewnić, że przełączniki UI (Tools, Tier, Model) **realnie docierają do backendu**.

## Endpoint

- **Method**: `POST`
- **Path**: `/api/ai/chat/stream`
- **Auth**: JWT Bearer (`Authorization: Bearer <token>`)
- **Response**: `text/event-stream` (SSE)

## Request Body (JSON)

### Wymagane

- **`message`**: `string` – treść wiadomości użytkownika

### Opcjonalne (historia + instrukcje)

- **`history`**: `Array<{ role: 'user'|'assistant'|'model', content?: string, parts?: [{text: string}] }>`
- **`systemInstruction`**: `string`
- **`roleName`**: `string`
- **`language`**: `string` (np. `pl`, `en`, `de`, `es`, `ja`, `ar`; locale typu `pl-PL` jest akceptowane i normalizowane)
- **`conversationId`**: `string`
- **`resumeFromPartial`**: `boolean`

### Opcjonalne (kontekst UI)

Uwaga: pola top‑level są jawnie whitelistowane w walidatorze, ponieważ middleware walidacji zastępuje `req.body` sparsowanymi danymi.

- **`projectId`**: `uuid`
- **`screenContext`**: `Record<string, any>`
- **`focusMode`**: `string`
- **`context`**: `Record<string, any>` (dodatkowy kontekst aplikacyjny)

### Opcjonalne (ToolsMenu)

- **`aiModes`**: `{ deepResearch?: boolean, webSearch?: boolean, showReasoning?: boolean }`
- **`knowledgeSources`**: `{ pmoDocuments?: boolean, projectData?: boolean, organizationData?: boolean }`
- **`responseStyle`**: `'normal' | 'learning' | 'concise' | 'explanatory' | 'formal'`

### Opcjonalne (routing modeli)

- **`selectedTier`**: `'BUDGET' | 'STANDARD' | 'PREMIUM' | 'REASONING'`
- **`selectedModelId`**: `string | null`

## Response (SSE)

### Chunk text

- `data: {"text":"..."}`

### Thought / progress

- `data: {"type":"thought", ...payload}`

### Zakończenie

- `data: [DONE]`

## Implementacja referencyjna

- **Walidacja**: `server/src/validators/ai.validators.ts` (`ChatStreamRequestSchema`)
- **Route**: `server/src/routes/ai.routes.ts` (`POST /chat/stream`)
- **Pipeline + routing**: `server/src/services/ai/AIPipeline.ts` (wybór modelu przez `server/src/services/ai/modelRouter.ts`)
