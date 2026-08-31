---
doc_id: funkcje-marzenie-gamma
status: canonical
owner: piotr
truth_type: plan
established: 2026-08-31
---

# ★ MARZENIE WŁAŚCICIELA: prezentacje jakości Gammy

Piotr, 2026-08-31 ~1:00 („marzenie od dawna"): **prezentacje generowane przez
Consultify mają wyglądać jak z gamma.app** — nowoczesne layouty, typografia,
hierarchia, obrazowość — nie jak slajdy z lat 2000. „To już było przygotowywane
w kodzie. Dorzuć ekstra, zrób później."

## Co już leży w kodzie (punkt startowy rekonesansu)
- `DeckStyler` + `report-pptx-designTokens` (2 z 5 systemów stylowania — rejestr
  wdrożenia, ocena B: żaden nie czyta tokenów produktu),
- szablony PPT z cyklem życia (dyżury 77-83: promocja, eksport, tytuł w pasku),
- **treść realna od dyżuru 186** (brief → slajdy — warunek konieczny: piękna
  forma bez treści to nadal pustka),
- `TemplateBuilder` / `PresentationTemplateArchitectView` (architekt szablonów).

## Droga (po zamknięciu bieżącej rundy 30 — „później" wg słów właściciela)
1. **Rekonesans G-0** (Sonnet): pełna mapa łańcucha deck → PPTX (motywy, layouty,
   fonty, kolory, obrazy) + co dokładnie „było przygotowywane" — zmierzyć, nie zgadywać.
2. **Analiza wzorca Gammy** (co konkretnie czyni Gammę Gammą: siatki, okładki,
   akcenty, autolayout treści, ilustracje/ikony) → lista 10-15 cech mierzalnych.
3. **PROTOTYP** (reguła 7!): 3 slajdy wzorcowe jako PLIK do akceptu Piotra
   PRZED budową silnika (lekcja szablonów-dokumentów: prototyp jako plik).
4. Budowa za flagą OFF: motyw „Gamma-grade" w DeckStyler + tokeny produktu,
   dyżurami po akcepcie prototypu.
5. Rubryka jakości deck-u (jak 15/18 dla dokumentów) + odbiór plikiem.

Zależności: dyżur 186 (treść) scalony/w odbiorze · dyżur 191 (renderer PDF) osobno.
NIE ruszać przed domknięciem rundy 30 — obietnica „później" oznacza porządek, nie zwłokę bez końca.
