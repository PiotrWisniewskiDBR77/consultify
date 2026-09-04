# CODEX DAY 338 — kontrakty 24 sekcji karty inicjatywy

Data: 2026-09-04  
Gałąź: `codex/day338-kontrakty-24-sekcji-20260904`  
Baza: marker `74c07919ce`, nie tip gałęzi bazowej  
Werdykt: **R1–R3 ZROBIONE; R4 STOP MERYTORYCZNY po pełnym inwentarzu; R5–R7 ZROBIONE; flaga kończy OFF.**

## 1. Wejście i rozjazd bazy

Wynik markera, dosłownie:

```text
74c07919ce docs(rejestr): sekcja N — decyzje wlasciciela DEC-388..391 (szablon nie tnie karty, silnik raportu po pomiarze, narrator zostaje, kontrakt czatu obowiazuje)
MARKER OK
```

Wynik sanity, dosłownie:

```text
74c07919cea7ab55dc9fde5fbd911f7f955ed425
```

`git status --short | head -3` nie wypisał nic. Tip `github-backup/grafika/m03-20260902` uciekł do `52a041a910`; zgodnie z DEC-2026-08-26-95 pracowałem dokładnie z markera. Lista sześciu commitów i plików rozjazdu jest w `/private/tmp/cx-day338-kontrakty-24-sekcji-artefakty/input-verification.txt`.

Warunki STOP: 61 GiB wolnego po utworzeniu worktree; porty 6374/5514 były wolne przed startem; uruchomiono wyłącznie `cx-day338-pg` i harness 5514. Pełne migracje: pierwszy przebieg `Applying migrations: 894`, drugi `Applying migrations: 0`; oba zakończyły się `Postgres migrations complete`.

## 2. R1 — pomiar wejściowy

Rekord: `init-smed-linia-pakowania`; każdy stan w świeżym kontekście Playwrighta.

| Szablon | Stara flaga `cardContract` | Pozycji DOM | Grup DOM | `localStorage` |
| --- | --- | ---: | ---: | --- |
| `quick_win` | OFF | 6 | 3 | `ff.cardContract="0"`, klucz kolejności `null` |
| `quick_win` | ON | 6 | 3 | `ff.cardContract="1"`, klucz kolejności `null` |
| brak | OFF | 24 | 5 | `ff.cardContract="0"`, klucz kolejności `null` |
| brak | ON | 24 | 5 | `ff.cardContract="1"`, klucz kolejności `null` |

Własna lista braków: Harmonogram; Zależności; Produkty i kamienie milowe; Decyzje; Ryzyko i RAID; Bramy; Sugerowane zmiany; Dziennik zmian; Zespół; RACI; Właściciele strumieni; Analiza finansowa; Wpływ finansowy; OKR; Hipoteza; Zasoby; Użyte w (powiązania); Wnioski i lekcje. Rozbieżność wobec listy instrukcji: brak.

Dowody: `evidence/kompletnosc-24-sekcji-20260904/r1/`. Para niepustego szablonu OFF/ON jest bajtowo identyczna (`38781015e65430dc…`).

## 3. R2 — DEC-388

Dodano wyłącznie flagę kodową `VITE_VF1_INITIATIVE_SECTIONS_COMPLETE`, domyślnie OFF. Nie istnieje wpis w `.env*`, `docker-compose*` ani `railway*`. `visibleSections` i cztery szablony pozostały bez zmian.

| Szablon | Nowa flaga | Pozycji DOM | Grup DOM | Wynik |
| --- | --- | ---: | ---: | --- |
| `quick_win` | OFF | 6 | 3 | zastane zachowanie |
| `quick_win` | ON | 24 | 5 | komplet, wszystkie 18 dawnych braków obecne |
| brak | OFF | 24 | 5 | brak regresji |
| brak | ON | 24 | 5 | brak regresji |

Dowody: `evidence/kompletnosc-24-sekcji-20260904/r2/`. Harness montuje produkcyjny `InitiativeDocumentView`, ale podstawia transport HTTP; wynik dowodzi zachowania DOM komponentu, nie ApiGateway/JWT/PostgreSQL ani wdrożenia.

## 4. R3 — dowody mutacyjne

Mutacja 1, komenda:

```bash
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run tests/unit/initiatives/initiativeTemplateNavigationCompleteness.test.ts tests/unit/initiatives/initiativeCardContractCompleteness.test.ts --retry=0
```

Po usunięciu `lessons-learned` z `INITIATIVE_BOARD_CANONICAL_ORDER`: RED, `expected ... length 24 but got 23` oraz `expected [ 'lessons-learned' ] to deeply equal []`. Po `cp` z kopii scratch: 10/10 GREEN, `GIT DIFF PUSTY PO COFNIĘCIU MUTACJI 1`.

Mutacja 2, ta sama rodzina komendy po przywróceniu bezpośredniego `allSections.filter(...)`: RED w przypadku `widok przekazuje do selektora pełne allSections i nową flagę`; trzy testy funkcji zachowania pozostały zielone. Po `cp`: 4/4 GREEN, `GIT DIFF PUSTY PO COFNIĘCIU MUTACJI 2`.

Pełne wyniki i sumy: `/private/tmp/cx-day338-kontrakty-24-sekcji-artefakty/r3-*.log` i `shasum.txt`.

## 5. R4 — kontrakty sekcji

Pełna tabela 24/24 jest w rejestrze, sekcja „Dyżur 338 — R4”. Wynik: 15 sekcji ma jednoznaczny deskryptor lub zastany jawny alias semantyczny; 9 nie ma: `deliverables-milestones`, `suggested-changes`, `change-log`, `okr`, `hypothesis`, `workstream-owners`, `used-in`, `artifacts`, `lessons-learned`.

