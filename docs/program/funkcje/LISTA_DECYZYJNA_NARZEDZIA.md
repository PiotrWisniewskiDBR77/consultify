---
doc_id: funkcje-lista-decyzyjna-narzedzia
status: canonical
owner: piotr
truth_type: owner-decision-input
established: 2026-08-30
---

# Lista decyzyjna — które narzędzia wchodzą do oferty

Podstawa: cztery równoległe pomiary kodu z 30.08 plus weryfikacja nadzorcy.
Każda liczba pochodzi z komendy, nie z dokumentu.

## Trzy fakty, które zmieniają kształt pytania

**1. Mechanizm zawężania JUŻ ISTNIEJE i jest wpięty.**
`server/src/services/toolCatalog/approvedMvpToolTypes.ts` — zbiór
`APPROVED_MVP_TOOL_TYPES`. Narzędzie spoza zbioru zostaje **widoczne w bibliotece
z etykietą „wkrótce", a jego uruchomienie jest zablokowane i z przodu, i z tyłu**.
Nic nie jest kasowane z kodu — dokładnie tak, jak chciał właściciel.

**2. W tym zbiorze jest dziś JEDNO narzędzie.** `dynamic-swot`.
Plik cytuje zamrożoną decyzję właściciela: *„Tools MVP is Dynamic SWOT. Every other
tool requires a separate packet, provenance and rights, and must be hidden or
explicitly marked UNAVAILABLE."* Testy pilnują równości zbiorów, żeby drugi katalog
nie powstał po cichu.

**Wniosek: decyzja „trzy narzędzia" nie jest wyborem trzech z trzydziestu jeden.
Jest ZMIANĄ ZAMROŻONEJ DECYZJI z jednego na trzy — czyli wskazaniem DWÓCH, które
dołączą do SWOT.**

**3. Wspólna maszyneria jest kompletna; brakuje silników.**
Powłoka, zapis sesji, wersjonowanie wyniku i eksport `DOCX` są **generyczne dla
wszystkich 31** — jeden endpoint, jedna tabela sesji, jedna tabela wyników.
Ale **most „silnik → wynik → dokument" istnieje wyłącznie dla `dynamic-swot`**.
Plik `toolOutputSnapshotService.ts` mówi to o sobie sam, w komentarzu:
*„KNOWN GAP (stated explicitly, not swept under the rug): only `dynamic-swot` has
a real engine bridge"*. Pozostałe 30 produkują snapshot **strukturalnie poprawny,
ale pusty**.

---

## Trzy poziomy gotowości — to jest lista do wyboru

### Poziom 1 — gotowe i zatwierdzone (1)

| Narzędzie | Stan |
| --- | --- |
| **Dynamic SWOT** | pełny łańcuch od rozmowy po dokument, jedyne w `APPROVED_MVP_TOOL_TYPES` |

### Poziom 2 — własny ekran i własny moduł rozmowy, brak mostu do dokumentu (9)

**To jest realna lista wyboru dla dwóch pozostałych miejsc.** Każde z nich ma
dedykowaną grafikę biblioteki **oraz** dedykowany moduł prowadzenia rozmowy
w `src/hooks/discovery/toolAi/` — obie listy liczą po dziesięć pozycji i **pokrywają
się co do nazwy** (dziesiąta to SWOT z poziomu 1).

| Narzędzie | Nazwa w kodzie | Co to jest po ludzku |
| --- | --- | --- |
| Priorytetyzacja portfela | `portfolio-priority` | macierz typu BCG — gwiazdy, dojne krowy, znaki zapytania |
| Siły rynkowe | `market-forces` | pięć sił konkurencyjnych |
| Ścieżki wzrostu | `growth-paths` | opcje wzrostu typu Ansoff |
| Łańcuch wartości | `value-chain` | gdzie powstaje i ucieka wartość |
| Mapa ryzyka i niepewności | `risk-uncertainty` | ryzyka i założenia |
| Mapa kompetencji | `capability-mapper` | co firma umie, czego jej brakuje |
| Dekompozycja ambicji | `ambition-decomposer` | cel nadrzędny na składowe |
| Fokus i kompromisy | `focus-tradeoff` | na czym się skupić, z czego zrezygnować |
| Narracja | `narrative-engine` | historia dla zarządu |

**Koszt jednego narzędzia z tego poziomu:** most silnik→dokument na wzór SWOT.
Wzorzec to około 1600 linii logiki plus komponenty fazowe. **Szacunek: tygodnie,
nie dni** — i to jest szacunek nadzorcy, nie pomiar; do potwierdzenia pierwszym
wykonanym mostem.

### Poziom 3 — sama powłoka (21)

Pozostałe 21 typów z `DEDICATED_TOOL_TYPES` — między innymi budowniczy SOP,
A3, `vsm-builder`, `smed-planner`, skaner RPA, diagnostyka integracji, inwentarz
danych. Mają wpięcie w maszynerię, **nie mają ani własnego modułu rozmowy, ani mostu
do dokumentu**. Wyjątek godny odnotowania: `smed-planner` ma realny silnik przeliczeń
(`src/config/smedplanner/changeoverEngine.ts`), ale **bez mostu do dokumentu** — więc
wynik nigdzie nie wychodzi.

---

## Czego właściciel NIE musi rozstrzygać

Nie musi wybierać spośród nazw takich jak „5S", „Six Sigma DMAIC" czy „Balanced
Scorecard" z listy, którą nadzorca podał wcześniej. **Ta lista była martwa** —
pochodziła z `src/config/transformationTools.ts`, katalogu bez działającego
konsumenta. Sprostowanie zapisane w `DECYZJE_WLASCICIELA_2026-08-30.md`.

## Pytanie w formie ostatecznej

**Które DWA narzędzia z poziomu 2 dołączają do Dynamic SWOT?**

Do tego jedno pytanie towarzyszące, którego nie rozstrzygnę sam, bo jest handlowe:
zamrożona decyzja mówi, że każde dodane narzędzie wymaga **pakietu, pochodzenia
i praw**. Przy narzędziach opartych na cudzych ramach metodycznych (macierz typu BCG,
pięć sił) to jest pytanie o prawa, nie o kod.
