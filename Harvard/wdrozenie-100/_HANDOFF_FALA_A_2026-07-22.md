# HANDOFF — Fala A (merytoryka Word/Deck/Excel) — 2026-07-22

Dla ŚWIEŻEJ sesji. Poprzednia sesja kończy kontekst po zrobieniu 3 commitów
naprawczych w worktree, jeszcze BEZ deployu na demo. To dokument, który ma
umożliwić kontynuację: zrozumieć co i dlaczego zmieniono, i bezpiecznie
wypchnąć + zweryfikować na żywo.

**Worktree:** `.worktrees/audyt-dokumenty-2026-07-22`
**Gałąź:** `prod/word-wzorzec-merytoryka` (od `origin/demo`)
**Stan:** 3 commity gotowe, NIE wypchnięte na demo. Zero deployu, zero
weryfikacji na żywym LLM.

```
2967d0932c fix(deck-tresc): koniec „brak danych" — deck z czatu pisze konkret z założeniami
21ac83f2a7 fix(excel-grounding): sourcePack/evidenceRefs do promptu arkusza (koniec [object Object])
849c9ce876 fix(word-tresc): format założeń — inline „(założenie)" zamiast „Assumption:" w każdym zdaniu
```

---

## 1. Cel Fali A

Jeden wzorzec merytoryczny (§0.3 z kanonu Harvard) dla trzech generatorów
treści z czatu (Teresa): **jawne oznaczanie założeń zamiast zmyślania albo
odmowy**. Zasada: liczba/data/wartość bez pokrycia w źródłach → nie kasujemy
jej i nie fabrykujemy jako pewnik, tylko oznaczamy inline `(założenie)` /
`(assumption)` i piszemy dalej pewną, decyzyjną prozą.

Ten wzorzec istniał już w Wordzie, ale w złej FORMIE (prefiks „Assumption:”
na każdym zdaniu — mechaniczne, nie brzmi jak deliverable partnera). Deck i
Excel w ogóle go nie miały wdrożonego poprawnie — każdy failował inaczej.

**Stan PRZED Falą A (obserwacja z żywego demo, audyt 2026-07-22):**
- **Word** z czatu: merytorycznie dobry, ale „Assumption:” w prawie każdym
  zdaniu — czyta się jak formularz ryzyka, nie jak dokument dla zarządu.
- **Deck** z czatu (bez podpiętych źródeł): pisał wprost „Brak dostępnych
  danych uniemożliwia…” zamiast treści — mimo że silnik (Narrative Engine)
  ma regułę „oznacz jako założenie”, przy pustych faktach domyślnie wybierał
  wariant „insufficient data”.
- **Excel** z czatu: liczby czysto zmyślone, mimo że UI/API miały już
  rusztowanie groundingu (`sourcePack`, `evidenceRefs`) — bug: te dane
  nigdy nie docierały do promptu LLM, ginęły po drodze do bazy.

Fala A naprawia wszystkie trzy pod wspólny wzorzec: **pewna proza + inline
`(założenie)` tylko przy konkretnych niepopartych wartościach**, nigdy
hedge co zdanie i nigdy pusta odmowa „brak danych”.

---

## 2. Commity — szczegóły

### A1 — Word: format założeń
**Commit:** `849c9ce876`
**Plik:** `server/src/services/documentStudio/documentBlockProseGenerator.ts`
**Linie:** `168` (buildSystemPrompt), `192` (buildUserPrompt, gałąź
no-source)

**Co zmienione (dokładny diff):**

Linia ~168, `buildSystemPrompt` — PRZED:
```
'Ground every factual claim in the provided sources. When a claim is NOT
supported by the sources, phrase it as an explicit assumption (e.g. prefix
"Assumption:") rather than asserting it as fact.'
```
PO:
```
'Ground every factual claim in the provided sources. Write confident,
decision-oriented consulting prose — do NOT hedge every sentence. When a
SPECIFIC number, percentage, amount, date or named fact is NOT supported by
the sources, mark just that value inline in parentheses in the document
language — "(założenie)" for Polish, "(assumption)" for English (e.g.
"redukcja błędów o 30% (założenie)"). Never prefix a whole sentence with
"Assumption:" and never repeat the marker on consecutive sentences.
Qualitative reasoning is stated plainly; if a section rests on a few key
assumptions, you may name them once in a short lead-in, not sentence-by-
sentence.'
```

