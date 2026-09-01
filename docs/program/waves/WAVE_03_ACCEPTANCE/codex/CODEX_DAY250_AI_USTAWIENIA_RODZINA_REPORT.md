# CODEX DAY 250 — Ustawienia AI, rodzina 18 tras

## Streszczenie

Dyżur wykonano na markerze `df7f13056f`, w worktree
`/private/tmp/cx-day250-ai-ustawienia-rodzina`, na efemerycznym PostgreSQL
`cx-day250-pg` (`127.0.0.1:6240/cx250`). Marker jest przodkiem
`github-backup/codex/m03-admin-20260824`; tip był dziewięć commitów dalej.

Wynik:

- `GET /api/ai-settings/effective` zwraca teraz spójne klucze camelCase na poziomie
  płaskim i w zagnieżdżonych obiektach `superadmin`/`org`, z zachowaniem wartości
  użytkownika;
- dodano realdb ochronę piętra superadmina: realny `ApiGateway`, podpisany JWT,
  realny PostgreSQL, GET, PUT + niezależny GET + SQL oraz para uprawnień;
- dopisano sprostowanie do `ZAPIS_USTAWIEN_AI_20260901.md`;
- końcowy pakiet: 7/7 PASS, `--retry=0`, pełne nazwy; mutacja usuwająca transformację
  z GET superadmin daje 3/4 RED.

## Stan wejściowy — wynik dosłowny

```text
MARKER OK
df7f13056fa24995be07f64b0e8c877b3faeab45
git status --short: <pusto>
```

Dysk przed utworzeniem worktree: 8,5 GiB wolne; po utworzeniu: 6,2 GiB wolne.
Porty `6240`, `5220`, `5221` były wolne. Kontener użył obrazu
`pgvector/pgvector:pg16`; pierwszy przebieg zastosował 880 migracji, drugi 0 i
zakończył się `Postgres migrations complete`.

## R1 — wszystkie 18 tras

Pomiar: `rg -n "router\.(get|put|post)\(" server/src/routes/ai/ai-settings.routes.ts`.
„Transformacja: NIE” nie oznacza defektu; defekt wymaga żywego czytelnika oczekującego
innego kształtu.

| # | Metoda + ścieżka | Linia na markerze | Transformacja nazw | Konsument zmierzony |
|---:|---|---:|---|---|
| 1 | `GET /superadmin` | 189 | TAK, `transformSettingsToCamelCase` | front żywy: `SuperAdminAISettings.tsx`, `AIConfigurationView.tsx` |
| 2 | `PUT /superadmin` | 214 | TAK, `transformSettingsToSnakeCase` i odpowiedź camelCase | front żywy, jak wyżej |
| 3 | `GET /org/:orgId` | 264 | TAK, `transformOrgSettingsToCamelCase` | front żywy: `OrgAISettingsView.tsx` oraz zakładki Admin/AI |
| 4 | `PUT /org/:orgId` | 310 | TAK, transformacja w obie strony | front żywy, jak wyżej |
| 5 | `GET /user` | 398 | NIE; serwisowy kształt snake_case, czytnik ma dual-key | front żywy: `AISettings.tsx`, `AIModelParametersSettings.tsx` |
| 6 | `PUT /user` | 429 | NIE; kontrakt użytkownika zachowany | front żywy, jak wyżej |
| 7 | `GET /effective` | 491 | NIE przed zmianą; TAK po R2 | frontowi wołacze martwi; żywy serwerowy konsument woła serwis bez HTTP |
| 8 | `GET /available-models` | 529 | NIE; brak wykazanej kolizji nazw | front żywy: `AIModelParametersSettings.tsx`, `ModelSelector.tsx` |
| 9 | `GET /proactivity` | 573 | NIE; brak wykazanej kolizji | brak bezpośredniego wołacza znalezionego w `src/` |
| 10 | `GET /proactivity/modes` | 609 | NIE; brak wykazanej kolizji | brak bezpośredniego wołacza znalezionego w `src/` |
| 11 | `GET /audit` | 640 | NIE; wynik listy audytu, brak wykazanej kolizji | front żywy: `AISettings/AuditLogViewer.tsx` |
| 12 | `GET /audit/org/:orgId` | 709 | NIE; brak wykazanej kolizji | brak bezpośredniego wołacza znalezionego w `src/` |
| 13 | `GET /user/costs` | 766 | NIE; agregat kosztów, brak wykazanej kolizji | front żywy: `useRealtimeCosts.ts` |
| 14 | `GET /org/:orgId/users/tiers` | 804 | NIE; brak wykazanej kolizji | brak bezpośredniego wołacza znalezionego w `src/` |
| 15 | `PUT /org/:orgId/users/:userId/tier` | 845 | NIE; brak wykazanej kolizji | brak bezpośredniego wołacza znalezionego w `src/` |
| 16 | `GET /org/:orgId/costs` | 901 | NIE; agregat kosztów, brak wykazanej kolizji | brak bezpośredniego wołacza znalezionego w `src/` |
| 17 | `GET /compliance/export/:format` | 947 | NIE; format eksportowy, brak wykazanej kolizji | brak bezpośredniego wołacza znalezionego w `src/` |
| 18 | `POST /compliance/generate` | 1039 | NIE; komenda raportu, brak wykazanej kolizji | brak bezpośredniego wołacza znalezionego w `src/` |

