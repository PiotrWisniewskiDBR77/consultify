---
name: consultify-triada
description: Kanon UI list/tabel Consultify. Wywołaj ZAWSZE gdy tworzysz lub zmieniasz jakikolwiek ekran listowy: menu modułu (Menu 1/2/3), tabelę, pstryczek kolumn, kebab wiersza, preview, przyciski akcji, widok kanban — w KAŻDYM module (My Work, Assessment, Interview, Initiatives, Execution, Results, Finance, Materiały, Audits, Meeting, Admin). Także przy audycie/odbiorze takiego ekranu.
---

# Consultify — Triada (Menu · Tabela · Preview · Kanban)

## Zasada nadrzędna (dlaczego to działa, a prompty nie)
Standard jest KODEM, nie prozą. Wygląd narzucają komponenty `src/components/standard/`
(StandardModuleBar · StandardTable · StandardPreview · StandardKanban). Moduł DEKLARUJE
treść, komponent NARZUCA wygląd. **Nie buduj własnej tabeli/menu/preview per ekran —
podepnij komponent standardu.** Poza nim nie da się wyjść zgodnie z kanonem.

## Zanim zmienisz cokolwiek
1. Przeczytaj `docs/ui-standards/TRIADA_KANON.md` — część A (opis 10 sekcji) + część C (twarde wartości: kolory/rozmiary/ramki/odstępy) + część D (fotki referencyjne z żywego My Work).
2. Wzorzec jakości = ŻYWY ekran My Work (Tasks/Decisions/Inbox). Kopiuj DOM/klasy 1:1, nie interpretuj.
3. Warstwa techniczna (mechanika resize/filtrów/settings): `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md` §27.
4. Surowe słowa właściciela: `Harvard/wdrozenie-100/_STANDARD_TRIADA_NOTATKA.md`.

## Twarde zakazy (primary=crimson #85182F!)
- `bg-primary-[4567]00` / crimson jako CTA, filtr, stan aktywny, focus → ZAKAZ. Aktywne stany UI = neutralne.
- `focus:ring-primary` → focus zawsze niebieski (`c-focus`); edytory tekstu bez obwódki fokusa.
- Gruby/biały pas między wierszami → tylko hairline. Zebra → zakaz.
- Pełne czerwone pigułki priorytetów → tylko kropka + tonowany tekst.
- Kolumny-pudełka w kanbanie, chowanie pustych kolumn → zakaz.

## Odbiór — OBOWIĄZKOWY audyt 40 punktów
Po każdej zmianie przejdź literalnie listę czekowania z `TRIADA_KANON.md` **część B**
(Menu 7 · Tabela 8 · Pstryczek 3 · Kebab 5 · Preview 7 · Przyciski 2 · Kanban 5 · Kolor/Fokus 3).
Klikaj realnie: pstryczek, kebab, preview, bulk (zaznaczenie wierszy), sort/resize/filtr, dark I light,
oraz układ menu i widok kanban. Ekran przechodzi wyłącznie przy komplecie ✓ (albo „n/d" z powodem).
Weryfikacja WZROKIEM (zrzuty z przeglądarki, nie „testy przeszły") — obok wzoru My Work.
Zrzuty: lista + otwarty pstryczek + otwarty kebab + preview + (jeśli jest) kanban.
NIE deployować bez akceptacji właściciela na zrzutach.
