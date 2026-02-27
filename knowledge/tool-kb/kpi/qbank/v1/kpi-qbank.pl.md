# KPI — QBank Pack (v1, PL)

## Pack meta

- **tool_slug**: `kpi`
- **pack_type**: `qbank`
- **pack_version**: `1.0.0`
- **language**: `pl`
- **source_kind**: `tool_pack`

## Provenance (sources)

- SSOT Results: `docs/product/RESULTS_V3.md`
- ROI/benefits governance (powiązane): `docs/product/ROI_TRACKING_CONTRACT_V3.md`
- Przykładowy zestaw KPI/BSC (benchmark wewnętrzny): `knowledge/KPI/TOP BGD + KPI v2023 — kopia(BSC).csv`

## Audience + use

- **Used by**: UI (wizard “Dodaj miernik”) + AI (tool-scoped retrieval)
- **Do not use for**: automatyczne „zgadywanie” wartości KPI; definicje KPI muszą mieć źródło danych i ownera

---

## Sections (chunk-friendly)

### [section_id:overview] Po co jest KPI w Consultify

- **Cel**: KPI w module `Rezultaty` jest dowodem dowiezienia wartości po wdrożeniu (tracking w czasie, mapping KPI↔initiative, raporty KPI).
- **Zasada**: KPI jest *artefaktem governance*, nie wykresem w prezentacji.

### [section_id:definition_contract] Kontrakt definicji KPI (MUST)

Każdy KPI w R0/R1 powinien mieć minimalnie:

- **Nazwa + opis intencji**: co mierzymy i dlaczego.
- **Jednostka**: `%`, `PLN`, `szt.`, `h`, `m2`, itp.
- **Kierunek**: `większe=lepiej` lub `mniejsze=lepiej`.
- **Częstotliwość i okres**: weekly/monthly/quarterly + kotwica okresu (np. miesiąc kalendarzowy).
- **Owner**: osoba/rola odpowiedzialna za aktualizację i interpretację.
- **Źródło danych**: w R0 `MANUAL_ENTRY`, dalej connector/MCP.
- **Baseline + target** (jeśli ma sens): bez targetu KPI bywa tylko informacyjny.
- **Progi bezpieczeństwa (widełki)**:
  - Green/Amber/Red (minimum)
  - reguła interpretacji zależna od kierunku (większe=lepiej / mniejsze=lepiej)
  - tryb: absolutny lub % odchylenia od targetu

### [section_id:qbank_wizard] QBank: pytania do tworzenia KPI (wizard)

#### [topic:scope] 1) Definicja i zakres

- **Q1 (tak/nie)**: Czy definicja KPI jest jednoznaczna (wiemy dokładnie, co wchodzi/nie wchodzi do licznika i mianownika)?
- **Q2 (tak/nie)**: Czy KPI ma jasny „owner” (kto odpowiada za wpisy i wyjaśnienia odchyleń)?
- **Q3 (tak/nie)**: Czy KPI da się zmierzyć cyklicznie w stałych okresach (bez „ręcznego kombinowania”)?

#### [topic:formula] 2) Wzór, jednostka, kierunek

- **Q1 (tak/nie)**: Czy mamy wzór (nawet prosty) lub opis obliczania wartości KPI?
- **Q2 (tak/nie)**: Czy jednostka jest zgodna z tym, co realnie pochodzi ze źródła danych (np. `PLN`, `m2`, `%`)?
- **Q3 (tak/nie)**: Czy ustalono kierunek oceny (większe=lepiej / mniejsze=lepiej) i ewentualną tolerancję?

#### [topic:baseline_target] 3) Baseline i target

- **Q1 (tak/nie)**: Czy baseline pochodzi z konkretnego okresu i źródła (np. „średnia z 3 mies.”), a nie z opinii?
- **Q2 (tak/nie)**: Czy target jest realistyczny i „osadzony” (np. benchmark, decyzja zarządcza, business case)?
- **Q3 (tak/nie)**: Czy target jest powiązany czasowo (kiedy ma być osiągnięty)?

#### [topic:thresholds] 3b) Progi bezpieczeństwa (Green/Amber/Red)

- **Q1 (tak/nie)**: Czy zdefiniowano “green band” (zakres normalny), a nie tylko pojedynczy target?
- **Q2 (tak/nie)**: Czy widełki są spójne z ryzykiem i realnym tempem procesu (żeby nie generować alert fatigue)?
- **Q3 (tak/nie)**: Czy strefy mają action rules (Green=monitoruj, Amber=wyjaśnij+plan, Red=eskaluj+plan)?

#### [topic:data_source] 4) Źródło danych i dowód (evidence)

- **Q1 (tak/nie)**: Czy wiemy, skąd pochodzi wartość (system/raport/plik/osoba) i czy to źródło jest powtarzalne?
- **Q2 (tak/nie)**: Czy można dostarczyć dowód (export, raport, zrzut, link) dla pojedynczego wpisu time-series?
- **Q3 (tak/nie)**: Czy istnieje ryzyko manipulacji KPI (gaming) i czy mamy sposób kontroli (np. drugi KPI/komentarz/evidence)?

#### [topic:cadence] 5) Częstotliwość i operacyjność

- **Q1 (tak/nie)**: Czy częstotliwość jest dostosowana do tempa procesu (miesiąc vs tydzień vs kwartał)?
- **Q2 (tak/nie)**: Czy owner ma możliwość realnie aktualizować KPI w tej kadencji?
- **Q3 (tak/nie)**: Czy period key jest jednoznaczny (`2026-02`, `2026-W08`, `2026-Q1`)?

#### [topic:mapping] 6) Mapowanie KPI ↔ inicjatywy (attribution)

- **Q1 (tak/nie)**: Czy ten KPI jest „obietnicą” konkretnej inicjatywy (wynika z business case / scope)?
- **Q2 (tak/nie)**: Czy KPI może być przypięty do wielu inicjatyw (cross-cutting) i czy to jest jawne?
- **Q3 (tak/nie)**: Czy w razie odchylenia „below target” wiemy, które inicjatywy/obszary są podejrzane?

### [section_id:evidence_patterns] Wzorce evidence (praktyczne)

- **Manual entry (R0)**: wpis musi mieć przynajmniej krótki komentarz „skąd liczba”.
- **Preferowane dowody**:
  - export z ERP/BI,
  - raport finansowy,
  - log z systemu operacyjnego,
  - zatwierdzony dokument governance (np. miesiąc zamknięty w finansach).

### [section_id:common_mistakes] Najczęstsze błędy

- KPI bez ownera („wszyscy” = nikt).
- KPI bez definicji licznika/mianownika (każdy liczy inaczej).
- KPI bez kadencji i period key (brak trendu, brak porównywalności).
- KPI „na prezentację” (brak time-series i brak dowodu danych).
- KPI, który jest wynikiem wielu inicjatyw, ale mapowanie jest ukryte → brak odpowiedzialności.
- Progi bez “action loop” (RAG jako kolor, ale nikt nie wie co robić w Amber/Red).

