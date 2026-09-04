# DEC-387 — KOMPLETNE KARTY INICJATYW

Data: 2026-09-04 · Gałąź: `agent/dec387-kompletne-karty-20260904` (worktree `/private/tmp/ag-dec387-20260904`)
Baza: hub `/private/tmp/m03`, HEAD `a0a2849838` (gałąź `codex/m03-admin-20260824`)
Harness: `dev-render` na porcie 5466, ekran `karta-initiative`
Flaga: `ff_initiativeCardContract` / alias `?cardContract=1` — **pozostaje domyślnie OFF**, nic nie włączono.

Decyzja właściciela: *„Musimy mieć kompletne karty inicjatyw — to jest sens naszej aplikacji"*.
Kontrakt kart (dyżur 305) **nie wchodzi w postaci, która sekcje kasuje**. Ma je zachowywać.

---

## 0. Czy pomiar stoi na REALNYM rekordzie, czy na fiksturze pokazowej

Pułapka z korpusu („odbiór na fiksturze pokazowej"): od 13.08 (`07bc597420`) realne inicjatywy
otwierały nieodebrany `CanonicalInitiativeCardWorkspace`, a zatwierdzony widok dostawały tylko
id `init-showcase-*`.

**Zmierzone dziś — pułapka jest już zamknięta w kodzie, niezależnie ode mnie:**

- `src/components/Initiatives/InitiativesHub.tsx:766-771` — `handleOpenInitiativeDocument` ustawia
  `desiredSubType = 'initiative'` **dla każdej** inicjatywy (decyzja właściciela 2026-09-03);
- `CanonicalInitiativeCardWorkspace` **nie istnieje w repo** (`find src -iname '*CanonicalInitiative*'`
  → wyłącznie `CanonicalInitiativeRegister.tsx`); bezpiecznik `tests/unit/initiatives/initiativeRecordCanon.test.ts` **8/8 PASS**;
- ekran pomiarowy `dev-render/screens/karta-initiative.tsx` jedzie **ścieżką produkcyjną**: id
  `init-smed-linia-pakowania` (celowo **BEZ** prefiksu `init-showcase-`, komentarz w pliku, linie 12-27),
  montuje realny `InitiativeDocumentView`; zamockowany jest **wyłącznie transport HTTP**, nie logika renderu.

Wniosek: każdy pomiar i każdy zrzut poniżej powstał na **realnej ścieżce rekordu**, nie na fiksturze pokazowej.

---

## 1. (R1) PRAWDA O KOMPLETNOŚCI — trzy kolumny

Pomiar mechaniczny, nie „z oglądania": kanoniczne `scripts/dev/grafika-zrzuty.mjs` z **nową opcją
opt-in `--zlicz`** (liczy `querySelectorAll` w chwili zrzutu, ten sam DOM co PNG).

### 1.1 Liczby zbiorcze — MOJA LICZBA ZAMIAST „11 z 15"

| Stan | Sekcje lewej nawigacji | Grupy | Plik pomiaru |
|---|---|---|---|
| **OFF (produkt dziś)** | **24** | **5** | `evidence/dec387-kompletne-karty-20260904/pomiar-zastany-OFF.json` |
| **ON (kontrakt, stan zastany)** | **4** | **2** | `evidence/dec387-kompletne-karty-20260904/dowod-ZASTANY-ON.json` |
| **ON (po naprawie)** | **24** | **5** | `evidence/dec387-kompletne-karty-20260904/dowod-PO-NAPRAWIE-ON.json` |

**Kontrakt kasował 20 z 24 sekcji i 3 z 5 grup — nie 11 z 15.**

Dlaczego odbiorca dyżuru 305 zobaczył „15": lewy panel ma WŁASNE przewijanie
(`NModeLeftNav.tsx:438-450`, `N_MODE_LEFT_NAV_SCROLL_CLASS`), więc przy 1440×900 mieści się
naraz ~15 pozycji, a reszta wymaga przewinięcia panelu. Liczba „15" to pojemność kadru,
nie liczba sekcji. Przy wysokości 1800 px widać wszystkie 24
(`evidence/dec387-kompletne-karty-20260904/PO-NAPRAWIE-ON-1800/`).

### 1.2 Sekcja po sekcji (plik:linia)

Kolumna (a) = renderuje się przy OFF · (b) = renderowało się przy ON **przed** naprawą ·
(c) = co deklaruje kontrakt (`src/components/Initiatives/sections/initiativeCardContract.ts`).
Most registry↔board: `nModeMap`, `InitiativeDocumentView.tsx:1640-1650`.

| # | id sekcji boardu | Etykieta PL | (a) OFF | (b) ON zastane | (c) karta kontraktu (linia) | plik:linia boardu |
|---|---|---|---|---|---|---|
| 1 | `initiative-definition` | Zakres inicjatywy | ✅ | ✅ | `overview` :63 + `problemDefinition` :81 | InitiativeDocumentView.tsx:5295 |
| 2 | `tasks` | Zadania | ✅ | ✅ | `tasks` :142 | :5302 |
| 3 | `timeline` | Harmonogram | ✅ | ❌ | `timeline` :457 | :5326 |
| 4 | `deliverables-milestones` | Produkty i kamienie milowe | ✅ | ❌ | *(brak własnej karty — dług kontraktu)* | :5446 |
| 5 | `dependencies` | Zależności | ✅ | ❌ | `dependencies` :504 | :5356 |
| 6 | `decisions` | Decyzje | ✅ | ❌ | `decisions` :160 | :5311 |
| 7 | `risk-raid` | Ryzyko i RAID | ✅ | ❌ | `raid` :177 | :5333 |
| 8 | `gates` | Bramy | ✅ | ❌ | `gates` :200 | :5390 |
| 9 | `suggested-changes` | Sugerowane zmiany | ✅ | ❌ | *(brak własnej karty)* | :5397 |
| 10 | `change-log` | Dziennik zmian | ✅ | ❌ | *(pokrewna `activity-log` :355)* | :5454 |
| 11 | `target-state-scope` | Kryteria sukcesu | ✅ | ✅ | `targetState` :103 + `scope` :121 | :5343 |
| 12 | `kpi` | KPI i korzyści | ✅ | ✅ | `kpis` :259 | :5349 |
| 13 | `okr` | OKR | ✅ | ❌ | *(brak własnej karty)* | :5462 |
| 14 | `hypothesis` | Hipoteza | ✅ | ❌ | *(brak własnej karty)* | :5470 |
| 15 | `financial-analysis` | Analiza finansowa | ✅ | ❌ | `financialAnalysis` :220 | :5366 |
| 16 | `financial-impact` | Wpływ finansowy | ✅ | ❌ | `financialImpact` :241 | :5373 |
| 17 | `team` | Zespół | ✅ | ❌ | `team` :408 | :5320 |
| 18 | `workstream-owners` | Właściciele strumieni | ✅ | ❌ | *(pokrewna `stakeholders` :488)* | :5476 |
| 19 | `raci` | RACI | ✅ | ❌ | `governance` :426 (alias `raciEscalation`) | :5381 |
| 20 | `resources` | Zasoby | ✅ | ❌ | `resources` :471 | :5405 |
| 21 | `attachments-links` | Załączniki i powiązania | ✅ | ❌ | `attachments` :522 | :5412 |
| 22 | `used-in` | Użyte w (powiązania) | ✅ | ❌ | *(brak własnej karty)* | :5423 |
| 23 | `artifacts` | Artefakty | ✅ | ❌ | *(brak własnej karty)* | :5430 |
| 24 | `lessons-learned` | Wnioski i lekcje | ✅ | ❌ | *(brak własnej karty)* | :5482 |

Prawy panel (`initiativeRightPanelSections`, `InitiativeDocumentView.tsx:9989`; sekcje
`actions` :10067, `properties` :10171, `relations` :10209, `evidence` :10286, `results` :10308,
`comments` :10326, `history` :10412) — **flaga go nie dotyka ani przed, ani po naprawie**.

Kontrakt deklaruje **27 kart kanonicznych** (27 wpisów `definiujKarteKanoniczna` w
`initiativeCardContract.ts`), ale to inna przestrzeń id niż board (klucze registry, nie id boardu) —
dlatego kolumna (c) bywa „brak własnej karty". **To nie była przyczyna kasowania** (patrz R2).

---

## 2. (R2) PRZYCZYNA KASOWANIA — allowlista, nie brak odpowiedników

Przyczyna jest jedna, w jednym miejscu, i jest to **zamknięta lista dozwolonych sekcji**:

```
// InitiativeDocumentView.tsx (stan zastany, ~8965-8985)
const initiativeCoreBoardIdSet = new Set([...INITIATIVE_CORE_BOARD_IDS,
                                          ...INITIATIVE_MINIMAL_BOARD_VISIBLE_IDS]);
useEffect(() => {
  if (!initiativeCardContractEnabled) return;      // OFF → no-op
  const hide = nModeSectionsWithContent.map(s => s.id)
                 .filter(id => !initiativeCoreBoardIdSet.has(id));   // ← WSZYSTKO POZA ALLOWLISTĄ
  setHiddenSectionIds(new Set(hide));
}, [...]);
```

- `INITIATIVE_CORE_BOARD_IDS` = `{ 'initiative-definition' }` (kontrakt :684)
- `INITIATIVE_MINIMAL_BOARD_VISIBLE_IDS` = `['initiative-definition','target-state-scope','tasks','kpi']` (kontrakt :743)
- suma = **4 id**; `hiddenSectionIds` filtruje listę w `orderedNModeSectionsWithContent`
  (`:9001-9002`), więc pozostałe **20 sekcji znikało z nawigacji**, a razem z nimi całe grupy
  „Decyzje i ryzyko", „Ludzie", „Zapisy".

**To NIE jest** filtrowanie po typie ani brak odpowiedników w kontrakcie — to **świadome zwężenie
widoku domyślnego**, w kodzie oznaczone jako „★ Który board = rdzeń/domyślny — DO POTWIERDZENIA
PIOTRA". Pytanie nigdy nie trafiło do właściciela, bo dyżur 305 nie zrobił kadrów.

**Konsekwencja dla naprawy: to uzupełnienie/odwrócenie decyzji, nie przebudowa.** Mechanizm
kontraktu jest sprawny — zły był tylko jego wkład w domyślny widok.

---

## 3. (R3) CO ZMIENIŁEM

Zasada: **kontrakt porządkuje i standaryzuje, nie ucina.** Flaga zostaje OFF.

### 3.1 `src/components/Initiatives/sections/initiativeCardContract.ts` (+100 linii, sekcja „3b")

- `INITIATIVE_CONTRACT_HIDDEN_SEED: readonly string[] = []` — ziarno ukryć przy ON jest **puste
  z definicji**. Powrót do ukrywania wymaga zmiany tej stałej, a to czerwieni test (dowód niżej).
- `INITIATIVE_BOARD_CANONICAL_ORDER` — **24 id boardu** w kolejności kanonicznej: grupy w kolejności
  `groupLabels` (Zakres i plan · Decyzje i ryzyko · Rezultaty · Ludzie · Zapisy), wewnątrz grupy
  rdzeń → domyślna → dodawalna. **To jest cały realny wkład kontraktu w wygląd.**
- `uporzadkujSekcjeBoarduInicjatywy(ids)` — zwraca **permutację wejścia** (ta sama liczebność,
  ten sam zbiór; sekcja nieznana kontraktowi ląduje na końcu, nigdy nie wypada; dodatkowy pas
  bezpieczeństwa zwraca wejście, gdyby wynik kiedykolwiek się skrócił).
- `sekcjeBoarduPozaKontraktem(ids)` — id boardu nienazwane przez kontrakt (dziś: `[]`).
- `INITIATIVE_MINIMAL_BOARD_VISIBLE_IDS` **zostaje**, ale wyłącznie jako preset przycisku
  „Rdzeń inicjatywy" w menu „Sekcje" — świadomy klik użytkownika, nie stan domyślny.

### 3.2 `src/components/Initiatives/InitiativeDocumentView.tsx`

- **usunięty** efekt ziarnujący `hiddenSectionIds` allowlistą; w jego miejsce efekt no-op oparty
  o `INITIATIVE_CONTRACT_HIDDEN_SEED` (pusty ⇒ nic się nie dzieje);
- kolejność kanoniczna wchodzi jako **WYPROWADZENIE** w `orderedNModeSectionsWithContent`
  (`useMemo`), nie jako ziarno stanu. Powód, zmierzony: pierwsza wersja ziarnowała
  `setNModeSectionOrder` i **przegrywała wyścig** z efektem czytającym `localStorage` — zrzut
  pokazał 24 sekcje w starej kolejności, czyli naprawa działała tylko w połowie. Wyprowadzenie
  nie ma wyścigu;
- kolejność kanoniczna wchodzi **tylko** gdy użytkownik nie ma własnej (zapisanej przeciąganiem) —
  inaczej kontrakt kasowałby jego układ, czyli robił dokładnie to, czego DEC-387 zakazuje;
- ostrzeżenie DEV, gdy sekcja boardu nie jest nazwana w kolejności kanonicznej (renderuje się
  dalej, na końcu — nie znika).

### 3.3 `src/components/shared/NModeLayout/NModeLeftNav.tsx`

Uchwyty pomiarowe (nie wygląd): `data-nmode-section-item={section.id}` na obu ścieżkach renderu
pozycji i `data-nmode-section-group={label}` na nagłówku grupy. Bez nich liczbę „ile sekcji widzi
właściciel" trzeba liczyć okiem na obrazku — i tak powstała nieweryfikowalna teza „11 z 15".

### 3.4 `scripts/dev/grafika-zrzuty.mjs` — dwie opcje OPT-IN dołożone do KANONICZNEGO narzędzia

(Zamiast pisania własnego skryptu zrzutowego obok kanonicznego.)

- `--zlicz=<nazwa>:<css>[;...]` — liczy elementy w chwili zrzutu, zapisuje pierwsze 60 tekstów,
  wynik ląduje w `--wynik-json` i w konsoli. Zero trafień raportowane jako `0`, nigdy pomijane.
- `--porownaj-z=<katalog>` — porównuje każdy nowy zrzut z jednoimiennym motywowo zrzutem z katalogu
  odniesienia: SHA-256 obu plików + procent różnych pikseli. **Para bajtowo identyczna jest
  raportowana jako `IDENTYCZNE — ZERO DOWODU` z kodem wyjścia 1.** Dotąd narzędzie porównywało
  wyłącznie parę light↔dark wewnątrz jednego przelotu, więc na pytanie „czy PO różni się od PRZED"
  odpowiadał człowiek — i tak przechodziły meldunki z dwoma identycznymi obrazami (dyżur 306).

Bez tych parametrów zachowanie narzędzia jest identyczne z dotychczasowym (zgodność wsteczna).

---

## 4. (R4) DOWÓD WZROKIEM — para na TYM SAMYM realnym rekordzie

Wszystkie zrzuty: ekran `karta-initiative`, id `init-smed-linia-pakowania` (ścieżka produkcyjna),
`lang=pl`, 1440 px, `uwagi=0` (kadr czysty), **sekcje rozwinięte**
(`--rozwin-sekcje=1 --cofnij-jesli-skraca=1 --osiad-po-rozwinieciu=1200`).

### 4.1 Para do pokazania właścicielowi (PRZED = kontrakt ON zastany, PO = kontrakt ON po naprawie)

| Rola | Plik | SHA-256 | Śr. jasność | Sekcje | Grupy |
|---|---|---|---|---|---|
| PRZED light | `evidence/dec387-kompletne-karty-20260904/ZASTANY-ON/karta-initiative__PRZED__pl__1440__light.png` | `557f4ce18df7afb6bf5eb19d39d046c065199a4cae096a09368bd55ed37265f3` | 243,42 | **4** | 2 |
| PRZED dark | `.../ZASTANY-ON/karta-initiative__PRZED__pl__1440__dark.png` | `31b7048744ab44a69e20e06afc0f90418cd15a558d40cf49176c99dfd2617fb2` | 26,54 | **4** | 2 |
| PO light | `.../PO-NAPRAWIE-ON/karta-initiative__PO__pl__1440__light.png` | `cbbfedc2b883ce282b5efe754273603305ba907bf2dbf2fa88bf9309b0330850` | 242,91 | **24** | 5 |
| PO dark | `.../PO-NAPRAWIE-ON/karta-initiative__PO__pl__1440__dark.png` | `60ec694c9d992f8e8be23a6c8bc863dd81d30bbaa81fd41e3600f1ea74bff328` | 27,18 | **24** | 5 |

Para wysoka (cała nawigacja bez przewijania panelu, 1440×1800) — **to jest kadr do pokazania**:

| Rola | Plik | SHA-256 | Sekcje |
|---|---|---|---|
| PRZED light | `.../ZASTANY-ON-1800/karta-initiative__PRZED__pl__1440__light.png` | `4084589f7d1352daed3309c47ecd33ace7da62dd1263e00cc9a737da2ba3c26f` | 4 |
| PRZED dark | `.../ZASTANY-ON-1800/karta-initiative__PRZED__pl__1440__dark.png` | `8594f3777cea70e85abd62a6028c85042a6611f35e03b89de41e79ac513c4d41` | 4 |
| PO light | `.../PO-NAPRAWIE-ON-1800/karta-initiative__PO__pl__1440__light.png` | `3741bfc8a56b304d193151c796c8aa34a008e6f45ecd9370b54cc9d57e4cdc26` | **24** |
| PO dark | `.../PO-NAPRAWIE-ON-1800/karta-initiative__PO__pl__1440__dark.png` | `198df3d21717073b4bf9959cc15ecd878c9500689143beb543e7bc01117807b8` | **24** |

Maszynowe porównanie PRZED↔PO (`--porownaj-z`): **RÓŻNE** w obu motywach —
1,6479 % / 1,6483 % różnych pikseli (900 px) i 1,3642 % / 1,3644 % (1800 px).
Żadna para nie jest bajtowo identyczna. Wszystkie 12 sum kontrolnych: `sumy-kontrolne.txt`.

### 4.2 Para OFF ↔ ON PO NAPRAWIE (dowód, że kontrakt niczego nie ucina)

| Rola | Plik | SHA-256 | Sekcje | Grupy |
|---|---|---|---|---|
| OFF light | `.../OFF/karta-initiative__PRZED__pl__1440__light.png` | `0cf20b0033fc277ddc01f28fbcb37f39839450163a902ee3c62dfcffb4458602` | 24 | 5 |
| OFF dark | `.../OFF/karta-initiative__PRZED__pl__1440__dark.png` | `670eeabee4d61e7df090b58103bdd77e3765dd00d96622f1fef2c9e37b34f6bf` | 24 | 5 |
| ON light | `.../ON/karta-initiative__PO__pl__1440__light.png` | `cbbfedc2…0850` | 24 | 5 |
| ON dark | `.../ON/karta-initiative__PO__pl__1440__dark.png` | `60ec694c…f328` | 24 | 5 |

Porównanie: **RÓŻNE**, 0,8112 % / 0,8116 % pikseli — to wyłącznie **inna kolejność** pozycji
nawigacji (Rezultaty przed Ludźmi, OKR/Hipoteza przed Analizą finansową). Liczba sekcji jest
identyczna. **Dokładnie to znaczy „kontrakt porządkuje, nie ucina".**

> Uczciwa uwaga: katalogi `ON/` i `PO-NAPRAWIE-ON/` mają identyczne SHA, bo to **ten sam stan
> programu sfotografowany dwa razy** (raz w parze z OFF, raz w parze z ZASTANY-ON). To dowód
> powtarzalności narzędzia, nie kształt „duplikat zamiast motywu" — tam identyczna była para
> light/dark, a tu light i dark różnią się luminancją 243 vs 27 i 99,99 % pikseli.

### 4.3 Kontrola przyrządu (rozwijanie sekcji nie zamyka podglądu)

Długość wydobytego tekstu **bez** i **z** `--rozwin-sekcje`:

| Stan | bez rozwijania | z rozwijaniem | rozwiniętych kontrolek |
|---|---|---|---|
| OFF | 1221 zn. | **2932 zn.** | 29 |
| ON po naprawie | 1221 zn. | **2932 zn.** | 29 |
| ON zastane (4 sekcje) | — | **2622 zn.** | 29 |

Rozwijanie **dokłada** 2,4× tekstu, nie skraca — podgląd nie jest zamykany, sekcje są realnie
rozwinięte. `--cofnij-jesli-skraca=1` nie cofnął ani jednego kliku (0 pozycji).
Pozostają 3 kontrolki `aria-expanded=false`: „Więcej", „Sekcje", „Analizuj z AI" — to **wyzwalacze
menu rozwijanych**, nie akordeony treści; narzędzie oznacza je jako `wynik BRAK` i dlatego kod
wyjścia to 1 mimo poprawnych zrzutów. To artefakt przyrządu, nie defekt produktu.

---

## 5. (R5) DOWÓD MUTACYJNY

Test: `tests/unit/initiatives/initiativeCardContractCompleteness.test.ts` (6 przypadków).
Surowe wyjście: `evidence/dec387-kompletne-karty-20260904/dowod-mutacyjny.txt`.

**Stan wyjściowy: 6/6 PASS.**

**Mutacja A — usuwam JEDNĄ sekcję z kontraktu** (`'risk-raid'` z `INITIATIVE_BOARD_CANONICAL_ORDER`):

```
× M1: kolejność kanoniczna pokrywa KAŻDĄ sekcję boardu produktu
  → AssertionError: expected [ 'risk-raid' ] to deeply equal []
Tests  1 failed | 5 passed (6)
```

Po przywróceniu: **6/6 PASS**.

**Mutacja B — przywracam ukrywanie** (`INITIATIVE_CONTRACT_HIDDEN_SEED = ['risk-raid','team']`):

```
× M3: przy fladze ON kontrakt nie ukrywa ANI JEDNEJ sekcji
  → AssertionError: expected [ 'risk-raid', 'team' ] to deeply equal []
× M3b: liczba sekcji widocznych przy ON nie jest mniejsza niż przy OFF
  → AssertionError: expected 22 to be greater than or equal to 24
Tests  2 failed | 4 passed (6)
```

Po przywróceniu: **6/6 PASS**. `git diff --stat` na kontrakcie po mutacjach: same moje +100 linii.

Test celuje w **zabezpieczenie**, nie w mechanizm obok:
- listę id boardu czyta **ze źródła produktu** (`InitiativeDocumentView.tsx`), nie z przepisanej
  do testu kopii — z podłogą liczebności (`>= 20`) i wymogiem unikalności, żeby zepsute parsowanie
  padło, a nie przeszło na pustej liście („brak pomiaru nie jest wynikiem");
- M4 pilnuje, że widok **realnie woła** `uporzadkujSekcjeBoarduInicjatywy` (zapora przed
  „biblioteką bez wywołania") i że nie wróciło ziarno-allowlista.

Test zastany `initiativeRecordCanon.test.ts`: **8/8 PASS** (bez regresji).

---

## 6. (R6) HIGIENA

| Kontrola | Wynik |
|---|---|
| `npx esbuild` per zmieniony plik (4 pliki osobno) | OK / OK / OK / OK |
| `node --check scripts/dev/grafika-zrzuty.mjs` | OK |
| Liście `public/locales/pl/translation.json` | **35183** (przed = po; `git diff` na `public/locales` = 0 plików) |
| Liście `public/locales/en/translation.json` | **33050** (przed = po) |
| `bash scripts/check-artefakt.sh` | ✓ crimson 8, baseline 9 — dług nie rośnie |
| `bash scripts/check-list-canon.sh` | ✓ 368 / baseline 368 |
| `check-focus-canon --ci` (hook) | OK, baseline 45 plików / 64 wystąpienia |
| Crimson dołożony do powłoki (`primary-*` / `#85182F`) | **0** (grep po dodanych liniach diffu) |
| `git status --short` | czysto poza `evidence/grafika/dec387-po-naprawie-ON/` (pomiar roboczy, celowo nietrzymany) |
| Flaga | **domyślnie OFF** — `isInitiativeCardContractEnabled()` nietknięte |

---

## 7. CZY KARTA PRZY FLADZE ON JEST TERAZ KOMPLETNA — odpowiedź uczciwa

**Kompletna względem stanu OFF: TAK, zmierzone.** 24 sekcje / 5 grup przy ON = 24 sekcje / 5 grup
przy OFF, ten sam zbiór id, na tym samym realnym rekordzie, w obu motywach, z bezpiecznikiem
mutacyjnym. Kontrakt wnosi wyłącznie kolejność.

**Kompletna względem kanonu §13.1 — NIE WIEM i nie twierdzę.** „Komplet" mierzę tu jako
„nie mniej niż dziś", bo taka była treść DEC-387. Czy 24 sekcje to właściwa zawartość karty
inicjatywy (a nie np. 27 kart kontraktu albo 11 archetypów Rekordu z `ARTIFACT_ANATOMY_STANDARD.md`
§13.1) — to osobne pytanie produktowe, nierozstrzygnięte.

---

## 8. TWIERDZENIA NIEZWERYFIKOWANE

1. **Sześć pozostałych typów kart** (Task, Decision, Notification, Insight, Interview, Tool) —
   nie sprawdzałem, czy ich kontrakty mają analogiczną allowlistę. Zlecenie dotyczyło Inicjatywy.
   Wspólny alias `?cardContract=1` włącza je wszystkie naraz, więc **ryzyko tego samego defektu
   w rodzinie jest realne i niezmierzone**.
2. **Zachowanie na żywej bazie** — pomiar szedł przez zamockowany transport HTTP w harnessie.
   Logika renderu jest produkcyjna, ale liczba sekcji na koncie z innym szablonem
   (`initiativeTemplate.visibleSections`, `InitiativeDocumentView.tsx:5271-5286`) może być mniejsza
   niż 24 — filtr szablonu działa **przed** kontraktem i go nie dotyczy. Nie zmierzyłem żadnego
   rekordu z niepustym `visibleSections`.
3. **Przycisk „Rdzeń inicjatywy"** (preset 4 sekcji w menu „Sekcje") — istnieje dalej i dalej
   zwęża widok po kliknięciu. Nie sprawdziłem go zrzutem; zakładam, że świadomy klik użytkownika
   jest dozwolony. Jeśli właściciel uzna, że preset ma zniknąć — to jedna linia.
4. **Wyższa rozdzielczość / inne szerokości** (1920, mobile) — niemierzone.
5. **Dostępność (a11y)** rozwiniętego widoku — `--a11y` nie był włączony w tych przelotach.
6. **Kolejność kanoniczna jako propozycja** — układ grup (Rezultaty przed Ludźmi) to moja decyzja
   wynikająca z `groupLabels` w kodzie, **nie z dokumentu kanonu**. Do akceptu właściciela.

---

## 9. ZMIENIONE PLIKI

| Plik | Zmiana |
|---|---|
| `src/components/Initiatives/sections/initiativeCardContract.ts` | +100 linii — sekcja 3b: pusty seed ukryć, kolejność kanoniczna 24 id, `uporzadkujSekcjeBoarduInicjatywy`, `sekcjeBoarduPozaKontraktem` |
| `src/components/Initiatives/InitiativeDocumentView.tsx` | usunięte ziarno-allowlista `hiddenSectionIds`; kolejność kanoniczna jako wyprowadzenie w `orderedNModeSectionsWithContent`; ostrzeżenie DEV o sekcji poza kontraktem |
| `src/components/shared/NModeLayout/NModeLeftNav.tsx` | uchwyty pomiarowe `data-nmode-section-item` / `data-nmode-section-group` |
| `scripts/dev/grafika-zrzuty.mjs` | opcje opt-in `--zlicz` i `--porownaj-z` |
| `tests/unit/initiatives/initiativeCardContractCompleteness.test.ts` | **nowy** bezpiecznik, 6 przypadków, dowód mutacyjny A i B |
| `evidence/dec387-kompletne-karty-20260904/**` | 12 PNG (6 par), 6 plików JSON pomiaru, `sumy-kontrolne.txt`, `dowod-mutacyjny.txt` |
