# CODEX DAY 314 — kontrakt kart, rodzina siedmiu typów

Stan roboczy. Baza: `bc18bc7acac2ec825ebb3db2f1309738ab034d58`; gałąź bazowa uciekła do przodu wyłącznie o dokumenty instrukcji. Flaga `ff.cardContract` pozostaje default OFF.

## Wejście

Marker:

```text
MARKER OK
bc18bc7acac2ec825ebb3db2f1309738ab034d58
```

Porty 5470 i 6330 były wolne przed startem. Dysk: 76 GiB wolnego. Kontener: `cx-day314-pg`, `pgvector/pgvector:pg16`, baza `cx314` na `127.0.0.1:6330`. Pierwszy przebieg migracji zakończył się `Postgres migrations complete`; drugi: `Applying migrations: 0` i `Postgres migrations complete`.

SMTP: środowisko `BRAK ZMIENNYCH POCZTY`; `SELECT ... FROM settings WHERE key LIKE 'smtp%'` zwrócił 0 wierszy; `Gateway.ts` nie zawiera drenażu outboxu.

## R1 — pomiar PRZED naprawą

Źródło liczb: `scripts/dev/grafika-zrzuty.mjs --zlicz`; JSON: `/private/tmp/cx-day314-kontrakt-kart-rodzina-artefakty/off.json` i `on.json`. PNG: katalogi `OFF` i `ON` obok JSON. Wszystkie liczby są identyczne w light i dark.

| Typ | Sekcje OFF | Sekcje ON | Grupy OFF | Grupy ON | Różnica sekcji/grup |
|---|---:|---:|---:|---:|---:|
| Initiative | 24 | 24 | 5 | 5 | 0 / 0 |
| Task | 8 | 4 | 0 | 0 | -4 / 0 |
| Decision | 6 | 4 | 0 | 0 | -2 / 0 |
| Notification | 3 | 2 | 0 | 0 | -1 / 0 |
| Insight | 22 | 10 | 5 | 3 | -12 / -2 |
| Interview | 8 | 3 | 3 | 1 | -5 / -2 |
| Tool | 4 | 3 | 3 | 2 | -1 / -1 |

Każdy z 14 wariantów light/dark ma własny plik PNG wskazany w polu `plik` JSON. Pary są różne: Initiative 0.8112/0.8116%, Task 0.3195/0.3196%, Decision 0.0950/0.0950%, Notification 0.1486/0.1482%, Insight 4.5011/7.6164%, Interview 11.0955/11.0684%, Tool 0.3841/0.3842% (light/dark).

Kontrola przyrządu na `karta-task`: bez rozwijania tekst 1081 znaków, z `--rozwin-sekcje=1 --cofnij-jesli-skraca=1` 1363; licznik w obu 8/0. Rozwijanie nie skróciło treści. Walidator oznaczył jednak wszystkie kadry jako `wynik BRAK`, bo menu `Więcej`/`Sekcje`/`Analizuj` pozostały `aria-expanded=false`. PNG i liczniki powstały, ale kompletność rozwinięcia kadru jest `PARTIAL`, nie PASS.

## R2 — przyczyna per typ

Inicjatywa jest zdrowa: puste `INITIATIVE_CONTRACT_HIDDEN_SEED` i permutacja 24 id. Dla każdego z sześciu pozostałych typów przyczyna jest taka sama, potwierdzona w jego własnym kontrakcie: `sets[0].cards = defaultCards` jest zamkniętą allowlistą; konsument przekazuje spec przy ON; `useCardLayout.ts:80-94` zamienia pierwszy zestaw w `visibleSet`; `NModeLeftNav` renderuje tylko widoczne id. Insight ma dodatkowy żywy `hiddenSectionIds`, ale w fiksturze startuje jako pusty; zmierzona strata 22→10 pochodzi z `spec`.

Korekty wobec instrukcji: uchwyt grup to `[data-nmode-section-group]`, nie nieistniejący `data-nmode-group`. Macierz JSON wymienia 7 ekranów, zaś katalog zawiera 8 plików przez dodatkowy `karta-task-pelna`.

Dokładne punkty zwężenia: Task `taskCardContract.ts:368` → `TaskDetailView.tsx:4776`; Decision `decisionCardContract.ts:282` → `DecisionDetailView.tsx:1721`; Notification `notificationCardContract.ts:263` → `NotificationDetailView.tsx:2486`; Insight `insightCardContract.ts:827` → `InsightViewer.tsx:1452` i synchronizacja `hiddenSectionIds`; Interview `interviewCardContract.ts:329` → `InterviewWorkspace.tsx:1965`; Tool `toolCards.contract.ts:203` → `KnownToolDetailView.tsx:1976`. Wspólny punkt tylko do odczytu: `useCardLayout.ts:80-94`.

Uboższy hook Decision jest defektem spójności rodziny: obsługuje env i URL, ale nie `localStorage ff.cardContract`, więc wspólny klucz nie włącza Decision tak jak pozostałych typów. Nie zmieniłem go, ponieważ nie wpływał na zamówiony pomiar URL, a zakres naprawy dotyczył utraty sekcji.

## R3 — naprawa i pomiar PO

Pierwszy zestaw Task/Decision/Notification/Interview/Tool zawiera teraz wszystkie id; węższy zestaw pozostał jako jawny preset `core`. Insight czyta zastany `DEFAULT_CARD_SETS.insight` i zachowuje dokładnie widoczne id OFF oraz jego dotychczasowe extras. Po naprawie, w obu motywach:

