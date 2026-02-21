# Wave 2 — 3 prompty do odpalenia rownolegle

Odpal te 3 prompty jednoczesnie:
- **Prompt A** -> nowe okno Cursor (Agent mode)
- **Prompt B** -> drugie okno Cursor (Agent mode)
- **Prompt C** -> Codex

Kazdy agent pracuje na swoim branchu. Gdy skonczy — zglasza gotowosc. Ty decydujesz o merge.

Uwaga: prompty sa zgodne z `PROMPT_TEMPLATE_V2.md` (PostgreSQL, strict TS, FunnelEventName, nie edytujemy progress.md).

---

## PROMPT A — Cursor Agent 1 -> Bundle 01 reszta (Chat & Research T003-T006)

```
Jestes agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 01 (reszta) — Chat & Research** (taski T003, T004, T005, T006).
Uwaga: T001 i T002 sa juz zrobione (pilot). Robisz TYLKO T003-T006.

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-01-chat-research

## Krok 2: Implementacja

### T003 — Cloud Data Integration
Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T003")

Kluczowe deliverables:
- Jeden provider w V2: Google Drive + bezpieczny OAuth
- Admin config: podlaczenie konta dostawcy storage
- User selection: wybor datasetu/folderu + jednorazowy import (copy-in snapshot) do projektu
- Audit log importu + obsluga bledow

### T004 — Deep Thinking Module
Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T004")

Kluczowe deliverables:
- Tryb w czacie: "Deep Thinking"
- UI "ChatGPT-like": prawy panel z wyszukiwaniem/zrodlami/referencjami
- Raport 2–3 strony w czacie + export do Notes/KB

### T005 — Market Research Module
Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T005")

Kluczowe deliverables:
- Tryb w czacie: "Market Research"
- UI jak T004: prawy panel + raport 2–3 strony + export do Notes/KB

### T006 — Co-Thinker Business Mode
Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T006")

Kluczowe deliverables:
- 5 trybow (przyciski) w czacie
- Multi-Consultant: dialog rol -> synteza -> ponumerowane wnioski
- Kazdy tryb konczy sie sekcja "Next actions"

Pliki do edycji (start points):
- `src/components/AIChat/UnifiedChatPanel.tsx`
- `src/components/AIChat/Input/FocusModeSelector.tsx`
- `src/components/AIChat/ResearchProgress.tsx`
- `server/src/routes/ai.routes.ts`
- `server/src/services/ai/*` (deep research / web research / co-thinker)

## Wazne zasady
- DB = PostgreSQL. Migracje SQL: natywny PostgreSQL.
- Jesli dodajesz nowe analytics events: rozszerz `FunnelEventName` w `src/services/funnelAnalytics.ts`.
- Strict TS: obsluz nullable.
- i18n: EN+PL minimum. Nowe klucze na koncu translation.json, prefix modulem.
- NIE edytuj `docs/plans/v2-delivery/progress.md`.

## Testy
npm run verify:quick

## Raport koncowy
Wypelnij format z `docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md`.
```

---

## PROMPT B — Cursor Agent 2 -> Bundle 30.5 (OAuth T110-T112)

```
Jestes agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 30.5 — OAuth bundle** (taski T110, T111, T112).

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-30-5-oauth

## Krok 2: Implementacja

### T110 — Google Login Integration
Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T110")

### T111 — LinkedIn Login Integration
Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T111")

### T112 — LinkedIn Account Connection + nudges
Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T112")

Pliki do edycji (start points):
- `server/src/routes/oauthRoutes.routes.ts` (stuby -> realne endpointy)
- `server/src/config/Config.ts` + `ConfigValidator.ts`
- `src/views/AuthView.tsx` + `src/views/OAuthCallback.tsx`
- `src/components/settings/ConnectedAccounts.tsx`
- `src/components/settings/ProfileCompleteness.tsx`

## Wazne zasady
- DB = PostgreSQL. Uzyj istniejacej tabeli `oauth_links` (nie tworz nowej).
- Strict security: state/TTL/jednorazowosc, rate limit, security_events logging.
- Jesli dodajesz nowe analytics events: rozszerz `FunnelEventName`.
- NIE edytuj `progress.md`.

## Testy
npm run verify:quick
npm run test:protect

## Raport koncowy
Wypelnij format z `docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md`.
```

---

## PROMPT C — Codex -> Bundle 03 (Interview/Survey/Acquisition T013-T017)

```
Jestes agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 03 — Interview / Survey / Acquisition** (taski T013, T014, T015, T016, T017).

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-03-interview-survey

## Krok 2: Implementacja
Specyfikacja dla kazdego taska: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj odpowiednio "## T013" ... "## T017")

Pliki do edycji (start points):
- `src/components/Interview/*`
- `server/src/controllers/InterviewController.ts`
- `server/src/routes/interview.routes.ts`
- `src/components/assessment/*` (survey/report workspace)

## Wazne zasady
- DB = PostgreSQL. Migracje SQL: natywny PostgreSQL.
- Strict TS: obsluz nullable.
- i18n: EN+PL minimum, 6 jezykow tylko tam gdzie spec wymaga (T013/T014/T015).
- NIE edytuj `progress.md`.

## Testy
npm run verify:quick

## Raport koncowy
Wypelnij format z `docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md` (tabela plikow, migracje, manual QA, testy, ryzyka, konflikty).
```

# Wave 2 — 3 prompty do odpalenia rownolegle

Odpal te 3 prompty jednoczesnie:
- **Prompt A** -> nowe okno Cursor (Agent mode)
- **Prompt B** -> drugie okno Cursor (Agent mode)
- **Prompt C** -> Codex

Kazdy agent pracuje na swoim branchu. Gdy skonczy — zglasza gotowosc. Ty decydujesz o merge.

---

## PROMPT A — Cursor Agent 1 -> Bundle 01 reszta (Chat & Research T003-T006)

```
Jestes agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 01 (reszta) — Chat & Research** (taski T003, T004, T005, T006).
Uwaga: T001 i T002 sa juz zrobione (pilot). Robisz TYLKO T003-T006.

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-01-chat-research

## Krok 2: Implementacja

### T003 — Cloud Data Integration
Specyfikacja: docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md (szukaj "## T003")

Kluczowe deliverables:
- Jeden provider V2: Google Drive + bezpieczny OAuth
- Admin config: podlaczenie konta dostawcy storage
- User selection: wybor datasetu/folderu + jednorazowy import (copy-in snapshot) do projektu
- Audit log importu + obsluga bledow
- Events: cloud_source_connected, dataset_import_started/succeeded/failed

### T004 — Deep Thinking Module
Specyfikacja: docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md (szukaj "## T004")

Kluczowe deliverables:
- Osobny tryb w czacie: "Deep Thinking"
- UI "ChatGPT-like": prawy panel z wyszukiwaniem/zrodlami/referencjami
- Raport 2-3 strony w czacie: Executive summary, Kluczowe tezy, Evidence/zrodla, Implikacje/rekomendacje, Zalozenia i ograniczenia
- Export raportu do Notes/KB
- Events: deep_thinking_started, deep_thinking_report_generated, deep_thinking_exported

### T005 — Market Research Module
Specyfikacja: docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md (szukaj "## T005")

Kluczowe deliverables:
- Osobny tryb w czacie: "Market Research"
- UI jak T004: prawy panel (research view) + raport w czacie
- Raport 2-3 strony: Executive summary, Market overview + segmenty, Competitive landscape, Positioning options, Risks/unknowns, Assumptions/limitations
- Export do Notes/KB
- Events: market_research_started, market_research_report_generated, market_research_exported

### T006 — Co-Thinker Business Mode
Specyfikacja: docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md (szukaj "## T006")

Kluczowe deliverables:
- 5 trybow (przyciski) w czacie:
  1) Multi-Consultant Panel (dialog rol -> synteza)
  2) Idea Maker (warianty + kreatywne opcje)
  3) Competitive Analyst (konkurencja + pozycjonowanie)
  4) Risk Challenger (dziury w planie, ryzyka)
  5) Executive Editor (skrocenie: 1-pager/memo)
- Multi-Consultant: krotka rozmowa rol (Strategy/CFO/Ops/Tech) -> synteza -> ponumerowane wnioski
- Kazdy tryb konczy sie sekcja "Next actions"
- Events: cothinker_mode_selected, cothinker_response_generated

Pliki do edycji (istniejace):
- src/components/AIChat/UnifiedChatPanel.tsx
- src/components/AIChat/Input/FocusModeSelector.tsx
- src/components/AIChat/ResearchProgress.tsx
- src/components/AIChat/ResearchClarification.tsx
- src/components/AIChat/ToolsMenu.tsx
- src/components/AIChat/EnhancedChatInput.tsx
- src/components/AIChat/Messages/ThinkingBlock.tsx
- src/components/AIChat/MessageRenderer.tsx
- server/src/routes/ai.routes.ts
- server/src/routes/conversations.routes.ts
- server/src/services/ai/deepResearchService.ts
- server/src/services/ai/coThinkerPrompts.ts
- server/src/services/ai/coThinker/index.ts
- server/src/services/ai/webResearchService.ts
- server/src/services/ai/intelligentResearch.ts

## Kontekst techniczny projektu (MUST READ)

### Baza danych
- Projekt uzywa **PostgreSQL** (pg Pool). NIE SQLite.
- ORM/wrapper: server/src/database/PostgresDatabase.ts z funkcja adaptQuery().
- adaptQuery() konwertuje ? -> $1/$2, datetime('now') -> NOW(), IFNULL -> COALESCE.
- W kodzie serwisow (*.ts) uzywaj ? jako placeholderow — adaptQuery zamieni je na $1/$2.
- W plikach migracji SQL (server/migrations/*.sql) pisz **natywny PostgreSQL**.
- Boolean w PostgreSQL: TRUE/FALSE, nie 1/0.

### Migracje
- Folder: server/migrations/
- Sprawdz ostatni numer w folderze i uzyj kolejnego (aktualnie ostatni to 552).
- Format nazwy: NNN_opis.sql
- Syntax: natywny PostgreSQL.

### i18n
- Pliki: public/locales/{en,pl}/translation.json
- Dodawaj nowe klucze NA KONCU pliku (przed ostatnim }).
- Prefix kluczy nazwa modulu (np. chat.deepThinking.title, chat.coThinker.panel).
- Minimum: EN + PL.

### Analytics events
- Jesli dodajesz nowe analytics events, MUSISZ rozszerzyc typ FunnelEventName w src/services/funnelAnalytics.ts.

### TypeScript strict mode
- Zawsze obsluguj nullable (| null, | undefined). Dodaj guard przed uzyciem.

### UI Standards
- Przeczytaj docs/ui-standards/README.md PRZED edycja komponentow.
- N-mode (page-first) jako domyslny. Ikony: lucide-react.

### Testy — pre-existing failures
- W repo sa pre-existing lint errors i test failures.
- **Ignoruj je.** Liczy sie TYLKO:
  1. Twoje nowe/zmienione pliki przechodza npx tsc --noEmit bez nowych bledow.
  2. Nie dodajesz nowych ESLint errors.
  3. Jesli dotykasz billing/auth/policy: npm run test:protect.

## Krok 3: Testy
Po implementacji uruchom:
npm run verify:quick

## Krok 4: Commit i raport

Commity: male logiczne commity. Format: bundle-01: [opis]

### Raport koncowy (WYMAGANY FORMAT)

**Bundle:** 01 — Chat & Research (T003-T006)
**Branch:** bundle-01-chat-research
**Status:** in_review

**Pliki zmienione/dodane:**
| Plik | Typ zmiany | Opis |
|------|-----------|------|
| ... | ... | ... |

**Migracje DB:** tak/nie (numer i nazwa)

**Manual QA (do sprawdzenia):**
T003:
- [ ] Connect -> list datasets -> import -> dane widoczne w projekcie
- [ ] Revoke token -> import fails gracefully
- [ ] Audit log importu
T004:
- [ ] Deep Thinking uruchamia prawy panel research
- [ ] Raport 2-3 stron z sekcja zrodel i ograniczen
- [ ] Export do Notes/KB
T005:
- [ ] Market Research generuje raport z wymaganymi sekcjami
- [ ] Export do Notes/KB
T006:
- [ ] 5 trybow dostepnych, kazdy zmienia format outputu
- [ ] Multi-Consultant: dialog + synteza + wnioski + next actions
- [ ] Kazdy tryb konczy sie "Next actions"

**Testy:**
- verify:quick: PASS/FAIL (jesli FAIL — czy to pre-existing?)
- type-check na moich plikach: PASS/FAIL

**Ryzyka / otwarte pytania:**
- ...

**Konflikty z innymi bundlami:** tak/nie

## Zasady (MUST)
- NIGDY nie rob git reset --hard ani git clean -fd
- Brak stubow/placeholderow w produkcji
- i18n: EN + PL minimum
- Nie dotykaj plikow spoza scope (T003-T006)
- UI zgodne z docs/ui-standards/README.md
- Dane konfiguracyjne z DB/config — NIE hardcode w komponentach
- **NIE edytuj** docs/plans/v2-delivery/progress.md
```

---

## PROMPT B — Cursor Agent 2 -> Bundle 30.5 (OAuth T110-T112)

```
Jestes agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 30.5 — OAuth bundle** (taski T110, T111, T112).

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-30-5-oauth

## Krok 2: Implementacja

### T110 — Google Login Integration
Specyfikacja: docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md (szukaj "## T110")

Kluczowe deliverables:
- Backend endpoints: GET /api/auth/google (start auth -> redirect do Google), GET /api/auth/google/callback (code -> tokens -> user -> redirect do frontend)
- Authorization code flow z state (+ PKCE), state w httpOnly cookie lub server-side store (TTL ~10min)
- Weryfikacja email_verified z Google
- User mapping/provisioning:
  - match po oauth_links(provider='google', provider_user_id) -> login
  - match po email -> link konto
  - brak usera -> create (jesli polityka pozwala)
- Zapis do oauth_links: provider, provider_user_id, provider_email, last_login_at
- Session: standardowy token jak w pozostalych flow
- Security events: login_success/login_failed z auth_method='oauth'
- Frontend: przycisk juz istnieje w AuthView.tsx, callback route w OAuthCallback.tsx
- Events: oauth_login_started/succeeded/failed (provider=google)

### T111 — LinkedIn Login Integration
Specyfikacja: docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md (szukaj "## T111")

Kluczowe deliverables:
- Backend endpoints: GET /api/auth/linkedin, GET /api/auth/linkedin/callback
- Email retrieval (MUST) — jesli provider nie daje email -> fallback
- User mapping identyczny jak Google (oauth_links provider='linkedin')
- State + TTL + jednorazowosc, rate limit
- Security events logowane
- Frontend: przycisk w AuthView.tsx, callback przez OAuthCallback.tsx
- /api/auth/oauth/status pokazuje linkedin.configured

### T112 — LinkedIn Account Connection Encouragement System
Specyfikacja: docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md (szukaj "## T112")

Kluczowe deliverables:
- Connect flow (dla zalogowanego usera):
  - GET /api/auth/linkedin/connect (start connect)
  - GET /api/auth/linkedin/connect/callback (zapis linka -> redirect do settings)
  - Wymaga aktywnej sesji, state/nonce + TTL
  - Blokada podpiecia tej samej LinkedIn tozsamosci do 2 userow
- Disconnect: DELETE /api/settings/connected-accounts/linkedin
- Status API: GET /api/settings/connected-accounts -> lista podlaczonych providerow
- UI Settings -> Connected Accounts: komponent juz istnieje (ConnectedAccounts.tsx — placeholder), V2: realny connect/disconnect
- Profile Completeness: GET /api/user/profile-completeness (obecnie stub 503 -> zrob realny endpoint)
- Nudge entrypoints: onboarding modal (1 raz), Settings card, dismiss z TTL 30 dni
- Events: oauth_linked/oauth_unlinked, linkedin_connect_cta_shown/clicked/dismissed

Pliki do edycji (istniejace):
- server/src/routes/oauthRoutes.routes.ts (stuby -> realne endpointy)
- server/src/config/Config.ts (GOOGLE_CLIENT_ID/SECRET, LINKEDIN_CLIENT_ID/SECRET)
- server/src/config/ConfigValidator.ts
- src/views/AuthView.tsx
- src/views/OAuthCallback.tsx
- src/components/settings/ConnectedAccounts.tsx (placeholder -> realny)
- src/components/settings/ProfileCompleteness.tsx
- server/src/routes/settings.routes.ts (connected-accounts endpoints)

## Kontekst techniczny projektu (MUST READ)

### Baza danych
- Projekt uzywa **PostgreSQL** (pg Pool). NIE SQLite.
- ORM/wrapper: server/src/database/PostgresDatabase.ts z funkcja adaptQuery().
- adaptQuery() konwertuje ? -> $1/$2, datetime('now') -> NOW(), IFNULL -> COALESCE.
- W kodzie serwisow uzywaj ? jako placeholderow.
- W migracji SQL pisz **natywny PostgreSQL**.
- Boolean: TRUE/FALSE, nie 1/0.

### Migracje
- Folder: server/migrations/
- Ostatni numer: 552. Uzyj kolejnego.
- Format: NNN_opis.sql, natywny PostgreSQL.

### Istniejaca tabela oauth_links
- Juz istnieje w server/migrations/055_security_module.sql.sql
- Kolumny: provider (TEXT), provider_user_id, provider_email, tokens, last_login_at
- Uzyj tej tabeli — NIE twórz nowej.

### i18n
- Pliki: public/locales/{en,pl}/translation.json
- Klucze NA KONCU pliku. Prefix: oauth., settings.connectedAccounts., profile.completeness.
- Minimum: EN + PL.

### Analytics events
- Rozszerz FunnelEventName w src/services/funnelAnalytics.ts jesli dodajesz nowe eventy.

### TypeScript strict mode
- Zawsze obsluguj nullable. Dodaj guard przed uzyciem.

### Testy — pre-existing failures
- Ignoruj pre-existing. Liczy sie TYLKO twoje pliki.

## Krok 3: Testy
npm run verify:quick
npm run test:protect (dotyka auth/security)

## Krok 4: Commit i raport

Commity: male logiczne. Format: bundle-30-5: [opis]

### Raport koncowy (WYMAGANY FORMAT)

**Bundle:** 30.5 — OAuth (T110-T112)
**Branch:** bundle-30-5-oauth
**Status:** in_review

**Pliki zmienione/dodane:**
| Plik | Typ zmiany | Opis |
|------|-----------|------|
| ... | ... | ... |

**Migracje DB:** tak/nie (numer i nazwa)

**Manual QA:**
T110:
- [ ] Google login: nowe konto -> user + oauth_link
- [ ] Google login: istniejacy email -> linkowanie (bez duplikatu)
- [ ] Zly state/timeout -> odmowa + redirect z auth_error
T111:
- [ ] LinkedIn login: nowe konto -> user + oauth_link
- [ ] LinkedIn login: istniejacy email -> linkowanie
- [ ] Brak email od provider -> bezpieczny fallback
T112:
- [ ] Connect LinkedIn z settings -> oauth_link zapisany
- [ ] Disconnect -> link usuniety + security event
- [ ] GET /api/settings/connected-accounts -> lista providerow
- [ ] Profile completeness sugeruje "Connect LinkedIn"
- [ ] Nudge dismiss -> nie wraca przez 30 dni

**Testy:**
- verify:quick: PASS/FAIL
- test:protect: PASS/FAIL
- type-check moich plikow: PASS/FAIL

**Ryzyka / otwarte pytania:**
- ...

**Konflikty z innymi bundlami:** tak/nie

## Zasady (MUST)
- NIGDY nie rob git reset --hard ani git clean -fd
- Brak stubow/placeholderow w produkcji
- i18n: EN + PL minimum
- Nie dotykaj plikow spoza scope (T110-T112)
- UI zgodne z docs/ui-standards/README.md
- **NIE edytuj** docs/plans/v2-delivery/progress.md
```

---

## PROMPT C — Codex -> Bundle 03 (Interview/Survey T013-T017)

```
Jestes agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 03 — Interview / Survey / Acquisition** (taski T013, T014, T015, T016, T017).

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-03-interview-survey

## Krok 2: Implementacja

### T013 — Conversational Control Questions (AI interview conductor)
Specyfikacja: docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md (szukaj "## T013")

Kluczowe deliverables:
- Tryb "Conversational" w sesji wywiadu: panel rozmowy (transkrypt) + panel listy pytan (task-list) z kategoriami
- AI jako "conductor": kolejnosc dowolna, skip/back/add custom question, doprecyzowanie gdy odpowiedz niepelna
- Automatyczne mapowanie rozmowy do odpowiedzi: POST /interview/sessions/:sessionId/ai-parse
- AI draft per pytanie: POST /interview/questions/:questionId/ai-suggest
- Voice-ready: speech-to-text input, TTS output (opcjonalnie)
- 6 jezykow: en, pl, de, ar, jp, es
- "Facts only" — brak rekomendacji w odpowiedziach/summary

### T014 — Modern Survey Experience (N-mode first)
Specyfikacja: docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md (szukaj "## T014")

Kluczowe deliverables:
- Spojny "survey shell": pasek postepu (sekcje + %), Next/Back/Skip, resume + autosave
- N-mode jako domyslny render (page-first: left nav + page canvas + properties strip)
- Redesign UI: typography, spacing, warianty pytan (single/multi choice, skala, free-text)
- Inline validation, quality helpers (mikrocopy, estimated time)
- i18n: 6 jezykow + RTL dla ar
- Events: survey_started/resumed/completed/abandoned

### T015 — External AI Self-Assessment Link (public mini-assessment)
Specyfikacja: docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md (szukaj "## T015")

Kluczowe deliverables:
- Publiczny URL (shareable) do mini-assessmentu, 6 jezykow + RTL
- Focus flow (single-question/small blocks) + progress
- Predefiniowany template (1-2 warianty)
- AI wynik po submit: executive snapshot + 3-5 bullet insightow + zalozenia + CTA
- Zapis wyniku: external assessment record z odpowiedziami + AI wynikiem + metadanymi
- Abuse protection: rate limiting
- Events: external_assessment_opened/started/completed/result_viewed/cta_clicked

### T016 — Advanced Insight Inference Engine
Specyfikacja: docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md (szukaj "## T016")

Kluczowe deliverables:
- "Inference run" generujacy structured output (JSON):
  - category (risk/opportunity/constraint/priority/trend/gap)
  - statement, why_it_matters, recommendation, confidenceScore (1-5)
  - evidence[] (sessionId + questionId + cytat)
  - assumptions[], unknowns[]
- Wejscia: interview_sessions + interview_questions + (opcjonalnie) assessment
- Traceability: kazdy insight ma evidence i jawny confidence
- Jakosc: unknowns + counterpoints + obnizone confidence przy mieszanych danych
- UI: N-mode "Insight pack" (left nav kategorie + canvas lista/detail + properties)
- Workflow: draft|reviewed|approved
- Export: do Tools/Assessment + przygotowanie pod T017
- Kontekst AI: zatwierdzone insighty staja sie czescia pamieci projektu

### T017 — Sponsor-Level Analysis Report (N-mode first, PPTX export)
Specyfikacja: docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md (szukaj "## T017")

Kluczowe deliverables:
- 1-2 kanoniczne report templates (Executive Board, Owner/PM)
- Dane wejsciowe: assessment + interview sessions + approved insights z T016
- Kazdy wniosek ma odwolanie do evidence
- Raport wywazone: assumptions, unknowns, counterpoints
- UI N-mode: left nav po sekcjach, canvas z trescia, properties strip
- Sekcje edytowalne (AI draft -> user poprawia)
- Workflow: DRAFT/GENERATING/PENDING_APPROVAL/APPROVED/FINAL/UTILIZED/ARCHIVED
- Export: PPTX jako primary
- i18n: 6 jezykow

Pliki do edycji (istniejace):
- src/components/Interview/InterviewWorkspace.tsx
- src/components/Interview/InterviewHub.tsx
- src/components/Interview/CategoryChat.tsx
- src/components/Interview/QuestionsList.tsx
- src/components/Interview/SummaryView.tsx
- src/components/Interview/InsightViewer.tsx
- src/components/Interview/InsightCreatorModal.tsx
- src/components/Interview/NewSessionModal.tsx
- server/src/controllers/InterviewController.ts
- server/src/routes/interview.routes.ts
- server/src/routes/assessment/assessment.routes.ts
- server/src/routes/assessment-reports.routes.ts
- src/components/assessment/AssessmentReportsWorkspace.tsx

## Kontekst techniczny projektu (MUST READ)

### Baza danych
- Projekt uzywa **PostgreSQL** (pg Pool). NIE SQLite.
- ORM/wrapper: server/src/database/PostgresDatabase.ts z funkcja adaptQuery().
- adaptQuery() konwertuje ? -> $1/$2, datetime('now') -> NOW(), IFNULL -> COALESCE.
- W kodzie serwisow uzywaj ? jako placeholderow.
- W migracji SQL pisz **natywny PostgreSQL**.
- Boolean: TRUE/FALSE, nie 1/0.

### Migracje
- Folder: server/migrations/
- Ostatni numer: 552. Uzyj kolejnego.
- Format: NNN_opis.sql, natywny PostgreSQL.

### i18n
- Pliki: public/locales/{en,pl}/translation.json
- Klucze NA KONCU pliku. Prefix: interview., survey., externalAssessment., insights., sponsorReport.
- Minimum: EN + PL.

### Analytics events
- Rozszerz FunnelEventName w src/services/funnelAnalytics.ts jesli dodajesz nowe eventy.

### TypeScript strict mode
- Zawsze obsluguj nullable. Dodaj guard przed uzyciem.

### UI Standards
- Przeczytaj docs/ui-standards/README.md PRZED edycja UI.
- N-mode (page-first) domyslny. Ikony: lucide-react.

### Testy — pre-existing failures
- Ignoruj pre-existing. Liczy sie TYLKO twoje pliki.

## Krok 3: Testy
npm run verify:quick

## Krok 4: Commit i raport

Commity: male logiczne. Format: bundle-03: [opis]

### RAPORT KONCOWY (WYMAGANY FORMAT — wypelnij DOKLADNIE)

**Bundle:** 03 — Interview / Survey / Acquisition (T013-T017)
**Branch:** bundle-03-interview-survey
**Status:** in_review

**Pliki zmienione/dodane:**
| Plik | Typ zmiany | Opis |
|------|-----------|------|
| ... | ... | ... |

**Migracje DB:** tak/nie (numer i nazwa)

**Manual QA:**
T013:
- [ ] Sesja z template -> conversational flow -> min 5 pytan answered
- [ ] ai-parse nie uzupelnia pytan bez wsparcia w transkrypcie
- [ ] Summary nie zawiera rekomendacji (tylko fakty)
T014:
- [ ] Ankieta: start -> odpowiedz -> refresh -> stan zachowany (autosave)
- [ ] Resume dziala (wraca do ostatniej sekcji)
- [ ] Mobile viewport — brak krytycznych problemow
- [ ] ar (RTL) — layout nie psuje nawigacji
T015:
- [ ] Publiczny link: wypelnienie na mobile -> completion bez bledow
- [ ] AI wynik sie generuje + CTA
- [ ] Rate limiting dziala
T016:
- [ ] Inference na 2 completed sessions -> min 5 insightow w JSON
- [ ] Kazdy insight ma >=1 evidence link
- [ ] Low-confidence trafiaja do gaps/unknowns
T017:
- [ ] Raport generuje sie z approved insightow
- [ ] Sekcje edytowalne, workflow approve/reject
- [ ] Export PPTX dziala

**Testy:**
- verify:quick: PASS/FAIL (pre-existing?)
- type-check moich plikow: PASS/FAIL

**Ryzyka / otwarte pytania:**
- ...

**Konflikty z innymi bundlami:** tak/nie

## Zasady (MUST)
- NIGDY nie rob git reset --hard ani git clean -fd
- Brak stubow/placeholderow w produkcji
- i18n: EN + PL minimum
- Nie dotykaj plikow spoza scope (T013-T017)
- UI zgodne z docs/ui-standards/README.md
- **NIE edytuj** docs/plans/v2-delivery/progress.md
```

---

## Po zakonczeniu pracy agentow

Gdy agent zglosi gotowosc ("in_review"):

1. Sprawdz branch: git switch bundle-XX-nazwa
2. Uruchom testy: npm run verify:quick (i test:protect jesli dotyczy)
3. Manual QA z checklisty
4. Merge: git switch main && git pull && git merge bundle-XX-nazwa --no-edit
5. Jesli konflikty w translation.json — rozwiaz recznie (klucze na koncu)
6. Push: git push origin main
7. Zaktualizuj progress.md centralnie: Status -> merged
