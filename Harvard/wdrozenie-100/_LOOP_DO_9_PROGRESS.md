# PĘTLA DO 9,0 — dziennik ciągłości (DOKUMENTY: Deck/Word/Excel + 3 generatory)

> **Cel (mandat Piotra, noc 2026-07-22→23):** średnia gotowości DOKUMENTY = **9,0/10**.
> „Pracuj w loopie wieloma agentami, rób notatki .md na wypadek końca kontekstu, działaj aż osiągniesz 9,0."
> Ten plik = ŹRÓDŁO PRAWDY dla następnego okna kontekstowego. Czytaj go PIERWSZY.

## STAN STARTOWY (2026-07-23, przed pętlą)
Średnia **6,3/10**. Per narzędzie (5 osi: Menu·Nawigacja·Funkcja·Merytoryka·Grafika):
| Narzędzie | Śr. | Menu | Nawig | Funkcja | Meryt | Grafika |
|---|---|---|---|---|---|---|
| Deck | 7,8 | 8 | 8 | 8 | 7 | 7 |
| Word | 7,2 | 7 | 7 | 8 | 7 | 7 |
| Excel | 7,0 | 8 | 8 | 6 | 6 | 7 |
| Gen. Deck | 5,2 | 6 | 6 | 6 | 4 | 4 |
| Gen. Word | 6,4 | 7 | 7 | 7 | 5 | 5 |
| Gen. Excel | 4,4 | 5 | 5 | 4 | 4 | 4 |

Raport wizualny (artifact, aktualizowany po każdej fali): `claude.ai/code/artifact/0c35724d-fa0d-42e5-a24c-e19e37e6e01f`
Plik źródłowy raportu (scratchpad sesji): `audyt-gotowosci-dokumenty.html`.
Handoff poprzedni: `[[gendeck-genexcel-nadganianie-2026-07-23]]` (memory), `[[dokumenty-plan-do-10-decyzje-2026-07-22]]`.

## ★ ŻELAZNE REGUŁY (nienaruszalne — łamanie = katastrofa)
1. **Reguła #7: Piotr NIGDY nie jest pierwszym testerem wizualnym.** Każdą powierzchnię wizualną
   renderuję JA (dev-render harness, mock danych, bez logowania) + robię ZRZUT + weryfikuję light+dark
   ZANIM Piotr zobaczy. Wygląd tylko za flagą **default OFF** do jego akceptu. **NIE przełączam flag
   wizualnych na domyślne bez akceptu Piotra na zrzutach.** Nowe powierzchnie z zasady wymagają jego
   wstępnego OK na koncept — dla takich: buduję za flagą, składam zrzut, OZNACZAM „czeka na koncept-OK".
2. **Baza gałęzi ZAWSZE `origin/demo`.** Nigdy lokalny checkout (jest ~2000 commitów za demo). Zawsze
   `git fetch origin demo` + pre-flight przed pushem (demo żyje pod wieloma sesjami — merge, NIGDY force-push).
3. **Robotnicy (agenci fal) NIE PUSHUJĄ.** Budują w izolowanym worktree z origin/demo, commit lokalny,
   zwracają nazwę gałęzi. Merge + render-verify + push robi NADZORCA (główna sesja) po weryfikacji.
4. **Weryfikuj REALNY runtime, nie flagi/docy.** esbuild per-plik (NIE pełny tsc), targeted vitest.
   Nie zawyżaj ocen — każdy skok punktu MUSI mieć realną, zweryfikowaną zdolność (uzasadnienie w logu fal).
5. **Modele:** Sonnet/Haiku do mechaniki, Opus tylko trudny kod. Robotnicy: zero sub-agentów.
6. **Dane demo = twarz produktu:** probe'y sprzątają po sobie, zero rekordów testowych na demo.

## ★ HARNESS dev-render (pułapki — MUST READ przed render-verify)
- Uruchom z repo-roota worktree: `npx vite --config dev-render/vite.config.ts --port <PORT>`.
- URL: `http://localhost:<PORT>/?screen=<klucz>&lang=pl&theme=light|dark`. Ekrany rejestrowane w `dev-render/main.tsx`.
- **PUŁAPKA 1:** `main.tsx` statycznie importuje WSZYSTKIE ekrany; kilka robi `Api.get = …` na top-level →
  ostatni klobuje realny HTTP. Mock `window.fetch` NIE zadziała. ROZWIĄZANIE: patchuj METODY `Api.get/post/put`
  w useEffect ekranu (runtime, przy mount), z disposerem. Wzorzec: `dev-render/screens/karta-task.tsx`,
  `gen-deck-content-hints.tsx` + `dev-render/mocks/presentationTemplateArchitectMocks.ts`.
