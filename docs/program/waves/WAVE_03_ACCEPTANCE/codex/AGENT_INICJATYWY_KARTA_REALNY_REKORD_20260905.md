# Inicjatywy — karta realnego rekordu + EV football-field (05.09.2026)

Gałąź: `agent/inicjatywy-karta-realny-rekord-20260905` (baza: `/private/tmp/m03`, `81460544f4`)
Zgłoszenie: `evidence/odbior-zywo-20260905/06-inicjatywy/RAPORT.md` — trzy pozycje
„NIE DOTARŁEM": `karta-initiative`, `initiative-record`, `ev-football-field`.

---

## 1. Pomiar przyczyny — skąd lista, dlaczego karta 404

Wszystkie odpowiedzi poniżej to **żywe odczyty GET ze stagingu** sesją właściciela
(org `a3e05d4a-5397-419d-b486-8e44366c0063`), nie lektura kodu. Zapis do stagingu: żaden.

### 1.1 Skąd lista bierze wiersze

`InitiativesHub.tsx:506` woła `listRegisteredInitiatives()`
(`src/services/initiatives-execution/runtimeApi.ts:1042`) →
`GET /api/initiatives/runtime-v1/initiatives`.

```
### 200 /api/initiatives/runtime-v1/initiatives?limit=5
{"initiatives":[{"version":1,"initiative":{
  "title":"Pełna identyfikowalność partii",
  "initiativeId":"demo-story-20260826-initiative-traceability",
  "source":{"sourceType":"DEMO_STORY","sourceId":"demo-story-20260826-source-traceability", …},
  "demoSeed":"2026-08-26","lifecycleState":"IN_EXECUTION","executionState":"ACTIVE",
  "projectId":"a3e05d4a-…--acceptance--case-project", …}}, …]}
```

**Lista NIE jest zmieszana z fiksturą pokazową.** Źródło jest rozłączne z kodu:
`selectInitiativeRegisterSource(canonicalRows, sampleRows, sampleMode)`
(`initiativeRegisterProjection.ts:183`) zwraca **albo** jedno **albo** drugie, a
`sampleMode = shouldAllowDemoData()` (`api.ts:739`) jest zapalane wyłącznie jawnym
przełącznikiem właściciela w Ustawieniach (bez backdoora na DEV/localhost).

### 1.2 Dlaczego realne wiersze mają id `demo-story-*` — FAKT O DANYCH

Napis `demo-story` **nie występuje w kodzie aplikacji** (`rg 'demo-story' src server/src` → 0 trafień).
To identyfikatory **realnych rekordów w bazie stagingu**, zaseedowanych 2026-08-26
(`demoSeed: "2026-08-26"`, `sourceType: "DEMO_STORY"`). Fikstura klienta używa zupełnie
innego prefiksu — `init-showcase-` (`initiativesDemoData.ts:72`, `isShowcaseInitiativeId`).
Zgodnie ze zleceniem **nie przemianowuję danych na stagingu**; naprawiam kod tak, żeby te
rekordy dały się otworzyć właściwą trasą.

### 1.3 Którą trasę wołała karta i na co dostawała 404

`InitiativeDocumentView.fetchAll` (przed naprawą) próbowała dokładnie trzech źródeł:

| # | Trasa | Wynik na `demo-story-20260826-initiative-traceability` |
|---|---|---|
| 1 | `GET /api/v8/planning/initiatives/:id` | **404** `{"error":"Initiative not found"}` |
| 2 | `GET /api/initiatives/:id` | **404** `{"error":"Initiative not found","code":"INITIATIVE_NOT_FOUND"}` |
| 3 | `GET /api/initiatives?source=interview_insight` | 200, ale lista **nie zawiera** tego id |
| — | → `throw new Error(t('initiatives.initiativeNotFound2'))` | czerwony błąd „Nie udało się załadować karty inicjatywy" |

A rekord **istnieje i jest osiągalny** — tą samą trasą, z której przyszedł wiersz listy:

```
### 200 /api/initiatives/runtime-v1/initiatives/demo-story-20260826-initiative-traceability
{"version":1,"initiative":{"title":"Pełna identyfikowalność partii", …},"updatedAt":"2026-08-26T04:01:55.596Z"}
```

