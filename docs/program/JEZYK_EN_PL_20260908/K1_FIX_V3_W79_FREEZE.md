# K1-fix v3 — W79 freeze

**Werdykt: READY FOR CTO REVIEW.** Pakiet odtwarza zawartość K1-fix v2 na bazie `c458374bfad3`, usuwa residualny false positive DeckBuilder i nie dodaje nowych czerwonych nazw testów.

- baza: `c458374bfad320e0c987c4f13fa299a0d261143d`
- branch: `codex/a-k1-fix-v3-20260915`
- content SHA przed freeze: `28f47c3bbd`
- migracje / kod produktu / serwer / zależności: `0 / 0 / 0 / 0`

## Pełna lista importerów delty

Lista została wyprowadzona przez wąskie `rg -l` dla nazw wszystkich zmienionych plików pomiarowych (`pomiar-jezyka`, `polskiBezOgonkowWspolny`, `baseline.json`, `MAPA_JEZYKA`, `K1_FIX_W77_JMALE_SAMPLE`) w `src tests scripts`. Obejmuje:

- cztery testy miernika: `jezykJmaleModuly`, `pomiar-jezyka.e2f-bis`, `pomiar-jezyka.klasyfikacja`, `pomiar-jezyka.warstwy`;
- pełne `jezyk*.source.test.ts`: Admin, Audits, Tools, Execution, Finance, Initiatives, Interview, Meeting, My Work, Organization, Partner, Materials, Results, Assessment, Billing, Settings, Chat i Shared;
- bezpośrednie importery dodatkowe: `polskiBezOgonkowWspolny.test.ts`, `i18nTrescPolska.test.ts`, `TaskDetailView.assigneeOwnerPayload.test.tsx`, `checkMockLifecycle.test.mjs`.

Porównanie tych samych testów istniejących na obu drzewach:

- czysta baza: `1 failed / 22 passed` pliki, `1 failed / 96 passed` testy; jedyna czerwona nazwa to `jezykMaterialow.source > nie ma polskich napisów poza t()` z fragmentem DeckBuilder `) : autosaveError ? (`;
- kandydat: `25/25` plików i `372/372` testów GREEN; nowe testy miernika i helpera są wliczone;
- regresje po prostym odtworzeniu v2: dokładnie `7` czerwonych testów w `5` modułach jak w W79. Po klasyfikacji i ratchetowaniu: `0` czerwonych nazw.

## Klasyfikacja 12 unikalnych trafień

False positives (`2`):

- DeckBuilder `) : autosaveError ? (` — fragment operatora warunkowego przecięty przez regex JSX; `wartoscTechniczna()` oraz współdzielony helper odrzucają go teraz przy braku polskich liter;
- My Work `Sa` — angielski skrót soboty w sekwencji `Mo..Su`, nie polskie „są".

Rzeczywisty dług do E2b-3 (`10` unikalnych napisów; `Element bez nazwy` występuje trzy razy):

1. Materials: `Od czystego`.
2. Tools: `Motyw / branding organizacji (D19 — osobno od szablonu)`.
3. Tools: `Brand Kit organizacji — osobno od struktury (D19).`.
4. Finance: `Import (.xlsx) — transakcyjny, wszystko-albo-nic`.
5. Finance: `Stopa wolna od ryzyka (%)`.
6. Finance: `Bez limitu`.
7. My Work: `Element bez nazwy` (3 miejsca w `IdeaElementInspector.tsx`).
8. My Work: `Bez grupowania`.
9. Partner: `w tym kwartale`.
10. Partner: `Oczekuje na zatwierdzenie`.

Każdy realny przypadek jest przypięty dokładną ścieżką i tekstem w teście modułowym. Nowy przypadek powoduje RED; progi globalne nie zostały podniesione.

## Bramki

- `npm run check:jezyk:ci`: GREEN, nic nie wzrosło.
- `check:list-canon --all`: GREEN, `349 = baseline`.
- `git diff --check c458374bfad3..HEAD`: GREEN.
- TypeScript 5.8.3, wspólny symlink `node_modules`:
  - server, ta sama maszyna: baza `22`, kandydat `22`, delta `0`;
  - front kandydat: `TIMEOUT_120`; historyczny fingerprint CTO z W79: front `194`, server `27`. Pomiar nie daje podstaw do twierdzenia o poprawie frontu; delta produktu jest zerowa.

Nie wykonano deployu, migracji ani pushu na gałąź chronioną.