- **PUŁAPKA 2:** po wielu edycjach na żywo Vite HMR gubi stan → restart z `--force` (busta esbuild dep-cache).
- Zawsze weryfikuj light I dark (przełącznik `consultify-storage.state.theme` w localStorage lub `&theme=`).

## ★ WORKTREE „armia" (wzorzec fal)
Każdy robotnik: `git fetch origin demo` → `git worktree add /private/tmp/army-<key> origin/demo -b feat/<key>`
→ symlink node_modules z MAIN → praca → esbuild+vitest → commit (NIE push) → raport {branch, pliki, testy, flaga, needsRenderVerify}.
Worktree integracyjny nadzorcy: `/private/tmp/loop-integration` (branch `loop/integration`), merge tam + push.
Sprzątanie worktree po scaleniu: `git worktree remove <path> --force`.

## ★ INWENTARZ DŹWIGNI DO 9,0 (per narzędzie — aktualizuj status)
Legenda: ⬜ do zrobienia · 🔨 w budowie · ✅ scalone+zweryfikowane · 🅰️ czeka akcept Piotra (flaga OFF)

### Gen. Excel (4,4 → 5,6 po W1 → cel 9) — największy dystans
- ✅ W1 registry: +2 szablony (operatingBudget, dcfValuation; 1→3 wzorce) — backend, żywe formuły, 44 testy. demo d410918a1e
- 🅰️ W1 nav: zakładka „Generator szablonów Excel" w hubie (flaga ff_workbook_templates OFF) — render-verify PASS light+dark, CZEKA AKCEPT+flip
- 🔨 W2 templates2: +2 wzorce (breakEven, cashflow12m) — backend
- 🔨 W2 preview: inline podgląd siatki wyniku po buildzie (reuse getWorkbookSchema+workbookGridPreview) — Grafika
- ⬜ LLM-asystent autorstwa szablonu (opis→params+formuły) — Merytoryka
- ⬜ Meta-edytor params istniejącego wzorca (UI) — Funkcja
- ⚠️ ZNALEZIONE: ExceleParametricTemplates pokazuje percent×100 w polach (default 3%→„300") — pre-existing C3 bug, do audytu osobno

### Gen. Deck (5,2 → 5,6 po W1 → cel 9)
- ✅ content hints per slajd (cc24229b4b)
- ✅ W1 delete/deprecate draftu (przycisk danger) + podgląd recommended_visuals/must_have_intents (chipy c-*) — render-verify PASS. demo d410918a1e
- ⬜ LLM głębia treści per slajd (bullet drafts, nie tylko tytuł+hint) — Merytoryka
- ⬜ Podgląd miniatur/layoutu slajdów — Grafika
- ⬜ Więcej rodzin bazowych + autorstwo nowej rodziny

### Gen. Word (6,4 → cel 9)
- 🔨 W2 content hints per sekcja (analog deck) — Merytoryka
- ⬜ Podgląd struktury/bloków szablonu — Grafika
- ⬜ Delete/deprecate + polish edytora struktury

### Excel (7,0 → 9)
- ✅ podgląd komórek+formuł (B3, poprzednie fale)
- ⬜ Grounding do promptu z runu (rozszerzyć pokrycie) — Merytoryka
- ⬜ Więcej dopasowań szablonów z czatu (matchWorkbookTemplate coverage) — Funkcja
- ⬜ Wykresy/wizualizacja wyniku — Grafika

### Word (7,2 → 9)
- ✅ QA fabrykacja-bramka (A3), auto-wersje (E1)
- ⬜ Merytoryka: głębia prose + grounding polish
- ⬜ UI historii wersji + komentarze klienta (F1/F3 polish)

### Deck (7,8 → 9)
- ✅ root-cause treści, quality gates (A4), slajd Wnioski (E2)
- ⬜ Merytoryka: surfacing critic/M19 w UI (nie tylko warning)
- ⬜ Wizualizacje/wykresy w slajdach

## ★ LOG FAL (dopisuj po każdej fali — najnowsza NA GÓRZE)

### Fala 3 — URUCHOMIONA (workflow wkrp7w510)
genexcel-templates3 (+2 wzorce: unitEconomics, loanAmortization), gendeck-slide-preview (sylwetka layoutu/slajd), genword-structure-preview (sylwetka struktury dok.). 🔨 w budowie.

### Fala 2 — ✅ SCALONA (workflow wavodm809, demo 498ce9d5ef)
3/3, 0 błędów. Zweryfikowane niezależnie: 89 testów backend + esbuild + render-verify 3 powierzchni light+console-clean.
- genexcel-templates2: WORKBOOK_TEMPLATES 3→5 (breakEven, cashflow12m; żywe formuły, krytyk 0 issues, 72 testy). Backend.
- genexcel-preview: inline podgląd siatki wyniku po buildzie w ExceleParametricTemplates (reuse getWorkbookSchema+workbookGridPreview z B3). Render-verify PASS: siatka z zakładkami arkuszy + formuły mono (=y1*1.12, =SUM). Za ff_excele (istniejąca). ⚠ drobne: zakładki „Sheet 1/2" zamiast nazw arkuszy (pre-existing workbookGridPreview default).
- genword-hints: contentHints per sekcja Word (analog deck) + edytor „Content guidance" per sekcja. Render-verify PASS (nowy ekran gen-word-content-hints, mock window.fetch). Za ff_tpl_editor (istniejąca). 17 testów.
Oceny: Gen.Excel 5,6→6,2 (Meryt 6→7 5 wzorców, Funkcja 5→6 + Grafika 5→6 podgląd); Gen.Word 6,4→6,6 (Meryt 5→6, Grafika 5→6). Średnia 6,6→6,7.

### Fala 1 — ✅ ZAKOŃCZONA + SCALONA (workflow wrort4or3, demo d410918a1e)
3 robotnicy, 0 błędów. Zweryfikowane NIEZALEŻNIE przez nadzorcę (nie ufając raportom): 44 testy backend (registry+regresja) + 3 testy FE (deprecate), esbuild wszystkich plików PASS, tree czysty.
- genexcel-registry: WORKBOOK_TEMPLATES 1→3 (operatingBudget, dcfValuation; żywe formuły ExcelJS, krytyk jakości 0 issues). Backend, brak flagi.
- genexcel-nav: zakładka huba „Generator szablonów Excel" za flagą ff_workbook_templates (OFF). Render-verify PASS: 3 wzorce jako karty + formularz params + build CTA, light+dark. 🅰️ CZEKA na akcept Piotra + flip flagi.
- gendeck-architect-plus: przycisk „Withdraw/delete draft" (danger, tylko draft) + bloki chipów „Suggested visualizations"/„Mandatory slides". Render-verify PASS light. Za istniejącą ff_deck_architect.
Oceny: Gen.Excel 4,4→5,6 (Meryt 4→6 registry live, Menu/Nav 5→6 nav-za-flagą, Funkcja 4→5, Grafika 4→5); Gen.Deck 5,2→5,6 (Funkcja 6→7 delete, Grafika 4→5 chipy). Średnia 6,3→6,6.
Dev-render: reuse gen-deck-content-hints (deck) + nowy gen-excel-templates-tab + mock workbookTemplatesMocks.

---
## ZASADY DOPISYWANIA DO TEGO PLIKU
Po każdej fali: (1) zaktualizuj status dźwigni w inwentarzu, (2) dopisz wpis do LOG FAL z SHA merge/commit,
(3) zaktualizuj tabelę „stan bieżący" poniżej, (4) zaktualizuj artifact raportu + memory.
Jeśli kontekst się kończy: następca czyta ten plik + memory `[[loop-do-9-2026-07-23]]`, robi `git fetch origin demo`,
sprawdza `git worktree list`, kontynuuje z inwentarza (najniższe średnie najpierw: Gen.Excel → Gen.Deck → Gen.Word).

## STAN BIEŻĄCY (aktualizuj)
Średnia: **6,7** → cel 9,0. Ostatni SHA demo: `498ce9d5ef` (fala 2). Fal ukończonych: 2. Fala 3 w toku (wkrp7w510).
Per narzędzie: Deck 7,8 · Word 7,2 · Excel 7,0 · Gen.Deck 5,6 · Gen.Word 6,6 · Gen.Excel 6,2.
🅰️ Czeka na akcept Piotra (flip flag po zrzutach): ff_workbook_templates (zakładka Gen.Excel). Reszta iteracji za istniejącymi flagami ON.
Dev-render ekrany: gen-deck-content-hints, gen-excel-templates-tab, gen-word-content-hints. Port bieżący 3027 (--force gdy HMR gubi).
