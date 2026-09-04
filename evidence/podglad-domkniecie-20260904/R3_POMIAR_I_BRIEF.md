# R3 — pomiar i brief (2026-09-04)

## Trzy konteksty wcześniej identyczne

W parach dyżuru 352 PRZED/PO dla `core/finance-hub`,
`core/results-vnext-registry-shell` i `core/results-vnext-attention` sumy SHA-256
były identyczne. Ponowny przebieg dyżuru 365 potwierdził w każdym ekranie i
motywie obecność jednego bloku `[data-preview-block="relations"]`, jednego
`[data-relations-empty]` i wysokość 107 px. Werdykt dla historycznej zmiany 349:
`BEZ ZMIANY RUNTIME — POTWIERDZONE`. Nowe PNG nie są porównaniem 349 PRZED/PO;
różnią się bajtowo przez nowy przebieg i nie są przedstawiane jako dowód tej
historycznej zmiany.

| Kontekst | Motyw | SHA-256 nowego pomiaru | Średnia jasność | DOM | Werdykt |
| --- | --- | --- | ---: | --- | --- |
| finance-hub | light | `9acc1787b32a7aa25159a1b144cd1b026c7989458ea817f8d143c846a31cd8e9` | 247.2777 | relations 1, empty 1, 107 px | `BEZ ZMIANY RUNTIME — POTWIERDZONE` dla 349; R2 widoczne osobno |
| finance-hub | dark | `8ea60e27797f75b7a7aa80cf765a5844196f74a5a4bf8a141054468e7486b5b8` | 25.8302 | relations 1, empty 1, 107 px | jw. |
| results-vnext-registry-shell | light | `39dd901a43d8bd3d35273ce6da6c75f5e7166a09849bdebb953b3334f5bc1f50` | 247.8186 | relations 1, empty 1, 107 px | `BEZ ZMIANY RUNTIME — POTWIERDZONE` |
| results-vnext-registry-shell | dark | `97bdf75fdc195c5004ef820b300484f8241281bb5cda9111d78d205de1ba3572` | 23.7710 | relations 1, empty 1, 107 px | `BEZ ZMIANY RUNTIME — POTWIERDZONE` |
| results-vnext-attention | light | `dc5d2d85be3fc1c427c42d9790e4732ec984f5eb3e60d3efccb0926f168d08d0` | 249.8248 | relations 1, empty 1, 107 px | `BEZ ZMIANY RUNTIME — POTWIERDZONE` |
| results-vnext-attention | dark | `a986f9e6f2b88da67562a2108429302561673b8669fd8a52c66ec7bd2e6ecee4` | 20.6217 | relations 1, empty 1, 107 px | `BEZ ZMIANY RUNTIME — POTWIERDZONE` |

Harness zwrócił exit 1: `finance-hub` i `results-vnext-registry-shell`
pozostawiły zwinięte filtry/menu. Jedynie `results-vnext-attention` miał status
`OK`. Wszystkie trzy pary przeszły kontrolę markera wyniku 3/3. Exit 1 nie jest
raportowany jako PASS.

## Brakujące wejścia — brief

- `audyt-findings`: istniejący ekran `day220-audyty-rejestr&view=findings`
  montuje realny `AuditFindingsTab`, ale komponent inicjuje `programId` z
  `programs[0]` i nie czyta wyboru z URL. Bez zmiany istniejącego wpisu albo
  dodania nowego wrappera z inną kolejnością programów nie da się wskazać
  `prog-metalpol-zakupy`. Brief: dodać nowy ekran w `dev-render/screens/`, który
  reużywa te same mocki i montuje realny komponent z programem Metalpol jako
  pierwszym; zarejestrować wyłącznie nowy identyfikator w `SCREENS`.
- `CasesListScreen`: wymaga routera oraz stanowych odpowiedzi dla
  `/api/v8/case-workspace/cases`, szczegółu, intake i komend lifecycle. Brief:
  nowy ekran ma montować realny `CasesListScreen` w `MemoryRouter` i przechwycić
  dokładnie te wywołania, z co najmniej jednym rekordem otwierającym preview.
- `RealizacjaView`: wymaga kompletnego `CaseCoreView`, runs, waits, proposals,
  node-result acceptances i handlerów komend. Brief: stanowy mock API plus realny
  `RealizacjaView`, z osobnymi wejściami dla wiersza oczekiwania i propozycji.
- `RezultatyView`: wymaga `CaseCoreView`, pomiarów, artifact links, node results,
  resolution API oraz callbacków nawigacji. Brief: stanowy mock API plus realny
  `RezultatyView`, z wejściami dla pomiaru, linku i node result.

Commit `a38110231b` mimo nazwy „wejście harnessu dla CaseWorkspace” zmienił
wyłącznie raport dyżuru 352 (1 plik, 8 dopisanych linii), więc nie jest dowodem
wejścia runtime. Dla czterech pozycji powyżej werdykt: `BRAK WEJŚCIA — BRIEF`.

Nie dodano czwartej opcji do `grafika-zrzuty.mjs`, nie zmieniono istniejących
wpisów harnessu i nie zaliczono identycznej pary jako różnego obrazu.
