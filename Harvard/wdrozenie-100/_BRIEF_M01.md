# BRIEF AGENTA — M01 Czat · DOKOŃCZENIE DO ODBIORU 8/8

> Wklej jako pierwszą wiadomość do świeżego czata. Agent łapie kontekst **tylko M01**. Cel: doprowadzić M01 do **MODUŁ ZAMKNIĘTY (8/8)** w tabeli odbioru — wszystkie bramki realizacji + przygotować odbiory.

## Rola i cel
Jesteś agentem-wykonawcą **modułu M01 Czat** (Teresa, `/chat`). Domykasz wszystkie bramki z tabeli odbioru [`_STAN_PRACY_ODBIORY.md`](_STAN_PRACY_ODBIORY.md): **Kod · DoD 7/7 · Epiki 5/5 · Testy · Zgodność UI/UX · Deploy · →F (odbiór funkcji) · →UI (odbiór grafika)**. Każdą rzecz **weryfikujesz dowodem** (test PASS / screenshot / payload), nie deklarujesz. Nie dotykasz innych modułów.

## Źródła prawdy (przeczytaj NAJPIERW, w tej kolejności)
- Repo: `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify` · branch **Londyn**
- **Tabela odbioru (Twój cel, aktualizuj wiersz M01):** `Harvard/wdrozenie-100/_STAN_PRACY_ODBIORY.md` — blok „### M01" ma 8 etapów.
- **Teczka modułu:** `Harvard/wdrozenie-100/M01-czat.md` (rejestr luk L-XX, epiki, DoD, ekrany).
- **Spec testów manualnych E2E (13 scenariuszy):** `Harvard/Testy manualne/TESTY_M01_CZAT.md`.
- **Krytyczny fix kontekst:** `~/.claude/.../memory/finding_chat_inputschema_sdk_v6.md` — czat był ZEPSUTY (ai SDK v6 `inputSchema`), naprawiony `42bee38044`, live-verified. NIE cofaj tego.

## Stan wejściowy M01 (zweryfikowany 2026-06-19 — potwierdź, nie zgaduj)
**Bramki już zrobione (z dowodem):**
- **Kod ✅** — L-01/02/05/07/08/09/10 zamknięte, L-04/06 false-pos; sierota `CodeInterpreter/` usunięta. **+ KRYTYCZNY FIX `42bee38044`** (czat padał 400 „type:None" → `inputSchema` w `llmService.ts`).
- **DoD 6/7 ✅** — #1 front↔back, #2 security (locki 4/4+3/3), #3 i18n (0 bare-missing), #4 tokeny (rose 0), #5 §27 N/D, #6 E2E-gate (M01 zielony). **Zostaje #7** (a11y/dark live).
- **Epiki 5/5 ✅** — język 10/10, reasoning 9/9, kręgosłup Tryb B 33/33+2/2 (Tryb C odroczony BETA).
- **Testy automaty ✅** — M01-core 100 PASS (component+backend). Naprawiony stale mock `EnhancedChatInput.teresa-error-toast` (`cb7244e1dd`).
- **Deploy ✅** — M01 live na demo (`demo/1475849a`).
- **→F częściowo NA ŻYWO ✅** — zweryfikowane: AddFilesMenu, ToolsMenu/AI-Modes, Co-Thinker(6 person), **język PL→PL**, error-state, SSE+RAG+persystencja.

**Co MUSISZ jeszcze domknąć do 8/8:**
1. **Testy — pełny zestaw zielony.** Uruchom CAŁY zestaw M01 i potwierdź 0 tracked-failów M01. (Znane nie-M01 faile: M22 `Wave5ArtifactRuntimePanel` + integracje DB-infra — NIE Twoje.) Komenda: `npx vitest run tests/components/AIChat tests/unit/AIChat tests/unit/detectMessageLanguage.test.ts tests/unit/backend/shareMetadataWhitelist.test.ts tests/unit/backend/aiMemoryGating.test.ts tests/unit/backend/ai/aiPipeline-thinking.test.js`. CI puszcza tylko `tests/unit|integration|components` (luka-testy w `tests/`, NIE `src/__tests__`).
2. **DoD #7 — a11y/dark NA ŻYWO** (niżej „Weryfikacja live").
3. **→F — pozostałe scenariusze z 13** (te niezweryfikowane: branch/export/share/revoke, slash-commands, głos jeśli skonfigurowany) NA ŻYWO.
4. **Drobny i18n-leak:** nagłówek `JAK TERESA MA ODPOWIADAĆ` (PL) w ToolsMenu wśród EN — znajdź klucz/hardkod i przez `t()` (locales dozwolone). Zweryfikuj render.
5. **→UI** — przygotuj zestaw screenów ekranów M01 (inwentarz 20 ekranów w teczce) dla audytora.

## Weryfikacja LIVE (tak to robisz — sprawdzone)
Czat wymaga zalogowanej, działającej apki. Środowisko:
1. `preview_start` serwery z `.claude/launch.json`: **`frontend-dev`** (:3000) + **`backend-dev`** (:3001, **staging DB — bezpieczne, NIE prod**).
2. Sterujesz **zalogowaną przeglądarką Piotra** przez „Claude in Chrome" MCP: `list_connected_browsers` → `navigate http://localhost:3000/chat` (nowa karta dziedziczy sesję). NIE używaj preview-przeglądarki (osobna, niezalogowana).
3. Dowód = screenshot + payload Network + logi backendu (`preview_logs`).
4. ⚠ Provider AI bywa bez balansu (deepseek/openrouter) — jeśli „AI returned no output", sprawdź logi backendu czy to balans (środowisko) czy realny bug; przełącz model (selektor „Model" prawy-góra) jeśli trzeba.

## Twarde zasady
- Tylko M01. NIGDY `git add -A`/`.` — jawne ścieżki. prod=centerbeam: zero zmian bez osobnej zgody Piotra (pracujesz Londyn→demo).
- Sekrety/env/flagi Railway: nie ustawiasz — zgłaszasz Piotrowi.
- Każda zmiana UI: zweryfikuj live, dowód=screenshot. Nigdy „done" na samym `tsc`. Weryfikuj zanim ogłosisz.

## Co zwracasz
Zaktualizowany wiersz M01 w `_STAN_PRACY_ODBIORY.md` + raport: stan 8 bramek z dowodem (commit/screenshot/test), co domknięte, blokery dla Piotra (deploy demo/prod, env). Status końcowy: **8/8 GOTOWY DO ZAMKNIĘCIA** (po Twoim →F/→UI) albo precyzyjna lista co zostało.
