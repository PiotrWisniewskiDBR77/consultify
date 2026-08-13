# FIXC — niezależna weryfikacja (gate-e)

Weryfikator: sesja niezależna od autora FIX-C, ten sam worktree
(`/Users/piotrwisniewski/consultify-wt/fv3p-d-statements`), gałąź `codex/fv3p-fixc-layout` @
`45fbf9c808`, baza `57fe0543cc`. Nie jestem autorem tego pakietu.

Środowisko: równolegle w innych worktree trwały weryfikacje FIX-A (`fv3p-e-analysis`) i FIX-B
(`fv3p-h-valuation`) — potwierdzone `ps aux` (osobne procesy `tsc`/`npm run type-check` w tamtych
katalogach). Nie dotykałem `server/**`, nie używałem `git reset`/`clean`/`stash`/`merge`/`rebase`/`push`.
Wszystkie cofnięcia plików wykonane wyłącznie przez `git show <sha>:<plik> > <plik>`, z potwierdzeniem
pustego `git diff --stat` po każdym przywróceniu.

## Wynik zbiorczy: **PASS**

Wszystkie siedem głównych twierdzeń autora POTWIERDZONE własnym, niezależnym pomiarem. Jeden
NOWY, nie zgłoszony wcześniej defekt znaleziony przy okazji weryfikacji punktu 1(c) (opisany
niżej) — pre-istniejący, poza mandatem FIX-C, nie blokuje tego pakietu, ale wymaga osobnego
zgłoszenia.

## Tabela twierdzeń

