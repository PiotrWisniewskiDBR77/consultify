# 🚀 CHECKLISTA CUTOVER Londyn → PROD (Faza 5)

> **STATUS: DO AKCEPTACJI PIOTRA — NIE WYKONANO.** Cutover kodu na prod (centerbeam) wymaga
> jawnej, osobnej zgody. Ten dokument to plan + bramy; żaden krok mutujący prod nie został uruchomiony.
> Autor: Harvard 5 · Data: 2026-06-17 · Branch: `Londyn`

---

## ⛔ BLOKER #1 — SCHEMA DRIFT (musi być rozwiązany PRZED cutover)

`npm run db:verify:schema:staging` (trolley) 2026-06-17 wykazał **NIE-zero drift**:
- **41 brakujących tabel** (migracje niezaaplikowane) — m.in. `ai_long_term_memory`, `conversation_summaries`,
  `knowledge_documents`, `v8_lane_decisions`, `presentation_governance_subscriber_tokens`, tabele partner v2.
- **59 brakujących kolumn** — m.in. `organization_profiles.*` (8 pól P30d), `presentation_decks.*` (canvas contract),
  `users.scim_*` (SCIM v4), `partner_*` (certification v2 / resources), `initiatives.workstream_id`.
- Oczekiwane: 876 tabel, 962 ALTER-kolumn.

**To jest dług migracyjny zarówno na staging (trolley) jak i prawdopodobnie prod (centerbeam)** — zgodne z
M26 L-08 (runbook `M26_SCHEMA_DRIFT_RUNBOOK.md`), ale szerszy (dotyczy wielu modułów, nie tylko partner).

**Wymagane (Piotr, za zgodą):**
1. `ENV_FILE=.env.staging.local npm run migrate` → staging do dnia.
2. `npm run db:verify:schema:staging` → **0 drift** (re-run, oczekiwany czysty raport).
3. Smoke staging po migracji (sekcja D).
4. Dopiero po zielonym staging: ten sam cykl na prod (osobna zgoda).

---

## A · BRAMY PRE-CUTOVER (kod gotowy)

- [ ] `npx tsc --noEmit` — 0 błędów na `Londyn` (strefa Fala 2 czysta; cross-zone weryfikuje koordynator).
- [ ] CI zielony: `tests/unit|integration|components` (uwaga: tylko te ścieżki w CI — `src/**/__tests__` poza CI).
- [ ] Testy bezpieczeństwa Fala 2 zielone: `llm-superadmin-gate` (8/8), `account-deletion-routes-guard` (6/6),
      `superadmin-l09-regression` (2/2), `partners.happy-path-and-fallback` (6/6).
- [ ] Rejestry §03 zrekoncyliowane z kodem (sekcja C — status programu).
- [ ] `_DECYZJE_RUNDA3.md` — wszystkie decyzje produktowe podpisane.
- [ ] Build prod artefakt: `npm run build` bez błędów; brak untracked plików importowanych przez tracked
      (`git archive` test — patrz finding build-integrity).

## B · BACKUP (przed dotknięciem prod)

- [ ] Snapshot DB prod (centerbeam) — Railway backup/`pg_dump` (Piotr, dostęp do centerbeam).
- [ ] Tag git punktu cofnięcia: `git tag pre-cutover-<data>` na obecnym prod HEAD.
- [ ] Zapis obecnych zmiennych env Railway (lista kluczy, BEZ wartości) — do szybkiego rollbacku.

## C · CUTOVER (Londyn → prod) — kolejność

1. [ ] Merge/deploy `Londyn` → środowisko prod (Railway centerbeam) — **za zgodą Piotra**.
2. [ ] `railway run npm run migrate` na centerbeam (po backupie) → zastosuj zaległe migracje.
3. [ ] `npm run db:verify:schema` (prod) → **0 drift** (gate; jeśli drift → STOP + rollback).
4. [ ] Restart serwisu; sprawdź logi startowe (DatabaseInitializer nie połyka błędów — patrz finding staging-drift).
5. [ ] Health: `GET /api/health` → 200; `GET /api/public/anna/voice-config` → 200.

## D · SMOKE POST-CUTOVER (per moduł — lista OK/ERR)

> Wymaga sesji zalogowanej; moduły superadmin/partner wymagają odpowiednich kont (🟦 jeśli brak).

- [ ] M01 Czat · M02 Canvas — wysłanie wiadomości, split-view
- [ ] M03-M08 Ideas suite — render list + 1 narzędzie
- [ ] M10 Wywiad · M12 Audyty · M13 Inicjatywy — render + 1 akcja
- [ ] M14-M16 Wdrożenie/Rezultaty/Finanse — render
- [ ] M17-M21 Outputs/Dokumenty/Prezentacje/Tabele/Meeting — render + 1 generacja
- [ ] M22 AI OS (Wave panels) — render (🟦 superadmin dla AIPlatformModule)
- [ ] M23 Organizacja — profil + org-switch
- [ ] M24 Admin — members/audit/billing tabele (FilterableTable)
- [ ] M25 Ustawienia — profil/security/privacy (GDPR delete = NIE wykonywać realnie)
- [ ] M26 Portal Partnerski — connect→dashboard (🟦 konto partnera)
- [ ] M27 SuperAdmin — control-plane (🟦 konto superadmin; L-10 feedback 500 live-verify TU)

## E · ROLLBACK (jeśli któraś brama czerwona)

1. [ ] Redeploy poprzedniego prod HEAD (`pre-cutover-<data>` tag).
2. [ ] Jeśli migracje uruchomione i powodują problem: restore z backupu DB (sekcja B).
3. [ ] Potwierdź health 200 + smoke M01/M02 na przywróconym.

---

## ZASADY TWARDE (przypomnienie)
- Prod (centerbeam) tylko za jawną, osobną zgodą Piotra. Staging (trolley/caboose) najpierw.
- `.env.local` nadpisuje `DATABASE_URL` → weryfikuj cel przed każdą mutacją.
- Sekrety/klucze Railway — ustawia Piotr osobiście, agent nigdy nie wpisuje.
- Migracje prod = osobna świadoma decyzja po zielonym staging.
