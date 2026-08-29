# CODEX DAY 74 — FINANSE — DOWÓD MERYTORYCZNY

Data pomiaru: 2026-08-29  
Marker: `b4c883b9ec488b12733839820304bbba6f8be640`  
Gałąź: `codex/day74-finance-proof-20260829`  
Werdykt: **PARTIAL — 4 z 5 wnętrz pokazują liczby; Sprawozdanie nie otwiera treści; raport zarządczy nie istnieje na tej powierzchni.**

## 1. Związanie środowiska

Wynik §0.1(2), dosłownie:

```text
8d254e6bae docs(instrukcje): dyzur 74 (Finanse — dowod merytoryczny) i 75 (naprawa licznikow migracji)
b4c883b9ec docs(ledger): DEC-292/293 odbior dyzuru 73 — uczciwe 16/20, modul pokazuje realna wartosc
48fe3a11c7 merge: dyzur 73 Wykonanie — uczciwe 16/20, cztery warianty nieosiagalne
e53d85f642 docs(day73): resume execution owner evidence after correction
53f22ac43c docs: DEC-288..291 uwaga wlasciciela o tabeli zewnetrznej, silnik POLICZYL CD Projekt, odbior 72, naprawa 0.4a
b9036590db merge: dyzur 72 Wyniki — 20/20 zrzutow, modul mial zero dowodow
558a3437e2 docs(ledger): DEC-287 checkpoint 69 — 3/3 formattery, mianowniki w raporcie
094f021c1a merge: dyzur 69 checkpoint — 3/3 formattery pl-PL, finance 207->131
95d4c96836 docs: DEC-282..286 dyzur 70 domkniety 20/20, poprawka 73, znaleziska z Finansow
af4281d3c3 docs(results): record day72 final K4
92e2259f19 merge: dyzur 73 — BLOCKED_AT_FIXTURE, blad instrukcji (migracje sa w komendzie provision)
a5710a93a8 merge: dyzur 70 DOMKNIETY technicznie — 20/20 zrzutow, naprawa stalej migracji
61b902b046 docs(results): add day72 owner evidence packet
33fa84c468 fix(i18n): domknij format kwot partnera
fc72f0cff1 docs(day73): resume execution owner fixture stop
1751ce02d9 docs(ledger): DEC-280/281 kontynuacja 69, duplikat potwierdzony, trzeci formatter en-IE
40e1024cb6 merge: dyzur 69 kontynuacja — format pl-PL, duplikat wartosci potwierdzony
39185afd9b docs(finance): close day70 technical owner packet
b3274f2be6 fix(i18n): ujednolic polskie kwoty partnera
b8fa285c83 docs: dyzury 72 (Wyniki) i 73 (Wykonanie) + DEC-277..279 dysk, przypiete migracje, wydanie
d3010f3da9 fix(finance): accept current migration ledger in owner fixture
b57253c039 docs(ledger): DEC-271..276 AKCEPT wlasciciela UI Partnera + odbior 69/70/71 + licencja na stala migracji
b48dc4ddc4 merge: dyzur 70 proba 3 — trzeci STOP, stala 834 w seederze
8c33ea26ea merge: dyzur 71 — bramka C.1 zatrzymala ryzykowna zmiane, K4 FAIL
3b86048090 merge: dyzur 69 proba 2 — K4 zwolnione, ekran Prowizji po polsku, akcept wlasciciela
MARKER OK
```

Wynik §0.1(7), dosłownie:

```text
b4c883b9ec488b12733839820304bbba6f8be640
```

`git status --short | head -3` nie wypisał żadnej linii. Wolne miejsce: `97 GiB` z progiem `5 GiB`. Porty `5946` i `4680`: `0 z 2` zajętych. Tip uciekł o `1 z 1` commitów; różnica obejmuje wyłącznie dwie instrukcje dnia 74/75, więc zgodnie z §0.1 start nastąpił dokładnie z markera.

## 2. Fixture, readback i Z30

Kontener: `cx-day74-pg`, wyłącznie `127.0.0.1:5946`, obraz `pgvector/pgvector:pg16`, administracyjna baza startowa `postgres`. Seeder sam utworzył i zmigrował `consultify_w3_finance_owner_day74`.

