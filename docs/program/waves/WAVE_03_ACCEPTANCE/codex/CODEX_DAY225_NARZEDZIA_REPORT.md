# CODEX DAY225 — Narzędzia: komentarz i `GET /api/tool-outputs`

Data: 2026-09-01
Marker: `0a35699021`
Gałąź: `codex/day225-narzedzia-20260901`
Werdykt: `A.1 ZROBIONE / A.2 ZROBIONE / A.3 POTWIERDZONE / OWNER_ACCEPTANCE PENDING`

## 1. Wejście: §0.1 (2) i (7)

`git log --oneline -25 github-backup/codex/m03-admin-20260824` (dosłowny wynik):

```text
a052ae1f7f 224/225/230/232: marker podniesiony po scaleniu 218/219/226/231 + ramka ostrzegajaca ze stan wejsciowy jest nowszy niz tresc instrukcji
0a35699021 odbior 231: SCALONE po FIX-231 — konspekt powstaje Z WIEDZY ORGANIZACJI (para rozstrzygajaca); stempel pochodzenia przestal klamac; zrodla realnie sie dopinaja
b90fc8715d merge: dyzur 231 + FIX-231 — KONSPEKT DECKU POWSTAJE Z WIEDZY ORGANIZACJI
cc3c9ff687 docs(day231): annotate evidence harness fixture with FIX-2 status
c72fcd2af3 test(day231/FIX-5): prove clear error instead of bare 500, flag gate
7a47abf44e test(day231/FIX-4): prove projectId ownership check, mutation-verified
c94415bd73 fix(day231/FIX-2+FIX-3): fix dead source filter, cover fail-closed guard
d613a2a3c3 fix(day231/FIX-1): stamp deck provenance from FACT, not flag echo
5ad2e203fd odbior 226: SCALONE (A-)
3621ec07ba merge: dyzur 226
2d58d0b036 merge: dyzur 219
bb22ae8cb5 merge: dyzur 218
7e3bc87337 docs(day231): report measured evidence and unresolved content gate
180c86b1c4 docs(admin): record day 219 evidence
b93910bc69 fix(admin): localize global breadcrumbs
99bdc944be fix(admin): make AI policy summary states honest
24a2da92f4 fix(admin): repair billing and SCIM schemas
2c7e7a6bee test(day231): prove outline provenance through gateway and postgres
e679c7adf3 fix(day231): fail closed on invented outline sources
48fc9e1f28 docs(day226): record gamma editor evidence
11f3dcb837 feat(day231): add knowledge outline review evidence screen
0aea4829e5 fix(presentations): gate custom template save runtime
c4f4759070 feat(day231): generate deck outlines from governed knowledge
c557c502c2 instrukcje 229-232 — komplet 15 instrukcji wydany
3416f1d62f instrukcje 222-225 — komplet
MARKER OK
```

```text
$ git -C "$WT" rev-parse HEAD
0a3569902119880841d30e0e5fac57879d1e5be0
$ git -C "$WT" status --short | head -3
<brak wyjścia — czysty worktree>
```

Dysk: `13Gi` wolne, próg 5 GB spełniony.

## 2. W1–W10

- W1: trzy odrębne nieaktualne twierdzenia na liniach 27–28, 45–46 i 97.
- W2: wymagane `946_tool_outputs_reports_lineage.sql`,
  `947_tool_outputs_idempotency_guard.sql`, `948_tool_promotion_idempotency.sql` istnieją.
  Regex instrukcji zwrócił także czwarty plik `948_tool_promotion_tenant_idempotency.sql`.
- W3: `resolved = fromQuery ?? fromLs ?? fromEnv ?? false` — default OFF.
- W4: `DiscoveryToolsHub` ma własny `.catch()`, ustawia
  `toolOutputsUnavailable=true` i zwraca `{ outputs: [] }`; obawa o pełnoekranowy crash
  nie odpowiada obecnej ścieżce.
- W5: Gateway montuje `/api/tool-outputs`; router ma
  `apiAuthRateLimiter → verifyToken → requireOrgAccess → demoContextMiddleware`.
- W6: `ToolOutputsController.listOutputs` istnieje.
- W7: gate karty to
  `TECHNICAL_BROWSER_COMPLETE / OWNER_QUALITY_REVIEW_IN_PROGRESS / ... / NO_REMEDIATION_AUTHORIZED`.
  Jawna instrukcja Day225 udziela węższej licencji na komentarz, testy i dopiski; nie
  rozszerzono remediacji UI.
- W8: `BRAK zmiennych zdalnych — czysty start`; wszystkie połączenia DB były do
  `127.0.0.1:6168`.
