## ★★ UZUPEŁNIENIE DO SEKCJI „JEŚLI COŚ W TEJ INSTRUKCJI JEST SPRZECZNE" (wyżej)

Sekcja wyżej obowiązuje w całości. Poniższe dwa zdania mają **pierwszeństwo**
przed jej brzmieniem — pierwszego w niej nie ma, a drugie odsyła do sekcji,
która w tym dokumencie nazywa się inaczej.

1. **★ Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje
   TWÓJ pomiar — zapisz rozbieżność wprost.** Dotyczy KAŻDEJ liczby w tym
   dokumencie, także tych, które autor zmierzył sam przy wydaniu.
2. **★ Obalenie którejkolwiek tezy z sekcji „MOJA HIPOTEZA" albo „Zmierz moje
   liczby sam" jest SUKCESEM dyżuru, a nie porażką.** Zapisz to w „Korektach
   wobec instrukcji" z dowodem i idź dalej. (Sekcja wyżej mówi „TEZY
   ZLECENIA…" — w tym dokumencie te sekcje noszą nazwy podane tutaj.)

---

## Po co ten dyżur istnieje

Dyżur 345 domykał panel Idei/Notatnika i zameldował **„398/398 PASS"**. Odbiorca sprawdził to
adwersaryjnie i znalazł dwie rzeczy, których zielony pakiet nie zauważył — obie tego samego
rodzaju: **narzędzie pomiarowe nie miało czym zmierzyć tego, co miało chronić.**

### Znalezisko (1): zielone testy przy czerwonych typach

`src/components/MyWork/prototypes/IdeaNotebookRightPanelPrototype.tsx` deklaruje w wierszu 22:

```ts
ariaLabel: string;
```

— pole **wymagane**, bez `?`. Bramka `IdeaNotebookRightPanelPrototypeGate` (wiersz 93)
przyjmuje `PrototypeProps & { legacy: React.ReactNode }`, więc wymóg dotyczy także jej.
A zastany plik `src/components/MyWork/prototypes/__tests__/IdeaNotebookRightPanelPrototype.test.tsx`
woła tę bramkę **pięć razy bez `ariaLabel`** — w wierszach **16, 22, 29, 36, 44**.

Zmierzyłem to przy wydaniu instrukcji:

```
src/.../IdeaNotebookRightPanelPrototype.test.tsx(16,35): error TS2741: Property 'ariaLabel' is missing …
src/.../IdeaNotebookRightPanelPrototype.test.tsx(22,13): error TS2741: …
src/.../IdeaNotebookRightPanelPrototype.test.tsx(29,13): error TS2741: …
src/.../IdeaNotebookRightPanelPrototype.test.tsx(36,13): error TS2741: …
src/.../IdeaNotebookRightPanelPrototype.test.tsx(44,13): error TS2741: …
```

**Pięć błędów typów w pliku, który vitest wykonuje na zielono.** Vitest transpiluje bez
sprawdzania typów, więc ten kształt jest niewidoczny dla każdego pakietu testowego, jaki
w tym programie kiedykolwiek uruchomiono.

### Znalezisko (2): mutacja, która nie tknęła zabezpieczenia

Odbiorca cofnął `src/utils/ideaNotebookRightPanelPrototypeFlag.ts` do wariantu **obliczonego**
`meta.env?.[ENV_KEY]` — czyli dokładnie do defektu, który dyżur 345 naprawiał — i uruchomił
`tests/unit/flags`. **Cały katalog został zielony.** Mutacje raportu 345 celowały w wartość
domyślną flagi, nie w naprawiony sposób dostępu.

**★★ Zmierzyłem, dlaczego, i to jest najważniejsze zdanie tej instrukcji.**
`tests/unit/flags/panelIdeiEnvFlags.day345.test.ts` steruje flagą przez `vi.stubEnv`
(wiersze 30-32). `vi.stubEnv` **ustawia właściwość na obiekcie `import.meta.env` w czasie
działania**. Dostęp statyczny `import.meta.env.VITE_X` i dostęp obliczony `meta.env?.[KEY]`
czytają wtedy **dokładnie tę samą właściwość tego samego obiektu**. Różnica między nimi
powstaje dopiero wtedy, gdy **Vite podmienia tekst wyrażenia w budowie przeglądarkowej** —
statyczne zostaje zastąpione literałem, obliczone zostaje nierozwiązane i w gotowym pakiecie
czyta `undefined`.

**Wniosek, który wyznacza kształt całej pracy: żaden test uruchomieniowy nie odróżni tych
dwóch wariantów. Bezpiecznik MUSI być statyczny (skan źródeł) albo budujący (skan gotowego
pakietu) — nigdy uruchomieniowy.**

To jest hipoteza, nie fakt. **`R2` ma ją potwierdzić albo obalić własnym pomiarem, i obalenie
jest sukcesem** — bo wtedy istnieje tańszy bezpiecznik, niż zakładam.

