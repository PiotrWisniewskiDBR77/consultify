---
doc_id: drd-ksiazka-kontra-kod
status: canonical
truth_type: source-comparison
established: 2026-08-30
zrodlo_nadrzedne: knowledge/DRD/ (książka „Digital Pathfinder", Piotr Wiśniewski, PhD)
---

# DRD — książka właściciela kontra kod

## Skąd ten dokument

Właściciel wskazał źródło: *„znajdziesz w repozytorium, gdzieś w dokumentach moją
książkę, która dokładnie tę metodologię opisuje"*. Znaleziona: **`knowledge/DRD/`**
(nie w `docs/`) — osiem PDF-ów wyciętych z książki **„Digital Pathfinder"** plus
scalona ekstrakcja `knowledge/DRD/extracted_content.txt` (2800 linii, najwygodniejsza
do czytania). Tekst autorski, pisany w pierwszej osobie, żywa pagina „Piotr Wisniewski, PhD".

**Ten dokument jest nadrzędny wobec kodu.** Gdzie kod się z nim rozjeżdża — poprawiamy kod.

Uwaga na `docs/product/DRD_CANON.md`: nagłówek mówi wprost `Autor: Claude (CTO)`.
To dokument techniczny, **nie źródło**. Nie mylić.

## ★ DWA SPROSTOWANIA MOICH WŁASNYCH SŁÓW

### Sprostowanie drugie (późniejsze, ważniejsze) — „kod ma źle" było nieprecyzyjne

Napisałem niżej, że kod przypisuje osiom 5 i 6 po pięć poziomów. **To nieprawda
o kodzie jako całości.** Pomiar czterech niezależnych źródeł plus obu plików struktury
pokazał, że:

| | oś 5 | oś 6 | oś 7 |
| --- | --- | --- | --- |
| wszystkie dokumenty właściciela | 6 | 6 | 5 |
| `src/services/drdStructure.ts` (źródło prawdy) | 6 ✔ | 6 ✔ | 5 ✔ |
| `server/src/data/drdStructure.ts` | 6 ✔ | 6 ✔ | 5 ✔ |
| **`src/components/Reports/EmbeddedMatrix.tsx:15-16`** | **5 ✘** | **5 ✘** | 5 ✔ |

**Kod ma rację w źródle prawdy i kłamie w jednym pliku** — tym, który rysuje macierz.
`EmbeddedMatrix` trzyma **własną, odklejoną kopię** konfiguracji osi zamiast czytać
strukturę. Sprawdzone realną długością tablic `levels` per obszar, nie polem `levelCount`.

Różnica jest praktyczna: naprawą nie jest podmiana piątki na szóstkę, tylko
**usunięcie drugiej kopii prawdy**. Podmiana liczby zostawiłaby przyczynę, a w tym
repo defekt załatany per-wywołanie odrósł po ośmiu tygodniach w dwunastu plikach.

### Sprostowanie pierwsze — trzy skale, nie dwie

Rekomendowałem `EmbeddedMatrix` jako macierz zgodną z opisem właściciela, pisząc,
że ma „7 poziomów dla Procesów i Danych, 5 dla pozostałych". **To było niepełne
i wprowadzało w błąd.** Książka opisuje **trzy różne skale: 5, 6 i 7 poziomów.**
Kod zna tylko dwie. Decyzja właściciela (7 osi, ta macierz) zostaje w mocy — ale
**dane osi trzeba poprawić przed budową**, inaczej zbudujemy macierz, która kłamie
w dwóch osiach z siedmiu.

## Siedem osi — książka kontra kod

| # | Oś wg książki | Obszarów | Poziomów wg KSIĄŻKI | Poziomów w `EmbeddedMatrix` | zgodność |
| --- | --- | --- | --- | --- | --- |
| 1 | Digital processes | 9 (1A–1I) | **7** | 7 | ✔ |
| 2 | Digital products | 5 (2A–2E) | **5** | 5 | ✔ |
| 3 | Digital business models | 5 (3A–3E) | **5** | 5 | ✔ |
| 4 | Data management: Big Data everywhere | 5 (4A–4E) | **7** | 7 | ✔ |
| 5 | Competence levels and digital culture | 5 (5A–5E) | **6** | **5** | ✖ **BŁĄD** |
| 6 | Cybersecurity | 5 (6A–6E) | **6** | **5** | ✖ **BŁĄD** |
| 7 | AI Readiness & Integration | 5 (7A–7E) | **5** | 5 | ✔ |

Kod: `src/components/Reports/EmbeddedMatrix.tsx:6-17`.

**Dwie osie mają w kodzie o jeden poziom za mało.** Skutkiem jest nie tylko krótszy
rząd w macierzy — najwyższy poziom dojrzałości kultury i cyberbezpieczeństwa jest
w produkcie **nieosiągalny**, a luka do celu liczona wobec złego maksimum.

## Druga rozbieżność: sześć osi czy siedem

Książka mówi dosłownie o **sześciu** osiach: *„it is divided into six major areas,
which I have called »the six axes of digital transformation«"*. **Oś 7 (AI) to
późniejszy dodatek** właściciela — dopisana w stylu pozostałych, nie występuje
w książkowym PDF-ie.

To rozstrzyga rzekomy „rozjazd", który `DRD_CANON.md` zgłasza jako defekt:
- książka: **34 oceny cząstkowe** (9+5+5+5+5+5 przy sześciu osiach)
- kod: **39** (po dodaniu 5 obszarów Osi 7)

**To nie jest błąd kodu — to skutek świadomego dodania siódmej osi.** Materiały
marketingowe obiecujące „8 wymiarów" są natomiast niezgodne z jednym i drugim.

## Trzecia rozbieżność: nazwy osi

Kod nazywa oś 5 „Kultura Transformacji" / „Culture of Transformation". Książka:
**„Competence levels and digital culture"** — kompetencje są w nazwie, bo obszary
5A–5E to postawy przywódcze, gotowość na zmianę, rozwój zawodowy, kultura innowacji
i dostępność zasobów. Nazwa w kodzie gubi połowę zakresu.

Osobliwość udokumentowana przez autora: skala obszaru **5A została przemianowana
z „Level 1–6" na „Type 1–6"**, ponieważ *„no single leadership style is superior"*.
To nie jest skala rosnąca i **macierz nie może malować jej gradientem dojrzałości
jak pozostałych**. Kod dziś o tym nie wie.

## Co książka mówi o samej macierzy i o „następnych krokach"

Rozdział 47 opisuje dokładnie mechanizm, o który upomniał się właściciel:
1. ocena wszystkich obszarów wszystkich osi → *„This matrix of scores constitutes
   your assessment of your company's level of maturity"*;
2. inicjatywy powstają **automatycznie z macierzy** — jeśli obszar oceniono na poziom 3,
   następnymi krokami rozwoju są z definicji poziomy 4 i 5; daje to *„od czterdziestu
   do nawet pięćdziesięciu inicjatyw transformacyjnych"*;
3. inicjatywy łączy się w sekwencje na osi czasu.

Filozofia oceny wywiedziona z normy **VDA 6.3**.

To potwierdza uwagę właściciela, że macierz „**wchodzi do raportu i wizualizuje
poziomy oraz następne kroki**" — i że jest **narzędziem**, a nie ilustracją.

## Kolejność prac, która z tego wynika

1. **Poprawić skale osi 5 i 6 na 6 poziomów** (`EmbeddedMatrix.tsx:6-17`) —
   bez tego macierz kłamie. Zanim cokolwiek graficznego.
2. Sprawdzić, czy backend oceny (`assessmentDrdReportSchemaService.ts`) i baza
   znają te same maksima. Jeśli nie — poprawka w kodzie ekranu niczego nie naprawi.
3. Poprawić nazwę osi 5 na oddającą kompetencje.
4. Wyłączyć gradient dojrzałości dla obszaru 5A (typy, nie poziomy).
5. Dopiero teraz: wejście do macierzy (flaga `isDrdReportEnabled` domyślnie wyłączona)
   i przywrócenie macierzy w widoku po zamrożeniu sesji.

**Punkty 1–4 to wierność metodyce właściciela, nie kosmetyka.** Punkt 5 to grafika.

## Źródła

- `knowledge/DRD/extracted_content.txt` — scalona książka, separatory `--- START OF FILE ---`
  w liniach 3, 453, 973, 1261, 1547, 1983, 2421, 2759; appendix od linii 455; macierz i inicjatywy w liniach 295–410.
- `knowledge/DRD/*.pdf` — osiem rozdziałów źródłowych.
- `uploads/org-dbr77-system/global/knowledge/1765522993870-digital_patfinder_*.pdf` —
  szerszy kontekst książkowy (rozdziały 44–48), ale **wersja starsza**: sześć osi,
  urwana w połowie obszaru 6B, bez Osi 7. Do kontekstu, nie do liczb.
- `knowledge/tool-kb/drd/methodology/v1/` — przepakowanie książki pod wyszukiwanie,
  deklaruje `verbatim: true`. Wtórne wobec `knowledge/DRD/`.

---

# ŹRÓDŁO NOWSZE NIŻ KSIĄŻKA — znalezione 2026-08-30 wieczorem

Właściciel sprostował moje ustalenie: *„w książce dołożyłem Cyber Security, a teraz
dołożyliśmy jeszcze siódmą AI, także rzeczywiście książka nie jest ostatnią wersją.
Ale gdzieś Ci dokładałem dokumentacji (…) z Cyber Security i z AI."*

**Znalezione. Łańcuch źródeł, od najstarszego:**

| źródło | dodane | co zawiera |
| --- | --- | --- |
| `uploads/…/digital_patfinder_…soft_paperback_.pdf` | 2025-12-12 | **książka drukowana** — osie 1–6, **osi 7 brak** |
| `wdrozenia/modules/assessment/11-DRD-METHOD.md` | 2026-01-29 | instrukcja operacyjna; **jedyny pełny opis obszaru 7E** w repo |
| `knowledge/DRD/*.pdf` + `extracted_content.txt` | 2026-02-26 | **to jest ta „dołożona dokumentacja"** — osiem rozdziałów, w tym oś 6 i dopisana oś 7 |
| `knowledge/tool-kb/drd/methodology/v1/` + `qbank/v2/` | 2026-07-10 | przepakowanie pod wyszukiwanie, `verbatim: true`; **niezależne potwierdzenie liczb** |

Po 2026-07-10 właściciel nie dołożył do repozytorium żadnego pliku wiedzy DRD.

## Rozstrzygnięcie liczby poziomów — zero rozbieżności w źródłach

**Oś 6 (Cyberbezpieczeństwo): SZEŚĆ poziomów.** Policzone, nie odczytane z nagłówka —
`Level 1.`…`Level 6.` występuje w każdym z pięciu obszarów 6A–6E
(`knowledge/DRD/extracted_content.txt:2496, 2546, 2590, 2633, 2675`), potwierdzone
niezależnie w `qbank/v2/drd-qbank-axis5-7.en.md:498, 578, 658, 738, 818`
oraz w `11-DRD-METHOD.md:497`. Także książka drukowana mówi 6.

**Oś 7 (Dojrzałość AI): PIĘĆ poziomów.** Autor stwierdza to wprost:
*„The maturity scale, similarly to other axes, ranges from Level 1 (initial) to
Level 5 (advanced)"* (`extracted_content.txt:2762`). **Kod jest tu poprawny — nie ruszać.**

**Skala rosnąca w obu osiach.** Zastrzeżenie „Type zamiast Level" występuje wyłącznie
w obszarze 5A (postawy przywódcze) i nigdzie indziej — przeszukane całe rozdziały 6 i 7.

## Obszary osi 6 i 7 — nazwy z dokumentacji właściciela

| | oś 6 · Cyberbezpieczeństwo (6 poziomów) | oś 7 · Dojrzałość AI (5 poziomów) |
| --- | --- | --- |
| A | Strategia i zarządzanie ryzykiem | Dane i fundamenty AI |
| B | Ochrona sieci i systemów | Procesy wspierane przez AI |
| C | Ochrona danych | AI w produktach i usługach |
| D | Edukacja i szkolenia | Nadzór, bezpieczeństwo i etyka AI |
| E | Plany awaryjne | Kompetencje i kultura AI |

## ★ DZIURA W ŹRÓDLE — obszar 7E nie ma opisu

`knowledge/DRD/7. Os AI opis.pdf` opisuje **tylko 7A, 7B, 7C, 7D**. Obszar **7E
(Kompetencje i kultura AI) jest zapowiedziany w wstępie, ale nigdy nie opisany** —
dokument urywa się na poziomie 5 obszaru 7D. Zweryfikowane dwiema drogami
(ekstrakcja tekstu z PDF-u oraz przepakowanie w `tool-kb`, które kończy się na nadzorze).

**Opisy poziomów 7E żyjące dziś w kodzie i w banku pytań nie pochodzą od właściciela** —
pochodzą z `wdrozenia/modules/assessment/11-DRD-METHOD.md:596-602`, dokumentu operacyjnego.
**To jest pytanie do właściciela: czy te opisy zatwierdza, czy chce napisać 7E sam.**
Do czasu rozstrzygnięcia obszar 7E stoi na treści nieautorskiej.

## Druga rozbieżność: nazwy obszarów rozjeżdżają się między książką a kodem

Najostrzej **6E**: dokumentacja właściciela mówi „Plany awaryjne / Emergency planning",
kod „Contingency Plans", a `DRD_CANON.md:69` postuluje jeszcze trzecią wersję
(„Reagowanie na incydenty"). Podobnie **6D**: „Edukacja i szkolenia" kontra
„Security Education and System Quality" w kodzie. Oś 7 ma w PDF-ie inne nazwy obszarów
(„Data Exposure & AI Foundations") niż w kodzie („Data and AI Foundations").

**To nie jest kosmetyka** — konsultant czytający raport widzi nazwę obszaru i po niej
rozpoznaje metodykę. Trzy różne nazwy tego samego obszaru w jednym produkcie to trzy
różne obietnice wobec klienta.
