# Plan napraw backlogu feedbacku — audit-first (2026-06-10)

Zasada nadrzędna (ustalona z Piotrem): **żadnej naprawy w ciemno**. Każde zgłoszenie przechodzi
bramkę audytową, bo prod = 2026-05-18, a Londyn ma ~miesiąc nowszych prac — część zgłoszeń
jest już naprawiona, część nieaktualna, część by-design.

## Bramka audytowa (per zgłoszenie / klaster)

1. **Dowód z prodowej bazy / repro** — czy objaw faktycznie występuje (logi, wiersze DB, repro w przeglądarce).
2. **Audyt kodu na Londynie** — czy kod, którego dotyczy zgłoszenie, został od tego czasu zmieniony/naprawiony
   (git log od daty zgłoszenia + czytanie bieżącego kodu, nie raportów).
3. **Werdykt** — jeden z:
   - `STILL-BROKEN` → naprawa na Londynie (wchodzi do kolejki fix),
   - `FIXED-ON-LONDYN` → bez kodowania; czeka na promocję Londyn→prod (osobny projekt), status REVIEWED,
   - `NOT-REPRODUCIBLE / STALE` → status RESOLVED z notą,
   - `BY-DESIGN / PRODUKTOWE` → status ARCHIVED lub przeniesienie do backlogu produktowego.
4. **Realizacja** (tylko STILL-BROKEN): fix + weryfikacja zgodnie z regułą "verify before claiming".
5. **Status w `feedback_items`** przesuwany na bieżąco (`PATCH /api/feedback/:id/status` albo bezpośrednio
   w DB + wpis do `feedback_items_status_history` z notą i `changed_by='claude-triage'`).

## Konwencja statusów

| Status | Znaczenie w tym programie |
|---|---|
| NEW | nietknięte |
| IN_PROGRESS | audyt lub fix w toku |
| REVIEWED | audyt zamknięty: fix na Londynie czeka na deploy na prod |
| RESOLVED | potwierdzone naprawione / niereprodukowalne / nieaktualne (nota w historii) |
| ARCHIVED | testowe, duplikat, by-design, przeniesione do backlogu produktowego |

## Fale (kolejność wg triage z feedback-backlog-triage.md)

### Wave 1 — P0 Elkomtech chat core (4 zgłoszenia z 2026-06-10, prod)
Audyt: forensyka 3 konwersacji z metadanych (`07578202…`, `ab0a650c…`, `5bb0cec5…`) w prodowej DB
(jakie wiadomości, jakim językiem odpowiadał model, czy są puste odpowiedzi asystenta, skąd tytuły)
+ audyt kodu chatu na Londynie (egzekwowanie języka odpowiedzi, flow "nowa konwersacja",
persystencja odpowiedzi przy błędzie streamu, generator tytułów).
Itemy: `f2c9f146` (język EN), `79802ad8` (nowa konwersacja), `5d27c9be` (brak odpowiedzi), `f9fba1e0` (puste+tytuły).

### Wave 2 — P1 context bleed między organizacjami (3 zgłoszenia, CRITICAL/HIGH)
Audyt: org-scoping w retrieval/daily-brief/quick-savings; czy "opisz moją firmę"→APLIX to RAG
z cudzych dokumentów, zły org-context użytkownika, czy prompt. Itemy: `45f9e56c`, Quick savings (04-18), Dzienny brief (04-18).

### Wave 3 — P2 My Work / Ideas (6 zgłoszeń APLIX 06-08)
Audyt: repro na Londynie (preview) — scroll, New Idea, podsumowanie, przyciski; i18n My Work.
Zgrane z aktywnym programem Ideas workspace overhaul — fixy wchodzą tam, nie osobno.

### Wave 4 — re-weryfikacja kohort kwietniowych (K2/K3/K4, ~60 zgłoszeń)
Masowy audyt na Londynie klastrami (foldery/kosz chatu, załączniki/cytaty, User Management,
Interview UX, demo mode). Oczekiwanie (pamięć "gap reports overstate"): większość FIXED-ON-LONDYN
lub STALE → masowe domknięcie statusów z notami; realne pozostałości → kolejka fix.

### Wave 5 — i18n przekrojowo + system feedbacku
Jeden audyt kluczy i18n zamiast 14 punktowych fixów; migracja 200 (pulse/feature 500),
`is_active` TEXT (eskalacja superadmin), "Improve with AI", screenshot persistence.

## Higiena (wykonywane przy okazji fal)
- ARCHIVED dla wierszy testowych ([TEST] cc7308b0 na prodzie).
- 2×IDEA → ARCHIVED z notą "backlog produktowy".
- Dziennik werdyktów: `docs/qa/runs/2026-06-10/feedback-verdicts.md` (uzupełniany na bieżąco).