### Kontekst rodziny

Wariant statyczny jest w kodzie dziś (wiersz 27) i nosi komentarz wyjaśniający, dlaczego:

> *„Static access is required: Vite replaces this expression in the browser bundle, while
> a computed lookup remains unresolved."*

Autor instrukcji 345 zmierzył, że to nie jest jedna flaga, tylko rodzina. Trzy naprawiono
(`ideaNotebookRightPanelPrototypeFlag`, `artifactRightRailFlag`, `notebookSpecAShellFlag`).
**Reszta czeka i nikt nie wie, ile jej jest ani ile z niej żyje.**

## ★★ MOJA HIPOTEZA — masz ją OBALIĆ ALBO POTWIERDZIĆ, nie przyjąć

Trzy tezy, każda z komendą obalającą:

| # | Teza autora instrukcji | Jak ją OBALIĆ |
| --- | --- | --- |
| **H1** | Żaden test uruchomieniowy z `vi.stubEnv` nie odróżni dostępu statycznego od obliczonego | Napisz taki test i pokaż go **czerwonym po mutacji na obliczony** i **zielonym po cofnięciu**. Jeżeli Ci się uda — H1 jest fałszywa, bezpiecznik jest tańszy, niż zakładam, i to jest lepszy wynik niż mój |
| **H2** | Bezpiecznik typów nie może brzmieć „cały projekt = 0 błędów", bo dziś jest **92** | Uruchom komendę (1) i (2) z `§0.3`. Jeżeli Twój pomiar da 0 — H2 jest fałszywa i bezpiecznik może objąć całość, co jest LEPIEJ |
| **H3** | Rodzina obliczonego dostępu liczy **109** plików w `src/`, nie „ok. 124", jak mówiło zlecenie | Komenda (5) z `§0.3`, **z pełnym wzorcem obejmującym `meta.env?.[K]` ORAZ `meta?.env?.[K]`** |

**★★ OSTRZEŻENIE O WŁASNYM BŁĘDZIE, ŻEBYŚ GO NIE POWTÓRZYŁ.** Przy pisaniu tej instrukcji
policzyłem rodzinę węższym wzorcem (`meta\.env\??\.?\[`) i dostałem **6 plików**. Prawidłowy
wzorzec (`meta\??\.env\??\.?\[`, obejmujący opcjonalny łańcuch także na `meta`) daje **109**.
Różnica bierze się stąd, że większość plików pisze `const meta = import.meta as unknown as
{ env?: … }` i czyta `meta?.env?.[ENV_KEY]`. **Prawie zapisałem fałsz osiemnastokrotnie
zaniżony.** Każdy Twój wzorzec musi być pokazany w raporcie razem z liczbą, którą dał.

## ★ Zmierz moje liczby sam

Twierdzę, na markerze `c0f690bae36a386de27f1a349fbb9674ec03c693`:

- `IdeaNotebookRightPanelPrototype.test.tsx`: **5 × `TS2741`**, wiersze **16, 22, 29, 36, 44**,
  wszystkie o brakującym `ariaLabel`;
- pełny `tsc` projektu: **92 błędy**, z tego **81 × `TS2345`** (kontrakt `t()` biblioteki i18n)
  i **5 × `TS2741`**; najwięcej w `useReportBuilder.ts` (27), `DocumentStudioDocumentPanel.tsx`
  (23), `useReportSections.ts` (11);
- **`tsc` przy domyślnej stercie Node PADA na OOM po ~73 s i zostawia pusty plik wyjściowy** —
  działa dopiero z `--max-old-space-size=8192`;
- `tests/unit/flags/panelIdeiEnvFlags.day345.test.ts` ma **2** przypadki, oba sterują flagą
  przez `vi.stubEnv`;
- rodzina: **109** plików `src/**` z dostępem obliczonym · **122** pliki z konstrukcją
  `const meta = import.meta as unknown as { env?: … }` · **136** plików z dostępem statycznym
  `import.meta.env.VITE_`;
- bramka ma **dwóch żywych konsumentów**: `NotebookRightRail.tsx:1038`
  i `standard/IdeaRightPanel.tsx:422` — to **nie jest** martwe poddrzewo;
- domyślna wartość `ff_idea_notebook_right_panel_prototype` to **`false`** (wiersz 27,
  `?? false`) — **i ma tak zostać**;