Linia ~192, `buildUserPrompt`, gałąź „brak source pack” — PRZED:
```
'(no source pack attached — flag all non-trivial claims as assumptions)'
```
PO:
```
'(no source pack attached — write confident consulting prose; mark ONLY
specific unsupported numbers/dates/named values inline with
"(założenie)"/"(assumption)", do NOT prefix sentences with "Assumption:")'
```

**Dlaczego:** stary prompt kazał modelowi oznaczać CAŁE zdanie jako
założenie prefiksem — LLM to interpretował maksymalistycznie i prefiksował
prawie każde zdanie „Assumption:”. Nowy prompt zawęża znacznik do
KONKRETNEJ wartości (liczba/%/kwota/data/nazwana wartość), reszta prozy ma
być pewna i decyzyjna.

**Gwarancja anty-fabrykacji:** zachowana — reguła „ground every factual
claim in sources” zostaje na początku obu wariantów promptu; liczby bez
źródła nadal MUSZĄ być oznaczone, zmieniła się tylko granularność i forma
znacznika (inline zamiast prefiksu zdania).

**Czego NIE rusza:** struktura bloków (text/items), reszta system promptu
(register, density, language style), sam pipeline generowania dokumentu,
inne generatory (deck, excel) — to osobny plik, osobna funkcja.

**Zasięg zmiany:** GLOBALNY — to jest wspólny prompt dla KAŻDEJ odpowiedzi
Teresy-dokumentu (nie tylko czat bez źródeł — `buildSystemPrompt` dotyczy
wszystkich wywołań; druga zmiana w `buildUserPrompt` dotyczy tylko gałęzi
bez source packa).

---

### A3 — Excel: grounding (sourcePack/evidenceRefs faktycznie w prompcie)
**Commit:** `21ac83f2a7`
**Pliki:**
- `server/src/routes/workbook.routes.ts` — nowy helper
  `buildWorkbookGrounding()`
- `server/src/services/workbook/WorkbookGeneratorService.ts` —
  `researchText` (coercion obronna)

**Bug PRZED (znaleziony w audycie):** route `workbook.routes.ts` przyjmował
z requestu `researchContext`, `sourcePack`, `evidenceRefs`, ale do
`WorkbookGeneratorService.generate()` przekazywał WYŁĄCZNIE
`researchContext` jako pole `researchContext:string`. `sourcePack` i
`evidenceRefs` lądowały tylko w zapisie do DB (metadane), nigdy nie
docierały do promptu LLM. Dodatkowo jeśli ktoś (Teresa-orkiestrator) wysłał
`researchContext` jako obiekt (nie string), interpolacja w
`WorkbookGeneratorService` dawała dosłowny tekst `[object Object]` w
prompcie — bezużyteczny dla modelu. Efekt: model dostawał pusty/bezsensowny
kontekst i zmyślał liczby, mimo że dane groundingu istniały (klient je
wysłał, po prostu ginęły po drodze).

**Co zmienione:**

