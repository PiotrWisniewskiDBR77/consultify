# ODBIÓR 223 — Czat: realny render propozycji + inwentarz widm-akcji

Audytor: sesja adwersaryjna główna (Fable), 2026-09-01. Zakres materiału:
`/private/tmp/cx-day223-czat-render`, gałąź `codex/day223-czat-render-20260901`,
commity `d1262f3416` (A.2 kod), `ee52d84d2c`/`1c7a821c25` (docs/runtime). Marker `9fb7942a01`.

## Werdykt: SCALIĆ

Render jest realny (potwierdzone wizualnie — nie storybook), 3 z 11 widm rozstrzygnięte
z działającym odpowiednikiem, 8 pozostałych świadomie oznaczonych do decyzji właściciela
(nie usunięte hurtem), bramka mutacyjna na inwentarz zweryfikowana niezależnie.

Ocena: **A-**

## Co zweryfikowano niezależnie

1. **Render — nie storybook.** Obejrzano oba PNG (`day223-chat-light.png`,
   `day223-chat-dark.png`, hashe SHA-256 na dysku dokładnie zgodne z raportem). Zrzuty
   pokazują **pełną powłokę aplikacji**: lewy sidebar z ikonami nawigacji, górny pasek
   („AI Chat", przełączniki Data/Model, ikony), znacznik „Day 223 · D2", kompozytor
   „Ask Teresa about your work...", oraz kartę `execution_proposal` („Awaiting review",
   „Low risk", `Approve`/`Reject`/`View run`) osadzoną w wątku z wiadomością użytkownika.
   To nie jest pojedynczy komponent na pustej stronie (wzorzec `day207-write-proposal.tsx`,
   który raport poprawnie odrzucił jako niewystarczający dowód) — to realny
   `UnifiedChatPanel` uruchomiony przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`
   na efemerycznej bazie dyżuru, z realnym seedem `conversation_messages`
   (`message_type='execution_proposal'`), bez modelu językowego.
2. Jasny/ciemny wyraźnie się różnią wizualnie (kolory, kontrast) — nie jest to duplikat
   pod dwiema nazwami.
3. Diff `chatActions.ts`/`chatActionRegistry.ts`/`chatActionHandler.ts`/
   `federatedActionAdapters.ts`: usunięte **dokładnie trzy** typy —
   `CREATE_TASK`, `CREATE_DECISION`, `CREATE_INITIATIVE` — wszystkie trzy z potwierdzonym,
   działającym odpowiednikiem (`CREATE_DRAFT_TASK/DECISION/INITIATIVE` w
   `aiActionExecutor.ts:911-920`, zweryfikowane w kodzie). Pozostałych 8 widm
   (`START_TOOL`, `OPEN_PREVIEW`, `ASSIGN_INTERVIEW`, `START_ARTIFACT_REVIEW`,
   `CHECK_TRUST_STATE`, `ANALYZE_STATEMENT`, `REVIEW_MODEL`, `CHECK_LANE_STATUS`)
   **pozostały w katalogu** z jawnym wpisem `DO_DECYZJI_WLASCICIELA` i uzasadnieniem per
   typ — zero hurtowego kasowania, zgodne z `Z40`/D-15.
4. **Bramka mutacyjna POTWIERDZONA przeze mnie.** Dodano do `chatActions.ts` fikcyjny typ
   `DAY223_DEAD_ACTION` (bez producenta) → test
   `does not allow the producer-less inventory to grow beyond eight types` poszedł
   **RED** (`8 → 9`, dokładnie jak w raporcie). Przywrócono plik, `cmp` czysty.
5. `ARCHITEKTURA_AGENTA_TERESY.md` P5: liczba zaktualizowana z „15/17" na „8/14" z
   odsyłaczem do raportu — zgodne z licencją (wyłącznie ta jedna liczba w tabeli).
   `MODULE_ACCEPTANCE.md` 13_CHAT: dopisana notatka o realnym renderze — zgodne z licencją.
6. Sprzątanie zweryfikowane: brak kontenera `cx-day223-pg`, porty 6166/5120/5121 wolne.

## Uwagi pomniejsze (nie blokują)

- `W7` (liczba 17 vs 18 wariantów) i `W8` (`CREATE_INITIATIVE` fałszywy pozytyw z
  `accessPolicyService.ts`) — raport poprawnie rozpoznaje i koryguje mechaniczne
  artefakty grepu zamiast wpisywać je jako fakt. Zgodne z zasadą „hipoteza nadzorcy
  nie staje się faktem bez weryfikacji".
- Flaga `ENABLE_TERESA_TOOL_LOOP_WRITE=true` przekazana do skryptu startowego nie
  dotarła do serwera (kanoniczny `childEnv(...)` filtruje) — wykonawca to zauważył,
  nie próbował obejść, i bezpiecznie oparł dowód na seedzie DB zamiast wywołania modelu.

## Odpowiedź wprost

**Czy render jest w realnym panelu, czy dalej w storybooku: W REALNYM PANELU.**
Zrzuty pokazują pełną powłokę aplikacji (sidebar, górny pasek, kompozytor, wątek)
uruchomioną przez kanoniczny runtime na realnej bazie, nie izolowany komponent na
pustej stronie. **Widm rozstrzygniętych: 3/11 z działającym odpowiednikiem (usunięte
z katalogu), 8/11 świadomie oznaczonych `DO_DECYZJI_WLASCICIELA` (zostawione, nie
skasowane) — 0 rozstrzygnięć bez uzasadnienia i 0 hurtowego kasowania.**
