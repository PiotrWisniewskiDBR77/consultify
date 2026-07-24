# BASELINE geometrii 6 kart n-Type — stan PRZED migracją powłoki (2026-07-24)

> **Po co ten plik.** Migracja 6 kart na wspólną powłokę dotyka wszystkich naraz.
> Bez odcisku palca stanu „przed" nikt nie udowodni, czy coś się rozjechało.
> To jest punkt odniesienia: po migracji ten sam skrypt musi dać wynik **NIE GORSZY**.
>
> **Mierzony stan:** `origin/demo` = `12826509a2` (partia n-Type 2026-07-24, wydana do testów).
> **Aparat:** `scripts/karty-n-geometria.mjs` (gałąź `chore/aparat-pomiarowy-kart`).
> **Warunki:** dev-render `:3201`, motyw **light**, `lang=pl`, viewporty **1280** i **1440**.
> **Artefakty:** `_BASELINE_GEOMETRIA_KART_2026-07-24/karty-n-geometria.json` (surowe dane,
> wejście dla `--porownaj`), `…/karty-n-geometria.md` (raport auto), `…/zrzuty/` (12 PNG).

## Jak powtórzyć pomiar (po migracji)

```bash
# 1. dev-render na własnym porcie (NIE 3000/319x — inne sesje)
npx vite --config dev-render/vite.config.ts --port 3201 --strictPort

# 2. NAJPIERW kontrolki pozytywne — czy aparat w ogóle jeszcze widzi defekty
node scripts/karty-n-geometria.mjs --self-test         # musi być 12/12

# 3. pomiar po migracji + automatyczne porównanie z baseline
node scripts/karty-n-geometria.mjs --zrzuty \
  --wyjscie=Harvard/wdrozenie-100/_PO_MIGRACJI_GEOMETRIA_KART \
  --porownaj=Harvard/wdrozenie-100/_BASELINE_GEOMETRIA_KART_2026-07-24/karty-n-geometria.json
```

