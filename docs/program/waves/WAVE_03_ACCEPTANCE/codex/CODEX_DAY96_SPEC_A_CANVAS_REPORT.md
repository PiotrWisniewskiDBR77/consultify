# CODEX DAY 96 — SPEC-A CANVAS — raport dowodowy

Data: 2026-08-29  
Marker: `188cb75f5b8f3b87eb8346160e5ee1aa56942988`  
Gałąź: `codex/day96-spec-a-canvas-20260829`  
Werdykt: `PARTIAL / B.1 FIXTURE BLOCKED / B.2-B.4 NIEZWERYFIKOWANE`

## 0. Tożsamość i stan wejściowy

Instrukcję `INSTRUKCJA_DYZUR_96_SPEC_A_CANVAS.md` odczytałem z wydanego obiektu
`github-backup/codex/m03-admin-20260824` w całości (740 linii), zanim dotknąłem
jakiegokolwiek zasobu roboczego. Checkout właściciela pozostał nietknięty;
jedyny kontakt to dozwolony symlink `node_modules`.

Wynik komend markera (§0.1 krok 2), dosłownie:

```text
8c7a853a6c docs(day95,96,97,99): armia SPEC-A — odbior artefaktow i kreatorow wg DoD 18.1
188cb75f5b docs(ledger): DEC-331..332 — straznik rozluzniony, Kanban naprawiony, znalezisko o granulacji
a2191d8bc7 merge: rozluznienie straznika uzasadnienia (DEC-328, wariant 3 wlasciciela)
4497d3de60 merge: naprawa cyklu zycia w Kanbanie Inicjatyw (DEC-326)
069b2ea81d fix(documentStudio): rozluznienie straznika uzasadnienia — skroty przechodza, liczby dalej pilnowane
32ade513fb docs(ledger): DEC-328..330 — rozluznienie straznika, odbior 90/94, wada szablonu wklejki
1d434bbdcc merge: dyzur 94 — ujemne EV POPRAWNE, teza nadzorcy obalona
c8322a613e merge: dyzur 90 — wynik negatywny, ktory doprowadzil do DEC-327
57d7a249cb merge: dyzur 93 Wywiad — pierwszy pelny pakiet 20 z 20 semantycznie zgodnych
6c9326f4e1 merge: dyzur 92 Ocena — uczciwe 12 z 20, interfejs w calosci angielski
95bc83cee6 docs(day93): normalize report markdown
b3a960640d docs(day93): record interview owner screenshot evidence
9f17e24d89 docs(ledger): DEC-327 — model pisze, straznik uzasadnienia kasuje napisane
fb9b6d4f86 docs(day90): record DOCX LLM evidence
1eed2946c9 fix(kanban): initiative lifecycle drives Portfolio Kanban columns + guard against silent drops
f99cff73ac docs(day92): satisfy report whitespace check
c027a2488f docs(day92): record assessment owner screenshot packet
28a1debc46 docs(day94): measure negative DCF composition
82fe23a9be docs(ledger): DEC-326 — decyzja wlasciciela, cykl inicjatywy jest zrodlem prawdy dla Kanbana
f34952a7c9 fix(day92,93): komenda W2 nie lapala poprawnej formy licznika migracji
8f0a678c61 docs(ledger): DEC-323..325 — odbior 91, dwie diagnozy pogleboione, dlug jezykowy Inicjatyw
eb6f7a22e1 docs(day92): record assessment fixture evidence
229231066f merge: dyzur 91 Inicjatywy — uczciwe 16 z 20, dwa realne defekty produktu
efd54054af docs(day90,92,93,94): cztery instrukcje zlozone skryptem ze szkieletu
4e67d5e2c9 docs(day91): close owner evidence report
MARKER OK
```

Wynik sanity (§0.1 krok 7), dosłownie:

```text
188cb75f5b8f3b87eb8346160e5ee1aa56942988
```

`git status --short | head -3` nie wypisał żadnej linii. Dysk: `60Gi` wolne z
`1.8Ti`. Porty `5976`, `4852`, `4853`: `0 z 3` zajętych.

Tip gałęzi bazowej uciekł o jeden commit:

```text
8c7a853a6c docs(day95,96,97,99): armia SPEC-A — odbior artefaktow i kreatorow wg DoD 18.1
```

Różnica obejmuje wyłącznie cztery instrukcje dyżurów 95/96/97/99. Pracowałem
dokładnie z markera; bez merge i bez rebase.

## 1. Weryfikacja wejściowa

