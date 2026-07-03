# SLACK COMMAND CENTER — projekt docelowy (SSOT)

Data: 2026-07-02 · Autor: Claude (CTO) · Bazuje na: żywym audycie kodu 2026-07-02 (3 sondy read-only) + [ALERTING_SYSTEM_COMPLETION_PLAN.md](ALERTING_SYSTEM_COMPLETION_PLAN.md) (2026-06-10, częściowo wykonany) + pamięć [finding_feedback_system_audit].

## 0. North star (Piotr, 2026-07-02)

> **Slack = centrum dowodzenia zewnętrznego aplikacją.** (1) Zbieramy informacje z list pracy **w czasie rzeczywistym**; (2) pomysły/problemy zgłaszane **w Slacku wchodzą do systemu pracy i dalej do kodowania**; (3) awarie/błędy/użytkownicy — raportowane konkretnie, nie szczątkowo.

Zasada projektowa: **nie budujemy drugiego systemu** — Slack staje się zewnętrznym oknem na istniejący, kompletny pipeline `feedback_items → auto-task → triage → workflow → deploy` oraz na istniejącą magistralę `notificationService`. Dobudowujemy tylko: bramkę wejścia (Slack App), router kanałów i domknięcie pętli (wątki).

## 1. Stan AS-IS (audyt 2026-07-02, fakty z kodu)

### Co JEST i działa (fundament do wykorzystania)
| Element | Dowód | Rola w projekcie |
|---|---|---|
| Pipeline bug→admin **kompletny**: widget `FeedbackSidePanel` (BUG/IDEA/PULSE/FEATURE + screenshot + diagnostyka + AI-assist) → `POST /api/feedback` → `feedback_items` → **auto-task** (`tasks`, tag `feedback:{id}`) → eskalacja in-app/Slack/email/WhatsApp → SuperAdmin (kanban, analytics, workflow-editor, respond, historia statusów) | `feedback.routes.ts:992-2376`, `FeedbackSidePanel.tsx` | **RDZEŃ** — inbound Slack wpina się TU, nie obok |
| Magistrala powiadomień z katalogiem typów pracy (TASK_OVERDUE/BLOCKED, INITIATIVE_*, DECISION_REQUIRED, GATE_PENDING_APPROVAL, AI_RISK…) + kanał `slack` per-org (integracje DB) | `notificationService.ts:1283-1560` | **SILNIK progress-feedu** |
| Nadawcy alertów systemowych: health DB (co 1 min), 5xx/latencja (`alertWatchdog`), crash procesu → Slack+WhatsApp, AI provider/cost | `systemAlertNotifier.ts`, `alertWatchdog.middleware.ts:191`, `index.ts:1756-1790` | zostają, tylko routing kanałów |
| `slackService` z 4 osobnymi webhookami (main/registration/feedback/ideas), retry, deep-link `?feedbackId=` | `slackService.ts` | baza outbound (do rozszerzenia o Web API) |
| Digest dzienny feedbacku (nowe 24h / zalegające >48h / krytyczne) — **kod gotowy, flaga OFF** | `feedbackDigest.ts:200` (`FEEDBACK_DIGEST_ENABLED`) | do włączenia + wzbogacenia |

### Czego BRAK / co MARTWE (luki do zbudowania)
| Luka | Dowód | Skutek dla Piotra |
|---|---|---|
| 🔴 **Inbound Slack nie istnieje jako funkcja**: brak slash-commands, brak Slack Actions/modali, brak `SLACK_SIGNING_SECRET`; OAuth (`SLACK_CLIENT_ID/SECRET`) = martwe rusztowanie; jedyny inbound = mirror wiadomości do inboxu (`webhooks/inbox.routes.ts:38-101`) | sondy A+B | nie da się dziś zgłosić pomysłu ze Slacka do systemu |
| 🔴 **Zero powiadomień o postępach pracy w Slacku** — typy istnieją w notificationService, ale org-webhook nieskonfigurowany / typy nie mapowane na Slack | `notificationService.ts:1492+` | brak „list pracy w czasie rzeczywistym" |
| 🔴 „Szczątkowy raport" = **AI Ops snapshot** (`DB: healthy, providers healthy=X…`, co godz. przy zmianie stanu) — jedyny cykliczny raport jaki realnie przychodzi | `AIOpsReportCron.ts:122-165` | wrażenie „raport bez konkretów" |
| 🔴 Martwe ogniwa: `AdminAlertService.sendAlert()`=stub (tylko log), `errorHandler` nie alertuje (tylko log), `superadminAuditMonitor` niepodpięty | `adminAlertService.ts:382`, `errorHandler.ts:67-99` | cicha strata alertów |
| 🟡 Rejestracje → Slack tylko dla APLIX; brak ogólnych sygnałów o użytkownikach | `auth.routes.ts:154` | ślepota na aktywność userów |
| 🟡 Webhooki (Incoming Webhooks) **nie zwracają `ts`** → nie da się budować wątków/aktualizacji; potrzebny bot token + `chat.postMessage` | ograniczenie API Slacka | bez tego nie ma „centrum dowodzenia", tylko strumień jednorazowych krzyków |

