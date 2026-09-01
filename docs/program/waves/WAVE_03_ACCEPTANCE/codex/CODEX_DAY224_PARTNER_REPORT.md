# CODEX DAY224 — Partner

Data: 2026-09-01  
Baza źródłowa: `0a35699021`  
Gałąź: `codex/day224-partner-20260901`

## 1. Wejście: §0.1 (2) i (7)

```text
0a35699021 odbior 231: SCALONE po FIX-231 — konspekt powstaje Z WIEDZY ORGANIZACJI (para rozstrzygajaca); stempel pochodzenia przestal klamac; zrodla realnie sie dopinaja
...
MARKER OK
0a3569902119880841d30e0e5fac57879d1e5be0
```

`git status --short | head -3` po utworzeniu worktree: brak wyjścia. Tip gałęzi bazowej
uciekł o jeden commit instrukcyjny `a052ae1f7f`; diff marker→tip obejmował wyłącznie
instrukcje dyżurów 224/225/230/232.

## 2. W1–W10

- W1: trasa earnings-summary łapie `PARTNER_ACCRUAL_POLICY_BLOCKED_OWNER` i zwraca
  `reason: 'POLICY_NOT_APPROVED'` zamiast rzucać.
- W2: `EarningsSection` ustawia błąd tylko, gdy summary jest odrzucone lub nie daje się
  znormalizować. W żywym przebiegu summary było spełnione; gałąź `error && !summary`
  nie wystąpiła.
- W3: wywołanie Organizations nie miało `minTableWidth` przed Day224.
- W4: `DEFAULT_MIN_TABLE_WIDTH=980`, `AUTO_MIN_WIDTH_COLUMN_THRESHOLD=2`; plik tylko
  odczytany.
- W5: własny pomiar: 26 plików z `<FilterableTable`, 10 plików z `minTableWidth` poza
  testami. Instrukcyjne „26 wywołań” jest przybliżeniem liczby plików, nie ścisłym
  pomiarem elementów JSX.
- W6: `getPartnerClients` wykonuje realne batched `COUNT(*)` dla `users`, ostrzega i
  stosuje fallback 0 wyłącznie po błędzie.
- W7: kanoniczny skrypt przyjął przydzielone porty serwer/client `5122/5123`.
- W8: gate pozostaje `TECHNICAL_BROWSER_PASS / OWNER_PENDING / ECONOMICS_OFF`.
- W9: AMD-PRT-ECONOMICS-002 i `410 PARTNER_ECONOMICS_POLICY_DISABLED` nietknięte.
- W10: przed startem `6167/5122/5123 wolne`; potem wyłącznie `cx-day224-pg` na
  `127.0.0.1:6167` oraz kanoniczny runtime na `5122/5123`.

Migracje `cx224`: pierwszy przebieg zakończony `Postgres migrations complete`; drugi:
`Applying migrations: 0`. SMTP: `BRAK ZMIENNYCH POCZTY`, tabela `settings` zwróciła
`0 rows`, a `Gateway.ts` nie zawiera drenażu outboxu.

## 3. §A.1 — żywy stan Earnings

Wynik **(b)**. Stary bursztynowy baner z dnia 189 nie jest już osiągalny tą ścieżką
po fixie 188; żywy ekran pokazuje normalny widok z zerami informacyjnymi i komunikatem,
że accrual/payout są niedostępne. Nie jest to dowód działania silnika ekonomii.

Kod: `EarningsSection.tsx` renderuje baner tylko pod `if (error && !summary)`, natomiast
`partner.routes.ts` zamienia blokadę polityki na `payoutEligibility.reason =
'POLICY_NOT_APPROVED'` przy odpowiedzi 200.

Artefakty PNG:

- `/private/tmp/cx-day224-partner-artefakty/true-png/earnings-dark-1280.png` —
  `f8b4a501da8ed19f8c16ee488c65291f315b7b53b68b59c3dad14e6c005179b6`
- `/private/tmp/cx-day224-partner-artefakty/true-png/earnings-light-1280.png` —
  `57d4d5bf3b340e136e1ca364187de01864399ad9423b8c30eb5a870a2837c279`

Motywy realnie różne: `YAVG dark=41.7287`, `YAVG light=225.907`.

