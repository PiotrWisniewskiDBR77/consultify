# CODEX DAY 147 — raport backendu załączników Zadania i Decyzji

## Stan wejściowy

Instrukcja miała stan `WYDANY`. Zastosowałem `§0.1-BIS`; nie wykonałem fetchu, nie tworzyłem worktree i nie dotknąłem vaulta ani checkoutu właściciela.

```text
$ git merge-base --is-ancestor c685ea65af HEAD && echo "BAZA OK" || echo "MARKER BRAK — STOP"
BAZA OK
$ git status --short
[brak wyjścia]
$ git branch --show-current
codex/day147-zalaczniki-backend-20260830
$ ls -la node_modules
lrwxr-xr-x@ 1 piotrwisniewski wheel 56 Aug 30 10:22 node_modules -> /Users/piotrwisniewski/Developer/Consultify/node_modules
$ df -h /
Filesystem        Size    Used   Avail Capacity iused ifree %iused Mounted on
/dev/disk3s1s1   1.8Ti    12Gi    20Gi    37%    459k  213M    0% /
$ lsof -nP -iTCP:6033 -sTCP:LISTEN
[brak wyjścia]
$ lsof -nP -iTCP:4960 -sTCP:LISTEN
[brak wyjścia]
$ lsof -nP -iTCP:4961 -sTCP:LISTEN
[brak wyjścia]
```

Obowiązkowe pomiary T1–T4:

```text
T1: grep -rniE "multer|upload" server/src/routes --include='*.ts' | grep -viE "test|notebook|knowledge|table" | head -10
server/src/routes/organization/branding.routes.ts:5: * - Logo uploads (light/dark mode, icon, favicon)
server/src/routes/organization/branding.routes.ts:23:import multer from 'multer';
server/src/routes/organization/branding.routes.ts:34:import { uploadsDir } from '../../utils/storagePaths.js';
[kolejne trafienia wyłącznie branding; zero task/decision]

T2: ls server/migrations/ | grep -iE "attach" | head -10
20260328_notebook_attachments.sql
20260822_finance_v3_e007_05_benefit_tracking_protection_reattach.sql
942_chat_m01p04a_attachment_status.sql

T3: grep -rn "notebook.*attach\|attach.*notebook" server/src/routes --include='*.ts' | grep -v __tests__ | head -6
server/src/routes/v8/my-work.routes.ts:1246:  '/notebook/pages/:id/attachments',
server/src/routes/v8/my-work.routes.ts:1315:  '/notebook/pages/:id/attachments/:attachmentId/download',
server/src/routes/v8/my-work.routes.ts:1355:  '/notebook/pages/:id/attachments/:attachmentId',
server/src/routes/v8/notebook.routes.ts:297:        downloadUrl: `/api/v8/my-work/notebook/pages/${noteId}/attachments/${attachmentId}/download`,
server/src/routes/my-work/notebook.routes.ts:4: * Handles /notebook/pages CRUD, file uploads, attachments, conversions,
server/src/routes/my-work/notebook.routes.ts:941:  '/notebook/pages/:id/attachments',

T4: grep -rnE "process\.cwd\(\)|uploads" server/src --include='*.ts' | grep -v __tests__ | head -8
server/src/middleware/inputSanitization.middleware.ts:11: * - Skip binary/file uploads (multipart)
server/src/middleware/inputSanitization.middleware.ts:213:    // Skip multipart/file uploads (binary data)
server/src/middleware/fileUpload.middleware.ts:14:import { uploadsDir } from '../utils/storagePaths.js';
server/src/middleware/fileUpload.middleware.ts:29:// Was `path.resolve(__dirname, '../../../uploads/assessments')` — equivalent
server/src/middleware/fileUpload.middleware.ts:30:// to `process.cwd()/uploads/assessments` at runtime, but hardcoded to
server/src/middleware/fileUpload.middleware.ts:31:// process.cwd() and blind to STORAGE_DIR/RAILWAY_VOLUME_MOUNT_PATH. Routed
server/src/middleware/fileUpload.middleware.ts:34:export const ASSESSMENTS_UPLOAD_ROOT = uploadsDir('assessments');
server/src/database/DatabaseInitializer.ts:28:  const cwdPath = path.resolve(process.cwd(), 'tests/utils/testSchema.js');
```

## Korekty wobec instrukcji

