---
doc_id: program-decyzje-wlasciciela-20260904
status: do-decyzji
data: 2026-09-03 (wieczór), do rozstrzygnięcia 2026-09-04 rano
---

# Decyzje właściciela, od których zależy termin zamknięcia bramek

Źródło: `ANALIZA_G13_MODULY_01_08_20260903.md`, `ANALIZA_G13_MODULY_09_16_20260903.md`,
`AUDYT_PRZEWODOW_ODBIORU_20260903.md`. Każda pozycja: co widzi użytkownik dziś, ile kosztuje,
rekomendacja CTO. Wybór jest binarny: **MVP TERAZ** albo **JAWNIE ODŁOŻONE** (wpis do rejestru
decyzji, bramka `G14` przechodzi z odłożeniem zapisanym, nie przemilczanym).

## A. Flagi domyślnie OFF na 21 zatwierdzonych ekranach (audyt przewodów, 22 pozycje)

| # | Co | Co widzi klient na produkcji bez ręcznego włączenia | Koszt | Rekomendacja CTO |
| --- | --- | --- | --- | --- |
| A1 | 14 ekranów Wyników (KPI, OKR, ROI, wyszukiwarka, uwaga) — `resultsVNextFeatureFlags.ts` | brak całego modułu Wyników w nowej postaci; na demo/stagingu widoczne przez profil odbiorowy | DROBNE (przełączniki) | **ON** — zatwierdzone 02.09, reguła 7 kodeksu: po akcepcie flaga domyślna |
| A2 | 6 paneli Finansów (komentarze, porównanie, eksport/import, nawigator pochodzenia, zapisane widoki, pakiet sprawozdań v2) — `useFinance*Flag.ts` | panele niewidoczne | DROBNE | **ON** — jak wyżej |
| A3 | Przeprojektowana Organizacja (`orgRedesignV1`) | stara powierzchnia; zatwierdzony ekran A tylko z parametrem | DROBNE | **ON** — zatwierdzony ekran ma być domyślny |
| A4 | Kreator wywiadu (`interview-creator-shell`, INT-1) | brak kreatora | DROBNE + odbiór 40-punktową listą po włączeniu | **ON po odbiorze na stagingu** |

Uwaga: włączenie dotyczy kodu, więc obejmie także produkcję consultify.ai przy następnym wdrożeniu.
Produkcja jest oddzielna i nietykalna do Twojego słowa — dlatego to jest Twoja decyzja, nie moja.

## B. Przebudowy wymagające prototypu do akceptu (DUŻE)

