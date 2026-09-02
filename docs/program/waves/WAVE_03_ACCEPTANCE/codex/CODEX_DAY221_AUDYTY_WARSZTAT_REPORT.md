# CODEX DAY221 — Audyty: warsztat D-5

## Werdykt

`PROTOTYP GOTOWY DO AKCEPTU WŁAŚCICIELA`, nie budowa produktu. `AUD-OR-20260829-004` pozostaje `OPEN`. Prototyp żyje wyłącznie w `dev-render`; nie ma wołacza API, trasy produktu ani konsumenta flagi.

## Wejście i baza

Marker:
```text
MARKER OK
```

Sanity:
```text
9fb7942a0117aaf4001836f00bf8bbdc4e717669
(status pusty)
```

Tip `github-backup/codex/m03-admin-20260824` uciekł o 6 commitów do `c557c502c2`; zgodnie z DEC-2026-08-26-95 praca wystartowała dokładnie z markera, bez rebase. Wolne: 11 GiB. Porty 6164, 5116 i 5117 były wolne. PostgreSQL: `cx-day221-pg`, `127.0.0.1:6164/cx221`; pierwszy przebieg migracji zakończył się `Postgres migrations complete`, drugi: `Applying migrations: 0`.

## R1 — inwentarz

Dzisiejszy hub ma jeden route `/audit-programs` (`src/routes/AppRoutes.tsx:1625`) i sześć zakładek (`AuditsMethodHub.tsx:371-406`): Biblioteka, Sesje (`processes`), Wyniki, Raporty, Ustalenia i Inicjatywy. Każda zakładka jest kanoniczną listą `StandardTable` z `StandardPreview`: Biblioteka (`tabs/AuditLibraryTab.tsx:128,313,332`), Sesje (`AuditProcessesTab.tsx:198,400,419`), Wyniki (`AuditOutputsTab.tsx:122,308,331`), Raporty (`AuditReportsTab.tsx:219,438,472`), Ustalenia (`AuditFindingsTab.tsx:290,605,651`) oraz Inicjatywy (`AuditInitiativesTab.tsx:106,282,301`). Akcje wiersza są deklarowane per zakładka; Raporty i Ustalenia mają pełne podglądy i operacje lifecycle, a pozostałe prowadzą odpowiednio do startu programu, sesji, wyniku albo propozycji inicjatywy.

Dane już istniejące dla przyszłego warsztatu: program z paginacją, lifecycle, członkami oraz licznikami kryteriów/ustaleń/dowodów (`programService.ts:209-347,1059-1076`); wersjonowane wyniki z snapshotem dowodów, kryteriów, ustaleń, odpowiedzi, CAPA i weryfikacji (`outputService.ts:110-251,410-512`); wersjonowane raporty, zatwierdzenie, publikacja, materiał i render dokumentu (`reportService.ts:130-395`); serwis ustaleń istnieje i zasila rejestr/CAPA. Brak konsumenta warsztatu w `src/` — to świadomy stan tego dyżuru.

Decyzje: D-3 PDF jest zbudowane i domknięte (`FALA_Z1_2026-08-31.md:49`); D-4 wskazuje staging jako powierzchnię żywego odbioru, ale ten dyżur nie łączył się ze stagingiem; D-5: prototyp wykonany, wpis koordynacyjny wykonany, akcept właściciela jeszcze nie zapadł.

## R2 — flaga

`ENABLE_AUDITS_WORKSHOP` dodano do schematu jako `z.boolean().default(false)` i do loadera jako jawne `=== 'true'`. Grep po repo pokazuje brak wołacza poza deklaracją i testem. Mutacja `default(false) → default(true)` dała 1/2 FAIL, exit 1; po przywróceniu 2/2 PASS. Produkcyjny diff po cofnięciu mutacji zawiera wyłącznie wartość `false`.

## R3 — archetyp i wireframe

Wybrano SPEC-A, archetyp C „Rekord”, klasa L. Warsztat otwiera jeden program z własnym tytułem, statusem i cyklem życia, nie zbiór wielu programów; centrum jest sekwencją pól/stanu procesu, a prawy panel niesie właściwości i powiązania. To wykorzystuje dane R1 bez kopiowania sześciu list do siódmej listy. Odczytano oba SSOT: `ARTIFACT_ANATOMY_STANDARD.md` i `TRIADA_KANON.md`.

