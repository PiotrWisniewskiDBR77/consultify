---
name: consultify-preview
description: Kanon podglądu (preview pane) Consultify — 6 bloków (nagłówek·meta·treść·AI·relations·akcje-pill) + „Co dalej" poza numeracją, zawsze na końcu, PO akcjach. Wywołaj ZAWSZE gdy tworzysz lub zmieniasz jakikolwiek boczny/podglądowy panel (preview pane) otwierany z tabeli/listy/karty przez single-click — w KAŻDYM module (My Work, Assessment, Interview, Initiatives, Execution, Results, Finance, Materiały, Audits, Meeting, Admin). Także przy audycie/odbiorze takiego panelu, przy pracy nad `PreviewPaneShell`/`PreviewActionBar`/`previewStyles.ts`/`ArtifactActionPanel`, lub gdy dodajesz nową akcję/pill w stopce preview. NIE dla pełnego widoku artefaktu po double-click (użyj consultify-artefakty) ani dla samej tabeli/menu/kebaba wiersza (użyj consultify-triada — preview jest jej częścią, ale ma własny, szczegółowy kanon poniżej).
---

# Consultify — Kanon podglądu (Preview Pane)

## Zasada nadrzędna
Preview to boczny panel otwierany **single-clickiem** z wiersza tabeli/karty — NIE pełny widok
(double-click/Enter otwiera to osobno, patrz `consultify-artefakty`). Standard jest KODEM:
`PreviewPaneShell` (layout) + `PreviewActionBar`/`actionPillClass()` (akcje) +
`ArtifactActionPanel` (create-strip „Co dalej"). **Nie buduj własnej stopki/pilla per moduł —
podepnij te komponenty.**

## Zanim zmienisz cokolwiek
1. Przeczytaj `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md` §7 (Preview pane) —
   zacznij od **§7.0 „Kanon podglądu — skrót"** (6 bloków, tabela z odsyłaczami), potem §7.1–§7.3b
   dla dokładnych wartości/klas.
2. Wzorzec jakości = **Insight preview** (zatwierdzony przez ownera 2026-06-07) — kopiuj
   DOM/kolejność 1:1, nie interpretuj.
3. SSOT implementacji: `src/components/shared/PreviewPane/PreviewPaneShell.tsx`,
   `src/components/shared/PreviewPane/PreviewActionBar.tsx`,
   `src/components/shared/PreviewPane/previewStyles.ts`,
   `src/components/shared/artifact-actions/ArtifactActionPanel.tsx`.

## Sześć bloków TRIADY (góra→dół, kolejność sztywna — MUST) + „Co dalej" poza numeracją

★ **UWAGA (poprawka 2026-09-01, dyżur 175):** wcześniejsza wersja tej sekcji numerowała „Co dalej"
jako blok 4 i „Akcje" jako blok 5 — kolejność ODWROTNA względem normy i kodu, znalezisko zgłoszone
przez właściciela trzeci raz. Obowiązuje kolejność poniżej, zgodna z `TABLE_AND_PREVIEW_CANON.md`
§7.0/§7.3 (poprawionym już 2026-08-02) i z realnym kodem `src/components/standard/StandardPreview.tsx`
(renderuje `whatsNext` bezwarunkowo PO `actionRows`, komentarze „Blok 1…6" w pliku).

1. **Nagłówek** (sticky) — tytuł + pin + „Open" (JEDYNE Open w całym preview) + „×".
2. **Meta** — status/typ/data/sesje, poziom +2 (stan, nie treść).
3. **Treść (Details)** — centrum, scrollowalne, bogaty domyślny szablon (nie jednolinijkowy opis),
   licznik słów, **kebab lokalny** (Rozwiń/Zwiń·Kopiuj·Kopiuj prompt·Export·Pobierz) — OSOBNY
   kontrakt od `RowActionsMenu` wiersza tabeli/karty (`KEBAB_MENU_STANDARD.md`, §9
   TABLE_AND_PREVIEW_CANON.md); nie mylić pozycji, nie duplikować.
4. **AI** — opcjonalna karta stopki: chipy (Podsumuj/Zasugeruj) dopasowane do encji.
5. **Relations** — opcjonalna karta stopki: klikalne pigułki powiązań albo „Brak powiązań".
6. **Akcje = pill** — `h-9 rounded-full` przez `PreviewActionBar`+`actionPillClass()`;
   OPCJONALNE — anty-duplikacja: nie dubluj „Open" (już w nagłówku) ani export/pobierz
   (już w kebab bloku 3). Jeśli po odjęciu duplikatów nic nie zostaje → pomiń cały pasek.

**„Co dalej" / What's-next (create-strip) — POZA numeracją TRIADY, zawsze na końcu, PO bloku 6:**
renderowany TYLKO gdy encja ma zaimplementowaną konwersję na artefakt innego modułu
(np. Insight → Raport/Deck/Tabela/Idea/Notatka/Inicjatywa); ikona+hue = moduł docelowy (§7.3a).

**Pełna kolejność stopki (blok 3 → 6 + poza numeracją): Details → AI → Relations → Akcje → Co dalej.**
Blok bez danych = **ukryty**, nie pusty box; kolejność OBECNYCH bloków się nie zmienia.

## Twarde zakazy
- **Pułapka #36 (rozstrzygnięta, Piotr 07-12 — D21): akcje w preview = PILL (`rounded-full`), NIE
  `rounded-lg`.** Zero bespoke `bg-*`/`rounded-lg`/inline classes na przyciskach stopki — zawsze
  przez `actionPillClass(scheme)` z `previewStyles.ts`. To był realny regres raz — nie powtarzaj.
- Zero duplikacji „Open" poza nagłówkiem; zero duplikacji export/download poza kebabem bloku 3.
- `primary-*`/crimson na przyciskach danych/akcji = ZAKAZ (patrz `pillColorScheme('primary')` —
  primary = neutralny wysoki kontrast, NIE crimson). Fokus zawsze `c-focus` (niebieski).
- Szerokość preview `clamp(340px, 28%, 480px)`, separacja `gap-1.5` **bez** `border-l`.
- Cross-module źródło→cel (np. inicjatywa z Wywiadu): single-click **nigdy** nie wyrzuca od razu
  do modułu docelowego — draft zostaje w preview źródłowym do czasu promocji (§7.1).

## Odbiór — checklist (przejdź literalnie po każdej zmianie)
- [ ] Kolejność 6 bloków zachowana (Nagłówek·Meta·Details·AI·Relations·Akcje), „Co dalej" — jeśli
      obecne — renderuje się PO akcjach, nigdy przed nimi; brak bloku bez danych renderowanego jako
      pusty box.
- [ ] Nagłówek: dokładnie jedno „Open"; „×" zawsze ostatnie po prawej.
- [ ] Details: licznik słów widoczny gdy treść > 0, kebab lokalny ma wszystkie 5 pozycji (lub ukryte gdy N/A).
- [ ] „Co dalej" renderuje się TYLKO dla encji cross-module źródło→cel; ikony/hue zgodne z §7.3a.
- [ ] Akcje stopki: zero inline `bg-*`/`rounded-lg`; wszystko przez `actionPillClass()`.
- [ ] Zero duplikacji Open/export między nagłówkiem, kebabem Details i pasekiem akcji.
- [ ] Light + dark, focus ring niebieski (`c-focus`), zero crimson na danych/akcjach.
- [ ] Weryfikacja WZROKIEM (zrzut z przeglądarki: preview otwarty + rozwinięty kebab Details +
      hover na pillu akcji), nie „testy przeszły".
