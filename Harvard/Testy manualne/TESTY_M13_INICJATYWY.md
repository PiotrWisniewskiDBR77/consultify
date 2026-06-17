# TESTY — M13 Inicjatywy

> **Moduł:** M13 Inicjatywy (`/initiatives`) — wg `Harvard/podzial/_MODULE_MAP_V2.md`
> **Zakres:** pełny cykl życia inicjatywy: tworzenie (wszystkie ścieżki) · dokument (~30 sekcji, `registry.ts`) · Charter/AI Wizard · maszyna stanów (13 statusów, bramki) · widoki portfolio (4) · ROI · Analysis · integracje cross-module
> **Źródła audytu:** `Harvard/modules/M13-inicjatywy/KARTA_AUDYTU.md` · `Harvard/wdrozenie-100/M13-inicjatywy.md` · `Harvard/podzial/inventory/INV_D_inicjatywy_wdrozenie_rezultaty_finanse.md`
> **SSOT kanonów:** `docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md` · `docs/initiatives/INITIATIVE_FORMULA.md` · `docs/standards/CARD_CONTENT_FORMULA.md`
> **Legenda:** **[MANUAL]** = ręczna weryfikacja (drag&drop / OAuth / incognito); **[FLAG]** = zależne od flagi/capability/roli; **[DB]** = dowód = wiersz/kolumna w bazie
> **Data:** 2026-06-16

---

## 0. Kontekst architektoniczny

### Mapa komponentów

| Obszar | Komponent / plik | Stan / store |
|---|---|---|
| Hub (lista, filtry, widoki) | `InitiativesHub.tsx` (~2000+ l.) | `initiatives[]`, `allInitiatives[]`, `activeStatusFilter`, `scope`, `openDocuments[]` |
| Lista / PortfolioListView | `PortfolioListView.tsx` | `initiatives[]` + filtry lokalne |
| Kanban | `InitiativesHub` → widok `kanban` | DnD per kolumna |
| Timeline/Gantt | `InitiativesTimelineView.tsx` | `initiatives[]` + timeline data |
| Dokument inicjatywy | `InitiativeDocumentView.tsx` | sekcje per inicjatywa |
| Sekcje (~30 kluczy) | `sections/registry.ts` → `SECTION_REGISTRY` | `DEFAULT_SECTION_ORDER`, `DEFAULT_VISIBLE_SECTIONS` |
| Preview panel | `InitiativePreviewV3.tsx` | drawer/panel |
| Drawer | `InitiativeDrawer.tsx` | — |
| Pełny widok | `InitiativeFullView.tsx` | — |
| Wizard AI | `Wizard/InitiativeWizardModal.tsx` | session-based (BE `initiativeWizardService`) |
| Charter Wizard | `Wizard/InitiativeCharterWizard.tsx` | modal |
| Generator propozycji | `Wizard/InitiativeGeneratorModal.tsx` | — |
| Analysis | `Analysis/AnalysisWorkspacePanel.tsx` + 6 podwidoków | — |
| Graf zależności | `Analysis/DependencyGraphCanvas.tsx` | — |
| Backend — endpointy | `server/src/routes/pmo/initiatives.routes.ts` | ~80 endpointów |
| Backend — maszyna stanów | `server/src/services/stageGateService.ts` | `GATE_CRITERIA`, `evaluateGate`, `getGateType` |
| Typy i statusy | `src/types/initiative.ts` + `src/types/core.ts` | 13 statusów, `GATE_PERMISSIONS` |
| Typy cyklu | `src/services/initiativeLifecycle.ts` | `VALID_TRANSITIONS`, `STATUS_METADATA` |

### Pełna maszyna stanów (13 statusów)

> **UWAGA — dwie warstwy prawdy (zweryfikowane w kodzie 2026-06-16):**
> 1. **Model kanoniczny** (`src/services/initiativeLifecycle.ts` `VALID_TRANSITIONS` + `server/src/constants/initiativeStatuses.ts` `GATE_TRANSITIONS`) — pełny 13-statusowy pipeline z bramkami i rolami. To jest projekt docelowy.
> 2. **Realne dedykowane endpointy** (`InitiativeController.ts`) — NIE pokrywają pełnego modelu; przejścia ograniczone i z innymi nazwami statusów (lowercase w DB). RBAC ról egzekwowany TYLKO na `PATCH /:id/status` (handler `updateInitiativeStatus`), a NIE na dedykowanych endpointach (`/submit-review`, `/approve`, `/reject`, `/start-execution`, `/block`, `/unblock`, `/complete`, `/archive`).
>
> **Testuj realny stan; rozbieżność z modelem kanonicznym = otwarty defekt do odnotowania.**

Model kanoniczny (`VALID_TRANSITIONS`):
```
DRAFT → PENDING_REVIEW → REVIEW → PROMOTED → PLANNING → APPROVED → SCHEDULED → EXECUTING → DONE → TRACKING
                                                                           ↓
                                                                       BLOCKED (EXECUTING ↔ BLOCKED)
                                        CANCELLED (z DRAFT…BLOCKED, przed DONE)
                                        ARCHIVED  (terminal; w VALID_TRANSITIONS tylko z TRACKING/CANCELLED)
```

**Realne dedykowane endpointy — przejścia 1:1 (zweryfikowane w `InitiativeController.ts`, statusy DB lowercase):**
| Endpoint | from (DB) | to (DB) | Guard statusu | Guard roli (serwer) |
|---|---|---|---|---|
| `POST /:id/submit-review` (`submitForReview` ~:2803) | `planning` | `review` | tak (400 jeśli ≠ `planning`) | **BRAK** |
| `POST /:id/approve` (`approveInitiative` ~:2855) | `review` | `approved` | tak (400 jeśli ≠ `review`) | **BRAK** |
| `POST /:id/reject` (`rejectInitiative` ~:2907) | `review` | `planning` | tak (400 jeśli ≠ `review`) | **BRAK** |
| `POST /:id/start-execution` (`startExecution` ~:2955) | `approved` | `executing` | tak (400 jeśli ≠ `approved`) | **BRAK** |
| `POST /:id/block` (`blockInitiative` ~:3002) | dowolny (brak guarda) | `blocked` | **BRAK** | **BRAK** |
| `POST /:id/unblock` (`unblockInitiative` ~:3036) | — (zweryfikuj) | `executing` | zweryfikuj | **BRAK** |
| `POST /:id/complete` (`completeInitiative` ~:3068) | — (zweryfikuj) | `done` | zweryfikuj | **BRAK** |
| `POST /:id/archive` (`archiveInitiative` ~:3193) | `done` lub `cancelled` | `archived` | tak (400 dla reszty) | **BRAK** |
| `PATCH /:id/status` (`updateInitiativeStatus` ~:1127) | wg `VALID_TRANSITIONS` | dowolny dozwolony | tak (`isValidTransition`) | **TAK** — `getGateForTransition` + `GATE_PERMISSIONS` → **403** jeśli rola nie pasuje |

> **Kluczowe rozbieżności realny↔kanon (defekty do odnotowania):**
> - `submit-review` realnie `planning→review`, NIE `DRAFT→PENDING_REVIEW` jak w modelu/bramce SUBMIT_FOR_REVIEW.
> - Statusy `PENDING_REVIEW`, `PROMOTED`, `SCHEDULED` **nie mają dedykowanego endpointu** — osiągalne tylko przez `PATCH /:id/status` (model kanoniczny). Na dedykowanych ścieżkach są pominięte. **[BRAK ENDPOINTU — defekt implementacji vs model kanoniczny]**
> - `DONE→TRACKING` i `APPROVED→SCHEDULED` — brak dedykowanego endpointu; tylko `PATCH /:id/status`. **[oznaczone]**
> - `/move` = przeniesienie inicjatywy między projektami (`targetProjectId`), **NIE** zmiana statusu. Nie używać do przejść statusów.

**Moduły per status (widoczność):**
| Moduł | Statusy widoczne |
|---|---|
| Tools / Assessment | DRAFT, PENDING_REVIEW |
| Inicjatywy (M13) | REVIEW, PROMOTED, PLANNING, APPROVED, SCHEDULED, CANCELLED, ARCHIVED |
| Wdrożenie (M14) | SCHEDULED, EXECUTING, BLOCKED, DONE |
| Rezultaty (M15) | TRACKING |

**Bramki i role (`src/types/initiative.ts`, `GATE_PERMISSIONS`):**
| Bramka | Role | Przejście |
|---|---|---|
| SUBMIT_FOR_REVIEW | INITIATIVE_OWNER | DRAFT→PENDING_REVIEW |
| APPROVE_TO_INITIATIVE | PROJECT_MANAGER, PROJECT_LEAD, PMO | PENDING_REVIEW→REVIEW |
| PROMOTE | PROJECT_SPONSOR | REVIEW→PROMOTED |
| ACCEPT | PROJECT_SPONSOR, STEERING_COMMITTEE | PROMOTED→PLANNING |
| REJECT | PROJECT_SPONSOR, STEERING_COMMITTEE | REVIEW→DRAFT (odrzucenie) |
| START_PLANNING | PMO | PLANNING→… |
| APPROVE | STEERING_COMMITTEE | PLANNING→APPROVED |
| SCHEDULE | PMO | APPROVED→SCHEDULED |
| START | PMO | SCHEDULED→EXECUTING |
| BLOCK | INITIATIVE_OWNER, PMO | EXECUTING→BLOCKED |
| UNBLOCK | PROJECT_SPONSOR, STEERING_COMMITTEE | BLOCKED→EXECUTING |
| COMPLETE | INITIATIVE_OWNER, PMO | EXECUTING→DONE |
| START_TRACKING | BUSINESS_OWNER | DONE→TRACKING |
| CANCEL | PMO, STEERING_COMMITTEE | dowolny status → CANCELLED |