1. `§0.2c` mówi, że zmienna `DB_TYPE=postgres` w tej samej linii nadpisze `server/vitest.config.ts`, natomiast `§0.1-BIS` rozstrzyga, że config przypina `DB_TYPE='sqlite'` i wygrywa z linią komend. Zastosowałem bezpieczniejsze, późniejsze rozstrzygnięcie z `§0.1-BIS`: config poza repo, bez `test.env.DB_TYPE`, uruchomiony z `server/`.
2. `Z24` odsyła do nieistniejącego `§0.4a`. Zgodnie z rozstrzygnięciem w `§0.1-BIS` pominąłem ten martwy odsyłacz. Nie pominąłem listy plików ani W-D.
3. `Z34a` nakazuje push po commitach, a końcowe rozstrzygnięcie mówi „NIE PUSHUJESZ”. Nie wykonałem żadnego pushu.
4. T1 oczekiwał zera trafień po filtrze, ale pomiar zwrócił branding. Nie są to trasy initiative/task/decision, więc teza zakresowa T1 pozostaje potwierdzona, a dokładne oczekiwanie „zero wyjścia” jest obalone.
5. `§R.2` mówi o „ścieżce w tabeli licencji”, chociaż raport nie jest w tabeli §4. Jawny nakaz Z13 i §R.2 przybija dokładną ścieżkę raportu, więc utworzyłem tylko ten jeden dokument.

## R1 — migracja addytywna

Commit: `af3aabfebe`.

Powstała wyłącznie migracja `server/migrations/20260830_day147_object_attachments.sql`. Tabela `object_attachments` ma 10 kolumn, ograniczenie `object_type IN ('task','decision')`, unikalny `storage_key` oraz wymagane indeksy `(object_type, object_id)` i `organization_id`. Wszystkie operacje tworzące są idempotentne przez `IF NOT EXISTS`.

Pełny runner migracji na `pgvector/pgvector:pg16`, kontener `cx-day147-pg`, `127.0.0.1:6033`:

```text
Pierwszy przebieg: Applying migrations: 865
→ 20260830_day147_object_attachments.sql
✅ Postgres migrations complete
FIRST_MIGRATION_EXIT=0

Drugi przebieg: Applying migrations: 0
✅ Postgres migrations complete
SECOND_MIGRATION_EXIT=0
```

`information_schema.columns` zwróciło: `id`, `object_type`, `object_id`, `organization_id`, `file_name`, `mime_type`, `size_bytes`, `storage_key`, `created_by`, `created_at`. `pg_indexes` potwierdziło `idx_object_attachments_object` i `idx_object_attachments_organization` oraz indeksy PK/UNIQUE.

## R2 — cztery trasy i uprawnienia

Commit: `927ac4747d`.

Pod istniejącym, uwierzytelnionym przez `verifyToken` i `validateOrgMembership` agregatorem `/api/my-work` zamontowałem:

- `POST /object-attachments/:objectType/:objectId`;
- `GET /object-attachments/:objectType/:objectId`;
- `GET /object-attachments/:objectType/:objectId/:attachmentId/download`;
- `DELETE /object-attachments/:objectType/:objectId/:attachmentId`.

Każda operacja najpierw sprawdza zgodność `organization_id`, a potem uczestnictwo: dla task `assignee_id`/`reporter_id`, dla decision `decision_maker_id`/`created_by`. Obcy tenant dostaje fail-closed `404`. Sukces daje jednoznaczne 2xx z danymi, a błędy mają nie-2xx oraz kod.

Harness poza repo zbudował aplikację wyłącznie przez `ApiGateway.getInstance().initializeRoutes(app)`, podpisał JWT, użył realnych `organization_members`, realnego Postgresa i niezależnego klienta `pg` do SELECT/readback. Wynik finalny: 4/4 PASS:

```text
passed | Day 147 object attachments through the production ApiGateway task: POST -> SELECT -> GET -> DELETE -> SELECT preserves bytes and metadata
passed | Day 147 object attachments through the production ApiGateway task: foreign tenant is rejected on all four routes
passed | Day 147 object attachments through the production ApiGateway decision: POST -> SELECT -> GET -> DELETE -> SELECT preserves bytes and metadata
passed | Day 147 object attachments through the production ApiGateway decision: foreign tenant is rejected on all four routes
```

W cyklach SELECT po POST potwierdził wiersz, metadane, rozmiar i klucz; sprawdzenie ścieżki potwierdziło plik; download zwrócił identyczne bajty i `text/plain`; DELETE dał 204; SELECT i sprawdzenie pliku po DELETE potwierdziły brak obu. Test cross-tenant wykonał POST, listę, download i DELETE osobno dla obu typów; statusy wyniosły `[404,404,404,404]`, a readback liczby wierszy nie zmienił się.

## R3 — storage seam i ryzyko trwałości

Nowy serwis wykonuje wyłącznie `getStorage().putObject`, `getObject` i `delete`. Pomiar:

```text
$ rg -n "fs\.(writeFile|unlink|rename)|getStorage\(" server/src/services/objectAttachmentService.ts server/src/routes/my-work/object-attachments.routes.ts
server/src/services/objectAttachmentService.ts:143:  const storage = getStorage();
server/src/services/objectAttachmentService.ts:188:  return { attachment, object: await getStorage().getObject(attachment.storageKey) };
server/src/services/objectAttachmentService.ts:209:  await getStorage().delete(attachment.storageKey);
```

Ryzyko trwałości: domyślny `LocalDiskAdapter` składuje pod drzewem `process.cwd()/uploads` (przez `baseStorageDir()`), więc bez trwałego wolumenu bajty nie przeżyją redeployu platformy. Środowisko musi wskazać trwały mount przez `STORAGE_DIR` albo `RAILWAY_VOLUME_MOUNT_PATH`; alternatywnie musi ustawić `STORAGE_PROVIDER=s3` wraz z poprawnymi `S3_BUCKET` i `S3_ENDPOINT` (oraz wymaganymi poświadczeniami dostawcy). Nie łączyłem się z żadnym środowiskiem zdalnym i nie weryfikowałem jego konfiguracji.

## R4 — porównanie wzorców i rozstrzygnięcie

Notatnik używa `server/migrations/20260328_notebook_attachments.sql`, kolumny `notebook_pages.attachments_json`, tras w `server/src/routes/v8/my-work.routes.ts` / `server/src/routes/my-work/notebook.routes.ts` i bezpośredniej warstwy plikowej w `server/src/services/notebookAttachmentService.ts`.

Table Platform używa dedykowanej tabeli `tp_attachments` z `server/migrations/700_table_platform_foundation.sql` oraz `server/src/services/tablePlatform/AttachmentService.ts`, który przechodzi przez `server/src/services/storage/index.ts` i `getStorage()`.

Zastosowałem wzorzec Table Platform: dedykowana tabela daje filtrowalność i izolację tenantową na poziomie wiersza, a seam zachowuje ten sam klucz przy przełączeniu local → S3/R2. Z notatnika przejąłem jednoznaczny kształt cyklu HTTP i kodów błędów, nie jego JSON ani bezpośrednie `fs`.

## W-A — dowód mutacyjny

Finalny harness i config leżą poza repo:

- `/private/tmp/cx-day147-zalaczniki-backend-scratch/day147.object-attachments.realpg.test.ts`;
- `/private/tmp/cx-day147-zalaczniki-backend-scratch/vitest.day147.config.ts`.

Mutacja: skopiowałem agregator przez `cp`, usunąłem `router.use(objectAttachmentsRouter)`, uruchomiłem komendę z kompletnym env i `--retry=0`. Finalna czerwień:

```text
failed | ... task: POST -> SELECT -> GET -> DELETE -> SELECT preserves bytes and metadata
failed | ... task: foreign tenant is rejected on all four routes
failed | ... decision: POST -> SELECT -> GET -> DELETE -> SELECT preserves bytes and metadata
failed | ... decision: foreign tenant is rejected on all four routes
{"success":false,"totalSuites":2,"failedSuites":2,"totalTests":4,"failedTests":4}
```

Przywrócenie: `cp` ze scratcha i `cmp` dały `MUTACJA COFNIETA: CMP OK`. Ta sama komenda (zmienione tylko ścieżki artefaktu/output uploadów) dała:

```text
passed | ... task: POST -> SELECT -> GET -> DELETE -> SELECT preserves bytes and metadata
passed | ... task: foreign tenant is rejected on all four routes
passed | ... decision: POST -> SELECT -> GET -> DELETE -> SELECT preserves bytes and metadata
passed | ... decision: foreign tenant is rejected on all four routes
{"success":true,"totalSuites":2,"failedSuites":0,"totalTests":4,"failedTests":0}
```

Test nie czyta tekstu kodu produkcyjnego. Po testach: `remaining_day147_attachments = 0`, `remaining_day147_orgs = 0`.

## W-C — pomiar różnicowy

Nie wykonałem checkoutu markera ani drugiego worktree, ponieważ §0.1-BIS przybił gotowy worktree i zakazał tworzenia go samodzielnie. Zamiast przedstawiać proxy jako marker, podaję uczciwie: finalna para mierzy dokładnie usunięcie i przywrócenie produkcyjnego mountu na HEAD. Dokładny przebieg tej samej suity na pełnym drzewie `c685ea65af` pozostaje `NIEZWERYFIKOWANY`. Teza braku mountu na bazie została jednak dowiedziona czerwonym kontraktem 4/4 przy jego usunięciu oraz statycznym diffem markera.

## Pułapki (a)–(e) per pakiet

Pakiet `day147.object-attachments.realpg.test.ts`:

- (a) `ENABLE_V8_GLOBAL=true` było jawnie w tej samej linii; ścieżka `/api/my-work` nie opiera wyniku cross-tenant na wcześniejszym V8 404, a pozytywne POST zwróciły 201.
- (b) `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` było jawnie ustawione; ten middleware nie jest strażnikiem nowego routera.
- (c) zewnętrzny config nie ma `test.env.DB_TYPE`; pierwsze asercje wymagają `DB_TYPE=postgres`, `MOCK_DB=false` i dokładnego lokalnego `DATABASE_URL`. Pakiet wykonał 4 testy, nie skip/0.
- (d) `ENABLE_TEST_AUTH_BYPASS=false`; podpisane JWT przeszły realny `verifyToken`, a członkostwa pochodziły z realnych `organization_members`.
- (e) `UPLOADS_BASE_DIR` wskazywał katalog artefaktów tego dyżuru; test potwierdził istnienie i usunięcie lokalnych bajtów. Ryzyko produkcyjnej trwałości opisano w R3 bez połączenia zdalnego.

TypeScript: `npx tsc --noEmit --project server/tsconfig.json --pretty false` zakończył się `TSC_PIPESTATUS=0 0 0` i pustym logiem (exit 0).

## Z30 — deklaracja

Dowody przed zapisem: `BRAK ZMIENNYCH POCZTY`; grep drenaży w `server/src/Gateway.ts` zwrócił 0 trafień; po migracjach SELECT `settings WHERE key LIKE 'smtp%'` zwrócił 0 wierszy.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## W-D — granica rozłączności

```text
$ git diff --name-only c685ea65af..HEAD
server/migrations/20260830_day147_object_attachments.sql
server/src/routes/my-work.routes.ts
server/src/routes/my-work/object-attachments.routes.ts
server/src/services/objectAttachmentService.ts

$ git diff --name-only c685ea65af..HEAD -- 'src/**'
[brak wyjścia]

$ git diff --name-only c685ea65af..HEAD -- <pliki nietykalne imiennie>
[brak wyjścia]
```

Po dodaniu raportu jedynym dodatkowym plikiem jest ten raport wymagany przez Z13/§R.2. Nie powstała inna migracja. Nie zmieniono frontu, endpointów notatnika, Table Platform ani `server/src/domain/initiatives-execution/**`.

## Artefakty i SHA-256

```text
8f0dffc26e8c95b266941dd6d0eb3cd7526ca15b4b3dd2d88b3001abf4460475  /private/tmp/cx-day147-zalaczniki-backend-artefakty/day147-migrate-first.log
39ab1f39446361f3e3c9768be1031dfd0624ee4afaa5b40594605cf88535b7b7  /private/tmp/cx-day147-zalaczniki-backend-artefakty/day147-migrate-second.log
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  /private/tmp/cx-day147-zalaczniki-backend-artefakty/day147-tsc.log
d8e50defd0ad5a7380666c7735581afa96cacd320d11c1c3ae7c9216fb65294e  /private/tmp/cx-day147-zalaczniki-backend-artefakty/day147-final-red.json
e03db7b4779966b45eb8d7345c914289e515aad040a2ac961416b04920854c06  /private/tmp/cx-day147-zalaczniki-backend-artefakty/day147-final-green.json
```

## TWIERDZENIA NIEZWERYFIKOWANE

1. `NIEZWERYFIKOWANE`: dokładny W-C na pełnym checkoutcie markera `c685ea65af`; powód i bezpieczny substytut opisano w sekcji W-C.
2. `NIEZWERYFIKOWANE`: zachowanie realnego S3/R2 i poprawność zdalnych poświadczeń; brak połączeń zdalnych był obowiązkowy.
3. `NIEZWERYFIKOWANE`: trwały wolumen na środowisku wdrożeniowym; opisano wymagania, nie stan zdalny.
4. `BRAK KONSUMENTA W ZAKRESIE`: front nadal nie wywołuje nowych tras, ponieważ Z40 zabrania zmian `src/**`; podpięcie jest osobnym dyżurem.
5. `NIEZWERYFIKOWANE`: zachowanie przy awarii storage po częściowym DELETE pomiędzy usunięciem obiektu a usunięciem wiersza; brak transakcji rozproszonej DB–object storage w istniejącym seam.

## Stan końcowy

R1–R4 wykonane. B1–B8 (zduplikowane oznaczenie B8 w instrukcji) pokryte z wyjątkiem jawnie niezweryfikowanego dokładnego W-C na pełnym drzewie markera. Nie wykonano pushu ani połączenia zdalnego.

Po pomiarach usunąłem wyłącznie własny kontener i wolumen komendą `docker rm -fv cx-day147-pg`; kontrola `lsof` potwierdziła zwolnienie portu 6033.
