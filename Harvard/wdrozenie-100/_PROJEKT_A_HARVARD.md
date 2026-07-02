# PROJEKT A — HARVARD · filar NIEZAWODNI („działa i płynie")

> **Nadrzędny:** `_FINISZ_MASTER_PLAN.md` · **Metoda:** 5 zasad planowania (plan od końca · zamknięte listy · ✅ tylko z dowodem+odbiorem Piotra · kod przed planem · jeden właściciel/rytm).
> **Stany:** ⬜ nie zaczęte · 🟡 w budowie · ✅ odebrane-z-dowodem (probe D-J i/lub sesja Piotra). Procent = ✅/wszystkie, liczony mechanicznie.
> **Aktualizacja:** tylko Claude, tylko na granicy sprintu. Stan na 2026-07-01.

## DEFINICJA KOŃCA (od tego planujemy)
HARVARD = ✅ gdy: (1) wszystkie pozycje list H1-H6 = ✅ · (2) 11/11 przejść łańcucha działa z dowodem · (3) zero P0/P1 · (4) Panel Health zielony dla GA-setu · (5) Piotr odebrał każdy moduł GA-setu.

## H1 — ŁAŃCUCH DANYCH (11 przejść — zamknięta lista)
| # | Przejście | Stan | Uwaga |
|---|---|---|---|
| 1 | Wywiad/Czat → Insights | ✅ | auto, potwierdzone audytem |
| 2 | Insights → Inicjatywy | ✅ | auto (handoffFinding) |
| 3 | Assessment → Inicjatywy | 🟡 | istnieje ręcznie (promoteWorkbench); docelowo jawny krok w raporcie |
| 4 | Tools → Inicjatywy | ⬜ | callback bez handlera — S6.2 |
| 5 | Ideas → Inicjatywy (convert) | 🟡 | działa ręcznie; brak back-ref źródła |
| 6 | Inicjatywy → Execution | 🟡 | ręczne „Start Execution" — OK jako jawny krok; dodać dowód |
| 7 | Execution(DONE) → Rezultaty | 🟡 | ZAPIS ZBUDOWANY (worktree `43c88a69fc`, testy 8/8): DONE→`initiative_benefits` z `source_tag=M14_CLOSURE_HANDOFF`, fail-safe, dedup (unique index), migracja 783. WAŻNE ODKRYCIE: nazwy ze spec (benefits_register/M14HandoffInbox) były ASPIRACYJNE — nie istniały w kodzie (wzorzec „gap-reports overstate"); zrealizowano intencję na realnych bytach. CZYTNIK TEŻ ZBUDOWANY (worktree `3cc0a0588d`, testy 9/9+4/4): 3 endpointy v8/results (inbox/promote-z-dedup/dismiss) + komponent M14HandoffInbox + zakładka „Incoming benefits" w ResultsHub. **Cały łańcuch #7 = zapis+odczyt gotowe, czeka merge+odbiór** |
| 8 | Rezultaty ↔ Finanse (reconciliation) | ⬜ | bug jednostek OEE; mapowanie KPI do naprawy |
| 9 | Statements → Model (grounding) | 🟡 | ZBUDOWANE (worktree `a925376568`, testy 8+24/24): DEC-3 zrealizowane — tworzenie modelu DOMYŚLNIE gruntuje na najnowszym Approved packu („Start from zero"=świadomy opt-out z ostrzeżeniem) · badge „Grounded on: <statement>" (naprawiony realny bug: pack-grounded pokazywał „Manual") · NOWY endpoint refresh-from-source (legacy+v8, świeży seed wygrywa, edycje usera przeżywają). Odkrycie: backend seedowania JUŻ ISTNIAŁ — luka była w UI-defaultach. Czeka merge+odbiór |
| 10 | Czat/Teresa → Deliverable (canvas) | ✅ | auto |
| 11 | Deliverable → M17 rejestr+back-ref | 🟡 | **S6.3 dedup+filtr ZBUDOWANY** (worktree, 32/32 testów): kolumna `is_draft`+migracja+guard runtime, domyślnie tylko realne, toggle „Pokaż robocze" (hub+generator krok 1), dedup prezentacyjny z licznikiem wersji, zero kasowania. ZOSTAŁO: S6.1 back-ref rejestr (skąd pochodzi artefakt) + kasacja ~39 śmieci za zgodą Piotra |
**Licznik H1: 3/11 ✅**

## H2 — TWARDE BUGI (zamknięta lista z odbiorów)
| # | Bug | Stan |
|---|---|---|
| 1 | M05 foldery nie zapisują | 🟡 naprawione w worktree (`8cf4ebc618`): przyczyna = fallback kolumn `my_ideas` bez `folder_id` + WIECZNY cache schematu robiony PRZED migracją → PUT 200, a zapis cicho pomijany; fix = kolumny w fallbacku + `clearSchemaCache()` po migracjach (chroni też inne tabele!); tsc 0 błędów, build zielony |
| 2 | M05 pułapka folderu (brak wyjścia + zły empty-state) | 🟡 naprawione w worktree: breadcrumb „‹ Wszystkie › 📁 Folder" + kontekstowy empty-state + pigułki folderów widoczne we wszystkich stanach pustych; testy 2/2 |
| 3 | M06 routing: Mind Map otwiera Process Flow | ⬜ |
| 4 | M06/Ideas context-menu z-index | ✅ (portal, live demo) |
| 5 | M15 OEE jednostki (+162252%) | 🟡 naprawione w worktree (`e7b5a1aa61`): przyczyna = reconciliation porównywał % KPI z kwotami € (unit nie przechodził do warstwy); teraz unit respektowany, dla niemonetarnych wariancja nie jest fabrykowana; format wg jednostki (85% nie €85). Testy 8/8+2/2 |
| 6 | M15 wykresy nie renderują | 🟡 naprawione: Contributions = słupki wokół linii zera (było: normalizacja dawała 2 pełne paski); Plan-vs-Realized = grouped bars (było: flex-col zwijał do 2%); kolory = tokeny c-tag |
| 7 | M15 panel KPI rozjechany + baseline „5 3" | 🟡 naprawione: grid 4-kolumnowy na wąskim drawerze łamał wartości; teraz responsywny + truncate + tabular-nums + tokeny |
| 8 | M15 Lineage duplikaty + „unknown" | 🟡 naprawione: dedup po id + etykiety COALESCE (nowy resultsLineage.ts, testy 5/5); backend wzmocniony |
| 9 | M16 kreator full-screen bez nawigacji | 🟡 naprawione w worktree (`a925376568`): wizard renderuje się WEWNĄTRZ layoutu (sidebar+topbar widoczne) + breadcrumb `‹ Finance / Import` |
| 10 | M16 tytuł kreatora pod logo | 🟡 rozwiązane fixem #9 (nagłówek h2 w content-region, brak kolizji z logo) |
| 11 | M24 Add member nie działa | 🟡 naprawione w worktree (`0062ab7356`, testy 5/5: guard roli z fallbackiem + walidacja email + widoczny baner błędu/sukcesu + czytelny komunikat USER_NOT_FOUND→invite-code); czeka merge+deploy+odbiór |
| 12 | M24 audit-emitter (admin-akcje nie logują) | 🟡 naprawione w worktree (`cda25baac8`, 16/16 testów): 3-warstwowa przyczyna (org_id tylko w metadata→over-fetch 0/0 · NOT NULL resource_type · CHECK status) + emisje wpięte w API-keys i AI-settings; filtr org na SQL bez wycieku między-tenantowego |
| 13 | M24 API keys false-no-access (Owner) | 🟡 naprawione w worktree (`1f86385228`, Fable): przyczyna = case-sensitive `status='ACTIVE'` w orgContext (DB miała `active` lowercase); fix `UPPER(status)` ×4 zapytania; 8/8 testów (3 pinują fix), zero poluzowania, promień rażenia tylko /api/api-keys |
| 14 | M24 AI-Controls audit fetch fail | 🟡 naprawione w tym samym worktree: endpoint odrzucał rolę OWNER (403) + zwracał obiekt zamiast tablicy (crash .filter); teraz owner/admin tej org 200+tablica, member/cross-org nadal 403. KOREKTA WIEDZY: `/api/audit-logs` NIE jest martwym stubem (używa go org-context lineage) — zostawiony |
| 15 | M06-UI3 command row nad panelem profilu (z-index) | 🟡 naprawione w worktree (`24327c288d`): nagłówek MainLayout bez kontekstu warstw → `relative z-50`; minimalna zmiana |
| 16 | M08 rail-undo | ✅ (T2.2, live) |
| 17 | M24 PATCH roli działa tylko z `user_id`; z membership `id` → 404 MEMBER_NOT_FOUND (znalezione probe'em 2026-07-01) | 🟡 naprawione w worktree (`24327c288d`, testy 6/6): resolucja po obu id; **BONUS: ten sam latentny bug naprawiony w removeMember**. + „Failed to load task" = realny bug zakresu (lista pokazuje wszystkie taski, detail filtrował tylko personal → 404 dla tasków z inicjatyw); fix + czytelny stan „nie znaleziono" |
**Licznik H2: 2/17 ✅** *(nowe bugi z sesji dopisywane — lista rośnie tylko przez odbiory)*

## H3 — MECHANIKA TOOLS/ASSESSMENTÓW/GENERATORÓW (niezawodność sesji)
| # | Element | Stan |
|---|---|---|
| 1 | Tool-sesja e2e (start→zapis→wznowienie→outputs) na wzorcu SWOT z dowodem | ⬜ |
| 2 | Rozjazd mechaniki na 19 Active (checklista per tool po wzorcu) | ⬜ |
| 3 | Assessment e2e DRD (sesja→scoring→zapis→wynik) z dowodem | ⬜ |
| 4 | Assessment e2e SIRI | ⬜ |
| 5 | Assessment e2e ADMA (odbramkowany T3A — live-verify) | ⬜ |
| 6 | Pipeline generatora doc/deck/sheet stabilny (timeouty, retry, statusy) | 🟡 |
| 7 | CMMI/LEAN zablokowane przed startem sesji (uczciwe „wkrótce") | ⬜ |
| 8 | M12 Audyty (orkiestrator ankiet — fan-out przez szablony wywiadów) e2e mechanika + odbiór — **złapane macierzą pokrycia, wcześniej w ŻADNEJ liście** | 🟡 ZWERYFIKOWANE (`e6c49a70b1`): mapa przepływu = kreator/fan-out(SEC-3)/zbieranie/rollup DZIAŁAJĄ; pierwszy REALNY e2e na sqlite 5/5 + naprawiony test-rot FE 12/12; „klasyków repo" NIE znaleziono (kod solidny). Do ✅: 10-min live-smoke na sesji |
**Licznik H3: 0/8 ✅**

## H4 — REDESIGNY PRZEPŁYWÓW (logika/układ; wizual=VEGAS)
| # | Element | Stan |
|---|---|---|
| 1 | Editor Shell D-I: wzorzec Mind Map (strefy) → sign-off Piotra | 🟡 |
| 2 | Rozjazd shell: Process Flow · Tabela · Whiteboard | ⬜ |
| 3 | Rozjazd shell: 3 edytory dokumentów | ⬜ |
| 4 | M13 generator inicjatyw: nowy przepływ create→DRAFT→dokument→timeline | ⬜ |
| 5 | M17 wejście generatora: IA kroku źródeł (grupowanie, bez dwóch paradygmatów) | ⬜ |
**Licznik H4: 0/5 ✅**

## H5 — WYDAJNOŚĆ I STABILNOŚĆ (znane ogniska — zamknięta lista)
| # | Element | Stan |
|---|---|---|
| 1 | Wolne ładowanie modelu M16 (skeleton+przyczyna) | ⬜ |
| 2 | Timeouty ciężkich operacji (audyt limitów po fixie 120s) | 🟡 |
| 3 | N+1 / latencja list (po fixie puli 40 — pomiar i domknięcie) | 🟡 |
| 4 | Strażnik regresji v8 mutacje (test kanaryjny — 2× wracało) | ⬜ |
| 5 | Snapshot rebuilds fire-and-forget — weryfikacja pozostałych mutacji | 🟡 |
| 6 | Semantyka capacity (backend): `allocatedHours` = dożywotni backlog vs 1-tygodniowa pojemność → absurdy typu 512% | 🟡 NAPRAWIONE (`53ad24e6ea`, 8/8): allocated = tylko taski z due w bieżącym oknie pon-nd; nieharmonogramowane → NOWE pole `backlogHours` obok (nie wliczane); kontrakty addytywne, konsumenci zaktualizowani. Przykład: było 380% → jest 80% + „120h backlogu nieharmonogramowanego" |
**Licznik H5: 0/5 ✅**

## H6 — OPERACJE I PRZEKROJE (13 tematów ze sweepa — zamknięta lista)
| # | Temat | Stan |
|---|---|---|
| 1 | M10 Wywiad: server-STT verify (P0 — utrata głosu) | 🟡 ROZSTRZYGNIĘTE (`08e080e43b`, 11 testów): ścieżka danych + fail-safe FE JUŻ BYŁY poprawne (interim-flush obecny; transkrypt przeglądarki zapisuje się nawet gdy serwer padnie) — realna luka była DIAGNOSTYCZNA: `/voice/health` sprawdzał tylko OPENAI_API_KEY i kłamał „unavailable" gdy STT działa przez Gemini. Fix: detekcja providera OR (OpenAI/Groq/Gemini), health z `requiredEnv`, warning startowy. Weryfikacja na demo: GET /api/voice/health |
| 2 | i18n PL/EN resztki (isPolish→t(): M13/M17/M01/M18/M20/M02) | 🟡 M13+M01 skonwertowane (worktree `697224e60d`+`dcb8703f39`, Sonnet: 46 konwersji, 31 kluczy, gate=0 braków; residuum uczciwie sklasyfikowane: kody locale+config-objects wymagają refaktoru modelu danych, nie forsować). Zostały M18/M20/M02 + decyzja o residuum |
| 3 | Spójność powiadomień (po historii dubli) | 🟡 |
| 4 | Standard obsługi błędów (fail-soft; koniec gołych 500) | ⬜ |
| 5 | RBAC/bramki ról jawne (M03/M04 + sweep) | ⬜ |
| 6 | Higiena CI/testów (tests/ -f, martwe testy, src/__tests__) | 🟡 |
| 7 | Deploy pipeline + monitoring (D-J: probe'y → Panel Health) | 🟡 **PANEL HEALTH ZBUDOWANY** (`fab72c4653`, 20/20): 6 probe'ów round-trip (M15 KPI/ROI · M16 grounding-kontrakt · M24 walidacja+audyt · M17 filtr · M14→M15 handoff) + rejestr registry-driven („dodaj obiekt do tablicy — routes/panel same się dowiedzą") + sekcja Health w Panelu Administratora (lampki 🟢/🔴, Re-run) + bramka env (NIGDY na prod). Czeka merge (intencje rekonsyliacji spisane) |
| 8 | Beta-gating spójność (badges vs realny dostęp) | 🟡 |
| 9 | M25 fasady: urealnić albo ukryć (~8 paneli) | ⬜ |
| 10 | M27 SuperAdmin: wejście → pakiet → odbiór | ⬜ |
| 11 | Czystość danych demo (duplikaty, smoke-testy) — STAGE-BLOCKER | ⬜ |
| 12 | Wyszukiwanie globalne — zweryfikować stan i decyzja zakresu v1 | ⬜ |
| 13 | Eksport PDF (M14 „PDF"=MD itd.) — mechanika | ⬜ |
| 14 | Kanoniczny dataset demo (Atelier Toys — istnieje w docs/demo/): seed + utrzymanie jako podstawa odbiorów i Testu Zaufania | ⬜ |
| 15 | D-K rozstrzygnięte: **M10 Wywiad WCHODZI do GA-setu** (default CTO zastosowany na polecenie „plany mają pokrywać całość"; odwracalne słowem Piotra). Warunek pracy = H6.1 STT-verify | ✅ |
**Licznik H6: 1/15 ✅**

## KOLEJNOŚĆ
S1: H6.11 + H2 paczka (1,2,11,12,13) + probe'y D-J → S2: H1.7 + H1.9 → S3: H4.1 sign-off + H1.11 → dalej wg kolejki Master Planu §3. Bramki: nic nie rozjeżdżamy bez wzorca; ✅ tylko po sesji/probe.

**HARVARD RAZEM: 6/60 ✅ (10%)** — uczciwy stan startowy wg nowej metody (poprzednie „~80% testowo" liczyło inne rzeczy inną miarą). Aktualizacja 2026-07-01: +H3.8 (M12 orkiestrator, z macierzy pokrycia) · +H6.14 (dataset) · H6.15 ✅ (D-K: M10 w GA).