1. `workbook.routes.ts` — nowa funkcja `buildWorkbookGrounding(input: {
   researchContext, sourcePack, evidenceRefs })`:
   - jeśli `researchContext` jest stringiem → bierze go wprost; jeśli jest
     obiektem → `JSON.stringify` (nigdy surowa interpolacja obiektu),
   - jeśli `sourcePack` ma kształt `ContextPack` (`key_points: string[]`,
     `data_points: {label, value, unit}[]`) → składa czytelną listę
     „Fakty ze źródeł (podstawa liczb — nie zaprzeczaj im): - …”; jeśli
     kształt inny → fallback `JSON.stringify(sourcePack)`,
   - jeśli `evidenceRefs` to tablica → dokleja `Dowody: …` (stringi wprost,
     obiekty przez `JSON.stringify`),
   - łączy wszystkie sekcje `\n\n`, **cap 6000 znaków**,
   - zwraca `undefined` gdy nic nie ma (model wtedy jawnie oznacza założenia
     — nie wymuszamy fałszywego groundingu).
   - W handlerze POST: `const groundingText = buildWorkbookGrounding({
     researchContext, sourcePack, evidenceRefs });` i to
     (`groundingText`, NIE surowy `researchContext`) leci do
     `WorkbookGeneratorService.generate({ ..., researchContext:
     groundingText, ... })`.

2. `WorkbookGeneratorService.ts`, metoda generującą pipeline (5-fazowy) —
   dodana **coercion obronna** `researchText`: jeśli `researchContext` to
   string → używa wprost; jeśli obiekt → `JSON.stringify` (z try/catch);
   inaczej pusty string. Warunek wstrzyknięcia do `userPrompt` zmieniony z
   `if (researchContext)` na `if (researchText.trim())`. To druga linia
   obrony — nawet gdyby jakiś inny caller (nie route) wywołał serwis z
   obiektem zamiast stringa, nigdy nie wstrzyknie się `[object Object]`.

**Dlaczego dwie warstwy (route + service):** route to punkt, gdzie
faktycznie GUBIONO dane (root cause), service to defensywna sieć
bezpieczeństwa na wypadek innych callerów tej samej metody `generate()`.

**Gwarancja anty-fabrykacji:** teraz liczby modelu MAJĄ realną podstawę w
prompcie kiedy klient je wysłał (`sourcePack.data_points` z konkretnymi
`label/value/unit` trafiają dosłownie do LLM). Kiedy nic nie wysłano,
`buildWorkbookGrounding` zwraca `undefined` — model działa bez groundingu i
(zgodnie z ogólnym promptem serwisu, nietkniętym w tym commicie) powinien
sam oznaczać założenia, ale UWAGA: ten commit NIE zmienia treści promptu
systemowego WorkbookGeneratorService pod kątem „(założenie)” — to NIE jest
analogiczna zmiana do A1/A2, to czysto naprawa PRZEPŁYWU DANYCH (dane nie
docierały). Czy prompt Excela w ogóle ma regułę „(założenie)” tak jak Word
po A1 — NIE zweryfikowano w tym commicie, do sprawdzenia przy weryfikacji
live (patrz sekcja 4).

**Czego NIE rusza:** sam pipeline 5-fazowy WorkbookGeneratorService (fazy
generowania arkusza), schemat `ContextPack`, endpoint inne niż POST
generate, Word/Deck.

---

### A2 — Deck: koniec „brak danych”
**Commit:** `2967d0932c`
**Plik:** `server/src/services/presentationGeneratorService.ts`
**Linie:** ~1506–1540 (funkcja `generateDeck`, okolice zmiennej
`briefInstruction` i pola `user_instruction`)

**Kontekst PRZED:** Narrative Engine (silnik generujący treść slajdów) MA
regułę oznaczania założeń — `linguisticRealization.ts:76` zawiera logikę
„mark as assumption”. Ale ścieżka **brief-rewrite** (deck tworzony z czatu,
bez podpiętego rich-source — czyli bez bogatego materiału źródłowego) przy
PUSTYCH faktach domyślnie wybierała wariant „insufficient data” zamiast
skorzystać z reguły założeń. Efekt na żywym demo: deck z czatu pisał wprost
„Brak dostępnych danych uniemożliwia…” zamiast treści.