`--porownaj` kończy się kodem wyjścia 1, gdy znajdzie regresję. Lista sprawdzanych regresji
= DoD z runbooka (§ „DoD migracji powłoki").

## Co dokładnie jest mierzone

Pięć **realnych pasów** (`getBoundingClientRect` elementu, który faktycznie ma tło/ramkę),
NIE kontenerów `max-w-*`:

| Pas | Jak rozwiązywany | Zapas (inne `zrodlo` w JSON) |
|---|---|---|
| Menu 1 (pas nagłówka) | `[data-testid="nmode-header"]` → root `NModeHeader` po klasach `backdrop-blur`+`rounded-2xl` nad Menu 2 | pas najgrubszego tytułu |
| Menu 2 | `[data-testid="nmode-menu2"]` | element ze strefami `data-menu2-zone` |
| Pas sekcji | rodzic lewej nawigacji (realny wiersz treści: nav + kanwa) | kontener sekcji kanwy |
| Prawy panel | `aside` szerszy niż 200 px | — |
| Lewa nawigacja | `nav` 80–400 px z przyciskami sekcji | — |

Każdy pas dostaje flagę `podejrzanyKontener`, jeśli rozwiązał się do elementu z klasą `max-w-*`
— to **wbudowany strażnik przeciwko powtórce błędu z 24.07**, kiedy zmierzono limity szerokości
zamiast pasów i wyszła fałszywa zgodność.

Dodatkowo per przebieg: błędy konsoli (po odfiltrowaniu szumu harnessu), error-boundary,
crimson `rgb(133,24,47)`/`rgb(200,50,74)`, surowe enumy w tekście **wraz z `.value` pól
formularza**, liczba i nazwy sekcji prawego panelu w kolejności.

## TABELA BASELINE — 6 kart × 2 viewporty (light)

`l` = lewa krawędź w px, `w` = szerokość w px.

| Karta | VP | Menu 1 | Menu 2 | Pas sekcji | Lewa naw. | Prawy panel | Wyrównanie L | Sekcji panelu | Konsola | Crimson | Enumy |
|---|---:|---|---|---|---|---|---|---:|---:|---:|---:|
| Decyzja | 1280 | l=64 w=768 | l=64 w=768 | l=64 w=768 | l=64 w=242 | l=856 w=360 | ✔ 64 | 6 | 0 | 0 | 0 |
| Decyzja | 1440 | l=144 w=768 | l=144 w=768 | l=144 w=768 | l=144 w=242 | l=936 w=360 | ✔ 144 | 6 | 0 | 0 | 0 |
| Zadanie | 1280 | l=64 w=768 | l=64 w=768 | l=64 w=768 | l=64 w=242 | l=856 w=360 | ✔ 64 | 6 | 0 | 0 | 0 |
| Zadanie | 1440 | l=144 w=768 | l=144 w=768 | l=144 w=768 | l=144 w=242 | l=936 w=360 | ✔ 144 | 6 | 0 | 0 | 0 |
| Powiadomienie | 1280 | l=64 w=768 | l=64 w=768 | l=64 w=768 | l=64 w=242 | l=856 w=360 | ✔ 64 | 6 | 0 | 0 | 0 |
| Powiadomienie | 1440 | l=144 w=768 | l=144 w=768 | l=144 w=768 | l=144 w=242 | l=936 w=360 | ✔ 144 | 6 | 0 | 0 | 0 |
| Insight | 1280 | l=24 w=840 | l=24 w=840 | l=24 w=840 | l=24 w=242 | l=904 w=360 | ✔ 24 | 7 | 0 | 0 | 0 |
| Insight | 1440 | l=24 w=1000 | l=24 w=1000 | l=24 w=1000 | l=24 w=242 | l=1064 w=360 | ✔ 24 | 7 | 0 | 0 | 0 |
| Narzędzie | 1280 | l=24 w=840 | l=24 w=840 | l=24 w=840 | l=24 w=242 | l=904 w=360 | ✔ 24 | 4 | 0 | 0 | 0 |
| Narzędzie | 1440 | l=24 w=1000 | l=24 w=1000 | l=24 w=1000 | l=24 w=242 | l=1064 w=360 | ✔ 24 | 4 | 0 | 0 | 0 |
| Inicjatywa | 1280 | l=64 w=768 | l=64 w=768 | l=64 w=768 | l=64 w=242 | l=856 w=360 | ✔ 64 | 7 | 0 | 0 | 0 |
| Inicjatywa | 1440 | l=144 w=768 | l=144 w=768 | l=144 w=768 | l=144 w=242 | l=936 w=360 | ✔ 144 | 7 | 0 | 0 | 0 |

**Czyste w baseline:** 0 błędów konsoli, 0 error-boundary, 0 crimson, 0 surowych enumów,
komplet 5 pasów zmierzony na każdej karcie, żaden pas nie rozwiązał się do `max-w-*`.
Wewnątrz KAŻDEJ karty `Menu1.left == Menu2.left == Sekcje.left` — naprawa z 24.07 potwierdzona.

## Sekcje prawego panelu (kolejność, @1440)

| Karta | `aria-label` | Sekcje |
|---|---|---|
| Decyzja | Szczegóły decyzji | AKCJE · WŁAŚCIWOŚCI · POWIĄZANIA · ŹRÓDŁA I ZAŁOŻENIA · KOMENTARZE · HISTORIA |
| Zadanie | Szczegóły zadania | AKCJE · WŁAŚCIWOŚCI · POWIĄZANIA · ŹRÓDŁA I ZAŁOŻENIA · KOMENTARZE · HISTORIA |
| Powiadomienie | Panel szczegółów powiadomienia | AKCJE · WŁAŚCIWOŚCI · POWIĄZANIA · ŹRÓDŁA I ZAŁOŻENIA · REZULTATY · HISTORIA |
| Insight | Szczegóły wniosku | AKCJE · WŁAŚCIWOŚCI · POWIĄZANIA · ŹRÓDŁA I ZAŁOŻENIA · REZULTATY · KOMENTARZE · HISTORIA |
| Narzędzie | Szczegóły narzędzia | WŁAŚCIWOŚCI · POWIĄZANIA · ŹRÓDŁA I ZAŁOŻENIA · REZULTATY |
| Inicjatywa | Szczegóły inicjatywy | AKCJE · WŁAŚCIWOŚCI · POWIĄZANIA · ŹRÓDŁA I ZAŁOŻENIA · REZULTATY · KOMENTARZE · HISTORIA |

## ★ CO JUŻ DZIŚ WYGLĄDA PODEJRZANIE (informacja dla migratora)

1. **Dwie rodziny szerokości — to jest właśnie dług, który migracja ma zdjąć.**
   Decyzja/Zadanie/Powiadomienie/Inicjatywa: kolumna **stała 768 px**, wyśrodkowana
   (l=64 @1280, l=144 @1440) — przy 1440 po bokach zostaje ~2×144 px pustki.
   Insight/Narzędzie: kolumna **płynna** (840 @1280, 1000 @1440) przy stałym marginesie 24 px.
   Na zrzutach to wyglądają jak dwa różne produkty. Wewnętrzna zgodność pasów jest w obu
   rodzinach ✔, więc kryterium „Menu1==Menu2==Sekcje" **nie wykryje**, gdyby migracja zostawiła
   ten podział — dlatego DoD ma osobny punkt o jednej szerokości między kartami.

2. **Prawy panel: 360 px w każdej karcie, ale kotwica pionowa różna.** Panel startuje od `top=16`
   i ma własny scroll; przy Narzędziu (4 sekcje) zostaje duży pusty dół. Po migracji sprawdzić,
   czy panel nie zaczyna scrollować razem z centrum.

3. **Narzędzie ma tylko 4 sekcje panelu — brak AKCJE, KOMENTARZE, HISTORIA.**
   Jedyna karta bez AKCJI. Jeżeli wspólna powłoka wymusi komplet sekcji, liczba wzrośnie —
   to jest poprawa, nie regresja (DoD zabrania wyłącznie *ubytku*).

4. **Niespójny słownik sekcji: KOMENTARZE vs REZULTATY.** Powiadomienie ma REZULTATY zamiast
   KOMENTARZY, Decyzja/Zadanie odwrotnie, Insight/Inicjatywa mają oba. Nie da się z tego zrobić
   jednej listy bez decyzji produktowej — migrator nie powinien „przy okazji" dorzucać/usuwać
   sekcji, bo baseline to złapie jako ubytek.

5. **`aria-label` panelu jest per karta** („Szczegóły decyzji", „Panel szczegółów powiadomienia").
   Uwaga przy przenoszeniu na wspólny komponent — łatwo zgubić i zostawić angielskie
   `Artifact details` z domyślnej wartości `ArtifactRightPanel`.

6. **Lewa nawigacja jest `hidden lg:block`** — poniżej 1024 px znika, a wtedy „pas sekcji"
   rozwiązuje się zapasową ścieżką. Baseline mierzy 1280/1440, więc migracja poniżej `lg`
   pozostaje niezmierzona. Jeśli powłoka zmieni ten próg — sprawdzić ręcznie.

7. **Menu 2 jest jedynym pasem z kotwicą właścicielską** (`data-testid="nmode-menu2"`).
   Menu 1 i pas sekcji są rozwiązywane po klasach/strukturze. Gdyby migracja zmieniła klasy
   nagłówka, pomiar spadnie na heurystykę — widać to w JSON w polu `zrodlo`.
   **Najtańsza inwestycja migratora: dodać `data-testid="nmode-header"` w root `NModeHeader`.**

8. **Fałszywy pozytyw detektora enumów, świadomie wyciszony:** `shadow-board` w treści demo
   karty Inicjatywa (`dev-render/screens/karta-initiative.tsx:213`) to terminologia Lean/5S,
   nie enum systemowy. Wpisany do listy wyjątków obok `trade-off`. Baseline enumów = 0
   dopiero po tym wyciszeniu — nie „samo wyszło".

## Kontrolki pozytywne aparatu (wynik z dnia baseline)

`node scripts/karty-n-geometria.mjs --self-test` → **12/12 zdanych**. Sprawdzane:
sztuczny błąd konsoli jest łapany, sztuczny favicon-404 jest odfiltrowany (filtr nie łapie
wszystkiego jak leci), wstrzyknięty crimson podnosi licznik, `STATUS_W_TOKU` i `priority-high`
są łapane, „Coś poszło nie tak" przełącza flagę error-boundary, usunięcie kotwicy Menu 2
daje **brak** zamiast po cichu rect-u rodzica, żaden pas nie jest kontenerem `max-w-*`,
komplet 5 pasów jest zmierzony, `trade-off`/daty/nazwy plików nie są zgłaszane,
a detektor działa też na tekście z `.value` pól formularza.

Skrypt kończy się kodem 1, gdy którakolwiek kontrolka padnie — wynik pomiaru bez zielonego
`--self-test` **nie ma wartości dowodowej**.
