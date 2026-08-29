# CODEX DAY 69 — raport fali językowej

Data: 2026-08-29  
Gałąź: `codex/day69-lang-wave-20260829`  
Marker: `f21bc627ad9c30b5dcc33b07af6e259d22a3456f`  
Werdykt: **PARTIAL — C.1 częściowo wykonane; C.2–C.6 NIEZWERYFIKOWANE**

## §0.1 — baza, marker i sanity

Wolne miejsce przed startem: `17Gi` (próg STOP 5 GB nie został przekroczony).

Wynik komendy (2), dosłownie:

```text
f824f55a9c docs(instrukcje): przenumerowanie 63/64 -> 69/70 (kolizja z istniejacymi dyzurami)
68bc2892e7 docs(instrukcje): dyzur 63 fala jezykowa + dyzur 64 Finanse wg szkieletu 02
f21bc627ad docs(ledger): DEC-256 decyzje wlasciciela, DEC-257 pomiar dlugu jezykowego, DEC-258 sprostowanie mianownika
e30c694542 merge: raport odbioru Audyty+Czat (PARTIAL, uczciwy) — 5 plikow dokumentacji
49877ce009 docs(owner-review): report audits and chat evidence
98d92f39e7 docs(ledger): DEC-254 sprostowanie (Finanse = 0 zrzutow) + DEC-255 odbior wizualny M11/M16
d1e62cbdbe docs(chat): add refreshed owner review packet
96213bd32b docs(audits): add owner review evidence packet
f5c0a53d2d docs(ledger): DEC-251..253 — staging dziala, realna skala dlugu, trzy moduly gotowe do odbioru
fdbad9ea84 merge: praca nocna — dlug testowy P2/P3, typy, inwentarz lintu
cfd547ec46 docs(test-debt): close night K1-K5 evidence
c26c0d596a docs(test-debt): inventory repository lint debt
be487427ba fix(types): close night test-debt type failures
0782421e3a fix(test-debt): isolate artifact SLA from project gates
8ff5cdb446 fix(test-debt): close portable P3 runtime guards
da1ecc507f docs(test-debt): close phase 1 P2 on fresh PG
7f6026fa96 docs(test-debt): record night marker baseline
fc20525ba8 revert(migrations): przywrocenie 948 — usuniecie lamalo rejestr bazy
28cece0e3a merge: domkniecie P2/P3 + dowody wizualne fali A (bez usuniecia migracji 948)
0d227a6ca9 docs(program): record integrated P2 P3 closure evidence
c5b3c4d604 test(partner): isolate real-db fixture schema
d8131e5a95 fix(test-db): honor explicit mock override in real-db runs
aa8525bb5f docs(acceptance): persist Materials and Partner visual evidence
9c3f15254c docs(finance): record day60 owner review evidence
688156e1c9 docs(P2): record full technical closure evidence
MARKER OK
```

Wynik komendy (7), dosłownie:

```text
f21bc627ad9c30b5dcc33b07af6e259d22a3456f
```

Tip uciekł do przodu. Rozbieżność od markera obejmuje wyłącznie dwie instrukcje:
`INSTRUKCJA_DYZUR_69_FALA_JEZYKOWA.md` i `INSTRUKCJA_DYZUR_70_FINANSE_ODBIOR.md`.
Nie wykonano rebase.

## Stan wejściowy W1–W5 i tezy T1–T5

- W1: `loadPath` = `/locales/{{lng}}/{{ns}}.json` — zgodne.
- W2: `1770095` bajtów — zgodne z „ok. 1,77 MB”.
- W3: `19489` wystąpień — zgodne.
- W4: oba wskazane pliki znalezione dokładnie.
- W5: oba wskazane pliki serwera znalezione dokładnie.
- T2: `31140` kluczy — zgodne.
- T3: `19489` wystąpień, ale **16000** unikalnych kluczy, nie 15989.
- T4: **3721** braków, nie 3718.
- T5: `settings 642`, `results 386`, `finance 216`, `myWork 152`, `security 134`, `decisions 121`, `documentStudio 89`, `partner 83`. Rozbieżność: `myWork +1`.

Pełny niezależny pomiar: `/private/tmp/cx-day69-artefakty/baseline-missing-keys.txt`, SHA-256 `7efc36a5b7e099a25009509650e2e52b3b7e269d49f9ea250cb984188a06bc21`.

## Z30 — brak wysyłki

```text
BRAK ZMIENNYCH POCZTY
 key | left
-----+------
(0 rows)
```

