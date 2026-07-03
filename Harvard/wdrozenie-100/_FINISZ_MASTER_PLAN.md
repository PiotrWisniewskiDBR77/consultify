# ★ FINISZ — MASTER PLAN (jedyny punkt wejścia)

> **Data ustanowienia:** 2026-07-01 · **Status:** ŻYWY — aktualizowany po każdym sprincie
> **Cel nadrzędny:** SKOŃCZYĆ Consultify i przekazać go zespołowi Piotra. Koniec z częściowymi działaniami.
> **Ten plik zastępuje jako punkt wejścia:** wszystkie wcześniejsze plany czyta się TYLKO przez pryzmat tego dokumentu. Tablica `_KOORDYNACJA_CLAUDE_PIOTR.md` pozostaje medium koordynacji między sesjami agentów.

---

## 0. PAKT O WSPÓŁPRACY (ustalony z Piotrem 2026-07-01)

| Zasada | Treść |
|---|---|
| **Role** | Piotr = konsultant/właściciel: decyzje produktowe + odbiory. Claude = całość planowania, wykonawstwa, orkiestracji agentów i kontroli jakości. Komunikacja językiem biznesu, nie kodu. |
| **Rytm** | **4 sprinty dziennie.** Sprint = [agenci budują] → [sesja odbiorowa Piotra wg karty] → [wyniki → plan następnego sprintu]. Piotr robi 3-4 głębokie sesje dziennie. |
| **Karta sesji** | Każda sesja odbiorowa ma przygotowaną KARTĘ: co odbierasz, URL, kroki, na co patrzeć, czego NIE oceniać (bo jeszcze w budowie). 30-60 min. Nigdy „rozejrzyj się". |
| **Zasoby** | 2× Claude Max — pracujemy wieloma agentami równolegle (worktree per agent). To praktycznie jedyny projekt. |
| **Zakres KOREKTA** | **VEGAS = pełna skórka CAŁEJ aplikacji** (~115 ekranów wg inwentarza), NIE tylko golden-path 8 ekranów. Golden-path zostaje wyłącznie jako kolejność startu fal. Framing „keynote/data Vegas" — nieaktualny. |
| **★ Miara jakości (Zasada Konsultanta HBS, 2026-07-01)** | Na aplikację patrzymy oczami **absolwenta HBS po MBA z 10-letnią praktyką**: „czy taki konsultant pracowałby z klientem właśnie tak — klient zadowolony, skuteczność zagwarantowana?" Każdy tool = **merytorycznie fantastyczny + sprawny + graficznie dowieziony** (trzy naraz). To pytanie otwiera każdą kartę sesji. |
| **★ Wolność technologii prezentacji (2026-07-01)** | NIE jesteśmy przywiązani do obecnych metod graficznych. Dozwolone i pożądane: HTML-raporty klasy wydawniczej (→PDF), profesjonalne biblioteki wizualizacji, PPTX komponowany programowo, dedykowane widoki per metodyka. Claude dobiera najlepsze rozwiązanie per zastosowanie i proponuje Piotrowi. |
| **Środowisko** | Wszystko na demo/stage. PROD nietknięty do finalnej, jawnej zgody Piotra (D-G). |
| **Kontekst** | Jeden punkt wejścia (ten plik) + tablica koordynacji + karty sesji. Dokumentacja posprzątana (archiwum dla historycznych). |

## 0b. METODA PLANOWANIA — 5 ZASAD (żeby plany nie miały pomyłek i realnie doszły do 100%)
1. **Planujemy od końca** — każdy plan zaczyna od definicji „skończone", potem rozkład na zadania.
2. **Zamknięte listy** — plan = wyliczony inwentarz ze statusem każdej pozycji (nie da się zapomnieć, bo wszystko policzone). Lista rośnie TYLKO przez odbiory/decyzje Piotra.
3. **✅ tylko z dowodem i odbiorem Piotra** — stany ⬜/🟡/✅; procent liczony mechanicznie z liczników, nigdy „z wyczucia".
4. **Kod przed planem** — zadanie wchodzi do sprintu po 5-min weryfikacji w kodzie (raporty przeszacowują).
5. **Jeden właściciel, jeden rytm** — plany edytuje tylko Claude, tylko na granicy sprintu, na podstawie wyników sesji; nowe dokumenty-plany zakazane.