- W9: istniejący test runtime flagi:
  `src/utils/__tests__/toolsInsightsWiringFlag.test.ts`; komendy W9 nie znalazły
  istniejącego testu trasy pod wzorcem nazwy.
- W10: `6168/5124/5125 wolne`; widoczny obcy `cx-day224-pg` na `6167` pozostał
  nietknięty.

## 3. A.1 — sprostowanie komentarza

Wszystkie trzy bloki mówią teraz, że tabela istnieje od `2026-08-28 09:35 UTC`,
migracje 946/947/948 mają `success`, a default OFF wynika z oczekiwania na świadomy
akcept właściciela. Link do `ZNALEZISKO_TOOL_OUTPUTS.md` wskazuje źródło daty i metody.
Kod wykonywalny nie zmienił się.

Strażnik treści:

- oryginalny plik przez `cp`: `2 failed`, `success:false`, exit `1`;
- przywrócona korekta: `2 passed`, `success:true`, exit `0`;
- grep trzech fałszywych fraz po naprawie: zero trafień.

To celowo test tekstu źródłowego (`readFileSync`), nie zachowania runtime: chroni przed
regresją komentarza, która była przedmiotem zlecenia.

Pierwszy commit i natychmiastowy push Z34a: `2a5b41a5c6`.

## 4. A.2 — lokalny RealPG/API/browser

### Migracje i baza

- kontener: `cx-day225-pg`, wyłącznie `127.0.0.1:6168`;
- przebieg 1: `Applying migrations: 879`, zakończony sukcesem;
- przebieg 2: `Applying migrations: 0`, zakończony sukcesem;
- log potwierdza 946, 947, 948 oraz dodatkowe 948 tenant;
- SQL: `to_regclass('public.tool_outputs') = tool_outputs`, `count(*) = 0`.

### Realny `ApiGateway`

Pierwsza komenda z rootem i `--config server/vitest.config.ts` dała reporter
`success:false`, `0` suite, `0` testów mimo exit 0. Konfiguracja ma include `src/**`
względem katalogu `server`; poprawny przebieg wykonano z `cwd=server` i
`--config vitest.config.ts`.

Poprawny przebieg (`--retry=0`, pełny env w tej samej linii): `3/3 PASS`:

1. `200 { outputs: [] }` na świeżo zmigrowanej pustej tabeli;
2. bezpośredni lokalny INSERT → SQL readback → HTTP `200` z tym samym id/tytułem/statusem;
3. brak ważnego JWT → `401`, bez pola `outputs`.

Pułapki Z33:

- (a) `ENABLE_V8_GLOBAL=true` jawnie w komendzie;
- (b) `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` jawnie w komendzie;
- (c) `MOCK_DB=false DB_TYPE=postgres`; pierwszy setup testu asertuje efektywne
  `process.env.DB_TYPE === 'postgres'`;
- (d) `ENABLE_TEST_AUTH_BYPASS=false`; `401` bez tokenu dowodzi, że `verifyToken` działa;
- (e) `toolOutputs.routes.ts` ma tylko standardowy stos, bez dodatkowej bramki trasy.

### Kanoniczny runtime i przeglądarka

Ponieważ runtime odmawia adopcji bazy nazwanej `cx225`, w tym samym wyłącznym kontenerze
i porcie utworzono efemeryczną bazę `consultify_w3_tools_owner_day225`, zastosowano te
same 879 migracji i kanoniczny seeder `W3-TOOLS-OWNER-v1` (`FINAL`). Pierwsza próba
runtime została automatycznie posprzątana po timeout health: backend rozpoczął ciężką
inicjalizację po ok. 111 s. Druga próba zakwalifikowała exact runtime:
health/ready/frontend `200`, SHA `2a5b41a5c6`, migracje `879`, auth/test bypasses OFF.

Po lokalnym logowaniu i wejściu na
`/discovery-tools?ff_toolsInsightsWiring=1` pomiar CDP zarejestrował dwa żądania
`GET http://127.0.0.1:5125/api/tool-outputs`, oba `200 application/json`. Zakładka
„Insighty” wyrenderowała pusty stan bez błędu pełnoekranowego. Runtime zatrzymano jego
kanonicznym `stop`; porty 5124/5125 są wolne i brak ocalałych procesów.

Retest lokalny POTWIERDZA, że blokada opisana w DEC-158 nie istnieje na tej bazie po
migracjach — ścieżka działa.

## 5. A.3 — flaga

