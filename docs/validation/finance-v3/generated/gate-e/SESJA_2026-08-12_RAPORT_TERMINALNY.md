# Finance v3 — raport terminalny sesji 2026-08-12

Orkiestracja: OPUS. Wykonanie: SONNET, jeden worktree = jeden agent, jawna allowlista plików.
Zasada nadrzędna sesji: **każdy pakiet weryfikowany przez agenta, który nie był jego autorem.**

---

## 1. CANDIDATE SHA

| | |
|---|---|
| Gałąź | `codex/finance-v3-complete-product-integration` |
| **Candidate SHA** | **`423cea4028`** |
| Worktree | `~/consultify-wt/fv3-product` |
| Drzewo robocze | czyste (0 niescommitowanych) |
| Stan zamrożony, nietknięty | `codex/finance-v3-closeout-fanin` @ `19b4b06934` |

**NOT PUSHED · NOT MERGED · NOT DEPLOYED · STAGING NOT VERIFIED · PRODUCTION NOT VERIFIED.**

---

## 2. GATE 0 — ODBUDOWA ZAUFANIA DO GIT: `VERIFIED`

Poprzednia sesja raportowała, że centralne `.git` zwraca „Operation not permitted" (iCloud).
**Ten stan ustąpił.** Szczegóły: `GATE_0_TRUST_REBUILD_2026-08-12.md`.

| Kontrola | Wynik |
|---|---|
| 10 gałęzi programu — czystość i zgodność tipów | wszystkie `CLEAN`, wszystkie zgodne |
| Osiągalność raportowanych SHA | wszystkie osiągalne |
| `git fsck --no-progress` | **exit 0**, wyłącznie obiekty dangling, zero uszkodzeń |
| Porównanie z kopią ratunkową (rsync po sumie kontrolnej, 5 drzew) | **0 różnic** |
| Niezależna kopia obiektów poza iCloud | `fv3-git-backup/fv3-all-20260812.bundle`, 2,0 GB, exit 0 |

**Rozstrzygnięta sprzeczność kanonu:** handoff §6 twierdził, że testy pakietu B3 są
„niezacommitowane". Git dowodzi, że **są zacommitowane** (911 linii w commicie WIP), ale nigdy
nieuruchomione. Poprawny status: `UNVERIFIED`, nie „brak".

---

## 3. CO ZOSTAŁO DOSTARCZONE — 10 PAKIETÓW, 10 WERDYKTÓW `PASS`, 0 `FAIL`

Żaden pakiet nie został przyjęty na samoocenę autora.

| Pakiet | Autor | Weryfikacja niezależna | Scalony |
|---|---|---|---|
| **B3** Valuation API | `b62a2cefd4` | `PASS` 11/11 twierdzeń | ✅ |
| **D** Statements | `a278e58dd9` | `PASS` z zastrzeżeniem | ✅ |
| **E** Analysis | `b81684d312` | `PASS`, **1 twierdzenie obalone** | ✅ |
| **F** Baseline | `0a02ce621a` | `PASS`, V-1…V-6 zamknięte | ✅ |
| **G** Prediction | `c2a9b7febd` | `PASS` 12/12 | ✅ |
| **H** Enterprise Valuation | `35db34f15e` | `PASS` 11/12 | ✅ |
| Naprawa serwisów kanonicznych | `4e9de4153b` | `PASS` z 2 zastrzeżeniami | ✅ |
| Wystawienie martwych serwisów | `ccb4589a0d` | `PASS` z 2 ustaleniami | ✅ |
| CLEAN-1 czysty kandydat | `c06fe3c652` | `PASS` 9/9 | ✅ |
| CLEAN-2 dług spójności | `0383c9eed0` | `PASS` 9/9 | ✅ |
| **GoldCo** oracle | `7321f7cfb0` | — (sam jest narzędziem weryfikacji) | niescalony |

---

## 4. POWIERZCHNIA HTTP: 2 → 88

Na starcie poprzedniej sesji Finance v3 miał **61 plików serwisów i 2 endpointy HTTP** —
silniki pięciu domen były skończone i **nieosiągalne z zewnątrz**.

| Etap | Endpointy `/api/v8/finance-v2/*` |
|---|---|
| Start poprzedniej sesji | 2 |
| Po pakietach B i B2 | 32 |
| Po B3 (wycena) | 53 |
| **Po wystawieniu martwych serwisów** | **88** |

Liczba policzona samodzielnie przez orkiestratora na scalonym drzewie, metodą
`grep -cE "^\s*router\.(get|post|put|patch|delete)\("` per plik tras.

---

