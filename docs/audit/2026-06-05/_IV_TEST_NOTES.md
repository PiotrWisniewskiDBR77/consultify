# Interview — Notatki z testów (zbieranie uwag)

**Tryb:** owner testuje, Claude tylko zbiera (nie naprawia). Naprawy później.
**Sesja:** 2026-06-05 · branch `feat/wave1-foundations` · HEAD `674bb0d1b7`

---

## Obserwacje

<!-- format: #N · [obszar/tab] · opis · (screen: tak/nie) · severity wstępna -->

### #1 · [Inbox / wszystkie tabele] · Popover „Visible columns" jest przycinany do wysokości tabeli
- **Co:** Owner chciał zwinąć opisy pod wierszami (sub-text pod nazwą template, np. „Data capture, KPI trust…"). Otworzył popover ustawień kolumn (ikona ⚙ po prawej nad tabelą). Popover renderuje się **wewnątrz** kontenera tabeli i jest **przycinany do jej wysokości** → ostatnia pozycja **„Show row description"** jest ucięta i **nie da się jej odhaczyć**.
- **Oczekiwane:** popover ma się rozwijać **nad/ponad tabelą** (portal lub `overflow: visible` / wyższy z-index), pełna wysokość listy widoczna, „Show row description" klikalne.
- **Screen:** tak (2/2, popover otwarty — widać ucięte „Show row descriptio…").
- **Severity wstępna:** S (UI/clipping) — ale blokuje realną funkcję (zwijanie opisów). Dotyczy prawdopodobnie wszystkich 6 tabel (wspólny komponent popovera).
- **Pozytyw od ownera:** ogólny wygląd Inbox „naprawdę dobry", stabilizacja obrazu OK po miesiącach walki. ✅

### #2 · [Inbox / preview pane] · Prawy panel podglądu — zaakceptowany ✅
- Owner otworzył preview (klik w wiersz). Pokazuje status/progress/overdue chips, Assignee, Details, sekcję AI (Summarize/Risks/Next steps), Category, Session, Open/Continue. „Podoba mi się, może być."
- Brak akcji — tylko potwierdzenie, że jest OK.

### #3 · [AI panel] · „AI unavailable" = wygasłe/wyczerpane klucze API, NIE bug kodu
- **Root cause (z logu backendu):** wszystkie providery down na poziomie konta:
  - `google (Gemini)` → `API key expired. Please renew the API key.` → circuit OPENED
  - `openai` → `You exceeded your current quota… check your plan and billing` → circuit OPENED
  - `zai` → timeout
- **Ocena:** kod działa POPRAWNIE — circuit-breaker + uczciwy komunikat „AI unavailable" zamiast fake outputu. Graceful degradation OK.
- **Naprawa:** operacyjna, nie programistyczna — odnowić klucz Gemini / doładować OpenAI w `.env.staging.local`. Bez zmian w kodzie.
- **Severity:** brak (env/billing). Flaga tylko informacyjnie — żeby owner wiedział, że AI-funkcje (Summarize/Insights/evaluate-quality) nie zadziałają w tej sesji testowej dopóki klucze nie wrócą.

### #3b · [AI keys] · Mechanizm podłączania kluczy — gotowe do wykonania, czeka na decyzję ownera
- **Rozwiązywanie klucza (kod, `modelRouter.ts:1392-1407`):** DB `llm_providers.api_key` (org-level) **wygrywa**; `process.env[KEY]` to tylko fallback gdy wiersz DB pusty. Dlatego env z samym OPENAI „czuł się ustawiony", ale stare klucze w bazie i tak go nadpisywały.
- **Mapowanie env (`getEnvKeyForProvider`):** openai→`OPENAI_API_KEY`, anthropic→`ANTHROPIC_API_KEY`, google/gemini→`GEMINI_API_KEY`, deepseek→`DEEPSEEK_API_KEY`, openrouter→`OPENROUTER_API_KEY`.
- **Stan providerów (`/api/llm/providers/health`):** ✅ OpenRouter, DeepSeek, ZAI · ❌ OpenAI (quota, circuit OPEN), Gemini (key expired, circuit OPEN).
- **Panel w UI:** Settings → AI (`src/components/settings/AISettings.tsx`), zapis przez `POST /api/llm/org/:orgId/providers`. Klucze maskowane `•••••1234`.
- **3 drogi przedstawione ownerowi:** (A) wpisać klucze w UI [najczystsze], (B) env + wyczyścić stare klucze z bazy, (skrót) ustawić OpenRouter (już zielony) jako domyślny — AI rusza bez wpisywania kluczy.
- **Status:** owner odłożył decyzję („wait for next instruction"). Wracamy do tego później.

### #3c · [AI config] · WYKONANE — tani stack na Railway (decyzja ownera: bez OpenAI, taniego trzymamy)
- **Potwierdzone:** `DATABASE_URL` → `caboose.proxy.rlwy.net` = **Railway Postgres**. `llm_providers` tam siedzi → klucze raz, używane we wszystkich środowiskach (local+staging czytają tę samą bazę). „Wpisz raz, używaj wszędzie" = już fakt.
- **Zmiana w DB (reversible):** `UPDATE llm_providers SET is_active=false WHERE provider IN ('openai','google')` — wyłączono 3 wiersze (1× openai PREMIUM, 2× google BUDGET).
- **Aktywny stack po zmianie:** openrouter (DEFAULT, STANDARD, healthy) + deepseek (BUDGET, healthy) + zai (STANDARD, czasem flaky/slow).
- **Voice:** NIETKNIĘTY — używa osobnego `GEMINI_LIVE_API_KEY`, nie wierszy llm_providers. Ale obecny klucz Google expired → Voice wymaga świeżego klucza (zadanie operacyjne ownera).
- **Restart wykonany** (appCache `router:default_provider` + in-memory circuits wyczyszczone). Po restarcie: openai/google znikły z health, wszystkie circuit-breakery CLOSED, overall healthy.
- **COFNIĘCIE:** `UPDATE llm_providers SET is_active=true WHERE provider IN ('openai','google')` + restart backendu.
- **TODO hygiene (nie pilne):** w llm_providers są DUPLIKATY wierszy (google ×2 identyczne, zai ×2, anthropic ×3) — do posprzątania kiedyś.

### #3d · [AI] · ZAI flaky na pierwszym probie (latency 0 / unhealthy) — obserwacja
- Po restarcie ZAI raz pokazał unhealthy (latency 0), wcześniej healthy (2341ms — wolny). Prawdopodobnie zimny start / timeout 4s. Default (OpenRouter) i DeepSeek zdrowe, więc nie blokuje. Monitorować czy ZAI się stabilizuje.

### #4 · [Teresa Voice / Chat] · „Rozmawiam z trzema osobami" — fragmenty odpowiedzi jako osobne wiadomości ⚠️
- **Co:** owner włączył Voice (Gemini Live) w Chacie. Głos OK, ale zamiast jednej koherentnej odpowiedzi dostał 3 osobne bąbelki AI — jakby 3 osoby mówiły naraz.
- **Root cause (potwierdzony w kodzie):** `TeresaVoiceContext.tsx:315-328` — callback `onModelAudioText` robi `addMessage()` (= POST /messages) **na KAŻDYM fragmencie** tekstu z Gemini Live. Gemini Live streamuje odpowiedź w częściach → każda część = osobna wiadomość w czacie. To samo dotyczy `onTranscriptUpdate` (299-312) — transkrypcja usera też fragmentowana.
- **Log potwierdza:** 3× POST `/conversations/:id/messages` w ciągu 7 sekund na jedną turę rozmowy.
- **Fix:** bufor akumulacyjny w kontekście + flush na `turnComplete` zamiast addMessage per fragment. Jedna tura = jedna wiadomość user + jedna wiadomość AI.
- **Severity:** wysoka UX — Voice jest bezużyteczny w obecnej formie (chat staje się nieczytelny).
- **Screen:** nie (owner opisał słownie).

### #5 · [Interview / formatka odpowiedzi] · Kompletny redesign potrzebny — owner widzi „duży bałagan"
- **Co:** owner podsumował formatkę odpowiedzi na pytanie jako „duży bałagan". Konkretne wymagania:
  1. **Record musi działać porządnie** — nagrywanie odpowiedzi ma być intuicyjne, nie tandetne (patrz R1 z _IV_ANSWER_FORM_REDESIGN.md).
  2. **Teresa Voice w trybie ankiety** — Teresa ma znać pytanie, zadać je głosem, i zapisać odpowiedź bezpośrednio w formatce (nie jako osobne wiadomości w chacie). To jest NOWY wymaganie — Voice zintegrowany z ankietą, nie tylko z chatem.
  3. **AI rozpisanie odpowiedzi** — przycisk AI (już istnieje) do rozwinięcia krótkiej odpowiedzi. Przetestować czy działa (zależy od OpenRouter).
  4. **Załączniki — przetestować WSZYSTKO:** File (upload), Link (URL), Artifact (wewnętrzny). Owner szczególnie podkreśla File i Link — „artefakty mało kto będzie wiedział jak podłączyć".
- **Dołączony screen:** widać duplikację tekstu „No stress" (pole główne + bursztynowe okno review), sekcję Additional context, przyciski File/Link/Artifact, chip „Answer – Q seed_iq…".
- **Severity:** wysoka (to jest core UX wypełniania ankiety — „od tego zależy, czy ludzie będą chcieli wypełniać").
- **Analiza+plan:** gotowy w `docs/audit/2026-06-05/_IV_ANSWER_FORM_REDESIGN.md` (R1-R4).
- **NOWE vs plan:** wymaganie Teresa Voice w ankiecie (punkt 2) to nowy scope ponad R1-R4 — wymaga integracji `useTeresaVoice` z `InterviewSingleQuestionRuntime` (przekazanie pytania jako kontekstu, zapis odpowiedzi w formatce zamiast w czacie).

### #5b · [Interview / formatka] · Weryfikacja backend endpointów — co działa, co nie
Sprawdzone w kodzie (nie w UI):
- **File upload** (`POST /interview/sessions/:id/evidence`, multer memory) — endpoint istnieje, backend realny. ✅ w kodzie. **Do przetestowania w UI:** czy plik się uploaduje i czy pojawia się jako chip/miniatura.
- **Link add** (`POST /interview/sessions/:id/linked-items`) — endpoint istnieje. ✅ w kodzie. **Do przetestowania w UI:** czy formularz linka działa i czy link pojawia się.
- **Artifact attach** — frontend `ArtifactAttachPopover` wyszukuje tasks/initiatives/decisions i wołaCIA `onAddLink`. ✅ w kodzie.
- **AI improve** (`POST /interview/questions/:id/ai-improve`) — endpoint **istnieje i jest bogaty** (5 trybów: improve/fix_grammar/shorten/expand/formal), używa `llmService.call({modelConfig:{id:'standard'}})` → pójdzie przez OpenRouter (default, healthy). ✅ powinno działać.
- **AI explain** (`POST /interview/questions/:id/ai-explain`) — endpoint istnieje, analogiczny. ✅.
- **PROBLEM na screenie:** chip `Answer – Q seed_iq…` na dole — wygląda na evidence/linked-item z demo seed data (id zaczyna się od `seed_`). Wygląda tandetnie i niepotrzebnie się wyświetla. Do zbadania.

### #6 · [Inbox / chipy filtrów] · „Overdue 12" nie ma sensu z perspektywy usera — redesign chipów ⚠️
- **Co:** owner widzi w Inbox chipy: `ALL 4 | My inbox 4 | To approve 0 | Overdue 12`. Overdue=12 to **org-wide count** (manager-scope), ale Inbox to widok **usera** (moje assignment-y). Juxtaposition: „mam 4 zadania, ale 12 opóźnionych" — niespójne i mylące.
- **Oczekiwane wg ownera:** Inbox usera powinien pokazywać chipy związane z **jego** statusami: np. All / Answered / Approved / Not approved (sent back). NIE org-wide overdue.
- **To approve / Overdue** to **manager shortcuts** — powinny żyć na zakładce Assigned, nie w Inbox.
- **Severity:** średnia-wysoka (confusion UX, nie crash). DEFERRED z audytu wcześniej (design call), teraz owner potwierdził kierunek.

### #7 · [Inbox → Assigned → Inbox] · System zatwierdzeń (approve/reject/send-back) — KRYTYCZNA mechanika do zweryfikowania
- **Wymagana ścieżka (owner potwierdził):**
  1. Manager assignuje ankietę userowi (Assign)
  2. User wypełnia odpowiedzi (Inbox → Session → odpowiada na pytania)
  3. User kończy → status zmienia się na „submitted" / gotowy do review
  4. Manager widzi w Assigned → „submitted" → może **zatwierdzić (Approve)** lub **odesłać do poprawki (Send back)** z komentarzem
  5. Jeśli Send back → user widzi w Inbox znowu, ze statusem „sent_back" i powodem
  6. User poprawia → submit ponownie → manager znowu decyduje
- **Do zweryfikowania w kodzie:**
  - Czy istnieje akcja „Submit" dla usera (zakończenie odpowiedzi)?
  - Czy status „submitted" jest widoczny w Assigned?
  - Czy Approve/Send-back działają end-to-end (V-A S1 naprawił gates, ale mechanika pełna?)?
  - Czy user widzi powód send-back?
  - Czy po Approve status zmienia się na „approved" i user to widzi?
- **Severity:** krytyczna — to jest core workflow modułu Interview.

### #7b · [Sessions / manager view] · Audyt manager flow — co JEST, co BRAKUJE
Owner pokazał screen Sessions (manager view): 7 sesji, chipy `All 7 | In progress 4 | Submitted 0 | Approved 3`. Rzędy mają statusy: In Progress, Approved, Completed. Jedna sesja w nazwie ma „Submitted — Cost baseline (awaiting approval)".

**WERYFIKACJA W KODZIE — co działa end-to-end:**
- ✅ **Status lifecycle pełen:** `AssignmentStatus = assigned | in_progress | submitted | sent_back | approved | completed` (InterviewAssignmentService.ts:37). Wszystkie 6 stanów istnieją.
- ✅ **Submit (user → manager):** `submitAssignment` handler istnieje (InterviewController.ts:2738), wymaga `SUBMIT_INTERVIEW` permission, zmienia status na `submitted`. UI: przycisk „Submit for review" / „Wyślij do przeglądu" w InterviewWorkspace.tsx:1642.
- ✅ **Approve (manager):** `approveAssignment` (3138), wymaga `APPROVE_INTERVIEW`, **wymusza completeness ≥ 50%** (3186), zapisuje `review_decision_memory_json`. UI: przycisk w InterviewWorkspace.tsx:1624.
- ✅ **Send-back (manager) z powodem + missing items:** `sendBackAssignment` (2931), **wymaga `reason`** (400 jeśli brak), accepts `missingItems[]` array, default fallback „quality_gaps". UI: textarea + button w InterviewWorkspace.tsx:1805.
- ✅ **User widzi powód send-back:** `sentBackReason` w `assignmentInfo` (InterviewWorkspace.tsx:399) — odczytane z assignment row.
- ✅ **Status chips spójne:** `submitted` chip liczy `list.filter(a.status === 'submitted')` (InterviewHub.tsx:1819). Approved chip = `a.status === 'approved'`.

**PROBLEMY NA SCREENIE I W LOGICE:**
1. ⚠️ **„Submitted 0" mimo że jedna sesja ma w NAZWIE „Submitted — Cost baseline (awaiting approval)"** — to znaczy że nazwa pochodzi z seedera demo (Anna Zielińska/Discovery), a faktyczny status assignment jest „Approved" (tag po prawej). Niespójność danych demo (cosmetyczne).
2. ⚠️ **Brak statusu „Sent back" w chip-row** Sessions — kanoniczny chip layout to `All | In Progress | Submitted | Approved`. **Gdzie manager widzi sesje sent_back?** Nie ma chipa, więc nie da się szybko zfiltrować „te które odesłałem do poprawki". Trzeba dodać `Sent back N` jako chip.
3. ⚠️ **Brak chipa „Completed" mimo że status istnieje** — sesja „Discovery — Data & metrics trust" ma status „Completed", ale chip-row pomija ten status.
4. ⚠️ **„Submitted" + status nazwy „awaiting approval"** sugeruje, że Cost baseline jest **„do zatwierdzenia"**, ale chip Submitted=0. To znaczy: backend dostał status `approved`, mimo że tytuł sugeruje czekający. Sprawdzić.
5. ⚠️ **Brak akcji Approve/Send-back bezpośrednio z listy Sessions** — manager musi wejść w sesję, żeby zatwierdzić. Bulk-action „approve selected" / „remind selected" byłby dużym usprawnieniem.
6. ⚠️ **Brak indykacji „awaiting MY approval"** dla managera — w organizacji z wieloma managerami, każdy widzi wszystko. Brak „przypisany do mnie do oceny".
7. ⚠️ **Approve wymaga completeness ≥ 50%** (backend:3186) — owner powinien wiedzieć, że nie da się zatwierdzić niedokończonej ankiety. Frontend musi to komunikować WCZEŚNIEJ (przed kliknięciem), nie dopiero error.

**OCENA OGÓLNA:** Mechanika **istnieje i jest kompletna** na poziomie kodu. Brakuje **chipów filtrów** (sent_back, completed), **bulk actions** w Sessions, i „awaiting my approval" indicator. Status chip dla `submitted` w Sessions = 0 to prawdopodobnie poprawne (żadna sesja nie jest w stanie `submitted`), ale demo seed wprowadza wizualną niespójność.

### #8 · [Sessions / bulk-actions po zaznaczeniu] · Brak likwidacji + brak bulk approve/sendback ⚠️
- **Co widzi owner po zaznaczeniu 3 sesji:** tylko `Clear · AI insights · Export CSV`. Brak: bulk Approve, bulk Send back, Archive, Delete. Owner: „nie mam możliwości żeby likwidować te, które już są wykorzystane, historyczne".

**WERYFIKACJA W KODZIE — co istnieje, co brakuje:**
- ✅ Stan `selectedSessionIds: Set<string>` (InterviewHub.tsx:870) działa, wielokrotny wybór OK.
- ✅ AI insights (Generate AI insights z zaznaczonych) — DZIAŁA jako bulk.
- ✅ Export CSV z zaznaczonych — DZIAŁA jako bulk.
- ❌ **Bulk Approve** — NIE istnieje (ani UI ani endpoint bulk).
- ❌ **Bulk Send back** — NIE istnieje.
- ❌ **DELETE session endpoint** — **brak w interview.routes.ts** (jedyne DELETE: `linked-items`). Jest tylko **w Discovery** (discovery.routes.ts:218) i superadmin. Czyli backend NIE pozwala usunąć sesji interview.
- ❌ **Pole `archived` / `archived_at`** — NIE ISTNIEJE w tabeli `interview_sessions`. Tylko templates mają archiving (Templates tab).
- ❌ **Zakładka „Archiwum"** — brak.

**WYMAGANE DO IMPLEMENTACJI (owner spec):**
1. **Bulk Approve / Send-back** — UI + endpointy `POST /interview/sessions/bulk-approve` + `bulk-sendback` (z opcjonalnym wspólnym reason). Reuse istniejących per-id handlerów w pętli z transakcją.
2. **Archiwum** — dodać kolumny `archived_at TIMESTAMP NULL` + `archived_by UUID NULL` w `interview_sessions` (lazy-ensure ALTER). Akcja Archive ustawia `archived_at = now()`. Restore = `archived_at = NULL`.
3. **Zakładka „Archiwum"** w Sessions chip-row: `All | In Progress | Submitted | Approved | Archived`. Filtruje `archived_at IS NOT NULL`. Default view excluduje archived (jak w Templates).
4. **Delete** (hard delete) — owner-only akcja, dla sesji w stanie `archived` od >X dni. Albo: tylko Archive (soft), brak hard delete (bezpieczniej).

**REKOMENDACJA:** zrobić **Archive + Restore (soft)** zamiast hard-delete. Bezpieczniej (nie traci się danych), reversible, łatwo pokazać licznik „N archived". Bulk Approve/SendBack jako osobny add-on.

**Severity:** średnia. Manager bez tego utknie w nieusuwalnych sesjach (cmentarzysko sesji historycznych); bulk-approve to power-user feature.

### #9 · [Sessions / kolumny + menu wiersza + eskalacja] · Pełen plan profesjonalnego widoku manager
Owner pokazał menu kontekstowe wiersza — dziś tylko `Open` lub `Open + Remind` w zależności od statusu. Pyta o pełen profesjonalny widok.

**KOLUMNY (owner spec):** dziś kolumna `DATE` skleja **wszystko** w jeden zlepek (`Due 27/03/2026` + `Submitted 26/03/2026`) — nieczytelne. Owner chce:
1. **Due date** — kiedy ma być wypełnione
2. **Submitted date** — kiedy faktycznie wysłano
3. **Overdue** — osobny badge/kolumna (chip czerwony „95d overdue" lub ✓)
4. Opcjonalnie: **Cycle time** (Submitted − Due) = ile spóźnienia / ile szybciej

**Status w kodzie:**
- Backend MA `due_at` (timestamp) i computa overdue (`InterviewAssignmentService.ts:1058`).
- Frontend ma chip `Xd overdue` (widoczne w Inbox), ale w Sessions sklejony z datą. Trzeba rozbić na 3 kolumny — czysto frontend.

**MENU WIERSZA (3-kropki) — co jest, co powinno być:**

*Dziś (z screenu):*
- Status `in_progress`: `Open` + `Remind` ✅
- Status `approved`/`completed`: tylko `Open` ✅

*Owner pyta: co warto dodać?* Mój kanoniczny zestaw dla manager view:

| Akcja | Kiedy widoczna | Status backend |
|---|---|---|
| **Open** | zawsze | ✅ istnieje |
| **Open preview (side panel)** | zawsze | ✅ FilterableTable z persistKey — owner wspomniał |
| **Remind** | assigned/in_progress/sent_back | ✅ istnieje (`remindAssignee` w v8) |
| **Approve** | submitted, completeness≥50% | ✅ backend istnieje, brak w menu wiersza |
| **Send back** | submitted | ✅ backend istnieje, brak w menu wiersza |
| **Reassign** | wszystkie nie-approved | ❌ brak |
| **Change due date** | wszystkie nie-approved | ❌ brak (jest endpoint update assignment) |
| **Set escalation target** | wszystkie | ⚠️ kolumna `escalate_to` istnieje w DB, brak UI |
| **Escalate now** (manual) | overdue | ⚠️ silnik istnieje, brak ręcznego triggera |
| **Archive** | approved/completed | ❌ brak (patrz #8) |
| **View activity log** | wszystkie | ✅ `review_decision_memory_json` istnieje |
| **Copy share link** | wszystkie | ✅ istnieje |
| **Convert to template** | approved (ciekawe!) | ❌ nowy pomysł |

**ESKALACJA — DUŻE ODKRYCIE: SILNIK JUŻ DZIAŁA, brak tylko UI ⭐**

Owner sugeruje „może warto eskalację" — sprawdziłem i:
- ✅ `interviewReminderJob.ts` — uruchamia się przez `Scheduler.ts` (cron)
- ✅ `checkAndEscalate()` w `InterviewAssignmentService.ts:1029` — szuka assignmentów `assigned/in_progress/sent_back` które są overdue (`due_at < now-1h`) i nie były eskalowane w ostatnich 24h
- ✅ Tabela ma kolumny: `escalation_deadline`, `escalated_to_user_id`, `escalated_at`, `escalation_reason`, `escalate_to` (target)
- ✅ Reminder cadence: **48h / 24h / 2h** przed deadline (komentarz w Scheduler.ts:614) — to się dzieje automatycznie
- ❌ **Brak UI** do:
  - Wskazania KTO jest escalation target (per assignment, per template, per organization)
  - Włączenia/wyłączenia eskalacji
  - Konfiguracji cadence reminderów (dziś hard-coded 48h/24h/2h)
  - Manual „Escalate now" z menu wiersza
  - Widoczności „kto został eskalowany" w tabeli (dziś niewidoczne, ale `escalated_to` jest w DB)

**REKOMENDACJA — pełen profesjonalny system (priorytety):**

⭐ **MUST (V-A polish):**
1. Rozbicie kolumny DATE na 3 (Due / Submitted / Overdue chip) — czysto frontend
2. Dodanie do menu wiersza: **Approve / Send back / Change due date / Reassign** (akcje już są w backendzie)
3. Bulk Approve / Send back (z #8)

⭐ **SHOULD (V-B nowy zakres):**
4. **Escalation panel** w Settings (per organization): kto jest default escalation target, kiedy eskalacja triggeruje, czy włączona. Bez tego silnik eskaluje do `created_by` (twórca assignmentu).
5. **Manual „Escalate now"** w menu wiersza (overdue → notify designated target natychmiast).
6. **Kolumna „Escalation" w Sessions** (kto, kiedy) — opt-in via View Settings.
7. **Archive** (z #8).
8. **Side preview pane** (Tab w view-mode, `FilterableTable` już to wspiera per #2) — dla Sessions.

⭐ **NICE TO HAVE (przyszłe):**
9. **Activity timeline modal** — wszystkie reminders/escalations/approvals/send-backs jednej sesji (już mamy `review_decision_memory_json`, brak UI).
10. **Convert to template** — gotowa sesja staje się szablonem.
11. **Konfigurowalne reminder cadence** per template (zamiast hard-coded 48/24/2h).
12. **Quality gate visual** — pokazać managerowi PRZED kliknięciem Approve, że completeness < 50% (dziś dostaje 409 error po fakcie).

**Severity:** wysoka dla MUST, średnia dla SHOULD. To są fundamenty pełnego workflow managera — bez tego Interview wygląda jak demo, nie product.

### #10 · [Sessions / brakujące kolumny + filtry per-column] · Systemowy brak ⚠️
Owner otworzył popover „Visible columns" (Status / Progress / Date / Show row description) i zauważył: **brak kolumny Assignee** + **brak filtrów per-column**. To jest systemowa uwaga — owner mówi: „struktura filtrów powinna być standardem w każdej kolumnie tabel".

**OBSERWACJE Z KODU:**

A) **Brakujące kolumny w Sessions** (owner explicit: nie da się powiedzieć kto zalega):
- ❌ **Assignee** (kto wypełnia) — krytyczne dla managera, dziś tylko w sub-tekście „Assignee: Piotr Wiśniewski" pod nazwą sesji, nie da się filtrować ani sortować
- ❌ **Template** (jaki szablon) — też w sub-tekście, brak filtra
- ❌ **Due date** (osobno od Submitted, patrz #9)
- ❌ **Submitted date** (osobno)
- ❌ **Overdue** (chip)
- ❌ **Days remaining / overdue days** (liczba)
- ❌ **Creator / Assigned by** (kto przypisał — ważne w multi-manager)
- ❌ **Escalation target** (komu eskalować — kolumna w DB istnieje, brak w UI)
- ❌ **Last activity** (kiedy ostatnia zmiana)
- ❌ **Project** (jeśli sesja jest project-scoped)
- ❌ **Priority** (low/medium/high/urgent — `AssignmentPriority` istnieje w typie, ale brak kolumny)

B) **Filtry per-column** (owner explicit: „standard w każdej kolumnie"):
- ✅ Kanoniczny `FilterableTable` (shared/ModuleHub/FilterableTable.tsx:171) MA `column.filterable + column.filterOptions` → renderuje dropdown checkbox per column. **Działa od dawna w ~20 innych hubach.**
- ❌ Sessions w Interview **nie używa** FilterableTable — używa hand-written builder. Dlatego brak filtrów per-column mimo że komponent jest gotowy.
- Top-level chipy (`All | In progress | Submitted | Approved`) NIE zastępują per-column filter — chipy filtrują jedną kolumnę (status), ale: assignee, template, project, priority, due-range NIE da się filtrować w ogóle.

**REKOMENDACJA — pełen spec kolumn Sessions + filtry per-column:**

| Kolumna | Default | Sortable | Filterable | Format |
|---|---|---|---|---|
| Name | ✅ visible | ✅ | text-search | tytuł + sub |
| **Assignee** ⭐ | ✅ visible | ✅ | dropdown users | chip avatar+name |
| **Template** | hide (opt-in) | ✅ | dropdown templates | chip |
| **Project** | hide (opt-in) | ✅ | dropdown projects | chip |
| Status | ✅ visible | ✅ | dropdown statuses | StatusBadge |
| **Priority** | hide (opt-in) | ✅ | dropdown 4 levels | chip kolorowy |
| Progress | ✅ visible | ✅ | range | progress bar |
| **Due date** | ✅ visible | ✅ | date range | date |
| **Submitted date** | hide (opt-in) | ✅ | date range | date or — |
| **Overdue** | ✅ visible | ✅ | dropdown (Yes/No) | chip „Xd overdue" |
| **Escalation target** | hide (opt-in) | ✅ | dropdown users | avatar+name |
| **Last activity** | hide (opt-in) | ✅ | date range | „2h ago" |
| **Created by** | hide (opt-in) | ✅ | dropdown users | avatar+name |
| Actions | ✅ required | — | — | ⋯ menu |

⭐ **Najprostsza droga implementacji:** migracja Sessions z hand-written buildera na **FilterableTable** (kanoniczny, persistKey już istnieje od #1 Phase 0). To jest dokładnie część V-B Phase 1, którą wcześniej deferowałem. Z migracją Interview Initiatives, Sessions byłaby drugą tabelą do migracji.

**WAŻNE — zasada owner spec dla CAŁEJ platformy:**
> „Struktura filtrów powinna być standardem w każdej jednej kolumnie, którą mamy w tych tabelach."

To jest standard, który powinien być wymuszony przez kanoniczny komponent. Jak wszystkie tabele Interview (i inne moduły) przejdą na FilterableTable → wszystkie automatycznie dostają filtrowanie per-column. Brak dodatkowej roboty per-moduł.

**Severity:** wysoka. Brak Assignee i filtrów per-column to nie kosmetyka — to blokuje realny manager workflow („kto mi zalega").

### #11 · [Interview / quality gate] · AI ocena jakości odpowiedzi — INFRASTRUKTURA JUŻ ISTNIEJE, brak UI front-and-center ⭐
Owner: „bramka AI — jak user odpowie trzy słowa, AI mu powie że mądrości tak nie zrobimy, popchnie do lepszej; manager widzi marną odpowiedź — odsyła". Sprawdziłem, **75% mechaniki już jest w kodzie**, brakuje UI ekspozycji.

**CO JUŻ JEST W KODZIE (głęboko):**

A) **Backend AI evaluator** (`evaluateInterviewSessionAnswers`, InterviewController.ts:1879):
- Ocenia każdą odpowiedź **1-5 pkt** w 4 wymiarach: Completeness, Specificity, Actionability, Relevance
- 4 verdykty per question: `sufficient | needs_improvement | insufficient | unanswered`
- 6 typów „fix": `clarify | add_evidence | expand_answer | make_specific | complete_required_fields | correct_meaning`
- 3 overall verdicts: `ready_for_approval | needs_improvement | insufficient`
- 2-5 actionable recommendations
- Zwraca structured JSON (zod schema), używa `llmService → OpenRouter` (działa)

B) **Automatyczne triggery:**
- `submitAssignment` (line 2868) — **AI review JEST automatycznie odpalany przy submicie!** Wynik zapisany w `ai_review_snapshot_json`. ✅
- Endpoint manualny: `POST /interview/sessions/:id/evaluate-answers` — można ocenić ad-hoc. ✅
- Endpoint template quality: `POST /interview/templates/evaluate-quality` — ocenia jakość samych pytań w template. ✅

C) **Frontend `SufficiencyIndicator` komponent** (już istnieje):
- Pokazuje score 0-100 + threshold
- 3 kolory: red (<40), amber (<70), green (≥70)
- Ma `canProceed` (gdy ≥ threshold) i `onSendBack` callback z dialogiem
- ⚠️ ALE: znaleziony tylko jako komponent, **niejasne czy faktycznie podpięty** do flow Approve/Submit (sprawdzić gdzie używany)

D) **Manager send-back z AI:**
- Po submicie manager dostaje notyfikację „Interview submitted for review"
- W assignment row jest `ai_review_snapshot_json` z weak answer map + recommendations
- Manager może użyć `sendBackAssignment` przekazując `missingItems[]` (już jest mechanika)

**CZEGO BRAKUJE — żeby owner spec był spełniony:**

1. ❌ **PRE-SUBMIT BRAMKA (USER) — kluczowe wg ownera:** dziś user może submitować dowolnie krótką odpowiedź (gate to tylko completeness ≥50% per session, NIE per answer quality). AI review odpala się DOPIERO po submicie. Trzeba: **przed kliknięciem Submit** odpalić AI review, pokazać użytkownikowi „twoje odpowiedzi 2 i 5 są za krótkie, AI rekomenduje: ..." i dać 2 opcje: „Wróć i popraw" (preferowane) lub „Wyślij i tak (na własną odpowiedzialność)".
2. ❌ **POJEDYNCZA ODPOWIEDŹ — instant feedback:** kiedy user wpisuje 3-słowną odpowiedź i kliknie Next/Save, **nic mu nie mówi** że to za mało. Powinien dostać inline indicator typu „Zbyt krótko — AI sugeruje rozwinąć" z opcją „użyj AI improve" (ten przycisk już istnieje!).
3. ❌ **MANAGER VIEW AI snapshot:** w panelu Approve manager nie widzi AI verdict, weak answer map, recommendations. Tylko status submitted + szansa kliknąć Approve/SendBack. Powinien widzieć: „AI: score 2.1/5, verdict: insufficient, 3 słabe odpowiedzi: Q2, Q5, Q9" — z jednym klikiem „Send back with these reasons" (pre-wypełnione missing items z AI).
4. ❌ **CALIBRATION CONFIG:** dziś threshold sufficient/needs_improvement/insufficient hard-coded (>=3.5 / >=2.5 / <2.5). Powinien być per-organization config (manager może być surowszy lub bardziej liberalny).
5. ❌ **AI-GUIDED SEND BACK:** dziś send-back wymaga, żeby manager sam napisał reason + missing items. Można z AI snapshota wygenerować draft send-back message: „Twoja odpowiedź na Q5 jest zbyt ogólna. AI rekomenduje: dodaj konkretne liczby budżetu i timeline. Inne uwagi: ..."

**REKOMENDACJA — pełen plan implementacji „procedury audytowania dopuszczania":**

⭐ **MUST (krytyczne dla jakości):**
1. **Pre-submit AI gate** dla usera — przed `Submit` odpalamy `evaluateSessionAnswers`, pokazujemy modal z scorem, weak answers, recommendations. 2 przyciski: „Wróć i popraw" / „Wyślij mimo to". (~1 dzień)
2. **Manager AI snapshot panel** — w Approve UI pokazać overallScore + verdict + listę weak answers z fixType + recommendations. Przycisk „Send back from AI" pre-wypełnia missing items. (~1 dzień)
3. **Per-question instant feedback** — gdy odpowiedź < 20 znaków (heurystyka) pokazać szary hint „Spróbuj dodać konkretny przykład albo liczbę — AI doradza precyzję". (~2-3h)

⭐ **SHOULD (polish):**
4. **AI-drafted send-back reason** — przycisk „Generuj uzasadnienie z AI" obok textarea reason.
5. **Threshold config** per org (Settings → Interview → quality threshold).
6. **AI quality badge** w Sessions table — kolumna „AI Score" z scorem + verdict chip (red/amber/green).
7. **Re-evaluate on demand** — manager może odpalić AI re-review (np. po zmianach w odpowiedziach).

⭐ **NICE TO HAVE:**
8. **Voice-mode AI gate** — gdy user dyktuje krótko, voice AI sama pyta „Czy możesz podać konkretny przykład?" przed Next. (wymaga Voice w ankiecie z #5).
9. **A/B threshold A/B testing** — porównanie jakości outputs z różnymi thresholdami.
10. **AI ocena spójności wewnętrznej** — wykryć sprzeczne odpowiedzi w jednej ankiecie.

**Severity:** krytyczna dla MUST. Bez tego AI review jest „cichym" feature — robi się w tle, ale UX nie pcha usera do lepszych odpowiedzi (ownera punkt: „mądrości tak nie zrobimy").

### #12 · [Sessions vs Assigned + archive + skala 400] · Decyzja architektoniczna ⭐ KRYTYCZNA
Pełna analiza: `docs/audit/2026-06-05/_IV_SESSIONS_VS_ASSIGNED_DECISION.md`. Krótko:
- **Sessions vs Assigned:** dziś 2 zakładki na to samo (sesja:assignment ≈ 1:1). Rekomendacja: **MERGE w jedną zakładkę „Work"** opartą na FilterableTable (#10). Assigned znika jako tab → zostaje jako saved view.
- **Archiwizacja:** owner spec: archive (reversible, czytelne) → trash (30 dni, reversible) → permanently delete (irreversible, drugie potwierdzenie). ALTER columns: `archived_at`, `archived_by`, `trashed_at`, `trashed_by`.
- **Skala 400 ankiet (100×4):** wymaga saved views, bulk actions (Approve/SendBack/Remind/Reassign/Archive), grouping (Linear-style), server-side pagination, AI insights na batch.
- **Plan:** 3 fazy, ~1 tydzień:
  - Faza 1 (struktura): merge zakładek, FilterableTable, kolumny, saved views
  - Faza 2 (lifecycle): archive/trash/delete + chip-row Active/Archive/Trash
  - Faza 3 (skala): grouping, pagination, bulk, batch AI
- **Severity:** krytyczna decyzja przed podejściem do innych UI prac, bo każda zmiana w 2 zakładkach to 2× robota.

### #13 · [Assigned tab] · Pełen plan kolumn + kebab menu + filtry per-tab
Owner pokazał Assigned (manager view) — chce: rozbudowane kolumny dla manager perspektywy + pełen kebab + globalne filtry per zakładka. Dziś chipy są dziedziczone z Inbox (`ALL/My inbox/To approve/Overdue`), co dla managera nie ma sensu.

**A) STAN DZIŚ (z kodu + screenu):**
- **Kolumny visible:** Template (req), Assignee, Status, Progress, Days to Due, Actions (req) + Show row description
- **Kebab menu — DYNAMICZNY (lepiej niż w Sessions!):**
  - **Zawsze:** Open
  - **Gdy showAssignee && canAssign && status !== completed/approved:** Send reminder
  - **Gdy status === submitted (manager pending review):** Approve · Send back (danger)
  - **Gdy status === sent_back && jest sessionId (user own):** Fix & Resubmit
- **Chipy filtrów:** dziedziczone z Inbox (`ALL · My inbox · To approve · Overdue`) — manager-niespójne (My inbox to user-scope, To approve to manager-scope)
- **Filtrów per-column:** ZERO (bo nie używa FilterableTable, patrz #10)
- **Brak globalnych filtrów po prawej stronie menu 2** (owner spec).

**B) KOLUMNY — pełen kanoniczny zestaw dla Assigned (manager workflow):**

| Kolumna | Default | Sortable | Filterable | Po co |
|---|---|---|---|---|
| Template | ✅ visible (req) | ✅ | dropdown templates | wiadomo o czym ankieta |
| **Assignee** | ✅ visible | ✅ | dropdown users | KOMU kazałem (najważniejsze!) |
| Status | ✅ visible | ✅ | dropdown 6 statusów + archived | gdzie jest w lifecycle |
| Progress | ✅ visible | ✅ | range | wskaźnik zaawansowania |
| Days to Due | ✅ visible | ✅ | range (numeric) | overdue widoczne |
| **Due date** | hide (opt-in) | ✅ | date-range picker | precyzyjne planowanie |
| **Submitted date** | hide (opt-in) | ✅ | date-range | wiadomo kiedy wpłynęło |
| **AI Score** ⭐ | hide (opt-in) | ✅ | dropdown (red/amber/green) | quality gate visible (#11) |
| **AI Verdict** ⭐ | hide (opt-in) | ✅ | dropdown 4 verdicts | sufficient/needs_improvement... |
| **Priority** | hide (opt-in) | ✅ | dropdown 4 levels | low/medium/high/urgent |
| **Project** | hide (opt-in) | ✅ | dropdown projects | jeśli multi-project |
| **Created at** | hide (opt-in) | ✅ | date-range | kiedy przydzielone |
| **Created by** | hide (opt-in) | ✅ | dropdown users | kto przypisał (multi-manager) |
| **Last reminded** | hide (opt-in) | ✅ | date-range | kiedy ostatnio popchnąłem |
| **Reminder count** | hide (opt-in) | ✅ | range | ile razy przypominane |
| **Escalation target** | hide (opt-in) | ✅ | dropdown users | komu eskalować (kolumna w DB istnieje) |
| **Escalated at** | hide (opt-in) | ✅ | date-range | kiedy eskalowane |
| **Sent back count** | hide (opt-in) | ✅ | range | ile razy odsyłane (rework metric) |
| **Last activity** | hide (opt-in) | ✅ | „2h ago" | kiedy ostatnia zmiana |
| Actions | ✅ required | — | — | kebab |

**C) KEBAB MENU — kanoniczny pełen zestaw dla Assigned:**

| Akcja | Kiedy widoczna | Backend |
|---|---|---|
| **Open** | zawsze | ✅ |
| **Open in side preview** | zawsze | ✅ (FilterableTable pattern) |
| **Send reminder** | active assignments (nie approved/completed) | ✅ istnieje |
| **Approve** | submitted only, completeness≥50% | ✅ istnieje |
| **Send back** | submitted only | ✅ istnieje |
| **Fix & resubmit** | sent_back (user own) | ✅ istnieje |
| **Reassign to...** | assigned/in_progress | ❌ brak UI (endpoint update istnieje) |
| **Change due date** | nie approved/completed | ❌ brak UI |
| **Change priority** | wszystkie | ❌ brak UI |
| **Set escalation target** | wszystkie | ⚠️ kolumna w DB, brak UI |
| **Escalate now** | overdue | ⚠️ silnik istnieje, brak manual triggera |
| **View AI review** ⭐ | submitted/approved/sent_back | ⚠️ snapshot istnieje, brak UI viewer |
| **View activity log** | wszystkie | ✅ review_decision_memory_json |
| **Copy share link** | wszystkie | ✅ |
| **Archive** | approved/completed | ❌ brak (z #8 i #12) |
| **Move to trash** | wszystkie z confirm | ❌ brak (z #12) |
| **Convert to template** | approved (nowy pomysł) | ❌ brak |

**D) FILTRY w MENU 2 (right slot) — owner spec:**

Owner explicitly: „filtry powinny być z prawej strony w menu 2... w sessions i w assignments... żebyśmy widzieli jakiego typu listy chcemy oglądać".

Dziś po prawej stronie menu 2 jest tylko `[ListView/GridView toggle] [Assign button]`. **Brak globalnych filtrów lifecycle.**

**Proponowane filtry po prawej stronie:**

1. **Lifecycle scope dropdown** (owner spec głównie):
   - `Active` (default) — `archived_at IS NULL AND trashed_at IS NULL`
   - `Archive` — pokazuje archiwum
   - `Trash` (30-day soft) — pokazuje trash
   - `All time` — wszystko łącznie z archiwum
2. **Status multi-select** (zamiast chipów):
   - Multi-checkbox: assigned · in_progress · submitted · sent_back · approved · completed
3. **Assignee multi-select** (osobny filtr, najczęściej używany):
   - Multi-checkbox users z avatarami
4. **Date range:**
   - Due in (next 7d / next 30d / overdue / custom)
   - Submitted in
   - Created in
5. **AI Score range:** sliderem (1-5)
6. **Priority multi-select:** chipy 4 poziomów

**E) JAK TO POŁĄCZYĆ — saved views & filter persistence:**

Owner spec o filtrach „żebyśmy widzieli jakiego typu listy chcemy oglądać" = de facto wymaga **saved views** (presetów). Najsensowniej:

- **Pasek presetów** zamiast hard-coded chipów `ALL/My inbox/To approve/Overdue`:
  - `Awaiting my approval` (status=submitted, created_by=me)
  - `My team's overdue` (status≠approved/completed, due<now, created_by=me)
  - `This week's submissions` (submitted_at>7d ago)
  - `All active` (default)
  - `Archive` (lifecycle=archived)
  - `Trash` (lifecycle=trashed)
  - **+ user defined** (zapisany za pomocą „Save current filters as view")
- Każdy preset = saved combination of filtrów z punktu D.
- Filtry per-column + global filters work in conjunction.

**F) REKOMENDACJA — priorytety:**

⭐ **MUST (V-B Phase 1 — wraz z #10, #12):**
1. Migracja Assigned na FilterableTable → automatyczne per-column filters.
2. Lifecycle dropdown w menu 2 (Active/Archive/Trash) — owner spec.
3. Kolumna **Assignee**, **AI Score**, **Due date osobno**, **Submitted date osobno** (visible default).
4. Reszta kolumn opt-in via Visible columns.
5. Kebab: dodać **Approve/SendBack/Fix** (już są handlery) jako visible w main menu + **Reassign/Change due date** (nowe).

⭐ **SHOULD (V-B Phase 2):**
6. Saved views z pre-setami (Awaiting my approval / Team overdue / This week / All active / Archive / Trash).
7. Archive/Trash actions w kebab + bulk.
8. **AI review viewer** modal (z #11) — view snapshot bez wchodzenia w session.
9. Set escalation target (manual).

⭐ **NICE TO HAVE:**
10. Reminder/Escalation metrics columns (count, last reminded, escalated at).
11. Sent back count (rework metric per assignee — manager video „ten Janek dostaje zwroty 3× częściej niż średnia").
12. Convert to template.
13. Activity log timeline modal.

**Severity:** wysoka. Owner spec o filtrach po prawej + lifecycle = blokuje pełny manager workflow.

### #14 · [AssignInterviewModal] · Nowy kanoniczny standard dla wszystkich modali formularzy ⭐
Owner: „samo wybieranie przy krótkich listach które się zasłaniają jest problematyczne... priority brzydkie, ta tabela nie jest profesjonalnie ładna... pozaokrąglajmy kształty... to ważny moment na wybór rozwiązań, później kolejne tabele będziemy nawiązywali do tego".

**A) DIAGNOZA W KODZIE (`AssignInterviewModal.tsx`):**

| Element | Stan dziś | Problem |
|---|---|---|
| **Template picker** (linia 717) | Custom dropdown ze searchem ✅ | OK, ale zasłania resztę formularza w trakcie wyboru |
| **Assign to (users)** | Custom multi-select ze searchem ✅ | OK |
| **Due Date** | `<input type="date">` natywny | Browser-default calendar, brzydki, niespójny cross-browser |
| **Priority** (linia 762) | **`<select>` natywny** ❌ | To źródło „brzydoty" — browser-default styling, ostre kąty, brak ikony chip |
| **Notes** | `<textarea>` zwykły | OK |
| **Buttony** | Cancel + Assign rounded-lg | OK |
| **Modal shell** | rounded-2xl bg dark | OK, profesjonalny |

**B) DLACZEGO DROPDOWNY „się zasłaniają":**
- Renderowane jako **inline** absolute pod inputem (`absolute top-full mt-1`) z **fixed inset-0 backdrop** (klik poza zamyka). Problem: gdy template/user dropdown otwarty, **zasłania** Due Date + Priority + Notes. Owner musi zamknąć żeby zobaczyć co niżej.
- **Fix kanoniczny:** użycie **Portal** (Radix-style) — dropdown renderuje się w `document.body` z `position: fixed` względem trigger, NIE blokuje treści pod modalem. Dodatkowo: **auto-flip** (jeśli za mało miejsca pod, otwiera się nad triggerem).

**C) DOSTĘPNE KANONICZNE PRIMITIVY (już w kodzie, nie używane przez AssignInterviewModal):**
- `src/components/ui/primitives/Select.tsx` ✅
- `src/components/ui/primitives/Dropdown.tsx` ✅
- `src/components/ui/select.tsx` (shadcn-style) ✅
- `src/components/ui/dropdown-menu.tsx` (Radix-portal) ✅
- `src/components/shared/ModuleHub/StatusDropdown.tsx` ✅
- `src/components/ui/composed/Modal.tsx` ✅

Infrastruktura **istnieje** — to kwestia migracji AssignInterviewModal na canonical components.

**D) PROPONOWANY KANONICZNY STANDARD FORM-MODALI (owner spec — wzorzec dla wszystkich):**

⭐ **Shell (Modal):**
- `rounded-2xl` (mocniej zaokrąglone niż dziś — spójność z chipami)
- `max-w-lg` (508px) dla typowego formularza, `max-w-2xl` dla większych
- Backdrop `bg-black/60 backdrop-blur-sm`
- Header: ikona w kółku + Title + Subtitle + Close × (jak dziś)
- Footer: Cancel (ghost) + Primary action (filled, gradient/solid)
- Padding: `p-6`
- **Sekcje** rozdzielone subtelnym separatorem `border-t border-white/[0.06]` (zamiast luźnego spacingu)

⭐ **Form Field (kanoniczny):**
```
<Field>
  <FieldLabel required>Etykieta</FieldLabel>
  <FieldHint>(opcjonalnie wyjaśnienie)</FieldHint>
  [Input/Select/DatePicker — zawsze rounded-xl, h-10]
  <FieldError>(walidacja inline)</FieldError>
</Field>
```
- Wszystkie inputy **`h-10 rounded-xl`** (spójne wymiary)
- Focus ring `ring-2 ring-primary-500/40` (nie agresywny)
- Disabled `opacity-50 cursor-not-allowed`
- Border `border-white/[0.08]` (subtelniejszy niż dziś)
- Background `bg-white/[0.04]` (transparent feel)

⭐ **Select / Dropdown (kanoniczny):**
- **Portal-based** (Radix-style) — nigdy nie zasłania innych pól
- **Auto-flip** gdy mało miejsca pod
- Trigger wygląda jak Input (h-10 rounded-xl)
- Każdy item: ikona (opcjonalnie) + label + check przy zaznaczonym
- Hover `bg-white/[0.06]`, selected `bg-primary-500/15`
- **Multi-select** = chipy z × wewnątrz triggera

⭐ **Priority specifically (owner wskazał jako brzydkie):**
Zamiast natywnego dropdownu — **chip-row picker** (4 buttony zamiast dropdownu):
```
[ ○ Low ] [ • Medium ] [ ! High ] [ 🔥 Urgent ]
```
- Każdy chip: rounded-full, ikona + label, kolor wskazujący poziom
- Aktywny: filled gradient + ring
- Nieaktywny: outline + hover
- **Zaleta:** 1 klik = wybór, nie trzeba otwierać dropdownu, nie zasłania nic.

⭐ **Date Picker (kanoniczny):**
Zamiast natywnego `<input type="date">`:
- Custom popover calendar (Radix-portal)
- Trigger: chip z ikoną kalendarza + sformatowana data („6 cze 2026")
- W popoverze: szybkie skróty (Today / Tomorrow / Next week / Next month) + miesięczny grid
- Auto-flip
- **Spójny cross-browser** (natywny date input wygląda inaczej w Chrome/Safari/Firefox)

⭐ **Multi-select Users (chipy):**
- Po wyborze użytkownika → renderuje się chip z avatarem + imieniem + × inside trigger
- Można wybrać kilka — wszystkie chipy w triggerze
- Search inside dropdown
- Hover row pokazuje email pod imieniem

**E) JAK TO ZAGRA DLA INNYCH MODALI:**

Te same primitivy stosować w:
- Send Back modal (reason + missing items)
- Approve modal (z AI snapshot preview)
- Reminder modal (custom message + cadence)
- Change Due Date modal
- Reassign modal
- Edit Template metadata
- New Session modal
- Archive/Trash confirm modals
- **Inicjatywy, Tasks, Decisions, Wnioski** — w innych modułach też

**F) REKOMENDACJA — kolejność implementacji:**

1. **Wynieść Form primitivy** do `shared/forms/` (FormShell, Field, FieldLabel, Select, MultiSelect, DatePicker, PriorityPicker, ChipPicker) — jeśli któreś brakuje, dodać.
2. **Refactor AssignInterviewModal** jako referencyjny wzorzec → wszystkie Form pattern w jednym miejscu.
3. **Doc strona** `docs/design-system/FORMS.md` z przykładami i prop API.
4. **Migracja innych modali** Interview (SendBack, Approve, Reminder, NewSession) — natychmiast po AssignModal jako wzorzec.
5. **Migracja innych modułów** (Tasks, Decisions, Initiatives) — iteracyjnie.

**Severity:** krytyczna jako fundament. Owner explicit: „to ważny moment na wybór rozwiązań".

### #15 · [Templates / kebab + filtry] · Najbogatszy wzorzec — używać jako referencję dla innych zakładek
Owner pokazał Templates z otwartym kebabem: `Open · Assign · Use template · Clone template · Edit template`. To **najbogatszy** kebab w całym Interview module.

**OBSERWACJE — co dobre:**
- Kebab Templates prowadzi user-flow: Use template (start nowej sesji) / Clone (skopiuj jako szablon) / Edit (modify).
- **Chipy filtrów spójne ze status modelem:** `All 18 · Draft 8 · In review 0 · Published 10 · Archived 0` — Templates ma to **dobrze** zrobione (efekt V-A S5 fix).
- **Filtry po prawej menu 2** — `Area: all + Source: all` (dropdowny) → Templates ma już to czego brakuje Sessions/Assigned (z #13). To dokładnie ten wzorzec, którego owner chce wszędzie.
- Status pills (Published + Default) — kanoniczna kombinacja.

**BRAKUJE w kebab:**
- Archive (jest fix V-A polish, ale tylko na hover row — powinno być w kebab)
- Delete forever (z confirm „wpisz nazwę")
- Set as default / Unset as default
- View usage — gdzie ten template jest używany (kto i kiedy assign — manager nie wie czy może bezpiecznie archiwizować)

**WAŻNE — Templates jako referencyjny wzorzec dla Sessions/Assigned:**
Owner explicit „struktura filtrów powinna być standardem". Templates **już ma** wzorzec, który Sessions/Assigned powinny przejąć:
- Chip-row spójny ze status modelem (z #6 dla Inbox)
- Lifecycle/scope filter po prawej (Area, Source — z #13 dla Sessions to byłby Active/Archive/Trash)
- Per-column filters via FilterableTable (z #10)

**Severity:** średnia. Templates są w dobrej formie. Główna wartość: jako wzorzec dla innych zakładek + dorzucić Archive/Delete/Default/Usage do kebab.

### #16 · [Templates / kolumny tabeli] · Brakujące dla zarządzania biblioteką szablonów
Dziś (z screenu Templates): `Name (z opisem) · Category · Questions · Status · Actions`. To minimum. Dla manager pracującego z biblioteką brakuje:

**Backend wystawia (sprawdzone w SQL `getTemplates` query):**
- `t.*` — wszystkie kolumny templates (status, language, area_tags, is_default, source, kind, created_by, created_at, updated_at)
- `question_count` ✅
- `(SELECT COUNT FROM interview_sessions s WHERE s.template_id = t.id)` jako **usage_count** ✅ (już liczone!)

**Propozycja kolumn (default + opt-in):**

| Kolumna | Default | Po co |
|---|---|---|
| Name + description | ✅ visible (req) | — |
| Category | ✅ visible | — |
| Questions | ✅ visible | ile pytań |
| Status | ✅ visible | Draft/In review/Published/Archived |
| **Default badge** | ✅ visible (gdy jest) | — |
| Actions | ✅ required | kebab |
| **Usage count** ⭐ | hide (opt-in) | ile razy używany (czy bezpiecznie archiwizować — bez tego manager strzela na ślepo) |
| **Last used** | hide (opt-in) | kiedy ostatnio użyty |
| **Source** | hide (opt-in) | system / user / imported / cloned-from |
| **Language** | hide (opt-in) | pl / en |
| **Area tags** | hide (opt-in) | obszary (multi) |
| **Estimated time** | hide (opt-in) | `time_min` — szacowany czas wypełnienia |
| **Runtime mode** | hide (opt-in) | one_question_at_time / all_at_once |
| **Created by** | hide (opt-in) | kto stworzył (multi-author org) |
| **Created / Updated** | hide (opt-in) | timestampy |
| **AI quality score** ⭐ | hide (opt-in) | endpoint `evaluate-quality` już istnieje — ocenia jakość pytań w template |

**Najważniejsze brakujące:**
1. **Usage count** — bez tego nie wiadomo czy template żyje (czy bezpiecznie archiwizować)
2. **AI quality score** — owner ma już `evaluate-quality` endpoint na backendzie, można pokazać ocenę pytań w template
3. **Last used** — szybko widać który template jest „dead" w bibliotece

**Severity:** średnia. Templates funkcjonują, kolumny opt-in to polish.

### #17 · [TemplateBuilder / „AI" vs „Create survey with AI"] · Owner pyta wprost — odpowiedź ⭐
Owner explicit: „w prawym górnym rogu tabeli jest jeszcze jeden przycisk AI. Strasznie jestem ciekaw, co on robi i czy on nie jest przypadkiem tym samym co create survey with AI."

**ODPOWIEDŹ — to DWA RÓŻNE flow (sprawdzone w kodzie):**

| Przycisk | Lokalizacja | Funkcja | Wymaga |
|---|---|---|---|
| **„Create survey with AI"** (lewy panel, czerwony) | `Create survey with AI` przy `Topic/Description` | **TWORZY** wszystkie pytania od zera na podstawie Topic + Description + Question count + Time + Areas + Tolerance | pusta ankieta (lub overwrite) |
| **„AI"** (prawy górny, mały chip) | `proposeQuestionImprovementsWithAI` | **POPRAWIA / UZUPEŁNIA** istniejące pytania (lub wgrane przez Upload) — daje suggestions: clarify / expand / add evidence / make specific etc. | minimum 1 pytanie LUB wgrana ankieta z Upload |

**Czyli:**
- „Create survey with AI" = **GENERATE from scratch** (główny generator)
- „AI" = **REVIEW + IMPROVE** (mniejszy asystent inkrementalny, np. po Add Question ręcznie / po Upload PDF)

**Czy to jest dobre?**
- ✅ Funkcjonalnie różne — każdy ma sens (generate od zera vs improve istniejące)
- ❌ **UX dramatycznie myląca** — oba mają nazwę „AI" + Sparkles ikonę. Owner sam się złapał. To **wymaga rebranding**:
  - „Create survey with AI" → ✓ zostaje
  - „AI" (prawy górny) → **„Improve" / „Suggest"** lub **„Review"** z tooltip „Use AI to review and improve existing questions"
- ❌ Owner nie wie kiedy używać którego — brakuje **mikro-tooltip** + onboarding hint przy pierwszym wejściu.

**KOLEJNE SPRAWY w TemplateBuilder (sprawdzone w kodzie):**

**Co jest:**
- ✅ Add Question (ręcznie) — działa, dodaje pytanie z pełną formatką
- ✅ Upload — wgrywa plik (.txt / .md / .pdf), z auto-review przez AI
- ✅ Pełna formatka pytania: Title / Answer Type / Required / Help Hint / Description / Evidence Prompt / Expected answer shape / Modalności (Voice / Attachments / Links / Context note)
- ✅ Drag-handle dla reorderowania (ikona `≡` z lewej)
- ✅ Wybór typu Open text (otwarte) / wiele typów dostępnych
- ✅ Personal / Organization library toggle
- ✅ Area tags / Available answer types / Question count / Tolerance / Time / Runtime mode
- ✅ Create survey with AI ⭐ (główny generator)
- ✅ AI improve (mały — patrz wyżej)
- ✅ Check quality (stopka) — AI evaluate templates
- ✅ Save Draft / Publish / Cancel
- ✅ Voice answer / Attachments / Links / Context note modality (per-question)

**Czego BRAKUJE:**
1. **Wzorce/preset pytań** — biblioteka „popularnych pytań" do wciągnięcia jednym klikiem („gotowe formułki" jak Notion templates)
2. **Question types preview** — owner nie wie co dostanie wybierając „Multi choice" / „Rating scale" / „Number" — brak hinta jak będzie wyglądało w runtime
3. **Branching / conditional** — „jeśli pytanie 3 ma odpowiedź X, pokaż pytanie 4" (advanced, ale standard w SurveyMonkey/Typeform)
4. **Sekcje / kategorie pytań** — grupowanie pytań w sekcje (dla długich ankiet) — dziś tylko płaska lista
5. **Validation rules** per pytanie (min/max length, regex dla custom formatów)
6. **Translacja PL/EN** — przełącznik dla bilingual templates
7. **Preview as user** — przycisk „zobacz jak respondent" przed publikacją
8. **Version history** templates (kto kiedy co zmienił) — gdy współpraca multi-author
9. **Duplicate question** — bez tego trzeba ręcznie przepisywać
10. **Import z innego template** — wciągnij 3 pytania z innego template

**Severity:** wysoka. Owner explicit „to jest ważny moment, bo tutaj byśmy chcieli móc stworzyć kolejne pytania" — wszystkie core funkcje DZIAŁAJĄ, ale UX (zwłaszcza dwa AI buttony) myli + brakuje 4-5 standardowych ficzerów survey builders (sekcje, branching, preview).

### #18 · [Standard graficzny tabel] · Owner spec dla całej platformy ⭐ KRYTYCZNY WYBÓR
Owner: „czy ten kształt grafiki w tabeli nam odpowiada... mamy różne kolory tła co powoduje że część opisów jest jaśniejszym, część zielonym, część czymś tam. Pomyśl czy to jest rzeczywiście taka formuła. Zaproponuj inny standard graficzny który będzie bardziej tech, bardziej sexy, bardziej pasujący do całości. To co tu zaproponujesz musisz opisać jako standard, bo później będziemy wykorzystywali to także w innych tabelach."

**DIAGNOZA — skąd „różne kolory tła":**

Dziś w tabelach Interview używane są (z kodu InterviewHub):
- `border-slate-200/70 dark:border-white/[0.06]` — header
- `border-slate-200/50 dark:border-navy-700/50` — wiersze
- `border-slate-200/50 dark:border-white/[0.08]` — niektóre wiersze (niespójne!)
- `bg-slate-50/70 dark:bg-navy-900/40` — header tło
- `bg-white/60 dark:bg-navy-900/60` — niektóre headery (różnice)
- `rowAccentClass + rowToneClass` (dynamiczne kolory wierszy zależnie od status/overdue)
- Status pills każdy moduł ma swoje kolory (cztery różne palety statusów)

**To jest dokładnie to co owner widzi:** różne odcienie tła, opisy raz w `text-slate-500` raz `text-slate-400` raz `text-emerald-500` — bo dynamiczne kolory akcentowe (overdue = czerwone tło, approved = zielonkawe).

**PROPOZYCJA STANDARDU — „Console / Linear" style:**

⭐ **Filozofia:** mniej koloru, więcej hierarchii. Linear/Console/Vercel dashboard style: czysty, monochromatyczny, ostre typo, dyskretne kolory tylko jako akcent **w semantyce** (status pill, AI score chip), NIE w tle wierszy.

⭐ **Tło tabeli — JEDEN kolor:**
- Light: `bg-white` z `border-slate-100`
- Dark: `bg-navy-950` z `border-white/[0.06]`
- **Brak** alternating row colors (zebra stripes) — owner: „różne kolory tła" znikają
- Hover row: `bg-slate-50/50 dark:bg-white/[0.02]` — bardzo subtelnie
- Selected row: `bg-primary-50/30 dark:bg-primary-500/[0.06]` z left accent border 2px primary
- **Brak** kolorowych akcent tła dla overdue/approved/itd. — kolor żyje w pills.

⭐ **Typografia — hierarchia:**
- Header: `text-[11px] uppercase tracking-[0.12em] text-slate-500 dark:text-slate-500 font-semibold`
- Cell primary text: `text-sm text-slate-900 dark:text-slate-100`
- Cell secondary (sub-text pod nazwą): `text-xs text-slate-500 dark:text-slate-500`
- Numbers / metadata: `text-xs tabular-nums text-slate-600`
- **Linear-style:** tytuł lekki bold (font-medium), sub-tekst lighter

⭐ **Borders — minimalne:**
- Header `border-b border-slate-100 dark:border-white/[0.06]` (włos, nie ciężki)
- Wiersze NIE mają borderów (separator = subtelny `divide-y divide-slate-100 dark:divide-white/[0.04]`)
- **Brak** zewnętrznego borderu tabeli — pływa w tle.

⭐ **Komórki:**
- Padding `px-4 py-3` (mniej pionowy padding dla compact list)
- Vertical align top dla cells z multi-line content
- Truncate z tooltip dla długich tekstów

⭐ **Status pill — SSOT (Single Source Of Truth):**
- Jeden kanoniczny `<StatusPill status>` komponent — bierze status string, mapuje na semantykę:
  - `in_progress / draft / open` → blue (informacyjny)
  - `submitted / pending` → amber (oczekuje)
  - `approved / completed / published` → emerald (sukces)
  - `sent_back / rejected / failed` → rose (uwaga)
  - `archived` → slate (neutralny)
- Style: `rounded-full px-2 py-0.5 text-[11px] font-medium border` z subtle bg (`bg-emerald-500/10 text-emerald-300 border-emerald-500/20`)
- **Zero koloru w innym miejscu wiersza** — owner będzie widział „okiem statusy" bez zmęczenia oczu zielonym/żółtym tłem

⭐ **Progress bar:**
- Cienki `h-1 rounded-full bg-white/[0.06]` z `bg-primary-500` wypełnieniem
- Liczba `%` po prawej w `text-xs tabular-nums`
- Dla overdue: zmiana koloru paska na `bg-rose-500` (subtelny sygnał, nie tło wiersza)

⭐ **Avatar + nazwa (Assignee):**
- 24px circle z initialami i `bg-gradient-to-br from-primary-500/30 to-primary-600/30`
- Nazwa obok w `text-sm`
- Spójnie wszędzie

⭐ **Chips (Category, Source, Area, Priority):**
- `rounded-full border border-white/[0.06] bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400`
- Wszystkie te same wymiary, te same kolory
- Variant z ikoną gdy potrzeba

⭐ **Days to Due / Overdue chip:**
- Active (>0): `text-xs text-slate-500` z liczbą + „d"
- Overdue: `rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 px-2 py-0.5 text-[11px]` — chip, NIE tło wiersza
- Symbol ⚠ przed liczbą tylko gdy critically overdue (>30d)

⭐ **Empty state:**
- Centered, icon + helpful copy + CTA
- `text-slate-500` — dyskretny

⭐ **Loading:**
- Skeleton rows (3-5) z `animate-pulse` + `bg-white/[0.04]`

⭐ **Sticky header:**
- `sticky top-0 z-10 bg-navy-950/95 backdrop-blur-sm` — header zostaje przy scrollu

⭐ **Row actions (kebab):**
- Pojawia się na hover (`opacity-0 group-hover:opacity-100 transition-opacity`)
- Pozycjonowanie absolute right-2 (overlay nad ostatnią kolumną)
- W mobile: zawsze visible

**ZESTAWIENIE: co znika, co zostaje:**

| Element | Dziś | Standard |
|---|---|---|
| Zebra stripes | mix tła | ❌ usunąć |
| Row tone color (overdue/approved tło) | dynamiczne | ❌ usunąć — kolor w pill |
| Border każdego wiersza | gruby | tylko divider 1px hairline |
| Status pill | 4 różne style w 4 zakładkach | ✅ jeden kanon |
| Tła headerów | różne `bg-slate-50` vs `bg-white/60` | ✅ jeden `bg-navy-950/95 backdrop` |
| Akcent left border (selected) | brak | ✅ 2px primary |
| Hover row | mocne | subtelne `bg-white/[0.02]` |
| Avatar style | różne | ✅ jeden 24px gradient |

**REKOMENDACJA — kolejność:**
1. **Zdefiniować spec design-system** w `docs/design-system/TABLES.md` (z tokenami: spacing, radius, colors, typography).
2. **Wynieść do `shared/Table/`** primitivy: `<DataTable>`, `<TableHeader>`, `<TableRow>`, `<TableCell>`, `<StatusPill>`, `<AvatarCell>`, `<ProgressCell>`, `<OverdueChip>`, `<ChipTag>`, `<RowActions>`.
3. **Pilotaż na Templates** (najprostsze, najmniej wierszy) — owner widzi efekt natychmiast.
4. **Migracja Sessions/Assigned/Inbox/Insights/Initiatives** w V-B Phase 1-5.
5. **Migracja innych modułów** (Tasks, Decisions, Initiatives, Wnioski) — iteracyjnie.

**Severity:** krytyczna jako fundament wizualny. Owner explicit: „to co zaproponujesz musisz opisać jako standard". Bez tego każda kolejna tabela będzie znów hand-written z inną estetyką.

### #19 · [Audit Orchestrator] · Dwa epicowe use case'y owner ⭐⭐⭐ DUŻY KIERUNEK PRODUKTU
Owner: „nowa firma chce zrobić audyt: chciałbym przeaudytować moje procesy produkcyjne pod kątem potencjalnych transformacji digitalnych. Ale wcześniej opisaliśmy tę firmę, więc już mamy o niej podstawową wiedzę. Więc wtedy system rozpisuje cały zestaw arkuszy dla wszystkich członków zespołu... drugi wariant: audyt ISO 27000 — system mówi: zapytajmy tych i tych w organizacji, te grupy pytań trzeba opracować, i tworzy ankiety pod to."

**TO JEST PRZEKOP — przeniesienie Interview z „builder ankiet" na „silnik audytu z AI orchestracją". Możemy ten kierunek owner spec już dziś rzetelnie zaplanować na bazie tego co JEST.**

**A) CO JUŻ MAMY W KODZIE — fundament istnieje:**
- ✅ `interviewInferenceService.ts:167` — generuje pytania z `orgContext` (JSON.stringify). To znaczy: AI **już teraz** umie wziąć dane firmy jako kontekst do generowania.
- ✅ `ideaAIGeneratorService.ts` — generator z org context, sugerowanie artefaktów platformy (initiatives/tasks/decisions/reports).
- ✅ `aiAssessmentPartnerService.ts:511` — używa `companySize` jako context.
- ✅ `reportBuilderService.ts:973` — `company_context_json` jako pole reportu (już persistowany).
- ✅ `Project brief / knowledge` — F3 z poprzedniej pracy: project knowledge (RBAC files/brief → Teresa).
- ✅ `bulkAssignProductPills` / `WorkerService` — wzorzec bulk-assignment już istnieje (virtual workers).
- ✅ `onboardingService.generatePlan` / `aiOperatorService.regeneratePlan` — wzorce orchestracji planów AI.
- ✅ **Pełen lifecycle assignmentów** (V-A) — submit/approve/sendback działa.
- ✅ **AI quality gate** (#11) — ocena odpowiedzi już istnieje.

**Czyli infrastruktura do orkiestracji jest. Brakuje TYLKO warstwy orchestratora batch + UI „nowy audyt".**

**B) PROPOZYCJA: NOWY OBIEKT `Audit Program` (wyższy poziom niż session)**

**Model danych:**
```
audit_programs
- id, organization_id, project_id, name, description
- audit_kind: 'discovery' | 'iso_27001' | 'iso_9001' | 'gdpr' | 'lean' | 'custom'
- trigger_kind: 'new_company' | 'compliance' | 'incident' | 'ad_hoc'
- status: 'draft' | 'planning' | 'live' | 'analysis' | 'completed' | 'archived'
- generated_by_ai: bool
- org_context_snapshot_json (snapshot firmy w momencie tworzenia)
- target_outcomes_json (cele jakie audyt ma osiągnąć)
- ai_plan_json (plan wygenerowany przez AI: kto co odpowiada)
- created_by, created_at, deadline_at, completed_at

audit_program_sessions (1:N)
- audit_program_id → audit_programs
- session_id → interview_sessions (te same które już są!)
- role_in_program (np. 'finance_lead', 'it_security', 'hr', 'qa')
- sort_order
```

Każda sesja Interview może być częścią Audit Program LUB stand-alone. Pełna kompatybilność.

**C) DWA WARIANTY OWNER SPEC — jak je obsłużymy:**

**WARIANT 1 — „Nowa firma chce audyt digital transformation"**
```
1. User: Klik [+ New Audit Program]
2. Modal: 3 kroki
   a. Audit goal (free text): „Przeaudytować procesy produkcyjne pod kątem transformacji digitalnej"
   b. Project context (auto-prefill z istniejącej wiedzy o firmie: brief, members, prior audits)
   c. AI proposes plan:
      - Suggested templates: „Operational Excellence", „Digital Maturity Discovery", „Data & Metrics"
      - Suggested assignees per template (na podstawie ról w org): „Operations lead → Marek", "IT Director → Anna"
      - Suggested deadlines & priorities
      - Estimated total time per assignee
3. User: Review & adjust (drag/drop kto co dostanie, zmienić deadline)
4. User: [Approve plan] → system bulk-creates wszystkie sessions + assignments naraz
5. Każdy assignee dostaje notyfikację z linkiem do swojej ankiety
6. Dashboard programu: realtime progress wszystkich ankiet
```

**WARIANT 2 — „Audyt ISO 27001 — konkretny task compliance"**
```
1. User: Klik [+ New Audit Program] → wybiera Audit kind: ISO 27001
2. System ma **preset templates** dla ISO 27001 (14 obszarów × N pytań — typowa struktura compliance audit)
3. AI mapping:
   - Sekcja A.5 (Information Security Policies) → CISO / Security Officer
   - Sekcja A.6 (Organization) → HR + Management
   - Sekcja A.8 (Asset Management) → IT Operations
   - Sekcja A.13 (Communications) → Network Admin
   - ...itd.
4. System suggesta who is who z org structure (LDAP-like role mapping)
5. User: Review & assign
6. Bulk-create + notify
7. Dashboard programu pokazuje: ile sekcji zatwierdzonych, którzy się spóźniają, AI snapshot quality
8. Po wszystkich approvals: AI generuje **Audit Report** (executive summary + gap analysis + remediation roadmap)
```

**D) MODEL UI — nowy Hub-tab „Audits" (wyższy poziom):**

Propozycja nawigacji:
```
Interview module
├── Inbox       (moja praca dziś)
├── Sessions    (wszystkie ankiety, V-B unified per #12)
├── Templates   (biblioteka)
├── Insights    (wnioski z analiz)
├── Initiatives (działania wyniknięte)
└── Audits ⭐ NOWE (programy audytowe — wyższy poziom)
```

W zakładce **Audits**:
- Lista programów (status, progress all sessions combined, deadline, AI quality avg)
- Klik → drilldown view programu:
  - Header: cel + context + AI plan
  - Lista sesji w programie (statusy każdej, kto wypełnia, deadline)
  - Progress bar globalny (12/45 sesji approved)
  - AI insights cross-program (kiedy ≥3 sesje approved)
  - Final report draft generator

**E) ENDPOINTY BACKEND — minimum:**
```
POST  /interview/audits                      — create audit (z AI planem)
POST  /interview/audits/:id/generate-plan    — AI proposes plan
POST  /interview/audits/:id/approve-plan     — bulk-create sessions + assignments
GET   /interview/audits/:id/dashboard        — live progress
POST  /interview/audits/:id/generate-report  — final report after all approvals
POST  /interview/audits/:id/escalate         — chase laggers
```

**F) SHIPPING PLAN — od MVP do pełnej wizji:**

⭐ **MVP (1-2 dni — Walk):** „Audit Wizard" jako modal nad Sessions
- Modal: cel → user wybiera 1-N templates → multi-select assignees → AI proposes deadlines
- Klik Apply → bulk creates wszystkie assignments
- Wszystko widoczne w istniejącym Sessions widoku
- Brak nowej zakładki, brak nowego obiektu — tylko orchestracja istniejących endpointów (`createAssignment` w pętli)

⭐ **V1 (3-5 dni — Run):** Pełen `audit_programs` jako osobny obiekt
- Nowa zakładka „Audits"
- Lista programów + drilldown dashboard
- AI generuje plan z org context (już mamy `interviewInferenceService`)
- Auto-assignment na podstawie ról (z `users` + `organization_members`)
- Notyfikacje bulk

⭐ **V2 (1-2 tygodnie — Fly):** AI-driven full orchestracja
- ISO 27001 / GDPR / SOC2 / NIS2 preset suites (gotowe template-packs)
- AI rekomenduje kogo zapytać na podstawie `org structure + role tags`
- Cross-program insights („w audytach ISO Anna systematycznie ma niskie AI scores w Section A.8 → potrzebuje szkolenia")
- Auto-generated final audit reports + remediation roadmaps
- Integracja z Initiative module (każdy gap → automatyczna initiative)
- Public stakeholder share-link (klient widzi swój dashboard audytu)

**G) BUSINESS CASE owner spec:**
- **„Nowa firma chce audyt"** = pierwszy use case sales — minutowa orchestracja dla nowego klienta, zero ręcznej pracy konsultanta. Ogromny boost time-to-value.
- **„ISO 27001"** = recurring revenue — co rok ten sam audyt z nowymi danymi, AI compare year-over-year, deliverable na sprzedaż.

**Severity:** kierunek produktu, nie bug fix. Ale **kluczowy moment** — od decyzji teraz zależy struktura modułu Interview na lata. Owner pyta wprost — to powinno trafić do strategicznej roadmapy.

### #20 · [Insights tabela] · Porządek graficzny + audit kolumn + kebab ⭐
Owner: „tu się wydarzył jakiś bałagan z tymi ramkami, z tymi kolorami, z tym wszystkim — koniecznie wypracuj porządek graficzny... mamy wszystkie kolumny które powinniśmy mieć... i czy mamy wszystko pod kebabem żebyśmy rzeczywiście wszystko mieli."

**A) BAŁAGAN GRAFICZNY — diagnoza z screenu:**

Widzę na screenie konkretne źródła „bałaganu":
1. **Cienki kolorowy pionowy pasek po LEWEJ stronie każdego wiersza** — zielony / czerwony / szary — koliduje z dziurą poniżej (gdzie powinna być wcięta linia)
2. **Avatar/icon w okrągłej kapsule** ma inny styl niż w innych tabelach (tu „żarówka" lightbulb, nie inicjały)
3. **Sub-text pod tytułem** — raz `markdown markup` (`## Executive Summary...` / `## Trends (cross-session)...`), raz plain text, raz `## Risk assessment | Risk | ...`. **Nieformatowany markdown ucieka surowy do UI** — bardzo brzydkie.
4. **Mini-chipy `4 cross-role` + `1 divergences`** mają inny styl niż chipy Type/Status/Source — niespójność.
5. **Wiersze różnej wysokości** (niektóre mają sub-chipy poniżej tytułu, niektóre nie) → tabela „skacze".
6. **Pusty stan kolumny Source** dla ostatniego wiersza — wyświetla się `-` w okrągłym chipie zamiast pustego placeholdera.

**B) FIX — zastosowanie standardu z #18 + Insights-specific:**

Kluczowe zmiany:
- ❌ **Usunąć kolorowy pasek po lewej** — replace przez chip status w kolumnie (kolor już tam jest)
- ❌ **Renderować markdown w sub-tekście** (nie raw `##`) — albo strip markdown markup do plain text z pierwszą linią
- ❌ **Sub-chipy `cross-role / divergences`** — unifikacja stylu z głównym standardem chipów (#18)
- ❌ **Source: jeśli pusty** → `—` w kolorze `text-slate-500`, BEZ chipa (dziś jest brzydki pusty chip `-`)
- ✅ **Fixed row height** — zawsze 64px (multi-line OK), tylko 3-linijkowy clamp dla sub-tekstu
- ✅ **Avatar:** spójnie z innymi tabelami — żarówka OK jako ikona insightu, ale w **gradient kółku jak Assignee** (24px, gradient bg)
- ✅ **Pasek statusu sygnalizujący gotowość** → przenieść do progress bar pod tytułem (jeśli partial AI) lub do chip Status (już jest)

**C) KOLUMNY — czego brakuje:**

Dziś (z screenu): `Title (z sub) · Type · Status · Source · Date · Actions`

**Propozycja kolumn dla Insights:**

| Kolumna | Default | Po co |
|---|---|---|
| Title + sub | ✅ visible (req) | — |
| Type | ✅ visible | Executive Summary / Trend Analysis / Risk Assessment / Recommendations |
| Status | ✅ visible | Draft / Completed / Failed / Published |
| Source | ✅ visible | „N sessions" — z ilu sesji wyciągnięte |
| **Confidence / AI score** ⭐ | hide (opt-in) | jak pewny jest insight (AI snapshot) |
| Date | ✅ visible | created_at |
| **Last updated** | hide (opt-in) | kiedy ostatnio edytowane |
| **Exported to** | hide (opt-in) | chipy: Tools / Assessment / Report (które exporty się odbyły) |
| **Findings count** | hide (opt-in) | ile P10 findings powiązanych |
| **Linked initiatives** | hide (opt-in) | ile initiatives wynikło |
| **Cross-role chip** | inline w sub | „4 cross-role" — już jest, tylko styl |
| **Divergences chip** | inline w sub | „1 divergences" — już jest, tylko styl |
| **Author** | hide (opt-in) | kto wygenerował (manual vs AI) |
| **AI vs Manual** | hide (opt-in) | badge „AI" gdy wygenerowane AI |
| **Tags / Category** | hide (opt-in) | dla filtrowania tematycznego |
| **Sentiment** | hide (opt-in) | positive/neutral/concern — szybko widać tony insightu |
| Actions | ✅ required | kebab |

**Najważniejsze brakujące:**
1. **Exported to** ⭐ — kluczowe (dziś trzeba otworzyć kebab żeby zobaczyć czy zostało wyeksportowane do Tools/Assessment — powinno być widoczne jako chipy w tabeli)
2. **Confidence / AI score** — dla insightów AI-generated, fundament credibility
3. **Findings count + Linked initiatives** — bo bez tego nie wiadomo czy insight „przyniósł coś" (czy stał się działaniem)

**D) KEBAB — co JEST, co BRAKUJE:**

