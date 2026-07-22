# PROMPT / BRIEF DLA NASTĘPNEJ SESJI — grupa DOKUMENTY (Consultify)
**Data przekazania:** 2026-07-22 · zmiana planu taryfowego, poprzednia sesja (Opus 4.8) skończyła okno kontekstu. Ten plik jest samodzielny — masz w nim wszystko, żeby ruszyć bez tej rozmowy. Skopiuj sekcję „PROMPT DO WKLEJENIA" na koniec jako pierwszą wiadomość, resztę czytaj jako brief.

---

## 1. KIM JESTEŚ, KIM JEST PIOTR, JAK Z NIM PRACOWAĆ
- Jesteś sesją roboczą/CTO Consultify — AI-native systemu realizacji doradztwa (nie generyczny SaaS-dashboard). Kontynuujesz grupę **DOKUMENTY**: narzędzia **Prezentacja (Deck) · Word/Raport · Excel/Arkusz** + ich **generatory template'ów**.
- **Piotr = właściciel, product/strategy, NIE-KODER.** Komunikacja PO POLSKU, krótko, obrazkami/zrzutami. Chce żebyś **działał autonomicznie** („decyduj sam, jedź w pętli, wypuszczaj wielu agentów, nie pytaj co krok"). Jedyna rzecz ZA KAŻDYM RAZEM na świeże „tak": **deploy na demo**.
- **★ Piotr NIGDY nie jest pierwszym testerem wizualnym** (nienaruszalne — powód: załamanie 07-11 „gwiazda"). Zanim pokażesz JAKIKOLWIEK ekran: sam wyrenderuj + zrób zrzut (dev-render/harness albo Claude-in-Chrome), pokaż do AKCEPTU, nie do odkrywania zepsucia. Zakaz „włącz i zobacz" jako pierwszego sprawdzenia.
- Co go wkurza (unikaj): pokazywanie mu kaszanki/mocka udającego dobry output; „testy przeszły" zamiast realnego dowodu; audyt który się zestarzał i zawyża; tabelki „jak dla trzylatka”.
- Co lubi (rób): metoda **oczekiwanie-vs-wynik na OBEJRZANYM artefakcie**; before/after na żywym demo; szczerość („to jest kaszanka, oto DLACZEGO”); wielu agentów równolegle.

## 2. KONTEKST PRODUKTU — koncepcja 3 TRYBÓW (SSOT: `_DOKTRYNA_POWSTAWANIA_ARTEFAKTOW.md`)
Każde wejście do narzędzia ma 3 tryby: **① CZYSTO** (ręcznie, pełna edytowalność) · **② z AI** (dialog z Teresą buduje artefakt) · **③ z TEMPLATE** (wielorazowy szablon). Stąd potrzeba **generatorów template'ów** = *AI tworzy szablon z rozmowy* ORAZ *ręczny edytor szablonu*. Reguła §6.2 doktryny: **pierwsza wersja MUSI być akceptowalna** (pełny pipeline z REVIEW zanim user zobaczy). Progi jakości = benchmarki: **Prezentacja→Gamma lub lepiej · Word→„wyznacznik sam w sobie" (dokument konsultingowy klasy partnerskiej) · Excel→analityk PE (żywe formuły, rygor 5-fazowy)**.

## 3. CO SIĘ STAŁO W TEJ SESJI (historia, żebyś rozumiał „dlaczego")
1. **Audyt grupy DOKUMENTY.** Werdykt: wejście przez czat (Teresa) było **atrapą prawdziwych silników** — odrzucało intent użytkownika i odbiorcę, omijało gotową, dobrą maszynerię, a silnik siedział podłączony do INNEGO wejścia (Kreator/Formularz). Przykłady: deck z czatu hardkodował `audience:'internal'` i wyrzucał cały `intent` → generyczny szablon; Word z czatu nie znał odbiorcy (pole audience zbierane, do promptu nie trafiało); Excel „stwórz arkusz" robił tabelkę Markdown zamiast arkusza z formułami (silnik 5-fazowy istniał, ale osierocony — `/excele` redirect na `/tabele`). Dok: `_AUDYT_DOKUMENTY_2026-07-22.md`.
2. **Naprawa audytu → WDROŻONA na demo** (gitSha `533d353896`, merge nie force). Deck brief z czatu (audience/goal/tytuł), deck#2 grounding intentem, Word audience z czatu, Word domyślnie treść (useLlm ON), Excel silnik za flagą `?ff_excele=1`. Zweryfikowana na żywym demo Twoją przeglądarką (Claude-in-Chrome) — deck jednak dalej pisał „brak danych" (bo brak trybu założeń §0.3, który MA Word) → to wyznaczyło Falę A.
3. **Framework 6 narzędzi** (3 narzędzia + 3 generatory template'ów; 5 osi: Menu·Nawigacja·Funkcja·Merytoryka·Grafika; 0–10 PRZED→PO). Oceniony z dowodami (3 agenci per rodzina). **Piotr ZAAKCEPTOWAŁ kryteria+progi.** Dok: `_FRAMEWORK_6_NARZEDZI_DOKUMENTY_2026-07-22.md`.
4. **Fala A/B/C zbudowane** (3 równolegli agenci) i **skonsolidowane** w gałąź `integr/dokumenty-fala-abc`. Szczegóły niżej.

## 4. STAN TECHNICZNY (DOKŁADNIE)
- **origin/demo = `533d353896`** — Railway auto-deploy serwis `consultify`, env demo, baza TROLLEY. Żyje na https://demo.consultify.ai (`/api/health` pokazuje gitSha/branch). Zawiera naprawę audytu (nie Falę A/B/C).
- **★ Gałąź do deployu: `integr/dokumenty-fala-abc`** (od origin/demo, 20 commitów, 18 plików kodu +1793/−105, NIE pushowana). Scala 4 workstreamy:
  - **Fala A merytoryka:** `849c9ce876` Word format założeń (inline „(założenie)" zamiast „Assumption:" co zdanie) · `21ac83f2a7` Excel grounding (sourcePack→prompt, koniec „[object Object]") · `2967d0932c` Deck koniec „brak danych" (user_instruction z założeniami).
  - **Fala B Excel:** `c6e6421684` §0.3 w prompcie WorkbookGeneratorService · `42badc1149` podłączenie `WORKBOOK_TEMPLATES`/`matchWorkbookTemplate` (był fantom bez callerów) · `0c995db458` odblokowanie „zapisz jako szablon" arkusza (enum `sheet_template`, `deliverableTemplateService` branch `'table'`, 409 zdjęte).
  - **Fala B Deck:** `da53e8a17e` nowy `presentationTemplateDraftService.ts` + `POST /api/presentations/templates/plan` (AI-draft outline szablonu, wzorzec Word).
  - **Fala C grafika:** tokeny `c-*` w `DeckTemplateGallery.tsx` (14) + `PresentationTemplateGovernanceView.tsx` (31).
  - Kolizja Excel A3↔§0.3 rozwiązała się auto-czysto (różne rejony pliku, obie zmiany współistnieją — zweryfikowane grepem+esbuild).
- **Gałęzie źródłowe** (zachowane): `prod/word-wzorzec-merytoryka`, `wip/excel-engine-template`, `wip/falab-deck-template-backend`, `wip/falac-tokeny-galerie`.
- **Punkt cofania** (przed deployem audytu): `a42ee33280`. NIGDY force/reset na demo.
- **Worktree:** `.worktrees/audyt-dokumenty-2026-07-22` (od origin/demo). **node_modules = symlink** do głównego repo (potrzebny do esbuild/tsx/vite — jak brak, `ln -s <mainrepo>/node_modules node_modules`).
- **Weryfikacja offline:** `npx esbuild <plik> --format=esm --outfile=/dev/null` (dla .tsx dodaj `--loader:.tsx=tsx --jsx=automatic`). Testy pure: `npx vitest run <plik.test.ts> --config vitest.config.ts`. **NIGDY pełny tsc/vitest (OOM).**
- **Dev-render (zrzuty bez logowania):** `preview_start {name:"audyt-dokumenty-render"}` (launch.json, port 3021) → nawiguj `?screen=<nazwa>&theme=light|dark`. Ekrany w `dev-render/screens/`, rejestr `dev-render/main.tsx`. Podgląd blokuje loopback przez `navigate` — używaj `preview_start` name; theme przełączasz JS-em `window.location.href=...&theme=dark`. ExceleView wymaga owinięcia w QueryClientProvider+MemoryRouter (patrz `dev-render/screens/excele-engine-reveal.tsx`).
- **Weryfikacja LIVE (treść/wizual — nie da się offline, brak LLM lokalnie):** Claude-in-Chrome (`mcp__claude-in-chrome__*`, ładuj przez ToolSearch) — Piotr jest zalogowany na demo.consultify.ai (Browser 1). Czat Auto (nie tryb „Presentations" — to przekierowuje do modułu, nie generuje!) → wpisz prośbę → Enter → deck/dokument/arkusz generuje się w panelu. Czytaj treść przez `read_page` (drzewo a11y), nie tylko zrzut.

## 5. FRAMEWORK — karta wyników PRZED→PO (progi = benchmarki)
| Narzędzie | Śr. PRZED | Największa luka | Fala A/B/C |
|---|:---:|---|---|
| Word/Raport #5 | 6.2 | najbliżej — polish (format założeń✅, wersje, tryb klienta) | A✅ |
| Deck #4 | 4.6 | merytoryka 3 (grounding) — A2✅; 4/5 bramek jakości martwe (Fala C) | A✅ |
| Excel #6 | 3.4 | silnik realny ODŁĄCZONY (grounding✅A3, split-brain czat→markdown ZOSTAJE) | A✅ B✅ |
| Gen.tpl Word #2 | 4.4 (zaniżone) | **MA frontend** Template Architect — domykać nie budować | — |
| Gen.tpl Prezentacji #1 | 2.0 | był fantom — backend `/templates/plan` dobudowany B✅; FE do zrobienia | B✅(backend) |
| Gen.tpl Excel #3 | 2.0 | fundament `WORKBOOK_TEMPLATES` podłączony B✅; FE do zrobienia | B✅ |

## 6. NASTĘPNE KROKI (kolejność)
1. **Deploy `integr/dokumenty-fala-abc` na demo** — ZA „tak" Piotra. Procedura = skill `consultify-promocja-demo` (runbook też w `_HANDOFF_FALA_A_2026-07-22.md`): `git fetch origin demo` → zapisz punkt cofania → pre-flight `git merge-tree $(git merge-base origin/demo HEAD) origin/demo HEAD | grep -E '^(<<<<<<<|CONFLICT|changed in both)'` → merge w izolowanym worktree `/private/tmp/promote-demo` (--no-ff) → twarda weryfikacja `git diff --stat origin/demo` (dokładnie 18 plików) → esbuild dotkniętych → `git push origin HEAD:demo` → monitor `curl -s https://demo.consultify.ai/api/health` aż gitSha=nowy. **UWAGA: partia zawiera zmianę wymagającą migracji bazy `20260412_seed_business_templates.sql`** dla „zapisz jako szablon" arkusza (constraint `sheet_template`) — sprawdź czy migracja jest zaaplikowana na TROLLEY przed testem round-trip.
2. **Live-verify po deployie** (Claude-in-Chrome, zrzuty before/after): (a) deck z czatu — bez „brak danych", konkret z „(założenie)"; (b) dokument — bez „Assumption:" co zdanie; (c) arkusz — grounding + „(założenie)", `matchWorkbookTemplate` odpala na „model 3-scenariusze RZiS" i milczy inaczej; (d) round-trip „zapisz jako szablon" arkusza; (e) dev-render galerii dark+light. → akcept Piotra.
3. **Dalej:** FE generatorów template'ów (Word Template Architect istnieje — domknij + klon na Deck/Excel na dobudowanych backendach); Fala C reszta (3 tryby jawne, /excele w sidebar po akcepcie, powłoka SPEC-A Excel, storage P0). Backlog: `_HANDOFF_FALA_B/C_*.md`.

## 7. PUŁAPKI I CZEGO NIE DUBLOWAĆ (złota reguła: weryfikuj RUNTIME nie docy — audyty starzeją się w 3 dni)
- **JUŻ NAPRAWIONE 07-19 (nie ruszaj):** Deck ← powrót (`DeckBuilder.tsx:317,1187`), tryb prezentera (`:1205`), `media` w rightRail to zamierzony guard nie bug, crimson-sweep chrome Decka. Karta wyników Decka Menu/Nawigacja była ZANIŻONA.
- **Generator Word MA frontend** (`DocumentStudioTemplateArchitectView.tsx`, 516 linii, wpięty `DocumentStudioView.tsx:394`) — NIE buduj od zera, domykaj.
- **Sprzeczność do rozstrzygnięcia:** `server/.../documentStudioTypes.ts:7` mówi „Mode 2/3 deferred", ale kod Mode 2/3 istnieje — zweryfikuj na żywym demo czy Mode 3 (generacja z szablonu) realnie działa.
- **Flagi bywają fantomami** (reguła w kodzie, zero callerów): `WORKBOOK_TEMPLATES` był taki (podłączony w tej sesji), Deck `PUT outlineJson` bez callerów FE. Grepuj realnego callera zanim powiesz „działa".
- **Zmiany promptów są GLOBALNE** (persona/generatory dotykają każdej odpowiedzi Teresy) → treść Piotr akceptuje na żywym LLM PRZED „done". NIE zmyślaj że zweryfikowane — rozróżniaj offline (kod/esbuild/test) vs live (treść/wizual).
- **NIE loguj się za Piotra** (zasada: nie dotykasz haseł) — do live używaj JEGO zalogowanej sesji Chrome. NIE kasuj trwale danych — test-rekordy na demo (deck `ac227fdea0` + ~2 dokumenty) zgłoś Piotrowi, nie usuwaj sam.
- **Railway CLI** bywa podlinkowany do innego projektu (Pitchdeck/production) — NIE ruszaj; monitoruj przez health endpoint.

## 8. PLIKI-KOTWICE
- Master: `Harvard/wdrozenie-100/_HANDOFF_DOKUMENTY_2026-07-22.md` (§1b = gałęzie, §6b = korekty).
- `_HANDOFF_FALA_A_2026-07-22.md` (diffy Fali A + runbook + live-verify PASS/FAIL) · `_HANDOFF_FALA_B_*.md` (generatory template'ów) · `_HANDOFF_FALA_C_POLISH_2026-07-22.md`.
- `_FRAMEWORK_6_NARZEDZI_DOKUMENTY_2026-07-22.md` · `_AUDYT_DOKUMENTY_2026-07-22.md` · `_DOKTRYNA_POWSTAWANIA_ARTEFAKTOW.md` · `docs/product/REPORTS_AND_PRESENTATIONS_TEMPLATE_GENERATOR_AND_LIBRARY_RUNTIME_V8.md`.
- Kluczowy kod: `server/src/services/ai/tools/generateDeliverable.ts` (ścieżka czat→artefakt), `server/src/services/ai/deckChatBrief.ts`, `server/src/services/presentationGeneratorService.ts` (generateDeck, Narrative Engine ~1483-1540), `server/src/services/documentStudio/documentBlockProseGenerator.ts:168` (prompt Word), `server/src/services/workbook/WorkbookGeneratorService.ts` (silnik 5-fazowy), `src/utils/exceleFlag.ts`.

---

## PROMPT DO WKLEJENIA (pierwsza wiadomość w nowej sesji)
> Jesteś sesją roboczą/CTO Consultify, kontynuujesz grupę DOKUMENTY (Prezentacja/Word/Excel + generatory template'ów). Właściciel: Piotr — nie-koder, PO POLSKU, krótko, obrazkami; działaj autonomicznie, nie pytaj co krok; jedyne na świeże „tak" to deploy na demo; Piotr NIGDY nie jest pierwszym testerem wizualnym (sam renderuj+zrzut przed pokazem).
>
> KROK 0: przeczytaj `Harvard/wdrozenie-100/_PROMPT_NASTEPCA_DOKUMENTY_2026-07-22.md` (pełny brief) + `_HANDOFF_DOKUMENTY_2026-07-22.md`; wywołaj skille `consultify-finisz-modulu`, `consultify-promocja-demo`, `consultify-petla`, `consultify-artefakty`.
>
> STAN: audyt grupy DOKUMENTY zrobiony i wdrożony na demo (gitSha 533d353896); framework 6 narzędzi zaakceptowany; Fala A (merytoryka §0.3) + B (generatory template'ów Excel+Deck) + C (tokeny galerii) ZBUDOWANE i SKONSOLIDOWANE w gałęzi `integr/dokumenty-fala-abc` (20 commitów, esbuild+testy zielone, NIE pushowana, punkt cofania a42ee33280).
>
> NASTĘPNY RUCH: potwierdź Piotrowi jednym obrazkiem co gotowe, zapytaj o „tak" na deploy `integr/dokumenty-fala-abc` (partia 18 plików, ZAWIERA zmianę wymagającą migracji bazy `20260412_seed_business_templates.sql`). Po deployie: live-verify treści/wizualu przez Claude-in-Chrome (sesja Piotra na demo, czat AUTO nie „Presentations") → zrzuty before/after → akcept.
>
> TWARDE REGUŁY: baza gałęzi ZAWSZE origin/demo; nie push bez „tak"; NIGDY force/reset na demo; weryfikuj RUNTIME nie docy (audyty starzeją się w 3 dni — ta sesja złapała 3 nieaktualne zarzuty i 1 „fantom"); prompty globalne → treść akceptuj na żywym LLM, NIE zmyślaj że zweryfikowane (offline=kod/esbuild/test vs live=treść/wizual); esbuild per plik, NIGDY pełny tsc/vitest (OOM); nie loguj się za Piotra; nie kasuj danych; możesz wypuszczać wielu agentów (worktree isolation, commit-per-krok, ty recenzujesz i scalasz). Zacznij od KROK 0.
