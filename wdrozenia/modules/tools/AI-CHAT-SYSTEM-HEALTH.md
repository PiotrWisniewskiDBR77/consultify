# AI Chat System - Raport Sprawności (L6)

## Przegląd

Dokument opisuje stan wszystkich podsystemów AI Chat w aplikacji Consultify.
Data ostatniej aktualizacji: 2026-02-04
Wersja testów: 3.0.0 (75 testów w 17 poziomach)

## Podsumowanie Stanu

### Podstawowe Podsystemy (L6.1-L6.8)

| Podsystem | Status | Testy | Priorytet |
|-----------|--------|-------|-----------|
| L6.1 Cloud Integrations | DEMO MODE | 2 | Średni |
| L6.2 Tools Menu | ✅ HEALTHY | 3 | - |
| L6.3 Chat Conversation | ✅ HEALTHY | 3 | - |
| L6.4 Voice System | ✅ HEALTHY | 3 | - |
| L6.5 History Management | ✅ HEALTHY | 3 | - |
| L6.6 LLM Management | ✅ HEALTHY | 3 | - |
| L6.7 End-to-End Flow | ✅ HEALTHY | 2 | - |
| L6.8 Health Summary | ✅ HEALTHY | 3 | - |

### Zaawansowane Podsystemy (L6.9-L6.17)

| Podsystem | Status | Testy | Priorytet |
|-----------|--------|-------|-----------|
| L6.9 Vector DB / Embeddings | ✅ SPECIFIED | 5 | Wysoki |
| L6.10 AI Memory System | ✅ SPECIFIED | 5 | Wysoki |
| L6.11 AI Learning System | ✅ SPECIFIED | 6 | Wysoki |
| L6.12 User Style Profiles | ✅ SPECIFIED | 4 | Średni |
| L6.13 Context Builder (RAG) | ✅ SPECIFIED | 4 | Średni |
| L6.14 AI Database Tables | ✅ SPECIFIED | 7 | Wysoki |
| L6.15 AI Pipeline & Streaming | ✅ SPECIFIED | 7 | Wysoki |
| L6.16 AI Admin Management | ✅ SPECIFIED | 6 | Średni |
| L6.17 AI Quality & Observability | ✅ SPECIFIED | 7 | Niski |
| L6.18 Complete System Summary | ✅ SPECIFIED | 2 | - |

**Ogólny status: OPERATIONAL**
- Podstawowe podsystemy: 7/8 sprawnych (1 demo mode)
- Zaawansowane podsystemy: 9/9 wyspecyfikowanych
- Łączna liczba testów: 75

---

## 1. System Podłączania Danych z Chmury

### Status: DEMO MODE

### Opis
Integracje z Google Drive, OneDrive i Dropbox są obecnie w trybie demonstracyjnym.
UI wyświetla przykładowe pliki, ale rzeczywiste połączenie z chmurami nie jest zaimplementowane.

### Pliki źródłowe
- `src/components/AIChat/CloudFilePicker.tsx` - picker plików (demo data)
- `src/hooks/useCloudIntegrations.ts` - hook z flagą `isImplemented: false`
- `src/components/AIChat/AddFilesMenu.tsx` - menu dodawania plików

### Co działa
- UI pickera plików
- Nawigacja po folderach (demo)
- Wyszukiwanie plików (demo)
- Ikony typów plików

### Co nie działa
- OAuth flow dla providerów
- Rzeczywiste pobieranie plików z chmury
- Synchronizacja z chmurą

### Wymagane prace
1. Implementacja OAuth 2.0 dla Google Drive
2. Implementacja OAuth 2.0 dla Microsoft Graph (OneDrive)
3. Implementacja OAuth 2.0 dla Dropbox
4. Backend endpoints: `GET /api/cloud/list-files`, `POST /api/cloud/download`
5. Obsługa tokenów refresh

### Komunikat w UI
W `CloudFilePicker.tsx` dodano banner informujący o trybie demo.

---

## 2. Menu Narzędzi (Tools Menu)

### Status: HEALTHY

### Opis
Menu narzędzi AI jest w pełni funkcjonalne i oferuje:

### Tryby AI
- **Głęboka analiza** (`deepResearch`) - dogłębne badanie tematu
- **Wyszukiwanie web** (`webSearch`) - dane w czasie rzeczywistym
- **Pokaż rozumowanie** (`showReasoning`) - widoczny tok myślenia AI
- **Czytaj odpowiedzi** (`textToSpeech`) - automatyczne czytanie na głos

### Źródła wiedzy
- **Dokumenty PMO** (`pmoDocuments`) - ISO 21500, PMBOK, PRINCE2
- **Dane projektu** (`projectData`) - inicjatywy, zadania, decyzje
- **Dane organizacji** (`organizationData`) - zespoły, role, procesy

### Style odpowiedzi
- Normalny, Edukacyjny, Zwięzły, Wyjaśniający, Formalny

