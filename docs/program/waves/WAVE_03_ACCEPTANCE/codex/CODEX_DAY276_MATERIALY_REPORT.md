# CODEX DAY 276 — materiały: narzędzia arkusza i prezentacji

Stan końcowy: **PROCEDURALNY STOP / NIE UKOŃCZONE**. Rdzeń mechaniczny i dowody realnego zapisu są zielone, lecz obowiązkowy bezpiecznik zrzutów `Z40` odrzuca parę prezentacji: `53,99%` różnych pikseli przy wymaganiu `>60%`. Nie obniżono progu i nie zmieniono fixture, aby wyprodukować pozorny sukces.

## Weryfikacja wejściowa

### Marker i worktree — wynik dosłowny

```text
0eff12615b merge: wyjscie z zamknietego kola logowania dwuskladnikowego
MARKER OK
0eff12615b6f00d48f9684a490ca77d9f3ebed72
       0
```

Tip `github-backup/kandydat/staging-20260902d` był równy markerowi; zakres `0eff12615b..tip` był pusty. Dysk przed startem: `88Gi` wolne, po checkout: `84Gi`; porty `6294`, `5274`, `5275` były wolne.

### Wyniki 14 pomiarów

1. `artifactStudioFlags.ts`: `document:false`, `presentation:true`, `spreadsheet:true`; profil demo jest sprawdzany przed flagą (`:161`, `:186`). Kod potwierdza rozstrzygnięcie nadzorcy, a kolumna „domyślnie WYŁĄCZONY” w `ARKUSZ_PREZENTACJA_PLAN.md` jest nieaktualna.
2. `ExceleView.tsx`: trzy bramki istnieją: home, `TriModeChooser`, studio/fallback.
3. `SpreadsheetArtifactStudio.tsx`: `ArtifactMenu3` istnieje jako `secondBar`, `maxVisible={9}`.
4. `EditableSpreadsheetGrid.tsx`: pasek formuły stoi bezpośrednio nad `<thead>`.
5. Zastany zapis komórki: optymistycznie zmieniał `localSheets`; odrzucona obietnica ustawiała tylko `saveState='error'`, bez rollbacku. `persistCell` nie komunikował przyczyny.
6. Łańcuch arkusza istnieje: `Api.applyWorkbookCommands` → `POST /api/workbook/:id/commands` → `applyWorkbookCommand` → `generated_workbooks` + `generated_workbook_revisions`.
7. Pasek prezentacji istnieje; rejestr zawiera **11** definicji `commandId`, nie 9. `maxVisible={9}` oznacza pojemność paska, a nie pełny mianownik rejestru.
8. `CardCanvas.tsx:138`: `editable` jest przekazane bezwarunkowo.
9. Autozapis slajdu to surowy `fetch` do `PUT /api/presentations/decks/:deckId/autosave`; kod ma widoczną obsługę `409`, innych nie-2xx i błędu sieci. Dodatkowa naprawa nie była potrzebna.
10. Word startuje na `activeTab='generate'`, `phase='intake'` i pokazuje wspólny `TriModeChooser`.
11. Zastane `/excele` wybierało home, a launcher „Z szablonu” nawigował do gołego `/excele`.
12. `tri_tryby` jest domyślnie ON.
13. Dokładne polecenie zwróciło:

```text
src/components/AIChat/KimiWorkspace/SpreadsheetArtifactStudio.tsx:2164:        rightRailTools={[]}
rc=0
```

To **1**, nie oczekiwane 3. Testowy komentarz także zawiera tekst, ale nie jest propem. Nie zmieniono żadnego prawego panelu (`Z11`).

14. Dysk po pomiarze: `84Gi` wolne, powyżej progu STOP.

`ENABLE_V8_GLOBAL`: workbook i presentations nie są pod `v8FeatureGate` (`Gateway.ts:612`, `:1201`; bramka V8 jest na innych montowaniach). `resultsInternalBetaVisibility` nie występuje w ścieżce tych tras (`rc=1`). `DB_TYPE='postgres'` było asertowane w obu pakietach, `ENABLE_TEST_AUTH_BYPASS=false`, realne podpisane JWT.

## §A.0 — flagi i rodzina

Potwierdzone: dwa z trzech pasów domyślnie ON (`presentation`, `spreadsheet`), Word OFF. Plan jest nieaktualny wyłącznie w tezie o domyślnym stanie. Dokładny inwentarz `rightRailTools={[]}` na markerze ma jeden element — arkusz. Nie naprawiano go.

## §A.1 — zrzut PRZED