- W1: `28` renderów `<ArtifactRightPanel` w `src/` po wykluczeniu `__tests__`.
- W2: §18.1 zaczyna się w `ARTIFACT_ANATOMY_STANDARD.md:1524`; przeczytałem
  całą sekcję 18.1 przed próbą uruchomienia produktu.
- W3: `scripts/check-artefakt.sh:1-40` jest ratchetem crimson oraz reguł kart N,
  a nie dowodem wizualnego odbioru.
- W4: G00-G20 odczytane; G20 pozostawało `NOT_STARTED`.
- Migracje `202617*`: `0`.

## 2. Powierzchnie nazwane przed zrzutami

Planowana macierz, nazwana przed pierwszym zrzutem:

1. Mapa myśli — jasny/pusty, jasny/pełny, ciemny/pusty, ciemny/pełny.
2. Przepływ procesu — jasny/pusty, jasny/pełny, ciemny/pusty, ciemny/pełny.
3. Tablica — jasny/pusty, jasny/pełny, ciemny/pusty, ciemny/pełny.

Żaden zrzut nie powstał, ponieważ B.1 nie uzyskało zielonego readbacku.

## 3. Trasy ustalone z kodu

Front: `/my-work/ideas/:id/workspace/mindmap`,
`/my-work/ideas/:id/workspace/process-flow` i
`/my-work/ideas/:id/workspace/whiteboard`; ścieżki buduje
`src/routes/ideaWorkspaceNavigation.ts:37`, a `IdeaMapWorkspace` jest realnie
montowany w `src/components/MyWork/MyWorkHub.tsx:3868`.

Tył: `server/src/Gateway.ts:1036` montuje `myWorkRoutes` pod `/api/my-work`.
Kontrakty canvasu są więc pod `/api/my-work/my-ideas/**`, m.in. GET/PUT mapy,
sync, snapshoty i komentarze w `server/src/routes/my-work.routes.ts:4414-6300`.
To jest wyłącznie mapa statyczna; nie twierdzę, że trasy wykonały się w tym
dyżurze.

## 4. B.1 — baza, migracje, fixture i readback

Lokalny kontener: `cx-day96-pg`, obraz `pgvector/pgvector:pg16`, port
`127.0.0.1:5976`, baza `consultify_w3_tools_owner_day96`.

- migracja 1: `Applying migrations: 863`, zakończona `Postgres migrations complete`;
- migracja 2: `Applying migrations: 0`, zakończona `Postgres migrations complete`;
- SQL po migracjach: `users=1`, jedyny użytkownik to `system`; wymagany przez
  seeder Tools użytkownik `0c13d1af-af67-4683-ad01-a3ea6fda2340`: `0 z 1`;
- SMTP w `settings`: `0` wierszy.

Kontrakt `server/scripts/seed-wave3-tools-owner-review.ts`:

- funkcja wykonywana jest komendą `seed` albo `readback` (`:15-22`);
- baza musi być loopback i pasować do `consultify_w3_tools_owner_*` (`:25-33`);
- `seed` wymaga `SEED_WAVE3_TOOLS_OWNER_REVIEW=YES` i nowej absolutnej ścieżki
  `TOOLS_OWNER_FIXTURE_MANIFEST` (`:14-18`, `:35-40`);
- skrypt nie tworzy bazy ani nie uruchamia migracji;
- przed zapisem wymaga istniejącego ownera w oczekiwanej organizacji
  (`:165-173`), a dopiero później zapisuje sesje, marker, manifest i robi
  readback (`:205-283`).

Trzy podejścia:

1. Literalny `seed` Tools: błąd `Wave 3 owner does not belong to the requested organization`.
2. Kanoniczny seeder logowania `seed-wave3-browser-review.mjs`: błąd
   `database must use the consultify_w3_runtime_* disposable prefix` — jego
   kontrakt nazwy nie pasuje do bazy Tools i trybu `adopt-existing`.
3. Osobny `readback` Tools: ten sam błąd braku ownera, zanim kod dochodzi do
   readbacku fixture.

Nie utworzyłem ręcznie użytkownika SQL-em, nie zmieniłem walidacji seederów i
nie użyłem `system` jako pozornego OWNER-a. Zgodnie z B.1: **bez zielonego
readbacku nie przeszedłem dalej**.

### STOP — B.1 fixture i readback

