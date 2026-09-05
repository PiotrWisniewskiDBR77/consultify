# P7K Wyniki — KROK 1b: korekta prototypu po werdykcie

Data: 2026-09-05  
Gałąź: `codex/p7k-wyniki`  
Status: **STOP DO PONOWNEJ AKCEPTACJI NADZORCY. KROK 2 NIE ROZPOCZĘTY.**

## K1–K9

| Korekta | Stan | Jak | Dowód (plik) |
| --- | --- | --- | --- |
| K1 | zrobione | Menu 2 renderuje `StandardModuleBar` z ikonami, lupą i przełącznikiem; aktywny stan jest neutralny. Filtr OKR korzysta z neutralnego Menu 3. Akcent L3 występuje wyłącznie jako lewa kreska sekcji. | `dev-render/screens/p7k-wyniki-prototype.tsx`; wszystkie PNG |
| K2 | zrobione | KPI L2 ma I–XII 2026, okresy po 132 px, poziomy scroll, przypięty MIERNIK oraz YTD i STAN. Harness przewija tabelę do WRZ 2026. Liczby mają `whitespace-nowrap`. | `prototype/kpi-l2--light.png`, `prototype/kpi-l2--dark.png`, odpowiadające JSON |
| K3 | zrobione | Nagłówki otrzymały szerokości i układ maksymalnie dwuwierszowy; pomiar DOM nie wykrywa nagłówków kończących się „…”. | 16 plików `prototype/*.json` |
| K4 | zrobione | ROI L1 pokazuje dziewięć zatwierdzonych kolumn bez ucięcia; NPV i IRR są obecne w pstryczku kolumn jako domyślnie ukryte. | `prototype/roi-l1--light.png`, `prototype/roi-l1--dark.png` |
| K5 | zrobione | Stan krytyczny jest jednowierszowym pillem „Krytyczne” z ikoną karty działania, a pełny opis jest w `title`. | `prototype/kpi-l2--light.png`, `prototype/okr-l2--dark.png` |
| K6 | zrobione | Wiersze grup KPI/OKR są pojedynczą komórką `colSpan` z nazwą grupy i właścicielem nadrzędnym; pozostałe komórki wiersza są usunięte z układu, bez „—”. | `prototype/kpi-l2--light.png`, `prototype/okr-l2--dark.png` |
| K7 | zrobione | KPI L3 pokazuje siedem kolumn domyślnych; Główna przyczyna, Działania? i Komentarz są w pstryczku kolumn. Treść wiersza jest ograniczona do dwóch linii. | `prototype/kpi-l3--light.png`, `prototype/kpi-l3--dark.png` |
| K8 | zrobione | Prawy panel używa `ArtifactRightPanel`, ma jeden landmark `aside`, sześć wymaganych sekcji accordion i Teresę jako zakładkę. Lewa nawigacja ma ikony oraz wyłącznie lewą kreskę aktywnej sekcji. | `prototype/kpi-l3--light.png`, `prototype/okr-l3--light.png`, `prototype/roi-l2--light.png` |
| K9 | zrobione | Wspólny harness `dev-render/main.tsx` ma własny chrome kontrolny, lecz skrypt odbiorowy celowo ukrywa elementy `data-dev-render-chrome`; prototyp nie imituje powłoki produktu. | `scripts/dev/p7k-prototype-capture.mjs` |

## Pomiar §10 KROK 1b

- 16 PNG 1440×1000: 8 widoków × jasny/ciemny.
- 16 JSON: HTTP 200 = 16/16; `bledyKonsoli = 0` = 16/16; błędy sieci ≥400 = 0; `dom.aside.count` maksymalnie 1.
- `grep -c -E "text-c-accent|bg-c-accent|primary-" dev-render/screens/p7k-wyniki-prototype.tsx` → `0`.
- `grep -c "StandardModuleBar" ...` → `2`.
- `grep -c -E "ArtifactRightPanel|StandardArtifactShell" ...` → `5`.
- DOM: nagłówki kończące się „…” = 0; komórki liczbowe z łamaniem pojedynczej wartości = 0.
- Delta średniej lumy jasny/ciemny: KPI L1 225,8; KPI L2 221,5; KPI L3 223,9; OKR L1 226,3; OKR L2 220,4; OKR L3 223,3; ROI L1 225,7; ROI L2 220,6. Minimum 220,4 ≥ 100.
- Bundlowanie `esbuild` zakończone kodem 0.
- Pełny `tsc --noEmit` nie jest dowodem tej korekty: proces repozytorium osiągnął limit pamięci Node (około 4 GB). Nie użyto obejścia ani `--no-verify`.

## Granica

To nadal prototyp graficzny. Nie zmieniono kodu produkcyjnego KPI/OKR/ROI, schematu, API, tras, flag ani migracji. **STOP do akceptacji nadzorcy; KROK 2 nadal zakazany.**