Wygenerowano 8 plików 1440×900 bez `PanelUwag` i bez chromu harnessu. Pomiar pierwszego nagłówka arkusza: `349,5 px / 900 px = 38,83%`. Z40: arkusz `223,25 / 100%` PASS; prawy panel arkusza `223,25 / 100%` PASS; droga startu `227,14 / 99,99%` PASS; prezentacja `118,13 / 53,99%` **FAIL**.

## §A.2 — zapis komórki i koniec ciszy

- `EditableSpreadsheetGrid` przy odrzuceniu zapisu przywraca dokładne wartości sprzed edycji, usuwa nieudany wpis historii, kończy tryb edycji i ustawia stan error.
- `useWorkbookStudioController.persistCell` pokazuje komunikat: zapis się nie udał i poprzednia wartość została przywrócona.
- Test jsdom sprawdza jednocześnie komunikat, `Błąd zapisu` i rollback `99 → 10`.
- Mutacja `change.before → change.after`: **RED**, otrzymano `99` zamiast `10`; po przywróceniu: **GREEN**.
- Realny HTTP przez `ApiGateway`, JWT, PostgreSQL i późniejszy SELECT: `POST /api/workbook/:id/commands` zmienił `schema_json` na `99`, podniósł version `0→1`, dodał dokładnie jedną rewizję.

## §A.3 — droga startu

Gołe `/excele` pokazuje istniejący `TriModeChooser`. Przeglądanie modułu jest jawne pod `/excele?view=home`; tam prowadzi „Z szablonu” z choosera i launchera Materiałów. `ArtifactModuleHome` nie został usunięty.

Test renderuje realny `ExceleView` w `MemoryRouter`: widzi „Czysto / Z AI / Z szablonu” i nie widzi „Ostatnie”. Mutacja starej bramki: **RED**, drzewo zawierało `Ostatnie`; po przywróceniu: **GREEN**.

## §A.4 — zapis slajdu

Realny HTTP przez `ApiGateway`, JWT, PostgreSQL i SELECT: autosave zmienił `presentation_decks.deck_json`, podniósł version `1→2`, dopisał snapshot wersji 1. Drugie żądanie ze starym `X-Deck-Version: 1` zwróciło `409 VERSION_CONFLICT` i nie zmieniło wiersza. UI już ma widoczne stany błędu dla 409, nie-2xx i sieci — brak warunkowej zmiany `DeckBuilder.tsx`.

## §A.5 — zrzut PO i STOP

Wygenerowano 8 plików 1440×900. Asercje przed zapisaniem obrazu potwierdziły:

- pasek „Narzędzia arkusza” widoczny;
- pierwszy `<th>`: `152,5 px / 900 px = 16,94%`, czyli powyżej granicy 1/3;
- kanwa arkusza: `58,33%` szerokości kadru;
- pasek prezentacji oraz „Nowy slajd” i „Pole tekstowe” widoczne;
- droga startu ma trzy opcje i nie ma „Ostatnie”;
- brak kontrolek harnessu.

Z40 PO: arkusz `224,90 / 100%` PASS; prawy panel arkusza `224,90 / 100%` PASS; droga startu `216,91 / 100%` PASS; prezentacja `118,13 / 53,99%` **FAIL**. Biała kanwa slajdu pozostaje biała w obu motywach, więc pełny kadr nie może osiągnąć wymaganego mianownika bez zmiany treści/fixture lub kadru. Zgodnie z §0.5 jest to proceduralny STOP i zrzuty są dowodem diagnostycznym, nie zaakceptowanym produktem.

Drugi człon warunku 41 — kolejność sekcji prawego panelu wg SPEC-A — **nie jest objęty tym dyżurem** i czeka na robotników nadzorcy.

## §A.6 — obcy / właściciel

Właściciel zapisał komórkę, a SELECT potwierdził wiersz. Token aktywnego właściciela innego tenanta dostał `403/404` (zmierzony kod mieści się w kontrakcie) i porównanie SELECT przed/po potwierdziło brak zmiany workbooka.

## Testy i pomiar zasięgu

- Front focused final: `2/2 PASS`.
- Workbook real PG: `2/2 PASS`.
- Deck real PG: `2/2 PASS`.
- Uruchomienie dwóch pakietów DB równolegle ujawniło wyścig globalnego `initDb` na indeksie `idx_project_ai_settings_role` i fałszywe 500; pakiety uruchomione sekwencyjnie są zielone. Nie zmieniano infrastruktury (`Z18`).
- Pełny katalog front PRZED: `105` nazw, `89 PASS`, `16 FAIL` (zastane awarie w 3 suite).
- Pełny katalog front PO: `107` nazw, `91 PASS`, `16 FAIL` — te same zastane awarie.

Diff nazw:

```diff
+Day 276 — droga startu nowego arkusza > gołe /excele pokazuje trzy drogi startu, a nie ekran Ostatnie
+Day 276 — odrzucony zapis komórki jest widoczny > pokazuje komunikat i przywraca poprzednią wartość komórki
```