### Ustawienia TTS
- Szybkość (0.5x - 2x)
- Wybór głosu
- Przycisk testowy

### Pliki źródłowe
- `src/components/AIChat/ToolsMenu.tsx`
- `src/store/useAppStore.ts` (aiConfig)

---

## 3. System Rozmowy (Chat)

### Status: HEALTHY

### Opis
Główny system czatu jest w pełni funkcjonalny.

### Funkcje
- Tworzenie konwersacji
- Wysyłanie wiadomości z streamingiem
- Zapisywanie historii do bazy danych
- Obsługa artefaktów (kod, tabele)
- Thinking steps (widoczne rozumowanie)
- Feedback na odpowiedzi AI
- Markdown rendering

### Pliki źródłowe
- `src/components/AIChat/UnifiedChatPanel.tsx` - główny komponent
- `src/hooks/useAIStream.ts` - streaming odpowiedzi
- `server/src/routes/conversations.routes.ts` - backend API

### API Endpoints
```
POST   /api/conversations              - Utwórz konwersację
GET    /api/conversations              - Lista konwersacji
GET    /api/conversations/:id          - Pobierz z wiadomościami
PATCH  /api/conversations/:id          - Aktualizuj metadane
DELETE /api/conversations/:id          - Usuń
POST   /api/conversations/:id/messages - Dodaj wiadomość
```

---

## 4. System Głosowy

### Status: HEALTHY

### Opis
System głosowy obsługuje zarówno wejście (STT) jak i wyjście (TTS).

### Speech-to-Text (STT)
- **Główny provider**: Whisper API (OpenAI)
- **Fallback**: Web Speech API (przeglądarka)
- Tryby: push-to-talk, click-to-talk
- Voice Activity Detection (VAD)
- Monitoring poziomu audio

### Text-to-Speech (TTS)
- **Główny provider**: OpenAI TTS
- **Fallback**: Web Speech Synthesis
- Auto-read odpowiedzi AI (toggle)
- Wybór głosu i szybkości
- Przycisk "Speak" przy wiadomościach

### Pliki źródłowe
- `src/hooks/useUniversalVoice.ts` - główny hook (670 linii)
- `server/src/routes/voice.routes.ts` - backend API
- `server/src/services/ai/VoiceService.ts` - serwis

### API Endpoints
```
POST /api/voice/stt     - Transkrypcja audio
POST /api/voice/tts     - Synteza mowy
GET  /api/voice/voices  - Lista głosów
GET  /api/voice/health  - Health check
```

---

## 5. Zarządzanie Historią Czatów

### Status: HEALTHY

### Opis
System historii konwersacji jest w pełni funkcjonalny.

### Funkcje
- Tworzenie nowych czatów
- Zapisywanie do bazy danych
- Grupowanie: Pinned, Today, Yesterday, This Week, Last Month, Older, Archived
- Foldery (Chat Projects)
- Wyszukiwanie
- Archiwizacja i usuwanie
- Bulk operations

### Tytuły konwersacji
- **Auto-generowanie**: Po pierwszej wymianie wiadomości
- **Edycja ręczna**: Via PATCH z `titleSource: 'user'`
- **Przenoszenie**: Via `chatProjectId`

### Pliki źródłowe
- `src/components/AIChat/ChatHistorySidebar.tsx`
- `src/store/useConversationStore.ts`
- `src/store/useChatProjectStore.ts`
- `server/src/routes/conversations.routes.ts`

### API Endpoints
```
POST   /api/conversations/:id/title/generate - Auto-tytuł
POST   /api/conversations/bulk               - Bulk operations
POST   /api/conversations/migrate            - Migracja z localStorage
```

---

## 6. Zarządzanie LLM

### Status: HEALTHY

### Opis
System zarządzania modelami LLM z hierarchią konfiguracji.

### Hierarchia konfiguracji

1. **SUPERADMIN Level**
   - Zarządzanie providerami (`/api/llm/providers`)
   - Tier assignments (`/api/llm/tiers/assignments`)
   - Health monitoring (`/api/llm/health/*`)

2. **ADMIN Level**
   - Konfiguracja organizacji (`/api/organizations/:id/llm-config`)
   - Wybór domyślnego providera

3. **User Settings**
   - Własne klucze API (OpenAI, Gemini)
   - Lokalne Ollama
   - Przechowywane w localStorage

4. **Tier-based Routing**
   - BUDGET - proste pytania, szybkie odpowiedzi
   - STANDARD - większość zadań
   - PREMIUM - złożone analizy, raporty
   - REASONING - MAX Mode, głębokie myślenie

### Pliki źródłowe
- `src/components/LLMSelector.tsx` - UI wyboru tier
- `views/settings/AIConfigSettings.tsx` - ustawienia
- `server/src/routes/llm.routes.ts` - backend API
- `server/src/controllers/ai/LLMController.ts`

