# ODBIÓR HARVARD B6 — prompt-book (dla Piotra, ~1-2h, zamyka Harvard v1)

> Przelot 2 przeglądarki (Ty = user A, druga sesja/incognito = user B, ta sama org).
> Login: piotr.wisniewski@dbr77.com. Demo na SHA z B1+ (health: demo.consultify.ai/api/health).
> Zasada odbioru: WZROKIEM, nie „testy przeszły". Per narzędzie: „tak" / lista poprawek → hotfix tą samą szyną.

## CZĘŚĆ 1 — Teresa tworzy (czat → artefakt otwiera się). Wpisz w czat Teresy:

| # | Narzędzie | Prompt (wklej) | Co ma się stać | Gdzie sprawdzić |
|---|-----------|----------------|----------------|-----------------|
| 1 | Mind Map | „Zrób mapę myśli o wejściu na rynek DACH" | otwiera się canvas z mapą (teza w centrum + gałęzie) | My Work → edytor mapy |
| 2 | Process Flow | „Narysuj proces onboardingu klienta krok po kroku" | canvas z węzłami-krokami + strzałki z etykietami | My Work → Process Flow |
| 3 | Whiteboard | „Zrób tablicę z pomysłami na redukcję kosztów" | canvas whiteboard ze stickerami/węzłami | My Work → Whiteboard |
| 4 | Tabela | „Zrób tabelę inicjatyw z kolumnami: nazwa, ROI, budżet, ryzyko" | tabela z wypełnionymi kolumnami (nie tylko status) | My Work → Tabela |
| 5 | Word / Dokument | „Napisz dokument: strategia cenowa na 2026" | otwiera się edytor z realną treścią (nie placeholder) | Materiały → Dokument |
| 6 | Deck | „Zrób prezentację o transformacji EV dla zarządu" | deck ~11 slajdów, status ready | Materiały → Prezentacja |
| 7 | **Sheet** ⚠ | „Zrób arkusz budżetu marketingu na Q3" | artefakt arkusza; **.xlsx przez „Export .xlsx"** (patrz B2 — decyzja o natywnym gridzie osobno) | Outputs → Export .xlsx |
| 8 | **Notatnik** ✅B1 | „Zapisz to jako notatkę: plan wdrożenia CRM na Q3" | toast „Zapisałem notatkę…" + **otwiera się KONKRETNA notatka** (nie lista notatników) | My Work → Notatnik (strona otwarta) |

**Punkt 8 = świeży fix B1** — przed nocą notatka lądowała w bibliotece (niewidoczna); teraz ma się otworzyć strona. To pierwszy test do klika.

## CZĘŚĆ 2 — Persystencja (reload nie gubi):
- Po każdym z 1-6: odśwież stronę (F5) → artefakt nadal jest z treścią.
- Process Flow: dodaj krok z toolbara → reload → krok jest (fix wdrożony).
- Word: dopisz ręcznie zdanie → reload → zdanie jest.

## CZĘŚĆ 3 — Kolaboracja (2 przeglądarki, ta sama org):
- Mind Map: A dodaje węzeł → B widzi ≤2s; B edytuje → A widzi.
- Process Flow / Whiteboard: powtórz (realtime org-scope).
- Tabela: A dodaje wiersz → B widzi; komentarz rekordu → powiadomienie u B.
- Word: A pisze komentarz w wątku → B odpowiada.
- Deck: zakładka Collaborate/presence widoczna.

## CZĘŚĆ 4 — Storage (tor B-R2, jeśli sekret R2 wgrany):
- Whiteboard: wgraj obraz → (po najbliższym redeployu) nadal jest. BEZ sekretu R2 = ten punkt czerwony (znany).

## WYNIK
Per narzędzie: ✅ „tak" albo lista poprawek. Komplet ✅ na osiach S+T+K = **Harvard v1 100%**.
Powłoka SPEC-A (wygląd artefaktów) = osobno, Vegas B8 — NIE część tego odbioru.

## STAN WEJŚCIOWY (noc 07-08/09, korekty vs plan 07-07 — plan ZANIŻAŁ):
- B1 Notatnik: backend był realny (nie fantom); naprawiony FE-mount, na demo `58a03a733f`.
- B2 Sheet: struktura + eksport .xlsx JUŻ są; natywny grid = Twoja decyzja (nie bug).
- B3 Word: siatka E2E już istniała; dołożone pokrycie DOCX (na gałęzi, do uruchomienia po `pnpm install`).
- B4 Mind Map/Process Flow/Whiteboard/Tabela: silniki ≥90 na demo, persystencja server-side, collab kod ON — czeka ten klik.
- Env: brak `cheerio` w node_modules głównego repo (lokalny run; demo OK).
