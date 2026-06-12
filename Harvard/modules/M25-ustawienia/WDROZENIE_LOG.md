# M25 — Ustawienia — Log wdrożenia

Wypełniany PO audycie, w trakcie realizacji planu dokończenia (Faza 8 karty).

| Data | Fala | Pozycja planu | Commit | Weryfikacja (dowód) | Status |
|---|---|---|---|---|---|
| 2026-06-12 | **FAZA 4 (żywa, staging)** | S1 smoke — Profil | — | **PASS**: `/settings/billing` osiągalny bez „Section not found" (decyzja #3); `/settings/profile` renderuje **realne dane usera** (email załadowany, 14 pól) + pełna nawigacja (Profil/Awatar/Podpisy/Godziny/Preferencje); zero crashy. FE+BE live. **Pending:** profile edit→save→reload persist (S1 pełne), notifications toggle persist (S2). | ZROBIONE (D smoke) |
| 2026-06-12 | **FAZA 4-deep (API)** | S1/S2/S5/S6 — API scenario verification + schema fix | `c4bfe757ca` + DB-fix | **S1 PASS**: profil get/save działa przez `/api/settings/import`. **S2 FAIL→FIXED**: wszystkie `user_preferences` write dawały HTTP 500 — `id NOT NULL` bez DEFAULT (staging-only schema drift); naprawiono `ALTER TABLE user_preferences ALTER COLUMN id SET DEFAULT gen_random_uuid()` na staging DB; weryfikacja `{"success":true}`. **S5 PASS**: `/api/gdpr/consents` GET+PUT działa, typy bool poprawne (`flagOn` z commit `64e5dba81a`). **S6 PASS**: `/api/ai-settings/user` GET+PUT, persistence potwierdzona. **Obserwacje:** dwa równoległe systemy GDPR (tabela `user_gdpr_consents` vs `user_preferences`); sesje `isCurrent` zawsze false (JWT nie ustawia req.sessionId). | ZROBIONE (API-deep) |
