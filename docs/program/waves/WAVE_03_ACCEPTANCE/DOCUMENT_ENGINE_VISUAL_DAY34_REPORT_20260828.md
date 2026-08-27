# Dyżur 34 — parytet wizualny silnika dokumentu DRD — raport

## 0. Wiązanie i środowisko

- SHA markera (dosłownie to, co stało w polu markera): `3e707a9d3c`.
- MARKER OK: `git merge-base --is-ancestor 3e707a9d3c codex/day34-instrukcja-20260828` zwrócił `0`; tip `696d87bbc8`, a drzewo tipa i markera było identyczne.
- Rozejście markera wobec tipa: tylko commit wiążący instrukcję; brak różnicy drzewa.
- Gałąź własna `codex/document-visual-day34-20260828`, worktree `/private/tmp/consultify-docvisual`. `git diff --name-only 3e707a9d3c...HEAD`: instrukcja, ten raport, `MODULE_ACCEPTANCE.md`, katalog evidence, `assessmentDrdReportSchemaService.ts`, test parytetu i 9 nowych fixtures, `documentChartRasterizer.ts`, `documentDocxRenderer.ts`, `documentStudioTypes.ts`, test real-PG Day 34.
- Gałąź złotego pliku: `git log -1 codex/day34-instrukcja-20260828` = `696d87bbc8`; pomiar pliku wzorca wykonano z kopii wskazanej przez instrukcję. GOLDEN MERGED — TAK (marker jest przodkiem tipa, brak różnicy drzewa).
- Kontener PG: `cx-day34-pg`, port `5605`; env kontenera `POSTGRES_DB=cx_day34`, `POSTGRES_PASSWORD=cx`; `docker port`: `5432/tcp -> 0.0.0.0:5605` i `[::]:5605`; readback: `cx_day34|postgres`.
- Migracje na pustej bazie: 854 zastosowane, bez błędu po uruchomieniu prawidłowego runnera z `NODE_ENV=test`.
- Migracje własne: 0; brak numerów `20261230-39`.
- Sprzątanie: `docker rm -fv cx-day34-pg` — wykonane; wynik: `cx-day34-pg`.
- Lokalny render PDF/PNG: LibreOffice 26.2.0.3. Brak LibreOffice w `server/**` i `scripts/**`.

## 1. Weryfikacja stanu wejściowego (§0.1 pkt 5)

| Komenda/pomiar       | Oczekiwane             | Zmierzone                                                                        | Zgodne? |
| -------------------- | ---------------------- | -------------------------------------------------------------------------------- | ------- |
| `isDrdReportProfile` | istnieje               | renderer i style                                                                 | TAK     |
| clamp tabel legacy   | 8                      | 8                                                                                | TAK     |
| podpisy              | angielskie/duplikowane | `Table`/`Figure`, dodatkowy opis                                                 | TAK     |
| limity kontraktu     | 180–260                | 180–260                                                                          | TAK     |
| migracje 20261230-39 | 0                      | 0                                                                                | TAK     |
| konsumenci renderera | 6 klas wywołań         | route method-core, v8, deliverables, Document Studio, initiative oraz Assessment | TAK     |

Obejrzałem wszystkie strony wzorca użyte do pomiaru oraz 18 stron pliku dnia 32. Na stronie tytułowej wzorca widać znak, kicker, klienta i metryczkę; na stronie tytułowej dnia 32 widać ogólną okładkę silnika bez pełnej metryczki DRD.

## 2. Pomiar PRZED (pełny zakres §0.4 pkt 3, bez zawężania)

- 1304 PASS / 51 FAIL / 0 SKIPPED (1355 testów, 157 plików), 1 błąd nieobsłużony.
- Zastane czerwone grupy: eksporty PDF z `Not a supported font format or standard PDF font`, testy Document Studio zależne od globalnych mocków/audytu, część route assertions i asynchroniczny `logger.warn is not a function`.

## 3. ★ BITOWA NIEZMIENNOŚĆ (§N) — dowód

