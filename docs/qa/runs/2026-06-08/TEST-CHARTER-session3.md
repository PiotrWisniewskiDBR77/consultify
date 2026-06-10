# Test Charter — Session 3 (równoległa, w trakcie napraw)

Środowisko: **PROD `consultify.ai`** (tu idzie rollout VTS) + porównawczo staging.
Role: testuj jako **USER** (zwykły) ORAZ jako **ADMIN** tej samej org — różnica między rolami jest kluczowa.
Format zgłoszeń: jak dotąd (BUG-xx, severity, URL, kroki, oczekiwane/rzeczywiste, dowód: screenshot + console + network status, correlationId/czas).
Uwaga: poprawki z `qa/remediation-2026-06-08` **nie są jeszcze wdrożone** — testujesz bieżący prod (to dobre: pogłębiamy baseline i potwierdzamy zakres).

## PRIORYTET 1 — Bezpieczeństwo danych / RBAC (najważniejsze, compliance)
To jest motyw, który może wywrócić rollout VTS. Zrób z tego mini-audyt.
1. **Zakres wycieku PII (BUG-18).** Dla każdego modułu sprawdź, czy zwykły USER widzi dane/nazwiska spoza swojego zakresu: Execution (Management/Action Queue, Reporting), Inicjatywy (przypisani, właściciele), Interview (sesje/insighty innych), Finance, Portfolio, KPI/OKR, Benefits, My Work (czyje zadania/decyzje). Zanotuj endpoint + czy zwraca dane całej org.
2. **Eskalacja uprawnień przez URL.** Jako USER wejdź ręcznie na: `/admin/*`, `/superadmin/*`, `/organization/members`, `/settings/billing`. Czy front blokuje, a backend zwraca 403? (sprawdź network, nie tylko UI).
3. **IDOR.** Podmień ID w URL/zapytaniach: `/api/conversations/:id`, `/api/initiatives/:id`, `/api/v8/interview/sessions/:id` — czy USER dosięga cudzych obiektów (200 zamiast 403/404)?
4. **Demo isolation.** Czy konto demo (`register-demo`) faktycznie ląduje we współdzielonej org `atelier` jako ADMIN i widzi dane innych gości? (z Session 1).

## PRIORYTET 2 — Domknięcie warunkowych bugów (potrzebuję repro)
5. **Voice/chat 403 (BUG-02/15) — kiedy pada, a kiedy nie.** Scenariusze: świeże logowanie → od razu klik „Talk to Teresa" (przed otwarciem czatu); po przełączeniu organizacji; po wylogowaniu/zalogowaniu. Notuj `x-org-context` (nagłówek żądania) i `organizationId` w odpowiedzi/logu przy 403 vs 200.
6. **BUG-13 Settings sub-nav — czy to gating pilotażowy?** Sprawdź na koncie, które NIE jest „pilot participant". Klik Theme/Language/Authentication & Access — czy URL się zmienia (`/settings/theme` itd.) i treść się przerenderowuje? Jeśli na zwykłym koncie działa, a na pilotowym nie → to gating, nie bug.

## PRIORYTET 3 — Moduły nietknięte w Session 1+2
7. Deliverables/Outputs: **Document Studio, Table Studio, Presentations, Reports builder** — twórz, zapisz, eksportuj. Szukaj 4xx/5xx, błędów zapisu.
8. **Meeting**, **KPI/OKR**, **Benefits**, **Finance**, **Portfolio**, **AI OS** (`/ai/*`) — przejście happy-path + zapis.
9. **Assessment** pełne (DRD/SIRI/ADMA/CMMI/Lean) jako USER i ADMIN.
10. **Admin panel** (jako ADMIN org): members, billing, AI settings, integrations — czy realnie zapisują.

## PRIORYTET 4 — Luki pokrycia z planu
11. **Locale EN** pełne przejście demo + workspace (Session 1 był tylko PL) — wyłap kolejne miksy językowe.
12. **Reset hasła** end-to-end (`/forgot-password` → mail → `/reset-password`).
13. **Trial z prawdziwym kodem** dostępu (jeśli wydasz kod QA) — onboarding → limity → konwersja.
14. **Responsywność**: 375px (BUG-17 sidebar), 768px (BUG-16 nav) — oraz formularze i modale na mobile.
15. **Voice end-to-end** (gdy 403 nie pada) — czy rozmowa głosowa faktycznie działa.

## PRIORYTET 5 — Wydajność / stabilność (przy okazji)
16. Notuj endpointy wolne (>1.5s) i z wysokim `dbQueryCount` (szczególnie `title/generate`, `/api/v8/admin/flags`).
17. Czy pod normalną nawigacją (bez sztucznego spamu) pojawia się kaskada 429 (BUG-14)?

## Czego NIE testować destrukcyjnie na prodzie
- Nie usuwaj danych VTS, nie wysyłaj realnych zaproszeń/maili, nie zmieniaj ustawień org VTS, nie rób masowych zapisów. Twórz własne, oznaczone (ZZQA-) artefakty i sprzątaj.
