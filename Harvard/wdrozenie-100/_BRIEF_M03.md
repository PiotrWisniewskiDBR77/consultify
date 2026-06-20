# BRIEF AGENTA — M03 My Work (organizer) · DOKOŃCZENIE DO ODBIORU 8/8

> Wklej jako pierwszą wiadomość do świeżego czata. Agent łapie kontekst **tylko M03**. Cel: **MODUŁ ZAMKNIĘTY (8/8)** w tabeli odbioru.

## Rola i cel
Jesteś agentem-wykonawcą **modułu M03 My Work — organizer** (`/my-work/*`: Inbox, Zadania, Decyzje, Kalendarz, Manager). Domykasz wszystkie bramki z [`_STAN_PRACY_ODBIORY.md`](_STAN_PRACY_ODBIORY.md): **Kod · DoD 7/7 · Epiki 6/6 · Testy · Zgodność UI/UX · Deploy · →F · →UI**. Każdą rzecz **weryfikujesz dowodem** (test PASS / screenshot / payload), nie deklarujesz. Nie dotykasz innych modułów.

## ⚡ Równoległość — ODPALAJ SUB-AGENTÓW
Masz narzędzie Agent/Task — **możesz i POWINIENEŚ odpalać wielu sub-agentów równolegle**, żeby szło szybko. M03 ma 5 powierzchni — rozdaj je: **jeden sub-agent na powierzchnię** (Inbox / Zadania / Decyzje / Kalendarz / Manager) do testów + zgodności + live-weryfikacji. Ty jesteś orchestratorem: zbierasz raporty, godzisz konflikty na plikach wspólnych, aktualizujesz tracker. Każdy sub-agent dostaje wyciętą część tej instrukcji + swoją powierzchnię.

## Źródła prawdy (przeczytaj NAJPIERW)
- Repo: `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify` · branch **Londyn**
- **Tabela odbioru (Twój cel, aktualizuj wiersz M03):** `Harvard/wdrozenie-100/_STAN_PRACY_ODBIORY.md` — blok „### M03".
- **Teczka:** `Harvard/wdrozenie-100/M03-my-work-organizer.md` (luki L-XX, epiki, DoD, 15 ekranów).
- **Spec testów manualnych (39 scenariuszy):** `Harvard/Testy manualne/TESTY_M03_MOJA_PRACA.md`.

## Stan wejściowy M03 (zweryfikowany 2026-06-19 — potwierdź w kodzie)
**Zamknięte/zweryfikowane:** L-01 leak executive-analytics → `requireRole` na route (`my-work.routes.ts:7974`), L-04 CalendarCreateEventModal (test), L-05 martwe komponenty usunięte (`de3eccbdd0`), L-06 crash render-time landing (`PreviewRelations.tsx` `$$typeof` fix `8bf85a6679`), L-08 initiative in-context (`openItemRouting.ts`, test 6/6), L-10 persistKey (`d03c0bc37f`). **Grafika M03 = 🟢** (wszystkie P0/P1 funkcjonalne+security+wizualne zamknięte, log 2026-06-18).
**Otwarte / odroczone:** L-02 session-context (stub, INERT), L-03 task-advisor (INERT 503, 0 FE), L-07 kalendarz OAuth = **BLOCKED-ON-ENV** (wymaga `GOOGLE_/MICROSOFT_CLIENT_ID/SECRET` — Piotr), L-09 kalendarz multi-day kolor (design D-03), L-10 sticky-thead overflow (§27, P2 odroczone), L-11 i18n 2888× (Faza 4 sweep).

**Co MUSISZ domknąć do 8/8:**
1. **Testy — pełny zestaw M03 zielony.** Uruchom testy M03 (`tests/**` dot. my-work/MyWork/calendar/tasks/decisions/inbox) → 0 tracked-failów M03. CI puszcza tylko `tests/unit|integration|components`.
2. **→F — 39 scenariuszy NA ŻYWO** (rozdaj sub-agentom per powierzchnia): Inbox, Zadania (lista/filtry/edycja), Decyzje, Kalendarz (event create/conflict; OAuth=zablokowane env), Manager (gate 403 dla member).
3. **DoD #7 a11y/dark NA ŻYWO** + potwierdź §27 sticky-thead (odroczone czy domknąć).
4. **→UI** — screeny 15 ekranów dla audytora.

## Weryfikacja LIVE (tak to robisz — sprawdzone)
1. `preview_start` z `.claude/launch.json`: **`frontend-dev`** (:3000) + **`backend-dev`** (:3001, **staging DB — bezpieczne, NIE prod**).
2. Sterujesz **zalogowaną przeglądarką Piotra** (Claude in Chrome MCP): `list_connected_browsers` → `navigate http://localhost:3000/my-work`. NIE preview-przeglądarka (niezalogowana).
3. Dowód = screenshot + payload Network + logi backendu (`preview_logs`).

## Twarde zasady
- Tylko M03. NIGDY `git add -A`/`.` — jawne ścieżki. prod=centerbeam: zero zmian bez osobnej zgody (Londyn→demo).
- Env/OAuth/sekrety: nie ustawiasz — zgłaszasz Piotrowi (L-07 OAuth = jego).
- Każda zmiana UI: zweryfikuj live, dowód=screenshot. Weryfikuj zanim ogłosisz.

## Co zwracasz
Zaktualizowany wiersz M03 w `_STAN_PRACY_ODBIORY.md` + raport: 8 bramek z dowodem, blokery dla Piotra (OAuth env), status końcowy **8/8 GOTOWY** albo lista co zostało.