Dziś (ze screenu): `Open · Export to Tools · Export to Assessment · Download · Delete`

**Propozycja pełnego kebab dla Insights:**

| Akcja | Status |
|---|---|
| Open | ✅ jest |
| Open in side preview | ❌ brak (zgodnie z #2 — preview pane) |
| **Edit** | ❌ brak (edytuj title/content) |
| Export to Tools | ✅ jest |
| Export to Assessment | ✅ jest |
| **Export to Report** | ❌ brak (dodaj do raportu) |
| **Convert to Initiative** | ❌ brak (insight → initiative — dziś trzeba ręcznie) |
| **Convert to Decision** | ❌ brak (insight → decision) |
| **Convert to Task** | ❌ brak |
| **Re-generate with AI** | ❌ brak (regeneruj na podstawie tych samych sesji — np. po zmianach) |
| **View source sessions** | ❌ brak (z których ankiet powstał) |
| **Share link** | ❌ brak (publiczny share dla klienta) |
| **Pin to dashboard** | ❌ brak |
| Download | ✅ jest |
| **Duplicate** | ❌ brak |
| **Archive** | ❌ brak (z #12 lifecycle) |
| Delete | ✅ jest |
| **View activity log** | ❌ brak (kto co z tym zrobił) |

**Najważniejsze brakujące:**
1. **Convert to Initiative/Decision/Task** ⭐ — to jest **handoff do działania** (już mamy D5 bridge w backendzie, ale tylko dla P10 findings, nie dla insightu jako całości)
2. **View source sessions** — manager musi widzieć z czego AI to wyciągnął (audit trail)
3. **Re-generate** — po dodaniu nowych sesji do programu, można zrefreshować insight bez kasowania
4. **Edit** — dziś przepuszczone, brak edycji
5. **Share link** — dla klient-facing insightów

**Severity:** wysoka. Insights to **deliverable** Interview module — to co konsultant pokazuje klientowi. Bałagan graficzny + brakujące akcje convert/edit/share blokują pełną wartość modułu.

### #21 · [Insight Detail View / Initiatives] · Dwa standardy widoków: N (Notion) + C (ClickUp) ⭐⭐⭐
Owner: „dwa potężne zadania: Insights i Initiatives. Koncepcję mam opanowaną, ale grafika jest dramatem. W prawym górnym mamy wybór widoków: Notion (lewy sidebar, dużo klikania, czysty) vs ClickUp (więcej treści, mniej klikania, tłoczony dla dużych ekranów). Wypracujmy standard dla obu."

**A) DIAGNOZA W KODZIE (InsightViewer.tsx 5991 linii):**
- ✅ **Sidebar 13-sekcyjny** istnieje (`Next Actions / Truth & Review / Executive Summary / Consulting Readout / Material Quality / Report Pack / Candidate Triage / People / Source Pack / Analysis Matrix / Themes / Issues & Risks / Opportunities`)
- ✅ Pełna metryczka u góry (Status / Analysis Type / Created / Gen Time / Sessions / Review / Findings / Candidates / Evidence / Readback)
- ✅ Toolbar (Regenerate / Export Tools / Export Assessment / To Notebook / Download MD / Copy / Submit for Review)
- ✅ Wiele inline `compact` flag (znaleziono w 10 miejscach) — ale per-sekcja, nie global view mode
- ❌ **Brak globalnego view mode toggle** (Notion vs ClickUp) — przyciski w prawym górnym ze screena to **list/grid toggle z listy** (LayoutList/Grid), nie z detalu. Owner widzi je „wyciekłe" do detalu.
- ❌ **Brak persystencji** preferencji widoku per user.

**B) DLACZEGO „grafika jest dramatem" — konkretne obserwacje:**

