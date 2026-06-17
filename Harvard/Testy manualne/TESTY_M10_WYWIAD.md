# TESTY — M10 Wywiad (Discovery)

> **Moduł:** M10 Wywiad (`/discovery`) — wg `Harvard/podzial/_MODULE_MAP_V2.md`
> **Zakres tej paczki:** pełny cykl życia wywiadu — szablony → przypisania → sesje (3 tryby: single_question / task_list / conversational) → wnioski/InsightViewer (material_quality) → generowanie inicjatyw (generate_from_evidence) → bramka oceny AI+człowiek (SPEC_ZADANIE_13).
> **Cel:** agent piszący i testujący moduł ma na tej podstawie zweryfikować CAŁY cykl E2E wraz z dwoma otwartymi P0/P1: głos STT (#12) i bramkę oceny (#13), z dowodem UI + Network + DB.
> **Legenda:** **[MANUAL]** = wymaga ręcznej weryfikacji (audio / drag&drop / mikrofon); **[FLAG]** = zależne od flagi/capability/roli; **[DB]** = dowód obejmuje wiersz/kolumnę w bazie.
> **Bazuje na:** `Harvard/wdrozenie-100/M10-wywiad.md` · `Harvard/modules/M10-wywiad/KARTA_AUDYTU.md` · `Harvard/SPEC_ZADANIE_13_interview_flow_approval.md` · `src/components/Interview/` · `server/src/routes/interview.routes.ts`
> **Data:** 2026-06-16

---

## 0. Kontekst architektoniczny (przeczytaj przed testami)

### 0.1 Mapa komponent ↔ plik ↔ stan

| Obszar | Komponent | Plik | Stan / store |
|---|---|---|---|
| Hub główny | `InterviewHub` | `src/components/Interview/InterviewHub.tsx` (~13k linii) | React state; tabs: Inbox/Sesje/Przydzielone/Szablony/Wnioski/Inicjatywy |
| Workspace sesji | `InterviewWorkspace` | `src/components/Interview/InterviewWorkspace.tsx` | `runtimeMode`, `aiEvaluation`, `questions`, `session` |
| Tryb jednotematyczny | `InterviewSingleQuestionRuntime` | `src/components/Interview/InterviewSingleQuestionRuntime.tsx` | `liveTranscriptRef`, `liveInterimRef`, `chunksRef`, `isRecording` |
| Tryb konwersacyjny | `ConversationalPanel` | `src/components/Interview/ConversationalPanel.tsx` | transcript, parsed answers |
| Wybór trybu | `RuntimeModeSelector` | `src/components/Interview/RuntimeModeSelector.tsx` | `RuntimeMode` = `single_question` \| `task_list` \| `conversational` |
| Wskaźnik kompletności | `SufficiencyIndicator` | `src/components/Interview/SufficiencyIndicator.tsx` | criteria array |
| Wnioski (przeglądarka) | `InsightViewer` | `src/components/Interview/InsightViewer.tsx` (~8600 linii) | `insight`, `materialQuality`, `v6Themes/Issues/Opportunities` |
| Tworzenie szablonu | `TemplateBuilder` | `src/components/Interview/TemplateBuilder.tsx` | pytania, typy, waga |
| Przypisania (modal) | `AssignInterviewModal` | `src/components/Interview/AssignInterviewModal.tsx` | assignees, deadline, templateId |
| Podglądy encji | `InterviewSessionPreview` / `InterviewTemplatePreview` / `InterviewAssignmentPreview` / `InterviewInsightPreview` | `src/components/Interview/` | preview pane |
| Backend główny | `InterviewController` | `server/src/controllers/InterviewController.ts` | — |
| Serwis przypisań | `InterviewAssignmentService` | `server/src/services/InterviewAssignmentService.ts` | mirror-task do M03 |
| Serwis wniosków | `InterviewInsightService` | `server/src/services/InterviewInsightService.ts` | org-scope (naprawiony `b9f2dee9d2`) |
| Serwis inference | `interviewInferenceService` | `server/src/services/interviewInferenceService.ts` | LLM + zod-schema → `interview_insights` |
| STT / głos | `VoiceService` | `server/src/services/ai/VoiceService.ts` | OPENAI `whisper-1` (DP-1) → fallback GROQ |
| Trasy API | `interview.routes.ts` | `server/src/routes/interview.routes.ts` | mount: `/api/interview` |
| Trasy enterprise | `interview-enterprise.routes.ts` | `server/src/routes/interview-enterprise.routes.ts` | dodatkowe operacje masowe |

### 0.2 Maszyna stanów przypisania (egzekwowana serwerowo)

```
assigned → in_progress → submitted → [sent_back → in_progress →] approved → completed
```
(`InterviewHub.tsx:637`, `InterviewController.ts:3485-3515`)

**Przejścia krytyczne:**
- `submit`: liczy `completenessRatio` / `completenessPercent`; uruchamia `evaluateSessionAnswers` → zapisuje `ai_review_snapshot_json` z polami `overallScore`, `overallVerdict` (`ready_for_approval|needs_improvement|insufficient|empty`), `weakAnswerMap`, `recommendations`.
- `approve`: **twarda bramka completeness ≥50%** (409 jeśli mniej); wymaga `INTERVIEW_ASSIGN_MANAGE`.
- `send-back`: obowiązkowy powód + checklista `missingItems` z `weakAnswerMap`; `submitted → in_progress`.

### 0.3 Trzy tryby runtime

| Tryb | id | Opis |
|---|---|---|
| Pytanie po pytaniu | `single_question` | jedno pytanie na ekranie + głos STT + autosave |
| Lista zadań | `task_list` | wszystkie pytania widoczne naraz, inline edycja |
| Konwersacyjny AI | `conversational` | swobodna rozmowa → `aiParseSessionAnswers` mapuje transkrypt na odpowiedzi |

### 0.4 Role i uprawnienia

| Rola / Permission | Co może |
|---|---|
| `INTERVIEW_TEMPLATE_MANAGE` | tworzenie/edit/delete szablonów, publish, archive |
| `INTERVIEW_TEMPLATE_VIEW` | przeglądanie szablonów (read-only) |
| `INTERVIEW_TEMPLATE_USE` | tworzenie sesji z szablonu |
| `INTERVIEW_ASSIGN_MANAGE` | tworzenie przypisań, approve, send-back, delete, escalate, archive |
| `INTERVIEW_ASSIGN_VIEW` | przeglądanie przypisań |
| `INTERVIEW_REMIND` | wysyłanie przypomnień do respondentów |
| `INTERVIEW_INSIGHTS_CREATE` | generowanie / regenerowanie wniosków |
| `INTERVIEW_INSIGHTS_VIEW` | przeglądanie wniosków i komentarzy |
| `INTERVIEW_INSIGHTS_REVIEW` | aktualizacja statusu wniosków |
| `INTERVIEW_INSIGHTS_HANDOFF` | eksport wniosków do M11/M17 |
| `INTERVIEW_INSIGHTS_PUBLISH` | usuwanie wniosków |
| Respondent (assignee) | start/submit własnego przypisania; brak `INTERVIEW_ASSIGN_MANAGE` |

### 0.5 Zasada weryfikacji E2E (obowiązkowa)

Każda akcja MUSI być potwierdzona TRZEMA dowodami:
1. **UI** — zmiana wyglądu, toast, nowy stan komponentu.
2. **Network** — właściwy endpoint, poprawny payload / kod odpowiedzi (zakładka Network w DevTools).
3. **DB** — wiersz/kolumna w tabeli (przez reload strony i weryfikację, że stan przetrwał).

Sama zmiana wizualna bez żądania sieciowego = FAIL.

---

## SETUP środowiska testowego

1. Uruchom dev server FE (`:3000`) + BE (`:3001`).
2. Zaloguj się jako **OWNER DBR77** (pełne uprawnienia: `INTERVIEW_TEMPLATE_MANAGE` + `INTERVIEW_ASSIGN_MANAGE` + `INTERVIEW_INSIGHTS_*`).
3. Przygotuj drugie konto testowe **bez** `INTERVIEW_ASSIGN_MANAGE` (rola respondenta).
4. Otwórz DevTools → zakładka **Network** z filtrem: `/api/interview` + `/api/voice`.
5. Otwórz zakładkę **Console** — zero błędów/warningów przez cały test.
6. Dane testowe:
   - Szablon testowy z min. 5 pytaniami (różne typy: otwarte, zamknięte, skala 1-5, wielokrotny wybór).
   - Co najmniej 2 uczestników (jeden z nich = konto respondenta).
   - VTS: jeśli dostępna organizacja VTS na staging — testuj na niej (kluczowy klient wave 2 ~131 osób).
7. Przed testem głosu: upewnij się, że przeglądarka ma dostęp do mikrofonu (`chrome://settings/content/microphone`).

---

## 1. SZABLONY WYWIADÓW (`/discovery` → zakładka „Szablony")

### 1.1 Tworzenie szablonu od zera (TemplateBuilder)

**Kroki:**
1. Przejdź do `/discovery` → zakładka **Szablony** → przycisk „Nowy szablon".
2. Wypełnij: Nazwa (min. 3 znaki), Opis, Kategoria. Kliknij „Utwórz".
3. **Asercja Network:** `POST /api/interview/templates` z body `{name, description, category}`; odpowiedź 201 z `{id, status:'draft'}`.
4. Sprawdź, że nowy szablon pojawia się na liście ze statusem `draft`.
5. Po reloadzie strony szablon nadal istnieje → **[DB]** tabela `interview_templates`.

**Happy path:** ✅ szablon stworzony, widoczny na liście, trwały.

**Przypadki negatywne:**
- Pusty formularz → przycisk „Utwórz" disabled lub walidacja blokuje wysyłkę (brak żądania sieciowego).
- Nazwa za krótka (<3 znaki) → komunikat błędu inline, brak POST.
- Duplikat nazwy → jeśli backend zwraca 409 — sprawdź czy toast informuje użytkownika.

**Rola [FLAG]:** konto bez `INTERVIEW_TEMPLATE_MANAGE` → przycisk „Nowy szablon" niewidoczny lub disabled; próba POST → 403.

### 1.2 Typy pytań

W `TemplateBuilder` dodaj po jednym pytaniu każdego typu i zweryfikuj, że:
- `POST /api/interview/templates/:id/questions` z prawidłowym `questionType` w payload.
- Pytanie pojawia się na liście z właściwą ikoną/oznaczeniem.
- Pole odpowiedzi w trybie sesji renderuje właściwy komponent (tekst / radio / suwak / checkbox).

| Typ | `questionType` | Komponent odpowiedzi |
|---|---|---|
| Otwarte | `open` | `<textarea>` |
| Zamknięte (tak/nie) | `closed` | radio tak/nie |
| Skala (1-5) | `scale` | suwak lub radio 1-5 |
| Wielokrotny wybór | `multiple_choice` | checkboxy z opcjami |

**Edge case:** pytanie bez treści → blok zapisu + komunikat błędu.

### 1.3 Kolejność pytań (drag & drop) [MANUAL]

1. Stwórz ≥3 pytania w szablonie.
2. Chwyć drugie pytanie za uchwyt drag i przeciągnij je na pierwsze miejsce.
3. **Asercja:** pytania zmieniły kolejność w UI.
4. **Network:** `PATCH /api/interview/templates/:id/questions/:questionId` (lub endpoint bulk-reorder) z nową wartością `order`/`position`.
5. Po reloadzie: kolejność zachowana → **[DB]**.

### 1.4 Publish szablonu (draft → approved)

1. Otwórz szkic szablonu → przycisk „Opublikuj" (wymaga `INTERVIEW_TEMPLATE_MANAGE`).
2. **Network:** `PATCH /api/interview/templates/:id` z `{status: 'approved'}` (lub `POST /templates/:id/...`); odpowiedź 200.
3. Lista: status zmieniony na `approved` / badge zmienił kolor.
4. **Negatywny:** publikacja szablonu bez żadnych pytań → komunikat błędu (szablon bez pytań nie powinien być publikowany).

### 1.5 Wersjonowanie i klon szablonu

1. Klonuj opublikowany szablon → `POST /api/interview/templates/:id/clone`.
2. Klon pojawia się ze statusem `draft` i zmienioną nazwą (np. „Kopia: ...").
3. Edytuj klon — oryginał niezmodyfikowany (izolacja wersji).

### 1.6 Archiwizacja i przywrócenie szablonu

1. Archiwizuj opublikowany szablon → `POST /api/interview/templates/:id/archive` → status `archived`.
2. Szablon znika z listy aktywnych (lub jest w zakładce „Archiwum").
3. Przywróć → `POST /api/interview/templates/:id/restore` → status powraca do `draft`.
4. **Negatywny:** usuń szablon powiązany z aktywnym przypisaniem → backend powinien zwrócić błąd (409 lub 400), nie usuwać; sprawdź toast.

### 1.7 Ustawienie szablonu domyślnego dla org

1. `POST /api/interview/templates/:id/default` → szablon oznaczony jako default.
2. Tylko jeden szablon może być domyślny dla org — ustawienie innego kasuje poprzedni.
3. **[DB]:** kolumna `is_default` w `interview_templates`.

### 1.8 Import szablonu z TXT/PDF [MANUAL]

1. Przycisk „Import źródła" → `POST /api/interview/templates/import-source` (multipart/form-data, pole `file`).
2. Prześlij plik TXT z pytaniami w liniach.
3. **Asercja:** AI buduje listę pytań w `TemplateBuilder` (podgląd przed zapisem).
4. **Edge:** plik binarny (np. `.exe`) → błąd walidacji, brak crash.

### 1.9 Ocena jakości szablonu (AI evaluate) [FLAG]

1. Kliknij „Oceń jakość" → `POST /api/interview/templates/evaluate-quality` z pytaniami.
2. Odpowiedź zawiera `scorePerQuestion` i `overallRecommendation`.
3. Wynik widoczny w TemplateBuilder (wskazówki per pytanie).

---

## 2. PRZYPISANIA (ASSIGNMENTS)

### 2.1 Pojedyncze przypisanie (AssignInterviewModal)

**Kroki:**
1. Na liście opublikowanych szablonów → „Przydziel".
2. Wybierz szablon (dropdown/wyszukiwarka), uczestnika, deadline.
3. Kliknij „Przydziel" → `POST /api/interview/assignments` (wymaga `INTERVIEW_ASSIGN_MANAGE`).
4. **Payload:** `{templateId, assigneeUserId, dueAt, priority}`.
5. **Odpowiedź:** 201 z `{id, status:'assigned'}`.
6. **Network M03:** sprawdź, że w ciągu ~2 s pojawia się `POST /api/my-work/tasks` (mirror-task) lub analogiczny → `interviewAssignmentService.create` tworzy mirror-task w M03 Inbox respondenta.
7. Zaloguj się jako respondent → `GET /api/interview/assignments/my` → nowe przypisanie na liście.
8. **[DB]:** tabele `interview_assignments` + `tasks` (mirror).

**Przypadki negatywne:**
- Bez szablonu → walidacja blokuje.
- Deadline w przeszłości → komunikat ostrzegawczy (ale czy blokuje?).
- Konto bez `INTERVIEW_ASSIGN_MANAGE` → 403.
- Przypisanie do użytkownika z innej organizacji → 400/403 (bug naprawiony `7df4b22d6d`; potwierdź że walidacja `org` nadal działa).

### 2.2 Bulk assignment (wiele osób naraz) [FLAG]

1. Zaznacz ≥3 uczestników → `POST /api/interview/assignments` lub dedykowany bulk endpoint.
2. Sprawdź, czy każdy uczestnik dostaje osobne przypisanie (separate rows w DB).
3. Mirror-task per respondent w M03.
4. **[DB]** po reloadzie: N wierszy w `interview_assignments`.

### 2.3 Statusy przypisania — widok managera

Na liście przypisań (zakładka „Przydzielone"):
- Kolumna Status pokazuje aktualny stan (`assigned` / `in_progress` / `submitted` / `sent_back` / `approved` / `completed`).
- Filtrowanie po statusie działa (Network: `GET /api/interview/assignments?status=submitted`).
- Badge statusu używa tokenów `c.*` / `EntityStatusChip` — **nie** hardkodowanego `rose-*` (bug L-04, `InterviewHub.tsx:4772`; sprawdź 21 wystąpień).

### 2.4 Deadline i priorytety

1. Edytuj deadline przypisania → `PATCH /api/interview/assignments/:id` z `{dueAt}`.
2. Zmień priorytet → `PATCH` z `{priority}`.
3. **Network + [DB]:** zmiany trwałe po reloadzie.

### 2.5 Wysyłanie przypomnienia

1. Przypisanie ze statusem `assigned` lub `in_progress` → przycisk „Przypomnij".
2. `POST /api/interview/assignments/:id/remind` (wymaga `INTERVIEW_REMIND`).
3. Toast potwierdzający wysłanie.
4. **Negatywny:** przypisanie `completed` — przycisk powinien być disabled lub niewidoczny.

### 2.6 Eskalacja i archiwizacja przypisania

1. **Eskalacja:** `POST /api/interview/assignments/:id/escalate` → zmiana priorytetu + powiadomienie.
2. **Archiwizacja:** `POST /api/interview/assignments/:id/archive` → znika z aktywnej listy.
3. **Przywrócenie:** `POST /api/interview/assignments/:id/restore`.
4. **Usunięcie:** `DELETE /api/interview/assignments/:id` — **tylko jeśli status = `assigned`** (nie started); inne statusy → 409.

---

## 3. SESJA — TRYB KLASYCZNY (single_question i task_list)

### 3.1 Uruchomienie sesji z przypisania

**Kroki (jako respondent):**
1. Zaloguj się jako respondent → `/discovery` → zakładka „Przydzielone" → kliknij przypisanie.
2. Przycisk „Zacznij wywiad" lub „Wznów".
3. `POST /api/interview/assignments/:id/start` → przypisanie zmienia status `assigned → in_progress`.
4. Wybór trybu runtime (`RuntimeModeSelector`) — domyślny tryb zależy od `session.runtimeModeDefault` lub `session.assignmentId` (dla przypisań default = `single_question`).
5. Pojawia się pierwsze pytanie / lista pytań.

### 3.2 Tryb `single_question` — nawigacja i autosave

1. Pierwsze pytanie widoczne na pełnym ekranie.
2. Wpisz odpowiedź.
3. **Autosave:** po zmianie odpowiedzi → `PATCH /api/interview/questions/:questionId` z `{answer, status:'in_progress'}` wyzwalany bez kliknięcia „Zapisz" (debounce ≥500 ms).
4. Nawigacja „Następne" → przejście do kolejnego pytania; „Poprzednie" → cofnięcie; pasek postępu aktualizuje się.
5. Przeładuj stronę → stan (aktualne pytanie + odpowiedzi) odtworzony z DB (nie z pamięci lokalnej). **[DB]:** tabela `interview_questions`, kolumna `answer`.

**Negatywne:**
- Wymagane pytanie bez odpowiedzi → „Następne" zablokowane lub toast ostrzegawczy.
- Wyjście ze strony w trakcie sesji → toast/dialog „Masz niezapisane zmiany".

### 3.3 Tryb `task_list` — lista wszystkich pytań

1. Przełącz RuntimeModeSelector na `task_list`.
2. Wszystkie pytania widoczne naraz z polami odpowiedzi.
3. **Autosave per pytanie** (tak samo jak 3.2).
4. Pasek postępu pokazuje `x/N pytań wypełnionych`.

### 3.4 Edycja odpowiedzi w trakcie sesji

1. Wróć do pytania z już wpisaną odpowiedzią i zmień treść.
2. **KRYTYCZNY test regresji N-1 (edit-clobber z M01):** upewnij się, że edycja pytania 2 NIE nadpisuje pytania 1. To znaczy: `PATCH /api/interview/questions/:questionId` musi zawierać właściwy `questionId` (nie ID poprzedniego).
3. Po edycji: reloaduj → obie odpowiedzi trwałe, każda w swoim wierszu DB.

### 3.5 Zakończenie sesji (Submit)

**Kroki:**
1. Wypełnij wszystkie pytania → kliknij „Wyślij" / „Zakończ".
2. **Pre-submit gate:** `POST /api/interview/sessions/:sessionId/evaluate-answers` (lub wewnętrzne wywołanie) → AI ocenia odpowiedzi → `ai_review_snapshot_json` zapisany.
3. `POST /api/interview/assignments/:id/submit` → status `in_progress → submitted`.
4. **Payload submit:** `{sessionId}`.
5. **Toast:** „Wywiad wysłany".
6. **[DB]:** `interview_assignments.status = 'submitted'`; `interview_assignments.submittedAt` ustawiony; `ai_review_snapshot_json` nie-null.
7. Reloaduj stronę → przypisanie nadal ze statusem `submitted`, odpowiedzi trwałe.

**Edge case — bramka twardego bloku (SPEC_ZADANIE_13 §5.1):**
- Gdy `overallVerdict === 'insufficient' || 'empty'` lub pytania wymagane bez odpowiedzi → submit ZABLOKOWANY (modal z listą braków, **bez przycisku „Wyślij mimo to"** dla przypadku `insufficient`/`empty`).
- Gdy `overallVerdict === 'needs_improvement'` → ostrzeżenie z `weakAnswerMap`, ale submit możliwy.
- **[FLAG]:** weryfikuj, czy ten mechanizm jest już wdrożony (luka L-07 — decyzje ZATWIERDZONE, ale implementacja otwarta); odnotuj aktualny stan.

### 3.6 Przerwanie i wznowienie sesji

1. W trakcie sesji zamknij kartę przeglądarki.
2. Otwórz ponownie `/discovery` → zakładka „Przydzielone".
3. Przypisanie nadal ze statusem `in_progress`, przycisk „Wznów".
4. Po wznowieniu: poprzednie odpowiedzi zachowane, pytanie tam gdzie przerwałeś (jeśli `single_question` — zakładany checkpoint).

---

## 4. SESJA — TRYB KONWERSACYJNY (ConversationalPanel) [FLAG]

### 4.1 Uruchomienie trybu konwersacyjnego

1. W `RuntimeModeSelector` wybierz `conversational`.
2. Pojawia się `ConversationalPanel` z interfejsem rozmowy.
3. Wpisz swobodną odpowiedź obejmującą kilka pytań z szablonu (np. „Mój największy problem to X, pracuję w zespole Y osób, oceniam procesy na 3 z 5").

### 4.2 AI parse transkryptu

1. Po zakończeniu rozmowy → kliknij „Analizuj" / „Wyodrębnij odpowiedzi".
2. **Network:** `POST /api/interview/sessions/:sessionId/ai-parse` z `{transcript}`.
3. **Payload odpowiedzi:** lista `{questionId, extractedAnswer, confidence}`.
4. UI pokazuje mapowanie: pytanie → wyodrębniona odpowiedź + poziom pewności.
5. **[DB]:** po zatwierdzeniu odpowiedzi zapisywane do `interview_questions.answer`.

### 4.3 Walidacja parsowania i edycja wyniku

1. Sprawdź, że każde pytanie z szablonu jest mapowane (lub oznaczone jako „brak odpowiedzi").
2. Edytuj wyodrębnioną odpowiedź przed zatwierdzeniem — zmiana powinna być możliwa inline.
3. Po zatwierdzeniu edycji → `PATCH /api/interview/questions/:questionId` z nową treścią.

### 4.4 Przypadki graniczne parsowania

- **Brak odpowiedzi na część pytań** → pytania bez mapowania oznaczone `not_answered`; wywiad można kontynuować (uzupełnić ręcznie).
- **Niejednoznaczna odpowiedź** (pasuje do kilku pytań) → UI pokazuje „confidence" i pozwala wybrać prawidłowe mapowanie.
- **Transkrypt w innym języku** niż język szablonu → system powinien rozumieć lub zwrócić ostrzeżenie.
- **Pusty transkrypt** → błąd walidacji przed wywołaniem API.

### 4.5 Transcript — zapis i przeglądanie

1. `POST /api/interview/sessions/:sessionId/transcript` — każda wiadomość konwersacji.
2. `GET /api/interview/sessions/:sessionId/transcript` — historia rozmowy.
3. Reload → transkrypt widoczny w ConversationalPanel.

---

## 5. SESJA — TRYB GŁOSOWY (STT) [MANUAL] [FLAG]

> **P0 PROD:** Bug #12 (VTS wave 2 ~131 osób) — tekst widoczny na ekranie nie był zapisywany. Fix interim-flush wdrożony na Londyn (`InterviewSingleQuestionRuntime.tsx`, NIEZACOMMITOWANY w momencie pisania — weryfikuj `git status M`). Weryfikacja tego scenariusza jest KRYTYCZNA.

### 5.1 Uruchomienie nagrywania

1. W `InterviewSingleQuestionRuntime` → kliknij ikonę mikrofonu (przycisk „Nagraj").
2. Przeglądarka pyta o dostęp do mikrofonu → akceptuj.
3. Przycisk zmienia stan na „Nagrywam..." / pulsująca czerwona ikona.
4. Mów przez ≥5 sekund: „Moja odpowiedź to: testujemy poprawkę głosową VTS."

### 5.2 Transkrypcja live (interim)

1. Podczas mówienia: tekst interim pojawia się na ekranie (blado / kursywą).
2. Po każdym zdaniu: `liveInterimRef` aktualizuje się w tle.
3. Tekst widoczny na ekranie musi ZAWIERAĆ zarówno finalne jak i interim fragmenty.

### 5.3 KRYTYCZNY P0 — zapis transkrypcji do DB [DB]

**Procedura weryfikacji (PRZED i PO fix interim-flush):**

**Krok 1 — weryfikacja stanu fixa:**
```
git status src/components/Interview/InterviewSingleQuestionRuntime.tsx
```
Powinno być: plik NIEMODYFIKOWANY (M → zacommitowany) lub sprawdź `git log` czy commit z `liveInterimRef` jest na gałęzi.

**Krok 2 — test:**
1. Nagraj odpowiedź głosową (~10 sekund).
2. Kliknij „Stop".
3. **Obserwuj Network:** `POST /api/voice/stt` (FormData z polem `audio` + `language`) → oczekiwana odpowiedź 200 z `{text: "..."}`.
4. Jeśli `/voice/stt` zwraca błąd (503/500 — brak klucza OPENAI na staging) → sprawdź czy **browser fallback działa:** `browserTranscript = liveTranscriptRef.current + liveInterimRef.current` musi być nie-pusty i wstawiony do pola odpowiedzi.
5. **Network:** `PATCH /api/interview/questions/:questionId` z `{answer: "<tekst>", answerMode:'voice_answer', voiceTranscript:"<tekst>", voiceTranscriptStatus:'approved'}`.
6. Toast: „Transkrypcja dodana" (ewentualnie: „Transkrypcja dodana (przeglądarka)" gdy server STT niedostępny).
7. **[DB]:** tabela `interview_questions` → `answer` = transkrypcja; `voice_transcript` = transkrypcja; `answer_mode = 'voice_answer'`.
8. Przeładuj stronę → odpowiedź nadal widoczna i zgodna z tym co nagrano.

**Asercja kluczowa:** tekst widoczny na ekranie PRZED kliknięciem Stop == tekst w DB PO reloadzie.

**Scenariusz awaryjny — server STT niedostępny:**
- `POST /api/voice/stt` zwraca 503 (brak `OPENAI_API_KEY`).
- **Oczekiwane:** catch block używa `browserTranscript` z `liveInterimRef` → `insertIntoAnswer(browserTranscript)` → `PATCH questions/:id` z browserTranscript → toast „Transkrypcja dodana (przeglądarka)".
- **Niedopuszczalne (stary bug):** toast „Nie udało się przetworzyć nagrania" + brak zapisu.

### 5.4 Server STT — weryfikacja provider [FLAG]

1. `GET /api/public/anna/voice-config` (lub sprawdź logi) → weryfikuj, że `VoiceService` wybiera OPENAI (`whisper-1`) gdy `OPENAI_API_KEY` ustawiony.
2. **Network:** request do `/api/voice/stt` → nagłówek/ciało nie ujawnia klucza; odpowiedź zawiera `{text: "..."}` lub `{error: "No STT provider available"}`.
3. Jeśli na staging/dev brak `OPENAI_API_KEY` → oczekiwany fallback GROQ lub błąd 503 z browser-fallback; odnotuj stan.

### 5.5 Błąd mikrofonu i przerwanie nagrywania [MANUAL]

- **Odmowa dostępu do mikrofonu:** kliknij „Nagraj", odmów w przeglądarce → toast błędu (np. „Brak dostępu do mikrofonu"), brak crash, brak żądań do backendu.
- **Przerwa w nagraniu** (np. odłącz mikrofon w trakcie) → `recorder.onerror` lub `MediaStream.onended` → toast błędu + sesja nie jest zepsuta (można kontynuować ręcznie).
- **Brak Web Speech API** (Firefox lub starsza przeglądarka) → ikona głosu disabled lub komunikat „Nagrywanie głosowe niedostępne"; server STT (OPENAI/Whisper) nadal dostępny jako alternatywa.

---

## 6. WNIOSKI / INSIGHTY (InsightViewer)

### 6.1 Generowanie wniosków (inference)

**Kroki (jako manager z `INTERVIEW_INSIGHTS_CREATE`):**
1. Po approve ≥1 przypisania → zakładka „Wnioski" → „Generuj wnioski".
2. `POST /api/interview/insights` z `{sessionIds: [...], language}`.
3. Stan ładowania: spinner / pasek postępu generacji.
4. Po zakończeniu: `GET /api/interview/insights/:id` → `{status:'completed', themes:[], issues:[], opportunities:[], signals:[], materialQuality:{...}}`.
5. Kliknij na wniosek → otwiera `InsightViewer` (2-panel: lista wniosków po lewej, detal po prawej).

### 6.2 KRYTYCZNY P0/P1 — material_quality_json guard [DB]

> Bug: InsightViewer crashuje (biały ekran) przy partial/null/malformed `material_quality_json`. Guard wdrożony w `InsightViewer.tsx:1551-1592` (funkcja `toArr`, normalizacja pól).

**Test ze wszystkimi trzema przypadkami:**

**Przypadek A — `material_quality_json = null` (wniosek bez quality):**
1. Utwórz wniosek testowy bezpośrednio w DB z `material_quality_json = NULL`.
2. Otwórz ten wniosek w InsightViewer.
3. **Asercja:** strona NIE crashuje; panel quality NIE renderuje się (lub pokazuje komunikat „Brak danych jakościowych").
4. **Sprawdź kod:** `InsightViewer.tsx:1594` — zwraca `null` gdy `!insight || insight.status === 'generating'` → panel quality pomijany.

**Przypadek B — `material_quality_json = {}` (pusty obiekt / partial):**
1. Utwórz wniosek z `material_quality_json = '{}'` (pusty JSONB).
2. Otwórz InsightViewer.
3. **Asercja:** guard `toArr(v)` zwraca `[]` dla brakujących pól; `overall_material_score` → `0`; `answer_quality_posture` → `'usable'` (fallback); strona NIE crashuje, pola pokazują wartości domyślne.

**Przypadek C — `material_quality_json` ze starym schematem (alt keys `score`/`posture`/`coverage`):**
1. Utwórz wniosek z `material_quality_json = '{"score": 3.5, "posture": "good", "coverage": "full_coverage"}'`.
2. InsightViewer: guard `InsightViewer.tsx:1570-1591` mapuje `alt.score * 20 → overall_material_score`; `alt.posture → answer_quality_posture`; `alt.coverage → coverage_posture`.
3. **Asercja:** strona nie crashuje; `overall_material_score = 70` (3.5 × 20); wartości widoczne w panelu quality.

### 6.3 Widoki i filtrowanie wniosków

1. **Lista wniosków** — tabela z kolumnami: Tytuł, Status, Data, Score; filtrowanie po statusie działa.
2. **Widok grouped** — tematy (themes) pogrupowane; kliknij temat → rozwinięcie powiązanych issues/opportunities.
3. **Filtrowanie:** filtruj po temacie (keyword) → lista odświeżona (lokalne lub `GET /api/interview/insights?search=...`).
4. **Filtr po statusie:** `draft` / `review` / `approved` / `published` → właściwe wiersze.

### 6.4 Insighty — edycja inline

1. W `InsightViewer` → kliknij na tytuł tematu / treść wniosku → pole staje się edytowalne.
2. Zmień treść → `PATCH /api/interview/insights/:id` lub endpoint per-section.
3. **[DB]:** zmiana trwała po reloadzie.
4. **Negatywny:** konto bez `INTERVIEW_INSIGHTS_REVIEW` → pole NIE jest edytowalne (readonly).

### 6.5 Zatwierdzanie wniosków (approval flow — SPEC_ZADANIE_13) [FLAG]

**Weryfikuj aktualny stan implementacji:**

1. Zmień status wniosku: `draft → review` → `approved` → `published`.
2. Każda zmiana: `PATCH /api/interview/insights/:id` z `{status: 'approved'}` (wymaga `INTERVIEW_INSIGHTS_REVIEW`).
3. **Komentarze:** `POST /api/interview/insights/:id/comments` z `{body}`.
4. `GET /api/interview/insights/:id/activity` → log aktywności (zmiany statusu, komentarze).
5. **[DB]:** `interview_insights.status`, `interview_insights_comments` tabela.

**Werdykt (odnotuj):** czy przyciski approve/send-back dla managera (SPEC_ZADANIE_13 §4b „Zatwierdź / Wyślij-do-poprawy") są widoczne i działają? — to luka L-07; odnotuj stan faktyczny.

### 6.6 AI-synthesis — generowanie syntezy z wniosków

1. Zaznacz ≥2 wnioski → „Generuj syntezę" / „AI Summary".
2. `POST /api/interview/sessions/:sessionId/summary` z `{insightIds: [...]}`.
3. Stan ładowania → wynikowy tekst syntezy wyświetlony w sidepanelu lub nowym widoku.
4. Zapisz syntezę → `GET /api/interview/sessions/:sessionId/summary` zwraca zapisany tekst.

### 6.7 Eksport wniosku do M11 / M17

1. Na wniosku → menu „Eksportuj do Narzędzi" / „Eksportuj do Outputs".
2. `POST /api/interview/insights/:id/export` (wymaga `INTERVIEW_INSIGHTS_HANDOFF`) z `{target: 'tools' | 'assessment'}`.
3. Sprawdź w M11 lub M17, że powiązany artefakt pojawił się.

### 6.8 Komentarze do wniosku

1. `POST /api/interview/insights/:id/comments` z `{body}`.
2. Komentarz widoczny w widoku wniosku.
3. `DELETE /api/interview/insights/:id/comments/:commentId` → komentarz usunięty.
4. **[DB]:** po reloadzie komentarze trwałe.

---

## 7. GENEROWANIE INICJATYW (generate_from_evidence)

### 7.1 Uruchomienie generowania inicjatywy z wniosku

**Kroki:**
1. W `InsightViewer` → na konkretnym findings (issue/opportunity) → przycisk „Utwórz inicjatywę z finding".
2. Pojawia się modal / panel inicjatywy z trybem `generate_from_evidence` (`InsightViewer.tsx:8177`, `InterviewHub.tsx:13041`).
3. **Network:** `POST /api/interview/insights/:id/export` lub endpoint inicjatyw z `{mode: 'generate_from_evidence', insightId, findingId}`.
4. Spinner / ładowanie → pojawia się karta inicjatywy wypełniona przez AI.
5. **Asercja payload:** karta inicjatywy zawiera WSZYSTKIE sekcje wg `CARD_CONTENT_FORMULA.md`: tytuł, opis, cel, timeline, KPIs, RAID (risk/assumptions/issues/dependencies), odpowiedzialni.

### 7.2 Akceptacja propozycji inicjatywy

1. Przejrzyj wygenerowaną kartę inicjatywy.
2. Kliknij „Zatwierdź" / „Utwórz inicjatywę".
3. `POST /api/v8/interview/insights/:id/...` lub endpoint M13 → nowa inicjatywa zapisana.
4. **[DB]:** tabela `initiatives` — nowy wiersz z `source_interview_insight_id` (lub podobne pole).
5. **Nawigacja:** po akceptacji → CTA / redirect do `/initiatives/:id` (M13).
6. Sprawdź w M13 (`/initiatives`), że inicjatywa pojawia się z odpowiednim statusem.

### 7.3 Edycja propozycji przed akceptacją

1. W panelu propozycji zmień tytuł inicjatywy.
2. Zmiana widoczna natychmiast (lokalna).
3. Po akceptacji: inicjatywa zapisana z edytowanym tytułem (nie AI-generowanym).

### 7.4 Odrzucenie propozycji

1. Kliknij „Anuluj" / „Odrzuć".
2. Panel znika, brak zapisu do DB (brak POST do inicjatyw).
3. Wróć do InsightViewer — finding nadal dostępny do ponownego generate.

### 7.5 Powiązanie z istniejącą inicjatywą

1. Na finding → „Powiąż z istniejącą inicjatywą" (`InsightViewer.tsx:8238`).
2. Dropdown z listą inicjatyw z M13 (`GET /api/v8/interview/insights?... `lub endpoint M13).
3. Wybierz inicjatywę → `POST /api/interview/sessions/:sessionId/linked-items` (lub endpoint wniosków) z `{target_initiative_id}`.
4. **[DB]:** relacja finding ↔ inicjatywa zapisana; w M13 widoczne powiązane wnioski.

---

## 8. BRAMKA OCENY AI + CZŁOWIEK (approve / send-back) [FLAG]

> Weryfikacja implementacji SPEC_ZADANIE_13. Część maszynerii istnieje (~70%), część luk L-07 otwarta.

### 8.1 AI-ocena po submit (manager widzi score)

**Kroki (jako manager z `INTERVIEW_ASSIGN_MANAGE`):**
1. Po submit respondenta → otwórz przypisanie w zakładce „Przydzielone".
2. Sprawdź, czy widoczny jest **score + verdict** z `ai_review_snapshot_json`:
   - `overallScore` (np. 3.8/5.0) — **[FLAG]:** czy pole jest persystowane i wyświetlane? (luka L-07 — placeholder `InterviewHub.tsx:8073`).
   - `overallVerdict` (`ready_for_approval` / `needs_improvement` / `insufficient` / `empty`).
   - `recommendations` — lista sugestii AI dla managera.
3. **[DB]:** `interview_assignments.ai_review_snapshot_json` — sprawdź przez reload/query.

### 8.2 Zatwierdzenie przypisania (approve)

1. Manager widzi submitted przypisanie z completeness ≥50%.
2. Kliknij „Zatwierdź" → `POST /api/interview/assignments/:id/approve` (wymaga `INTERVIEW_ASSIGN_MANAGE`).
3. Status: `submitted → approved`.
4. **Twarda bramka:** jeśli completeness <50% → 409, toast błędu; przycisk „Zatwierdź" powinien być disabled lub zwracać błąd serwera.
5. **[DB]:** `interview_assignments.status = 'approved'`; `session.status = 'completed'`.

### 8.3 Odesłanie do uzupełnienia (send-back)

1. Manager widzi submitted przypisanie z `needs_improvement` / niewystarczającą jakością.
2. Kliknij „Wyślij do poprawy" → `POST /api/interview/assignments/:id/send-back` z `{reason: "Proszę uzupełnić pytania 2 i 4", missingItems: [...]}`.
3. Status: `submitted → in_progress`.
4. **[DB]:** `interview_assignments.status = 'in_progress'`; `sentBackReason` ustawiony; `missingItems` (z `weakAnswerMap`) zapisane.
5. Respondent widzi powiadomienie o odesłaniu + listę braków.

### 8.4 review_decision_memory_json (audyt decyzji)

1. Po approve / send-back → sprawdź, że `review_decision_memory_json` zapisany (`InterviewController.ts:818,828`).
2. **[DB]:** pole zawiera `{aiVerdict, humanDecision, timestamp, reasoning}` (alignment AI↔człowiek).
3. Rozbieżność: AI mówi `ready_for_approval`, manager odsyła → rozbieżność zapisana w `review_decision_memory_json`.

---

## 9. ŚCIEŻKI CROSS-MODULE (KLUCZOWE)

### 9.1 GŁÓWNA ŚCIEŻKA E2E: Szablon → Sesja → Wnioski → Inicjatywy (M13) → Wdrożenie (M14)

**Pełny przebieg (jeden test, ~45 minut):**

| Krok | Akcja | Endpoint | Dowód |
|---|---|---|---|
| 1 | Stwórz szablon z 5 pytaniami → publish | `POST /api/interview/templates` + `PATCH .../status:approved` | `interview_templates.status = 'approved'` |
| 2 | Przydziel do respondenta | `POST /api/interview/assignments` | `interview_assignments` + mirror `tasks` |
| 3 | Respondent: start → odpowiedz (tryb single_question) → submit | `POST .../start` + `PATCH .../questions` + `POST .../submit` | `status = 'submitted'`, `ai_review_snapshot_json` |
| 4 | Manager: approve | `POST .../approve` | `status = 'approved'` |
| 5 | Generuj wnioski (inference) | `POST /api/interview/insights` | `interview_insights` row |
| 6 | Utwórz inicjatywę z wniosku | `InsightViewer → generate_from_evidence` | `initiatives` row, `source_insight_id` |
| 7 | Przejdź do M13 Inicjatywy → potwierdź inicjatywę | `/initiatives/:id` | inicjatywa widoczna z treścią |
| 8 | Przejdź do M14 Wdrożenie | `/implementation` (jeśli inicjatywa pushuje do M14) | zależność M13→M14 |

### 9.2 Wywiad → Czat Teresa (dyskusja wniosków)

1. Z `InsightViewer` → otwórz czat Teresa z kontekstem wniosku.
2. Zapytaj Teresę o rekomendacje dot. wniosku.
3. **Asercja:** Teresa odpowiada z uwzględnieniem treści wniosku (kontekst przekazany przez system prompt).
4. **Network:** `POST /api/chat/...` zawiera w `context` lub `systemPrompt` dane z wniosku.

### 9.3 Wywiad → M03 My Work (powiadomienia o przypisaniu)

1. Przydziel wywiad do użytkownika.
2. **Zaloguj się jako ten użytkownik** → `/my-work/inbox`.
3. Nowe powiadomienie o przypisaniu widoczne w Inbox (mirror-task).
4. Kliknij powiadomienie → deep-link do przypisania w M10.
5. `GET /api/my-work/inbox` → nowy wpis z `type = 'interview_assigned'`.

### 9.4 Wywiad → Admin (zarządzanie szablonami organizacji)

1. Jako superadmin → `/admin` → sprawdź, czy panel zarządzania szablonami M10 dostępny.
2. (Jeśli `InterviewAssignmentsPanel` z Admin/ jest żywym kodem — weryfikuj; jeśli dead code — odnotuj).

### 9.5 M12 Audyty → Wywiad (fan-out sesji)

1. W M12 Audyty → tworzenie ankiety diagnostycznej.
2. **Asercja:** M12 używa `interviewAssignmentService.create` (współdzielony serwis; fix `7df4b22d6d` — walidacja org assignee).
3. Sprawdź, że sesja wywiadowa stworzona przez M12 jest widoczna w M10 → zakładka „Przydzielone".

---

## 10. MAPA EPIKÓW → WERYFIKACJA

| Epik | Opis | Sekcja testu | Status luki |
|---|---|---|---|
| E1: Głos PROD P0 (#12) | FE interim-flush + server STT OPENAI | §5 cały | FE-fix na Londyn (niezacommitowany → verify `git status`); env DP-1 do potwierdzenia |
| E2: Integralność (DONE) | cross-org get/delete wniosku | §6 + §8 (test cross-org) | NAPRAWIONE `b9f2dee9d2` — **potwierdź testem** |
| E3: Flow + bramka (#13) | score, approve/send-back, pipeline ①–⑥ | §8 cały + §3.5 (submit gate) | L-07 otwarta; decyzje ZATWIERDZONE |
| E4: Testy automatyczne | 9 FAIL → 0, E2E PR-gate | §regresja | otwarta |
| E5: Szlif kanonu | rose, persistKey, i18n, table | §11.3 (kanon) | otwarta |
| E6: Stepper 4-krok | stepper / pending_review | §11.1 | D-03/D-04 otwarte |

---

## 11. WERYFIKACJA ZNANYCH BUGÓW (aiOperatorService + luki)

### 11.1 Bug L-09: Stepper 4-krokowy niezbudowany

1. Wejdź na `/discovery` → sprawdź, czy istnieje wizualny stepper: `① Szablony → ② Przydział → ③ Wypełnienie → ④ Dopuszczenie → ⑤ Wnioski → ⑥ Inicjatywy`.
2. Sprawdź `InterviewHub.tsx:2631,2688` — czy kod steppera jest renderowany.
3. **Oczekiwane (D-03 otwarte):** stepper prawdopodobnie NIEWIDOCZNY (redesign 2026-06-06 niezbudowany). Odnotuj stan.

### 11.2 Bug L-04: Korupcja „rose" w status-chipach

1. Otwórz zakładkę „Przydzielone" i „Sesje" → status-chipy.
2. Otwórz DevTools → Inspect na chipie statusu.
3. Sprawdź klasy CSS: czy zawierają `rose-*` (np. `text-rose-600`, `bg-rose-100`) zamiast tokenów `c.*` / `EntityStatusChip`.
4. `grep -n "rose-" src/components/Interview/InterviewHub.tsx | head -30` — powinno znaleźć 21 wystąpień (luka L-04).
5. **Oczekiwane (otwarta):** `rose-*` widoczne — odnotuj jako P1 FAIL.

### 11.3 Bug L-05: Brak persistKey + i18n inline

1. W zakładce „Sesje" → posortuj według kolumny „Data" → zmień szerokość kolumny → przeładuj stronę.
2. **Asercja:** po reloadzie kolejność sortowania i szerokość kolumny **nie** są zachowane → brak `persistKey`.
3. Sprawdź aktualny język PL → szukaj fragmentów UI po angielsku (hardkodowane fallbacki) → luka i18n inline (2090 wystąpień wg grep 2026-06-13).

### 11.4 Bug L-06: Surowe `<table>` (RC-5)

1. W DevTools → Elements → szukaj surowych `<table>` w `InterviewHub.tsx`-rendered DOM.
2. `grep -n "<table" src/components/Interview/InterviewHub.tsx | wc -l` → powinno zwrócić 7 (luka L-06, RC-5).
3. Odnotuj jako P2.

### 11.5 Weryfikacja cross-org (SEC-1 / SEC-2 — NAPRAWIONE)

1. Zaloguj się jako użytkownik org-B.
2. Spróbuj `GET /api/interview/insights/<id_z_org-A>` (podmień ID wniosku z innej org).
3. **Oczekiwane (po `b9f2dee9d2`):** 403 lub 404, NIE dane wniosku z innej org.
4. Spróbuj `DELETE /api/interview/insights/<id_z_org-A>`.
5. **Oczekiwane:** 403 lub 404, NIE usunięcie.

---

## 12. TESTY PRZEKROJOWE

### 12.1 Kombinacje trybów runtime

1. Zacznij sesję w trybie `single_question` → wypełnij połowę pytań.
2. Przełącz na `task_list` → sprawdź, że poprzednie odpowiedzi widoczne.
3. Przełącz na `conversational` → dodaj transkrypt → przeparsuj → sprawdź, że nowe odpowiedzi nie nadpisują wcześniejszych pytań z innych trybów (edge case N-1).

### 12.2 Persistencja po reload (sesja w toku)

1. Zacznij sesję → odpowiedz na 3 pytania → zamknij kartę.
2. Otwórz ponownie `/discovery` → wznów sesję.
3. **Asercja:** 3 odpowiedzi zachowane, sesja w stanie `in_progress`, bez duplikatów.

### 12.3 Disabled async — równoległe operacje

1. Kliknij „Generuj wnioski" → w trakcie ładowania próbuj kliknąć ponownie.
2. **Asercja:** przycisk disabled podczas ładowania; brak duplikatów żądań.
3. Kliknij „Submit" w sesji → natychmiast zamknij modal/przejdź → sprawdź stan DB.

### 12.4 i18n PL / EN

1. Przełącz język aplikacji na EN.
2. Przejdź przez `/discovery` → sprawdź, że: zakładki, etykiety, statusy, toasty, komunikaty błędów — wszystko po angielsku.
3. Przełącz z powrotem na PL → sprawdź, że wraca do polskiego.
4. **Szczególnie:** komunikaty w sesji głosowej (`.tsx:957-960`) — dwa warianty PL/EN.
5. Odnotuj przypadki hardkodowanych fallbacków (brak `t()`).

### 12.5 Dark mode

1. Włącz dark mode → przejdź przez wszystkie zakładki M10.
2. Sprawdź czytelność: status-chipy, tabele, InsightViewer, RuntimeModeSelector, TemplateBuilder.
3. Szczególnie: modal AssignInterviewModal — formularz czytelny w dark mode.

### 12.6 A11y — nawigacja klawiaturą

1. Tab przez zakładki InterviewHub → każda osiągalna klawiaturą.
2. W sesji `single_question`: Tab → pole odpowiedzi → Shift+Tab → „Poprzednie" → Enter → nawigacja.
3. Modal „Przydziel wywiad" → Esc zamyka; Tab przez pola formularza w logicznej kolejności.
4. `InsightViewer` → klawiszem Enter/Space na finding → otwiera detal.
5. Sprawdź `role="dialog"` na modalach, `aria-label` na ikonkach akcji.

### 12.7 Cykl VTS: import uczestników → masowa sesja → synteza → inicjatywy

1. Jeśli dostępna org VTS na staging:
   - Zaloguj się jako admin VTS.
   - Sprawdź, że szablony VTS są opublikowane i przypisania dla ~5 uczestników testowych istnieją.
   - Przejdź przez 1 pełną sesję jako respondent VTS.
   - Approve jako manager → generuj wnioski → generuj inicjatywę.
2. Sprawdź, że cały cykl działa dla polskiego klienta (PL, dark mode, mobilna szerokość okna).

---

## 13. TESTY REGRESJI / JEDNOSTKOWE

### 13.1 Istniejące testy smoke (uruchom przed deployem)

```bash
cd /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify
npx vitest run src/components/Interview/__tests__/InterviewHub.smoke.test.tsx
npx vitest run src/components/Interview/__tests__/TemplateBuilder.smoke.test.tsx
```

**Oczekiwane:** PASS (jeśli FAIL — zidentyfikuj czy to drift testów z listy 9 FAILów czy nowa regresja).

### 13.2 Weryfikacja 9 znanych FAILów (L-02)

Uruchom pełny suite M10:
```bash
npx vitest run --reporter=verbose src/components/Interview/ server/src/
```

Znane 9 FAILów (drift, nie funkcjonalne):
- `InterviewHub` — `__private__` undefined.
- `interview-barrel-exports` — `ManageAssignmentModal` brak eksportu.
- `DiscoveryConsultantView` — stale i18n.
- `InsightViewer` — badge.
- `InsightCreatorModal` × 3.
- `PATCH /api/v8/interview/insights/:id` 404 (MOCK_DB) × 2.

**Asercja:** wszystkie 9 FAILów to WYŁĄCZNIE znane drifty, bez nowych regresji.

### 13.3 Weryfikacja commit FE interim-flush

```bash
git log --oneline src/components/Interview/InterviewSingleQuestionRuntime.tsx | head -5
git diff HEAD~1 HEAD -- src/components/Interview/InterviewSingleQuestionRuntime.tsx | grep "liveInterimRef\|interim" | head -10
```

Sprawdź, że `liveInterimRef` (`:268`) i merge przy Stop (`liveInterimRef.current`, `:914`) są obecne w najnowszym commicie.

---

## 14. FORMAT RAPORTU + DEFINITION OF DONE

### Format raportu (dla każdej sekcji)

| Pole | Opis |
|---|---|
| **Kroki** | wykonane kroki (1, 2, 3...) |
| **Oczekiwane** | co powinno nastąpić |
| **Faktyczne** | co faktycznie nastąpiło |
| **Status** | `PASS` / `FAIL` / `SKIP` (z powodem) / `OTWARTE` (znana luka) |
| **Dowód** | screenshot UI + zrzut z Network (endpoint + payload + status) + [DB] wiersz/kolumna |
| **Dla FAIL** | `plik:linia`, opis przyczyny, propozycja fixa |

### Definition of Done (M10 Wywiad)

| # | Kryterium | Miara |
|---|---|---|
| 1 | Głos STT (P0 #12) | głos→submit→reload→trwałość 100%: text w polu == text w DB; browser-fallback działa gdy server STT niedostępny |
| 2 | InsightViewer guard | null/partial/malformed material_quality_json NIE crashuje (biały ekran = FAIL) |
| 3 | Submit gate (SPEC_13) | `insufficient`/`empty` verdict → submit zablokowany BEZ „Wyślij mimo to" |
| 4 | Approve / send-back | oba przyciski widoczne dla managera; completeness <50% → 409 |
| 5 | Pełna ścieżka E2E | szablon→przypisanie→sesja→approve→wnioski→inicjatywa → każdy krok PASS |
| 6 | Cross-org security | org-B nie czyta/nie kasuje wniosku org-A → 403/404 |
| 7 | Brak nowych błędów w Console | zero nowych błędów poza 9 znanymi FAILami testów |
| 8 | PL + EN | wszystkie komunikaty przetłumaczone w obu językach |
| 9 | Regresja autotestów | smoke tests PASS; żaden nowy FAIL poza 9 driftami |
| 10 | Mirror-task | przypisanie → natychmiast task w M03 Inbox respondenta |
