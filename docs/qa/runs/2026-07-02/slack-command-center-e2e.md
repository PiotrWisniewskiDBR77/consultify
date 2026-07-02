# Slack Command Center — dowód działania E2E (F4)

Data: 2026-07-02 · Środowisko: **demo** (`demo.consultify.ai`, gitSha `ca81a124e8`) · Workspace: **DBR77** · Wykonawca: nadzorca (Chrome+API) + subagenci Opus (F1/F2/F3). SSOT projektu: [SLACK_COMMAND_CENTER_PLAN.md](../../../plans/SLACK_COMMAND_CENTER_PLAN.md).

## Matryca dowodów (każdy wiersz = żywy dowód, nie deklaracja)

| # | Krok łańcucha | Dowód | Status |
|---|---|---|---|
| 1 | Slack App: slash `/consultify` + shortcut + interactivity + Events | manifest zapisany; **Events Request URL `https://demo.consultify.ai/api/slack/events` = Verified ✓** (podpisany challenge obsłużony przez F2 na demo) | ✅ |
| 2 | Kanały + bot | `#cf-alerts C0BENH8J6JJ` · `#cf-feedback C0BEQHLK1TL` · `#cf-progress C0BEU9A8V7W` · `#cf-ai-ops C0BEJA48QSX` (conversations.create); `chat.postMessage` ok=true, `ts` zwracany | ✅ |
| 3 | Weryfikacja podpisu (bez sekretu nie wchodzi nic) | probe bez podpisu → **401** na `/events` i `/interactions`; testy HMAC 9/9 | ✅ |
| 4 | `/consultify` → modal (PL, prefill z argumentu komendy) | żywy klik w Slack web; screenshot modala „Zgłoś do Consultify" | ✅ |
| 5 | Submit → `feedback_items` + AUTO-TASK | **DB round-trip (pg, demo):** ticket `57a37840-0baa-4f43-85d7-4c983cfee9c2` (BUG, source=`slack`) + task `64d1b6af-…` (status=todo); wcześniejszy przebieg: `a747aac6` + `730f624d` | ✅ |
| 6 | Post bota na #cf-feedback + ephemeral z ID | wiadomość „📨 BUG — F4 final…" + „✅ Zgłoszenie #57a37840 przyjęte → task 64d1b6af" | ✅ |
| 7 | Kotwica wątku w metadata | **DB:** `slack_thread_ts=1782990566.040479`, `slack_channel_id=C0BEQHLK1TL` | ✅ |
| 8 | Zmiana statusu w systemie → reply w wątku Slack | `PATCH /api/feedback/:id/status → {"success":true}` → **reply bota w wątku: „🔧 Status: NEW → IN_PROGRESS"** (screenshot) | ✅ |
| 9 | Progress feed (batch 15 min) + digest 8:00 | kod live (`4e9f2688a9`), `FEEDBACK_DIGEST_ENABLED=true`; testy 10/10 | ✅ kod · 🟡 pierwsza żywa emisja = najbliższy digest/zdarzenia |
| 10 | Naprawione martwe ogniwa (F1) | AdminAlertService.sendAlert realny; rejestracje→#cf-progress bez APLIX-only; watchdog top-routes | ✅ (testy 12/12) |

## Bugi znalezione ŻYWYMI testami (i naprawione w tej sesji)
1. **`appEnv is not defined`** w `createFeedbackInternal` (błąd ekstrakcji F2) — każdy intake ze Slacka padał; dowód: railway logs; fix `a9fdb0d848`.
2. **Race na `metadata_json`**: eskalacja (read-modify-write całego obiektu) nadpisywała świeżo zapisaną kotwicę `slack_thread_ts`; dowód: router miał `ts`, DB nie miało; fix `ca81a124e8` (sequencing po `escalationPromise` + atomowy `jsonb_set`).

## Commity fazy (feat/deliverables-w1 → demo)
`4faf432d20` (F1 router+ogniwa) · `32b4b317bd` (F2 inbound) · `a9fdb0d848` (hotfix appEnv) · `4e9f2688a9` (F3 feed+digest) · `ca81a124e8` (race fix). Testy łącznie: 31/31 (router 12 + inbound 9 + progressFeed 10).

## Znane drobiazgi (polish, nie blokery)
- Reply w wątku pokazuje **user ID** zamiast nazwiska („przez d2b6a316-…") — do zamiany na display name.
- Superadmin-gate statusu: rola z DB (elevacja OWNER→SUPER_ADMIN wykonana odwracalnie na czas testu i przywrócona).
- Modal `FEATURE` normalizowany do `IDEA` (schemat zna BUG/IDEA) — typ oryginalny w `metadata.slack_modal_type`.
- Pierwsza żywa emisja digestu/progress-feed do potwierdzenia po naturalnych zdarzeniach (wiersz 9).

## PROD
Nietknięty (D-G=NIE). Całość na demo; promocja na prod = osobna jawna zgoda.
