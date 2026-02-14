# Changelog

All notable changes to Consultinity will be documented in this file.

## [Unreleased] - 2026-02-14

### Fixed - Task / Initiative Dependencies (N-mode UX + behavior)

- **Dependencies actions menu restored as vertical three-dots** in `src/components/MyWork/shared/DependenciesSection.tsx`:
  - right-side per-row trigger uses `MoreVertical`
  - dropdown actions include: **Open card**, **Edit**, **Delete**
  - outside click closes the menu reliably
- **"Open card" action is now explicitly wired** to `onOpenTask(dep.taskId)` from the same dependency row menu.
- **Initiative wrapper passes sample-data mode** in `src/components/Initiatives/sections/DependenciesSection.tsx`, so the section can render meaningful preview content for empty initiatives.
- **Task view passes sample-data mode** in `src/components/MyWork/TaskDetailView.tsx` for empty dependency states in both render contexts.

### Added - Dependency sample data (preview mode only)

- In `src/components/MyWork/shared/DependenciesSection.tsx` added `showSampleDataWhenEmpty?: boolean`:
  - when enabled and there are no real dependencies, UI shows two read-only sample rows
  - sample mode includes badge (`dane przykładowe` / `sample data`) and disables row mutating actions
  - sample rows do not call API and are not persisted
- Sample data is displayed only after loading finishes (`!loading`) to avoid flashing preview during fetch.

### Fixed - RACI / Reminders crash loop in Task detail

- Root cause: runtime error `delivery.integrationChannels.includes` when legacy/incomplete `delivery` shape was present.
- Hardened handling in `src/components/MyWork/TaskDetailView.tsx`:
  - `ensureDeliveryConfig(...)` now always returns complete arrays (`coreChannels`, `integrationChannels`, `syncTargets`)
  - additional defensive guards before `.includes(...)` and `toggleChannel(...)` ensure array fallback even for malformed payloads
- Result: no repeated error-boundary resets when entering RACI & Escalation or adding reminders.

### Fixed - KPI API compatibility with legacy SQLite schema

- `server/src/controllers/InitiativeController.ts` updated to support both new and old `initiative_kpis` table layouts:
  - `getInitiativeKpis` now has fallback query path when newer columns (for example `baseline_value`, `current_value`, `category`, `trend_data`) do not exist
  - legacy fallback enriches response with safe defaults and latest value from `kpi_measurements`
  - `createInitiativeKpi` now falls back to legacy insert shape when modern insert fails due to missing columns
  - for legacy flow, initial baseline snapshot is inserted into `kpi_measurements`
- Purpose: prevent KPI section failures on environments with schema drift and keep frontend contract stable.

### Data Seed - Local development sample KPIs

- Seeded sample KPI data in local SQLite dev DB (`data/dev/consultinity.db`) for initiative:
  - `id: init-adma-09`
  - `title: Automated Changeover Optimization`
- Inserted 3 sample KPIs + corresponding entries in `kpi_measurements`:
  - `Skrócenie czasu changeover` (target 75 min, current 92)
  - `Redukcja odpadów rozruchowych` (target 4.0%, current 5.2)
  - `OEE po changeover` (target 80%, current 76)
- Note: this seed is local runtime data (DB content), not a committed migration.

## [Unreleased] - 2026-02-08

### Added - AI Chat: Text-to-Speech (Auto-Read Responses)

- **Read Responses toggle** (`ToolsMenu` / `EnhancedChatInput`): nowa opcja "Read responses" w menu narzędzi AI (ikona klucza). Po włączeniu AI automatycznie czyta na głos odpowiedzi w trakcie ich generowania.

- **Incremental TTS (sentence-by-sentence streaming)**: odpowiedzi AI czytane są zdanie po zdaniu w czasie rzeczywistym — nie czeka na pełną odpowiedź. Mechanizm:
  - `spokenCharsRef` śledzi ile tekstu już wypowiedziano.
  - `useEffect` monitoruje `streamedContent`, identyfikuje ukończone zdania regex `(?<=[.!?])\s+|(?<=\n)\s*`, i wysyła je do `speak()`.
  - Po zakończeniu streamu, `handleStreamDone` wypowiada tylko _pozostałą_ (niewypowiedzianą) część tekstu.
  - `cleanTextForSpeech()` czyści markdown, kod, URL i emoji przed syntezą mowy.
  - Zaimplementowane w obu widokach: `UnifiedChatPanel.tsx` (split mode) i `AIChatWelcomeView.tsx` (full mode).