Deklaracja §0.2b: „Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego
dyżuru nie zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts`
wyłącznie przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej
bazie dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log
serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani
powiadomienie zewnętrzne nie zostało wysłane.”

## 4. §A.2 — Organizations

Zmiana: wyłącznie `minTableWidth="auto"` w jednym wywołaniu Organizations.

Dowód mutacyjny (`--retry=0`):

1. przed propem: `1 failed`, brak `minTableWidth="auto"`;
2. po propie: `1 passed`;
3. cofnięcie produkcji przez kopię: `1 failed`;
4. przywrócenie: `1 passed`.

Artefakty:

- 1280: `/private/tmp/cx-day224-partner-artefakty/true-png/organizations-light-1280.png`
  — `74cb7d0d46b0ebb0472d53e73e46777bb279ab815dc5e06bc1ab462fa69ad0a0`;
  wszystkie sześć kolumn i Status widoczne.
- 375: `/private/tmp/cx-day224-partner-artefakty/true-png/organizations-light-mobile-375.png`
  — `efbc8e6c1f80c7aef14ee6995b32ca8e66a6e850963ac4917c324b82a900f4d9`;
  Status nie jest widoczny, tabela nadal wymaga przewijania.

### STOP — §A.2 mobile

Rodzaj: MERYTORYCZNY  
Powód: `minTableWidth="auto"` usuwa próg 980 px, ale sześć kolumn o własnych
szerokościach nadal nie mieści się przy 375 px.  
Licencja, którą sprawdziłem: zapis do `PartnerPortalView.tsx` pozwala wyłącznie dopisać
jeden prop; `FilterableTable.tsx` jest tylko do odczytu.  
Dowód: zrzut mobile i DOM zawierający sześć nagłówków, podczas gdy kadr pokazuje tylko
lewą część tabeli.  
Co dostarczyłem ZAMIAST zmiany: prop, test regresyjny, zrzuty 1280/mobile i brief.  
Co zrobiłbym, gdyby zapadła decyzja X: osobny kontrakt responsywny ustaliłby ukrywanie,
stackowanie albo jawne przewijanie kolumn na mobile, z testem sticky Status.  
Rekomendacja dla nadzorcy: nie zamykać PRT-D112-003 dla mobile; otworzyć wąski dyżur
responsive dla tabeli Partner Organizations.  
Stan: zacommitowano poprawę 1280; mobile `PARTIAL`.  
Czy kontynuowałem pozostałe pozycje: TAK — §A.3 i raport ukończone.

## 5. §A.3 — Users: 0

Werdykt: **Users: 0 to UCZCIWA LICZBA / DANE FIXTURE**.

Organizacja zwrócona i widoczna w UI: `b1600000-0000-4000-8000-000000000003`
(`Wave 3 Referred Participant`). Dowody:

```sql
SELECT COUNT(*) FROM users
WHERE organization_id='b1600000-0000-4000-8000-000000000003';
-- 0

SELECT id FROM organizations
WHERE id='b1600000-0000-4000-8000-000000000003';
-- dokładnie 1 wiersz
```

Log żywego żądania zawiera `GET /api/v8/partner/clients` oraz
`[AuthMiddleware] Verifying token for path: /partner/clients`; nie zawiera
`getPartnerClients user counts failed`. UI pokazuje `Users = 0`. To nie jest sierota
ani połknięty błąd zapytania. Real-PG kontrakt usługi dodatkowo wstawił jednego
użytkownika klienta i otrzymał `users=1`, `userCount=1`, bez warn.

## 6. §0.4a — nazwy testów

Artefakty: `przed-nazwy.txt`, `po-nazwy.txt`. Diff nazw dodał dokładnie:

- `Day 224 Partner client user counts on real PostgreSQL returns the real users COUNT without falling back through the warning path`
- `Day 224 Partner organizations table width contract passes minTableWidth="auto" to the organizations FilterableTable`

Nazwy zniknięte: brak. Nowe testy końcowe: `1/1` UI i `1/1` RealPG. Zastany pakiet
Day188 ma przed i po identyczne `5/5 FAIL`: wszystkie żądania kończą się 401, mimo
`ENABLE_TEST_AUTH_BYPASS=false`; nie jest przedstawiany jako zieleń ani naprawiany poza
licencją Day224.

Pułapki Z33: UI nie mierzy auth/DB i asertuje deterministyczny prop, bo JSDOM nie ma
wiarygodnego layoutu. RealPG ma `DB_TYPE=postgres`, jawny `DATABASE_URL` loopback,
`RUN_DB_TESTS=1`, `MOCK_DB=false`, `ENABLE_V8_GLOBAL=true`,
`ENABLE_TEST_AUTH_BYPASS=false`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`
i `--retry=0`; strażnik wywołano bez argumentów.

## 7. Korekty wobec instrukcji

1. Kanoniczny runtime w `adopt-existing` odrzuca nazwę `cx224`; wymaga
   `consultify_w3_partner_owner_*`. Bez zmiany skryptu utworzono drugi database
   `consultify_w3_partner_owner_day224` w tym samym wyłącznym kontenerze i na tym samym
   porcie 6167. `cx224` pozostał bazą testów.
2. Zrzut API w osobnej karcie dostał klientowe `ERR_BLOCKED_BY_CLIENT`; nie obchodzono
   blokady. Osiągalność API udowodnił zalogowany konsument UI, log Gateway/Auth i SQL.
3. Narzędzie przeglądarki zwróciło JPEG mimo nazwy `.png`; przekonwertowano artefakty
   do prawdziwego PNG i zweryfikowano `file`.
4. `minTableWidth="auto"` nie spełnia mobile DoD — wynik, nie sprzeczność instrukcji.
5. Komenda testu z rootem i `--config server/vitest.config.ts` dała 0 testów; właściwy
   serwerowy root to katalog `server` z `--config vitest.config.ts`.

## 8. TWIERDZENIA NIEZWERYFIKOWANE

- Nie wykonano pełnego przejazdu wszystkich 25 powierzchni Partnera.
- Nie twierdzę, że ekonomia partnera działa; pozostaje świadomie OFF.
- Nie twierdzę, że PRT-D112-003 jest zamknięte na mobile.
- Nie rozstrzygnięto zastanego 401 w pakiecie Day188, ponieważ jest poza licencją.
