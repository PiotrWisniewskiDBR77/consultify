# CODEX DAY 122 — komunikat wyceny

Data: 2026-08-29  
Gałąź: `codex/day122-wycena-komunikat-20260829`  
Marker: `a1265154b73f57a43cbe468993e4317bb2e0f02b`  
Commity produktu: `32050f31eed094b080639dafd258dcc40591ae49`, `f1efb98a3a6aa3f24e0098db60684c6796d9dc88`  
Werdykt: **PARTIAL / IMPLEMENTED / RUNTIME PATH NOT PROVEN**.

Kod obsługi `APPROVED_VERSION_IMMUTABLE` został wdrożony w obu realnych
wołaczach i ma klucze PL/EN. Pełny produkt na finalnym SHA nie osiąga jednak
tego kodu błędu z zaakceptowanej fixture: wcześniejsza bramka zwraca
`409 FINANCE_LEGACY_IDENTITY_UNMAPPED`. Dlatego nie wpisuję `VERIFIED` ani
`ZROBIONE_WG_DoD`.

## 0. Tożsamość pracy i marker

Wolne miejsce:

```text
Filesystem        Size    Used   Avail Capacity iused ifree %iused  Mounted on
/dev/disk3s1s1   1.8Ti    12Gi    52Gi    19%    459k  543M    0%   /
```

Wynik komend markera, dosłownie:

```text
63e7c979df merge: dyzur 119 — kontrakt trzech stanow w 3 komponentach; wycofal 2 pozorne integracje w martwym kodzie
aa564ad4f0 docs(day121-124): pierwsza budowa PO akcepcie + trzy rownolegle
13c33a84f9 docs(day119): record three-state acceptance evidence
70c68154f8 fix(interview): render template uncertainty banner
a1265154b7 merge: day120-fixture-insight
9ed715a779 merge: day118-propagacja
4ba5900ca0 docs(ledger): DEC-337..339 — wlasciciel zaakceptowal wzorzec karty Zadania
1736e861e3 fix(interview): surface template load uncertainty
91acd26e6e docs(interview): record day120 fixture evidence
1a31bedb26 docs(day118): record owned cleanup
71f6c5198b docs(day118): record propagation evidence
a2bda5f3de fix(interview): expose team member load failures
0caec88e83 test(finance): expose valuation error propagation boundary
a1215a8fbb fix(interview): seed measurable owner insight
73cb3bf395 fix(superadmin): surface configured AI providers
a2b7106bb3 fix(ui): preserve known partial and unknown counts
9a39cd41d6 fix(superadmin): align health monitor routes
63b5f8e64b docs(day118-120): fala naprawcza 2
86eeb60fb3 merge: dyzur 117 — kontrakt statusu naprawiony, ekran wola nieistniejaca trase
a9579b65d1 merge: dyzur 116 — 500 zastapione kontrolowana odmowa 409, UI jeszcze nie propaguje
289fe87400 docs(day117): record AI provider status evidence
a50202d838 docs(day116): record owned database cleanup
3b2a21f30e docs(day116): add WACC fix report
f6f7ec4ea4 docs(day116): record WACC conflict fix evidence
96d7a24067 merge: dyzur 114 — os czasu mowi prawde i podaje skale (wariant B)
MARKER OK
```

Wynik sanity po utworzeniu worktree, dosłownie:

```text
a1265154b73f57a43cbe468993e4317bb2e0f02b
```

`git status --short | head -3` nie zwrócił żadnego wiersza.

Porty przed startem: `6005`, `4910`, `4911` — **3 z 3 WOLNE**.  
Worktree: `/private/tmp/cx-day122-wycena-komunikat`.  
Kontener: `cx-day122-pg`, wyłącznie `127.0.0.1:6005`.

Tip bazy był 7 commitów przed markerem w historii, czyli o 7 commitów dalej niż marker; zgodnie z DEC-2026-08-26-95 praca
zaczęła się dokładnie z markera. Różnica nazw obejmowała m.in. instrukcje
121–124, pliki Interview, dwa pliki tłumaczeń oraz raport/test dnia 119;
niczego z tipa nie scalono i nie wykonano rebase.

## 1. Stan wejściowy B.1

Realne wołacze przed zmianą:

```text
src/components/Economics/hooks/useFinanceRowActions.ts:624
src/components/Economics/FinancePreviewPanel.tsx:1209
```

Oba wykonywały:

```text
e?.response?.data?.error || t('finance.toast.computeDcfFailed', 'Nie udało się obliczyć DCF')
```

Kontrakt dnia 118:

```text
tests/unit/components/Finance/day118ValuationErrorPropagation.contract.test.ts
```

