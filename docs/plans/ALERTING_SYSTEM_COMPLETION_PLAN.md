# Plan dokończenia systemu komunikacji i alertów

Data: 2026-06-10 · Bazuje na: żywym audycie ([feedback-system-audit.md](../qa/runs/2026-06-10/feedback-system-audit.md)) + pełnej mapie infrastruktury alertowej w kodzie.

## Cel (north star)

1. **Każde zgłoszenie błędu → Slack** na dedykowany kanał (dziś: działa, ale wszystko leci na ogólnofirmowy #all-dbr77).
2. **Superadmini → powiadomienia in-app** (dziś: martwe — bug `is_active`).
3. **Krytyczne zatrzymania → alert „totalnie wszędzie"**: Slack + e-mail + WhatsApp + in-app + **monitoring zewnętrzny** (gdy serwer leży, żaden wewnętrzny alert nie wyjdzie — to ostatnia, dziś nieistniejąca linia obrony).

## Stan obecny (zweryfikowany żywo 2026-06-10)

| Element | Stan | Dowód/przyczyna |
|---|---|---|
| BUG/IDEA → `feedback_items` → SuperAdmin | ✅ | test prod `cc7308b0…`, staging `f551b4f1…` |
| BUG → Slack | ✅ | dotarł na #all-dbr77 w ~0,2 s |
| Pulse (1–5) | ❌ 500 | brak tabeli `feedback_pulse` (prod+staging) |
| Feature request | ❌ 500 | brak tabeli `feature_requests` (prod+staging) |
| In-app do superadminów | ❌ | `is_active = 1` vs kolumna TEXT → query pada → 0 odbiorców |
| E-mail/WhatsApp (HIGH/CRITICAL) | ⚙️ skonfigurowane, nigdy nie przetestowane | `ALERT_EMAIL_RECIPIENTS`, Twilio na prodzie |
| System alerty (DB health, LLM, schema drift) | ✅ działa → #all-dbr77 | `systemAlertNotifier` + crony w `index.ts` |
| Watchdog 5xx/latencja | ⚠️ tylko e-mail | `alertWatchdog.middleware.ts` |
| Fatal crash (uncaughtException) | ❌ brak alertu | `index.ts:1714` — log + exit, tylko Sentry |
| Padnięcie całego serwera | ❌ nic | brak zewnętrznego uptime monitora |
| Dzienny digest feedbacku | ⚙️ gotowy, wyłączony | `FEEDBACK_DIGEST_ENABLED` domyślnie false |

---

## FAZA A — Naprawy P0: odblokowanie istniejących przepływów (~0,5 dnia)

### A1. Tabele `feedback_pulse` + `feature_requests` (prod + staging)
- Zastosować odpowiednie `CREATE TABLE` z `server/migrations/200_enterprise_feedback_system.sql` na obu bazach (prod: proxy `centerbeam.proxy.rlwy.net:37823`, staging: `caboose…`/lokalny `.env`).
- Dodać **inline ensure-schema** w `feedback.routes.ts` dla obu tabel — wzorzec identyczny jak dla `feedback_items` (linie ~88–160). Odporność na dryf przy następnych środowiskach.
- Test: `POST /api/feedback/pulse` (rating 2 → eskalacja Slack) i `POST /api/feedback/feature` na prod i staging → 200 + wiersz w DB + wpis `alertDispatch`.

### A2. Fix odbiorców-superadminów (`feedback.routes.ts:417–423`)
- Przyczyna: `users.is_active` w prodzie to **TEXT**; adapter (`PostgresDatabase.ts:139` `BOOLEAN_IS_ACTIVE_TABLES`) normalizuje `is_active = 1` tylko dla `initiative_section_types` i `llm_providers` — `users` poza whitelistą → `operator does not exist: text = integer`.
- Zmiana predykatu na typ-bezpieczny: `(is_active IS NULL OR lower(is_active::text) NOT IN ('0','false'))`.
- Test: BUG na prod → `alertDispatch.results.in_app.status='sent'`, `recipientCount ≥ 1`.

### A3. Weryfikacja dzwonka in-app
- Po A2: sprawdzić, że powiadomienie ląduje w tabeli `notifications` i jest widoczne w UI superadmina (dzwonek), z działającym deep-linkiem `/superadmin/customers/feedback?feedbackId=…` (ten link już jest poprawny — `feedback.routes.ts:557`).

## FAZA B — Krytyczne zatrzymania „wszędzie" (~1 dzień)

### B1. Alert przy fatalnym crashu procesu
- `index.ts:1714–1743`: `uncaughtException`/`unhandledRejection` dziś tylko logują i robią `process.exit(1)` na prodzie.
- Dodać best-effort CRITICAL przez `systemAlertNotifier` (Slack + WhatsApp) + `AlertEmailService`, z twardym timeoutem 2–3 s przed `exit` (żeby nie wisieć na padniętym procesie).

### B2. HealthCheckJob (DB down) — pełne kanały
- `cron/HealthCheckJob.ts:45`: usunąć **hardcode** `piotr.wisniewski@dbr77.com` → czytać `ALERT_EMAIL_RECIPIENTS`.
- Przy CRITICAL (DB niedostępna) dodać Slack + WhatsApp (przez `systemAlertNotifier`, z istniejącym throttlingiem).

### B3. Watchdog 5xx/latencja → też Slack
- `alertWatchdog.middleware.ts` (próg: 10×5xx / 5 min, p95 > 2 s) wysyła dziś tylko e-mail → dopiąć `systemAlertNotifier` (Slack), throttle 30 min już jest.

### B4. Zewnętrzny uptime monitor — JEDYNY element spoza kodu, krytyczny
- Gdy kontener/Railway leży, nic wewnętrznego nie zaalarmuje. Rekomendacja: **Better Stack** (darmowy plan, aplikacja mobilna z push/SMS, status page) lub UptimeRobot.
- Monitory: `https://consultify.ai/api/health` co 1 min; `https://demo.consultify.ai/api/health` co 5 min.
- Kanały: Slack `#consultify-alerts` + e-mail + **push/SMS na telefon** — to domyka „totalnie wszędzie".

### B5. Sentry (potwierdzenie)
- Zweryfikować, że `initSentry` ma DSN na prodzie i że alerty Sentry → Slack (integracja po stronie Sentry). Fatalne błędy mają wtedy 2 niezależne drogi.

## FAZA C — Routing kanałów Slack: porządek w komunikacji (~0,5 dnia)

### C1. Dedykowane kanały zamiast #all-dbr77 (decyzja właściciela)
Propozycja: `#consultify-alerts` (system/krytyczne), `#consultify-feedback` (zgłoszenia, pulse, feature, rejestracje), `#consultify-ai-ops` (godzinny snapshot, AI health, koszty — dziś spamują #all-dbr77 nocą co 30–60 min).

Mapowanie env (Railway, prod + staging):

| Zmienna | Kanał | Uwagi |
|---|---|---|
| `SLACK_WEBHOOK_URL` | #consultify-alerts | używana przez systemAlertNotifier, digest, fallback wszystkiego |
| `SLACK_FEEDBACK_WEBHOOK_URL` | #consultify-feedback | **NOWA** — drobna zmiana w `slackService.sendNewFeedbackAlert` (osobny URL + fallback do `SLACK_WEBHOOK_URL`) |
| `SLACK_REGISTRATION_WEBHOOK_URL` | #consultify-feedback | już obsłużona w kodzie |
| `AI_OPS_SLACK_WEBHOOK_URL`, `AI_COST_SLACK_WEBHOOK_URL`, `AI_SLACK_WEBHOOK_URL` | #consultify-ai-ops | zmienne już istnieją na Railway — wystarczy podmienić URL-e |

### C2. Deep-link do konkretnego zgłoszenia
- `slackService.ts` (sendNewFeedbackAlert): link „View in SuperAdmin" bez `?feedbackId=` → dodać `?feedbackId=${feedbackId}` (parametr już dociera do funkcji).

### C3. Niezawodność webhooka
- 1× retry z backoffem przy błędzie axios + log **którego** webhooka użyto (łańcuchy fallbacków są dziś niediagnozowalne).

### C4. Higiena konfiguracji
- Staging `FRONTEND_URL`: `https://stage.consultinity.ai` → `https://demo.consultify.ai` (dziś ratuje redirect).

## FAZA D — Wzmocnienia (~0,5 dnia)

- **D1. Dzienny digest**: `FEEDBACK_DIGEST_ENABLED=true` na prodzie (8:00 PL; sekcje: nowe 24 h, zalegające w NEW > 48 h, otwarte krytyczne prod — kod gotowy w `feedbackDigest.ts`).
- **D2. Żywy test e-mail + WhatsApp**: kontrolowane zgłoszenie CRITICAL na stagingu → potwierdzić mail na `piotr.wisniewski@dbr77.com` i WhatsApp +48 668 009 544 (nigdy nie odpalone na żywo).
- **D3. (Opcja) Tabela `system_alerts`**: trwały log wysłanych alertów (dziś tylko `metadata_json` przy feedbacku, system alerty są ulotne) + prosty widok w superadminie.
- **D4. Backlog systemowy `is_active = 1`**: ~20 dalszych miejsc (orgContext, SuperAdminController, LLMController, TaskController…) na różnych tabelach — audyt typów kolumn per tabela i rozszerzenie normalizacji w adapterze. Osobne zadanie, nie blokuje alertowania.

## FAZA E — Testy końcowe i Definition of Done

Docelowa matryca zdarzenie → kanały (każdy wiersz potwierdzony żywym dowodem):

| Zdarzenie | Slack | In-app | E-mail | WhatsApp | Zewn. monitor |
|---|---|---|---|---|---|
| BUG LOW/MEDIUM | ✅ #feedback | ✅ | — | — | — |
| BUG HIGH | ✅ | ✅ | ✅ | — | — |
| BUG CRITICAL | ✅ | ✅ | ✅ | ✅ | — |
| Pulse ≤ 2 / komentarz blokujący | ✅ | ✅ | ✅ | (✅) | — |
| Feature request | ✅ | ✅ | — | — | — |
| Rejestracja użytkownika | ✅ | — | — | — | — |
| DB down / LLM fail / schema drift | ✅ #alerts | — | ✅ | ✅ (B2) | — |
| Fatal crash procesu | ✅ (B1) | — | ✅ | ✅ | ✅ |
| Serwer w ogóle nie odpowiada | ✅ (Better Stack) | — | ✅ | push/SMS | ✅ |

**DoD (10 punktów):**
1. Pulse i feature zwracają 200 na prod+staging, wiersze w DB.
2. `alertDispatch.in_app.status='sent'` z `recipientCount ≥ 1` na prodzie.
3. Dzwonek superadmina pokazuje powiadomienie z działającym deep-linkiem.
4. Wiadomość Slack o BUG ląduje na #consultify-feedback z linkiem do **konkretnego** zgłoszenia.
5. Alerty systemowe i AI-ops NIE pojawiają się już na #all-dbr77.
6. Kontrolowany CRITICAL: mail + WhatsApp dotarły (screenshot/zrzut).
7. Kill serwera na stagingu → Better Stack alarmuje na Slack + telefon < 2 min.
8. `HealthCheckJob` bez hardcodowanego maila; watchdog 5xx wysyła Slack.
9. Digest dzienny przyszedł następnego ranka.
10. Raport końcowy w `docs/qa/runs/` z dowodami per kanał.

## Kolejność krytyczna i estymata

```
A1 → A2 → A3        (odblokowuje pulse/feature + in-app)        ~0,5 dnia
B4                  (jedyna ochrona na totalny dół — od razu)    ~0,5 h konfiguracji
B1 → B2 → B3 → B5   (krytyczne zatrzymania)                      ~1 dzień
C1 → C2 → C3 → C4   (routing Slack)                              ~0,5 dnia
D1 → D2 (→ D3)      (wzmocnienia)                                ~0,5 dnia
E                   (testy + dowody + raport)                    ~0,5 dnia
                                                    RAZEM: ~2,5–3 dni robocze
```

## Decyzje do podjęcia (właściciel)

1. **Nazwy/układ kanałów Slack** — 3 kanały jak wyżej, czy mniej (np. alerts+feedback razem)?
2. **WhatsApp**: tylko CRITICAL, czy też HIGH?
3. **Zewnętrzny monitor**: Better Stack (rekomendacja — push mobilny, status page) czy UptimeRobot?
4. **Digest dzienny**: włączać na prodzie od razu?
5. **D3 (tabela `system_alerts`)**: robić teraz czy odłożyć?
