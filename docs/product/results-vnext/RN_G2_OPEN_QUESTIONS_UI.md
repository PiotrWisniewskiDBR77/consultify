# RN-G2 — pytania otwarte warstwy UI

Rejestr rzeczy, których **nie rozstrzygnięto po cichu**. Każda pozycja została
znaleziona przez realną pracę na kodzie albo na zrzucie, nie przez lekturę
dokumentacji. Żadna nie jest zablokowana „do wyjaśnienia" — przy każdej opisano,
co program w międzyczasie robi i dlaczego to jest bezpieczne.

Ta lista uzupełnia pytania otwarte z `RN_G2_UI_SCOPE.md` (tam: co pokazuje gołe
`/results` w okresie przejściowym, archetyp pełnych narzędzi, umiejscowienie
spraw odchyleń KPI). Tamte nadal są otwarte i nadal nie zostały rozstrzygnięte.

---

## OQ-UI-A — decyzja R01 znosi literalny zapis TRIADA §C3. Który z nich obowiązuje?

**Znalezione niezależnie przez trzy tory** (OKR, karty wyników KPI, tworzenie ROI),
co samo w sobie jest sygnałem: każdy zespół budujący ekran listowy na to wpadnie.

TRIADA §C3 mówi wprost: pozycja zablokowana regułą produktu zostaje **widoczna i
wyszarzona _z powodem_** — ukrywa się tylko to, czego jeszcze nie zbudowano.

`src/components/shared/RowActionsMenu.tsx` (L629, L635-646) niesie komentarz
decyzji zarządczej **R01 z 2026-08-06**: „POWÓD BLOKADY NIE JEST PREZENTOWANY".
Powód nadal przepływa przez `note` do warstwy audytu/capability, ale UI go nie
pokazuje — ani jako podpis, ani jako tooltip.

Czyli: pozycja jest widoczna i wyszarzona (zgodnie z §C3), ale użytkownik nie
dowiaduje się, **dlaczego**. Połowa wymogu jest spełniona, połowa nie.

**Co robimy w międzyczasie**: wszystkie ekrany RN-G2 ustawiają `note` poprawnie i
rozróżniają dwa różne powody — „automat stanów tego zabrania" vs „jeszcze nie
zbudowane w tym pakiecie". Dane są prawidłowe. Jeśli decyzja R01 zostanie
odwrócona, powody pojawią się w UI bez żadnej zmiany w kodzie domenowym.

**Czego potrzeba**: rozstrzygnięcia właściciela, który zapis jest nadrzędny —
i, jeśli R01 zostaje, poprawienia TRIADA §C3, żeby kanon nie kłamał.

---

## OQ-UI-B — migawki przeglądu kart wyników KPI nie są re-filtrowane pod czytelnika

