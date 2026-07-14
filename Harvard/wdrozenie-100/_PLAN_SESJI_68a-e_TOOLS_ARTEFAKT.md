# PLAN SESJI #68a-e — Tools jako artefakt: struktura AI, role, wersje

> Dokument PLANISTYCZNY (nie wykonanie). Cel: przygotować sesję projektową (prawdopodobnie Fable-L,
> analogicznie do #57 dla Insight), zebrać co trzeba zaprojektować, jakie pytania wymagają decyzji
> Piotra, jaki byłby zakres realizacji per pod-temat i w jakiej kolejności robić.

---

## 0. ŹRÓDŁO — gdzie #68a-e zostało zapisane

`Harvard/wdrozenie-100/_PRZEGLAD_DOMOWY_WYNIKI_2026-07-10.md`, linie 895-942 (sekcja „MODUŁ: TOOLS").
Poprzedzone kontekstem Z72-SYS (linie 895-900): Tools/Assessment to ARTEFAKTY-obiekty, powinny mieć
kanoniczną powłokę SPEC-A + zarządzanie kartami (Sections) + właściwy archetyp.

Cross-ref w `_ROZLICZENIE_1-88_2026-07-12.md`:
- linia 127: `#68a-e | Tools=artefakt, struktura AI, role, wersje | ⚪ | Sesja Fable | L` — status ⚪ (nie
  zaczęte), rozmiar **L**, metoda **Sesja Fable**.
- linia 128: `#68b | Tools▸Initiatives wspólny Wizard | ✅ | dedup-parity na demo | S` — **UWAGA: #68b ma
  DWA różne opisy w źródłach** (patrz §1.2 niżej) i jest oznaczone ✅ oddzielnie od reszty litery a-e.
- linia 305 (kubeł decyzji Piotra, ~9 pozycji): „#65-67/#68a-e silnik treści Tools (zakres)" — nadal
  otwarte jako pytanie o ZAKRES, mimo że #68b formalnie zamknięte.

**Rozbicie liter (dosłowne cytaty Piotra z przeglądu domowego):**

| Litera | Tytuł | Jedno zdanie Piotra |
|---|---|---|
| **#68a** | Domknięcie TOOLS — dwa fronty | „musimy wypracować ZARÓWNO formułę graficzną współpracy, JAK i całą MERYTORYKĘ dokończyć" |
| **#68b** | Tools ▸ Initiatives — wspólny Wizard | „dokładamy TEN SAM Wizard związany z budową inicjatyw... dziś inicjatyw brak" |
| **#68c** | Struktura pracy z AI = jak w Insight | „w KAŻDYM oknie możemy używać AI, ale też AI może rozpisać CAŁY tool, a później poprawiamy ręcznie i znowu uzupełniamy AI" + „musi móc być wysłany do stworzenia RAPORTU" |
| **#68d** | Proces tworzenia narzędzia przypisany do ról | „ktoś inny TWORZY, ktoś inny ZATWIERDZA... nie wiem czy jest w tym sens" (Piotr sam sygnalizuje niepewność) |
| **#68e** | Reports & Presentations — wersjonowanie + archiwizacja + filtrowanie | „tworzymy coś, później generujemy KOLEJNĄ WERSJĘ... + archiwizacja... + filtrowanie" — domyka wizję „narzędziówki konsultanta" |

---

## 1. WAŻNE ZASTRZEŻENIE — kolizja nazw „12 narzędzi" vs „Tools"

Zlecenie tego planu zakładało, że #68a-e dotyczy „12 narzędzi Discovery (Mind Map, Process Flow,
Whiteboard, itd.)" wg `_FORMULA_MENU_NARZEDZI_12.md`. **To założenie jest niepoprawne — trzeba je
skorygować, żeby sesja projektowa nie ruszyła złego zakresu.**

### 1.1 Dwa różne inwentarze w dokumentacji, ta sama liczba „12"

- `_FORMULA_MENU_NARZEDZI_12.md` — katalog **12 ogólnych typów artefaktów** produktu: Mind Map/Process
  Flow/Whiteboard/Idea Table (My Work/Ideas) + Notatnik + Insight/Initiative/Task/Decision (Karty N) +
  Word/Excel/PowerPoint (Generatory). To jest formuła menu/przycisków dla CAŁEGO produktu, nie moduł
  „Tools".
- Moduł **„Tools" / „Discovery Tool"** dyskutowany w #63-68 to **31 ramowych narzędzi konsultingowych**
  (frameworki typu Dynamic SWOT, Market Forces, Growth Paths, Value Chain, Portfolio Priority, Risk &
  Uncertainty, Capability Mapper, Ambition Decomposer, Focus Tradeoff, Narrative Engine, SOP Builder, A3
  Problem Solving, VSM Builder, Constraint Control, Decision Engine, Control Tower, Automation Pipeline,
  SMED Planner, DMS Builder, Inventory Autopilot, Robotics Feasibility, Logistics Automation, RPA
  Scanner, AI Discovery, Integration Diagnostic, Digital Value Pool, Legacy Analyzer, Data Inventory,
  Pain-to-Solution, Pain Explorer, Process Automation).

### 1.2 Dowody z kodu

- `ARTIFACT_ANATOMY_STANDARD.md` §4 (mapa 40 artefaktów), wiersz: **„Discovery Tool (31 narzędzi) | A
  Canvas | L | serce konsultingu — priorytet"** — jeden wiersz, jeden archetyp, dla całej rodziny 31
  narzędzi.
- `server/migrations/620_tool_assets.sql` — seeduje 31 `tool_slug` (dynamic-swot … process-automation) ×
  3 typy assetów (thumbnail/micro_video/preview_graphic) = potwierdzenie listy 31.
- `src/config/consultingToolsStandard.ts` — `CONSULTING_TOOL_LIFECYCLE` (library→session→outputs→
  initiatives), `CONSULTING_TOOL_RUNTIME_STAGES` (entry→conversation→context→analysis→conclusions→
  summary→outputs) — pasuje 1:1 do zrzutu Piotra z #68a (SESSION/ANALYSIS/OUTPUTS/COLLABORATION).
- Frontend: `src/components/DiscoveryTools/` (nie „Tools12" ani nic podobnego) — `ToolWorkspace.tsx`,
  `ToolWizardView.tsx`, `ToolCanvas.tsx`, `GenerateInitiativesModal.tsx` (dowód #68b), itd.
- Commit #65-67 (`67f6a45bb8`, cyt. w `_ROZLICZENIE`): „narracja Discovery Tools wzbogacona czterotaktem
  W2... w 8 narzędziach fallback" — mówi o narzędziach Discovery Tools (framework), nie o Mind Map.

### 1.3 Konsekwencja dla tego planu

**Ten plan traktuje #68a-e jako dotyczące modułu „Tools" = 31 ramowych narzędzi konsultingowych
(`DiscoveryTools`/`consultingToolsStandard`), NIE 12-pozycyjnego katalogu z `_FORMULA_MENU_NARZEDZI_12.md`.**
Mind Map / Process Flow / Whiteboard / Idea Table / Notatnik / Insight / Initiative / Task / Decision /
Word / Excel / Deck mają WŁASNY, już opisany plan standaryzacji SPEC-A/SPEC-L (`_ROLLOUT_ARTEFAKTY_PLAN.md`,
`_ROLLOUT_TRIADA_INWENTARZ.md`) — nie trzeba go tu duplikować. Jeśli intencja Piotra faktycznie obejmowała
oba zbiory, to pierwsze pytanie sesji projektowej (§4, pytanie P0) musi to potwierdzić.

---

## 2. SPEC-A — czym jest „artefakt" w tym systemie (dla kontekstu sesji)

Z `ARTIFACT_ANATOMY_STANDARD.md`:

- **6 stref powłoki** (§2): Menu 1 (tożsamość+1 primary), Menu 2 (tylko archetyp B), Menu 3 (chipy widoku
  + AI zawsze prawa), lewy rail (narzędzia-czasowniki), prawy panel `ArtifactRightPanel` (accordion: Akcje
  2rz. · Właściwości · Powiązania · Komentarze · Historia/AI — stała kolejność), PPM/kebab (§6.4, stała
  kolejność: Otwórz/Podgląd → Edytuj/Zmień nazwę/Powiel → Eksport/Udostępnij/Kopiuj link/Przenieś → AI →
  Archiwizuj/Usuń).
- **5 archetypów × 2 klasy** (§3): A Canvas / B Dokument / C Rekord / D Matryca / E Deck; klasa S (jeden
  widok) vs L (wiele widoków wewn., M2+M3 aktywne).
- **Discovery Tool = archetyp A Canvas, klasa L** (§4) — czyli: brak Menu 2 (formatowania), pełne Menu 3
  (chipy widoku + AI po prawej), lewy rail z narzędziami canvasu, prawy panel = właściwości węzła/sekcji.
- **§13.3** (instancjacja Archetyp A): bazowa Menu 3 = zoom/dopasuj/minimapa; rail = narzędzia.
- **§18.1 DoD Artefaktu** (czerwone MUST) — odbiór „gotowe" wymaga spełnienia checklisty (nie
  przytaczam całości — patrz plik źródłowy), obowiązkowy krok przy realizacji, nie przy tym planie.

**Co to znaczy dla #68a-e:** zanim zaprojektuje się „strukturę AI/role/wersje" dla Tools, sesja musi
najpierw potwierdzić, że powłoka Tools (`ToolWorkspace`/`ToolCanvas`/`ToolWizardView`) faktycznie mapuje
się na Archetyp A (M1/M3/rail/panel/PPM) — to jest przesłanka #68a-front-1 („formuła graficzna
współpracy") i jednocześnie punkt wyjścia dla #68c (gdzie ma żyć AI-per-okno) i #68d (gdzie ma żyć
bramka twórca→zatwierdzający, skoro M1 ma tylko 1 primary).

---

## 3. REALNY STAN — co już istnieje w kodzie (zweryfikowane, nie z dokumentacji)

> Zasada złota reguła #1: audyty starzeją się w ~3 dni. Poniższe zweryfikowane grepem na
> `origin/demo` 2026-07-14, nie z opisów.

### 3.1 Wersje (tool_sessions) — BRAK

`server/migrations/641_v4_tool_runtime_contract.sql` definiuje `tool_sessions`: `id, organization_id,
project_id, tool_type, name, status, completion_percent, confidence_avg, answers_json,
context_snapshot, review_requested_at, approved_at, created_by, updated_by, created_at, updated_at,
runtime_contract_json, dod_status`. **Brak kolumny `version` i brak tabeli
`tool_session_versions`.** Dla porównania — inne artefakty MAJĄ dedykowaną historię wersji:
`presentation_deck_versions` (migracja 752, P20 — optimistic concurrency + revert), `report_templates.
version` + `report_template_versions` (migracja 654), `my_idea_map_versions` (622). Tools jest jedynym
większym artefaktem BEZ mechanizmu wersji treści sesji.

### 3.2 Role (twórca↔zatwierdzający) — CZĘŚCIOWY SZKIELET

`tool_sessions` ma już `created_by`, `updated_by`, `review_requested_at`, `approved_at`, `status`.
`server/src/routes/my-work.routes.ts:763` robi `add('status', 'APPROVED')` przy zatwierdzeniu — czyli
**bramka DRAFT→REVIEW→APPROVED technicznie istnieje** (kolumny + przejście stanu). Czego BRAK: żadnego
egzekwowania „kto może zatwierdzić" wobec roli — istniejący model ról to `WorkspaceRoleValues =
['owner','admin','editor','viewer','guest']` (`server/src/types/workspaceGovernance.ts`), ogólny na
poziomie workspace, NIE per-narzędzie. Nie ma sprawdzenia w kodzie „czy `approved_by` różni się od
`created_by`" ani konfiguracji „kto ma prawo zatwierdzać sesję narzędzia". To dokładnie odpowiada
niepewności Piotra w #68d („nie wiem czy jest w tym sens") — infrastruktura kolumnowa jest, logika
governance NIE.

### 3.3 Struktura pracy z AI (#68c) — CZĘŚCIOWA, nieskopiowana z Insight

- `runtime_contract_json` (V4-TOOL-02, migracja 641) — typed I/O contract + DoD gates + deterministyczny
  eksport per framework. To jest silnik „merytoryki" (#68a front 2), ale dotyczy STRUKTURY danych, nie
  UX AI.
- `server/src/services/ai/canvasGraphLlm.ts` — silnik LLM-graf zasilający AI w canvasach narzędzi
  (potwierdzony w MEMORY jako pętla 07-08 „root splitter→LLM-graf").
- `AIConsultantPanel` (`src/components/shared/NModeLayout/AIConsultantPanel.tsx`) — komponent WSPÓLNY
  (nie w folderze Insight), już reużywalny — dobra wiadomość dla #68c: „Teresa jako jeden byt AI po
  prawej" może dosłownie zamontować ten sam komponent w Tools.
  - Grep pod kątem wzorca Insight „Fill empty / Synthesize" (generacja CAŁOŚCI jednym klikiem) NIE
    znalazł odpowiednika w `DiscoveryTools/` — wzorzec „AI rozpisuje cały tool" (środkowy człon #68c)
    **nie jest jeszcze przeniesiony**, tylko AI-per-pole/per-karta (`InlineAssist.tsx`,
    `aiCardGovernance.ts` w `DiscoveryTools/`).
  - Export do raportu: `GenerateInitiativesModal.tsx` istnieje (droga Tools→Initiative), ale odpowiednik
    „wyślij tool do stworzenia RAPORTU" (Tools→Report, analog Insight WHAT NEXT) nie znaleziony w
    `DiscoveryTools/` przy tym przeglądzie — do zweryfikowania w sesji, nie zakładać z góry że brak.

### 3.4 #68b (Tools ▸ Initiatives wspólny Wizard) — WYGLĄDA NA REALNIE DOSTARCZONE

`src/components/DiscoveryTools/GenerateInitiativesModal.tsx` istnieje, `ToolInitiativeService.ts`
istnieje po stronie serwera. Zgadza się z ✅ w `_ROZLICZENIE` linia 128 („dedup-parity na demo"). **Do
sesji projektowej #68b NIE wchodzi jako nowy zakres** — jedyne co warto zrobić to szybki live-retest (5
min, poza tym planem) żeby potwierdzić że nie jest to fantom, zanim się to ostatecznie odhaczy.

### 3.5 #68e (wersjonowanie Reports & Presentations) — INFRASTRUKTURA W DUŻEJ MIERZE ISTNIEJE

To największe zaskoczenie audytu: wersjonowanie raportów/prezentacji NIE jest greenfield.
- `presentation_deck_versions` (migracja 752, „P20 Contract Compliance... server-side version history for
  revert capability") + kolumna `presentation_decks.version` (optimistic concurrency, konflikt 409).
- `report_templates.version` + `report_template_versions` (migracja 654) — ale to wersjonowanie
  SZABLONU, niekoniecznie wygenerowanej INSTANCJI raportu (do zweryfikowania w sesji — czy istnieje
  odpowiednik dla samego wygenerowanego dokumentu, nie tylko jego szablonu).
- UI: `src/components/Presentations/DeckBuilder/VersionHistoryPanel.tsx` +
  `useVersionHistory.ts`, `src/components/Reports/Management/VersionHistory.tsx`,
  `src/components/MyWork/notebook/NotebookVersionHistory.tsx`,
  `src/components/assessment/AssessmentVersionHistory.tsx` — wzorzec UI wersji już powtórzony
  wielokrotnie w produkcie (dokładnie tak jak zakładał #68e: „jeden mechanizm wersjonowania w produkcie").
- **Czego prawdopodobnie brak:** (a) archiwizacja jako osobny stan (odróżniony od „wersja nieaktualna"),
  (b) filtrowanie zakres (aktualne/archiwum/wszystkie) + typ (Report/Deck) w Menu 2 modułu Reports &
  Presentations (Z52-SYS „strefa filtrów" — do potwierdzenia czy wdrożone), (c) spięcie z pipeline'em
  Tools→Report (czy REGENERACJA raportu z sesji narzędzia faktycznie tworzy nową wersję, czy nowy
  osobny rekord — ryzyko duplikacji podobne do „dwóch generatorów inicjatyw" #68b/finding_two_initiative
  _generators_divergence).

**Wniosek:** #68e to w większości PORT/ADOPCJA istniejącego wzorca do konkretnego ekranu „Reports &
Presentations" + domknięcie 2-3 luk (archiwizacja jako stan, filtry zakres+typ), NIE budowa
wersjonowania od zera. To zmienia jego wycenę z L na S/M (patrz §4).

---

## 4. PLAN SESJI PROJEKTOWEJ — co zaprojektować, pytania do Piotra, zakres, kolejność

### P0 — pytanie WSTĘPNE (zadać PRZED sesją, blokuje zakres)

> **Czy #68a-e dotyczy modułu „Tools" (31 ramowych narzędzi konsultingowych: SWOT/BMC/Porter/...), czy
> intencja obejmowała też 12-pozycyjny katalog z `_FORMULA_MENU_NARZEDZI_12.md` (Mind Map/Whiteboard/
> Notatnik/Word/Excel/itd.)?** Ten plan zakłada pierwsze (§1.3), na podstawie dowodów kodowych. Jeśli
> Piotr miał na myśli oba — sesja projektowa się podwaja, a druga połowa (12 artefaktów) ma już OSOBNY,
> częściowo zaawansowany plan (`_ROLLOUT_ARTEFAKTY_PLAN.md`) i nie powinna być tu duplikowana od zera.

### #68a — Domknięcie Tools: formuła graficzna + merytoryka (2 fronty)

**Do zaprojektowania:**
1. Mapowanie realnej powłoki `ToolWorkspace`/`ToolCanvas` na 6 stref SPEC-A Archetyp A (M1/M3/rail/panel/
   PPM) — analog tabel z `_FORMULA_MENU_NARZEDZI_12.md` §2, ale dla 31 narzędzi Tools (dziś nieopisanych
   w żadnym pliku formuły — luka do wypełnienia).
2. Rozciągnięcie wzorca współpracy z Dynamic SWOT (Accept/Another proposal/Comment/Think deeper +
   liczniki ACCEPTED/CONFIRMED/TARGET) na pozostałe 30 narzędzi — czy wzorzec jest generyczny (jeden
   komponent współdzielony) czy wymaga wariantów per typ frameworku (macierz 2×2 SWOT vs proces liniowy
   SOP Builder vs sieć VSM).
3. Kryteria „kompletności merytorycznej" per narzędzie (jakość propozycji AI, próg akceptacji punktu) —
   analog #57 (formuła treści kart Insight, 13 typów McKinsey-grade, już domknięte wg commitu
   `86d12cbe91`) — czy da się reużyć tę samą metodykę walidatora treści dla Tools.

**Pytania do Piotra:**
- Czy wzorzec współpracy SWOT (Accept/Another/Comment/Think deeper) ma być JEDEN uniwersalny komponent
  dla wszystkich 31 narzędzi, czy per-kategoria frameworku (macierz/proces/sieć/scoring)?
- Priorytet: który z 31 dostaje wzorzec merytoryczny jako pierwszy (kandydat: te 8 z commitu #65-67, bo
  już mają czterotakt W2)?

**Zakres:** **L** (2 fronty × 31 narzędzi, ale front UI jest w dużej mierze port, front treści to nowy
silnik per-framework — analog Oxford dla Insight).

---

### #68b — Tools ▸ Initiatives wspólny Wizard

**Status: uznane za ✅ dostarczone** (`GenerateInitiativesModal.tsx` + `ToolInitiativeService.ts` na
demo, zgodne z `_ROZLICZENIE` linia 128). **Nie wchodzi do zakresu tej sesji projektowej** poza
5-minutowym live-retestem potwierdzającym (poza tym dokumentem, w ramach `consultify-petla`/
`consultify-test`, nie Fable).

**Zakres:** **—** (weryfikacja, nie projekt).

---

### #68c — Struktura pracy z AI = wzorzec Insight

**Do zaprojektowania:**
1. Port „AI-per-okno" — dziś Tools ma `InlineAssist.tsx`/`aiCardGovernance.ts` (AI per karta) — sprawdzić
   zgodność wzorca z Insight (#33/#55 „AI section") i ujednolicić UX (ten sam komponent czy równoległy
   klon).
2. Nowa funkcja: „AI rozpisuje CAŁY tool" (jak „Fill empty"/„Synthesize" z AI Consultant #56) — dziś
   NIEZNALEZIONA w `DiscoveryTools/`. Do zaprojektowania: co dokładnie generuje AI przy jednym kliknięciu
   dla frameworku typu SWOT (4 ćwiartki) vs VSM (mapa procesu) — różna struktura wyjścia per typ, to nie
   jest jeden uniwersalny prompt.
3. Montaż `AIConsultantPanel` (już współdzielony komponent) jako panel Teresy w Tools — techniczne
   niskie ryzyko (komponent istnieje, port), ale wymaga decyzji UX gdzie w SPEC-A prawym panelu (Akcje/
   Właściwości/Powiązania/Komentarze/Historia-AI) mieści się „Teresa" — analog decyzji D16/D17 już
   podjętej dla idei (panel Teresy ArtifactRightPanel accordion, zaakceptowane 07-13, commit `68c8f74aa1`)
   — **reużyć TĘ SAMĄ decyzję**, nie projektować od nowa.
4. Export do raportu — sprawdzić w sesji czy istnieje ścieżka Tools→Report (nie znaleziona w tym
   audycie, ale audyt nie był wyczerpujący na poziomie routingu); jeśli brak — zaprojektować analog
   Insight WHAT NEXT (#53).

**Pytania do Piotra:** brak nowych — Piotr już dał jednoznaczny kierunek („TA SAMA struktura co
Insight"). Jedyna otwarta rzecz to kolejność wdrożenia per framework (wszystkie 31 naraz czy falami).

**Zakres:** **M** dla portu AI-per-okno + montażu panelu Teresy (bo komponenty i wzorzec decyzji już
istnieją — patrz analogia idei D16/D17); **L** dla „AI rozpisuje CAŁY tool" per 31 frameworków (nowa
logika generacji specyficzna dla struktury każdego frameworku, nie jeden prompt).

---

### #68d — Proces tworzenia narzędzia przypisany do ról (twórca↔zatwierdzający)

**Status: OTWARTE PYTANIE, nie decyzja** — Piotr sam sygnalizuje niepewność. Sesja ma to ROZWAŻYĆ i
zarekomendować, nie wdrożyć.

**Do zaprojektowania (jeśli rekomendacja wypadnie na TAK):**
1. Czy governance per-tool-session powinien być konfigurowalny per organizacja/wielkość zespołu (opcja
   sugerowana w przeglądzie domowym) — jak dziś działa `initiativeGovernanceService` (bramki fazowe
   inicjatyw, żywe wg #74) — czy to dobry wzorzec do skopiowania.
2. Wykorzystanie ISTNIEJĄCYCH kolumn `tool_sessions.review_requested_at/approved_at/status` — one już SĄ,
   brakuje tylko: (a) reguły „kto może zatwierdzić" wobec `WorkspaceRoleValues`, (b) UI bramki w M1
   (Primary = „Zgłoś do przeglądu"/„Zatwierdź", analog Initiative M1 z `_FORMULA_MENU_NARZEDZI_12.md`
   wiersz 7), (c) blokady „prezentacja/raport dopiero po zatwierdzeniu" (powiązanie z #68e/#68c export).
3. Rekomendacja: ponieważ infrastruktura kolumnowa i wzorzec (`initiativeGovernanceService`) już
   istnieją, koszt telefonu jest niski — ale WARTOŚĆ dla małych zespołów wątpliwa (sam Piotr to
   zasygnalizował). Rekomendowane podejście do sesji: **potraktować jako opcjonalny toggle per
   organizacja**, domyślnie OFF (spójne z zasadą „wygląd tylko za flagą" i ogólną ostrożnością programu
   wobec nowych bramek).

**Pytania do Piotra:**
- Czy governance ma sens jako opt-in per organizacja, czy w ogóle odłożyć (KUBEŁ D „odłożone")?
- Jeśli tak — czy to blokuje TYLKO prezentację/raport (jak zasugerował), czy też dalsze edycje sesji po
  zatwierdzeniu (immutable po approve, jak wersje dokumentów)?

**Zakres:** **S** jeśli reużyje się `initiativeGovernanceService` jako wzorzec (kolumny już są) — **ALE
zależne od decyzji Piotra, może wynieść 0 (odłożone) jeśli rekomendacja wypadnie na „nie wdrażać teraz"**.

---

### #68e — Reports & Presentations: wersjonowanie + archiwizacja + filtrowanie

**Do zaprojektowania:**
1. Potwierdzić w sesji (nie zakładać z audytu) czy `presentation_deck_versions` +
   `report_template_versions` faktycznie obejmują wygenerowane INSTANCJE (nie tylko szablony) — to
   kluczowe rozróżnienie zmieniające wycenę.
2. Zaprojektować/potwierdzić stan „zarchiwizowany" jako pole niezależne od wersji (dziś prawdopodobnie
   brak — do zweryfikowania `status`/`archived_at` na `presentation_decks`/tabelach raportów).
3. Filtr zakres (aktualne/archiwum/wszystkie) + typ (Report/Deck/…) w Menu 2 modułu Reports &
   Presentations — sprawdzić zgodność z ogólną doktryną „Z52-SYS spójna strefa filtrów" (czy Reports &
   Presentations ma już taką strefę, czy to nowy ekran).
4. Spięcie z pipeline'em „narzędziówki konsultanta": regeneracja raportu z sesji Tools ma tworzyć NOWĄ
   WERSJĘ tego samego rekordu, nie duplikat — analog ryzyka z #68b (`finding_two_initiative_generators
   _divergence` — dwa generatory inicjatyw rozjechane celowo, ale to lekcja o pilnowaniu dedupu).

**Pytania do Piotra:** brak nowych merytorycznych — kierunek jasny („wersjonowanie + archiwizacja +
filtrowanie"). Jedyne pytanie: czy wersjonowanie ma być WIDOCZNE dla użytkownika jako lista wersji z
możliwością powrotu (jak Deck P20 „revert capability"), czy tylko cichy audit-trail.

**Zakres:** **S/M** (skorygowane w dół z L) — bo istniejąca infrastruktura (`presentation_deck_versions`,
wzorce UI `VersionHistoryPanel` w 5 miejscach produktu) oznacza to głównie PORT + domknięcie 3 luk
(archiwizacja jako stan, filtry, spięcie z pipeline'em Tools), nie budowę wersjonowania od zera.

---

## 5. REKOMENDOWANA KOLEJNOŚĆ SESJI

1. **P0 najpierw** — potwierdzić z Piotrem zakres („Tools" 31 narzędzi vs też 12-katalog) zanim
   cokolwiek się zaplanuje dalej — inaczej ryzyko zaprojektowania niewłaściwego zbioru (analog błędu
   „masowy flip bespoke tables" z 07-12 — zła interpretacja zakresu = kosztowna pomyłka).
2. **#68b** — 5-min live-retest (nie sesja projektowa), zamknąć formalnie jeśli potwierdzone.
3. **#68a front 1 (formuła graficzna)** — zmapować `ToolWorkspace` na SPEC-A Archetyp A, uzupełnić
   `_FORMULA_MENU_NARZEDZI_12.md`-analogiczną tabelę dla 31 narzędzi Tools (dziś nie istnieje — luka).
   To PRZESŁANKA dla #68c (gdzie montować AI) i #68d (gdzie montować bramkę).
4. **#68c** (port AI-per-okno + panel Teresy) — reużywa gotowe komponenty (`AIConsultantPanel`, wzorzec
   D16/D17), niskie ryzyko, wysoka wartość demo („Tools = Insight-grade AI").
5. **#68a front 2 (merytoryka)** — Oxford, per-framework, największy nakład — planować falami (zacząć od
   8 narzędzi z #65-67, które już mają czterotakt W2).
6. **#68e** — równolegle do 4-5 (inny zespół/robotnik, bo dotyczy innego ekranu — Reports & Presentations
   — niska kolizja z Tools UI).
7. **#68d** — na końcu, dopiero po rekomendacji Fable czy w ogóle robić; jeśli TAK, to małe (S) bo
   kolumny DB już istnieją.

**Metoda realizacji (po sesji projektowej):** zgodnie z `CLAUDE.md` — Fable/Opus dla decyzji
architektonicznych (§68a front 2, #68d rekomendacja), Sonnet/Haiku dla portu mechanicznego (#68c AI-per-
okno, #68e domknięcie luk) w pętli `consultify-petla`, świeża gałąź z `origin/demo`, odbiór wzrokiem wg
DoD §18.1 SPEC-A, nic na demo bez akceptacji Piotra na zrzutach.

---

## 6. SKRÓCONA LISTA PYTAŃ DO PIOTRA (do zebrania przed/podczas sesji Fable)

1. **P0:** #68a-e = tylko moduł Tools (31 frameworków), czy też 12-katalog `_FORMULA_MENU_NARZEDZI_12.md`?
2. Wzorzec współpracy SWOT (Accept/Another/Comment/Think deeper) — jeden uniwersalny komponent, czy
   warianty per kategoria frameworku (macierz/proces/sieć/scoring)?
3. Kolejność fal merytoryki (#68a front 2) — zacząć od 8 narzędzi z #65-67, czy inny priorytet biznesowy?
4. #68d — governance twórca↔zatwierdzający: wdrażać w ogóle? Jeśli tak, opt-in per organizacja?
   Blokuje tylko prezentację/raport, czy też dalszą edycję sesji?
5. #68e — wersje widoczne dla użytkownika z „revert" (jak Deck P20), czy tylko cichy audit-trail?

---

## 7. ŹRÓDŁA UŻYTE W TYM PLANIE

- `Harvard/wdrozenie-100/_PRZEGLAD_DOMOWY_WYNIKI_2026-07-10.md` (linie 895-942, źródło #68a-e)
- `Harvard/wdrozenie-100/_ROZLICZENIE_1-88_2026-07-12.md` (linie 124-128, 305, status)
- `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` (§2-4, §13.3, §18.1 — doktryna SPEC-A)
- `Harvard/wdrozenie-100/_FORMULA_MENU_NARZEDZI_12.md` (kontrast — inny inwentarz, nie mylić)
- `src/config/consultingToolsStandard.ts` (lifecycle/runtime stages realnego modułu Tools)
- `server/migrations/641_v4_tool_runtime_contract.sql`, `620_tool_assets.sql`, `752_p20_deck_version_
  and_history.sql`, `654_v4_reports_enterprise.sql` (realny stan DB)
- `server/src/types/workspaceGovernance.ts` (model ról dziś)
- `src/components/DiscoveryTools/*` (realny frontend Tools: `ToolWorkspace.tsx`, `GenerateInitiatives
  Modal.tsx`, `InlineAssist.tsx`, `aiCardGovernance.ts`)
- `src/components/shared/NModeLayout/AIConsultantPanel.tsx` (współdzielony panel AI, kandydat do #68c)