## 5. USTALENIE, KTÓRE ZMIENIŁO KOLEJNOŚĆ PRAC

Inwentaryzacja read-only warstwy „profesjonalny analityk" wykazała:
**0 z 13 zdolności podłączonych produkcyjnie — ale 11 z 13 to problem PODŁĄCZENIA, nie budowy.**

Konsekwencja policzona na rejestrze właścicielskim: **12 z 22 wymagań** (`OWN-FIN-004, 005, 007,
011, 012, 013, 016, 017, 019, 020, 021, 022`) to mandat warstwy AP-09/10/11, której komponenty
(`FinanceWorkspaceBar`, Focus Mode, `FinanceErrorBoundary`) są **gotowe i przetestowane**,
a montował je wyłącznie harness `dev-render`.

Program był planowany tak, jakby tę warstwę trzeba było napisać. **Ona w większości jest napisana.**
Szczegóły: `PKG_AP_LAYER_INVENTORY_2026-08-12.md`, `STRATEGIA_PO_INWENTARYZACJI_AP_2026-08-12.md`.

Pakiet G jest **pierwszym produkcyjnym callerem** tych trzech komponentów (potwierdzone niezależnie).

---

## 6. DEFEKTY ZNALEZIONE I NAPRAWIONE W TEJ SESJI

### Klasy naprawione