**Ścieżki projektów (zamknięte listy z licznikami):** [`_PROJEKT_A_HARVARD.md`](_PROJEKT_A_HARVARD.md) (60 pozycji, 6✅) · [`_PROJEKT_B_VEGAS.md`](_PROJEKT_B_VEGAS.md) (7 fal + 8 przekrojów, 1 fala ✅) · [`_PROJEKT_C_OXFORD.md`](_PROJEKT_C_OXFORD.md) (70 pozycji, 7✅). Pokrycie modułów GA zweryfikowane MACIERZĄ POKRYCIA (§ niżej) — każdy moduł ma wskazane pozycje we wszystkich trzech planach.

## 1. TRZY PROJEKTY DO DOMKNIĘCIA (1 projekt = 1 filar zaufania)

> **Kryterium jakości = [`_TEST_ZAUFANIA_TRZY_FILARY.md`](_TEST_ZAUFANIA_TRZY_FILARY.md)**: ŁADNI × NIEZAWODNI × KOMPETENTNI (mnożą się, nie sumują). **Restrukturyzacja 2026-07-01 (decyzja Piotra):** merytoryka wydzielona z Harvardu do trzeciego projektu **OXFORD** (nazwa robocza do akceptu Piotra). Kompletność zakresów zweryfikowana sweepem dokumentacji (~390 specyfikacji zmapowanych do projektów + 13 tematów przekrojowych jawnie włączonych — wcześniej wisiały poza planem).

