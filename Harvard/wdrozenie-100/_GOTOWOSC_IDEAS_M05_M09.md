# GOTOWOŚĆ DO TESTÓW RĘCZNYCH — pula Ideas M05–M09

> **Dla Piotra (product), przed ręcznym przejściem M5–M9.** Domknięte: epiki, DoD (wszystko **poza #3 i18n** — odroczone do Fazy 4, robimy gdy Piotr na targach), manualne scenariusze. Data: 2026-06-23. Branch: `feat/deliverables-w1`.

## Tabela zbiorcza gotowości

| Moduł | Epiki | DoD (poza i18n) | i18n (#3) | Manual scenariusze | Auto (Cases) | Doc gotowości |
|---|---|---|---|---|---|---|
| **M05** Zarządzanie | 7/7 ✅ | **6/7 ✅** | ⏸️ odroczone (349×) | 54 (`TESTY_M05`) | live 0-fail | [_GOTOWOSC_M05](_GOTOWOSC_M05.md) |
| **M06** Mind Map | 7/7 ✅ | **6/7 ✅** (§27 N/D) | ⏸️ odroczone (~881×) | ~121 (`TESTY_M06`) | Cases 23/7/0 | [_GOTOWOSC_M06](_GOTOWOSC_M06.md) |
| **M07** Process Flow | 6/6 ✅ | **6/7 ✅** (#1+#7 domknięte) | ⏸️ odroczone (252×) | 89 (`TESTY_M07`) | Cases 27/4/0 | [_GOTOWOSC_M07](_GOTOWOSC_M07.md) |
| **M08** Table | 5/5 ✅ | **6/7 ✅** (obie delty zamknięte) | ⏸️ odroczone (~1288×) | 100 (`TESTY_M08`) | Cases 29/1/0 | [_GOTOWOSC_M08](_GOTOWOSC_M08.md) |
| **M09** Whiteboard | 6/6 ✅ | **7/7 ✅** (i18n wzorcowy!) | ✅ MET (189 kluczy) | 117 (`TESTY_M09`) | Cases 29/1/0 | [_GOTOWOSC_M09](_GOTOWOSC_M09.md) |

**Razem manualnych scenariuszy do przejścia: ~481** (M05 54 + M06 121 + M07 89 + M08 100 + M09 117). Każdy moduł ma dedykowany dokument `Harvard/Testy manualne/TESTY_M0X_IDEAS_*.md` z mapą komponent↔plik↔stan i regułą dowodu E2E (Network + DB).

## Co domknięto w tej rundzie (2026-06-23)

- **#2 security (WS org-scope):** notatki „dodać test" w teczkach były **NIEAKTUALNE** — testy regresji cross-org (Org B → 403/404 IDOR) **już istnieją i są kompletne**: `tests/integration/gateways/ideaCollabWs.orgscope.test.ts` (6 przypadków) + `tests/integration/mywork/my-work.map-orgread.contract.test.ts` + `my-work.ai-ownership.contract.test.ts`. #2 zamknięte istniejącym pokryciem.
- **#1 front↔back:** M07 — realny bug skrótów Ctrl+Shift+V/Z naprawiony (`ffa318ed1a`). M08 — obie delty teczki (`generate_table` martwy = false-positive nieosiągalny; fenced-JSON crash naprawiony, strip+try/catch). Plus: **staging AI naprawiony** (`06326decfe` — generacja strukturalna padała na OpenAI strict json_schema).
- **#4 tokeny / #5 §27 / #7 UI canon:** zweryfikowane per moduł (szczegóły w `_GOTOWOSC_M0X.md`). §27 = N/D dla narzędzi canvasa (M06/M07/M09), N/D-uzasadnione dla grida M08.
- **#3 i18n — ODROCZONE** (decyzja Piotra): dług inline `isPl ? …` (M08 największy ~1288×), bare-missing keys = 0, dwujęzyczność DZIAŁA. Codemod isPl→t() = program „Faza 4 i18n sweep" (gdy Piotr na targach).

## Znane noty do weryfikacji RĘCZNEJ (nie blokery, udokumentowane)

- **M07 / MC-07-28:** panele AI Proposal + Semantic Readback są świadomie nie-spięte z triggerem UI (DP-5 cut) — sprawdź że NIE są osiągalne (nie że działają).
- **M08:** rename tabeli znika po reloadzie (React-only, known) — testuj że pole jest, nie że się utrwala.
- **M09 / deep-link:** świeży deep-link do tablicy potrafi wyrenderować Process Flow (race montażu MyWorkHub) — fix wpięty (`forcedIdeaDeepLinkRef`), pełna zieleń E2E wymaga non-demo lane; zweryfikuj ręcznie na żywej sesji.
- **caboose (staging DB):** bywa przeciążony (wolne `/map`, „Loading…") — to latencja środowiska, nie bug; jeśli kanwa wisi, odśwież.

## Bramki pozostałe po stronie Piotra (po manualnym przejściu)

→F (odbiór funkcji) · →UI (odbiór UI, audytor+Piotr) · deploy demo · #3 i18n (Faza 4).
