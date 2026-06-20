# Survey 2026-06-19 — pełny przegląd ekranów (zalogowany OWNER, dark mode)

**Cel:** baza do dyskusji o standardach (Menu 1/2/3, tabele, preview) i przejścia ekran-po-ekranie.
**Sposób:** Chrome-MCP na żywej, zalogowanej sesji (localhost:3000). Screeny są w transkrypcie rozmowy (inline) — patrz znaczniki [SCREEN: nazwa] poniżej.
**Uwaga techniczna:** authed screeny nie zapisują się jako pliki PNG (ograniczenie narzędzia); Playwright nie może przejąć cookie-sesji Chrome (pipe, nie port TCP). Żeby zrobić folder realnych PNG-ów: uruchomić Chrome z `--remote-debugging-port=9222` albo dać Playwrightowi login. Wtedy generuję folder w minuty.

## Mapa (kolejność z railu)

## Co udało się uchwycić (inline w rozmowie, dark mode)
| # | Moduł / ekran | Stan danych | Struktura widoczna (do standardu) |
|---|---------------|-------------|-----------------------------------|
| 1 | Chat (landing/Teresa) | OK | composer, OUTPUT taby, suggestion chips |
| 2 | My Work → Inbox | ❌ Failed to load | Menu1 (Ideas/Notebook/Inbox/Calendar/Tasks/Decisions/Manager), Menu2 (ALL/Overdue/Saved/AI/Critical/Action req/Today/This week), Menu3 (Open/Done/Saved + AI Triage), view toggles |
| 3 | My Work → Notebook | OK (wcześniej) | lista notatników + edytor + prawy rail |
| 4 | Interview → Inbox | OK (puste) | Menu1 numerowane ①–⑥, Menu2 (All/Answered/Approved/Sent back), nagłówki TEMPLATE/STATUS/PROGRESS/DAYS TO DUE, "Assign" CTA |
| 5 | Tools → Library | ❌ HTTP 500 | Menu2 kategorie z licznikami + kropki categoryTone, "Add" CTA, crimson "Retry" |
| 6 | Initiatives → Portfolio | ❌ degraded/Failed | Menu1 (Portfolio/Analysis), Menu2 (ALL/In Review/Promoted/Planning/Approved/Scheduled + AI Wizard + Charter), view-modes (Active/All/ROI + list/board/cal/grid), "New initiative" CTA |
| 7 | Execution | ❌ V8 unavailable | pusty shell (moduł za bramką V8) |
| 8 | Settings → Profile | OK | "Save Changes" navy CTA, sekcje formularza |
| 9 | Settings → Webhooks/Language/AI-behavior | ❌ (transient 401/proxy) | sidebar grup, karty/radio (Language: selekcja info-blue) |

## STATUS / blokery (czytaj to)
1. **Folder realnych PNG = NIEMOŻLIWY teraz.** Authed screeny (Chrome-MCP) nie zapisują plików na dysk — są tylko w transkrypcie rozmowy. Playwright (zapisałby pliki) nie przejmie sesji-cookie Twojego Chrome (pipe, nie port TCP; token cookie-based, localStorage-refresh = 500).
   **FIX (wtedy generuję pełny folder w kilka minut):** zamknij Chrome i odpal z portem debug:
   `open -na "Google Chrome" --args --remote-debugging-port=9222`
   — wtedy Playwright łączy się przez CDP do Twojej zalogowanej sesji i robi czysty folder PNG (light+dark, wszystkie moduły + drill-in encji).
2. **Dane szeroko nie ładują się teraz** (backend dev → Railway PROD DB: latencja/N+1, część endpointów 500/timeout; org-context potrafił trwać 24s). Dlatego drill-in encji (inicjatywy, wiersze) jest niewykonalny w tej chwili — nie ma czego otworzyć. To nie kod UI, to warstwa danych (zob. finding_staging_db_perf).
3. **Część modułów jest za bramką V8** (Execution „unavailable") — to by design dla org bez V8.

## Co robię zamiast tego (odblokowane, najwyższa wartość)
Konsolidacja JEDNEGO standardu (Menu 1/2/3, tabele, preview) z 5 sprzecznych dokumentów + lista sprzeczności do Twojej decyzji — bo to jest root cause i to robimy po Twoim powrocie.