**Co zmienione:**
```ts
const briefText = resolveDeckNarrativeBrief(setup) ?? '';
const useBriefRewrite = briefText.length > 0;
// NOWE:
const briefInstruction = useBriefRewrite
  ? `${briefText}\n\n${
      setup.language === 'pl'
        ? 'To pierwszy szkic prezentacji BEZ podpiętych źródeł danych. Napisz
           konkretną, decyzyjną treść osadzoną w temacie (answer-first) —
           NIE odpowiadaj „brak danych"/„niewystarczające dane". Każdą
           konkretną, niepopartą liczbę/procent/datę oznacz w nawiasie
           „(założenie)".'
        : 'This is a first draft deck with NO attached data sources. Write
           concrete, decision-oriented content grounded in the topic
           (answer-first) — do NOT reply "insufficient data". Mark each
           specific unsupported number/percentage/date inline as
           "(assumption)".'
    }`
  : '';
```
i niżej, w miejscu gdzie budowany jest obiekt slajdu:
```ts
// PRZED:
...(useBriefRewrite ? { user_instruction: briefText } : {}),
// PO:
...(useBriefRewrite ? { user_instruction: briefInstruction } : {}),
```

Czyli: zamiast wysyłać do silnika sam `briefText` (temat/brief z czatu) jako
`user_instruction`, wysyła się `briefText` + doklejona jawna dyrektywa
„pisz konkretnie, nie ‘brak danych’, oznacz `(założenie)`” — w języku
prezentacji (pl/en).

**Dlaczego to jest kanał autorski, nie silnik:** `user_instruction` to pole
przekazywane DO Narrative Engine jako dyrektywa treściowa dla KONKRETNEGO
slajdu w KONKRETNEJ ścieżce (chat brief-rewrite), nie zmiana logiki
wewnątrz silnika. Sam silnik (`linguisticRealization.ts` i reguła „mark as
assumption” w linii 76) — **nietknięty**. Zmiana działa tylko przez
wzmocnienie promptu wejściowego dla tej jednej ścieżki.

**Gwarancja anty-fabrykacji:** commit explicite mówi, że reguły
anty-fabrykacji (`post_check`) pozostają nadrzędne — czyli nawet gdy model
dostanie dyrektywę „pisz konkretnie”, post-check nadal odrzuca zmyślone
liczby bez oznaczenia. Sama dyrektywa dodatkowo instruuje model, żeby
niepoparte liczby oznaczał `(założenie)`/`(assumption)` — spójne z A1
(Word) i intencją A3 (Excel).

**Czego NIE rusza:** wspólny silnik Narrative Engine (`linguisticRealization.ts`
i inne pliki silnika), ścieżkę Kreatora (nie-czat) — dyskryminator
chat-vs-Kreator pozostaje bez zmian, potwierdzone „6 testów zielonych” w
treści commita (nie uruchamiałem ich ponownie w tej sesji — do
zweryfikowania jeśli potrzebna pewność, np. `npx vitest run <plik>` z
odpowiednim filtrem, ale zgodnie z higieną wykonania robotnicy NIE
uruchamiają pełnego `vitest`).

---

## 3. Wspólny wzorzec §0.3 — podsumowanie

| Narzędzie | Problem przed | Naprawa | Commit |
|---|---|---|---|
| Word | „Assumption:” na każdym zdaniu | inline `(założenie)` tylko przy konkretnej wartości | A1 `849c9ce876` |
| Deck | „brak danych” zamiast treści | jawna dyrektywa: pisz konkret + `(założenie)` inline | A2 `2967d0932c` |
| Excel | liczby zmyślone (grounding gubiony) | `sourcePack`/`evidenceRefs` faktycznie trafiają do promptu | A3 `21ac83f2a7` |

Wszystkie trzy: **proza pewna, decyzyjna, answer-first**; jedyny hedge to
inline `(założenie)`/`(assumption)` przy KONKRETNEJ niepopartej wartości —
nigdy odmowa całości, nigdy hedge co zdanie.

---

## 4. RUNBOOK DEPLOYU Fali A

Adaptacja procedury `consultify-promocja-demo` pod te 3 commity. Baza —
`origin/demo` (święta, target Railway). **Wywołaj skill
`consultify-promocja-demo` na starcie, żeby mieć aktualne fakty (Railway
service name, host bazy itd.) — poniżej tylko sekwencja kroków dopasowana
do Fali A.**