Grep drenaży w `server/src/Gateway.ts`: 0 trafień.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## C.1 — Partner i Finanse

Stan: **PARTIAL**.

Klasy A→B→C→D:

- A: liczba kluczy PL wzrosła z `31140` do `31182`; JSON parsuje się poprawnie. Dodano 42 świadomie ocenione wartości, głównie dla kanonicznego panelu Partnera, profilu, ustawień wypłat i nazw sekcji poleceń. Nie domknięto całego mianownika C.1: po zmianie pozostaje `partner 77`, `finance 216`, `billing 78`, `v8 66`, `valuation 40` braków według użytego wzorca.
- B: `Company Name` i `Tax ID / VAT` opakowano w `t()` i dodano polskie wartości.
- C: wartości `active` dla fazy programu i statusu organizacji są mapowane przy renderowaniu na polskie etykiety. API nie zostało zmienione.
- D: usunięto z oglądanego panelu określenia `Governed Partner runtime`, `Read-only governance view`, identyfikator rekordu i kod `AMD-PRT-ECONOMICS-002`; zastąpiono je zdaniami dla człowieka. Nazwy `V8 Referral ...` otrzymały etykiety bez nazwy architektury.

### K1

Przed: `31140`; po: `31182`; spadku nie ma.  
Pomiar po: `/private/tmp/cx-day69-artefakty/c1-after-missing-keys.txt`, SHA-256 `2a7a05b3bb08fccb5a9262fe63b899eeb8e31088c374182b81afc060059f38f9`.

### K2

- Backend: `NODE_OPTIONS="--max-old-space-size=3072" ../node_modules/.bin/tsc --build tsconfig.build.json` — PASS, exit 0.
- Frontend, próba 1: OOM przy domyślnym limicie — FAIL.
- Frontend, próba 2: `NODE_OPTIONS="--max-old-space-size=8192" npm run build` — PASS, exit 0, `✓ built in 36.13s`.
- Log PASS: `/private/tmp/cx-day69-artefakty/c1-frontend-build-8g.log`, SHA-256 `42a479927dd7652b43fff7efb3c150a91c0a40173e6de4ca8fd21eeac02125c8`.

### K3

Obejrzano **1 z co najmniej 4 zmienionych powierzchni** w motywie jasnym, ze stanem pełnym. Na zrzucie panelu kanonicznego Partnera nagłówki i wartości są po polsku: m.in. „Status partnera / Aktywny”, „Polecenia / Aktywne polecenia: 12”, „Historia poleceń”, „Kwota możliwa do wypłaty”. Nie widać identyfikatora rekordu ani kodu decyzji.

Zrzut: `/private/tmp/cx-day69-artefakty/c1-partner-canonical-runtime-light.png`, SHA-256 `15c5eb82311d16917b92377485fd19959792f1012980b242d7cfe27f8984ce50`.

### Testy i pułapki Z33

Komenda:

```bash
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run tests/components/partner/PartnerCanonicalRuntimePanel.test.tsx tests/components/partner/PartnerPortalView.v8-company-info.test.tsx tests/components/partner/EarningsSection.policy-gated.test.tsx tests/components/partner/EarningsSection.v8-payout-settings.test.tsx tests/components/partner/ReferralToolsSection.v8-campaign-create.test.tsx --retry=0 --reporter=json --outputFile=/private/tmp/cx-day69-artefakty/c1-partner-tests.json
```

Wynik po nazwach: 15 PASS, 2 FAIL. Czerwone:

1. `EarningsSection V8 payout settings seam renders governed payout settings as historical read-only data` — test oczekuje widocznego kodu `AMD-PRT-ECONOMICS-002`.
2. `PartnerCanonicalRuntimePanel renders verified values while keeping accrual policy-gated` — test oczekuje angielskiego tekstu `3 active attribution records`.

JSON: SHA-256 `87a7fc352ba8c36d665381dd0894c3d5ec2dc3939898cda14fa9285b51b02c65`.

Pułapki (a)–(e) nie leżą na ścieżce tego pakietu czysto komponentowego. Dowód:

```text
rg -n "ENABLE_V8_GLOBAL|ENABLE_TEST_AUTH_BYPASS|RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE|DB_TYPE|assertRealPostgresTestEnvironment" <5 plików pakietu>
BRAK STRAZNIKOW (a)-(e) W PAKIECIE CZYSTO KOMPONENTOWYM
```

