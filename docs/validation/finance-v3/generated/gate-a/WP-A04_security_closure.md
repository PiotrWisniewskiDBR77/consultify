# WP-A04 — zamknięcie incydentu bezpieczeństwa (dostęp lokalnego runtime do produkcyjnej bazy)

Data: 2026-08-09
Gałąź: `codex/finance-v3-gate-a-20260809` (świeża z `origin/demo`, worktree `/private/tmp/finance-v3-gate-a-20260809`)
Wykonawca: agent (weryfikacja statyczna, zero połączeń DB w trakcie pracy)

## 0. WAŻNE ZASTRZEŻENIE — źródła nie istnieją na `origin/demo`

Zanim przejdę do meritum: **żaden z dwóch dokumentów wskazanych jako punkt wejścia nie istnieje
w tym repo, w żadnej gałęzi**, sprawdzone przez:

```
git log --all --oneline --diff-filter=A -- '*FINANCE_IMPLEMENTATION_MASTER_PLAN*'   → pusto
git log --all --oneline --diff-filter=A -- '*OWNER_REVIEW_REGISTER*'                → pusto
grep -rln "OWN-FIN-009\|OWN-FIN-010" . --include="*.md"                             → pusto
```

Sprawdzone również na gałęziach powiązanych z Finance (`codex/finance-recovery-20260807`,
`codex/finance-demo-readiness-20260808`, `codex/recovery-finance-20260808` i ich odpowiedniki
`remotes/origin/*`) — katalog `docs/validation/finance-v3/` tam istnieje, ale bez pliku
`FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md` ani `OWNER_REVIEW_REGISTER_2026-08-09.md`.
Identyfikatory zgłoszeń `OWN-FIN-009`/`OWN-FIN-010` nie występują w repo w ogóle.

**Traktuję to jak każdy inny martwy/fałszywy audyt z historii tego projektu — nie ufam
zawartości, sprawdzam wyłącznie realny kod na `origin/demo`.** Poniżej wynik tej weryfikacji
i domknięcie zrobione na podstawie samego kodu, niezależnie od tego, czy opisany „incydent"
rzeczywiście miał miejsce w tej formie.

## 1. Co znaleziono na `origin/demo` — istniejące zabezpieczenia (częściowe, inny cel)

`server/src/config/databaseTargetResolver.ts` + `server/src/config/DatabaseConfig.ts` już
zawierały dwa guardy uruchamiane na starcie serwera (przy pierwszym dostępie do
`databaseConfig.postgres`, czyli w praktyce przy budowie `Pool` w
`server/src/database/PostgresDatabase.ts`):

- `assertNoLocalDatabaseOutsideTests` — **odwrotny kierunek** niż potrzebny: blokuje
  `localhost`/`127.0.0.1` jako cel, wymuszając zewnętrzny Postgres (Railway) nawet lokalnie.
  Nie chroni przed tym, że ten zewnętrzny URL wskazuje na PRODUKCJĘ.
- `assertNoPrivateRailwayDbHostOutsideRailway` — blokuje prywatny host `*.railway.internal`
  poza Railway (kwestia osiągalności sieciowej, nie tożsamości środowiska).

**Żaden z nich nie odróżniał hosta produkcyjnego od demo/staging/dev.** Innymi słowy: kod
już wymuszał „połącz się z prawdziwym, zewnętrznym Postgresem" (co jest architekturą
świadomą — patrz `.env.staging.local.example`: „Usage: npm run dev:staging"), ale nic nie
stało na przeszkodzie, żeby ten zewnętrzny URL był connection stringiem produkcyjnym
skopiowanym do lokalnego `.env` — dokładnie wzorzec opisany w zadaniu (localhost:3000 →
zdalna produkcja).