| # | Co | Co widzi użytkownik dziś | Koszt | Rekomendacja CTO |
| --- | --- | --- | --- | --- |
| B1 | ASS-2 — struktura raportu końcowego Oceny (wstęp → 7 osi → odpowiedzi i wnioski → podsumowanie; analogicznie SIRI) | raport w starej strukturze | DUŻE: przeprojektowanie + generowanie per metodyka; prototyp dokumentu jako PLIK do akceptu przed silnikiem | **MVP TERAZ, ale osobnym torem**: prototyp w 1 dzień, budowa 2–3 dni; nie blokuje bramek pozostałych 15 modułów |
| B2 | ASS-3 — biblioteka DRD: odrzucony zestaw kolumn i brak podglądu („Do powtórki") | tabela z kolumnami, których nie chcesz | DUŻE (co pokazać — decyzja treści) | **Twoja lista kolumn w 5 zdaniach** → wykonanie ŚREDNIE |
| B3 | MW-4 — prawy panel Idei/Notatnika (UW-07-14/17/18), sam wpisałeś do backlogu | obecny układ panelu | DUŻE projektowo | **ODŁOŻONE** (Twoja własna kwalifikacja z 01.09) |
| B4 | INIT-2(b) — „Tworzy raport" w doradcy obciążenia (migawka zespołu) — funkcji nie ma w kodzie | brak przycisku/funkcji | DUŻE (nowa funkcja) | **ODŁOŻONE** — nie budujemy nowych funkcji w tygodniu zamykania bramek |
| B5 | Czat — restrukturyzacja współdzielonego menu kanw (kebab) | obecne menu na wszystkich kanwach | DUŻE, szeroki promień | **ODŁOŻONE** do osobnej fali po stagingu |
| B6 | Czat — nowa funkcja preferencji (za crashem, który dziś się nie odtworzył) | brak funkcji | DUŻE (nowa) | **ODŁOŻONE** |
| B7 | 11_MATERIALS — usunięcie jednej trasy/ekranu (analiza: „tanie, ale wymaga decyzji produktowej") — szczegół w analizie 09–16 | ekran istnieje | DROBNE po decyzji | **Twoje jedno słowo: zostaje / znika** |

## C. Przemalowanie crimsona poza semantyką krytyczną (projekt, nie poprawka)

Systemowy dług: **5 325 wystąpień w 609 plikach** (Czat 69 plików, Administracja 102, Moja Praca
53, Finanse 6, Ustawienia 17). Pierścień fokusu (193 wystąpienia) idzie już dyżurem Codexa 287.
Reszta to zmiana wyglądu CTA i stanów aktywnych na neutralne — **wymaga Twojego akceptu na
zrzutach per moduł**, bo zmienia twarz produktu.

Rekomendacja CTO: **moduł po module, po Twoim przelocie po stagingu**, zaczynając od Czatu
(moduł startowy każdej sesji), jako osobne dyżury Codexa z parą zrzutów PRZED/PO. Nie w tym
tygodniu — nie blokuje żadnej z 96 bramek, bo kanon crimsona jest bezpiecznikiem „nie rośnie",
nie „zero".

## D. Rzeczy zamknięte rozmową (0 linii kodu)

| # | Co | Pytanie |
| --- | --- | --- |
| D1 | ASS-6 — `assessment-quality-review-panel` i `assessment-presentation-view`: analiza mówi, że masz pytanie o ich sens | Zostają jako są? |
| D2 | ORG-4 — Organizacja nie ma ani jednej Twojej uwagi w 77 uwagach z odbioru | Widziałeś ten moduł na przeglądzie 22–23.08, czy przeoczony? |
| D3 | INT-1 (jak A4) | — |

## Co się dzieje bez Twojej decyzji

Robotnicy zamykają dziś i jutro wszystko DROBNE i ŚREDNIE (dostępność, język, przewody, luki
podglądu, martwy kod, migracje). Pozycje z tej listy stoją. Przy `G14` każdego modułu wpisuję
„odłożone decyzją właściciela DEC-…" albo „w budowie" — nie „gotowe".

## E. Dopisane wieczorem 03.09 (po pomiarach robotników)

| # | Co | Co widzi użytkownik dziś | Koszt | Rekomendacja CTO |
| --- | --- | --- | --- | --- |
| A5 | Zakładka „Obserwowane” w Ustawieniach: cały katalog `NotificationSettingsV2` (8 plików + hook wołający trasę, której serwer nie ma) NIE jest podłączony — Ustawienia renderują starą wersję | nic — funkcji nie widać | usunięcie DROBNE; podłączenie ŚREDNIE (trasa + tabela + 3 operacje + test) | **USUNĄĆ** (kod bez wołacza to dług, nie funkcja; jeśli obserwowanie obiektów ma wrócić, wraca jako projekt po MVP) |
| E1 | Reguła liczenia bramki G20 „zero otwartych P0/P1”: rejestry mają 121 pozycji, z czego 48 to Twoje życzenia produktowe z 22–23.08 bez decyzji, 8 czeka na rozmowę, 23 są zamknięte/odłożone Twoimi decyzjami | — | 0 linii kodu | **Przyjąć regułę**: pozycje ZAMKNIĘTE/ODŁOŻONE decyzją (z numerem DEC) nie blokują; blokują tylko pozycje bez decyzji. Bez tej reguły G20 nie ma matematycznej szansy przejść w tym tygodniu |
| E2 | Pakiet 56 pozycji P0/P1 do decyzji „teraz / po MVP” — rodzinami, z rekomendacją per rodzina | — | wg pakietu | Osobny plik `DECYZJE_WLASCICIELA_P0P1_20260904.md` (w przygotowaniu przez robotnika; rano gotowy) |
| E3 | Staging jest 507 commitów za linią dowodów | Twój przelot po stagingu ogląda kod sprzed tygodnia | 0 linii, jedno słowo | **„wdrażaj”** — bez tego G16 nie rusza |

Wydane dziś wieczorem dyżury Codexa: 288 (bramka modułu na 270 trasach finansów), 289 (pomoc), 290 (dowody G19), 291 (dowody runtime P0/P1). Wklejki masz w rozmowie; instrukcje w `docs/program/waves/WAVE_03_ACCEPTANCE/codex/`.
