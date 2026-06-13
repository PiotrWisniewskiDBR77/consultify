# WP M10 — Wywiad · dokończenie do 100%

**Pula:** core (kliencki: VTS wave 2 ŻYWY) · **Karta:** `Harvard/modules/M10-wywiad/KARTA_AUDYTU.md` (ocena 60/100) · **Rozmiar:** M-L (1–3 dni + szlif kanonu) · **Żywy bloker:** **PROD P0 — głos w wywiadzie (VTS)**
**Faza programu:** **FAZA 1** (PROD P0 głos — najwyższy priorytet) → FAZA 2 (klienci, SPEC_13 flow) → FAZA 4 (sweepy) · **Master:** `Harvard/wdrozenie-100/MASTER.md`

## 1. Stan obecny (jednym akapitem)
Najbardziej dojrzały kodowo moduł audytu — 13/15 pozycji REALNE, 0 mock, 0 zepsute funkcjonalnie. Pełny cykl szablony→przydziały→sesje→wnioski→inicjatywy wpięty end-to-end; inference (`interviewInferenceService.executeInference`, LLM+zod-schema+persyst do `interview_insights`) i wywiad konwersacyjny (`aiParseSessionAnswers`, `InterviewController.ts:5982`) realne; demo-data poprawnie bramkowane jawnym togglem (`api.ts:623`, nie cichy fallback). **Naprawione w audycie:** cross-org IDOR `getInsight`/`deleteInsight` (`b9f2dee9d2`, hard cap zdjęty; sąsiednie handlery scoped — luka była zlokalizowana); martwy import `InsightPackView.p10-alignment.test.tsx` usunięty (`ea77dc678c` — 26 testów S5 odblokowanych); +1 kontraktowe testy cross-org (`7ab1b8aace`). **W TOKU (Londyn):** redesign formularza odpowiedzi (per-question hint `30c06e51d6`, voice-echo fix `b4586a7c16`, inline record/attachments `7ee1fb481d`); `InterviewSingleQuestionRuntime.tsx` ma niezacommitowaną zmianę (interim-flush głosu). Brak otwartych P0 w samej karcie — ale ŻYWY PROD P0 głosu (z MASTER §2 + `finding_interview_voice_stt_bug`).

## 2. Luki do DoD

### (a) BACKEND / API — **PROD P0 (FAZA 1)**
- **[P0 PROD] głos w wywiadzie nie zapisuje odpowiedzi (VTS wave 2 żywy).** Nagranie głosowe transkrybuje na ekranie, ale odpowiedź NIE jest zapisywana. FE interim-flush fix zrobiony na `Londyn` (`b4586a7c16` voice-echo + niezacommitowany `InterviewSingleQuestionRuntime.tsx`); **server STT do weryfikacji** — czy klucz `OPENAI`/`GROQ` na prod skonfigurowany i ścieżka STT zwraca transkrypt utrwalany do `interview_sessions`. Ref: `finding_interview_voice_stt_bug`. Fix: potwierdzić server-side STT na prod + utrwalanie odpowiedzi głosowej; test E2E głos→submit→reload→trwałość.
- **[P2] schema-drift** — defensywny `CREATE TABLE IF NOT EXISTS tool_sessions` w runtime eksportu → zweryfikować schema na prod (FAZA 3).

### (b) FRONTEND / UX (FAZA 2)
- **[CZĘŚCIOWE, poz.14] redesign 4-krokowego steppera** — flow jako tab bar gated permissionami (`InterviewHub.tsx:2631`); dedykowanego wizualnego steppera 4-krok BRAK (0 trafień Stepper/StepIndicator; redesign 2026-06-06 niezbudowany). SPEC: `SPEC_ZADANIE_13_interview_flow_approval.md`. Decyzja: zbudować wg 2026-06-06 ALBO świadomie odłożyć do backlogu.
- **[UKRYTE-celowo, poz.8] tab `pending_review`** (`InterviewHub.tsx:2688`) — logika filtra gotowa, render wyłączony. Decyzja: udokumentować jako feature-gate lub usunąć.

### (c) INTEGRACJA / TESTY E2E (FAZA 2 + 4)
- **[P1] 9 FAIL (drift testów):** `InterviewHub` (`__private__` undefined), `interview-barrel-exports` (`ManageAssignmentModal`), `DiscoveryConsultantView` (stale i18n), `InsightViewer` (badge), `InsightCreatorModal` ×3; BE `PATCH /api/v8/interview/insights/:id` 404 (MOCK_DB) ×2; report-pack nie utrwala `worksheets`. Doprowadzić 9 FAIL → 0.
- **[P1] brak unitów S4** (konwersacyjny) — `interviewTranscriptService` + `interviewInferenceService` (parse transkryptu, inference, material_quality).
- **[P1] CI** — `test-joby „Deferred outside main/develop"` → na `feat/*` testy interview nie biegną; E2E interview tylko nightly/weekly, żaden nie PR-blokujący. ≥1 E2E do PR-gate (tier0) + dodać `Londyn`.