1. **Fetch + punkt cofania:**
   ```bash
   git fetch origin demo
   git rev-parse origin/demo   # ZAPISZ ten SHA — to punkt cofnięcia
   ```

2. **Pre-flight — 0 konfliktów:**
   ```bash
   cd "<worktree Fali A>"   # gałąź prod/word-wzorzec-merytoryka
   git merge-tree $(git merge-base origin/demo HEAD) origin/demo HEAD \
     | grep -E '^(<<<<<<<|CONFLICT|changed in both)'
   ```
   Pusty output = czysto, jedziesz dalej. Cokolwiek się wypisze → STOP,
   rozwiąż zanim ruszysz merge.

3. **Merge w izolowanym worktree** (NIE w tym worktree, NIE w drzewie
   głównym):
   ```bash
   git worktree add /private/tmp/promote-demo origin/demo
   cd /private/tmp/promote-demo
   git merge prod/word-wzorzec-merytoryka --no-ff \
     -m "Merge prod/word-wzorzec-merytoryka → demo: Fala A merytoryka (Word/Deck/Excel, audyt 2026-07-22)"
   ```
   Uwaga: `node_modules` w tym worktree to symlink do głównego repo —
   potrzebne dla esbuild/tsx, nic nie kopiuj ręcznie.

4. **Twarda weryfikacja zasięgu — MUSI pokazać dokładnie te pliki (3-4,
   nie więcej):**
   ```bash
   git diff --stat origin/demo
   ```
   Oczekiwane:
   - `server/src/services/documentStudio/documentBlockProseGenerator.ts`
   - `server/src/routes/workbook.routes.ts`
   - `server/src/services/workbook/WorkbookGeneratorService.ts`
   - `server/src/services/presentationGeneratorService.ts`

   Więcej plików niż te 4 → STOP, sprawdź co się wkradło (np. gałąź nie
   była czysto od `origin/demo`, albo złapała coś dodatkowego).

5. **esbuild dotkniętych plików** (składnia, nie pełny tsc):
   ```bash
   npx esbuild server/src/services/documentStudio/documentBlockProseGenerator.ts --loader:.ts=ts --bundle=false --format=esm --outfile=/dev/null
   npx esbuild server/src/routes/workbook.routes.ts --loader:.ts=ts --bundle=false --format=esm --outfile=/dev/null
   npx esbuild server/src/services/workbook/WorkbookGeneratorService.ts --loader:.ts=ts --bundle=false --format=esm --outfile=/dev/null
   npx esbuild server/src/services/presentationGeneratorService.ts --loader:.ts=ts --bundle=false --format=esm --outfile=/dev/null
   ```

6. **Push:**
   ```bash
   git push origin HEAD:demo
   ```
   NIGDY force, NIGDY reset. To zwykły `--ff-only`-kompatybilny push bo
   robiliśmy merge z `origin/demo` jako bazą.

7. **Monitor deployu (z GŁÓWNEGO katalogu repo, nie z worktree —
   Railway CLI nie jest linkowany z worktree):**
   ```bash
   railway deployment list --service consultify   # aż status ≠ BUILDING/DEPLOYING
   curl -s https://demo.consultify.ai/api/health
   ```
   Sprawdź w odpowiedzi health pole `gitSha` — musi zgadzać się z nowym
   SHA HEAD po merge (czyli commitem merge, nie jednym z trzech
   pojedynczych). Jeśli health nie ma `gitSha`, potwierdź przez
   `railway deployment list` że deploy = SUCCESS i timestamp świeży.

8. **Rollback (gdyby coś poszło źle):** `git revert <sha-mergea>` na
   `demo` i push, albo Railway rollback do poprzedniego deploymentu.
   SHA cofnięcia z kroku 1. NIGDY force-push na demo.

---

## 5. WERYFIKACJA LIVE po deployu