Mechanizm z OWN-FIN-010 („read-only staging, wyjątek tylko dla lifecycle refresh_tokens")
**nie istnieje w kodzie** — grep za `read-only`/`readOnly`/`READ_ONLY`/`PRODUCTION_GUARD`
w `server/src/config`, `server/src/database`, `server/src/middleware` nie zwrócił nic
pasującego do takiego mechanizmu (trafienia na `readOnly` w innych plikach middleware
dotyczą niepowiązanych funkcji, nie DB-level read-only enforcement).

Osobna, least-privileged rola DB dla local/staging: **nie znaleziono** żadnego
`CREATE ROLE`/`GRANT` w migracjach ani skryptach setupowych, które tworzyłyby dedykowaną,
ograniczoną rolę do użytku lokalnego (poza dwoma niepowiązanymi trafieniami w migracjach
o innym kontekście). To pozostaje otwarte — wymaga działania na poziomie samej bazy
(Railway/Postgres), którego celowo NIE wykonuję w tej sesji (żadnych połączeń DB).

## 2. Co zaimplementowano

Nowy fail-closed guard: **host produkcyjnej bazy jest teraz blokowany na starcie serwera,
chyba że proces może udowodnić (przez natywne zmienne Railway), że jest realną usługą
produkcyjną.**

Plik: `server/src/config/databaseTargetResolver.ts` (rozszerzony, nie nowy plik) — sekcja
„WP-A04 — production database fail-closed guard":

- `getProductionDatabaseHostFingerprints(env)` — domyślna, wbudowana lista fingerprintów
  hosta produkcyjnego (patrz §3 — redakcja), rozszerzalna (nigdy zawężalna) przez
  `PRODUCTION_DB_HOST_DENYLIST_EXTRA` (comma-separated).
- `isKnownProductionDatabaseHost(host, env)` — dopasowanie substring, case-insensitive.
- `isVerifiedProductionRuntime(env)` — `true` **tylko** gdy proces działa wewnątrz Railway
  (`RAILWAY_SERVICE_ID`/`RAILWAY_ENVIRONMENT_ID`) **i** `RAILWAY_ENVIRONMENT_NAME === 'production'`.
  Świadomie NIE ufa `NODE_ENV`/`APP_ENV` — to właśnie one są kopiowane razem z connection
  stringiem przy incydencie tego typu, więc nie mogą być dowodem.
- Wąski, jawny wyjątek awaryjny: `PRODUCTION_DB_OVERRIDE_ACK=i-understand-this-is-production`
  (dokładna fraza, nie samo `true` — nie da się go „przypadkiem" ustawić).
- `assertNoProductionDatabaseOutsideVerifiedRuntime(env)` — punkt wejścia dla ścieżki
  `DB_HOST`/`DB_PORT`, dodatkowo re-sprawdza `DATABASE_URL` (defense in depth).
- Guard wpięty też w `assertResolvedDatabaseUrlIsReachable(...)` — czyli pokrywa **obie**
  ścieżki resolvera: `DATABASE_URL` i fallback `DATABASE_PUBLIC_URL`/`FINANCE_IMPORT_DATABASE_URL`.

### Realne wpięcie w start serwera (nie martwy plik)

`server/src/config/DatabaseConfig.ts` — `assertNoProductionDatabaseOutsideVerifiedRuntime(process.env)`
dodane obok istniejących asercji w **obu** miejscach, gdzie już wcześniej były wywoływane
(`getDatabaseType()` i `getPostgresConfig()`), w tym samym bloku `try { ... } catch { logger.error(...); process.exit(1); }`.

Ścieżka wykonania potwierdzona czytaniem kodu (bez uruchamiania):
`server/src/database/PostgresDatabase.ts` robi `import databaseConfig from '../config/DatabaseConfig.js'`
i odwołuje się do `databaseConfig.postgres` już przy budowie configu poola (linia ok. 451,
przed `new Pool(effectiveConfig)` w linii 462). `databaseConfig` to `Proxy`, którego `get`
trap wywołuje `getDatabaseConfig()` → `loadDatabaseConfig()` → `getDatabaseType()` +
`getPostgresConfig()` przy **pierwszym** dostępie do dowolnej właściwości. Czyli guard
odpala się zanim jakiekolwiek połączenie TCP do Postgresa zostanie w ogóle otwarte, i
kończy proces (`process.exit(1)`) zamiast pozwolić na próbę połączenia.

## 3. Redagowany fingerprint środowiska (bez sekretów)

Zgodnie z zasadą „nie loguj/nie zapisuj prawdziwych connection stringów": poniżej tylko
host:port bez usera/hasła, i tylko to, co już jest udokumentowane w tym repo (np.
`docs/qa/deliverables/AUDIT_2026-06-23.md`: „Prod (centerbeam) go-live... NIGDY centerbeam").

| Rola      | Host (fragment, bez sekretów) |
|-----------|--------------------------------|
| Produkcja | `centerbeam...:37823` — **zablokowany domyślnie** przez nowy guard poza zweryfikowanym Railway production |
| Demo/staging | inny host Railway (np. „trolley") — dozwolony |
| Dev | inny host Railway (np. „thomas") — dozwolony |

Żadne rzeczywiste hasło/login nie zostały odczytane, zalogowane ani zapisane w tej sesji.

## 4. Testy

`server/src/config/__tests__/databaseTargetResolver.test.ts` — 22 testy jednostkowe,
**czysta logika string/boolean, zero połączeń sieciowych/DB**. Pokrywają:
fingerprint hosta produkcyjnego (case-insensitive, rozszerzalność listy), weryfikację
runtime (Railway + `production` vs. sam `NODE_ENV=production` jako fałszywy dowód — to
dokładnie kształt incydentu), blokadę dla `DATABASE_URL`/`DB_HOST`/`DATABASE_PUBLIC_URL`,
przepuszczenie hostów demo/dev, działanie i granice override'u.

Weryfikacja wykonana lokalnie w tej sesji (symlink do `node_modules` głównego repo,
usunięty po teście — nic nie zostało w worktree):
- `vitest run server/src/config/__tests__/databaseTargetResolver.test.ts` → **22/22 PASS**, 129ms.
- `esbuild` (bundlecheck) obu zmienionych plików → bez błędów.
- `tsc --noEmit` (scoped do 3 plików) → bez błędów.

Żadna z tych komend nie otworzyła połączenia do bazy danych — to była wyłączna kontrola
statyczna, zgodnie z twardym zakazem na start zadania.

## 5. Dokumentacja

`.env.example` — dopisany krótki blok wyjaśniający guard WP-A04 i dwie nowe zmienne
(`PRODUCTION_DB_HOST_DENYLIST_EXTRA`, `PRODUCTION_DB_OVERRIDE_ACK`).

## 6. Co pozostaje otwarte (poza zakresem tej sesji, wymaga dostępu do żywej bazy)

1. **Least-privileged rola DB dla local/staging** (punkt 3 zlecenia) — nie istnieje w
   kodzie/migracjach. Wymaga pracy na infrastrukturze Postgres/Railway (`CREATE ROLE`,
   `GRANT`), nie samego repo — celowo nie wykonane w tej sesji.
2. Mechanizm „read-only staging z wyjątkiem lifecycle refresh_tokens" z OWN-FIN-010 —
   źródło (OWN-FIN-010) nie istnieje w repo, więc nie było z czego odtworzyć wymagań;
   jeśli Piotr potwierdzi że taki wymóg istnieje realnie, potrzebna osobna specyfikacja.
3. Fingerprint hosta produkcyjnego jest statyczny (`centerbeam`) — jeśli Railway kiedyś
   zrotuje nazwę proxy dla produkcji, trzeba dopisać nowy fingerprint przez
   `PRODUCTION_DB_HOST_DENYLIST_EXTRA` (lub do stałej w kodzie) — guard tego nie wykryje
   automatycznie.

## 7. Status

**PARTIAL → domknięcie punktu „fail-closed guard przeciw localhost→produkcja" (CLOSED),
punkt „least-privileged rola DB" pozostaje OPEN (poza zakresem repo).**

Podsumowując pytanie z zadania: guard **nie istniał** na `origin/demo` (istniały tylko
guardy o innym celu — osiągalność sieciowa, nie tożsamość środowiska). Zaimplementowano
go w tej sesji, wpięto w realną ścieżkę startu serwera, dodano test jednostkowy bez
połączeń z bazą.