> **Bramki = tylko model kanoniczny.** Egzekwowane na serwerze WYŁĄCZNIE przez `PATCH /:id/status` (`updateInitiativeStatus`). Dedykowane endpointy przejść (`/submit-review`, `/approve`, …) NIE wołają `canExecuteGate` ani `GATE_PERMISSIONS` → ról nie sprawdzają. Powyższa mapa from→to (kanon) różni się od realnych dedykowanych endpointów (patrz tabela w sekcji „Pełna maszyna stanów").

**Sprzeczność źródeł — CONSULTANT / SUBMIT_FOR_REVIEW (do odnotowania):**
- `src/types/initiative.ts` → `canExecuteGate(CONSULTANT, *)` zwraca `false` ZAWSZE (CONSULTANT nie może nawet SUBMIT_FOR_REVIEW), mimo że `GATE_PERMISSIONS[SUBMIT_FOR_REVIEW]` zawiera `CONSULTANT`.
- `server/src/constants/initiativeStatuses.ts` → `canExecuteGate(CONSULTANT, SUBMIT_FOR_REVIEW)` zwraca `true` (CONSULTANT MOŻE submitować własną pracę).
- **Dwie definicje `canExecuteGate` przeczą sobie.** Realne zachowanie API zależy od tego, którą importuje `resolveInitiativeAccessContext` w kontrolerze — zweryfikuj empirycznie. Admin ma techniczny override (logowany) w obu.

### Zasada weryfikacji E2E (OBOWIĄZKOWA)

Każde tworzenie / zmiana statusu / edycja sekcji MUSI być potwierdzona:
1. **Network** — właściwy endpoint (metoda + URL + kod odpowiedzi)
2. **Payload** — sprawdź body żądania (method, pola) lub query param
3. **UI** — aktualizacja widoku (chip statusu, treść sekcji)
4. **Reload** — po odświeżeniu strony stan przetrwał

Sama zmiana wyglądu w UI BEZ żądania sieciowego = FAIL.

### Znane otwarte luki (uwzględnij w testach)

| ID | Opis | Oczekiwany wynik testu |
|---|---|---|
| L-01 | ~~Tworzenie z huba disabled~~ ZDEZAKTUALIZOWANE — CTA Wizard/Charter/New są stałe (`InitiativesHub.tsx:1898/1908/1937`, „present at all times") | CTA WIDOCZNE i działają dla Ownera; tylko pilot bez `primaryCta`; deep-link `?new=1` DZIAŁA |
| L-03 | UI nie pokazuje pełnego pipeline statusów / CTA per rola | Udokumentuj rozbieżność z MATRIX |
| L-05 | Cicha degradacja V8 bez banera | Udokumentuj czy user widzi pustkę czy komunikat |
| L-06 | Gating pilota VTS tylko klient, serwer nie blokuje | Test API bezpośrednio dla roli pilot → oczekiwany 403 (FAIL jeśli 200) |
| L-12 | Router governance (`/api/initiatives-v4`) potencjalnie org-spoofable | Verify w Network |

---

## Setup środowiska testowego

1. Uruchom dev server frontend (`:3000`) i backend (`:3001`).
2. Zaloguj się jako **Owner DBR77** (pełne uprawnienia).
3. Przygotuj drugie konto z rolą **Pilot VTS** (`isPilotParticipantRole=true`).
4. Otwórz **DevTools → Network** z filtrem `/api/initiatives` + `/api/pmo/initiatives` oraz `/api/economics`.
5. Otwórz **DevTools → Console** — przez całą sesję zero nowych błędów konsoli (poza wyraźnie odnotowanymi).
6. **Dane testowe:**
   - Co najmniej 1 inicjatywa w każdym statusie (lub utwórz w trakcie testu)
   - Co najmniej 3 insighty z M10 (Wywiad) z wypełnioną `material_quality_json`
   - Demo org z Atelier Toys (do testów flag demo)
7. **DB bezpośredni dostęp** (dla asercji `[DB]`): połączenie z Railway staging (nie prod).
8. **Monitoring konsoli statusów:** przed każdym przejściem statusu otwórz konsolę i obserwuj przez 5 sek. po przejściu.

---

## §1. Tworzenie inicjatywy — wszystkie ścieżki

### 1a. Tworzenie z huba [L-01 zdezaktualizowane — CTA są stałe]

**Cel:** potwierdzić, że CTA tworzenia są obecne (NIE wyłączone) i działają.

> **Aktualizacja premisy:** L-01 („hub disabled") jest NIEAKTUALNE. W `InitiativesHub.tsx` przyciski **AI Initiative Wizard** (`setShowInitiativeWizard(true)`, ~:1898) i **Charter** (`setShowCharter(true)`, ~:1908) są renderowane w prawej grupie Menu 3 z komentarzem „Present at all times (not conditional)". Dodatkowo `primaryCta` „Nowa inicjatywa" (~:1937) jest obecny dla wszystkich poza pilotem (`isPilotParticipant ? undefined : <button>`). NIE ma wyszarzenia.

1. Wejdź na `/initiatives` jako Owner DBR77.
2. Sprawdź pasek górny (Menu 3 / commandRow):
   - **Asercja:** przycisk „AI Initiative Wizard" jest widoczny i klikalny → kliknij → otwiera `InitiativeWizardModal`.
   - **Asercja:** przycisk „Charter" jest widoczny i klikalny → kliknij → otwiera `InitiativeCharterWizard`.
   - **Asercja:** `primaryCta` „Nowa inicjatywa" (`initiatives.form.newInitiative`) jest widoczny dla Ownera (kod ~:1937: `!isPilotParticipant` → widoczny).
   - **Dla roli Pilot VTS:** `primaryCta` jest niewidoczny (`isPilotParticipant → undefined`) [FLAG].
3. **Raport:** jeśli którykolwiek z trzech CTA jest disabled/nieobecny dla Ownera — to regresja względem kodu (CTA mają być stałe), odnotuj jako defekt.

**Weryfikacja negatywna (pilot):**
- Zaloguj się jako Pilot VTS.
- Sprawdź, że przycisk „Nowa inicjatywa" nie jest widoczny (linia `:1937`: `isPilotParticipant ? undefined : <button>`).
- Przejdź na `/initiatives?new=1` — oczekiwane: `dispatchPilotAccessBlocked` → blokada, modal NIE otwiera się.

---

### 1b. Tworzenie przez deep-link `?new=1` [FLAG]

**Cel:** potwierdzić, że deep-link działa dla Owner i jest blokowany dla Pilot.

**Kroki (Owner):**
1. Wejdź bezpośrednio na `/initiatives?new=1`.
2. **Asercja:** modal tworzenia otwiera się (`setShowNewModal(true)` `:858`).
3. Sprawdź, że `?new=1` zostaje usunięty z URL po obsłużeniu (replace history).
4. Wypełnij formularz (tytuł wymagany, pozostałe opcjonalne) i kliknij „Utwórz".
5. **Network:** `POST /api/initiatives` → `201 Created`, body zawiera `{ id, title, status, organizationId }`.
6. **UI:** nowa inicjatywa pojawia się na liście ze statusem DRAFT.
7. **Reload:** `GET /api/initiatives` → inicjatywa widoczna. [DB]
8. **Asercja DB:** `SELECT id, title, status, organization_id FROM initiatives WHERE id = '<nowe_id>'` → wiersz istnieje, `organization_id = <org_DBR77>`.
   - **UWAGA casing:** `createInitiative` (~:539) zapisuje `status ?? null` (to co wyśle klient, lub NULL) — NIE wymusza `'DRAFT'`. API normalizuje status do UPPERCASE dopiero na odczycie (`normalizeStatus`, ~:76). Zweryfikuj realną wartość w DB (może być `'draft'`, `'DRAFT'` albo `NULL`) i odnotuj. Przejścia statusów zapisują lowercase (`'review'`, `'approved'`, …) → kolumna `status` ma mieszany casing.

**Edge case — brak tytułu:**
- Wyczyść pole tytułu i kliknij „Utwórz" → walidacja blokuje wysłanie, komunikat błędu widoczny.

**Kroki (Pilot VTS):**
1. Zaloguj się jako Pilot VTS, wejdź na `/initiatives?new=1`.
2. **Asercja:** modal NIE otwiera się; pojawia się komunikat blokady dostępu (lub redirect).

---

### 1c. Tworzenie z `generate_from_evidence` (z M10 Wywiad) [DB]

**Cel:** E2E test ścieżki InsightHub → inicjatywa (scenariusz S5 z karty audytu).

**Kroki:**
1. Przejdź do M10 Wywiad (`/discovery`) → otwórz wywiad z min. 3 insightami.
2. Zaznacz insighty (checkboxy na liście insightów).
3. Kliknij przycisk „Utwórz inicjatywy" / „Generuj inicjatywy z insightów" (przycisk w InterviewHub triggeruje `setShowInitiativeWizard(true)` z `initialMode="generate_from_evidence"` `:13041`).
4. **Asercja:** otwiera się `InitiativeWizardModal` z trybem `generate_from_evidence`.
5. W modalu:
   - Sprawdź, że `initialSourceBasket` zawiera zaznaczone insighty (`initiativeWizardSourceBasket`).
   - Krok 1: sesja jest tworzona — **Network:** `POST /api/initiatives/wizard/sessions` → `201`, body `{ session: { id, mode: "generate_from_evidence", ... } }`.
   - Krok 2: generacja kandydatów — **Network:** `POST /api/initiatives/wizard/sessions/:sessionId/candidates/generate` → `201`, body `{ candidates: [...] }`.
   - Krok 3: Przeglądaj kandydatów w `InitiativeProposalBoard`.
   - Dla każdego kandydata: kliknij „Przyjmij do shortlisty" → **Network:** `PATCH /api/initiatives/wizard/candidates/:candidateId/triage` → `200`, body `{ triageStatus: "accepted_for_shortlist" }`.
6. Shortlist Gate: **Network:** `GET /api/initiatives/wizard/sessions/:sessionId/shortlist-gate` → `{ gate: { ok: true/false, ... } }`.
7. Kliknij „Utwórz drafty": **Network:** `POST /api/initiatives/wizard/sessions/:sessionId/drafts-created` → `200`.
8. Następnie `POST /api/initiatives` dla każdego kandydata na shortliście → `201` per inicjatywa.
9. **Asercja UI:** nowe inicjatywy pojawiają się na liście M13 ze statusem DRAFT.
10. **Asercja DB:** `SELECT id, title, status, evidence_refs_json FROM initiatives WHERE id IN (...)` → `evidence_refs_json` zawiera `interview_insight:<insightId>`.
11. **Asercja linii w karta:** sprawdź `InterviewHub.tsx:12955` — przycisk „Generuj inicjatywy" jest dostępny gdy są zaznaczone insighty.

**Edge case — brak insightów:**
- Wywiad bez insightów → przycisk „Generuj" jest niewidoczny lub disabled.

**Edge case — kandydaci odrzuceni:**
- Wszystkie kandydatury w stanie `rejected` → shortlist gate blokuje, komunikat o braku kandydatów.

---

### 1d. Tworzenie z czatu AI Teresa [MANUAL]

**Cel:** potwierdzić, że Teresa rozumie intent „utwórz inicjatywę" i otwiera właściwy moduł.

1. Przejdź do `/chat` (M01).
2. Wyślij wiadomość: „Chcę stworzyć nową inicjatywę dot. automatyzacji procesów HR".
3. **Asercja:** Teresa odpowiada z propozycją lub linkiem do M13; NIE tworzy inicjatywy samodzielnie bez potwierdzenia usera.
4. Jeśli jest link/CTA „Przejdź do Inicjatyw" — kliknij i potwierdź, że prowadzi na `/initiatives` (lub `/initiatives?new=1`). [MANUAL]
5. Odnotuj, czy Teresa używa kontekstu organizacji przy sugerowaniu inicjatywy.

---

### 1e. Tworzenie z szablonu (apply-template / apply-blueprint) [FLAG]

**Cel:** potwierdzić, że szablony tworzą inicjatywę z prefillowanymi sekcjami.

**Lista szablonów:**
1. `GET /api/initiatives/templates` → lista szablonów (publiczne + org); sprawdź response `{ templates: [...] }`.
2. Wybierz szablon z listy (jeśli brak — utwórz przez `POST /api/initiatives/templates`).

**Apply template:**
1. Utwórz inicjatywę DRAFT (ścieżka 1b lub przez UI).
2. W dokumencie inicjatywy: znajdź opcję „Zastosuj szablon" (jeśli dostępna w UI).
3. **Network:** `POST /api/initiatives/:id/apply-template`, body `{ templateId: "...", ... }` → `200`, body zawiera zaktualizowane sekcje.
4. **Asercja:** sekcje dokumentu inicjatywy są wypełnione treścią z szablonu.
5. **Reload** → zmiany trwałe.

**Apply blueprint:**
1. `POST /api/initiatives/:id/apply-blueprint`, body `{ blueprintId: "...", ... }` → `200`.
2. Sprawdź, czy WBS (Work Breakdown Structure) został zaaplikowany: `GET /api/initiatives/templates/:templateId/wbs` → `{ wbs: [...] }`.

**Negatywny — system template:**
- Próba edycji/usunięcia szablonu systemowego (`isPublic=true` bez `organizationId`) → `403 Cannot edit system templates`.

---

### 1f. Duplikacja istniejącej inicjatywy [DB]

**Cel:** potwierdzić, że duplikacja tworzy nową inicjatywę DRAFT z tytułem „(Copy)".

1. Wybierz istniejącą inicjatywę (dowolny status).
2. Kliknij opcję „Duplikuj" w kebab menu lub action bar.
3. **Network:** `POST /api/initiatives/:id/duplicate` → `201`, body `{ id: "<nowy_uuid>" }`.
4. **Asercja:**
   - Nowa inicjatywa pojawia się na liście.
   - Tytuł: `"<oryginalny tytuł> (Copy)"` (lub customowy jeśli podany w body).
   - Status: `DRAFT` (zawsze resetowany).
5. **Asercja DB:** `SELECT id, title, status FROM initiatives WHERE id = '<nowe_id>'` → status=`DRAFT`, title kończy się na `(Copy)`. [DB]
6. **Negatywny — duplikacja cudzej inicjatywy:** zmanipuluj `:id` na inicjatywę z innej org → `404 Initiative not found`.

---

### 1g. Merge i Extend z insightu

**Cel:** potwierdzić addytywną aktualizację inicjatywy z insightu (nie tworzy duplikatu).

**Merge:**
1. `POST /api/initiatives/:id/merge-from-insight`, body:
   ```json
   { "sourceInsightId": "<istniejący_insight_id>", "summary": "Treść insightu" }
   ```
2. **Asercja response:** `{ ok: true, mode: "merge", sourceInsightIds: [...], initiative: { id, evidenceRefs: [...] } }`.
3. **Asercja:** `evidence_refs_json` inicjatywy zawiera `interview_insight:<insightId>`.
4. **Asercja:** oryginalna treść (`hypothesis`/`summary`) NIE jest nadpisana — dopisany jest przypis `[timestamp] Merged from insight...`. [DB]

**Extend:**
1. `POST /api/initiatives/:id/extend-from-insight`, body:
   ```json
   { "sourceInsightId": "<id>", "summary": "Nowy zakres", "scopeText": "Szczegółowy zakres" }
   ```
2. **Asercja:** `scope_in` JSON array w DB zawiera nową pozycję. [DB]

**Negatywny — brak sourceInsightId:**
- Body bez `sourceInsightId` i bez `sourceInsightIds` → `400` z komunikatem Zod.

---

## §2. Dokument inicjatywy (~30 sekcji)

### 2.1 Nawigacja przez sekcje (SECTION_REGISTRY)

**Pełna lista sekcji z `registry.ts`:**

| Klucz | Komponent | Domyślnie widoczna |
|---|---|---|
| overview | OverviewSection | tak |
| problemDefinition | ProblemDefinitionSection | tak |
| targetState | TargetStateSection | tak |
| scope | ScopeSection | tak |
| tasks | TasksMilestonesSection | tak |
| decisions | DecisionsSection | tak |
| raid | RaidSection | tak |
| gates | GateReadinessSection | tak |
| financialAnalysis | FinancialAnalysisSection | tak |
| financialImpact | FinancialImpactSection | tak |
| kpis | KpisSection | tak |
| competencyRequirements | CompetencyRequirementsSection | tak |
| skillsGap | SkillsGapSection | tak |
| comments | CommentsSection | tak |
| history | HistorySection | tak |
| control | ControlSection | tak |
| team | TeamSection | tak |
| timeline | TimelineSection | tak |
| resources | ResourcesSection | tak |
| stakeholders | StakeholdersSection | tak |
| dependencies | DependenciesSection | tak |
| attachments | AttachmentsSection | tak |
| tags | TagsSection | tak |
| reminders | RemindersSection | tak |
| pilot | PilotSection | NIE (domyślnie off) |
| watchers | OverviewSection (alias) | NIE |
| initiativeTeam | InitiativeTeamSection | NIE |
| raciEscalation | RaciEscalationSection | NIE |
| linkedItems | LinkedItemsSection | NIE |

**Kroki:**
1. Otwórz dokument inicjatywy DRAFT.
2. Sprawdź, że wszystkie sekcje domyślnie widoczne (`DEFAULT_VISIBLE_SECTIONS: true`) są renderowane.
3. Sprawdź, że sekcje off (`pilot`, `watchers`, `initiativeTeam`, `raciEscalation`, `linkedItems`) NIE są widoczne bez włączenia.
4. Jeśli istnieje panel „Widoczność sekcji" / toggle — włącz sekcję `pilot` i sprawdź, że `PilotSection` pojawia się.
5. **Asercja:** nieznany klucz sekcji (`getSectionComponent("unknown_key")`) → zwraca `null`, brak białego ekranu.

---

### 2.2 Edycja sekcji — scenariusze per typ

**Dla każdej z niżej wymienionych sekcji przetestuj cykl: otwórz → edytuj → zapisz → przeładuj → trwałość.**

#### 2.2.1 OverviewSection (rich text)
1. Kliknij w pole tekstowe sekcji overview.
2. Wpisz/zmodyfikuj tekst (np. „Opis inicjatywy testowej {timestamp}").
3. Kliknij „Zapisz" / blur z pola.
4. **Network:** `PUT /api/initiatives/:id` lub `PATCH /api/initiatives/:id` → `200`, response zawiera nową wartość `overview` lub `hypothesis`.
5. **Reload → asercja:** tekst zachowany.
6. **Asercja DB** [DB]: `SELECT overview FROM initiatives WHERE id = '...'` (lub odpowiednia kolumna).

#### 2.2.2 KpisSection (tabela)
1. Kliknij „Dodaj KPI" w sekcji kpis.
2. Wypełnij pola: nazwa, wartość bazowa, cel, jednostka.
3. Zapisz.
4. **Network:** `POST /api/initiatives/:id/kpis` → `201`, body `{ id, name, baselineValue, targetValue, unit, ... }`.
5. Edytuj istniejące KPI → `PUT /api/initiatives/:id/kpis/:kpiId` → `200`.
6. Usuń KPI → `DELETE /api/initiatives/:id/kpis/:kpiId` → `200` lub `204`.
7. **Reload:** KPI zachowane/usunięte.

#### 2.2.3 RaidSection (checklisty/tabela)
1. Dodaj RAID item (Risk/Assumption/Issue/Dependency): kliknij „Dodaj".
2. Wypełnij: typ (Risk/Assumption/Issue/Dependency), opis, właściciel, priorytet.
3. **Network:** `POST /api/initiatives/:id/raid` → `201`.
4. Edytuj → `PATCH /api/initiatives/:id/raid/:raidId` → `200`.
5. Usuń → `DELETE /api/initiatives/:id/raid/:raidId` → `200`.

#### 2.2.4 TasksMilestonesSection (lista zadań i milestone'ów)
1. Dodaj milestone: kliknij „Dodaj milestone".
2. **Network:** `POST /api/initiatives/:id/milestones` → `201`.
3. Edytuj → `PUT /api/initiatives/:id/milestones/:milestoneId` → `200`.
4. Usuń → `DELETE /api/initiatives/:id/milestones/:milestoneId` → `200`.

#### 2.2.5 StakeholdersSection
1. Dodaj interesariusza: kliknij „Dodaj".
2. **Network:** `POST /api/initiatives/:id/stakeholders` → `201`.
3. Usuń → `DELETE /api/initiatives/:id/stakeholders/:stakeholderId` → `200`.

#### 2.2.6 AttachmentsSection
1. Wgraj plik (PDF/DOCX).
2. **Network:** żądanie uploadu → potwierdzenie.
3. Plik widoczny na liście załączników.
4. Usuń → plik znika z listy.

#### 2.2.7 CommentsSection
1. Dodaj komentarz → `POST /api/initiatives/:id/comments` → `201`.
2. Usuń swój komentarz → `DELETE /api/initiatives/:id/comments/:commentId` → `200`.
3. **Asercja roli:** zwykły user nie może usunąć cudzego komentarza (chyba że Admin).

#### 2.2.8 HistorySection
1. Sprawdź, że `GET /api/initiatives/:id/history` → lista zdarzeń historycznych.
2. Po edycji i zapisie → historia zawiera nowy wpis z aktualnym timestamp i ID usera.
3. **Asercja:** historia read-only (brak przycisku edycji).

#### 2.2.9 TagsSection
1. Dodaj tag → sekcja zapisuje się.
2. **Network:** `PUT /api/initiatives/:id` lub dedykowany PATCH z polem `tags`.
3. Usuń tag → tag znika.

#### 2.2.10 DependenciesSection
1. Dodaj zależność do innej inicjatywy.
2. **Network:** `POST /api/initiatives/portfolio/dependencies`, body `{ fromId, toId, type }` → `201`.
3. Usuń → `DELETE /api/initiatives/portfolio/dependencies/:id` → `200`.
4. **Asercja:** zależność widoczna w sekcji + w grafie Analysis.

---

### 2.3 Autosave vs. manual save

1. Edytuj pole tekstowe w sekcji (np. overview).
2. Poczekaj bez klikania „Zapisz" — sprawdź czy autosave jest aktywny (Network żądanie po debounce ~2s).
3. Odnotuj czy jest wskaźnik stanu zapisu (np. „Zapisano", „Niezapisane zmiany").
4. **Edge case:** edytuj, szybko odśwież (`Ctrl+R`) przed autosave — czy jest ostrzeżenie `beforeunload`?

---

### 2.4 AI-fill sekcji wg formuły [FLAG — L-04]

**Cel:** przetestować `/generate-section` per sekcja.

1. Otwórz sekcję `problemDefinition` w dokumencie DRAFT.
2. Znajdź przycisk „Generuj z AI" / „Uzupełnij AI" (jeśli dostępny — L-04 is open).
3. **Network:** `POST /api/initiatives/generate-section`, body:
   ```json
   { "initiativeId": "...", "sectionKey": "problemDefinition", "context": {...} }
   ```
4. **Asercja response:** `{ content: "...", sectionKey: "problemDefinition" }` lub podobna struktura.
5. **Asercja:** wygenerowana treść pojawia się w sekcji (do zatwierdzenia lub bezpośrednio).
6. Jeśli przycisk AI nie istnieje → odnotuj jako L-04 PENDING (nie zaimplementowane w UI).

**Readiness analysis:**
1. `POST /api/initiatives/readiness-analysis`, body zawierający `initiativeId` i sekcje.
2. **Asercja response:** `{ analysis: { completeness, missingElements, suggestions } }`.

**Suggest sections:**
1. `POST /api/initiatives/suggest-sections`, body z kontekstem.
2. **Asercja response:** `{ sections: [...] }` z rekomendowanymi sekcjami.

---

### 2.5 Completeness score vs CARD_CONTENT_FORMULA

1. Przejdź do zakładki Analysis → CompletenessAnalysis.
2. **Asercja:** widać `completenessScore` per sekcja oraz overall.
3. Sprawdź sekcję `overview` — czy posiada: tytuł, hipotezę, zakres, cel (wg CARD_CONTENT_FORMULA §B3)?
4. Wypełnij brakujące pola → score powinien wzrosnąć.
5. **Network:** `GET /api/initiatives/:id/gate-readiness-check` → `{ readiness: [...], completenessScore: ... }`.

---

### 2.6 DEFAULT_SECTION_ORDER i customizacja kolejności

1. Sprawdź, że sekcje w dokumencie renderują się w kolejności wg `DEFAULT_SECTION_ORDER` (overview=10, problemDefinition=20, …).
2. Jeśli jest opcja „Przeciągnij sekcję" (drag handle) — zmień kolejność i zapisz. [MANUAL]
3. **Reload:** kolejność zachowana.

---

## §3. Charter Wizard i AI Wizard

### 3.1 Charter Wizard (`InitiativeCharterWizard`)

**Stan:** `showCharter` jest mount'owany w `InitiativesHub.tsx:1991-2000`. Sprawdź, czy jest CTA triggerujące `setShowCharter(true)`.

1. Otwórz Charter Wizard (jeśli jest CTA) lub bezpośrednio zmień `showCharter=true` w DevTools React (dla QA).
2. **Krok 1 — dane podstawowe:** wypełnij: tytuł, opis problemu, właściciel.
3. **Krok 2 — cel i zakres:** wypełnij cel SMART i zakres.
4. **Krok 3 — zasoby i timeline:** budżet, termin, zasoby.
5. Sprawdź walidację każdego kroku (wymagane pola → błąd + blokada przycisku „Dalej").
6. Sprawdź powrót między krokami (przycisk „Wstecz") — dane nie są tracone.
7. Kliknij „Generuj z AI" (jeśli dostępny) — `POST /api/initiatives/generate-section` z kontekstem.
8. Kliknij „Utwórz" — `POST /api/initiatives` → `201`, nowa inicjatywa DRAFT z prefillowanymi sekcjami.
9. **Reload:** inicjatywa i jej charter trwałe.

---

### 3.2 AI Wizard (`InitiativeWizardModal`) — tryby

**Tryby dostępne (z kodu `:WizardSessionSchema.mode`):**
- `create_first_portfolio`, `generate_from_evidence`, `prioritize_by_goal`, `match_existing`, `refresh_portfolio`, `build_waves`, `improve_portfolio`

**Kroki wspólne dla wszystkich trybów:**
1. Otwórz Wizard (przez `setShowInitiativeWizard(true)` — trigger z huba, jeśli CTA dostępne, lub z M10).
2. Krok 1 — wybór trybu: sprawdź dropdown z wartościami (`create_first_portfolio`, etc.).
3. **Network kroku 1:** `POST /api/initiatives/wizard/sessions` → `201`, response `{ session: { id, mode, ... } }`.
4. Krok 2 — generacja: `POST /api/initiatives/wizard/sessions/:sessionId/candidates/generate` → `201`.
5. Krok 3 — przeglądanie kandydatów: lista wyświetla kandydatów z `InitiativeProposalBoard`.
6. Krok 4 — triage: `PATCH /api/initiatives/wizard/candidates/:candidateId/triage` per kandydat.
7. Sprawdź Shortlist Gate: `GET /wizard/sessions/:sessionId/shortlist-gate` → `{ gate: { ok, ... } }`.
8. Krok 5 — tworzenie: `POST /wizard/sessions/:sessionId/drafts-created` + `POST /api/initiatives` per kandydat.
9. **Asercja:** po zamknięciu modala nowe inicjatywy pojawiają się w liście M13.

**Similarity check:**
- Podczas wizarda: `POST /api/initiatives/similarity-check`, body `{ candidates: [{title, description}] }`.
- **Asercja response:** `{ results: [{ title, isSimilar, matchingInitiatives }] }`.
- Jeśli kandydat jest podobny do istniejącej → ostrzeżenie w UI.

**Audit log:**
- `GET /api/initiatives/wizard/sessions/:sessionId/audit-events` → lista zdarzeń sesji.

**Edge case — anulowanie w połowie:**
- Zamknij modal w kroku 3 (po generacji, przed triagem) → sesja może być niedokończona; odnotuj co się dzieje przy ponownym otwarciu.

---

### 3.3 Walidacje

| Pole | Walidacja Zod | Oczekiwane |
|---|---|---|
| `targetCount` | `int.min(1).max(10)` | 0 lub 11 → `400` |
| `timeHorizon` | `string.max(50)` | >50 chars → `400` |
| `riskAppetite` | `string.max(50)` | >50 chars → `400` |
| `manualNotes` | `string.max(20000)` | >20000 → `400` |

---

## §4. Maszyna stanów i bramki

> **Kluczowa zasada:** każde przejście statusu = `POST /api/initiatives/:id/<akcja>` + preflight `GET /:id/gate-readiness-check`. Weryfikuj ZAWSZE w Network.

### 4.0 Readiness check

1. `GET /api/initiatives/:id/readiness` → `InitiativeController.checkReadiness`.
   - Sprawdź format response: `{ ready: bool, missingItems: [...], completionCriteria: [...] }`.
2. `GET /api/initiatives/:id/gate-readiness-check` → `InitiativeController.getGateReadinessCheck`.
   - Sprawdź format: `{ readiness: [...] }` lub `Partial<V8PlanningGateReadinessCheck>` (per `gateReadinessPayload.ts`).
3. Dla inicjatywy DRAFT z brakującymi sekcjami → `ready: false`, `missingItems` niepusty.

---

### 4.1 submit-review — REALNIE `planning → review`

> **UWAGA:** dedykowany endpoint `submit-review` NIE realizuje `DRAFT→PENDING_REVIEW` z modelu kanonicznego. Realnie wymaga statusu `planning` i ustawia `review` (`submitForReview` ~:2825-2847).

1. Otwórz inicjatywę w statusie `planning` (DB lowercase).
2. Przed próbą — sprawdź readiness: `GET /:id/readiness` → `{ ready: true }` (jeśli NIE — uzupełnij sekcje).
3. Kliknij CTA „Wyślij do przeglądu".
4. **Network:** `POST /api/initiatives/:id/submit-review` → `200`, response `{ success: true, newStatus: "review" }` (NIE `{ status: "PENDING_REVIEW" }`).
5. **UI:** chip statusu zmienia się na „W przeglądzie biznesowym" / `review`.
6. **Reload:** status `review` trwały. [DB]
7. **Asercja DB:** `SELECT status FROM initiatives WHERE id = '...'` → `'review'` (lowercase).
8. **Asercja console:** zero nowych błędów.

**Negatywny — zły status źródłowy:**
- Inicjatywa NIE w `planning` (np. `draft`) → `POST /:id/submit-review` → `400 Cannot submit for review from status: <status>`.

**[OTWARTY DEFEKT — autoryzacja roli na trasie]:**
- Trasa `/:id/submit-review` ma tylko `verifyToken` + `requireOrgAccess()` — BRAK middleware ról; kontroler `submitForReview` NIE woła `canExecuteGate`. Zaloguj jako TEAM_MEMBER/CONSULTANT i wywołaj endpoint bezpośrednio → sprawdź realny kod odpowiedzi. **Jeśli `200` → P1 luka autoryzacji** (gating tylko klient). Jedyna ścieżka egzekwująca rolę to `PATCH /:id/status`.

---

### 4.2 approve — REALNIE `review → approved`

> **UWAGA:** dedykowany `approve` NIE robi `PENDING_REVIEW→REVIEW` ani trzech różnych przejść. Realnie: wymaga `review`, ustawia `approved` (`approveInitiative` ~:2877-2899). To jedyne przejście tego endpointu.

1. Inicjatywa w statusie `review`.
2. Kliknij „Zatwierdź".
3. **Network:** `POST /api/initiatives/:id/approve` → `200`, `{ success: true, newStatus: "approved" }` (opcjonalne body: `comment`, `roadmapQuarter`, `roadmapYear`).
4. **Reload + DB:** `SELECT status …` → `'approved'`.
5. **Negatywny — zły status:** inicjatywa NIE w `review` → `400 Cannot approve from status: <status>`.
6. **[OTWARTY DEFEKT — rola]:** trasa `/:id/approve` bez middleware ról; kontroler nie woła `canExecuteGate`. Wywołaj jako TEAM_MEMBER/CONSULTANT → jeśli `200` → P1 luka autoryzacji.

---

### 4.3 reject — REALNIE `review → planning`

> **UWAGA:** `reject` NIE robi `REVIEW→DRAFT`. Realnie: wymaga `review`, ustawia `planning` (`rejectInitiative` ~:2929-2940).

1. Inicjatywa w statusie `review`.
2. Kliknij „Odrzuć" (opcjonalny `reason` w body).
3. **Network:** `POST /api/initiatives/:id/reject` → `200`, `{ success: true, newStatus: "planning" }`.
4. **Reload + DB:** `SELECT status …` → `'planning'` (NIE `draft`).
5. **Negatywny — zły status:** NIE w `review` → `400 Cannot reject from status: <status>`.
6. **[OTWARTY DEFEKT — rola]:** trasa bez guarda ról; kontroler nie woła `canExecuteGate`. Test jako TEAM_MEMBER/CONSULTANT → jeśli `200` → P1.

---

### 4.4 start-execution — REALNIE `approved → executing`

> **UWAGA:** `start-execution` NIE robi `PROMOTED→PLANNING` ani `SCHEDULED→EXECUTING`. Realnie: wymaga `approved`, ustawia `executing` (`startExecution` ~:2976-2986). Statusy `promoted`/`scheduled` są POMINIĘTE w dedykowanych endpointach.

1. Inicjatywa w statusie `approved`.
2. Kliknij „Rozpocznij realizację".
3. **Network:** `POST /api/initiatives/:id/start-execution` → `200`, `{ success: true, newStatus: "executing" }`.
4. **Reload + DB:** `SELECT status …` → `'executing'`.
5. **Asercja:** inicjatywa pojawia się w M14 (Wdrożenie).
6. **Negatywny — zły status:** NIE w `approved` → `400 Cannot start execution from status: <status>`.
7. **[OTWARTY DEFEKT — rola]:** trasa bez guarda; test jako TEAM_MEMBER → jeśli `200` → P1.

---

### 4.5 Przejścia BEZ dedykowanego endpointu — tylko `PATCH /:id/status`

> Statusy `pending_review`, `promoted`, `scheduled` oraz przejścia `approved→scheduled` i `done→tracking` **nie mają dedykowanego endpointu**. Jedyna ścieżka = `PATCH /api/initiatives/:id/status` (`updateInitiativeStatus` ~:1127), która waliduje `isValidTransition` i RBAC bramki.

**Test ścieżki kanonicznej (z RBAC):**
1. Inicjatywa w statusie dozwalającym przejście wg `VALID_TRANSITIONS`.
2. **Network:** `PATCH /api/initiatives/:id/status`, body `{ "status": "<docelowy>", "reason": "..." }`.
3. **Asercja sukces (rola pasuje):** `200`, status zmieniony.
4. **Asercja walidacja przejścia:** przejście spoza `VALID_TRANSITIONS` → `400 Invalid status transition` z `rule: INVALID_TRANSITION` i listą `validNext`.
5. **[POZYTYWNY RBAC]:** to JEDYNY endpoint egzekwujący rolę. Rola spoza `GATE_PERMISSIONS[gate]` → `403 Permission denied for this status transition` z `requiredRoles`. CONSULTANT przy SUBMIT_FOR_REVIEW — zachowanie zależy od sprzeczności źródeł (patrz §0) — odnotuj realny wynik.
6. **CONSULTANT non-author:** SUBMIT_FOR_REVIEW dla cudzej inicjatywy (`created_by` ≠ aktor) → `403 Consultants can only submit initiatives they created`.

> **`/move` NIE używać do statusów** — `moveInitiative` (~:3105) zmienia `targetProjectId` (przeniesienie między projektami), nie status.

---

### 4.8 block → `executing → blocked` (BEZ guarda statusu)

> **UWAGA:** `blockInitiative` (~:3002) NIE sprawdza statusu źródłowego — bezwarunkowo ustawia `blocked` na dowolnej inicjatywie. Brak też guarda roli.

1. Inicjatywa `executing` (semantycznie poprawny punkt startu).
2. Kliknij „Zablokuj" → modal z polem „Powód blokady".
3. **Network:** `POST /api/initiatives/:id/block`, body `{ reason: "...", decisionId? }` → `200`, `{ success: true, newStatus: "blocked" }`.
4. **UI:** chip „Zablokowana" (rose), powód (`blocked_reason`) widoczny.
5. **DB:** `status = 'blocked'`. [DB]
6. **[DEFEKT — brak guarda statusu]:** wywołaj `block` na inicjatywie `draft`/`review` → realnie przejdzie (200). Odnotuj jako defekt (powinno być ograniczone do `executing`).
7. **[OTWARTY DEFEKT — rola]:** brak guarda ról; test jako TEAM_MEMBER → jeśli `200` → P1.

**unblock → `blocked → executing` (BEZ guarda statusu):**
1. Inicjatywa `blocked`.
2. Kliknij „Odblokuj".
3. **Network:** `POST /api/initiatives/:id/unblock` → `200`, `{ success: true, newStatus: "executing" }` (czyści `blocked_reason`).
4. **[DEFEKT]:** `unblockInitiative` (~:3036) też bez guarda statusu i roli — odnotuj realny wynik na nie-blocked.

---

### 4.9 complete → `done` (BEZ guarda statusu)

> **UWAGA:** `completeInitiative` (~:3068) NIE sprawdza statusu źródłowego — bezwarunkowo ustawia `done`. Brak guarda roli.

1. Inicjatywa `executing`.
2. Kliknij „Zakończ" (opcjonalne body `{ enableBenefitsTracking }`).
3. **Network:** `POST /api/initiatives/:id/complete` → `200`, `{ success: true, newStatus: "done", benefitsTrackingEnabled }`.
4. **Asercja:** inicjatywa w M14 jako `done`.
5. **[DEFEKT — brak guarda statusu]:** `complete` na inicjatywie spoza `executing` realnie przejdzie — odnotuj.
6. **[OTWARTY DEFEKT — rola]:** brak guarda ról; test jako TEAM_MEMBER → jeśli `200` → P1.

---

### 4.10 done → tracking — BRAK dedykowanego endpointu

> **[BRAK ENDPOINTU — tylko ścieżka kanoniczna]:** nie ma `POST /:id/start-tracking`. Przejście `done→tracking` realizuje wyłącznie `PATCH /api/initiatives/:id/status` (`VALID_TRANSITIONS[DONE] = [TRACKING]`, bramka START_TRACKING / rola BUSINESS_OWNER egzekwowana tylko tutaj). `/move` to przeniesienie projektu, NIE status.

1. Inicjatywa `done`.
2. **Network:** `PATCH /api/initiatives/:id/status`, body `{ "status": "TRACKING" }` → `200`.
3. **Asercja:** inicjatywa w M15 (Rezultaty) jako `tracking`.
4. **[RBAC]:** rola spoza BUSINESS_OWNER → `403` (jedyny endpoint z RBAC). Odnotuj realny wynik.

---

### 4.11 CANCELLED — przez `PATCH /:id/status`

> **[BRAK dedykowanego endpointu]:** brak `POST /:id/cancel`. Anulowanie = `PATCH /api/initiatives/:id/status` z `{ status: "CANCELLED" }` (bramka CANCEL / role PMO, STEERING_COMMITTEE; `VALID_TRANSITIONS` dozwala z DRAFT…BLOCKED). NIE używać `/move`.

1. Dowolna aktywna inicjatywa (z `draft`…`blocked`).
2. Kliknij „Anuluj" (kebab menu) → modal potwierdzenia z powodem.
3. **Network:** `PATCH /api/initiatives/:id/status`, body `{ "status": "CANCELLED", "reason": "..." }` → `200`.
4. **Asercja:** `cancelled` widoczne w liście M13 (`getInitiativesVisibleStatuses()` zawiera CANCELLED).
5. **Negatywny:** próba powrotu z `cancelled` (np. → `executing`) → `400 Invalid status transition` (`VALID_TRANSITIONS[CANCELLED] = [ARCHIVED]`).
6. **[RBAC]:** rola spoza PMO/STEERING_COMMITTEE → `403`. Odnotuj realny wynik.

---

### 4.12 ARCHIVED — tylko z `done`/`cancelled`

> **UWAGA:** `archiveInitiative` (~:3193) wymusza status `done` LUB `cancelled` (`400` dla reszty). NIE „z każdego statusu" jak w §0 — to ograniczone. Zgodne z `VALID_TRANSITIONS` (ARCHIVED osiągalny tylko z TRACKING/CANCELLED w modelu; endpoint dodatkowo dopuszcza `done`).

1. Inicjatywa w statusie `done` lub `cancelled`.
2. Kliknij „Archiwizuj".
3. **Network:** `POST /api/initiatives/:id/archive` → `200`, `{ success: true, newStatus: "archived" }`.
4. **Asercja:** `archived` widoczne w liście M13 (`getInitiativesVisibleStatuses()` — uwaga: w `constants/initiativeStatuses.ts` lista NIE zawiera ARCHIVED; w `initiativeLifecycle.ts` `MODULES.initiatives` ZAWIERA — sprawdź realną widoczność i odnotuj rozbieżność).
5. **Negatywny — zły status:** archive z `planning`/`executing`/`review` itd. → `400 Only done or cancelled initiatives can be archived`.
6. **[OTWARTY DEFEKT — rola]:** trasa `/:id/archive` bez guarda ról; test jako TEAM_MEMBER → jeśli `200` → P1.
7. **Negatywny — edycja po archiwizacji:** próba edycji sekcji w `archived` — powinna być zablokowana (zweryfikuj).

---

### 4.13 Status history

1. `GET /api/initiatives/:id/status-history` → lista przejść statusów z timestamps i aktorami.
2. **Asercja:** każde z powyższych przejść jest zapisane.

---

### 4.14 Gate-roles (konfiguracja ról bramek)

1. `GET /api/initiatives/:id/gate-roles` → `{ gateRoles: [...] }`.
2. `PUT /api/initiatives/:id/gate-roles`, body `{ gateRoles: [...] }` → `200`.
3. **Asercja:** po zmianie ról bramka jest dostępna tylko dla nowych ról.

---

### 4.15 Inicjatywa widoczna per moduł (visibility routing)

| Status | Moduł, gdzie widoczna |
|---|---|
| DRAFT | Assessment/Tools (NIE w M13 głównej liście) |
| PENDING_REVIEW | Assessment/Tools |
| REVIEW | M13 ✓ |
| PROMOTED | M13 ✓ |
| PLANNING | M13 ✓ |
| APPROVED | M13 ✓ |
| SCHEDULED | M13 ✓ + M14 |
| EXECUTING | M14 |
| BLOCKED | M14 |
| DONE | M14 |
| TRACKING | M15 |
| CANCELLED | M13 ✓ |
| ARCHIVED | M13 ✓ |

Sprawdź każdy wiersz: wejdź na dany moduł i potwierdź obecność/nieobecność inicjatywy.

> **Rozbieżność źródeł widoczności (odnotuj):** `getInitiativesVisibleStatuses()` w `server/src/constants/initiativeStatuses.ts` zwraca `[REVIEW, PROMOTED, PLANNING, APPROVED, SCHEDULED, CANCELLED]` — **bez ARCHIVED**. Natomiast `MODULES.initiatives.statuses` w `src/services/initiativeLifecycle.ts` zawiera pełną listę łącznie z DRAFT/EXECUTING/DONE/ARCHIVED. Realna widoczność ARCHIVED i DRAFT w M13 zależy od tego, którego helpera używa query listy — zweryfikuj empirycznie i odnotuj, który wiersz tabeli jest faktycznie prawdziwy.

---

## §5. Widoki portfolio

### 5.1 Lista (PortfolioListView) — tabela §27

1. Otwórz `/initiatives` → domyślny widok `table`.
2. **Sorting:** kliknij kolumnę „Tytuł" → sortowanie ASC; ponownie → DESC. Sprawdź `?sort=title&order=asc`.
3. **Filtrowanie po statusie:** kliknij chip statusu (np. REVIEW) → lista filtruje się do statusu. Network: `GET /api/initiatives?status=REVIEW`.
4. **Wyszukiwanie:** wpisz fragment tytułu → lista odświeża się na bieżąco (debounce).
5. **§27 obowiązkowe checklisty:**
   - Sticky header (tabela nie scrolluje nagłówka).
   - DueChip / PriorityChip widoczne w kolumnach.
   - Kebab menu na wierszu (prawdopodobnie puste/statyczne per L-03 — odnotuj).
   - **[P1 L-03]:** brak `resizable:false` (brak resize kolumn) — odnotuj.
   - Brak `TableSettingsPopover` (widoczne kolumny) — odnotuj jako L-11b.
6. **Pusty stan:** firma bez inicjatyw → komunikat empty-state widoczny, nie biały ekran.

**Network:** `GET /api/initiatives` → `{ initiatives: [...], total: N }`.

---

### 5.2 Kanban (drag & drop) [MANUAL]

1. Przełącz widok na `kanban`.
2. **Asercja:** kolumny = statusy (REVIEW, PROMOTED, PLANNING, APPROVED, SCHEDULED — widoczne per moduł M13).
3. Przeciągnij inicjatywę z kolumny REVIEW do PROMOTED. [MANUAL]
4. **Network:** preflight `GET /:id/gate-readiness-check` → potem zmiana statusu.
5. **Asercja:** inicjatywa jest w nowej kolumnie; stara kolumna ją nie zawiera.
6. **Reload:** zmiana trwała.
7. **Edge case:** przeciągnij do statusu niedozwolonego (np. DRAFT → TRACKING) → oczekiwane odrzucenie ze komunikatem.

**Network:** zmiana statusu przez DnD = `PATCH /api/initiatives/:id` z `{ status: "PROMOTED" }` (alias delegujący do `updateInitiativeStatus` — patrz routes ~:2156 `hasStatus → UpdateInitiativeStatusSchema`) LUB `PATCH /api/initiatives/:id/status`. Obie ścieżki egzekwują `isValidTransition` + RBAC bramki (403). Przejście niedozwolone (np. DRAFT→TRACKING) → `400 Invalid status transition`.

---

### 5.3 Timeline / Gantt

1. Przełącz widok na `timeline` (`InitiativesTimelineView`).
2. **Asercja:** inicjatywy z ustawionymi datami start/end renderują się jako paski na osi czasu.
3. Kliknij pasek → otwiera preview lub dokument.
4. **Edge case:** inicjatywa bez dat → pasek bez osi czasu lub placeholder.

---

### 5.4 Grid view

1. Przełącz widok na `grid`.
2. **Asercja:** inicjatywy renderują się jako karty.
3. Kliknij kartę → otwiera preview/dokument.

---

### 5.5 Portfolio endpointy

1. `GET /api/initiatives/portfolio` → `{ initiatives: [...], stats: { total, byStatus: {...}, ... } }`.
2. `GET /api/initiatives/portfolio/rollups` → `{ rollups: [...] }` (hierarchia programów).
3. `GET /api/initiatives/portfolio/dependencies` → `{ dependencies: [...] }`.
4. `GET /api/initiatives/capacity` → `{ activeCount: N, suggestedCount: M, overload: "green"|"amber"|"red" }`.
5. `GET /api/initiatives/capacity?projectId=<id>` → filtrowanie per projekt.

**Asercja overload:**
- 0–2 aktywnych → `overload: "green"`, `suggestedCount: 3`
- 3–5 → `overload: "amber"`, `suggestedCount: 3`
- 6+ → `overload: "red"`, `suggestedCount: 2`

---

### 5.6 Programy (hierarchia)

1. `GET /api/initiatives/programs` → lista programów z `initiativeCount`.
2. `POST /api/initiatives/programs`, body `{ name, description, status }` → `201`.
3. `GET /api/initiatives/programs/:programId` → program + childPrograms + initiatives.
4. `PUT /api/initiatives/programs/:programId` → update.
5. `DELETE /api/initiatives/programs/:programId` → `200`.
6. **Negatywny — usuń program z inicjatywami:** `DELETE` → `409 Cannot delete program with linked initiatives`.
7. **Negatywny — circular reference:** `PUT` z `parentProgramId === programId` → `400`.

---

## §6. ROI i ekonomika

### 6.1 Nawigacja do ROI [P1 — weryfikacja fix dc1dd6154d]

1. Na stronie `/initiatives` sprawdź, czy w prawym górnym rogu jest przycisk `TrendingUp` / „ROI".
2. **Asercja kodu:** `InitiativesHub.tsx:1649` — `onClick={() => navigate(ROUTES.ROI)}` gdzie `ROUTES.ROI = '/roi'`.
3. Kliknij przycisk ROI → nawigacja na `/roi`.
4. **Asercja:** strona ROI (`FullROIView`) renderuje się poprawnie, bez białego ekranu.
5. **Network:** `GET /api/economics/analyses` → `{ analyses: [...] }` (lista analiz ROI).

---

### 6.2 Kalkulacja ROI

1. Na stronie `/roi` sprawdź, czy jest formularz wejść ROI (koszt, korzyść, timeline, stopa dyskontowa).
2. Wypełnij dane i uruchom kalkulację.
3. **Network:** żądanie do `/api/economics/analyses` (POST lub GET z parametrami).
4. **Asercja response:** `{ npv, irr, paybackPeriod, roi, ... }`.
5. Zmień stopę dyskontową → wynik się aktualizuje.

---

### 6.3 Powiązanie ROI z inicjatywą

1. W dokumencie inicjatywy (zakładka Analysis lub FinancialAnalysisSection):
   - Sprawdź, czy jest link do kalkulatora ROI.
   - `onClick={() => navigate('/economics?tab=models&initiativeId=<id>')` → `InitiativesHub.tsx:1468`.
2. Kliknij → otwarcie `/economics` z kontekstem inicjatywy.
3. **Asercja:** analiza ROI jest powiązana z inicjatywą.

---

## §7. Analysis i zależności

### 7.1 Analysis Workspace (`AnalysisWorkspacePanel`)

1. Otwórz zakładkę Analysis w M13 lub z dokumentu inicjatywy.
2. **6 podwidoków:** CompletenessAnalysis, FeasibilityAnalysis, LogicAnalysis, PortfolioAnalysisView, ResourcesAnalysis, TimelineAnalysis.
3. Dla każdego podwidoku:
   - Sprawdź, że renderuje się bez błędów konsoli.
   - Sprawdź, że dane są realne (nie mocki) — Network: endpointy per widok.

---

### 7.2 Graf zależności (`DependencyGraphCanvas`)

1. Wejdź do Analysis → zakładka „Dependencies" / „Graf zależności".
2. **Asercja:** graf renderuje się (SVG lub Canvas) z węzłami inicjatyw i krawędziami zależności.
3. **Asercja tokenów [P2 L-11c]:** brak hardkodowanych hex kolorów w CSS grafu; sprawdź `DependencyGraphCanvas.tsx` — odnotuj 9 hex kolorów do zastąpienia tokenami.
4. Kliknij na węzeł → otwiera inicjatywę lub jej preview.
5. Sprawdź auto-fix: jeśli w grafie wykryty jest cykl zależności → ostrzeżenie lub auto-fix.

---

### 7.3 Completeness i Feasibility Analysis

**CompletenessAnalysis:**
1. Inicjatywa z wypełnionymi sekcjami vs. inicjatywa z pustymi sekcjami.
2. **Asercja:** `completenessScore` wyższy dla wypełnionej.
3. Kliknij „Auto-fix" (jeśli dostępny) → `POST /api/initiatives/readiness-analysis` lub `/:id/gate-readiness-check`.

**FeasibilityAnalysis:**
1. Sprawdź, że widzi zasoby i budżet.
2. **Network:** odpowiedni GET endpoint z danymi zasobów.

---

## §8. Ścieżki cross-module (KLUCZOWE)

### 8.1 M10 Wywiad → M13 Inicjatywy (GŁÓWNA ŚCIEŻKA — S5)

Już pokryte w §1c. Dodatkowe asercje:

1. Po wygenerowaniu inicjatyw z insightów → wróć do M10 Wywiad.
2. **Asercja:** insighty, które były użyte, mają powiązanie z inicjatywą (badge/link w M10 — jeśli istnieje).
3. `GET /api/initiatives?sourceType=interview_insight&sourceId=<insightId>` → inicjatywa powiązana.

---

### 8.2 M13 Inicjatywy → M14 Wdrożenie

1. Zmień status inicjatywy na SCHEDULED (per §4.5 — brak dedykowanego endpointu, użyj `PATCH /:id/status`).
2. Przejdź do M14 (`/implementation`).
3. **Asercja:** inicjatywa SCHEDULED pojawia się w M14 (wg `getExecutionVisibleStatuses()`).
4. Status EXECUTING, BLOCKED, DONE → też widoczne w M14.
5. **Asercja:** wejście z M14 w dokument inicjatywy — możliwe przez kliknięcie.

---

### 8.3 M13 Inicjatywy → M15 Rezultaty

1. Zmień status inicjatywy na TRACKING (per §4.10).
2. Przejdź do M15 (`/benefits`).
3. **Asercja:** inicjatywa TRACKING pojawia się w M15.
4. **Network:** `GET /api/economics/analyses` → analizy powiązane z inicjatywą.

---

### 8.4 M13 Inicjatywy → M16 Finanse

1. W dokumencie inicjatywy otwórz sekcję `financialAnalysis` lub `financialImpact`.
2. **Network:** `GET /api/economics/analyses` → dane finansowe.
3. Wejdź na `/roi` → sprawdź integrację per inicjatywę.

---

### 8.5 M13 → M01 Czat (in-context)

1. W dokumencie inicjatywy sprawdź, czy jest przycisk „Czat z Teresą" / sidebar czatu.
2. Kliknij → otwiera czat M01 z kontekstem inicjatywy.
3. **Asercja:** Teresa zna tytuł / zakres inicjatywy (widoczne w kontekście odpowiedzi).
4. **Odnotuj:** D-01 ROZSTRZYGNIĘTE → DP-2 (globalny IDE-tabs). Sprawdź aktualną implementację.

---

### 8.6 M13 → M02 Canvas

1. Sprawdź, czy jest opcja „Otwórz w Canvas" / „Dokumentuj w Canvas".
2. Kliknij → otwiera M02 Canvas z dokumentem inicjatywy lub puste Canvas z linkiem do inicjatywy.

---

### 8.7 M23 Organizacja → M13 (governance / cele i decyzje)

1. `GET /api/initiatives-v4/initiatives` (router governance — `Gateway.ts:906`) — sprawdź response.
2. **Security check [L-12]:** wyślij żądanie z manipulowanym headerem `x-organization-id` → verify że org ze serwisu ignoruje header (scoped do tokena).
3. **Powiązania cel↔inicjatywa:** jeśli dostępne w UI M23 → powiąż cel z inicjatywą i sprawdź w M13 widoczność.

---

## §9. Gating i bezpieczeństwo

### 9.1 Gating pilota VTS (L-06) [FLAG]

1. Zaloguj się jako użytkownik z rolą `isPilotParticipantRole=true`.
2. **UI asercja:** CTA tworzenia niewidoczne/wyszarzone (per `InitiativesHub.tsx:1937`).
3. **API bezpośrednio:** `POST /api/initiatives` z tokenem pilota → oczekiwane `403`.
4. **Jeśli serwer zwraca `200`** → odnotuj jako L-06 CONFIRMED (gating tylko klientem, nie serwerem).
5. `POST /api/initiatives/wizard/sessions` z tokenem pilota → `403` oczekiwane.
6. Bulk actions z tokenem pilota → `403`.

---

### 9.2 Cross-org security (L-09, naprawione b9f2dee9d2)

1. Zaloguj się jako user org-A.
2. Spróbuj `GET /api/initiatives/<id_z_org-B>` → `404 Not found` (org-scoped).
3. Spróbuj `PUT /api/initiatives/<id_z_org-B>` → `404`.
4. Spróbuj `POST /api/initiatives/<id_z_org-B>/submit-review` → `404`.
5. **Governance links:** `POST /api/initiatives-v4/initiatives/<id_z_org-B>/links` → `403` lub `404`. [L-12: do potwierdzenia czy serwis faktycznie ignoruje org z headera]

---

### 9.3 Rola na przejściach — gdzie egzekwowana, gdzie NIE [OTWARTY DEFEKT]

> **Stan realny (zweryfikowany):** RBAC bramek (`canExecuteGate`/`GATE_PERMISSIONS`) działa WYŁĄCZNIE na `PATCH /api/initiatives/:id/status` (`updateInitiativeStatus`). Dedykowane endpointy (`/submit-review`, `/approve`, `/reject`, `/start-execution`, `/block`, `/unblock`, `/complete`, `/archive`) NIE wołają RBAC i NIE mają middleware ról — tylko `verifyToken` + `requireOrgAccess()`.

1. Zaloguj się jako `Role.CONSULTANT` (lub TEAM_MEMBER).
2. **Ścieżka kanoniczna (oczekiwane 403):** `PATCH /api/initiatives/:id/status` z `{ status: "..." }` → oczekiwane `403 Permission denied for this status transition`.
   - Uwaga sprzeczności źródeł dla CONSULTANT+SUBMIT_FOR_REVIEW (patrz §0) — odnotuj realny wynik.
3. **Ścieżki dedykowane (PODEJRZANE o lukę):** `POST /:id/submit-review`, `/:id/approve` bezpośrednio jako CONSULTANT/TEAM_MEMBER → sprawdź realny kod.
   - **Jeśli `200`** (a status źródłowy pasuje) → **P1 luka autoryzacji**: rola gatowana tylko po stronie klienta, serwer ją ignoruje na dedykowanych trasach.
   - **Jeśli `400`** (zły status) → to guard statusu, NIE roli — nadal luka roli niepotwierdzona w drugą stronę.
4. **Wniosek do raportu:** udokumentuj asymetrię — RBAC tylko na `/status`, brak na 8 dedykowanych endpointach.

---

### 9.4 Degradacja V8 (L-05)

1. Sprawdź, czy V8 Planning chip jest dostępny (env `V8_PLANNING=true` / off).
2. Z V8 wyłączonym (staging): otwórz inicjatywę → sprawdź czy jest baner degradacji (jak w Finance/Results).
3. **Jeśli brak banera** → odnotuj L-05 CONFIRMED (cicha degradacja).

---

## §10. Widok preview i nawigacja

### 10.1 InitiativePreviewV3 — CTA „Otwórz" (L-08, naprawione 18ed3e44f7)

1. Kliknij inicjatywę na liście → otwiera się preview panel (`InitiativePreviewV3`).
2. **Asercja:** przycisk „Otwórz" jest widoczny i klikalny (`InitiativePreviewV3.tsx:399` — fix `18ed3e44f7`).
3. Kliknij „Otwórz" → nawigacja do pełnego dokumentu inicjatywy.
4. **Asercja:** pełny dokument (InitiativeDocumentView lub InitiativeFullView) renderuje się ze wszystkimi sekcjami.

---

### 10.2 InitiativeDrawer i InitiativeFullView

1. Sprawdź, czy jest ścieżka otwierająca `InitiativeDrawer` (side-panel).
2. Sprawdź, czy jest ścieżka otwierająca `InitiativeFullView` (pełnoekranowy).
3. **[P2 — korupcja „rose"]:** sprawdź `InitiativeFullView.tsx` i `InitiativeDrawer.tsx` → poszukaj hardkodowanych `rose`/`blue` (zamiast `EntityStatusChip`/`c.*`). Odnotuj ile instancji.

---

## §11. Testy przekrojowe

### 11.1 Kombinacje statusów × ról

| Status | Owner/Admin | PMO | STEERING | PROJECT_SPONSOR | PILOT VTS | CONSULTANT |
|---|---|---|---|---|---|---|
| DRAFT | Edycja pełna, submit | — | — | — | Brak dostępu | Read-only |
| REVIEW | Widok | Widok | Accept/Reject | Accept/Reject | Brak | Read-only |
| PLANNING | Widok | Start Planning | Approve | — | Brak | Read-only |
| EXECUTING | Widok | Start/Block/Complete | Unblock | Unblock | Brak | Read-only |
| DONE | Widok | — | — | — | Brak | Read-only |

Przetestuj min. 3 kombinacje statusów × ról, weryfikując, że **CTA w UI** jest dostępne/niedostępne zgodnie z GATE_PERMISSIONS.

> **WAŻNE — UI ≠ serwer (patrz §9.3):** powyższa matryca opisuje WIDOCZNOŚĆ CTA po stronie klienta. Egzekucja serwerowa roli istnieje TYLKO na `PATCH /:id/status`. Dla każdej komórki „—"/„Read-only" zweryfikuj dodatkowo bezpośrednie wywołanie odpowiedniego dedykowanego endpointu (`/approve`, `/block`, …) — jeśli zwraca `200` mimo braku CTA w UI → P1 luka autoryzacji.

---

### 11.2 Disabled states podczas operacji asynchronicznych

1. Kliknij „Wyślij do przeglądu" → przez czas trwania żądania sprawdź, czy przycisk jest disabled (wyszarzony, `cursor-not-allowed`).
2. Podwójny klik podczas ładowania → tylko jedno żądanie sieciowe.
3. **Reload during async:** kliknij submit i odśwież stronę przed response → brak white-screen, aplikacja wychodzi gracefully.

---

### 11.3 Viewport / responsive

1. Zmień szerokość okna na 1280px → lista inicjatyw OK.
2. Zmień na 768px (tablet) → tabela nie przełamuje się; kebab menu dostępny.
3. Zmień na 375px (mobile) → check overflow (lub odnotuj, że mobile poza zakresem v1).

---

### 11.4 i18n — PL i EN

1. Sprawdź kilka kluczowych stringów w trybie PL (`i18n.language = 'pl'`):
   - Status „Szkic" (DRAFT), „W przeglądzie" (REVIEW), „Promowana" (PROMOTED).
   - CTA „Wyślij do przeglądu", „Zatwierdź", „Archiwizuj".
2. Przełącz na EN → te same elementy w języku angielskim.
3. **[P1 L-11a] i18n inline ~1820×:** poszukaj w UI gołych polskich stringów (np. `InitiativeDocumentView.tsx` 423 inline strings). Odnotuj minimum 5 przykładów hardkodowanych stringów.
4. **Asercja:** brak gołych `isPolish ? '...' : '...'` widocznych wprost w UI (powinny być przez klucze i18n).

---

### 11.5 Dark mode

1. Przełącz na dark mode.
2. Sprawdź, że wszystkie elementy M13 mają odpowiednie kolory dark:
   - Tło listy, karty, preview panel.
   - Chipa statusów (kolor niezmieniony, czytelny).
   - Tekst we wszystkich sekcjach dokumentu.
3. **[P2 L-11c korupcja koloru]:** w dark mode hardkodowane `rose`/`blue` mogą być nieczytelne — odnotuj.

---

### 11.6 Dostępność (A11y)

1. Otwórz modal Charter Wizard → sprawdź **focus trap** (Tab nie wychodzi poza modal).
2. Otwórz modal tworzenia (`showNewModal`) → focus trap OK.
3. Zamknij modal przez `Escape` → focus wraca do triggera.
4. **Klawiatura:** lista inicjatyw — nawigacja strzałkami, Enter = otwórz, Escape = zamknij preview.
5. **ARIA:** przyciski akcji mają `aria-label` lub widoczny tekst.

---

### 11.7 Zero błędów konsoli przez całą sesję

**Obligatoryjna lista momentów do sprawdzenia:**
- Otwarcie strony `/initiatives`.
- Zmiana widoku (table → kanban → timeline).
- Każde przejście statusowe.
- Otwarcie/zamknięcie modali.
- Otwarcie dokumentu inicjatywy z ~30 sekcjami.
- Otwarcie Analysis → DependencyGraphCanvas.

Odnotuj KAŻDY błąd z timestamp, treścią i stack trace.

---

## §12. Testy regresji / jednostkowe

### Istniejące testy do uruchomienia

```bash
# Z katalogu projektu:
npx vitest run src/components/Initiatives/__tests__/InitiativesHub.smoke.test.tsx

# Testy CRUD BE (naprawione ea77dc678c):
npx vitest run server/src/routes/pmo/initiatives-crud.test.ts

# Testy ROI view:
npx vitest run src/views/__tests__/FullROIView.smoke.test.tsx
```

**Oczekiwany wynik:**
- `InitiativesHub.smoke.test.tsx` → PASS
- `initiatives-crud.test.ts` → 5/5 PASS (stale import naprawiony `ea77dc678c`)
- `FullROIView.smoke.test.tsx` → PASS

**Znane awarie (z karty audytu §2):**
- Mock-drift `react-i18next` w 4 plikach Initiatives → odnotuj które FAIL.
- Mock-drift `notificationService.send` → odnotuj.
- Integration schema-drift (roadmap_waves, user_sessions) → odnotuj.

---

## §13. Mapa epików — pokrycie ZERO niepokrytych

| Epik | Opis | Sekcja testu |
|---|---|---|
| EPIK 1 | Tworzenie z huba (L-01), deep-link, gating pilota | §1a, §1b, §9.1 |
| EPIK 2 | System statusów/bramek/pipeline (#14) | §4, §0 maszyna stanów, §11.1 |
| EPIK 3 | AI-fill sekcji wg formuły (#16) | §2.4 |
| EPIK 4 | Odporność (baner degradacji V8, bulk ukryte) | §9.4, §5.1 (bulk) |
| EPIK 5 | Szlif kanonu (i18n, §27, tokeny) | §11.4, §5.1, §7.2 |
| EPIK 6 | In-context open #10 (D-01) | §8.5 |

---

## Format raportu

Dla każdego testu używaj formatu:

```
### [PASS|FAIL|SKIP|FLAG] §X.Y — <Nazwa testu>

**Środowisko:** localhost:3000, branch Londyn, user <rola>
**Kroki:** (skrócony opis wykonanych kroków)
**Dowód:**
  - Network: <metoda> <URL> → <status_code> — <kluczowe pola response>
  - UI: <opis zmiany w UI>
  - DB: <wynik query> (jeśli [DB])
**Wynik:** PASS / FAIL (<opis niezgodności>) / FLAG (<co wymaga decyzji>)
**Błędy konsoli:** BRAK / <lista błędów>
```

---

## Definition of Done (DoD)

Testy M13 uznane za zaliczone gdy:

- [ ] §1a–1g: wszystkie ścieżki tworzenia przetestowane (PASS lub FLAG z uzasadnieniem)
- [ ] §2: min. 10 z 24 domyślnych sekcji przetestowanych z E2E (Network + DB)
- [ ] §3: Charter Wizard i AI Wizard (generate_from_evidence) PASS lub FLAG
- [ ] §4: pełny happy path DRAFT→TRACKING przetestowany (każde przejście z Network)
- [ ] §4.8: BLOCK/UNBLOCK cykl PASS
- [ ] §5: wszystkie 4 widoki portfolio otwierają się bez błędów konsoli
- [ ] §6: ROI dostępne z nawigacji (przycisk TrendingUp) i endpoint działa
- [ ] §7: Analysis Workspace bez białego ekranu
- [ ] §8: M10→M13 generate_from_evidence E2E PASS
- [ ] §9.1: gating pilota potwierdzony (UI + API)
- [ ] §9.2: cross-org 404 potwierdzony
- [ ] §11: zero nowych błędów konsoli przez całą sesję
- [ ] §12: testy regresji uruchomione, awarie udokumentowane
- [ ] Raport zawiera: sekcja, wynik, dowód Network, błędy konsoli

**Eskalacja:** każdy FAIL w §4 (maszyna stanów) lub §9 (bezpieczeństwo) = P0, wymaga natychmiastowej naprawy przed merge do prod.