Patrząc na screen Insight detail:
1. **„Tile" panele** (Confidence high / Evidence 10 / Sessions 2) - są wyłuskane jakby chciały być compact metrics, ale rozjeżdżają się z resztą układu
2. **Sekcja toolbar** (Regenerate kolorowy + Export Tools etc.) ma chipy o bardzo różnych intensywnościach (czerwony Regenerate, niebieski Tools, fioletowy Assessment, zielony Notebook, szary Copy, szary Submit) → kolorowy chaos
3. **Cards „Documents" + „App Actions"** — każda karta ma **inny kolor tła** (czerwony Create report, fioletowy Create deck, zielony Create table, oranżowy Create idea, szary Create note, niebieski Create initiative) → to ten sam „tęcza problem" co tabeli Insights (#20)
4. **Sidebar list** używa standardowych chipów + badge'ów liczbowych — OK
5. **„WHAT NEXT WITH THIS INSIGHT?"** banner — niespójny radius i border z kartami poniżej
6. **„Downstream conditions"** — żółty/oranżowy callout z bulletami — to OK informacyjnie ale wizualnie odlatuje

**C) PROPOZYCJA: DWA TRYBY WIDOKU (owner spec)**

⭐ **Tryb N (Notion) — domyślny, narrow + sequential:**
```
Header (full width, metrics u góry)
┌─────────────┬─────────────────────────────────┐
│  Sidebar    │   Active section content        │
│  (sekcje)   │   (max-w-3xl, dużo whitespace)  │
│             │                                 │
│  Next Act → │   [content tylko 1 sekcji       │
│  Truth      │    na raz, klik w sidebar       │
│  Exec Sum   │    przełącza]                   │
│  ...        │                                 │
└─────────────┴─────────────────────────────────┘
```
- Zalety: czyste, fokus, łatwe skupienie
- Wady: dużo klikania (13 sekcji = 13 kliknięć żeby przejrzeć wszystko)