### API Endpoints
```
GET  /api/llm/providers              - Lista providerów
GET  /api/llm/providers/recommended  - Rekomendacja dla tier
GET  /api/llm/tiers/assignments      - Przypisania tier
POST /api/llm/tiers/assign           - Przypisz do tier
GET  /api/llm/health                 - Health status
```

---

## 7. Vector Database / Embeddings

### Status: TO TEST

### Opis
System wektorowej bazy danych do semantic search i RAG (Retrieval Augmented Generation).

### Funkcje
- Generowanie embeddingów (OpenAI text-embedding-3-small)
- Przechowywanie w SQLite (JSON) lub PostgreSQL (pgvector)
- Semantic search z cosine similarity
- Indeksowanie dokumentów projektu i organizacji

### Pliki źródłowe
- `server/src/services/ai/embeddingService.ts` - główny serwis
- `server/tests/unit/backend/services/EmbeddingService.test.ts` - testy jednostkowe

### Tabele bazy danych
- `ai_knowledge_embeddings` - embeddingi dokumentów

### API Endpoints (do implementacji)
```
GET  /api/ai/embeddings/health  - Health check
POST /api/ai/embeddings/generate - Generuj embedding
POST /api/ai/embeddings/search   - Semantic search
GET  /api/ai/embeddings/stats    - Statystyki
```

---

## 8. AI Memory System

### Status: TO TEST

### Opis
Trójwarstwowy system pamięci AI dla personalizacji i kontekstu.

### Warstwy pamięci

1. **User Memory** (`ai_user_memory`)
   - Preferencje użytkownika (język, styl, szczegółowość)
   - Ekspertyza i obszary zainteresowań
   - Historia interakcji
   - Przypisane projekty

2. **Organization Memory** (`organization_memory`)
   - Wzorce sukcesu i porażek
   - Best practices organizacji
   - Lessons learned
   - Benchmarki i standardy
   - Terminologia branżowa

3. **Project Memory** (`project_memory`)
   - Kontekst projektu
   - Decyzje i ich uzasadnienia
   - Kluczowe osoby i role

### Pliki źródłowe
- `server/src/services/ai/aiMemoryService.ts` - pamięć użytkownika
- `server/src/services/ai/organizationMemoryStore.ts` - pamięć organizacji
- `server/src/services/ai/projectMemoryStore.ts` - pamięć projektu

### API Endpoints
```
GET  /api/ai/memory/user/:userId           - Pobierz pamięć użytkownika
PUT  /api/ai/memory/user/:userId           - Aktualizuj pamięć
GET  /api/ai/memory/organization/:orgId    - Pobierz pamięć organizacji
POST /api/ai/memory/organization/:orgId/patterns - Dodaj wzorzec
GET  /api/ai/memory/project/:projectId     - Pobierz pamięć projektu
POST /api/ai/memory/search                 - Semantic search w pamięci
```

---

## 9. AI Learning System

### Status: TO TEST

### Opis
System uczenia się AI na podstawie feedbacku i interakcji.

### Komponenty

1. **Feedback Collection**
   - Like/Dislike na odpowiedzi
   - Korekty użytkownika
   - Sugestie ulepszeń

2. **Pattern Learning**
   - Automatyczne wykrywanie wzorców
   - Confidence scoring
   - Kategoryzacja wzorców

3. **Quality Metrics**
   - Accuracy score
   - Helpfulness score
   - Relevance score
   - Trend analysis

4. **Instruction Suggestions**
   - Automatyczne sugestie ulepszeń promptów
   - Review workflow dla adminów

### Pliki źródłowe
- `server/src/services/ai/aiLearningService.ts` - główny serwis uczenia
- `server/src/services/ai/adaptiveResponseService.ts` - adaptacja odpowiedzi
- `server/src/services/ai/userStyleProfileService.ts` - profile stylów

### Tabele bazy danych
- `ai_feedback` - feedback użytkowników
- `ai_learning_patterns` - wykryte wzorce
- `ai_instruction_suggestions` - sugestie ulepszeń
- `ai_style_learning_patterns` - wzorce stylów

### API Endpoints
```
POST /api/ai/learning/feedback              - Prześlij feedback
GET  /api/ai/learning/feedback/pending      - Feedback do review
POST /api/ai/learning/feedback/:id/review   - Review feedback
GET  /api/ai/learning/patterns              - Lista wzorców
GET  /api/ai/learning/quality-metrics       - Metryki jakości
GET  /api/ai/learning/suggestions           - Sugestie ulepszeń
POST /api/ai/learning/batch                 - Batch learning
```

---

## 10. User Style Profiles

### Status: TO TEST

### Opis
System automatycznego wykrywania i stosowania preferencji stylu użytkownika.

### Preferencje
- **Preferred Depth**: executive_summary | balanced | deep_dive
- **Preferred Format**: bullets | paragraphs | structured | conversational
- **Technical Level**: beginner | intermediate | expert
- **Response Length**: concise | medium | comprehensive

