## Po co ten dyżur istnieje

Dyżur 349 (scalony, `4f01d13012`) dostał zadanie naprawienia czterech czerwonych kontraktów UI
i wykonał je **uczciwie** — z produktu, bez wyciszania testów, bez osłabiania asercji. Jedna
z tych napraw dotyczyła `src/components/standard/StandardPreview.tsx` i wygląda tak
(commit `58d391d65b`):

```
-  const footer =
-    ai || relations || actionRows.length > 0 || whatsNext ? (
+  const footer = (
       <div className="space-y-2.5">
         {ai ? <PreviewAIHintStrip {...ai} /> : null}
-        {relations ? (
-          <PreviewRelations items={relations} emptyLabel={…} />
-        ) : null}
+        <PreviewRelations items={relations ?? []} emptyLabel={…} />
```

**Skutek, którego zlecenie dyżuru 349 nie obejmowało:** stopka podglądu renderuje się teraz
**zawsze**, a każdy ekran, który nie podaje `relations`, dostał **kartę „Brak powiązań"**.
To jest **realna zmiana wyglądu na kilkunastu żywych ekranach, której nikt nie oglądał**.

**★ To nie jest zarzut wobec dyżuru 349.** Zmiana jest zgodna z jednym z dwóch dokumentów kanonu
i naprawia realny kontrakt. Brakuje wyłącznie **czyichś oczu** — bo reguła nr 7 `CLAUDE.md` jest
nienaruszalna: **właściciel NIGDY nie jest pierwszym testerem wizualnym.**

### ★ Drugie dno: SSOT wyglądu sam sobie przeczy w tym punkcie

To jest część merytoryczna dyżuru i najcenniejsza rzecz, jaką możesz z niego wynieść.

| Dokument | Co mówi o bloku 5 | Wniosek |
| --- | --- | --- |
| `docs/ui-standards/TRIADA_KANON.md:70` | „**Relations:** klikalne pigułki **albo** »No relations«." | karta **ZAWSZE**, także pusta |
| `docs/ui-standards/TRIADA_KANON.md:132` (lista czekowania, pkt 29) | „Relations **albo** »No relations«" | karta **ZAWSZE** |
| `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md:337` | „**Relations** (blok 5 TRIADY, **jeśli są**)" | karta **TYLKO GDY SĄ** |

Dwa dokumenty kanonu, dwa przeciwne wymagania, jedna zmiana kodu, która wybrała jedno z nich.
**Tego nie rozstrzygasz sam** (`Z14`, `Z40`) — i nie zmieniasz żadnego z tych dokumentów.
Stawiasz właścicielowi **jedno pytanie rozstrzygalne**, poparte zrzutami, w `R5`.

---

## ★ Sprostowanie zlecenia — co mój pomiar na markerze skorygował

Zlecenie mówiło: „**20 z 44** ekranów `StandardPreview` nie podaje `relations`".
**Zmierzyłem to na markerze i obie liczby są inne.**

Metoda, którą policzyłem (i którą masz powtórzyć **własnym** narzędziem): usunąć komentarze
`/* */` i `//`, znaleźć każde otwarcie tagu `<StandardPreview`, przeczytać blok atrybutów
**do domykającego `>` z uwzględnieniem zagnieżdżonych klamer**, i sprawdzić, czy zawiera
`relations=`.

**Dlaczego to ma znaczenie:** naiwny `grep -rl '<StandardPreview'` daje 49 plików, ale
**dwa trafienia to zdania w blokach komentarza** (`src/views/vault/VaultDocumentsView.tsx` ok. 20,
`src/components/assessment/AssessmentHub.tsx` ok. 2696 — oba opisują komponent, nie renderują go).
Policzenie ich jako ekranów zawyża wynik i wysyła Cię po zrzuty ekranów, które karty nie mają.

**Moje liczby, do zweryfikowania:**

| Co | Moja liczba |
| --- | --- |
| Użycia JSX `<StandardPreview>` w `src/` (bez testów, bez samego komponentu, bez komentarzy) | **53** w **39** plikach |
| Z tego **podaje** `relations=` | **27** |
| Z tego **NIE podaje** `relations=` | **26**, w **18** plikach |
| Klasyfikacja osiągalności tych 18 plików | **wszystkie `app`** — ekrany są żywe |
| Użycia w `dev-render/` | **3**, z czego **2** bez `relations` |
| Wpisy w rejestrze `SCREENS` harnessu | **394** |
| Z 18 plików: pokryte harnessem | **15** (9 wprost, 5 zakładek Audytów przez `audyty-piec-powierzchni&tab=…`, `MyProjects` przez `zwornik-projects`) |
| Z 18 plików: **bez żadnego wejścia w harnessie** | **3** — cały `CaseWorkspace` (`CasesListScreen`, `RealizacjaView`, `RezultatyView`), łącznie **7** z 26 użyć |

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost.**

---

## ★ Zmierz moje liczby sam

Twierdzę: użyć `<StandardPreview>` w `src/` jest **53** w **39** plikach; bez `relations` — **26**
w **18** plikach; wszystkie te pliki mają klasyfikację **`app`**; w `dev-render/` są **3** użycia,
**2** bez `relations`; rejestr `SCREENS` ma **394** wpisy; `CaseWorkspace` ma **0** trafień w całym
katalogu `dev-render/`; próg różnicy jasności bezpiecznika pary to **150**; `StandardPreview.tsx`
ma **548** linii; liście `public/locales/pl/translation.json` = **35199**, `en` = **33066**.

**Każdą z tych liczb policz sam. Przepisanie mojej liczby jest zawyżeniem i podstawą odrzucenia
raportu (`Z24`).** Wszystkie grepy uruchamiaj przez `bash -c "…"` — `grep --include` w `zsh`
zwraca pustkę zamiast wyniku, a **pustka nie jest wynikiem, dopóki nie sprawdzisz, że polecenie
się wykonało**.

---

## B.1. TABELA LICENCJI — CAŁA ŚCIEŻKA: KOMPONENT · WOŁACZE · HARNESS · NARZĘDZIE · DOWODY

