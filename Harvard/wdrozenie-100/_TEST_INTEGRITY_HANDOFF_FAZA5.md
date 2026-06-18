# 🧪 TEST-INTEGRITY HANDOFF (Faza 5, A2) — dla właściciela CI (H1/H2)

> Autor: Harvard 5 · 2026-06-18. `.github/workflows/*` = strefa H1 → **nie edytuję workflow sam**;
> niżej gotowy job do wklejenia + plan domknięcia A2a. Zgłaszam do właściciela CI.

---

## A2b — wepnij colocated `__tests__` do CI (580 testów poza CI)

**Problem:** w `test-suite.yml` joby wołają `npx vitest run tests/unit|tests/integration|tests/components`.
Jawna ścieżka NADPISUJE `include` z `vitest.config.ts`, więc **colocated testy nigdy nie biegną w CI**:
- `server/src/**/__tests__/*.test.ts` — **431 plików** (m.in. `presentationStudio.routes.test.ts` 71 RBAC).
- `src/**/__tests__/*.test.{ts,tsx}` — **149 plików**.
(Precedens: workflow już dodał wyjątek `vitest run src/components/MyWork` dla colocated MyWork — `:364-369`.)

**Gotowy job (wzorowany na `integration-tests` `:472-525` — server testy wymagają Postgres):**

```yaml
  colocated-tests:
    name: Colocated __tests__ (server + src)
    runs-on: ubuntu-latest
    timeout-minutes: 15
    needs: lint-typecheck
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: iris
          POSTGRES_PASSWORD: iris_test
          POSTGRES_DB: iris_test
        ports: [ "5432:5432" ]
        options: >-
          --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Migrate DB (strict)
        run: DB_TYPE=postgres DATABASE_URL=postgres://iris:iris_test@localhost:5432/iris_test npm run db:migrate:strict
      - name: Run colocated server/src __tests__
        run: npx vitest run server/src src --no-file-parallelism --reporter=junit --outputFile=junit-colocated.xml
        env:
          DB_TYPE: postgres
          DATABASE_URL: postgres://iris:iris_test@localhost:5432/iris_test
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with: { name: junit-colocated, path: junit-colocated.xml }
```

**Uwagi do walidacji właściciela:**
- `vitest run server/src src` filtruje po pliku — odpala tylko `*.test.*` w tych drzewach (nie dubluje `tests/`).
- Per-plik środowisko: `src/**` = jsdom, `server/src/**` = node — pokryte `environmentMatchGlobs` w `vitest.config.ts`. Jeśli mieszanie sprawia problem → rozbij na 2 joby (server=node+pg, src=jsdom bez pg).
- Pierwsze uruchomienie ujawni testy, które „zielone" były tylko dlatego, że NIGDY nie biegły — spodziewaj się realnych czerwonych do domknięcia (to jest cel A2).

---

## A2a — de-sham asercji (stan + plan domknięcia)

**Skala (audyt 2026-06-18):** **443 pozorne asercje / 106 plików** `tests/integration/` (więcej niż szacowane 179/88).
- 346 inline tablic `expect([200,401,403,404,500,503]).toContain(res.status)`
- 97 przez stałą `VALID_STATUSES` (`[200,201,400,401,403,404,500,501]`) w **29** plikach — najbardziej systemowe; **usunąć stałą**, nie zwężać.

**Zrobione + ZWERYFIKOWANE (commity `5f928ea983`, `246d17296c`):**
- `llmHealth.test.js` — 6 verifyToken routes → exact **401**; `/providers/public` → not-401/403. 7/7 ✅
- `aiLayersIntegration.test.js` — 2× „without auth" → exact **401** (zweryfikowane); happy-path GET → **200**. 13/13 ✅
- `storage_security.test.js` — cross-org IDOR `[403,404,501]`→`[403,404]`+not-200; traversal/limit/delete: usunięto masking 500/501.

**Ograniczenie weryfikacji:** lokalna DB nie ma roli `iris` → DB-zależne testy integracyjne (większość) **nie weryfikują się lokalnie** (hard-fail w `beforeAll` lub `if(!token) return`). Weryfikowalne lokalnie = tylko auth-before-DB (401/403). **Reszta wymaga CI-DB** (job z Postgres) — dlatego A2b musi wejść PRZED masowym de-shamem, by każda zmiana asercji była weryfikowana w CI.

**Plan domknięcia (kolejność, dla wykonawcy z dostępem CI-DB):**
1. Wepnij `colocated-tests` (wyżej) + włącz integration job na PR (dziś deferred poza main/develop, `:495`).
2. **Security-critical FIRST** (tablice z 200 w testach „without auth"/cross-org): `conversations.p35-history` (28), `routes/ai-performance` (66/82), `routes/assessment` (66), `metricsFullFlow` (3× „401"), `chat/streaming` (111/117), `access-control`, `superadmin-iam/customers/support`, `auth.test`. Każdy „without auth"→**401**, cross-org-denied→**403**.
3. **Usuń stałą `VALID_STATUSES`** w 29 plikach (superadmin-system/ai-platform/analytics/overview…) — zastąp dokładnym statusem per-call (kasuje 97 shamów + maskowanie 500).
4. **Sweep happy-path** inline: GET→**200**, create→**201**, no-auth→**401**, cross-org→**403** (`initiatives.test.js:106-172`, `billing.routes.full.l3` 80 shamów, reszta ~80 plików 1-4 każdy).
5. Każda konwersja zielona w CI; czerwone = realny bug → eskalacja do właściciela modułu (NIE rozluźniaj asercji z powrotem).

Pełny inwentarz per-plik (linie + proponowany status) — w transkrypcie audytu A2a (agent scope, 2026-06-18).