⭐ **Tryb C (ClickUp) — alternative, dense + all-in-one:**
```
Header (full width)
┌──────────┬──────────────────────────────────┐
│ Sidebar  │  ┌────────┐ ┌────────┐ ┌──────┐  │
│ (sekcje) │  │ Sec 1  │ │ Sec 2  │ │Sec 3 │  │
│ jako     │  │ panel  │ │ panel  │ │ panel│  │
│ ToC      │  └────────┘ └────────┘ └──────┘  │
│ (anchor  │  ┌────────┐ ┌────────┐ ┌──────┐  │
│ scroll)  │  │ Sec 4  │ │ Sec 5  │ │Sec 6 │  │
│          │  │ panel  │ │ panel  │ │ panel│  │
│          │  └────────┘ └────────┘ └──────┘  │
└──────────┴──────────────────────────────────┘
```
- Wszystkie sekcje widoczne jednocześnie w **grid 2-3 kolumnowym** (responsive)
- Każda sekcja jako card-panel z heading + content compact
- Sidebar staje się **ToC anchor links** (klik scrolluje do sekcji)
- Można scrollować całość, można skoczyć
- Zalety: cały insight na raz, dla power-userów z 27"+, mniej klikania
- Wady: gęsto, wymaga dyscypliny wizualnej

