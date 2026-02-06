# AI Chat System — Changelog

> **Document:** AI_CHAT_CHANGELOG.md
> **Version:** 1.0
> **Created:** 2026-02-06
> **Status:** ACTIVE

Szczegółowy changelog zmian w systemie AI Chat. Dokumentuje wszystkie modyfikacje kodu, nowe serwisy, poprawki błędów i ulepszenia UX.

---

## 2026-02-06 — Wave 1b/2b/3b: Stabilizacja + nowe funkcje

### 🔴 CRITICAL FIX: Suggestions endpoint crash

**Problem:** Endpoint `/api/ai/suggestions` crashował w runtime — lazy-loader wrappery (`smartSuggestions.ts`, `proactiveSuggestionsService.ts`) wskazywały na nieistniejące pliki `.js`.

**Rozwiązanie:** Napisano pełne implementacje TypeScript:

| Serwis                        | Plik                                                    | Funkcja                                                                       |
| ----------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `SmartSuggestionsService`     | `server/src/services/ai/smartSuggestions.ts`            | Kontekstowe sugestie AI na podstawie zadań, decyzji, projektów. Cache 1min.   |
| `ProactiveSuggestionsService` | `server/src/services/ai/proactiveSuggestionsService.ts` | Proaktywne sugestie (deadlines, stale initiatives). Tracking akcji + metryki. |

**Metody:**

- `getCachedSuggestions(userId, projectId, options)` — cache, fallback
- `getSuggestions(userId, projectId, conversationContext)` — z kontekstem konwersacji
- `generateSuggestions(request)` — proaktywne na bazie stanu org
- `recordSuggestionAction(id, userId, action, feedback)` — tracking
- `getSuggestionMetrics(orgId, days)` — metryki akceptacji

---

### ✅ Chat Export (ChatExportModal)

**Problem:** Przyciski eksportu w modalu nie robiły nic — brak `onExport` handler.

**Rozwiązanie:**

- Dodano `handleExportFormat()` w `AIChatWelcomeView.tsx`
- Obsługiwane formaty: JSON (strukturyzowany), TXT (transcript), PDF (fallback do TXT)
- Utility `downloadFile()` generuje Blob i triggeruje pobranie
- Poprawiona literówka "Raw raw data" → "Raw data"

**Pliki:** `src/views/AIChatWelcomeView.tsx`, `src/components/AIChat/ChatExportModal.tsx`

---

### ✅ ResponseActions — bezpieczeństwo API

**Problem:** `ResponseActions.tsx` używał surowego `fetch()` z `localStorage.getItem('token')` dla akcji "execute" — niebezpieczne, bez retry, bez error handling.

**Rozwiązanie:**

- Zastąpiono `Api.executeAIAction()` (dla action endpoints) i `Api.genericPost()` (dla dynamicznych)
- Dodano `Api.genericPost(endpoint, data)` — authenticated POST przez standardowy `fetchWithRetry`

**Pliki:** `src/components/AIChat/ResponseActions.tsx`, `src/services/api.ts`

---

### ✅ MessageActions — Share & Bookmark

**Problem:** Przyciski Share i Bookmark w rozwijanym menu były stubami (kliknięcie = zamknięcie menu, brak akcji).

**Rozwiązanie:**

- **Share:** Web Share API (mobilne urządzenia) z fallbackiem na clipboard (desktop)
- **Bookmark:** Zapis do `localStorage` key `chat_bookmarks` z content, role, timestamp, savedAt

**Plik:** `src/components/AIChat/Messages/MessageActions.tsx`

---

### ✅ SmartSuggestions — kontekstowe podpowiedzi

**Problem:** Minimal variant miał 3 hardcoded sugestie ("Daily brief", "Plan the week", "Create a diagram") niezależnie od kontekstu.

**Rozwiązanie:** Podpowiedzi zależą od `workspaceType`:

| Workspace    | Suggestion 1                     | Suggestion 2       |
| ------------ | -------------------------------- | ------------------ |
| `assessment` | Analyze [name] / Assessment tips | Identify gaps      |
| `initiative` | Prioritize initiatives           | Risk analysis      |
| `roadmap`    | Review timeline                  | Check dependencies |
| `task`       | Plan the week                    | Unblock me         |
| `report`     | Summarize report                 | Executive summary  |
| _default_    | Plan the week                    | Create a diagram   |

**Props dodane:** `workspaceType?: string`, `entityName?: string`

**Pliki:** `src/components/AIChat/SmartSuggestions.tsx`, `src/views/AIChatWelcomeView.tsx`

---

### ✅ FocusMode selector — source count badge

**Problem:** Kompaktowy selektor nie pokazywał ile źródeł jest aktywnych.

**Rozwiązanie:** Dodano prop `activeSourceCount?: number` i wyświetlanie liczby przy ikonie gdy tryb ≠ "All".

**Plik:** `src/components/AIChat/Input/FocusModeSelector.tsx`

---

### ✅ Chat title auto-generation — stale closure fix

**Problem:** `handleStreamDone` w `AIChatWelcomeView` używał `activeConversationId` z closure `useCallback`. Gdy nowa konwersacja była tworzona w `handleSend`, `activeConversationId` mógł być nadal `null` w momencie wywołania `generateTitle`.

**Rozwiązanie:**

- Dodano `activeConversationIdRef = useRef(activeConversationId)`
- `useEffect` synchronizuje ref z aktualnym stanem
- `handleStreamDone` czyta z ref zamiast z closure
- Usunięto `activeConversationId` z dependency array `useCallback`

**Plik:** `src/views/AIChatWelcomeView.tsx`

---

### ✅ SSE auto-reconnect

**Problem:** Gdy stream się zrywał (network error), UI pokazywał błąd bez próby ponowienia.

**Rozwiązanie:**

- `retryCountRef` w `useAIStream` — max 1 auto-retry
- Delay 1.5s przed ponowieniem
- Skip retry dla błędów auth (`ACCESS_BLOCKED`, `Unauthorized`)
- Reset counter na początku każdego nowego streamu
- Zmienne `mergedContext` i `resolvedLanguage` przeniesione poza blok `try` (fix TS2304)

**Plik:** `src/hooks/useAIStream.ts`

---

### ✅ Conversation summary endpoint

**Endpoint:** `POST /api/conversations/:id/summarize`

**Parametry:** `{ keepRecent: number }` (default 10)

**Logika:**

1. Pobiera wszystkie wiadomości konwersacji
2. Jeśli ≤ keepRecent → skip
3. Dzieli na starsze (do podsumowania) i ostatnie (zachowane)
4. LLM generuje 3-5 bullet points podsumowania
5. Fallback bez LLM: ekstrakcja pierwszych 5 wiadomości użytkownika
6. Stare wiadomości oznaczane jako `message_type = 'condensed'`

**Response:** `{ summary, summaryMessageId, condensedCount, remainingCount }`

**Frontend:** `Api.summarizeConversation(conversationId, keepRecent)`

**Pliki:** `server/src/routes/conversations.routes.ts`, `src/services/api.ts`

---

### ✅ Adaptive response — feedback loop

**Problem:** Feedback od użytkownika (rating + length/detail/format) logowany do `aiLogger` ale nie trafiał do systemu adaptacyjnego.

**Rozwiązanie:** W endpoincie `POST /api/ai/feedback` dodano wywołanie `adaptiveResponseService.processFeedback()` z pełnym zestawem danych: userId, messageId, rating, lengthFeedback, detailFeedback, formatFeedback, responseLength, conversationId, screenContext, focusMode.

**Plik:** `server/src/routes/ai.routes.ts`

---

### ✅ Quota checking w AIPipeline

**Problem:** `checkQuota()` było pustym TODO.

**Rozwiązanie:**

- Integracja z `BudgetManagementService.checkBudgetLimit()`
- Sprawdzanie limitu tokenów (~500 est.) przed każdym requestem
- Rzuca `AI_BUDGET_EXHAUSTED` z `budgetStatus` metadata
- Fail-open: gdy serwis budżetowy niedostępny, request przechodzi

