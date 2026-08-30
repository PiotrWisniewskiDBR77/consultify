# CODEX DAY 137 — AUDYTY: CZYTANIE I EKSPORT RAPORTU

Data pomiaru: 2026-08-30  
Marker: `4378136c7d`  
Gałąź: `codex/day137-audyt-raport-20260830`  
Werdykt: **R1 DA SIĘ PRZECZYTAĆ; R2 DOCX DZIAŁA; R3 PDF DO DECYZJI; R4 KREATOR NIEAKTYWNY.**

## Stan wejściowy

### §0.1-BIS — wynik dosłowny

```text
$ git merge-base --is-ancestor 4378136c7d HEAD && echo "BAZA OK" || echo "MARKER BRAK — STOP"
BAZA OK
$ git status --short
[brak wyjścia]
$ git branch --show-current
codex/day137-audyt-raport-20260830
$ ls -la node_modules
lrwxr-xr-x@ 1 piotrwisniewski  wheel  56 Aug 30 07:45 node_modules -> /Users/piotrwisniewski/Developer/Consultify/node_modules
$ df -h /
Filesystem        Size    Used   Avail Capacity iused ifree %iused  Mounted on
/dev/disk3s1s1   1.8Ti    12Gi    30Gi    28%    459k  317M    0%   /
```

Porty `6021`, `4940`, `4941`: `lsof -nP -iTCP:<port> -sTCP:LISTEN` — brak wyjścia.  
Kontener `cx-day137-pg`: przed startem `docker ps -a --filter name='^/cx-day137-pg$'` — brak wyjścia.

### Migracje przed pomiarem

Kontener: `pgvector/pgvector:pg16`, `127.0.0.1:6021`, baza `cx137`. Oba przebiegi miały w tej samej linii `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6021/cx137`.

```text
# przebieg 1, końcówka
→ 20260813b_audits_source_classification_split.sql
→ 20260813c_method_core_roles_and_approvals.sql
→ init-pgvector.sql
✅ Postgres migrations complete

# przebieg 2, końcówka
Applying migrations: 0
✅ Postgres migrations complete
```

Artefakty:

- `/private/tmp/cx-day137-audyt-raport-artefakty/migrate-1.log` — SHA-256 `64d9375c3cdc904054e13750d89c5714fd00dc0ffd912544169120c28b167df6`;
- `/private/tmp/cx-day137-audyt-raport-artefakty/migrate-2.log` — SHA-256 `8ff01aca6dcc3db3472167c16422b9e33dae7f9f1503b489de59da5958e4d639`.

### Z30 — dowód przed pierwszym zapisem

```text
$ env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL|ENABLE_LIVE_EMAIL)" || echo "BRAK ZMIENNYCH POCZTY"
BRAK ZMIENNYCH POCZTY

$ docker exec cx-day137-pg psql -U postgres -d cx137 -c "SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';"
 key | left
-----+------
(0 rows)

$ grep -n "startNotificationOutboxDrainCron\|outboxWorker\|platformOutboxDrainCron" server/src/Gateway.ts
[brak wyjścia]
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

### T1–T4 — komendy wejściowe

```text
$ grep -n "export.docx" server/src/routes/audits/reports.routes.ts
23: * FIX-4 (dyżur 41, naprawa): `export.docx` podstawiał `{programName: null,
84:  '/:id/export.docx',
85:  route('GET /reports/:id/export.docx', async (req, res) => {

$ grep -rn "export.pdf" server/src/routes/audits/ 2>/dev/null | wc -l
       0

$ grep -n "MODULE_AUDITS" -A4 src/components/navigation/Sidebar/menuConfig.ts
169:      id: 'MODULE_AUDITS',
170-      label: t('sidebar.audits', 'Audits'),
171-      icon: React.createElement(ClipboardCheck, { size: 20 }),
172-      viewId: AppView.ASSESSMENT_AUDITS,
173-      badge: 'beta',

$ grep -rn "ASSESSMENT_AUDITS" src/routes/routeConfig.ts | head -3
src/routes/routeConfig.ts:390:  [AppView.ASSESSMENT_AUDITS]: '/audit-programs',

$ for n in AuditsHub AuditHistoryView AuditOrchestratorWizard; do ...; done
AuditsHub ->
AuditHistoryView ->
AuditOrchestratorWizard ->
```

