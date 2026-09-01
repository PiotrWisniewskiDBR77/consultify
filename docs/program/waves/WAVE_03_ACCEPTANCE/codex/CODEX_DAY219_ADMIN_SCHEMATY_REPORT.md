# CODEX DAY 219 — Admin: Billing, SCIM i nawigacja

Data: 2026-09-01  
Marker: `9fb7942a01`  
Gałąź: `codex/day219-admin-schematy-20260901`  
Werdykt: `FIXED_LOCAL / REALPG_API_MUTATION_VERIFIED / OWNER_REVIEW_PENDING`

## Baza pracy i rozjazd tipa

Wynik markera, dosłownie:

```text
MARKER OK
```

Wynik sanity, dosłownie:

```text
9fb7942a0117aaf4001836f00bf8bbdc4e717669
```

`status --short | head -3` nie zwrócił żadnej linii. Tip
`github-backup/codex/m03-admin-20260824` był sześć commitów przed markerem;
zmiany między markerem i tipem dotyczyły wyłącznie dokumentów pomiarowych,
instrukcji 218–232 oraz znaleziska Gamma. Zgodnie z `DEC-2026-08-26-95`
dyżur wystartował dokładnie z markera, bez rebase.

Przed pierwszym commitem remote
`github-backup/codex/day218-admin-polityki-20260901` nie istniał, więc nie było
mierzalnej kolizji w `adminP32.routes.ts`. Zakres zapisu pozostał ograniczony do
`readBillingInvoices` i jego handlera; `readAiSummary` nie został dotknięty.

## Wynik R1 — Billing

- Pełny łańcuch przed zmianą potwierdził na żywym PostgreSQL, że z zapytania
  faktur brakuje wyłącznie `issue_date`; pozostałe kolumny istnieją.
- Migracja `20260936_admin_invoices_issue_date_column.sql` dodaje kolumnę
  addytywnie, ustawia `DEFAULT CURRENT_TIMESTAMP` i backfilluje istniejące
  wiersze z `created_at`. Default jest konieczny: pięć zmierzonych ścieżek
  `INSERT INTO invoices` nie podaje `issue_date` jawnie.
- `ADD COLUMN IF NOT EXISTS` został wykonany dwukrotnie na tabeli próbnej w
  PostgreSQL 16; drugi przebieg zwrócił `NOTICE ... already exists, skipping`.
- `readBillingInvoices` używa teraz `fallback:false` i rozróżnia poprawny pusty
  wynik (`status: ok`) od błędu zapytania (`status: unavailable`). Front nie
  pokazuje już awarii jako „brak faktur”, tylko osobny stan niedostępności.
- Realny `ApiGateway` + podpisany JWT + `verifyToken` + tenant fixture +
  PostgreSQL zwróciły zapisaną fakturę i `status: ok`. Po mutacji polegającej
  na usunięciu kolumny odpowiedź miała `status: unavailable` i pustą listę.
- Mutacja kodu `fallback:false -> fallback:true` dała `2/3 PASS, 1/3 FAIL`
  dokładnie na teście rozróżnienia awarii; po przywróceniu `3/3 PASS`.
- UI nadal pokazuje `due_date`, nie `issue_date`. Nie zmieniono tej decyzji
  produktowej poza zakresem naprawy schematu.

## Wynik R2 — SCIM

- Pełny łańcuch przed zmianą potwierdził brak `organization_id` dokładnie w
  `scim_group_mappings` i `scim_sync_logs`. `scim_tokens` oraz
  `scim_conflict_log` miały tę kolumnę i zapytania działały.
- Migracja `20260937_admin_scim_organization_id_backfill.sql` dodaje obie
  kolumny oraz indeksy tenantowe. Migracja jest właściwsza niż `hasColumn`:
  `organization_id` jest obowiązkową granicą bezpieczeństwa, a nie opcjonalnym
  wymiarem jak `project_id`.
- Backfill historycznych wierszy jest niemożliwy bez źródła tenant identity;
  pozostają uczciwie `NULL`. Dodatkowy pomiar wykazał istniejące ścieżki
  `INSERT` w `server/src/routes/integrations/scim.routes.ts`, które nie wpisują
  `organization_id`. To aktywny dług poza licencją tego dyżuru, nie teoretyczny.
- Para dowodowa przez realny `ApiGateway`: mapping `org-A` był widoczny dla
  właściciela, mapping `org-B` niewidoczny. Usunięcie kolumny z
  `scim_group_mappings` czerwieniło pakiet; po przywróceniu kolumny i indeksu
  pakiet wrócił do `3/3 PASS`.

## Wynik R3 — globalny breadcrumb Admina

- Osiem odrębnych etykiet ma jedno źródło w `ADMIN_SECTION_TITLES` i klucze
  `sidebar.adminSection.*` z parytetem PL/EN. Alias `members` świadomie używa
  klucza `people`, więc dziewięć selektorów mapuje osiem pojęć.
- Łańcuch osiągalności jest produkcyjny: `AppRoutes.tsx:915` wywołuje hook, a
  `AppRoutes.tsx:1075` przekazuje wynik do `MainLayout`.
- Zmierzono wszystkie osiem ścieżek `/admin/*`: w PL żadna nie zwraca jednego
  z ośmiu angielskich literałów, a w EN wszystkie zachowują angielski wariant.
  Wynik `16/16 PASS`.
- Mutacja jednego klucza Overview dała `15/16 PASS, 1/16 FAIL`; po cofnięciu
  `16/16 PASS`.
- `ADM-OWN-001` nie został zmieniony: struktura, liczba i kolejność sekcji
  Admina pozostały identyczne.

