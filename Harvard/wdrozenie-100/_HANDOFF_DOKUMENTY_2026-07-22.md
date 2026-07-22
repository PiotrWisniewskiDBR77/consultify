# HANDOFF — grupa DOKUMENTY (Prezentacja · Word · Excel) — 2026-07-22
**Punkt wejścia dla świeżej sesji.** Poprzednia sesja (Opus 4.8) kończyła okno kontekstowe. Ten plik + linkowane = pełny stan.

> Właściciel: Piotr (nie-koder, PO POLSKU, obrazkami). Metoda, którą polubił i chce dalej: **oczekiwanie-vs-wynik na OBEJRZANYM artefakcie** (harness/żywe demo, nie docy). Mandat: „działaj, decyduj sam, jedź w pętli, nie pytaj co krok; deploy na demo = jedyna rzecz za każdym razem na świeże »tak«".

---

## 0. TL;DR — gdzie jesteśmy
1. **Audyt grupy DOKUMENTY zrobiony** → werdykt: wejście przez czat (Teresa) było atrapą prawdziwych silników (odrzucało intent+odbiorcę, omijało gotową maszynerię). Dok: `_AUDYT_DOKUMENTY_2026-07-22.md`.
2. **Naprawa audytu WDROŻONA NA DEMO** (gitSha `533d353896`): deck/word audience+treść z czatu, Excel silnik formuł odsłonięty za flagą OFF. Zweryfikowana wzrokiem (dev-render) + na żywym demo.
3. **Framework 6 narzędzi opisany i ZAAKCEPTOWANY** przez Piotra (kryteria + progi PRZED/PO). Dok: `_FRAMEWORK_6_NARZEDZI_DOKUMENTY_2026-07-22.md`.
4. **FALA A (merytoryka) ZBUDOWANA, NIE deployowana** — gałąź `prod/word-wzorzec-merytoryka`, 3 commity. Czeka na jeden deploy + żywy before/after.
5. **Następne:** deploy Fali A → weryfikacja live → FALA B (generatory template'ów) → FALA C (polish).

---

## 1. STAN GIT (kluczowe)
- **origin/demo = `533d353896`** — auto-deploy Railway serwis `consultify`, env demo, baza TROLLEY. Zawiera naprawę audytu (7 commitów zmergowanych). ŻYWE na https://demo.consultify.ai (health: `/api/health` pokazuje gitSha).
- **Gałąź `prod/word-wzorzec-merytoryka`** (od origin/demo) = FALA A, 3 commity NIE pushowane:
  - `849c9ce876` A1 Word — format założeń inline „(założenie)" (documentBlockProseGenerator.ts:168,192)
  - `21ac83f2a7` A3 Excel — grounding sourcePack→prompt (workbook.routes.ts buildWorkbookGrounding + WorkbookGeneratorService.ts)
  - `2967d0932c` A2 Deck — koniec „brak danych", user_instruction z założeniami (presentationGeneratorService.ts ~1506-1540)
- **Worktree:** `.worktrees/audyt-dokumenty-2026-07-22` (od origin/demo). node_modules = **symlink** do głównego repo (potrzebny do esbuild/tsx/vite). Wpis launch.json: `audyt-dokumenty-render` port 3021 (dev-render).
- **Punkt cofania** ostatniego deployu: `a42ee33280` (przed merge audytu). NIGDY force/reset na demo.

## 2. NAPRAWA AUDYTU (już na demo, `533d353896`) — co żyje
| Naprawa | Plik | Efekt |
|---|---|---|
| Deck brief z czatu (audience/goal/tytuł) | `server/src/services/ai/deckChatBrief.ts`, `generateDeliverable.ts`, `mcpServer.ts` | „dla zarządu"→register executive; tytuł-polecenie ścięty; model może podać audience/goal |
| Deck #2 grounding intentem | `presentationGeneratorService.ts` (brief→Narrative Engine user_instruction; `resolveDeckNarrativeBrief` dyskryminator chat-vs-Kreator) | treść o temacie, Kreator nietknięty |
| Word audience z czatu | `generateDeliverable.ts` (docAudience) → `documentBlockProseGenerator.ts:162` | prompt „written for the audience: zarząd" |
| Word domyślnie treść | `DocumentStudioIntakeForm.tsx:143` useLlm=true + etykieta (locale pl/en) | koniec pustego szkieletu „awaiting content" |
| Excel silnik za flagą | `src/utils/exceleFlag.ts`, `AppRoutes.tsx` /excele ternary, `ArtifactModuleHome.tsx` (Excel identity + route /excele) | `?ff_excele=1` odsłania realny silnik formuł; flaga default OFF |
Testy: `deckChatBrief.test.ts` (18), `deckNarrativeBrief.test.ts` (6). Dev-render: `dev-render/screens/word-intake-uselm-default.tsx`, `excele-engine-reveal.tsx`.

## 3. FRAMEWORK 6 NARZĘDZI (zaakceptowany) — karta wyników PRZED→PO
SSOT: `_FRAMEWORK_6_NARZEDZI_DOKUMENTY_2026-07-22.md`. Skala 0–10, 5 osi (Menu·Nawigacja·Funkcja·Merytoryka·Grafika). Progi PO = benchmarki doktryny (`_DOKTRYNA_POWSTAWANIA_ARTEFAKTOW.md` §2): Prezentacja→Gamma+, Word→wyznacznik, Excel→analityk PE.

| Narzędzie | Śr. PRZED | Największa luka |
|---|:---:|---|
| Word/Raport #5 | 6.2 | najbliżej — polish (format założeń✅, wersje, tryb klienta) |
| Deck #4 | 4.6 | merytoryka 3 (grounding) + 4 z 5 bramek jakości martwe |
| Excel #6 | 3.4 | silnik realny ale ODŁĄCZONY (grounding, split-brain, brak wejścia z menu) |
| Gen.tpl Word #2 | 4.4 | backend AI-draft istnieje (`/templates/plan`), brak FE |
| Gen.tpl Prezentacji #1 | 2.0 | fantom — brak tworzenia szablonu, SSOT: „MISSING" |
| Gen.tpl Excel #3 | 2.0 | fundament `WORKBOOK_TEMPLATES`/threeScenarioPnL istnieje ale ZERO callerów |

**3 prawdy:** (1) Word>Deck>Excel w merytoryce — tylko Word miał tryb założeń §0.3; (2) silniki ISTNIEJĄ, problem=ODŁĄCZENIE (grounding nie dochodzi do promptu, split-brainy); (3) generatory template'ów: backend Word realny, Deck+Excel fantomy → zbudować JEDEN wzorzec (Word FE), klonować ×2.

## 4. PLAN PRODUKCJI (decyzja CTO, przyjęta) — 3 fale
- **FALA A — merytoryka (§0.3 wzorzec):** ✅ ZBUDOWANA (gałąź, nie deployowana). A1 Word · A2 Deck · A3 Excel. → szczegóły + RUNBOOK DEPLOYU: `_HANDOFF_FALA_A_2026-07-22.md`.
- **FALA B — generatory template'ów:** wzorzec Word FE (backend jest) → klon Deck (dobudować backend) + Excel (podłączyć WORKBOOK_TEMPLATES + zdjąć 409). → `_HANDOFF_FALA_B_GENERATORY_TEMPLATE_2026-07-22.md`.
- **FALA C — polish (menu/nawigacja/grafika):** 3 tryby jawne na wejściu; /excele w sidebar (po akcepcie flaga ON); powłoka SPEC-A; ← powrót Deck; storage nietrwały P0. → `_HANDOFF_FALA_C_POLISH_2026-07-22.md`.

## 5. NASTĘPNY KONKRETNY RUCH
**Deploy Fali A na demo** (czeka na świeże „tak" Piotra — per-action, nie generalizować). Procedura = skill `consultify-promocja-demo` (merge nie force, punkt cofania, monitor health aż gitSha=nowy). Kroki i runbook: `_HANDOFF_FALA_A_2026-07-22.md`.
Po deployu — **weryfikacja LIVE** (treści NIE da się offline, brak LLM lokalnie): przez Claude-in-Chrome (sesja Piotra zalogowana na demo), czat Auto → wygeneruj deck/dokument/arkusz „dla zarządu o pilocie faktur", zrób zrzuty before/after. Sprawdź: deck bez „brak danych", dokument bez „Assumption:” co zdanie, arkusz z groundingiem.

## 6. UWAGI / PUŁAPKI
- **Test-rekordy na demo do sprzątnięcia** (utworzone przy weryfikacji live): deck `ac227fdea0` („Dla zarządu z wyników pilota…") + ~2 dokumenty. NIE kasować trwale bez zgody Piotra (zasada: nie usuwam danych).
- **Weryfikuj RUNTIME nie docy** (złota reguła) — audyty starzeją się w 3 dni. Grep realnego callera; flagi bywają fantomami (Deck `PUT outlineJson` bez callerów, Excel `WORKBOOK_TEMPLATES` bez callerów).
- **Zmiany promptów są GLOBALNE** (persona/generatory dotykają każdej odpowiedzi Teresy) → treść Piotr akceptuje na żywym LLM PRZED uznaniem „done". Offline: esbuild per plik, testy jednostkowe pure-funkcji; NIGDY pełny tsc/vitest (OOM).
- **Railway CLI** był podlinkowany do innego projektu (Pitchdeck/production) — NIE ruszać; monitorować przez health endpoint.
- **Doktryna 3 trybów** (`_DOKTRYNA_POWSTAWANIA_ARTEFAKTOW.md` wymiar 4): każde narzędzie MUSI mieć oba wejścia AI (dialog Teresy + copilot) + pełną edycję ręczną + template. §6.2: pierwsza wersja MUSI być akceptowalna.

## 6b. OTWARTE PUNKTY (dokończyć w świeżej sesji)
- **Excel — reguła „(założenie)" w system-prompcie.** A3 (`21ac83f2a7`) naprawił tylko PRZEPŁYW groundingu (sourcePack→prompt), NIE dodał do `WorkbookGeneratorService.ts:31-71` (system prompt) reguły §0.3 „liczbę bez źródła oznacz (założenie)" — którą mają już Word (A1) i Deck (A2). Domknąć dla spójności wzorca, zanim uzna się Falę A merytorycznie kompletną.
- Weryfikacja live całej Fali A po deployu (patrz `_HANDOFF_FALA_A_2026-07-22.md`, tabela PASS/FAIL).
- **KOREKTY „audyty się starzeją" (weryfikacja runtime po napisaniu frameworku) — karta wyników ZANIŻONA, skoryguj przed produkcją:**
  - **Deck menu/nawigacja lepsze niż w karcie:** ← powrót JUŻ podpięty (`DeckBuilder.tsx:317,1187`, commit `a838907d6f` 07-19), tryb prezentera DZIAŁA (`:1205`, `eead180f35`), `media` w rightRail = zamierzony guard nie bug, crimson-sweep chrome zrobiony (`ecfa635252`). Deck ① Menu/② Nawigacja realnie wyżej niż 4/5. Szczegóły: `_HANDOFF_FALA_C_POLISH_2026-07-22.md` §0.
  - **Generator tpl. Word MA frontend** (Template Architect `DocumentStudioTemplateArchitectView.tsx`, wpięty `DocumentStudioView.tsx:394`) — score #2 zaniżony; domykać, nie budować od zera. Szczegóły: `_HANDOFF_FALA_B_*.md` §1.
  - **Sprzeczność do rozstrzygnięcia:** `documentStudioTypes.ts:7` mówi „Mode 2/3 deferred", ale kod Mode 2/3 istnieje — zweryfikuj na żywym demo czy Mode 3 (generacja z szablonu) realnie działa, zanim budujesz na tym.

## 7. PAMIĘĆ (auto-recall, już zapisana)
- `audyt-dokumenty-naprawa-2026-07-22.md` — audyt+naprawa+mandat.
- `framework-6-narzedzi-dokumenty-2026-07-22.md` — framework+plan+Fala A commity.

## 8. LINKI ŻYWE (weryfikacja)
- Deck (test): https://demo.consultify.ai/presentations/builder/ac227fdea0a447f3abb138b05dec2681
- Word (test, z czatu): https://demo.consultify.ai/chat/bf22a4e8-0754-48c6-968a-a38b32731b75
- Excel silnik: https://demo.consultify.ai/excele?ff_excele=1
- Health/SHA: https://demo.consultify.ai/api/health
