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
_(pusto)_

### Blokady zgłoszone przez funkcje do toru grafiki

**2026-08-30 · dyżur 135 — panele wyceny finansowej.** Tor funkcji podpina 19 gotowych
paneli z `src/components/Economics/panels/` do trasy Finansów **za flagą domyślnie
wyłączoną** i buduje harness w `dev-render/screens/`. Instrukcja zawiera **twardy zakaz
projektowania wyglądu** — panele mają wyglądać dokładnie tak, jak dziś w harnessie.

**Co z tego wynika dla grafiki:** po zamknięciu dyżuru 135 powstanie komplet ekranów
gotowych do zrzutu bez logowania i bez żywej bazy. To jest krok (b) reguły 7 — materiał
do odbioru wizualnego. **Odbiór i ewentualna zmiana wyglądu tych paneli należy do
toru grafiki, nie do funkcji.**

### Pliki zajęte w tej chwili
| Plik / katalog | Tor | Od kiedy |
| --- | --- | --- |
| `docs/program/grafika/**` | grafika | 2026-08-30 |
| `docs/program/funkcje/**` | funkcje | 2026-08-30 |
| `src/components/Economics/**` · `dev-render/screens/**` | funkcje (dyżur 135, do zamknięcia) | 2026-08-30 |
| `src/components/MyWork/shared/**` · `TaskDetailView` · `DecisionDetailView` | funkcje (dyżur 133) | 2026-08-30 |
| `src/components/Initiatives/InitiativesHub.tsx` | funkcje (dyżur 134) | 2026-08-30 |