### Auto-detection
- Analiza interakcji użytkownika
- Wykrywanie wzorców pytań
- Peak activity hours
- Preferowane tryby focus

### Pliki źródłowe
- `server/src/services/ai/userStyleProfileService.ts`
- `server/src/services/ai/adaptiveResponseService.ts`

### API Endpoints
```
GET  /api/ai/profile/:userId           - Pobierz profil
PUT  /api/ai/profile/:userId           - Aktualizuj profil
POST /api/ai/profile/:userId/detect    - Wykryj preferencje
GET  /api/ai/profile/:userId/patterns  - Wykryte wzorce
```

---

## 11. Context Builder

### Status: TO TEST

### Opis
System budowania kontekstu dla zapytań AI.

### Źródła kontekstu
- Dane projektu (inicjatywy, zadania, decyzje)
- Dane organizacji (zespoły, role, procesy)
- Pamięć AI (user, org, project)
- Embeddingi dokumentów (RAG)
- Historia konwersacji

### Pliki źródłowe
- `server/src/services/ai/enhancedContextBuilder.ts`
- `server/src/services/ai/contextResponseMapper.ts`

### API Endpoints
```
GET  /api/ai/context/health              - Health check
POST /api/ai/context/build               - Zbuduj kontekst
GET  /api/ai/context/project/:projectId  - Kontekst projektu
GET  /api/ai/context/organization/:orgId - Kontekst organizacji
```

---

## Testy Automatyczne (L6) - Pełna Specyfikacja

### Lokalizacja
`tests/e2e/ai-system-health.spec.ts`

### Zakres testów - 17 poziomów

| Test Suite | Opis | Priorytet | Status |
|------------|------|-----------|--------|
| **L6.1** | Cloud Integrations - sprawdzenie statusu demo | Średni | ✅ Implemented |
| **L6.2** | Tools Menu - toggle trybów i źródeł | Średni | ✅ Implemented |
| **L6.3** | Chat Conversation - wysyłanie wiadomości | Wysoki | ✅ Implemented |
| **L6.4** | Voice System - przyciski i API health | Średni | ✅ Implemented |
| **L6.5** | History Management - CRUD operations | Wysoki | ✅ Implemented |
| **L6.6** | LLM Management - tier selector i API | Wysoki | ✅ Implemented |
| **L6.7** | End-to-End Flow - pełna rozmowa | Wysoki | ✅ Implemented |
| **L6.8** | Health Summary Report - zbiorczy raport | Średni | ✅ Implemented |
| **L6.9** | Vector DB / Embeddings - semantic search | Wysoki | 🔲 TODO |
| **L6.10** | AI Memory System - user/org/project memory | Wysoki | 🔲 TODO |
| **L6.11** | AI Learning - feedback i pattern learning | Wysoki | 🔲 TODO |
| **L6.12** | User Style Profiles - auto-detection | Średni | 🔲 TODO |
| **L6.13** | Context Builder - RAG pipeline | Średni | 🔲 TODO |
| **L6.14** | AI Database Tables - schema validation | Wysoki | 🔲 TODO |
| **L6.15** | AI Pipeline & Streaming - flow health | Wysoki | 🔲 TODO |
| **L6.16** | AI Admin Management - SuperAdmin/Admin UI | Średni | 🔲 TODO |
| **L6.17** | AI Quality & Observability - metrics | Niski | 🔲 TODO |

---

## L6.9: Vector DB / Embeddings - Specyfikacja

### Cel
Weryfikacja działania systemu embeddingów i semantic search.

### Testy

```typescript
test.describe('L6.9: Vector Database & Embeddings', () => {
  test('should check embeddings API health', async ({ request }) => {
    // GET /api/ai/embeddings/health
    // Expected: { status: 'healthy', model: 'text-embedding-3-small', dimensions: 1536 }
  });

  test('should verify embedding generation works', async ({ request }) => {
    // POST /api/ai/embeddings/generate
    // Body: { text: 'Test embedding generation' }
    // Expected: { embedding: number[], dimensions: 1536 }
  });

  test('should verify vector search functionality', async ({ request }) => {
    // POST /api/ai/embeddings/search
    // Body: { query: 'project management', limit: 5 }
    // Expected: { results: [...], similarity_scores: [...] }
  });

  test('should check ai_knowledge_embeddings table exists', async ({ request }) => {
    // GET /api/ai/health-check/subsystem/embeddings
    // Expected: { tableExists: true, rowCount: number }
  });

  test('should verify pgvector extension if PostgreSQL', async ({ request }) => {
    // GET /api/ai/embeddings/pgvector-status
    // Expected: { installed: true/false, version: string }
  });

  test('should check embedding index performance', async ({ request }) => {
    // GET /api/ai/embeddings/stats
    // Expected: { totalEmbeddings: number, avgSearchTime: number }
  });
});
```

