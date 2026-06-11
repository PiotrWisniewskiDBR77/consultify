# MAPA MODUŁÓW V2 — podział audytowy całej aplikacji (2026-06-11)

**Decyzja właścicielska:** nowy podział audytowy aplikacji wg realnego Sidebara (źródło prawdy: `src/components/navigation/Sidebar/menuConfig.ts` + `src/routes/AppRoutes.tsx`, zweryfikowane w kodzie 2026-06-11, branch `feat/deliverables-light`). Zastępuje podział 19-modułowy z audytu 2026-06-02. **27 modułów + 1 aneks** — każdy dostanie osobny audyt i plan dokończenia.

**Zmiany vs podział 2026-06-02:**
- Ideas rozbite na 5 pozycji (decyzja 2026-06-11, karty już istnieją w `ideas/`)
- Canvas (split-view czatu) wyodrębniony jako osobny moduł (program Canvas + deliverables-light)
- Moja Praca rozbita na: organizer osobisty + Notatnik (osobny program przebudowy)
- Audyty (Audit Orchestrator) — nowy moduł, nie istniał 2026-06-02
- MCP IRIS / MCP Marketplace — usunięte z nawigacji (decyzja D7), wypadają z podziału
- Dokumenty: `/wordy` = redirect; kanon to Document Studio
- Organizacja, Admin, SuperAdmin, Partner — bez zmian pozycji, świeże inwentarze

**Pełne inwentarze funkcjonalności:** katalog `inventory/` (INV_A…INV_G) — każda funkcjonalność ze statusem [DZIAŁA / ZA FLAGĄ / WIDOCZNE-ALE-ZEPSUTE / UKRYTE / STUB / MARTWY KOD] i plikiem źródłowym.

---

## Tabela zbiorcza

| # | Moduł | Route | Gating dziś | Inwentarz | Karta audytu |
|---|-------|-------|-------------|-----------|--------------|
| M01 | **Czat** | `/chat` | otwarte (core) | INV_A | 2026-06-02: MODULE_01 (62/100) — do odświeżenia |
| M02 | **Canvas** (split-view + deliverables-light) | panel w czacie; `/public/artifacts/:token` | częściowo za `ENABLE_DELIVERABLES_LIGHT` | INV_A | 2026-06-10: audyty Canvas+Deliverables w docs/audit/2026-06-10/ |
| M03 | **Moja Praca — organizer** (Inbox, Zadania, Decyzje, Kalendarz, Manager; Home/Radar ukryte) | `/my-work/*` | otwarte (core) | INV_B | 2026-06-02: MODULE_02 (57/100) — do rozbicia |
| M04 | **Notatnik** | `/my-work/notebook` | otwarte | INV_B | brak osobnej karty — NOWY |
| M05 | **Ideas — Zarządzanie** | `/my-work/ideas` | beta closed (wszyscy) | ideas/02A | **2026-06-11: 68/100 + plan** |
| M06 | **Ideas — Mind Map** | `…/workspace/mindmap` | beta closed | ideas/02B | **2026-06-11: 72/100 + plan** |
| M07 | **Ideas — Process Flow** | `…/workspace/process_flow` | beta closed | ideas/02C | **2026-06-11: 48/100 + plan** |
| M08 | **Ideas — Table** | `…/workspace/table` | beta closed | ideas/02D | **2026-06-11: 60/100 + plan** |
| M09 | **Ideas — Whiteboard** | `…/workspace/whiteboard` | beta closed | ideas/02E | **2026-06-11: 58/100 + plan** |
| M10 | **Wywiad** | `/discovery` | otwarte (core) | INV_C | 2026-06-02: MODULE_03 + program to-100% (2026-06-06) |
| M11 | **Narzędzia** (Library + Assessment) | `/discovery-tools`, `/assessment` | zablokowane na public prod | INV_C | 2026-06-02: MODULE_04 (48/100) |
| M12 | **Audyty** (Audit Orchestrator) | `/audit-programs` | beta closed (wszyscy) | INV_C | brak — NOWY |
| M13 | **Inicjatywy** | `/initiatives` | otwarte (core) | INV_D | 2026-06-02: MODULE_05 (55/100) + INITIATIVE_FORMULA |
| M14 | **Wdrożenie** | `/implementation` | otwarte (core) | INV_D | 2026-06-02: MODULE_06 (51/100) |
| M15 | **Rezultaty** | `/benefits` | beta closed (wszyscy) | INV_D | 2026-06-02: MODULE_07 (45/100) |
| M16 | **Finanse** | `/finance` | beta closed (wszyscy) | INV_D | 2026-06-02: MODULE_08 (47/100) |
| M17 | **Outputs** | `/presentations` | beta closed + backend za `ENABLE_V8_GLOBAL` | INV_E | 2026-06-02: MODULE_09 (49/100) |
| M18 | **Dokumenty** (Document Studio) | `/document-studio` | beta closed | INV_E | 2026-06-02: MODULE_10 (53/100) — duże zmiany od tego czasu |
| M19 | **Prezentacje** (P20 + DeckBuilder) | `/prezentacje`, `/presentations/builder` | beta closed; pipeline za `ENABLE_V8_GLOBAL` | INV_E | 2026-06-02: MODULE_12 (58/100) |
| M20 | **Tabele Studio** | `/tabele` | beta closed; 193 endpointy platformy | INV_E | 2026-06-02: MODULE_11 (44/100) |
| M21 | **Meeting** | `/meeting` | beta closed | INV_E | 2026-06-02: MODULE_13 (38/100) — stan „unmounted" NIEAKTUALNY |
| M22 | **AI OS / Internal Tools** | `/ai/*` | internal (DBR77: domena+rola+env) | INV_F | brak osobnej karty — NOWY |
| M23 | **Organizacja** | `/organization/*` | sidebar: admin+; route: każdy zalogowany | INV_F | 2026-06-02: MODULE_16 (52/100) |
| M24 | **Panel Administratora** | `/admin/*` | rola ADMIN | INV_G | 2026-06-02: MODULE_17 (54/100) + plan 2026-06-07 |
| M25 | **Ustawienia** | `/settings/*` | otwarte (core) | INV_G | 2026-06-02: MODULE_18 (56/100) |
| M26 | **Portal Partnerski** | `/partner/*` | wpis za `connected=true`; route otwarte celowo | INV_G | 2026-06-02: MODULE_19 (41/100) |
| M27 | **SuperAdmin** | `/superadmin/*` | rola SUPERADMIN | INV_G | brak osobnej karty — NOWY (control plane) |
| A1 | *(aneks)* **Ecosystem/Affiliate** | `/affiliate` | journeyState gate | INV_G | STUB end-to-end — decyzja: budować albo wyciąć |

