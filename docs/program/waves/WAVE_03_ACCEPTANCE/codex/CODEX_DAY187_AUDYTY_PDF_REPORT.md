# CODEX DAY 187 — AUDYTY — EKSPORT PDF RAPORTU

Data: 2026-08-30  
Marker: `18661cc6a0`  
Gałąź: `codex/day187-audyty-pdf-20260830`  
Commit funkcjonalny: `1b1aeccd700b0bca117239e0e10583504bf6b1ad`  
Werdykt pozycji: **ZROBIONE_WG_DoD**  
Werdykt szerokiego katalogu Audytów: **PARTIAL** — dowód pozycji i regresja bezpośrednia zielone, opt-in `mounting.integration.test.ts` kończy się zastanym timeoutem hooka 120 s.

## 1. Stan wejściowy i baza pracy

Instrukcję odczytałem z bare-vaulta i przeczytałem w całości przed rozpoczęciem pracy. Nie czytałem ani nie modyfikowałem checkoutu właściciela `/Users/piotrwisniewski/Developer/Consultify`; jedyny kontakt to dozwolony symlink `node_modules`.

Wynik markera, dosłownie:

```text
a5251e1d06 rejestr: usuniety duplikat wpisu macierzy — moj wlasny blad przy odtwarzaniu formatu
18661cc6a0 Merge branch 'codex/m03-admin-20260824' of https://github.com/PiotrWisniewskiDBR77/consultify-recovery-private-20260820 into codex/m03-admin-20260824
336c234e6f rejestr: PROSTUJE wlasny blad — poprzedni commit przeformatowal caly plik (2629 linii zamiast 20); przywrocony format oryginalu
MARKER OK
```

Wynik sanity worktree, dosłownie:

```text
18661cc6a007769dd419060ff3089860f1163afc
```

`git status --short | head -3` nie zwrócił żadnej linii. Wolne miejsce: `10Gi`, czyli więcej niż wymagane `5 GB`. Porty `6096`, `5044`, `5045` nie miały listenerów. Tip gałęzi bazowej uciekł do przodu; zgodnie z `DEC-2026-08-26-95` pracowałem dokładnie z markera. Lista nowszych commitów i plików została zmierzona komendami wymaganymi w `§0.1`; scalenie pozostaje zadaniem nadzorcy.

## 2. Tezy zlecenia

### T1 — ochrona i flaga

**POTWIERDZONE.** `GET /:id/export.docx` nie ma dedykowanej flagi. `/api/audits` jest montowane jako `gatewayVerifyToken, auditsStrictMembership, auditsMethodRouter`; `MODULE_AUDITS` ma wartość `'open'` po stronie serwera i klienta. Grep `ENABLE_|requireCapability|requireFlag` w trzech wskazanych plikach tras nie zwrócił trafień. PDF jest za dokładnie tą samą ochroną i nie wprowadza nowej flagi.

### T2 — reużycie renderera

**POTWIERDZONE W REALNEJ ŚCIEŻCE.** `buildAuditReportDocumentSchema` zbudował `DocumentSchema` z raportu zapisanego w lokalnym PostgreSQL, a handler przekazał go do istniejącego `renderDocumentSchemaToPdfBuffer`. Uwierzytelnione żądanie przez pełny `ApiGateway` zwróciło PDF 9-stronicowy, 30119 B, wersja 1.3. `PDFParse` i `pdftotext` odczytały realną nazwę organizacji oraz marker `DAY187_PDF_REAL_PAYLOAD`.

### T3 — kontekst i nazwa pliku

**POTWIERDZONE.** Nowy handler używa tego samego `resolveReportContext`, `requireReportPayloadShape` i tej samej sanityzacji NFC/ASCII co DOCX. Test potwierdza nagłówek z realną nazwą organizacji, `filename="Raport_audytu_Lodz...pdf"`, wariant UTF-8 dla `Łódź` oraz identyczny błąd `422 AUDIT_REPORT_INVALID_PAYLOAD` dla payloadu bez `sections`.

## 3. Zakres zmiany

- `server/src/routes/audits/reports.routes.ts`: import istniejącego renderera i nowy, równoległy handler `GET /:id/export.pdf`.
- `server/src/routes/audits/__tests__/day187.reportExportPdf.pg.test.ts`: real-PG, pełny Gateway, podpisany JWT, poprawny raport i uszkodzony payload.
- Front pozostawiłem nietknięty świadomie: instrukcja uznaje go za opcjonalny, a minimalny obowiązkowy dowód jest bezpośrednim wywołaniem HTTP. Nie tworzę nowego wizualium bez odbioru.
- Nie zmieniłem handlera DOCX, rendererów Document Studio, middleware, Gateway, flag, globalnej infrastruktury testowej ani `MODULE_ACCEPTANCE.md`.