## KOREKTY WOBEC INSTRUKCJI

1. Teza pomocnicza, że żywym ekranem może być `AuditsHub`, jest obalona. `AppRoutes.tsx:1622-1635` montuje pod `/audit-programs` komponent `AuditsMethodHub`; `AuditsHub` ma tylko eksport w `src/components/Audit/index.ts`, bez konsumenta JSX. To jest wynik pomiaru, nie STOP.
2. T4 jest prawdziwa w mocniejszej postaci: wszystkie trzy wskazane komponenty (`AuditsHub`, `AuditHistoryView`, `AuditOrchestratorWizard`) nie są renderowane przez `src/`. Żywy produkt raportowy leży pod `src/components/Audit/method/**`.
3. Pierwsze dwa wywołania testu serwerowego z katalogu głównego (`server/src/... --config server/vitest.config.ts`, następnie `src/... --config server/vitest.config.ts`) zapisały JSON z `numTotalTests: 0`, więc zostały odrzucone jako brak pomiaru. Poprawny przebieg wymagał katalogu roboczego `server/`, ścieżki `src/routes/...` i `--config vitest.config.ts`; dał 6/6.
4. `§R.2` odsyła do nieistniejącego `§0.4`; w raporcie ujęto wszystkie faktyczne komendy wejściowe z §0.1 i T1–T4. Martwe odwołanie `Z24 → §0.4a` pominięto zgodnie z §0.1-BIS.

## R1 — czy raport da się przeczytać

**Jednoznaczna odpowiedź: raport z audytu DA SIĘ przeczytać przez interfejs.**

### Cztery warstwy

- **W1 — komponent:** `AuditReportDocumentView` renderuje pełny dokument; `AuditReportsTab` renderuje listę i podgląd z akcją „Otwórz pełny raport”.
- **W2 — źródło treści:** `AuditReportDocumentView.tsx:576-590` woła `getReport(reportId)`, waliduje `payload.sections` i ustawia `fullDocument`. `auditsMethodApi.ts:609-614` mapuje to na `GET /audits/reports/:id`. Backend `reports.routes.ts:117-128` pobiera raport przez `reportService.getReport`; jego treść pochodzi z `audit_reports.payload`.
- **W3 — realny wołacz:** frontendowy `Api.get('/audits/reports/:id')`; eksport ma dwa wołacze `fetch('/api/audits/reports/:id/export.docx')` w `AuditReportsTab.tsx:123-166` oraz `AuditReportDocumentView.tsx:556-580`.
- **W4 — łańcuch renderowania:** `menuConfig.ts:169-173` → `AppView.ASSESSMENT_AUDITS` → `routeConfig.ts:390` `/audit-programs` → `AppRoutes.tsx:1622-1635` → `AuditsMethodHub` → zakładka `reports` (`AuditsMethodHub.tsx:530-536`) → `AuditReportsTab` → `/audit-programs/reports/:reportId` (`AppRoutes.tsx:1671-1684`) → `AuditReportDocumentView`.

Pomiar jednostkowy na markerze: 31/31 PASS, pełne nazwy w `/private/tmp/cx-day137-audyt-raport-artefakty/day137-frontend-marker.json`, SHA-256 `fcb2c5ad25b6627975d10bb32b76025a00cc491c1dc3b2e4a7b71c4a217619f5`. Kluczowe nazwy: `renders report.payload by default — title, executive summary text`, `flag ON: ... offers "Download DOCX" and requests the real export route`, `requests the encoded report export endpoint`.

