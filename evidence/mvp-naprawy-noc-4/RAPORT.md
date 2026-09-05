# Fala 4 (mvp/naprawy-noc-4) — rodzina uciętego nagłówka "ZAKTUALIZOWANO"/"Aktualizacja"

Gałąź: `mvp/naprawy-noc-4` (worktree `/private/tmp/wt-fix4`, bazowana na
`codex/m03-admin-20260824` + zmergowany fix-commit fali 3 `0b2e18bb7f`
bezpośrednio, bo branch `mvp/naprawy-noc-3` został w międzyczasie skasowany
przez równoległy proces sprzątający po scaleniu). Commit naprawy: `0d2892ef30`.

## Kontekst

Fala 3 naprawiła WYŁĄCZNIE `AuditLibraryTab.tsx` (kolumna "Zaktualizowano"
ucięta do "ZAKTU" na 1440px) i we własnym opisie commita wprost napisała:
„AssessmentHub/FinanceHub/DiscoveryToolsHub mają ten sam wzorzec (width:'120px'
dla »Zaktualizowano«/»Aktualizacja«) — osobny dyżur, poza zakresem tego
zlecenia". Ta fala domyka TĘ rodzinę — i, zgodnie z zasadą „naprawa po jednej
powierzchni odrasta", rozszerza pomiar na WSZYSTKIE wystąpienia
`id: 'updatedAt'` znalezione grep-em w `src/`, nie tylko na 3 wymienione huby.

## PRZED / PO — pomiar rzeczywisty (13 plików, 14 kolumn)

| Plik | Kolumna(y) | PRZED | PO |
|---|---|---|---|
| `Discovery/DiscoveryToolsHub.tsx` | `updatedAt` ×4 (discovery/sessions/initiatives/outputs) | `width:'120px'`, brak `dataType` | `width:'200px'` + `dataType:'date'` |
| `assessment/AssessmentHub.tsx` | `updatedCol` (zakładki "list"+"reports", "reports" ma dokładnie ten sam 14-znakowy label "Zaktualizowano" co Audyty) | `width:'120px'` | `width:'200px'` + `dataType:'date'` |
| `Economics/FinanceHub.tsx` | `baseUpdatedCol` | `width:'120px'` | `width:'200px'` + `dataType:'date'` |
| `ResultsVNext/roi/roiCaseFullToolPresenters.tsx` | `updatedAt` ×2 | `width:'130px'` | `width:'200px'` + `dataType:'date'` |
| `ResultsVNext/roi/roiCaseDetailPresenters.tsx` | `updatedAt` ×4 | `width:'130px'` | `width:'200px'` + `dataType:'date'` |
| `ResultsVNext/roi/roiRegistryPresenters.tsx` | `updatedAt` | `width:'130px'` | `width:'200px'` + `dataType:'date'` |
| `ResultsVNext/okr/okrObjectivePresenters.tsx` | `updatedAt` | `width:'130px'` | `width:'200px'` + `dataType:'date'` |
| `ResultsVNext/okr/okrKeyResultPresenters.tsx` | `updatedAt` | `width:'130px'` | `width:'200px'` + `dataType:'date'` |
| `ResultsVNext/okr/okrRegistryPresenters.tsx` | `updatedAt` | `width:'130px'` | `width:'200px'` + `dataType:'date'` |
| `Audit/method/tabs/AuditReportsTab.tsx` | `updatedAt` | `width:'140px'` | `width:'200px'` + `dataType:'date'` |
| `Audit/method/tabs/AuditReportsTab.tsx` | `publishedAt` ("Data publikacji" — **dodatkowy defekt, znaleziony live screenshotem**, ten sam mechanizm) | `width:'150px'`, ucięte do "DATA PUBLIKA" na żywo | `width:'180px'` + `dataType:'date'` |
| `Audit/method/tabs/AuditProcessesTab.tsx` | `updatedAt` | `width:'140px'` | `width:'200px'` + `dataType:'date'` |
| `Audit/method/tabs/AuditInitiativesTab.tsx` | `updatedAt` | `width:'140px'` | `width:'200px'` + `dataType:'date'` |
| `assessment/manage/ReportsManagementPanel.tsx` | `updatedAt` | `width:'110px'` | `width:'200px'` + `dataType:'date'` |

