# RAPORT KOŃCOWY — 09/10.09.2026

Stan zamknięcia sesji nadzorczej. Wszystkie liczby zmierzone bezpośrednio na żywych bazach
i przez odczyt `/api/health`, nie z pamięci. Punkt wejścia dla kolejnego agenta:
`PRZEKAZANIE_20260909_KONIEC_DNIA.md` w tym samym katalogu.

## 1. Stan środowisk (10.09, 06:20)

| | staging (thomas) | demo (trolley) |
|---|---|---|
| kod (`/api/health`) | `f53f9fbdf9` | `f53f9fbdf9` |
| baza | połączona | połączona |
| organizacje | 8 (4 docelowe + 4 konta testerów z 09.09) | 4 docelowe |
| klony sesji demo | 0 | 0 |
| inicjatywy / zadania | 120 / 259 | 119 / 259 |
| konfiguracja produktu | komplet (polityka 1, szablony 44, bezpieczeństwo 4) | komplet |
| surowy JSON w opisach skrzynki | 0 | 0 |

Gałąź integracyjna `mvp/inicjatywy-lancuch-20260907` = `8ca7850060`, drzewo czyste,
zdalna gałąź `staging` zsynchronizowana. Nic nie biegnie w tle: zero procesów robotników,
zero zajętych portów, jeden worktree. Produkcja (centerbeam) nietknięta przez cały dzień.

## 2. Co zostało zrobione (09.09, jeden dzień)

**Język.** Osiem fal wdrożeniowych. W wersji angielskiej zero polskich napisów w 16 modułach,
mierzone przyrządem i okiem na 176 zrzutach z żywego stagingu. Osobno wykryty i zamknięty
polski bez ogonków, którego przyrząd nie widział: 665 miejsc w modułach pierwszej fali → 3.
Osiemnaście bezpieczników źródłowych pilnuje, żeby nie wrócił. Naprawiony błąd, przez który
etykiety statusów były zawsze polskie niezależnie od języka konta (70 wywołań w 6 plikach).

**Dane.** Czystka bazy w czterech cyklach plus sieroty: usunięte 325 organizacji-śmieci,
3 organizacje pokazowe, 49 klonów sesji demo i 39 354 wiersze bez właściciela — łącznie ponad
96 tysięcy wierszy, każdy cykl z manifestem do cofnięcia i pełnym zrzutem przed operacją.
Demo postawione jako kopia stagingu (dane, 36 zmiennych, ten sam kod). Dosiew D9 domknął pięć
braków wykrytych testem: profil organizacji 13/13, przydziały wywiadu, opublikowana migawka
karty wyników, obłożenie realizacji 46 %, pola pochodne.

**Test.** Kryteria spisane przed pomiarem (7 kryteriów języka, 7 danych), dwa raporty
szczegółowe, jeden zbiorczy, kontrola po naprawach. Werdykt: dane wysyłane poprawnie,
70 ekranów bez błędów konsoli i bez odpowiedzi 5xx, 9 z 9 kont działa.

**Naprawy.** Dziesięć defektów z testu plus dwa znalezione po nim, w tym jeden blokujący:
ekran inicjatywy bił nieudanym zapisem co półtorej sekundy i pokazywał „Unsaved" na dwunastu
z trzynastu rekordów. Dwie premisy z raportu obalone pomiarem — nie naprawiałem tego, czego
nie było zepsute.

**Operacyjnie.** Odblokowany czat testera (trzy warstwy limitów), włączony moduł spotkań na
stagingu, usunięty martwy kod, rejestr zamrożenia zrównany z mapą przyrządu (794 rozjazdy → 0),
zrotowane hasło kont pokazowych.

## 3. Trzy incydenty i czego uczą

1. **Czystka sierot skasowała 319 wierszy konfiguracji produktu.** Wiersze wzorcowe (`*`,
   `__system__`, `__global__`, pusty ciąg) z definicji nie należą do żadnej organizacji, więc
   predykat sieroty je objął. Skutek: żadnej inicjatywy nie dało się utworzyć, serwer oddawał 500
   bez śladu w logu. Weryfikacja po czystce była zielona, bo liczyła zera. **Po operacji na danych
   przejdź jeden pełny przepływ zapisu, nie licz rekordów.** Zabezpieczone testem.
2. **Uznałem żywego robotnika za martwego i skasowałem mu stanowisko z bazą.** Milczał 13 minut,
   a jego zrzut wyglądał na urwany — w rzeczywistości commit etapu leżał w repozytorium od kwadransa,
   a plik właśnie się kopiował. Odtworzył wszystko i znalazł defekt blokujący, którego mój szybszy
   pomiar nie objął. **Żywotność mierz commitami, czasem zmiany plików i obecnością procesu.
   Cudzego stanowiska nie kasuj nigdy.**
3. **Wdrożenie padło na przeterminowanym połączeniu z Railway**, nie na kodzie. Powtórka pomogła.
   Przy każdym wdrożeniu czytaj wynik przebiegu, nie zakładaj sukcesu po samym wysłaniu.

## 4. Co zostaje otwarte

**Do decyzji właściciela (zrzuty wysłane):** menu przy tworzeniu inicjatywy zamiast wejścia
wprost w kreatora; kolor plakietki „Attention Required" przy statusie gotowym; zapis daty
rzymską cyfrą.

**Do paczki 2, wg wartości:**
1. Przejście właściciela po systemie — jedyna pozycja niewykonalna bez niego.
2. Brak przycisków edycji i usuwania w menu kontekstowych realizacji i mojej pracy. Na poziomie
   API cykl przechodzi, brakuje przewodu w interfejsie.
3. Klony sesji demo wracają przy każdym użyciu funkcji; sprzątacz chodzi raz na dobę.
   Skrócić czas życia, sprzątać częściej albo wyłączyć sesje demo poza produkcją.
4. Wskaźnik zwrotu w kokpicie realizacji czyta pustą tabelę zastaną zamiast kanonicznej.
5. Dług językowy: daty i liczby w panelu administratora i na serwerze, zdania serwera,
   maile i dokumenty, cała wersja polska.
6. Znane braki produktu: spotkania to zaślepka, finanse bez pozycji w menu, partnerzy dla
   właściciela pokazują tylko ekran połączenia.

## 5. Gdzie szukać dowodów

Rejestr: `docs/program/PROGRAM_NAPRAWCZY_20260905/01_INDEKS_I_HARMONOGRAM.md`.
Raporty: `docs/program/TEST_JEZYK_I_DANE_20260909/`.
Zrzuty ekranów: `evidence/test-jezyk-dane-0909/`, `evidence/poprawki-po-tescie-1/`,
`evidence/kontrola-po-naprawach-0909/`, `evidence/jezyk-*/`.
Punkty cofnięcia danych: `~/Developer/consultify-dumps/` i `.../manifesty/`.
Sekrety i konta: `~/Developer/consultify-secrets/`.