Readback po seedzie i osobny cold readback zwróciły identyczny wynik:

```json
{"fixtureId":"W3-FINANCE-OWNER-v1","databaseName":"consultify_w3_finance_owner_day74","readback":{"migrations":863,"approvedVersions":5,"statements":6,"sourceReceipts":6,"baselineContexts":1,"lifecycleHashRunIdentityVerified":true}}
```

To jest `863 z 863` migracji, `5 z 5` zatwierdzonych wersji, `6 z 6` sprawozdań, `6 z 6` receiptów źródłowych i `1 z 1` kontekstów bazowych. Manifest ma `ownershipState: FINAL`. Runtime: health/readiness/frontend `200/200/200`, marker klienta i SQL `2 z 2`, `ENABLE_TEST_AUTH_BYPASS=false`, prawdziwy login OWNER.

Dowody Z30 przed użyciem UI:

```text
BRAK ZMIENNYCH POCZTY

 key | left
-----+------
(0 rows)
```

`grep` drenaży w `server/src/Gateway.ts`: `0 z 3` wzorców. **Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.** Runtime wystartował przez narzucony `start-wave3-owner-runtime.mjs`; manifest runtime potwierdza izolację dotenv i brak zabronionych kluczy w `5 z 5` procesach grupy.

Pułapki Z33: (a) wyłączona przez `ENABLE_V8_GLOBAL=true` i manifest `v8GlobalEnabled:true`; (b) nie leży na ścieżce Finansów; (c) seed wymusił realny PostgreSQL i cold readback z bazy na porcie 5946; (d) wyłączona przez `ENABLE_TEST_AUTH_BYPASS=false`, manifest `enableTestAuthBypass:false`, log zawiera `AuthMiddleware Token extracted: YES`; (e) wszystkie `5 z 5` adresów pochodzi z bieżącego manifestu i zawiera `?ff_wave3FinanceOwnerReview=1`.

## 3. Pięć wnętrz — liczby, nie listy

| Wnętrze | Pomiar produktu | Werdykt |
| --- | --- | --- |
| Sprawozdanie | Manifest/fixture ma `6 z 6` pozycji: P&L, BS i CF po `2 z 2` okresy (`2024`, `2025`), wszystkie `6 z 6` z SHA PDF `e993f390ccf5d67143b1076ef7b6d9eed23f234f1c29dc23892eeb57418e3c0e`. UI listy pokazuje `CD PROJEKT S.A.`, `6` dokumentów i okres `2025`. Po wejściu do wnętrza UI pokazuje jednak `0 z 6` wartości i komunikaty: „Nie można otworzyć tego rekordu w nowym module” oraz „Ten rekord jeszcze nie ma odpowiednika w nowym systemie”. | **FAIL / liczby wnętrza 0 z wymaganych**. Trzy próby: deep link → lista, wybór rekordu → preview, `Open` → uczciwy nagrobek. Źródło komunikatu: `src/components/Finance/shared/FinanceLegacyBridgeGate.tsx:88,93`. |
| Analiza | `Current Ratio = 3` za `1 z 1` widocznych okresów (`FY2025`). Inne policzone wskaźniki: `0 z 0`; tabela ma dokładnie `1 z 1` wiersz KPI. Dwa starsze endpointy ratio zwróciły `404`, po czym kanoniczne `/api/v8/finance-v2/analysis/.../kpi-values` wyrenderowało wartość. | **PASS z ustaleniem K4**: lista `OKRESY=0` nie opisuje treści; wnętrze ma `1` okres. |
| Model bazowy | Horyzont miesięczny `12 z 12` okresów (`1/2026`–`12/2026`). Założenia: `9 z 9` wierszy. Widoczne wartości m.in. wzrost przychodów `0,05`, COGS/przychody `0,6483516483516484`, OPEX/przychody `0,18681318681318682`, CIT `0,19`, CAPEX/przychody `0,04945054945054945`, DSO `52,14285714285714` dni, DIO `60,317796610169495` dni, DPO `54,131355932203384` dni. Wyjście: `31 z 31` wierszy (`10` P&L + `15` BS + `6` CF) × `12` okresów = `372 z 372` wartości. Przykłady: przychody `15 925 000` w każdym z `12 z 12` miesięcy; wynik netto `1 523 623,5` → `1 540 790,907`; gotówka `10 797 682,64` → `16 975 375,279`; FCF `472 682,64` → `2 310 725,897`. | **PARTIAL względem tezy „7 rodzin widocznych”**: ekran pokazuje `5 z 5` nazwanych rodzin założeń i `3 z 3` rodzin sprawozdań, ale nie pokazuje osobnej listy `7 z 7` rodzin harmonogramów. `372 z 372` i `12 z 12` są widoczne. |
| Prognoza | Scenariusz `Base` / `Standardowy`, passthrough baseline, `12 z 12` okresów. Tabela porównawcza ma `30 z 30` linii × `12 z 12` okresów = `360 z 360` wierszy; wszystkie Δ `0` i `0,0%` (Base = Baseline). Przykłady: REVENUE `15 925 000`; CAPEX `787 500`; CASH od `10 797 682,64` do `16 975 375,279`; TOTAL_ASSETS od `159 377 857,371` do `167 725 405,379`. | **PASS** dla realnych liczb; UI jednocześnie pokazuje „Nieaktualne — zmieniono założenia od ostatniego przeliczenia”, więc nie nazywam prognozy świeżą. |
| Wycena | Metoda `DCF (FCFF)`, `1 z 1` gotowych metod. EV = `-6 422 709,196 PLN` (nagłówek zaokrągla do `-6 422 709`). WACC `8,925849999999999%`, stopa wolna od ryzyka `4%`, waluta `PLN`, nominalna, po opodatkowaniu, źródło Baseline przez `4 z 4` powiązania lineage. Most EV→Equity: `0 z 1` (brak zapisanego mostu). | **PASS dla kwoty DCF; PARTIAL dla kompletności wyceny** z powodu braku mostu EV→Equity. |

