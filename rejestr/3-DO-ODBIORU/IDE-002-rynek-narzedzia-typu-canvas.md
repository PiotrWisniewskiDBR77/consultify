---
id: IDE-002
tytul: Rynek: narzędzia typu canvas
typ: analiza
waga: srednia
obszar: IDE
stan: do-odbioru
wlasciciel: piotr
blokuje: [IDE-003]
zablokowane_przez: []
zrodlo: "_RAPORT.md PEŁNY INWENTARZ / _REJESTR_ZYWY.md, 20-21.07"
stare_id: B1
utworzone: 2026-07-21
---

## 1. PROBLEM

Brakowało odpowiedzi, czego NIE budować — gdzie konkurujemy z Miro na przegranej pozycji, a gdzie mamy realną przewagę.

## 2. PRZYCZYNA

Nie dotyczy — analiza rynkowa.

## 3. ROZWIĄZANIE

Przegląd Miro / Mural / FigJam / Whimsical: model tworzenia, rola AI, świadome braki.

## 4. KRYTERIUM ODBIORU

**Dokument.** Zamknięte, gdy zaakceptujesz listę „czego nie budujemy" — bo to ona ma realny wpływ na zakres.

## 5. DOWODY

**Analiza rynkowa z wiedzy własnej — bez dowodu plik:linia, bo dotyczy produktów zewnętrznych.** To ograniczenie jest jawne.

**Model tworzenia:** Miro/Mural/FigJam — jeden uniwersalny canvas, ale ekran startowy to galeria szablonów, „Blank board" jako drugorzędny przycisk. **Whimsical** — jedyny każe wybrać konkretny typ (Flowchart/Wireframe/Mind Map/Sticky/Docs).

**AI:** wszyscy czterej mają „generuj z opisu" + „podsumuj notatki", ale traktują wynik jako **szkic do poprawy**, nie gotowy output ekspercki.

**★ Czego rynek świadomie NIE robi — najważniejsze dla nas:**
1. nikt nie integruje się głęboko ze strukturalnymi danymi biznesowymi projektu (inicjatywy/KPI/finanse) — są domenowo-agnostyczni
2. nikt nie chce być systemem rekordu — eksportują do Jira/Confluence/PPT
3. **nikt nie ma formalnej bramki jakości treści** (u nas: `cardContentFormulaValidator.ts`, patrz ART-016)
4. nikt nie robi modelowania finansowego na canvasie
5. AI generuje tylko szkic strukturalny, nigdy gotowej treści merytorycznej

**Rekomendacje:** (a) iść wzorem galerii szablonów zamiast domyślnej mapy myśli — to adresuje IDE-001 · (b) **nie budować własnego Miro** (kształty/linie/naklejki) — przegrana bitwa zasobów · (c) różnicować się AI generującym gotową treść osadzoną w realnych danych projektu + bramką jakości.

**Lista do wycięcia z zakresu:** real-time multi-cursor na skalę Miro · natywne wideo · biblioteki naklejek/kształtów · eksport-jako-prezentacja jako funkcja canvasu (mamy osobny moduł Deck) · diagramy kodu.

## 6. DZIENNIK

**2026-07-21** — zmigrowane ze źródła B1.
