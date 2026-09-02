# CODEX DAY 257 — SYNTEZA ŹRÓDEŁ

## Streszczenie

Wynik: **FIXED / VERIFIED w zakresie deterministycznego buildera**. Dla niepustego materiału tekstowego bez ustrukturyzowanych liczników slajd „Wnioski” nie podaje już `0 inicjatyw i 0 ryzyk` jako faktu. Zamiast zgadywać liczbę stosuje jawny hedge w K1 i K2 oraz dodaje nieliczbową akcję uporządkowania ryzyk w K3. Rzeczywiście puste źródło zachowuje prawdziwe zera.

Nie użyto modelu językowego, sieciowego API AI, bazy ani runtime'u HTTP. Zakres tego dyżuru jest czysto deterministyczny i jednostkowy.

## Wejście i bramki

- Stan dokumentu: `WYDANY`.
- Marker wpisany w instrukcji 257: `df7f13056f`; `git merge-base --is-ancestor df7f13056f github-backup/codex/m03-admin-20260824` → `MARKER OK`.
- Czysta gałąź korekcyjna: `codex/day257-synteza-zrodel-20260901-clean`, utworzona bezpośrednio z literalnego markera instrukcji po audycie, który wykazał proceduralnie błędną bazę pierwszej gałęzi.
- HEAD worktree bezpośrednio po utworzeniu: `df7f13056fa24995be07f64b0e8c877b3faeab45`.
- `git status --short | head -3` bezpośrednio po utworzeniu worktree: brak wyjścia.
- Dysk przed utworzeniem czystego worktree: `11Gi` wolne, powyżej progu 5 GB.
- `lsof` dla `6254`, `5234`, `5235`: brak listenerów. `docker ps`: brak kontenera `cx-day257-pg`.

Tip uciekł do przodu względem `df7f13056f`, lecz zgodnie z literalną instrukcją czysta remediacja wystartowała dokładnie z `df7f13056f`, bez rebase i bez domieszki commitów instrukcyjnych lub cudzych dyżurów. Z poprzedniego commita odtworzono wyłącznie trzy licencjonowane pliki 257; skażonej gałęzi nie zmieniono ani nie przepchnięto siłowo.

## R1 — rozkaz pomiarowy

### 1. Co trafia do `contextPack`

`ContextPack` ma luźne `key_points: string[]` i ogólne `data_points: DataPoint[]`; typ `DataPoint` ma `label` i `value`, lecz nie ma kanonicznych pól `initiativesCount` ani `risksCount` (`server/src/services/contextPackBuilder.ts:10-19,33-44`). Builder inicjalizuje obie tablice jako puste i zasila je wyłącznie przez `sourceRefs` (`contextPackBuilder.ts:65-79,104-134`). Dispatch źródeł rozróżnia rekordowe typy, np. `initiative`, `risk`, `artifact`, ale nie ma typu wolnego tekstu/briefu (`contextPackBuilder.ts:216-265`).

Dla ścieżki czatu `sourceRefs` powstaje wyłącznie z `setup.sourceArtifacts`, po czym dokładnie ten obiekt trafia do `buildContextPack` (`presentationGeneratorService.ts:1784-1795`). Sam brief jest przetwarzany później przez osobny `generateDeckBriefContentPack` i merge'owany tylko do `artifactData` (`presentationGeneratorService.ts:1828-1848`). Kształt tego packa zawiera `_keyFindings`, `_risks`, KPI itd., ale nie `_initiatives` (`deckBriefContentPack.ts:40-64`); koercja tekstowych ustaleń i ryzyk jest w `deckBriefContentPack.ts:139-142,197-209`.

Wniosek: nie istnieje jeden stabilny, ustrukturyzowany licznik inicjatyw/ryzyk w `contextPack.data_points`, który można bezpiecznie odczytać po etykiecie dla wszystkich materiałów tekstowych. Etykiety są domenowe i źródłowe. Liczenie słów lub rekordów byłoby zgadywaniem. Wybrano **Gałąź B**.