Rodzaj: MERYTORYCZNY  
Powód: wydany łańcuch nie zawiera seedera, który tworzy realnie logowalnego
OWNER-a w bazie `consultify_w3_tools_owner_*`, a seeder Tools wymaga go jako
prerequisite.  
Licencja, którą sprawdziłem: §D pozwala zapisać dokładnie raport i
`MODULE_ACCEPTANCE.md`; seedery, `src/**` i `server/src/**` są tylko do odczytu.  
Dowód: `seed-wave3-tools-owner-review.ts:165-173` oraz trzy logi prób.  
Co dostarczyłem ZAMIAST zmiany: pełne migracje 863/0, SQL identity readback,
kontrakt obu seederów i trzy zachowane logi.  
Co zrobiłbym, gdyby zapadła decyzja X: kanoniczny seeder logowania powinien
obsłużyć bazę Tools albo seeder Tools powinien jawnie utworzyć tę samą personę
z hasłem lokalnym; następnie seed Tools, osobny readback i adopt-existing.  
Rekomendacja dla nadzorcy: wydać punktową licencję na ujednolicenie prerequisite
persony, bez ręcznego SQL w dyżurze odbiorowym. Promień: fixture/runtime lokalny,
bez zmian produktu.  
Stan: zacommitowano wyłącznie dokumentację.  
Czy kontynuowałem pozostałe pozycje: NIE dla B.2-B.4, ponieważ literalne B.1
zabrania przejścia bez zielonego readbacku.

## 5. B.2 — macierz zrzutów

- pliki PNG na dysku: `0 z 12`;
- pliki semantycznie pokazujące zamówiony stan: `0 z 12`;
- runtime: nieuruchomiony;
- realne logowanie: niewykonane.

Nie relabelowałem pustych ekranów ani nie użyłem renderu komponentu.

## 6. B.3 — DoD §18.1 per artefakt

Brak osiągalnego produktu oznacza brak podstaw do wpisania `TAK`, `NIE` albo
`NIE DOTYCZY`. Bezpieczniejszy wynik to `NIEZWERYFIKOWANE`; nie zamieniam braku
pomiaru na negatywny werdykt produktu.

| # | Mapa myśli | Przepływ procesu | Tablica |
|---|---|---|---|
| 1 Menu 1 | NIEZWERYFIKOWANE | NIEZWERYFIKOWANE | NIEZWERYFIKOWANE |
| 2 Powłoka archetypu | NIEZWERYFIKOWANE | NIEZWERYFIKOWANE | NIEZWERYFIKOWANE |
| 3 Prawy panel | NIEZWERYFIKOWANE | NIEZWERYFIKOWANE | NIEZWERYFIKOWANE |
| 4 Powiązania | NIEZWERYFIKOWANE | NIEZWERYFIKOWANE | NIEZWERYFIKOWANE |
| 5 Slot AI | NIEZWERYFIKOWANE | NIEZWERYFIKOWANE | NIEZWERYFIKOWANE |
| 6 Otwieranie/guard | NIEZWERYFIKOWANE | NIEZWERYFIKOWANE | NIEZWERYFIKOWANE |
| 7 Stany | NIEZWERYFIKOWANE | NIEZWERYFIKOWANE | NIEZWERYFIKOWANE |
| 8 Light/dark | NIEZWERYFIKOWANE | NIEZWERYFIKOWANE | NIEZWERYFIKOWANE |
| 9 Zero crimson | NIEZWERYFIKOWANE | NIEZWERYFIKOWANE | NIEZWERYFIKOWANE |
| 10 Tab/Shift+Tab | NIEZWERYFIKOWANE | NIEZWERYFIKOWANE | NIEZWERYFIKOWANE |
| 11 Esc | NIEZWERYFIKOWANE | NIEZWERYFIKOWANE | NIEZWERYFIKOWANE |
| 12 Widoczny fokus | NIEZWERYFIKOWANE | NIEZWERYFIKOWANE | NIEZWERYFIKOWANE |
| 13 Teresa role=log | NIEZWERYFIKOWANE | NIEZWERYFIKOWANE | NIEZWERYFIKOWANE |
| 14 Generator §13.7 | NIEZWERYFIKOWANE | NIEZWERYFIKOWANE | NIEZWERYFIKOWANE |
| 15 Zakres AI | NIEZWERYFIKOWANE | NIEZWERYFIKOWANE | NIEZWERYFIKOWANE |
| 16 Klawiatura bez myszy | **NIEZWERYFIKOWANE — 0 realnych naciśnięć** | **NIEZWERYFIKOWANE — 0 realnych naciśnięć** | **NIEZWERYFIKOWANE — 0 realnych naciśnięć** |

