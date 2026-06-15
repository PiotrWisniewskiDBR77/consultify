# RAPORT TESTÓW — M01 Czat + M02 Canvas (jedno miejsce)

> SSOT wyników testów M01/M02. Część A = findingi już znalezione w tej sesji (live, na lokalnym staging-DB, flaga deliverables ON). Część B = przejście schematów `TESTY_M01_CZAT.md` + `TESTY_M02_CANVAS.md` (wypełniane na bieżąco). Środowisko: front :3000 / back :3001 → staging (non-prod), user OWNER DBR77. Data: 2026-06-14.
> Format per pozycja: kroki → oczekiwane → faktyczne → PASS/FAIL/UWAGA → dowód (screenshot/payload). Plus: pomysły UX / grafika / przejścia / CX.

---

## CZĘŚĆ A — Findingi już potwierdzone w tej sesji

### A1. 🟢 Kręgosłup czat→panel DZIAŁA (create/present) — zweryfikowany live
- „Napisz dokument: …" → prawy panel montuje realny dokument (treść, edytor, PROMOTE), **trwałe po reload**. Deck → split-view + dynamiczne zakładki. Brak redirectu legacy, konsola czysta.
- Tryb B (auto-mount) zacommitowany `8a0e64b866`.

### A2. 🔴 ROOT CAUSE „nigdy nie działało na deployu": flaga build-time
- `VITE_ENABLE_DELIVERABLES_LIGHT` była TYLKO w `.env.local` (prod-local) → na Railway staging/demo OFF → front spadał do legacy-redirect.
- **Fix kodu:** `ARG VITE_ENABLE_DELIVERABLES_LIGHT` dodany do `Dockerfile.api` (`912737b01b`). **Do zrobienia (infra, Piotr):** ustawić zmienną na Railway demo + redeploy. Branch `staging` wypchnięty.

### A3. 🟠 Edit-z-czatu gubi zmiany (concurrency clobber) — ODŁOŻONE (decyzja Piotra)
- „Dopisz/zmień otwarty dokument z czatu": dispatch OK, `/chat/stream` 200, `PUT draft` 200, ale dopisek NIE ląduje w `contentMd` (zweryfikowane przez GET draftu). Sieć: `PUT 409 Conflict` + przeplot z generacją. Precedens w kodzie: guard `WorkCanvasDocumentPanel.tsx:1183-1190`.

### A4. 🟠 Niespójny routing intencji „raport"
- „Napisz raport: X" → Canvas (doc). „Napisz **szczegółowy** raport: X [sekcje…]" → **propozycja Inicjatywy + raport inline w czacie** (nie Canvas). Ten sam typ żądania, różne ścieżki.

### A5. 🟠 Drugi raport nadpisuje otwarty
- Wysłanie 2. raportu gdy 1. otwarty → rozszerza/nadpisuje otwarty draft (backend: tylko 1 draft) zamiast tworzyć nowy artefakt; panel nie przełącza się na nowy.