## Migracje i zasięg nazw

Przed zmianą produktu pełny pakiet `adminP32.routes.test.ts` odkrył 30 pełnych
nazw: `29 PASS, 1 zastany FAIL` (`does not let SUPERADMIN with an ACTIVE MEMBER
membership bypass health tenant authority`). Po zmianie ten sam przypadek
pozostał jedynym zastanym błędem w tej suicie.

Nowe pakiety dodały 19 pełnych nazw: 3 RealPG/API oraz 16 i18n. Nie zniknęła
żadna nazwa. Diff: `/private/tmp/cx-day219-admin-schematy-artefakty/nazwy.diff`.

Pełny runner migracji po dodaniu plików:

```text
Applying migrations: 2
→ 20260936_admin_invoices_issue_date_column.sql
→ 20260937_admin_scim_organization_id_backfill.sql
✅ Postgres migrations complete
Applying migrations: 0
✅ Postgres migrations complete
```

## Pułapki środowiska i bezpieczeństwo

- RealPG biegł wyłącznie z kompletem env w tej samej linii: `RUN_DB_TESTS=1`,
  `MOCK_DB=false`, `DB_TYPE=postgres`, `NODE_ENV=test`,
  `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`,
  `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, jawny `DATABASE_URL`
  na `127.0.0.1:6162`, `JWT_SECRET` i `--retry=0`.
- Test asercjonuje `DB_TYPE=postgres`; `assertRealPostgresTestEnvironment()`
  został wywołany bez argumentów. Dowód HTTP montuje
  `ApiGateway.getInstance().initializeRoutes(app)`.
- Pułapka `fallback:true` z `DbPromise.all()` została wyłączona w Billing przez
  `fallback:false`; mutacja potwierdziła, że bez tego błąd znów udaje pustkę.
- SCIM testuje stan po pełnym łańcuchu migracji, a nie ad-hoc `CREATE TABLE IF
NOT EXISTS`, które było no-opem na istniejących tabelach.

Deklaracja testowa, dosłownie: **Nie ustawiłem żadnej zmiennej SMTP ani flagi
wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie
uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani
zaproszenie kalendarzowe nie zostało wysłane.**

## Artefakty

Artefakty leżą wyłącznie poza repo:
`/private/tmp/cx-day219-admin-schematy-artefakty`. Manifest hashy:
`/private/tmp/cx-day219-admin-schematy-artefakty/SHA256SUMS`.

Najważniejsze SHA-256:

- final RealPG green po formatowaniu: `9931a0ffab37c41966d8c23103db1f3a036055e4014a61f2424984b24a073350`
- Billing mutation red: `357c7d94e3e7443cee3636c242fbc8dc77dfe14cd0decc8566edeac0472ec0b`
- breadcrumb final green po formatowaniu: `82939b2290f6d20a97c46de5485b8202d848f144de073bf2aabc8c40f9137794`
- breadcrumb mutation red: `df020ff0b75bb0d0f8ddfc891bb311cced0999c77ee3ba265e32347d64c355be`
- SCIM mutation red: `415cdbb096b3c20eaf4cc6653d225793f9633a1a262aeae3f1689cd678aabe2c`
- diff nazw: `67b2aa72145c1a07e8a01c8a7b85ec786f0bbd185edd5e79a42e81d2a909b321`

## Korekty wobec instrukcji

1. Instrukcja mówi o „ośmiu wpisach” mapy. Pomiar wykazał dziewięć kluczy,
   ponieważ `people` i `members` są aliasami tej samej etykiety; nadal istnieje
   dokładnie osiem odrębnych etykiet.
2. `R2a` sugeruje, że brak writerów uczyni dług backfillu teoretycznym. Pomiar
   znalazł dwa writery w `integrations/scim.routes.ts`, oba bez tenant identity;
   dług jest aktywny i został jawnie zachowany poza licencją.
3. Podany przykład jednej komendy Vitest miesza test serwerowy i frontendowy.
   Zgodnie z ostrzeżeniem instrukcji użyto `server/vitest.config.ts` z cwd
   `server/` dla testów serwerowych oraz root configu dla testu hooka. Próby z
   niewłaściwą ścieżką odkryły zero testów i nie zostały policzone jako PASS.

## TWIERDZENIA NIEZWERYFIKOWANE

- Potwierdzono na żywym PostgreSQL, że jedyną brakującą kolumną zapytania
  faktur jest `issue_date`; nie przepisano tego z instrukcji.
- Potwierdzono na żywym PostgreSQL dokładnie dwie z czterech tabel SCIM bez
  `organization_id`; nie założono wszystkich czterech.
- Sprawdzono writery SCIM; istnieją i nie ustawiają tenant identity.
- `R1c` zaimplementowano i zweryfikowano mutacyjnie; nie zastosowano STOP-u.
- Zmierzono osiągalność wszystkich ośmiu etykiet przez ścieżki `/admin/*` oraz
  realne przekazanie breadcrumbów w `AppRoutes` do `MainLayout`.
- Kolizję z dyżurem 218 sprawdzono przed pierwszym commitem; jego gałąź nie
  istniała wtedy na `github-backup`. Nie można wykluczyć późniejszego pushu
  dyżuru 218, dlatego nadzorca nadal musi scalić rozłączne hunki ostrożnie.
- Nie wykonano odbioru wizualnego w kanonicznym runtime ani zrzutów; R3 ma
  dowód hook/DOM, ale Owner review pozostaje otwarty.
- Nie naprawiono writerów `integrations/scim.routes.ts`, ponieważ plik był poza
  licencją. Nowe wiersze z tych ścieżek nadal mogą mieć `organization_id IS NULL`.