## 2. Architektura docelowa — 5 filarów

```
                    ┌────────────────────────────────────────────┐
                    │                SLACK WORKSPACE              │
                    │  #cf-alerts   #cf-feedback   #cf-progress   │
                    │  (awarie)     (zgłoszenia,   (praca real-   │
                    │               wątek=lifecycle) time+digest) │
                    └───────▲──────────────▲───────────▲─────────┘
            Web API (bot)   │              │ wątki     │ batch/digest
                    ┌───────┴──────────────┴───────────┴─────────┐
   F1  ────────────▶│           SLACK ROUTER (1 moduł)            │
                    │  event → kanał → Block Kit → dedup/throttle │
                    └───▲──────────▲──────────▲──────────▲────────┘
                        │          │          │          │
                 systemAlert  feedback   notification  digest
                 Notifier     escalation Service       (rozszerzony)
                 (awarie)     (bugi/idee) (praca: task/init/decision)
                        ▲
   F2  Slack App ───────┘
   /consultify + message-shortcut + modal
        │ POST /api/feedback (source=slack, thread_ts)
        ▼
   feedback_items → AUTO-TASK → backlog superadmina → AGENT KODUJE
        │                                              │
   F3   └── status/workflow change ──► thread reply ◄──┘
            („🔧 in progress → Cloud", „✅ na demo, commit abc123")
```

