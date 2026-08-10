# APWAVE-00 — rozbicie `workspaceContracts.test.ts` na trzy pliki

**Data:** 2026-08-10
**Gałąź:** `codex/finance-v3-apwave-ap0-split` (odbita od zamrożonego `19b4b06934`)
**Charakter zmiany:** refaktoryzacja MECHANICZNA plików testowych. Zero zmian w kodzie
produkcyjnym, zero zmian w asercjach, progach, nazwach testów i danych testowych.

## 1. Po co

`server/src/services/finance/workspace/__tests__/workspaceContracts.test.ts` (1078 linii)
obsługiwał trzy niezależne obszary naraz (AP-09, AP-10, AP-11). Strumienie AP-09 i AP-11
mają iść równolegle — wspólny plik gwarantowałby konflikty scalania.

## 2. Co powstało

| Plik | Linie | Testy | Zakres |
| --- | ---: | ---: | --- |
| `__tests__/workspaceBarContract.test.ts` | 446 | **31** | AP-09: Workspace Bar (18) + Focus Mode (13) |
| `__tests__/moduleAdapters.test.ts` | 206 | **32** | AP-10: adaptery pięciu modułów |
| `__tests__/lineageNavigatorContract.test.ts` | 385 | **17** | AP-11: nawigator lineage |
| `__tests__/workspaceTestFixtures.ts` | 108 | — | wspólne fixtures (nie jest plikiem testowym) |
| ~~`__tests__/workspaceContracts.test.ts`~~ | ~~1078~~ | ~~80~~ | **usunięty** |

Wspólne fixtures wydzielone (były używane przez ≥2 pliki): `ORG`, `artifactRef()`,
`evaluationContext()`, `allGatesSatisfied()`, `configFor()`.
Fixtures wyłącznie AP-11 (`edge()`, `NODES`, `resolve`, `ANCESTOR_EDGES`) zostały
w `lineageNavigatorContract.test.ts`. Nic nie jest zduplikowane.

Nagłówkowy komentarz „WHY THERE IS NO DATABASE HERE" przeniesiony w całości do
`workspaceTestFixtures.ts`; każdy z trzech plików ma krótki nagłówek ze wskazaniem.

`workspaceTestFixtures.ts` NIE zostanie zebrany jako suite — `server/vitest.config.ts`
zbiera wyłącznie `src/**/*.{test,spec}.{ts,tsx}`. Potwierdzone realnym przebiegiem
(3 pliki, nie 4).

## 3. Dowód równoważności

### 3.1 Liczby

```
PRZED:  workspaceContracts.test.ts                       80 testów, 80 pass, 0 fail
PO:     lineageNavigatorContract.test.ts   17
        moduleAdapters.test.ts             32
        workspaceBarContract.test.ts       31
        ------------------------------------
        SUMA                               80 testów, 80 pass, 0 fail
```

Rozkład 31 / 32 / 17 zgadza się co do jednego z zakładanym (AP-09 18+13, AP-10 32, AP-11 17).

### 3.2 Zbiór nazw — `diff` pusty

Pełne nazwy (`describe > it`, po rozwinięciu `it.each`) wyciągnięte z reportera JSON
przed i po, posortowane, porównane:

```
$ diff before.names.txt after.names.txt
$ echo $?
0
```

Zero pozycji zniknęło, zero doszło, zero zmieniło nazwę, zero się zdublowało.

### 3.3 Kontrola twardsza niż nazwy — bloki `describe` bajt w bajt

Nazwy same w sobie nie dowodzą, że treść asercji się nie zmieniła. Dodatkowa kontrola:
wszystkie 18 bloków `describe(...)` wyparsowane z oryginału (`git show HEAD:…`) i z trzech
nowych plików, sparowane po pierwszej linii i porównane jako tekst:

```
original describe blocks: 18, new: 18, mismatches: 0
```

Bloki są **identyczne bajtowo**. Zmieniły się wyłącznie: nagłówek pliku, lista importów
i banery sekcji.

## 4. Typecheck