Pakiet uruchomiono z `RUN_DB_TESTS=0 MOCK_DB=true`; nie jest dowodem egzekucji DB/HTTP.

### STOP — C.1 Partner i Finanse

Rodzaj: MERYTORYCZNY  
Powód: wymagane usunięcie żargonu i angielskich tekstów powoduje dwa czerwone testy, które kontraktowo oczekują właśnie starych tekstów; K4 nie jest spełnione.  
Licencja, którą sprawdziłem: §E pozwala zapisywać pliki `.tsx`/`.ts` w `src/` i tłumaczenia, lecz nie wymienia plików testowych; zgodnie z procedurą pliki spoza licencji traktuję jako tylko do odczytu.  
Dowód: dwa pełne `fullName` powyżej oraz JSON testów.  
Co dostarczyłem ZAMIAST zmiany: czerwony kontrakt, polski zrzut realnego komponentu, gotowy częściowy diff oraz dokładny pozostały mianownik.  
Co zrobiłbym, gdyby zapadła decyzja X: po jawnej licencji zaktualizowałbym oczekiwane teksty w dwóch testach bez osłabiania zachowania, następnie uruchomił pakiet ponownie i porównał `fullName`. Domknąłbym pozostałe klucze C.1 dopiero po odbiorze słownictwa finansowego.  
Rekomendacja dla nadzorcy: przyznać licencję na dwa wskazane testy i zatwierdzić słownik terminów finansowych; promień rażenia: Partner UI i jego testy komponentowe, bez API.  
Stan: zacommitowano częściowo w commicie wskazanym w sekcji końcowej.  
Czy kontynuowałem pozostałe pozycje: NIE — rdzeń C.1 nie osiągnął K3/K4, a pozostały zakres i prawdziwy mianownik zapisano jako NIEZWERYFIKOWANE.

## Korekty wobec instrukcji

1. T3/T4/T5: wiążące są własne wyniki `16000`, `3721`, `myWork 152`; różnią się od liczb autora.
2. `Z24` odsyła do `§0.4a`, lecz w wydanym dokumencie po `§0.2d` występuje bezpośrednio `§0.5`; brak treści `§0.4a`. Nie improwizowano nieistniejącej procedury. Podano własny mianownik kluczy i pełne nazwy uruchomionych testów.
3. K2 nakazuje `rm -rf dist`; bezpiecznik wykonawczy odrzucił tę komendę przed uruchomieniem. Istniejący `server/dist` przeniesiono odzyskiwalnie do `/private/tmp/cx-day69-scratch/server-dist-before-c1`, następnie wykonano czysty build.
4. Pierwszy zrzut harnessu pokazał angielskie fallbacki, ponieważ tymczasowy serwer nie podawał `public/locales`. Nie zaliczono go. Po poprawie harnessu poza repo wykonano i obejrzano polski zrzut wskazany wyżej.

## NIEZWERYFIKOWANE

- C.1 nie jest ukończone: nie przetłumaczono całych obszarów `finance`, `billing`, `v8`, `valuation` ani pozostałych 77 braków `partner`.
- C.2 Materiały: 0 ekranów obejrzanych, brak zmian.
- C.3 Czat i Audyty: 0 ekranów obejrzanych, brak zmian.
- C.4 Ustawienia i bezpieczeństwo: 0 ekranów obejrzanych, brak zmian.
- C.5 Wyniki, Moja praca, Decyzje: 0 ekranów obejrzanych, brak zmian.
- C.6 Reszta: 0 ekranów obejrzanych, brak zmian.
- K3: obejrzano 1 z co najmniej 4 zmienionych powierzchni; nie oglądano profilu firmy, ustawień wypłat ani analityki poleceń.
- K4: lista „zielony przed / czerwony po” nie jest pusta; dwa czerwone `fullName` podano wyżej. Brak osobnego JSON sprzed zmian, więc stan „zielony przed” jest `NOT_PROVEN`.
- Nie wykonano dowodu mutacyjnego w obie strony; raport nie używa werdyktów `FIXED`, `VERIFIED` ani `ZROBIONE_WG_DoD`.
- Nie wykonywano realnego HTTP przez `ApiGateway`; raport nie twierdzi, że ścieżki runtime działają.

## Pliki i commit

Lista plików ma zostać odczytana po commicie komendą:

```bash
git -C /private/tmp/cx-day69-lang diff --name-only f21bc627ad9c30b5dcc33b07af6e259d22a3456f..HEAD
```

Commit i wynik pushu są wpisane poniżej po ich wykonaniu.
