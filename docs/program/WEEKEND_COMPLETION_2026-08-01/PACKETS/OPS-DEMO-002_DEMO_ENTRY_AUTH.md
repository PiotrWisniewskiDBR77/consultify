---
doc_id: OPS-DEMO-002
truth_type: operations
status: READY_FOR_STAGING
owner: codex
product_owner: piotr
priority: P0
depends_on: OPS-DEMO-001
last_reviewed: 2026-08-01
---

# OPS-DEMO-002 — publiczne wejście do demo

## Próba stagingowa 2026-08-01

Na `https://demo.consultify.ai` publiczne CTA `Try demo` prawidłowo otwiera modal
`Experience Consultify Demo`, ale logowanie kanonicznymi kontami wskazanymi w kodzie
zwraca `Invalid email or password`:

- `piotr.wisniewski@demo.com`;
- `anna.zielinska@ateliertoys-demo.com`.

Istniejące konto administratorskie `piotr.wisniewski@dbr77.com` pozwoliło wejść do
`Demo Mode · Atelier Toys`, dlatego dalszy odbiór techniczny był możliwy. Nie jest to
jednak poprawna ścieżka wejścia użytkownika/prospekta.

Dodatkowo `isQuickAccessShortcutHost()` nie klasyfikował `demo.consultify.ai` jako
stagingu (`stage.*` i `staging.*` były obsłużone, `demo.*` nie), więc przewidziane
skróty testowe nie były dostępne na docelowej domenie odbiorowej.

## Werdykt pierwotny

**NO-GO dla publicznego Try demo.** Ochrona tras prywatnych działa, ale obiecana ścieżka
wejścia do seedowanego workspace nie działa znanymi danymi dostępowymi.

## Slice 1 — host allowlist (zaakceptowany, rewizja `c522a86183`)

- `demo.consultify.ai` w jawnej allowliście hostów stagingowych;
- resolver PIN-u odrzuca każdy host spoza allowlisty;
- produkcyjne `consultify.ai` dopuszcza wyłącznie istniejący skrót `1111`;
- testy host allowlist / obcy host / produkcja: `3/3 PASS`.

## Slice 2 — publiczna ścieżka wejścia (gałąź `fix/ops-demo-002-public-entry`)

### Przyczyna źródłowa

Publiczne `Try demo` nie było zepsute „gdzieś w UI” — łamały je cztery niezależne
defekty w `POST /api/auth/register-demo`:

1. **Rozjazd normalizacji adresu (bloker właściwy).** Rejestracja zapisywała
   `users.email` w postaci surowej (`String(email).trim()`), a `AuthController.login`
   szuka konta przez `WHERE email = ?` na adresie **już zmałolitrowanym**. Każde
   zgłoszenie z wielką literą tworzyło konto, które nigdy się nie zaloguje. Ponownej
   rejestracji broniła kontrola duplikatu, która jest `LOWER(email) = LOWER(?)` —
   czyli adres zostawał martwy na stałe. To dokładnie objaw ze stagingu: „konto jest,
   ale hasło nie pasuje”.
2. **Brak sesji demo.** `register-demo` ustawiał tylko preferencję `demo:enabled`; nie
   powstawał wiersz `demo_sessions` i odpowiedź nie zawierała identyfikatora tenanta.
   Klient nie miał czego wysłać w `X-Demo-Session-Org`, więc backend degradował
   każde zgłoszenie do **wspólnej** kuratorowanej organizacji bazowej.
3. **Nadmiarowa rola.** Publiczne zgłoszenie dostawało `ADMIN` w organizacji demo
   (i taki sam wpis w `organization_members`), czyli wstęp do pasa administracji
   organizacji (`adminP32` wpuszcza `OWNER`/`ADMIN`).
4. **Wyciek istnienia konta.** Duplikat adresu zwracał `400 EMAIL_IN_USE`
   z komunikatem „Email already in use”, a modal na ten kod **po cichu logował się**
   wpisanym hasłem. Publiczny endpoint był jednocześnie wyrocznią istnienia konta
   i wygodnym narzędziem do sprawdzania haseł.

### Kanoniczna ścieżka publiczna (rozstrzygnięcie)

Wybrano **izolowany `register-demo`**, nie wspólnego read-only tenanta. Podstawa
w istniejącym SSOT — decyzja nie wymaga `NEEDS_PRODUCT_DECISION`:

- `docs/DEMO_MODE.md` §Data model: „Demo data is stored in **isolated session
  organizations** created from the Atelier Toys template… demo sessions expire
  automatically and are cleaned up”;
- `demoSessionService` implementuje ten model od dawna (`demo_sessions`,
  `demo_session_tenants`, TTL 24 h);
- wariant wspólny pozostaje dostępny jako **jawnie włączany** tryb prezentacyjny
  `DEMO_USE_BASE_ORG=true` i nadal działa bez zmian.

Kontrakt:

```
Landing „Try demo”
  → DemoModeModal (zakładka Sign up)
  → POST /api/auth/register-demo
      → konto (rola TEAM_MEMBER, org macierzysta = DEMO_ORG_ID)
      → resolveOrCreateDemoSession(source='register_demo')  ← izolowany tenant + seed
      → { user, token, refreshToken, isDemo, demoSession }
  → klient zapisuje demoSession.organizationId jako demoSessionOrgId
  → każde żądanie niesie X-Demo-Mode + X-Demo-Session-Org
  → /chat na danych Atelier Toys
```

Ścieżka wtórna dla powracającego prospekta: `POST /api/auth/login`
→ `POST /api/demo/toggle {enabled:true}` → ten sam kontrakt sesji.
Anonimowe `/demo-login` pozostaje `410` poza test gateway i **nie jest przywracane**.

### Model tenancy

| Warstwa | Wartość | Kto ją pilnuje |
| --- | --- | --- |
| Organizacja macierzysta konta demo | `DEMO_ORG_ID` (kuratorowana, nigdy nie kasowana) | `users.organization_id` |
| Tenant roboczy sesji | `${DEMO_ORG_ID}-session-<user>-<ts>` | `demo_sessions` + nagłówek `X-Demo-Session-Org` |
| Walidacja właściciela tenanta | zapytanie po `user_id` **i** `session_org_id` | `resolveValidatedDemoSessionOrgId`, `attachUser` |
| Zapisy | zablokowane globalnie dla org demo | `demoWriteProtection` (`403 DEMO_READ_ONLY`) |

Konto A podające `X-Demo-Session-Org` konta B nie trafia do B — walidacja nie
potwierdza własności, więc kontekst degraduje do organizacji bazowej. Pokryte testem
negatywnym.

### Rola i uprawnienia

`TEAM_MEMBER`, nie `ADMIN`. Demo jest read-only z definicji, więc najmniejsza rola,
która nadal przegląda wszystkie moduły, jest właściwa. Snapshot dostępu
(`accessPolicyService`) zależy od planu organizacji, nie od roli, więc obniżenie roli
nie ukrywa modułów. Test bramkowy sprawdza, że rola nie należy do
`{SUPERADMIN, SUPER_ADMIN, OWNER, ADMIN}` i że token demo nie wchodzi na
`/api/superadmin/*`.

### Cykl życia, retry i recovery

- **TTL**: 24 h (`DEMO_SESSION_DURATION_MS`), wygasanie i sprzątanie po stronie
  `cleanupExpiredDemoSessions` przy każdym `/api/demo/toggle` i `/api/demo/status`.
- **Idempotencja**: gdy seed padnie, `register-demo` **kasuje właśnie utworzone konto**
  i zwraca `503 DEMO_SEED_UNAVAILABLE`. Bez tej kompensacji adres zostałby zajęty
  przez konto bez workspace i każda kolejna próba wracałaby z konfliktem.
- **Duplikat**: `409 DEMO_SIGNUP_UNAVAILABLE` z komunikatem identycznym dla adresu
  znanego i nieznanego.
- **Cleanup operatorski**: `server/scripts/cleanup-orphan-demo-orgs.ts` — dry-run
  domyślnie, `--apply` wymaga `FORCE_PURGE=true`, backup JSON przed usunięciem,
  odmowa na hoście produkcyjnym. Poprawki w tym pakiecie:
  - wzorzec liczony z `DEMO_ORG_ID` (`${DEMO_ORG_ID}-session-%`) zamiast twardego
    `demo-org-session-%` — przy `DEMO_ORG_ID=atelier` stary wzorzec nie trafiał w nic
    i raportował „już czysto”, gdy organizacje przyrastały;
  - odmowa, gdy wzorzec obejmie samą organizację bazową;
  - pomijanie organizacji z **aktywną, niewygasłą** sesją (`--include-active` aby
    wymusić) — inaczej narzędzie potrafiło skasować workspace prospekta w trakcie demo.
- **Rollback kodu**: `git revert` commitów gałęzi; nie ma migracji ani zmian schematu.

### Komunikaty publiczne

Trzy klasy, bez ujawniania istnienia konta:

| Klasa | Kiedy | Treść |
| --- | --- | --- |
| `invalidCredentials` | zakładka Log in, `401` | `Invalid email or password.` |
| `signupUnavailable` | zakładka Sign up, duplikat **i** każdy inny błąd tworzenia | `We could not start a demo with those details…` |
| `demoUnavailable` | `DEMO_SEED_UNAVAILABLE` / `DEMO_UNAVAILABLE` / `DEMO_NOT_CONFIGURED` | `The demo workspace is temporarily unavailable…` |

Modal nigdy nie renderuje surowego komunikatu backendu i nie loguje się po cichu
w reakcji na duplikat.

## Bramki wykonane lokalnie

