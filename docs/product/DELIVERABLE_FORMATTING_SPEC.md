# Specyfikacja formatowania deliverables (Word / PowerPoint / Excel) · 2026-06-24

> Cel: materiały formatowane **tak dobrze jak natywny Word/Office** — predefiniowane narzędzia (nagłówki H1-H3, treść, tabele, punktowania, wyliczniki, czcionki). Kuratorowana biblioteka, nie chaos 100 nieczytelnych fontów. Trzy osie (z rozmów): **struktura = template · kolory = motyw · TERAZ: typografia+formatowanie = ta specyfikacja.** Rozszerza [`DELIVERABLE_STANDARDS_AND_TOOLING.md`](../qa/deliverables/DELIVERABLE_STANDARDS_AND_TOOLING.md).

## 1. Biblioteka czcionek — 10 kuratorowanych (nie 100)
Zasada: tylko fonty **czytelne, profesjonalne i dostępne wszędzie** (Office-natywne LUB Google Fonts = działają w .docx, .pptx i web-viewerze). Po 5 sans + 5 serif.

**Sans-serif** (nagłówki, treść ekranowa, decki):
1. **Inter** — nowoczesny, czysty, ekran+druk; domyślny „modern".
2. **Calibri** — natywny Office, znajomy, bezpieczny.
3. **Lato** — przyjazny profesjonalny.
4. **Arial / Helvetica** — uniwersalny, neutralny (fallback).
5. **Source Sans 3** — Adobe, klarowny.

**Serif** (treść raportów, powaga, druk):
6. **Georgia** — serif czytelny na ekranie, profesjonalny.
7. **Merriweather** — nowoczesny czytelny serif (web).
8. **EB Garamond** — elegancki, edytorski.
9. **Source Serif** — neutralny serif do długich raportów.
10. **Times New Roman** — klasyczny raport/legal (fallback).

*(Opcjonalny 11. mono: Roboto Mono — tylko do kodu/danych.)*

## 2. Pary (gotowe motywy typograficzne) — 5
Profesjonaliści dobierają **parę nagłówek+treść**, nie pojedyncze fonty. Te 5 to gotowe motywy:
| Motyw | Nagłówki | Treść | Charakter |
|---|---|---|---|
| **Modern** | Inter | Inter | tech, czysty, domyślny |
| **Executive** | Merriweather (serif) | Inter (sans) | serif-head + sans-body, styl McKinsey |
| **Corporate** | Calibri | Calibri | natywny Office, znajomy |
| **Classic** | EB Garamond | Georgia | tradycyjny raport |
| **Clean** | Lato | Source Sans 3 | lekki, przyjazny |

## 3. Skala typograficzna + hierarchia (per format — bo druk ≠ ekran ≠ projekcja)

### Word (A4, marginesy 2.5 cm)
| Element | Rozmiar | Waga | Odstęp |
|---|---|---|---|
| H1 (tytuł sekcji) | 22-24 pt | 600 | po: 12 pt |
| H2 (podsekcja) | 16-18 pt | 500 | przed 12 / po 6 |
| H3 (pod-pod) | 13-14 pt | 600 | przed 10 / po 4 |
| Treść główna | 11 pt | 400 | interlinia 1.4-1.5, po 6-8 pt |
| Caption/źródło | 9 pt | 400 | kolor secondary |
| Cover title | 28-32 pt | 600 | — |

### PowerPoint (16:9, 1920×1080)
| Element | Rozmiar | Waga |
|---|---|---|
| Tytuł slajdu | 28-32 pt | 500 |
| Section divider | 40-44 pt | 500 |
| Treść/bullety | 18-22 pt (min 18 do projekcji) | 400 |
| Caption/źródło | 11-12 pt | 400 |
Reguły: ≤6 bulletów, ≤6-8 słów/bullet, ≥8 distinct layoutów, kontrast ≥4.5:1.

### Excel
| Element | Reguła |
|---|---|
| Header row | 11 pt bold, tło tint motywu 12%, dolny border, zamrożony |
| Treść | 10-11 pt, sans |
| Liczby | prawy align, wyrównane dziesiętne |
| Tekst/daty | lewy align |

## 4. Punktowania i wyliczniki (predefiniowane)
- **Bullety:** L1 `•` · L2 `–` · L3 `·`; wcięcie 0.25"/poziom; odstęp 4 pt; max 3 poziomy zagnieżdżenia.
- **Wyliczniki:** L1 `1.` · L2 `a.` · L3 `i.`; ten sam rytm wcięć.
- **Checklist:** `☐` / `☑` (status/to-do).
- **Callouts/admonitions:** info / warning / danger / success — lewy pasek koloru + ikona + tło 8% tint.

## 5. Tabele (we wszystkich 3)
- **Header:** bold, tło tint motywu, dolny border 1px; powtarzany na kolejnych stronach (Word).
- **Zebra:** subtelne naprzemienne tło (tint 4-6%) — tylko gdy gęsto/szeroko.
- **Bordery:** minimalne — poziome linie zamiast pełnej siatki (Tufte/Few); pełna lekka siatka tylko gdy dane gęste.
- **Wyrównanie:** liczby/waluta/% = prawo + wyrównane dziesiętne; tekst/daty = lewo; nagłówki = jak kolumna.
- **Formaty liczb (Excel):** waluta `#,##0.00`, procent `0.0%`, data `yyyy-mm-dd`, negatywy `[Red]`.
- **Conditional formatting (Excel):** data-bars / color-scales / icon-sets / progi.

## 6. Spięcie z osiami z rozmów
- **Template (struktura)** decyduje: ile sekcji/slajdów, co na nich, hierarchia → §3 wypełnia hierarchię.
- **Motyw (kolory + para fontów)** nakłada się na strukturę → §1-2 to warstwa typografii motywu; kolory osobno (Gamma-style).
- **Brand klienta (ingestion z .pptx/.docx)** może NADPISAĆ motyw (jego fonty/kolory) — §1 to nasze defaulty, nie przymus.

## 7. Implementacja (gdy dojdziemy do budowy)
- **Word:** docx — Styles (Heading 1-3 + Normal + Caption) z §3; numbering definitions z §4; table styles z §5. Fonty embedowane.
- **PowerPoint:** pptxgenjs — slide master + placeholdery z §3 (PPT); fonty z motywu.
- **Excel:** exceljs — cell styles + numFmt + CF z §5.
- **Web-viewer:** CSS z §3 + Google Fonts z §1 (spójność z plikami).
- **SSOT motywów:** jeden rejestr `theme = { fontPair, scale, palette, listStyles, tableStyle }` konsumowany przez wszystkie 4 renderery → identyczne formatowanie na każdej powierzchni.