- **Web Speech API provider** (`useUniversalVoice.ts`): zmiana `ttsProvider` z `'openai'` na `'web'` — TTS działa bezpośrednio przez przeglądarkowy `SpeechSynthesis` API bez potrzeby serwera czy klucza API.

- **Obsługa 6 języków TTS**: mapowanie `LANG_TO_BCP47` dla wszystkich obsługiwanych języków aplikacji:
  | App code | BCP-47 locale | Preferowane głosy |
  |----------|---------------|-------------------|
  | `pl` | `pl-PL` | Zosia, Paulina |
  | `en` | `en-US` | Samantha, Karen, Alex |
  | `de` | `de-DE` | Anna, Petra, Helena |
  | `ar` | `ar-SA` | Maged |
  | `jp` | `ja-JP` | Kyoko, O-Ren, Otoya |
  | `es` | `es-ES` | Monica, Paulina, Jorge |

- **Inteligentny wybór głosu** — `pickBestVoice()`: automatyczny wybór najlepszego dostępnego głosu przeglądarki z priorytetem:
  1. Preferowane głosy premium z listy `PREFERRED_VOICES` (np. "Zosia" dla PL)
  2. Głosy z "premium", "enhanced", "natural", "neural" w nazwie
  3. Dowolny głos pasujący do pełnej lokalizacji (np. `pl-PL`)
  4. Dowolny głos pasujący do prefiksu języka (np. `pl`)
  - `utterance.pitch = 1.05` dla cieplejszego, mniej robotycznego brzmienia.
  - Preload głosów przez event `voiceschanged` (Chrome ładuje głosy asynchronicznie).

### Fixed - AI Chat: Attachments

- **AI nie rozumiał załączników**: wdrożono 3-warstwowy fallback w `ai.routes.ts` do wstrzykiwania treści załączników do system prompt AI:
  1. RAG search po knowledge chunks
  2. Bezpośredni odczyt z `knowledge_docs` (treść dokumentu)
  3. Odczyt z `knowledge_chunks` z fallbackiem na `conversation_messages` z typem `attachment_content`
- **Relaksacja filtra `organization_id`** w RAG (`ragService.ts`) — zapobiega wykluczaniu załączników użytkownika.
- **Toast notifications** (`react-hot-toast`) dla statusu uploadu załączników w `UnifiedChatPanel.tsx`.

### Fixed - AI Chat: Thinking Steps (Progress Indicators)

- **Duplikaty kroków myślenia**: usunięto redundantny `ThinkingStatusLine` z `AIChatWelcomeView.tsx`. `MessageRenderer` renderuje kroki myślenia tylko dla ostatniej wiadomości ze streamem.

- **Za mało informacji w krokach**: backend (`ai.routes.ts`) emituje realne SSE eventy `type: 'thought'` z konkretnymi opisami (np. "Analizuję kontekst rozmowy", "Przeszukuję bazę wiedzy"). Frontend (`useAIStream.ts`) obsługuje te eventy i aktualizuje `thinkingSteps` w czasie rzeczywistym, zastępując symulowane kroki.

- **Wizualne statusy**: `ThinkingStatusLine.tsx` wyświetla:
  - ✓ (zielony checkmark) dla kroków ukończonych (`status: 'done'`)
  - Spinner animowany dla kroków w trakcie (`status: 'in_progress'`)
  - Strukturalne `ThinkingLineItem` obiekty z `label` i `status`

### Fixed - AI Chat: Dictation (Voice Input)

- **Timer nagrywania zatrzymany na 0:00**: `EnhancedChatInput.tsx` — `currentRecordingDuration` teraz priorytetyzuje wewnętrzny stan komponentu gdy aktywna jest dyktacja (Web Speech API), nie tylko tryb nagrywania serwerowego.

