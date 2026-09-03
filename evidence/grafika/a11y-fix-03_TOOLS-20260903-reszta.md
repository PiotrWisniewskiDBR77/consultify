# A11y fix — 03_TOOLS (dyżur „reszta", 2026-09-03)

Gałąź: `agent/fix-a11y-reszta-20260903`, worktree `/private/tmp/ag-fix-a11y-reszta`.

## Ekrany

1. `tools-sesja-wyjscie` — mocked `DiscoveryToolsHub`
   (`src/components/Discovery/DiscoveryToolsHub.tsx`)
2. `tools-swot-library-detail` — mocked `KnownToolDetailView`
   (`src/components/DiscoveryTools/KnownToolDetailView.tsx`)

## Tabela PRZED → PO (kadry z realnym naruszeniem axe)

| Ekran | Kadr | PRZED | PO |
|---|---|---|---|
| tools-sesja-wyjscie | pl-1440 light/dark | 0/0 | 0/0 |
| tools-sesja-wyjscie | en-1024 light | 0 | 0 |
| tools-sesja-wyjscie | en-1024 **dark** | **1 (color-contrast)** | 0 |
| tools-sesja-wyjscie | en-1440 | nie mierzone (poza zakresem PRZED) | — |
| tools-swot-library-detail | pl-1440, pl-1024, en-1024, en-1440 (wszystkie, oba motywy) | 0 na WSZYSTKICH 8 kadrach | 0 |

## Korekta pomiaru (punkt 5 instrukcji)

Instrukcja: „tools-sesja-wyjscie color-contrast 2/8; tools-swot-library-detail
color-contrast 2/8 (tylko część kadrów — sprawdź, który motyw/szerokość)".
Zmierzyłem WSZYSTKIE 4 kombinacje język×szerokość (pl-1440, pl-1024, en-1024,
en-1440) × 2 motywy = 8 kadrów na `tools-swot-library-detail` — **0/8 realnych
naruszeń axe**, na żadnym. `tools-sesja-wyjscie`: naruszenie znalezione TYLKO
w en-1024 dark (1/8 zmierzonych kadrów, nie 2/8 — ale ten sam komponent
współdzielony może odpowiadać za drugi kadr z matrycy nadzorcy, którego nie
miałem w moim skróconym zestawie testowym np. en-1440 dark). Naprawiłem
źródłowy komponent (patrz niżej) — defekt (brak `dark:` na `text-slate-600`)
jest jednoznaczny i naprawa zamyka go we WSZYSTKICH kadrach dark niezależnie od
szerokości/języka (statyczna klasa, nie zależy od layoutu).

## Naprawa (reguła → komponent → plik)

| Reguła | Komponent | Plik | Co zmieniono |
|---|---|---|---|
| color-contrast | Etykieta „AI Copilot" nad akcjami AI fazy narzędzia — `text-slate-600` bez wariantu `dark:`, więc w trybie ciemnym zostawał ten sam (jasny-motyw) odcień: 2.36:1 na `#0f172a` (< 4.5) | `src/components/DiscoveryTools/shared/ToolPhaseAiActions.tsx` | Dodano `dark:text-slate-400` (6.96:1 na dark); `text-slate-600` w light bez zmian (7.58:1). Komponent współdzielony (`shared/`) — naprawa zamyka to samo naruszenie na wszystkich ekranach narzędzi Discovery, które montują `ToolPhaseAiActions`, nie tylko na tym jednym. |

## Zadanie od koordynatora: rozjazd wymiarów light/dark na `tools-swot-library-detail`

**Nie udało się odtworzyć.** Zmierzyłem bezpośrednio wymiary PNG (nie tylko
`scrollHeight` z `wynik.json`, ale `file <ekran>.png`) dla WSZYSTKICH kombinacji:

| Szerokość/język | light × dark wymiary PNG |
|---|---|
| pl-1440 | 2880×3278 = 2880×3278 (identyczne) |
| pl-1024 | 2048×4180 = 2048×4180 (identyczne) |
| en-1024 | 2048×3888 = 2048×3888 (identyczne) |
| en-1440 | (DOM `wys`=1607 w obu — identyczne) |

