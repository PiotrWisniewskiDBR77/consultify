# TECZKA M10 — Wywiad · pełna teczka reuse-first (pogłębiona do poziomu M13)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje istniejące (karta audytu §1–§7 + evidence + `SPEC_ZADANIE_13`) i dokłada brakujące ogniwa (Rejestr Wejść z uwagami żywymi #12/#13 · Rejestr Decyzji · DoD z liczbami · maszyna stanów + ścieżka głosu + bramka oceny). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · referencja: [`M13-inicjatywy.md`](M13-inicjatywy.md).

## 00 · Nagłówek
- **Moduł:** M10 Wywiad (szablony → przydziały → sesje → wnioski → inicjatywy) · **Pula:** core (kliencki: **VTS wave 2 ŻYWY na prod**, ~131 osób)
- **Ocena audytu:** 60/100 · **Status:** **FAZA 1** (PROD P0 głos) → FAZA 2 (SPEC_13 flow) → FAZA 4 · **Rozmiar:** M-L (i18n 2090 inline + szlif kanonu)
- **Żywy bloker:** **#12 PROD P0 — głos w wywiadzie nie zapisuje odpowiedzi (VTS)**
- **2 uwagi żywe:** **#12** głos VTS (P0 PROD) · **#13** jeden przepływ + bramka oceny AI+człowiek (P1-design, `SPEC_ZADANIE_13`)
- **Decyzje kierunkowe:** **DP-1 ZATWIERDZONA (2026-06-13) = OPENAI** (STT na prod = OpenAI/Whisper; egzekucja = klucz na Railway centerbeam + commit FE interim-flush, Faza 1, wymaga zgody na env prod). **#13 decyzje produktowe ZATWIERDZONE** (`SPEC_ZADANIE_13` §5). Patrz [`_DECYZJE.md`](_DECYZJE.md).
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 · teczka 2026-06-13 (pogłębiona)
- **Karta:** `Harvard/modules/M10-wywiad/KARTA_AUDYTU.md` · **SPEC:** `Harvard/SPEC_ZADANIE_13_interview_flow_approval.md` · **Evidence:** `…/evidence/f1_code_truth.md`, `f2_tests_report.md`, `f56_kanon_sec.md`
- **Kod:** `src/components/Interview/` (InterviewHub, InterviewSingleQuestionRuntime, InterviewWorkspace, InsightViewer, ConversationalPanel) · `server/src/routes/interview.routes.ts` · `server/src/controllers/InterviewController.ts` · `server/src/services/interviewInferenceService.ts` · `interviewTranscriptService.ts` · `InterviewAssignmentService.ts` · `InterviewInsightService.ts` · `server/src/services/ai/VoiceService.ts` · `server/src/controllers/voice.controller.ts`