Treści nie da się ocenić offline — to prompt-only zmiana, efekt zależy od
żywego LLM. Weryfikacja przez Claude-in-Chrome, sesja Piotra zalogowana na
`demo.consultify.ai` (NIE loguj się sam, NIE wpisuj haseł — jeśli sesja nie
jest zalogowana, zatrzymaj się i poproś Piotra).

Wejdź do czatu Auto i wyślij po kolei (osobne wątki/rozmowy jeśli możliwe):

1. **Deck:** „Zrób prezentację dla zarządu z wyników pilota automatyzacji
   faktur”
2. **Dokument:** „Napisz dokument dla zarządu: raport z pilota automatyzacji
   faktur”
3. **Arkusz:** „Zrób arkusz finansowy: model 3 scenariusze”

**Kryteria akceptu (patrz też skill `consultify-test` dla progu/gate):**

| Narzędzie | FAIL (stan przed) | PASS (oczekiwane po Fali A) |
|---|---|---|
| Deck | „Brak dostępnych danych uniemożliwia…” | Konkretna treść answer-first, niepoparte liczby oznaczone `(założenie)` |
| Dokument | „Assumption:” na początku niemal każdego zdania | Proza pewna, `(założenie)` TYLKO przy konkretnej niepopartej wartości |
| Arkusz | Liczby czysto zmyślone, brak śladu źródła | Liczby ze śladem groundingu (widoczna spójność z tym co user opisał / podał jako kontekst), a przy braku źródła — jawne oznaczenie |

Zrób zrzuty **before/after** (jeśli to możliwe — before z tej sesji audytu
lub z pamięci/opisu z tego handoffu, jeśli nie ma zapisanych zrzutów
sprzed). Odbiór ekranowy = zgodnie z regułą repo: WZROKIEM, nie „testy
przeszły”. To NIE jest zmiana wizualna (SPEC-A/TRIADA) więc checklisty
40-punktowej nie stosujemy — ale zasada „Piotr nie jest pierwszym testerem”
nadal obowiązuje: TY (sesja wykonująca) sprawdzasz treść na żywo PIERWSZA,
robisz zrzuty, dopiero potem pokazujesz Piotrowi do akceptu.

---

## 6. Test-rekordy na demo do sprzątnięcia

Z poprzednich testów na demo (audyt 2026-07-22) zostały co najmniej:
- **Deck** `ac227fdea0` — „Dla zarządu z wyników pilota…”
- **~2 dokumenty** (dokładne ID nie zapisane w tej sesji — poszukaj po
  tytule/dacie 2026-07-22 w liście dokumentów na demo, autor = konto testowe
  użyte do audytu).

**NIE kasować trwale bez zgody Piotra** (reguła repo — permanentne
kasowanie danych wymaga jawnej zgody, patrz zasady bezpieczeństwa sesji).
Jeśli jest funkcja archiwizacji/soft-delete w narzędziu — użyj jej i
zapytaj Piotra o twarde usunięcie osobno. Nowe rekordy z testów w sekcji 4
też trzeba dopisać do tej listy i posprzątać tym samym trybem.

---

## 7. Otwarte pytania dla następnej sesji

- Czy prompt systemowy WorkbookGeneratorService (Excel) w ogóle zawiera
  regułę „(założenie)” analogiczną do Word/Deck? A3 naprawił tylko PRZEPŁYW
  danych do promptu, nie zweryfikowano treści samego promptu systemowego
  serwisu pod kątem formatu znacznika. Sprawdzić przy weryfikacji live
  (krok 5) — jeśli liczby są dobre ale bez znacznika przy brakach, może
  być potrzebna analogiczna poprawka promptu jak A1.
- 6 testów „zielonych” dla dyskryminatora chat-vs-Kreator (wspomniane w
  opisie A2) — nie uruchomione ponownie w tej sesji, do potwierdzenia jeśli
  coś budzi wątpliwość po deployu.
- Po akceptacji Piotra na zrzutach — re-tag punktu cofania zgodnie z
  `_RUNBOOK_COFANIA.md` (`demo-safe-<data>`).