### (d) Przekrojowe / §27 (FAZA 4)
- **[P1] korupcja „rose"** — status-chip hardkodowaną paletą `rose/amber` zamiast `EntityStatusChip`/`c.*` (21× `rose-*`, `InterviewHub.tsx:4772-4778`). To REALNY wzorzec korupcji (inaczej niż M01/M03).
- **[P1] §27.A brak `persistKey`** (0×) → kolumny/filtry nie persystują (4 tabele: Sesje/Przydzielone/Szablony/Wnioski).
- **[P1] §27.R i18n inline** `{en,pl}`, ~7 `t()` na 13.6k linii.
- **[P2] RC-5** — 5× surowy `<table>`.
- **CARD_CONTENT_FORMULA:** 25 kart VTS 0/25 PASS progu ≥90 — **to jakość TREŚCI (`project_vts_card_audit`), NIE defekt kodu M10**; `material_quality_complete` 10/10 PASS na prod (kontrakt renderera dotrzymany).

## 3. Kroki realizacji
1. **(FAZA 1, P0 PROD)** Domknąć głos: zweryfikować server STT na prod (klucz OPENAI/GROQ) + utrwalanie odpowiedzi głosowej do `interview_sessions`; zacommitować FE interim-flush (`InterviewSingleQuestionRuntime.tsx`). Test E2E głos→submit→reload→trwałość. **Najwyższy priorytet — VTS żywy.**
2. **(FAZA 2)** Unit dla S4 — transcript/inference/material_quality.
3. **(FAZA 2)** Napraw 5 stale FE-testów + diagnoza PATCH-insights 404 (MOCK_DB) + utrwalanie `worksheets` report-packa (9 FAIL → 0).
4. **(FAZA 2, SPEC_13)** Decyzja o stepperze 4-krok — zbudować wg 2026-06-06 lub backlog; decyzja o `pending_review` (poz.8).
5. **(FAZA 3)** Zweryfikować schema-drift `tool_sessions` na prod.
6. **(FAZA 4)** Korupcja „rose" → `EntityStatusChip`/`c.*`; `persistKey` na 4 tabelach; i18n inline→`t()`; RC-5; ≥1 E2E do PR-gate + `Londyn`.

## 4. DoD (6 kryteriów — bramka 6/6)
1. **Front↔back:** głos w wywiadzie zapisuje odpowiedź E2E (PROD P0 zamknięty); stepper/pending_review rozstrzygnięte; pełny cykl szablon→sesja→wniosek→inicjatywa trwały.
2. **Bezpieczeństwo:** cross-org get/delete wniosku zamknięte (naprawione `b9f2dee9d2`); 25/25 endp. scoped.
3. **i18n:** `t()` pełne (koniec inline `{en,pl}`).
4. **Tokeny:** korupcja „rose" usunięta → `EntityStatusChip`/`c.*`.
5. **§27:** Sesje/Przydzielone/Szablony/Wnioski przez FilterableTable + `persistKey`; RC-5 czyste.
6. **E2E w PR-gate:** S3 (sesja submit) + S5 (wnioski) + głos zielone na `Londyn`.

## 5. Weryfikacja
- **Głos (PROD P0):** nagranie głosowe → transkrypt → submit → reload → odpowiedź TRWAŁA w `interview_sessions` (E2E + żywy smoke na VTS, OSTROŻNIE — tylko po potwierdzeniu, prod żywy).
- Cross-org: org-A nie czyta/nie kasuje wniosku org-B → 403/404 (test; naprawione).
- S5: generacja wniosku → InsightViewer (evidence + material quality) → workflow statusów (26 testów S5 aktywne po `ea77dc678c`).
- §27: kolumny/filtry trwałe po reloadzie; 0× hardkodowany `rose-*` w status-chipach.
- **Uwaga DB:** dev `.env` → Railway zdalna (PROD — centerbeam, VTS żywy); maksymalna ostrożność z zapisami przy żywym smoke.

## 6. Zależności
- **PROD P0 głos** — niezależny od kręgosłupa; FAZA 1 najwyższy priorytet (VTS wave 2 żywy, ~131 osób).
- M10→M13 Charter/`generate_from_evidence` (`InterviewHub.tsx:12955`) — koordynować z WP M13 (FAZA 2).
- Wyjścia → M11/Assessment, M17 Outputs; wejścia ← M12 Audyty (fan-out ankiet), M23 Organizacja (kontekst org).
- CI „Deferred outside main/develop" + `Londyn` — systemowe wspólne z M01/M03/M13/M14/M25.
- SPEC_13 (interview flow approval) — wspólny z kręgosłupem (generacja z czatu, FAZA 0).