Znalezione przez tor kart wyników przy czytaniu `kpiScorecardRepository.ts`
(decyzja #6b w kodzie): zwykłe `listReviewSnapshots` **nie** przepuszcza
`snapshot_payload` przez filtr widoczności aktualnego czytelnika. Robi to
wyłącznie `getPublishedSnapshot`.

Czyli payload migawki może zawierać wiersze KPI, których czytelnik nie ma prawa
zobaczyć w żadnym innym miejscu produktu.

**Co robimy w międzyczasie**: pakiet kart wyników **nigdy nie renderuje
zawartości payloadu** — pokazuje wyłącznie metadane migawki. Ograniczenie
zapisane w nagłówku `kpiScorecardPresenters.tsx`, żeby następny pakiet go nie
zniósł przez nieuwagę.

**Czego potrzeba**: decyzji, czy to zamierzone (payload jest z definicji
migawką stanu z chwili publikacji, więc być może ma pokazywać to, co widział
publikujący), czy to luka do domknięcia po stronie repozytorium. **Do czasu
rozstrzygnięcia żaden ekran nie powinien renderować payloadu.**

---

## OQ-UI-C — `not_calculable` nie dociera na drut w dwóch z trzech domen

Niezmiennik uczciwych braków jest w tym programie wymuszony przez ~23 epiki i
`HonestValueCell` z P0 renderuje trzy stany rozróżnialnie. Ale:

| Domena | Stan na drucie | Skutek |
|---|---|---|
| **ROI** (NPV/IRR/payback) | pełna trójka: `decimal \| null \| 'not_calculable'` | gałąź `not_calculable` realnie osiągalna, zweryfikowana na zrzutach (`roi-case-3` vs `roi-case-4`) |
| **OKR** (`overall_progress`/`overall_confidence`) | `NUMERIC NULL` — dwa stany | rozróżnienie żyje **tylko wewnątrz silnika** (`okrProgressEngine.ts`/`okrSetRollupCalculator.ts`, pole `reason`) i **nigdy nie jest persystowane ani zwracane** przez żaden `GET` |
| **KPI karty wyników** | zero wystąpień `not_calculable` w `server/src/services/resultsVnext/kpi/` | domena uczciwie dwuwartościowa |

To **nie jest** błąd UI i **nie wolno** go obejść zgadywaniem po stronie klienta,
kiedy `null` „pewnie znaczy" `not_calculable` — to byłoby dokładnie fabrykowanie
znaczenia, przed którym broni cały ten niezmiennik.

**Co robimy w międzyczasie**: `HonestValueCell` jest użyty wszędzie poprawnie;
w OKR i w kartach wyników jego trzecia gałąź jest po prostu nieosiągalna z
realnych danych. Udokumentowane w `parseOkrProgress` i w nagłówku prezenterów
kart wyników, żeby nikt nie uznał tego za przeoczenie.

**Czego potrzeba**: decyzji produktowej, czy silnik OKR ma **persystować i
zwracać** powód nieobliczalności. Dopóki nie zwraca, UI nie ma czego pokazać.

---

## OQ-UI-D — zaszyte angielskie napisy we wspólnych komponentach

Widoczne na polskich zrzutach odbioru, w każdej domenie:

1. **`StandardTable`** — etykieta przycisku ponowienia w stanie błędu jest
   zaszyta po angielsku (ok. L532), dla wszystkich 100+ konsumentów w repo.
   Dowód: `docs/qa/screens/rn-g2-roi-2026-08-10/07-all-error-light-pl-1440.png`.
   **Naprawiane** przez tor platformy — to jedyne miejsce, gdzie nie ma ani
   propa, ani klucza, więc zmiana komponentu jest uzasadniona.
2. **`StandardPreview`** — nagłówki „Property"/„Value" tabeli właściwości.
   **To NIE jest brak mechanizmu**: propy `details.propertyLabel`/`valueLabel`
   istnieją (L122-123), a angielski to tylko wartość domyślna (L471-472).
   Prawdziwa przyczyna jest po stronie wywołujących — **żaden** z czterech
   zbudowanych ekranów RN-G2 ich nie podaje:
   `roiRegistryPresenters.tsx` (oba buildery), `ResultsKpiRegistryPage.tsx`,
   `okrRegistryPresenters.tsx`, `kpiScorecardPresenters.tsx`.

**Czego potrzeba**: nic — punkt 2 to zwykły dług do spłacenia w kolejnej fali,
po stronie wywołujących, bez ruszania wspólnego komponentu. Zapisany tutaj,
żeby nie zginął.

---

## OQ-UI-E — `initiatives.status DEFAULT 'step3'`: naprawa udowodniona, ale niescalona

Naprawa luki fikstur w 18 plikach ROI (`d6d54f3e1c`) jest poprawna, ale jej
skutku **nie widać w licznikach** na gałęzi programu: `initiatives.status` nadal
ma `DEFAULT 'step3'`, który łamie własny `initiatives_status_check`, a Postgres
sprawdza CHECK **przed** wyzwalaczem klucza obcego. Każdy dotknięty test umiera
na `23514`, zanim dotrze do `23503`, który ta naprawa usuwa.

Dowiedzione w izolowanym worktree (gałąź `rn-g2-lane-status`, cherry-pick
istniejącego `f99016b632`), na realnym Postgresie 17, pełnym zestawem migracji:

| Domena | Przed | Po zdjęciu maski |
|---|---|---|
| ROI | 129 passed / 48 failed / 12 skipped | **189 / 0 / 0** |
| KPI | 146 / 0 / 5 | 146 / 0 / 5 (bez zmian) |
| OKR | 344 / 0 / 0 | 344 / 0 / 0 (bez zmian) |

Sumy zgodne w obu pomiarach (684 = 684) — brak dryfu, żaden test nie „zniknął".
Kontrola negatywna przeszła: celowo zepsute asercje faktycznie się czerwieni.
**Po zdjęciu maski w ROI i OKR nie zostaje ani jedna porażka z przyczyny
produktowej.**

`f99016b632` łata wszystkie trzy realne ścieżki produkujące schemat
(`PostgresDatabase.ts` runtime DDL, `000_z_core_baseline.sql`,
`000_initdb_core_tables.sql` używany przez `run-initdb.js` z pominięciem runnera
migracji) — zweryfikowane w kodzie, nie przyjęte z dokumentu.

**Dlaczego nie scalono**: `server/src/database/PostgresDatabase.ts` jest jednym z
pięciu plików należących do **równoległej sesji** i ma tam niezacommitowane
zmiany dotyczące dokładnie tego samego problemu. Scalenie na ślepo zniszczyłoby
cudzą pracę w toku.

**Czego potrzeba**: uzgodnienia z tamtą sesją, kto ląduje naprawę. Oczekiwany
konflikt to **jedna linia tekstu** (`'step3'` vs `'DRAFT'` w `initDb()`), nie
konflikt semantyczny — obie naprawy zbiegają się na tej samej wartości.

---

## OQ-UI-F — trzy pliki testowe KPI mają tę samą lukę fikstur, ale są cudze

`initiativeKpiImpactBaselineFreeze.realdb.test.ts`,
`kpiIdentityAcrossSurfaces.realdb.test.ts`,
`kpiInitiativeImpactPerspectivesRoutesRealdb.test.ts` — wszystkie trzy padają na
`initiatives_organization_id_fkey`, dokładnie tak jak naprawione 18 plików ROI.

Ich `beforeAll` łapie błąd i rzuca własny wyjątek („refusing to report a green
run"), więc vitest liczy je jako **3 nieudane pliki**, a zawarte w nich bloki
jako **skipped** — w liczniku testów wyglądają jak 5 pominiętych, nie jak
porażki. To jest dokładnie ten wzorzec, przez który sam licznik potrafi
wprowadzić w błąd.

**Dlaczego nie naprawiono**: wszystkie trzy są na liście plików należących do
równoległej sesji.

**Czego potrzeba**: przekazania tej samej łatki fikstury (`ensureRoiFixtureOrganization`,
`tests/resultsVnext/roi/roiRealdbOrgFixture.ts`) właścicielowi tamtych plików.

---

## OQ-UI-G — nierozstrzygnięte osie odbioru, których automat nie potrafi sprawdzić

Nie są to defekty produktu, tylko granice narzędzia — zapisane, żeby nie zostały
zaliczone jako sprawdzone.

1. **Aktywacja klawiszem Enter/Space** na kebabie i pstryczku kolumn. Sterowanie
   przeglądarką nie wyzwalało natywnej aktywacji nawet na przyciskach z jawnym
   `onClick`, identycznie na niepowiązanym przycisku kontrolnym. Wymaga
   człowieka przy realnej klawiaturze.
2. **Esc i powrót fokusu po zamknięciu modala tworzenia ROI.** Harness sterowany
   parametrami URL, `onClose` jest w nim pusty; sam mechanizm `Modal.tsx` jest
   używany w 25+ miejscach aplikacji i został sprawdzony czytaniem kodu, ale nie
   przejechany end-to-end. Do domknięcia na realnym `/results/roi` za flagą.

---

## OQ-UI-H — `persistKey` OKR jest budowany z identyfikatora rekordu, nie powierzchni

Wszystkie 15 kluczy RN-G2 są poprawnie w przestrzeni `results-vnext.*` (zero
kolizji z żywymi ekranami legacy T36/T37/T38 — to było twarde wymaganie i jest
spełnione). Ale trzy klucze OKR zawierają identyfikator rekordu:

```
results-vnext.okr-objectives.${setId}
results-vnext.okr-key-results.${objectiveId}
results-vnext.okr-check-ins.${keyResultId}
```

Dwa skutki, oba do świadomej decyzji, żaden nie jest awarią:
1. Układ kolumn **nie przenosi się między rekordami** — użytkownik, który ustawił
   sobie kolumny Celów dla jednego zestawu, zobaczy domyślne przy następnym.
   Zwykle układ kolumn należy do POWIERZCHNI, nie do rekordu.
2. Liczba kluczy w pamięci przeglądarki rośnie z liczbą rekordów, bez górnej
   granicy i bez sprzątania.

**Czego potrzeba**: decyzji, czy to zamierzone (np. bo kolumny check-inów mogą
realnie różnić się per Kluczowy Rezultat), czy klucz ma być per powierzchnia.
Zmiana jest jednoliniowa w każdym z trzech miejsc.