| # | Twierdzenie autora | Mój niezależny pomiar | Werdykt |
|---|---|---|---|
| 1a | `SourceStep.tsx` czytał wyłącznie `lineage.ancestors[0]`; `getAncestors()` to rekurencyjna CTE zwracająca cały łańcuch | Przeczytałem `server/src/services/finance/canonical/lineageService.ts:238-262` — `WITH RECURSIVE ancestors ... SELECT DISTINCT ... FROM ancestors`, bez `LIMIT`, `maxDepth=50`. Przeczytałem diff `SourceStep.tsx`: przed `const sourceEdge = lineage?.ancestors[0] ?? null;` i render tylko `sourceEdge`; po — `sourceEdges = [...lineage.ancestors].sort(...)`, `.map()` po wszystkich krawędziach | **POTWIERDZONE** |
| 1b | Defekt utraty danych, wymaga testu regresji | Napisałem własny plik `tests/components/Finance/SourceStep.fixc-lineage-chain.verify.test.tsx` (2 testy, nieznane autorowi wcześniej) z 3-elementowym łańcuchem lineage. PASS na obecnym (naprawionym) komponencie. Kontrola mutantem: cofnąłem `SourceStep.tsx` do `57fe0543cc` (`git show 57fe0543cc:... > ...`) → oba testy **CZERWONE** (component renderuje tylko 1 kartę zamiast 3, `getByTestId('source-edge-only-edge')` nie istnieje). Przywróciłem plik z `45fbf9c808`, `git diff --stat` puste. Ponowny PASS. Commit `e05282a736` | **POTWIERDZONE + własny test regresji działa** |
| 1c | Wzorzec `ancestors[0]` mógł występować gdzie indziej w Finance | `grep -rn "ancestors\[0\]" src` → **znaleziono jeszcze jedno wystąpienie**: `src/components/Finance/Valuation/ValuationWorkspace.tsx:291` — `contextValues={{ ..., source: lineage?.ancestors[0]?.sourceVersionId ?? 'nie połączono' }}` w pasku roboczym (workspace bar). Ponieważ `getAncestors()` nie ma `ORDER BY`, `ancestors[0]` jest tu ARBITRALNY (SQL `SELECT DISTINCT` nie gwarantuje kolejności) — pasek może pokazać dowolną wersję z łańcucha jako "source", nie koniecznie bezpośrednie źródło. To NIE jest naprawione przez FIX-C (plik nie jest w `git diff --stat` tej gałęzi) i jest to dokładnie ten sam wzorzec błędu | **POTWIERDZONE (wzorzec występuje ponownie) — patrz „Nowy defekt" niżej** |
| 2 | Martwa przestrzeń PO: Wycena/Źródło 6,7%/18,1% (1280/1440); Prediction 0%/0%; Analysis 0%/17,7% | Własny skrypt (nie kopia `fixc-deadspace-measure.mjs`, napisany od zera, `verify-deadspace.mjs`, Playwright, świeży `browser.newContext()` per pomiar, unia bboxów liści DOM), własny serwer vite na porcie 58411 z TEGO worktree. Wyniki na aktualnym (naprawionym) kodzie: Prediction 137,5%/121,4% treści (=0% dead space, przewija się) · Analysis 105,1% (=0%) / 82,3% (17,7% dead space) · Valuation-source 93,3% (6,7% dead space) / 81,9% (18,1% dead space) | **POTWIERDZONE — liczby identyczne co do dziesiętnej** |
| 2 | Martwa przestrzeń PRZED: Wycena/Źródło 78,1%/83,0%; Prediction 48,0%/54,1%; Analysis 47,5%/58,9% | Cofnąłem 6 plików (3 produkcyjne + 3 harness) do `57fe0543cc`, zrestartowałem serwer, zmierzyłem tym samym własnym skryptem: Prediction 48%/54,1% · Analysis 47,5%/58,9% · Valuation-source 78,1%/83% | **POTWIERDZONE — liczby identyczne co do dziesiętnej**. Przywrócono do stanu naprawionego, `git diff --stat` puste |
| 2 | Wszystkie trzy ekrany ≤25% PO naprawie, oba viewporty | Z moich pomiarów: max dead space PO to 18,1% (Valuation/Źródło @1440) — poniżej limitu 25% na wszystkich 6 kombinacjach ekran×viewport | **POTWIERDZONE** |
| 3 | Prediction/Analysis = objętość danych (nie układ); kody driverów z fixture'ów serwerowych; kody KPI z `analysisKpiCatalog.ts` | `grep -rn "REVENUE_GROWTH_YOY" server --include="*.ts" \| grep test` → obecny w `baseline.routes.pg.test.ts`, `tenantMatrix.pg.test.ts`, `predictionPreflightOrderDeterminism.test.ts` z `revenue_pvm`. `grep DIO_DAYS` → obecny w 5 plikach testowych serwera z `wc_dso_dio_dpo`. Przeczytałem `analysisKpiCatalog.ts:56-60`: `UNIVERSAL_RECOMMENDED_CODES` (4: REVENUE_GROWTH_YOY/GROSS_MARGIN_PCT/EBITDA_MARGIN_PCT/NET_MARGIN_PCT) + `INDUSTRY_ADDITIONAL_CODES.MANUFACTURING` (2: INVENTORY_DAYS/ASSET_TURNOVER) = dokładnie 6 kodów zadeklarowanych w produkcyjnym kodzie dla MANUFACTURING, dokładnie tyle ile harness teraz renderuje | **POTWIERDZONE — wzbogacenie uczciwe, nie naciągnięte**. Nie zweryfikowałem niezależnie liczby "47,3% przy 1440 po samym wzbogaceniu lineage bez zdjęcia `max-w-5xl`" (krok pośredni, nieodtworzony) — **NIE ZWERYFIKOWANE (nieistotne dla wyniku końcowego)** |
| 4 | Wyciek enuma w `FinancialStatementPackWorkspace.tsx` naprawiony przez REUŻYCIE istniejących kluczy `t('finance.pack.status{Ready,Recovery,Draft}')`, nie nowe stringi | `grep -n "finance.pack.status" ...` → te same 3 klucze użyte w DWÓCH miejscach pliku: linia ~740 (`packRow.status`, oryginalne) i ~1362 (`file.status`, nowe) — identyczne stringi kluczy i fallbacków | **POTWIERDZONE — reużycie, nie nowa implementacja** |
| 4 | Kontrola negatywna: cofnięcie pliku → skaner 1/5 czerwony z dokładnym komunikatem | Wykonałem WŁASNĄ kontrolę negatywną: `git show 57fe0543cc:...FinancialStatementPackWorkspace.tsx > ...`, `npx vitest run tests/unit/finance/rawEnumLeakScanner.test.ts` → **1 test czerwony**, identyczny komunikat `AssertionError: expected [ Array(1) ] to deeply equal [] ... "src/components/Finance/FinancialStatementPackWorkspace.tsx: {file.status}"`. Przywrócono plik z `45fbf9c808`, `git diff --stat` puste, ponowny PASS 5/5 | **POTWIERDZONE — własna kontrola negatywna reprodukuje dokładnie ten sam wynik** |
| 5 | `npx vitest run src/components/Finance --maxWorkers=2` → 62 pliki / 504 testy PASS | Uruchomiłem sam: **62 pliki, 504 testy, PASS, exit 0**, 69,68s (autor: ~37,0s — różnica czasu tłumaczona równoległym obciążeniem maszyny przez FIX-A/FIX-B w tej samej sesji, potwierdzone `ps aux`; liczba plików/testów identyczna) | **POTWIERDZONE** |
| 5 | `tsc -p . --noEmit`, `NODE_OPTIONS=--max-old-space-size=12288`, exit 0, 0 błędów, kod mierzony BEZ potoku | Uruchomiłem: `(NODE_OPTIONS=--max-old-space-size=12288 npx tsc -p . --noEmit > log 2>&1; echo $? > exitfile)` — **exit 0**, log **0 linii** (0 błędów), czas ~167s (autor: 151s — również w granicach różnicy wynikającej z równoległego obciążenia; PID/`ps` potwierdza proces trwał realnie, nie zakończył się przedwcześnie/OOM-em) | **POTWIERDZONE** |
| 6 | 24 zrzuty PRZED/PO w `visual/fixc/`, wzorzec nazw, brak crimsona, fokus niebieski, jednolity PL | `ls visual/fixc/` → dokładnie 24 pliki, wzorzec zgodny. Obejrzałem 8/24 (reprezentatywna próbka: oba viewporty, oba motywy, PRZED+PO, wszystkie 3 ekrany). Próbkowanie pikseli (Python/PIL) na kolorowanym tekście ("-100,0%" w Analysis, "NIEAKTUALNE" w Prediction) → kolory `(2,8,23)` (prawie czarny) i `(88,50,20)` (bursztyn/amber), ŻADEN nie odpowiada crimson `#85182F`≈`(133,24,47)`. CTA-i ("Przekaż do przeglądu", "Przelicz scenariusz", "Odśwież krok") — czarne/neutralne, nie crimson. Status w Analysis niesiony tekstem + liczbą, nie samym kolorem | **POTWIERDZONE (na obejrzanej próbce)**. Uwaga: zrzuty `PO-prediction-*` zostały zrobione na commicie `d10ab43cbf` (naprawa układu), PRZED commitem enum-fix `d5a5a18f1b` — nadal pokazują `status: DRAFT` surowo w banerze "honest scratch", zamiast `businessVersionStatusLabel()` → `"Wersja robocza"`. To NIE jest fałszywe twierdzenie autora (Zadanie 2 w jego raporcie nie deklaruje własnych zrzutów), ale zrzuty PO nie odzwierciedlają finalnego stanu kodu — czysto kosmetyczna luka w dowodzie wizualnym |
| 7 | Allowlista: `PredictionWorkspace.tsx` dotknięty poza pierwotnym mandatem (uzasadnienie: skaner go wskazał, plik był już w zakresie sesji) | `git diff --stat 57fe0543cc..45fbf9c808` — potwierdzone 34 pliki (33 + raport). `git diff --stat -- server/` → **puste** (zero). `git diff --stat -- 'src/components/Finance/shared/**' '**/EmptyStateInline*'` → **puste** (zero, zakres FIX-A nienaruszony) | **POTWIERDZONE, wyjście uzasadnione**: plik już należał do zakresu sesji (Prediction dead-space, Zadanie 1), drugi wyciek był realnie blokujący (skaner czerwony), naprawa użyła gotowej funkcji etykiety zamiast nowego kodu. Zero kolizji z `server/**` lub FIX-A |
| 8 | Brak osłabienia testów (`.skip`, `.only`, usunięte asercje, zmienione expected) | `git diff 57fe0543cc..45fbf9c808 \| grep -E "^\+.*\.(skip\|only)\("` → puste. `git diff ... \| grep -E "^-.*expect\("` → puste | **POTWIERDZONE — brak osłabienia** |