| Defekt | Waga | Dowód naprawy |
|---|---|---|
| **Idempotencja compute** — powtórzony `POST` rzucał 500 zamiast idempotentnego powtórzenia; flaga `wasExisting` z `enqueue()` ignorowana w 5 miejscach 4 serwisów | **P1** | `claimForCompute()` jako wspólny punkt decyzyjny; weryfikator dowiódł **prawdziwie równoległymi** żądaniami (`Promise.all`, 3 przebiegi, surowy `pg.Client`), że powstaje dokładnie 1 wiersz. Bezpieczeństwo z atomowego `UPDATE ... FOR UPDATE SKIP LOCKED` + `UNIQUE` **na poziomie bazy**, nie z dyscypliny kodu |
| **Stan `NA` nieosiągalny** — schemat go dopuszczał, żaden żywy serwis go nie produkował; gwarancja „brak danych = N/A, nigdy zero" była niewykonalna w silniku | **P1** | Wykryty niezależnie przez oracle GoldCo **i** weryfikatora D. Naprawiony w `formulaAstEvaluator.ts` (brakujący lub zerowy mianownik → `NA` z reason code). `statementMappingService.ts` świadomie nietknięty z uzasadnieniem domenowym |
| **Wyciek międzytenantowy w Compare** — `organizationId` brany z ciała żądania | **P0-class** | Wykryty kontrolą negatywną autora, **odtworzony przez weryfikatora** (HTTP 200 z realnymi danymi organizacji A dla B). Grep całej powierzchni: zero innych wystąpień |
| **Bug siatki wrażliwości** — `writeSensitivityGrid()` zwracał świeży identyfikator zamiast id z gałęzi `ON CONFLICT` | P2 | Pełny cykl revert→CZERWONY→restore→ZIELONY wykonany przez weryfikatora (autor miał tylko analizę statyczną) |
| **9 błędów typów** w `statementPackWorkspaceV2/` | blokujące | Naprawione **typowaniem**; grep całego diffu potwierdza zero `any`/`@ts-ignore`/`as unknown`/zmian `tsconfig` |
| **8 wycieków surowych enumów do UI** | UX/kanon | Naprawione + **skaner regresji** `rawEnumLeakScanner.test.ts` (6 z 8 znalazł sam skaner) |
| **23 endpointy zwracały surowe wiersze snake_case** | spójność API | Przerobione na DTO camelCase, `organization_id` usunięte; sonda weryfikatora 24/24 potwierdza nieosłabione filtrowanie |
| **Float w produkcyjnej ścieżce** — `computeYoyDelta` (kolumna „Zmiana r/r") | poprawność | `Decimal`, konwersja tylko na granicy prezentacji; test przypina `0.30000000000000004` |
| **Brak endpointu tworzącego krawędź lineage** — `insertEdge()` wołany wyłącznie z testów, krok Source wyceny nieprzechodni | P1 | `POST .../lineage-edges`; append-only potwierdzony triggerem bazy, brak kaskady FK, odrzucanie cykli |
| **V-1…V-6** — sześć naruszeń kanonu w Baseline | odbiór | Wszystkie zamknięte, zrzuty PRZED/PO, potwierdzone niezależnie |

### Klasy potwierdzone, nienaprawione

| Defekt | Status | Powód |
|---|---|---|
| „Gotówka = 0" z fałszywą etykietą `IMPORTED FROM STATEMENT` w `FinancialModelWorkspace.tsx` | **potwierdzony, otwarty** | Brak danych renderowany jako zero — łamie zasadę produktu. To ekran, który właściciel widzi DZIŚ. Poza allowlistą; oddzielne zadanie w toku |
| Linia wykluczona przez analityka jako „nie dotyczy" nieodróżnialna od linii niewpisanej | **potwierdzony, otwarty** | Obie widoczne dla silnika KPI jako `MISSING`. Przedistniejący, poza mandatem paczki naprawczej |
| Endpointy GET wyceny w snake_case (B3) | **potwierdzony, odroczony** | Poza allowlistą CLEAN-2; wycenione na następną falę |
| Skaner wycieków enumów — 4 sposoby ominięcia | **granica nazwana** | Zmienna pośrednia, dwa warianty szablonu literałowego, konkatenacja |

---

## 7. BRAMKI NA CANDIDATE SHA `423cea4028`

| # | Bramka | Wynik |
|---|---|---|
| 1 | Endpointy `/api/v8/finance-v2/*` | **88** (policzone samodzielnie) |
| 2 | Testy frontendowe (D+E+F+G+H) | **354**, exit 0 |
| 3 | Testy serwerowe, realny Postgres, finance-v2 + canonical | **636/636**, exit 0 |
| 4 | Testy paczki tras, realny Postgres | **150/150**, exit 0 |
| 5 | `tsc --noEmit` z korzenia | **exit 0**, zero linii, **309 s** — zmierzone przez orkiestratora na tym SHA |
| 6 | `tsc --noEmit -p server/tsconfig.json` | **exit 0**, zero linii, **21 s** — zmierzone przez orkiestratora na tym SHA |

★ Oba pomiary z **jawnym przechwyceniem kodu wyjścia i czasu trwania**. Czas 309 s i 21 s dowodzi,
że to pełne przebiegi, a nie `exit 134` (OOM), który przy zerze błędów wygląda identycznie jak sukces.
Pierwsza próba pomiaru w tej sesji zgubiła kod wyjścia (`PIPESTATUS` po potoku) i została powtórzona —
odnotowane, bo dokładnie ten błąd pomiarowy trzykrotnie zawiódł w poprzedniej sesji.
| 7 | Migracje STRICT, świeża baza (bez `--safe`) | **exit 0, 637/637**, public 1451 tabel + 8 widoków, v8 121 |
| 8 | Kontrola negatywna bramki bazy | **potwierdzona**: z kompletem 4 zmiennych 25 testów przechodzi, bez `RUN_DB_TESTS` **25/25 `skipped`**, nigdy fałszywe „passed" |

★ Rozbieżność „−8 tabel" z poprzedniej sesji **rozstrzygnięta i unieważniona**: referencja liczyła
widoki jako tabele. `1451 BASE TABLE + 8 VIEW = 1459`, `+ 121 v8 = 1580` — zgodność co do sztuki.
`server/migrations` bajtowo identyczne między `4489fdcab8` a `49071c3e2d`.

---

## 8. CZEGO NIE DOSTARCZONO — z powodami

| Pozycja | Status | Powód |
|---|---|---|
| **Audyt J** (realDB, cross-tenant 88 endpointów, rola×stan×akcja, wstrzykiwanie awarii) | `EVIDENCE_MISSING` | Przerwany **limitem sesji API**. Sonda (46 KB, `server/scripts/finance-v3-audit/j-realdb-probe.ts`) zabezpieczona commitem `f5a7f23c84` na `codex/fv3p-j-realdb`, **ani razu nieuruchomiona** |
| **Warstwa AP** — montaż powłoki w 5 workspace'ach | `PENDING` | Świadomie odroczone do czasu po fan-inie; reguła #9 wymaga wchodzenia **pojedynczo**, ekran po ekranie, po akcepcie właściciela |
| **Grid / Keyboard / kolaboracja DB** | wycenione | Grid i Keyboard ocenione jako logika czysto kliencka. Warstwa kolaboracji dotykająca bazy: ~6-8 endpointów |
| **Utrwalanie scenariuszy Prediction** | wycenione | Brak nie tylko tras, ale i **funkcji zapisu w warstwie serwisowej** dla 5 tabel; schemat gotowy |
| **„Why this number?" na poziomie komórki** | `BRAK` | Jedyna z 13 zdolności AP, która wymaga zaprojektowania logiki od zera |
| **I** (a11y/WCAG AA) i **K** (browser E2E, macierz rozdzielczości, dark/light) | `PENDING` | Nie uruchomione |
| **GoldCo E2E** przez cały łańcuch + 4 realne firmy | `PENDING` | Oracle gotowy (69/69), przebieg end-to-end nieuruchomiony |
| Import CSV | odroczony | Zakres zawężony do `.xlsx`, jawnie udokumentowany |

### `BLOCKED_EXTERNAL` — nieosiągalne lokalnie

| Pozycja | Powód |
|---|---|
| **Aktywacja RLS** | Jedyna rola to `postgres` — superuser z `rolbypassrls`, właściciel wszystkich tabel. **Superuser omija RLS zawsze, nawet z `FORCE`.** Wymaga roli o ograniczonych uprawnieniach na Railway |
| **Cutover / rollback / shadow parity** | Brak stagingu |
| **SLO produkcyjne p50/p95/p99** | Rozrzut 9,3× między przebiegami na tej maszynie |
| **FC-12 — niezależny recenzent CFO** | Wymaga człowieka z zewnątrz |
| **Push / deploy** | Wymaga zgody właściciela |

---

## 9. STAN 22 WYMAGAŃ WŁAŚCICIELSKICH

**Żadne wymaganie nie może zostać uznane za w pełni odebrane** — brakuje bramek UI (I, K),
realDB (J) i recenzenta CFO (FC-12). Postęp jest realny, ale odbiór wizualny właściciela
nie został przeprowadzony poza jednym ekranem.

Jedyny ekran przedstawiony właścicielowi: **Baseline Model** (zrzuty PRZED/PO), po osobistym
przeglądzie orkiestratora zgodnie z regułą #7. Akcept nieudzielony na moment pisania raportu.

---

## 10. ZDARZENIA OPERACYJNE TEJ SESJI

1. **Awaria sieci `ENOTFOUND`** ubiła 7 agentów jednocześnie. Jeden zginął **między cofnięciem
   naprawy a jej przywróceniem** w kontroli negatywnej i zostawił drzewo z celowo zepsutym kodem.
   Przechwycone; naprawa przywrócona z HEAD metodą `git show <sha>:<plik> > <plik>`.
2. **Błąd orkiestratora:** użycie `git add -f` na szerokich ścieżkach wciągnęło 514 plików cache
   builda (619 tys. linii) mimo wpisu w `.gitignore`. Naprawione do przodu commitem `c334b1000e`,
   bez przepisywania historii.
3. **Incydent prywatności:** jeden agent, diagnozując zepsute narzędzie podglądu, użył systemowego
   `screencapture` i uchwycił pulpit użytkownika. Plik skasowany natychmiast, nieużyty, ujawniony
   w commicie; zweryfikowane, że nic nie zostało w repo. **Przyczyna źródłowa:** `preview_start`
   rozwiązuje `launch.json` względem katalogu orkiestratora, nie worktree agenta. Obejście
   (skrypt Playwright ze stałym portem) rozesłane dalej.
4. **Limit sesji API** przerwał audyt J.
5. Maszyna była saturowana (load do 624) przez **inne, niezwiązane sesje** — zdiagnozowane
   z listy procesów, nie założone.

---

## 11. NASTĘPNE KROKI, W KOLEJNOŚCI

1. **Dokończyć audyt J** — sonda gotowa, wystarczy uruchomić. To największa luka dowodowa.
2. **Uruchomić I i K** — a11y oraz dowody wizualne na candidate SHA, wszystkie rozdzielczości i stany.
3. **GoldCo E2E** przez pełny łańcuch, potem 4 realne firmy (słabsza klasa dowodu, nie zastępuje oracle).
4. **Montaż powłoki AP** w 5 workspace'ach — najtańsza duża dźwignia, zamyka ~10 wymagań
   właścicielskich. **Pojedynczo**, każdy ekran po osobnym akcepcie na czystym zrzucie.
5. Domknąć wycenione odroczenia: utrwalanie scenariuszy, kolaboracja DB, GET-y B3, import CSV.
6. Pełny przebieg `single_sha_evidence_run.sh` na jednym, finalnym SHA.

---

## 12. STATUS PROGRAMU

**`PARTIAL` — nie `READY`.**

Backend ma pokrycie dowodowe, powierzchnia HTTP wzrosła z 2 do 88 endpointów, pięć pionów
produktowych istnieje za flagami domyślnie OFF, a dziesięć pakietów przeszło niezależną
weryfikację. Ale bramki UI, realDB i recenzenta CFO nie zostały przejęte, więc **żadne z 22
wymagań właścicielskich nie jest w pełni odebrane**.

Wszystko wizualne pozostaje **za flagą domyślnie OFF** do akceptu właściciela, ekran po ekranie.
