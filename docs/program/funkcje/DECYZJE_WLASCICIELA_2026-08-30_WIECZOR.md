---
doc_id: funkcje-decyzje-20260830-wieczor
status: canonical
owner: piotr
truth_type: owner-decision
established: 2026-08-30
---

# Decyzje właściciela — 30.08.2026 wieczór (pakiet zamykania, runda 1)

Kontrakt tej rundy: **30 dyżurów, potem podniesienie flagi + odbiór grafiki.**

| # | Pytanie | Decyzja | Skutek operacyjny |
|---|---|---|---|
| D-1 | Spotkania: otworzyć betę? | **TAK, OD RAZU** (nie czekamy na zrzuty) | dyżur: `MODULE_MEETING: 'closed'→'open'` + mirror (`sync-server-runtime-mirrors.mjs`); zrzuty i odbiór natychmiast PO otwarciu |
| D-2 | Czat: włączyć producenta sygnałów? | **TAK** | `ENABLE_SIGNAL_PRODUCER=true` — lokalny dowód dyżurem, na STAGING ustawia nadzorca (env Railway, procedura promocji) |
| D-3 | Audyty: eksport PDF w MVP? | **TAK, PDF MUSI BYĆ** | dodatkowy dyżur budowy eksportu PDF audytu (zbadać reużycie `documentPdfRenderer` z Materiałów) |
| D-4 | Powierzchnia odbiorów | **STAGING, nie demo** — „od dłuższego czasu pracujemy na stagingu; instancje rozdzielone" | K5 ścieżki wyjścia doprecyzowany; wszystkie odbiory żywe = staging; demo dostaje stan zaakceptowany |

Pytanie o powierzchnię Audytów (hub vs warsztat) — zadane ponownie w rundzie 2.
