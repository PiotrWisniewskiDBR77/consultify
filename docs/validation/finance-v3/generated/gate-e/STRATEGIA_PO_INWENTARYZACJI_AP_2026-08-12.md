# Finance v3 — przestawienie priorytetów po inwentaryzacji warstwy AP (2026-08-12)

Autor: OPUS (orkiestrator). Podstawa: `PKG_AP_LAYER_INVENTORY_2026-08-12.md`, pomiar read-only
na `codex/finance-v3-complete-product-integration` @ `49071c3e2d`.

---

## 1. USTALENIE, KTÓRE ZMIENIA KOLEJNOŚĆ PRAC

Z trzynastu zdolności warstwy „profesjonalny analityk" **zero jest podłączonych produkcyjnie**.
Ale rozkład braków jest zupełnie inny, niż zakładał plan:

| Stan | Liczba | Znaczenie |
|---|---|---|
| `PODLACZONE` | **0** | — |
| `KONTRAKT_BEZ_UI` / `UI_BEZ_PODLACZENIA` | **11** | kod istnieje, przetestowany, **brakuje wyłącznie podłączenia** |
| `BRAK` | **1** | „Why this number?" na poziomie komórki — jedyna realna luka projektowa |

**Wniosek: to w przeważającej mierze problem PODŁĄCZENIA, nie problem budowy.**
Program był planowany tak, jakby warstwę AP trzeba było napisać. Ona w większości **jest napisana**.

---

## 2. NAJWIĘKSZA DŹWIGNIA W CAŁYM PROGRAMIE

`FinanceWorkspaceBar`, hook trybu focus i `FinanceErrorBoundary` to **gotowe, przetestowane
komponenty Reacta**. Montuje je wyłącznie harness `dev-render/` i własne testy.
**Żaden z pięciu produkcyjnych workspace'ów Finance ich nie importuje.**

Konsekwencja policzona wprost na rejestrze właścicielskim:

> **12 z 22 wymagań właścicielskich** (`OWN-FIN-004, 005, 007, 011, 012, 013, 016, 017, 019, 020,
> 021, 022`) to **dokładnie mandat warstwy AP-09/10/11** — plus częściowo `002`, `003`, `014`, `018`.
> Wszystkie są dziś **niezamontowane**.

Oznacza to, że **oryginalne zastrzeżenia właściciela z przeglądu 2026-08-09 są nadal odtwarzalne
na żywych ekranach**, mimo że kod, który je zamyka, leży w repozytorium gotowy.

To nie jest kwestia inżynierii, tylko importu komponentu w pięciu plikach i usunięcia
bespoke'owych nagłówków.

---

## 3. FLAGA, KTÓRA NICZEGO NIE STERUJE

`financeWorkspacePlatformV1` ma `defaultValue: false` **i zero miejsc odczytu w aplikacji**.
Nie jest to flaga-fantom w klasycznym rozumieniu (kod za nią **istnieje** i jest przetestowany),
ale **funkcjonalnie zachowuje się jak fantom** — dziś nie steruje niczym żywym.

Rozróżnienie warte utrzymania w raportach: *„flaga bez implementacji"* to co innego niż
*„implementacja bez odczytu flagi"*. Druga sytuacja jest tańsza do naprawy i właśnie ją mamy.

---

## 4. MARTWY KOD BACKENDU — skala

Serwisy w pełni zaimplementowane, przetestowane i **bez ani jednej trasy HTTP**:

| Obszar | Pliki | Stan |
|---|---|---|
| `services/finance/grid/**` | 9 | zero wywołujących w całym repo |
| `services/finance/keyboard/**` | 6 | zero wywołujących |
| `services/finance/collaboration/**` | 6 | wzajemnie się wołają, na zewnątrz osierocone |
| `financeCompareService.ts` | 1 | zero tras, zero wywołujących |
| `commentService.ts` | 1 | ma **realne, zmigrowane tabele**, zero tras |
| `savedViewService.ts` | 1 | zero tras, zero wzmianek |
| `financeExportService` / `financeImportService` | 2 | zero tras |
| `workspace/lineageNavigatorContract.ts` | 1 (~1480 linii) | zero tras; istniejąca trasa lineage **omija go** i oddaje surowe krawędzie |

---

## 5. PRZESTAWIONA KOLEJNOŚĆ — od najtańszego do najdroższego

1. **Montaż istniejącej powłoki** (`FinanceWorkspaceBar` + focus + ErrorBoundary) w pięciu
   workspace'ach. Zamyka ~10 wymagań właścicielskich naraz. **Wykonać PO fan-inie fali 1** —
   dziś pakiety D/E/F/G/H równolegle budują te właśnie workspace'y i montaż wywołałby konflikt.
2. **Warstwa tras dla gotowych serwisów** (compare, comments, saved views, export/import,
   grid, keyboard, lineage navigator). Wzorzec znany i przećwiczony w pakietach B/B2/B3.
   **Można wykonać równolegle** — to praca serwerowa, nie koliduje z frontendem D–H.
3. **Prezentacja lineage** — trasa dla `lineageNavigatorContract` + komponent breadcrumb.
   Zamyka `OWN-FIN-007` i `OWN-FIN-022`.
4. **Excel/CSV round-trip** — serwisy są, brakuje trasy i UI (kreator, podgląd różnic, mapping).
5. **Grid + keyboard + kolaboracja** — najgłębsza luka frontendowa. `FinanceDataGrid` **nie
   istnieje w ogóle** jako komponent Reacta, a jest domyślnym założeniem większości pozostałych
   zdolności (synchroniczny scroll w Compare, kotwice komentarzy na komórce, „Why this number?").
6. **„Why this number?" na poziomie komórki** — jedyna pozycja wymagająca zaprojektowania
   logiki od zera, nie tylko podłączenia.

---

## 6. OGRANICZENIA, KTÓRE OBOWIĄZUJĄ PRZY PUNKCIE 1

Montaż powłoki **nie jest** decyzją techniczną, którą zespół podejmuje sam:

- `CLAUDE.md` **#7** — Piotr nigdy nie jest pierwszym testerem wizualnym. Kolejność: render →
  zrzut → **przegląd orkiestratora** → dopiero potem oczy właściciela.
- `CLAUDE.md` **#9** — **zakaz masowego włączania flag**. Pięć workspace'ów wchodzi
  **pojedynczo**, każdy po osobnym akcepcie na czystym zrzucie. Nie „daj wszystko naraz".
- Do czasu akceptu: flaga **domyślnie OFF**, zero importerów produkcyjnych.

---

## 7. STATUS

`PARTIAL` — ustalenie zmienia kolejność prac, nie zamyka żadnego wymagania.
Żadne z 22 wymagań właścicielskich nie zmienia statusu na podstawie tego dokumentu.