*(Wyniki /100 z 2026-06-02 są wskaźnikowe — od tego czasu wiele modułów istotnie się zmieniło; nowy audyt nada świeże oceny.)*

---

## Charakterystyka modułów (skrót — pełnia w inwentarzach)

**M01 Czat** — 59 pozycji inwentarza: zarządzanie rozmowami (11), kompozer (10: slash-commands, @-wzmianki, załączniki, Co-Thinker, focus mode), wiadomości (13: streaming SSE, cytowania, karty propozycji, chipy artefaktów), deep research (orkiestrator v2), głos Teresy (Gemini Live + TTS), kontekst org/encji (8), handoffy intencji do 7 celów (deck/doc/sheet/mindmap/flow/whiteboard/canvas-write). Czerwone flagi: rodzina flag chatV9 nieaudytowana, martwe komponenty (WorkModeMenu, ChatOverlay, CodeInterpreter).

**M02 Canvas** — 33 pozycje: edytor TipTap + AI floating menu z diff accept/reject, TRIADA deliverables (deck/doc/sheet za flagą, live-proven), wersje+restore, public share+revoke, eksport 7 formatów, promote do 5 encji + 3 ścieżki Outputs, registry C7. Czerwone flagi: provenance C4 nie pisany na żywej ścieżce, deck z surowym `##`/`[Fact:…]`, sourceRefs przyjmowane-nieużywane.

**M03 Moja Praca — organizer** — Inbox (10 funkcji, triage z AI), Zadania (11; w tym P0: linkowanie decyzji = 4 hardcodowane mocki), Decyzje (8; timeline celowo ukryty), Kalendarz (8, integracje Google/Outlook), Manager/Executive (6), Home/Radar w całości UKRYTY (`RADAR_ENABLED=false`, backend żywy), Focus = zapis działa/odczyt bez UI. Ogromna lista martwego kodu (WorkCenter + ~25 komponentów).

