# Audyt systemu zgłaszania błędów + feedback + Slack — 2026-06-10

Zakres: linki, przyjmowanie zgłoszeń, widoczność w adminie, feedback (pulse/feature), przekazywanie alertów do Slacka. Testy żywe na **produkcji** (consultify.ai) i **stagingu** (demo.consultify.ai), weryfikacja w prodowej bazie (Railway Postgres, proxy centerbeam) i w Slacku (workspace dbr77).

## Wyniki testów żywych

| Test | Prod | Staging |
|---|---|---|
| `POST /api/feedback` (BUG, LOW) | ✅ 200, zapis do `feedback_items` | ✅ 200 |
| Wiersz w DB + status NEW (widoczny w SuperAdmin) | ✅ `cc7308b0-dc9a-4fb9-9e81-3683b60fcc24` | ✅ `f551b4f1-bc05-493b-b75d-e8e6ca9b3480` |
| Alert Slack | ✅ dotarł do **#all-dbr77** 08:42:55 CEST (~0,2 s od zapisu; `alertDispatch.slack.status=sent`) | — (ten sam mechanizm) |
| Powiadomienie in-app dla superadminów | ❌ `skipped: No superadmin recipients found` | ❌ (ten sam kod) |
| `POST /api/feedback/pulse` | ❌ **500 INTERNAL_ERROR** | ❌ **500** |
| `POST /api/feedback/feature` | ❌ **500 INTERNAL_ERROR** | ❌ (tabela brak) |
| Link "View in SuperAdmin" (https://consultify.ai/superadmin/customers/feedback) | ✅ 200 | ✅ (stara domena `stage.consultinity.ai` → redirect na demo.consultify.ai) |
| Auto-task z feedbacku | ⚠️ `taskId:null` — zgłoszenie anonimowe bez `organizationId` ⇒ task pomijany (by design) | jw. |

## Błędy — przyczyny źródłowe (potwierdzone)

### B1. Pulse i Feature → 500: brak tabel w bazie (prod i staging)
`to_regclass('feedback_pulse')` = NULL, `to_regclass('feature_requests')` = NULL w **obu** bazach.
Migracja `server/migrations/200_enterprise_feedback_system.sql` nie została zastosowana; endpointy
(`feedback.routes.ts:2336` i `:2417`) robią INSERT do nieistniejących tabel. `feedback_items` działa,
bo routes mają dla niej inline-create (linie ~88–160) — pulse/feature nie mają.
**Fix:** zastosować migrację 200 na prod+staging albo dodać inline ensure-schema jak dla `feedback_items`.

### B2. In-app eskalacja do superadminów martwa na Postgresie
`getSuperAdminRecipients()` (`feedback.routes.ts:423`) filtruje `(is_active = 1 OR is_active IS NULL)`.
W prodzie `users.is_active` to **TEXT** → Postgres: `operator does not exist: text = integer` → query pada,
lista odbiorców pusta. W prodzie jest 1 użytkownik `role=superadmin` (adm***@dbr77.com), nigdy nie dostaje
powiadomień in-app o feedbacku. **Fix:** `(is_active::text NOT IN ('0','false') OR is_active IS NULL)`
lub normalizacja kolumny.

## Uwagi (nie-blokujące)

- **U1. Kanał Slack = #all-dbr77 (ogólnofirmowy).** Wszystkie alerty (feedback, systemowe, nocne health-checki
  co 30–60 min) lecą na kanał całej firmy. Rekomendacja: dedykowany `#consultify-alerts` + rozdzielenie webhooków
  (są już zmienne `AI_SLACK_WEBHOOK_URL`, `AI_OPS_…`, `AI_COST_…` — częściowo niewykorzystane).
- **U2. Link w Slacku bez `?feedbackId=`** — `slackService.ts` linkuje do listy feedbacku, nie do konkretnego
  zgłoszenia (in-app actionUrl ma pełny deep-link, `feedback.routes.ts:557`). Drobny fix w `sendNewFeedbackAlert`.
- **U3. Staging `FRONTEND_URL=https://stage.consultinity.ai`** — stara domena; działa przez redirect,
  ale warto zaktualizować na `https://demo.consultify.ai`.
- **U4. Screenshoty zgłoszeń** zapisywane na lokalnym FS (Railway ephemeral/volume) — możliwa utrata po redeployu.
- **U5. Brak retry dla webhooka Slack** — pojedynczy axios POST; błąd tylko logowany.
- **U6. Email/WhatsApp (HIGH/CRITICAL)** skonfigurowane na prodzie (`ALERT_EMAIL_RECIPIENTS=piotr.wisniewski@dbr77.com`,
  Twilio WhatsApp +48 668 009 544) — **nietestowane żywo** w tym audycie (żeby nie spamować realnych kanałów).
- **U7. Lokalny `.env` `DATABASE_URL`** (trolley.proxy.rlwy.net:28146) wskazuje bazę **staging/pgvector**, nie prod —
  wcześniejsza notatka "dev hits prod DB" już nieaktualna.

## Wiersze testowe do obejrzenia/archiwizacji w adminie

- prod: `cc7308b0-dc9a-4fb9-9e81-3683b60fcc24` — "[TEST] Przegląd systemu zgłaszania błędów"
- staging: `f551b4f1-bc05-493b-b75d-e8e6ca9b3480` — "[TEST] Audyt staging"

Nie usuwane celowo — służą jako dowód do samodzielnej weryfikacji w `/superadmin/customers/feedback`.

## Czego NIE zweryfikowano

- Klik-test UI formularza w przeglądarce (FeedbackSidePanel) — wymaga zalogowanego konta; przepływ
  zweryfikowany od API w dół (te same endpointy, które wywołuje panel).
- Auto-task dla zalogowanego użytkownika z organizacją (anonimowe ścieżki potwierdzone jako "skip by design").
- Realna wysyłka email/WhatsApp (konfiguracja obecna, kod okablowany).
