# Kompletny audyt wdrożenia modułu Canvas/Deliverables (2026-06-10, wieczór)

Metoda: 3 równoległe ścieżki — (1) audyt kodu triady generacji, (2) audyt okablowania funkcji
Canvas z fal 1–3 (WIRED/PARTIAL/DEAD per funkcja), (3) **audyt live** na preview (DEMO ORG,
dane testowe z prefiksem AUDYT-). Dyscyplina anty-przeszacowania luk: każda luka potwierdzana
w ≥2 konwencjach nazewniczych + ścieżce runtime.

Werdykt ogólny: **triada generacji ~85% kompletna i przetestowana (16/16), funkcje fal 1–3
w 7/8 przypadków poprawnie okablowane — ALE dwa znaleziska klasy P0 unieważniają "gotowość":
utrata danych przy generacji dokumentu oraz capability-gating czyniący moduł admin-only.**

---

## P0-1 — UTRATA DANYCH: finalna treść dokumentu ginie bezpowrotnie (live-proven)

Przebieg zaobserwowany na żywo (draft `39d38c1e…`):
1. Generacja doc: backend zapisuje finalną polską prozę (zweryfikowano bezpośrednio w API) —
   **edytor nadal pokazuje szkielet** mimo że listener `deliverables:draft-ready` odpala
   i fetch leci (network-proof).
2. Po reloadzie + otwarciu przez chip: panel znowu pokazuje szkielet, a **autosave PUT-uje
   szkielet na serwer, nadpisując finalną treść**. Historia wersji zawiera tylko szkielet →
   **wygenerowany dokument jest bezpowrotnie utracony.**
3. Efekt uboczny: każdy mount panelu POST-uje nowy boilerplate draft ("Company Work Note") —
   4+ osierocone drafty w jednej rozmowie.

**Przyczyny zlokalizowane statycznie (dwa niezależne defekty — hipoteza "martwy setContent"
z handoffu OBALONA: restore idzie tą samą ścieżką propsa contentMd i działa live):**

- **D1 — wyścig boilerplate'u:** efekt starter-persist (`WorkCanvasDocumentPanel.tsx:1269-1296`)
  przy mount ze starterem 'document' i niezhydratowanym stanem POST-uje NOWY draft; callback
  (`:1204-1218`) ustawia `documentState.draftId` na boilerplate i nadpisuje
  `LAST_DRAFT_ID_STORAGE_KEY`. Guard listenera (`:993` — `readyDraftId !== documentState.draftId`)
  odtąd zawsze odrzuca refresh. Bump `canvasRemountNonce` POGARSZA sprawę (każdy remount może
  mintować kolejny boilerplate).
- **D2 — rozjazd SSOT `content_md` vs `content_json`:** runtime generacji pisze finał przez
  `workCanvasService.updateDraft`, który aktualizuje **tylko `content_json`**
  (`workCanvasService.ts:449-472`), podczas gdy PUT edytora pisze oba (`work-canvas.routes.ts:3378`),
  a `toDraft` **preferuje `content_md`** (`:617`). Każdy kliencki PUT w fazie szkieletu zamraża
  szkielet w `content_md` i finał z `content_json` jest trwale przesłonięty; retry 409
  (`:1168-1185`) dodatkowo nadpisuje finał szkieletem w OBU kolumnach.

**Fix (mały, precyzyjnie zlokalizowany):** (a) nie tworzyć boilerplate-draftu gdy podany
`initialDraftId`/`requestedCanvasDraftId`; (b) `updateDraft` pisze też `content_md` (albo toDraft
preferuje świeższe); (c) autosave wyłączony, dopóki treść zawiera marker szkieletu.

## P0-2 — LAUNCH BLOCKER: Canvas jest admin-only (capability-gating)

`WorkCanvasDocumentPanel.tsx:1038-1050` pobiera 9 capabilities `canvas.*` z
`GET /api/access/effective`; `effectiveAccessService` daje `'*'` tylko OWNER/ADMIN/SUPERADMIN,
a **żadna capability `canvas.*` nie istnieje w szablonach ról** (grep: 0 trafień). Skutek dla
zwykłego MEMBER-a: wszystkie Promote (idea/note/initiative/decision/task), outputy i **Share**
są wyszarzone (z mylącą etykietą "coming soon"). Testy ownera tego nie łapią — admin widzi wszystko.
Odwrotny problem bezpieczeństwa: **share/revoke server-side sprawdza tylko ownedDraft** —
capability `canvas.share` egzekwowana wyłącznie frontendowo; każdy member może mintować publiczny
link bezpośrednim wywołaniem API.
**Fix:** dodać `canvas.*` do szablonów ról member (decyzja produktowa które), + enforcement
share na serwerze.

## Wyniki audytu live (checklist DoD ze specu)