Linie 8–18 przesunęły się o 10 po R2; tabela podaje linie wejściowe z markera.

### Montaż

Żywy plik jest zamontowany dwukrotnie:

- `Gateway.ts:54,744` → `/api/ai-settings`;
- `routes/ai/index.ts:25,64`, przez `Gateway` pod `/api/ai` → `/api/ai/settings`.

To realny duplikat mountu, ale nie znaleziono konsumenta drugiego prefiksu.
Zgodnie z Z40 nie scalano ani nie odmontowywano routera.

## R2 — `GET /effective`

Przed zmianą handler zwracał `res.json(effective)`, czyli płaski i zagnieżdżony
snake_case z serwisu. Po zmianie handler reużywa istniejące
`transformSettingsToCamelCase` i `transformOrgSettingsToCamelCase`; nie powstał
nowy konwerter.

Realny GET przez `ApiGateway` na zasianej organizacji zweryfikował wartości:

- `policyLevel = PROACTIVE`;
- `maxTokensPerMonth = 7654321`;
- `monthlyBudgetUSD = 54.25`;
- `hardLimitUSD = 432.1`;
- `freezeOnLimit = true`.

Te same wartości są w `body.org`; `policy_level` nie występuje ani płasko, ani w
`body.org`.

Ryzyko biznesowe pozostaje niskie, lecz niezerowe: grep potwierdził brak importerów
`useAISettings.ts` i brak wołania `Api.getAIEffectiveSettings` poza definicją.
`aiContextBuilder.ts:220` jest żywy, ale woła `AISettingsService.getEffectiveSettings`
bez HTTP; `AIPipeline.ts:1608-1630` czyta dual-key tylko dla czterech pól użytkownika.
Zmiana trasy HTTP nie zmienia tego serwerowego łańcucha.

## R3 — realdb superadmin

Nowy plik `tests/integration/superadmin-ai-settings-camelcase.realdb.test.ts`:

- wywołuje `assertRealPostgresTestEnvironment()` bez argumentów i bez przypięcia nazwy bazy;
- montuje `ApiGateway.getInstance().initializeRoutes(app)`;
- podpisuje JWT tym samym `JWT_SECRET`, który dostaje proces testowy;
- zasiewa `superadmin_ai_settings` surowym SQL;
- porównuje GET camelCase z zasianymi wartościami;
- wykonuje PUT camelCase, niezależny GET i surowy SQL;
- dowodzi pary uprawnień: OWNER dostaje 403 bez zmiany, SUPERADMIN nadal dostaje 200.

### Dowód mutacyjny Z32

Mutacja: wyłącznie w GET `/superadmin` zamieniono
`res.json(transformSettingsToCamelCase(settings))` na `res.json(settings)`.

```text
mutacja RED: 4 testy, 1 PASS, 3 FAIL
- ODCZYT ... camelCase — FAIL
- para ZAPIS ... niezależny GET — FAIL
- para UPRAWNIEŃ ... superadmin nadal działa — FAIL
```

Po przywróceniu pliku przez `cp` z katalogu scratch porównanie z kopią GREEN było
identyczne; końcowy pakiet dał 7/7 PASS. W diffie produktu pozostała wyłącznie zmiana
handlera `GET /effective`.

### Osobne znalezisko świeżego schematu