**D) TOGGLE W UI:**

Prawy górny róg (gdzie owner widział przyciski — przenieść z listy do detalu):
```
[ ⌘ ⌘ ] [ ⊞ ▢ ]  ← dwa toggle: N / C
   N        C
```
- N = ListIcon (lub sidebarIcon)
- C = LayoutGridIcon (lub denseIcon)
- Tooltip: „Notion view (narrow, sequential)" / „ClickUp view (dense, all-in-one)"
- Persystowanie w localStorage `insightDetail.viewMode` per user
- Default: N (Notion-mode) dla onboarding clarity

**E) STANDARD GRAFICZNY KART „App Actions" (dla obu trybów):**

Dziś każda karta Create report/deck/table/idea/note/initiative ma **inny kolor tła** → chaos.

Propozycja **kanon „Action Card"**:
- Wszystkie karty: ten sam `bg-white/[0.03] border border-white/[0.06] rounded-xl p-4`
- **Kolor żyje tylko w ikonie** (Document=blue, Deck=purple, Table=emerald, Idea=amber, Note=slate, Initiative=primary)
- Layout: ikona 32px w kolorowym kółku (bg-{color}-500/15) + title + sub-text + CTA chip
- Hover: subtelne `bg-white/[0.05]` + border `border-primary-500/30`
- Active/used: badge „Created" w prawym górnym (małe ✓)
- **Zero kolorowych teł** w cards — wszystkie identyczne wizualnie, kolor identyfikuje typ przez ikonę

Wzorzec dla **wszystkich** „akcji konwersji" w platformie (Insight→Initiative, Note→Document, Task→Report etc.).

**F) STANDARD METRYK U GÓRY (Status/Analysis Type/Created/Gen Time/Sessions/Review/Findings/Candidates/Evidence/Readback):**

Dziś: każda metryka w osobnym input-like box → wygląda jak formularz.

Propozycja **kanon „Metric Strip"**:
- Row z poziomymi statami, każda: małą etykietą (`text-[10px] uppercase tracking-wide text-slate-500`) + wartością (`text-sm font-medium`)
- Separatory cienkimi pionowymi dividers `divide-x divide-white/[0.06]`
- Niektóre stat to **drop-down** (Status, Review = editable), niektóre **read-only** (Created, Gen Time, Sessions)
- Wzorzec: dashboard-strip, nie formularz

**G) STANDARD GRAFICZNY TOOLBAR (Regenerate / Export Tools / Export Assessment / To Notebook / Download MD / Copy / Submit for Review):**

Dziś: 7 buttonów, każdy w innym kolorze (czerwony / niebieski / fioletowy / zielony / szary / szary / szary) → tęczowy chaos.

Propozycja **kanon „Action Toolbar"**:
- **Primary action** (1 button, gradient): „Submit for Review" — głowna konwersja stanu
- **Secondary actions** (3-5 buttonów, outline + ikona): Export Tools / Export Assessment / To Notebook / Download / Copy — wszystkie ten sam styl chip
- **Destructive/State action** (1, accent): Regenerate (osobno, z ostrzeżeniem „This will replace existing content")
- **Grupowanie**: dropdown „More" gdy >5 akcji (np. Copy + Download w More)

**H) INITIATIVES — analogiczny problem (owner explicit „dwa potężne zadania"):**

Initiative module ma podobny detail view (Header + sekcje: Goal / KPIs / Tasks / Decisions / Stakeholders / Timeline / Risks / Outputs). Te same standardy:
- Tryb N / C toggle
- Sekcje sidebar / grid panels
- Metric strip (Progress % / Owner / Due / Tasks completed / Last activity)
- Action toolbar z primary + secondary
- Card kanon dla linked items (tasks, decisions, outputs)

**I) PLAN IMPLEMENTACJI — kolejność:**

⭐ **Faza 1 (1-2 dni — fundament wizualny):**
1. **Zdefiniować spec** `docs/design-system/DETAIL_VIEWS.md` z dwoma trybami N/C
2. **Wynieść primitivy** do `shared/detailView/`: `<DetailHeader>`, `<MetricStrip>`, `<ActionToolbar>`, `<SectionSidebar>`, `<SectionPanel>`, `<ActionCard>`, `<ViewModeToggle>`
3. **Standard kolorów**: monochrome bg, kolor tylko w ikonach + status pills

⭐ **Faza 2 (2-3 dni — pilotaż na Insights):**
4. Refactor InsightViewer na nowe primitivy
5. Implementacja toggle N/C
6. Persystencja preferencji
7. Migracja kart Documents/App Actions na ActionCard kanon

⭐ **Faza 3 (2-3 dni — Initiatives):**
8. Refactor Initiative detail view (analogiczny)
9. Te same primitivy reuse

⭐ **Faza 4 (długoterminowo):**
10. Migracja pozostałych detail views (Tasks, Decisions, Reports, Notes, Notebooks) na ten sam standard
11. Każdy moduł dostaje toggle N/C
12. Cross-module spójność

**J) ZYSK BIZNESOWY (owner spec):**
- N-mode = onboarding-friendly, klient/junior konsultant czuje się prowadzony
- C-mode = power-user friendly, senior konsultant widzi cały obraz na raz
- Toggle daje wybór BEZ kompromisu między obozami
- Standard dla wszystkich detail views = predictable UX → szybciej uczenie się platformy

**Severity:** krytyczna jako standard dla całej platformy. Owner: „dwa potężne zadania. Jak sobie z nimi damy radę, nasze życie w tej aplikacji będzie znacznie prostsze". Bez tego Insights+Initiatives wyglądają jak rozbity zlepek elementów, nie professional product.

### #22 · [Insight sekcje / IA] · Reorganizacja 20 sekcji + adaptive sidebar + „między wierszami" ⭐
Owner: „rola insighta to zrozumieć co ludzie mówią oficjalnie I między wierszami, zestawić zdania różnych osób, dostrzegać zależności, ryzyka — wszystko co mądry konsultant widzi. Po lewej mnóstwo punktów — może niektóre ograniczyć. Albo system pokazuje tylko te z wartościowymi info, puste ukrywa."

**A) PEŁNA LISTA 20 SEKCJI (z kodu — `INSIGHT_SECTIONS`):**
1. Next Actions ⭐ (action panel — Documents/App Actions)
2. Truth & Review (verdict + reviewer feedback)
3. Executive Summary (TL;DR)
4. Consulting Readout (clean copy for client)
5. Material Quality (czy źródła wystarczające)
6. Report Pack (sub-documents)
7. Candidate Triage (P10 candidates do oceny)
8. People (perspektywy poszczególnych osób)
9. Source Pack (pliki źródłowe)
10. Analysis Matrix (cross-tabulacja)
11. Themes (rozpoznane tematy)
12. Issues & Risks (ryzyka)
13. Opportunities (szanse)
14. Signals (tension/gap/contradiction/emerging_pattern ⭐)
15. Evidence Map (kto, gdzie, kiedy powiedział co)
16. Traceability (audit trail finding → source quote)
17. Full Analysis (long-form deep-dive)
18. Source Sessions (które ankiety)
19. Comments (dyskusja teamu)
20. Activity Log (kto co zrobił)

**B) ODKRYCIE: „MIĘDZY WIERSZAMI" CZĘŚCIOWO ISTNIEJE** ⭐

Sprawdzone w kodzie:
- ✅ `Signals` z typami: **`tension | gap | contradiction | emerging_pattern`** — to dokładnie „między wierszami"
- ✅ `divergence_note` per candidate/theme (gdzie różni się opinia)
- ✅ `contradictionSignals` filter w kodzie (linia 1237)
- ✅ `consensusTopics` (gdzie wszyscy się zgadzają)
- ✅ `candidateSummary.needsSplit` (gdy candidate ma sprzeczne wersje)

**Czego brakuje** żeby owner spec się ziściła:
1. **Cross-person comparison view** — zestawienie cytatów od 3-5 osób na ten sam temat obok siebie (dziś People sekcja istnieje, ale brak comparison-mode)
2. **Sentiment analysis** per person per topic — co kto NAPRAWDĘ czuje (zgoda na powierzchni, opór głębiej)
3. **„Silences"** — czego NIKT nie powiedział a powinien był (gap detection)
4. **Power dynamics** — kto narzuca narrację (1 dominant voice), kto się dostosowuje
5. **Cultural cues** — language style differences (formal vs casual = poziomy zaufania)
6. **Implicit assumptions** — założenia traktowane jako oczywiste przez wszystkich (red flag w transformation)

To są klasyczne ramy analizy jakościowej (Grounded Theory + Discourse Analysis) — można je dorobić do prompta `evaluateInterviewSessionAnswers` jako dodatkowe wymiary AI.

**C) DIAGNOZA — dlaczego 20 sekcji to za dużo:**

Kategoryzacja sekcji wg częstotliwości użycia (z perspektywy konsultanta):
- 🟢 **Always show (3):** Executive Summary, Next Actions, Source Sessions
- 🟡 **Often (5):** Themes, Issues & Risks, Opportunities, People, Signals
- 🔵 **Sometimes (5):** Consulting Readout, Report Pack, Candidate Triage, Evidence Map, Comments
- ⚪ **Rarely (5):** Truth & Review, Material Quality, Source Pack, Analysis Matrix, Traceability
- ⚫ **Almost never UI-facing (2):** Full Analysis, Activity Log

20 sekcji daje **wrażenie złożoności**, ale 75% to **niskiej-częstotliwości** lub power-user features. Konsultant pracujący z insightem chce w 90% przypadków: TL;DR + co dalej + kto co powiedział + tematy + ryzyka.

**D) PROPOZYCJA: REORGANIZACJA NA 5 PAKIETÓW + ADAPTIVE SIDEBAR**

⭐ **Plan:** zamiast 20 płaskich pozycji → **5 grup tematycznych z collapse**:

```
📋 INSIGHT (zawsze otwarta)
   ├─ Executive Summary        ⭐ zawsze
   ├─ Themes
   ├─ Issues & Risks
   └─ Opportunities

🔬 BETWEEN THE LINES (kluczowa wartość owner)
   ├─ People (per-person view)
   ├─ Signals (tension/gap/contradiction/pattern)
   ├─ Consensus & Divergence  🆕 (nowa — agreement matrix)
   ├─ Implicit Assumptions    🆕
   └─ Silences                🆕

📊 EVIDENCE (proof layer)
   ├─ Evidence Map
   ├─ Analysis Matrix
   ├─ Source Sessions
   └─ Source Pack

🎯 DELIVERABLES (output layer)
   ├─ Next Actions            ⭐ zawsze
   ├─ Consulting Readout
   ├─ Report Pack
   └─ Candidate Triage

⚙ AUDIT (compliance/QA — rzadko otwierane)
   ├─ Truth & Review
   ├─ Material Quality
   ├─ Traceability
   ├─ Full Analysis
   ├─ Comments
   └─ Activity Log
```