- `day34-rich-pl`: PL, okładka, TOC, stopka, przypisy, lista, obraz, appendix, tabela 11 kolumn.
- `day34-rich-en`: EN, wariant consulting/legal, źródła, podpisy i tabela szeroka.
- `day34-rich-technical`: wariant technical/register, numeracja, sekcje i media.

| Schemat        | XML       | SHA PRZED                                                          | SHA PO     | ZGODNE? |
| -------------- | --------- | ------------------------------------------------------------------ | ---------- | ------- |
| rich-en        | document  | `af0310084828567f998b24e706dd7ab246f452fb33070f0dacab0972748ef757` | identyczny | TAK     |
| rich-en        | styles    | `3e45b8537c4931afa9cd5d9c36ee6d77d1a3b667543fac008cfc739fa529640b` | identyczny | TAK     |
| rich-en        | numbering | `1807eaa3eeda4104ec059cf491de9f646a519c16fb9d1294ce0c67f61179d250` | identyczny | TAK     |
| rich-pl        | document  | `4f5aa81f73d89b1aeaef6a7bfe3d5834cc48b76cc829c687dd01ff79a34737c0` | identyczny | TAK     |
| rich-pl        | styles    | `a5af8365ff8ccc6f1e8f191a2faa2e3776f48e608912085167fcff1e020308da` | identyczny | TAK     |
| rich-pl        | numbering | `1807eaa3eeda4104ec059cf491de9f646a519c16fb9d1294ce0c67f61179d250` | identyczny | TAK     |
| rich-technical | document  | `cc91fe0052e53149779b8205c138e0d88a75faaa6d6714bb8acc25f2042617b9` | identyczny | TAK     |
| rich-technical | styles    | `3e45b8537c4931afa9cd5d9c36ee6d77d1a3b667543fac008cfc739fa529640b` | identyczny | TAK     |
| rich-technical | numbering | `1807eaa3eeda4104ec059cf491de9f646a519c16fb9d1294ce0c67f61179d250` | identyczny | TAK     |

Pełny diff obu plików jest odtwarzalny komendą `git diff 3e707a9d3c..HEAD -- server/src/services/documentStudio/documentDocxRenderer.ts server/src/services/documentStudio/documentDocxStyles.ts`: `documentDocxStyles.ts` ma brak różnic; renderer ma wyłącznie rozgałęzienia profilu DRD dla rastra, tabel, podpisów, okładki i stopki. Każda zmiana zachowania w tych dwóch plikach jest bramkowana `isDrdReportProfile`: TAK. Snapshoty dnia 32 nietknięte: TAK; `git diff --stat` pokazuje wyłącznie 9 nowych fixtures Day 34.

## 4. Pozycje

- N — ZROBIONE_WG_DoD; 3 schematy × 3 XML, 9/9 SHA; `46f5d86a28`.
- A — ZROBIONE_WG_DoD; osobna okładka, 9 wierszy, jawne braki; `80a8278c3e`.
- B — ZROBIONE_WG_DoD; 8/9/10 kolumn bez foldowania, szerokości i crimson; `b603322aa1`.
- C — ZROBIONE_WG_DoD; brak rusztowania redakcyjnego, pojedynczy jawny placeholder; `6a4348eb90`.
- D — ZROBIONE_WG_DoD; pojedyncze polskie podpisy, brak sierot; `b73bf88790`.
- E — ZROBIONE_WG_DoD; 2100×1212, 332,7 dpi, Calibri, legenda; `ed180567c5`.
- F — ZROBIONE_WG_DoD; trzy człony na tabulatorach, poufność raz, znak; `259edd5754`.
- G — ZROBIONE_WG_DoD; pomiar wzorca i trzy niezależne okna bez zmiany contractVersion; `ad02d28eb6`.
- H — CZĘŚCIOWO; pole TOC istnieje, ale nie zweryfikowano aktualizacji w Microsoft Word. Próba: LibreOffice; wpływ: użytkownik może potrzebować F9; właściciel: odbiór w Wordzie; `570e147fc6`.
- W — ZROBIONE_WG_DoD w zakresie LibreOffice; dwa tenanty przez realną trasę, 36/36 stron obejrzanych, tabela 20+4; `e8b8dcc5bd`.