Wireframe: cienki pasek tożsamości + jeden CTA → pasek postępu/liczników → centrum 4 kolumn faz (18 klikalnych ogniw) → stały prawy panel wybranego ogniwa: stan, kontekst, odpowiedzialność, powiązania. V1 NIE zapisuje, nie woła API/AI, nie generuje raportu/PDF, nie zarządza CAPA, nie zastępuje tabel hubu i nie jest montowana pod `/audit-programs`.

## R4/R5 — prototyp i zrzuty

Ekran: `dev-render/screens/day221-audyty-warsztat.tsx`; rejestr: `?screen=day221-audyty-warsztat`. Mocki mają polskie, domenowe wartości i długości zbliżone do istniejącego harnessu Audytów; nie są `Lorem ipsum`.

```text
light mean_luma: 246.671
dark  mean_luma: 22.559
różnica: 224.112 (>150)
3463100df90aa226727a230b60d74fd54229f0adc826e5e95f5a4aa6f54699dc  day221-light.png
98640ef453368319df5940a05e3bd16102f88056f311a5a9afc56fae9a73aa0b  day221-dark.png
```

Obrazy: `/private/tmp/cx-day221-audyty-warsztat-artefakty/day221-light.png` i `day221-dark.png`. Luma policzona narzędziem `sharp` (Rec.709), nie oszacowana. Zrzuty obejrzane; brak błędów konsoli i sieci 4xx/5xx.

## R6 — koordynacja

Do końca `docs/program/KOORDYNACJA.md` dopisano widoczną sekcję modułu 12: ścieżka prototypu, status oczekiwania na akcept i flaga default OFF. Wiersz `-004` dostał dokładnie jedno zdanie i pozostał `OPEN`. Historia pliku została sprawdzona przed commitem; Day220 nie był scalony do bazy tego dyżuru.

## Testy i pułapki Z33

Przed: 19 plików / 139 pełnych nazw PASS. Po: 19 plików hubu + 1 nowy plik / 141 pełnych nazw PASS. `nazwy.diff` ma wyłącznie dwa dodane testy Day221, zero znikniętych. Komendy miały `--retry=0` oraz pełny env real-PG w tej samej linii. Pułapki (a)-(d) wyłączono przez `ENABLE_V8_GLOBAL=true`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, `MOCK_DB=false DB_TYPE=postgres`, `ENABLE_TEST_AUTH_BYPASS=false`; (e) dev-render nie korzysta z routera ani bramek produktu. Artefakty: `przed.json`, `po.json`, `przed-nazwy.txt`, `po-nazwy.txt`, `nazwy.diff` w katalogu artefaktów.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Korekty wobec instrukcji

- Wariant C wskazywał nowy test `.mjs`, lecz root `vitest.config.ts:221` obejmuje tylko `js,ts,jsx,tsx`; `.mjs` dawał zero zebranych testów. Bezpieczna korekta: plik `.test.ts`; rzeczywisty pomiar 2/2, nie fałszywa zieleń exit 0.
- `npx tsc --project dev-render/tsconfig.json` nie istnieje; nie uznano go za pomiar. Prototyp zweryfikowano przez rzeczywisty render Vite/Playwright, konsolę i ogląd obu obrazów.
- Instrukcja oczekiwała danych długości „z dyżuru 220”, ale Day220 nie był scalony do markera ani tipa odczytanego przed pracą. Użyto realistycznych danych z istniejącego `dev-render/screens/audyty-piec-powierzchni.tsx`; nie przypisuję im statusu zmierzonego wyniku Day220.

## TWIERDZENIA NIEZWERYFIKOWANE

- Archetyp: wybrany po odczycie obu SSOT, nie z pamięci — ZWERYFIKOWANE.
- Realizm mocków względem dokładnego pomiaru Day220: NIEZWERYFIKOWANE, bo raport Day220 nie był w bazie; porównano z istniejącym realistycznym harness-em Audytów.
- `mean_luma`: ZWERYFIKOWANE narzędziem, liczby wyżej.
- Widoczność wpisu koordynacyjnego: ZWERYFIKOWANE — nowa sekcja jest na końcu dokumentu; może wymagać przeniesienia przez nadzorcę przy scalaniu równoległych wpisów.
- Kolizja Day220: ZWERYFIKOWANE przez `git log --all -- MODULE_ACCEPTANCE.md`; commit Day220 nie był obecny przed commitem.
- Akcept właściciela: NIE ZAPADŁ; tego konkretnie brakuje, aby zamknąć `AUD-OR-20260829-004`.