### Pliki źródłowe do testowania
- `server/src/services/ai/embeddingService.ts`

### API Endpoints wymagane
| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/ai/embeddings/health` | GET | Health check |
| `/api/ai/embeddings/generate` | POST | Generuj embedding |
| `/api/ai/embeddings/search` | POST | Semantic search |
| `/api/ai/embeddings/stats` | GET | Statystyki |

---

## L6.10: AI Memory System - Specyfikacja

### Cel
Weryfikacja trójwarstwowego systemu pamięci AI.

### Testy

```typescript
test.describe('L6.10: AI Memory System', () => {
  // User Memory
  test('should check user memory API health', async ({ request }) => {
    // GET /api/ai/memory/health
  });

  test('should get user memory', async ({ request }) => {
    // GET /api/ai/memory/user/:userId
    // Expected: { preferences, expertise, recentTopics, interactionCount }
  });

  test('should update user memory after interaction', async ({ request }) => {
    // POST /api/ai/memory/user/:userId/interaction
    // Body: { topic: 'project planning', messageCount: 1 }
  });

  // Organization Memory
  test('should get organization memory', async ({ request }) => {
    // GET /api/ai/memory/organization/:orgId
    // Expected: { industry, companySize, terminology, decisionPatterns }
  });

  test('should add organization pattern', async ({ request }) => {
    // POST /api/ai/memory/organization/:orgId/patterns
    // Body: { type: 'SUCCESS_PATTERN', title: '...', description: '...' }
  });

  test('should search organization patterns', async ({ request }) => {
    // POST /api/ai/memory/organization/:orgId/search
    // Body: { query: 'successful implementation', limit: 5 }
  });

  // Project Memory
  test('should get project memory', async ({ request }) => {
    // GET /api/ai/memory/project/:projectId
  });

  // Cross-memory search
  test('should perform semantic memory search', async ({ request }) => {
    // POST /api/ai/memory/search
    // Body: { query: '...', scopes: ['user', 'org', 'project'] }
  });

  // Tables verification
  test('should verify ai_user_memory table exists', async ({ request }) => {
    // Check table structure
  });

  test('should verify organization_memory table exists', async ({ request }) => {
    // Check table structure
  });
});
```

### Pliki źródłowe do testowania
- `server/src/services/ai/aiMemoryService.ts`
- `server/src/services/ai/organizationMemoryStore.ts`
- `server/src/services/ai/projectMemoryStore.ts`

---

## L6.11: AI Learning System - Specyfikacja

### Cel
Weryfikacja systemu uczenia się AI na podstawie feedbacku.

### Testy

```typescript
test.describe('L6.11: AI Learning System', () => {
  // Feedback Collection
  test('should submit feedback', async ({ request }) => {
    // POST /api/ai/learning/feedback
    // Body: { userId, messageId, feedbackType: 'like', rating: 5 }
  });

  test('should get pending feedback for review', async ({ request }) => {
    // GET /api/ai/learning/feedback/pending?orgId=xxx
  });

  test('should review feedback', async ({ request }) => {
    // POST /api/ai/learning/feedback/:id/review
    // Body: { reviewerId, action: 'approve' }
  });

  // Pattern Learning
  test('should get learning patterns', async ({ request }) => {
    // GET /api/ai/learning/patterns?type=SUCCESS_PATTERN
  });

  test('should record new pattern', async ({ request }) => {
    // POST /api/ai/learning/patterns
    // Body: { patternType, patternData, confidenceScore }
  });

  // Quality Metrics
  test('should get quality metrics', async ({ request }) => {
    // GET /api/ai/learning/quality-metrics
    // Expected: { overallScore, accuracyScore, trend }
  });

  // Instruction Suggestions
  test('should get instruction suggestions', async ({ request }) => {
    // GET /api/ai/learning/suggestions
  });

  test('should review instruction suggestion', async ({ request }) => {
    // POST /api/ai/learning/suggestions/:id/review
  });

  // Batch Learning
  test('should run batch learning', async ({ request }) => {
    // POST /api/ai/learning/batch
    // Expected: { usersProcessed, patternsFound, suggestionsApplied }
  });

  // Tables verification
  test('should verify ai_feedback table exists', async ({ request }) => {
    // Check table structure
  });

  test('should verify ai_learning_patterns table exists', async ({ request }) => {
    // Check table structure
  });
});
```

### Pliki źródłowe do testowania
- `server/src/services/ai/aiLearningService.ts`

---

## L6.12: User Style Profiles - Specyfikacja

### Cel
Weryfikacja automatycznego wykrywania i stosowania preferencji stylu.

### Testy

```typescript
test.describe('L6.12: User Style Profiles', () => {
  test('should get user style profile', async ({ request }) => {
    // GET /api/ai/profile/:userId
    // Expected: { preferredDepth, preferredFormat, technicalLevel, responseLength }
  });

  test('should update user style profile', async ({ request }) => {
    // PUT /api/ai/profile/:userId
    // Body: { preferredDepth: 'deep_dive', technicalLevel: 'expert' }
  });

  test('should detect user preferences from interactions', async ({ request }) => {
    // POST /api/ai/profile/:userId/detect
    // Expected: { detectedPatterns: [...], suggestions: [...] }
  });

  test('should get learned style patterns', async ({ request }) => {
    // GET /api/ai/profile/:userId/patterns
    // Expected: { patterns: [...], confidenceScores: [...] }
  });

  test('should apply profile suggestions', async ({ request }) => {
    // POST /api/ai/profile/:userId/apply-suggestions
  });

  test('should record interaction for learning', async ({ request }) => {
    // POST /api/ai/profile/:userId/interaction
    // Body: { screenContext, focusMode, questionType, responseLength }
  });

  test('should process feedback for style learning', async ({ request }) => {
    // POST /api/ai/profile/:userId/feedback
    // Body: { rating, lengthFeedback, detailFeedback, formatFeedback }
  });

  // Adaptive Response
  test('should get adaptive response config', async ({ request }) => {
    // GET /api/ai/adaptive/:userId/config
    // Expected: { format, length, depth, tone }
  });

  test('should build adaptive system prompt', async ({ request }) => {
    // POST /api/ai/adaptive/:userId/prompt
    // Body: { basePrompt, context }
  });

  // Tables verification
  test('should verify ai_user_style_profiles table exists', async ({ request }) => {
    // Check table structure
  });

  test('should verify ai_style_learning_patterns table exists', async ({ request }) => {
    // Check table structure
  });
});
```

### Pliki źródłowe do testowania
- `server/src/services/ai/userStyleProfileService.ts`
- `server/src/services/ai/adaptiveResponseService.ts`

---

## L6.13: Context Builder - Specyfikacja

### Cel
Weryfikacja systemu budowania kontekstu dla AI (RAG pipeline).

### Testy

```typescript
test.describe('L6.13: Context Builder', () => {
  test('should check context builder health', async ({ request }) => {
    // GET /api/ai/context/health
  });

  test('should build project context', async ({ request }) => {
    // POST /api/ai/context/build
    // Body: { projectId, includeInitiatives: true, includeTasks: true }
    // Expected: { context: string, sources: [...], tokenCount: number }
  });

  test('should get project context', async ({ request }) => {
    // GET /api/ai/context/project/:projectId
    // Expected: { initiatives, tasks, decisions, team }
  });

  test('should get organization context', async ({ request }) => {
    // GET /api/ai/context/organization/:orgId
    // Expected: { industry, terminology, patterns, standards }
  });

  test('should enrich context with embeddings', async ({ request }) => {
    // POST /api/ai/context/enrich
    // Body: { query, context, topK: 5 }
    // Expected: { enrichedContext, relevantDocuments }
  });

  test('should map context to response format', async ({ request }) => {
    // POST /api/ai/context/map-response
    // Body: { screenContext, userProfile }
    // Expected: { format, length, depth, tone }
  });

  // RAG Pipeline
  test('should check RAG pipeline health', async ({ request }) => {
    // GET /api/ai/rag/health
    // Expected: { embeddingsAvailable, indexHealthy, lastIndexed }
  });

  test('should perform RAG query', async ({ request }) => {
    // POST /api/ai/rag/query
    // Body: { query, projectId, topK: 5 }
    // Expected: { documents, scores, context }
  });
});
```

### Pliki źródłowe do testowania
- `server/src/services/ai/enhancedContextBuilder.ts`
- `server/src/services/ai/contextResponseMapper.ts`

---

## L6.14: AI Database Tables - Specyfikacja

### Cel
Weryfikacja istnienia i struktury wszystkich tabel AI.

### Testy

```typescript
test.describe('L6.14: AI Database Tables', () => {
  // Core Chat Tables
  test('should verify conversations table exists', async ({ request }) => {
    // Check: id, user_id, organization_id, title, created_at, updated_at
  });

  test('should verify conversation_messages table exists', async ({ request }) => {
    // Check: id, conversation_id, role, content, created_at
  });

  // Embedding Tables
  test('should verify ai_knowledge_embeddings table exists', async ({ request }) => {
    // Check: id, document_id, chunk_text, embedding, metadata
  });

  // Memory Tables
  test('should verify ai_user_memory table exists', async ({ request }) => {
    // Check: id, user_id, preferences, expertise, recent_topics
  });

  test('should verify organization_memory table exists', async ({ request }) => {
    // Check: id, organization_id, memory_type, content, embedding
  });

  // Learning Tables
  test('should verify ai_feedback table exists', async ({ request }) => {
    // Check: id, user_id, feedback_type, rating, comment
  });

  test('should verify ai_learning_patterns table exists', async ({ request }) => {
    // Check: id, pattern_type, pattern_data, confidence_score
  });

  test('should verify ai_instruction_suggestions table exists', async ({ request }) => {
    // Check: id, suggested_instruction, status, confidence_score
  });

  // Style Tables
  test('should verify ai_user_style_profiles table exists', async ({ request }) => {
    // Check: id, user_id, preferred_depth, preferred_format
  });

  test('should verify ai_style_learning_patterns table exists', async ({ request }) => {
    // Check: id, user_id, pattern_type, pattern_value
  });

  // LLM Tables
  test('should verify llm_providers table exists', async ({ request }) => {
    // Check: id, name, api_key_env, is_active, tier
  });

  // Database Health
  test('should check database connection pool health', async ({ request }) => {
    // GET /api/system/database/health
    // Expected: { connected, poolSize, activeConnections }
  });

  test('should verify migrations are up to date', async ({ request }) => {
    // GET /api/system/database/migrations
    // Expected: { pending: 0, applied: [...] }
  });
});
```

---

## L6.15: AI Pipeline & Streaming - Specyfikacja

### Cel
Weryfikacja głównego pipeline'u AI i streamingu odpowiedzi.

### Testy

```typescript
test.describe('L6.15: AI Pipeline & Streaming', () => {
  test('should check AI pipeline health', async ({ request }) => {
    // GET /api/ai/pipeline/health
    // Expected: { status, components: { llm, memory, context, streaming } }
  });

  test('should verify streaming endpoint works', async ({ request }) => {
    // POST /api/ai/chat/stream
    // Body: { message: 'Hello', conversationId }
    // Expected: SSE stream with chunks
  });

  test('should check rate limiter status', async ({ request }) => {
    // GET /api/ai/rate-limit/status
    // Expected: { remaining, limit, resetAt }
  });

  test('should verify circuit breaker status', async ({ request }) => {
    // GET /api/ai/circuit-breaker/status
    // Expected: { state: 'closed'|'open'|'half-open', failures, lastFailure }
  });

  test('should check model router health', async ({ request }) => {
    // GET /api/ai/model-router/health
    // Expected: { availableModels, defaultModel, tierMappings }
  });

  test('should verify tier routing works correctly', async ({ request }) => {
    // POST /api/ai/route
    // Body: { tier: 'PREMIUM', taskType: 'analysis' }
    // Expected: { provider, model, estimatedCost }
  });

  test('should check quota service status', async ({ request }) => {
    // GET /api/ai/quota/status
    // Expected: { used, limit, resetAt, tier }
  });

  // Observability
  test('should get AI metrics', async ({ request }) => {
    // GET /api/ai/metrics
    // Expected: { requestCount, avgLatency, errorRate, tokenUsage }
  });

  test('should check AI logging is working', async ({ request }) => {
    // GET /api/ai/logs/recent?limit=10
  });
});
```

### Pliki źródłowe do testowania
- `server/src/services/ai/AIPipeline.ts`
- `server/src/services/ai/modelRouter.ts`
- `server/src/services/ai/rateLimiter.ts`
- `server/src/services/ai/circuitBreaker.ts`
- `server/src/services/ai/quotaService.ts`

---

## L6.16: AI Admin Management - Specyfikacja

### Cel
Weryfikacja UI zarządzania AI dla SuperAdmin i Admin.

### Testy

```typescript
test.describe('L6.16: AI Admin Management', () => {
  // SuperAdmin Level
  test('should access SuperAdmin AI settings page', async ({ page }) => {
    // Navigate to /superadmin/ai-settings
    // Check: Provider management, Tier configuration, Health monitoring
  });

  test('should display LLM provider management', async ({ page }) => {
    // Check: List of providers, Add/Edit/Delete buttons
    // Verify: Provider status indicators
  });

  test('should display tier configuration', async ({ page }) => {
    // Check: BUDGET, STANDARD, PREMIUM, REASONING tiers
    // Verify: Model assignments per tier
  });

  test('should display AI usage statistics', async ({ page }) => {
    // Check: Request counts, Token usage, Cost breakdown
  });

  test('should display AI cost tracking', async ({ page }) => {
    // Check: Daily/Monthly costs, Per-provider breakdown
  });

  test('should manage AI health alerts', async ({ page }) => {
    // Check: Alert configuration, Notification settings
  });

  // Admin Level
  test('should access Admin AI settings', async ({ page }) => {
    // Navigate to /admin/ai-settings
    // Check: Organization-level configuration
  });

  test('should configure organization AI settings', async ({ page }) => {
    // Check: Default provider, Tier limits, Feature toggles
  });

  test('should view organization AI usage', async ({ page }) => {
    // Check: Usage by user, Usage by project
  });

  // User Level
  test('should access user AI preferences', async ({ page }) => {
    // Navigate to /settings/ai
    // Check: Personal API keys, Style preferences
  });

  test('should configure personal AI settings', async ({ page }) => {
    // Check: Response style, Language, Detail level
  });
});
```

---

## L6.17: AI Quality & Observability - Specyfikacja

### Cel
Weryfikacja systemu monitoringu jakości i observability AI.

### Testy

```typescript
test.describe('L6.17: AI Quality & Observability', () => {
  test('should check AI metrics endpoint', async ({ request }) => {
    // GET /api/ai/metrics
    // Expected: { requests, latency, errors, tokens }
  });

  test('should verify response quality checker', async ({ request }) => {
    // GET /api/ai/quality/health
    // Expected: { enabled, lastCheck, averageScore }
  });

  test('should get quality metrics by time range', async ({ request }) => {
    // GET /api/ai/quality/metrics?from=...&to=...
    // Expected: { accuracy, helpfulness, relevance, trend }
  });

  test('should check AI logging is working', async ({ request }) => {
    // GET /api/ai/logs/health
    // Expected: { loggingEnabled, logLevel, recentErrors }
  });

  test('should verify observability metrics', async ({ request }) => {
    // GET /api/ai/observability/metrics
    // Expected: { prometheus compatible metrics }
  });

  test('should check A/B testing status', async ({ request }) => {
    // GET /api/ai/ab-testing/status
    // Expected: { activeExperiments, results }
  });

  test('should get A/B test results', async ({ request }) => {
    // GET /api/ai/ab-testing/results/:experimentId
  });

  test('should check alerting configuration', async ({ request }) => {
    // GET /api/ai/alerting/config
    // Expected: { enabled, thresholds, channels }
  });

  test('should verify health monitor is running', async ({ request }) => {
    // GET /api/ai/health-monitor/status
    // Expected: { running, lastCheck, alerts }
  });
});
```

### Pliki źródłowe do testowania
- `server/src/services/ai/metrics.ts`
- `server/src/services/ai/observability.ts`
- `server/src/services/ai/responseQualityService.ts`
- `server/src/services/ai/abTesting.ts`
- `server/src/services/ai/healthMonitor.ts`
- `server/src/services/ai/alerting.ts`

---

## Uruchomienie testów

### Wszystkie testy L6
```bash
npx playwright test tests/e2e/ai-system-health.spec.ts
```

### Pojedyncza grupa testów
```bash
# Podstawowe (L6.1-L6.8)
npx playwright test tests/e2e/ai-system-health.spec.ts -g "L6.1"