## 5. ★ TABELA PARYTETU STRONA-PO-STRONIE (§W.4)

Pełna tabela 20 wierszy i cztery przewagi są w `evidence/document-visual-day34-20260828/parytet.md`. Wynik: 15 PARYTET, 4 RÓŻNICE ŚWIADOME, 0 LUK, 1 NIEMIERZALNE. NIEMIERZALNE: TOC; próba LibreOffice nie wypełniła pola, wpływ to możliwe ręczne F9, decyzja/odbiór należy do właściciela w Microsoft Word. Przewagi: jawne placeholdery, pełne/częściowe skip reasons, 0 inline rFonts, natywne pole TOC.

## 6. Pomiary liczbowe PRZED/PO (obowiązkowe, wszystkie)

| Miara                        |             wzorzec |                    silnik PRZED |                              silnik PO |
| ---------------------------- | ------------------: | ------------------------------: | -------------------------------------: |
| `+N more`                    |                   0 |                               4 |                                      0 |
| `Figure `/`Table `           |                   0 |                              18 |                                      0 |
| podpisy-sieroty              |                   0 |                               8 |                                      0 |
| wiersze metryczki            |                   9 |                               0 |                                      9 |
| punkty rusztowania           |                   0 |                             117 |                                      0 |
| radar px / dpi / proporcja   | 2482 / ~393 / 1,733 |               960 / 144 / 1,778 |              2100×1212 / 332,7 / 1,733 |
| człony stopki                |               3 tab |             3 pipe, poufność ×2 |                     3 tab, poufność ×1 |
| inline rFonts                |                 638 |                               0 |                                      0 |
| udział słów placeholderowych |                 n/d | 27% (tokeny placeholder/całość) | nieporównywalne; 95 jawnych znaczników |
| rozmiar DOCX                 |  zmierzony lokalnie |                           75 kB |                 A 205426 B, B 209910 B |

## 7. Nazwane RÓŻNICE ŚWIADOME (nie luki)

Brak fikcyjnej prozy w streszczeniu, wstępach i wnioskach; jawne placeholdery, gdy kontrakt nie niesie danych. Natywne pole TOC zamiast wpisanych numerów. Krótszy dokument wynika z braku zmyślonej treści.

## 8. Pomiar PO (pełny zakres, bez zawężania)

- 1304 PASS / 54 FAIL / 0 SKIPPED (1358 testów, 157 plików), 1 błąd nieobsłużony; delta względem PRZED: +3 testy, +3 FAIL, PASS bez zmiany.
- Bramka Day 34 uruchomiona osobno z prawidłowym URL: 12/12 PASS.
- ZASTANE: grupy fontu PDFKit, globalnych mocków/audytu i route assertions.
- WPROWADZONE w pełnym współbieżnym zakresie: trzy dodatkowe czerwone wykonania; nie wskazują na renderer legacy, a przebieg ma zależności od wspólnego stanu DB/mocków. Nie naprawiano poza zakresem.
- Konsumenci renderera (§1.3): brak nowego FAIL przypisanego do DOCX/legacy — TAK; pełny zakres jako całość pozostaje czerwony.

## 9. Artefakty dowodowe

- `raport-drd-org-a.docx` 205426 B; `raport-drd-org-b.docx` 209910 B; `raport-drd-org-a.pdf` ok. 504 KiB.
- `strony/`: 36 PNG, ok. 2,3 MiB.
- `document.xml.txt` ok. 28 KiB; `parytet.md` ok. 8 KiB; `sha-niezmiennosci.txt` ok. 4 KiB; `spis-tresci-word.png` ok. 116 KiB (zrzut próby LibreOffice, nie dowód Worda).

## 10. Korekty wobec instrukcji