## Nowy defekt znaleziony przy weryfikacji (nie w mandacie FIX-C)

**`src/components/Finance/Valuation/ValuationWorkspace.tsx:291`**

```tsx
contextValues={{ type: 'Wycena przedsiębiorstwa', source: lineage?.ancestors[0]?.sourceVersionId ?? 'nie połączono' }}
```

Ten sam wzorzec co pierwotny defekt w `SourceStep.tsx` (odczyt niesortowanej tablicy `ancestors`
pod indeksem `[0]`), ale w innym miejscu — pasek roboczy (workspace bar) wyświetla pole "source"
w oparciu o dowolny, nie posortowany element łańcucha pochodzenia (`getAncestors()` SQL nie ma
`ORDER BY`). Ryzyko: pasek może pokazać jako "source" NIE bezpośrednie źródło (np. Statement Pack
zamiast Scenariusza), w zależności od kolejności zwracanej przez `SELECT DISTINCT`. Nie jest to
regresja wprowadzona przez FIX-C — istniała już w bazie `57fe0543cc` i nie została dotknięta przez
tę gałąź (poza mandatem: mandat dotyczył wyłącznie kroku Źródło, nie całego `ValuationWorkspace.tsx`).
Nie blokuje odbioru FIX-C. Rekomendacja: osobne zgłoszenie/naprawa analogiczna do `SourceStep.tsx`
(np. sortowanie po `createdAt` i wybór najnowszego/bezpośredniego ogniwa zamiast `[0]`).

