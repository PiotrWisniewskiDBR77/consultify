# HANDOFF — Agent STRATEG (Harvard) — 2026-06-29

> **Czytasz to jako NOWY agent strategiczny ("Harvard Strateg").** Przejmujesz fotel strategii+koordynacji po poprzedniej, długiej sesji z Piotrem (która kończyła się na limicie kontekstu). Ten dokument = pełen przeniesiony kontekst. **Przeczytaj go w całości, potem dokumenty z §10.**
> **Jak doczytać poprzednią rozmowę (Piotr prosił):** użyj `mcp__ccd_session_mgmt__search_session_transcripts` / `list_sessions` — szukaj fraz: „Editor Shell Canon", „dokończenie 4 tory", „M12A M12B", „Notatnik N8 bookmark", „macierz L1 L2 L3 L4". To była JEDNA wielka sesja: redesign Notatnika → odkrycie luki Tools/Assessmenty → cały program dokończenia.

## 1. KIM JESTEŚ — Twoja rola (4 zadania, ustalone z Piotrem)
Jesteś **mózgiem strategii i koordynatorem**, NIE wykonawcą kodu (od kodu jest Cloud) ani nie asystentem klikania (od tego Pilot). Robisz 4 rzeczy:
1. **Uzupełniasz plan strategiczny Harvard** (dashboard `_STAN_PRACY_ODBIORY.md` + plany niżej) — utrzymujesz prawdę o stanie, dokładasz brakujące obszary, korygujesz staleness.
2. **Zarządzasz pracą w dwóch torach:** koordynujesz **Piotra** (odbiory/decyzje) ⇄ **Cloud** (wykonanie) — przez tablicę `_KOORDYNACJA_CLAUDE_PIOTR.md`. Pilnujesz formuły nie-stojącej, defaultów, priorytetów.
3. **Ustalasz z Piotrem plan na naprawę POWŁOK CAŁEJ aplikacji** (re-skin app-wide) — to GŁÓWNY otwarty temat strategiczny (§9). Piotr: re-skin jest większy niż 7 edytorów, wymaga dyskusji.
4. (wynika z 1-3) Rozmawiasz z Piotrem strategicznie, podejmujesz decyzje CTO, gdy prosi „wybieraj".

## 2. ARCHITEKTURA 3 AGENTÓW
- **Harvard Strateg (TY)** — strategia + koordynacja + plan powłok. Rozmawia z Piotrem. Pisze plany/dokumenty, NIE pcha kodu produkcyjnego (chyba że drobne docsy/koordynacja).
- **Harvard Cloud** — agent wykonawczy. Realizuje Tory 2/3/4 (sweep L1 nawigacja / build L3 Tools+Assessmenty / kręgosłup L4) + D-I contained. Pisze do sekcji A+B tablicy. Prompt startowy = §11.
- **Harvard Pilot** — asystent odbiorowy Piotra. Prowadzi przez odbiory na demo, pisze do sekcji C. Prompt startowy = §11.
- **Medium komunikacji** = `Harvard/wdrozenie-100/_KOORDYNACJA_CLAUDE_PIOTR.md` (sekcja A=Cloud status, B=zadania dla Piotra, C=odbiory/feedback Piotra). Ty czytasz wszystko, koordynujesz.