Pełne migracje nie tworzą tabeli `ai_settings_audit`, mimo że
`aiSettingsService.ts:85` próbuje do niej pisać. Log realnego PUT zawiera
`relation "ai_settings_audit" does not exist`. Zapis ustawień i niezależny readback
pozostają skuteczne, ponieważ warstwa DB raportuje błąd bez przerwania handlera.
Nie zmieniono migracji ani serwisu — brak licencji. Trwałość śladu audytowego tego PUT
jest **NOT_PROVEN / EVIDENCE_MISSING** i wymaga osobnego zamówienia.

## R4 — sprostowanie

Na końcu `docs/program/grafika/ZAPIS_USTAWIEN_AI_20260901.md` dopisano sekcję
wyjaśniającą, że cytowany plik bez prefiksu `ai/` nie istnieje na markerze, a żywy
plik ma transformację superadmina. Istniejącej treści ani nagłówkowego werdyktu nie
zmieniono.

## Testy i zasięg pełnymi nazwami

Komenda końcowa (w jednej linii env) zawierała:
`RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true
ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6240/cx250
JWT_SECRET=cx250-test-secret-do-not-reuse ... --retry=0 --reporter=json`.

Przed: trzy pełne nazwy pakietu org. Po: te same trzy plus cztery nowe pełne nazwy
superadmin/effective; żadna nazwa nie zniknęła. Dokładny diff:
`/private/tmp/cx-day250-ai-ustawienia-rodzina-artefakty/nazwy.diff`.

Pułapki Z33:

- `DB_TYPE=postgres` jest asertowane w `beforeAll`, a log zawiera
  `DB_IDENTITY ... 127.0.0.1:6240/cx250`;
- `ENABLE_TEST_AUTH_BYPASS=false` wymusza realne `verifyToken`;
- `ENABLE_V8_GLOBAL=true` usuwa fałszywe 404 przed auth;
- `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` ustawiono, choć ta trasa nie
  korzysta z bramki Results;
- test idzie przez realny `ApiGateway`, nie przez goły router;
- `--retry=0` oraz `NO_RETRY = { retry: 0 }`.

Hashy SHA-256:

```text
f205a5f65cc03b5db2a1a8e5a74f210314f6528fc87f39389f8e5f1c2e8464dc  przed.json
450d6d4b8d5ace375fcdccc3843c5faffb4df9e0fc48cf092ab43fbf5bc7aca7  po.json
ddbce702e2840b89b80c402804b653e30f2f77058f8eede9b48bfc5737b64c9f  mutacja-red.json
6a3fb01f990efe215e3f881994c5780d6a8ac1198eaf27d31cb966e0a3be4ff6  przed-nazwy.txt
a05c414d3e47400b02b449ca158f857e362e66c4535b614727956a5d24c424d9  po-nazwy.txt
a6dad5add5b2995e3e17777d17650162f0b465037b106d8510cd458ed51585b1  nazwy.diff
```

## Z30 — brak wysyłki

`env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)"` zwrócił
`BRAK ZMIENNYCH POCZTY`. Zapytanie do lokalnej tabeli `settings` o `smtp%`
zwróciło 0 wierszy. `Gateway.ts` nie zawiera montażu drenaży.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera
wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu
outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano, czy drugi prefix `/api/ai/settings` ma zewnętrznych klientów poza
  repozytorium; w `src/` nie znaleziono takich wywołań.
- Nie zweryfikowano realnej trwałości `ai_settings_audit`; świeży schemat nie ma tej
  tabeli i log pokazuje błąd.
- Nie uruchamiano modelu językowego, Railway, demo, stagingu ani produkcji.

## Korekty wobec instrukcji

1. Instrukcja nazywa `ai-settings-api.test.ts` ochroną „REAL_CODE”; pomiar potwierdził,
   że test mockuje `dbGet` i nie dowodzi HTTP ani PostgreSQL.
2. Podwójny mount jest faktyczny, lecz nie znaleziono w repo konsumenta
   `/api/ai/settings`; bez pomiaru klientów zewnętrznych nie uznano go za bezpieczny do
   usunięcia.
3. Nie wykazano dodatkowej kolizji nazw dla tras 8–18. Brak transformacji sam w sobie
   nie został nazwany defektem.
4. Instrukcja mówi o pięciu powodach STOP całego dyżuru; żaden nie wystąpił.
