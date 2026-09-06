# Panel „Trzy pojemniki pracy” — jak aktualizować

Panel wizualny dla właściciela (Piotr) pokazujący stan trzech pojemników pracy
z `docs/program/TRZY_POJEMNIKI_PRACY_20260906.md`. Jedyne źródło stanu to
`stan.json` w tym katalogu. Generator (`scripts/dev/plan-pojemniki/generuj.mjs`)
czyta ten plik i zapisuje `PANEL.html` — plik gotowy do publikacji przez
nadzorcę (Fable) jako stronę obok rozmowy z właścicielem.

## Jak zaktualizować panel

1. Edytuj `docs/program/plan-pojemniki/stan.json` — WYŁĄCZNIE na podstawie
   nowego wpisu w „Rejestrze odbioru”
   (`docs/program/PROGRAM_NAPRAWCZY_20260905/01_INDEKS_I_HARMONOGRAM.md`).
   Nie wymyślaj stanu — jeśli rejestr milczy, zostaw `"czeka"`.
2. Uruchom generator:
   ```
   node scripts/dev/plan-pojemniki/generuj.mjs
   ```
   Zapisuje `docs/program/plan-pojemniki/PANEL.html`. Zły stan (nieznana
   wartość enuma, brakujące pole) kończy się `exit 1` i komunikatem błędu —
   generator nie zapisze złego pliku.
3. Uruchom test jednostkowy, jeśli zmieniłeś logikę liczenia albo strukturę:
   ```
   npx vitest run tests/unit/plan-pojemniki
   ```
4. Nadzorca publikuje `PANEL.html` jako Artifact/stronę dla właściciela i
   odświeża po każdym kolejnym odbiorze (krok 1–2 ponownie).

## Zasada własności pliku

**`stan.json` aktualizuje TYLKO nadzorca, i TYLKO po realnym wpisie w
Rejestrze odbioru** (SHA, data, dowód). Robotnicy nie edytują tego pliku
bezpośrednio — meldują nadzorcy, nadzorca wpisuje do rejestru, potem do
`stan.json`. To zapobiega rozjazdowi między tym, co panel pokazuje właścicielowi,
a tym, co naprawdę jest odebrane (patrz pamięć nadzorcy:
„gotowe nie znaczy skończone”, „dwa rejestry — licznik mierzy rozjazd”).

## Słownik stanów

Pole `stan` dla pozycji pojemnika (`pojemniki[].pozycje[].stan`):

| Wartość | Znaczenie |
|---|---|
| `czeka` | Nie rozpoczęte — czeka na zależność, decyzję właściciela albo kolejkę |
| `w_toku` | Robotnik pracuje (worktree istnieje, commity powstają) |
| `do_odbioru` | Robotnik zgłosił §10 spełnione, nadzorca jeszcze nie zmierzył/obejrzał |
| `odebrane` | Nadzorca zmierzył i obejrzał zrzuty, zanim scalił |
| `scalone` | Scalone do gałęzi docelowej (m03 / origin/staging), SHA w rejestrze |
| `odeslane` | Odesłane do robotnika — nie spełnia §10, wraca do poprawki |
| `stop` | Zatrzymane na decyzji właściciela albo blokerze nie do ominięcia |

Pole `stan` dla listy szampana (`pojemniki[].szampan[].stan`):
`nie` (nieprawda dziś) · `czesciowo` (część prawdziwa) · `tak` (potwierdzone
dowodem).

Pole `werdykt` dla przejścia właściciela (`przejscie_wlasciciela[].werdykt`):
`brak` (właściciel jeszcze nie przechodził modułu) · `tak` (przeszedł, moduł OK)
· `nie` (przeszedł, znalazł coś, co go zawstydza).

Pole `stan` dla decyzji (`pojemniki[].decyzje[].stan`): `czeka` (właściciel
jeszcze nie zdecydował) · `podjeta` (decyzja zapadła, ma numer `dec`, np.
`DEC-397`).

## Publikacja
Panel właściciela (artefakt, ten sam URL przy każdej republikacji z pliku `PANEL.html`): https://claude.ai/code/artifact/2a86e4bf-46b5-4056-a472-264dc4a26da6 — po każdym odbiorze: edycja `stan.json` → `node scripts/dev/plan-pojemniki/generuj.mjs` → nadzorca republikuje ten sam artefakt.