### FILAR 1 — Slack Router (porządek w outbound)
Jeden moduł `server/src/services/slack/slackRouter.ts`:
- **Wejście:** `route(event: { kind, severity, title, body, blocks?, threadKey? })` — wszyscy istniejący nadawcy (systemAlertNotifier, feedback escalation, digest, AI-ops) przechodzą przez router (adapter, bez łamania wywołań).
- **Mapa zdarzenie→kanał** (konfig w 1 miejscu, env per kanał), dedup sygnaturą + throttle (przenosimy istniejący z `systemAlertNotifier`).
- **Dwa transporty:** Incoming Webhook (jak dziś, kanały „strumieniowe") **oraz Slack Web API z bot tokenem** (`chat.postMessage`) dla kanałów, gdzie potrzebujemy wątków i aktualizacji (#cf-feedback). Bot token = warunek „centrum dowodzenia".
- Log „którego kanału/transportu użyto" (dziś fallbacki niediagnozowalne).

### FILAR 2 — Inbound: Slack App „Consultify" (pomysły → system pracy)
Jedna aplikacja Slack (Events API na publiczny URL Railway; weryfikacja `SLACK_SIGNING_SECRET` — timestamp+HMAC):
- **`/consultify` slash command** → otwiera **modal** (Block Kit): typ (Bug/Pomysł/Feature), tytuł, opis, priorytet, moduł/obszar (select). Submit → **istniejący** `POST /api/feedback` z `source='slack'`, `reporter=piotr` (mapowanie Slack user→user aplikacji).
- **Message shortcut „Zgłoś do Consultify"** (⋯ na dowolnej wiadomości) — najszybsza ścieżka: piszesz normalnie na kanale, jednym klikiem robisz z tego zgłoszenie; treść wiadomości = opis, link do wiadomości w metadata.
- **Potwierdzenie w wątku:** bot odpowiada pod zgłoszeniem: `✅ #FB-123 przyjęte → task T-456 → [SuperAdmin]` i **zapisuje `slack_channel_id`+`thread_ts` do `metadata_json` feedbacku** — to kotwica pętli zwrotnej.
- Skutek: zgłoszenie ze Slacka przechodzi **dokładnie ten sam** pipeline co widget w aplikacji (feedback_items → auto-task → triage) — zero drugiego systemu.

### FILAR 3 — Pętla zwrotna: wątek = lifecycle zgłoszenia (→ „wchodzi do kodowania")
- Hook w `PATCH /feedback/:id/status` + `PATCH /:id/workflow`: jeśli feedback ma `slack_thread_ts` → bot dopisuje w wątku: zmianę statusu, ownera, branch/PR, deploy, resolution. Piotr widzi cały cykl **bez wchodzenia do aplikacji**.
- Backlog feedback-tasków to dokładnie to, co biorą agenci (Cloud) — więc „pomysł ze Slacka → kod" domyka się przez istniejący workflow-editor (owner/branch/PR/deploy), którego zmiany raportują się z powrotem do wątku.

### FILAR 4 — Progress feed: listy pracy w czasie rzeczywistym
- **Silnik = istniejący `notificationService`**: typy TASK_*/INITIATIVE_*/DECISION_*/GATE_* dostają routing na #cf-progress (globalny webhook DBR77, obok per-org).
- **Anty-spam (twarda zasada):** zdarzenia progress **batchowane** (zbiorcza wiadomość co 15–30 min: „3 zadania ukończone, 1 inicjatywa → EXECUTING, 2 decyzje czekają") + wyjątki natychmiastowe (BLOCKED, CRITICAL). Bez tego kanał umrze jak #all-dbr77.
- **Digest dzienny 8:00 PL** (rozszerzenie `feedbackDigest.ts`): wczoraj (zamknięte/nowe/zablokowane + nowi userzy + błędy 5xx z kontekstem) / dziś w toku / zalegające. To zastępuje „szczątkowy" AI-ops snapshot jako główny raport (AI-ops zostaje na #cf-ai-ops).

### FILAR 5 — Naprawa martwych ogniw alertowych (wiarygodność)
- `AdminAlertService.sendAlert()` stub → wpiąć w router (Slack+in-app).
- `errorHandler` 5xx → licznik do routera (watchdog już agreguje — dopiąć konteksty: route, org, user).
- `superadminAuditMonitor` → zamontować.
- Rejestracje: usunąć warunek APLIX-only → każdy signup na #cf-progress (sekcja „użytkownicy").

## 3. Taksonomia kanałów (propozycja — decyzja Piotra)

| Kanał | Co | Transport | Tryb |
|---|---|---|---|
| **#cf-alerts** | awarie: DB down, 5xx spike, crash, schema drift, AI provider down | webhook | natychmiast, throttle 30 min |
| **#cf-feedback** | zgłoszenia (bug/pomysł/feature) z aplikacji **i ze Slacka**; wątek = lifecycle | **bot (Web API)** | natychmiast + aktualizacje w wątku |
| **#cf-progress** | praca: statusy zadań/inicjatyw/decyzji, rejestracje, deploye; digest 8:00 | webhook lub bot | batch 15–30 min + digest |
| **#cf-ai-ops** | AI health/koszty/ops snapshot (istniejące) | webhook | jak dziś |

(Wariant minimalny: 2 kanały — #cf-alerts + #cf-commandcenter dla reszty; kosztem czytelności.)

## 4. Matryca zdarzenie → kanał (docelowa, DoD per wiersz = żywy dowód)

| Zdarzenie | #alerts | #feedback | #progress | wątek | e-mail/WA |
|---|---|---|---|---|---|
| BUG/IDEA (app lub Slack) | — | ✅ nowy wątek | — | ✅ lifecycle | HIGH→mail, CRIT→WA |
| Zmiana statusu/workflow zgłoszenia | — | — | — | ✅ reply | — |
| Task done/blocked, initiative status, decision required | — | — | ✅ batch | — | — |
| Rejestracja / nowy user | — | — | ✅ | — | — |
| Digest dzienny 8:00 | — | — | ✅ | — | — |
| DB down / crash / 5xx spike / AI down | ✅ | — | — | — | ✅ |
| AI ops/cost | #ai-ops | — | — | — | — |

## 5. Fazy realizacji

- **F0 — Piotr (~30 min, jedyne poza kodem):** utworzyć w workspace **Slack App „Consultify"** (bot token `xoxb-`, signing secret, scope: `commands`, `chat:write`, `chat:write.public`) + 3–4 kanały + wkleić tokeny do Railway (demo najpierw). Dostanę od Ciebie: `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, ID kanałów.
- **F1 — Router + porządek outbound (~1 dzień, Cloud):** slackRouter (mapa+dedup+2 transporty) · przepięcie nadawców · naprawa 3 martwych ogniw · rejestracje bez APLIX-only · routing kanałów. DoD: alerty NIE lecą na #all-dbr77; test-event na każdy kanał.
- **F2 — Inbound Slack App (~1–1,5 dnia):** endpoint `/api/slack/events`+`/api/slack/interactions` (signing secret!) · `/consultify` + modal · message shortcut · wpięcie w `POST /api/feedback` (`source=slack`) · reply z linkami + zapis thread_ts. DoD: zgłoszenie z Slacka widoczne w SuperAdmin + task w backlogu + potwierdzenie w wątku.
- **F3 — Pętla + progress feed (~1 dzień):** thread-updates przy status/workflow · notificationService→#cf-progress z batchingiem · digest dzienny rozszerzony (praca+userzy+błędy), `FEEDBACK_DIGEST_ENABLED=true`. DoD: pełny cykl „zgłoszenie ze Slacka → task → zmiana statusu → reply w wątku" na żywo.
- **F4 — Dowód działania (D-J, ~0,5 dnia):** round-trip test E2E na demo + matryca §4 z żywymi dowodami per wiersz + raport w `docs/qa/runs/`.

**Estymata: ~3,5–4 dni kodu (Cloud) + 30 min konfiguracji Piotra.** PROD nietknięty do osobnej zgody (najpierw demo).

## 6. Decyzje Piotra (przed F1) — ZAMKNIĘTE 2026-07-02
1. ~~Kanały: 4 jak w §3, czy mniej? Nazwy?~~ → **decyzja: zostają 4, patrz §7** (Piotr: „nie pytaj jak, wiesz lepiej").
2. ~~Slack App (F0)~~ → zrealizowane (appka „Consultify" istniejąca od marca rozbudowana o slash+shortcut+bot, patrz F0 w journal poniżej).

## 7. Kanały — decyzja finalna (2026-07-02)

**Zostaje przy 4 kanałach z §3** (nie mnożymy — rozproszenie = szum, którego nikt nie czyta; dowód a contrario: legacy `#all-dbr77` na PROD, gdzie wszystko leci w jedno miejsce i ginie w powtórkach). Każdy kanał odpowiada na jedno pytanie:

| Kanał | Pytanie | Powiadomienia (telefon) |
|---|---|---|
| **#cf-alerts** | Czy coś jest zepsute *teraz*? | zawsze on |
| **#cf-feedback** | Co zgłoszono i na jakim jest etapie? | on (nowe + wątki własnych zgłoszeń) |
| **#cf-progress** | Co dzieje się w pracy zespołu? | off / batch (15 min + digest 8:00) |
| **#cf-ai-ops** | Ile to kosztuje, czy AI działa? | off / przegląd dzienny |

**Dodana kategoria: 🚀 Wdrożenie → #cf-progress, natychmiastowa (nie batchowana).** Luka: deploye nie miały żadnego sygnału w Slacku (weryfikacja = ręczne odpytywanie `/api/health`). `announceDeploy()` w `server/src/index.ts` (po `server.listen`) ogłasza `env (branch) — gitSha` + commit message, dedup po `env:gitSha` (restart bez nowego kodu nie spamuje). Fail-soft: brak `gitSha`-env (lokalny dev) = cicho nic.

**Znany, celowo nietknięty problem: PROD (`consultify.ai`) ma STARY, sprzed-programu alerting** (`slackService.ts`, format „SYSTEM ALERT:", webhook → `#all-dbr77`, brak dedupu → duplikaty co ~3 min przy degradacji). To NIE jest część tego systemu (który działa tylko na `demo`) — zgodnie z regułą PROD-nietknięty-bez-zgody. Migracja PROD na `slackRouter` = osobna decyzja + jawna zgoda (wymieni webhook-do-`#all-dbr77` na bot-do-`#cf-alerts` + naprawi brak dedupu przy okazji). Do backlogu, nie pilne (alert sam w sobie jest degradacją schematu DB na prod, warty odrębnego sprawdzenia — nie robię tego bez pytania, bo to ingerencja w prod diagnostykę).

**Stara druga appka Slack** (`DBR77_Consulting_Notifi…`, A0A68HE3JUD) — widoczna w workspace, nieużywana przez ten program, nieznana mi jej funkcja. Nie ruszona.
3. **Progress feed — zakres:** taski+inicjatywy+decyzje+rejestracje (rekomendacja) czy węziej na start?
4. **Batch:** 15 min / 30 min / tylko digest dzienny?
