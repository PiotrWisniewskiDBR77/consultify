---
doc_id: funkcje-odbior-172
status: canonical
truth_type: acceptance
established: 2026-08-30
---

# ODBIÓR 172 — ekrany kłamią · WERDYKT: SCALONO

Gałąź `codex/day172-ekrany-nieprawda-20260830` (1 commit `d4c215d123` nad `514c60b355`).
Odbiór adwersaryjny: kontener 6082, migracje idempotentne, testy 3/3 PG + 4/4 UI,
**mutacja odtworzona niezależnie** (throw przywrócony → 1 FAIL; cp-restore → 4/4).

**Podejrzenie główne OBALONE:** przycisk statusu inicjatywy NIE prowadzi do błędu —
`updateInitiativeStatusWriteTruth` woła realny `PATCH /initiatives/…/status`, a front
i backend używają JEDNEJ funkcji autoryzacji (`canExecuteGate`,
`initiativeCapabilityMatrix.ts:264/311`): przycisk pojawia się tylko dla przejść,
które backend potwierdził. Zmierzone: DRAFT→PENDING_REVIEW 200+zapis; bez roli 403+0.
Liczniki: wariant (b) ukrywa licznik strukturalnie dla KAŻDEGO stanu (nie łatka zera).

Oceny: przycisk **A** · liczniki **A** · dyscyplina licencji **B** (nieujawnione
addytywne dotknięcie `KimiWorkspaceShell.tsx` pod wariantem b) · higiena **C**.

**Dwa wpisy do sprzątnięcia przy najbliższym dotknięciu plików:**
1. `InitiativeDocumentView.tsx` ~:5709 — komentarz DEC-104 twierdzi „no card-level
   status write path exists" — **kłamie obok naprawionej ścieżki**.
2. Korekta licencji w raporcie 172 (KimiWorkspaceShell) — dopisana tu, nie w raporcie.

Uwaga procesowa: instrukcja 172 nie jest w gałęzi dyżuru (żyje w `6514a4d235` na
linii integracyjnej) — poprawne wg DEC-95, wykonawca czytał z tipa.