> **★★ ZASTRZEŻENIE.** Poniższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz, jest
> opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie i STOP z tytułu »nie wolno mi« jest
> NIEZASADNY**. Jeżeli pliku nie ma w tabeli — domyślnie **TYLKO DO ODCZYTU**, a Twoim produktem
> jest opis + brief, **nie zatrzymanie dyżuru**.

| Warstwa | Plik / wzorzec | Licencja | Co robisz, gdy pozycja wymagałaby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- | --- |
| **komponent podglądu** | `src/components/standard/StandardPreview.tsx` | **★ WĄSKA LICENCJA — WYŁĄCZNIE TYMCZASOWA MUTACJA NA CZAS ZRZUTU „PRZED", cofana przez `cp` ze `SCRATCH` natychmiast po zrobieniu pary.** `git diff` na tym pliku po cofnięciu **PUSTY**; plik **nie może wystąpić w żadnym commicie tego dyżuru**. ZAKAZ trwałej zmiany zachowania (`Z40`) | Zrzut „PRZED" produkujesz z `git show 58d391d65b~1:src/components/standard/StandardPreview.tsx` zapisanego do `SCRATCH`; jeśli i to zawiedzie — opisujesz w raporcie i robisz same „PO" z adnotacją, **pozycja jest ZROBIONA** |
| **osiemnaście wołaczy podglądu** | `src/components/Audit/method/tabs/**`, `src/components/CaseWorkspace/**`, `src/components/Economics/FinanceHub.tsx`, `src/components/MyWork/MyProjects.tsx`, `src/components/ReportBuilder/**`, `src/components/ResultsVNext/**`, `src/components/SuperAdmin/ModelRegistry/**`, `src/components/assessment/library/**`, `src/views/superadmin/**` | **TYLKO ODCZYT.** ★★ **ZAKAZ dosypywania `relations` do tych plików** — to byłaby zmiana wyglądu na kolejnych osiemnastu ekranach, której znowu nikt by nie widział, i wyprzedzenie decyzji właściciela z `R5` | Wpis do raportu: plik, linia, jak wygląda karta, **gotowa rekomendacja jako diff w bloku kodu, nienałożony**. Pozycja idzie dalej |
| **rejestr ekranów harnessu** | `dev-render/main.tsx` | **★ WĄSKA LICENCJA — WYŁĄCZNIE dopisanie NOWYCH wpisów do `SCREENS` dla ekranów, które nie mają żadnego wejścia** (`CaseWorkspace`). ZAKAZ zmiany i usuwania wpisów zastanych, zakaz zmiany kolejności | Jeżeli wpis wymagałby przebudowy — **STOP MERYTORYCZNY z briefem dla tych trzech ekranów**, reszta pracy idzie dalej. Pozycja jest **ZROBIONA** z takim briefem |
| **nowe ekrany harnessu** | `dev-render/screens/**` (**NOWE pliki**) | **★ PEŁNA LICENCJA.** Ekran harnessu **montuje REALNY komponent produktu z mock-danymi**, nigdy nie odtwarza go od nowa (wzór: `dev-render/screens/zwornik-projects.tsx`, który importuje `<MyProjects />` z `src/`) | — |
| **narzędzie zrzutowe** | `scripts/dev/grafika-zrzuty.mjs` | **TYLKO ODCZYT domyślnie.** **★ WĄSKA LICENCJA WARUNKOWA:** jeżeli `R2` udowodni, że pary nie da się zrobić istniejącymi opcjami — wolno dodać **jedną opcję OPT-IN**, tak żeby historyczne wywołania zachowały się **bit w bit**. ★★ **ZAKAZ pisania własnego skryptu zrzutowego obok** (`Z40`) | Opis w raporcie: czego zabrakło, jaka byłaby opcja, i **gotowy diff nienałożony** |
| **bezpiecznik pary** | `scripts/dev/lib/checkScreenshotPairState.mjs`, `scripts/dev/lib/meanLuma.mjs` | **TYLKO ODCZYT — `Z18`** | Opis w raporcie: co bezpiecznik przepuścił i dlaczego jest to niebezpieczne |
| **SSOT wyglądu** | `docs/ui-standards/TRIADA_KANON.md`, `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md`, `docs/ui-standards/02-components/families/UI-PREVIEW-01/STANDARD.md` | **TYLKO ODCZYT — BEZWZGLĘDNIE** (`Z14`). Sprzeczność między nimi **opisujesz, nie rozstrzygasz** | **Wpis `DO DECYZJI WŁAŚCICIELA`** z cytatami obu zdań, numerami wierszy i zdaniem „czego konkretnie mi zabrakło, żeby rozstrzygnąć samodzielnie". Pozycja **ZROBIONA** |
| **kontrakty podglądu (ZASTANE)** | `src/components/shared/__tests__/standardPreview.r03.test.tsx`, `src/components/standard/__tests__/**`, `src/components/shared/__tests__/tablePreviewGeometry.r03-2.test.tsx` | **TYLKO ODCZYT — uruchamiasz, nie naprawiasz.** Czerwień z powodów spoza tego dyżuru zapisujesz **z pełnymi nazwami przypadków** i idziesz dalej | Wynik przelotu w raporcie z `numTotalTests` i pełnymi nazwami |
| **kontrakty (NOWE)** | `tests/unit/preview/**` (**NOWE**) | **★ PEŁNA LICENCJA**, `git add -f`. **★ NOWE PLIKI TESTOWE kładziesz w `tests/`, NIGDY pod `src/`** — plik testowy pod `src/` czerwieni `node scripts/dev/reachability-from-root.mjs --check-baseline` (zdarzyło się 04.09 trzy razy) | — |
| **dowody i zrzuty** | `evidence/podglad-relations-20260904/**` (**NOWY**) | **★ PEŁNA LICENCJA, `git add -f` — DOTYCZY TO TAKŻE PLIKÓW PNG.** ★★ 04.09 trzykrotnie trzeba było ratować dowody z katalogów tymczasowych, a raz dyżur powołał się na **nieistniejący „zakaz binariów"**. Ta instrukcja daje licencję na `evidence/` — **zrzuty mają tam trafić** | — |
| **cudze dowody** | `evidence/grafika/**`, `evidence/day349/**`, `evidence/g19/**` | **TYLKO ODCZYT — CUDZE DOWODY.** ZAKAZ nadpisania | Twoje artefakty idą do własnego katalogu |
| **rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **★ WĄSKA LICENCJA — WYŁĄCZNIE dopisanie JEDNEJ nowej sekcji o pierwszej wolnej literze** | — |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY352_PREVIEW_20_EKRANOW_REPORT.md` (**NOWY**) | `§R.2` — **JEDYNY nowy dokument raportowy** (`Z13`) | — |
| **macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | **TYLKO ODCZYT — teren dyżuru 353** | Wpis do raportu, **nie zmieniasz stanu** |
| **bramki i infra testowa** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.husky/pre-commit`, `scripts/check-*.sh`, `scripts/check-dev-render-parytet.mjs` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie: co blokuje pomiar, jaka byłaby zmiana, jak obszedłeś to zmiennymi w linii komendy. Pozycja **ZROBIONA** |
| **cudzy teren** | `server/**` i `src/services/**drdViz**` — **teren dyżuru 351**; `evidence/g19/**`, `modules/**` — **teren dyżuru 353**; `src/components/DiscoveryTools/**`, `src/toolPacks/**`, `src/components/Discovery/**` — **teren dyżuru 354** | **TYLKO ODCZYT** | Wpis do raportu z gotową rekomendacją jako diff, nienałożony |
| — | **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI

**Jedna pozycja = jeden wiersz = jeden commit = jeden werdykt. Commit robisz PO KAŻDEJ pozycji,
push na `github-backup` po pierwszym commicie i po każdej kolejnej (`Z34a`).**

| Pozycja | Nazwa | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione | Definicja ukończenia | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | Własny pomiar: ile użyć, w ilu plikach, które osiągalne, które pokryte harnessem | TAK | NIE — dowód: pomiar jest odczytem, nie dotyka żadnego pliku produktu | bazowe | Tabela: `plik:linia` · `relations` TAK/NIE · klasyfikacja osiągalności · **wpis w `SCREENS`, który ten ekran montuje** (albo „BRAK") + **własne liczby**; licznik usuwa komentarze i czyta blok atrybutów do domykającego `>` | własny licznik w `node` + `node scripts/dev/reachability-from-root.mjs` | `docs(day352): inwentarz podgladow bez relations (352 R1)` |
| R2 | **RDZEŃ: pary PRZED/PO dla WSZYSTKICH pokrytych ekranów, light+dark** | TAK | NIE — dowód: „PRZED" powstaje z tymczasowej kopii, cofanej przez `cp`; commit nie zawiera `StandardPreview.tsx` | n/d | Dla każdego pokrytego ekranu **cztery pliki** (PRZED-light, PRZED-dark, PO-light, PO-dark) w `evidence/podglad-relations-20260904/`; **żadna para nie ma identycznej sumy kontrolnej**; `shasum -a 256` i średnia jasność każdego pliku w raporcie; **obecność karty czytana z uchwytu DOM**, nie z obrazu | `node scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5551 --ekrany=… --katalog=… --faza=PRZED\|PO --rozwin-sekcje=1 --klik-po-rozwinieciu=1 --osiad-po-rozwinieciu=800` | `evidence(day352): pary PRZED/PO kart Brak powiazan (352 R2)` |
| R3 | **RDZEŃ: obejrzenie i orzeczenie per ekran** | TAK | NIE | n/d | Lista **wszystkich** ekranów z `R2` podzielona na `WYGLĄDA DOBRZE` / `WYGLĄDA ŹLE`, **każdy z jednozdaniowym uzasadnieniem odnoszącym się do konkretnego zrzutu**; osobno wskazane ekrany, gdzie karta **zabiera miejsce potrzebne treści** | odczyt własnych zrzutów + wysokości bloków z uchwytu DOM | `docs(day352): orzeczenie per ekran na parach PRZED/PO (352 R3)` |
| R4 | Trzy ekrany bez wejścia w harnessie: wpis albo brief | NIE | NIE | n/d | Dla `CaseWorkspace` albo **nowy wpis `SCREENS` + para zrzutów**, albo **STOP MERYTORYCZNY z briefem**: czego zabrakło, ile pracy potrzeba, jaki byłby wpis. **Oba wyniki są pełnowartościowe** | `bash -c "grep -rn 'CaseWorkspace' dev-render/"` | `feat(dev-render): wejscie harnessu dla CaseWorkspace (352 R4)` |
| R5 | Rekomendacja + **JEDNO pytanie rozstrzygalne do właściciela** | NIE | NIE | n/d | Rekomendacja oparta na `R3`; **cytaty obu sprzecznych zdań SSOT z numerami wierszy**; pytanie w formie „tak"/„nie"; wpis `DO DECYZJI WŁAŚCICIELA` ze zdaniem „czego konkretnie mi zabrakło, żeby rozstrzygnąć samodzielnie" | — | `docs(day352): rekomendacja i pytanie o pusty blok Relations (352 R5)` |
| R6 | Raport | NIE | NIE | n/d | Struktura `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE" **niepusta** | — | `docs(day352): raport` |

> **Kolumna „Wymaga plików przekrojowych?" jest wypełniona dla KAŻDEJ pozycji, z dowodem przy
> odpowiedzi `NIE`.** Jedynym plikiem przekrojowym w promieniu jest `StandardPreview.tsx` —
> i **żaden commit tego dyżuru nie ma prawa go zawierać**; mutacja jest tymczasowa i cofana przez
> `cp`. Jeśli uznasz, że musi być trwała — produktem jest gotowy diff **nienałożony** + brief,
> a pozycja jest **ZROBIONA**.

---

## B.3. TABELA MIANOWNIKÓW

**Każdą z tych liczb mierzysz sam (`Z24`) i podajesz swoją. Wszystkie komendy uruchamiasz
w `bash`, nigdy w `zsh`.**

| # | Co liczę | Liczba autora | Komenda | Obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Użycia JSX `<StandardPreview>` w `src/`, bez testów, bez komentarzy | 53 w 39 plikach | własny licznik `node`: usuń `/* */` i `//`, znajdź `<StandardPreview` niepoprzedzone znakiem słowa, czytaj do `>` na zerowej głębokości klamer | **TAK — i to jest jedyny poprawny mianownik.** `grep -rl` daje 49 plików, w tym **dwa komentarze**; policzenie ich zawyża wynik |
| 2 | Z tego bez `relations=` | 26 w 18 plikach | jw., filtr `!/\brelations\s*=/` na bloku atrybutów | TAK — **to jest mianownik pozycji `R2`** |
| 3 | Klasyfikacja osiągalności tych 18 plików | wszystkie `app` | `node scripts/dev/reachability-from-root.mjs` + filtr po `file` | TAK — rozstrzyga, czy zmiana jest żywa, czy jest miną |
| 4 | Użycia w `dev-render/` | 3, w tym 2 bez `relations` | jw., ścieżka `dev-render/` | TAK — harness też pokazuje kartę i to trzeba wiedzieć, czytając zrzut |
| 5 | Wpisy w rejestrze `SCREENS` | 394 | `node -e '…matchAll(/^  \x27([a-z0-9-]+)\x27: \{/gm)…'` na `dev-render/main.tsx` | TAK — mianownik pokrycia harnessem |
| 6 | Pliki z 18 **bez żadnego wejścia** w harnessie | 3 (cały `CaseWorkspace`) | `bash -c "grep -rn 'CasesListScreen\\\|RealizacjaView\\\|RezultatyView' dev-render/"` | **TAK — pustka tu jest wynikiem tylko dlatego, że komenda się wykonała; sprawdź kod wyjścia** |
| 7 | Zakładki Audytów pod jednym wpisem `audyty-piec-powierzchni` | 5 (`&tab=library\|processes\|outputs\|reports\|initiatives`) | `bash -c "grep -n -A3 \\"'audyty-piec-powierzchni'\\" dev-render/main.tsx"` | TAK — **jeden zrzut zamiast pięciu to próbka ogłoszona zbiorem** |
| 8 | Próg różnicy jasności bezpiecznika pary | 150 | `bash -c "grep -n 'DEFAULT_LUMA_DIFF_THRESHOLD' scripts/dev/lib/checkScreenshotPairState.mjs"` | TAK — i **im większy defekt, tym łatwiej para go przechodzi**; dlatego drugi wymiar jest obowiązkowy |
| 9 | Linie `StandardPreview.tsx` | 548 | `wc -l src/components/standard/StandardPreview.tsx` | TAK — kontrola, że czytasz ten plik, o którym mówi instrukcja |
| 10 | Liście `translation.json` | pl 35199 / en 33066 | `node -e 'const f=require("fs");function c(o){let n=0;const w=v=>{if(v&&typeof v==="object"){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ["pl","en"])console.log(l,c(JSON.parse(f.readFileSync("public/locales/"+l+"/translation.json","utf8"))));'` | TAK — **liczba nie może zmaleć** |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | `evidence/podglad-relations-20260904/**` (w tym **pliki PNG**) | NOWY | R2/R3 | ZEROWE — **twój** katalog dowodów, `git add -f` |
| 2 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY352_PREVIEW_20_EKRANOW_REPORT.md` | NOWY | R6 | ZEROWE |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `dev-render/main.tsx` | R4 | Wyłącznie **dopisanie** nowych wpisów `SCREENS` dla `CaseWorkspace`; zero zmian we wpisach zastanych. ★ Sprawdź `scripts/check-dev-render-parytet.mjs` przed commitem |
| `dev-render/screens/case-workspace-*.tsx` (NOWE) | R4 | Ekran **montuje realny komponent produktu** z mock-danymi; zero re-implementacji |
| `scripts/dev/grafika-zrzuty.mjs` | R2 | Wyłącznie **jedna opcja OPT-IN**, i tylko gdy `R2` udowodni, że bez niej pary nie da się zrobić; historyczne wywołania bit w bit bez zmian |
| `tests/unit/preview/**` (NOWE) | R3 | `git add -f`; test broni **ZACHOWANIA** (karta jest/nie ma jej przy pustych `relations`), nie literału klasy CSS |
| `docs/program/REJESTR_ZNALEZISK_20260903.md` | R5 | Jedna nowa sekcja o **pierwszej wolnej literze**, sprawdzonej komendą tuż przed commitem |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
src/components/standard/StandardPreview.tsx              — mutacja TYMCZASOWA, git diff po cofnieciu PUSTY,
                                                            plik nie moze wystapic w ZADNYM commicie
src/components/Audit/method/tabs/**                      — 18 wolaczy: TYLKO ODCZYT, zakaz dosypywania relations
src/components/CaseWorkspace/**                          — jw.
src/components/Economics/FinanceHub.tsx                  — jw.
src/components/MyWork/MyProjects.tsx                     — jw.
src/components/ReportBuilder/**                          — jw.
src/components/ResultsVNext/**                           — jw.
src/components/SuperAdmin/ModelRegistry/**               — jw.
src/components/assessment/library/**                     — jw.
src/views/superadmin/**                                  — jw.
src/components/shared/PreviewPane/**                     — PreviewRelations, wspolny komponent
docs/ui-standards/**                                     — SSOT wygladu, Z14: opisujesz sprzecznosc, nie rozstrzygasz
scripts/dev/lib/checkScreenshotPairState.mjs             — bezpiecznik pary, Z18
tests/setup.ts, tests/helpers/**, tests/__mocks__/**     — Z18
vitest*.config.ts, server/vitest.config*.ts              — Z18
.husky/pre-commit, scripts/check-*.sh                    — bramki, Z18
docs/program/waves/WAVE_03_ACCEPTANCE/modules/**         — macierz odbioru, teren dyzuru 353
evidence/grafika/**, evidence/day349/**, evidence/g19/** — CUDZE dowody
server/**                                                — ten dyzur nie dotyka serwera; teren dyzuru 351
src/components/DiscoveryTools/**, src/toolPacks/**       — teren dyzuru 354
server/migrations/**                                     — przedzial NIEPRZYDZIELONY
public/locales/**                                        — ten dyzur nie dodaje kluczy
```

### B.4.4. Zasoby wyłączne

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | 6411 | `lsof -nP -iTCP:6411 -sTCP:LISTEN` → puste (zmierzone przy pisaniu instrukcji na markerze `c0f690bae3`). ★ Podnosisz go **tylko jeśli ekran harnessu tego wymaga**; nieużycie jest poprawnym wynikiem |
| Port harnessu | 5551 | `lsof -nP -iTCP:5551 -sTCP:LISTEN` → puste. ★★ **Vite podnosisz na 5551, NIE na domyślnym 3020** — 3020 należy do toru grafiki; każde wywołanie narzędzia dostaje `--base=http://127.0.0.1:5551` |
| Nazwa kontenera | `cx-day352-pg` | `docker ps -a --format '{{.Names}}' \| grep cx-day352` → brak |
| Nazwa bazy | `cx352` | n/d |
| **Przedział migracji** | **NIEPRZYDZIELONY** — dyżur nie dodaje migracji | Potrzeba migracji = **STOP MERYTORYCZNY z briefem** |
| Gałąź | `codex/day352-preview-20-ekranow-20260904` | nie istnieje na `github-backup` (sprawdzone) |
| Worktree | `/private/tmp/cx-day352-preview-20-ekranow` | nie istnieje (sprawdzone) |
| Flagi funkcyjne | **ŻADNA NOWA i żadna zmieniona** | `bash -c "grep -rn 'relations' .env* docker-compose* railway* 2>/dev/null"` → 0 trafień na markerze |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day352-preview-20-ekranow
git diff --name-only --cached | tee /private/tmp/cx-day352-preview-20-ekranow-artefakty/staged.txt

# ★★ NAJWAZNIEJSZA KONTROLA TEGO DYZURU: komponent podgladu NIE MOZE trafic do commita
grep -c 'src/components/standard/StandardPreview.tsx' /private/tmp/cx-day352-preview-20-ekranow-artefakty/staged.txt
#   oczekiwane: 0 — jesli 1, COFNIJ (git restore --staged) i przywroc plik przez cp ze SCRATCH

grep -iE 'components/Audit/|components/CaseWorkspace/.*\.tsx|Economics/FinanceHub|MyWork/MyProjects|ReportBuilder/|ResultsVNext/|SuperAdmin/ModelRegistry|assessment/library/|views/superadmin/|shared/PreviewPane/|docs/ui-standards/|checkScreenshotPairState|tests/setup|tests/helpers|tests/__mocks__|vitest.*config|\.husky/|scripts/check-|waves/WAVE_03_ACCEPTANCE/modules/|evidence/grafika/|evidence/day349/|evidence/g19/|^server/|components/DiscoveryTools/|toolPacks/|server/migrations/|public/locales/' \
  /private/tmp/cx-day352-preview-20-ekranow-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged <plik>)" \
  || echo "rozlacznosc OK"

# ★ dowody MAJA byc w repo — takze PNG:
git diff --name-only --cached | grep -c '^evidence/podglad-relations-20260904/'
#   oczekiwane przy commicie R2: co najmniej 4 (dwie pary)

# ★ NOWY plik testowy pod src/ czerwieni bezpiecznik osiagalnosci:
git diff --name-only --cached --diff-filter=A | grep -E '^src/.*\.(test|spec)\.(ts|tsx)$' \
  && echo "★★ NOWY TEST POD src/ — PRZENIES DO tests/" || echo "testy we wlasciwym miejscu"
```

---

## R1 — WŁASNY POMIAR: ILE, GDZIE, CZY ŻYWE, CZY WIDOCZNE W HARNESSIE

**Ta pozycja nie robi ani jednego zrzutu.** Ma zamienić liczbę „20 z 44" na Twój własny,
policzalny mianownik — i **rozstrzygnąć, ile z tego w ogóle da się zobaczyć**.

**(a) Napisz własny licznik.** Nie `grep -rl`. Licznik ma: usunąć komentarze `/* */` i `//`,
znaleźć każde `<StandardPreview` **niepoprzedzone znakiem słowa**, przeczytać blok atrybutów
**do domykającego `>` na zerowej głębokości klamer**, i sprawdzić `relations=`.
**Dwa trafienia w repo to zdania w komentarzach** — jeśli je policzysz, wyślesz się po zrzuty
ekranów, które karty nie mają.

**(b) Tabela inwentarza.** `plik:linia` · `relations` TAK/NIE · klasyfikacja z
`scripts/dev/reachability-from-root.mjs` · **wpis `SCREENS`, który ten ekran montuje** (albo
jawne „BRAK"). Kolumna czwarta jest tu najważniejsza: **to ona wyznacza, ile par da się zrobić.**

**(c) Trzy grupy pokrycia, wypisane imiennie:**
1. ekrany z **własnym** wpisem `SCREENS` — zrzut wprost;
2. ekrany pod **wspólnym** wpisem z parametrem (u mnie: pięć zakładek Audytów pod
   `audyty-piec-powierzchni&tab=…`) — **pięć osobnych zrzutów, nie jeden**; obejrzenie dwóch
   i ogłoszenie tego stanem pięciu to „próbka zamiast zbioru";
3. ekrany **bez żadnego wejścia** (u mnie: cały `CaseWorkspace`) — idą do `R4`.

Prawo zatrzymania po tej pozycji.

## R2 — RDZEŃ: PARY PRZED/PO, LIGHT I DARK, DLA WSZYSTKICH POKRYTYCH EKRANÓW

**„PRZED" nie jest wspomnieniem — jest plikiem.** Produkujesz go tak:

1. `cp src/components/standard/StandardPreview.tsx <SCRATCH>/StandardPreview.PO.tsx` — kopia
   zapasowa stanu bieżącego (`Z27`, **nigdy `git stash`**: schowek jest współdzielony między
   wszystkimi worktree tego repozytorium);
2. `git show 58d391d65b~1:src/components/standard/StandardPreview.tsx > <SCRATCH>/StandardPreview.PRZED.tsx`;
3. `cp <SCRATCH>/StandardPreview.PRZED.tsx src/components/standard/StandardPreview.tsx` — mutacja
   **tymczasowa**;
4. komplet zrzutów `--faza=PRZED`;
5. `cp <SCRATCH>/StandardPreview.PO.tsx src/components/standard/StandardPreview.tsx` — **cofnięcie**;
6. `git diff -- src/components/standard/StandardPreview.tsx` → **PUSTY**. Wynik tej komendy
   wklejasz do raportu dosłownie;
7. komplet zrzutów `--faza=PO`.

**★ Kolejność ma znaczenie.** Jeżeli zrobisz najpierw wszystkie „PO", a potem zmutujesz plik
i zapomnisz cofnąć, mutacja wejdzie do commita. Kontrola z `B.4.5` łapie to, ale taniej jest
nie dopuścić.

**Wymagania dla każdego zrzutu:**

- **`--base=http://127.0.0.1:5551`** — Twój harness, nie domyślne 3020;
- **`--rozwin-sekcje=1` i `--klik-po-rozwinieciu=1`.** ★★ Bez drugiego z nich pętla rozwijania
  **zamknie podgląd** kliknięciem w róg zamykającym nakładki filtrów — i zrobisz zrzut ekranu
  **bez podglądu**, czyli bez rzeczy, którą mierzysz. Na ekranie `execution-tab-list` tekst spadł
  wtedy z 1018 do 648 znaków;
- **`--osiad-po-rozwinieciu=800`** (albo więcej) — bloki mają `fade-in`, a skan w połowie
  przejścia `opacity` daje fałszywy kontrast;
- **oba motywy** (`--motywy=light,dark`);
- **`shasum -a 256` i średnia jasność KAŻDEGO pliku** w raporcie. **Para bajtowo identyczna
  = ZERO dowodu**; to jest kształt „duplikat zamiast motywu" — ten sam obraz pod dwiema nazwami;
- **★★ obecność karty „Brak powiązań", jej wysokość i liczebność pigułek czytasz z UCHWYTU DOM**
  (`data-preview-block`, selektor karty Relations), **nigdy ze zrzutu**. Obraz jest ilustracją,
  DOM jest dowodem.

**★ Bezpiecznik pary jest dwuwymiarowy i nagradza defekt.** Sam próg jasności (150) przepuszcza
parę tym łatwiej, im większy jest wyścig klik→zrzut. Dlatego drugi wymiar — obecność
charakterystycznego elementu w DOM w **obu** wariantach — jest obowiązkowy, a jego wynik idzie
do raportu razem z sumami.

**Jeżeli któregoś ekranu nie da się zrzucić istniejącymi opcjami narzędzia** — masz wąską
licencję na **jedną opcję opt-in** (`B.1`). ★★ **Nie piszesz własnego skryptu obok** — 04.09
doraźny skrypt dał parę identycznych obrazów i zameldował sukces.

Prawo zatrzymania po tej pozycji.

## R3 — RDZEŃ: OBEJRZENIE I ORZECZENIE PER EKRAN

**Tu przestajesz mierzyć i zaczynasz patrzeć.** To jest jedyna pozycja tego dyżuru, której nie
da się zrobić komendą.

Dla **każdego** ekranu z `R2` jeden wiersz: `WYGLĄDA DOBRZE` albo `WYGLĄDA ŹLE`, z **jednym
zdaniem uzasadnienia odnoszącym się do konkretnego zrzutu**. Osobno, jawnie, wskaż ekrany,
na których **pusta karta zabiera miejsce potrzebne treści** — bo to jest realny koszt, a nie
kwestia gustu.

**★ Zanim orzekniesz „wygląda źle", sprawdź, czy nie oglądasz przyrządu.** Host harnessu nie
jest produktem: 29 ocenionych ekranów pokazywało kiedyś kompozycję, której w aplikacji nie ma,
i jednemu z nich właściciel wystawił piątkę za regresję. Jeżeli defekt polega na wysokości,
szerokości albo przycięciu — **porównaj łańcuch przodków karty w harnessie i w realnej trasie**
i napisz, co sprawdziłeś.

**★ „Wygląda dobrze" jest tak samo cennym wynikiem jak „wygląda źle".** Dowód, że coś, co
uchodziło za ryzykowne, jest sprawne, to jedna z trzech najcenniejszych rzeczy, jakie możesz oddać.

Prawo zatrzymania po tej pozycji.

## R4 — TRZY EKRANY BEZ WEJŚCIA W HARNESSIE

`CaseWorkspace` (`CasesListScreen.tsx`, `RealizacjaView.tsx`, `RezultatyView.tsx`) — u mnie
**7 z 26 użyć bez `relations`** i **zero trafień w całym `dev-render/`**. Masz dwie drogi
i **obie są pełnowartościowym wynikiem**:

1. **Dopisz wpis `SCREENS`** i ekran w `dev-render/screens/`, który **montuje realny komponent
   produktu z mock-danymi** (wzór: `dev-render/screens/zwornik-projects.tsx` importuje
   `<MyProjects />` prosto z `src/`). Nigdy nie odtwarzasz komponentu od nowa — to byłby przyrząd
   pokazujący nie produkt. Potem para zrzutów jak w `R2`.
2. **STOP MERYTORYCZNY z briefem**: czego zabrakło (jakich danych wejściowych, jakiego kontekstu),
   ile pracy potrzeba, jak wyglądałby wpis. **To nie jest porażka** — to jest nazwana granica
   dowodu, a granica nazwana jest warta więcej niż zrzut zrobiony na siłę z niewłaściwego ekranu.

**Czego nie robisz:** nie dosypujesz `relations` do tych plików, żeby „problem zniknął".

Prawo zatrzymania po tej pozycji.

## R5 — REKOMENDACJA I JEDNO PYTANIE ROZSTRZYGALNE DO WŁAŚCICIELA

**To jest główny produkt myślowy tego dyżuru.**

Pytanie brzmi: **czy ekran bez powiązań ma pokazywać kartę „Brak powiązań", czy nie pokazywać jej
wcale?** Kanon mówi „blok obowiązkowy" — ale **kanon mówi też coś przeciwnego**, w drugim
dokumencie, i to jest ustalenie, które masz właścicielowi przedstawić:

- `docs/ui-standards/TRIADA_KANON.md:70` i punkt 29 listy czekowania: „Relations **albo**
  »No relations«" — czyli **zawsze**;
- `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md:337`: „Relations (blok 5 TRIADY,
  **jeśli są**)" — czyli **tylko gdy są**.

**Zweryfikuj oba cytaty sam** i podaj własne numery wierszy. Jeżeli Twój pomiar pokaże, że
sprzeczności nie ma — **napisz to wprost, to też jest wynik** i obalenie mojej tezy.

Obowiązkowo w tej pozycji:

- **rekomendacja oparta na `R3`**, nie na przeczuciu: ile ekranów wygląda dobrze, ile źle, na ilu
  karta zabiera miejsce treści;
- **jedno pytanie w formie rozstrzygalnej („tak"/„nie")**, na przykład: *„Czy pusta karta »Brak
  powiązań« ma zostać na ekranach, które nie deklarują powiązań — mimo że na N z M zrzutów zabiera
  wiersz potrzebny treści?"*;
- **wpis `DO DECYZJI WŁAŚCICIELA`** ze zdaniem **„czego konkretnie mi zabrakło, żeby rozstrzygnąć
  samodzielnie"**. Wpis bez tego zdania liczy się jako nierozstrzygnięty;
- **★ nie zmieniasz żadnego dokumentu w `docs/ui-standards/`** (`Z14`) i nie cofasz zmiany
  dyżuru 349. Twoim produktem jest orzeczenie i pytanie, nie fakt dokonany.

Prawo zatrzymania po tej pozycji.

## R6 — RAPORT

Struktura `§R.2`. Obowiązkowo:

- **tabela inwentarza z `R1`** w całości, z kolumną pokrycia harnessem;
- **pełna lista zrzutów z `R2`**: ścieżka w `evidence/`, `shasum -a 256`, średnia jasność,
  wynik dwuwymiarowego bezpiecznika pary, **oraz odczyt z uchwytu DOM** (czy karta była, jaka
  miała wysokość, ile pigułek);
- **`git diff` na `StandardPreview.tsx` po cofnięciu mutacji — dosłownie, jako pusty wynik**;
- **orzeczenie per ekran z `R3`** w całości;
- **wynik `R4`**: wpis albo brief;
- **rekomendacja i pytanie z `R5`**;
- **tabela rozbieżności wobec liczb tej instrukcji** — każda liczba, którą Twój pomiar obalił;
- obowiązkowy akapit `§0.2e` dla **każdego** uruchomionego pakietu testowego;
- deklaracja `Z30`;
- sekcja **TWIERDZENIA NIEZWERYFIKOWANE** **niepusta**. Wymień w niej co najmniej: jak karta
  wygląda w realnej aplikacji na realnych danych (harness to nie produkt), zachowanie na wąskim
  ekranie (jeśli nie mierzyłeś), oraz ekrany, których nie udało się pokryć harnessem.

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl '<nazwa-pliku>' scripts/"`. Sekcję w `REJESTR_ZNALEZISK_20260903.md`
dopisujesz o **pierwszej wolnej literze** — sprawdź ją komendą
`bash -c "grep -nE '^## [A-Z]\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
**tuż przed commitem**, bo równolegle pisze inny autor.

**Commit po `R6`.**

## Próg odbioru

**Dla każdego ekranu, który da się pokryć harnessem, istnieje para PRZED/PO w obu motywach,
o różnych sumach kontrolnych, z odczytem karty z uchwytu DOM; każdy z nich ma orzeczenie
»wygląda dobrze« albo »wygląda źle« z uzasadnieniem odnoszącym się do konkretnego zrzutu;
a właściciel dostaje jedno pytanie rozstrzygalne z cytatami obu sprzecznych zdań SSOT.**

Odbiorca odrzuci dyżur, w którym: para ma identyczne sumy kontrolne; liczebność albo obecność
karty odczytano ze zrzutu zamiast z DOM; obejrzano część ekranów i ogłoszono to stanem wszystkich;
powstał własny skrypt zrzutowy obok kanonicznego; `StandardPreview.tsx` trafił do commita;
dosypano `relations` do wołaczy; zmieniono dokument `docs/ui-standards/`; albo przepisano moje
liczby zamiast zmierzyć własne.

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna. „R1 zrobione, R2 zrobione dla 15 z 18 ekranów, R3 zrobione
dla tych 15, R4 jako brief, R5-R6 nietknięte" jest **pełnowartościowym wynikiem** — o ile R2 stoi
na parach o różnych sumach kontrolnych, a R3 na uzasadnieniach odnoszących się do konkretnych
zrzutów.

**Odwrotna kolejność — rekomendacja napisana, a zrzutów nie ma albo są bajtowo identyczne — jest
podstawą odrzucenia.** Orzeczenie o wyglądzie bez obejrzenia wyglądu jest dokładnie tym, przed
czym ten dyżur ma chronić.

---

## AUDYT SPRZECZNOŚCI — pary wymagań i miejsce rozstrzygnięcia

| Para wymagań, która mogłaby się wykluczać | Gdzie ROZSTRZYGNIĘTA w tym dokumencie |
| --- | --- |
| „Zrób zrzut PRZED" **vs** zakaz cofania naprawy dyżuru 349 | `R2` kroki 1-6 — mutacja **tymczasowa**, cofana przez `cp` ze `SCRATCH`, `git diff` pusty, plik **nie może wystąpić w żadnym commicie**; kontrola w `B.4.5` |
| Zakaz `Z11` „nowe wizualium za flagą `default OFF`" **vs** „ta zmiana już weszła na żywo" | `POZYCJE_Z_FLAGAMI` — zmiana jest **scalona**, więc produktem jest **zobaczenie i orzeczenie**, nie schowanie jej za flagą; cofnięcie albo flaga to **rekomendacja do `R5`**, nigdy Twoja własna decyzja |
| `TRIADA_KANON.md` „Relations zawsze" **vs** `TABLE_AND_PREVIEW_CANON.md` „jeśli są" | `R5` — **nie rozstrzygasz**; cytujesz oba zdania z numerami wierszy i stawiasz właścicielowi jedno pytanie „tak"/„nie". `Z14` zabrania zmiany któregokolwiek dokumentu |
| „Napraw ekrany, na których wygląda źle" **vs** zakaz dosypywania `relations` do 18 plików | `B.1` wiersz „osiemnaście wołaczy" i `R3` — produktem jest **gotowy diff nienałożony** + orzeczenie; masowa naprawa byłaby kolejną zmianą wyglądu, której nikt nie widział (krach 07-12) |
| „Obejrzyj wszystkie ekrany" **vs** trzy ekrany nie mają wejścia w harnessie | `R4` — albo dopisujesz wpis `SCREENS`, albo dajesz **STOP MERYTORYCZNY z briefem**; **oba są pełnowartościowym wynikiem**, a granica dowodu ma być nazwana |
| Zakaz `Z18` „narzędzia pomiarowe tylko do odczytu" **vs** „narzędzie nie ma potrzebnej opcji" | `B.1` wiersz „narzędzie zrzutowe" — **jedna opcja OPT-IN**, historyczne wywołania bit w bit; a jeżeli i tego nie wolno — gotowy diff nienałożony, pozycja **ZROBIONA** |
| Zakaz `Z13` „zrzuty i pliki wynikowe NIE wchodzą do repo" **vs** „dowody commituj do `evidence/`" | `B.1` wiersz „dowody i zrzuty" — **ta instrukcja daje jawną licencję na `evidence/podglad-relations-20260904/` z `git add -f`, także dla PNG**; 04.09 trzykrotnie ratowano dowody z katalogów tymczasowych, a raz powołano się na nieistniejący „zakaz binariów" |
| „Rozwiń sekcje przed zrzutem" **vs** „podgląd ma być na zrzucie" | `R2` — `--rozwin-sekcje=1` **razem z** `--klik-po-rozwinieciu=1`; bez drugiego pętla zamyka podgląd i mierzysz ekran bez tego, co mierzysz |
| „Bezpiecznik pary przeszedł" **vs** „para nie jest dowodem" | `R2` — bezpiecznik jest **dwuwymiarowy** i sam próg jasności **nagradza defekt**; dowodem jest para sum kontrolnych **plus** odczyt z DOM, nie zielony wynik bezpiecznika |
| Reguła `Z7` „port zajęty = STOP" **vs** „harness domyślnie słuchałby na 3020" | `B.4.4` i pułapka (6) — **podnosisz Vite na 5551** i przekazujesz `--base`; 3020 należy do toru grafiki i nie jest Twój |
| „Cofaj mutacje" **vs** `Z27` (zakaz `git stash`) | `R2` krok 1 i 5 — kopia przez `cp` do `SCRATCH`; schowek jest współdzielony między worktree i dlatego zakazany |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — patrz tabela wyżej | TAK — jedenaście par, każda rozstrzygnięta w treści |
| 2 | Każda ścieżka istnieje na markerze albo jest oznaczona `NOWY` | TAK — sprawdzone na worktree z markera `c0f690bae3`; zero `BRAK`. Oznaczone `NOWY`: katalog dowodów, ekrany `dev-render/screens/case-workspace-*`, `tests/unit/preview/**` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — `B.3`, dziesięć wierszy; **liczba „20 z 44" ze zlecenia obalona własnym pomiarem** (26 w 18 plikach, z 53 w 39) |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — każdy wiersz „tylko odczyt" ma rzeczownik-produkt (diff · brief · wpis `DO DECYZJI` · opis · wynik przelotu) |
| 5 | Wykonalność per pozycja bez plików przekrojowych, z dowodem przy `NIE` | TAK — `B.2`, kolumna 4; jedyny plik przekrojowy jest mutowany **tymczasowo** i nie wchodzi do commita |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych (351, 353, 354 oraz starsze 343-350) | TAK — `B.4.4`; porty 6411/5551 zmierzone jako wolne, kontener i gałąź nie istnieją. ★ Instrukcje 355-358 pisze równolegle inny autor — dlatego `Z7` zaostrzony: port zajęty = STOP całości, nigdy podmiana numeru. ★★ Dodatkowo jawnie wyłączony port 3020 (tor grafiki) |
| 7 | Komendy paste-ready, z komentarzem oczekiwanego wyniku | TAK — wszystkie grepy przez `bash -c`, wszystkie wywołania narzędzia zrzutowego z `--base`, `--rozwin-sekcje`, `--klik-po-rozwinieciu` i `--osiad-po-rozwinieciu` |
| 8 | Pułapki środowiska w całości + pułapki właściwe temu modułowi (sześć) | TAK — `§0.2d` osiemnaście punktów + `§0.2e` punkt (e) z sześcioma pułapkami przyrządu, każda zmierzona |
| 9 | Samodzielność — zero odwołań do rozmów i „poprzedniego dyżuru" bez ścieżki | TAK; zmiana dyżuru 349 zacytowana jako diff z SHA `58d391d65b`, oba zdania SSOT z numerami wierszy |
| 10 | Klauzula sprzeczności obecna; niewypełnionych pól szablonu: `0`; wierszy `Z`: `41` | TAK — sprawdzone przez generator, który blokuje zapis przy niespełnieniu |