Status trzech komponentów wskazanych w instrukcji:

| Komponent | Stan | Dowód |
| --- | --- | --- |
| `AuditsHub` | `ISTNIEJE_NIEAKTYWNE` | tylko eksport z `index.ts`; żywa trasa montuje `AuditsMethodHub` |
| `AuditHistoryView` | `ISTNIEJE_NIEAKTYWNE` | zero konsumentów poza definicją |
| `AuditOrchestratorWizard` | `ISTNIEJE_NIEAKTYWNE` | zero konsumentów poza eksportem `index.ts`; 511 linii |

## R2 — eksport DOCX przez realny HTTP

Komenda dowodowa została uruchomiona z `server/` z kompletem w tej samej linii: `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6021/cx137 JWT_SECRET=cx137-test-secret-do-not-reuse`, dalej `npx vitest run src/routes/audits/__tests__/day41.reportExport.pg.test.ts --config vitest.config.ts --retry=0 --reporter=json ...`.

Pakiet tworzy realny `express`, wywołuje `apiGateway.initializeRoutes(app)`, podpisuje JWT, zapisuje tenant, membership i raport do RealPG, a następnie wykonuje `GET /api/audits/reports/:id/export.docx`.

Wynik:

- HTTP: **200** (`returns a non-empty DOCX ZIP with the required headers` — PASS);
- rozmiar: **11 244 B**; nagłówek `Content-Length > 0`, sygnatura `PK`;
- plik: `/private/tmp/cx-day137-audyt-raport-artefakty/day137-audit-report.docx`;
- SHA-256: `a161ccff47219eaffc84fc9e3968f4e4ff0c4d950c19a33c413756fbbe38f1c9`;
- integralność: `unzip -t` → `No errors detected`;
- zawartość po otwarciu `word/document.xml`: tytuł `Łódź — raport jakości`, spis treści, 13 sekcji, m.in. `Treść executive_summary`, `Treść scope`, `Macierz traceability — DAY41_PAYLOAD_ONLY` oraz jawna informacja o braku źródeł.

JSON: 6/6 PASS, 0 FAIL, `/private/tmp/cx-day137-audyt-raport-artefakty/day137-report-export-vitest.json`, SHA-256 `f01f0f4e372bd714fdf6df88da89dcf628e1a8a6e9b661f8db94320fcd3794e8`.

Nie wykonano naprawy produkcyjnej — stan markera już spełnia R2. Dlatego para W-A (czerwony przed / zielony po) **nie ma zastosowania**; fabrykowanie mutacji byłoby sprzeczne z zakresem.

## R3 — koszt PDF (nic nie zbudowano)

`grep -rn "export.pdf" server/src/routes/audits/` daje 0: audyty nie mają trasy PDF. Najkrótsza technicznie ścieżka nie wymaga nowego generatora: `reports.routes.ts` już buduje wspólny `DocumentSchema` przez `buildAuditReportDocumentSchema`, a `server/src/services/documentStudio/documentPdfRenderer.ts:1134` eksportuje `renderDocumentSchemaToPdfBuffer`. Należałoby dodać siostrzaną trasę i kontrolkę frontendową oraz wykonać dowody renderu, polskich fontów, nazw pliku, tenant isolation, rozmiaru i otwarcia PDF.

Szacunek techniczny po decyzji właściciela: **1–2 dni inżynierskie + odbiór wizualny**, jeśli reuse wspólnego `DocumentSchema` zostanie zaakceptowany. Budowa osobnego, szóstego składu to wysokie ryzyko rozjazdu DOCX/PDF (sekcje, placeholdery, typografia, źródła, QA) i nie jest rekomendowana. Decyzja wymagana: czy PDF jest zakresem produktu oraz czy wspólny Document Studio jest jego SSOT.

## R4 — kreator programu audytu

`AuditOrchestratorWizard.tsx` ma dokładnie **511 linii**. Jest eksportowany z `src/components/Audit/index.ts`, lecz nie ma renderującego konsumenta. Nie został ożywiony ani zmieniony.