- **Brak wizualnego feedbacku podczas słuchania**: dodano `AudioContext` + `AnalyserNode` do monitorowania poziomu audio w czasie rzeczywistym — wizualna animacja reagująca na głos użytkownika.

- **Język dyktacji**: `recognition.lang` teraz priorytetyzuje prop `chatLanguage`, fallback na `i18nextLng` → `'pl'`. Naprawiony brak mapowania `jp` → `ja-JP` (app używa `jp`, nie `ja`).

### Fixed - AI Chat: Language Handling (Polish as Default)

- **AI odpowiadało po angielsku**: głęboki problem — `i18nextLng` auto-detect ustawiał `'en'` (język przeglądarki), co propagowało się do:
  - Speech recognition (`recognition.lang`)
  - AI system prompt (`language` parameter)
  - Zustand persisted store (`draftChatLanguage`, `chatLanguageByConversationId`)

- **Rozwiązanie — nowy klucz preferencji `consultinity-preferred-chat-lang`**:
  - Przechowuje _jawną_ preferencję użytkownika (nie auto-detect przeglądarki)
  - `UnifiedChatPanel.tsx` i `AIChatWelcomeView.tsx`: `chatLanguage` resolution priorytetyzuje `consultinity-preferred-chat-lang` → conversation-specific → draft → `'pl'`
  - `i18nextLng` jawnie NIE jest używany do rozwiązywania języka czatu
  - `useAIStream.ts`: `resolvedLanguage` fallback zmieniony z `i18nextLng` na `consultinity-preferred-chat-lang`

- **Migracja Zustand store v2** (`useConversationStore.ts`):
  - `draftChatLanguage`: `'en'` → `'pl'`
  - `chatLanguageByConversationId`: wszystkie wpisy `'en'` → `'pl'`
  - `localStorage.setItem('consultinity-preferred-chat-lang', 'pl')`

### Fixed - AI Chat: Floating Menus Direction

- **Menu otwierały się w dół i znikały poza ekran**: gdy rozmowa jest na dole okna, menu kontekstowe (narzędzia, akcje wiadomości, dodawanie plików) teraz otwierają się DO GÓRY:
  - `ToolsMenu.tsx`: `top-full mt-2` → `bottom-full mb-2`, animacja `slide-in-from-bottom-2`
  - `MessageActions.tsx`: `top-full mt-1` → `bottom-full mb-1`
  - `UnifiedChatPanel.tsx` (AddFilesMenu): `top-full mt-2` → `bottom-full mb-2`
  - `ToolsMenu`: `menuMaxHeight` obliczany na podstawie przestrzeni _nad_ triggerem (`rect.top - 24`)

### Technical — Files Changed