# Zaawansowane (L6.9-L6.17)
npx playwright test tests/e2e/ai-system-health.spec.ts -g "L6.9"
npx playwright test tests/e2e/ai-system-health.spec.ts -g "L6.10"
# itd.
```

### Z dłuższym timeout
```bash
npx playwright test tests/e2e/ai-system-health.spec.ts --timeout=120000
```

### Z debug mode
```bash
npx playwright test tests/e2e/ai-system-health.spec.ts --debug
```

---

## Health Check API

### Endpoint
`GET /api/ai/health-check`

### Odpowiedź
```json
{
  "timestamp": "2026-02-04T06:00:00.000Z",
  "overall": {
    "status": "operational",
    "healthyCount": 5,
    "totalCount": 6
  },
  "subsystems": {
    "cloudIntegrations": { "status": "demo_mode", ... },
    "toolsMenu": { "status": "healthy", ... },
    "chatConversation": { "status": "healthy", ... },
    "voiceSystem": { "status": "healthy", ... },
    "historyManagement": { "status": "healthy", ... },
    "llmManagement": { "status": "healthy", ... }
  },
  "recommendations": [
    "Cloud integrations are in demo mode..."
  ]
}
```

### Dodatkowe endpointy
- `GET /api/ai/health-check/summary` - szybkie podsumowanie
- `GET /api/ai/health-check/subsystem/:name` - sprawdzenie konkretnego podsystemu

---

## Rekomendacje

### Priorytet 1 (Wysoki)
1. Implementacja testów L6.9 (Embeddings) - kluczowe dla RAG
2. Implementacja testów L6.10 (Memory) - kluczowe dla personalizacji
3. Implementacja testów L6.14 (Database) - podstawowa walidacja

### Priorytet 2 (Średni)
1. Implementacja integracji z chmurami (OAuth)
2. Implementacja testów L6.11 (Learning)
3. Implementacja testów L6.15 (Pipeline)
4. Dodanie retry logic dla voice API

### Priorytet 3 (Niski)
1. Implementacja testów L6.16 (Admin UI)
2. Implementacja testów L6.17 (Observability)
3. Eksport konwersacji do różnych formatów
4. UI dla adminów do zarządzania tier assignments
5. Provider health monitoring w UI

---

## Historia zmian

| Data | Wersja | Opis |
|------|--------|------|
| 2026-02-04 | 1.0.0 | Utworzenie dokumentu |
| 2026-02-04 | 2.0.0 | Rozszerzenie o L6.9-L6.17 (17 poziomów testów) |