## Środowisko wykonania weryfikacji

- Serwer harness: `npx vite --config dev-render/vite.config.ts --port 58411` uruchomiony ręcznie z
  tego worktree (port odrębny od portów używanych przez FIX-A/FIX-B), restartowany po każdym
  cofnięciu plików (Vite nie HMR-uje niezawodnie przy podmianie plików przez `git show > plik`).
- Pomiar dead-space: własny skrypt
  `/private/tmp/.../scratchpad/verify-deadspace.mjs` (Playwright, nie kopia skryptu autora).
- Test regresji lineage: `tests/components/Finance/SourceStep.fixc-lineage-chain.verify.test.tsx`
  (nowy plik, commit `e05282a736`).
- Wszystkie cofnięcia/przywrócenia plików robione `git show <sha>:<plik> > <plik>`, każdorazowo
  potwierdzone pustym `git diff --stat` po przywróceniu. Zero `git reset`/`clean`/`stash`.
- `tsc`/`vitest` mierzone bez potoku (`cmd > plik 2>&1; code=$?`), zgodnie z wymogiem.

## Werdykt końcowy

**PASS.** Wszystkie kluczowe twierdzenia FIX-C (defekt lineage, pomiary martwej przestrzeni,
klasyfikacja przyczyn, naprawa wycieku enuma z kontrolą negatywną, brak naruszeń allowlisty/testów)
zweryfikowane niezależnie i potwierdzone z dokładnością do dziesiętnej części procenta tam, gdzie
dotyczyło to liczb. Jeden nowy, pre-istniejący defekt (ten sam wzorzec `ancestors[0]`) znaleziony w
`ValuationWorkspace.tsx` — poza mandatem tej gałęzi, nie blokuje przyjęcia FIX-C, wymaga osobnego
zgłoszenia.