5 grup zamiast 20 płaskich pozycji. **Domyślnie 1-2 grupy expanded** (Insight + Deliverables), reszta collapsed.

**E) ADAPTIVE SIDEBAR — owner spec:**

⭐ **Trzy stany każdej sekcji:**
1. **Hidden** — brak danych w tej sekcji (count = 0, brak content) → **nie pokazuj w sidebar w ogóle**
2. **Empty placeholder** — sekcja istnieje ale pusta → szary, z subtelnym hint „No data yet" (gdy user kliknie expand)
3. **Active** — ma dane → normalna z badge liczbowym

**Logic per sekcja:**
- Executive Summary: ZAWSZE visible (nawet pusty — placeholder „AI generating...")
- Next Actions: ZAWSZE visible
- Themes: visible gdy `themes.length > 0`
- Issues & Risks: visible gdy `count > 0`
- People: visible gdy `≥2 people`
- Signals: visible gdy `contradictions + tensions + gaps > 0`
- Consensus & Divergence: visible gdy `≥2 people` (wymaga porównania)
- Implicit Assumptions: visible gdy AI wykrył ≥1
- Silences: visible gdy `expectedTopic.length > coveredTopic.length` (jakaś expected nieobecna)
- Evidence Map: visible gdy `evidence_count > 0`
- Analysis Matrix: visible gdy `analysisMatrix.cells.length > 0`
- Source Sessions: visible gdy `sessions.length > 0`
- Source Pack: visible gdy `attached_files.length > 0`
- Report Pack: visible gdy `subDocuments.length > 0`
- Candidate Triage: visible gdy `candidates.length > 0`
- Consulting Readout: visible gdy `readoutDraft.length > 0`
- Truth & Review: visible gdy `truthReviewNote || rejected_count > 0`
- Material Quality: visible gdy `qualityWarnings.length > 0` LUB user opt-in
- Traceability: visible gdy `findings.length > 0`
- Full Analysis: visible w „Show all" mode (default ukryta)
- Comments: visible gdy `comments.length > 0`
- Activity Log: visible gdy `activity.length > 5` (zawsze jest aktywność)

**Persystencja:** user toggle „Show all sections" w settings sidebaru → override hide logic. Per-user preference.

**F) BADGE COUNTERY (już są na screenie — utrzymać):**
- Liczby `1 · 3 · 7 · 2 · 2 · 2 · 4 · 10` przy sekcjach
- Kolor badge dla nowych: green dla acted/reviewed, amber dla pending, rose dla flagged
- Pulse animation gdy nowa zawartość (od ostatniego open) — onboarding cue

**G) NOWE SEKCJE „MIĘDZY WIERSZAMI" (3) — dodać do `INSIGHT_SECTIONS`:**

⭐ **Consensus & Divergence Matrix** (nowa)
- Macierz: rows = tematy, columns = people, cells = stance chip (agrees ✓ / opposes ✗ / unclear ?)
- Hot-spots wyróżnione: tematy gdzie wszyscy się zgadzają (consensus) vs gdzie polaryzacja
- Klik w cell → drill-down do citatu osoby

⭐ **Implicit Assumptions** (nowa)
- Lista założeń, które wszyscy traktowali jako oczywiste
- AI prompt: „identify what every respondent treated as given without questioning"
- Każde assumption: czyje słowa to ujawniają + sugestia „validate this with..."

⭐ **Silences** (nowa)
- Co nie zostało powiedziane mimo że template/audit kind tego oczekiwał
- AI cross-checks against `expected_topics` (z template) vs `covered_topics` (z odpowiedzi)
- Lista gap-ów z severity (red flag dla compliance audit, soft sygnał dla discovery)

**Te 3 sekcje to dokładnie „mądry konsultant po szeregu rozmów" — owner spec.**

**H) PLAN IMPLEMENTACJI:**

⭐ **MVP (1 dzień):**
1. Adaptive hide-empty logic dla istniejących 20 sekcji
2. Refactor sidebar na 5 grup z collapse
3. „Show all sections" toggle

⭐ **V1 (2-3 dni):**
4. Prompt extension w `evaluateInterviewSessionAnswers` o consensus/divergence/assumptions/silences
5. Backend: nowe pola w `ai_review_snapshot_json`
6. UI: 3 nowe sekcje (Consensus Matrix, Implicit Assumptions, Silences)

⭐ **V2 (1-2 dni):**
7. Cross-person comparison view (People sekcja w grid mode)
8. Sentiment per person per topic
9. Pulse animation na nowych sekcjach

**I) OWNER SPEC — ZGODNOŚĆ:**

| Owner request | Status w planie |
|---|---|
| „zrozumieć co ludzie mówią oficjalnie I między wierszami" | ✅ Signals (jest) + Consensus/Assumptions/Silences (nowe) |
| „zestawiać zdania różnych osób" | ✅ Consensus Matrix + People comparison |
| „dostrzegać zależności, ryzyka — co mądry konsultant widzi" | ✅ Implicit Assumptions + Silences = klasyczna analiza jakościowa |
| „insights tematycznie po raportach lub ludźmi" | ✅ Już istnieje — `insightKind: thematic | by_person` (do potwierdzenia) |
| „mnóstwo punktów — niektóre ograniczyć" | ✅ Reorganizacja 20→5 grup |
| „pokazywać tylko z wartościowymi info" | ✅ Adaptive hide-empty logic |

**Severity:** krytyczna dla wartości produktowej. Sekcje sidebar to NIE jest „ile checkboxów ma feature list" — to **fundament jak konsultant pracuje z deliverable**. Dobre IA = szybsza praca, lepsze deliverables. Owner explicit „mądry konsultant widzi zależności i ryzyka" — to wymaga 3 nowych sekcji „between the lines" jako kanonicznych komponentów AI snapshot.

### #23 · [Insight Detail — per-sekcja format prezentacji + Menu 3 AI slot] ⭐⭐⭐ FUNDAMENT
Owner: „1) Czy mamy wszystko? 2) Czy nie za wiele — co połączyć? 3) Dla każdej zakładki zaproponować JAK prezentować, bo teraz tyle różnych formatów że beznadziejne. 4) Per-karta AI revise/regenerate + całość regenerate. 5) Menu 3 (prawy slot) wszędzie = AI buttons — wzorzec dla całej platformy."

Przejrzałem 7 reprezentatywnych screenów z `Inshgts/`. Diagnoza per sekcja + propozycja jednolitego formatu.

---

**A) ⚠️ KRYTYCZNY BŁĄD ZNALEZIONY:** Screenshot 12.36.52.png pokazuje **crash strony** (`Coś poszło nie tak. Wystąpił nieoczekiwany błąd podczas ładowania tej strony. Strona napotkała problem i została bezpiecznie zatrzymana. Crash diagnostics could not be delivered.`). Owner trafił na error boundary w trakcie przeglądania jednej z sekcji insightu. **Trzeba ustalić która sekcja crashuje** (kolejność screenów sugeruje: między „Opportunities" 12.36.20/12.36.30 a „Evidence Map" 12.36.40 → prawdopodobnie **„Signals"**). Dodatkowo Crash diagnostics nie zadziałało — drugi problem.

**B) DIAGNOZA DZIŚ — 7 sekcji × 7 zupełnie różnych formatów (źródło chaosu):**

| Sekcja | Dzisiejszy format |
|---|---|
| **Next Actions** (12.34.26) | Banner „WHAT NEXT" + Downstream conditions yellow callout + 6 kolorowych kart akcji + chipy Confidence/Evidence/Sessions po prawej |
| **Executive Summary** (12.34.46) | Banner „Read this as a consulting brief" red + 3 numeric tiles (Special Findings 1 / Issues + Risks 3 / Convergences 1) |
| **Report Pack** (12.35.05) | Banner + 3 percentowe metryki (77% / 15 / 10/1) + sekcje „Report readiness gate" + ostrzeżenia |
| **Analysis Matrix** (12.35.35) | Banner „Analysis canon: person × topic × scope" + 3 tiles (Organization synthesis / Cells in scope / Coverage) + Coverage gaps + 4 tabsy (Stakeholder lenses / Outcome / Layers / Department lenses) + grid 2-kol |
| **Opportunities** (12.36.20) | Karty bordered z fioletowym akcentem, tytuł + opis + chipy Impact/Confidence + buttony „Open in canvas / Convert" |
| **Signals** (12.36.30) | „Lack of ROI..." callout w niebieskim banner + small badges (FYI) + pojedynczy bullet item |
| **Evidence Map** (12.36.40) | Banner + tabela 4-kolumnowa (Question / Answer / Source / Confidence) z linkami |
| **Full Analysis** (12.37.15) | Banner + Themes (bold + paragraf) + ###Issues (sekcja markdown-like) — wygląda **inaczej niż Themes sekcja oddzielna** |

**Problem #1:** Każda sekcja ma własne **bannery, kolory, layout, akcenty**. Owner ma rację — to chaos wizualny.
**Problem #2:** Duplikacja treści — Full Analysis zawiera Themes/Issues które są też w osobnych sekcjach.
**Problem #3:** Niespójność akcji AI — niektóre sekcje mają „Open in canvas / Convert", inne pusto, inne callout w środku content.

**C) ODPOWIEDŹ NA PYTANIE 1: CZY MAMY WSZYSTKO?**

**Z perspektywy „mądrego konsultanta po wywiadach" — BRAKUJE 4 kluczowych:**
1. ❌ **Cross-person Quote Comparison** (kto co mówi na ten sam temat — dziś People istnieje ale brak side-by-side)
2. ❌ **Sentiment / Tone Map** (jakim językiem ludzie mówią — formal vs frustrated vs uncertain)
3. ❌ **Power & Voice Dynamics** (kto narzuca narrację, kto się dostosowuje, kto milczy)
4. ❌ **Hypothesis Board** (hipotezy konsultanta budowane na bazie odpowiedzi — `if X is true then Y → validate with Z`)

Plus 3 z #22: **Consensus & Divergence Matrix**, **Implicit Assumptions**, **Silences**. **Razem 7 nowych sekcji**.

**D) ODPOWIEDŹ NA PYTANIE 2: CO POŁĄCZYĆ / WYRZUCIĆ?**

**Łączenia/usunięcia:**
- 🔀 **Full Analysis → usunąć** (duplikuje Themes/Issues/Opportunities — to był „dump everything" gdy nie wiedzieliśmy gdzie co dać). **Zastąpić** wyborem „Print all sections sequentially" w toolbar.
- 🔀 **Material Quality + Truth & Review → MERGE** w jedną sekcję „Quality & Trust" (oba mówią o tym samym: czy insight jest wiarygodny)
- 🔀 **Source Pack + Source Sessions → MERGE** w jedną „Sources" (wszystkie źródła w jednym miejscu)
- 🔀 **Candidate Triage + Traceability → MERGE** w „Findings & Evidence" (P10 candidates + ich audit trail)
- 🗑️ **Activity Log → zostaje, ale przenieść do header dropdown** (zawsze dostępne via clock-icon w header, nie zaśmieca sidebar)
- 🗑️ **Comments → zostaje, ale jako floating panel** (drawer z prawej, nie sidebar entry)

**Liczby:** **20 obecnych − 6 (Activity, Comments, Full Analysis usunięte z sidebar + 4 merge) + 7 nowych = 21**, ale **z lepszą hierarchią 5 grup** (z #22), zamiast 20 płaskich.

**E) ODPOWIEDŹ NA PYTANIE 3 ⭐ — JAK PREZENTOWAĆ KAŻDĄ SEKCJĘ (kanon formatu)**

**Najpierw ZASADA KANONU dla wszystkich sekcji:**

```
┌─────────────────────────────────────────────┐
│ SectionHeader                               │
│   • Icon + Title + Counter badge            │
│   • [AI dropdown ▾] in right slot (Menu 3)  │
│                                             │
│ SectionDescription (1-2 zdania co to jest) │
│                                             │
│ ──── Section Body ────                      │
│   [type-specific layout — patrz poniżej]    │
│                                             │
│ Footer (opcjonalnie): Confidence chip       │
│   + Generated at + Source sessions chips    │
└─────────────────────────────────────────────┘
```

**Wszystkie sekcje:** ten sam border, padding, header style. Zero bannerów. Zero kolorowych teł. Cały kolor żyje w status pills + AI score chip.

**Per-sekcja FORMAT prezentacji:**

| Sekcja | Format docelowy | Komponent |
|---|---|---|
| **Executive Summary** | Markdown long-form text (clean prose, NIE numeric tiles) + 3 inline metric chips u góry (findings/issues/convergences) | `<RichTextPanel>` |
| **Themes** | Kafelki 2-kol: każda Theme = card (title + 1-2 sentence + signal strength chip „strong/moderate/weak") | `<ThemeCard grid>` |
| **Issues & Risks** | Tabela: Risk title / Severity (chip) / Impact / Likelihood / Sources (chipy z avatarami) / [Convert to ▾] | `<RiskTable>` |
| **Opportunities** | Kafelki 1-kol: każda card = title + benefit + effort/impact 2×2 matrix dot + [Convert to Initiative] | `<OpportunityCard>` |
| **Signals** | Lista chipów-akordeonów: typ (tension/gap/contradiction/pattern) jako kolorowy chip + tytuł + expand → szczegóły + cytaty | `<SignalAccordion>` |
| **People (Perspektywy)** | Per-person panel: avatar + name + role chip + sentiment + key quotes (max 3) + alignment chip | `<PersonPanel>` |
| **Consensus & Divergence** ⭐NEW | **Matrix** (topics × people) z kolorowymi cells: ✓ agrees / ✗ opposes / ? unclear. Klik cell → drilldown do quote | `<ConsensusMatrix>` |
| **Cross-person Quote Comparison** ⭐NEW | Per-topic widok: 1 topic → side-by-side cytaty 3-5 osób w columns | `<QuoteComparison>` |
| **Sentiment / Tone Map** ⭐NEW | Radar chart per person (5 dimensions: confidence/concern/frustration/optimism/uncertainty) | `<SentimentRadar>` |
| **Power & Voice Dynamics** ⭐NEW | Graf nodes (people) + edges (kto za kim powtarza thesis) + dominance score | `<PowerGraph>` |
| **Hypothesis Board** ⭐NEW | Lista hipotez: „If X then Y" + validation status (validated/contradicted/needs more) + linked evidence | `<HypothesisBoard>` |
| **Implicit Assumptions** ⭐NEW | Lista kart: „Assumption" + „Held by" (chipy ludzi) + risk chip + „Validate with..." sugestia | `<AssumptionCard>` |
| **Silences** ⭐NEW | Lista expected topics niepokrytych: topic + expected coverage % + actual % + suggested follow-up question | `<SilenceCard>` |
| **Analysis Matrix** | Macierz 4-tab (Stakeholder/Outcome/Layer/Department) ale **bez bannerów ozdobnych** — clean cells + 3 metric chips u góry | `<AnalysisMatrix>` |
| **Evidence Map** | Tabela Q/A/Source/Confidence — keep current ale rounded, hairline borders zamiast box | `<EvidenceTable>` |
| **Findings & Evidence** (z merge Candidates+Traceability) | Kafelki: każde Finding = title + verdict chip + sources + audit trail expand | `<FindingCard>` |
| **Sources** (z merge Source Pack + Source Sessions) | 2 sub-tabsy: Sessions (clickable rows) + Attached files (file chip list) | `<SourcesPanel>` |
| **Quality & Trust** (z merge Material Quality + Truth & Review) | Lista warningów + verdict + reviewer comments timeline | `<QualityPanel>` |
| **Consulting Readout** | Prosty rich-text editor (cleanup wersja Executive Summary dla klienta) | `<ReadoutEditor>` |
| **Report Pack** | Lista sub-documents jako Document chipy z thumbnail + open links | `<DocumentList>` |
| **Next Actions** | 2 sub-grupy (Documents / App Actions) — **wszystkie karty ten sam styl** (z #21 ActionCard kanon) | `<ActionCardGrid>` |

**F) ODPOWIEDŹ NA PYTANIE 4: AI revise/regenerate per-card + całość**

⭐ **AI Action Slot — kanoniczny komponent `<AIActionSlot>`:**

Każda sekcja ma **swój dropdown AI** w `Menu 3 right slot` (top-right header sekcji):

```
[ ✨ AI ▾ ]
  ├ Regenerate this section
  ├ Improve clarity
  ├ Expand with more detail
  ├ Shorten / make concise
  ├ Translate to PL/EN
  ├ Fact-check
  ├ Suggest revisions (opens chat with context)
  ├ ───
  └ ⚙ Compare with prev version
```

**Plus globalne AI w toolbar insightu (poziom całości):**
```
[ ⚡ Regenerate insight ] [ ✨ AI ▾ ]
                            ├ Apply consultant lens
                            ├ Re-run between-the-lines analysis
                            ├ Generate report draft
                            ├ Run consensus extraction
                            ├ Compare with previous insight version
                            └ Export AI improvement log
```

**Backend:**
- Endpoint `POST /interview/insights/:id/sections/:sectionId/regenerate` — section-level
- Endpoint `POST /interview/insights/:id/regenerate` — global (już istnieje? — sprawdzić)
- Per-section job kolejkowany, status streaming
- Wersjonowanie: każda regeneracja zapisuje snapshot w `insight_section_versions` (rollback możliwy)

**G) ODPOWIEDŹ NA PYTANIE 5 ⭐ — MENU 3 / Prawy slot jako STANDARD PLATFORMY dla AI**

Owner spec: „Menu 3 po prawej stronie = wszędzie AI buttons. Użytkownik się przyzwyczaja: AI = prawa strona."

**Kanon `<RightAiSlot>` dla całej platformy:**

W **Menu 3** (chip-row z filtrami u góry tabeli + dla detail view = pasek pod header):
- **Lewa strona Menu 3:** filtry zakresu (Active/Archive, filtry per-status)
- **Środek:** action chipy zależne od kontekstu
- **Prawa strona (CONSISTENT):** `[ ✨ AI ▾ ]` dropdown z akcjami AI dla tego widoku

Gdzie się powinno pojawić identycznie:
- Interview Hub (Sessions/Inbox/Assigned/Templates/Insights/Initiatives lists) — AI batch operations
- Insight Detail (per-sekcja + globalnie)
- Initiative Detail (per-sekcja + globalnie)
- Task Detail, Decision Detail, Report Detail, Note Detail
- Canvas, Notes, Notebooks
- Discovery, Assessment, Tools

User uczy się: **„AI zawsze tam — prawy slot Menu 3". Zero zgadywania.**

**H) PRIORYTETY IMPLEMENTACJI (4 fazy):**

⭐ **Faza 1 (1-2 dni — naprawić co boli):**
1. Naprawić crash w Signals (lub innej sekcji która crashuje — sprawdzić)
2. Naprawić crash diagnostics (telemetry not delivered)
3. **Spec `<SectionCard>` kanon** + AI dropdown slot
4. Refactor 3 sekcji jako pilotaż: Executive Summary, Themes, Opportunities (najprostsze)

⭐ **Faza 2 (3-4 dni — usunąć chaos):**
5. Migracja wszystkich 20 sekcji na `<SectionCard>` kanon
6. Merge 4 par sekcji (Material Quality+Truth, Source Pack+Sessions, Candidates+Traceability, usunąć Full Analysis)
7. Activity Log → header dropdown; Comments → floating drawer
8. AI Section Slot per każdej sekcji + globalny w toolbar
9. Section-level regenerate backend + UI

