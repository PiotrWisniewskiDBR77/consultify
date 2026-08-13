> ## ★ SPROSTOWANIE (Opus, 2026-08-13, po weryfikacji `DRD_CANON.md`)
>
> Ten dokument powstał na podstawie briefu, w którym **ja** opisałem model
> `D1..D8` jako `INCOMPATIBLE_LEGACY_MODEL`. **To było nieprecyzyjne i wymaga
> sprostowania przed dalszą pracą.**
>
> `DRD_CANON.md` §1 definiuje DRD jako **dwie warstwy o różnych rolach**:
> **POMIAR** (7 osi → 39 obszarów, skale 5/6/7) i **KOMUNIKACJA**
> (**8 wymiarów raportowych `D1..D8`**). §3.2 podaje kanoniczne mapowanie
> **MAP-1.0**, MECE, sumujące się do 39:
> `D1←1A–1I(9) · D2←2A–2E(5) · D3←3A–3E(5) · D4←4A,4B,4D(3) · D5←4C,4E(2) ·
> D6←5A–5E(5) · D7←6A–6E(5) · D8←7A–7E(5)`.
>
> Czyli `D1..D8` **jest warstwą kanoniczną**, nie obcym modelem legacy.
> Poprawny status to **`NOT_WIRED / NORMALISATION_MISSING`**.
>
> Decyzja koordynatora „nie podłączać, nie mapować heurystycznie" **pozostaje
> w mocy i jest słuszna** — ale z innego powodu, niż podałem: nie dlatego, że
> modele są niezgodne, tylko dlatego, że **brakuje kroku normalizacji §6.1**,
> bez którego przeliczenie 39 obszarów na `D_x`/I–V byłoby niewiarygodne.
> Zakaz mapowania heurystycznego/AI obowiązuje bez zmian.

---

# DRD Pathway Mapping — stan faktyczny i warunki domknięcia (COORD-06)

> Agent: A12. Zakres: **wyłącznie pomiar i opis**. Zero mapowania, zero treści
> metodycznej, zero heurystyki/AI. Decyzja koordynatora: **COORD-06 APPROVED**
> — kanonem jest 7 osi / 39 obszarów; `maturityPathwayDrdData.ts` pozostaje
> odłączony i jawnie pusty w Method Packu do czasu przemapowania przez
> właściciela metodyki.
>
> Worktree: `/Users/piotrwisniewski/.codex/worktrees/mac-a12-registers`,
> branch `codex/mac-a12-registers-20260813`, baseline `3faac01e98`.

---

## 1. Stan faktyczny — dwa modele w repo

### 1.1 Model A — ścieżki dojrzałości (`maturityPathwayDrdData.ts`)

Plik: `src/services/assessmentKnowledge/maturityPathwayDrdData.ts`.

Zmierzone wprost z kodu (nie z opisu):

| Cecha | Wartość zmierzona | Dowód w kodzie |
| --- | --- | --- |
| Liczba wymiarów | **8** — `D1`..`D8` | `DRD_DIMENSION_ORDER` (linia 140): `['D1','D2','D3','D4','D5','D6','D7','D8']` |
| Skala poziomów | **1 jednolita drabina 1..5**, etykiety I..V dla WSZYSTKICH 8 wymiarów | `DRD_PATHWAY_LEVEL_ROMAN` (linia 22): `{1:'I',2:'II',3:'III',4:'IV',5:'V'}` |
| Liczba przejść (kroków ścieżki) | **32** = 8 wymiarów × 4 przejścia (I→II, II→III, III→IV, IV→V) | `CANON_TRANSITIONS` (linie 58–138) — policzone: dokładnie 32 klucze `D{1..8}#{1..4}`; `buildPathways()` (linia 142) rzuca wyjątkiem, jeśli któregokolwiek brakuje — czyli struktura jest wymuszona kompletna na 32, nie „około" |
| Nazwy wymiarów | D1 Procesy cyfrowe, D2 Produkty cyfrowe, D3 Cyfrowe modele biznesowe, D4 Dane i analityka, D5 Technologia i infrastruktura, D6 Ludzie i kultura, D7 Cyberbezpieczeństwo, D8 Dojrzałość AI | komentarze przy każdym bloku `CANON_TRANSITIONS` |
| Pochodzenie tekstu | Werbatim transkrypcja `docs/product/DRD_CANON.md` §5 ("Ścieżka przejścia N→N+1 per wymiar") — potwierdzone porównaniem treści D1 I→II w obu plikach, identyczne znak w znak | nagłówek pliku + `DRD_CANON.md` linie 205–208 |

