# 📋 REKONSYLIACJA DOSSIERS vs KOD (Faza 5)

> Autor: Harvard 5 · 2026-06-17 · Branch `Londyn`. Cel: rejestr §03 zgodny z kodem przed cutover.
> Metoda: grep statusów §03 per moduł + weryfikacja otwartych luk w żywym kodzie.

## Stan programu (closed/total per dossier)

| Moduł | Stan | Moduł | Stan | Moduł | Stan |
|-------|------|-------|------|-------|------|
| M01 Czat | 9/10 | M10 Wywiad | 8/9 | M19 Prezentacje | 8/9 |
| M02 Canvas | 14/15 | M12 Audyty | 9/10 | M20 Tabele | **10/11** |
| M03 Moja Praca | **11/11** | M13 Inicjatywy | 13/14 | M21 Meeting | 8/9 |
| M04 Notatnik | **11/11** | M14 Wdrożenie | **9/9** | **M22 AI OS** | **9/9** |
| M05 Ideas zarz. | **8/8** | M15 Rezultaty | 11/12 | **M23 Organizacja** | **9/9** ✅ |
| M06 Mind Map | **7/7** | M16 Finanse | **7/7** | **M24 Admin** | **9/9** |
| M07 Process Flow | **6/6** | M17 Outputs | 10/12 | **M25 Ustawienia** | **10/10** |
| M08 Ideas Table | **5/5** | M18 Dokumenty | **12/12** | **M26 Portal** | **10/10** |
| M09 Whiteboard | 4/6 | | | **M27 SuperAdmin** | 9/11 |
| | | | | **A1 Affiliate** | DESCOPED |

**Strefa Harvard 5 (M22-M27 + A1): zrekoncyliowana z kodem.**
- M22/M24/M25/M26 = 100% zamknięte/udokumentowane.
- M23 = 9/9 po flipie L-06 (ODROCZONA→H1: `isPl` = legalny selektor pola DB, nie debt; ~96 hardkodów→H1).
- M27 = 9/11: L-10 (🟦 feedback live-verify, naprawione w kodzie `36ceb52c60`), L-11 (test-masking, P1-test — realna otwarta, wymaga konta superadmin do pełnej weryfikacji).
- A1 = DESCOPED (DP-4, `referrals.routes.ts`+`AffiliateDashboardView` usunięte).

## Otwarte luki cross-zone (M01-M21) — dla właścicieli (Harvard 1-4), NIE flipowane

Weryfikacja: pozostałe otwarte luki to **legalne deferrals, NIE stale-open defekty**:
- **i18n → Harvard 1 (locales zakazane dla Fala 1)**: M01 L-10 (318 inline lang), M13 L-11a (`tr(en,pl)`→`t()`),
  M21 L-06, M17 L-09, M19 L-05 — wszystkie ZABLOKOWANA-i18n, czekają na injekcję `translation.json`.
- **Architektoniczne/blok**: M09 L-04 (whiteboard poza rdzeniem multiplayer), M09 L-06 (CZĘŚCIOWO, 3 suity w CI).
- **Env-pending**: M10 L-01 (STT — `OPENAI_API_KEY` na centerbeam, FE-fix `1522f3de32` gotowy, DP-1 czeka).
- **Pozostałe** (M02 L-11, M12 L-07, M15, M17 L-12, M20): doc/preview-pending lub SPEC_01 epik — śledzone, nie blokery.

**Wniosek:** rejestry §03 są zgodne z kodem; brak ukrytych „committed-but-open" defektów w próbce.
Pozostałe otwarte = świadomie odroczone (i18n→H1, blok architektoniczny, env-pending) — **nie blokują cutover**
poza osobnym blokerem schema-drift (patrz `_CUTOVER_CHECKLIST_FAZA5.md`).

## Bramy cutover (skrót — pełna lista w checkliście)
1. ⛔ **Schema drift** (staging 41 tabel + 59 kol brak) — `npm run migrate` + `db:verify:schema` 0-drift PRZED cutover.
2. Smoke staging: app serwuje (health/root/login = 200 2026-06-17); per-moduł render = 🟦 (auth-gated).
3. Cutover Londyn→prod = checklista, DO AKCEPTACJI Piotra.