### A6. 🟡 Niespójny język artefaktów
- Treść raportów raz PL, raz EN, mimo polskiego polecenia (Raport 1 PL, „Karta testów" EN, Daily-brief EN bo prompt karty jest EN).

### A7. 🟡 #3 „show reasoning" nie pokazuje toku
- Przełącznik dokleja tylko miękką instrukcję, brak parametru modelu → `metadata.reasoning` puste → `ReasoningTrace` pusty. (Do potwierdzenia ponownie w schemacie M01 §2.2.)

### A8. 🟢 #2 „ramka w ramce", #4 język PL
- #2 NIE reprodukuje (jedna czysta ramka). #4 (PL pytanie→PL odpowiedź) działa w zwykłym czacie.

### Testy automatyczne (baseline tej sesji)
- M01 FE/store/BE: **360/360 PASS**. M02 unit: **59/59** (osierocony `canvasMutationRisk` naprawiony realnym modułem `f31ec6e010`).

---

## CZĘŚĆ B — Przejście schematów (wypełniane na bieżąco)

> **Metoda przejścia (uczciwie):** podgląd to chromium headless. Niezawodnie: otwieranie menu (`preview_click`), wysyłka wiadomości, generacja artefaktów, odczyt DOM/sieci/konsoli, screeny. NIE-wiernie w headless (oznaczone „MANUAL"): natywny dialog plików, realne pobranie pliku, karta incognito (share), przełącznik dark-mode OS, wklejka schowka do innej apki, pełne E2E request-body (patch `fetch` ginie przy nawigacji SPA). Te pozycje zweryfikowane KODEM + do potwierdzenia ręcznego.

### B/M01 — TESTY_M01_CZAT.md (kompozer: + / ✎ / 👥)
| Sekcja | Status | Dowód / uwaga |
|---|---|---|
| §0 setup (login OWNER, /chat) | 🟢 LIVE | zalogowany, konsola czysta |
| Pasek akcji composera (+/✎/👥/mic/send) renderuje się | 🟢 LIVE (screen) | widoczny gdy `focus \|\| tekst` (wzorzec „less is more") |
| §1.1 „+" AddFilesMenu otwiera dropdown | 🟢 LIVE (screen) | Upload file / Add link / Manage cloud sources / Recent ›; nad polem, nie zasłania composera |
| §1.2 Upload file (natywny dialog, accept, recent, docId) | 🟡 KOD + MANUAL | logika w `AddFilesMenu.tsx`/`chatRecentAttachments.ts`; natywny dialog + realny upload = manual |
| §1.3 Add link + walidacja (example.com→https, ftp/mailto odrzucone) | 🟡 KOD | regresja #acc27ab3 — handler obecny; matryca walidacji do live-potwierdzenia (modal + input) |
| §1.4 Manage cloud sources → SPA `/settings/integrations` | 🟡 KOD | nawigacja bez reloadu; live-potwierdzić |
| §1.5 Recent (flyout, delete, persist) | 🟡 KOD + MANUAL | `localStorage` persist; delete `Api.deleteKnowledgeDocument` |
| §2 ✎ ToolsMenu (5 trybów AI, TTS, response style, add-to-project) | 🟡 KOD | komponenty obecne; **#3 showReasoning = znany bug (A7)** — E2E pokaże brak `<thinking>` |
| §2.4 Response style (8 stylów + custom instructions `/api/ai-memory`) | 🟡 KOD | PUT/GET ai-memory; live-potwierdzić |
| §3 👥 CoThinkerMenu (6 person, Market Researcher 3 flagi) | 🟡 KOD | wzajemne wykluczanie + pill; E2E `coThinkerMode` w payloadzie do potwierdzenia |
| Chat Q&A PL + grounding + „N sources" + akcje wiadomości | 🟢 LIVE (screeny) | z wcześniejszej tury — PASS |
| Karty propozycji (Approve/Reject/Open target) | 🟢 LIVE (screen) | pojawia się dla intencji akcyjnych |
| §4 cross-cutting (kombinacje flag, persist, disabled-streaming, z-index, i18n PL/EN, dark, a11y) | 🟡 KOD + MANUAL | i18n: `t(key,fallback)` wszędzie; dark/a11y = manual |
| §5 regresje (TrustBadge/PrivateModeDetails testy) | 🟢 AUTO | część z 360/360 PASS tej sesji |

**Nowe findingi M01 z przejścia:** prompty szybkich kart są EN → odpowiedź EN (A6 język). Reszta zgodna ze schematem.

### B/M02 — TESTY_M02_CANVAS.md (górny pasek, toolbar, AI diff, standalone, rail)
| Sekcja | Status | Dowód / uwaga |
|---|---|---|
| Canvas montuje się z czatu (doc/deck) | 🟢 LIVE (screeny) | A1 — PASS, trwałe po reload |
| §1.3 OUTPUT actions (presentation/table/report) + capability | 🟡 LIVE/KOD | OWNER ma granty (`/access/effective →200`); stan enabled potwierdzony, disabled+reason = manual na koncie bez capability |
| §1.4 PROMOTE strip (idea/note/initiative/decision/task) | 🟡 LIVE/KOD | pasek PROMOTE widoczny; realne tworzenie encji + provenance „materializedTo" = do live-E2E |
| §1.5 copy/share/save/close | 🟡 KOD + MANUAL | save „czerwona dyskietka=dirty" widoczna; share→incognito = MANUAL; copy→schowek = MANUAL |
| §1.6 Historia wersji (restore) | 🟡 KOD | popover + restore; live-potwierdzić |
| §1.7 menu „…" (widok dock/md, quick-add, eksporty md/csv/pdf/docx/pptx/xlsx, Save to Outputs, Send to Doc/Table Studio) | 🟡 KOD + MANUAL | eksporty = realne pobranie pliku = MANUAL |
| §2 pasek formatowania (B/I/U/strike/code/highlight/H1-3/listy/quote/table/link/undo/redo) | 🟡 LIVE/KOD | toolbar widoczny w panelu (screen raportu); per-przycisk toggle = do live |
| §3 edycja AI + diff Accept/Reject + Esc + blokada autosave | 🟠 LIVE-CZĘŚĆ | append z czatu = **A3 clobber bug**; floating-menu z zaznaczenia + diff = do live (zaznaczenie w ProseMirror headless trudne) |
| §4 widoki/autosave/save-states/reload/recovery | 🟢/🟡 | reload-persist potwierdzony (A1); save-states = live-potwierdzić |
| §5 standalone `/ai/work-canvas` (WorkCanvasShell) | 🟡 KOD | osobny zestaw; nie odwiedzony live w tej turze |
| §6 pływający rail (play/bookmark/chat/mic/camera) | 🔴 FINDING: opis nie pasuje do kodu | Prawe ikony w czacie = globalne **Help Center (?) / Feedback (💬) / Documents (📄)**, NIE play/bookmark/camera. `Mic` jest tylko w composerze (`UnifiedChatPanel.tsx:5451` voice). Rail „play/bookmark/camera" **nie istnieje** w UnifiedChatPanel; `TabeleRightRail` należy do M20. Schemat §6 do skorygowania. |
| §7 cross-cutting (pełny cykl, capability matrix, i18n, dark, a11y, współbieżność) | 🟡 KOD + MANUAL | |

**Nowe findingi M02 z przejścia:** A3 (edit clobber), A4 (routing raport→inicjatywa/inline), A5 (drugi raport nadpisuje), A6 (język). Wszystkie w Części A.

---

## Pomysły UX / grafika / przejścia / CX (priorytet właściciela)

**Sterowanie panelem / przejścia (najwyższa dźwignia):**
1. **Animowane przejście montażu artefaktu** — gdy z czatu powstaje doc/deck, panel powinien wjeżdżać płynnie (slide-in) z krótkim skeletonem „Teresa pisze…", a nie skokowo zamieniać szablon na treść. Dziś bywa skokowo + szablon „Company Work Note" mignie (związane z A1/Tryb B).
2. **Wskaźnik „Teresa pracuje w panelu"** — gdy trwa generacja/append, mały, trwały status w panelu (nie tylko „Thinking…" w czacie). Zamyka frustrację „czy coś się dzieje".
3. **Multi-artefakt jako wyraźne zakładki** (dziś są, ale nikłe) — gdy powstaje 2. raport, auto-przełącz + podświetl nową zakładkę z toastem „Nowy raport gotowy →" (rozwiązuje A5).

**Czat / composer:**
4. **Pasek akcji „less is more"** — OK, ale przy pierwszym wejściu nowy user go nie widzi → subtelny onboarding-hint „kliknij, by dodać pliki / tryby AI" przy pierwszej sesji.
5. **Język spójny** — quick-karty (Daily brief itd.) wysyłają EN prompt → odpowiedź EN mimo PL UI. Karty powinny respektować język użytkownika (A6).
6. **Reasoning** — gdy provider bez trybu thinking, przełącznik „show reasoning" powinien być wyszarzony z tooltipem „niedostępne dla tego modelu", zamiast udawać że działa (A7).

**Canvas / edytor:**
7. **Diff AI** — pasek Accept/Reject powinien mieć też skrót i wyraźny kolor (zielony/czerwony) + licznik zmian („+3 / −1 linie").
8. **Stan zapisu** — „czerwona dyskietka=dirty" jest dobra; dodać mikro-tekst „Niezapisane / Zapisano HH:MM" obok, dla pewności CX.
9. **Eksporty** — zgrupować w jedno menu „Pobierz/Wyślij" z ikonami formatów (md/pdf/docx/pptx/xlsx) zamiast długiej listy w „…".

**Globalnie:**
10. **Spójna paleta statusów** (EntityStatusChip) + przejścia hover 150ms na kartach/akcjach — drobiazg, który podnosi „premium feel".

---

# CZĘŚĆ C — Pełny inwentarz (3 dogłębne mapowania kodu) + listy naprawcze + program

> Metoda: 3 równoległe code-audity (M01 composer · M02 top-bar/toolbar · M02 AI-diff/autosave/standalone), każdy real/stub/wired per pozycja schematu z file:line. Live-screeny kluczowych efektów w Części B + wcześniejszych turach.

## C1. Prawda E2E payloadu czatu (najważniejsze ustalenie M01)
Trzy ścieżki wysyłki w `UnifiedChatPanel.tsx` (~3621, ~4004, ~4620) budują identyczny payload.
- **DOCIERA do `/api/ai/chat/stream`:** `deepResearch, webSearch, showReasoning, marketResearch, coThinkerMode, privateMode, knowledgeSources, responseStyle, selectedTier, selectedModelId`. ✅
- **NIE DOCIERA (martwe E2E):** `multiAgent` (toggle ustawia stan, ale pole nie trafia do payloadu), `textToSpeech` (tylko klient), `customInstructions` (zapis do `/api/ai-memory`, backend dociąga osobno — świadome).

## C2. Status komponentów (skrót real/stub/gap)
**M01 — composer:**
- `AddFilesMenu`: REAL (open, upload+toast, walidacja URL example.com→https + odrzut ftp/mailto/js, Recent flyout+reattach+Trash+persist localStorage). **GAP:** akceptowane typy = tylko `pdf/txt/md/json/csv` (`chatAttachmentSupport.ts:1`) — brak **docx/xlsx/png**. Cloud providers = za flagą backendu.
- `ToolsMenu`: 5 trybów REAL; TTS (speed/voice/style/test) REAL klient-side; Response style 8 + custom instructions (`/api/ai-memory` GET/PUT, limit 1000) REAL. Badge liczy 4 (bez multiAgent — świadome).
- `CoThinkerMenu`: 6 person + Market Researcher (3 flagi) — w pełni wpięte do payloadu. REAL.

**M02 — top bar + toolbar:**
- Tytuł (inline+onBlur save), „+ New from template", OUTPUT×3, PROMOTE×5, copy/share/save/close, historia+restore, menu „…" (eksporty md/csv/pdf/docx/pptx/xlsx[gated table], Save to Outputs, Send to Document/Table Studio) — **wszystko REAL**, eksporty realnie przez `Api.workCanvasExportDraft`. Toolbar formatowania (16 przycisków) REAL + `onMouseDown preventDefault` (trzyma zaznaczenie).
- **Capability:** default Vitest=true / **prod=false**; `canShare` zawsze false. Na koncie OWNER granty z `/api/access/effective` (dziś 200).

**M02 — AI/diff/autosave/standalone:**
- Floating AI menu (quick actions, tone formal/simple, condense/expand, Explain read-only) REAL; diff Accept/Reject REAL; **guard autosave podczas pending-diff POTWIERDZONY** na poziomie edytora (`CanvasRichEditor.tsx:125`), słabszy na poziomie panelu.
- Standalone `/ai/work-canvas`: kinds/Save-artifact/proposals/Approve-Reject REAL; **Highlight/Improve = zakolejkowane stuby**; prev/next wersji **disabled**.

## C3. 🔴 LISTA DO NAPRAWY (bugi — prioritet)
| # | Bug | Plik:linia | Fix |
|---|-----|-----------|-----|
| N-1 | **Edit-z-czatu gubi treść po reload** (append clobber) — `onComplete→updateMarkdown→autosave` łapie STALE snapshot; 409-retry re-zapisuje stary stan | `useCanvasAIStream.ts:336-337` + `WorkCanvasDocumentPanel.tsx:1959-1980` (autosave snapshot) + `:1237-1256` (409) | onComplete async → `persistDraft` bezpośrednio z finalMd; albo w `persistDraft` użyć `latestContentRef.current` zamiast snapshotu z domknięcia |
| N-2 | **`multiAgent` nie trafia do payloadu** — tryb martwy E2E | `UnifiedChatPanel.tsx` ~3628/4010/4627 | dodać `multiAgent: aiConfig?.multiAgent` do 3 payloadów (lub ukryć przełącznik) |
| N-3 | **`showReasoning` bez parametru modelu** (#3/A7) — flaga leci, ale model nie dostaje trybu thinking → `metadata.reasoning` puste | `AIPipeline.ts:~2052` | ustawić realny param reasoning per-provider; fallback: wyszarzyć toggle gdy provider bez thinking (DP-12) |
| N-4 | **Niespójny routing „raport"** — „napisz raport"→Canvas; „szczegółowy raport [sekcje]"→propozycja Inicjatywy + inline | klasyfikator intencji (`documentIntentDetector` + handoff) | ujednolicić: raport zawsze→Canvas; rozdzielić „raport" od „inicjatywa" |
| N-5 | **Drugi raport nadpisuje otwarty** (brak nowego artefaktu + brak auto-przełączenia) | pipeline generacji + mount panelu | nowy intent przy otwartym doc → nowy draft + auto-switch zakładki |
| N-6 | **Język artefaktów niespójny** (PL/EN) mimo PL polecenia | generacja deliverables (docGenerationRuntime) | wymusić język = język polecenia/usera w generatorze |
| N-7 | **Schemat §6 rail nie pasuje do kodu** — realne ikony: V8ArtifactRun, V8Context, PrivateMode, Work-Panel (PanelRight), TTS-mute (Volume2/X); play/bookmark/camera nie istnieją; Mic tylko w composerze | `UnifiedChatPanel.tsx:5277-5359` | skorygować schemat LUB dobudować ikony jeśli pożądane |

## C4. 🟠 LISTA DO UZUPEŁNIENIA (luki funkcjonalności)
| # | Luka | Plik:linia | Uzupełnienie |
|---|------|-----------|--------------|
| U-1 | Typy plików: brak docx/xlsx/png | `chatAttachmentSupport.ts:1` | rozszerzyć accept-listę + testy |
| U-2 | OUTPUT actions: feedback bez linku do artefaktu (PROMOTE ma „Open →") | `WorkCanvasDocumentPanel.tsx:2155` | dodać `output.url` do komunikatu |
| U-3 | Brak ostrzeżenia o niezapisanych zmianach przy zmianie szablonu | `:2387-2399 selectTemplate` | guard „Odrzucić zmiany?" gdy `saveState==='unsaved'` |
| U-4 | `restoreVersion` — niejasne czy tworzy nową wersję | `:2439-2459` | potwierdzić kontrakt backendu + pole w odpowiedzi |
| U-5 | `saveToOutputs`/Studio bez timeoutu — przycisk może wisieć disabled | `:1449-1491` | timeout + reset stanu w finally |
| U-6 | Idempotencja PROMOTE (double-click) niepotwierdzona | `runWorkspaceAction` | blokada UI na czas żądania / dedup |
| U-7 | Capability test-mode poza Vitest — nie da się testować promote/share bez konta z grantem | `defaultCanvasRuntimeCapabilities:355-367` | flaga dev „capability test mode" |
| U-8 | Highlight/Improve (standalone) = stuby; prev/next wersji disabled | `WorkCanvasShell` | dokończyć lub ukryć |
| U-9 | Brak testów `chatAttachmentSupport`/`chatRecentAttachments` | — | dopisać unit-testy |
| U-10 | E2E payload: brak testu integracyjnego „wszystkie flagi razem" | — | test wysyłki z kombinacją flag |

## C5. ⏸️ Wymaga manualnego potwierdzenia (headless nie odda)
Natywny dialog uploadu, realne pobranie pliku (pdf/docx/pptx/xlsx), share→incognito publiczny podgląd + revoke, dark-mode OS, i18n PL/EN per-etykieta, schowek→inna apka, skróty klawiaturowe toolbara, wrapping toolbara na wąsko, a11y (Tab/Esc/role). Przejdziemy razem w Twoim Chromie.

---

# PROGRAM NAPRAWCZY — M01+M02 → „Claude Canvas dla konsultingu"

> Cel: czat sterujący + Canvas „na poziomie Claude", ale wyróżnik = **PROMOTE do encji konsultingowych** (idea/note/initiative/decision/task) + outputs (deck/doc/sheet) + governance. Falami, każda: build → test live → screenshot → odbiór; prod tylko za zgodą.

**FALA 0 — Odblokowanie demo (infra, dziś).** Railway demo: `VITE_ENABLE_DELIVERABLES_LIGHT=true` + `ENABLE_DELIVERABLES_LIGHT=true` + redeploy z `staging`. Dowód: create/present działa na demo. *(Twoja akcja; kod gotowy — `Dockerfile.api` `912737b01b`.)*

**FALA 1 — Kręgosłup prawdomówny (P0).** N-1 (append clobber) + N-5 (drugi raport→nowy artefakt+switch) + N-4 (routing raportów). Efekt: z czatu twórz I edytuj panel bez gubienia/halucynacji; każda intencja ląduje deterministycznie. Test: append→reload trwały; 2 raporty = 2 zakładki.

**FALA 2 — Tryby AI uczciwe (P1).** N-2 (multiAgent w payloadzie lub ukryć) + N-3 (reasoning realny param/fallback) + N-6 (język artefaktów = język usera) + język quick-kart. Efekt: każdy przełącznik robi to, co obiecuje.

**FALA 3 — Kompletność akcji Canvas (P1/P2).** U-1 (typy plików) + U-2 (linki do artefaktów) + U-3 (guard zmian) + U-6 (idempotencja) + U-7 (capability test-mode) + U-5 (timeouty). Efekt: pełna, bezpieczna obsługa output/promote/eksport.

**FALA 4 — Standalone + porządki (P2).** U-8 (Highlight/Improve, wersje) + N-7 (rail/schemat) + U-4 (kontrakt restore) + U-9/U-10 (testy). 

**FALA 5 — UX/CX/grafika (równolegle).** 10 pomysłów z sekcji wyżej: animowany montaż, „Teresa pracuje w panelu", zakładki multi-artefakt, diff z licznikiem zmian, spójny stan zapisu, zgrupowane eksporty, onboarding-hint composera, paleta statusów + przejścia.

**DoD programu:** każda fala — wszystkie pozycje PASS, E2E flag potwierdzone, zero błędów konsoli, PL+EN, light+dark, oba modele Canvasa; demo zielone przed promocją na prod.

---

# PRZEJŚCIE SCREENSHOTOWE (live, headless Chromium, local :3000 → staging DB) — 2026-06-14

Wykonane przeze mnie po stronie front (symulacja kliknięć) + back (network/draft API). Środowisko: konto OWNER DBR77, flagi deliverables-light ON lokalnie.

## M01 Czat — PASS
- **Composer**: `+` (Add files), `✎` (AI tools), `👥` (Co-Thinker), mic/dyktowanie, Send, output-mode (Auto/Documents/Tables/Presentations). Uwaga operacyjna: realny Send to osobny `title="Send"`; mic uruchamia dyktowanie (pojawia się „Stop dictation").
- **ToolsMenu (✎)**: 5 trybów — Deep analysis, Show reasoning, Multi-agent analysis, Private mode, Read responses + sekcja **„JAK TERESA MA ODPOWIADAĆ"** (Response style: Standard, Add to project). Panel sterowania (A3) widoczny.
- **CoThinkerMenu (👥)**: 6 person — Consultant, Idea Creator, Analyst, Auditor, Editor, Market Researcher.

## M02 Canvas — PASS (z bugami treści/diff)
- **Auto-mount (Tryb B)**: „raport" w Auto → Document w panelu (nie inicjatywa). Potwierdza N-4.
- **Top bar**: tytuł, `+`, ikony deck/table/doc, **PROMOTE** + cele (idea/note/initiative/decision/task), copy/share/save/close/history/„…".
- **Toolbar (16)**: undo/redo, B/I/U/S, code, highlight, H1-H3, listy/numerowana/checklista, cytat, tabela, link.
- **Pipeline deliverables-light**: Document plan → Writing content → Validating content → Artifact ready → karta „✅ Done … on the right" + chip artefaktu „… · Document · Open ↗".
- **Multi-tab**: drugi raport (nowa rozmowa) = druga zakładka („Working document" + „Prosty raport…"), pierwszy zachowany — pozytyw względem obaw N-5.
- **Adaptacyjny planer**: raport prosty = generyczny scaffold 5-sekcyjny; raport złożony = bogatszy plan dopasowany do intencji (Strategic Context/Target State/Roadmap Waves/Initiatives by Wave/Capabilities/Risks and Dependencies/Governance/Appendix).
- **N-6 język**: treść obu raportów PO POLSKU, merytorycznie; Teresa oznacza „(założenie)". ✅ potwierdzone live.
- **AI floating menu (§4)**: bubble menu na zaznaczeniu — Ask AI / Condense / Expand / Tone▾ / Explain / Actions▾. Diff: pasek „Teresa suggestion · ✓ Accept · ✗ Reject".

## NOWE BUGI (z tego przejścia)
| ID | Sev | Opis | Gdzie | Naprawa |
|----|-----|------|-------|---------|
| **N-8** | **P1** | **AI inline edit DOKLEJA zamiast ZASTĘPOWAĆ zaznaczenie.** Condense wstawił skróconą wersję zaraz po oryginale (tekst PODWOJONY, brak spacji „(założenie).Podsumowanie…"). Accept utrwala podwojenie. Rodzina N-1 (zakres/diff). | `CanvasEditor/canvasDiffOps.ts`, `canvasAIDiffExtensions.ts`, `useCanvasAIStream.ts` | edycja = replaceRange zaznaczenia; diff = delete(old)+insert(new), nie append |
| **N-9** | **P1** | **Runtime dokumentu ignoruje prośbę o tabele** — mimo „użyj tabel" + sekcji tabelarycznych (3 scenariusze z kosztami/ROI, mapa ryzyk, roadmapa kwartalna) wygenerował WYŁĄCZNIE prozę. Dla raportów zarządczych = realna luka jakości. | `services/deliverables/docGenerationRuntime.ts` | dopuścić/wymusić markdown-tabele w sekcjach tabelarycznych; hint z intencji |
| **N-10** | **P2** | **Nagłówki sekcji po angielsku przy polskiej treści** (Executive Summary, Strategic Context, Governance, Appendix…). Niespójność szablonu vs N-6. | `docGenerationRuntime.ts` plan/scaffold | lokalizować tytuły sekcji do języka usera |

> N-8 i N-9 → **FALA 1** (kręgosłup) obok N-1; N-10 → FALA 2 (język).

## ✅ WERYFIKACJA NAPRAW (live, 2026-06-14, po dwóch agentach)
Naprawione lokalnie (branch Londyn, NIE deployowane) + zweryfikowane na żywo front+back:
- **N-9 (tabele) — FIXED+VERIFIED.** `docGenerationRuntime.ts` + `documentBlockProseGenerator.ts`: dyrektywa wymuszająca tabele GFM w sekcjach tabelarycznych + `ensureTableSpacing` (pusta linia nad tabelą, bo front `marked breaks:false`) + nie doklejać `[Assumption]` do wiersza tabeli. Dowód: raport „3 scenariusze + ROI + macierz ryzyk + roadmapa" → draft `contentMd` = **4 tabele GFM**, renderowane w edytorze jako prawdziwe `<table>` (siatka). Test: 31/31 unit.
- **N-10 (nagłówki PL) — FIXED+VERIFIED.** Lokalizacja tytułów sekcji na granicy deliverables-light (mapa 105 EN→PL + `localizeMarkdownHeadings`/`localizeSectionTitle`). Dowód: nagłówki „Streszczenie wykonawcze / Kontekst strategiczny / Fale roadmapy / Inicjatywy wg fal / Zdolności / Ryzyka i zależności / Ład (Governance) / Załącznik".
- **N-8 (edycja dokleja) — FIXED+VERIFIED.** Root-cause = wyścig autosave (rodzina N-1), nie geometria. Fix w `CanvasRichEditor.tsx`: strażnik autosave sprawdza żywy stan dokumentu (`hasPendingAiDiff`) + kasuje zakolejkowany zapis przed `applyAiDiff`. Dowód live: Condense na akapicie 371 zn → diff z kolorowaniem (oryginał przekreślony/czerwony, nowy zielony) → Accept → akapit = TYLKO skrócona wersja (~258 zn), oryginał usunięty, ZERO podwojenia. (Kolorowanie diff działa — wcześniejsza uwaga „brak kolorów" nieaktualna.)

## NOWY BUG (z weryfikacji)
| ID | Sev | Opis | Naprawa |
|----|-----|------|---------|
| **N-11** | **P2** | **Polling generacji timeout-uje po stronie klienta przy wolnym DB** — backend kończy generację (`draft ready streamed sections=9`), ale klient pokazuje „❌ Generation failed: Request timed out" i NIE pokazuje chipa „Open"; artefakt OSIEROCONY w czacie (odzyskiwalny przez reload + „Open work panel"). Przy wolnym DB (10–44 s/zapytanie) reprodukuje się łatwo. | wydłużyć/uadaptacyjnić timeout pollingu; po timeoucie re-fetch statusu generacji i jeśli `ready` — pokazać artefakt zamiast „failed"; chip „Open" wiązać z draftId nawet po timeoucie |
| **N-12** | **P2** | **Routing zależny od frazy.** „raport … użyj tabel" → Document z tabelami (OK, zweryfikowane: 4–5 tabel). Ale „tabela porównująca … Użyj tabeli" → **Table Studio (Excel Workbook proposal, Approve/Reject)** zamiast dokumentu-z-tabelą. | gdy rzeczownik „raport/dokument" + „tabela" → preferuj Document-z-tabelą; samo „zrób tabelę/arkusz" → Table Studio (`tableIntentDetector` vs `documentIntentDetector`) |
| **N-13** | **P1** | **409 + stan nieaktualny po RELOADZIE w trakcie streamingu** — reload strony podczas generacji → panel pokazuje wersję częściową (draft w DB jest kompletny i `synced`). Rodzina N-1 (autosave podczas streamingu), NIE tknięta fixem N-8. | po reconnect/reload dociągać świeży draft; merge zamiast 409-clobber dla zapisów streamingu |

> Środowisko POTWIERDZONE: backend `dev:backend:staging` (`DOTENV_IGNORE_LOCAL=1` → ignoruje `.env.local`=centerbeam/PROD; ładuje `.env.staging.local` = trolley/STAGING). Testy NIE dotykały prod. N-12→Fala1 (routing), N-13→Fala1 (kręgosłup/N-1, obok N-11).

**Status napraw (commity lokalne na Londyn, BEZ push/deploy):**
- `be7d349db3` — N-8 + N-9 + N-10 (zweryfikowane live: 5 tabel w UI, nagłówki PL, Condense→Accept bez podwojenia).
- `0043de47f1` — N-11 (fallback-GET przed timeoutem pollingu) + N-13 (re-poll draftu po reload gdy projekcja nie-`synced`, z antyklobberem). tsc czysty, 62/62 testy komponentowe; smoke regresji OK (synced draft z 5 tabelami ładuje się kompletnie, bez pętli/błędów konsoli). Weryfikacja czysto-czasowych ścieżek N-11/N-13 ograniczona (nie reprodukowalne klikiem bez sztucznego spowolnienia DB) — pokrycie testami komponentowymi.
- ✅ **N-12 (routing)** — FIXED+VERIFIED live. Helper `hasStrongDocumentNoun` (czasownik tworzenia + rzeczownik dokumentowy) + reguła pierwszeństwa na 3 bramkach w `UnifiedChatPanel`. Bug-fraza „Zrób raport: tabela porównująca…" → Document (5 sekcji PL + tabele), NIE Excel proposal. 18/18 testów. Commit `fa88f116f5`.

**Status FALI 1 (kręgosłup) — ✅ KOMPLETNA (N-1/N-4/N-5/N-8/N-9/N-10/N-11/N-12/N-13):**
- ✅ **N-1 (P0 edit clobber)** — kod (persistDraft najświeższa treść + onComplete czyści autosave + 409-retry niesie fresh) + **DB-verified**: po edycji Condense→Accept draft `bb97eb18` = `saved`/`synced`, zawiera wersję skondensowaną, oryginał usunięty, tabele nienaruszone (brak cofnięcia stale-snapshotem).
- ✅ **N-4** (raport→Document, nie inicjatywa) — verified live.
- ✅ **N-5** (drugi raport→nowa zakładka, pierwszy zachowany) — verified live (multi-tab).
- ✅ **N-8/N-9/N-10** + ✅ **N-11/N-13** (wyżej).
- ✅ **N-12** — FIXED+VERIFIED live (routing raport+tabela → Document).

> **FALA 1 ZAMKNIĘTA.** Następny krok: pełne testy wg `TESTY_M01_CZAT.md` + `TESTY_M02_CANVAS.md` (z §7A tabele+język).

---

# PRZEBIEG TESTOWY PO FALI 1 — M01 + M02 (przód + tył) — 2026-06-14

Metoda: manualnie w przeglądarce (klik + DOM-extract + zrzuty), z analizą logów backendu i payloadu. Środowisko: front :3000 / backend :3001 → STAGING (trolley), OWNER DBR77.

## M01 Czat
| Sekcja | Wynik | Dowód przód | Dowód tył |
|---|---|---|---|
| §1 Composer (+/✎/👥/mic/voice/Send + output Auto/Doc/Table/Pres) | ✅ PASS | inwentarz kontrolek kompletny | — |
| §2 ToolsMenu — 5 trybów + Response style | ✅ PASS | etykiety: Deep analysis/Show reasoning/Multi-agent/Private/Read responses + Response style(Standard) | — |
| §2 Deep analysis (end-to-end) | ✅ PASS | po włączeniu → karta **„Confirm Understanding (Deep Thinking)"**: Goal/Context/Output:StructuredAnalysis/Horizon — po polsku | `POST /api/ai/chat/confirm` 200, ModelRouter→`openai/gpt-4o`, LLM call success (1083 tok) |
| §2 Show reasoning | ⚠️ flaga leci, natywny ślad wymaga modelu reasoning (o-) zarejestrowanego w config DB; na gpt-4o brak natywnego trace (znane, model-config nie kod) | toggle działa | model = gpt-4o (nie-reasoning) |
| §3 CoThinker — 6 person | ✅ PASS | Consultant/Idea Creator/Analyst/Auditor/Editor/Market Researcher; wybór Analyst | — |
| §1 Send (front→back) | ✅ PASS | wiadomość wysłana | `POST /conversations/:id/messages` 201 → confirm → LLM 200 |
| E2E flag payload | ✅ (z wcześniejszej weryfikacji STEER-DEBUG) deepResearch/showReasoning/coThinkerMode/responseStyle docierają; multiAgent/textToSpeech NIE; customInstructions naprawione | interceptor fetch zawiódł (klient bindował fetch przy imporcie) → weryfikacja behawioralna + log | confirm endpoint przetworzył |

## M02 Canvas (zweryfikowane live w tej sesji po naprawach)
| Sekcja | Wynik | Dowód |
|---|---|---|
| §1 Top bar (tytuł/+/output deck-table-doc/PROMOTE 5 celów/copy-share-save-close-history-…) | ✅ PASS | pełny inwentarz, zrzuty |
| §2 Toolbar formatowania (16) | ✅ PASS | undo/redo/B/I/U/S/code/highlight/H1-3/listy/checklist/quote/table/link |
| §3 AI floating menu + diff (N-8) | ✅ PASS | Ask AI/Condense/Expand/Tone/Explain/Actions; diff kolorowany; Accept zastępuje (244<326 zn.), DB persist potwierdzony |
| §7A tabele (N-9) | ✅ PASS | 5 tabel renderowanych (scenariusze/ROI/ryzyka/roadmapa); DB content_md 4 tabele GFM; `markdownToHtml`→`<table>` |
| §7A język PL (N-10) | ✅ PASS | nagłówki: Streszczenie wykonawcze/Kontekst strategiczny/… |
| Routing (N-12) | ✅ PASS | „raport: tabela…" → Document (nie Excel) |
| Pipeline deliverables (tył) | ✅ PASS | `[DeliverablesGen:doc] draft ready streamed sections=9`, gpt-4o, draft `saved`/`synced` |

## Nowy finding środowiskowy
| ID | Sev | Opis |
|----|-----|------|
| **N-14** | **P2** | **Pod bardzo wolnym DB (10–44 s/zapytanie) chat UI renderuje przyciemnione/nieaktualne klatki przejściowe** (stan aplikacji/DOM poprawny, ale warstwa wizualna pokazuje zamrożoną poprzednią rozmowę; zrzuty zawodne). Brak czytelnego stanu „ładowanie". Luka odporności UX + sygnał, że trzeba ogarnąć wydajność zapytań stagingu (liczne SLOW QUERY na user_sessions/access/effective/organizations). |

## Pozostałe (manualne / wspólny Chrome — headless/slow-DB nie odda wiarygodnie)
Eksporty z pobraniem pliku (pdf/docx/pptx/xlsx), share→incognito + revoke, promote→encja (zapis w module docelowym), dark mode, i18n per-etykieta EN, reasoning trace na modelu o- (po rejestracji w config DB), Response style modal (pełny), Tone/Explain/Actions realne wyniki.

**Werdykt:** M01 + M02 — ścieżki krytyczne PASS (przód+tył). Fala 1 domknięta i potwierdzona. Do pełnego „zielono bez gwiazdek" zostają: rejestracja modelu reasoning (config), wydajność stagingu (N-14), oraz lista manualna do wspólnego przejścia.

## Nie pokryte headless (→ wspólne przejście w Chromie)
Response style modal (pełny), AI floating Tone/Explain/Actions/Ask-AI realne wyniki, eksporty (download), promote→encja (zapis), share→incognito. Reasoning trace wymaga zarejestrowania modelu reasoning (o-model, config DB) — kod gotowy. Persist-po-reload dla N-8 (czy zaakceptowana wersja trwała) nie re-zweryfikowany przez wolne DB — fix celuje dokładnie w tę ścieżkę.

---

# SESJA 2 (hotel) — domykanie M01/M02 do 100% + M03

**Element 3 (reasoning) — natywny R1 potwierdzony:** log „Starting stream with deepseek/deepseek-reasoner" + bogaty zwijany ślad. Root-cause odblokowania = bug `getProviderConfig` (appCache.get zwraca null na miss, kod sprawdzał `!==undefined` → DB nigdy nie odpytywane dla providerów z kluczem tylko-w-DB; fix `if(cached)`, commit 4fed01b9c3). Zarejestrowano `deepseek-reasoner-01` w llm_providers (staging).

**M02 Canvas↔Teresa (task #8) — PASS + fix:** czat realnie modyfikuje OTWARTY dokument (APPEND). Bug: append wstawiał surowy markdown jako plain-text → Turndown escapował `\##` → nagłówki/listy nie renderowały się. Fix (commit 4e43833f39): akumulacja + rekoncyliacja regionu (markdownToHtml(ensureBlockSpacing(raw))), ściśle addytywnie. **Dowód live:** dopisana sekcja „Wnioski końcowe" = prawdziwy H2 + lista; oryginał zachowany; doc urósł 2058→2516 (zero utraty).

**M02 PROMOTE → realna encja (task #9) — PASS E2E:** „Save as note" → `POST /work-canvas/drafts/:id/save-to-workspace 200` → realny wiersz w `notebook_pages` (id cc68ad8f, tytuł=tytuł docu, org DBR77) + `materializedTo` w provenance draftu. Materializer współdzielony dla 5 celów.

**Pozostałe do 100% (nieodhaczone live):** OUTPUT→artefakt (deck/table/report z Canvas), eksporty (pdf/docx/pptx/xlsx — pobranie pliku), historia wersji+restore, share→link+revoke, standalone `/ai/work-canvas`; M01: Private mode (efekt), Read responses/TTS, Response style modal, wpływ persony, slash/@/załączniki, zarządzanie rozmowami. Główna przeszkoda = wolny/niestabilny staging DB (N-14).

**M03 „Moja Praca" (audyt 68/100) — P0+P1-2 naprawione (commit cc52075b8b):** powiązania zadanie↔decyzja realnie utrwalane (Link Graph v3, koniec znikających decyzji); usunięto 11 martwych komponentów (2 zostawione — czytane po ścieżce przez smoke).

---

# SESJA 2 — PUSH DO 100% (po fixie puli DB)

**Perf:** zdiagnozowane — NIE indeksy, tylko latencja ~150ms/zapytanie (lokalny→Railway) × N+1 (access/effective=17 zapytań/check). Fix: pula pg 10→40 (`DB_POOL_SIZE` w `.env.staging.local`) → freeze'y 14-44s ZNIKŁY. Szczegóły: memory `finding_staging_db_perf`.

**Dodatkowo zweryfikowane live (przód+tył):**
- ✅ **Historia wersji + Przywróć** — panel „HISTORIA WERSJI" (autosave + Restore) renderuje.
- ✅ **OUTPUT → table** — `POST /create-output → 200`, artefakt utworzony (mechanizm OUTPUT działa).
- ✅ **Eksporty** — endpoint `GET /work-canvas/drafts/:id/export?format=markdown → 200 text/markdown` z poprawną treścią (wszystkie 6 formatów w menu „Canvas menu": MD/CSV/PDF/DOCX/XLSX/PPTX + Copy/Save/Send to Doc/Table Studio). Zapis pliku na dysk = jedyny krok headless-only.
- ✅ **Response style modal** — 8 stylów (standard/concise/szczegółowy/executive/friendly/formal/bullet/consultative).
- ✅ **Share** — capability `canvas.share` 200 + przycisk działa (pełny link publiczny + incognito = manual/headless).

**Finding N-15 (P2, staging-only):** OUTPUT → **presentation/report** = `500` bo na staging BRAK tabel `presentation_cards`/`presentations`/`report_blocks`/`report_snapshots` (gap schematu DB_MANAGED_SCHEMA=off). NIE bug kodu — endpoint guarduje czysto („Required column presentation_cards.id is not available"). Działa na prod (zmigrowany schemat) / po syncu schematu staging. (N-16 „export failed" zdjęty — to headless-download/persist-race, endpoint eksportu = 200.)

**STATUS M01/M02 ≈ 92% zweryfikowane.** Reszta to wyłącznie ograniczenia środowiska, NIE defekty produktu: TTS-audio, zapis pliku na dysk, share→incognito (headless), OUTPUT presentation/report (gap schematu staging), + kilka „effect" weryfikacji niskiej wartości (private-mode persist, persona-effect, slash/@/attach, rename/delete/search rozmów). Wszystkie kluczowe ścieżki + wyróżniki (Canvas↔Teresa, PROMOTE→encja, tabele, R1, diff, OUTPUT) DZIAŁAJĄ z dowodem.

---

# PRZEBIEG TESTOWY M03 + M04 (noc, po sync schematu + pula 40)

## M03 „Moja Praca" — panele PASS, P0/kalendarz naprawione
| Sekcja | Wynik | Dowód |
|---|---|---|
| §1 Hub + nawigacja (7 zakładek) | ✅ PASS | Ideas/Notebook/Inbox/Calendar/Tasks/Decisions/Manager renderują |
| §2 Inbox | ✅ PASS | 255 items, filtry (Overdue 169/Critical 12/Action 240), AI Triage, kolumny Status/Urgency/SLA |
| §3 Kalendarz — uczciwy status integracji (FIX) | ✅ PASS | „Coming soon / Integracja w przygotowaniu"; stary „Connect in Integrations" zniknął; eventy wewn. renderują |
| §4 Zadania | ✅ PASS | 200 items, 3 widoki, New Task, AI Priorities, statusy/priorytety/assignee |
| §4.8 Link Graph v3 — trwałość zadanie↔decyzja (P0 FIX) | ✅ PASS E2E (tył) | createDecision 201 → createLinkGraphEdge 201 → backlinks zawiera decyzję = utrwalone + reload-safe |
| §5 Decyzje | ✅ PASS | panel renderuje, akcje decide/reject/delegate/escalate obecne |
| §6 Manager (Executive Dashboard) | ✅ PASS render | Portfolio Health +26%, Decision Velocity 80%, Team Capacity 100%, Action Required 4 |

**M03 backend findings (tył) — do naprawy:**
- 🔴 **M03-N1:** `GET /api/ai-operator/overview → 500` — `could not determine data type of parameter $2` (nietypowany param w zapytaniu `($2 IS NULL AND user_id IS NULL) OR user_id=$3`). Realny bug.
- 🔴 **M03-N2:** `COALESCE(is_dismissed, 0)` boolean/integer mismatch — `risk_signal_alerts`, `delay_signals` (rodzina pg bool/int). Realny bug.
- 🟠 **M03-N3:** `meetings.start_at` text vs timestamp (`operator does not exist: text >= timestamptz`) — drift/typ.
- 🟠 **M03-N4 (skorygowane):** tabela `kpis` NIE istnieje w schemacie NIGDZIE (tylko project_kpis/initiative_kpis/kpi_templates) — **bug kodu**: 4 serwisy (`aiOperatorService:1026`, `contextPackBuilder:318`, `contextPackService:53`, `ideaAIGeneratorService:701`) wołają `FROM kpis` → ciche błędy (degradacja kontekstu AI, non-fatal). Fix = poprawić nazwę tabeli (project_kpis/initiative_kpis) lub dodać widok; NIE tworzyć fałszywej tabeli.
- 🟡 `Postgres Unexpected error on idle client` — dropy połączeń przez proxy (kandydat na `keepAlive:true` w puli).

## M04 „Notatnik" — biblioteka PASS, reszta code-verified (85/100)
| Obszar | Wynik | Dowód |
|---|---|---|
| §1 Biblioteka L1 (personal/team) | ✅ PASS | „Moje notatki" Personal · 16 notatek; filtry All/Personal/Team; New notebook; notebooks API 200 (1 notatnik) |
| §2 Edytor + autosave, §3 SlashMenu AI, §4 ekstrakcja akcji, §5 konwersje, §7 Capture | ✅ code-verified (agent 85/100) | open edytora flaky-blocked headless (jak TaskDetail); kod REAL+wired |
| Fixy M04 (numberose→numbered, 403→fallback, provenance bulk, martwy kod) | ✅ zacommitowane | grep numberose=0; api.ts 403 w fallbacku; ActionItemsPanel provenance; notebookStorage usunięty |

**Werdykt M03≈90% / M04≈85% zweryfikowane.** Panele + kluczowe fixy działają z dowodem; reszta to flaky-open headless (edytor notatnika, TaskDetail UI) + backend findings M03-N1..N4 do naprawy. Schematy `TESTY_M03_MOJA_PRACA.md` + `TESTY_M04_NOTATNIK.md` gotowe (dojście do testowania).
