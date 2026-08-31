---
doc_id: funkcje-decyzje-20260830-wieczor
status: canonical
owner: piotr
truth_type: owner-decision
established: 2026-08-30
---

# Decyzje właściciela — 30.08.2026 wieczór (pakiet zamykania, runda 1)

Kontrakt tej rundy: **30 dyżurów, potem podniesienie flagi + odbiór grafiki.**

| # | Pytanie | Decyzja | Skutek operacyjny |
|---|---|---|---|
| D-1 | Spotkania: otworzyć betę? | **TAK, OD RAZU** (nie czekamy na zrzuty) | dyżur: `MODULE_MEETING: 'closed'→'open'` + mirror (`sync-server-runtime-mirrors.mjs`); zrzuty i odbiór natychmiast PO otwarciu |
| D-2 | Czat: włączyć producenta sygnałów? | **TAK** | `ENABLE_SIGNAL_PRODUCER=true` — lokalny dowód dyżurem, na STAGING ustawia nadzorca (env Railway, procedura promocji) |
| D-3 | Audyty: eksport PDF w MVP? | **TAK, PDF MUSI BYĆ** | dodatkowy dyżur budowy eksportu PDF audytu (zbadać reużycie `documentPdfRenderer` z Materiałów) |
| D-4 | Powierzchnia odbiorów | **STAGING, nie demo** — „od dłuższego czasu pracujemy na stagingu; instancje rozdzielone" | K5 ścieżki wyjścia doprecyzowany; wszystkie odbiory żywe = staging; demo dostaje stan zaakceptowany |

Pytanie o powierzchnię Audytów (hub vs warsztat) — zadane ponownie w rundzie 2.

## Runda 2 (ta sama sesja)

| # | Pytanie | Decyzja | Skutek operacyjny |
|---|---|---|---|
| D-5 | Audyty: powierzchnia odbioru | **BUDUJEMY WARSZTAT TERAZ** (wbrew rekomendacji — decyzja świadoma) | +3-4 dyżury; UWAGA reguła 7: warsztat to NOWY wygląd → najpierw prototyp → akcept właściciela → budowa za flagą OFF; wpis do KOORDYNACJA.md (styk z grafiką) |
| D-6 | Moja praca | **Kalendarz ON TERAZ; Radar po-MVP** | dyżur: włączenie flagi kalendarza + retest; Radar → backlog po-MVP (literał zostaje) |
| D-7 | Realizacja: magazyn zadań | **MIGRACJA legacy→kanon W MVP** (najdroższa opcja — decyzja świadoma) | najpierw dyżur ANALIZY (inwentarz danych `tasks` vs `ie_aggregate_state`, plan migracji addytywnej, ryzyka), potem dyżur wykonania; brama 409 zostaje do końca migracji |
| D-8 | Materiały: strażnik groundingu | **POLUZOWAĆ + rubryka** | dyżur GEN-2: liczby-założenia dopuszczone i oznaczone; jakość pilnowana rubryką 15/18 przy odbiorze pliku |

## Runda 3 (31.08 noc)

| # | Pytanie | Decyzja | Skutek |
|---|---|---|---|
| D-9 | Auto-polityka limitów agenta obejmuje też wave8/multiAgent/adapter (fail-open) | **ZAAKCEPTOWAĆ** | ostatni warunek K6 zamknięty — `ENABLE_AI_TASKS_WORKER=true` na STAGINGU przy deployu kandydata (K5); obserwacja licznika `[AgentResource] admission denied`; demo dopiero po akcepcie na stagingu |
| D-10 | Źródło briefu prezentacji z szablonu | **OBA**: modal przy szablonie (dyżur 201, ta fala) + ścieżka przez Teresę (dyżur 203, następna) | 31.08 rano |
| D-11 | Granulacja założeń vs próg gęstości QA | **próg liczy średnią SEKCJI** (nie bloku) — granulacja per akapit zostaje; wdrożenie w FIX-195 | 31.08 rano |
| D-12 | Migracja E2: pomiar M3 przed decyzją | **TAK — read-only na stagingu** | wykonane 31.08: 14 domów / 67 inicjatyw z zadaniami / 467 zadań (265 osobistych); wynik w raporcie 197 |