Baseline z `--retry=0`, odczytany z JSON, a nie z kodu wyjścia:

```json
{"success":false,"numTotalTests":1,"numPassedTests":0,"numFailedTests":1}
```

Pełna nazwa przypadku:

```text
Day 118 valuation 409 propagation boundary does not replace APPROVED_VERSION_IMMUTABLE guidance with the generic DCF failure toast
```

W2: znaleziono finansowy seeder
`server/scripts/seed-wave3-finance-owner-review.ts`. W3 z instrukcji szukał
literału `successful_migrations`, którego ten seeder nie ma. Rzeczywisty próg
jest w `server/scripts/seed-wave3-finance-owner-review.ts:238`:
`Number(readback.migrations) < 834`, czyli poprawne „co najmniej 834”.

Stan G00–G20 przed dyżurem: G00 `PASS`, G01
`PASS_FOR_EXACT_RUNTIME_PREFLIGHT`, G02 `PASS`, G03 `PASS_FOR_PREFLIGHT`, G04
`PASS_OWNER_FIXTURE_READY`, G05 `PASS_FOR_SOURCE_PREFLIGHT`, G06
`PASS_TECHNICAL_BROWSER / OWNER_PENDING`, G07–G10 `PARTIAL`, G11–G20
`NOT_STARTED`.

## 2. B.2 — implementacja

Zmienione wołacze:

- `src/components/Economics/hooks/useFinanceRowActions.ts`;
- `src/components/Economics/FinancePreviewPanel.tsx`.

Oba rozpoznają `APPROVED_VERSION_IMMUTABLE` w rzeczywistym kształcie klienta
API (`e.data`, z kompatybilnym fallbackiem `e.response.data`). Dla tego kodu
pokazują lokalizowany komunikat z przyczyną i zaleceniem. Pozostałe błędy
zachowują dotychczasowy fallback.

Klucze w tym samym commicie produktu:

```text
PL: Ta wersja wyceny jest zatwierdzona i niezmienna. Aby ponownie obliczyć WACC, utwórz nową wersję.
EN: This valuation version is approved and immutable. To recompute WACC, create a new version.
```

Nie dodano flagi ani nowego wizualium.

### Pięć cech właściciela — 5 z 5 w treści źródłowej

1. **PL:** komunikat ma pełny polski wariant; EN ma osobny klucz.
2. **Mianowniki:** komunikat nie podaje żadnej liczby, więc nie zawiera liczby
   bez mianownika.
3. **Stan pusty:** nie jest to stan pusty i nie podszywa `UNKNOWN` pod zero.
4. **Uprawnienie:** mówi wprost, że zatwierdzonej, niezmiennej wersji nie można
   przeliczyć oraz wskazuje dozwolone wyjście — nową wersję.
5. **Czerwień:** toast błędu występuje wyłącznie dla rzeczywistej blokady 409;
   nie zmieniono neutralnych przycisków ani palety.

**Ograniczenie:** 5 z 5 dotyczy treści i sposobu renderowania w kodzie.
Osiągalność dokładnie tego komunikatu w pełnym produkcie jest `NOT_PROVEN`,
patrz sekcja 5.

## 3. B.3 — dowód mutacyjny i granica kontraktu

Komenda RED dla mutacji rozpoznawanego kodu:

```bash
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run tests/unit/components/Finance/day118ValuationErrorPropagation.contract.test.ts --retry=0 --reporter=json --outputFile=/private/tmp/cx-day122-wycena-komunikat-artefakty/day122-mutation-red.json
```

Wynik z JSON:

```json
{"success":false,"numTotalTests":1,"numPassedTests":0,"numFailedTests":1}
```

Po przywróceniu kodu, komenda GREEN:

```bash
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run tests/unit/components/Finance/day118ValuationErrorPropagation.contract.test.ts --retry=0 --reporter=json --outputFile=/private/tmp/cx-day122-wycena-komunikat-artefakty/day122-mutation-green.json
```

Wynik z JSON:

```json
{"success":true,"numTotalTests":1,"numPassedTests":1,"numFailedTests":0}
```

Po przywróceniu:

```text
DIFF PO PRZYWROCENIU:
GIT DIFF PUSTY
```

Druga, ważniejsza mutacja usunęła obsługę realnego `e.data`, pozostawiając
tylko `e.response.data`. Ten sam test pozostał zielony:

```json
{"success":true,"total":1,"passed":1,"failed":0}
```

To dowodzi, że kontrakt dnia 118 sprawdza obecność słowa i brak jednego
literału, ale nie sprawdza kształtu błędu wspólnego klienta API. Nie zmieniono
testu, ponieważ `§D` nie licencjonuje zapisu w `tests/**`. Po ponownym
przywróceniu finalnego kodu test był `1 z 1 PASS`, a `git diff` pusty.

