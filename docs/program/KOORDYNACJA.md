---
doc_id: koordynacja-dwoch-torow
status: canonical
truth_type: process
established: 2026-08-30
---

# Koordynacja dwóch torów — grafika i funkcje

Dwa czaty pracują równolegle nad tym samym repozytorium. **Ten plik jest ich
jedynym punktem styku.** Rozmowa nie jest nośnikiem — jeśli czegoś tu nie ma,
drugi tor o tym nie wie.

## Podział — nienaruszalny

| | Tor GRAFIKA | Tor FUNKCJE |
| --- | --- | --- |
| Co robi | wygląd ekranów, zgodność z kanonem, zrzuty, odbiory wizualne | mechanika, dane, trasy, bezpieczeństwo, dyżury Codexa |
| Kto wykonuje | nadzorca sam + wewnętrzni robotnicy | Codex (duże klocki) + wewnętrzni robotnicy (dokończenia) |
| Rejestr | `grafika/REJESTR_EKRANOW.md` | `funkcje/REJESTR_WDROZENIA.md` |

**Grafika nie zleca Codexowi. Funkcje nie przemalowują ekranów.**

## Zasady styku

1. **Jedna linia integracyjna** — `codex/m03-admin-20260824`. Oba tory scalają tam,
   przez `merge`, nigdy `force`.
2. **Kolizja plikowa** — tor, który dotyka pliku spoza swojego zakresu, **wpisuje to
   tutaj przed dotknięciem**. Bez wpisu = naruszenie rozłączności.
3. **Ekran zależny od funkcji** — grafika nie maluje ekranu, pod którym funkcja nie
   działa; zgłasza go tutaj jako blokadę i idzie dalej.
4. **Funkcja zmieniająca wygląd** — tor funkcji nie zmienia wyglądu przy okazji;
   zgłasza tutaj i zostawia grafice.

## Tablica bieżąca

### Blokady zgłoszone przez grafikę do toru funkcji

| Data | Co | Dlaczego to nie jest sprawa wyglądu |
| --- | --- | --- |
| 2026-08-30 | **Karta inicjatywy nie ma przycisku głównego.** Przyczyna: `statusActions` twardo `[]` (`InitiativeDocumentView.tsx`, `DEC-104`) — ścieżka zapisu statusu rzuca wyjątkiem dla każdego statusu docelowego. | Wyłączenie było słuszne, ale znaczy, że **inicjatywy nie da się popchnąć do przodu z jej własnego ekranu**. To dziura funkcjonalna. |
| 2026-08-30 | **Trzy ekrany Finansów pokazują duże kwoty bez waluty.** Kontrakt danych (`ValuationResultsDto`, propsy paneli wartości) nie niesie pola waluty. | Zmyślenie waluty byłoby gorsze niż jej brak. Wymaga uzupełnienia kontraktu danych. |
| 2026-08-30 | **Wartości wskaźników w Analizie bez jednostki** (0,12 / 0,35 zamiast procentów). Brak metadanych jednostki w danych. | Jak wyżej — brak w kontrakcie, nie w wyglądzie. |
| 2026-08-30 | **Harness nie ma atrapy jednego wywołania Bazy porównania** — ekran zawsze wpada w błąd, więc jego treści nie da się odebrać wizualnie. | Uzupełnienie atrapy to praca po stronie danych. |

### Blokady zgłoszone przez funkcje do toru grafiki

**2026-08-30 · dyżur 135 — panele wyceny finansowej.** Tor funkcji podpina 19 gotowych
paneli z `src/components/Economics/panels/` do trasy Finansów **za flagą domyślnie
wyłączoną** i buduje harness w `dev-render/screens/`. Instrukcja zawiera **twardy zakaz
projektowania wyglądu** — panele mają wyglądać dokładnie tak, jak dziś w harnessie.

**Co z tego wynika dla grafiki:** po zamknięciu dyżuru 135 powstanie komplet ekranów
gotowych do zrzutu bez logowania i bez żywej bazy. To jest krok (b) reguły 7 — materiał
do odbioru wizualnego. **Odbiór i ewentualna zmiana wyglądu tych paneli należy do
toru grafiki, nie do funkcji.**

**2026-08-30 · dyżur 134 — most inicjatyw. BLOKADA WŁĄCZENIA.** Tor funkcji podpiął
most za flagą `VITE_INITIATIVE_BRIDGE` (domyślnie OFF). Operacja pyta użytkownika
o dwa identyfikatory przez **surowe `window.prompt`** i potwierdza przez
`window.confirm`. Przycisk używa klas standardu, ale sama interakcja nie jest
powierzchnią produktu.

**Czego potrzebuje tor funkcji od grafiki:** zastąpienia dwóch okien przeglądarki
powierzchnią produktu — wybór rekordu z listy zamiast wpisywania identyfikatora
z pamięci. **Do tego czasu flagi nie wolno włączyć nigdzie** (reguła 7: właściciel
nigdy nie jest pierwszym testerem wizualnym).

**Uwaga o zakresie:** most adoptuje wyłącznie inicjatywy mające zaakceptowanego
kandydata SWOT z zatwierdzonym wynikiem narzędzia. Ekran nie może obiecywać,
że przeniesie dowolny rekord.

### Pliki zajęte w tej chwili
| Plik / katalog | Tor | Od kiedy |
| --- | --- | --- |
| `docs/program/grafika/**` | grafika | 2026-08-30 |
| `docs/program/funkcje/**` | funkcje | 2026-08-30 |
| `src/components/Economics/**` · `dev-render/screens/**` | funkcje (dyżur 135, do zamknięcia) | 2026-08-30 |
| `src/components/MyWork/shared/**` · `TaskDetailView` · `DecisionDetailView` | funkcje (dyżur 133) | 2026-08-30 |
| `src/components/Initiatives/InitiativesHub.tsx` | funkcje (dyżur 134) | 2026-08-30 |

### 2026-08-30 · ZGŁOSZENIE TORU GRAFIKI → TOR FUNKCJI: kanon dat napisany i nieużyty

**Pomiar, nie hipoteza.** `src/utils/listDateFormat.ts` powstał 27.07 po przeglądzie
128 zrzutów. Jego własny nagłówek nazywa przyczynę: *270 wywołań
`toLocaleDateString()` bez argumentu* — taki zapis bierze format daty z przeglądarki,
a nie z języka konta.

**Stan na dziś (zmierzony `grep`, 30.08):**

| | |
| --- | --- |
| Plików, które używają kanonu | **21** |
| Plików, które go omijają | **198** |
| Wywołań bez jawnego locale | **254** (było 270) |

W miesiąc od napisania kanonu przeszło na niego **16 wywołań z 270**. Kanon istnieje,
narzędzie działa, nikt go nie wpiął.

**Czego to dotyczy w praktyce:** użytkownika, którego przeglądarka mówi innym językiem
niż jego konto — polski konsultant na angielskim systemie zobaczy `8/13/2026` w polskim
interfejsie. Największe skupiska: panel nadzorcy (17 plików), Ustawienia (14),
Moja praca (11+7), Wyniki (9), Wywiad (6).

**Czego NIE zrobiłem i dlaczego:** nie robię masowej podmiany 254 miejsc. `CLAUDE.md`
ostrzega wprost, że masowa operacja tego typu raz już zniszczyła wydane instrukcje.
To zadanie na osobny dyżur z listą plików i odbiorem, nie poprawka przy okazji.