⭐ **Faza 3 (5-7 dni — dodać brakujące):**
10. 7 nowych sekcji: Consensus Matrix, Quote Comparison, Sentiment Radar, Power Dynamics, Hypothesis Board, Implicit Assumptions, Silences
11. Backend prompt extensions w `evaluateInterviewSessionAnswers` o nowe wymiary
12. Każda nowa sekcja ze swoim wizualnym komponentem (Matrix, Radar, Graph)

⭐ **Faza 4 (długoterminowo — standard platformy):**
13. `<RightAiSlot>` kanon w **WSZYSTKICH** modułach (Tasks, Decisions, Reports, Notes, Canvas, Initiatives)
14. User feedback loop: każdy AI action → quick rating (👍/👎) → fine-tune prompts

**I) BIZNESOWY IMPACT (owner spec):**

Bez tej roboty Insight jest **„ładny dump danych"**, nie **„mądry deliverable"**. Po tej robocie:
- Konsultant otrzymuje **prawdziwą analizę jakościową** (sentiment, dynamics, assumptions, silences) — nie tylko bullet listę
- Każda sekcja **może być iteracyjnie poprawiana AI** — konsultant nie musi przepisywać ręcznie
- Standard `RightAiSlot` → **uczenie produktu = 1 raz, nie 12 razy per moduł**
- Nowe sekcje (Hypothesis Board, Consensus Matrix) to **wyróżnik konkurencyjny** — Notion/Linear nie mają, klasyczne audit tools (RSM Wingman, Workiva) też nie

**Severity:** krytyczna dla pełnej wartości deliverable. To jest **„cała robota nad Insight"** sprowadzona do 4 faz. Każda kolejna karta będzie nawiązywać do tego samego kanonu — owner zapyta raz, używa wszędzie.

### #24 · [BUG — INSIGHT SECTION CRASH] · znaleziony na screenie 12.36.52
- **Co:** Owner w trakcie nawigacji między sekcjami Insight (między Opportunities a Evidence Map — prawdopodobnie sekcja **Signals**) trafił na error boundary „Coś poszło nie tak. Wystąpił nieoczekiwany błąd podczas ładowania tej strony. Strona napotkała problem i została bezpiecznie zatrzymana."
- **Dodatkowo:** „Crash diagnostics could not be delivered. You can retry or report manually." — TELEMETRIA TEŻ NIE ZADZIAŁAŁA
- **Severity:** wysoka — sekcja InsightViewer crashuje w prodzie, error boundary łapie ale diagnostyka nie idzie
- **Do zrobienia podczas implementacji:** powtórzyć crash, znaleźć rootcause, naprawić; uruchomić crash diagnostics submission

### #25 · [Insight Preview-pane action skrót + Mądry Generator] ⭐
Owner: „Na preview już są przyciski akcji (report/deck/table/idea/note/initiative + AI summarize/suggest) — to fajne, gdyby stąd można było robić inicjatywy/notatki/idee. Trzeba mądry generator."

**STAN DZIŚ:** Preview-pane Insights ma ten skrót (potwierdzone na screenie + w kodzie). Ale generatory **prawdopodobnie nie dostają payloadu z insightu** — grep nie znalazł `insightContext`/`prefilledFrom` w komponentach Interview. Czyli klik „Create report" prawdopodobnie otwiera **pusty generator**, co marnuje cały skrót.

**MĄDRY GENERATOR — owner spec:**

⭐ **„Mądry" = generator dostaje przefiltrowany kontekst z insightu** zamiast całości:

```
[Klik na karcie „Create report" w preview-pane]
   ↓
Modal „Smart Generator" otwiera się obok generatora docelowego z 4 krokami:
   1. Cel: „Jaki rodzaj raportu?" (Executive 1-pager / Full audit / Specific dimension)
   2. **Tabela wyboru źródeł** ⭐ (owner spec):
      [ ✓ ] Executive Summary
      [ ✓ ] Themes (5 wybranych z 8)
      [ ✓ ] Issues & Risks (poziom: High+ only)
      [   ] Opportunities
      [ ✓ ] Consensus & Divergence
      [   ] Implicit Assumptions
      [ ✓ ] Source Sessions (chipy do wyboru: A, B, D)
      [   ] Full Analysis
      [   ] Activity Log
   3. Tone & format: Tone (formal/casual) + length (1pg/3pg/10pg)
   4. Audience: Internal / Client / Executive
   ↓
[Generate] — generator dostaje TYLKO wybrane sekcje + ich AI summaries jako kontekst.
```

**Per docelowy artefakt — preset selection:**

| Target | Default checked | Sugerowane |
|---|---|---|
| **Report** | Exec Sum + Themes + Issues + Opportunities | „Audit readout" preset |
| **Deck (PPTX)** | Exec Sum + 3 strongest Themes + 2 top Opportunities + Sources | „10-slide exec deck" preset |
| **Table** | Findings & Evidence + Consensus Matrix | Eksport do Excel/Sheets |
| **Idea** (canvas) | Opportunities + Hypotheses (jeśli są) | Mind-map seed |
| **Note** ⭐ | **tylko 1-2 fragmenty** (owner spec: „nie całość, tylko fragmenty") | Quote picker — wybierasz konkretne ustępy |
| **Initiative** | Issues + Opportunities + Hypothesis Board | Inicjatywa = action plan |

**Dla Note — szczególny case (owner):**
- Generator pokazuje listę pojedynczych **bloków** (każdy paragraph/theme/finding jako klikalny chip)
- User zaznacza 2-3 fragmenty
- Wybiera notebook docelowy
- Klik → fragmenty wlatują do notatki z linkiem do insight ID jako źródło

**Dla Initiative — szczegółowy case (owner: „cały generator inicjatyw"):**
- Smart Generator wyciąga z insightu: top 5 Issues + top 3 Opportunities + Hypothesis Board
- AI proposes 3 kandydatów na initiative z każdego źródła
- User zaznacza które inicjatywy stworzyć
- Każda inicjatywa preselected z: title + description + linked findings + suggested KPIs + estimated effort
- Klik [Create] → bulk-creates kilka inicjatyw naraz, każda z source = `insight_id`

**Implementacja backend:**
- `POST /interview/insights/:id/generate-artifact` z payload `{targetKind, selectedSections[], options}`
- Backend agreguje wybrane sekcje, zwraca prefilled draft do target generatora
- Trace linkage: każdy stworzony artefakt ma `source_insight_id`

**Severity:** wysoka. Dziś skrót akcji w preview-pane to **fasada** — kliknięcie otwiera pusty generator, co frustruje. Mądry Generator = realna wartość: 1 klik vs 30 minut przepisywania.

### #26 · [Insight Toolbar — chaos kolorów + Submit for Review → „Submit for Information"] ⭐
Owner screen pokazuje toolbar: `Regenerate · Export Tools · Export Assessment · To Notebook · Download MD · Copy · Submit for Review`.

Owner: **„Submit for Review to może być istotna funkcjonalność. Ale dla insightów ja bym nie robił review — ja bym robił 'Submit for Information'. Wysyłam insight do osoby z grupy menedżerów/ownerów, wylatuje do jej inboxa, my work. Nie mamy formuły review ani zatwierdzenia."**

To jest **kluczowa decyzja produktowa** — i ma sens:

**RÓŻNICA: Review vs Information**
- **Review** = manager musi coś **zrobić** (approve/sendback) → blokuje workflow
- **Information** = manager **dowiaduje się** → nic nie blokuje, można dyskutować w comments

**Owner wniosek:**
- Insights NIE są workflow-locked (jak ankiety)
- Insights są **deliverable do informacji** — manager je czyta, komentuje, ale nie „akceptuje"
- Formuła zatwierdzenia nie istnieje dla insightów → nie udawajmy że istnieje

**Propozycja:**
1. **`Submit for Review` → `Submit for Information`** (rename + zmiana semantyki)
2. Brak gate'u approve/sendback
3. Wybór odbiorcy z dropdownu (managers + owners w org)
4. Po kliknięciu: insight ląduje w inboxie/MyWork odbiorcy z badge „Shared with you"
5. Odbiorca może komentować w sekcji Comments (już istnieje)
6. Sender widzi „Read by X · Comments Y"
7. Insight pozostaje **edytowalny** (nie locked jak po review)

**Toolbar redesign (chaos kolorów):**

Dziś 7 buttonów × 4 różne kolory (red Regenerate / blue Tools / red Assessment / blue Notebook / gray Download / gray Copy / blue Submit) → tęczowy chaos.

**Propozycja kanon „Insight Action Bar":**

```
[ Primary: Submit for Information ] (gradient/solid)
   │
[ Export ▾ ] [ Convert ▾ ] [ ✨ AI ▾ ]   (3 dropdowny — wszystkie jednolite)
   │           │              │
   ├ Tools     ├ Initiative   ├ Regenerate insight
   ├ Assessment├ Decision     ├ Improve clarity
   ├ Notebook  ├ Task         ├ Re-run analysis
   ├ Download  ├ Report       ├ Translate
   ├ Copy      └ Deck         └ Compare versions
   └ Share link
```

- **1 primary action** (Submit for Information)
- **3 secondary dropdowny** (Export / Convert / AI) — wszystkie ten sam styl chipa
- **„Copy" znika** (owner: „kopiowanie stąd jest w ogóle trudne, nie widzę sensu") → przeniesione do dropdown Export jako „Copy markdown"
- **„Regenerate" przenosi się** do AI dropdown (nie zostaje w głównym pasku)
- **Convert dropdown ⭐ NEW** — pełen handoff w jednym miejscu (Initiative / Decision / Task / Report / Deck)

**Severity:** wysoka. Owner explicit wnioski — to nie kosmetyka, to zmiana modelu mentalnego insightu.

### #27 · [Insight Metrics Strip + Index ID jako artefakt + N/C view] ⭐
Owner: „Rzeczywiście dobrze, gdyby u góry była tabela z metrykami. Mamy raz, dwa… dziesięć okien. Niesymetrycznie. Albo rozłóż na dziesięć, po pięć w linii, albo zrób inaczej. Plus: insight ma unikatowy numer indeksowy (INS-II_A0552A23-), który można jako artefakt później podpinać."

**A) MetricStrip — 10 metryk dziś:**
1. Status, 2. Analysis Type, 3. Created, 4. Gen Time, 5. Sessions, 6. Review, 7. Findings, 8. Candidates, 9. Evidence, 10. Readback.

Dzisiejszy layout: 6 + 4 (asymetria którą owner widzi).

**Propozycja MetricStrip layout (3 opcje):**

⭐ **Opcja A: 5+5 (owner sugestia direct):**
- Row 1: Status · Analysis Type · Sessions · Findings · Candidates
- Row 2: Created · Gen Time · Evidence · Readback · Review
- Symetria visualna

⭐ **Opcja B: Inline single row z dividerami (modern):**
- `Status • Type • Sessions 2 • Findings 7 • Candidates 7 • Evidence 10 • Readback 0/7 • Review Draft`
- Created + Gen time → przeniesione do timestamp pod tytułem
- Mniej wizualnego ciężaru
- Najlepsze dla owner-spec „dashboard-strip, nie formularz"

⭐ **Opcja C: Compact „health summary":**
- 1 duża metryka: overall confidence chip
- 4 sub-metryki: Sessions · Findings · Evidence · Readback %
- Reszta w „Details" hover/expand
- Najmniej miejsca

**Rekomendacja:** **Opcja B** (inline z dividerami) — najczystsze, owner-spec „mniej formularz, więcej dashboard".

**B) Insight Index ID (INS-II_A0552A23-) jako artefakt — owner explicit:**

⭐ **Tak — to jest core feature: Insight to artefakt z addresowalnym ID.**

**Plan:**
1. **Display ID** zawsze widoczny obok title (małym `font-mono text-slate-500`)
2. **Copy ID button** obok (klik = clipboard)
3. **Universal artifact picker** w innych modułach pozwala wyszukiwanie po `INS-` prefix
4. **Linkowanie:** `INS-II_A0552A23-` można wkleić w Reports/Notes/Decks/Initiatives jako mention chip → embed link
5. **Backlinks panel** w Insight: „Linked from: 3 reports, 1 initiative, 2 notes" (już mamy Activity Log — można dodać linked-from)
6. **Slash-command:** w edytorze tekstu wpisz `/insight` → search → wstaw chip
7. **Insight URL stable:** `/insights/INS-II_A0552A23-` — link działa przez lata nawet jak title się zmieni

To jest standard **dla wszystkich artefaktów platformy** — Tasks (`TSK-`), Decisions (`DEC-`), Reports (`RPT-`), Initiatives (`INI-`), Notes (`NTE-`). Linear, Jira, Notion — wszyscy duzi mają stabilny ID prefix.

**C) Drugi format widoku (N vs C) — czy w tej rundzie?**

Owner: „Zastanowiłbym się, czy już teraz robić drugi kształt widoku, bardziej podsumowywalny. Jeżeli będziesz miał na to pomysł i przestrzeń — możemy. To wprowadzi konieczność nowego formatu artefaktu, który będzie tak samo zrobiony w inicjatywach."

**Moja rekomendacja: TAK — w tej rundzie zrobić oba (N+C) razem ale jako PHASING.**

⭐ **Plan w tej samej rundzie:**

**Faza A:** wszystko z #21 (kanon SectionCard + AI slot + N-mode poprawiony) + #23 (per-sekcja format) + #25 (mądry generator) + #26 (toolbar + Submit for Info) + #27 (metric strip + ID artefakt) — to wszystko **w N-mode** = pełen detail view.

**Faza B (drugi kształt):** **„Summary Mode" / „C-mode"** = compact dashboard insightu na 1-2 ekranach:
- Top: header + metric strip
- Sekcja środkowa: **2-3 kol grid kafelków**, każdy kafelek = compact mini-section:
  - Tytuł sekcji + count badge
  - 2-3 najważniejsze elementy (top themes / top risks / top opportunities)
  - „Show more →" do pełnej sekcji w N-mode
- Footer: action bar
- **Jeden ekran = cały insight w 80% trafności**
- Idealne dla: senior konsultant 27"+, klient quick-look, manager Inbox preview

**Format artefaktu:**
- Format `InsightSummaryCard` reusable: pojedyncza karta z tą samą strukturą (top kafelki) — można embedować w **Reports/Decks** jako block (z Insight ID jako reference)
- W **Initiatives** ten sam format dla initiative summary
- Jeden komponent = wzorzec dla obu modułów

**Plan implementacji w tej rundzie:**

| Część | Czas | Kolejność |
|---|---|---|
| #21 kanon SectionCard + AI slot | 1-2 dni | start |
| #23 per-sekcja format (20 sekcji + 7 nowych) | 5-7 dni | po kanonie |
| #25 mądry generator | 2-3 dni | po sekcjach |
| #26 toolbar + Submit for Info | 1 dzień | równolegle |
| #27a MetricStrip layout | 0.5 dnia | równolegle |
| #27b Insight ID artifact linking | 1-2 dni | po refactor |
| **#27c C-mode (Summary view) + reusable card** | 2-3 dni | po wszystkim |
| **= razem 12-19 dni** | | |

**To jest ~3 tygodnie pełnej pracy nad Insight** — realna inwestycja, ale rezultat: **pełen profesjonalny artefakt + drugi format reusable w Initiatives**.

**Severity:** wszystkie 3 wątki krytyczne. Owner spec consolidated: detail view + drugi format (summary) + ID jako artefakt + symetryczny metric strip + Submit for Info zamiast Review + mądry generator z preselectem sekcji. Razem = pełen kontrakt na to jak Insight ma się stać core deliverable platformy.

### #28 · [AI Insight Creator — graficzne uwagi + reusable source basket] ⭐
Owner: „Generator treściowo prawdopodobnie już jest niegłupi, ale graficznie pytanie czy nie podmienić. I ważna rzecz: z jednych źródeł możemy robić różne insighty pod różnym kątem — to musi być proste."

**A) MERYTORYCZNA OCENA — generator jest dobry treściowo:**

Sprawdziłem 5 kroków na screenach:
- **Step 1 Goal:** Title + 5 output types (Executive Summary / General Analysis / Trend Analysis / Problem Discovery / + scroll) ✅ sensowne lensy
- **Step 2 People:** „All people" master + lista osób z checkboxami (Anna/Marek/Ola + 2 puste sloty?) ✅ właściwy wybór
- **Step 3 Source:** Material date range + Respondent role + Respondent department + Select source sessions (checkbox lista z metadata: questions / template / date) ✅ przemyślane filtry
- **Step 4 Analysis:** 5 modów (General consulting / Focused topic / Contradiction scan / Initiative opportunity scan / + scroll) + Topic focus chip-grid + „Selected: 1" counter ✅ kanon analizy jakościowej
- **Step 5 Context:** Leading question + Notes + Add files (TXT/MD/CSV/JSON/PDF/DOC/XLS/PPT, max 5 × 10MB) + Internal artifact links ✅ pełna kontekstualizacja

**Wniosek owner ma rację: treściowo to JEST mądry generator.** 5 trybów analysis + leading question + role/department/date filters + internal artifact linkable to są dokładnie te dźwignie których konsultant potrzebuje.

**B) GRAFICZNE UWAGI — co bym poprawił (nie krytyczne, ale polish):**

1. **Wizard tabs (1 Goal / 2 People / 3 Source / 4 Analysis / 5 Context)** — dziś każdy active tab jest **kolorowy chip czerwony**. Po kliknięciu „Next" poprzedni krok robi się szary chip z liczbą. **Problem:** brak wizualnego progress sense (gdzie jestem na drodze do końca). 
   - **Fix:** progress bar pod tabami (`▄▄▄░░ 60%`) + czerwony chip TYLKO dla active, pozostałe ukończone = ✓ green chip, nieosiągnięte = `text-slate-500`.
   
2. **Step 2 People** — pokazuje listę osób + **2 puste sloty checkbox** (na screenie widoczne). To wygląda jak placeholder/error. 
   - **Fix:** jeśli to ma być „add more" — explicite `+ Add person`, nie puste sloty. Jeśli to data bug — naprawić.
   
3. **Step 3 Source** — sesje pokazują metadata jako 3 wartości w jednym rzędzie (`6/10 questions · Cost & Efficiency · 26/03/...`). Czytelne, ale **brak quick filter** „tylko approved" / „tylko submitted". 
   - **Fix:** chip-row filter na górze listy (`Wszystkie · Approved · Submitted · Mixed`) + sort by date/relevance.
   
4. **Step 4 Analysis** — Topic focus jako 2-kol chip grid (`Strategy and goals · Process and operations · Technology and systems · Data and reporting`). 
   - **Brak miganu „co tu zrobi inny wybór"** — user widzi tylko nazwy. 
   - **Fix:** hover na chip → tooltip „This focuses AI on..." + przykład znaleziska.
   
5. **Step 5 Context** — `Documents (TXT/MD/CSV/JSON/PDF/DOC/XLS/PPT, max 5 files, 10 MB each)` to **długa linijka mikro-typografii** — niesympatyczna. Add files button z prawej, mała czcionka. 
   - **Fix:** drag-drop zone z dużymi ikonami formatów + przycisk Add files w środku. Limit info jako tooltip pod (i).
   
6. **Submit button** w step 5: `[ ✨ Run ]` — czerwony solid, OK. Ale `[ Run ]` jest bardzo lakoniczne. 
   - **Fix:** `[ ✨ Generate Insight ]` (jasna intencja) + jeśli już insight z tych samych źródeł istnieje — alert „1 podobny insight istnieje — chcesz zastąpić/dodać/anulować?".

7. **Wszystkie tabsy 1-5** powinny być **klikalne** żeby skoczyć (dziś chyba też są, ale w grafiki niewidać affordance — dodać hover state).

8. **Wszystkie checkboxy** to natywne — patrz #14 — powinny być custom rounded checkboxy spójne z resztą platformy.

9. **Modal max-w** — szeroki ale puste boki na większości kroków. Z drugiej strony krok 3+4 mogą wymagać szerokości. 
   - **Fix:** `max-w-2xl` (672px) — szerszy niż dziś, ale nie cały ekran.

