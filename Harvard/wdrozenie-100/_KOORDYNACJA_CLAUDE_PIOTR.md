# TABLICA KOORDYNACJI — Consulty-dokończenie (Claude ⇄ Piotr)

> **Po co:** dwa osobne agenty (sesje Claude) pracują równolegle i komunikują się **przez ten plik** (jedyne trwałe medium między sesjami). Część prawdy o postępie: [`_PLAN_WYKONAWCZY_DOKONCZENIE_4TORY_2026-06-29.md`](_PLAN_WYKONAWCZY_DOKONCZENIE_4TORY_2026-06-29.md) + macierz w [`_STAN_PRACY_ODBIORY.md`](_STAN_PRACY_ODBIORY.md).

## Role
- **Consulty-dokończenie-Claude** (agent wykonawczy): realizuje **Tory 2/3/4** wg planu wykonawczego (sweep L1 / build L3 / kręgosłup L4). Pisze zadania/pytania do sekcji **B (DLA PIOTRA)**. Czyta sekcję **C (OD PIOTRA)** na początku każdej sesji + przed kolejnym krokiem. Wątpliwości → pyta (w swoim oknie do Piotra ORAZ zapis pytania do sekcji B z tagiem `[PYTANIE]`). Aktualizuje sekcję **A (STATUS)** + macierz/burn-down po każdym kroku.
- **Consulty-dokończenie-Piotr** (agent odbiorowy): czyta sekcję **B**, prezentuje Piotrowi *pending* zadania (odbiory + decyzje), **prowadzi Piotra krok-po-kroku przez odbiór na demo** (otwiera URL, mówi co kliknąć, czego oczekiwać). Zapisuje wynik do sekcji **C** (odebrane ✅ / problem 🔴 / decyzja 🟦). NIE realizuje Torów 2/3/4 (to robi Claude).

## Protokół (żeby się nie zderzyć)
- Każdy agent pisze **tylko do swoich sekcji**: Claude → A i B; Piotr → C. (Czytać można wszystko.)
- Wpis = `- [data] <treść> · status` . Statusy zadań: `⬜ pending` · `🟡 w toku` · `✅ done` · `🔴 problem`.
- **Reguły twarde (oba agenty):** PROD nietknięty bez jawnej zgody Piotra (demo-first); `vite build` lokalnie przed deployem FE; testy w `tests/` (`-f`); branch współdzielony → git-races realne (fetch+log przed reset). Pełne reguły: §0 planu wykonawczego.
- Branch roboczy: `feat/deliverables-w1` (lub nowy, jeśli Piotr założy — wtedy zaktualizuj tu).

---

## A. STATUS (Claude aktualizuje)
- **2026-06-29:** struktura dwóch strumieni założona. Claude gotowy ruszyć **FAZĘ I** (kanon nawigacji · fix M08 rail-undo · przegląd+flip flag · L4 quick-wins: handoff M14→M15 + tab „Dane") po zielonym świetle / lub od razu wg planu. Burn-down = macierz L1-L4.
- Aktualna faza: **I (start)**. Następny krok Claude: T2.1 kanon nawigacji + T4 quick-wins; równolegle generacja pakietów odbioru do sekcji B.

## B. ⬇ ZADANIA / PYTANIA DLA PIOTRA (Claude pisze)

### B1 — DECYZJE (odpowiedz albo zadziała default po 72h; PROD nigdy bez Ciebie)
- [2026-06-29] **D-A** zestaw GA-v1 → DEFAULT: M01–M09 · M12/M12A/M12B · M13–M17; reszta beta-po-starcie. · ⬜
- [2026-06-29] **D-B** CMMI/LEAN → DEFAULT: beta („wkrótce"), nie budować w v1. · ⬜
- [2026-06-29] **D-C** Tools v1-set → DEFAULT: 10 strategic + Dynamic SWOT. · ⬜
- [2026-06-29] **D-D** które flagi OFF włączyć na demo → DEFAULT: wszystkie zweryfikowane-gotowe (M14 Intelligence/What-If/Rollout/Benefits; M15 Strategic/AI/Portfolio/m14Handoff; M17 oba). · ⬜
- [2026-06-29] **D-E** M16 Valuations/Budgets → DEFAULT: legacy-OK w v1 (flaga), migracja V8 post-GA. · ⬜
- [2026-06-29] **D-F** M22 AI OS w GA? → DEFAULT: nie, internal-only (dbr77). · ⬜
- [2026-06-29] **D-G** promocja PROD → **BEZ DEFAULTU — czeka na Twoje jawne „tak"** (po GA-v1 zielonym). · ⬜
- [2026-06-29] **D-H** AI-guidance assessmentów (realne zasilanie LLM per framework DRD/SIRI/ADMA) → DEFAULT: tak. · ⬜

### B2 — ODBIORY (pakiety dopisywane przez Claude w Fazie I; Piotr odbiera seriami)
- [2026-06-29] Pakiety odbioru ~11 modułów (M05/06/07/09/M13/M15/M16/M17/M21/M23/M24/M27) — **w przygotowaniu** (Claude generuje w Fazie I, każdy = URL+kliknięcia+oczekiwane+screeny). · 🟡
- *(tu Claude dokłada gotowe pakiety jako osobne pod-wpisy)*

## C. ⬆ OD PIOTRA: odbiory / problemy / decyzje (Piotr pisze)
- *(pusto — Piotr dopisuje: odpowiedzi na D-*, odbiory ✅/🔴, problemy z demo z opisem co nie działa)*

---

## Jak wystartować oba agenty (dla Piotra)
1. **Consulty-dokończenie-Claude** (nowa sesja): pierwsza wiadomość → *„Jesteś Consulty-dokończenie-Claude. Przeczytaj `Harvard/wdrozenie-100/_KOORDYNACJA_CLAUDE_PIOTR.md` + `_PLAN_WYKONAWCZY_DOKONCZENIE_4TORY_2026-06-29.md` + macierz w `_STAN_PRACY_ODBIORY.md`. Realizuj Tory 2/3/4 od Fazy I. Zadania/pytania dla mnie pisz do sekcji B, czytaj sekcję C. Start."*
2. **Consulty-dokończenie-Piotr** (nowa sesja): pierwsza wiadomość → *„Jesteś Consulty-dokończenie-Piotr. Przeczytaj `Harvard/wdrozenie-100/_KOORDYNACJA_CLAUDE_PIOTR.md`. Pokaż mi pending zadania z sekcji B (decyzje + odbiory), prowadź mnie krok-po-kroku przez odbiory na demo, zapisuj wyniki/problemy do sekcji C."*
