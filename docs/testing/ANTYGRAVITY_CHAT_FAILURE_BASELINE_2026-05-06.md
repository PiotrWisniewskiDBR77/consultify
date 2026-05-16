# Antygravity Chat Failure Baseline (2026-05-06)

Status globalny: `UPDATED`.

Zrodlo:
- baseline fail report (wczesniejszy),
- retest pass report: `testy_antygravity/reports/2026-05-06_0637_qa-chat-8-areas.md`.

## Syntetyczne podsumowanie (historyczne baseline)

- Krytyczne problemy byly widoczne:
  - raw linie wewnetrzne w odpowiedziach (`Source ledger`, `Blocked scopes`, `rag_*`),
  - `No cited sources` mimo widocznych cytowan,
  - deep thinking w petli bez finalnej analizy,
  - historia rozmow niestabilna (zanik, loading loop, rename/folder persistence),
  - nietrafione lub przypadkowe zrodla zewnetrzne, bez kontekstu DBR77.
- Ocena funkcjonalna testera (baseline): narzedzie wyglada profesjonalnie, ale funkcjonalnie nie spelnia oczekiwan.

## Retest update (2026-05-06 06:37)

Wg najnowszego raportu 8/8 obszarow:
- `PASS`: Area 1-7
- `PASS_WITH_P2`: Area 8 (sporadyczne `No cited sources` w odpowiedziach generycznych)
- `Global decision`: `GO`

W retescie nie potwierdzono otwartych `P0/P1`.

## Rejestr znanych defektow (do retestu)

| ID | Obszar | Objaw | Severity | Status |
| --- | --- | --- | --- | --- |
| AG-CHAT-001 | Basic chat / citations | `No cited sources` pokazuje sie sporadycznie | P2 | OPEN (UX debt) |
| AG-CHAT-002 | Output sanitization | Widoczne `Source ledger`, `Blocked scopes`, `rag_*` | P0 | CLOSED (retest PASS) |
| AG-CHAT-003 | Deep Thinking | Petla potwierdzen, brak analizy koncowej | P0 | CLOSED (retest PASS) |
| AG-CHAT-004 | Show Reasoning | Widoczny surowy `artifact:comparison:{...}` | P1 | CLOSED (retest PASS) |
| AG-CHAT-005 | Attachments | Brak sensownej degradacji i dalszej pracy po bledzie pliku | P1 | CLOSED (retest PASS) |
| AG-CHAT-006 | Web research | Zrodla sa przypadkowe/nielogiczne wobec pytania produktowego | P1 | CLOSED (retest PASS) |
| AG-CHAT-007 | Conversation history | Rozmowy nie trzymaja stanu po switch/refresh | P0 | CLOSED (retest PASS) |
| AG-CHAT-008 | Conversation rename | Zmiana nazwy nie utrzymuje sie | P1 | CLOSED (retest PASS) |
| AG-CHAT-009 | Product assistant quality | Odpowiedzi ogolne, bez kontekstu produktu | P1 | CLOSED (retest PASS) |
| AG-CHAT-010 | Follow-up context | Kontekst watku jest gubiony, cytowania sa nieadekwatne | P1 | CLOSED (retest PASS) |

## Kryterium wyjscia z NO-GO (historyczne)

Warunki minimalne przed ponowna decyzja:
1. Zamkniete wszystkie `P0` (`AG-CHAT-002`, `AG-CHAT-003`, `AG-CHAT-007`).
2. Co najmniej 80% `P1` zamkniete i potwierdzone w retescie.
3. Pelny retest z `docs/testing/ANTYGRAVITY_CHAT_MANUAL_SESSION_PLAYBOOK_2026-05-06.md`.
4. Dowody UI + Network dla kazdego obszaru.

## Decyzja (aktualna)

Na bazie retestu z `2026-05-06_0637_qa-chat-8-areas.md`: `GO` dla Chat, z jednym otwartym defektem `P2` (`AG-CHAT-001`).

