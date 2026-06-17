# Domknięcie M01–M04 do 100% — precyzyjna lista braków

> Stan na 2026-06-15 (noc). Definicja „100%": wszystkie pozycje schematów PASS **live**, wszystkie realne bugi naprawione, repo **buildowalne/deployowalne**. Legenda: 🔧 FIX (realna robota kodu) · 👁 VERIFY (wired/code-verified, brak potwierdzenia live) · 🖐 MANUAL (headless nie odda — klik w realnym Chrome) · 🔴 blocker.

---

## 0. CROSS-CUTTING (blokuje resztę)
- 🔴🔧 **Build-integrity:** 73 plików `.tsx` w `src/` jest **untracked**, a tracked kod je importuje → **clean build (staging/prod) padnie**. Trzeba: zacommitować wymagane pliki LUB naprawić importy, potem zweryfikować czysty build (tsc + Docker). **To blokuje deploy i jest warunkiem „done".**
- 🔧 **Staging DB:** idle-client drops (`Postgres Unexpected error on idle client`) — kandydat na `keepAlive:true` w puli (pula 40 już złagodziła freeze'y).

---

## M01 — Czat (Teresa)
**Zweryfikowane:** composer, ToolsMenu (5 trybów), Deep analysis E2E, **Show reasoning → R1 + live-stream (🆕 zbudowane)**, Co-Thinker (render 6 person), steering, send front→back, Response style modal (8 stylów).

Do 100%:
- 👁 **Multi-agent (Decision Room)** — wired w kodzie, brak potwierdzenia live (1 zapytanie → ścieżka Decision Room).
- 👁 **Wpływ persony Co-Thinker** na treść odpowiedzi (kliknięcie działa; efekt na odpowiedzi niepotwierdzony).
- 👁 **Private mode** — efekt (rozmowa nie idzie do pamięci) niepotwierdzony.
- 🖐 **Read responses (TTS)** — audio (headless nie odda; odsłuch w Chrome).
- 👁 **Slash-commands / @-wzmianki / załączniki** (upload pliku) — nieklikane.
- 👁 **Zarządzanie rozmowami** (rename / delete / search) — nieklikane.
- 👁 **Reasoning-live „klatka pisania"** — mechanizm działa; pokazać na ZŁOŻONYM pytaniu (dłuższe myślenie) dla wyraźnego dowodu wizualnego.

## M02 — Canvas
**Zweryfikowane:** top bar, toolbar 16, AI diff (N-8 zastępuje+persist), język PL (N-10), routing (N-12), Canvas↔Teresa (N-1 + append fix), PROMOTE→note (DB), OUTPUT→table (200), historia wersji+restore, eksport (endpoint 200), Reasoning.

Do 100%:
- 🔧 **Tabele niekonsystentne (N-9):** ścieżka one-shot nie zawsze generuje tabelę (zależne od modelu). Utwardzić, żeby tabela wychodziła zawsze gdy zasadna (np. wymusić w prompcie/retry).
- 👁 **OUTPUT → presentation/report:** schemat ZSYNCHRONIZOWANY (presentation_cards/report_blocks dodane), ale **brak live re-weryfikacji** po sync (create-output deck/report → 200 + artefakt).
- 👁 **PROMOTE pozostałe 4 encje** (idea / initiative / decision / task) — zweryfikowana tylko note; każda do potwierdzenia E2E (encja w module docelowym).
- 🖐 **Eksport — pobranie pliku** (PDF/DOCX/PPTX/XLSX) na dysk (endpoint daje 200+treść; sam zapis pliku = realny Chrome).
- 🖐 **Share → publiczny link + incognito + revoke** (capability OK; pełny token+podgląd niezweryfikowany).
- 👁 **Standalone `/ai/work-canvas`** — nietknięte.

## M03 — Moja Praca
**Zweryfikowane live:** Inbox (256), Kalendarz (+uczciwy status integracji 🆕), Tasks (200), Decyzje (+ P0 link persystuje), Manager (Executive Dashboard). Backend N1-N3 naprawione (ai-operator 500→200 verified, COALESCE, meetings type).

Do 100%:
- 🔧 **M03-N4 (kpis):** 4 serwisy (`aiOperatorService`, `contextPackBuilder`, `contextPackService`, `ideaAIGeneratorService`) wołają **nieistniejącą tabelę `kpis`** → cicha degradacja kontekstu AI. Fix = wskazać `project_kpis`/`initiative_kpis` albo dodać widok. **Decyzja co do intencji + fix.**
- 👁 **Inbox akcje** (triage / snooze / bulk-triage / AI-assist) — panel renderuje, akcje nieklikane.
- 👁 **Kalendarz** — create event / drag-reschedule / day-load (konflikty) — nieklikane.
- 👁 **Zadania** — pełny flow UI „utwórz decyzję z zadania → reload" (P0 potwierdzony API; UI detalu flaky w headless — doklikać w Chrome) + CRUD/status/bulk.
- 👁 **Decyzje** — decide/reject/delegate/escalate/snooze/remind/bulk — nieklikane.
- 👁 **Manager** — „Task Execution: No data" (sprawdzić czy brak danych czy bug) + AI Operator readiness 0%.

## M04 — Notatnik
**Zweryfikowane live:** biblioteka (16), edytor TipTap (canonical path, tagi, verification), toast ekstrakcji akcji, SlashMenu się otwiera. Fixy: numberose→numbered, 403→fallback, provenance bulk, martwy kod.

Do 100%:
- 👁 **SlashMenu AI realnie** (ask/expand/challenge/action) — menu się otwiera; uruchomić komendę i potwierdzić wynik (tu żył fix `numberose` — sprawdzić /challenge i /action po polsku/angielsku).
- 👁 **Konwersje** (→task/decision/initiative/assessment/report/presentation, →Canvas „Rozwiń w dokument") — code-verified, nieklikane.
- 👁 **Capture API** (web-clip/email/upload/import) — nieweryfikowane.
- 👁 **AI Proposals** (accept/reject) — nieweryfikowane.
- 👁 **403 → fallback legacy** (fix) — wymaga scenariusza 403 do potwierdzenia.
- 👁 **Ekstrakcja akcji bulk + provenance** (fix) — potwierdzić, że masowe taski mają link do notatki.

---

## Rekomendowana kolejność domknięcia (jako CTO)
1. **🔴 Build-integrity** (73 pliki) — bez tego nie ma deployu ani „done". Najpierw.
2. **🔧 Realne fixy:** tabele-konsystencja (M02), M03-N4 kpis. (2 rzeczy kodu.)
3. **👁 Wspólny klik w Twoim Chrome** (mamy sesję) — przejść owe VERIFY: OUTPUT deck/report, PROMOTE 4 encje, M03 akcje paneli, M04 SlashMenu-AI/konwersje/proposals, M01 multiagent/persona/private/slash-@-attach/conv-mgmt.
4. **🖐 MANUAL** (pobrania plików, TTS, share-incognito) — szybkie w realnym Chrome.
5. Dopiero potem **deploy na staging** (FF `staging` → dispatch).

**Szacunek:** punkty 2-4 to ~kilka godzin wspólnej pracy; pkt 1 zależy od tego, czy 73 pliki są gotowe do commita (Twój WIP).