1. Runner migracji jest w `server/scripts/migrate.postgres.ts`, nie w podanej ścieżce `server/src/database/migrate.postgres.ts`.
2. Pierwsza próba runnera bez `NODE_ENV=test` została zatrzymana przez guard localhost; prawidłowy jawny przebieg zastosował 854 migracje.
3. Pomiar limitów wzorca: streszczenie 131 słów, wnioski końcowe 276, linie decyzyjne 12–21; dlatego okna 120–150, 250–300 i 10–30.
4. Radar wynikowy ma 2100×1212 i efektywnie 332,7 dpi, a nie literalne 2482 px wzorca.
5. Plik `spis-tresci-word.png` dokumentuje nieudaną próbę lokalną, nie odbiór w Wordzie; H pozostaje CZĘŚCIOWO.
6. Trasa publiczna nie została dodana ani zmieniona; dowód idzie przez istniejący router method-core z JWT i real PG.
7. Pierwszy końcowy pomiar omyłkowo użył hasła `postgres`; został unieważniony i powtórzony z odczytanym z kontenera hasłem `cx`.

## 11. Zależności zewnętrzne (§1.4)

Dane demo sesji oceny nie są warunkiem implementacji Day 34. Dowód korzysta z deterministycznych danych dwóch tenantów na własnym PG. Przygotowanie biznesowych danych demo należy do osobnego dyżuru/owner acceptance.

## 12. Znaleziska poza zakresem

- Zastane błędy fontów PDFKit oraz niestabilność pełnego współbieżnego zakresu testów wobec globalnych mocków/stanu.
- Średnie osi z PG były konkatenowane jako stringi (`4004%`); korekta `Number()` została wykonana w mapperze DRD i pokryta real-PG.

## 13. Twierdzenia NIEZWERYFIKOWANE

- Aktualizacja natywnego TOC i numery stron w Microsoft Word.
- Akceptacja właściciela i gotowość release — NIE_PROVEN.

## 14. STOP-y i pytania do nadzorcy

- H.4: potrzebny odbiór w Microsoft Word; bez niego H pozostaje CZĘŚCIOWO.
- Pełny zakres testów pozostaje czerwony: 54 FAIL; wymaga osobnego uporządkowania środowiska/font fixtures/global mocks, nie zmiany rendererów Day 34.

## 15. Commity

`46f5d86a28` N; `80a8278c3e` A; `b603322aa1` B; `6a4348eb90` C; `b73bf88790` D; `ed180567c5` E; `259edd5754` F; `ad02d28eb6` G; `570e147fc6` H; `e8b8dcc5bd` W; `a5f854ec7b` R.1; R.2 — commit tego raportu.

DYŻUR 34 — PARYTET WIZUALNY SILNIKA DOKUMENTU DRD

Marker: `3e707a9d3c` — MARKER OK. Gałąź: `codex/document-visual-day34-20260828`. PG: `cx-day34-pg`, port 5605, migracje 854, własne 0, posprzątane TAK. Niezmienność: 3 schematy, 9/9 SHA — SPEŁNIONE. Pozycje: N/A/B/C/D/E/F/G/W ZROBIONE_WG_DoD, H CZĘŚCIOWO, R.1 CZĘŚCIOWO. Testy PRZED 1304/51/0 → PO 1304/54/0; bramka Day 34 12/12. Dowód: A i B przez trasę, 18+18 stron obejrzanych. Parytet: 15/4/0/1. Zero LLM TAK; zero LibreOffice w serwerze TAK; zero `src/**` TAK; zero nowych tras TAK; zero stash TAK; snapshoty dnia 32 nietknięte TAK. STOP: Word TOC i czerwony pełny zakres. Niezweryfikowane: Word, owner acceptance, release.

Dyżur 32 udowodnił składanie dokumentu z danych; Day 34 dostarcza obejrzany plik klientowski bez zmiany bajtów legacy, z jawnym wyjątkiem nierozstrzygniętego odbioru TOC w Wordzie.
