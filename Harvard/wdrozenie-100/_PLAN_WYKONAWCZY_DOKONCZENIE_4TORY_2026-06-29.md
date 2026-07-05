# PLAN WYKONAWCZY — DOKOŃCZENIE CONSULTIFY (4 tory) — SSOT do końca

> **To jest jedyny dokument wykonawczy do DOKOŃCZENIA programu.** Samowystarczalny — nowy agent przejmuje stąd, bez wcześniejszej pamięci. Data: 2026-06-29.
> **Autorytet (kolejność prawdy):** TEN plik + macierz AS-IS w [`_STAN_PRACY_ODBIORY.md`](_STAN_PRACY_ODBIORY.md) (sekcja „🔬 MACIERZ 4 POZIOMÓW", skan z kodu 2026-06-29) **>** starsze sekcje per-moduł.
> **Cel:** skończyć. Złota ścieżka konsultanta działa end-to-end na demo + zestaw GA-v1 zielony + odebrany. Reszta = beta po starcie.

---

## 0. REGUŁY TWARDE (nie łamać — dla agenta)
- **PROD (centerbeam) ŚWIĘTY.** Zmiany prod tylko jawnie + osobna zgoda Piotra. Wszystko leci na **demo** (gałąź `demo`, `./scripts/deploy-demo.sh`). `.env.local` wskazuje prod — uważać.
- **Deploy demo:** token Railway API potrafi wygasnąć (→ `Not Authorized`); **fallback który działa: `git push origin HEAD:demo` → GitHub auto-deploy** (build ~5 min). Monitoruj `/api/health` gitSha. NIE w subshell `&` (ginie) — `run_in_background`.
- **Przed deployem zmian FE/importów: `vite build` LOKALNIE** (`NODE_OPTIONS=--max-old-space-size=8192 node node_modules/vite/bin/vite.js build`). tsc+vitest NIE łapią błędów resolucji bundlera (lekcja: alias-prefix `@tiptap/react` łamał subpath). NIE odpalaj wielu `tsc` naraz (kontencja + SIGPIPE z `| tail` ubija je).
- **Testy w `tests/`** (`/tests/` w .gitignore → `git add -f`; CI bierze tylko `tests/unit|integration|components`).
- **Branch współdzielony (`feat/deliverables-w1`), git-races REALNE** — `git fetch` + sprawdź `git log` przed reset/rebase; commity chirurgiczne per ścieżka; push fast-forward.
- **Cofalność:** każda logiczna zmiana = osobny commit. Weryfikuj przed „done" (UI → screen na demo, nie sam tsc).
- **`primary` = crimson #85182F** (NIE violet); chrome monochromatyczny (slate/navy); budżet czerwieni. NIE wprowadzaj crimson-leak.

## 1. FORMUŁA WYKONAWCZA (nie przerywamy do końca)

**Definicja KOŃCA (GA-v1):** na demo przechodzi cała złota ścieżka: **Czat → Ideas → Assessment → Tool → Inicjatywa → Wdrożenie → Rezultaty → Materiały**, na realnych danych; zestaw modułów GA-v1 ma w macierzy L1/L2/L4 ✅ (L3 ✅ dla Tools/Assess w zakresie v1); Piotr odebrał GA-v1; (osobno) zgoda na prod.

**Pętla (codziennie, aż KONIEC):**
1. **Agent** pcha Tory 2/3/4 autonomicznie (też nocą) → po każdym kroku: commit + deploy demo + live-verify + **odhaczenie komórki w macierzy** (`_STAN_PRACY_ODBIORY.md`).
2. **Piotr** drenuje Tor 1 (odbiory) + Kolejkę decyzji (§7) **kiedy ma czas** — bez przymusu godzinowego.
3. **Brak czasu Piotra NIE zatrzymuje programu:** każda decyzja ma **default** (§7); **jeśli Piotr nie odpowie w 72h, agent działa wg rekomendacji i odhacza** (poza promocją na PROD — ta zawsze czeka na jawne „tak"). Odbiory się kumulują w kolejce i Piotr je przechodzi seriami; build/sweep lecą niezależnie.

**Anty-sprawl (żeby nie leciało kolejny miesiąc):**
- **WIP = 1** w Torze 3 (build): jeden klaster do końca, nie 10 na 80%.
- **Zamrożenie zakresu:** M12A/M12B = OSTATNIE dodatki. Nowe pomysły → `_BACKLOG_POST_GA.md`, nie do bieżącego przebiegu.
- **Burn-down** = macierz L1-L4. Meta widoczna na jednym ekranie.

## 2. BURN-DOWN (scoreboard = macierz L1-L4)
Źródło: `_STAN_PRACY_ODBIORY.md` → „🔬 MACIERZ 4 POZIOMÓW". **Komórka → ✅ gdy:** L1 = nawigacja spójna z kanonem + brak martwych przycisków + gate ról jawny; L2 = akcje działają na realnym backendzie, live-verify na demo; L3 = tool/framework kompletny do klasy konsultanta (output e2e); L4 = integracja realna end-to-end (nie stub/flaga-OFF). Agent aktualizuje macierz po KAŻDYM kroku.

---

## 3. TOR 1 — DRENAŻ ODBIORÓW  ·  właściciel: PIOTR (async)  ·  agent: przygotowuje pakiety
**Cel:** ~11 modułów technicznie zielonych → ✅ odebrane, BEZ nowego kodu. Najszybsza wygrana.

**Agent (krok wstępny, robi od razu):** wygeneruj `_PAKIETY_ODBIORU/` — per moduł 1 ekran: *(a) URL na demo, (b) 3-6 kliknięć do zrobienia, (c) czego oczekiwać, (d) 1-2 screeny dowodowe załączone*. Moduły do pakietów (z macierzy L1✅/L2✅, czekają →F/→UI):

| # | Moduł | Uwaga do pakietu |
|---|---|---|
| 1 | M05 Ideas-Zarządzanie | lista+foldery+otwórz workspace |
| 2 | M06 Mind Map | utwórz węzły, persist po reload, convert |
| 3 | M07 Process Flow | (data-loss naprawiony) persist po reload |
| 4 | M09 Whiteboard | sticky/vote/convert |
| 5 | M13 Inicjatywy | charter→DRAFT→status→kanban/gantt |
| 6 | M15 Rezultaty | KPI/ROI (włącz flagi URL wg pakietu) |
| 7 | M16 Finanse | model/analiza→inicjatywa (closed beta — admin) |
| 8 | M17 Materiały | „Komplet AI" brief→bundle→ZIP (flagi ON) |
| 9 | M21 Meeting | CRUD + generate-notes |
| 10 | M23 Organizacja | profil/members |
| 11 | M24 Admin | 5 paneli |
| 12 | M27 SuperAdmin | sampling sekcji |

**Odbierane PO fixie (nie teraz):** **M08 Table** (po naprawie rail-undo, Tor 2), **M14 Wdrożenie** (po przeglądzie flag, Tor 2), **M10 Wywiad** (po live-verify server-STT na prodzie).
**DoD Tor 1:** każdy moduł z listy = ✅ →F (Piotr) + ✅ →UI. Odhaczone w macierzy + logu odbiorów.

---

## 4. TOR 2 — SWEEP L1 (nawigacja + uprawnienia + flagi)  ·  właściciel: AGENT  ·  Piotr: 1 odbiór UI/klaster
**Cel:** spójna nawigacja w całej apce + włączenie ukrytego gotowego kodu. Największy skok „wygląda na skończone".

**Kroki po kolei:**
1. **Kanon w 1 autorytet.** Scal `docs/ui-standards/CANON.md` + table-canon + `02-components/workspace-3-tools-strip.md` w jeden dokument nawigacji+uprawnień. Wzorzec referencyjny = **Notatnik** (hamburger ⋯, brak zdublowanych pasków, czyste menu — `NotebookContent`/`NotebookHamburgerMenu`).
2. **Fix M08 Table rail-undo (martwy).** Rail emituje `mm_undo`/`mm_redo` (`mindmap/CanvasLeftToolbar.tsx:201`), `useTableQuickActions` ich nie słucha; `mmCanUndo/Redo` karmione tylko `mm-undo-state` z mind mapy. → dodaj prefix `tbl_undo`/`tbl_redo` + podłącz `canUndo/canRedo` z tabeli (`table/useTableQuickActions.ts`, `IdeaTableTool.tsx:1154`). DoD: rail-undo w Table odzwierciedla historię tabeli.
3. **PRZEGLĄD FLAG (decyzja D-D) — włącz gotowy kod na demo.** Lista flag default-OFF chowających realne funkcje:
   - M14: `executionFeatureFlags.ts` — Intelligence / What-If / RolloutStages+Baseline+Cutover / BenefitsRegister. (`ganttBaseline` = flaga MARTWA, 0 wywołań → usuń.)
   - M15: `resultsFeatureFlags.ts` — Strategic / AI / Portfolio / **`m14Handoff`** (inbox handoffu — patrz Tor 4).
   - M17: `VITE_ENABLE_DELIVERABLES_LIGHT` (build-time) + `ENABLE_DELIVERABLES_PREMIUM` (backend) — OBA muszą być ON na demo, inaczej launcher cichy fallback / `/bundle*` 404.
   → włącz zweryfikowane-gotowe; live-verify każdą po flipie.
4. **Jawne bramki ról (M03/M04).** Pilot/permission-gate dla tabów notebook + inbox/tasks/decisions niejasny (`MyWorkHub` pilot-gate) → ujawnić/domknąć jawnie.
5. **Spójność hamburger-wzorca** w pozostałych toolbarach narzędzi (Ideas wspólny rail OK; sprawdź M12/M17/M14 toolbary).
**Gate:** Piotr robi 1 odbiór UI per klaster (Ideas / My Work / Inicjatywy-Wdrożenie-Rezultaty / Materiały). **DoD:** kolumna L1 w macierzy = ✅ dla wszystkich GA-v1; flagi przejrzane.

---

## 5. TOR 3 — BUILD L3 (Tools + Assessmenty)  ·  właściciel: AGENT  ·  WIP=1  ·  to jest długa noga
**Cel:** rdzeń konsultingowy z realną głębią. Dziś: Tools 1/~31 pewny e2e, Assessmenty 2/5 osiągalne.

### 3A — Assessmenty (M12B) — start od tego (koncepcje gotowe)
SSOT: `docs/product/ASSESSMENT_CONCEPT_V4_2026-06-28.md` + `ASSESSMENT_IMPLEMENTATION_PLAN_2026-06-28.md`. Stan AS-IS (z kodu):
- **DRD, SIRI** = kompletne (forma+mapa+raport: `DRDReportTemplate`/`SIRIReportTemplate`). **Domknąć:** warstwa AI-guidance (dziś `useAssessmentAI` framework-agnostic, `*Knowledge.ts` = statyczne tablice display-only → realne zasilanie promptu LLM per framework, JEŚLI to cel — decyzja jakości).
- **ADMA** = kompletny ale **`coming_soon`** w pickerze (`AssessmentView.tsx:82,92,102`) → **odbramkować** (kod gotowy).
- **CMMI** = wydmuszka (brak `cmmiKnowledge.ts`, `knowledgeBase:false` w `frameworkRegistry.ts:381`, forma kopia ADMA). **LEAN** = mocna struktura (`dbr77LeanStructure.ts`) bez warstwy doradczej. → **decyzja D-B** (default: oznaczyć szczerze „beta/wkrótce", NIE udawać; build CMMI/LEAN poza v1).
- **DoD 3A:** DRD+SIRI+ADMA osiągalne i kompletne do klasy konsultanta (raport+mapa+guidance), CMMI/LEAN szczerze oznaczone. Live-verify każdy na demo.

### 3B — Tools (M12A)
SSOT: `docs/product/CONSULTING_TOOLS_STANDARD_V1.md` + `TOOLS_V8_SSOT.md` + `toolAssetsRegistry.ts` (31 slugów). Stan AS-IS:
- **1 pewny e2e: Dynamic SWOT** (`tools/DynamicSWOT/`, mission→input→swot→insights→outputs, governance, generate-initiatives). To wzorzec.
- ~14-16 z runtime w `ToolCanvas` ale **output niezweryfikowany**; ~15 = `GenericToolDocumentView` (read-only stub); tylko 10 `*LibraryGraphic.tsx`.
- **Decyzja D-C: v1-set** (default: 10 strategic + Dynamic SWOT). → dla v1-set: domknąć runtime+output do klasy konsultanta (wzorzec SWOT) + grafiki; reszta jawnie „wkrótce" (nie martwy „uruchom").
- **DoD 3B:** każdy tool z v1-set przechodzi e2e do outputu + generate-initiatives; pozostałe szczerze oznaczone. Live-verify.

---

## 6. TOR 4 — KRĘGOSŁUP L4 (integracja)  ·  właściciel: AGENT  ·  małe celne, między sweepami
**Cel:** „jeden deliverable → rejestr Outputs" + ożywić martwe spięcia.
1. **M14→M15 handoff (MARTWY).** `emitResultsHandoffEvent` (`executionVisibilityService.ts:314`) = **zero wywołań**. Pomost benefits-register istnieje po stronie M15 ale za flagą `m14Handoff`=OFF. → wpiąć emit w realny moment (benefit/cutover) + flip flagi (Tor 2). DoD: benefit z M14 ląduje w M15 inbox.
2. **Eksport-do-Outputs (rozjechany).** (a) M13 materialize (`initiativeMaterialize.routes.ts:58`) generuje pliki ale **nie zapisuje do rejestru** → zapis do `deliverable_bundles`/Outputs. (b) M14 „PDF" (`executionReports.ts:358`) = faktycznie Markdown → realny PDF. DoD: deliverable z M13/M14 widoczny w rejestrze Materiałów.
3. **M17 tab „Dane" (MARTWY FE).** `src/services/materialData.ts` istnieje (connectors/forms, realny backend) ale **niezaimportowany** → wpiąć zakładkę „Dane" + upload-UI. DoD: tab „Dane" żywy.
4. **M16 split-brain (decyzja D-E).** Valuations+Budgets idą TYLKO legacy `/economics/*` (`useFinanceData.ts:142,159`). Default: zostawić legacy w v1 za flagą (świadomie), migracja V8 = post-GA.

---

## 7. KOLEJKA DECYZJI (Piotr — wsadowo; **default jeśli brak odpowiedzi 72h**)
| ID | Decyzja | Rekomendacja / DEFAULT (po 72h agent działa wg tego) |
|---|---|---|
| D-A | Zestaw GA-v1 | **M01–M09 · M12/M12A/M12B · M13–M17.** Reszta (M21/M22/M23-25/M26/M27) = beta-po-starcie. |
| D-B | CMMI / LEAN | **Beta — szczerze oznaczyć „wkrótce", NIE budować w v1.** Build poza GA. |
| D-C | Tools v1-set | **10 strategic + Dynamic SWOT.** Reszta „wkrótce". |
| D-D | Które flagi OFF włączyć na demo | **Wszystkie zweryfikowane-gotowe** (M14 Intelligence/What-If/Rollout/Benefits; M15 Strategic/AI/Portfolio/m14Handoff; M17 oba). |
| D-E | M16 Valuations/Budgets | **Legacy-OK w v1 (flaga); migracja V8 = post-GA.** |
| D-F | M22 AI OS w GA? | **Nie — internal-only (dbr77), poza GA.** |
| D-G | Promocja PROD | **Tylko po GA-v1 zielonym + osobna jawna zgoda Piotra** (NIGDY default-auto). |
| D-H | Assessment AI-guidance | **Tak, realne zasilanie LLM per framework dla DRD/SIRI/ADMA** (inaczej „assessment" jest płytki). |

---

## 8. SEKWENCJA OD POCZĄTKU DO KOŃCA (po kolei)
> Fazy, nie sztywne daty (Piotr nie gwarantuje 5h/dzień — i OK). Agent pcha niezależnie; Piotr drenuje równolegle.

- **FAZA I (fundament + szybkie wygrane).** Agent: kanon nawigacji (T2.1) · fix M08 rail-undo (T2.2) · przegląd+flip flag (T2.3) · L4 quick-wins: handoff M14→M15 (T4.1) + tab „Dane" (T4.3) · **wygeneruj pakiety odbioru (Tor 1) + tę kolejkę decyzji**. Piotr: odbierz klaster Ideas (M05-M07,M09) + odpowiedz kolejce decyzji.
- **FAZA II (sweep + drenaż + start build).** Agent: dokończ L1 sweep (T2.4-2.5) · L4 eksport-do-Outputs (T4.2) · **start Tor 3A Assessmenty** (ADMA odbramkuj, DRD/SIRI guidance). Piotr: odbierz M13/M15/M16/M17 + M08/M14 (po fixach).
- **FAZA III (build L3 głębia).** Agent: dokończ 3A (DRD/SIRI/ADMA klasa konsultanta) → **3B Tools v1-set** (SWOT-wzorzec na 10 strategic). Piotr: odbieraj assessmenty + toole seriami; live-verify M10 server-STT.
- **FAZA IV (domknięcie + start).** Agent: przejazd **złotej ścieżki E2E** na demo (dowód całości) + ostatnie L4/i18n/klasa wizualna. Piotr: finalny odbiór GA-v1 → **decyzja D-G: zgoda na prod** → promocja demo→Londyn→prod (za jawną zgodą).

**KONIEC = Faza IV odebrana.** Wtedy reszta (beta) otwiera się jako osobny, spokojny przebieg po starcie.

---

## 9. HANDOFF DLA NOWEGO AGENTA (gdy kontekst się przeniesie)
1. Przeczytaj: TEN plik → macierz w `_STAN_PRACY_ODBIORY.md` (sekcja MACIERZ 4 POZIOMÓW) → `_PLAN_DOKONCZENIA_3POZIOMY_2026-06-29.md`. `git log --oneline -20`.
2. Znajdź **pierwszą nieodhaczoną komórkę/krok** wg §8 → kontynuuj. WIP=1 w Torze 3.
3. Po każdym kroku: commit (cofalny) → `vite build` lokalnie (jeśli FE) → deploy demo (`git push origin HEAD:demo`, czekaj na auto-deploy/health) → live-verify → **odhacz macierz**.
4. Decyzje Piotra: §7. Brak odpowiedzi 72h → default (poza D-G prod). Pakiety odbioru: `_PAKIETY_ODBIORU/`.
5. Reguły twarde: §0. NIE prod bez zgody. NIE crimson-leak. Testy w `tests/` (`-f`). Git-races realne.

---

## 10. STATUS WYKONANIA (agent odhacza tu na bieżąco)
- [ ] FAZA I — kanon / M08 / flagi / L4 quick-wins / pakiety odbioru / kolejka decyzji
- [ ] FAZA II — L1 sweep done / eksport-Outputs / Assessmenty start
- [ ] FAZA III — Assessmenty v1 done / Tools v1 done
- [ ] FAZA IV — złota ścieżka E2E / GA-v1 odebrany / (zgoda) prod