- katalog `evidence/day356/` **NIE ISTNIEJE** na markerze — tworzysz go;
- liście słowników: **pl 35198**, **en 33065**; `reachability --check-baseline` kończy się
  kodem **0**; `focus-canon`, `list-canon`, `artefakt` kończą się kodem **0**.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: WALIDATOR · TRASA · KONTROLER · SERWIS · REPOZYTORIUM · TESTY · MACIERZ ODBIORU

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
czerwony kontrakt testowy + brief. Pozycja z takim produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Kontrakt typów bramki** | `src/components/MyWork/prototypes/IdeaNotebookRightPanelPrototype.tsx` | **★ WĄSKA LICENCJA:** wolno **czytać** i **cytować `plik:linia`**. **Zakaz osłabienia kontraktu — `ariaLabel: string` NIE STAJE SIĘ `ariaLabel?: string`.** Naprawa idzie po stronie wołających, nie przez zmiękczenie typu. Wolno **zmutować tymczasowo** w `R2` jako dowód mutacyjny, z cofnięciem przez `cp` i pustym `git diff` | Brief z `plik:linia` |
| **Test bramki (rdzeń pozycji `R1`)** | `src/components/MyWork/prototypes/__tests__/IdeaNotebookRightPanelPrototype.test.tsx` | **★ PEŁNA LICENCJA** w zakresie `R1`: dopisanie brakującego `ariaLabel` w pięciu wywołaniach. **Zakaz usuwania przypadków, osłabiania asercji i zmiany zachowania testu** — dodajesz brakujące pole, nic więcej | — |
| **Flaga panelu (rdzeń pozycji `R2`)** | `src/utils/ideaNotebookRightPanelPrototypeFlag.ts` | **★ WĄSKA LICENCJA:** wolno **zmutować tymczasowo** (statyczny → obliczony) jako dowód mutacyjny i **cofnąć przez `cp`**. **Zakaz trwałej zmiany: dostęp zostaje STATYCZNY, wartość domyślna zostaje `false`** (`Z10`) | Brief |
| **Pozostałe flagi rodziny** | `src/utils/*Flag*.ts`, `src/components/**/*Flag*.ts` (109 plików z obliczonym dostępem) | **TYLKO ODCZYT — ten dyżur je INWENTARYZUJE, nie naprawia.** Naprawa rodziny to osobne zlecenie i osobna decyzja właściciela; ten dyżur ma dostarczyć listę i podział żywe/martwe | Wpis do inwentarza `R4` + rekomendacja jako diff **nienałożony** |
| **Żywi konsumenci bramki** | `src/components/MyWork/notebook/NotebookRightRail.tsx`, `src/components/standard/IdeaRightPanel.tsx` | **TYLKO ODCZYT** — jeżeli okaże się, że one też wołają bramkę bez `ariaLabel`, jest to **znalezisko do raportu**, a naprawa wymaga osobnego akapitu z uzasadnieniem. Sprawdź je jawnie w `R1` | Wpis: plik, linia, problem, diff **nienałożony** |
| **Nowe testy i bezpieczniki** | `tests/**` (NOWE pliki, `git add -f`), `scripts/**` (NOWY plik bezpiecznika, `git add -f`) | **★ PEŁNA LICENCJA na dodanie**, z zastrzeżeniem `Z18` i `Z31`. **Nowe pliki testowe kładziesz w `tests/`, NIGDY pod `src/`** | — |
| **Istniejący test flag** | `tests/unit/flags/panelIdeiEnvFlags.day345.test.ts`, `tests/unit/flags/flagiDomyslnieOn.test.ts`, `tests/unit/flags/initiativeSectionsCompleteFlag.day343.test.ts` | **★ WĄSKA LICENCJA:** wolno **URUCHAMIAĆ** i wolno **DOPISAĆ** przypadek. **Zakaz usuwania i zmiany istniejących przypadków** | — |
| **Konfiguracja typów** | `tsconfig.json`, `tsconfig.*.json`, `vite.config.ts` | **NIETYKALNE DO ZAPISU (`Z12`).** Poszerzenie `exclude`, żeby błędy zniknęły, jest **odrzuceniem dyżuru**, nie naprawą | Brief z `plik:linia` |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie |
| **CI** | `.github/workflows/**` | **TYLKO ODCZYT (`Z38`/`Z39`).** Bezpiecznik dostarczasz jako **skrypt w `scripts/` + test w `tests/`**; podłączenie do CI rekomendujesz w raporcie jako diff **nienałożony** | Diff nienałożony + brief |
| **Serwer** | `server/**` | **TYLKO ODCZYT — BEZWZGLĘDNIE.** Ten dyżur nie dotyka serwera | Opis w raporcie |
| **Słowniki** | `public/locales/**` | **TYLKO ODCZYT.** 81 błędów `TS2345` dotyczy kontraktu `t()`, nie treści słowników — nie naprawiasz ich w tym dyżurze | Brief |
| **Dowody** | `evidence/day356/**` (**katalog NIE ISTNIEJE na markerze — tworzysz go**, `git add -f`) | **★ PEŁNA LICENCJA na tworzenie i dopisywanie** | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o **pierwszej wolnej literze**, sprawdzonej komendą tuż przed commitem (dziś doszły do `Q`) | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY356_TYPY_I_FLAGI_REPORT.md` (**NOWY**) | `R5` — **JEDYNY nowy dokument rejestrowy, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Macierze odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` (wszystkie 16) | **NIETYKALNE DO ZAPISU** — ten dyżur nie zmienia stanu żadnego wiersza `G` | — |
| **Cudze tereny** | `server/src/routes/v8/finance-v2/__tests__/**`, `evidence/g15/**` (dyżur 355) · `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md`, wiersz `G16` (dyżur 357) · `server/src/routes/__tests__/day27{4,5,6,7}-*.pg.test.ts`, `evidence/g19/**`, `vitest.config.ts` (dyżur 358) · wszystko wokół licznika kompletności, 20 ekranów podglądu, wiersza `G19` i etykiet narzędzi (dyżury 351-354) | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff, **nienałożony** |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby: pl 35198, en 33065