Wynik: Mapa myśli `0 rozstrzygniętych z 16`; Przepływ procesu
`0 rozstrzygniętych z 16`; Tablica `0 rozstrzygniętych z 16`.

Punkt 16 **nie został sprawdzony odczytem kodu**. Nie został również sprawdzony
klawiszami, bo produkt nie został dopuszczony do uruchomienia po B.1. Dlatego
żaden canvas nie otrzymuje w tym raporcie statusu przejścia DoD.

Twierdzenia, że Tablica nie ma kontroli warstw oraz że komentarze nie istnieją,
pozostają nierozstrzygnięte — brak runtime i zrzutu, a grep nie byłby dowodem.

## 7. Protokół Z30

Dowody przed seedem/runtime:

- `env` → `BRAK ZMIENNYCH POCZTY`;
- tabela `settings`, `key LIKE 'smtp%'` → `0 rows`;
- `Gateway.ts` dla drenów → `0` trafień.

Deklaracja dla testów, dosłownie:

**„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane.”**

Deklaracja dla zrzutów nie ma zastosowania: runtime do zrzutów nie został
uruchomiony. Nie wykonano żadnej operacji AI/LLM.

## 8. Pułapki Z33 i pomiary testowe

Nie uruchomiono żadnego pakietu Vitest jako dowodu, więc pułapki (a)-(e) nie są
relabellowane jako wyłączone. Komendy seed/readback miały w tej samej linii
`RUN_DB_TESTS=1`, `MOCK_DB=false`, `DB_TYPE=postgres`, `NODE_ENV=test`,
`ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`,
`RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, lokalny `DATABASE_URL` i
lokalny `JWT_SECRET`. Nie jest to dowód egzekucji tras.

## 9. Artefakty poza repo

| Plik | SHA-256 |
|---|---|
| `day96-migrate-1.log` | `dc976f9d1f64e2c7aaafb05f7dae45cf1b9e62884ea8e10dfc56648f2a8199b7` |
| `day96-migrate-2.log` | `590fa1a64c6eb3c9f9c7b72b19ce0bfb2ac8e513bd463e4ef52fcfb74a64e935` |
| `day96-seed-attempt-1.log` | `e9de42a91527cd6a417db88d2c5ee22bbcd2a770a712e74f866d46be47088eb9` |
| `day96-seed-attempt-2.log` | `57e43e8e92c2abbc5e8d5ed0e15337f7951b0e3090d03d0f16f70389a4155ad8` |
| `day96-seed-attempt-3-readback.log` | `e9de42a91527cd6a417db88d2c5ee22bbcd2a770a712e74f866d46be47088eb9` |

## 10. Korekty wobec instrukcji

1. W2 `grep -n "18.1" ... | head -5` nie wskazał nagłówka §18.1; realny
   nagłówek jest w linii 1524. Odczytałem sekcję przez `sed -n '1524,1625p'`.
2. B.1 zamawia seeder właściwy bazie Tools, lecz ten seeder zakłada istniejącą
   personę. Kanoniczny seeder persony odrzuca wymagany prefiks bazy Tools.
   Wybrałem bezpieczniejszą interpretację: zero ręcznego SQL, trzy próby,
   następnie wynik nierozstrzygnięty.
3. B.3 żąda wyłącznie `TAK/NIE/NIE DOTYCZY`, ale brak zielonego B.1 zakazuje
   wejścia na ekran. Wpisanie `NIE` udawałoby negatywny pomiar. Użyłem
   `NIEZWERYFIKOWANE` i podałem mianownik.

## 11. TWIERDZENIA NIEZWERYFIKOWANE

- wszystkie 12 zamówionych stanów wizualnych — brak zielonego fixture/readbacku;
- wszystkie 48 rozstrzygnięcia DoD — brak produktu ze stylami;
- punkt 16 dla każdego canvasu — **nie wykonano realnych naciśnięć klawiszy**;
- kontrola warstw Tablicy i istnienie komentarzy — brak runtime;
- realna osiągalność HTTP, JWT, ApiGateway, handler, zapis i readback canvasów;
- zachowanie jasnego/ciemnego motywu, pustego/pełnego stanu, fokus, Esc i Tab;
- liczba sensownych PNG ponad `0 z 12`, ponieważ PNG nie powstały.

## 12. Zakres końcowy

Oczekiwany `git diff --name-only marker..HEAD`: dokładnie raport i
`MODULE_ACCEPTANCE.md`; `0` plików w `src/`, `server/src/`, migracjach,
seederach i test infrastructure.