Dowód ekranowy: `5 z 5` deep linków otwarto jako OWNER w jasnym motywie i zapisano `5 z 5` pełnostronicowych PNG. Sprawozdanie jest screenshotem uczciwego błędu wnętrza, nie listą udającą sukces.

## 4. K4 — `OKRESY = 0` kontra obliczona analiza

Rozstrzygnięcie: **kolumna listy jest niezgodna z wnętrzem**. Lista raportuje `0` okresów, lecz kanoniczne wnętrze Analizy pokazuje kolumnę `FY2025`, `Current Ratio = 3` i `1 z 1` wiersz KPI. Nie naprawiano kodu.

## 5. B.3 — raport zarządczy

### STOP — raport zarządczy
Rodzaj: MERYTORYCZNY  
Powód: Na `0 z 5` wnętrz istnieje przycisk lub tekst „Management report”; trzy niezależne ślady (pięć DOM-ów, grep frontendowy, karta Eksport) nie dały pliku.  
Licencja, którą sprawdziłem: §D pozwala zapisać wyłącznie raport i `MODULE_ACCEPTANCE.md`, a Z40 zakazuje zmiany kodu; pomiar UI i źródła jest tylko do odczytu.  
Dowód: licznik browsera `buttons=0, texts=0` na każdym z `5 z 5` deep linków; `src/components/Finance/Valuation/steps/ExportStep.tsx:21` renderuje „Eksport wyceny nie jest dziś dostępny”; karta wyjaśnia brak endpointu eksportu wyceny.  
Co dostarczyłem ZAMIAST zmiany: screenshot karty Eksport i statyczny odczyt źródła; plik wynikowy `0 z 1`, format/rozmiar/strony `NIE DOTYCZY`, bo produkt niczego nie wygenerował.  
Co zrobiłbym, gdyby zapadła decyzja X: po udostępnieniu jawnego, tenantowego endpointu i przycisku ponowiłbym generację dla Modelu lub Wyceny, policzył strony/arkusze i porównał liczby z UI.  
Rekomendacja dla nadzorcy: osobna decyzja produktowa o źródle, formacie i bramce eksportu; nie podpinać ogólnego `REPORT_EXPORT` bez kontraktu Finansów.  
Stan: zacommitowano wyłącznie dokumentację.  
Czy kontynuowałem pozostałe pozycje: TAK — `5 z 5` wnętrz zmierzono przed STOP-em B.3.

