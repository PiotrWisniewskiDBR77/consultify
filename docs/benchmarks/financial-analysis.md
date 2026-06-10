---
brief: financial-analysis
module: Analiza finansowa (SPEKULATYWNY — brak w obecnym roadmapie produktu)
sources: [Anaplan (z wiedzy własnej; scrape anaplan.zip NIEDOSTĘPNY w środowisku), Apiary (scrape Apiary.zip NIEDOSTĘPNY — patrz §6)]
status: done
updated: 2026-06-09
speculative: true
sources_unusable: true
---

# Benchmark: Analiza finansowa

> Po co: zrozumieć wzorce „connected planning" i modelowania finansowego (Anaplan),
> żeby ocenić, czy i jak Consultify mógłby zaoferować warstwę scenariuszową/finansową
> na bazie danych z audytów i inicjatyw. Moduł jest na dziś SPEKULATYWNY (nie ma go
> w roadmapie) — ten brief to rozpoznanie, nie specyfikacja.

> ⚠️ **UCZCIWOŚĆ O ŹRÓDŁACH:** oba zip-y (`anaplan.zip` ~2,3 GB, `Apiary.zip`) okazały się
> NIEDOSTĘPNE do odczytu w tym środowisku — system blokuje dostęp powłoki (cp/unzip/ditto/
> python) do całego drzewa `Documents` z błędem „Operation not permitted" (macOS TCC/Full-Disk-
> Access), a narzędzie czytające nie rozpakowuje binarnych archiwów tej wielkości.
> Poniższy brief opiera się więc na **wiedzy własnej o produktach**, nie na scrapie.
> Każde twarde twierdzenie z konkretnego scrape'u należy potwierdzić, gdy archiwa będą czytelne.

## 1. Krajobraz konkurencji

| Narzędzie | Pozycjonowanie | Killer feature | Czy do TEGO modułu? |
|---|---|---|---|
| **Anaplan** | Enterprise „connected planning" / FP&A, sprzedaż, supply chain, workforce | Silnik **Hyperblock** — wielowymiarowe modele in-memory + scenariusze/wersje | ✅ TAK — rdzeń tego briefu |
| **Apiary** (Apiary.io / API Blueprint) | Narzędzie do **projektowania i dokumentacji API** (Oracle, przejęte 2017, w zaniku) | API Blueprint + mock server + dokumentacja | ❌ NIE — to nie finanse (patrz §6) |

Wniosek strategiczny: **tylko Anaplan jest relewantny** dla „Analizy finansowej".
Apiary trafił do tego folderu prawdopodobnie omyłkowo — należy do tematyki API/integracji,
nie do finansów.

## 2. Feature-surface Anaplan (siatka kontrolna dla ewentualnej warstwy finansowej)
Z wiedzy o produkcie (scrape niepotwierdzony) — to mapa kompletności „connected planning":

**Model danych:** Modules · Line Items · Lists (hierarchie) · Dimensions · Time · Versions
**Logika:** Formulas (Anaplan formula language) · Drivers (driver-based planning) · Allocations
**Scenariusze:** Versions/What-if · Scenario planning · Sensitivity · Rolling forecast
**Współpraca/proces:** Workflow, role-based access, audit trail, „one source of truth"
**Integracje:** Connectors (HyperConnect/CloudWorks, ETL), Excel/CSV in-out, API
**Wizualizacja:** Dashboards (UX/Boards) · Grids · Charts · KPI cards

→ Dla nas kluczowe są trzy warstwy: **wielowymiarowy model**, **drivery** i **scenariusze/wersje**.

> Screenshoty: **POMINIĘTE** — nie udało się rozpakować scrape'u, więc brak realnych ujęć UI.
> Folder `assets/financial-analysis/` nie został utworzony (brak materiału). Do uzupełnienia,
> gdy archiwum Anaplan będzie czytelne.

## 3. Model danych / architektura (wzorzec Anaplan)
- **Wielowymiarowość:** dane = przecięcie wymiarów (np. czas × jednostka × pozycja kosztowa),
  a nie płaska tabela. „Module" to wielowymiarowy blok, „Line Item" to mierzalna wielkość.
- **Hyperblock** = in-memory engine liczący cały model na bieżąco (zmiana założenia → natychmiastowy
  re-kalkulacja w dół całego łańcucha).