Brak do ożywienia nie ogranicza się do jednego importu: kreator korzysta ze starego `auditApi.ts` i przestrzeni `/api/audit/programs`, podczas gdy żywy hub używa kanonicznego kernela `/api/audits`. Potrzebna jest decyzja, czy zachować stary model interview-based, czy przepisać flow na kanoniczne packs/programs; następnie modal/route, integracja z hubem, test renderu, RealPG i odbiór wizualny. Szacunek: **średnia/duża pozycja, 2–4 dni + decyzja produktowa i odbiór**, nie bezpieczny „jednolinijkowy mount”.

## Pary W-A i pomiar różnicowy W-C

Nie było realnej naprawy kodu produkcyjnego, zatem W-A nie występuje. Identyczna komenda frontendowa została wykonana przed i po utworzeniu raportu, z `--retry=0` i reporterem JSON:

```text
marker: total 31, passed 31, failed 0
after:  total 31, passed 31, failed 0
fullNamesIdentical: true
onlyMarker: []
onlyAfter: []
```

Artefakt po: `/private/tmp/cx-day137-audyt-raport-artefakty/day137-frontend-after.json`, SHA-256 `a2dd8dc7079d2d5a66b12240569a855ce6b04ec52c05304a4afc9a944a63ab82`.

## Pułapki (a)–(e) per pakiet

### RealPG `day41.reportExport.pg.test.ts`

- (a) wyłączona: `ENABLE_V8_GLOBAL=true` w tej samej linii;
- (b) wyłączona: `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` w tej samej linii, choć ten middleware nie jest wskazany na ścieżce `/api/audits`;
- (c) wyłączona: `MOCK_DB=false DB_TYPE=postgres DATABASE_URL=...:6021/cx137`; dowodem dodatkowym są realne inserty i cleanup przez `auditRun` oraz 6 wykonanych (nie pominiętych) testów;
- (d) wyłączona: `ENABLE_TEST_AUTH_BYPASS=false`; JWT jest podpisany `JWT_SECRET`, a test obcego tenanta kończy się właściwym 404;
- (e) uwzględniona: żywą trasą jest `AuditsMethodHub`, nie trzy komponenty legacy.

### Frontend — cztery pliki testowe

Pakiet jest czysto jednostkowy (`RUN_DB_TESTS=0 MOCK_DB=true`), więc (a)–(d) nie są dowodem egzekucji backendu i nie są tak przedstawiane. (e) jest mierzona bezpośrednio przez render `AuditsMethodHub`, `AuditReportsTab` i `AuditReportDocumentView`; osobny pełny grep bez `head` wykazał brak konsumentów trzech komponentów legacy.

## W-D — granica rozłączności

Po commicie końcowym wynik `git diff --name-only 4378136c7d..HEAD`:

```text
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY137_AUDYT_RAPORT_REPORT.md
```

To jedyny plik w diffie i ma licencję „utworzenie”. Nie zmieniono generatorów, migracji, flag, middleware ani plików cudzych dyżurów.

## TWIERDZENIA NIEZWERYFIKOWANE

1. Nie wykonano pełnego zrzutu w przeglądarce na runtime 4940/4941; R1 ma dowód łańcucha i renderu testowego, ale nie owner proof pikseli na konkretnym tenantcie.
2. Nie zmierzono dostępności dla każdej roli biznesowej; R2 dowodzi admina aktywnego tenanta oraz izolacji obcego tenanta, nie pełnej macierzy RBAC.
3. Szacunki PDF 1–2 dni i kreatora 2–4 dni są estymacją na podstawie zależności, nie wykonanym spike'em ani zobowiązaniem zespołu.
4. Nie zweryfikowano wizualnej paginacji DOCX w Wordzie/LibreOffice; zweryfikowano integralność OOXML i treść XML, ale nie render stron.
