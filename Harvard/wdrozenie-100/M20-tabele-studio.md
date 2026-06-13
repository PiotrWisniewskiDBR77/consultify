# WP M20 — Tabele Studio · dokończenie do 100%

**Pula:** beta · **Karta:** `Harvard/modules/M20-tabele-studio/KARTA_AUDYTU.md` (ocena 48/100) · **Rozmiar:** L (3–5 dni) · **Żywy bloker:** P0 security
**Faza programu:** FAZA 1 (blokery) → FAZA 3 (szlif) → FAZA 4 (sweepy) · **Master:** `Harvard/wdrozenie-100/MASTER.md`

## 1. Stan obecny (jednym akapitem)
Najpotężniejszy funkcjonalnie moduł beta (platforma tabel Airtable-like, 193 endpointy). **Rdzeń szczelny:** bazy/tabele/rekordy/widoki/pola na realnym Postgresie `tp_*` (BEZ fasady in-memory), org-guard przez `PermissionsService.canAccessBase` (~115/193 tras), budżet AI Editor egzekwowany serwerowo. **Ale** cluster endpointów „dosadzonych później" omija `PermissionsService` i uderza w DB raw → realny cross-org IDOR read+write (zweryfikowany osobiście w audycie). To trzyma moduł na 48/100 (hard cap).

## 2. Luki do DoD

### (a) BACKEND / API — **P0/P1 blokery (FAZA 1)**
- **[P0] cross-org IDOR read+write — record-templates.** `GET/POST/PATCH /tables/:tableId/record-templates` (`server/src/routes/table-platform.routes.ts:4802,4823,4840`) robi `import('../database/Database.js')` i `INSERT INTO tp_records (..., table_id, data) VALUES ($1=tableId-z-URL, $2)` — bez org, bez base-access. Fix: przepuścić przez `PermissionsService.canAccessBase(tableId→base, token.org)`.
- **[P1] cross-org read PII — form submissions.** `GET /forms/:formId/submissions` (`:2804`) → `FormService.getSubmissions(formId)` bez scope'u. Fix: scope org/base na `formId`.
- **[P1] cross-org — row-policies.** `:4407/4434` keyed bez org. Fix: `canAccessBase`.
- **[P1] cross-module write — governed-models sync.** `publish-to-results`/`sync-to-finance`/`sync-to-execution` (`:3413,3440,3469`) keyed tylko `:modelId`. Fix: scope org + walidacja własności modelu.

### (b) BACKEND — fasady / długi (FAZA 3)
- **[INTEGRACJA] governed sync = STUB.** `ModuleSyncService.syncToModule` (`server/src/services/.../ModuleSyncService.ts:57-110`, zapis `:89`) pisze wyłącznie log do `tp_module_sync_results`, zwraca `success:true`, ale NIE pisze do Results/Finance/Execution (grep: zero czytelników w M15/M16). Decyzja #6: albo realny zapis do modułu docelowego, albo oznaczyć jako „preview" i ukryć przyciski sync.
- **[P1] SSO config plaintext at rest.** `SSOService.ts:47-63` — `clientSecret`/SAML cert bez szyfrowania (wzorzec M25 → AES).
- **[P2] share_password zapisywane, NIGDY nieweryfikowane.** `MetadataService.ts:1279` — widoki „chronione hasłem" są otwarte. Fix: weryfikacja hasła przy dostępie do share.
- **[P2] rozjazd 4 flag komentarz↔runtime.** `FeatureFlags.ts:85-103` — `ENABLE_TABLE_AI_EDITOR`/`QA_ENGINE`/`SOURCE_PACK`/`ARTIFACT_CONVERSION`: komentarz „Disabled by default", runtime `!== 'false'` = **default ON**. FE chowa UI, BE żywe → osiągalne API. Ujednolicić komentarz↔runtime↔FE.

### (c) FRONTEND / UX (FAZA 3/4)
- Cicha degradacja przy flag-OFF (catch→null, brak baneru); brak obsługi `503 SCHEMA_NOT_READY` / `404 AI_EDITOR_DISABLED` (komunikat zamiast pustki).
- i18n: inline (sweep FAZA 4).

### (d) INTEGRACJA / TESTY E2E (FAZA 1 + 4)
- **[P0 testowy] fundament Records API w 100% zmockowany** — żaden test nie dotyka realnej `tp_records`. Dodać integrację na realnej DB (S1).
- E2E false-green: `crud/views/chat-to-schema.spec.ts` mają `test.skip()` na 404/no-token + asercje `<500` → strukturalnie nie potrafią oblać. Refactor: twardy `beforeAll` seed.
- Testy org-guard (cross-org 403) na record-templates/form-submissions/row-policies — brak.
- CI: `test-suite.yml` tylko `[main,develop]`; default `Londyn` → PR-gate M20 ≈ 0. Dodać `Londyn` (sweep FAZA 4).

## 3. Kroki realizacji
1. **(FAZA 1, P0)** Org-guard na 4 ścieżki wtórne (`:4802-4849`, `:2804`, `:4407/4434`, `:3413-3469`) przez `PermissionsService.canAccessBase`/scope org. + testy IDOR (cross-org → 403/404).
2. **(FAZA 1)** Test fundamentu na realnej `tp_records` (S1) — twardy seed, potrafi oblać.
3. **(FAZA 3)** Governed sync: realny zapis do Results/Finance/Execution ALBO „preview" + ukrycie przycisków (Decyzja #6). Aktualizacja inwentarza INV_E (STUB ≠ „DZIAŁA").
4. **(FAZA 3)** SSO AES, share_password weryfikacja, ujednolicenie 4 flag.
5. **(FAZA 3/4)** Banery degradacji flag-OFF + obsługa 503/404; i18n; §27 jeśli tabele listujące poza kanonem.
6. **(FAZA 4)** E2E anty-false-green + trigger CI `Londyn`.

## 4. DoD (6 kryteriów — bramka 6/6)
1. **Front↔back:** governed sync realnie pisze (lub jawnie „preview"); zero martwych przycisków; Records CRUD trwały po reload.
2. **Bezpieczeństwo:** 4 ścieżki IDOR zamknięte (cross-org → 403/404, test); SSO szyfrowane; share_password weryfikowane.
3. **i18n:** `t()` pełne.
4. **Tokeny:** zgodne z Visual Standard.
5. **§27:** listy przez FilterableTable.
6. **E2E w PR-gate:** S1 (real DB) + IDOR-403 zielone na `Londyn`.

## 5. Weryfikacja
- Cross-org IDOR: próba zapisu/odczytu na cudzą `tableId`/`formId` → 403/404 (test + żywy read-only proof na staging — OSTROŻNIE, dev `.env` może wskazywać Railway PROD).
- Governed sync: rekord faktycznie pojawia się w module docelowym (lub przycisk schowany).
- Records: utwórz → reload → trwałe (real DB).
- Migracje `tp_*` (700–778) zastosowane mimo wcześniejszej kolizji 725/726 (→777/778, naprawione).

## 6. Zależności
- Governed sync (krok 3) dotyka M15/M16 — koordynować inwentarz wyjść.
- FAZA 1 (IDOR) niezależna od kręgosłupa — można robić równolegle z Fazą 0.