### PROJEKT A — HARVARD (filar NIEZAWODNI: „działa i płynie")
Strumienie:
1. **Twarde bugi** (lista w tablicy §C): M05 foldery+pułapka · M06 routing-race · M15 OEE-jednostki+wykresy · M16 kreator · M24 add-member+audit-emitter+API-keys+AI-audit-fetch.
2. **SPINY ŁAŃCUCHA** (przepływ danych — „jeden deliverable, zero duplikatów"): S6.1 rejestr deliverables w M17 z back-reference do źródła (fix split-brain, `registerChatDeliverable` e2e) · S6.2 Tools→Inicjatywy handoff · S6.3 M17 dedup+filtr draft/test · S6.4 Finance grounding (model ze Statement + refresh-from-source) · S6.5 handoff M14→M15 (B1b, w kolejce) · connection-model doc/sheet. Decyzje DEC-1..4 w Teście Zaufania.
3. **Mechanika Tools + Assessmentów** (dopisane po korekcie Piotra — wcześniej BRAKOWAŁO w planie): sesja→zapis→wznowienie→handoff wyników niezawodne dla 19 tooli + DRD/SIRI/ADMA end-to-end · pipeline generatorów (mechanika; treść i głębia = OXFORD; wygląd plików = VEGAS Fala 6).
4. **Redesigny przepływów**: M13 generator inicjatyw (werdykt „masakra") · M17 wejście generatora (dramat nawigacyjny) · Editor Shell D-I (logika/układ; wykonanie wizualne = VEGAS Fala 2).
5. **Wydajność i stabilność** (dopisane — kompletność): wolne ładowania (model M16, snapshoty) · timeouty ciężkich operacji · N+1 · strażnicy regresji (v8 mutacje — 2× wracało).
6. **Operacje i przekroje** (dopisane — kompletność, 13 tematów ze sweepa): M10 Wywiad server-STT verify (P0 — utrata odpowiedzi głosowych) · i18n PL/EN resztki · spójność powiadomień · standard obsługi błędów (fail-soft) · RBAC/bramki ról · higiena CI/testów · deploy+monitoring (Panel Health D-J) · beta-gating · M25 fasady (urealnić/ukryć) · M27 wejście+odbiór · czyszczenie danych testowych.
**DoD HARVARD:** 11/11 przejść łańcucha działa z dowodami (D-J) · zero P0/P1 · GA-set odebrany · Panel Health zielony.

### PROJEKT B — VEGAS (filar ŁADNI: „wygląda premium wszędzie")
Zakres = **wszystkie ~115 ekranów** wg `ARTIFACT_ANATOMY_STANDARD.md` + **wszystko, co klient dostaje do ręki**:
- **Fala 0** fundament ✅ zmergowana · **Fala 1** ~25 tabel 🟨 W LOCIE (A1/A3/A4 gotowe na branchach, A2/A5 w toku) · **Fala 2** artefakty/edytory (wzorzec Mind Map = D-I) · **Fala 3** huby+instrumenty (M15 motyw, M24 „10 lat", M16 kreator) · **Fala 4** hartowanie (z-index, motywy, empty-states, mikro-detale) · **Fala 5** light mode + ekrany P3.
- **Fala 6 — TOŻSAMOŚĆ WIZUALNA DOKUMENTÓW GENEROWANYCH** (dopisane — największa luka kompletności): szablony PPTX/DOCX/XLSX klasy premium (PPTX dziś „3-", Excel „bez formatowania"). To, co klient trzyma w ręku, MUSI wyglądać jak produkt — inaczej cały re-skin apki nie ma znaczenia.
- **Przekroje wizualne** (dopisane): stany puste/ładowania/skeletony systemowo · e-maile systemowe · onboarding/first-run · eksporty PDF.
**DoD VEGAS:** każdy ekran + każdy generowany dokument zgodny ze standardem (tokeny c.*, zero crimson-leak, spójny motyw) · Piotr przeszedł apkę i podpisał wygląd · ESLint gate blokuje nowy dług.

### PROJEKT C — OXFORD (filar KOMPETENTNI: „myśli jak konsultant") ★ NOWY 2026-07-01
Wypełnia aplikację wiedzą konsultingową — serce przewagi konkurencyjnej („Harvey wygrał nie interfejsem, tylko tym, że zna prawo"). Strumienie:
- **O1 Kanony metodyczne**: DRD jako pełny autorski framework (wymiary→poziomy→pytania→scoring→benchmark→**RAPORT+MAPA — P0 reputacyjne, start projektu**) · fidelity SIRI/ADMA · ścieżki dojrzałości N→N+1 („co zrobić, żeby przejść wyżej") · CMMI/LEAN uczciwe „wkrótce".
- **O2 Standard wniosków** (CONCLUSION_LAYER_STANDARD, jeden dla całej apki): każdy wynik = „co jest → co znaczy → co robić najpierw (impact×effort) → jaki efekt". Raporty wnioskowe zamiast opisowych: assessmenty, toole, finanse.
- **O3 Q-banki głębokie**: drabinki poziomów z rozgałęzieniami dla 19 tooli (wzorzec Dynamic SWOT → rozjazd na resztę).
- **O4 Finanse jako doradztwo**: business case (assumptions→scenariusze nazwane biznesowo→rekomendacja) · rozkład benefitu (savings/growth/risk) · współzależności inicjatyw · benchmarki branżowe / guidance stóp.
- **O5 Biblioteka promptów AI** (mózg systemu jako zarządzany zasób): prompty sekcji inicjatyw · briefy generatorów · AI-guidance per framework (D-H) · persona Teresy.
- **O6 Benchmarki i profile branżowe**: co znaczy „dojrzały" w automotive vs pharma; dane referencyjne (BIC/FoF/własne DBR77).
- **O7 Standardy treści**: CARD_CONTENT_FORMULA + INITIATIVE_FORMULA egzekwowane w outputach · jakość języka PL/EN.
- **O8 Pomoc i edukacja**: treści pomocy, „dlaczego to pytanie", edukacja nie-konsultanta (warunek Spotify-demokratyzacji).
- Zaplecze: sweep zmapował **~260 istniejących specyfikacji** (V8/generatory/formuły) do OXFORDU — dużo doktryny JUŻ istnieje; projekt = egzekucja i domknięcie, nie pisanie od zera.
**DoD OXFORD:** DRD/SIRI/ADMA + top-5 tooli + analiza finansowa produkują dokument, który **Piotr podpisałby własnym nazwiskiem przed klientem.**

### JAWNIE POZA ZAKRESEM FINISZU (wykluczenie = decyzja, nie przeoczenie)
M21 Meeting (niezbudowany, beta post-GA) · M22 AI OS (internal dbr77, D-F) · M26 Partner Portal (beta post-GA; tylko higiena gatingu H6.8) · CMMI/LEAN pełne (D-B) · Stripe/billing (po decyzji komercyjnej) · migracja V8 M16 Valuations (D-E) · mobile (desktop-first v1) · type-safety serwera pełne (~tys. błędów TS = po GA). **D-K ROZSTRZYGNIĘTE: M10 Wywiad WCHODZI do GA-setu** (łańcuch zaczyna się od Wywiadu; warunek = STT-verify H6.1; default CTO, odwracalny).

### MACIERZ POKRYCIA MODUŁÓW GA (anty-dziura: każdy moduł → pozycje planów)
| Moduł | HARVARD | VEGAS | OXFORD |
|---|---|---|---|
| M01 Czat | H1.10 | F1(A5)+F2 SPEC-K | O5.4 Teresa |
| M02 Canvas | (bez otwartych bugów) | F2 | O5.3 |
| M03 My Work | H1.5 · H6.5 | F1(A1) ✅br | — |
| M04 Notatnik | H6.5 | F2 | — |
| M05-M09 Ideas | H2.1-4,15 · H4.1-2 | F2 (wzorzec MM) | — |
| **M10 Wywiad** | **H6.1 STT** | F1(A2) | **O5.6 pytania** |
| **M12 Audyty** | **H3.8 orkiestrator** | F1(A2) | — |
| M12A Tools | H3.1-2 · H1.4 | F1(A2)+F2 | O3 (19) · O2.3 |
| M12B Assessmenty | H3.3-5,7 · H1.3 | F1(A2)+F3 | O1 (24) · O2.2 |
| M13 Inicjatywy | H4.4 · H1.5-6 | F1(A3) ✅br | O5.1 · O7.2 |
| M14 Wdrożenie | H1.6-7 · H6.13 | F3 | — |
| M15 Rezultaty | H2.5-8 · H1.7-8 | F1(A4) ✅br + F3 motyw | O2.4 |
| M16 Finanse | H1.8-9 · H2.9-10 | F3 kreator | O4 (7) |
| M17 Materiały | H1.11 · H4.5 | F1(A5)+F6 dokumenty | O2.5 |
| M23/M24/M25/M27 | H2.11-14 · H6.9-10 | F3 huby | O8 pomoc |
*(„✅br" = gotowe na branchu, czeka na merge+odbiór. Macierz aktualizowana przy zmianach list.)*
> Uwaga porządkowa: numeracja modułów ma dwa systemy — mapa V2 (M11=Narzędzia) vs pakiety (M12A Tools/M12B Assessmenty to ta sama powierzchnia). Obowiązuje nazewnictwo pakietów; alias odnotowany, żeby nic nie zginęło między mapami.

### MACIERZ WŁAŚCICIELSTWA (kto co robi mechanicznie)
| Rola | Robi | NIE robi |
|---|---|---|
| **Piotr** | decyzje · sesje odbiorowe wg kart · sign-offy wzorców | kodowanie, planowanie szczegółowe |
| **Strateg (ta sesja)** | plany+liczniki (jedyny edytor) · karty sesji · orkiestracja · audyty · zapisy do §C | kod produkcyjny (poza koordynacją) |
| **Cloud (sesja wykonawcza)** | kod: bugi, spiny, mechanika, wzorce · raport do §A | edycja planów/liczników · deploy prod |
| **Agenci-fale (A1-A5+)** | równoległe zakresy w worktree wg zleceń `_AGENCI/` | merge do brancha bez bramki |

### Po A+B+C → OCENA FINAŁU (wspólnie)
Jeden dataset demo przechodzi trzy bramki jakości: funkcjonalną (HARVARD), wizualną (VEGAS), konsultingową (OXFORD). Potem: dokumentacja produktu, onboarding zespołu Piotra, decyzja PROD (D-G), plan utrzymania.

## 2. SYSTEM SPRINTÓW (operacyjnie)

```
DZIEŃ = 4 sprinty
┌──────────┬──────────────────────────────┬───────────────────────────┐
│ Sprint N │ AGENCI BUDUJĄ (2-4h)         │ SESJA PIOTRA (30-60 min)  │
│          │ równolegle: tor HARVARD      │ karta odbioru przygotowana │
│          │ + tor VEGAS (worktree)       │ przez Claude               │
└──────────┴──────────────────────────────┴───────────────────────────┘
Po sesji: wyniki → tablica §C → plan sprintu N+1 (Claude).
```
- **Każdy sprint ma z góry:** cel budowy (co agenci dowożą) + cel odbioru (co Piotr klika).
- **Kartę sesji** Claude wystawia PRZED sesją do `_KARTY_SESJI/` (SESJA_<data>_<nr>.md).
- **Nic nie idzie do odbioru bez dowodu działania** (probe D-J tam, gdzie klik nie wystarcza).
- **Prognoza:** przy 4 sprintach/dzień i pełnej równoległości — **~2-3 tygodnie** na domknięcie obu projektów. Aktualizowana codziennie w §4.

## 2b. POLITYKA MODELI (zarządzenie Piotra 2026-07-01 — optymalizacja kosztu tokenów)
**Zasada:** najtańszy model, który NA PEWNO udźwignie zadanie; przy wątpliwości — poziom wyżej; **bramki jakości zawsze na Fable**. Wzorzec pracy = „kanapka": **Fable projektuje → Opus/Sonnet wykonuje → Fable weryfikuje przy bramce.**

| Model | Rola | Zadania (przykłady z list) |
|---|---|---|
| **FABLE 5** (najmocniejszy — oszczędnie, tam gdzie myślenie) | Strateg/architekt + trudne przypadki | orkiestracja programu (ta sesja) · architektura spin łańcucha (S6.1, DEC-1..4) · wzorzec Editor Shell (przebudowa 3000-liniowego workspace) · wybór technologii prezentacji · projekt CONCLUSION_LAYER_STANDARD · kanon DRD (metodyka flagowca) · bugi o niejasnej przyczynie (audit-emitter, API-keys) · diagnozy wydajności · przeglądy sceptyka i sign-off przed sesjami Piotra |
| **OPUS** (koń roboczy) | kodowanie wg jasnej specyfikacji | bugi H2 ze znaną przyczyną · rozjazd shella na 6 edytorów (wzorzec istnieje) · fale VEGAS (tokeny wg standardu) · probe'y D-J · handoff B1b · Panel Health · Fala 6 implementacja szablonów · merge/integracje/testy · mechanika H3 |
| **SONNET** (treści i lżejsze) | content + masówka językowa | treść q-banków (wg struktury z Fable) · teksty raportów wnioskowych · prompty AI (treść) · pomoc/edukacja O8 · i18n tłumaczenia · empty-states copy · drafty kart sesji · proste sweepy/inwentaryzacje |
| **HAIKU** (grosze) | trywialna mechanika | walidacje list/liczników · proste greppy statusowe · porządkowe przenosiny plików |

**Reguły twarde:** (1) treść merytoryczna Sonneta ZAWSZE przechodzi review Fable przed pokazaniem Piotrowi (filar KOMPETENTNI nie może być tani w weryfikacji). (2) Zadanie, które Opus dwukrotnie oddał źle → eskalacja do Fable, nie trzecia próba. (3) Model zapisywany w zleceniu agenta (`_AGENCI/`).

## 3. KOLEJKA NAJBLIŻSZYCH SPRINTÓW (żywa — Claude aktualizuje)
> Kolumna „Tor HARVARD" = wspólny tor budowy merytoryczno-technicznej; zadania OXFORD (O*/S7.*) płyną tym samym torem budowy, rozliczane pod DoD OXFORDU.

| Sprint | Tor HARVARD (budowa) | Tor VEGAS (budowa) | Sesja Piotra (odbiór) |
|---|---|---|---|
| **S1** | probe'y D-J dla M15/M16/M24 + start bugów P0/P1 (M05 foldery, M24 add-member/audit) | **domknięcie merge Fali 1**: A2/A5 dokończenie + scalenie A1/A3/A4 (gotowe, czekają) + czyszczenie danych testowych (STAGE-BLOCKER) + deploy demo + `vite build` | **SESJA 1 = Fala 0+1 runda 1** (fundament + nowe listy: My Work ×6, Inicjatywy, Rezultaty/Finanse, Materiały-huby) — karta w `_KARTY_SESJI/` |
| **S2** | handoff M14→M15 + M16 grounding | wzorzec Mind Map — strefy GÓRNA/PRAWA (D-I) | **wzorzec Mind Map sign-off** (karta wg editor-shell-canon) |
| **S3** | Excel generator — przebudowa (dane+formatowanie) | rozjazd shell na M07/08/09 + Fala 2 start (artefakty/edytory) | **Ideas po nowym shellu** (M06-M09 jednym przejściem) |
| **S4** | M13 generator redesign — projekt przepływu | Fala 2 c.d. (edytory dokumentów, Chat SPEC-K) | **M13 nowy przepływ** + Excel po przebudowie |
| **S5-S6** | **S7.1 DRD raport+mapa (P0)** + S6.1 rejestr deliverables + S6.3 dedup M17 | Fala 3 (huby/instrumenty) | **DRD raport** (czy podpisałbyś przed klientem?) + M17 po sprzątaniu |
| **S7-S8** | S7.2 CONCLUSION_LAYER + raport wnioskowy SIRI/ADMA · S6.2 Tools→Inicjatywy · S6.4 Finance grounding | Fala 4 (hartowanie) | raporty wnioskowe + finanse ugruntowane |
| dalej | PPTX premium · S7.3 q-bank · S7.4 business case · Tools 19 · AI-guidance · M27 · M25 fasady | Fala 5 (light+P3) | rundy per fala + finalny TEST ZAUFANIA (3 filary) |

## 4. PROGNOZA I STAN (Claude aktualizuje po każdym sprincie)
- **2026-07-01:** plan ustanowiony. **Stan Fali 1 (inwentaryzacja):** A1 (My Work, 8 tabel) · A3 (Inicjatywy/Execution/Portfolio, 11 plików) · A4 (Rezultaty/Finanse/Admin-listy) = **GOTOWE na branchach `reskin/A*/wave-1`, NIEZMERGOWANE** (czekają na bramkę G0 = odbiór fundamentu przez Piotra); A2 (Interview/Tools/Assessment) i A5 (Materiały/Chat) = w toku. Blokery sesji 1: merge + czystość danych demo.
- **2026-07-01 (po audycie koncepcyjnym):** dodane strumienie 6-7 (spiny łańcucha + warstwa wniosków) = ~30-40% więcej pracy niż pierwotny backlog. **Prognoza skorygowana uczciwie: ~3-4 tyg.** przy 4 sprintach/dzień. Świadomy wybór: szybsza wersja bez strumienia 7 oblałaby test „czy pokazałbym to klientowi" — czyli nie byłaby końcem.

## 5. HIGIENA DOKUMENTACJI (żeby nie zgubić kontekstu)
- **Punkt wejścia:** TEN plik. Tablica `_KOORDYNACJA_CLAUDE_PIOTR.md` = koordynacja agentów. `ARTIFACT_ANATOMY_STANDARD.md` = SSOT wyglądu. `editor-shell-canon.md` = SSOT powłoki edytorów. Macierz `_STAN_PRACY_ODBIORY.md` = stan modułów.
- **Inwentaryzacja zrobiona (2026-07-01):** katalog ma ~150 plików .md. **ŻYWE autorytety:** ten plik · tablica koordynacji · `ARTIFACT_ANATOMY_STANDARD.md` · `editor-shell-canon.md` · `_STAN_PRACY_ODBIORY.md` (macierz) · `_PLAN_5AGENTOW_FALE_2026-07-01.md` (kontrakt fal Vegas) · `_ANALIZA_STAN_I_PLAN_100_2026-07-01.md` (diagnoza) · `_PAKIETY_ODBIORU/` · `_AGENCI/`. **DO ARCHIWUM (za zgodą Piotra, nic nie kasujemy):** `_W2_BLUEPRINTS.md` (pokryty nowszymi planami) · seria `_GOTOWOSC_M*.md` (treść przeniesiona do pakietów) · `_PLAN_OSTATNIE_8PCT_2026-06-18.md` · serie `M*-AUDYT/M*-RAPORT/M*-PLAN` z 18-24.06 (zamknięte raporty etapów) · raporty nocne z datą. Wykonanie przenosin = zadanie sprintu S1 (Cloud), po „tak" Piotra.
- **Karty sesji** → `_KARTY_SESJI/` — jedna na sesję, z wynikiem.
- Reguła: nowy dokument powstaje TYLKO jeśli żaden żywy go nie pokrywa.