### 1.2 Model B — kanoniczna struktura pomiarowa (`drdStructure.ts`)

Plik: `src/services/drdStructure.ts`, SSOT opisowe: `docs/product/DRD_CANON.md` §2.3 (zamrożone v1.0).

| Cecha | Wartość zmierzona | Dowód |
| --- | --- | --- |
| Liczba osi | **7** | `DRD_STRUCTURE` (linia 1762): `[AXIS_1_PROCESSES..AXIS_7_AI_MATURITY]` |
| Liczba obszarów | **39** | `getTotalAreaCount()` sumuje `axis.areas.length` po 7 osiach; `DRD_CANON.md` §2.3 podaje rozbicie 9+5+5+5+5+5+5=39, potwierdzone niezależnie w `EVIDENCE_LEDGER.md` G1.2 |
| Rozkład obszarów per oś | Oś1=9 (1A–1I), Oś2–Oś7=5 każda (2A–2E … 7A–7E) | `DRD_CANON.md` §2.3 tabela |
| Skale (poziomy) per oś | **MIESZANE, nie jednolite**: Oś1=1–7, Oś2=1–5, Oś3=1–5, Oś4=1–7, Oś5=1–6, Oś6=1–6, Oś7=1–5 | `DRD_CANON.md` §2.3 tabela; potwierdzone niezależnie `EVIDENCE_LEDGER.md` G1.3 |
| Poziom interpretacyjny klienta | I..V (5 poziomów), wspólny język niezależny od natywnych drabin | `DRD_CANON.md` §4.1 |

### 1.3 Oficjalne mapowanie 39→8 już istnieje w kanonie — ale nie jest to to samo co „zgodność modeli"

`DRD_CANON.md` §3.2 ("MAP-1.0") definiuje agregację 39 obszarów do 8 wymiarów
raportowych o TYCH SAMYCH identyfikatorach `D1`..`D8`, jakich używa
`maturityPathwayDrdData.ts`:

| Wymiar | Obszary źródłowe | Skala natywna (PO agregacji, PRZED normalizacją do I–V) |
| --- | --- | --- |
| D1 | 1A–1I (9) | 7 |
| D2 | 2A–2E (5) | 5 |
| D3 | 3A–3E (5) | 5 |
| D4 | 4A, 4B, 4D (3) | 7 |
| D5 | 4C, 4E (2) | 7 |
| D6 | 5A–5E (5) | 6 |
| D7 | 6A–6E (5) | 6 |
| D8 | 7A–7E (5) | 5 |

Czyli: `D1`..`D8` **jako nazwy wymiarów raportowych** są zgodne między oboma
plikami. To, co jest **niezgodne**, to zestawienie:
1. wymiar D5 w `maturityPathwayDrdData.ts` ma pełny zestaw 4 przejść I→V,
   podczas gdy w MAP-1.0 jest agregatem tylko 2 obszarów (4C, 4E) — mniejszym
   niż pozostałe wymiary;
2. `maturityPathwayDrdData.ts` zakłada JEDNĄ drabinę 1–5 dla wszystkich 8
   wymiarów, podczas gdy MAP-1.0 mówi wprost, że każdy `D_x` ma własną skalę
   natywną (5/5/5/7/7/6/6/5) — I–V jest interpretacją PO normalizacji, nie
   surowym poziomem;
3. krok normalizacji natywnej skali (5/6/7) do wspólnej skali I–V jest
   opisany w kanonie (wzór przy §6, nota wdrożeniowa w `DRD_CANON.md` linia
   283), ale **nie jest zaimplementowany** — `calculateOverallScore()` i
   `calculateAxisScore()` w `src/services/drdStructure.ts` dziś uśredniają
   **surowe** poziomy między osiami o różnych skalach, bez normalizacji.

**Wniosek:** nie istnieje dziś żaden fragment kodu, który weźmie realny wynik
oceny (39 wpisów, mieszane skale), przepuści go przez MAP-1.0 + normalizację
§6, i wyprodukuje wiarygodny poziom I–V per `D_x` do nakarmienia
`getMaturityPathway({ framework: 'drd', ... })`. Ta luka — nie same nazwy
`D1`..`D8` — jest sednem niezgodności.

---

## 2. Konsumenci `getMaturityPathway()`

