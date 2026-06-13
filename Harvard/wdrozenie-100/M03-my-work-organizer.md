# WP M03 — Moja Praca (organizer) · dokończenie do 100%

**Pula:** core · **Karta:** `Harvard/modules/M03-my-work-organizer/KARTA_AUDYTU.md` (ocena 54/100) · **Rozmiar:** M (1–3 dni) · **Żywy bloker:** brak otwartych P0 (1×P1 leak)
**Faza programu:** FAZA 2/3 (core, klient-adjacentny) → FAZA 4 (sweepy) · **Master:** `Harvard/wdrozenie-100/MASTER.md`

## 1. Stan obecny (jednym akapitem)
Najbardziej rozbudowany moduł aplikacji: Inbox (triage v8 z uczciwym fallbackiem do legacy), Kalendarz (unified feed + drag-reschedule etag), Zadania (tabela+Kanban+detal ~6.5k linii), Decyzje (approve/reject/escalate), Manager/Executive — wszystko zasadniczo realne i wpięte FE↔BE↔DB z migracjami. **Naprawione w audycie:** cross-org IDOR write decyzji `DecisionController.decide` (`b9f2dee9d2` — `WHERE id=? AND organization_id=?`); cross-org IDOR inbox delegate/snooze/SLA (`45d74b0de1` — 2-step org-verify); linkowanie decyzji z zadania mock→real fetch `Api.getDecisions()` (`f35aa8d7c8`, `TaskDetailView.tsx:1143-1149`); executive-analytics server role-guard (`d05382fb44`); 15 martwych komponentów usuniętych (`d05382fb44`); +1 W15 CI gate + kontraktowe testy cross-org (`7ab1b8aace`). Brak otwartych P0.

## 2. Luki do DoD

