---
doc_kind: AS_IS_TARGET_GAP_ANALYSIS
function_id: MW_INBOX
status: REVIEW
last_updated: 2026-07-31
---

# Inbox — AS-IS, MVP, luki i pytania

## 1. Potwierdzone AS-IS

- unified `InboxContent`: notifications + tasks + decisions;
- canonical item/service i materialization;
- sections, urgency, SLA/aging, source references;
- open/done/saved/all, flat/sections, action-required;
- snooze, dismiss, save, focus routing i keyboard triage;
- bulk selection/actions, dedup/aggregation;
- AI brief/recommended action/confidence i undo;
- routing rules, focus boards/templates, eval/golden set;
- standard table i preview components;
- backend/component/contract tests.

## 2. Krytyczne luki

1. Stary `InboxTriage` i nowy `InboxContent` współistnieją — wybieramy jeden runtime, drugi migrujemy/usuwamy po parity check.
2. UI model `open/done/saved/dismissed` i backend `pending/triaged/delegated/resolved/snoozed` wymagają jednej mapy.
3. `read` nie może być wyliczane jako `done`; potrzebna osobna oś attention.
4. Triage lokalny i owner mutation muszą mieć oddzielny sync state/read-back.
5. Materialization, webhook ingestion i enterprise connector items potrzebują jednego identity/dedup contract.
6. Bezpośrednie bulk actions muszą raportować częściowy sukces i wyjątki.
7. AI eval istnieje technicznie, ale próg automatyzacji i zakazane akcje muszą być produktem/admin policy.

## 3. P0 MVP

- jedna kanoniczna lista i detail preview;
- Do działania/Saved/FYI oraz osobne read/triage/source/sync states;
- Tasks/Decisions/Notifications/Approvals/Escalations;
- dedup, sections, urgency, SLA i why-visible;
- open, today/week, schedule, snooze, save, done, dismiss, undo;
- owner deep-link i read-back;
- Teresa brief/recommendation z confidence;
- bulk reversible actions z partial result;
- ACL i source deletion;
- keyboard + compact/detailed;
- golden flows na świeżej bazie.

## 4. P1/P2

P1: comments/replies inline, delegate, waiting view, saved views, multi-channel preferences, Calendar RSVP, batch AI plan, mobile gestures, external connectors.

P2: predictive attention management, advanced cross-channel digest, autonomous low-risk triage w polityce organizacji.

## 5. Golden flows

- GF-I1 assignment → jeden item → open source → owner read-back;
- GF-I2 repeated updates → jedna agregacja bez utraty actorów;
- GF-I3 snooze → ukrycie → powrót o czasie / po materialnej zmianie;
- GF-I4 schedule task → Calendar proposal → Tasks+Calendar confirmation;
- GF-I5 decision approval → preview → approve/reject → Decisions read-back;
- GF-I6 bulk triage → preview → częściowy sukces z exceptions → undo reversible subset;
- GF-I7 private source → brak wycieku w preview/search/AI;
- GF-I8 duplicate webhook/materialization → dokładnie jeden item;
- GF-I9 AI low confidence → rekomendacja niewykonana;
- GF-I10 owner command timeout/conflict → item pozostaje widoczny pending/conflict.

## 6. Otwarte decyzje

1. Czy tab `Waiting` wchodzi do MVP, czy P1?
2. Czy `Done` ma pozostawać dostępne historycznie, a jeśli tak — jak długo?
3. Które FYI są realtime, a które tylko w digest?
4. Czy nowe komentarze zawsze budzą snoozed item, czy tylko mention/priority change?
5. Które akcje low-risk AI może wykonać po globalnej zgodzie: section, save, snooze?
6. Czy external e-mail/Teams/Slack wchodzi do MVP, czy po stabilnym inboxie wewnętrznym?