**STOP MERYTORYCZNY R4:** obecny `INITIATIVE_CANONICAL_CARDS` opisuje 27 kluczy registry, a board ma odrębną przestrzeń ID. Bez decyzji, czy brak ma być nową kartą, czy dodatkową przynależnością istniejącego deskryptora, dopisanie stworzyłoby równoległy kanon. Dostarczono inwentarz i rekomendację SSOT zamiast zgadywania.

## 6. R5 — archetyp REKORD

Własny pomiar: 11 wierszy §13.1; kontrakt mają 4 typy; **7 typów nie ma kontraktu**: KPI, Idea, RAID, Milestone, Change Request, Stage Gate, Action Proposal. To obala liczbę 8 ze zlecenia. Tabela ekranów, szacunków i kolejności jest w rejestrze. W jednym osobnym dyżurze realne jest KPI albo Action Proposal; pozostałe wymagają wskazania kanonicznej powierzchni lub większego zakresu.

## 7. R6 — pułapki

Decyzja czyta `ff.cardContract` (`DecisionDetailView.tsx:509,519`). Nowy test wykonuje ciało resolvera: `'1'` → ON, `'0'` → OFF, brak → OFF. Mutacja `'1'` na `return false` dała RED; po `cp` 3/3 GREEN i pusty diff widoku.

Gotowy diff migracji `v2-contract` → `v3-contract` dla Task/Decision/Notification jest zapisany jako **NIENAŁOŻONY** w rejestrze. Mechanizm nie kasuje starych danych; promień rażenia ogranicza się do układów kart tych trzech typów przy fladze ON.

## 8. R7 — DO DECYZJI WŁAŚCICIELA

| Standard §13.1 | Produkt |
| --- | --- |
| Zadania · Definicja · Wdrożenie · Ekonomia · Governance · Zespół | Zakres i plan · Decyzje i ryzyko · Rezultaty · Ludzie · Zapisy |

Kadr: `evidence/kompletnosc-24-sekcji-20260904/r2/on-niepusty.png`.

Czego konkretnie mi zabrakło, żeby rozstrzygnąć samodzielnie: brak decyzji właściciela, czy sześć nazw standardu jest docelową taksonomią wymagającą przegrupowania 24 sekcji, czy semantycznym opisem mapowalnym na pięć grup produktu.

## 9. Zasięg testów po pełnych nazwach

Komenda przed i po:

```bash
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run tests/unit/initiatives tests/unit/cards --retry=0 --reporter=json --outputFile=<przed|po>.json
```

PRZED: 353 przypadki, 337 PASS, 16 FAIL. PO: 360 przypadków, 344 PASS, 16 FAIL. `diff przed-nazwy.txt po-nazwy.txt`: 7 nazw dodanych, **0 znikniętych**. Zastane 16 FAIL nie wzrosło; pakiet pozostaje czerwony i nie jest raportowany jako PASS. Artefakty: `przed.json` SHA-256 `1260381801583907…`, `po.json` `c6d9c53e85739c0a…`, `nazwy.diff` `063ece2083e2cc10…`.

Pułapki Z33: to pakiety czysto jednostkowe (`RUN_DB_TESTS=0 MOCK_DB=true`), bez tras, V8 gate, `verifyToken` ani visibility middleware; nie są dowodem egzekucji HTTP/DB. Świeży kontekst Playwrighta i zapis kluczy `localStorage` wyłączyły pułapkę zastanego profilu.

## 10. Z30 i bezpieczeństwo

`env` → `BRAK ZMIENNYCH POCZTY`; zapytanie `settings WHERE key LIKE 'smtp%'` → 0 wierszy; `Gateway.ts` → 0 trafień drenaży. Pełny `server/src/index.ts` nie był uruchamiany; zrzuty wykonał izolowany harness Vite z transportem mockowanym.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## 11. Korekty wobec instrukcji

1. Instrukcja odwołuje się do „struktury §R.2” (B.1/R8), ale nie zawiera sekcji §R.2. Zastosowałem wszystkie jawnie wymienione pola R8 i nie wymyślałem brakującego szablonu.
2. Kontrola B.4.5 dopasowuje `decisionCardContract` w nazwie dozwolonego nowego testu `decisionCardContractFlagBehavior.day338.test.ts`, mimo że chroniony plik `decisionCardContract.ts` nie jest staged. To false positive wzorca; do commita wszedł test dozwolony przez B.1, nie chroniony kontrakt.
3. R4: pomiar wykazał 9 braków deskryptorów boardu przy uznaniu jawnych aliasów semantycznych, nie liczbę podaną z góry. Wynik został zachowany jako STOP MERYTORYCZNY.
4. Lint wybranego 12-tysięcznego widoku pozostaje czerwony na zastanym długu (m.in. 270 ostrzeżeń i błędy Prettier poza zmienianym zakresem). Nie uruchomiłem autofixu; targetowane nowe testy oraz hooki pre-commit przeszły.

## 12. Commity

- `aca814c505` — R1
- `c435eaac2a` — R2
- `73abf5c9a6` — R3
- `98d86e3c7e` — R4
- `2729e4521b` — R5
- `dff277535e` — R6
- `4051e9d329` — R7

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano wdrożenia, produkcji, demo, stagingu ani Railway — połączenia były zakazane.
- Nie wykonano dowodu realnego HTTP przez ApiGateway/JWT/PostgreSQL; dyżur jest frontowy, a harness podstawia transport.
- Nie zweryfikowano akceptacji wizualnej właściciela; flaga pozostaje OFF.
- Nie rozstrzygnięto SSOT deskryptorów registry-id vs board-id ani nazw Menu 3.
- Nie naprawiono 16 zastanych FAIL pełnego pakietu ani zastanego długu lint; nie leżały w licencji dyżuru.