## MAPA POKRYCIA (co już jest vs co dokłada teczka)
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta werdykt + §0 (6 scenariuszy) | job-to-be-done + zakres (niżej) |
| B UX docelowe | 🟢 | karta §5 (§27 4 tabele) + SPEC_13 | stany + delta głos #12 + flow #13 (niżej) |
| C Dane+API+reguły | 🟢 | karta §1e (wiring) + §1f | **endpointy + maszyna stanów + ścieżka głosu (DP-1) + bramka (#13)** (niżej) |
| D AI/Teresa | 🟢 | `CARD_CONTENT_FORMULA` + inference service | inference + bramka oceny #13 (HITL) (niżej) |
| E Integracje | 🟢 | karta §1g (tabela połączeń) | fan-out M12 + handoff M13 (niżej) |
| F Epiki | 🟢 | karta §7 (3 fale) + SPEC_13 | epiki→stories Gherkin→L-xx + uwagi żywe (niżej) |
| G DoD/jakość | 🟢 | karta §0/§2/§7 | **liczby grepem 2026-06-13** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść (#12/#13) + Decyzji + R3** (niżej) |

---

## A · INTENCJA *(link + uzupełnienie)*
- **Job-to-be-done:** przeprowadzić diagnozę organizacji przez **ustrukturyzowane wywiady** — od szablonu, przez przydział i wypełnienie (tekst / głos / konwersacyjny AI), przez **bramkę dopuszczenia** (ocena AI + decyzja człowieka), po wnioski (inference) i inicjatywy.
- **Persony/role:** **konsultant/manager** (twórca + przydzielający + **approver**), **respondent** (assignee — wypełnia), admin. Core otwarty (bez beta-gate).
- **Zakres v1:** szablony CRUD+publish · przydziały+mirror-task · sesje 3 tryby (single_question / task_list / conversational) · inference (LLM+zod→`interview_insights`) · InsightViewer · `generate_from_evidence`→inicjatywa · głos (Web Speech + server STT) · **bramka oceny AI+człowiek (#13, ~70% maszynerii istnieje)**. **POZA v1:** wizualny stepper 4-krok (CZĘŚCIOWE, redesign 2026-06-06 niezbudowany — D-03); tab `pending_review` (ukryty celowo — D-04).
- **Metryka wartości:** (1) głos→submit→reload→trwałość 100% (#12); (2) jeden przepływ z bramką oceny AI+człowiek, % sesji z egzekwowaną bramką (#13).

## B · UI/UX — STAN DOCELOWY *(karta §5 + delty żywe)*
- **Layout:** `InterviewHub` z 6 zakładkami: Inbox / Sesje / Przydzielone / Szablony / Wnioski / Inicjatywy (`InterviewHub.tsx:1390-1397`). Docelowo (#13): zakładki → **numerowany pipeline ①–⑥** z badge'ami stanu („④ 3 do oceny").
- **Stany ekranu:** pusty / ładowanie / błąd (jawne banery, demo-data za jawnym togglem — **nie cichy fallback**, poprawny wzorzec) / pełny / brak-uprawnień (per-permission).
- **§27:** Sesje/Przydzielone/Szablony/Wnioski — A0 spełnione; **korupcja „rose" = REALNY wzorzec korupcji** (21× `rose-*`, `InterviewHub.tsx:4772-4778`, w odróżnieniu od M01/M03 gdzie `rose` legalny); brak `persistKey` (0×); i18n inline.
- **Delty żywe:**
  - **#12 głos (P0 PROD VTS):** tekst pojawia się NA ŻYWO w polu, ale przy Stop toast „Nie udało się przetworzyć nagrania", tekst nie zapisany; retry działa. **Docelowo:** głos→submit→reload→trwałość 100% nawet gdy server STT padnie (FE flush interim) i gdy Web Speech niedostępny (server STT = OPENAI per DP-1).
  - **#13 jeden przepływ + bramka oceny (P1-design SYSTEMOWE):** AI ocenia+podpowiada braki, poniżej progu nie wypuszcza; nadawca dostaje score+rekomendację i Zatwierdza/Wysyła-do-poprawy. **~70% maszynerii JUŻ ISTNIEJE doradczo/ukryto** (`SPEC_ZADANIE_13`). Docelowo: bramka dwustopniowa (HITL) + menu jako numerowany pipeline + przyciski „następny krok".

## C · DANE + API + REGUŁY *(link + endpointy + maszyna stanów + głos + bramka)*

### C0 · Endpointy (enumeracja `interview.routes.ts`, mount `/api/interview`; `requireUser` + per-permission)
- **Sesje:** `GET /sessions`, `/sessions/completed`, `/sessions/:id`; `POST /sessions`, `/sessions/bulk` (bulkSessionLifecycle), `/sessions/:id/archive|restore|trash|untrash`; `PATCH /sessions/:id`; `DELETE /sessions/:id`.
- **Przydziały:** `GET /assignments/my`, `/assignments/counts`; `POST /assignments/:id/start`, `/assignments/:id/submit`, **approve / send-back** (`:132,:139`).
- **Pytania:** `GET/POST /sessions/:sessionId/questions`, `PATCH /questions/:questionId`; AI: `POST /questions/:questionId/ai-suggest|ai-improve|ai-explain`.
- **Ocena/parse (bramka #13):** `POST /sessions/:sessionId/evaluate-answers` (`evaluateSessionAnswers`), `/sessions/:sessionId/ai-parse` (`aiParseSessionAnswers`, konwersacyjny).
- **Transkrypt:** `GET/POST /sessions/:sessionId/transcript`.
- **Inne routery:** `interview-enterprise.routes.ts`, `v8/interview.routes.ts`, `v8/interview-insights.routes.ts`.

### C1 · Maszyna stanów (kanon, `InterviewHub.tsx:637` + `InterviewController.ts`)
**6 statusów przydziału, egzekwowane serwerowo:** `assigned → in_progress → submitted → sent_back → approved → completed` (`InterviewHub.tsx:637`).
- **Happy path:** `assigned → in_progress → submitted → approved → completed`. Send-back zawraca `submitted → sent_back → in_progress` (respondent poprawia).
- **Przejścia (`InterviewController.ts`):**
  - **submit** (`:3485-3515`): liczy `completenessRatio`/`completenessPercent`; resetuje send-back fields; status → `submitted`; sync mirror-task.
  - **evaluate-answers** (`evaluateSessionAnswers`): AI-ocena → `ai_review_snapshot_json` (`overallScore`, `overallVerdict` ∈ `ready_for_approval|needs_improvement|insufficient|empty`, `weakAnswerMap`, `recommendations`) zapisany `:3536`.
  - **approve** (`approveAssignment`): **twarda bramka completeness ≥50%** (409 jeśli mniej); status → `approved`, sesja → `completed`.
  - **send-back** (`sendBackAssignment`, `:3592`): obowiązkowy powód + checklista missing items (z `weakAnswerMap`); **send-back = decyzja jakościowa, NIE bramka matematyczna** (`:3682`); status → `in_progress`.
  - **audyt decyzji:** `review_decision_memory_json` (alignment AI↔człowiek, kolumny dodawane runtime `:818,:828`).

### C2 · Reguła głosu (#12, kanon docelowy — DP-1 = OPENAI)
- **(1) FE — interim transcript gubiony przy Stop:** `recognition.onresult` dopisuje do `liveTranscriptRef` **tylko FINAL** (`InterviewSingleQuestionRuntime.tsx:838-839`); interim → tylko `setLiveInterim` (widoczny, `:844`). `recorder.onstop` czyta `liveTranscriptRef` **synchronicznie** (`:903`) zanim Web Speech sfinalizuje tail → bufor pusty → error toast mimo widocznego tekstu.
  - **FE-fix wdrożony na Londyn (NIEZACOMMITOWANY — `git status` = `M`):** `liveInterimRef` (`:264`), mirror interim w `onresult` (`:846`), flush przy Stop `browserTranscript = (liveTranscriptRef + interim)` (`:903`), reset przy starcie (`:826`). **Egzekucja DP-1: zacommitować ten plik.**
- **(2) SERWER — STT:** `/voice/stt` → `VoiceService.getClient()` wybiera provider: **OPENAI (`whisper-1`)** jeśli `OPENAI_API_KEY` (`VoiceService.ts:23,26,39`), fallback GROQ (`whisper-large-v3`, `:42-46`); brak obu → throw „No STT provider available" (`:66`) → 503/500 → `serverText=''` zawsze. **DP-1 = OPENAI:** potwierdzić/ustawić `OPENAI_API_KEY` na Railway centerbeam (prod) — Web Speech NIE działa w Firefox/części mobile, więc server STT MUSI działać dla wszystkich VTS. **Wymaga zgody/dostępu właściciela do env prod.**

### C3 · Reguła bramki (#13, kanon docelowy — decyzje `SPEC_13` §5 ZATWIERDZONE)
- **Istnieje (doradczo/ukryto):** AI-ocena na submit (`ai_review_snapshot_json`); approve completeness≥50%; send-back checklist; `review_decision_memory_json`; pre-submit quality gate **bypassowalny** „Wyślij mimo to" (`InterviewWorkspace.tsx:1326-1374`).
- **BRAKUJE (docelowe):** persystencja `overallScore` (placeholder „brak pola" `InterviewHub.tsx:8073`); egzekucja twardego progu; score+rekomendacja w powiadomieniu (`:3905`); wizualizacja pipeline; przyciski stage→stage.
- **Bramka dwustopniowa (HITL):** **Stopień 1 respondent** — twardy block SUBMIT tylko dla obiektywnej niedostateczności (puste/wymagane-brak/verdict `insufficient`/`empty`); usunąć „Wyślij mimo to" dla twardego floora, zostawić dla `needs_improvement`. **Stopień 2 nadawca** (= przydzielający + `INTERVIEW_ASSIGN_MANAGE`) — persyst score, powiadomienie ze score+rekomendacją, przyciski **Zatwierdź / Wyślij-do-poprawy** (oba istnieją, uwidocznić).

### C4 · Pułapki danych
bigint=string, jsonb=object (`ai_review_snapshot_json`/`review_decision_memory_json` parsowane przez `parseAiReviewSnapshot`/`parseReviewDecisionMemory`, `:3000,:3002`). Schema-drift: defensywny `CREATE TABLE IF NOT EXISTS tool_sessions` w runtime eksportu (L-08, potwierdzić prod).

## D · AI / TERESA *(SSOT istnieje — linkuj)*
- **Formuła treści:** `docs/standards/CARD_CONTENT_FORMULA.md` (wnioski+inicjatywy McKinsey-grade). Walidator VTS na prod: 25 kart 0/25 PASS progu ≥90 — **to jakość TREŚCI (`project_vts_card_audit`), NIE defekt kodu M10**; `material_quality_complete` 10/10 PASS (kontrakt renderera dotrzymany).
- **Inference:** `interviewInferenceService.executeInference` (LLM + zod-schema + persyst do `interview_insights`/`inference_runs`) — realny. Konwersacyjny: `aiParseSessionAnswers` (parse transkryptu na odpowiedzi).
- **Bramka oceny (#13):** **AI doradza / człowiek decyduje (HITL)** — `evaluateSessionAnswers` proponuje score+verdict+rekomendacje; nadawca zatwierdza/odrzuca; rozbieżności → `review_decision_memory_json`. **Granica persony:** AI nie auto-blokuje na ocenie jakościowej (tylko obiektywna niedostateczność), nie udaje decyzji człowieka.

## E · INTEGRACJE — mapa połączeń *(karta §1g)*
- **Wyjścia →** M11/Assessment (eksport wniosków), **M13 Inicjatywy** (`generate_from_evidence`, `InterviewHub.tsx:12955`), M17 Outputs (assessment_report/deck/report), M03 My Work (mirror-task przy przydziale, `InterviewAssignmentService.create`).
- **Wejścia ←** **M12 Audyty** (fan-out ankiet przez kanoniczny `interviewAssignmentService.create` — **współdzielony serwis; org-walidacja assignee naprawiona raz dla M10+M12, `7df4b22d6d`**), M23 Organizacja (kontekst org zasila generację).
- **Kręgosłup:** `SPEC_13` flow wspólny z klastrem „następny krok/trzeci panel" (#1/#6/#7/#10). PROD P0 głos = niezależny od kręgosłupa (lokalna ścieżka FE+server STT).

## F · EPIKI → STORIES → ZADANIA *(z karty §7 + SPEC_13 + uwagi żywe)*

- **EPIK 1 — Głos PROD P0 (#12, FAZA 1 TOP, DP-1):**
  - *Story 1.1:* jako respondent VTS chcę, by moja odpowiedź głosowa zapisała się.
    - *Gherkin:* dane respondent dyktuje odpowiedź (Chrome) · gdy klika Stop · wtedy tekst (interim+final) trafia do submit i przeżywa reload — nawet gdy server STT padnie.
    - *Zadania:* [Z-01 → L-01] zacommitować FE interim-flush (`InterviewSingleQuestionRuntime.tsx`); [Z-02 → L-01] **DP-1: potwierdzić/ustawić `OPENAI_API_KEY` na Railway centerbeam** (env, zgoda właściciela); [Z-03 → L-01] E2E głos→submit→reload (mikrofon na staging).
- **EPIK 2 — Integralność (P0, DONE):** ~~cross-org get/delete wniosku~~ `b9f2dee9d2`; ~~martwy import InsightPackView~~ `ea77dc678c` (26 testów S5). [Fala 1 DONE]
- **EPIK 3 — Flow + bramka oceny (#13, P1-design):**
  - *Story 3.1:* jako nadawca chcę dostać score+rekomendację i móc Zatwierdzić lub Wysłać-do-poprawy.
    - *Gherkin:* dane respondent wysłał sesję · gdy AI ocenia · wtedy nadawca widzi score+verdict+rekomendacje i przyciski Zatwierdź/Wyślij-do-poprawy.
  - *Story 3.2:* jako respondent nie mogę wysłać sesji obiektywnie niedostatecznej.
    - *Gherkin:* dane wymagane pytania bez odpowiedzi LUB verdict `insufficient/empty` · gdy klika Wyślij · wtedy block + lista braków (bez „Wyślij mimo to").
    - *Zadania:* [Z-04 → L-07] persyst `overallScore`; [Z-05 → L-07] egzekucja progu submit; [Z-06 → L-07] powiadomienie ze score; [Z-07 → L-07] uwidocznić Zatwierdź/Wyślij-do-poprawy; [Z-08 → L-07] pipeline ①–⑥ + przyciski stage→stage. [`SPEC_13` §4]
- **EPIK 4 — Testy (P1):**
  - *Zadania:* [Z-09 → L-02/L-03] unit S4 (transcript/inference/material_quality); 9 FAIL→0; [Z-10 → L-06] ≥1 E2E→PR-gate na `Londyn`.
- **EPIK 5 — Szlif kanonu (P1/P2):**
  - *Zadania:* [Z-11 → L-04] korupcja „rose"→`EntityStatusChip`/`c.*`; [Z-12 → L-05] persistKey 4 tabele + i18n inline (2090); [Z-13 → L-06] RC-5 (7× `<table>`).
- **EPIK 6 (decyzje):** stepper 4-krok (D-03); tab `pending_review` (D-04).

## G · JAKOŚĆ / DoD *(skwantyfikowane — grep 2026-06-13, R4)*
| # | Kryterium | Miara M10 |
|---|-----------|-----------|
| 1 | Front↔back | głos→submit→reload trwałość (PROD P0 #12 zamknięty, FE commit + DP-1 env); bramka #13 wyegzekwowana+uwidoczniona; stepper/pending_review rozstrzygnięte; pełny cykl trwały |
| 2 | Bezpieczeństwo | cross-org get/delete wniosku ✅ `b9f2dee9d2` (potwierdzić testem); 23/25 endp. scoped (2 naprawione) |
| 3 | i18n | 0 z **2090** inline (`i18n.language==='pl'`/`isPolish`) w `src/components/Interview/` (grep 2026-06-13) |
| 4 | Tokeny | korupcja „rose" → 0 (`InterviewHub.tsx:4772`, **21×** grep); **15** hex w `src/components/Interview/` (zweryfikować ile = ikony vs hardkod, DP-8) |
| 5 | §27 | Sesje/Przydzielone/Szablony/Wnioski przez FilterableTable + `persistKey` (0× dziś); **7** surowych `<table>` (RC-5) czyste (grep 2026-06-13) |
| 6 | E2E w PR-gate | S3 (sesja submit) + S5 (wnioski) + **głos** (#12) + **bramka #13** zielone na `Londyn` |

**Telemetria sukcesu:** głos save-rate (→100%, #12); % sesji z egzekwowaną bramką; alignment AI↔człowiek (`review_decision_memory_json`).
Scenariusze S1–S6 + pułapka CI (test-suite tylko main/develop): karta §0/§2. Bezpieczeństwo: karta §6. (CARD_CONTENT_FORMULA = jakość treści VTS, poza kodem M10.)

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1) — scala WSZYSTKIE źródła
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §1–§7 | 2026-06-11 | 13/15 realne; cross-org + martwy import naprawione; dług kanonu | L-02..L-06,L-08,L-09 |
| W-02 | **Uwaga żywa #12** | 2026-06-13 | PROD P0 głos w wywiadzie nie zapisuje (VTS wave 2 ~131 osób) | L-01 (FE-fix wdrożony) |
| W-03 | **Uwaga żywa #13** | 2026-06-13 | jeden przepływ + bramka oceny AI+człowiek (P1-design) | L-07 (D-01/D-02 → SPEC_13 §5 ZATWIERDZONE) |
| W-04 | **`SPEC_ZADANIE_13_interview_flow_approval.md`** | 2026-06-13 | pełna analiza flow+bramka (~70% maszynerii istnieje, decyzje §5 zatwierdzone) | L-07 |
| W-05 | **`_DECYZJE.md` DP-1 (ZATWIERDZONA = OPENAI)** | 2026-06-13 | STT prod = OPENAI/Whisper; egzekucja env + commit FE | L-01 (D-05 ROZSTRZYGNIĘTA) |
| W-06 | `CARD_CONTENT_FORMULA.md` + inference service | — | formuła treści wniosków/inicjatyw | jakość treści (poza M10) |
| W-07 | Feedback prod (`finding_interview_voice_stt_bug`, `project_vts_survey_wave2`) | 2026-06-13 | VTS żywy ~131 osób; server STT do potwierdzenia | L-01 |

### 02 · Stan obecny (prawda kodu) — karta §1 (REALNE 13 · MOCK 0 · ZEPSUTE 0 · UKRYTE-celowo 1 · CZĘŚCIOWE 1). Naprawione: `b9f2dee9d2` (get/delete wniosku org-scope), `ea77dc678c` (martwy import, 26 testów S5), `7ab1b8aace` (cross-org testy). W TOKU Londyn: `30c06e51d6` (per-question hint), `b4586a7c16` (voice-echo), `7ee1fb481d` (inline record/attachments), **`1522f3de32` (`InterviewSingleQuestionRuntime.tsx` — `liveInterimRef` interim-flush głosu #12 ZACOMMITOWANY)**. Testy 273/273 PASS (weryfikacja 2026-06-16).

### 03 · Rejestr luk (= docelowy − obecny)
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status |
|----|------|---------|--------------------|-------|------|--------|
| L-01 | głos nie zapisuje odpowiedzi (FE interim + server STT) | W-02,W-05,W-07 | `InterviewSingleQuestionRuntime.tsx:838-839,903` + `VoiceService.ts:23-66` | **P0 PROD** | 1 | **FE-fix ZACOMMITOWANY `1522f3de32` (`liveInterimRef` interim-flush); DP-1=OPENAI env do potwierdzenia na Railway centerbeam (wymaga zgody Piotra — prod caution)** |
| L-02 | ~~9 FAIL drift testów~~ | W-01 | f2_tests_report | P1-test | 2 | **NAPRAWIONA — 273/273 PASS (2026-06-16); drift zamknięty przez poprzednie commity** |
| L-03 | brak unitów S4 (konwersacyjny) | W-01 | `interviewTranscriptService`/`interviewInferenceService` | P1-test | 2 | **NAPRAWIONA (R3: teczka stale, testy ISTNIEJĄ). Zweryf. 2026-06-17: `interviewTranscriptService.test.ts` (5 testów „S4 conversational transcript": addMessage/getMessages/count/delete org+session-scoped + JSONB round-trip) + `interviewInferenceService.test.ts` (6 testów „S4 inference": startRun/executeInference + cross-org early-return + LLM-throw + zero-sessions) = 11/11 PASS** |
| L-04 | korupcja „rose" w status-chipach | W-01 | `InterviewHub.tsx:4772-4778` (**21×** grep) | P1 | 4 | **NAPRAWIONA — grep 2026-06-17: `rose-` w `InterviewHub.tsx` = **0** (korupcja status-chip usunięta). Pozostałe 76× `rose-` w innych plikach Interview/ (NewSessionModal urgent, SufficiencyIndicator danger, CompanyFactsPanel, QuestionsList, ConversationalPanel) = semantycznie LEGALNE (danger/urgent), NIE korupcja → poza zakresem L-04** |
| L-05 | brak `persistKey` (4 tabele) + i18n inline | W-01 | `src/components/Interview/` (**2090** i18n grep) | P1 | 4 | otwarta (Faza-4 sweep — i18n/persistKey kanon) |
| L-06 | RC-5 surowe `<table>` | W-01 | **7×** w `src/components/Interview/` (grep) | P2 | 4 | **NAPRAWIONA/FALSE-POSITIVE (zweryf. 2026-06-17 sub-agentem): 7 surowych `<table>` = 6× wewnętrzne gridy WEWNĄTRZ `TableWithPreviewLayout` (kanoniczny wrapper §27/§8 — wszystkie główne listy Sesje/Wnioski/Szablony/Przydzielone/Inicjatywy/Pytania zgodne) + 1× legalna read-only matryca topic×stakeholder w detail-view (`InsightViewer.tsx:4419`). §27-kandydatów = 0. Brak migracji.** |
| L-07 | flow + bramka oceny niewyegzekwowana/nieuwidoczniona | W-03,W-04 | `InterviewController.ts:3485,3536,3592,3682` | P1-design | 2 | **NAPRAWIONA (R3: audyt 2026-06-13 nieaktualny — overstate). Zweryfikowane 2026-06-17:** (1) hard gate submit `OBJECTIVE_INSUFFICIENCY` 422 + FE bypass-proof (`InterviewWorkspace.tsx:1386-1397`); (2) score persisted+shown (`InterviewWorkspace.tsx:2033`, `InterviewHub.tsx:10146`); (3) notyfikacja ze score+rekomendacją (`InterviewController.ts:3638-3664`); (4) pipeline ①-⑥ (`InterviewHub.tsx:2673-2688`); (5) Approve/SendBack buttons w reviewer-mode (`InterviewWorkspace.tsx:1888-1895`). Pozostaje: dedykowany inbox ④ Dopuszczenia (PREVIEW per komentarz `:2678`) = osobna fala |
| L-08 | schema-drift `CREATE TABLE IF NOT EXISTS tool_sessions` runtime | W-01 | runtime eksportu | P2 | 3 | **NAPRAWIONA/FALSE-POSITIVE (R3, 2026-06-17): `tool_sessions` ma REALNĄ migrację `server/migrations/291_tools_initiatives.sql:8` (+ `641_v4_tool_runtime_contract.sql`, + indeksy + FK). Runtime `CREATE TABLE IF NOT EXISTS` (`InterviewController.ts:8255`) to defensywny pas bezpieczeństwa dla dev (komentarz `:8253`), NIE źródło driftu. Brak defektu kodu. (Potwierdzenie wykonania migracji na prod = jak L-01, wymaga dostępu do DB)** |
| L-09 | stepper 4-krok niezbudowany / `pending_review` ukryty | W-01 | `InterviewHub.tsx:2631,2688` | P-design | 4 | **ZAMKNIĘTA — D-03 + D-04 rozstrzygnięte przez Piotra i ZBUDOWANE: (D-04 `2ec855e820`) ④ pending-review tab za flagą DP-5 `isInterviewPendingReviewTabEnabled()` (default OFF); (D-03 `c6d29791d6`) top-level numerowany pipeline ①-⑥ `InterviewPipelineStepper` za flagą `isInterviewPipelineStepperEnabled()` (default OFF, render nad content). Oba flag-gated = prod VTS bez zmian; tsc clean, 19/19 testów (flagi + render). Default ON = osobny rollout** |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | #13 próg twardego blocku respondenta | obiektywna niedostateczność+wymagane / min. score | Piotr | 2026-06-13 | **ROZSTRZYGNIĘTA = obiektywna niedostateczność** (SPEC_13 §5.1) |
| D-02 | #13 kto zatwierdza + „nie wypuszcza" | przydzielający / manager-permission · block submit / wyjścia | Piotr | 2026-06-13 | **ROZSTRZYGNIĘTA = nadawca + `INTERVIEW_ASSIGN_MANAGE`; block SUBMIT** (SPEC_13 §5.2,§5.3) |
| D-03 | stepper 4-krok: zbudować wg 2026-06-06 czy backlog? | zbudować / odłożyć | Piotr | 2026-06-17 | **ROZSTRZYGNIĘTA = ZBUDOWAĆ — zbudowane flag-gated `c6d29791d6` (pipeline ①-⑥)** |
| D-04 | tab `pending_review`: feature-gate czy usunąć? | udokumentować gate / usunąć | Piotr | 2026-06-17 | **ROZSTRZYGNIĘTA = UDOKUMENTOWAĆ+UKRYĆ — flaga DP-5 `2ec855e820`** |
| D-05 | server STT na prod: który provider klucz? | OPENAI / GROQ / oba | Piotr | 2026-06-13 | **ROZSTRZYGNIĘTE → DP-1: OPENAI/Whisper** (egzekucja env wymaga zgody/dostępu prod) |

### 05 · Flagi / rollout / beta-gating
Brak dedykowanych flag blokujących core (moduł otwarty). **VTS wave 2 żywy na prod (centerbeam).** Web Speech NIE działa w Firefox/części mobile → server STT (OPENAI per DP-1) MUSI działać dla wszystkich.

### 06 · Ryzyka i założenia
- **L-01 część serwerowa = env-check na prod (DP-1 OPENAI), wymaga zgody/dostępu właściciela do Railway** (`feedback_prod_caution`); FE-fix niezweryfikowany live (mikrofon — R3: nie twierdzić „działa" bez żywego testu na staging).
- **#13 egzekucja progu = zmiana zachowania produkcyjnego (VTS wave 2 live!)** → ostrożnie, zbyt twardy block frustruje respondentów; HITL łagodzi (block tylko obiektywna niedostateczność).
- Deploy Londyn→prod = osobna jawna zgoda. Dev `.env` → Railway PROD (VTS żywy) — maksymalna ostrożność z zapisami.

### 07 · Log wdrożenia + re-ocena
- **2026-06-17 (Harvard 3): domknięcie M10 bez PROD P0.** Zweryfikowano kodem: **InsightViewer guard** (brief task #4) — `materialQuality` useMemo (`InsightViewer.tsx:1551-1626`) koalescuje KAŻDE pole-tablicę do `[]` przez `toArr` + normalizuje alternatywne klucze (score/posture/coverage) + pełny fallback gdy `materialQuality` brak → biały-ekran przy partial `material_quality_json` niemożliwy = **ZWERYFIKOWANY naprawiony**. **L-03 NAPRAWIONA** (testy S4 istnieją 11/11). **L-04 NAPRAWIONA** (rose status-chip w InterviewHub=0). **L-08 FALSE-POSITIVE** (migracja 291 tworzy tool_sessions). Pozostają OTWARTE tylko: **L-01 PROD P0** (OPENAI_API_KEY Railway centerbeam — czeka na zgodę Piotra, NIE dotykane), L-05/L-06 (Faza-4 sweep i18n/§27), L-09 (design-blocked D-03/D-04). Junk untracked `NewSessionModal 2.tsx` (kopia z równoległej sesji, NIE importowana) — do usunięcia poza scope.
- 2026-06-17: **R3 korekta masowa — audyt 2026-06-13 nieaktualny (overstate):** L-01 FE-fix ZACOMMITOWANY (`1522f3de32` — `liveInterimRef` interim-flush); L-02 drift NAPRAWIONY (273/273 PASS); L-07 NAPRAWIONA — SPEC_13 F1/F2/F3 zaimplementowane w `1522f3de32` + poprzednich commitach (hard gate, score, notyfikacja, pipeline ①-⑥, reviewer buttons). Server STT (OPENAI_API_KEY Railway centerbeam) = jedyny blokujący prod task, wymaga zgody Piotra.
- 2026-06-13: pogłębienie teczki; #12 FE interim-flush wdrożony (niezacommitowany); #13 SPEC_13 sporządzony, **decyzje §5 zatwierdzone (D-01/D-02 rozstrzygnięte)**; **D-05 rozstrzygnięta DP-1=OPENAI**; DoD przeliczone grepem (i18n 2090, table 7, hex 15, rose 21).
- Audyt 2026-06-11: 60/100; `b9f2dee9d2`, `ea77dc678c`. Re-ocena D/G po Fazie 1 (głos) i 4 + żywy smoke głosu VTS (R6).

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta + 2 uwagi żywe #12/#13 + SPEC_13 + DP-1 + formuła + feedback prod VTS) · R2 zero sierot (wejście→luka→DoD) · R3 L-01 „FE-fix wdrożony niezacommitowany niezweryf. live + DP-1 env do potwierdzenia" (nie dziedziczone, status `M` zweryfikowany) · R4 DoD z liczbami (2090 i18n · 7 table · 15 hex · 21× rose) · R5 decyzje z właścicielem (**D-01/D-02 ROZSTRZYGNIĘTE #13; D-05 → DP-1 OPENAI**; D-03/D-04 modułowe TBD) · A–E docelowy zlinkowany (+ endpointy/maszyna stanów/głos/bramka) · F epiki↔stories Gherkin↔luki · G DoD+S+sec · R6 sesja żywa = Faza 4 + żywy smoke głosu VTS (zaplanowane). **Teczka kompletna do egzekucji.**