**M04 Notatnik** — 19 funkcji: dwupoziomowa biblioteka, TipTap + SlashMenu z AI (ask/expand/challenge/action), ekstrakcja akcji, klasyfikacja, konwersje (→output, →zadania, →Canvas), Capture API. Powiązany program: notebook structure overhaul (typologia personal/team). Uwaga: korupcja codemodu „rose" w AIChatInlinePanel.

**M05–M09 Ideas** — patrz `ideas/_INDEX_IDEAS_SPLIT.md` (5 kart z planami rozwoju; średnia ~61/100; wspólne P0: model per-user blokuje współpracę, kłamiący konflikt 409, wielu writerów wersji).

**M10 Wywiad** — 15 pozycji: pełny cykl szablony→przydziały→sesje (3 tryby runtime, w tym konwersacyjny z AI-parse)→wnioski (InsightViewer z material quality)→inicjatywy (wizard generate_from_evidence). 89+23 handlerów serwerowych. Ankiety (VTS/Elkomtech) = szablony wywiadu; seed Elkomtech untracked. Redesign 4-kroków z 2026-06-06 NIE zbudowany.

**M11 Narzędzia** — Library: katalog 31 narzędzi, **14 SHIP / 17 coming-soon**; runner sesji z governance AI; Megatrendy. Assessment: 5 frameworków (DRD/SIRI/ADMA/CMMI/LEAN) z lifecycle i edytorami; wizard inicjatyw za flagą OFF. Czerwona flaga: 3 digital-SHIP na generycznym formularzu.

**M12 Audyty** — orkiestrator programów (fan-out ankiet przez szablony wywiadów): kreator 4-krokowy, presety ISO27001/new-company, completion rollup. Kodowo kompletny E2E, w całości za zamkniętą betą. UWAGA: nazwa myli — to nie runner DRD/SIRI (te w M11).

**M13 Inicjatywy** — 19 pozycji: 4 widoki + dokument ~30 sekcji + zakładka Analysis z grafem zależności. **Czerwona flaga P1: całe tworzenie z huba wyłączone „w przygotowaniu"** (Charter/AI Wizard/New disabled) — żywe tylko deep-link `?new=1` i generator z insightów. ROI `/roi` już realny, ale bez wejścia z nawigacji.

**M14 Wdrożenie** — 13 pozycji: executive dashboard, 3 widoki portfela, Action Queue, RAID, Rollout (trwałe dane — naprawione vs 06-02), raporty z generacją z live-data, Manager z people-change.

**M15 Rezultaty** — 5 zakładek (Initiatives/KPI×4 tryby/Reports×5 trybów enterprise z approval-gatingiem/ROI/ROI Analysis) + showcase-data fallback. Dual-runtime V8→legacy. Martwy `BenefitsHub` (8 zakładek) do wycięcia.

**M16 Finanse** — 6 zakładek (Statements z importem Excel/Modele/Analiza/Predykcja/Wycena/Inwestycyjna) + V8 za flagą. Billing NIE tu (superadmin); mock karty usunięty, self-serve za kill-switchem OFF.

**M17 Outputs** — 16 pozycji: rejestr artefaktów z trust-state (5 filarów), bramka eksportu za aprobatą, review/publish, lineage. **Czerwona flaga: listy = `GET /api/artifacts` za `ENABLE_V8_GLOBAL`** — bez flagi moduł pusty (finding v8-404).

**M18 Dokumenty** — 9 pozycji: 3 tryby generacji (intake/architect/template), edytor proposalowy 6 poziomów, QA-gate eksportu, persistencja NAPRAWIONA (DAO write-through). Najbardziej zmieniony moduł vs 06-02.

**M19 Prezentacje** — 16 pozycji: pipeline V8 generacji, DeckBuilder WYSIWYG (MELS default ON), wersje, share+analytics, agent Teresa, governance, quality-gates eksportu. Bramka kontaktowa USUNIĘTA. STUB: collaborate (invite bez handlerów).

**M20 Tabele Studio** — 16 pozycji na 193 endpointach: Records API default ON, widoki, formuły v2, realtime+presence, AI Editor 8 poziomów (BE ON), automatyzacje, formularze, governed models. Rozjazd: 4 flagi BE runtime-ON przy komentarzach „OFF"; FE flagi QA/SourcePack/Conversions OFF.

**M21 Meeting** — 8 pozycji, wszystko DZIAŁA (CRUD, statusy, decyzje, follow-upy, notatki AI z wklejonego transkryptu, operator brief). Luka produktowa: brak audio/integracji kalendarza.