Flaga `VITE_TOOLS_INSIGHTS_WIRING` pozostaje domyślnie WYŁĄCZONA. Włączenie wymaga
osobnej decyzji właściciela na czystym zrzucie. `resolved = ... ?? false` oraz `.env*`,
compose i Railway pozostały bez zmian. Zrzut Day225 jest dowodem technicznym, nie
zrzutem odbiorowym.

## 6. §0.4a — pełne nazwy

- przed: 9 pełnych nazw;
- po: 14 pełnych nazw;
- dodane: 5 (2 strażniki komentarza + 3 RealPG/API);
- zniknięte: 0.

Pełny diff: `/private/tmp/cx-day225-narzedzia-artefakty/nazwy.diff`.

## 7. Z30 i artefakty

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera
wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu
outboxu podczas testów. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera
wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie przez kanoniczny
`scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie dyżuru, tylko w celu
wykonania zrzutów. Zweryfikowałem środowisko procesu i log serwera zgodnie z §0.2b (4).
Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie zewnętrzne nie zostało wysłane.
Log odnotował wyłącznie fail-closed: `No transport configured ... message dropped`.

| Artefakt | SHA-256 |
|---|---|
| `migrations-pass1.log` | `243798703b2ead26185c393a7b718302088882b22809b7a6d77bfaa90e262a33` |
| `migrations-pass2.log` | `cb06a5073effb8969e1311c78fa8c7a46ffb1aca8130d5dfc5f292d27abb1487` |
| `day225-narzedzia-routetest.json` | `40d79a8b25dd84aca4324a8851b0c12494689eaa6d69849974338c000f4b1971` |
| `day225-tool-outputs-http-db-evidence.json` | `a33c030183d3723303a0eed2acfc7a9b71fe8dd75d9be3b0ce96a0cfe4985dae` |
| `day225-tools-insights-local.png` | `753ab6a5bf879fb7fb2dc581fb4f99b3501678c5144e47a9423f2c7b42aeee5e` |
| `comment-mutation-red.json` | `14d299e6a8ee3d7bb18b55fa0a3108bfcdcf73bd9e774de2eeb5f0e0953dc903` |
| `comment-restored-green.json` | `9fd9036cb1331a2d715d106a3b68190a321b9b24cc3093be252cdeee0053cdd6` |
| `przed-nazwy.txt` | `f7f3c2244834808e93290884031c9f9b58b632670f67a4fe6aca334395d7e43f` |
| `po-nazwy.txt` | `68a88af36ec491d9dcfd652864ac563ce28f9a4bc80380cf2f4ee398c3319286` |
| `nazwy.diff` | `ef0f8b1c470b760de22a430b62ee7f88f4914f9bf398f9661f97d1362c8a849f` |

## 8. Korekty wobec instrukcji

1. W2 mówi o trzech trafieniach, lecz regex `^94[678]_tool` zwraca cztery przez
   dodatkowy `948_tool_promotion_tenant_idempotency.sql`. Wymagane trzy istnieją.
2. Komenda §0.2c(B) z rootem i `server/vitest.config.ts` daje 0 testów, ponieważ include
   configu jest liczony od `server/`. Dowód wykonano z `cwd=server`.
3. `ZNALEZISKO_TOOL_OUTPUTS.md` w starej treści mówi „retest na stagingu”, ale Z28 i A.2
   bezwzględnie zakazują stagingu. Wybrano bezpieczniejszy, jawnie zamówiony retest lokalny.
4. Istniejący `toolsInsightsWiringFlag.test.ts` nadal ma fałszywą tezę o brakującej tabeli
   w nazwie `describe` i komentarzu. Nie ma go w tabeli licencji zapisu; pozostawiono
   nietknięty i zgłoszono zamiast rozszerzać zakres.
5. Karta modułu ma `NO_REMEDIATION_AUTHORIZED`, natomiast instrukcja Day225 jawnie udziela
   wąskiej licencji na komentarz, dwa nowe testy i dwa dopiski. Nie wykonano remediacji UI.

## 9. TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano gotowości wizualnej zakładki do akceptu właściciela; zrzut jest tylko
  techniczny.
- Nie zweryfikowano stagingu/demo/produkcji — celowo, z powodu Z28.
- Nie zweryfikowano, czy każde miejsce w całym repo opisujące DEC-158 jest aktualne;
  licencja obejmowała trzy bloki w pliku flagi. Wiadomo, że istniejący test ma przestarzałą
  nazwę i komentarz.
- Nie wykonywano pełnego corpus testów Tools; dowód obejmuje 9 istniejących testów runtime
  flagi, 2 nowe strażniki komentarza i 3 nowe przypadki real-PG/API.
- Nie wykonano właścicielskiego odbioru ekranu ani decyzji o włączeniu flagi.