### 2. Skąd pochodzi `contextPack` przy builderze slajdu

`contextPack` jest budowany raz z `sourceRefs` (`presentationGeneratorService.ts:1784-1795`), używany do wzbogacenia `_keyFindings`/`_kpis` (`:1798-1813`) i bez modyfikacji przekazywany wraz z końcowym `artifactData` do `buildDeckConclusionSlide` (`:2005-2019`). Jest to ten sam obiekt, który zasila fallback `key_points`; brief czatu nie jest jednak dopisywany do tego obiektu, tylko do `artifactData` w osobnym kroku.

### Tezy T1–T9

- T1 potwierdzona na wejściu: liczniki były tylko z `_initiatives`/`_risks` (`deckConclusionSlide.ts:179-180`).
- T2 potwierdzona: fallback `keyFindings` do `cp.key_points` (`:142-146`).
- T3 i T4 potwierdzone na wejściu: liczby trafiały do K1/K2, a K3 zależało od `risksCount > 0`.
- T5 i T6 potwierdzone (`deckConclusionSlide.ts:119-130`; `presentationGeneratorService.ts:2015-2019`).
- T7 potwierdzona: znaleziono `server/src/services/conclusionValidators.ts` i `src/services/report/conclusionValidators.ts`; import `../conclusionValidators.js` w `deckConclusionSlide.ts:27-31` rozwiązuje plik serwerowy.
- T8: kod wywołujący ma `!== 'false'` (`presentationGeneratorService.ts:2005`), ale `FeatureFlags.ts` ma odrębny default `false`. Rozbieżność jest opisana niżej; żadnej flagi nie zmieniono.
- T9 potwierdzona: po utworzeniu worktree 9.4 GiB wolne.

## R2 — naprawa Gałęzi B

W `buildDeterministicDeckConclusion` dodano sygnał `countsAreGrounded`: zera pozostają literalne tylko dla rzeczywiście pustego źródła; niepuste `keyFindings` przy zerowych licznikach oznaczają brak ustrukturyzowania, nie dowód zera (`deckConclusionSlide.ts:242-249`).

- K1 używa hedge'u bez liczby (`:267-279`).
- K2 nie twierdzi rozłożenia postępu na zero inicjatyw (`:287-295`).
- K3 nie znika: dodaje nieliczbową akcję ustrukturyzowania ryzyk (`:333-350`).

Nie zmieniono `factsPool`, `factRefs`, walidatorów, bramek jakości ani flag.

## R3 — para dowodowa i mutacja

Nowy pakiet: `server/src/services/deliverables/__tests__/day257-deckConclusionSlide.textSourceGrounding.test.ts`.

Pełne nazwy dodane po zmianie:

1. `Day 257 deck conclusion text-source grounding keeps literal zero counts when the source is genuinely empty`
2. `Day 257 deck conclusion text-source grounding hedges unknown counts instead of asserting zero for a non-empty text source`

Nazwy zniknięte: **brak**. Wszystkie 22 pełne nazwy istniejącego `tests/unit/finance/conclusionValidators.test.ts` były zielone przed i po zmianie.

Przebieg zielony:

```text
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run server/src/services/deliverables/__tests__/day257-deckConclusionSlide.textSourceGrounding.test.ts tests/unit/finance/conclusionValidators.test.ts --retry=0 --reporter=json --outputFile=/private/tmp/cx-day257-synteza-zrodel-clean-artefakty/po-clean.json
wynik JSON: 24 passed, 0 failed
```

Dowód mutacyjny: kopię naprawy zapisano poza repo, następnie ustawiono stary semantyczny warunek (`countsAreGrounded = true`). Ten sam pakiet Day 257 dał: kontrola pustego źródła `passed`, kontrola tekstowego źródła `failed` na asercji zakazującej `0 inicjatyw i 0 ryzyk`. Po przywróceniu pliku przez `cp`: oba przypadki `passed`; `git diff --check` bez wyjścia.