**M22 AI OS** — 8 paneli (Home/Actions/Research/Artifacts/Memory/Connectors/Agents/Outcomes), ~40 funkcji governance AI, podwójny gating DBR77. Artifacts dodatkowo za `ENABLE_V8_GLOBAL` (panel widoczny, API 404). OAuth konektorów symulowany ręcznie.

**M23 Organizacja** — 14 pozycji. Czerwone flagi: **Goals/Challenges/Strategy = localStorage-only** (nie zasilają kontekstu Teresy), podwójna implementacja sekcji admin (redirect vs lokalny panel), CTA Billing/Limits ślepe, route bez gatingu roli.

**M24 Admin** — 5 paneli kanonicznych (Team/Billing/AI×9/Security×6/Audit), P0 superadmin-redirect zamknięty. Do sprzątnięcia: layout/AdminSidebar + resztki components/Admin.

**M25 Ustawienia** — ~35 sekcji w 10 grupach; GDPR-delete z hasłem NAPRAWIONE, Calendar Sync realny. Czerwone flagi: Voice & TTS false-negative, `/settings/billing` = „Section not found", Shortcuts bez dispatchera.

**M26 Portal Partnerski** — 24 sekcje w 8 grupach; auth payoutów NAPRAWIONE, performance uczciwe. **26 endpointów 503 (celowy kontrakt)** — zapisy Client Management, licencje, faktury.

**M27 SuperAdmin** — 5 sekcji × dziesiątki zakładek (Tenant Ops 20, AI Platform 7×N, System, Governance, Security 15). Virtual Workers (Anna/Teresa) UKRYTE — tylko URL. Znane: feedback pulse/feature 500 (brak tabel prod).

**A1 Ecosystem/Affiliate** — STUB end-to-end (klient atrapy + serwer 503). Decyzja produktowa: budować albo wyciąć z menu.

---

## Wątki przekrojowe (systemowe — naprawiać raz, nie 27 razy)

1. **Beta-lock tylko nawigacyjny** — `betaAccess.ts` blokuje sidebar (także adminom: `BETA_ADMINS_EXEMPT=false`), ale ŻADEN route nie egzekwuje bety → bezpośredni URL omija blokadę wszędzie (M05-M09, M12, M15-M21). Decyzja: route-guard albo świadoma akceptacja.
2. **`ENABLE_V8_GLOBAL` jako pojedynczy punkt awarii** — Outputs (M17), pipeline Prezentacji (M19), generacja Tabel (M20), AI OS Artifacts (M22) i inbox kanoniczny (M03) zależą od jednej flagi + org-gate; przy OFF moduły wyglądają na puste/zepsute bez komunikatu.
3. **Rozjazd flag BE: komentarz/zod-default „OFF" vs runtime `!== 'false'` = ON** — co najmniej 4 flagi Tabel; audyt flag w `FeatureFlags.ts` potrzebny.
4. **Martwy kod na dużą skalę** — My Work (~25 komponentów), Benefits/BenefitsHub, Economics/*, Admin/*, layout/*-Sidebar, Focus/*, Home v1. Jeden porządkujący PR obniży koszt każdego przyszłego audytu.
5. **Dane lokalne udające serwerowe** — Organizacja Goals/Challenges/Strategy (localStorage), rename tabel Ideas, sloty rozmaitych „save" — wzorzec do wyplenienia.
6. **Public-production lock** (`publicProduction.ts`) — na consultify.ai tylko 6 modułów core; mapa V2 musi być czytana przez ten pryzmat przy planowaniu GA.
7. **Naprawione od 2026-06-02 (nie powielać starych findingów):** Document Studio persistencja, Meeting zamontowany, Rollout trwały, zaproszenia org, GDPR-delete, Calendar Sync, partner auth/payouts, superadmin-redirect, mock karty płatniczej, bramka kontaktowa Prezentacji, ROI „Under Construction".

## Następny krok

Osobne audyty per moduł (M01→M27) wg metody kart Ideas: ocena /100 + realne/mock/zepsute + wiring + testy + UX vs benchmark + **plan dokończenia w falach**. Proponowana kolejność: najpierw moduły core otwarte dla klientów (M01, M03, M10, M13, M14, M25), potem beta-closed wg priorytetu produktowego, na końcu internal/admin.