Werdykt K3: **PARTIAL** — mutacja rozpoznania kodu daje RED/GREEN, lecz
kontrakt nie chroni rzeczywistego odczytu payloadu.

### Pułapki Z33 dla pakietu

Pakiet jest czysto tekstowym testem jednostkowym i nie montuje Gateway, nie
łączy się z bazą ani nie dotyka auth/V8. Dlatego pułapki (a)–(d) nie leżą na
jego ścieżce; uruchomiono go z `RUN_DB_TESTS=0 MOCK_DB=true`. Pułapka (e)
została wyłączona przez odczyt dokładnego pliku w `Economics`, wskazanego w
teście. `--retry=0` było obecne w każdej komendzie.

## 4. B.4 — brak regresji po nazwach

Zbiory `fullName` przed i po zawierają dokładnie 1 z 1 tę samą nazwę przypadku;
delta nazw wynosi **0**. Stan przeszedł z `failed` do `passed`.

Frontend build:

- pierwszy przebieg: `FAIL / OOM` po transformacji 10 509 modułów przy
  domyślnym limicie 4 GB;
- drugi przebieg: `NODE_OPTIONS=--max-old-space-size=8192 npm run build` —
  **PASS**, `✓ built in 35.96s`;
- log: `/private/tmp/cx-day122-wycena-komunikat-artefakty/frontend-build.log`;
- SHA-256: `91b763982ca4cea7235050fa8f9a321f7d3e9f1d1f696f85489287b08cd8d7f5`.

## 5. K5 — pełny produkt, realny 409 i zrzut

Fixture została utworzona niezmienionym seederem na lokalnym kontenerze
`cx-day122-pg`, bazie `consultify_w3_finance_owner_day122`, porcie `6005`.
Cold readback:

```json
{"migrations":863,"approvedVersions":5,"statements":6,"sourceReceipts":6,"baselineContexts":1,"lifecycleHashRunIdentityVerified":true}
```

Ledger: `863 z 863 success`, `0` innych. Baza zawierała `0` wierszy `smtp%`.
Kanoniczny runtime na finalnym SHA `f1efb98a3a6aa3f24e0098db60684c6796d9dc88`
potwierdził `health/ready/frontend = 200/200/200`, migracje `ok/ok`, auth bypass
`false`, DB `127.0.0.1:6005` oraz markery SHA serwera i klienta zgodne.

Po realnym logowaniu OWNER, polskim UI i kliknięciu `Oblicz DCF`:

- realny `ApiGateway` i `verifyToken` zostały osiągnięte;
- POST `/api/economics/valuations/:id/compute` zwrócił `409`;
- payload był **nie** `APPROVED_VERSION_IMMUTABLE`, lecz:

```json
{"success":false,"code":"FINANCE_LEGACY_IDENTITY_UNMAPPED","writerId":"ECO-W26","message":"This legacy writer is retired for migrated records, but this record has no canonical identity yet. Run the canonical backfill before retrying.","identityStatus":"not_migrated"}
```

- ekran pokazał zastany ogólny toast `Nie udało się obliczyć DCF`.

Zrzut obejrzany ręcznie: polski, ostylowany, ciemny produkt z zatwierdzoną
wyceną i ogólnym czerwonym toastem. Jest dowodem negatywnym, nie zrzutem
zamówionego komunikatu.

```text
/private/tmp/cx-day122-wycena-komunikat-artefakty/day122-pl-409-unreachable.png
SHA-256 8055f68eba59f40f86914c8cd79e0935bf21383f733eac1c206570c7fdc3f407
```

Werdykt K5: **PARTIAL / 0 z 1 zrzutów zamówionego komunikatu; 1 z 1 zrzutów
negatywnego stanu runtime**.

### Pułapki Z33 dla runtime

- (a) V8: runtime manifest potwierdził `v8GlobalEnabled=true`.
- (b) Results beta: nie leży na ścieżce Finance.
- (c) baza: manifest i niezależny SQL potwierdziły PostgreSQL na `6005`.
- (d) auth: manifest potwierdził `enableTestAuthBypass=false`, a log zawiera
  `AuthMiddleware Verifying token` dla POST.
- (e) realny wołacz: UI i źródło wskazują dwa pliki w `Economics`, nie
  `Finance`.

Runtime uruchomiono wyłącznie kanonicznym skryptem, a następnie zatrzymano tym
samym skryptem: `ownedProcessGroupsOnly=true`, `processGroupsVerifiedTerminated=true`,
porty `4910` i `4911` wolne.

## 6. Z30 — zero wysyłki

Przed zapisami:

```text
BRAK ZMIENNYCH POCZTY
```

Po migracjach i po seedzie:

```text
 key | left
-----+------
(0 rows)
```

Grep Gateway dla `startNotificationOutboxDrainCron|outboxWorker|platformOutboxDrainCron`
zwrócił 0 trafień. Środowisko procesu serwera miało `DOTENV_DISABLED=1` i
wyłącznie lokalny `DATABASE_URL`; nie zawierało zmiennych SMTP/RESEND/SENDGRID/MAIL.
Log pokazał start lokalnych drenaży, ale nie pokazał konfiguracji transportu
ani próby wysyłki.

**Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie
przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie
dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log
serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani
powiadomienie zewnętrzne nie zostało wysłane.**

## 7. Korekty wobec instrukcji

1. **Brak sekcji `§0.4a`.** Z24 i kilka odwołań wymaga pomiaru „wg §0.4a”, ale
   wydana instrukcja przechodzi z `§0.2d` do `§0.5`. Bezpieczna interpretacja:
   zmierzono jedyny istniejący kontrakt dnia 118, porównano jego pełne nazwy,
   uruchomiono build i podano pełną listę plików względem markera.
2. **W3 nie pasuje do seedera.** Instrukcja szuka `successful_migrations`,
   seeder finansowy używa `readback.migrations < 834`. Wynik: próg jest typu
   „co najmniej”, ale literalna komenda instrukcji daje 0 trafień.
3. **Migracje kontra seeder.** `§0.2c(A)` każe utworzyć i zmigrować bazę,
   natomiast `seed-wave3-finance-owner-review.ts` odmawia każdej istniejącej
   bazy. Po zapisaniu dowodów migracji i SMTP usunięto wyłącznie własną
   efemeryczną bazę; niezmieniony seeder utworzył ją ponownie pod tą samą nazwą
   w tym samym kontenerze i wykonał własny pełny łańcuch migracji.
4. **Teza o osiągalności zamówionego 409 obalona.** Instrukcja zakłada, że
   przycisk wyceny dociera do `APPROVED_VERSION_IMMUTABLE`. Rzeczywisty wynik
   na zaakceptowanej fixture to wcześniejsze
   `409 FINANCE_LEGACY_IDENTITY_UNMAPPED`. Nie wykonano backfillu ani zmian
   serwera, bo `§D` zakazuje zapisu `server/src/**` i nie licencjonuje fixture.
5. **Kontrakt dnia 118 jest niewystarczający.** Pozostał zielony po usunięciu
   rzeczywistego odczytu `e.data`. Nie zmieniono go poza licencją.

## 8. TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano w pełnym produkcie widocznego PL ani EN komunikatu dla
  `APPROVED_VERSION_IMMUTABLE`, ponieważ zaakceptowana fixture nie osiąga tego
  kodu.
- Nie zweryfikowano, czy po wykonaniu kanonicznego backfillu ten sam rekord
  osiągnie naprawioną trasę dnia 116; backfill był poza licencją i mógłby
  zmienić dane dowodowe.
- Nie zweryfikowano automatycznie rzeczywistego kształtu błędu komponentu,
  ponieważ jedyny istniejący kontrakt jest tekstowy, a `tests/**` były poza
  licencją zapisu.
- Nie zweryfikowano drugiego wołacza (`FinancePreviewPanel`) przez osobny
  przebieg UI; źródło ma identyczną obsługę, ale to nie jest dowód runtime.
- Nie wykonano owner acceptance ani żadnego dowodu Railway/demo/staging/produkcja.

## 9. Kryteria K1–K7

| Kryterium | Wynik |
| --- | --- |
| K1 stan zastany przed zmianą | **PASS** |
| K2 pięć cech | **5 z 5 w źródle / runtime NOT_PROVEN dla zamówionego kodu** |
| K3 mutacja w obie strony | **PARTIAL** — kod błędu RED/GREEN; realny kształt payloadu niechroniony |
| K4 delta nazw testów | **PASS — 0** |
| K5 zrzut produktu | **PARTIAL — 0 z 1 zamówionych; 1 z 1 negatywnych** |
| K6 niezweryfikowane | **PASS — sekcja niepusta** |
| K7 rozłączność | **PASS** po finalnym pomiarze |

## 10. Commity i push

- `32050f31eed094b080639dafd258dcc40591ae49` — komunikat PL/EN w obu wołaczach;
- `f1efb98a3a6aa3f24e0098db60684c6796d9dc88` — korekta do rzeczywistego
  payloadu `e.data`.

Po każdym commicie wykonano push wyłącznie na
`github-backup/codex/day122-wycena-komunikat-20260829`.
