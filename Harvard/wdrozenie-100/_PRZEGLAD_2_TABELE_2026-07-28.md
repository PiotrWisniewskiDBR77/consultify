# PRZEGLĄD 2 — 74 zrzuty Piotra (2026-07-28, po wdrożeniu fali tabel)

> **Ocena Piotra:** „nie zrobiłeś nawet połowy tego, co wczoraj zostało opisane".
> **Weryfikacja: ma rację.** Poniżej rozliczenie na podstawie zrzutów, nie deklaracji.
>
> **Zrzuty:** `rejestr/_zrzuty/2026-07-28/` (74 PNG, chronologicznie = kolejność przechodzenia).
> **Wejście:** `_ODBIOR_TABELE_PREVIEW_2026-07-27.md`, `docs/ui-standards/TRIADA_KANON.md`.
> **Stan demo w chwili zrzutów:** `0bc0a4df0b44` / `22a29c3c16ef` (plakietka), czyli PO fali `77d04f623a`.

---

## ★★★ WZORZEC MOICH BŁĘDÓW — jedna przyczyna, cztery skutki

Cztery z sześciu potwierdzonych braków mają **ten sam mechanizm**: naprawiłem
PIERWSZE znalezione wystąpienie i nie sprawdziłem, czy są inne. Bramki tego nie
łapią, bo kod się kompiluje i testy przechodzą — brakującego miejsca po prostu nikt nie pyta.

| # | Uwaga | Co naprawiłem | Czego NIE sprawdziłem |
|---|---|---|---|
| B-1 | **P-24** surowy `Date.toString` w Finance | `periodLabel`/`periodStart`/`periodEnd` w **jednym** bloku mapowania (linie 851–866) | **Drugi blok mapowania** (3085–3088) — i to z niego karmi się ekran. Do tego `entityName`, którego kolumna NAME używa PIERWSZEGO, nie było sanityzowane **w żadnym** z dwóch. Na zrzucie: `Thu Dec 31 2026 00:00:00 GMT+0000 (Coordinated Universal Time)` w NAME **i** PERIOD (3 linie wysokości wiersza) |
| B-2 | **Jeden format daty** | Interview, Tools, Ideas (22 wywołania) | **Całe My Work**: Inbox pokazuje `Apr 20`, `Mar 18`, `Jul 21`; Tasks `Feb 9`, `Feb 11`, `Mar 26`. Czyli moduł, w którym Piotr siedzi najczęściej |
| B-3 | **P-4** kebab ⋮ w bloku DETAILS | akcje w `MyIdeasListContent` | Podgląd Ideas na zrzucie **nadal nie ma ⋮** → naprawa trafiła w komponent, który tego ekranu nie renderuje |
| B-4 | **Nagłówki UPPERCASE** | polskie `TYP`/`TRYB` w Documents | **N-1: Ideas ma `Title · Stage · Tags · Tool · Updated` Title Case** — a to była pierwotna treść uwagi. Zaliczyłem sobie „nagłówki" naprawiając coś innego |

**Wniosek na przyszłość:** po każdej naprawie `grep` na WSZYSTKIE wystąpienia wzorca,
nie tylko na to, które znalazłem jako pierwsze. Dla pól z danych — sprawdzić każdą
ścieżkę mapowania, bo lista i podgląd potrafią karmić się z różnych.

---

## POTWIERDZONE, NIEZROBIONE

### My Work → Ideas
| # | Naruszenie | Ref |
|---|---|---|
| A-1 | Nagłówki **Title Case zamiast UPPERCASE** | N-1 (kanon C6) |
| A-2 | **`Source: manual` renderuje się DWA RAZY** — w `CONTEXT` i luzem nad `WHAT'S NEXT` | **PILNE-2** |
| A-3 | **Brak kebaba ⋮ przy `DETAILS`** | **P-4** |
| A-4 | **`WHAT'S NEXT` wychodzi poza panel**: `Financial Model` łamie się na 2 linie, `Bud…` ucięte. Pięć pozycji nie mieści się w szerokości podglądu | nowe |
| A-5 | ~150 px pustki między `CONTEXT` a `✨ AI` | OBR-12 |
| A-6 | `Creates a MyWork session first` po angielsku w polskim UI | OBR-12 |
| A-7 | `Folder ⌄` / `Recent ⌄` po **prawej** stronie Menu 3 — kanon A3: po prawej tylko AI, filtry po lewej | sprzeczność D-02 ↔ A3, do rozstrzygnięcia |

### My Work → Inbox
| # | Naruszenie |
|---|---|
| A-8 | Daty `Apr 20` / `Mar 18` / `Jul 21` — angielskie skróty zamiast `DD/MM/YYYY` |
| A-9 | Duplikaty wierszy ×2–×3 (dane) |
| A-10 | Cztery filtry z zerem: `Saved 0 · AI 0 · Today 0 · This week 0` |

### My Work → Tasks
| # | Naruszenie |
|---|---|
| A-11 | Daty `Feb 9` / `Mar 26` — jak wyżej |
| A-12 | `Done` w stopce podglądu = pełny zielony, kanon A8 mówi o **tincie** (N-22) |

### Finance → Statements
| # | Naruszenie |
|---|---|
| A-13 | **`Thu Dec 31 2026 00:00:00 GMT+0000 (Coordinated Universal Time)` w NAME i PERIOD** — 4 z 6 wierszy. Wiersz rozciąga się na 3 linie |

### Tools → Library _(ekran spoza poprzedniego przeglądu)_
| # | Naruszenie |
|---|---|
| A-14 | **Prawa strona Menu 3 pusta** — brak przycisku AI (kanon A3) |
| A-15 | `CATEGORY` renderowana jako **goły kolorowy tekst** (`Strategy` zielony, `Operations` niebieski) — nie chip, nie kropka+tekst; niespójne z każdą inną kolumną kategorii |
| A-16 | Chip `In development` przy nazwie **duplikuje** kolumnę `STATUS` (`Inactive`) |
| A-17 | Tagi ucięte w połowie: `operating-…`, `standard-w…` |

---

## DZIAŁA (potwierdzone na zrzutach — nie wszystko poszło źle)

- Inbox / Tasks / Tools: **nagłówki UPPERCASE** ✓
- Inbox: **`Critical` jako kropka + tekst**, nie czerwona pigułka ✓ (N-10)
- Inbox: **`Assignment` / `Review` / `System`** zamiast surowych `assignment` / `review` ✓ (N-11)
- Inbox: **po prawej Menu 3 sam `AI Triage`** ✓ (P-10) · Tasks: sam `AI Priorities` ✓
- Tasks: kebab ⋮ w `DETAILS`, `No relations` ✓
- Ideas: daty `27/07/2026` ✓, Stage jako kropka + tekst ✓, odstęp pod Menu 3 ✓
- Sejf: jedna wyszukiwarka, brak czwartej warstwy, brak chipów z cudzych modułów ✓

---

## STAN PRZEGLĄDU

Przejrzane: **7 z 74** zrzutów (Ideas ×3, Inbox, Tasks, Tools→Library, Finance→Statements).
Reszta do przejścia — dokument uzupełniany na bieżąco.