# (b) cztery bezpieczniki maja konczyc sie kodem 0
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: wszystkie 0

# (c) ★ WLASCIWY TEMU DYZUROWI: liczba bledow tsc NIE MOZE WZROSNAC
node --max-old-space-size=8192 ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json 2>&1 | grep -c 'error TS'
#   moja liczba PRZED: 92. Po R1 oczekuje 87 (5 x TS2741 zgaszone). WZROST = regresja Twojej pracy.
```

**Jeżeli którakolwiek liczba zmaleje (słowniki) albo wzrośnie (błędy typów) od Twojej zmiany —
naprawiasz KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`).

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | błędy `TS2741` w pliku testu bramki | `5` (wiersze 16/22/29/36/44) | komenda (1) z `§0.3` | TAK — **tylko z `--max-old-space-size`; bez niego `tsc` pada i wygląda na zero** |
| 2 | wszystkie błędy `tsc` projektu | `92` | komenda (1) z `§0.3` | TAK — **to obala próg „cały projekt = 0"** |
| 3 | rozkład błędów po plikach | `27 / 23 / 11 / 9 / 9` | komenda (2) z `§0.3` | TAK — dowód, że reszta to cudze tereny |
| 4 | pliki z dostępem OBLICZONYM do env | `109` | komenda (5) z `§0.3` | TAK — **wzorzec MUSI objąć `meta?.env?.[K]`; węższy dał mi 6** |
| 5 | pliki z konstrukcją `import.meta as unknown` | `122` | komenda (5) z `§0.3` | TAK |
| 6 | pliki z dostępem STATYCZNYM | `136` | komenda (5) z `§0.3` | TAK |
| 7 | żywi konsumenci bramki | `2` | komenda (6) z `§0.3` | TAK — **to obala „martwe poddrzewo"** |
| 8 | czy test uruchomieniowy odróżnia warianty | — | `R2` punkt 1, dwa przebiegi | TAK — **różnica albo jej brak jest wynikiem, nie porażką** |
| 9 | ile z rodziny 109 jest ŻYWE | — | `R4`, osiągalność od korzenia | TAK — **mierzysz osiągalność od korzenia, nie „plik bez importera"**: metoda per-plik liczy importy wewnątrz martwego poddrzewa jako żywe |
| 10 | liście słowników PL/EN | `35198` / `33065` | blok (a) „WARUNKÓW WSPÓLNYCH" | TAK |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY356_TYPY_I_FLAGI_REPORT.md` ·
`evidence/day356/**` (nowy katalog, `git add -f`) ·
`src/components/MyWork/prototypes/__tests__/IdeaNotebookRightPanelPrototype.test.tsx` (`R1`).