| File                                                | Description                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/hooks/useUniversalVoice.ts`                    | TTS engine: 6-language support, `pickBestVoice()`, Web Speech provider, voice preload |
| `src/components/AIChat/UnifiedChatPanel.tsx`        | Incremental TTS effects, auto-read sync, dropup menus                                 |
| `src/views/AIChatWelcomeView.tsx`                   | Incremental TTS effects, ttsEnabled logic, language resolution                        |
| `src/components/AIChat/EnhancedChatInput.tsx`       | Dictation: timer fix, audio level, language mapping fix (`jp`)                        |
| `src/components/AIChat/ToolsMenu.tsx`               | Dropup direction, max-height calculation                                              |
| `src/components/AIChat/Messages/MessageActions.tsx` | Dropup direction                                                                      |
| `src/hooks/useAIStream.ts`                          | Backend thought events, language fallback                                             |
| `src/components/AIChat/ThinkingStatusLine.tsx`      | Structured steps with visual indicators                                               |
| `src/components/AIChat/Messages/ThinkingBlock.tsx`  | Rich ThinkingLineItem objects                                                         |
| `src/components/AIChat/MessageRenderer.tsx`         | Last-message-only thinking display                                                    |
| `src/store/useConversationStore.ts`                 | Zustand v2 migration, Polish default                                                  |
| `src/utils/textCleaning.ts`                         | `cleanTextForSpeech()` utility                                                        |
| `server/src/routes/ai.routes.ts`                    | Attachment fallback, thought SSE events, language param                               |
| `server/src/services/ragService.ts`                 | Relaxed organization_id filter                                                        |
| `server/src/validators/ai.validators.ts`            | `multiAgent` field                                                                    |

---

## [Unreleased] - 2026-02-06

### Added / Improved - AI Chat System (Wave 1–3 + stabilization)

- **ContextBadge** (`src/components/AIChat/ContextBadge.tsx`): nowy komponent pokazujący użytkownikowi co AI "widzi" (workspace, projekt, encja, focus mode). Zintegrowany w `UnifiedChatPanel` nad obszarem wiadomości.

- **SmartSuggestions kontekstowe**: podpowiedzi startowe na ekranie powitalnym zależą teraz od typu workspace (assessment → analiza/gaps, initiative → priorytetyzacja/ryzyka, roadmap → timeline/zależności, task → planowanie tygodnia/blokery, report → podsumowanie/executive summary). Fallback na generyczne sugestie.

- **Retry button przy błędach streamu**: gdy AI odpowiada błędem (`⚠️`), pod wiadomością pojawia się przycisk "Spróbuj ponownie" z ikoną `RefreshCw`, automatycznie powtarzający ostatnią wiadomość użytkownika. Działa w `UnifiedChatPanel` i `AIChatWelcomeView`.

- **ThinkingBlock w AIChatWelcomeView**: 5-krokowy wskaźnik myślenia AI (analiza → kontekst → wiedza → synteza → formatowanie) widoczny konsekwentnie we wszystkich trzech formatach czatu (pełnoekranowy, split, panel boczny).

- **Conversation continuity — loading state**: dodany spinner ładowania gdy konwersacja jest wybrana ale wiadomości jeszcze się nie załadowały (np. po nawigacji między ekranami). Eliminuje "miganie" powrotne do ekranu powitalnego.

- **Chat export (JSON/TXT)**: `ChatExportModal` podłączony do handlera eksportu — przyciski PDF/JSON/TXT generują i pobierają pliki z pełną historią rozmowy.

- **MessageActions — Share & Bookmark**: Share korzysta z Web Share API (mobilne) lub kopiuje do schowka (desktop). Bookmark zapisuje wiadomość do `localStorage` z timestampem.

- **FocusMode selector UX**: dodany `activeSourceCount` badge do kompaktowego selektora — widoczny gdy użytkownik wybrał tryb inny niż "All".

- **SSE auto-reconnect**: `useAIStream` automatycznie ponawia próbę 1× po 1.5s gdy stream się zerwie (network error), z wyłączeniem błędów autoryzacji.

- **Conversation summary endpoint** (`POST /api/conversations/:id/summarize`): kondensuje starsze wiadomości w długich rozmowach przez LLM, zostawiając ostatnie N nienaruszone.

- **AI Memory w pipeline**: system prompt wzbogacony o preferencje użytkownika i pamięć organizacji z `aiMemoryService`.

- **AIContextBuilder optimization**: budowanie kontekstu zrównoleglone, cap rozmiaru kontekstu (>12k chars → trimming).

- **Adaptive response — zamknięcie pętli**: feedback trafia do `adaptiveResponseService.processFeedback()`, aktualizując profil stylu użytkownika.

- **Voice health endpoint** (`GET /api/voice/health`).

- **Circuit breaker health check probes** dla OpenAI, Gemini, Anthropic.

- **AI health dashboard** (`GET /api/ai/health-check/dashboard`): skonsolidowany status AI.

- **Quota checking w AIPipeline**: integracja z `BudgetManagementService.checkBudgetLimit()`.

### Fixed - Runtime crashes & broken endpoints

- **`/api/ai/suggestions` crashował**: brakujące `smartSuggestions.ts` i `proactiveSuggestionsService.ts`. Napisane pełne implementacje TypeScript.

- **ResponseActions — raw fetch()**: zastąpiony przez `Api.executeAIAction` / `Api.genericPost`.

- **Chat title auto-generation**: naprawiony stale closure bug z `activeConversationIdRef`.

- **`authorName` TypeScript error**: dodane do `ChatMessage` w `types/domain/ai.ts`.

### Improved - Internationalization (i18n)

- **InlineResponseFeedback**: namespace `chat.feedback.*` → `aiChat.feedback.*` (34 klucze en+pl).
- **ChatOverlay**: hardcoded PL → `t('aiChat.expandFullScreen')`.
- **Nowe klucze i18n** (6 locales): `aiChat.retry`, `contextBadge.*`, `aiChat.feedback.*`, `aiChat.actions.*`.

---

## [2.8.0] - 2025-01-XX

### Fixed - Removed All Mock Data from Production Code

#### Admin Screens

- **AdminAnalyticsView**: Removed `generateMockUsageData()` and `generateMockFailureData()` functions, now uses real API data only
- **AdminMetricsDashboardView**: Removed hardcoded `percent={75}` mock, now calculates from real data
- **AdminBillingManagement**: Removed fallback mock data, proper error handling with empty states
- **SpendingAlertsView**: Removed `mockUsage` calculations, now fetches real usage data from API
- **PaymentMethodsView**: Removed mock Stripe payment method ID generation, uses real Stripe integration
- **UserGroupsView**: Removed mock data fallbacks, proper error handling
- **OwnershipManagementView**: Removed mock data, proper error handling
- **AuditLogView**: Removed mock data, uses real audit API endpoint

#### SuperAdmin Screens

- **AIIntelligenceView**: Removed `generateMockTrends()` function, uses real API data only

#### Settings Screens

- **APIAccessSettings**: Removed mock data fallback, proper error handling
- **ActiveSessionsSettings**: Removed mock data fallback, proper error handling
- **LoginHistorySettings**: Removed mock data fallback, proper error handling

#### Test Data

- **New Seed Script**: Created `server/scripts/seedEnglishTestData.js` with comprehensive English test data
  - 5 test organizations with different subscription tiers
  - 30 test users with English names
  - 15-20 test projects
  - Billing data (invoices, payment methods)
  - API keys, webhooks, audit logs
  - Notifications, login history
  - AI usage data
  - All data in English language for manual testing

#### Improvements

- All screens now show proper empty states instead of mock data
- Better error handling throughout
- Consistent API error messages
- Loading states properly implemented

## [2.7.0] - 2025-01-02

### Added - Unified AI Chat System

A seamless chat experience across full-screen and split-screen modes, similar to OpenAI Canvas or Google AI Studio.

#### New Components

- **UnifiedChatPanel** - Dual-mode chat component supporting both full-screen and split-screen
- **WorkspaceContext** - Type system for tracking what user is viewing in workspace
- **Enhanced SplitLayout** - Now integrates UnifiedChatPanel by default

#### Store Extensions

- `useConversationStore` extended with:
  - `displayMode` - Manages full/split/collapsed chat modes
  - `workspaceContext` - Tracks workspace panel content
  - `expandToFullScreen()` / `collapseToSplit()` actions
  - Mode persistence across sessions

- `useAppStore` extended with:
  - `navigateWithChatContext()` - Navigate while preserving chat
  - `returnToFullChat()` - Return to full-screen chat
  - `previousView` tracking for back navigation

#### Sidebar Navigation

- Smart navigation that preserves active conversation
- Clicking menu items while in conversation switches to split mode
- AI Chat button switches between modes intelligently

#### AI Context Awareness

- AIContext now includes `workspaceContext` and `chatDisplayMode`
- AI receives information about what user is currently viewing
- Contextual placeholders in input based on workspace type

#### Features

- Seamless transition between full-screen and split-screen modes
- Conversation history preserved across mode changes
- All input features available in split mode (files, tools, voice)
- FocusModeSelector with compact mode for split view
- Mobile-responsive with FAB for chat access

#### Documentation

- Full technical documentation in `docs/UNIFIED_AI_CHAT_SYSTEM.md`
- Architecture diagrams
- Migration guide from legacy ChatPanel
- Usage examples

#### Tests

- Unit tests for store extensions
- Component tests for UnifiedChatPanel
- E2E tests for navigation flows

### Files Changed

- `store/useConversationStore.ts`
- `store/useAppStore.ts`
- `components/SplitLayout.tsx`
- `components/Sidebar.tsx`
- `contexts/AIContext.tsx`

### Files Added

- `components/AIChat/UnifiedChatPanel.tsx`
- `types/workspace.ts`
- `tests/store/useConversationStore.displayMode.test.ts`
- `tests/components/AIChat/UnifiedChatPanel.test.tsx`
- `e2e/unified-chat.spec.ts`
- `docs/UNIFIED_AI_CHAT_SYSTEM.md`

---

## [2.6.0] - 2025-01-02

### Added - System Module Enterprise Implementation

#### Database

- Added `audit_logs` table with comprehensive audit logging
- Added `feature_flags` and `feature_flag_history` tables
- Added `webhook_deliveries` table for delivery tracking
- Added `integrations` and `integration_sync_logs` tables
- Added `system_metrics` table for metrics collection
- Added `security_events` table for security monitoring
- Added `compliance_records` table for compliance tracking
- Added `system_config` table for configuration management
- Added `api_keys` table for API key management
- Added `backup_records` table for backup tracking
- Extended `webhooks` table with retry_policy, headers, payload_template columns
- Migrated existing `activity_logs` to `audit_logs` table

#### Backend Services

- **auditLogService** - Comprehensive audit logging with compliance support
- **featureFlagService** - Full CRUD and targeting rules support
- **webhookService** - Extended with delivery management
- **integrationService** - Third-party integration management
- **securityService** - Security event tracking and threat detection
- **complianceService** - Compliance framework management
- **systemConfigService** - System configuration management
- **metricsService** - Metrics collection and aggregation
- Enhanced **systemHealthService** with detailed metrics

#### API Routes

- `/api/audit-logs` - Audit log management endpoints
- `/api/feature-flags` - Feature flag CRUD endpoints
- `/api/webhooks` - Extended webhook management
- `/api/integrations` - Integration management endpoints
- `/api/security` - Security and compliance endpoints
- `/api/system-config` - Configuration management endpoints
- `/api/system-health` - Enhanced health monitoring endpoints
- `/api/api-keys` - API key management endpoints
- `/api/backups` - Backup management endpoints

#### Frontend Components

- **SystemHealthView** - Enhanced health monitoring
- **AuditLogViewer** - Full audit log browsing and export
- **FeatureFlagsPanel** - Complete feature flag management
- **IntegrationsPanel** - Integration and webhook management
- **SecurityPanel** - Security events and compliance
- **ConfigurationPanel** - System configuration management
- **AnalyticsPanel** - System analytics dashboard
- **BackupPanel** - Backup and recovery management
- **ApiManagementPanel** - API key management

#### Features

- Comprehensive audit logging with risk levels and compliance tags
- Feature flags with targeting rules and A/B testing support
- Webhook management with delivery tracking and retry logic
- Integration hub with sync monitoring
- Security event tracking and resolution workflow
- Compliance framework support (GDPR, SOC2, ISO27001, HIPAA, PCI_DSS)
- System configuration management with environment support
- Real-time system metrics and analytics
- Backup and recovery management
- API key management with usage tracking

#### Documentation

- Architecture documentation
- API documentation
- Database schema documentation
- User guide
- Administrator guide
- Migration guide

#### Tests

- Unit tests for services
- Component tests
- Integration tests for API endpoints
- E2E tests for user flows

### Changed

- Enhanced System Module with 9 tabs (was 4)
- Extended audit logging capabilities
- Improved feature flag management
- Enhanced webhook delivery tracking

### Security

- All System Module endpoints require SUPERADMIN role
- Audit logs are immutable (append-only)
- API keys hashed before storage
- Webhook secrets encrypted
- Compliance evidence tracking

## [2.5.0] - Previous Version

- Initial System Module with basic health monitoring