Nowe testy i testy DB przechodzą ESLint bez błędów. Globalnego formattera ani autofixu nie uruchamiano.

## Mianowniki — autor / pomiar

| Obiekt | Autor | Pomiar Day 276 |
| --- | ---: | ---: |
| Linie `SpreadsheetArtifactStudio.tsx` | 2560 | 2560 |
| Pasy domyślnie ON | 2/3 | 2/3 |
| `rightRailTools={[]}` | 3 | **1** |
| Definicje poleceń prezentacji | 9 | **11 `commandId`; 9 to `maxVisible`** |
| Zakładki home | 3 | 3 |
| Góra arkusza OFF / ON | 38,9% / 17,0% | **38,83% / 16,94%** |
| Wzorce zapisu | 2 | 2 |

## Korekty wobec instrukcji

1. Komenda z §0.2c(B), uruchomiona z roota wraz z `--config server/vitest.config.ts`, znalazła 0 testów. Realne pakiety wymagają cwd `server` i ścieżek `src/routes/__tests__/...`; tak zostały przejechane z identycznym pełnym env.
2. Równoległe odpalenie obu suite wywołuje wyścig globalnego initDb; sekwencyjne odpalenie daje 4/4 PASS.
3. Mianownik wyzerowanych prawych pasów to 1, nie 3.
4. Rejestr prezentacji ma 11 poleceń; 9 jest pojemnością widocznego paska.
5. Z40 jest niewykonalny dla obecnej pary deck light/dark w pełnym kadrze 1440×900 z niezmienną białą kanwą slajdu: 53,99%.

## Dług

Arkusz zapisuje przez klienta `Api.applyWorkbookCommands`; prezentacja przez surowy `fetch` w komponencie. Nie ujednolicano tego poza zakresem.

## Bezpieczeństwo wysyłki

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Manifest SHA-256

```text
9e38e1e5088210b02a7a72164cade7fc947b6b1f5eb540352d1e83b73ac78d05  po-arkusz-dark.png
6ae3462220aa3135cd1bdf712c7ed065e0e00e89c04d8fb13233c2e7f47a7346  po-arkusz-light.png
9e38e1e5088210b02a7a72164cade7fc947b6b1f5eb540352d1e83b73ac78d05  po-arkusz-prawy-panel-dark.png
6ae3462220aa3135cd1bdf712c7ed065e0e00e89c04d8fb13233c2e7f47a7346  po-arkusz-prawy-panel-light.png
06fd8802d101e16d8f97a7df553306d40dabbc5c90b9ce9fa8112516ffc9c98f  po-droga-startu-dark.png
bd9a5944c50da3b88febc42354676bf8151441123e170ffb4af9bf767fed6a57  po-droga-startu-light.png
63015dcbbf98bc698078e1403c390a494be2f1669bc2b400d5b0595e829fdafc  po-prezentacja-dark.png
3a31bff1966e68e0e5e9e3551aa0c0421656424703e661282bf1e8ea950d7023  po-prezentacja-light.png
9af15aa0563ff0964c3565c63b1ebf4438b49dc8f72cd345910b711833f7b5dd  przed-arkusz-dark.png
158c1b6289befa78ef06d765313354406141939f22f254b1745792650b6aa29e  przed-arkusz-light.png
9af15aa0563ff0964c3565c63b1ebf4438b49dc8f72cd345910b711833f7b5dd  przed-arkusz-prawy-panel-dark.png
158c1b6289befa78ef06d765313354406141939f22f254b1745792650b6aa29e  przed-arkusz-prawy-panel-light.png
5e55b5c64e8956ecdea250988abcfbc2d3aa3bc064f466e2edf02cb4f2dda56a  przed-droga-startu-dark.png
fe820aaacc5310ab0d9ece3848dc39b2241bc1aa06534d9cdd9eb89e9aedb22b  przed-droga-startu-light.png
63015dcbbf98bc698078e1403c390a494be2f1669bc2b400d5b0595e829fdafc  przed-prezentacja-dark.png
3a31bff1966e68e0e5e9e3551aa0c0421656424703e661282bf1e8ea950d7023  przed-prezentacja-light.png
```

## Twierdzenia niezweryfikowane

- Zrzuty prezentacji nie spełniają Z40 i nie są dowodem odbiorowym.
- Warunek 41 jako całość nie jest spełniony w tym dyżurze (SPEC-A poza zakresem).
- Nie wykonano produkcyjnego browser E2E z backendem; zrzuty harnessu dowodzą renderu, a zapis dowodzą osobne testy real HTTP/PG.
- Nie wykonano pushu ani interakcji z Railway/demo/staging/produkcją.
