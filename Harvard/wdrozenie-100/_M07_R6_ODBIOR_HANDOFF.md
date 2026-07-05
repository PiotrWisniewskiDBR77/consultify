# M07 Process Flow — HANDOFF DO ODBIORU (bramka R6)
**Orkiestrator:** Fable 5 · 2026-07-04 · **Gałąź:** `feat/m07-finisz` (worktree `.claude/worktrees/agent-a4140c9776c425306`) — NIE pushnięta, NIE scalona
**Dla:** Piotr — żywy odbiór + akceptacja wizualna. Merge do Londyn/demo dopiero po Twoim „tak".

## Co dostarczono (6 fal, wszystkie testy zielone, zero nowych błędów type-check)
| Commit | Fala | Efekt dla użytkownika | Model |
|--------|------|----------------------|-------|
| `bbaac1165f` | F1 | Walidacja, Odczyt i Eksport (JSON/tekst) znów działają — po wycięciu V8 były zepsute; martwy kod usunięty | Sonnet |
| `81729c859d` | F2 | Panel „Propozycja AI" działa na realnym LLM: generuje zmiany przepływu, podgląd before/after, Akceptuj/Odrzuć | Opus+Sonnet |
| `6060070710` | F3 | Współpraca na żywo — edycje jednego użytkownika widoczne u drugiego (wcześniej tylko kursory) | Opus |
| `bb0371f83d` | F4 | Wspólny runtime persystencji — koniec rozjazdu stanu przy przełączaniu narzędzi tej samej idei | Opus |
| `85df074c0d` | F5a | Routing ortogonalny krawędzi + waypointy, 3 typy krawędzi, zwijane/skalowane tory | Opus |
| _F5b_ | F5b | viewState przy wczytaniu, komentarze na węzłach, (context-menu wg decyzji agenta), sweep | Sonnet |

## Scenariusz żywej weryfikacji (uruchom na STAGINGU, nie prod)
> UWAGA: w tej sesji nie odpalono serwera — jedyny `.env.local` celuje w PROD centerbeam (reguła prod-caution). Poniższe wykonaj w swoim bezpiecznym środowisku staging.

**Wejście:** My Work → Ideas → narzędzie Process Flow (URL `.../workspace/process_flow`).

### R6.1 — Funkcje naprawione (F1)
- [ ] Cmd/Ctrl+Shift+V → panel walidacji pokazuje realne wyniki (brak start/end/dangling/decyzja bez 2 wyjść).
- [ ] Przycisk „Odczyt" → panel pokazuje trawers przepływu (gałęzie decyzji, cykle, węzły nieosiągalne).
- [ ] Eksport → PNG pobiera obraz; JSON pobiera plik; readback-text pobiera .txt. Żaden nie „wisi".

### R6.2 — Realne AI (F2)
- [ ] „Propozycja AI" (przycisk widoczny) → wpisz prompt → podgląd operacji + before/after + ryzyka.
- [ ] Akceptuj → zmiany na kanwie, jedno Cmd+Z cofa całość. Odrzuć → nic się nie zmienia.
- [ ] Zaznacz 1 węzeł → propozycja rozwija właśnie ten węzeł (node_expand).

### R6.3 — Współpraca na żywo (F3) — DWA OKNA/UŻYTKOWNICY
- [ ] User A dodaje węzeł → pojawia się u B < 1s. Zmiana etykiety, nowa krawędź, rename toru — propagują.
- [ ] Undo u A → snapshot propaguje do B.
- [ ] **Network u B:** zdalny patch NIE generuje `PUT /map` u odbiorcy (guard origin remote — krytyczne po F4).
- [ ] Węzeł trzymany przez A jest niedraggable u B (obwódka `var(--c-info)` + avatar). Brak deadlocka po rozłączeniu A.

### R6.4 — Persystencja / runtime (F4)
- [ ] Przełącz narzędzia tej samej idei: Table ↔ Process Flow ↔ Mind Map — stan i wersja nie gubią się, brak konfliktu 409 przy zwykłej edycji.
- [ ] F5, reload — węzły/tory/krawędzie wracają; przywrócony viewState (grid/snap/zoom — F5b).

### R6.5 — Edge UX (F5a) — AKCEPTACJA WIZUALNA
- [ ] Krawędź: przełącz na ortogonalną; double-click dodaje waypoint; drag uchwytu przesuwa; double-click uchwytu usuwa.
- [ ] Trzy typy krawędzi (sequence/conditional/message) renderują się poprawnie.
- [ ] Tor: zwiń/rozwiń (chevron), zmień wysokość (uchwyt). Zwinięty chowa węzły.
- [ ] Komentarze na węźle (F5b) — wątek działa, persystuje po reload.

## Dowód zastępczy (bo brak żywych zrzutów w tej sesji)
`docs/qa/runs/2026-07-04-m07-f5/` — README + `edge-routing-proof.svg` (dosłowny output funkcji routingu offline). Do R6 zastąp żywymi zrzutami ze stagingu.

## Reżim wizualny (przypomnienie)
Wszystkie zmiany wyglądu (F5a/F5b) zbudowane w `feat`, wyłącznie tokeny `var(--c-*)`, zero nowych kolorów, zero crimson-leak. NIE scalone — czekają na Twoją akceptację na zrzutach.

## Rekomendacja merge
1. Odbierz R6.1–R6.5 na stagingu.
2. Zaakceptuj zrzuty F5 (wizual) lub wskaż poprawki.
3. Dopiero wtedy: `feat/m07-finisz` → integracyjna/Londyn. Przy merge — pełne testy PF + Whiteboard razem (F4 dotknął wspólnego `IdeaMapWorkspace.tsx` w izolowanym bloku; kolizja z torem Whiteboard mało prawdopodobna, ale zweryfikuj po rebase).

## Znane, świadomie poza zakresem
- Dwukliencki E2E collab: szkielet `tests/e2e/m07-process-flow-collab.spec.ts` [MANUAL] — wymaga żywego WS/stagingu.
- Odkrycie systemowe (poza M07): realtime Mind Mapy martwy (`broadcastGraphPatch` bez wywołań) — chip zadania dla właściciela M06.
- Egzekucja locków po stronie serwera, CRDT/OT — poza v1.