Zmierzone przez `grep -rn "getMaturityPathway" src server/src`:

| Plik:linia | Kontekst |
| --- | --- |
| `src/services/assessmentKnowledge/maturityPathwayService.ts:101` | definicja funkcji (eksport główny) |
| `src/services/assessmentKnowledge/index.ts:18` | re-eksport z barrela modułu |
| `src/components/assessment/reports/MaturityPathwaySection.tsx:24,64` | komponent UI — renderuje karty ścieżki N→N+1 dla DRD/SIRI/ADMA w raporcie |
| `src/components/assessment/reports/templates/DRDReportTemplate.tsx:36,99` | szablon raportu DRD — woła funkcję przez WŁASNĄ, ręczną mapę `DRD_AXIS_TO_CANON_DIMENSION` (linie 32–47), która stratnie tłumaczy 7 osi na `D1`..`D8` i **pomija oś odpowiadającą D5** (Technologia i infrastruktura nie ma dedykowanej osi źródłowej w tej ręcznej mapie) |
| `src/method-core/methods/drd/compileDrdPack.ts:24,417` | TYLKO w komentarzu/`discrepancies` — kompilator świadomie NIE woła tej funkcji; zgłasza rozbieżność zamiast cicho wybierać model |

Brak wywołań w `server/src` (grep zero trafień) i brak dedykowanych testów
jednostkowych dla `getMaturityPathway()` w drzewie repo poza istniejącymi
testami frameworków SIRI/ADMA, które nie korzystają z gałęzi DRD tej funkcji.

**Dodatkowy, wcześniej nieopisany defekt znaleziony przy tym pomiarze:**
`DRDReportTemplate.tsx:32-47` zawiera drugą, niezależną, ręczną mapę oś→D_x,
różną od kanonicznej MAP-1.0 (§3.2) i od tego zadania — trzeci punkt
niespójności, nie tylko dwa. Wymaga osobnego zgłoszenia do koordynatora
(poza zakresem tego zadania — TYLKO pomiar, nie naprawa).

---

## 3. Co dokładnie trzeba rozstrzygnąć, żeby mapowanie było możliwe

1. **Czy D5 (Technologia i infrastruktura) w ogóle powinien mieć pełną
   drabinę 4 przejść I→V**, skoro w MAP-1.0 jest agregatem tylko 2 obszarów
   (4C, 4E) — czy to za mało sygnału, by uzasadnić 4 osobne, konkretne
   przejścia opisane w Canon §5?
2. **Jak normalizować** mieszane skale natywne (5/6/7) do wspólnej I–V
   PRZED użyciem w `getMaturityPathway()` — wzór istnieje w kanonie (§6,
   nota przy linii 283 `DRD_CANON.md`), ale nie jest zaimplementowany; kto
   go implementuje i gdzie (w `drdStructure.ts` czy w nowej warstwie
   agregującej)?
3. **Czy treść przejść w `CANON_TRANSITIONS` (32 wpisy) pozostaje aktualna**
   po normalizacji, czy wymaga przeglądu przez właściciela metodyki pod
   kątem tego, że opisuje przejścia na surowej skali I–V, a realny wynik
   wymiaru będzie teraz liczony inaczej (normalizowany, nie uśredniany
   wprost)?
4. **Co z trzecią, rozbieżną mapą** w `DRDReportTemplate.tsx` — czy ma zostać
   zastąpiona MAP-1.0, usunięta, czy jest to inny, celowo uproszczony byt?
   (Do rozstrzygnięcia razem z niniejszym tematem, bo dotyczy tych samych
   `D1`..`D8`.)
5. **Kto jest właścicielem metodyki DRD** uprawnionym do zatwierdzenia
   powyższego — DRD/Digital Pathfinder jest metodyką licencjonowaną
   (`compileDrdPack.ts` linia 21: `manifest.licence`), więc decyzja nie może
   być techniczna/inżynierska.

---

## 4. Wymagane traceability

Każde przyszłe mapowanie musi być udokumentowane jako osobny, wersjonowany
rekord — NIE jako komentarz w kodzie i NIE jako ukryta logika w komponencie
(tak jak dziś `DRDReportTemplate.tsx` robi to po cichu). Minimalny kształt
rekordu na wpis:

| Pole | Wymagane |
| --- | --- |
| `dimensionId` | `D1`..`D8` |
| `sourceAreaIds` | lista obszarów źródłowych (np. `4C`, `4E`) — zgodna z MAP-1.0 §3.2 lub jawnie inna z uzasadnieniem |
| `normalisationRule` | dokładny wzór/procedura użyta do sprowadzenia natywnej skali (5/6/7) do I–V, z odwołaniem do `DRD_CANON.md` §6 |
| `sourceRef` | dokładne odwołanie do dokumentu kanonu (rozdział/paragraf) |
| `approvedBy` | rola: właściciel metodyki DRD |
| `approvedDate` | data zatwierdzenia |
| `versionTag` | wersja mapowania (mapowanie jest wersjonowane, tak jak MAP-1.0 samo w sobie jest wersją "1.0") |

Bez KOMPLETU tych pól dla WSZYSTKICH 8 wymiarów, `getMaturityPathway()` dla
DRD nie powinien być podłączony do żadnej ścieżki produkcyjnej.

---

## 5. Mapowanie 8 → 39 jest stratne — jawne stwierdzenie

Redukcja 39 niezależnie ocenianych obszarów (każdy z własną drabiną 5/6/7
poziomów, własnymi pytaniami QBank v2, własnym dowodem) do 8 wymiarów
raportowych, każdy z JEDNĄ liczbą I–V, **z definicji gubi informację**:
różne kombinacje wyników obszarów składowych mogą dać ten sam zagregowany
poziom I–V wymiaru. To nie jest błąd implementacyjny do "naprawienia" —
to **właściwość** modelu 8-wymiarowego jako warstwy komunikacyjnej (Canon
§3, "Zasada: klient widzi 8 wymiarów; konsultant ocenia 39 obszarów").
Konsekwencja: KAŻDA decyzja o tym, jak agregować i jak formułować
prescriptive `actions` na tym zagregowanym poziomie, jest decyzją
metodyczną z realną utratą precyzji — wymaga świadomej zgody właściciela
metodyki, nie automatycznego uśrednienia.

---

## 6. Czego NIE wolno zrobić

- **Heurystycznego dopasowania** obszarów do wymiarów po nazwie/słowach
  kluczowych zamiast użycia jawnej tabeli MAP-1.0 (§3.2) lub jej
  następczyni zatwierdzonej przez właściciela metodyki.
- **Mapowania przez model AI** (dopasowanie semantyczne, „na oko",
  wnioskowanie z opisów) — DRD jest metodyką licencjonowaną; wygenerowana
  treść lub mapowanie byłyby fabrykowaniem metodyki (ten sam zakaz co
  COORD-07 dla brakującej treści Method Packa).
- **Cichego wyboru jednego modelu** bez zapisania decyzji i bez
  aktualizacji WSZYSTKICH trzech miejsc, które dziś niezależnie próbują
  mapować `D1`..`D8` (MAP-1.0 w kanonie, `DRDReportTemplate.tsx`, ta
  ścieżka dojrzałości) — muszą się zgadzać ze sobą po zmianie.
- **Podłączenia `getMaturityPathway()` do realnych wyników oceny** przed
  domknięciem normalizacji (§6 kanonu) i zatwierdzeniem mapowania.
- **Kasowania lub przepisywania treści `CANON_TRANSITIONS`** — to
  verbatim transkrypcja kanonu §5; jeśli treść wymaga zmiany, zmiana
  wchodzi NAJPIERW do `DRD_CANON.md`, a stąd jest transkrybowana, nigdy
  odwrotnie.

---

## 7. Status po tym zadaniu

`maturityPathwayDrdData.ts` i `maturityPathwayService.ts` mają teraz
jawne komentarze `STATUS: INCOMPATIBLE_LEGACY_MODEL / NOT_MAPPED` na
górze pliku (patrz commit `ff4da6b606` na tej gałęzi). Logika i dane
NIE zostały zmienione — zero mapowania, zero treści metodycznej,
zero heurystyki wykonano w ramach tego zadania.

**NOT VERIFIED w tym zadaniu** (poza zakresem — tylko sygnalizacja):
- Stan trzeciej, rozbieżnej mapy w `DRDReportTemplate.tsx` na żywej bazie /
  w renderowanym raporcie — nie sprawdzono wizualnie, tylko w kodzie źródłowym.
- Czy `MaturityPathwaySection.tsx` faktycznie jest osiągalny z jakiegokolwiek
  ekranu za dziś aktywną flagą — nie sprawdzono runtime, tylko istnienie
  importu w kodzie.
