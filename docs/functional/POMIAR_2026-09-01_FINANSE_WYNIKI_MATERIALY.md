---
doc_id: pomiar-2026-09-01-finanse-wyniki-materialy
title: Pomiar 2026-09-01 — Finanse · Wyniki · Materiały
truth_type: runtime
status: canonical
owner: piotr
established: 2026-09-01
marker: e99e81301ac8c9cc9b945eb44b7365fa7ff055d6
---

# Pomiar 2026-09-01 — Finanse · Wyniki · Materiały

Ten dokument jest **jedynym miejscem**, gdzie trzy dzisiejsze pomiary (dyżury
Codex 233/234/235) są zebrane razem, z cytatami źródłowymi. Karty modułów
(`docs/modules/08_finanse/`, `docs/modules/07_rezultaty/`,
`docs/functional/10_materials/README.md`) odsyłają tutaj po szczegóły i noszą
tylko skróconą wersję faktu.

**Zasada czytania:** każde twierdzenie ma `plik:linia` w kodzie **albo** datę
i sposób pomiaru (komenda, marker, artefakt). Gdzie źródła się rozjeżdżają,
napisane jest wprost „sprzeczność, wymaga pomiaru" — nie ma zgadywania.

Marker pomiaru dla wszystkich trzech modułów: `e99e81301ac8c9cc9b945eb44b7365fa7ff055d6`.
Pełne raporty źródłowe:
- `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY233_FINANSE_REPORT.md`
- `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY234_WYNIKI_REPORT.md`
- `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY235_MATERIALY_REPORT.md`
- `docs/program/funkcje/SPROSTOWANIE_WIDOCZNOSC_WYNIKOW.md`
- `docs/program/funkcje/DOWOD_TRZY_PLIKI_2026-09-01.md`
- `docs/program/funkcje/KSZTALT_19_PARA_ZGODNA_ROZNE_STANY.md`

---

## 1. Finanse (moduł 9 w menu)

### 1.1 Ile paneli wyceny woła zaplecze — było / jest

**OBALONE 1.09.** Wcześniejsze twierdzenie „5 z 21 paneli woła backend"
powoływało się na plik, który w repozytorium **nie istnieje**, i jest tym
samym obalone. Nie było ono zapisane literalnie w kartach modułu 08_finanse
(sprawdzone grepem) — funkcjonowało jako ustne/instrukcyjne twierdzenie
nadzorcy, powtórzone w instrukcji dyżuru 233.