Artefakty i SHA-256:

- `po-clean.json`: `628013587442251e2f095b437522f8a36bdaa00c039dedaa5c3b958644a2c43a`
- `przed-clean.json`: `120466dc5b6786612d3e8b64d3c2334366125217acf6c2d40f8c0c405488cfbd`
- `mutacja-clean.json`: `af9407591db8a807429187d797001e6a51ea832dee9dd380e88583191a8f8da1`
- `przywrocone-clean.json`: `4d722ff79ed694c4248bf841092690d3bd50c76363ac55dba70832800e9380f0`

W czystej remediacji nie odziedziczono artefaktu `przed.json` z proceduralnie skażonej gałęzi. `przed-clean.json` jest świeżą rekonstrukcją bazowego zakresu 22 istniejących przypadków walidatora na czystej remediacji; `po-clean.json` zawiera te same 22 pełne nazwy oraz dwa nowe przypadki Day 257. Nazwy zniknięte: brak. Rekonstrukcja została wykonana po odtworzeniu diffu, lecz mierzony plik walidatora pozostaje identyczny z markerem; ograniczenie chronologiczne ujawniam zamiast przedstawiać je jako historyczny przebieg sprzed zmian.

Pułapki Z33: pakiety są czysto jednostkowe, nie montują `ApiGateway`, nie dotykają bazy, auth, `ENABLE_V8_GLOBAL`, visibility middleware ani globalnego `fetch`. `RUN_DB_TESTS=0 MOCK_DB=true` jawnie utrzymało je poza RealPG. Walidator `numbers_from_engine` został wykonany bez zmian. `--retry=0` wyłączyło ponowienia.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane. Baza nie była uruchamiana, ponieważ pakiet jest czysto jednostkowy i nie wykonuje zapisów.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie wykonano realnego przebiegu decka z LLM, RealPG ani HTTP: instrukcja Z15 zabrania modelu, a naprawiany kod jest deterministycznym builderem. Nie jest to dowód pełnej ścieżki produkcyjnej ani jakości tekstu modelowego.
- Nie uruchomiono istniejącego `tests/acceptance/o25-deck-conclusion.e2e.test.ts`, ponieważ jego nagłówek i setup wymagają realnego LLM oraz bazy, co jest poza licencją i sprzeczne z Z15 dla tego dyżuru.
- Nie potwierdzono zachowania dowolnych historycznych snapshotów `contextPack` o niestandardowych etykietach; dlatego naprawa nie próbuje interpretować ich heurystyką.

## Korekty wobec instrukcji

1. **Korekta proceduralna po audycie sceptyka:** pierwotna gałąź wystartowała z `7a733cb63d`, choć literalna instrukcja 257 nakazuje `df7f13056f`. Tego wyniku nie uznajemy za prawidłową ancestry. Utworzono nową gałąź `codex/day257-synteza-zrodel-20260901-clean` dokładnie z `df7f13056f` i odtworzono wyłącznie licencjonowane zmiany produktu, testu oraz raportu. Pierwotnej gałęzi nie zmieniono i nie użyto force-push.
2. T8 jest częściowo rozbieżna: lokalny warunek generatora jest default-ON przez `!== 'false'`, natomiast `server/src/config/FeatureFlags.ts` deklaruje default `false`. Nie zmieniono żadnej wartości; builder jest wywoływany przez lokalny warunek pokazany w R1.
3. Zastosowano Gałąź B, bo `contextPack` nie ma kanonicznego policzalnego pola liczby inicjatyw/ryzyk dla wolnego tekstu. Heurystyka etykiet byłaby fałszywą precyzją.
4. Pułapka T7 potwierdziła się; żywy importer tej ścieżki to serwerowy walidator. Oba pliki pozostały tylko do odczytu.
5. K3 otrzymał hedge w postaci nieliczbowej akcji ustrukturyzowania ryzyk, zamiast pozostawać bez zmian i całkowicie znikać.