| Typ | Sekcje OFF | Sekcje ON PO | Grupy OFF | Grupy ON PO | Werdykt |
|---|---:|---:|---:|---:|---|
| Initiative | 24 | 24 | 5 | 5 | zachowane |
| Task | 8 | 8 | 0 | 0 | zachowane |
| Decision | 6 | 6 | 0 | 0 | zachowane |
| Notification | 3 | 3 | 0 | 0 | zachowane |
| Insight | 22 | 22 | 5 | 5 | zachowane; próba pośrednia 25/5 została odrzucona |
| Interview | 8 | 8 | 3 | 3 | zachowane |
| Tool | 4 | 4 | 3 | 3 | zachowane |

## R4 — bezpieczniki i mutacje

Dodano 6 plików × 4 pełne przypadki M1–M4. Czysty pakiet `tests/unit/cards/`: 24/24 PASS, `--retry=0`. Mutacja Task `allCards → defaultCards`: dokładnie M2 RED (3/4 PASS), po `cp` 4/4 PASS. Mutacje Decision/Notification/Insight/Interview/Tool: dokładnie pięć M2 RED (15/20 PASS), po `cp` 24/24 PASS. Finalna mutacja ochrony Insight `preservedDefaultCards → defaultCards`: dokładnie Insight M2 RED (3/4 PASS), po `cp` 24/24 PASS. JSON-y leżą w katalogu artefaktów.

Pomiar nazw: `przed-nazwy.txt` zawiera 18 nazw, `po-nazwy.txt` 42 nazwy; dodano 24 nazwy, żadna nie zniknęła. Zbiorczy przebieg miał 38/42: wszystkie 30 testów kontraktów (6 Initiative + 24 nowe) przeszły, natomiast 4 zastane testy `NModeShell owner action hierarchy` padły na `null` w `NModeHeader.ownerActions.test.tsx:147/167`. Nie zmieniałem globalnego setupu ani tych testów; stan całej suity jest PARTIAL, nie zielony.

## R5 — niepusty szablon

Harness dostał opt-in `?szablon=quick-win`, montujący realny `InitiativeDocumentView` na rekordzie `init-smed-linia-pakowania` i zwracający niepusty `visibleSections`. Pomiar: OFF 6 sekcji/3 grupy, ON 6/3, light i dark. Pary są bajtowo identyczne.

**„Przy niepustym szablonie komplet 24 sekcji nie jest osiągalny — szablon redukuje kartę do 6 sekcji/3 grup przed kontraktem, więc konflikt oczekiwania kompletności ze świadomym filtrem szablonu wymaga decyzji właściciela.”**

## R6 — kanon kolejności grup

`ARTIFACT_ANATOMY_STANDARD.md` §12 opisuje lokalizację i sposób nawigacji, a §13.1 określa bazową nawigację rekordu oraz kluczowe sekcje prawego panelu. Dokument nie ustala kolejności pięciu grup lewej nawigacji Inicjatywy. Nie zmieniłem kolejności.

Pytanie do właściciela: czy zatwierdzasz obecną kolejność `Zakres i plan → Decyzje i ryzyko → Rezultaty → Ludzie → Zapisy` jako kanoniczną kolejność grup lewej nawigacji?

## Pary zrzutów do oceny

Pliki light (dark są w tych samych katalogach):

| Typ | OFF SHA-256 | ON PO SHA-256 | Porównanie |
|---|---|---|---|
| Initiative | `0cf20b00…602` | `cbbfedc2…150` | różne 0.8112% |
| Task | `141349f1…0925` | `141349f1…0925` | IDENTYCZNE — kontrakt po naprawie nie zmienia renderu |
| Decision | `9f7e7046…119` | `9f7e7046…119` | IDENTYCZNE — kontrakt po naprawie nie zmienia renderu |
| Notification | `e9774895…570` | `383da84f…d12` | różne 0.0444% |
| Insight | `929fef28…9111` | `929fef28…9111` | IDENTYCZNE — dokładna widoczność OFF |
| Interview | `d30d9f76…d7d7` | `bde02196…e15` | różne 10.9437% |
| Tool | `4e2c089d…15` | `4e2c089d…15` | IDENTYCZNE — kontrakt po naprawie nie zmienia renderu |

Pełne ścieżki i sumy: `/private/tmp/cx-day314-kontrakt-kart-rodzina-artefakty/{OFF,FIXED-ON,FIXED2-ON}`. Identyczne pary nie są materiałem pokazującym zmianę wizualną; są dowodem, że flaga nie zmienia renderowanego elementu po usunięciu zwężenia. Kadry mają ograniczenie `PARTIAL` opisane w R1 (walidator rozwinięcia menu).

## Bramki

Przed i po: `check-artefakt` — brak nowych naruszeń (8, baseline 9); `check-focus-canon --ci` — OK, 41 plików/60 wystąpień; `check-list-canon` — brak nowych naruszeń, pełny fallback scan 157 plików, 368 = baseline 368.

Flaga kończy dyżur jako default OFF; gałąź NIE jest scalona i czeka na akcept właściciela na zrzutach.

Deklaracja Z30: „Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.”

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie wykonano odbioru przez właściciela; flaga pozostaje OFF.
- Nie udowodniono, że identyczne pary spełniają intencję wizualną właściciela; dowodzą jedynie braku różnicy w kadrze.
- Cztery zastane testy NModeShell są czerwone w przebiegu zbiorczym; przyczyna nie została zdiagnozowana w tym dyżurze.
- Nie sprawdzono trwałości układu po istniejących zapisach `localStorage` użytkownika; harness startuje w czystym kontekście.