| # | Test | Werdykt |
|---|---|---|
| 1 | Deck: checklista → żywy deck → chip | **PASS** (uwagi jakości niżej) |
| 2 | Doc: szkielet → finalna proza bez reloadu | **FAIL — destrukcyjny** (P0-1) |
| 3 | Reload: chipy trwałe + otwierają właściwy artefakt | PARTIAL (chipy tak; doc wraca do szkieletu i nadpisuje) |
| 4 | Historia wersji + restore | **PASS** (restore realnie zmienia treść edytora) |
| 5 | Menu zaznaczenia: Condense/Expand/Tone/Explain | **PASS** (bug: brak guarda granic bloków — wklejka w środek H1) |
| 6 | Share → publiczny URL → revoke → 404 | **PASS** (pełny cykl, curl bez auth) |
| 7 | Zapis jako Notatka | **FAIL (UI)** — encja powstaje (ledger OK), ale brak toasta/linku, a deep-link pokazuje "No notebooks yet" |
| 8 | Switcher: 2 typy artefaktów w rozmowie | **PASS** |
| 9 | Higiena konsoli | **PASS** (0 błędów) |

## Audyt okablowania fal 1–3 (kod)

| Funkcja | Werdykt | Uwagi |
|---|---|---|
| C8 org-guard | **WIRED** | oba żywe writery kryte; site w `commitProposalToDomain` = dead code (nieosiągalny) |
| B1 wersje UI | **WIRED** | restore działa live; współdzieli ścieżkę propsa z D1/D2 — po fixie P0-1 przetestować ponownie |
| E1 skróty | **WIRED** | gating 3-warstwowy poprawny |
| B2 switcher+chip | **WIRED** | luka znana: switcher nie słucha `deliverables:draft-ready`; doc in-flight bez wpisu |
| C7 registry+panel | **WIRED** | branch **table NIE rejestruje** w registry; panel na inicjatywie OK |
| C4 pętla provenance | **PARTIALLY-WIRED** | ledger NIE pisany na żywej ścieżce akceptu propozycji (pisany w dead-code); sekcja w popoverze diagnostyki = niska odkrywalność |
| D1+D1b share | **WIRED** | + luka serwerowa j.w. (P0-2) |
| C6 retrieval | **WIRED** | `get_initiative` odpala tylko przy literalnym UUID (tematycznie nigdy); flag-off = byte-identical |

## Audyt triady generacji (kod + testy)

- **Deck L1: CONFIRMED** (pełny łańcuch; odstępstwo od planu: zamiast server-side toola Teresy
  jest frontendowy intercept — funkcjonalnie równoważne).
- **Doc L2: CONFIRMED** — anti-placeholder gate realny i blokujący; testy **16/16 PASS**.
- **Sheet L3: CONFIRMED** — twarda walidacja struktury GFM; bezstratny round-trip.
- **Flagi: CONFIRMED additive** — `ENABLE_DELIVERABLES_LIGHT` (backend, off→404) +
  `VITE_ENABLE_DELIVERABLES_LIGHT` (frontend, off→legacy redirecty verbatim).
- **sourceRefs: kontrakt przyjmuje, ŻADNE UI nie wysyła** (zgodne ze stanem planu — krok 4–5).

## Pozostałe znaleziska (priorytetyzowane)

P1: sheet bez chipa/switchera (brak `metadata.deliverable` + typ 'sheet' wykluczony w B2);
    deck renderuje surowe `##`, tokeny `[Fact: …]` i "Data gap:…" w treści slajdów;
    zapis-jako-notatka bez feedbacku + "No notebooks yet" na deep-linku.
P2: AI-edit bez guarda granic bloków; szkielet/marker PL-only dla artefaktów EN; hydration
    fallback parsuje envelope bez `.draft` (`:935`); `POST /:id/generate` defaultuje 'deck'.
P3: M-5 endpoint 500 (chip task_51148b11); brak unit-testów deck-brancha; dead code
    `commitProposalToDomain` (mylące podwójne implementacje — kandydat do usunięcia).

## Rekomendowana kolejność napraw

1. **P0-1** (D1+D2+autosave-guard) — to jest KROK 1 z `CANVAS_NEXT_STEPS_EXECUTION_PLAN.md`,
   teraz z dokładnymi adresami; po fixie re-test checków 2/3/7 + restore.
2. **P0-2** — capabilities `canvas.*` w rolach member + server-side share enforcement.
3. P1 (sheet-parity, czystość decka, UX zapisu do notatnika).
4. Dalej wg planu kroków (4–13).

Completeness po audycie: **triada ~85%, fale 1–3 ~90% okablowane, ale moduł NIE nadaje się do
udostępnienia poza adminów do czasu P0-1 + P0-2.**