## 6. Artefakty poza repo

| Plik | SHA-256 |
| --- | --- |
| `/private/tmp/cx-day74-artefakty/01-statement.png` | `39c18acca391d6106f2d1a090da7d0fe2809381d1dafae2f5f55d711f4c49deb` |
| `/private/tmp/cx-day74-artefakty/02-analysis.png` | `8583e66fbbe9b3f66eb19da0b5d3ec0fd2c6b0cc0e7b23bd895a2fa4fa6f7f08` |
| `/private/tmp/cx-day74-artefakty/03-model.png` | `39585aa0b78d3cdfe4ddc5df15c777f131d66d68e652fa8ffeee68d72abea059` |
| `/private/tmp/cx-day74-artefakty/04-prediction.png` | `dc1180f43eb614189c769650e471c7111e81a24d42855c604c2ea866501bd529` |
| `/private/tmp/cx-day74-artefakty/05-valuation.png` | `ad3f2681d8bcdf72a72c5efad22fd881dda993600c2429dc641e83a4d0ba328d` |
| `/private/tmp/cx-day74-artefakty/06-management-report-unavailable.png` | `66b21180f941c6df4896aef39fab14674c925fd1eb5b8a5903cf47c8e90c1f05` |
| `/private/tmp/cx-day74-artefakty/finance-day74-manifest.json` | `1d043ea33acc7770ef2a01e854ab88101e961c38c1df6126ab0d2113cb89142f` |

## 7. Korekty wobec instrukcji

1. §0.2c(A) mówi: `POSTGRES_DB=consultify_w3_finance_owner_day74` i ręczne dwa przebiegi migratora. §B.1 mówi: `POSTGRES_DB=postgres`, „NIE tworzysz bazy”, „NIE uruchamiasz migracji ręcznie”, bo seed robi create/migrate. Zastosowano późniejszą, jawnie „wiążącą” sekwencję §B.1. Wynik: seeder i cold readback zielone, `863 z 863`.
2. §B.2 tezuje, że Sprawozdanie pokaże liczby. Pomiar obalił tezę: deep link kończy się nagrobkiem legacy bridge i pokazuje `0 z 6` wartości.
3. §B.2 tezuje, że siedem rodzin harmonogramów jest widocznych. Pomiar pokazuje `372 z 372` wartości w `31 z 31` wierszach i `12 z 12` okresach, ale nie osobny komplet `7 z 7` nazw rodzin.
4. §B.3 mówi, że „na ekranach modułu jest przycisk Management report”. Pomiar na `5 z 5` wnętrz daje `0 z 5`; karta eksportu wyceny jawnie deklaruje brak eksportu i endpointu.

## 8. Kryteria końcowe

| Kryterium | Stan |
| --- | --- |
| K1 readback | **PASS**, zielony cold readback `863/5/6/6/1` |
| K2 pięć wnętrz i zrzutów | **PASS techniczny 5 z 5**, przy czym `1 z 5` wnętrz kończy się uczciwym błędem |
| K3 konkretne liczby | **PARTIAL 4 z 5**; Sprawozdanie nie pokazuje liczb we wnętrzu |
| K4 `OKRESY=0` | **ROZSTRZYGNIĘTE**: wnętrze ma `1 z 1` okres (`FY2025`) |
| K5 raport zarządczy | **STOP MERYTORYCZNY**: przycisk `0 z 5`, plik `0 z 1` |
| K6 rozłączność | **PASS**: wyłącznie ten raport i `MODULE_ACCEPTANCE.md`; `0` plików `src/`/`server/src/` |

## 9. Zakres twierdzeń HTTP

Runtime i frontend zwróciły `200/200/200`, login przeszedł przez realne `verifyToken`, a log potwierdza zapytania kanoniczne `/api/v8/finance-v2/**`. Logger zapisuje pełny kod tylko dla błędów: legacy fallbacki zwróciły `404` (Analiza `2 z 2`, Model `4 z 4`, Prognoza `4 z 4`, Wycena wielokrotnie), podczas gdy kanoniczne dane zostały wyrenderowane. Nie relabeluję samego braku błędu jako osobnego pomiaru kodu `200`; sukces wnętrz dowodzę renderem liczb, realnym auth i readbackiem PG.