Serwer ma ten handler od dawna (`server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:2076`,
`GET /initiatives/:initiativeId`) i klient też ma gotowy wołacz
(`runtimeApi.ts:955`, `readRegisteredInitiative`) — **karta po prostu nigdy go nie wołała**.
To jedenasty kształt z rejestru („biblioteka bez wywołania") w wersji odwrotnej: wołacz
istnieje, ale nie na tej ścieżce, na której jest potrzebny.

**Diagnoza jednym zdaniem:** lista i karta czytały z DWÓCH RÓŻNYCH modeli odczytu;
rejestr runtime-v1 karmi listę, a karta pytała wyłącznie modeli, które tych rekordów nie znają.

---

## 2. Naprawa — karta otwiera realny rekord

### 2.1 Nowy, testowalny punkt rozstrzygania źródła

`src/components/Initiatives/initiativeDocumentSource.ts` (nowy):

- `resolveInitiativeDocumentRecord(id, readers)` — łańcuch **v8 → legacy → rejestr runtime-v1 →
  skan `interview_insight`**. Kolejność jest addytywna: rekordy, które żyją w v8/legacy, ładują się
  jak dotąd (bogatszy kształt), a rejestr wchodzi dopiero tam, gdzie wcześniej był czerwony błąd.
- `toInitiativeDocumentFromRegistration(record)` — adapter read modelu na kształt karty.
  Reużywa kanonicznego `toCanonicalInitiativeRegisterItem`, żeby wiersz listy i karta nie
  rozjechały się po raz drugi.

`InitiativeDocumentView.tsx` woła ten moduł zamiast zaszytego łańcucha `.catch(...)`.

### 2.2 Druga usterka złapana zrzutem, nie testem

Po pierwszym poprawnym otwarciu karta pokazywała w nagłówku i we Właściwościach
**„Szkic"** dla rekordu, który jest **„W realizacji"**.
Przyczyna: `toCanonicalInitiativeRegisterItem` zostawia `displayStatus` w słowniku
**cyklu życia rejestru** (`IN_EXECUTION`), a karta czyta `displayStatus` PRZED `status`
(`getWorkflowStatusForInitiative`, `src/utils/initiativeWorkflowStatus.ts:8`) i **nieznaną
wartość ścina do `DRAFT`**. Adapter podaje więc karcie `displayStatus` w jej własnym słowniku
(`EXECUTING`); `lifecycle` (stan rejestru) zostaje nietknięty.

To jest dokładnie ten przypadek, którego test jednostkowy sam z siebie nie łapie —
liczba się zgadzała, znaczenie nie. Bezpiecznik dopisany (patrz §4).

---

## 3. EV football-field — droga dojścia i naprawa

### 3.1 Zatwierdzony obraz i jego realny komponent

`dev-render/screens/ev-football-field.tsx` to mock-host realnego, prezentacyjnego komponentu
`src/components/Economics/panels/EvBasketFootballField.tsx`
(`data-testid="ev-basket-football"`, nagłówek „Enterprise Value — przedział rekomendowany").
Produkcyjnych konsumentów są dwaj:

1. `src/components/Benefits/ValuationWorkspace.tsx:1135` — Finance → **Wycena przedsiębiorstw**,
   krok **„Wyniki"**, za flagą `ff.evBasket` (`financeEvBasketFlag.ts`, **default ON**).
2. `src/components/Economics/FinanceValuePanelsSurface.tsx` — wewnętrzna galeria paneli
   deweloperskich (to ją odbierający zobaczył po wymuszeniu `ff.finance_value_panels`; **nie** jest
   to droga produktowa i nie ma jej być).

Czyli droga zatwierdzonego obrazu to **(1)**, a nie galeria.

### 3.2 Co blokowało — pomiar

Realna wycena `ab2dcfe8805042efb7e3e420f1028a48` („CD PROJEKT Group — Bear DCF + multiples"):

| Trasa | Wynik |
|---|---|
| `GET /api/economics/valuations/:id` | **200** — pełny rekord, w tym `results.dcf.enterpriseValue = 4 219 798,26` |
| `GET /api/economics/valuations/:id/basket` | **200** — realny koszyk metod (jest czym karmić panel!) |
| `GET /api/v8/finance-v2/artifacts/resolve-legacy/valuations/:id` | **200** `{"status":"NOT_MIGRATED"}` |
| `GET /api/v8/finance-v2/valuation/legacy/:id/inputs` | **409** `LEGACY_IDENTITY_UNMAPPED` „Legacy valuation is not mapped" |

`FinanceLegacyBridgeGate` **celowo** kieruje rekordy `NOT_MIGRATED` do sprawdzonego widoku
klasycznego (`unresolvedFallback`, `FinanceHub.tsx:3673`) — ta część działała. Wywracał się
dopiero sam widok: `ValuationWorkspace.fetchValuation` robiło
`Promise.all([legacy detail, getCanonicalValuationInputs(id)])`, więc **jedno 409 z warstwy
kanonicznej zabijało CAŁE ładowanie rekordu** → `setSelected` nigdy nie było wołane →
ekran zostawał na „Select a valuation to continue" → panel EV (renderuje się tylko przy
`evBasketEnabled && dcf`) nigdy się nie pojawiał.

Uwaga do wcześniejszego zgłoszenia: **flaga EV basket nie była problemem** (jest domyślnie ON),
a `ff.finance_value_panels` dotyczy innej, wewnętrznej powierzchni.

### 3.3 Naprawa

W `ValuationWorkspace.fetchValuation` warstwa kanoniczna jest **wzbogaceniem, nie warunkiem**:

- rekord ładuje się z archiwum (`/api/economics/valuations/:id`);
- `getCanonicalValuationInputs` w osobnym `try` — gdy 409/błąd, pokazujemy `results`/`assumptions`/
  `peers` **z archiwum** i podnosimy `canonicalInputsUnavailable`;
- widoczny, uczciwy pasek **„Dane z archiwum wyceny"** (nowe klucze `valuation.archiveOnly.*`
  w `pl` i `en`, oba przetłumaczone — nie sam klucz) mówi wprost, skąd są liczby;
- gdy warstwa kanoniczna działa — zachowanie bez zmian (bez paska).

Efekt: „Enterprise Value — przedział rekomendowany" jest osiągalny z realnego rekordu
ścieżką **Finanse → Wycena przedsiębiorstw → rekord → krok „Wyniki"**.

### 3.4 Czego NIE ma w danych (uczciwie)

Koszyk na stagingu ma dla tej wyceny **jedną metodę** (`M1 · DCF / FCFF`), więc panel
rysuje jeden pasek i sam pisze: „Tylko jedna metoda w koszyku — brak triangulacji; dodaj
mnożniki lub metodę majątkową". Zatwierdzony obraz pokazuje cztery metody, bo mock-host
karmi go czterema. **To różnica DANYCH, nie kompozycji** — komponent, tokeny i układ są te same.
Żeby obraz zgadzał się co do liczby pasków, wycena musi mieć policzone mnożniki/metodę
majątkową (osobna praca po stronie silnika wyceny, poza tym dyżurem).

---

## 4. Testy i dowód mutacyjny

`src/components/Initiatives/__tests__/initiativeKartaRealnyRekord.test.ts` (6 testów, 6 PASS):

- lista realnej org nie miesza się z fiksturą (i odwrotnie — fikstura nigdy nie jest nakładką);
- `demo-story-*` NIE jest identyfikatorem pokazowym klienta;
- karta ładuje rekord z rejestru runtime-v1, gdy v8 i legacy zwracają 404, i **nie dotyka**
  trasy ratunkowej `interview_insight`;
- **integracja z realnym klientem HTTP**: uderzenie idzie dokładnie w
  `/api/initiatives/runtime-v1/initiatives/<id>` (asercja na URL-u, nie na atrapie);
- adapter zachowuje tożsamość, wersję, cykl życia i **`displayStatus === 'EXECUTING'`**
  (bezpiecznik defektu z §2.2);
- **dowód mutacyjny w samym teście**: po wycięciu rejestru z łańcucha ten sam realny rekord znowu
  nie ładuje się.

`tests/components/Finance/valuationEvFootballFieldRealRecord.test.tsx` (2 testy, 2 PASS):
- realny rekord `NOT_MIGRATED` otwiera się mimo 409 i renderuje `ev-basket-football` na kroku
  „Wyniki" + pasek „Dane z archiwum wyceny", i nie zostaje na „Select a valuation to continue";
- przy działającej warstwie kanonicznej panel renderuje się nadal, bez paska archiwum.

**Dowód mutacyjny na KODZIE PRODUKCYJNYM (nie na atrapie w teście):**

| Mutacja | Wynik |
|---|---|
| wycięcie gałęzi rejestru runtime-v1 z `initiativeDocumentSource.ts` | 2 z 6 testów **czerwone**, po przywróceniu 6/6 zielone |
| powrót do twardego sprzężenia kanonu w `ValuationWorkspace` (`throw canonicalError`) | 1 z 2 testów **czerwony**, po przywróceniu 2/2 zielone |

Testy sąsiednie bez regresji: `InitiativesHub.smoke`, `day277-wypelnij-cala-karte`,
`initiativeRegisterProjection.scope`, `tests/unit/initiatives/initiativeRecordCanon` — 25 PASS / 1 todo.

**Czerwień ZASTANA (nie moja):** `tests/components/Finance/ValuationVisualsPanelM16.test.tsx`
— 2 testy pustego stanu („Uruchom wycenę, aby zobaczyć wizualizacje.") padają tak samo
w nietkniętym `/private/tmp/m03`. Zmierzone przed werdyktem, nie przypisuję tego naprawie.

## 5. Zrzuty PO (jasny motyw, 1440, własny vite :3111, sesja właściciela)

`evidence/inicjatywy-karta-20260905/`

| Plik | Co pokazuje |
|---|---|
| `01-lista.png` | rejestr Inicjatyw: 15 REALNYCH rekordów organizacji, po polsku, zero wierszy pokazowych |
| `02-podglad.png` | podgląd „Pełna identyfikowalność partii" z akcją „Otwórz" |
| `03-karta-realny-rekord.png` | **karta otwarta** na `?open=demo-story-20260826-initiative-traceability`: tytuł, realny problem, 24 sekcje w 5 grupach, status „W realizacji", brama „Zakończenie realizacji" — zero czerwonego błędu |
| `04-ev-wycena-otwarta.png` | realna wycena otwarta z listy Finanse (WACC 10,2 · comps 6,4/8/9,6) + dwa uczciwe paski |
| `05-ev-football-field.png` | **„Enterprise Value — przedział rekomendowany"** na kroku „Wyniki" realnego rekordu, realne liczby (3 mld–7 mld zł) |

Do zrzutu §5 potrzebny był parametr, którego kanoniczny skrypt nie miał (blok leży poniżej
pierwszego ekranu, a `--pelna` daje obraz nie do obejrzenia). Zgodnie z zasadą „nie pisz
własnego zrzutu obok kanonicznego" dołożyłem go **do narzędzia, opt-in**:
`scripts/dev/odbior-zywo/zrzut.mjs` → `--przewin=<selektor>` (bez tego parametru zachowanie
bajt w bajt jak dotąd; parametr trafia też do zapisywanego `<out>.json`).

Procesy: własny vite na :3111 wystartowany i **zabity po PID** (57999). Katalog cache miałem
osobny (`/private/tmp/ag-init-karta/.vite-odbior`), żeby nie ruszać `node_modules/.vite`
współdzielonego z `/private/tmp/m03`; sprzątnięty.

## 6. Commity

| SHA | Zakres |
|---|---|
| `51337e3f65` | karta ładuje realny rekord z rejestru runtime-v1 (nowy `initiativeDocumentSource.ts` + wpięcie) |
| `3ca9fe2aa1` | testy: lista bez wierszy pokazowych + karta ładuje realny rekord (dowód mutacyjny) |
| `783151ddd9` | EV football-field osiągalny z realnego rekordu wyceny (+ klucze `valuation.archiveOnly.*` pl/en, test) |
| `e67e7565be` | karta pokazuje realny status rekordu (`displayStatus` w słowniku karty) |

## 7. Co zostaje otwarte

1. **Koszyk metod ma na stagingu jedną metodę** — panel jest poprawny, dane niepełne (§3.4).
2. **`NOT_MIGRATED` to stan całej rodziny wycen**, nie jednego rekordu — backfill kanoniczny
   Finance nigdy nie objął tych 15 wycen. Naprawa tego dyżuru sprawia, że rekordy są UŻYWALNE,
   ale nie zastępuje backfillu; osobna gałąź `agent/finance-bridge-gate-20260905` dotyka tego
   samego obszaru (gate), moja zmiana jest w innym pliku (`ValuationWorkspace.tsx`).
3. **Karta ładuje się, ale sekcje treści są puste** (Opis rozwiązania, Koszt bezczynności…) —
   rekordy rejestru niosą tylko `problem` i `proposedOutcome`. To brak DANYCH, nie karty.
4. **Ostrzeżenie Reacta** „Each child in a list should have a unique key" w `ValuationWorkspace`
   (zastane, nie z mojej zmiany) — do sprzątnięcia osobno.