```
PRZED (19b4b06934):  npx tsc --noEmit -p server/tsconfig.json  → 0 błędów
PO  (ten commit):    npx tsc --noEmit -p server/tsconfig.json  → 0 błędów
```

Zero nowych błędów. Stan wyjściowy był czysty, więc i porównanie jest trywialne.

## 5. Czy coś importowało usuwany plik

`grep` po całym repo (bez `node_modules`) po ciągu `workspaceContracts`:

- **Kod: ZERO trafień.** `workspace/index.ts` nie eksportuje ani nie importuje testów.
- **Dokumentacja: 7 trafień**, wszystkie w historycznych raportach Gate-D
  (`AP-09_10_11_workspace_contracts_report.md`, `AP-09_layout_test_resolution_report.md`,
  `VALUATION_ADVISOR_GENERATOR_report.md`, `ROI_E007_FANIN_VERIFICATION_report.md`).
  To zapisy stanu z konkretnych SHA — **świadomie nietknięte** (poza allowlistą, i tak
  opisują przeszłość). Jedno trafienie to komenda repro, która od teraz nie zadziała:
  `AP-09_layout_test_resolution_report.md:23`.

## 6. Żywe sprzężenie z warstwą bazy (do odnotowania)

`lineageNavigatorContract.test.ts` robi **runtime** import:

```ts
import { stageRank } from '../../canonical/lineageService.js';
```

To celowa kontrola krzyżowa (test porównuje własną rangę etapu z prawdziwą, żeby obie nie
rozjechały się po cichu) — zachowana bez zmian. Skutek uboczny: wciąga
`PostgresDatabase.js` do grafu modułów. Połączenie NIE jest otwierane i testy nie
potrzebują bazy, ale import jest realny — trzeba o tym pamiętać przy zmianach efektów
ubocznych ładowania modułów. Po rozbiciu sprzężenie dotyczy **tylko pliku AP-11**;
AP-09 i AP-10 są od niego wolne (to uboczna korzyść rozbicia).

## 7. Zauważone, ŚWIADOMIE NIENAPRAWIONE

Zgodnie z zakresem (przenosimy kod, nie poprawiamy go):

1. **Martwa asercja** — `moduleAdapters`/`lineage` Related panel: `buildRelatedPanel({…})!`
   z operatorem `!`, a linijkę niżej `expect(panel).not.toBeNull()`. Asercja nic nie
   sprawdza — gdyby zwrócono `null`, wywaliłoby się wcześniej na dereferencji.
   (`lineageNavigatorContract.test.ts`, „separates direct parents…").
2. **Asercja `.every()` może przejść pusto** — „emits only visibility/focus/announce
   effects": `entered.effects.every(…)` na pustej tablicy zwraca `true`. Ratuje to dopiero
   następna asercja o liczbie `hide-region`, ale sama w sobie jest wydmuszką.
   (`workspaceBarContract.test.ts`, Focus Mode.)
3. **`calls.sort()` gubi kolejność wywołań** — test portu `loadLineageNavigator`
   sortuje zarejestrowane wywołania przed porównaniem, więc nie wykryje zmiany kolejności
   ani zrównoleglenia `getAncestors`/`getDescendants`. Prawdopodobnie celowe.
4. **Coverage** — `server/vitest.config.ts` wyklucza z pokrycia `**/*.test.ts`, ale nie
   `workspaceTestFixtures.ts`. Przy uruchomieniu z `--coverage` nowy plik fixtures liczy
   się jako źródło wobec progów 95%. W praktyce wszystkie jego funkcje są wołane przez
   testy, więc nie powinien zaniżyć progu — ale to nowa powierzchnia, której wcześniej
   nie było.

Żaden z powyższych punktów nie jest regresją tego rozbicia — wszystkie istniały
w oryginale.

## 8. Czego NIE ruszono

Zero zmian w: `workspaceBarContract.ts`, `focusModeContract.ts`, `moduleAdapters.ts`,
`lineageNavigatorContract.ts`, `index.ts`, migracjach, jakimkolwiek kodzie produkcyjnym.
Nic nie zostało wypchnięte.
