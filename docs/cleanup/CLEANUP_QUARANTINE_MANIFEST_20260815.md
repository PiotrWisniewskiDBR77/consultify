# Cleanup Residual Manifest v1 (2026-08-15)

## Freeze status
- Freeze coding mode jest obowiązkowy do kolejnego checkpointu modułowego.
- Żadnych zmian produktowych poza zamknięciami modułów z planu.
- To jest dokument operacyjny, nie wdrożeniowy.

## Autoritative base snapshot
- HEAD: 635fd2d48d
- Branch: codex/sync-demo-20260729
- Pliki w statusie: 364
- Tracked modified: 175
- Untracked: 189

## Koszyki klasyfikacji

### KEEP_FOR_DOCS (dowód, dokumentacja, governance)
- docs/**/* (w tym docs/program, docs/modules, docs/product, docs/ui-standards)
- docs/cleanup/* newly generated in this cycle
- docs/ssot/registry.json (ważny rejestr SSOT)
- .claude/launch.json
- .tmp-ie-live-acceptance.mjs (tylko po potwierdzeniu test-gate i użyciu jako seed/run script)

### QUARANTINE_LOCAL (tymczasowe aktywa robocze, screenshoty, sesje)
- tools/
- tmp/
- artifacts/
- dev-render/*
- Harvard/legacy screenshoty i pliki tymczasowe
- root tmp artifacts (m.in. konsultacyjne, logi, pdfy/raporty nieprzydzielone)

### ARCHIVE_BACKUP (wartość historyczna i recovery)
- Harvard/* (wszystkie pliki z katalogu zachowane jako kontekst organizacyjny/operacyjny)
- CONSULTIFY_COMPLETE_MVP_CHECKPOINT.md i raporty M08/M09/M12/M14/M15
- AI_HANDOVER
- missing-tip-relation-old.tsv (ważne dla recovery i missing-tip)

### IMMEDIATE_CLEAN_CANDIDATE (prawdopodobnie do usunięcia z tego drzewa)
- audit-results.txt
- detailed-fixes.md
- AUDYT_SRODOWISKA_ODBIORU.md
- duplikaty dokumentów z nieaktualnym zakresem, jeśli brak odwołania do rejestru i statusu kanonicznego

### DYNAMIC_PENDING (wymaga decyzji właściciela modułu)
- docs/START_HERE.md (sprawdzić, czy ma pozostać jako wejście projektowe)
- nowe foldery `docs/modules/*` z niezatwierdzonymi audytami (np. initiatives-execution-canon, results-vnext, case-workspace)
- untrackowane pakiety MVP (M08_M..M15_MVP_*) — utrzymać jako evidence-only, dopóki nie zasilą doc-acceptance matrix

## Następny krok (blok domknięcia)
1) Zamrozić ruch: tylko ręczne klasyfikowanie.
2) Dla każdego pliku untracked: przypisać jednoznaczny koszyk.
3) Przenieść tylko to, co nieprodukcyjne, do `_quarantine/` dopiero po decyzji „keep/keep-as-docs/remove”.
4) Zaktualizować Module Closure Ledger dla 16 modułów i wygenerować „ready-blockers” per moduł.

## Notatka operacyjna
Ten manifest jest stanem pochodzącym z obecnego drzewa roboczego. Nie jest jeszcze aktem końcowym.