## 4. PostgreSQL, migracje i bezpieczeństwo wysyłki

Kontener: `cx-day187-pg`, obraz `pgvector/pgvector:pg16`, baza `cx187`, wyłącznie `127.0.0.1:6096`.

```text
Pierwszy przebieg: Applying migrations: 870; Postgres migrations complete
Drugi przebieg: Applying migrations: 0; Postgres migrations complete
settings WHERE key LIKE 'smtp%': (0 rows)
env SMTP_/RESEND/SENDGRID/MAIL: BRAK ZMIENNYCH POCZTY
Gateway.ts drenaże: 0 trafień
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

Nie wykonano połączeń do Railway, demo, stagingu ani produkcji. Nie wywołano modelu językowego.

## 5. Dowody testowe

Wszystkie przebiegi bazodanowe miały w tej samej linii: `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6096/cx187 JWT_SECRET=cx187-test-secret-do-not-reuse` oraz `--retry=0`. Pierwszy `beforeAll` nowego pakietu asertuje `process.env.DB_TYPE === 'postgres'`.

Pułapki `Z33`: (a) wyłączona przez `ENABLE_V8_GLOBAL=true`; (b) wyłączona przez `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; (c) wyłączona przez `MOCK_DB=false DB_TYPE=postgres` i asercję w teście; (d) wyłączona przez `ENABLE_TEST_AUTH_BYPASS=false`, a JWT jest podpisany; (e) zmierzona bezpośrednio: wspólny guard payloadu, kontekst, sanityzacja nazwy i istniejący renderer PDF. Renderer DOCX nie przekazuje opcji, więc PDF także używa domyślnego `{}`.

### Pakiet pozycji — PASS 2/2

Plik: `/private/tmp/cx-day187-audyty-pdf-artefakty/day187-final-green.json`

```text
PASS Day 187 audit report HTTP PDF export exports a real report through authenticated ApiGateway with PDF headers and content
PASS Day 187 audit report HTTP PDF export returns 422 AUDIT_REPORT_INVALID_PAYLOAD for the same malformed shape as DOCX
```

### Regresja bezpośrednia — PASS 12/12

Plik: `/private/tmp/cx-day187-audyty-pdf-artefakty/day187-related-regression.json`. Obejmuje pełnymi nazwami 2 przypadki Day 187, 6 przypadków eksportu DOCX Day 41, 2 przypadki kontekstu/payloadu i 2 przypadki reachability tworzenia raportu przez HTTP. Wynik: 12 PASS, 0 FAIL, 0 SKIP.

### Pomiar szeroki katalogu tras Audytów

Wydana instrukcja odwołuje się do `§0.4a`, ale nie zawiera tej sekcji: po `§0.2d` następuje `§0.5`. Jako bezpieczny pomiar zastępczy uruchomiłem cały `server/src/routes/audits/__tests__`.

- Bez opt-inów destrukcyjnej macierzy: 29 PASS, 0 FAIL, 25 SKIP; plik `day187-all-audits-routes.json`.
- Z poprawnymi opt-inami jednorazowej bazy (`AUD_MOUNTED_ALLOW_FIXTURE_CLEANUP=1`, `AUD_MOUNTED_DISPOSABLE_DB_PREFIX=cx187`): **PARTIAL**, 15 PASS, 0 FAIL-asercji, 39 SKIP, 1 failed suite. `mounting.integration.test.ts` zakończył `beforeAll` komunikatem `Hook timed out in 120000ms`. Nie podniosłem timeoutu i nie zmieniłem infrastruktury testowej. Plik `day187-all-audits-routes-full.json`.

### Dowód mutacyjny Z32

Zmiana produkcyjnego `Content-Type` z `application/pdf` na `application/octet-stream` dała 1 PASS / 1 FAIL; zawiódł dokładnie przypadek kontraktu PDF z komunikatem `expected 'application/octet-stream' to contain 'application/pdf'`. Po przywróceniu pliku przez kopię poza repo przebieg wrócił do 2 PASS / 0 FAIL, a `git diff --check` był pusty.

## 6. Artefakty i sumy SHA-256