- **Versions** = pierwszorzędny obywatel: Actual / Budget / Forecast / scenariusze jako osobny wymiar.
- **Drivers** = założenia biznesowe (np. liczba etatów, cena, churn) sterujące pochodnymi wielkościami.

→ Dla Consultify: gdybyśmy budowali warstwę finansową, model powinien być **driver-based i wersjonowany**,
nie arkuszem płaskim — żeby scenariusze i what-if były tanie i porównywalne.

## 4. Scenariusze / what-if (najmocniejsza koncepcja do „kradzieży")
- Scenariusz = zestaw założeń (driverów) → przeliczany model → porównywalne wyniki.
- Wartość: **porównanie wariantów** (base / optimistic / pessimistic), wrażliwość na pojedynczy driver,
  rolling forecast.
- To dokładnie ten język, którego brakuje wynikom audytu/inicjatyw w Consultify:
  inicjatywa ma „impact", ale nie ma **modelu finansowego scenariusza**, który by ten impact policzył.

## 5. Decyzje dla Consultify
- ✅ **Kradniemy koncepcyjnie:** **driver-based, wersjonowany model scenariuszy** jako sposób
  kwantyfikacji efektu inicjatyw (oszczędność/przychód/ROI per scenariusz) — spina się z
  `project_initiative_formula` (inicjatywa jako „silnik transformacji" z mierzalnym efektem).
- ✅ **Kradniemy UX:** dashboard wyników scenariusza (KPI cards + grid + wykres wrażliwości).
- ⚠️ **Adaptujemy lekko:** nie budujemy drugiego Anaplana. Realny zakres v1 = **mini-model
  scenariuszowy inicjatywy** (3–5 driverów, base/upside/downside), nie pełna platforma FP&A.
- ❌ **Unikamy:** wielowymiarowego silnika in-memory typu Hyperblock — to lata pracy i zła
  altituda dla nas; wystarczy prosty kalkulator scenariuszy spięty z danymi inicjatyw.
- ❌ **Unikamy:** traktowania Apiary jako konkurenta finansowego — to inny temat (§6).

## 6. Apiary — co to NAPRAWDĘ jest (i gdzie należy)
- **Apiary = Apiary.io / API Blueprint** — platforma do **projektowania, mockowania i dokumentacji API**
  (przejęta przez Oracle w 2017, dziś w dużej mierze wygaszona). Nie ma nic wspólnego z analizą finansową.
- **Werdykt:** Apiary **NIE należy do tego briefu.** Tematycznie pasuje do ewentualnego modułu
  „API / integracje / developer tooling" (jeśli taki w ogóle powstanie), nie do „Analizy finansowej".
- Uwaga: scrape'u Apiary i tak nie udało się otworzyć, więc powyższe to identyfikacja z wiedzy o produkcie,
  nie weryfikacja zawartości archiwum. Przy okazji czytelnego archiwum — potwierdzić i przenieść do
  właściwego folderu źródeł.

## 7. Otwarte pytania
- Czy „Analiza finansowa" w ogóle wchodzi do roadmapy, czy zostaje jako **scenariusz finansowy inicjatywy**
  wbudowany w moduł Inicjatyw (rekomendacja: to drugie)?
- Jaki minimalny zestaw driverów pokrywa 80% naszych przypadków (FTE, stawka, czas wdrożenia, oszczędność/szt.)?
- Skąd dane wejściowe — ręcznie czy z audytu/wywiadu (re-use grounded data)?

## Załączniki / status źródeł
- `Softs/0 Analiza finansowa/anaplan.zip` (~2,3 GB) — **NIEODCZYTANE** (blokada dostępu powłoki, TCC/FDA).
- `Softs/0 Analiza finansowa/Apiary.zip` — **NIEODCZYTANE** (ta sama blokada) + i tak poza zakresem (§6).
- Do zrobienia, gdy archiwa będą czytelne: rozpakować Anaplan, potwierdzić §2–§4 ze scrape'u,
  dograć ≤2 realne screenshoty UI do `assets/financial-analysis/` i podlinkować w §2.
- Wiedza referencyjna online: `anaplan.com` (Connected Planning, Hyperblock), dokumentacja modeli/wersji.