10. **Polski/angielski mix** — generator po angielsku, reszta platformy po polsku (przyciski „Nazwa" / „Sprawdź"). Sprawdzić lokalizację.

**Severity polish'u:** średnia — to jest „dobre już, ale lepsze byłoby" — nie blokuje funkcjonalności.

**C) ⭐⭐⭐ KLUCZOWA SPRAWA: 1 zestaw źródeł → wiele insightów pod różnym kątem (owner spec)**

Sprawdziłem w kodzie: **NIE MA `sourceBasket` / `reusableSource`** — czyli dziś każdy nowy insight = od nowa wszystkie checkboxy w Step 3.

**To jest źle dla twojej wizji**, bo:
- Konsultant ma 10 sesji z auditu transformacji digitalnej
- Chce zrobić: 1) Executive Summary, 2) Risk Assessment, 3) Trend Analysis, 4) Opportunities scan, 5) Stakeholder lens, 6) Contradiction scan — wszystko z TYCH samych źródeł, ale inne LENS
- Dziś = 6 × klikanie identycznych checkboxów źródeł → frustracja
- Owner spec: „z jednych źródeł różne insighty" — to musi być **2 kliknięcia, nie 10**

⭐ **PROPOZYCJA: Source Basket (koszyk źródeł)**

**Model danych:**
```sql
insight_source_baskets
- id, organization_id, project_id, created_by
- name (np. "DigitalAuditQ4-Sessions" — auto lub user-named)
- description (opcjonalnie)
- filter_criteria_json (date range, role, department, status — żeby auto-refresh)
- selected_session_ids_json (lista konkretnie wybranych sesji)
- people_filter_json (kogo dotyczy)
- context_docs_json (które context files attached)
- created_at, updated_at, last_used_at
- usage_count (ile insightów z tego koszyka)

insights → insight_source_basket_id (FK, nullable)
```

**UX:**

1. **Step 3 + 5 generatora dostają nowy TOP toggle:**
   ```
   [ ⊙ Use existing basket ▾ ]   [ ⊙ Build new basket ]
                ↓
        (jeśli existing — dropdown:)
         📦 DigitalAuditQ4-Sessions     · 10 sessions · used 3× · last 2d ago
         📦 ProductTeamFeedback         · 4 sessions  · used 1×
         📦 ComplianceQ1                · 12 sessions · used 5×
   ```
   - Wybór existing basket pre-fills Steps 3 i 5 automatycznie
   - User może jednak edytować (nadpisuje basket lub tworzy variant)

2. **Po pierwszej Run insightu:** modal proponuje „Save these sources as a reusable basket?" → name → save
   - Default: auto-save z auto-name typu „<Project> sessions <date>"
   - User może rename / skip

3. **Lista existing basketów** dostępna globalnie w Insights tab → secondary button `[ 📦 Source Baskets ]`
   - Każdy basket: name + metadata (sessions count, last used, lineage of insights z tego basketu)
   - Akcje: Use / Edit / Clone / Delete

4. **Po zmianach źródeł** w bazie (np. nowa sesja zatwierdzona pasująca do filter_criteria):
   - Basket pokazuje badge „2 new sessions match — refresh?"
   - User decyduje czy chce **przelać nowy insight z aktualnym koszykiem** (czyli filter-based) lub **trzymać snapshot** (frozen baskets)

5. **„Generate variant"** ⭐ — z existing insightu klik → otwiera generator z **prefilled basket** (z basketu źródłowego) + można zmienić TYLKO Step 1 (output type) i Step 4 (analysis mode) → 1 klik = nowy insight pod innym kątem
   - To realizuje **1:1 owner spec** „z jednych źródeł różne insighty"

**Backend:**
- `POST /interview/insight-baskets` — create
- `GET /interview/insight-baskets` — list
- `GET /interview/insight-baskets/:id` — read with linked insights
- `POST /interview/insights/from-basket/:basketId` — generate using basket
- `POST /interview/insights/:id/variant` — clone basket + open Step 1/4 only

**Severity:** **bardzo wysoka** ⭐ — bez basketów twoja wizja transformacji (insighty są podstawą dla inicjatyw) tonie w klikaniu. Owner explicit: „inicjatywy są samą transformacją, dlatego insight musi być dobry". Mądry insight = łatwo dostępny z kilku lensów na tym samym materiale.

**D) PODSUMOWANIE GENERATORA — co trzymać, co poprawić:**

| Aspekt | Trzymać | Poprawić |
|---|---|---|
| 5-step wizard | ✅ struktura sensowna | dodać progress bar + lepsze hover states |
| Output types (Step 1) | ✅ 5+ typów to fundamenty | dodać preview „co dostaniesz" |
| People filter (Step 2) | ✅ logiczne | puste sloty — fix bug / add „+" |
| Source picker (Step 3) | ✅ filters OK | quick chips „Approved/Submitted/Mixed" |
| Analysis modes (Step 4) | ✅ 5 lensów wartościowych | hover tooltip „co zrobi inny wybór" |
| Context (Step 5) | ✅ file upload OK | drag-drop zone z ikonami zamiast button |
| Run button | ✅ akcja jasna | rename „Generate Insight" + duplicate-detect alert |
| **Source Basket** ⭐ | ❌ NIE ISTNIEJE | **MUST DODAĆ** — krytyczne dla wizji |
| **Generate variant** ⭐ | ❌ NIE ISTNIEJE | MUST — 1-klik nowy lens z tych samych źródeł |

**E) BUSINESS CASE (twoje słowa „inicjatywy są samą transformacją"):**

Insight → Initiative → Transformation. Każde tarcie w robieniu insightu = przeszkoda w docelowej transformacji. Mądry generator + basketing = **konsultant może wygenerować 6 insightów pod 6 różnych kątów w 10 minut zamiast 60 minut**. To jest 6× lepszy throughput analizy jakościowej — przewaga konkurencyjna nad klasycznymi audit tools (RSM Wingman / Workiva / AuditBoard).

### #29 · [Initiative Wizard — MĄDRY GENERATOR INICJATYW] ⭐⭐⭐ KOŃCOWY MOMENT
Owner: „Koniec tej przygody. Initiative jest podstawowym narzędziem transformacyjnym. Trzeba mądrze definiować: wartościowe, odpowiednia ilość, NIE definiować jeśli już taka inicjatywa jest. Workflow: lista Inicjatywy → Add new → Wizard → wybierz insighty (1 lub więcej) → na poziomie insightów tworzymy listy inicjatyw."

**A) STAN DZIŚ (sprawdzone w kodzie):**

Wizard już istnieje (`src/components/Initiatives/Wizard/InitiativeWizardModal.tsx`). Plus **3 inne implementacje wizardów inicjatyw**: useInitiativeGenerator.ts, AdminInitiativeCreatorPanel.tsx, InitiativeGeneratorWizard.tsx (assessment), InitiativesGenerationWizardModal.tsx.

⚠️ **Problem #1: są 4 różne wizardy** — konsolidacja w jeden kanon z różnymi entry points (from-insights, from-assessment, from-scratch).

**Aktualny screen pokazuje:**
- 4-step wizard: Intencja / Kandydaci / Governance / Wynik (sensowna struktura)
- Język PL dla labelek ✅
- **Notatka konsultanta w środku po ANGIELSKU** ❌ — bug, owner explicit
- 6 priority chipów (Marża/EBITDA · Jakość · Terminowość · Automatyzacja · Governance · Redukcja ryzyka)
- Liczba: 5, Horyzont: 90 dni, Ryzyko: Mieszany portfel

**Problem #2:** wizard nie wymaga wyboru insightów na wejściu — owner spec: „wybieramy insighty (1 lub więcej) i na ich poziomie tworzymy listy inicjatyw". Trzeba dodać **Step 0: wybór insightów**.

**B) ⭐ MĄDRY GENERATOR — pełen design:**

Cztery filary mądrości (owner spec):
1. **WARTOŚCIOWE** — rozwiązuje realny problem z dowodami
2. **ODPOWIEDNIA ILOŚĆ** — capacity-aware, nie 50, nie 0
3. **NIE DUPLIKOWAĆ** — sprawdzić co już jest (similarity check) ⭐
4. **DOBRA TRANSFORMACJA** — każda to realny krok

**Step 0 — Wybór insightów (NEW):** lista insightów z checkboxami (1-N), badge „11 findings · 5 sessions" jako podsumowanie, tip „więcej insightów = bogatszy kontekst, ale >3 = risk rozproszenia".

**Step 1 — Intencja (POLISH-COMPLETED):** cel transformacyjny (text) + priorytety (1-3 chipy) + horyzont + ryzyko + ⭐ **Liczba AI-suggested z capacity check** (`zespół ma 4 wolne sloty → propose 3-5`) + notatka kontekstowa **PO POLSKU** (bug fix).

**Capacity logic:**
- 0-2 aktywne → propose 3-5
- 3-5 aktywne → propose 2-3
- 6+ aktywne → propose 1-2 + ostrzeżenie „organizacja przeciążona transformacją"

**Step 2 — Kandydaci (NEW with similarity check ⭐ KLUCZOWA INNOWACJA):**

AI generuje 5-7 kandydatów, każdy z flagą NEW/SIMILAR/DUPLICATE/RELATED:

```
1. Approval Workflow Automation                   ⚠ SIMILAR (67%)
   Reduce approval cycles via workflow tool
   ⚠ Similar: "Process automation - approvals"
      (existing, in_progress, owner: Anna)
      [View existing] [Merge] [Create anyway]
   Evidence: 3 findings · Confidence: 78%
   Effort: M · Impact: High
   [✓ Include] [✗ Skip]

2. Quality Gate Implementation                    ✓ NEW
   Add quality gates between phases
   ✓ No similar — NEW
   Evidence: 5 findings · Confidence: 89%
   Effort: L · Impact: High
   [✓ Include] [✗ Skip]

3. Training Program Restructure                   💭 RELATED
   ⚠ Related: "L&D framework update" (42% match)
   Suggestion: Extend istniejącą
   [View] [Extend] [Create separate]
```

⭐ **Per-kandydat similarity check** używa `embeddingService` (sprawdziłem — istnieje w `KnowledgeService`):
- Embedding wektor per kandydat
- Backend porównuje z embeddings WSZYSTKICH aktywnych inicjatyw w org
- >70% match → DUPLICATE (czerwony, sugeruje Merge/Block)
- 50-70% → SIMILAR (żółty, sugeruje Extend)
- 30-50% → RELATED (niebieski, kontekst)
- <30% → NEW (zielony)

Score'y vs trzy źródła:
- Aktywne inicjatywy (status ≠ completed/cancelled)
- Niedawno completed (<6 miesięcy) → „już zrobione"
- Cross-project (jeśli owner view) → „inny projekt to robi"

**Step 3 — Governance:** per inicjatywa: Owner + Stakeholders + Approver + Reviewers per phase. Opcja „Auto-create governance z org chart" (use roles → suggest owners).

**Step 4 — Wynik:** preview wybranych inicjatyw + capacity check po utworzeniu (status overload GREEN/AMBER/RED) + audit trail do insightów.

**C) BACKEND — co dorobić:**

```sql
ALTER TABLE initiatives ADD COLUMN embedding TEXT;  -- vector dla similarity
ALTER TABLE initiatives ADD COLUMN generation_metadata_json TEXT;  -- params wizard
ALTER TABLE initiatives ADD COLUMN linkage_findings_json TEXT;  -- konkretne findings
```

```
POST /initiatives/wizard/check-similar   — embedding diff per kandydat
POST /initiatives/wizard/generate-candidates  — AI z capacity-aware count
POST /initiatives/wizard/check-capacity  — overload status
POST /initiatives/wizard/bulk-create     — z governance + lineage
```

**D) AI PROMPT — co ma robić mądrze:**

```
System: "You are a transformation strategist. Given N insights with findings, propose K initiatives that:
1. Each addresses a REAL problem with cited evidence
2. Each has measurable outcome (2-4 KPIs)
3. Each fits priority filter
4. Each can be delivered in horizon
5. Together balance effort vs impact (don't propose 5 huge)
6. AVOID overlap — if 2 findings address same root cause, propose ONE

Quality bar: each initiative must pass test 'Could a director defend this to a board?'"
```

**E) FORMUŁA „NIE DUPLIKUJ" — pełny flow:**

1. Po Step 1 → AI generuje kandydatów
2. Per kandydat → embedding
3. Backend compares z 3 źródłami (active / completed / cross-project)
4. Wynik per kandydat: NEW / SIMILAR / DUPLICATE / RELATED
5. User widzi flagi PRZED kliknięciem „Include" — informed decision

**F) POPRAWKI GRAFICZNE z screena:**

1. ❌ Notatka kontekstowa po angielsku → lokalizować PL
2. ❌ Brak language switcher
3. ❌ Brak Step 0
4. ⚠ „Liczba 5" hard-coded → AI-suggested
5. ⚠ Priorytety — brak hint „wybierz 1-3" + max-limit
6. ⚠ Esc też anuluje (a11y)

**G) WARTOŚCI BIZNESOWE (twoje słowa „inicjatywa jest podstawowym narzędziem transformacyjnym"):**

Bez mądrego generatora:
- 20 zduplikowanych inicjatyw o tej samej rzeczy → chaos
- „Mamy 30 inicjatyw" → klient pyta „które robicie?" → milczenie
- Nikt nie wie czego ma być więcej

Z mądrym generatorem:
- Każda inicjatywa = uzasadniony krok z dowodami
- Capacity-aware → zespół realnie robi co przyjął
- Similarity check → nie duplikujemy pracy
- Cross-insight synthesis → inicjatywy z wielu lensów składają się w spójną transformację

**H) KOLEJNOŚĆ IMPLEMENTACJI:**

⭐ **MVP (3-5 dni):** lokalizacja PL, Step 0 wybór insightów, capacity check, konsolidacja 4 wizardów → 1
⭐ **V1 (5-7 dni):** embedding similarity, UI flags NEW/DUPLICATE/SIMILAR/RELATED, Merge/Extend flow
⭐ **V2 (3-4 dni):** auto-KPIs, suggest owner z org chart, bulk-create z governance, lineage
⭐ **V3 (długoterm.):** Portfolio Health dashboard, cross-project sharing, kwartalne auto-review

**I) FINAŁOWY STATEMENT:**

Generator inicjatyw to **najważniejszy generator w platformie** — od niego zależy, czy konsultanci dostarczają wartość, czy tylko gadają.

**3 testy które każda inicjatywa musi przejść:**
- ✓ **Defendable**: „mogę to obronić przed zarządem klienta" (evidence + confidence)
- ✓ **Distinct**: „nie duplikuje istniejącej roboty" (similarity check)
- ✓ **Deliverable**: „mamy capacity i kompetencje" (capacity + skills check)

Bez tych 3 testów wizard jest „dump pomysłów". Z nimi — **fabryka transformacji**.

**Severity:** krytyczna. Owner: „liczę na ciebie, bo ja go chyba do końca nie wymyśliłem." — odpowiadam: **TO jest design.** 4-step wizard z Step 0 (insights), capacity check, similarity dedup z embeddingami, bulk creation z governance. Embedding service już mamy. **Embeddings + capacity + lineage = mądry generator.**

---

## ⭐ KONIEC SESJI ZBIERANIA UWAG — finalne podsumowanie

29 obserwacji + analiz zebrane w `_IV_TEST_NOTES.md` + 4 osobne pliki specs (`_IV_ANSWER_FORM_REDESIGN.md`, `_IV_SESSIONS_VS_ASSIGNED_DECISION.md`, oryginalne audyty per-feature).

**Tematy do ataku w kolejności priorytetów (moja rekomendacja):**

**P0 (krytyczne bugi):**
- #4 Voice „3 osoby" (fragment-per-message)
- #24 Insight section crash (Signals?)
- #14 Form modal kanon (fundament wszystkich modali)
- #18 Tables kanon graficzny (fundament wszystkich tabel)

**P1 (fundamenty platformy):**
- #21 Detail view N+C standard
- #23 Insight Detail kompletny refactor
- #28 Insight Generator + Source Basket ⭐
- #29 Initiative Generator + Similarity check ⭐
- #19 Audit Orchestrator (epicowe use case'y)
- #27 Insight ID jako artefakt

**P2 (workflow):**
- #7+#7b+#8 Manager flow (Approve/SendBack/Archive/Bulk)
- #11 AI Quality Gate (pre-submit)
- #12 Sessions+Assigned merge
- #25 Mądry Generator preview-pane
- #26 Submit for Information

**P3 (polish):**
- #1 Visible columns popover clipping
- #5+#5b Answer form redesign
- #6 Inbox chip filters
- #16 Templates kolumny
- #17 TemplateBuilder rebranding AI buttons
- #20 Insights tabela
- Reszta UX polish

**Szacunek: 6-8 tygodni dedykowanej pracy** żeby Interview module osiągnął jakość „production-grade SaaS for serious consulting". To realna inwestycja, ale rezultat: **jeden z najbardziej zaawansowanych qualitative-research+transformation tooli na rynku**.

### #30 · [Initiative Card jako WZORZEC + źródło prawdy lifecycle] ⭐⭐⭐
Owner: „karta inicjatywy jest znacznie lepsza niż insight, można ją traktować jako wzorzec. Top strip czytelniejszy — podwędźmy do insightów. Brak wersji clickupowej. Menu 3 prawy slot: generuj/regeneruj całość + per-karta AI. Duża część automatycznie, ale dużo przez człowieka — AI podpowiada."

**Pełna dyskusja: `docs/audit/2026-06-05/_IV_INITIATIVE_DISCUSSION.md`** (pytania/wątpliwości/pomysły + źródło prawdy).

**Najważniejsze ustalenia:**
1. **Karta inicjatywy = referencyjny wzorzec dla #21 (detail view standard).** Ma top strip czysty, ID artefakt (INIT-), per-section AI, backlinks, 18 sekcji z drag-reorder. Insight się podciąga do tego kanonu.
2. **Źródło prawdy przeczytane (kod + docs):** inicjatywa to ciężki obiekt governance — **13 statusów** (DRAFT→PENDING_REVIEW→REVIEW→PROMOTED→PLANNING→APPROVED→SCHEDULED→EXECUTING⇄BLOCKED→DONE→TRACKING + CANCELLED/ARCHIVED), gates z rolami, backend-owned capabilities (`gate-readiness-check`), scope przez Decisions, 4 ścieżki tworzenia.
3. **Wizard „nie przełączał zakładek"** = sekwencyjny bramkowany (Krok 2 pusty dopóki nie wygenerujesz kandydatów) — celowe, ale UX nie komunikuje.
4. **Wielki rozjazd:** wizard generuje BULK kandydatów, ale każda inicjatywa to ciężki 18-sekcyjny obiekt. Rozwiązanie: **progresywne wypełnianie** — wizard wypełnia rdzeń (Problem/Solution/Scope/KPI z insightu), reszta pusta z AI-assist per sekcja, sekcje wymagane progresywnie wg gate.
5. **„Interview nie ma żadnej inicjatywy"** (owner) — flow Interview→Initiative realnie jeszcze nie działa end-to-end. Generator #29 + handoff fix to fundament.

**5 decyzji architektonicznych do rozstrzygnięcia przez ownera (P1/P4/P5/P7 + czy zaczynamy od wspólnego DetailView kanonu).**

---

## ⭐ STATUS KOŃCOWY SESJI — 30 obserwacji + 3 dokumenty dyskusyjne

**Pliki:**
- `_IV_TEST_NOTES.md` — 30 obserwacji (ten plik)
- `_IV_INITIATIVE_DISCUSSION.md` — dyskusja inicjatyw + źródło prawdy lifecycle
- `_IV_ANSWER_FORM_REDESIGN.md` — redesign formatki odpowiedzi
- `_IV_SESSIONS_VS_ASSIGNED_DECISION.md` — decyzja architektoniczna

**Wszystkie wpisy ownera potwierdzone i zapisane. Czeka na 5 decyzji architektonicznych przed implementacją.**