## 3. SKĄD PRZYSZLIŚMY (kontekst tej rozmowy)
- Sesja zaczęła się od **redesignu Notatnika (M04)**: FAZA 1 UI (N1-N8: hamburger, lewa kolumna, slash premium, floating toolbar) + FAZA 2 funkcje (K1 @mention+dwukierunkowe linki, K1b pasek „Mentioned in", K2 rich bookmark + **SSRF guard** na `/api/link-preview` — naprawione 5 dziur, 2×P0). Wszystko live-zweryfikowane na demo. (Notatnik = wzorzec nawigacji dla reszty.)
- W trakcie Piotr zauważył **brak dwóch obszarów w programie Harvard: Tools consultingowe + Assessmenty digitalne** → dołożone jako **M12A / M12B** (między M12 Audyty a M13).
- To uruchomiło **cały program dokończenia**: skan AS-IS całej apki → macierz L1-L4 → model 4 torów → formuła nie-stojąca → architektura 3 agentów.

## 4. MODEL WYKONAWCZY (4 tory + formuła)
SSOT: [`_PLAN_WYKONAWCZY_DOKONCZENIE_4TORY_2026-06-29.md`](_PLAN_WYKONAWCZY_DOKONCZENIE_4TORY_2026-06-29.md). Strategia: [`_PLAN_DOKONCZENIA_3POZIOMY_2026-06-29.md`](_PLAN_DOKONCZENIA_3POZIOMY_2026-06-29.md).
- **4 tory:** T1 drenaż odbiorów (Piotr) · T2 sweep L1 nawigacja+uprawnienia+flagi (Cloud) · T3 build L3 Tools+Assessmenty (Cloud, WIP=1, długa noga) · T4 kręgosłup L4 integracja (Cloud).
- **Formuła nie-stojąca:** Cloud pcha autonomicznie (też nocą); Piotr odbiera/decyduje kiedy może (NIE gwarantuje 5h/dzień — i OK). **Każda decyzja ma default „brak odpowiedzi 72h → Cloud działa wg rekomendacji" — POZA PROD (zawsze jawna zgoda).**
- **Definicja KOŃCA (GA-v1):** złota ścieżka konsultanta (Czat→Ideas→Assessment→Tool→Inicjatywa→Wdrożenie→Rezultaty→Materiały) działa end-to-end na demo + zestaw GA-v1 zielony + odebrany.

## 5. STAN AS-IS (macierz L1-L4, ground-truth 2026-06-29)
Macierz = sekcja „🔬 MACIERZ 4 POZIOMÓW" w `_STAN_PRACY_ODBIORY.md` (**PRECEDENS nad starszymi sekcjami**). Skan z kodu, 6 agentów, konserwatywnie. Wnioski:
- **L2 (funkcjonalność/backend) MOCNA prawie wszędzie (~80%)** — realne DB/V8, nie fasady. To dobra wiadomość: dokończenie = głównie re-skin+integracja na działającym silniku, NIE pisanie funkcji.
- **L3 (Tools+Assessmenty) = realna duża luka:** Tools 1/~31 pewny e2e (Dynamic SWOT); Assessmenty 2/5→3/5 osiągalne (DRD+SIRI+ADMA).
- **L4 (integracja) najsłabsza:** kręgosłup M13→M14→M15 statusowy nie encja; M14→M15 handoff był martwy; eksport-do-Outputs rozjechany.
- **L1 (nawigacja) rozproszone:** M08 rail-undo (naprawiony), flagi OFF chowają gotowy kod, M03/M04 gate.
- **Korekty starego raportu:** M10 STT P0 NAPRAWIONY · DRD ma raport+mapę (było błędne) · M22=dbr77-internal · M17 tab „Dane" był martwy w FE (ożywiony).
- **M18/M19/M20 = pochłonięte przez M17** (silniki żyją, komponowane; odbiory standalone znikają).

## 6. CO JUŻ ZROBIONE (Cloud kroki 1-7, sekcja A tablicy)
✅ T2.2 M08 rail-undo · ✅ T4.3 tab „Dane" ożywiony · ✅ 11 pakietów odbioru (`_PAKIETY_ODBIORU/`) · ✅ T2.1 kanon nawigacji (`navigation-permissions-canon.md`) · ✅ T3A ADMA odbramkowany (3/5) · ✅ **T2.2-korekta: `ganttBaseline` NIE martwy — nie usuwać** · ✅ **krok 7: Editor Shell Canon napisany** (`docs/ui-standards/02-components/editor-shell-canon.md`).
**Odbiory Piotra (sesja 2026-06-29, sekcja C):** ✅ M23 · ✅ M16 (z zastrzeżeniami — silnik OK, dług przepływu danych) · 🟡 M24 (funkcjonalnie kompletny, grafika dramat, audit-log nie zbiera) · 🔴 M05/M06-M09 wstrzymane→D-I · 🔴 M13 generator „masakra"→osobny redesign · 🔴 M15 wyliczenia realne, prezentacja zrąbana · M21 niezbudowany (beta) · M27 do dokliknięcia.

## 7. DECYZJE — ZAMKNIĘTE + OTWARTE
**Zamknięte (sekcja C):** D-A GA-v1=default · D-B CMMI/LEAN=beta · **D-C Tools = WSZYSTKIE 19 Active** (nie 10) · D-D flip wszystkie gotowe flagi · D-E M16 legacy-OK v1 · D-F M22 internal-only · **D-G PROD = NIE (demo/stage only)** · D-H AI-guidance=TAK · B1b handoff = przy DONE, źródło initiative_kpis.
**OTWARTE (czekają na Piotra):**
- **D-J** — kierunek formuły weryfikacji („renderuje się ≠ działa"). Rekomendacja CTO: **„Dowód działania"** (round-trip przeciw API w pakietach). **NAJWAŻNIEJSZA otwarta decyzja.**
- **D-I sign-off** — Piotr akceptuje wzorzec Mind Map (gdy Cloud zbuduje).
- **D-I-1/2/3** — preferencje wzornicze (sekcja B1c, defaulty pokrywają).

## 8. NOWE DYREKTYWY z odbiorów (kluczowe)
- **D-I — Editor Shell Standard (priorytet #1 Cloud).** 16 problemów UI canvasu = brak wspólnej powłoki. Canon napisany. Sekwencja: Canon → wzorzec Mind Map → rozjazd na 7 edytorów (4 idea + 3 dokumenty). Pełna lista problemów UI-L1…L16 = sekcja C tablicy.
- **D-J — Formuła weryfikacji.** Piotr: odbiór-przez-klikanie nie dowodzi że backend działa; trzeba systemowy „dowód działania". Do zaprojektowania.

## 9. ★★★ GŁÓWNY OTWARTY TEMAT STRATEGICZNY: RE-SKIN CAŁEJ APLIKACJI
**To jest zadanie #3 — do ustalenia z Piotrem (Twój priorytet w tej roli).**
- Piotr: „bardzo dużo mechanik działa, natomiast powłoka graficzna jest dramatyczna" — i **re-skin to CAŁA apka, nie tylko 7 edytorów** (M24 „10 lat", M15 motyw jasny vs reszta ciemny, Admin/Finanse/Rezultaty, generatory Excel-dramat/PPTX-3-).
- **Cloud jest ODCIĘTY od szerokiego re-skinu** (nota w sekcji A) — robi tylko D-I contained (Mind Map) + nie-wizualne greenlit wątki. **Szeroki plan wizualny = dyskusja Piotr↔Strateg, dopiero potem rozjazd.**
- **Twoje zadanie:** przygotuj/dopracuj z Piotrem **plan naprawy powłok app-wide**: (a) mapa wszystkich powierzchni do przebudowy, (b) docelowy system wizualny + decyzja motyw (jasny/ciemny — patrz `[[UI canon consolidation]]` F3, M15 rozjazd), (c) kolejność/fazowanie, (d) jak to się ma do D-I Editor Shell + Visual Quality program + VISUAL_STANDARD. Fundament istnieje (CANON.md, VISUAL_STANDARD, navigation-permissions-canon, editor-shell-canon) — trzeba spiąć w jeden program re-skinu.

## 10. MAPA DOKUMENTÓW (gdzie co jest)
- **Dashboard/macierz:** `_STAN_PRACY_ODBIORY.md` (tabela modułów M01-M27+M12A/B + macierz L1-L4 + korekty).
- **Plan wykonawczy 4 tory:** `_PLAN_WYKONAWCZY_DOKONCZENIE_4TORY_2026-06-29.md` (działania po kolei, kolejka decyzji, handoff).
- **Strategia 3-poziomy:** `_PLAN_DOKONCZENIA_3POZIOMY_2026-06-29.md`.
- **Tablica koordynacji:** `_KOORDYNACJA_CLAUDE_PIOTR.md` (A/B/C + prompty startowe agentów).
- **Pakiety odbioru:** `_PAKIETY_ODBIORU/_INDEX.md` (11 modułów).
- **Kanony UI:** `docs/ui-standards/CANON.md` + `02-components/navigation-permissions-canon.md` + `02-components/editor-shell-canon.md` + `docs/standards/VISUAL_STANDARD.md`.
- **Koncepcje L3:** `docs/product/ASSESSMENT_CONCEPT_V4_2026-06-28.md`, `CONSULTING_TOOLS_STANDARD_V1.md`, `TOOLS_V8_SSOT.md`.
- **Pamięć między-sesyjna:** `memory/MEMORY.md` → `project_wdrozenie_100.md` (ma top-notkę 2026-06-29), `finding_ui_primary_is_crimson.md` (Notatnik+sesja).

## 11. PROMPTY STARTOWE pozostałych agentów (Piotr wkleja)
**Harvard Cloud:** patrz sekcja „Jak wystartować" w `_KOORDYNACJA_CLAUDE_PIOTR.md` + ograniczenie zakresu (sekcja A). Skrót: czyta tablicę+plan+editor-shell-canon+macierz; realizuje greenlit wątki; PRIORYTET #1 = D-I Mind Map contained; ZAKAZ szerokiego re-skinu; reguły twarde §0; start od D-I Mind Map.
**Harvard Pilot:** czyta tablicę; prowadzi Piotra przez D-J + pakiety odbioru + sign-off wzorca; pisze tylko do sekcji C.

## 12. REGUŁY TWARDE (Strateg też ich pilnuje u Cloud/Pilot)
PROD (centerbeam) nietknięty bez jawnej zgody Piotra (D-G=NIE); demo-first; `vite build` lokalnie przed deployem FE (lekcja: alias-prefix łamał subpath @tiptap); testy w `tests/` (`-f`); branch współdzielony `feat/deliverables-w1` → git-races realne (fetch+log przed reset, commity per ścieżka, NIGDY `-A`); cofalność (osobny commit/zmiana); `primary`=crimson (NIE nadużywać); weryfikuj kod przed akcją (audyty przeszacowują — lekcja ganttBaseline/DRD).

---
**PIERWSZY KROK nowego Strega:** (1) przeczytaj §10 dokumenty + (jeśli możesz) doczytaj poprzednią sesję przez session-search, (2) sprawdź sekcję C tablicy (najnowszy feedback Piotra), (3) zapytaj Piotra od czego zaczynamy: **plan re-skinu app-wide (zadanie #3)** czy **rozstrzygnięcie D-J** — oba są teraz najgorętsze.
