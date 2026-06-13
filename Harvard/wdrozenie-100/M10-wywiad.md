# TECZKA M10 — Wywiad · pełna teczka reuse-first

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje istniejące (karta audytu §1–§7 + evidence + SPEC_13) i dokłada brakujące ogniwa (Rejestr Wejść z uwagami żywymi #12/#13 · Rejestr Decyzji · DoD z liczbami). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · referencja: [`M13-inicjatywy.md`](M13-inicjatywy.md).

## 00 · Nagłówek
- **Moduł:** M10 Wywiad (szablony→przydziały→sesje→wnioski→inicjatywy) · **Pula:** core (kliencki: **VTS wave 2 ŻYWY na prod**, ~131 osób)
- **Ocena audytu:** 60/100 · **Status:** **FAZA 1** (PROD P0 głos) → FAZA 2 (SPEC_13) → FAZA 4 · **Rozmiar:** M-L (i18n 2090 inline + szlif kanonu)
- **Żywy bloker:** **#12 PROD P0 — głos w wywiadzie nie zapisuje odpowiedzi (VTS)**
- **2 uwagi żywe:** #12 głos VTS (P0 PROD) · #13 jeden przepływ + bramka oceny AI+człowiek (P1-design)
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 · teczka 2026-06-13
- **Karta:** `Harvard/modules/M10-wywiad/KARTA_AUDYTU.md` · **SPEC:** `Harvard/SPEC_ZADANIE_13_interview_flow_approval.md` · **Evidence:** `…/evidence/f1_code_truth.md`, `f2_tests_report.md`, `f56_kanon_sec.md`
- **Kod:** `src/components/Interview/` (InterviewHub, InterviewSingleQuestionRuntime, InsightViewer, ConversationalPanel) · `server/src/controllers/InterviewController.ts` · `server/src/services/interviewInferenceService.ts` · `server/src/services/ai/VoiceService.ts` · `server/src/controllers/voice.controller.ts`

## MAPA POKRYCIA
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta werdykt + §0 (6 scenariuszy) | job-to-be-done + zakres (niżej) |
| B UX docelowe | 🟢 | karta §5 (§27 4 tabele) + SPEC_13 | delta głos #12 + flow #13 |
| C Dane+API+reguły | 🟢 | karta §1e (wiring) + §1f | link + reguła głosu/bramki (niżej) |
| D AI/Teresa | 🟢 | `CARD_CONTENT_FORMULA` + inference service | delta bramki oceny #13 |
| E Integracje | 🟢 | karta §1g (tabela połączeń) | — |
| F Epiki | 🟢 | karta §7 (3 fale) + SPEC_13 | epiki + uwagi żywe (niżej) |
| G DoD/jakość | 🟢 | karta §0/§2/§7 | **liczby** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść (#12/#13) + Decyzji** (niżej) |

---

## A · INTENCJA *(link + uzupełnienie)*
- **Job-to-be-done:** przeprowadzić diagnozę organizacji przez ustrukturyzowane wywiady — od szablonu, przez przydział i wypełnienie (tekst/głos/konwersacyjny AI), po wnioski (inference) i inicjatywy.
- **Persony/role:** konsultant/manager (twórca+przydzielający+approver), respondent (assignee), admin. Core otwarty.
- **Zakres v1:** szablony CRUD+publish · przydziały+mirror-task · sesje 3 tryby (single/task_list/conversational) · inference (LLM+zod→`interview_insights`) · InsightViewer · `generate_from_evidence`→inicjatywa · głos (Web Speech + server STT). **POZA v1:** wizualny stepper 4-krok (CZĘŚCIOWE, redesign 2026-06-06 niezbudowany — decyzja D-03); tab `pending_review` (ukryty celowo).
- **Metryka:** głos→submit→trwałość 100% (#12); jeden przepływ z bramką oceny AI+człowiek (#13).

## B · UX DOCELOWE *(link + delty żywe)*
Stany + §27 (Sesje/Przydzielone/Szablony/Wnioski): karta §5. **Korupcja „rose" = REALNY wzorzec korupcji** (21× `rose-*`, `InterviewHub.tsx:4772-4778`, w odróżnieniu od M01/M03); brak `persistKey`; i18n inline.
**Delty żywe:**
- **#12 głos w wywiadzie (P0 PROD VTS):** tekst pojawia się NA ŻYWO, ale przy Stop toast „Nie udało się przetworzyć nagrania", tekst nie zapisany; retry działa. Docelowo: głos→submit→reload→trwałość 100% nawet gdy server STT padnie.
- **#13 jeden przepływ + bramka oceny (P1-design SYSTEMOWE):** AI ocenia+podpowiada braki, poniżej progu nie wypuszcza; nadawca dostaje score+rekomendację i Zatwierdza/Wysyła-do-poprawy. **~70% maszynerii JUŻ ISTNIEJE doradczo/ukryto** (SPEC_13). Docelowo: bramka dwustopniowa (HITL) + menu jako numerowany pipeline + przyciski „następny krok". Pełna analiza: `SPEC_ZADANIE_13_interview_flow_approval.md`.

## C · DANE + API + REGUŁY *(link + reguła głosu/bramki)*
- **Wiring FE↔BE↔DB:** karta §1e (szablony/przydziały/sesje/inference/konwersacyjny/`generate_from_evidence`; getInsight/deleteInsight org-scope `b9f2dee9d2`). **Flagi:** brak dedykowanych flag blokujących core (karta §1f).
- **Reguła głosu (#12, kanon docelowy):** (1) **FE** — interim transcript gubiony przy Stop: `recognition.onresult` dopisuje do `liveTranscriptRef` tylko FINAL (`InterviewSingleQuestionRuntime.tsx:838-839`); `recorder.onstop` czyta synchronicznie (`:903`) zanim Web Speech sfinalizuje tail → bufor pusty. **FE-fix wdrożony Londyn:** `liveInterimRef` (`:264`), mirror interim (`:846`), flush przy Stop (`:903`), reset przy starcie (`:826`). (2) **SERWER** — `/voice/stt` wymaga `OPENAI_API_KEY`/`GROQ_API_KEY` (`VoiceService.ts:26-66`, `voice.controller.ts:24-51`) inaczej „No STT provider available" → 503/500.
- **Reguła bramki (#13, kanon docelowy):** AI-ocena na submit istnieje (`ai_review_snapshot_json`: score/verdict/weakAnswerMap/recommendations, `InterviewController.ts:3519-3542`); approve z completeness≥50% (`:3799,:3850`); send-back checklist (`:3592`). BRAKUJE: persystencji score, egzekucji progu (gate bypassowalny), score+rekomendacji w powiadomieniu, wizualizacji pipeline.

## D · AI / TERESA *(SSOT istnieje — linkuj)*
- **Formuła treści:** `docs/standards/CARD_CONTENT_FORMULA.md` (wnioski+inicjatywy McKinsey-grade). Walidator VTS na prod: 25 kart 0/25 PASS progu ≥90 — **to jakość TREŚCI (`project_vts_card_audit`), NIE defekt kodu M10**; `material_quality_complete` 10/10 PASS (kontrakt renderera dotrzymany).
- **Inference:** `interviewInferenceService.executeInference` (LLM+zod-schema+persyst do `interview_insights`) — realny.
- **Bramka oceny (#13):** AI doradza/człowiek decyduje (HITL) — uwidocznić istniejącą maszynerię, nie budować od zera.

## E · INTEGRACJE
Pełna tabela: karta §1g. Skrót: **→** M11/Assessment (eksport wniosków), M13 (`generate_from_evidence`, `InterviewHub.tsx:12955`), M17 Outputs, M03 (mirror-task przy przydziale). **←** M12 Audyty (fan-out ankiet przez `interviewAssignmentService.create`), M23 Organizacja (kontekst org zasila generację). **Kręgosłup:** SPEC_13 flow wspólny z generacją z czatu (FAZA 0). PROD P0 głos = niezależny od kręgosłupa.

## F · EPIKI *(z karty §7 + SPEC_13 + uwagi żywe)*
- **EPIK 1 — Głos PROD P0 (#12, FAZA 1 TOP):** zacommitować FE interim-flush (`InterviewSingleQuestionRuntime.tsx` niezacommitowany) + zweryfikować server STT na prod (klucz OPENAI/GROQ) + utrwalanie do `interview_sessions`; E2E głos→submit→reload. [uwaga żywa, VTS żywy]
- **EPIK 2 — Integralność (P0):** ~~cross-org get/delete wniosku~~ `b9f2dee9d2`; ~~martwy import InsightPackView~~ `ea77dc678c` (26 testów S5). [Fala 1, DONE]
- **EPIK 3 — Flow + bramka oceny (#13, P1-design):** bramka dwustopniowa HITL + pipeline w menu + przyciski stage→stage; uwidocznić istniejące. [SPEC_13]
- **EPIK 4 — Testy (P1):** unit S4 (transcript/inference/material_quality); 9 FAIL→0; ≥1 E2E→PR-gate+`Londyn`. [Fala 2]
- **EPIK 5 — Szlif kanonu (P1/P2):** korupcja „rose"→`EntityStatusChip`/`c.*`; persistKey 4 tabele; i18n inline (2090); RC-5 (5× `<table>`). [Fala 3]
- **EPIK 6 (decyzje):** stepper 4-krok (D-03); tab `pending_review` (D-04).

## G · JAKOŚĆ / DoD *(skwantyfikowane)*
| # | Kryterium | Miara M10 |
|---|-----------|-----------|
| 1 | Front↔back | głos→submit→reload trwałość (PROD P0 #12 zamknięty); stepper/pending_review rozstrzygnięte; pełny cykl trwały |
| 2 | Bezpieczeństwo | cross-org get/delete wniosku ✅ `b9f2dee9d2` (potwierdzić testem); 25/25 endp. scoped |
| 3 | i18n | 0 z **2090** inline (`i18n.language==='pl'`/`isPolish`) w `src/components/Interview/` |
| 4 | Tokeny | korupcja „rose" → 0 (`InterviewHub.tsx:4772`); **15** hex w `src/components/Interview/` (zweryfikować ile = ikony vs hardkod) |
| 5 | §27 | Sesje/Przydzielone/Szablony/Wnioski przez FilterableTable + `persistKey` (0× dziś); **7** surowych `<table>` (RC-5) czyste |
| 6 | E2E w PR-gate | S3 (sesja submit) + S5 (wnioski) + **głos** zielone na `Londyn` |

Scenariusze S1–S6 + pokrycie + pułapka CI: karta §0/§2. Bezpieczeństwo: karta §6. (CARD_CONTENT_FORMULA = jakość treści VTS, poza kodem M10.)

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1) — scala WSZYSTKIE źródła
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §1–§7 | 2026-06-11 | 13/15 realne; cross-org + martwy import naprawione; dług kanonu | L-02,03,04,05,06 |
| W-02 | **Uwaga żywa #12** | 2026-06-13 | PROD P0 głos w wywiadzie nie zapisuje (VTS wave 2) | L-01 (FE-fix wdrożony) |
| W-03 | **Uwaga żywa #13** | 2026-06-13 | jeden przepływ + bramka oceny AI+człowiek (P1-design) | L-07 (D-01/D-02) |
| W-04 | `SPEC_ZADANIE_13_interview_flow_approval.md` | 2026-06-13 | pełna analiza flow+bramka (~70% maszynerii istnieje) | L-07 |
| W-05 | `CARD_CONTENT_FORMULA.md` + inference service | — | formuła treści wniosków/inicjatyw | jakość treści (poza M10) |
| W-06 | Feedback prod (`finding_interview_voice_stt_bug`, `project_vts_survey_wave2`) | 2026-06-13 | VTS żywy ~131 osób; server STT do potwierdzenia | L-01 |

### 02 · Stan obecny (prawda kodu) — karta §1 (REALNE 13 · MOCK 0 · ZEPSUTE 0 · UKRYTE-celowo 1 · CZĘŚCIOWE 1). Naprawione: `b9f2dee9d2` (get/delete wniosku org-scope), `ea77dc678c` (martwy import, 26 testów S5), `7ab1b8aace` (cross-org testy). W TOKU Londyn: `30c06e51d6` (per-question hint), `b4586a7c16` (voice-echo), `7ee1fb481d` (inline record/attachments), niezacommitowany `InterviewSingleQuestionRuntime.tsx` (interim-flush głosu #12).

### 03 · Rejestr luk (= docelowy − obecny)
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status |
|----|------|---------|--------------------|-------|------|--------|
| L-01 | głos nie zapisuje odpowiedzi (FE interim + server STT) | W-02,W-06 | `InterviewSingleQuestionRuntime.tsx:838-839,903` + `VoiceService.ts:26-66` | **P0 PROD** | 1 | **FE-fix WDROŻONY (niezacommitowany, niezweryfikowany live); serwer STT do potwierdzenia (env, R3)** |
| L-02 | 9 FAIL drift testów (Hub `__private__`, barrel, i18n, InsightCreator ×3, PATCH 404 ×2, worksheets) | W-01 | f2_tests_report | P1-test | 2 | otwarta |
| L-03 | brak unitów S4 (konwersacyjny) | W-01 | `interviewTranscriptService`/`interviewInferenceService` | P1-test | 2 | otwarta |
| L-04 | korupcja „rose" w status-chipach | W-01 | `InterviewHub.tsx:4772-4778` (21×) | P1 | 4 | otwarta |
| L-05 | brak `persistKey` (4 tabele) + i18n inline | W-01 | `src/components/Interview/` (2090 i18n) | P1 | 4 | otwarta |
| L-06 | RC-5 surowe `<table>` | W-01 | 7× w `src/components/Interview/` | P2 | 4 | otwarta |
| L-07 | flow + bramka oceny niewyegzekwowana/nieuwidoczniona | W-03,W-04 | `InterviewController.ts:3519-3542,3799,3850,3592` | P1-design | 2 | otwarta |
| L-08 | schema-drift `CREATE TABLE IF NOT EXISTS tool_sessions` runtime | W-01 | runtime eksportu | P2 | 3 | otwarta (potwierdzić prod) |
| L-09 | stepper 4-krok niezbudowany / `pending_review` ukryty | W-01 | `InterviewHub.tsx:2631,2688` | P-design | 4 | D-03/D-04 |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | #13 próg twardego blocku respondenta | obiektywna niedostateczność+wymagane / min. score | Piotr | TBD | otwarta |
| D-02 | #13 kto zatwierdza + „nie wypuszcza" = block submit czy wyjścia | przydzielający / manager-permission | Piotr | TBD | otwarta |
| D-03 | stepper 4-krok: zbudować wg 2026-06-06 czy backlog? | zbudować / odłożyć | Piotr | TBD | otwarta |
| D-04 | tab `pending_review`: feature-gate czy usunąć? | udokumentować gate / usunąć | Piotr | TBD | otwarta |
| D-05 | server STT na prod: który provider klucz? | OPENAI / GROQ / oba | Piotr | **pilne (VTS żywy)** | otwarta (env, wymaga zgody/dostępu) |

### 05 · Flagi/rollout — brak dedykowanych flag blokujących core (moduł otwarty). VTS wave 2 żywy na prod (centerbeam). Web Speech NIE działa w Firefox/części mobile → server STT MUSI działać dla wszystkich (D-05).
### 06 · Ryzyka — **L-01 część serwerowa = env-check na prod, wymaga zgody/dostępu właściciela do Railway** (`feedback_prod_caution`); FE-fix niezweryfikowany live (mikrofon — R3: nie twierdzić „działa" bez żywego testu na staging). Deploy Londyn→prod = osobna jawna zgoda. Dev `.env` → Railway PROD (VTS żywy) — maksymalna ostrożność z zapisami.
### 07 · Log — 2026-06-13: #12 FE interim-flush wdrożony (niezacommitowany); #13 SPEC_13 sporządzony. Audyt 2026-06-11: ocena 60/100; `b9f2dee9d2`, `ea77dc678c`. Re-ocena D/G po Fazie 1 (głos) i 4.

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta + 2 uwagi żywe #12/#13 + SPEC_13 + formuła + feedback prod VTS) · R2 zero sierot (wejście→luka→DoD) · R3 L-01 „FE-fix wdrożony niezweryfikowany live + serwer STT do potwierdzenia" (nie dziedziczone) · R4 DoD z liczbami (2090 i18n · 7 table · 15 hex · 21× rose) · R5 decyzje z właścicielem (D-05 pilne, terminy TBD) · A–E docelowy zlinkowany · F epiki↔luki · G DoD+S+sec · R6 sesja żywa = Faza 4 + żywy smoke głosu VTS (zaplanowane). **Teczka kompletna do egzekucji.**
