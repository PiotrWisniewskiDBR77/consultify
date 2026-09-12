---
doc_id: codex9-zamkniecie-kandydata
status: WYDANY 12.09 wieczór
truth_type: codex-block-instruction
baza: codex/integrator-mvp-20260912 (gałąź kandydata, którą sam zbudowałeś)
---

# CODEX 9 — ZAMKNIĘCIE KANDYDATA MVP (zamrożenie, bramka, dowód)

Zbudowałeś kandydata MVP na gałęzi `codex/integrator-mvp-20260912`. Zawiera on w całości gałąź
`codex/ie00-governance-20260912` oraz przyjęte dostawy C2b, C4 (E1–E4), C8 E0, deck autosave,
ocenę AI Wywiadu i kontrakt eksportu. **Kandydat rośnie szybciej, niż da się go wdrożyć** —
ostatni commit powstał kilka minut przed wydaniem tego bloku. Wdrożenia nie da się zrobić
na ruchomym celu, więc ten blok ma jedno zadanie: **zamrozić, zmierzyć i udowodnić**.

## §0 ZASADA NADRZĘDNA

**Od momentu przyjęcia tego bloku nie dokładasz do kandydata żadnego nowego zakresu.**
Nowa robota (Wywiad, Materiały, eksport, cokolwiek) idzie na **osobne gałęzie** i czeka.
Do kandydata wolno dopisać wyłącznie to, co naprawia czerwony wynik bramki z §2.
Każde takie dopisanie odnotowujesz w §4 jako „naprawa bramki", z powodem.

## §1 ZAMROŻENIE

1. Zapisz SHA zamrożenia: `git -C <worktree kandydata> rev-parse HEAD` — to jest **SHA KANDYDATA**.
   Powtarzasz go w raporcie i w nazwach katalogów dowodów.
2. `git status --porcelain` musi być puste. Niecommitowana robota = STOP i meldunek.
3. Potwierdź rodowód: linia `7c7dd88091` jest przodkiem kandydata, a gałąź `ie00-governance`
   zawiera się w kandydacie w całości. Podaj obie odpowiedzi komendą, nie zdaniem.
4. Wypisz **listę przyjętych dostaw** (paczka → SHA scalenia → jednozdaniowy zakres) i osobno
   **listę rzeczy świadomie NIEprzyjętych** (C6 HOLD i cokolwiek innego), z powodem.

## §2 BRAMKA — sekwencyjnie, nigdy równolegle

| # | Krok | Próg |
|---|---|---|
| 1 | `cd server && npx tsc --noEmit` | **0** |
| 2 | `npx tsc --noEmit` (front, jeden bieg, `NODE_OPTIONS=--max-old-space-size=8192`) | **≤ 192**; podaj liczbę i potwierdź, że proces nie został zabity |
| 3 | `node scripts/dev/pomiar-jezyka.mjs --baseline` | bez wzrostu wobec bazy |
| 4 | `npx vite build` + `git status --porcelain` | build OK, drzewo czyste; podaj rozmiar `App-*.js` i sumę eager JS |
| 5 | `bash scripts/check-list-canon.sh` · `bash scripts/check-artefakt.sh` | nie gorzej niż baza (322 / 8-0-117) |
| 6 | testy **per plik** dla całego zakresu kandydata + zbiory bezpieczeństwa | zielone albo jawnie „zastane" |

**Krok 6 ma twardy wymóg różnicowy:** każdą czerwień mierzysz też na `7c7dd88091` i klasyfikujesz
jako **NOWA** albo **ZASTANA**. Ogłoszenie regresji bez pomiaru na obu SHA jest błędem bloku.
Nowa czerwień = naprawa w tym bloku. Zastana = wiersz w raporcie, bez naprawy.

## §3 DOWÓD NA ŻYWYM STANOWISKU

Kontener `cx-codex9-pg` (port **6460**), bazy `cx9_*`, API **4219**, preview **5219**.
Baza z kopii szablonu stagingu. Front z **budowy produkcyjnej**, nie z serwera deweloperskiego.

Zmierz i udokumentuj, w **jednym** kontekście przeglądarki (token odświeżony, warunek gotowości
na zmienioną treść, nie na zegar):

1. **16 modułów** montuje treść; podaj czas każdego; zero błędów konsoli produktu; zero odpowiedzi 5xx.
2. **Parytet flag OFF**: przy `ENABLE_INITIATIVE_UNIFIED_WRITE` i `ENABLE_INITIATIVE_APPROVAL_V2`
   wyłączonych zachowanie jest **bit w bit** jak na `7c7dd88091`. To jest warunek wdrożenia — bez tego
   kandydat nie jedzie.
3. **Trzy naprawy z C4** na rekordach zastanych: legacy skrzynka nie zwraca 500, przypisanie zadania
   bez projektu nie zwraca 500, karta działania daje się zamknąć **i otworzyć ponownie**.
4. **Finanse**: pozycja widoczna, wejście pokazuje „wkrótce", żadna trasa finansowa nie zwraca 404 ani 500.
5. **Zimny start**: zmierz i podaj liczbę uczciwie. Jeśli nie poprawił się względem `7c7dd88091`,
   napisz to wprost — „mniej JS" bez poprawy czasu to nie jest sukces.

Zrzuty: `evidence/kandydat-<sha8>/`, jasny i ciemny, bezpiecznik jasności. Logi surowe poza repo.

## §4 RAPORT — jedna strona werdyktu na początku

`docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX9_ZAMKNIECIE_KANDYDATA/98_KANDYDAT.md`:

1. **SHA kandydata** i werdykt w jednym zdaniu: gotowy do wdrożenia / niegotowy i dlaczego.
2. Lista przyjętych dostaw i lista świadomie nieprzyjętych.
3. Bramka — surowe wyniki wszystkich sześciu kroków, tabela NOWE vs ZASTANE.
4. Dowód z §3, punkt po punkcie, z liczbami i ścieżkami zrzutów.
5. **Ryzyka wdrożenia**: co może pójść nie tak na stagingu i po czym to poznamy w pierwszych 10 minutach.
6. **Czego nie sprawdziłeś.** Sekcja nie może być pusta bez uzasadnienia.

Zakazy bez zmian: nie pushujesz, zero połączeń do Railway, stagingu, demo i produkcji, zakaz
`git stash` i `--no-verify`, testy per plik, znacznik commita `[ODMROZENIE WSPOLNE DEC-475]`
plus moduł, jeśli hook go wskaże.
