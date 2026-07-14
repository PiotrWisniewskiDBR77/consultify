# SPEC — Model ról Program Managera (#25/#28/#30/#35)

> Sesja projektowa 2026-07-14. Metoda: `consultify-fable-sesja` (Zasada #1: audyt przed projektem).
> **Wynik audytu zmienił zakres sesji.** Model ról NIE wymaga projektowania od zera — istnieje,
> jest dojrzały i dobrze odwzorowuje standardowe governance PM (Sponsor/Steering/PMO/Delivery).
> Realny problem to **pokrycie egzekwowania** (backend) i **całkowity brak świadomości ról na
> froncie**. To zmienia charakter tej sesji z "projektuj model" na "domknij wdrożenie modelu".

## 1. AUDYT — co istnieje (potwierdzone na `origin/demo`, nie na dokumentacji)

### 1.1 Katalog ról — kompletny, 11 ról
`server/src/services/effectiveAccessService.ts` (`FACTORY_ROLE_TEMPLATES`, 15 wpisów wliczając typy):

| Rola | Warstwa | Przykładowe capability |
|---|---|---|
| PROJECT_SPONSOR | Governance | `initiative.approve`, `gate.approve`, `decision.approve`, `project.financials.view` |
| STEERING_COMMITTEE | Governance | (analogiczna do Sponsora, poziom komitetu) |
| PROJECT_LEADER | Delivery-lead | `task.assign`, `initiative.start`, `initiative.block`, `project.team.manage` |
| PMO | Governance/standardy | `gate.approve`, `risk.manage`, `stakeholder.registry.manage` |
| INITIATIVE_OWNER | Delivery-scoped | `initiative.update.own`, `initiative.block.scoped` |
| WORKSTREAM_OWNER | Delivery-scoped | `project.workstream.update.scoped` |
| TASK_ASSIGNEE | Execution | `task.update.assigned`, `task.status.update.assigned` |
| REVIEWER / SME / CONSULTANT / BUSINESS_OWNER | Wsparcie | głównie `*.view*` |
| OBSERVER | Read-only | `project.view`, `benefits.view` |

**Mapowanie na standard branżowy (PRINCE2/PMI):** Sponsor+Steering=Governance Board, PMO=Programme
Office, Project Leader=Project Manager, Initiative/Workstream Owner=Work Package Owner, Task Assignee=
Team Member, Observer/Reviewer/SME=stakeholder wspierający. **Model jest zgodny ze standardem, nie
wymaga zmiany struktury.**

### 1.2 Silnik egzekwowania — zbudowany, dwutrybowy
`server/src/middleware/effectiveCapability.middleware.ts` + `effectiveAccessService.ts`:
- Tryb **shadow** (domyślny, `CAPABILITY_ENFORCE` nieustawiona) — loguje `{userId, capability, route,
  wouldAllow}`, NIGDY nie blokuje. Telemetria do podjęcia decyzji na danych, nie na zgadywaniu.
- Tryb **enforce** (`CAPABILITY_ENFORCE=enforce`) — te same bramki zwracają realne 401/400/403.
- Osobny, starszy `EFFECTIVE_ACCESS_ENFORCE`/`EFFECTIVE_ACCESS_SHADOW` — legacy, nietknięty.

**To jest dobrze zaprojektowany, produkcyjny mechanizm rollout — nie trzeba go przebudowywać.**

## 2. DELTA — realne luki (to jest sedno tej sesji)

### 2.1 ⛔ NAJWAŻNIEJSZE: `pmo/initiatives.routes.ts` — 0/89 endpointów chronionych
Plik **importuje** `requireInitiativeCapability` (linia 18) ale **nigdy go nie wywołuje** — martwy
import. To dotyczy DOKŁADNIE capabilities o które pytał Piotr: `initiative.start`, `initiative.block`,
`initiative.complete`, `initiative.approve`. Dziś **każdy zalogowany użytkownik może wykonać każdą z
tych akcji na każdej inicjatywie**, niezależnie od roli — capability-model istnieje w katalogu, ale
nie jest podłączony w jedynym miejscu gdzie ma znaczenie.

### 2.2 Pokrycie ogólne: 6 z 457 plików tras używa modelu capability
`decisions.routes.ts`, `initiatives.routes.ts`* (patrz 2.1 — import bez użycia, więc realnie 5),
`stage-gates.routes.ts`, `stakeholders.routes.ts`, `tasks.routes.ts`, `resultsStrategic.routes.ts`.
Reszta (projects.routes.ts, my-work/*, riskRegister, changeRequests — sprawdzone bezpośrednio) —
**zero wywołań capability middleware**, mimo mutujących endpointów.

### 2.3 W samym `tasks.routes.ts` (najlepiej pokrytym pliku) — 2 luki
`POST /:id/reassign` i `POST /:id/unassign` — **brak `requireTaskCapability`**, mimo że `/assign`
(ten sam typ operacji) JEST chroniony (`task.assign`, shadow). Brakująca capability: `task.reassign`
nie istnieje w katalogu wcale — trzeba ją dodać (dziś reassign = create+delete assignment pod spodem,
bez własnej semantyki uprawnień).

### 2.4 ⛔ Front-end: ZERO świadomości ról (0 wystąpień w całym `src/`)
Grep `useEffectiveAccess`/`useCapability`/`hasCapability` w `src/**/*.tsx` → **0 wyników**. Żaden
przycisk w aplikacji nie chowa się/nie wyłącza w zależności od roli użytkownika. Konsekwencja praktyczna:
jeśli dziś ktoś flipnie `CAPABILITY_ENFORCE=enforce` bez tej pracy, użytkownicy zobaczą te same
przyciski co zawsze, klikną, i dostaną nagły, niewyjaśniony błąd 403 — najgorsza możliwa ścieżka UX.
**To jest twardy blocker dla enforce, niezależnie od pokrycia backendu.**

## 3. REKOMENDACJA — kolejność domknięcia (nie projekt, tylko wdrożenie istniejącego modelu)

**Faza A (S, bezpieczna, zrób najpierw):** podłącz `requireInitiativeCapability` do wszystkich 89
endpointów w `initiatives.routes.ts` w trybie `shadow: true` — zero ryzyka (shadow nie blokuje),
zaczyna zbierać telemetrię `wouldAllow` na najważniejszym pliku. Dodaj `task.reassign`/`task.unassign`
do katalogu i podłącz do 2 brakujących endpointów tasks.routes.ts, też shadow.

**Faza B (M):** rozszerz pokrycie na `projects.routes.ts` + `my-work/*.ts` (decisions/focus/notebook —
mutujące, dziś zupełnie nagie) — shadow wszędzie.

**Faza C (M, blocker dla enforce):** frontend hook `useEffectiveAccess()` (fetch raz per projekt,
cache w kontekście) + wariant `<CapabilityGate capability="initiative.start">` opakowujący przyciski
akcji w kluczowych ekranach (Initiative detail modal, Task board, Decision hub) — na razie renderuje
zawsze `true` dopóki nie ma danych z shadow-telemetrii pokazujących że nikt nie traci realnego dostępu.

**Faza D (decyzja Piotra, nie robota):** po 1-2 tygodniach shadow-telemetrii z Fazy A+B (log `wouldAllow:
false` per rola) — przegląd: czy któraś rola dostałaby fałszywie 403 na realnie używanej akcji. Jeśli
czysto → flip `CAPABILITY_ENFORCE=enforce`. Jeśli brudno → dopraw mapowanie ról→capability, powtórz.

**Rozmiar całości:** Faza A = pół dnia (mechaniczne podłączenie istniejącej funkcji, wzorzec już jest
w `tasks.routes.ts`). Faza B = pół dnia-dzień. Faza C = 1-2 dni (nowy hook + pierwsze 3-5 ekranów).
Faza D = kalendarzowa (czekanie na dane), nie robocza.

## 4. Co NIE wymaga pracy (błędna wcześniejsza ocena w rejestrze)
Rejestr `_ROZLICZENIE_1-88` sugerował "sesja projektowa nigdy się nie odbyła" — nieprecyzyjne:
**model DANYCH i katalog capability są kompletne i dobrej jakości**, zgodne ze standardem branżowym.
Błędem było founding-level projektowanie od zera — właściwa praca to Fazy A-D wyżej: podłączenie
istniejącego mechanizmu, nie wymyślanie nowego.
