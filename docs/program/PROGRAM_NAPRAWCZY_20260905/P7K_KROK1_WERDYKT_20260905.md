---
doc_id: p7k-krok1-werdykt-20260905
status: canonical
truth_type: acceptance-verdict
established: 2026-09-05 (późny wieczór)
author: CTO (Fable)
paczka: P7K_WYNIKI_TRZY_POZIOMY_KOREKTA.md
---

# P7K KROK 1 — werdykt nadzorcy na prototyp (gałąź `codex/p7k-wyniki` @ `80d6e76f95`)

**Werdykt: NIE do pokazu właścicielowi. Korekta prototypu (KROK 1b), potem ponowny zrzut i STOP.**

Obejrzane własnymi oczami: 8 widoków jasnych + KPI L2 ciemny (`evidence/p7k-wyniki/prototype/`). Para jasny/ciemny zmierzona mechanicznie (luma 249 vs 19–26, nie duplikat). Konflikty scalania z m03: 0.

## Co jest dobrze (zostaje)
Trzy poziomy KPI/OKR i dwa ROI; Menu 2 = KPI · OKR · ROI; StandardTable na L1/L2; CEL nad Rezultatem w komórce okresu; YTD z prawej; „—” zamiast 0; nazwiska, nie identyfikatory; czerwień tylko przy odchyleniu/otwartej karcie, bursztyn przy ostrzeżeniu; terminologia ROI (GO / CONDITIONAL GO, Conservative/Base/Upside, Expected/Actual) zgodna z SSOT właściciela; L3 jako karta N z sekcjami po lewej; dane DBR77 z arkusza.

## Korekty (każda obowiązkowa)
| # | Defekt (widziany na zrzucie) | Wymagany stan |
|---|---|---|
| K1 | Stany aktywne w crimson: pstryczek Menu 2 (`bg-c-accent-soft text-c-accent`), chip filtra „Właściciel: wszyscy”, aktywna sekcja nawigacji L3. Menu 2 rysowane ręcznie własnym `<nav>`. | Menu 2 z komponentu `StandardModuleBar` (pstryczki z ikonami, lupa, przełącznik z prawej — jak zamrożone moduły, np. Realizacja). Stan aktywny NEUTRALNY (szary pstryczek, ciemny tekst). Zero `c-accent`/`primary-*` w stanach aktywnych; akcent w L3 tylko jako lewa kreska przy aktywnej sekcji (odniesienie: `evidence/odbior-zywo-20260905/kpi-3poziomy/L3-karta-N-wskaznika.png`). |
| K2 | KPI L2: liczby łamane w komórce („12 / 180”, „94 / 810”). | Liczba nigdy nie łamie się (`whitespace-nowrap`). Kolumny okresów ≥ 132 px, wszystkie miesiące roku (I–XII 2026) przewijane poziomo, MIERNIK przypięty z lewej, YTD + STAN przypięte z prawej, domyślnie przewinięte do bieżącego miesiąca (SSOT: „kolumny okresów przewijane, stałe przypięte, YTD z prawej”). |
| K3 | Nagłówki ucięte wielokropkiem („CZĘSTOTLIWO…”, „ODPOWIEDZIA…”). | Nagłówek mieści się w dwóch liniach albo kolumna jest szersza (pomiar treści jak w P2). Zero „…” w nagłówkach na 1440. |
| K4 | ROI L1: kolumna FAZA ucięta („Wy”, „Zał”), tabela wychodzi z kadru. | Na 1440 żadna kolumna nie jest obcięta. Domyślne kolumny: NAZWA · PRZEDMIOT · WARIANT · CAPEX · ROCZNA KORZYŚĆ · ROI · PAYBACK · REKOMENDACJA · FAZA; NPV i IRR w pstryczku kolumn (domyślnie schowane). |
| K5 | Pill „Krytyczne · działanie otwarte” łamie się na 3 linie (KPI L2, OKR L2, L3). | Pill jednowierszowy: „Krytyczne” + mała ikona karty działania; pełna treść w dymku (`title`). |
| K6 | Wiersze grupujące wypełnione „—” w każdej komórce; OKR L2 powtarza nazwę tematu w dwóch kolumnach. | Wiersz grupy = jedna komórka na całą szerokość (`colSpan`) z nazwą grupy i właścicielem nadrzędnym; zero „—” w wierszu grupy. |
| K7 | KPI L3 tabela odchyleń: 10 kolumn w ~870 px, każda komórka na 3–4 linie. | Domyślne kolumny: MIESIĄC · CEL OSIĄGNIĘTY · PROBLEM · DZIAŁANIE · ODPOWIEDZIALNY · TERMIN · STATUS; reszta (Główna przyczyna, Działania?, Komentarz) w pstryczku kolumn. Wiersz ≤ 2 linie na 1440. |
| K8 | Prawy „Panel analizy” = lista napisów; Teresa jako stopka. | Jeden ZWIJANY prawy panel accordion (Akcje · Właściwości · Powiązania · Źródła i założenia · Komentarze · Historia) z Teresą jako ZAKŁADKĄ — komponent `ArtifactRightPanel` / `StandardArtifactShell` z `src/components/standard/`, nie własny `<aside>`. Lewa nawigacja sekcji z ikonami jak w odniesieniu L3. |
| K9 | Brak powłoki produktu (lewy pasek modułów, górny pasek). | Jeśli harness dev-render ma powłokę (sprawdź istniejące ekrany w `dev-render/screens/`), użyj jej; jeśli nie — jedno zdanie w raporcie, nie blokuje. |

## Pomiar po korekcie (§10 KROK 1b)
- Te same 16 zrzutów 1440 jasny+ciemny + `.json`; `bledyKonsoli` = 0; `dom.aside.count` ≤ 1.
- `grep -c -E "text-c-accent|bg-c-accent|primary-" dev-render/screens/p7k-wyniki-prototype.tsx` → 0.
- `grep -c "StandardModuleBar" dev-render/screens/p7k-wyniki-prototype.tsx` ≥ 1; `grep -c -E "ArtifactRightPanel|StandardArtifactShell"` ≥ 1.
- Z `.json` (tekst DOM): zero nagłówków kończących się „…”; zero komórek liczbowych z łamaniem (sprawdź `th`/`td` przez `--dom`).
- Luma pary jasny/ciemny różni się o ≥ 100 dla każdego widoku (`scripts/dev/odbior-zywo/luma-para.mjs` gdy scalone z IV, inaczej PIL).
- Raport `evidence/p7k-wyniki/KROK_1B_PROTOTYP_RAPORT.md` z tabelą K1–K9 → „zrobione / jak / dowód (plik)”. **STOP do akceptu nadzorcy. KROK 2 nadal zakazany.**