**Zapisujesz WARUNKOWO (tylko z dowodem `R2`/`R3`):**
nowe pliki testowe w `tests/` (`git add -f`) · nowy skrypt bezpiecznika w `scripts/`
(`git add -f`) · dopisane przypadki w `tests/unit/flags/**` ·
`REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja).

**JAWNIE NIE ZAPISZESZ:** `server/**`, `public/locales/**`, `tsconfig*.json`, `vite.config.ts`,
`tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`,
`.github/workflows/**`, `server/migrations/**`,
`src/utils/ideaNotebookRightPanelPrototypeFlag.ts` **trwale** (tylko mutacja z cofnięciem),
`src/components/MyWork/prototypes/IdeaNotebookRightPanelPrototype.tsx` **trwale**,
`src/components/MyWork/notebook/NotebookRightRail.tsx`, `src/components/standard/IdeaRightPanel.tsx`,
pozostałe 108 plików rodziny, `evidence/g15/**`, `evidence/g19/**`,
`docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md`, wszystkie `MODULE_ACCEPTANCE.md`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day356-typy-i-flagi
git diff --name-only --cached | tee /private/tmp/cx-day356-typy-i-flagi-artefakty/staged.txt
bash -c "grep -iE '^server/|^public/locales/|^tsconfig|vite\.config|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|MODULE_ACCEPTANCE|evidence/g1[59]|PRZELOT_WLASCICIELA|NotebookRightRail|IdeaRightPanel|ideaNotebookRightPanelPrototypeFlag|prototypes/IdeaNotebookRightPanelPrototype\.tsx' /private/tmp/cx-day356-typy-i-flagi-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — TRZY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Bezpiecznik bez pary „mutacja → czerwony / cofnięcie → zielony" NIE ISTNIEJE.**
Każdy z dwóch bezpieczników tego dyżuru ma być pokazany w obu stanach, z komendami i wynikami
dosłownie w raporcie. Bezpiecznik pokazany tylko na zielono jest **atrapą** i pozycja
z takim produktem jest **odrzucona**, nie zaliczona.

**(2) Mutacja celuje w ZABEZPIECZENIE, nie w mechanizm.** Dla bezpiecznika typów mutacją jest
**usunięcie `ariaLabel` z jednego z pięciu wywołań** (przywrócenie stanu zastanego), nie
zepsucie składni pliku. Dla bezpiecznika flagi mutacją jest **cofnięcie dostępu ze statycznego
na obliczony**, nie zmiana wartości domyślnej. Mutacja, która psuje coś obok, dowodzi tylko
tego, że narzędzie w ogóle działa — a to nie jest przedmiot dowodu.

**(3) Nie osłabiasz kontraktu, żeby zzielenieć.** `ariaLabel: string` **nie staje się**
`ariaLabel?: string`. `tsconfig.json` **nie dostaje nowego wpisu w `exclude`**. Próg „cały
projekt = 0 błędów" **nie jest obniżany do „ignoruj `TS2345`"** — bezpiecznik ma być punktowy,
a nie rozmiękczony.

**Wymagany dowód:** trzy zdania w raporcie, że przeczytałeś te zasady, plus `git show --stat`
każdego commita. **Bez commita — to jest warunek, nie pozycja.**

## R1 — PIĘĆ WYWOŁAŃ BEZ `ariaLabel` I BEZPIECZNIK TYPÓW (rdzeń)

1. **Zmierz stan wejściowy** komendą (1) z `§0.3` i **zapisz surowe wyjście** do
   `evidence/day356/tsc-przed.txt`. **Obie wersje komendy** — z domyślną stertą i z
   `--max-old-space-size=8192` — z zapisanymi kodami wyjścia. To jest dowód pułapki `§0.2e`.
2. **Napraw pięć wywołań**: dopisz `ariaLabel` w wierszach 16, 22, 29, 36, 44 pliku
   `src/components/MyWork/prototypes/__tests__/IdeaNotebookRightPanelPrototype.test.tsx`.
   Wartość ma być sensowna dla kontekstu (`context="idea"` → etykieta idei, `context="notebook"`
   → etykieta notatki), nie pusty napis. **Nie zmieniasz niczego innego w tym pliku.**
3. **Sprawdź żywych konsumentów bramki** komendą (6) z `§0.3`:
   `NotebookRightRail.tsx:1038` i `standard/IdeaRightPanel.tsx:422`. **Czy one podają
   `ariaLabel`?** Jeżeli któryś nie podaje, a mimo to `tsc` milczy — **to jest znalezisko
   ważniejsze niż cała reszta pozycji** i opisujesz je z `plik:linia`. Naprawy w tych plikach
   NIE robisz (cudzy teren produkcyjny) — dostarczasz diff **nienałożony**.
4. **Zbuduj bezpiecznik typów.** Wymagania, wszystkie obowiązkowe:
   - **jest PUNKTOWY** — obejmuje jawną listę plików albo katalog, a nie próg „cały projekt =
     0", bo dziś jest 92 błędy i taki bezpiecznik nigdy by nie przeszedł;
   - **ustawia stertę** — bez `--max-old-space-size` `tsc` pada na OOM i jego awaria wygląda
     jak sukces;
   - **traktuje pusty wynik jako BŁĄD KOMENDY**, nie jako zero błędów — kod wyjścia i liczba
     przeanalizowanych plików idą do wyjścia bezpiecznika;
   - **żyje w `scripts/`** jako skrypt **i** w `tests/` jako test, żeby był uruchamialny na
     dwa sposoby; podłączenie do CI rekomendujesz jako diff **nienałożony** (`Z38`/`Z39`).
5. **Dowód mutacyjny bezpiecznika typów:** usuń `ariaLabel` z **jednego** z pięciu wywołań →
   bezpiecznik ma **zaczerwienić się** z komunikatem wskazującym `plik:linia`; cofnij przez
   `cp` ze `SCRATCH` (nigdy `git stash`, `Z27`) → ma **zzielenieć**; `git diff` po cofnięciu
   **pusty**. Obie komendy i oba wyniki dosłownie w raporcie.

**Wymagany dowód:** `evidence/day356/tsc-przed.txt` i `tsc-po.txt` z kodami wyjścia obu wersji
komendy · liczba błędów przed (`92`) i po (oczekuję `87`) · odpowiedź o dwóch żywych
konsumentach · skrypt bezpiecznika · para „mutacja czerwony / cofnięcie zielony" dosłownie.
**Commit po `R1`.**

## R2 — BEZPIECZNIK FLAGI, KTÓRY CZERWIENI SIĘ OD COFNIĘCIA (rdzeń)

**To jest pozycja, w której hipoteza `H1` staje się faktem albo pada.**

1. **Najpierw OBAL ALBO POTWIERDŹ `H1`, zanim cokolwiek zbudujesz.** Zmutuj
   `src/utils/ideaNotebookRightPanelPrototypeFlag.ts` — zamień wiersz 27
   `parseFlag(import.meta.env.VITE_IDEA_NOTEBOOK_RIGHT_PANEL_PROTOTYPE)` na wariant obliczony
   `parseFlag((import.meta as unknown as { env?: Record<string,string|undefined> })?.env?.[ENV_KEY])`
   — i uruchom **cały** `tests/unit/flags/`, `--retry=0`, `--reporter=json`.
   **Zapisz `numTotalTests` i `numFailedTests`.** Cofnij przez `cp`.
   - Twierdzę, że pakiet **pozostanie całkowicie zielony**. Jeżeli tak — `H1` potwierdzona,
     bezpiecznik musi być statyczny albo budujący.
   - **Jeżeli coś zaczerwienieje — `H1` jest FAŁSZYWA**, zapisujesz to zdaniem „hipoteza
     autora instrukcji obalona pomiarem", wskazujesz który przypadek zaczerwienił i **budujesz
     tańszy bezpiecznik uruchomieniowy**. To jest lepszy wynik niż mój.
2. **Zbuduj bezpiecznik flagi.** Jeżeli `H1` się potwierdziła, dopuszczalne są dwie drogi
   i **uzasadniasz wybór, wypisując, co odrzuciłeś**:
   - **(A) skan źródeł** — bezpiecznik czyta pliki flag z jawnej listy i **odrzuca** dostęp
     obliczony `env[...]` / `env?.[...]` do klucza `VITE_*`, wymagając wyrażenia statycznego.
     Musi być odporny na obie formy zapisu (`meta.env?.[K]` i `meta?.env?.[K]`) — pokaż to
     przypadkiem testowym dla każdej formy;
   - **(B) skan gotowego pakietu** — bezpiecznik buduje front i sprawdza, czy literał wartości
     env pojawił się w pakiecie. Droższy, ale mierzy dokładnie to, co psuje się w produkcji.
     **Jeżeli wybierzesz (B), zmierz czas budowy i podaj go w raporcie** — bezpiecznik, który
     trwa dziesięć minut, zostanie wyłączony przy pierwszej okazji.
3. **Dowód mutacyjny bezpiecznika flagi, obowiązkowy:** zmutuj flagę na wariant obliczony →
   bezpiecznik ma **zaczerwienić się**; cofnij przez `cp` → ma **zzielenieć**; `git diff`
   po cofnięciu **pusty**. Obie komendy i oba wyniki dosłownie w raporcie.
   ★ **Mutacja wartości domyślnej `false` → `true` NIE LICZY SIĘ** jako dowód — to jest inne
   zabezpieczenie i pilnuje go `tests/unit/flags/flagiDomyslnieOn.test.ts`.
4. **Sprawdź, że nie zepsułeś tego, co już działa:** `tests/unit/flags/` w całości ma zostać
   zielone po Twojej pracy, z **listą nazw przypadków**, nie samą liczbą (`Z37`).

**Wymagany dowód:** wynik mutacji z punktu 1 z `numTotalTests` i `numFailedTests` · jawne
zdanie „`H1` potwierdzona / obalona" · opis wybranej drogi z uzasadnieniem odrzucenia drugiej ·
para „mutacja czerwony / cofnięcie zielony" · nazwy wszystkich przypadków `tests/unit/flags/`
przed i po. **Commit po `R2`.**

## R3 — CZY OBA BEZPIECZNIKI ŁAPIĄ STAN ZASTANY (rdzeń)

Krótka pozycja, ale rozstrzygająca: **bezpiecznik, który nie łapie defektu, dla którego
powstał, jest atrapą.**

1. Cofnij worktree do stanu zastanego **wyłącznie w dwóch plikach** (przez `cp` ze `SCRATCH`,
   nigdy `git stash`): test bramki bez `ariaLabel` w pięciu miejscach **oraz** flaga
   w wariancie obliczonym.
2. Uruchom oba bezpieczniki. **Oba mają być CZERWONE**, każdy ze wskazaniem `plik:linia`.
3. Przywróć swój stan. **Oba mają być ZIELONE.** `git diff` po przywróceniu ma pokazywać
   wyłącznie Twoje zamierzone zmiany.
4. **Zapisz oba przebiegi surowo** do `evidence/day356/` i podaj `shasum -a 256` każdego pliku.

**Wymagany dowód:** cztery przebiegi (dwa bezpieczniki × dwa stany) z surowymi wyjściami
i sumami kontrolnymi · `git diff` po przywróceniu. **Commit po `R3`.**

## R4 — INWENTARZ RODZINY Z PODZIAŁEM ŻYWE / MARTWE

**Ten dyżur rodziny NIE NAPRAWIA. Ma ją policzyć i pokazać, ile z niej naprawdę żyje.**

1. Wypisz **wszystkie** pliki `src/**` z obliczonym dostępem do `import.meta.env` do
   `evidence/day356/rodzina-env.tsv`: `ścieżka · numer wiersza · forma zapisu · nazwa klucza
   `VITE_*``. **Podaj wzorzec, którym je znalazłeś, i liczbę, którą dał** — mój wzorzec dał
   **109** plików, węższy dał **6**, i ta różnica jest ostrzeżeniem, nie ciekawostką.
2. **Rozstrzygnij ŻYWE / MARTWE osiągalnością OD KORZENIA**, nie metodą „plik bez importera".
   Metoda per-plik liczy importy wewnątrz martwego poddrzewa jako żywe i już raz przepuściła
   w tym programie osiem plików plus hook. Narzędzie: `scripts/dev/reachability-from-root.mjs`.
   Wynik: kolumna `ŻYWY` / `MARTWY` / `NIEORZECZONY` przy każdym pliku.
3. **Nie orzekaj na próbce.** Jeżeli sprawdzisz część, napisz **ile z ilu** i **którą część** —
   „obejrzałem dwa najstarsze pliki i ogłosiłem ich stan stanem całości" to zmierzony kształt
   fałszywego „gotowe", który już raz kosztował ten program dzień.
4. **Wskaż podzbiór, który jest jednocześnie ŻYWY i obliczony** — to jest realny dług
   i to jest liczba, po którą program przyjdzie. Podaj ją jawnie.
5. **Nie naprawiasz ani jednego pliku z tej rodziny poza flagą panelu.** Rekomendację
   dostarczasz jako diff **nienałożony** dla **jednego** wybranego pliku, jako wzór dla
   przyszłego zlecenia.

**Wymagany dowód:** `evidence/day356/rodzina-env.tsv` z pełną listą · wzorzec i jego liczba ·
kolumna ŻYWY/MARTWY z metodą · jawna liczba „żywe ∧ obliczone" · jeden diff wzorcowy,
nienałożony. **Commit po `R4`.**

## R5 — RAPORT, JAWNA LICZBA I PYTANIA DO WŁAŚCICIELA

Raport zawiera: wynik `tsc` przed i po z **obiema** wersjami komendy i kodami wyjścia ·
odpowiedź o dwóch żywych konsumentach bramki · **jawne zdanie „`H1` potwierdzona / obalona"** ·
opis obu bezpieczników z uzasadnieniem wyboru drogi · **cztery pary mutacyjne dosłownie** ·
inwentarz rodziny z liczbą „żywe ∧ obliczone" · listę rozbieżności wobec liczb tej instrukcji ·
**niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE"** · obowiązkowy akapit `§0.2e` dla każdego
uruchomionego pakietu.

★★ **Osobna, obowiązkowa sekcja: „CO NADAL WYMAGA OSOBNEGO ZLECENIA".** Rodzina 109 plików
nie jest naprawiana w tym dyżurze — wypisujesz, ile z niej żyje, ile rodzin naprawczych to
obejmuje i jaki jest wzór naprawy (jeden diff).

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA".** Jeżeli uznasz, że bezpiecznik
powinien wejść do CI jako bramka blokująca — **piszesz to tutaj jako pytanie rozstrzygalne
(„tak"/„nie"), i NIE podłączasz go samodzielnie** (`Z38`/`Z39`). Sekcja może być pusta, ale
wtedy piszesz wprost: „nie mam zastrzeżeń".

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl '<nazwa-pliku>' scripts/"`. Sekcję w `REJESTR_ZNALEZISK_20260903.md`
dopisujesz o **pierwszej wolnej literze** — sprawdź ją komendą
`bash -c "grep -nE '^## [A-Z]\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
**tuż przed commitem**, bo równolegle piszą inni autorzy (dziś sekcje doszły do `Q`).

**Commit po `R5`.**

## Próg odbioru

**Mutacja „obliczony dostęp" czerwieni. Mutacja „usunięcie `ariaLabel`" czerwieni. Inwentarz
rodziny z podziałem żywe/martwe istnieje i podaje jawną liczbę „żywe ∧ obliczone".**

Odbiorca odrzuci dyżur, w którym bezpiecznik pokazano tylko na zielono; w którym bezpiecznik
typów brzmi „cały projekt = 0" (bo dziś jest 92 i nigdy nie przejdzie); w którym `tsc`
uruchomiono bez ustawionej sterty i pusty wynik odczytano jako zero błędów; w którym
`ariaLabel` zrobiono opcjonalnym zamiast dopisać go pięć razy; albo w którym inwentarz
rodziny opisuje próbkę, a mówi o całości.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „pięć wywołań naprawione,
`H1` rozstrzygnięta pomiarem, jeden bezpiecznik zbudowany z parą mutacyjną, drugi nie —
bo wymaga decyzji o czasie budowy" — **jest pełnowartościowym wynikiem.**

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Dołóż bezpiecznik typów" vs „w projekcie jest 92 błędy" | `R1` punkt 4: bezpiecznik jest **PUNKTOWY**, obejmuje jawną listę plików; próg „cały projekt = 0" jest jawnie zakazany jako niewykonalny |
| „Napraw typy" vs „nie osłabiaj kontraktu" | `R0` (3) i tabela licencji: naprawa idzie po stronie **wołających** (dopisanie `ariaLabel`), nie przez `ariaLabel?: string` ani przez `exclude` w `tsconfig.json` |
| „Napisz test flagi, który czerwieni się od cofnięcia" vs „test uruchomieniowy tego nie odróżni" | `R2` punkt 1: **najpierw mierzysz, czy odróżnia**; jeżeli nie — bezpiecznik jest statyczny albo budujący; jeżeli odróżnia, moja teza jest obalona i budujesz tańszy |
| „Bezpiecznik ma być w CI" vs `Z38`/`Z39` (zakaz ruszania CI) | Tabela licencji, wiersz „CI": dostarczasz **skrypt + test**, podłączenie rekomendujesz jako diff **nienałożony** i jako pytanie do właściciela w `R5` |
| „Zinwentaryzuj rodzinę" vs „nie naprawiasz rodziny" | `R4` punkt 5: produktem jest **lista + jeden diff wzorcowy nienałożony**; naprawa rodziny to osobne zlecenie |
| „Mutuj flagę" vs `Z10` (zakaz zmiany wartości domyślnych flag) | `POZYCJE_Z_FLAGAMI` i `R2` punkt 3: mutacja dotyczy **sposobu dostępu**, nie wartości domyślnej; wartość domyślna `false` zostaje nietknięta, a mutacja jest cofana przez `cp` |
| „Cofaj mutacje" vs `Z27` (zakaz `git stash`) | `R1` punkt 5, `R2` punkt 3, `R3` punkt 1: mutację cofasz przez `cp` ze `SCRATCH`; `git diff` po cofnięciu ma być pusty |
| „Zmierz rodzinę" vs „nie orzekaj na próbce" | `R4` punkt 3: jeżeli sprawdzasz część, piszesz **ile z ilu i którą**; próbka podana jako całość jest podstawą odrzucenia |
| „Instrukcja mówi ok. 124 pliki" vs „mój pomiar mówi 109" | Sekcja „MOJA HIPOTEZA", teza `H3`: autor obalił liczbę zlecenia przy wydaniu; wiążący jest pomiar wykonawcy (`Z24`) |
| „Nie dotykasz konsumentów bramki" vs „mogą wołać ją bez `ariaLabel`" | `R1` punkt 3: to jest **znalezisko do raportu z diffem nienałożonym**, nie naprawa; pozycja z takim produktem jest ZROBIONA |
| „Dopisz sekcję do rejestru znalezisk" vs „równolegle piszą inni autorzy" | `R5`: literę sekcji sprawdzasz komendą **tuż przed commitem**, nie zakładasz z góry |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 11 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — plik testu (5 wywołań), komponent i bramka, flaga, trzy pliki `tests/unit/flags/`, dwaj żywi konsumenci, `scripts/dev/reachability-from-root.mjs` sprawdzone przy wydaniu; `evidence/day356/` **jawnie oznaczony jako nieistniejący** |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 10 wierszy; wiersze 1-7 i 10 zmierzone przy wydaniu na markerze, w tym awaria OOM `tsc` |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — kontrakt typów · test bramki · flaga panelu · rodzina flag · żywi konsumenci · nowe testy i bezpieczniki · istniejące testy flag · konfiguracja typów · infrastruktura testów · CI · serwer · słowniki · dowody · rejestr znalezisk · raport · macierze · cudze tereny |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1` zmienia jeden plik testowy, `R2` mutuje i cofa jeden plik flagi, `R3` tylko mierzy, `R4` tylko inwentaryzuje |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — `6415`/`5555` wolne (`lsof` przy wydaniu), brak kontenera `cx-day356-pg`, brak gałęzi `codex/day356-*` i worktree; 355/357/358 mają rozłączne porty i rozłączne pliki; dyżury 351-354 mają rozłączny temat |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera, łącznie z obiema wersjami `tsc` |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: **OOM `tsc` przy domyślnej stercie dający pusty plik czytany jako zero**, `vi.stubEnv` zacierające różnicę statyczny/obliczony, węższy wzorzec `grep` zaniżający rodzinę osiemnastokrotnie, `grep --include` w `zsh`, metoda „plik bez importera" licząca martwe poddrzewo jako żywe |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany", zero pól szablonu | TAK — kontrola generatora przy wydaniu |
