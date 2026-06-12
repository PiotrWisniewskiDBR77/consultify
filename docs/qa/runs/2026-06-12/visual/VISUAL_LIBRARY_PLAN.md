# Plan: Pełna biblioteka wizualna Consultify

**Autor:** Claude Code (automatyczny)  
**Data planu:** 2026-06-12  
**Cel:** Kompletna, aktualana biblioteka screenshotów + analiza komponentów → wejście do `docs/standards/VISUAL_STANDARD.md`

---

## Status po Fazie 1

Faza 1 dostarczyła **29 screenshotów, 13 modułów** — podejście modułowe.  
Problem: zdjęcia pokazują *co jest na stronie*, ale nie dają odpowiedzi na pytania standardu:  
*Ile wariantów przycisku primary istnieje? Czy badge "High" w Initiatives wygląda tak samo jak w Decisions?*

Do zbudowania standardu potrzeba podejścia **komponentowego**: każdy atom sfotografowany  
we wszystkich wariantach i stanach, niezależnie od modułu, z cross-module porównaniami.

---

## Luki z Fazy 1 (do uzupełnienia w Fazie 1b)

### Brakujące stany modułów

| Co | Dlaczego brakuje |
|----|-----------------|
| Sidebar nawigacja — dedykowane zdjęcia (collapsed / expanded / active per item) | Tylko przy okazji innych modułów |
| Viewport 1280px — Chat, Notebook, Document Studio, Sidebar | Tylko Kanban był testowany |
| Document Studio — flow generowania (outline + treść + ASSUMPTION badges + export bar) | Opcjonalny w Fazie 1, pominięty |
| Toast sukcesu / błędu | Nie udało się wywołać systematycznie |
| Modal / dialog — backdrop + container + X | Nie sfotografowany |
| Loading states poza chat — skeleton vs spinner | Szczątkowe |
| My Work Inbox detail panel | Crash uniemożliwił |

### Brakujące warianty komponentów

| Komponent | Brakuje |
|-----------|---------|
| Przyciski | Hover, focus, disabled, loading — systematycznie dla primary/secondary/ghost/destructive |
| Badges | Wszystkie kolory w jednym miejscu: Open/Approved/Escalated/Failed/Completed/Critical/High/Medium/Low |
| Inputy | Wszystkie stany: default, focus, filled, error, disabled — text + textarea + select + checkbox + radio |
| Karty | Initiative card vs Insight card vs Notebook card vs Decision card — zestawienie |
| Tabele | Header, data row hover, selected row, empty, loading skeleton |
| Typografia | H1–H4, body-lg, body-sm, caption, mono, label — konkretne px i weight w jednym miejscu |
| Avatary | Z inicjałami, z obrazkiem, rozmiary S/M/L |
| Dividers / separators | Horizontal, vertical |
| Progress bar | 0%, 50%, 100% |
| Ikonografia | Zestaw ikon używanych + rozmiary |

---

## Plan Fazy 1b — Component Sweep

### Metoda

Agent chodzi po aplikacji **nie modułami ale typami komponentów**.  
Dla każdego typu: wyszukuje wszystkie wystąpienia w całej aplikacji, robi screenshot w każdym kontekście,  
zapisuje porównanie: *"ten sam komponent wygląda tak w module A i tak w module B"*.

### Sekwencja pracy agenta

```
1. Uzupełnij luki z Fazy 1 (brakujące stany modułów)
2. Sweep komponentów:
   a) Przyciski (wszystkie warianty + stany)
   b) Badges / chips (wszystkie kolory)
   c) Inputy (wszystkie typy i stany)
   d) Karty (wszystkie typy)
   e) Tabele (wszystkie stany)
   f) Nawigacja / tabs (wszystkie stany)
   g) Typografia (hierarchia w kontekście)
   h) Overlay (toasty, modale, dropdowny)
   i) Specjalne (progress bar, avatary, ikony, dividers)
3. Cross-module comparisons (ten sam komponent, dwa różne konteksty)
4. Zapisz wyniki jako VISUAL_AUDIT_PHASE1B.md
```

### Oczekiwana liczba screenshotów

| Kategoria | Szacunek |
|-----------|----------|
| Uzupełnienia Fazy 1 | ~15 |
| Przyciski | ~12 |
| Badges | ~8 |
| Inputy | ~15 |
| Karty | ~10 |
| Tabele | ~8 |
| Nawigacja / tabs | ~8 |
| Typografia | ~6 |
| Overlay | ~10 |
| Specjalne | ~8 |
| Cross-module | ~10 |
| **ŁĄCZNIE** | **~110** |

---

## Plan analizy komponentów

### Wejście

- `VISUAL_AUDIT_PHASE1.md` (29 screenshotów, 13 modułów)
- `VISUAL_AUDIT_PHASE1B.md` (component sweep)

### Wyjście

`COMPONENT_ANALYSIS.md` — dla każdego komponentu:

```markdown
## BTN — Przyciski

### Warianty znalezione w aplikacji
| Wariant | Gdzie | Screenshot | Tło | Tekst | Border-radius | Padding |
|---------|-------|-----------|-----|-------|---------------|---------|
| primary | Chat input, Initiatives | ss_xxx | #E55B4D | white | 8px | 12px 20px |
| primary | Document Studio "Generate" | ss_yyy | #7C3AED | white | 6px | 10px 24px |
...

### Niespójności
- Primary button ma 2 różne kolory tła w różnych modułach (#E55B4D vs #7C3AED)
- ...

### Rekomendacja kanoniczna
(do decyzji właściciela — agent opisuje co widzi, nie decyduje)
```

### Kategorie analizy

1. **BTN** — Przyciski (8 typów)
2. **BADGE** — Statusy, etykiety, pill'e (12 wariantów kolorów)
3. **INPUT** — Pola formularzy (6 typów × 5 stanów)
4. **CARD** — Karty i kafelki (5 typów)
5. **TABLE** — Tabele (stany + kolumny)
6. **NAV** — Sidebar, taby, breadcrumbs
7. **TYPE** — Typografia (hierarchia)
8. **OVERLAY** — Toasty, modale, dropdowny, tooltips
9. **SPECIAL** — Progress, avatar, ikony, dividers
10. **COLOR** — Paleta kolorów wyekstrahowana z całości — spis co i gdzie

---

## Produkt końcowy (rano do przeglądu)

| Plik | Zawartość |
|------|-----------|
| `VISUAL_AUDIT_PHASE1.md` | Gotowy (Faza 1, 29 ss) |
| `VISUAL_AUDIT_PHASE1B.md` | Component sweep (~110 ss) |
| `COMPONENT_ANALYSIS.md` | Analiza spójności, warianty, niespójności |
| — | `VISUAL_STANDARD.md` tworzy właściciel na podstawie powyższych |

---

## Decyzje do podjęcia rano

Po przeglądzie raportów właściciel decyduje dla każdego komponentu:
1. Który wariant jest **kanoniczny** (zostaje, reszta zmieniana)
2. Które niespójności to **błędy** (do naprawienia), a które **zamierzone** (zostają)
3. Czy paleta kolorów jest OK czy wymaga ujednolicenia

Te decyzje → `docs/standards/VISUAL_STANDARD.md` → podstawa egzekucji standardu w code review i audytach.