### (a) FRONTEND / UX (FAZA 2/3)
- **[P1] session-context odczyt = martwy stub.** `MyWorkHub.tsx:946-951` — GET wykonany, ciało `if(...){}` to sam komentarz, wynik wyrzucany → „ciągłość sesji L7" po stronie odczytu nie istnieje. Fix: wpiąć wynik do promptu/zachowania ALBO usunąć martwy GET.
- **[P1] mylący komentarz beta.** `MyWorkHub.tsx:604-605` „Admins keep access" sprzeczny z runtime (`betaAccess.ts:71` zwraca `true` dla wszystkich, `BETA_ADMINS_EXEMPT=false:32`) → Ideas zablokowane też adminom. Fix: poprawić komentarz zgodnie z runtime.
- **[P1] task-advisor stub.** `task-advisor.routes.ts:12-20` (mount `Gateway.ts:483`) — każdy request 503, zero konsumenta FE. Fix: wpiąć konsumenta FE ALBO usunąć stub-mount.
- **[P2] martwy kod do wycięcia** — łańcuch WorkCenter (+MyProjects/PillNavigation/QuickFilterBar/WorkSidebar/DecisionsPanel/DecisionsList/DecisionBottleneckPanel), WorkloadView, TodayDashboard, ProgressView, FocusCockpit, NotificationsHub/Content/Kanban, TaskInbox, ConvertToMenu, KnowledgePulse, InsertMenu, Focus/*. **UWAGA: NIE wycinać `NudgeStrip` (żywy w Ideas).** Zostaw świadomie ukryte: HomeView/Radar (`RADAR_ENABLED=false:189`), FocusView, DecisionsTimelineView.

### (b) BACKEND / API (FAZA 2)
- **[P1] leak executive-analytics.** `GET /my-work/executive-analytics` (`my-work.routes.ts:7832`) zwraca portfel całej org (overload alerts z imionami+godzinami per-pracownik) KAŻDEMU członkowi; manager-gate tylko UI. **UWAGA:** karta §6 i Fala 2/A notuje server role-guard NAPRAWIONE (`d05382fb44`) — zweryfikować czy `requireRole(admin/manager)` faktycznie wpięte; jeśli nie — domknąć (member → 403).
- **[P2] Decyzje Archive/Delay** disabled „Wkrótce backend" (§14 lifecycle) — dokończyć backend lifecycle lub ukryć.

### (c) INTEGRACJA / TESTY E2E (FAZA 2 + 4)
- **[P0 testowy] `CalendarCreateEventModal` 3/4 FAIL** (S5 — onSubmit/conflict callbacks nie wołane). Fix + drag-reschedule etag/412.
- **[P1] brak funkcjonalnego E2E w PR-gate.** Joby unit/component/integration/e2e „Deferred outside main/develop" → na PR-ach `feat/*` nie biegną wcale; E2E M03 (task-management-flow, decision-management, calendar-management) tylko weekly, smoke nightly. Promować ≥1 funkcjonalny E2E do PR-gate + dodać `Londyn`.
- **[P1] brak testów:** S1 trwałość-po-reload inbox, S2 inline-edit + Kanban DnD persist, S3 linkowanie decyzji (po naprawie mocka), S6 manager inline-approve + race.
- **[P2]** mock i18n w unit (`{defaultValue}` jako React child) — `DecisionsList`+`MyTasksList`.

### (d) Przekrojowe / §27 (FAZA 4)
- **[P1] RC-4 sticky thead** złamany na 3 tabelach: wrapper `rounded-xl overflow-hidden` nad sticky `<thead>` (`MyTasksListContent.tsx:2173`, `DecisionsPanelContent.tsx:1873`, `InboxContent.tsx:3316`).
- **[P1] brak persistencji szerokości kolumn** (Zadania+Decyzje) — `handleColumnResize` trzyma w stanie React (`MyTasksListContent.tsx:1467`), giną po reloadzie.
- i18n: brak korupcji „rose" (legalny Tailwind).

## 3. Kroki realizacji
1. **(FAZA 2)** Zweryfikować/domknąć role-guard serwerowy Managera na `/executive-analytics` + akcjach managerskich (member → 403). Test cross-role.
2. **(FAZA 2)** Domknąć session-context (L7) odczyt — wpiąć do zachowania ALBO usunąć martwy GET (`MyWorkHub.tsx:946-951`).
3. **(FAZA 2)** Fix `CalendarCreateEventModal` (S5) + drag-reschedule etag/412.
4. **(FAZA 2)** task-advisor — wpiąć konsumenta FE ALBO usunąć stub-mount (`Gateway.ts:483`).
5. **(FAZA 3)** Wytnij ~15 martwych komponentów (łańcuch WorkCenter + sieroty; NIE `NudgeStrip`); popraw komentarz beta `:604`; Decyzje Archive/Delay (§14) dokończyć lub ukryć.
6. **(FAZA 4)** RC-4 sticky thead na 3 tabelach + persistencja szerokości kolumn; promocja ≥1 E2E do PR-gate + `Londyn`; testy S1/S2/S3/S6; fix mock i18n.

## 4. DoD (6 kryteriów — bramka 6/6)
1. **Front↔back:** session-context wpięte lub usunięte; task-advisor wpięte lub usunięte; CalendarCreateEventModal działa; zero martwych CTA; Decyzje lifecycle aktywne lub ukryte.
2. **Bezpieczeństwo:** cross-org decyzje+inbox zamknięte (naprawione `b9f2dee9d2`/`45d74b0de1`); leak executive-analytics zamknięty role-guardem serwerowym (member → 403, test).
3. **i18n:** `t()` pełne (fix mock `{defaultValue}`).
4. **Tokeny:** Visual Standard (korupcja „rose" nie występuje).
5. **§27:** RC-4 sticky thead naprawione na 3 tabelach; szerokości kolumn trwałe; Zadania/Decyzje/Inbox przez FilterableTable z Menu 1/2/3.
6. **E2E w PR-gate:** ≥1 funkcjonalny flow (task/decision/calendar) zielony na `Londyn`.

## 5. Weryfikacja
- Leak: member wywołuje `/my-work/executive-analytics` → 403 (test cross-role).
- Cross-org: admin org-A nie zatwierdzi decyzji org-B → 404/403; cross-org snooze/delegate inbox → odmowa (testy; naprawione).
- S1: inbox quick action (Focus Dziś/Done/Snooze) → reload → stan trwały (żywe przejście, FAZA 4).
- S5: create event → trwały po reloadzie; drag-reschedule etag.
- §27: thead sticky przy scrollu; szerokości kolumn trwałe po reloadzie (screenshot).
- **Uwaga DB:** dev `.env` → Railway zdalna; tylko dane jednorazowe. Rola member vs admin (osobno dla S6).

## 6. Zależności
- Kalendarz feed ← M13/M14/M10 (task/initiative/decision) + google/outlook; ConvertTo* ← M04/M05-09; karty propozycji ← M01 Czat (`/chat/confirm`).
- RC-4 + persistKey — wspólny wzorzec §27 z M13/M14/M10 (sweep FAZA 4).
- CI „Deferred outside main/develop" + trigger `Londyn` — systemowe wspólne z M01/M10/M13/M14/M25.