| Bramka | Wynik |
| --- | --- |
| `tests/integration/demoPublicEntry.contract.test.ts` (realny Express + realna baza) | `11/11 PASS` (`--retry=0`) |
| Kontrola negatywna: ten sam plik na kodzie sprzed poprawki | `8/11 FAIL` — test faktycznie wykrywa defekty |
| `tests/components/DemoModeModal.public-entry.contract.test.tsx` | `5/5 PASS` |
| Host allowlist (`AuthView.quickAccess` + `quick-access-guard` + `fail-closed-errors`) | `11/11 PASS` |
| Regresja: `trialDemoIntegration`, `auth.test`, `services/demo/__tests__` | `30/30 PASS` |
| Regresja: 5 zestawów CTA/marketing dotykających modalu | `7/7 PASS` |
| `npm run type-check` | PASS |
| `npm run build:backend` | PASS |
| `git diff --check` | PASS |

## Niewykonane świadomie

- **Playwright staging** — `tests/e2e/staging/ops-demo-002-public-entry.staging.spec.ts`
  jest przygotowany i domyślnie pominięty (`OPS_DEMO_002_STAGING=1` + host
  `demo.consultify.ai`). Nie uruchamiany z pasa implementacji: tworzy realne konta
  w bazie `demo`.
- **Deploy, migracja, seed i cleanup na `demo`** — poza mandatem tego pakietu.

## Kroki stagingowe dla Codex

1. Wdrożyć rewizję gałęzi `fix/ops-demo-002-public-entry` na Railway `consultify` /
   environment `demo`; potwierdzić `SUCCESS` i `/ping` = `pong`.
2. Potwierdzić tryb demo: jeśli `DEMO_USE_BASE_ORG=true`, wejście jest wspólne
   i read-only; jeśli nie jest ustawione, każde zgłoszenie dostaje własny seedowany
   tenant (dłuższy pierwszy request — patrz ryzyka).
3. Fixture (namespaced, żadnych realnych osób), hasło generowane na miejscu
   i nigdzie nie zapisywane:
   `ops-demo-002+<runId>-a@fixture.invalid`, `ops-demo-002+<runId>-b@fixture.invalid`.
4. `OPS_DEMO_002_STAGING=1 E2E_BASE_URL=https://demo.consultify.ai npx playwright test tests/e2e/staging/ops-demo-002-public-entry.staging.spec.ts`.
5. Read-back z PostgreSQL `demo`: `users.email` zapisany małymi literami,
   `users.role` = `TEAM_MEMBER`, dwa różne `demo_sessions.session_org_id`.
6. Cleanup — najpierw dry-run, potem apply po akceptacji listy:
   `DATABASE_PUBLIC_URL=… npx tsx scripts/cleanup-orphan-demo-orgs.ts`
   → `DATABASE_PUBLIC_URL=… FORCE_PURGE=true npx tsx scripts/cleanup-orphan-demo-orgs.ts --apply`
   oraz usunięcie kont `ops-demo-002+%@fixture.invalid`.
7. Werdykt `GO / FIX / NO-GO` na podstawie 1–6.

## Ryzyka otwarte

1. **Latencja pierwszego wejścia.** Przy wyłączonym `DEMO_USE_BASE_ORG` seed
   Atelier Toys biegnie synchronicznie w `register-demo`. Na Railway trzeba zmierzyć
   czas odpowiedzi; jeśli zbliża się do limitu bramy, właściwą odpowiedzią jest
   `DEMO_USE_BASE_ORG=true` albo osobny pakiet na seed asynchroniczny.
2. **`resolveQuickAccessCredentials` trzyma realne adresy i hasła w kodzie frontu.**
   Trafiają do bundla przeglądarki. Poza zakresem tego pakietu (nie wolno ruszać
   host guarda), ale to dług bezpieczeństwa do osobnej paczki. `1111` wskazuje na
   `anna.zielinska@ateliertoys-demo.com`, które **nie istnieje** — skrót produkcyjny
   jest martwy.
3. **Ten sam defekt normalizacji adresu istnieje w `POST /api/auth/register`**
   (ścieżka trialowa, `auth.routes.ts`: `INSERT INTO users … [ … email … ]` przy
   loginie szukającym `normalizedEmail`). Nie naprawiono — poza zakresem pakietu.
   Poprawka to podmiana jednego argumentu na `normalizedEmail`; rekomendowany
   osobny pakiet, bo dotyka rejestracji produkcyjnej.
4. **`tests/e2e/demo-flow.spec`** (bez rozszerzenia `.ts`, więc niezbierany) opisuje
   nieistniejący już modal `Experience Consultinity` i wycofane konto demo wpisane
   na sztywno w asercję. Martwy plik do usunięcia w porządkach.
5. **Bramka typów backendu jest ślepa na tej trasie**: `server` buduje się przez
   `tsc --noCheck`, a `auth.routes.ts` ma `// @ts-nocheck`. Dowodem poprawności jest
   tu przechodzący test integracyjny na realnym runtime, nie kompilator.

## Stan

`READY_FOR_STAGING` — kod i testy lokalne gotowe na gałęzi
`fix/ops-demo-002-public-entry`. Bez merge, bez push na `demo`, bez deployu.
Odbiór `GO` wymaga wykonania kroków stagingowych na `https://demo.consultify.ai`.
