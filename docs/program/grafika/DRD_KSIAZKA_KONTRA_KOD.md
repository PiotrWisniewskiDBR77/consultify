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

## ★ SPROSTOWANIE MOJEJ WŁASNEJ REKOMENDACJI

Rekomendowałem `EmbeddedMatrix` jako macierz zgodną z opisem właściciela, pisząc,
że ma „7 poziomów dla Procesów i Danych, 5 dla pozostałych". **To było niepełne
i wprowadzało w błąd.** Książka opisuje **trzy różne skale: 5, 6 i 7 poziomów.**
Kod zna tylko dwie. Decyzja właściciela (7 osi, ta macierz) zostaje w mocy — ale
**dane osi trzeba poprawić przed budową**, inaczej zbudujemy macierz, która kłamie
w dwóch osiach z siedmiu.

## Siedem osi — książka kontra kod

| # | Oś wg książki | Obszarów | Poziomów wg KSIĄŻKI | Poziomów w KODZIE | zgodność |
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