```text
8c2dd30895454d5c442127aee8a4481de966de5c377d83d78c01139415b46732  /private/tmp/cx-day187-audyty-pdf-artefakty/day187-audit-report-final.pdf
e28470506891b4871e5e40bad798db37afa05bc18a757d3e642aab6d27205b38  /private/tmp/cx-day187-audyty-pdf-artefakty/day187-final-green.json
c4a2478877abbcd84e56574c55570da48194b0646292167e5f797608ae49bafe  /private/tmp/cx-day187-audyty-pdf-artefakty/day187-mutation-red.json
353c488495b1c84c3434ac8451e35dbe0dd246b584135ce652aa1a590ae053d4  /private/tmp/cx-day187-audyty-pdf-artefakty/day187-mutation-green.json
6e4dafff559f009f9fd83a9f4d769dfff7145eab4086c1827966ecbe99af25d6  /private/tmp/cx-day187-audyty-pdf-artefakty/day187-related-regression.json
ed09501236d672db9c04116ff6f6d4f8c8c12057f03cb9b077957cfa03d14628  /private/tmp/cx-day187-audyty-pdf-artefakty/day187-all-audits-routes.json
39d35981dc98946f8e848402baca8c0469254294debf54882eaafbd89767877e  /private/tmp/cx-day187-audyty-pdf-artefakty/day187-all-audits-routes-full.json
21007f546d8cff11179f1750d47b7dc921b8b2abe3b8169a15c2f5ba89e96225  /private/tmp/cx-day187-audyty-pdf-artefakty/migrate-first.log
87c39031bcbe90ac452d29a9b5e9d7cd53bc2666b53e57278afee06ec83cff96  /private/tmp/cx-day187-audyty-pdf-artefakty/migrate-second.log
```

`file`: PDF document, version 1.3, 9 pages. `pdfinfo`: A4, 30119 B, niezaszyfrowany. `PDFParse` odczytał zawartość bez błędu. `pdftotext` odczytał wymagane teksty, zgłaszając ostrzeżenia składniowe `Restoring state when no valid states to pop`; nie blokują otwarcia ani ekstrakcji, ale zapisuję je uczciwie.

## 7. Korekty wobec instrukcji

1. `§0.1/Z24` wymaga pomiaru „wg §0.4a”, lecz wydany dokument nie ma `§0.4a`. Wybrałem bezpieczniejszy pomiar całego katalogu i podałem zarówno wynik bez opt-inów, jak i niezielony wynik z opt-inami.
2. Pierwsza próba z rootem i `--config server/vitest.config.ts` zwróciła `0` testów mimo exit 0. Nie uznałem jej za PASS; poprawny runner został uruchomiony z katalogu `server` i ścieżką `src/...`.
3. `prettier --check` dla całego zastanego `reports.routes.ts` jest czerwony także na nietkniętych liniach. Nie uruchomiłem szerokiego `prettier --write`, bo naruszyłby zakaz zmiany handlera DOCX i promień licencji. Nowy test przechodzi `prettier --check`, ESLint i hook commita; `git diff --check` jest czysty.
4. Szeroki opt-in katalog nie jest PASS z powodu timeoutu `mounting.integration.test.ts`; nie naprawiałem cudzego testu ani globalnego timeoutu.

## 8. TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowałem przycisku PDF w UI, ponieważ świadomie nie podjąłem opcjonalnego R-front. Backend ma realny, uwierzytelniony konsument testowy HTTP; w `src/` nadal nie ma konsumenta `.pdf`.
- Nie wykonałem zrzutu UI ani pełnego runtime `server/src/index.ts`; nie były potrzebne do dowodu plikiem i zwiększałyby ryzyko Z30.
- Nie uruchomiłem produkcyjnego CI ani żadnego środowiska zdalnego.
- Nie rozstrzygam ostrzeżeń `pdftotext` jako defektu renderera: PDF otwiera się, `pdfinfo` i `PDFParse` przechodzą, tekst jest obecny, a renderer jest imiennie tylko do odczytu.

## 9. Stan końcowy

`GET /api/audits/reports/:id/export.pdf` jest osiągalne przez realny, uwierzytelniony Gateway na PostgreSQL, zwraca `200`, `application/pdf`, niepusty PDF z realnym kontekstem i treścią; uszkodzony payload zwraca ten sam `422 AUDIT_REPORT_INVALID_PAYLOAD` co DOCX. Commit funkcjonalny został wypchnięty na `github-backup/codex/day187-audyty-pdf-20260830` natychmiast po utworzeniu.