Sąsiednie kolumny statusowe/kategoryczne (`framework`/`toolType`/`category`/
`status`/`reportKind`/`version`/`language`/`audience`/`confidentiality`) i
liczbowe/`owner` (`progress`/`overallScore`/`confidenceAvg`/`createdBy`)
dostały odpowiedni `dataType` (`status`/`number`/`owner`) tym samym wzorcem
co `0b2e18bb7f` — obniża to ich podłogę w `COLUMN_MIN_WIDTH_BY_DATA_TYPE`, żeby
algorytm dopasowania `FilterableTable` kurczył WŁAŚCIWE kolumny zamiast
kolumny daty. **Zero zmian w `FilterableTable.tsx`** (zakaz z instrukcji —
mechanika P2 z fali 1 użyta, nie ruszona).

## Weryfikacja NA ŻYWO (nie tylko w kodzie)

Własny vite `:3096` (`VITE_API_TARGET=http://127.0.0.1:4100`, wspólny backend
NOC), sesja skopiowana z `/private/tmp/stanowisko-noc/auth.json` →
`auth-fix4.json`, skrypt pomiarowy `scripts/dev/pomiar-naglowkow-fix4.mjs`
(standalone, NIE modyfikuje wspólnego `zrzut.mjs`) — zrzut 1440px + pomiar
`document.querySelectorAll('th')` (tekst, `scrollWidth`/`clientWidth`).

Potwierdzone zrzutem i oglądem (`evidence/mvp-naprawy-noc-4/*.png` +
`.png.json`), nagłówek "ZAKTUALIZOWANO"/"AKTUALIZACJA"/"DATA PUBLIKACJI" w
całości, bez ucięcia:

- `/discovery-tools?tab=sessions` — `discovery-sessions-po.png` ("AKTUALIZACJA" pełne, `scrollWidth==clientWidth`)
- `/assessment?tab=list` — `assessment-list-po.png` ("AKTUALIZACJA" pełne)
- `/assessment?tab=reports` — `assessment-reports-po.png` ("ZAKTUALIZOWANO" pełne — dokładnie ten sam string co Audyty)
- `/audit-programs?tab=library` — `audit-programs-po.png` (Biblioteka, pusty stan, nagłówek "ZAKTUALIZOWANO" pełne — powtórka dowodu fali 3)
- `/audit-programs?tab=reports` — `audit-reports-po2.png` ("ZAKTUALIZOWANO" i "DATA PUBLIKACJI" pełne, PRZED w `audit-reports-po.png` pokazuje ucięte "DATA PUBLIKA")
- `/audit-programs?tab=processes` — `audit-processes-po.png`
- `/audit-programs?tab=initiatives` — `audit-initiatives-po.png`

**Pułapka pomiaru** (do wiadomości, nie defekt): `scrollWidth`/`clientWidth`
mierzone tym skryptem miały STAŁY artefakt +6px na WSZYSTKICH nagłówkach bez
`dataType:'date'` (widoczne nawet na krótkich etykietach typu "AUTOR"/"TAGI",
które na zrzucie wizualnie NIE są ucięte) — to narzut techniczny (prawdopodobnie
ikona sortowania/obramowanie w modelu pudełkowym), nie prawdziwe ucięcie.
Kolumny z `dataType:'date'` konsekwentnie wychodzą na `scrollWidth==clientWidth`
(idealne dopasowanie). Rozstrzygający dowód to WŁASNE OKO na zrzucie, zgodnie
z kanonem projektu — nie surowa liczba z heurystyki.