Dodatkowo: powtórzyłem pomiar pl-1440 dwukrotnie (osobne uruchomienia
kanonicznego narzędzia) — za każdym razem identyczne wymiary. Sprawdziłem też
ISTNIEJĄCE zrzuty w repo (`evidence/grafika/195-przelot-A/`,
`evidence/grafika/147-parametry/`) z wcześniejszych sesji — tam też
`tools-swot-library-detail__PO__light.png` i `__dark.png` mają identyczne
wymiary (2880×2332 w obu miejscach).

**Wniosek**: nie znalazłem żadnego dowodu na rozjazd wymiarów w obecnym stanie
kodu na tej gałęzi, na żadnej z testowanych kombinacji szerokość×język, w
żadnym z wielokrotnych pomiarów. Możliwe wyjaśnienia (nierozstrzygnięte —
brak dowodu w żadną stronę):
1. Defekt już naprawiony przez wcześniejszą sesję na tej samej gałęzi (worktree
   dzieli HEAD `7c2f342144` z `/private/tmp/m03`).
2. Obserwacja koordynatora pochodziła z INNEGO stanu kodu / innej gałęzi / innego
   przyrządu pomiarowego niż `scripts/dev/grafika-zrzuty.mjs` użyty tutaj.
3. Zjawisko rzadko-nawracające (np. zależne od stanu sieci/timing przy
   pierwszym renderze), którego nie złapałem mimo powtórzeń.

Nie znalazłem w kodzie `KnownToolDetailView.tsx` ani w mocku
`dev-render/screens/tools-swot-library-detail.tsx` żadnej gałęzi renderującej
inną strukturę/treść zależnie od `theme` — jedyne różnice to klasy `dark:` na
kolorach (typowy wzorzec), zero warunkowego contentu. To zgadza się z brakiem
zmierzonego rozjazdu: nie ma w kodzie mechanizmu, który by go produkował.

**Rekomendacja**: jeśli rozjazd pojawi się ponownie u koordynatora, potrzebny
jest DOKŁADNY zrzut z jego przebiegu (plik `wynik.json` + PNG z konkretnej
komendy) do porównania — bez tego nie da się zdiagnozować różnicy między
naszymi pomiarami.

## Komendy (odtwarzalność)

```
node scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5333 \
  --ekrany=tools-sesja-wyjscie,tools-swot-library-detail \
  --katalog=03_TOOLS-po-pl1440 --faza=PO --jezyk=pl --szerokosc=1440 \
  --motywy=light,dark --rozwin-sekcje=1 --a11y=1 \
  --wyjscie=/private/tmp/ag-fix-a11y-reszta-artefakty/03_TOOLS/po-pl-1440 \
  --wynik-json=/private/tmp/ag-fix-a11y-reszta-artefakty/03_TOOLS/po-pl-1440/wynik.json
```

(analogicznie `--jezyk=en --szerokosc=1024`, oraz dodatkowo `--jezyk=pl
--szerokosc=1024` i `--jezyk=en --szerokosc=1440` użyte do sprawdzenia
zadania koordynatora)

Surowe dane (poza repo):
`/private/tmp/ag-fix-a11y-reszta-artefakty/03_TOOLS/{przed-pl-1440,przed-pl-1024,przed-en-1024,przed-en-1440,po-pl-1440,po-en-1024,rerun-a}/wynik.json`
i towarzyszące `*.png`.

## Pliki produktu zmienione

- `src/components/DiscoveryTools/shared/ToolPhaseAiActions.tsx`

Weryfikacja składni: `npx esbuild <plik> --loader:.tsx=tsx --jsx=automatic` — exit 0.

## Nienaprawione / nierozstrzygnięte

- Zadanie koordynatora (rozjazd wymiarów light/dark na
  `tools-swot-library-detail`) — nierozstrzygnięte z braku odtwarzalności,
  patrz sekcja wyżej. Nie naprawiałem niczego pod tym tytułem, bo nie znalazłem
  defektu do naprawienia.
