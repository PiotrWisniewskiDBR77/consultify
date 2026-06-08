# Triage scalony — Session 2 (PRODUKCJA `consultify.ai`) — 2026-06-08

⚠️ **Testowano na PRODUKCJI**, jako USER `3dd1179b…` w org `vts` (VTS GROUP S.A.). Te bugi dotyczą środowiska, na które idzie rollout VTS wave 2 (~131 osób). To zmienia priorytety: część rzeczy to **blokery przed-rolloutowe**, nie kosmetyka staging.
Łączy: raport testera (Session 2, BUG-13..23) + [session2-backend-report.md](session2-backend-report.md) (kod + logi prod).

## Macierz korelacji (objaw FE ↔ przyczyna BE, zweryfikowane)
| ID | Tytuł | Sev | Werdykt po analizie BE | Dowód |
|----|-------|-----|------------------------|-------|
| 18 | USER widzi cudze zadania + nazwiska (PII) | **P1** | **Realny wyciek** — endpoint skopuje tylko po org, bez roli | kod `execution-control.routes.ts:1418`, `managerProblemsService.ts:83` |
| 14 | Kaskada 429 łamie apkę | **P1** | **Frontend self-DoS** — breaker 2 błędy/8s → 5 min blokady; serwer OK | `api.ts:86-88`; brak 429 w logach serwera |
| 02/15 | Chat 403 / Voice „no access" | **P1** | **Warunkowy** membership/kontekst org; czat tekstowy w logach DZIAŁAŁ | `auth.middleware.ts:1383-1407`; log 19:38 conv 200 |
| 13 | Settings sub-nav martwe (Theme/Język/Security) | **P1** | Frontend — brak routingu sekcji | `SettingsSidebar.tsx:569` |
| 22 | Wyjątek „commandDock" na My Work | P2 | Frontend — brak default block (serwer emituje commandDock) | `useHomeData.ts:485,871` vs `home.routes.ts:1352` |
| 05 | Interview 4 zakładki 403 | P2 | RBAC by-design (USER≠manager); problem UX | log: 403 na v8+legacy interview |
| 16/17 | Mobile: miks PL/EN + sidebar bez collapse@375px | P2 | Frontend responsywność/i18n | raport testera |
| 18b | Execution: „brak inicjatyw" vs 24 krytyczne | P2 | Sprzeczny stan (powiązane z 18) | raport testera |
| 19 | Ghost skeleton w grafie zależności | P2 | Frontend glitch | raport testera |
| 20 | `/api/integrations` 404 | P3 | Stub wyłączony w prod (sub-ścieżki działają) | `Gateway.ts:333,543` |
| 21 | `/api/analytics/web-vitals` 404 | P3 | Brak route — telemetria gubiona | log prod 404 ×2 |
| 23 | TipTap duplikat extension | P3 | Frontend warning | raport testera |
| BE-S2-1 | `title/generate` 164 zapytania/2.1s | P2 | Backend N+1 na prodzie | log perf 19:38 |

## Najpilniejsze przed rolloutem VTS (kolejność)
1. **BUG-18 — wyciek PII (P1).** Na prodzie VTS każdy USER widzi zaległe zadania całej org z imionami i nazwiskami pracowników (Karol Góral, Mateusz Kozłowicz, …). Dodać skopowanie po roli/uprawnieniach do `execution-control manager lanes` przed wpuszczeniem 131 userów.
2. **BUG-02/15 — chat/voice 403 (P1).** Czat tekstowy działa, ale voice i część sesji dostają „You no longer have access" przez niespójne rozwiązanie kontekstu org / status membership. Dla świeżo zaproszonej kohorty VTS ryzyko, że część userów nie utworzy rozmowy. Ujednolicić org-context w ConjugationStore/TeresaVoice; naprawić mylący komunikat.
3. **BUG-14 — self-DoS breaker (P1).** Próg 2 błędy/8 s → 5 min blokady całej apki to za mało dla realnego usera z kilkoma tabami. Poluzować próg/okno i wykluczyć health/krytyczne odczyty.
4. **BUG-13 — Settings sub-nav (P1).** User nie dojdzie do Języka/Theme/Security (frontend routing).
5. **BUG-22 (P2)** wyjątek na My Work, **BE-S2-1 (P2)** N+1 164 zapytań (skala 131 userów), **BUG-05 (P2)** UX 403 zamiast „brak uprawnień".

## Co działa / zostało potwierdzone jako poprawne
- Czat tekstowy end-to-end na prodzie (conv create + messages + title 200, org `vts`).
- Health/Redis/DB connected; voice-config endpoint odpowiada.
- RBAC faktycznie egzekwowane (interview managed → 403 dla USER).
- Notebook: zapis + auto-save (PUT 200) — z raportu testera.

## Rekomendacja gotowości (PROD / rollout VTS)
- **NO-GO do rolloutu VTS** bez naprawy: **BUG-18 (PII)**, **BUG-02/15 (chat/voice 403)**, **BUG-14 (self-DoS)**, **BUG-13 (settings)**.
- BUG-18 traktować jako **incydent prywatności** — ekspozycja danych osobowych pracowników na produkcji osobom bez uprawnień.
- Pozostałe P2/P3 (responsywność, i18n, 404 telemetrii, N+1) — naprawić w kolejnej iteracji, nie blokują, ale N+1 monitorować pod obciążeniem 131 userów.

## ⚠️ PROD ma własny drift schematu DB w pipelinie AI (BE-S2-2) — P1
Logi prod (org `vts`) = 26 błędów DB, m.in.: `ai_policies.internet_enabled` brak, `ai_user_style_profiles` brak, `llm_providers` typ `integer=boolean` → **ModelRouter pada i leci na hardcoded fallback**, `ai_usage_logs.error_message` brak → **INSERT zużycia AI się wywala (brak token-accountingu)**. Czat odpowiada, ale routing modeli zdegradowany i koszty/limity nieewidencjonowane. Na 131 userów VTS to **dorzucam do listy blokerów rolloutu** (między BUG-14 a BUG-13).

## Różnica vs Session 1 (staging)
- Session 1 (staging): `/api/v8/*` feature routery → **404** (stary build). Session 2 (prod): te same routery **działają** → **prod ma nowszy build serwera niż staging**.
- ALE drift schematu DB występuje na **OBU** środowiskach, z **innym zestawem braków**: staging (`users.user_status`, `initiative_kpis.is_on_target`, `sso_configurations`), prod (`ai_policies.internet_enabled`, `ai_user_style_profiles`, `ai_usage_logs.error_message`, typy w `llm_providers`). Migracje schematu trzeba zweryfikować/zastosować osobno na prodzie i staging.