**Plik:** `server/src/services/ai/AIPipeline.ts`

---

### ✅ Internationalization (i18n)

**Zmiany:**

| Komponent                | Zmiana                                            | Klucze                    |
| ------------------------ | ------------------------------------------------- | ------------------------- |
| `InlineResponseFeedback` | Namespace `chat.feedback.*` → `aiChat.feedback.*` | 17 kluczy                 |
| `ChatOverlay`            | Hardcoded PL → `t()`                              | `aiChat.expandFullScreen` |
| Locales EN               | Dodane sekcje `aiChat.actions`, `aiChat.feedback` | 34 klucze                 |
| Locales PL               | Dodane sekcje `aiChat.actions`, `aiChat.feedback` | 34 klucze                 |
| Locales DE/ES/AR/JP      | Dodane `loadingConversation`, `contextBadge.*`    | 4 klucze × 4 locales      |

---

## 2026-02-05 — Wave 1/2/3: Fundament AI Chat

### Wave 1 — Stability + UX

- **ContextBadge** — nowy komponent transparentności kontekstu AI
- **Conversation continuity** — loading state eliminujący "flash to welcome screen"
- **ThinkingBlock w AIChatWelcomeView** — spójny 5-krokowy wskaźnik myślenia
- **ACCESS_BLOCKED** — fail-open, 500s z DB errors obsłużone

### Wave 2 — Context + Memory

- **AIContextBuilder cleanup** — parallel builds, context size cap (12k chars)
- **User memory** — preferencje, ekspertyza, język w system prompt
- **Organization memory** — terminologia, wzorce decyzji, etap AI maturity

### Wave 3 — Ops / Production

- **Voice health** (`GET /api/voice/health`) — STT/TTS status
- **Circuit breaker probes** — health checks OpenAI, Gemini, Anthropic
- **AI health dashboard** (`GET /api/ai/health-check/dashboard`) — skonsolidowany monitoring

---

## Architektura zmian

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                      │
│                                                          │
│  AIChatWelcomeView ──┬── ThinkingBlock                  │
│  UnifiedChatPanel  ──┤── ContextBadge                   │
│  ChatOverlay       ──┤── SmartSuggestions (kontekstowe)  │
│                      ├── InlineResponseFeedback (i18n)   │
│                      ├── ChatExportModal (wired)         │
│                      ├── MessageActions (Share/Bookmark)  │
│                      └── ResponseActions (Api service)    │
│                                                          │
│  useAIStream ────── auto-reconnect (1× retry, 1.5s)     │
│  api.ts ─────────── summarizeConversation, genericPost   │
├──────────────────────────────────────────────────────────┤
│                    BACKEND (Express)                      │
│                                                          │
│  AI Pipeline ────── quota checking (BudgetManagement)    │
│                ├── user memory (aiMemoryService)          │
│                └── org memory (aiMemoryService)           │
│                                                          │
│  AIContextBuilder ── parallel builds, 12k cap            │
│  adaptiveResponse ── feedback loop (processFeedback)     │
│  circuitBreaker ──── health checks (3 providers)         │
│                                                          │
│  NEW SERVICES:                                           │
│  smartSuggestions ── kontekstowe sugestie + cache         │
│  proactiveSuggestions ── proaktywne + metryki             │
│                                                          │
│  NEW ENDPOINTS:                                          │
│  POST /conversations/:id/summarize                       │
│  GET  /api/voice/health                                  │
│  GET  /api/ai/health-check/dashboard                     │
└──────────────────────────────────────────────────────────┘
```

---

## Status weryfikacji

| Check                    | Status                                                |
| ------------------------ | ----------------------------------------------------- |
| `tsc --noEmit`           | ✅ 0 nowych błędów (1 pre-existing: WebhooksSettings) |
| `eslint` (changed files) | ✅ 0 errors, warnings only (pre-existing)             |
| i18n keys                | ✅ Dodane do en, pl, de, es, ar, jp                   |
| Runtime crashes          | ✅ `/api/ai/suggestions` naprawiony                   |
| Stale closures           | ✅ `activeConversationIdRef` fix                      |
