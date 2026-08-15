# Consultify - check-point czyszczenia i rekonsyliacji
## Data
- 2026-08-15
- cel operacyjny: jeden zintegrowany, zabezpieczony canonical, audyt wszystkich modułów przed weekendowym startem

## 0) Stan wejścia
 - aktywny HEAD: `635fd2d48d`
 - gałąź robocza: `codex/sync-demo-20260729`
- liczba wpisów `git status --short`: 364 (aktualnie aktywny roboczy kanał zawiera zmiany wielu obszarów)
- liczba plików tracked (M/D/A): 175
- liczba plików untracked: 189

## 1) Freeze / bezpieczeństwo
### Akcje wykonane / zachowane
- Wykonano pełną inwentaryzację worktree/refs i w razie potrzeby wykonano archiwum zachowania: `/Users/piotrwisniewski/Developer/consultify-cleanup-evidence-20260814`
- manifesty SHA256: `PRESERVATION_MANIFEST_SHA256.txt`, `SHA256SUMS.txt`
- rejestry worktree i refs: `worktrees.tsv`, `worktrees.all.tsv`, `worktrees.unique.tsv`, `refs-*.tsv`
- rejestry WIP do odzyskania: `dirty-analysis.tsv`, `wip-preservation-index.tsv`, `wip-measurements.tsv`
- brak integracyjnych zmian produktowych w tym kroku (kontynuacja dokumentacyjna)

## 2) Test-gate standard (pełny przebieg)
- Runner: `f6a00552802d3a5d0f2bbd2c72316c05b55b8f82`
- scope: 4052 plików
- testy: 39 884 (PASS 38 798 / FAIL 581 / PENDING 485 / TODO 19)
- missing/duplicate: 0
- performance-leak test wyjęty jako gate `performance` PENDING (nie domyka green)

## 3) Aktualna mapa modułów z rekonsyliacji
### Wynikowy stan z ostatniego pełnego auditu modułowego
- `routing/my-work` i chat/infrastruktura: **LIVE_CONNECTED** (w kodzie, brak końca runtime+grafika)
- `Agent` (AgentHubShell / Transformation Cases): **PARTIAL + DUPLICATE**, konflikt tożsamości i zduplikowane ścieżki, wymagany decyzyjny bridge
- `Case Workspace`: **IMPLEMENTED_UNMOUNTED + DUPLICATE semantic conflict** (feature-flag route, konflikt z Agent)
- `Execution` / `Initiatives` / `Initiatives + AI`: **LIVE_CONNECTED core**; część zaawansowana PARTIAL
- `Results` VNext: **IMPLEMENTED_UNMOUNTED by default / PARTIAL**
- `Finance`: **PARTIAL + DUPLICATE generations**
- `Materials/Artifacts`: base live, legacy warstwy częściowo zdemontowane (PARTIAL)
- `Audits`: **PARTIAL** (częściowo produkcyjna, część jako showcase)
- `Docs/Artifacts`: pełna dokumentacja istnieje, ale brakuje pełnego runtime/dowodowego domknięcia dla niektórych ścieżek

## 4) Klasyfikacja źródeł do zachowania (priorytet)
1. **Wartość z `consultify-cleanup-evidence-20260814`** — traktować jako immutable evidence layer (backup/recovery)
2. Ścieżki WIP z wysoką unikalnością: `/Users/piotrwisniewski/Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify` (worktree główny)
3. Kanał `consultify-canonical-full-20260814` jako wzorzec referencyjny (clean candidate SHA `0be009202`, branch `codex/consultify-canonical-cleanup-20260814`)

## 5) Natychmiastowe ryzyka (blokery planu)
- W repo nadal obecne są nieprzyporządkowane artefakty i aktywność robocza (189 untracked) oraz 175 zmienionych plików tracked; bez klasyfikacji nie można uznać drzewa za „jeden canonical sha”.
- 581 failów testowych, 485 pending, 19 TODO i 283 non-green files na pełnym standard run. To są twarde bloker, nie kosmetyka.
- `tests/performance/memory-leak.test.ts` został wyodrębniony jako gate `performance` (PENDING), czyli jawny, świadomy wyłączenie z main.
- duże ryzyko spójności pozostaje głównie w obszarach `PARTIAL` i duplikatach legacy-vs-v8.

## 6) Decyzje „startowe” na kolejną turę (bez rozszerzania zakresu)
- **Nie wykonywać nowych zmian produktowych** do czasu zamknięcia inwentaryzacji źródeł i przypisania statusu każdemu worktree/commitowi.
- Ustalić pojedynczy `Canonical-SHA` do odbioru modułowego (lub potwierdzić `0be009202` jako punkt startowy), następnie przenosić jedynie przez modułowe commity.
- Zamknąć pipeline clean-up na: `Freeze -> Inventory -> Preserve -> Rebuild -> Module closure -> Remove dead residuals`.