**Jest (pomiar 2026-09-01, metoda: pełny `ApiGateway.getInstance().initializeRoutes(app)`,
podpisany JWT bez auth bypassu, `ENABLE_V8_GLOBAL=true`, realny PostgreSQL,
pełne migracje; klasyfikacja „DANE" = odpowiedź `2xx` z niepustym `body.data`):**

**18 z 21 paneli** woła realny endpoint backendu i w tym pomiarze wszystkie 18
dostało dane. Trzy panele są **celowo** lokalne/prop-driven (nie defekt):

| Panel | Dlaczego bez backendu |
| --- | --- |
| `DriverPlannerPanel` | obliczenia lokalne w komponencie |
| `EvBasketFootballField` | render z propsów |
| `ValuationVisualsPanel` | render z propsów |

Pełna tabela 21 paneli z konkretnym adresem `POST/GET` każdego jest w
`CODEX_DAY233_FINANSE_REPORT.md` (sekcja „Pierwszy pomiar — sporna liczba
paneli"). Pełne requesty/odpowiedzi: `/private/tmp/cx-day233-finanse-artefakty/panel-probe.json`
(poza repo, artefakt sesji z 2026-09-01), SHA-256
`e33662056fb3655c5be99c924e7efcf7c0a363fdd4f8dd21179910decbb64002`.

### 1.2 Flagi — 25 z 26 ekranów zamkniętych domyślnie: to jest ZAMIERZONE

Na domyślnych ustawieniach **25 z 26 ekranów modułu Finanse jest zamkniętych
za flagami**. To jest **stan zamierzony** (kontrolowany rollout wizualny wg
reguły 7/9 z `CLAUDE.md` — właściciel nigdy nie jest pierwszym testerem
wizualnym), **nie usterka i nie dług**.

Mechanika: front `VITE_FINANCE_VALUE_PANELS` jest niezależny od backendowego
`ENABLE_V8_GLOBAL` — pierwszy ma domyślnie `OFF`
(`src/utils/financeValuePanelsFlag.ts:1-30`), drugi zwraca `404 V8_DISABLED`
przed dalszą obsługą, jeśli wyłączony
(`server/src/middleware/v8FeatureGate.middleware.ts:10-20`). Pomiar użył
wyłącznie query `ff_financeValuePanels=1` i `ff_wave3FinanceOwnerReview=1` —
wartości domyślne produktu nie zostały zmienione.

### 1.3 „Management report" wyceny — nie istnieje w kodzie, oznaczone uczciwie

`ExportStep.tsx` (krok eksportu w przepływie wyceny) jest **uczciwym
placeholderem** — nie udaje, że eksport działa. Decyzja „w MVP czy poza MVP"
pozostaje **otwarta** (pomiar 2026-09-01, `CODEX_DAY233_FINANSE_REPORT.md`,
sekcja „Management report — decyzja otwarta"). Żeby powstał realny eksport,
potrzeba: decyzji PDF/DOCX, kontraktu eksportu produkującego typ
`REPORT_EXPORT`, nowej trasy, implementacji UI oraz oceny, czy
`documentPdfRenderer` z Materiałów da się bezpiecznie reużyć.

### 1.4 Zabezpieczenie zrzutów — nowy kształt 19 i jego naprawa

Pierwszy przebieg odbioru dyżuru 233 zameldował „5 z 5 par zrzutów ma wynik
policzony" — to była **pomyłka wykryta przy odbiorze**, nie w tym dokumencie
obalana teza produktowa, tylko usterka **metody pomiaru**: dwie pary
(Monte Carlo, Scenariusze) miały wariant jasny przechwycony PRZED wynikiem
(wyścig klik→zrzut w jednorazowym, nigdy niezacommitowanym skrypcie).
Bezpiecznik różnicy jasności (próg 150) to przepuścił, bo różnica i tak
wynosiła >200 — opisane jako `docs/program/funkcje/KSZTALT_19_PARA_ZGODNA_ROZNE_STANY.md`.
**Naprawione**: nowy zacommitowany skrypt
`scripts/dev/day233-finanse-panele-zrzuty-jasne.mjs` czeka na selektor DOM
wyniku przed zrzutem; dowód mutacyjny w
`scripts/dev/__tests__/checkScreenshotPairState.test.mjs` (6/6 PASS z
zabezpieczeniem, 3/6 FAIL po jego ręcznym usunięciu). Po naprawie: **5 z 5**
par ma wynik policzony w obu motywach.

---

## 2. Wyniki (moduł 8 w menu)

### 2.1 ★ Widoczność OKR/ROI na demo — nadzorca podał FAŁSZ, tu jest sprostowanie

**OBALONE 1.09.** Nadzorca powiedział właścicielowi przy wydawaniu dyżuru 234:
„OKR i ROI są domyślnie niewidoczne — też na demo. Z 33 elementów około 22
nikt nie zobaczy bez ręcznego ustawienia flagi." **Obie części tego zdania
były nieprawdziwe** (pełne sprostowanie:
`docs/program/funkcje/SPROSTOWANIE_WIDOCZNOSC_WYNIKOW.md`).

**Jest naprawdę:**
1. Na realnym `demo.consultify.ai` te ekrany **SĄ widoczne**. Zmienna
   środowiskowa `VITE_DEMO_ACCEPTANCE` jest tam **ustawiona** — potwierdził
   to sam właściciel w panelu Railway 28.08 (decyzja `DEC-2026-08-28-216`).
   Działa jako **wczesny `return true`**, który omija całą logikę flag
   poniżej niego w tej samej funkcji.
2. Liczba też była zła. **Na gołym kodzie**, bez zmiennej, nieosiągalne są
   **24 z 33** elementów (nie „około 22"). **Na realnym demo: 0 z 33**
   (zmienna omija wszystko).

Zasięg zmiennej jest **większy niż tylko ten moduł**: `isDemoAcceptanceProfileEnabled`
jest czytane jako wczesny `return true` przez **sześć rodzin flag** — Wyniki
(KPI+ROI+OKR naraz) oraz pięć rodzin w obszarze pomysłów i studia artefaktów.
Koperta widoczności wpuszcza wyłącznie aktywnego właściciela i administratora —
konsultant tych ekranów nie widzi.

**Właściciel zdecydował 28.08 (`DEC-2026-08-28-227`): demo NIETKNIĘTE** — ta
zmienna zostaje, nikt jej nie zmienia bez jego decyzji.

**Wpisz obie liczby razem, zawsze z kontekstem który jest który:**
- gołe repo / bez zmiennych środowiska: **24 z 33 elementów nieosiągalne**;
- realny `demo.consultify.ai` (z `VITE_DEMO_ACCEPTANCE`): **0 z 33 nieosiągalne**.

### 2.2 Mianownik pokrycia F.2 — `135` wycofane

**OBALONE 1.09.** Liczba `135` (mianownik pokrycia tras mutujących Results)
**nie jest odtwarzalna żadną zmierzoną metodą** i zostaje wycofana z obiegu.

Trzy reprodukowalne metody na markerze `e99e81301ac8c9cc9b945eb44b7365fa7ff055d6`
dają trzy różne, każda odtwarzalna liczby:

| Metoda | Wynik | Co liczy |
| --- | --- | --- |
| literalne rejestracje `router.(post\|put\|patch\|delete)(` | **130** | liczy też pojedyncze linie definicji helperów, nie rozwija ich wywołań |
| literalne minus definicje helperów plus wywołania helperów | **146** | nadal widzi tylko rejestracje o rozpoznanym kształcie tekstowym |
| introspekcja zbudowanych stosów Express (`router.stack`) w runtime | **152** | jedyna metoda, która faktycznie uruchamia moduły i czyta zamontowane trasy; `RUNTIME_MUTATOR_REGISTRATIONS=152 UNIQUE_GATEWAY_METHOD_PATHS=152 DUPLICATES=0` |

Dokładne komendy dla każdej metody: `CODEX_DAY234_WYNIKI_REPORT.md`, sekcja
„Mianownik F.2 — trzy metody". **152** najlepiej odpowiada na pytanie „ile
unikalnych mutujących metoda+pełna-ścieżka faktycznie zarejestrowały routery
montowane przez Gateway", ale wybór kanonicznego mianownika (146 vs 152)
należy do nadzorcy — **nierozstrzygnięte, wymaga decyzji**.

### 2.3 Crosswalk/backfill KPI — biblioteka bez wołacza

Mechanizm crosswalk/backfill (`kpiCrosswalkService.ts:36,74`,
`kpiShadowReadService.ts:56`) ma **zero wołaczy produktowych** — grep bez
testów zwraca tylko definicje, Gateway bez trafień. To jest kształt „biblioteka
bez wywołania": kod istnieje i jest gotowy, ale nic w produkcie go nie
uruchamia. Najmniejszy bezpieczny wariant montażu (akcja OWNER/ADMIN „Potwierdź
mapowanie KPI" na karcie inicjatywy, wyłącznie jawne pary wybrane przez
człowieka) jest opisany w `CODEX_DAY234_WYNIKI_REPORT.md`, sekcja „R3 — brief
crosswalk/backfill" — **wymaga osobnej decyzji produktowej, nie jest
zamontowany**.

### 2.4 Co pozostaje potwierdzone z instrukcji 234 (T1–T8)

Tezy T1 (8 KPI/6 OKR/16 ROI), T5 (KPI ON poza public prod, OKR/ROI OFF **w
kodzie** — patrz 2.1 dla runtime demo), T6 (pierwszy odbiór 170 odrzucony),
T7 (testowy escape-hatch bez bypassu poza testem), T8 (wspólny łańcuch bramek
tras) są **potwierdzone** pomiarem — szczegóły i cytaty linii w
`CODEX_DAY234_WYNIKI_REPORT.md`, sekcja „T1–T8". T4 (izolacja tenant w
testach realnego PG) jest **potwierdzona strukturalnie, ale wykonanie
niezweryfikowane** — własne przebiegi oznaczyły 4 testy jako `skipped`, nie
`PASS`.

---

## 3. Materiały (moduł 10 w menu)

### 3.1 Szablony Excel — 9, nie 8

**OBALONE 1.09.** Poprzedni pomiar liczby szablonów Excel dawał 8. Przyczyna:
wzorzec dopasowywał tylko litery (`[a-zA-Z]*`), a jedna nazwa klucza zawiera
cyfry (`cashflow12m`) i nie pasowała do regexu. Realna liczba pozycji `id:`
to **9** (dowód: `CODEX_DAY235_MATERIALY_REPORT.md`, teza T4 — „potwierdzona
po korekcie komendy: 9 `id:`; regex autora zwraca 8, bo `[a-zA-Z]*` nie
obejmuje `cashflow12m`"). Generator i **9 szablonów** istnieją, ale bez
formalnej oceny rubryką (`GEN-3`, sekcja 5 tego samego raportu).

### 3.2 ★★ Trzy realne pliki — pierwszy uczciwy pomiar największej obawy właściciela

Pomiar 2026-09-01 (`docs/program/funkcje/DOWOD_TRZY_PLIKI_2026-09-01.md`)
przeprowadził **pełny realny przebieg**: Postgres od zera, realny `Gateway`,
realna rejestracja organizacji, podpisany token, realne trasy produkcyjne —
nie test, przebieg. Wyprodukowano trzy pliki:

| Format | Wynik | Ocena własnej bramki |
| --- | --- | --- |
| Arkusz (XLSX) | **DZIAŁA** — formuły realne, sprawdzone komórka po komórce, przeliczone niezależnie (kapitał ≈ 53,7 mln, ≈ 107,47/akcję — zgodne) | 100/100, zero uwag |
| Dokument (DOCX) | Słaby — 432 słowa, zdań z konkretem: 0, wypełniaczy: 18, angielskie etykiety w polskim dokumencie, wyciek znacznika systemowego do treści klienckiej | **eksport ZABLOKOWANY przez bramkę jakości** — plik powstał dopiero po świadomym, audytowanym obejściu |
| Prezentacja (PPTX) | Najgorsza — 12 slajdów, 533 słowa, ani jeden zaszczepiony fakt na slajdzie; slajd 10 twierdzi „portfel 0 inicjatyw i 0 ryzyk" mimo dwóch źródeł z realnymi inicjatywami (`deckConclusionSlide.ts:179-180` liczy wyłącznie ze strukturalnych tablic, źródło tekstowe jest dla tej syntezy niewidoczne) | **99/100, eksport PRZEPUSZCZONY** mimo jawnie fałszywego zdania na slajdzie |

**Werdykt do zapamiętania:** dokument był słabszy niż prezentacja pod
względem treści, ale to prezentacja przeszła — bramki jakości **nie są
spójne między formatami**. Gorszy artefakt dostał wyższą ocenę.

### 3.3 ★★ Przyczyna źródłowa: brak klucza do modelu językowego — unieważnia wcześniejsze wnioski o „słabych generatorach"

W środowisku pomiaru **nie było klucza do żadnego modelu językowego**. Logi
pokazują realne, nieudane wywołania: brak klucza → pięć błędów → bezpiecznik
się otwiera → „brak dostępnego modelu". To jest jednocześnie dowód, że
pomiar rozmawiał z prawdziwym kodem, a nie z atrapą (atrapa by „zadziałała").

**Wniosek, który trzeba czytać dosłownie: dokument i prezentacja NIE BYŁY
OCENIANE — oceniane były ich awaryjne zastępniki.** Arkusz nie ucierpiał, bo
jego silnik jest deterministyczny i nie zależy od modelu językowego — to
jest zarazem dowód, że problem nie leży w składaniu plików, tylko w ścieżce
LLM. **Dopóki pomiar nie zostanie powtórzony z realnym kluczem, żadna ocena
jakości dokumentu i prezentacji (ani ta zła z dziś, ani przyszła dobra) nie
jest wiążąca.**

### 3.4 Cztery zgłoszone, świadomie nienaprawione defekty (z pomiaru trzech plików)

1. `deckConclusionSlide.ts:179-180,266,281-282,321-330` — synteza slajdu
   podsumowania ignoruje źródła tekstowe, produkuje fałszywe „0 inicjatyw i
   0 ryzyk".
2. `materialExportReceiptService.ts:109` — eksport po pierwszym niepowodzeniu
   **trwale** blokuje ten sam artefakt; trzeba założyć nowy, żeby dostać plik.
3. `document-studio.routes.ts:832` — realna kolizja klucza unikalnego przy
   rejestracji artefaktu; ponowienie maskuje to w logu, ale pierwsza próba
   pada.
4. Niespójność bramek jakości między formatami (patrz 3.2) — dług
   architektoniczny, kolejność naprawy w `DOWOD_TRZY_PLIKI_2026-09-01.md`,
   sekcja „Co robimy dalej".

---

## 4. Sprzeczności nierozstrzygnięte (nie zgadywane, do decyzji nadzorcy/właściciela)

- **Wyniki — kanoniczny mianownik pokrycia:** 146 czy 152? Oba odtwarzalne,
  różna definicja „co się liczy". `135` jest wycofane, ale wybór między
  pozostałymi dwoma nie jest rozstrzygnięty w tym pomiarze.
- **Finanse — Management report w MVP czy poza MVP:** otwarte, wymaga decyzji
  właściciela (patrz 1.3).
- **Materiały — GEN-1…GEN-5 nie mają statusu `PASS`/`FIXED`/`VERIFIED`** dla
  żadnego generatora; koszt domknięcia opisany, ale nie zdecydowany
  (`CODEX_DAY235_MATERIALY_REPORT.md`, sekcja 5).
