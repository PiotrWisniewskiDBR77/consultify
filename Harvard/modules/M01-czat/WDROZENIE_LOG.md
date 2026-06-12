# M01 — Czat — Log wdrożenia

Wypełniany PO audycie, w trakcie realizacji planu dokończenia (Faza 8 karty).

| Data | Fala | Pozycja planu | Commit | Weryfikacja (dowód) | Status |
|---|---|---|---|---|---|
| 2026-06-11 | quick-fix (Krok 4, reguła 2) | Fala 1 #4 — crash hasła share | _ten commit_ | `share.routes.ts:592` `hashPasscode`→`await scryptHash` (niezdefiniowana funkcja → ReferenceError); zgodne z wzorcem :304/:417 | ZROBIONE |
| 2026-06-12 | **FAZA 4 (żywa)** | Scenariusze krytyczne S1, S2 | — (weryfikacja) | **S1 PASS** (live, staging): nowa rozmowa `/chat/698823ea…` → prompt → **streaming SSE** (Teresa odpowiedziała + grounding „10 sources") → **reload → obie wiadomości trwałe**. **S2 PASS**: „/" → menu slash-komend (Utwórz tabelę/Generuj obraz…), intercept intencji żywy. Smoke: render OK, `/api/conversations` 200, zero błędów konsoli. **Pending:** S3 (załącznik), S5 (share/revoke), S6 (Canvas handoff), S7 (głos). | ZROBIONE (D częściowa) |