**Niezweryfikowane na żywo** (naprawione na poziomie źródła tym samym wzorcem,
ale brak zrzutu):
- `/finance` — konto NOC (`audyt@dbr77.local`) nie ma podłączonego źródła
  danych finansowych („Źródło danych finansowych wymaga uwagi"), tabela w
  ogóle się nie renderuje (0 `<th>`) — nie z powodu tej naprawy.
- Zagnieżdżone tabele ROI Case / OKR Objective-KeyResult / `ReportsManagementPanel`
  — wymagają konkretnych ID rekordów (case/objective) niedostępnych z samego
  URL-a listy; nie odnalezione w czasie tego dyżuru.
- `/results/kpi`, `/results/roi`, `/results/okr` — TOP-LEVEL rejestry tych
  tras renderują się przez INNE, już poprawne pliki prezenterów
  (`roiCardRegistryPresenters.tsx`, i analogiczny dla OKR z kolumną „Ostatni
  check-in"), które NIE mają kolumny `updatedAt` w ogóle — brak defektu na
  tych trasach, potwierdzone zrzutem (`results-kpi-po.png`, `results-roi-po.png`,
  `results-okr-po.png`). Poprawione pliki `roi*`/`okr*Presenters.tsx` obsługują
  głębsze podekrany (poszczególne case'y/objective'y), stąd brak w top-level.

## Test / mutacja

`tests/unit/ui/naglowkiKolumnFala4.test.ts` — 14 przypadków (13 plików, licząc
`AuditReportsTab.tsx` dwa razy dla `updatedAt`+`publishedAt`), źródłowy
strażnik regresji (jsdom nie uruchomi pomiaru canvas z `FilterableTable` —
patrz komentarz w teście i w oryginalnym
`tests/components/Audit/AuditLibraryTab.updatedAtColumnWidth.test.ts`).
Filtruje bloki bez `width:` (property-list w podglądzie, nie kolumna tabeli).

Mutacja zweryfikowana ręcznie: cofnięcie `FinanceHub.tsx` `updatedAt` do
`width:'120px'` bez `dataType` → test pada
(`expected 120 to be greater than or equal to 180`); naprawę przywrócono i
retest zielony.

## Bramki

- `npx esbuild` (bez bundlowania) na wszystkich 13 dotkniętych plików — OK.
- `npx vitest run tests/unit/ui/naglowkiKolumnFala4.test.ts tests/components/Audit/AuditLibraryTab.updatedAtColumnWidth.test.ts` — 17/17 OK.
- `bash scripts/check-list-canon.sh` — brak nowych naruszeń (dług spadł o 3).
- `bash scripts/check-artefakt.sh` — brak nowych naruszeń crimson.
- Commit-msg hook `mvp-final`: `[ODMROZENIE 03_TOOLS DEC-397] [ODMROZENIE 04_ASSESSMENT DEC-397] [ODMROZENIE 12_AUDITS DEC-397]` — przeszedł świadomie (moduły 09_RESULTS/10_FINANCE nie są jeszcze zamrożone, hook ich nie zażądał).

## Dodatkowe znalezisko (naprawione przy okazji)

`AuditReportsTab.tsx` kolumna "Data publikacji" (`publishedAt`, `width:'150px'`,
brak `dataType`) — ujawniona live-screenshotem jako naprawdę ucięta do
"DATA PUBLIKA" (nie artefakt pomiaru — widoczne wizualnie na zrzucie PRZED).
Ten sam plik, ten sam mechanizm, naprawione w tym samym commicie.

## Nie zrobione / do rozliczenia

- Brak zrzutu na żywo dla `/finance` (brak seeda źródła danych na stanowisku NOC).
- Brak zrzutu na żywo dla zagnieżdżonych tabel ROI Case / OKR Objective /
  ReportsManagementPanel (potrzebne ID rekordów).
- Znaleziona przy pomiarze (ale POZA rodziną "Zaktualizowano" — inne etykiety,
  np. "NARZĘDZIE"/"KATEGORIA"/"TAGI"/"LICENCJA" w zakładce Biblioteka Narzędzi)
  seria false-positive z heurystyki pomiarowej — sprawdzona wizualnie, NIE jest
  defektem, nie wymaga akcji.
