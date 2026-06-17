# HARVARD 1 — Core Chat & Canvas
**Cluster:** Core Chat & Canvas | **Fala:** 1 | **Data:** 2026-06-17

---

## TOŻSAMOŚĆ

Jesteś Harvard 1. Twój scope to dwa najważniejsze user-facing moduły produktu: **M01 Czat (Teresa)** i **M02 Canvas / Deliverables**. Są to moduły WIELKIE — o największej liczbie luk i największym wpływie na użytkownika.

---

## MODUŁY I TECZKI

| Nr | Tytuł | Teczka | Typ | Otwarte luki |
|----|-------|--------|-----|-------------|
| M01 | Czat (Teresa) | `M01-czat.md` | WIELKI | ~10 |
| M02 | Canvas / Deliverables | `M02-canvas.md` | WIELKI | ~15 |

---

## KOLEJNOŚĆ PRACY

**Zasada: małe szybkie wygrane najpierw, potem głębokie naprawy.**

1. **M01 najpierw** — chat jest punktem wejścia; jego niezawodność blokuje M02 (canvas chat→doc).
2. W M01 zacznij od luk P0/P1, potem P2/P3.
3. Dopiero gdy M01 ≥ 80% zamknięte, otwórz M02.
4. W M02 zacznij od VITE flag (deliverables na staging) — to debloker dla Harvard 5 (M17/M18/M19).

---

## M01 — CZAT (TERESA)

**Teczka:** `Harvard/wdrozenie-100/M01-czat.md`

**Kluczowe konteksty:**
- Chat AI persona = `server/src/services/persona.ts`
- Main UI = `src/components/Chat/UnifiedChatPanel.tsx` (~3000 linii)
- Poprzednie naprawy: `b9f2dee9d2` (cross-org mem), `e0b368b218` (UnifiedChatPanel), `ca0e632e4d`, `dc1dd6154d`
- L-08 oznaczona "NAPRAWIONE bez commita" w teczce → **R3: zweryfikuj w kodzie runtime przed zamknięciem**
- Dev backend trafia na Railway PROD DB (`.env.local` nadpisuje) — uważaj z query

**Twoje zadanie:**
1. Przeczytaj teczkę `M01-czat.md` — sekcja §03 Rejestr luk
2. Dla każdej OTWARTEJ luki: napraw → test → commit → zaktualizuj teczkę
3. Dla każdej NAPRAWIONEJ (bez commita): zweryfikuj w kodzie runtime → albo zamknij z commitem, albo cofnij status do OTWARTA
4. Reasoning chain i zmiana języka → testować WYŁĄCZNIE na staging (nie dotykaj prod)

**Ścieżki plików (tylko te edytuj):**
```
src/components/Chat/
src/views/chat/
server/src/routes/chat.routes.ts
server/src/services/chat*/
server/src/services/persona.ts
src/components/shared/ (tylko jeśli dotyczy chatu)
```

---

## M02 — CANVAS / DELIVERABLES

**Teczka:** `Harvard/wdrozenie-100/M02-canvas.md`

**Kluczowe konteksty:**
- VITE flag: `ENABLE_DELIVERABLES_LIGHT=true` musi być w Railway build env — bez tego triada (deck/doc/sheet) jest OFF na staging/demo
- Triada live-proven lokalnie `2026-06-10` ale NIE na Railway → ustaw env var (nie edytuj .env.local)
- `regenerateSlide` — teczka mówi NAPRAWIONE (`36a6f240ff`), ale wymaga R3 (zweryfikuj runtime)
- Stare inwentarze/briefe STALE — nie ufaj, sprawdzaj kod live
- Dwa silniki artefaktów = realny dług integracji (M18/M19 zależne)

**Twoje zadanie:**
1. Przeczytaj teczkę `M02-canvas.md` — sekcja §03 Rejestr luk
2. **Priorytet #1:** Zweryfikuj że `ENABLE_DELIVERABLES_LIGHT` jest w Railway env → napisz instrukcję dla Piotra jeśli nie masz dostępu
3. Dla każdej OTWARTEJ luki: napraw → test → commit → zaktualizuj teczkę
4. `regenerateSlide` → test runtime przed zamknięciem
5. Re-oceń sekcje D i G teczki po naprawie kręgosłupa (Faza 3/4)

**Ścieżki plików (tylko te edytuj):**
```
src/components/Canvas/
src/components/Deliverables/
server/src/routes/canvas.routes.ts
server/src/services/deliverables*/
```

---

## ZABRONIONE ŚCIEŻKI

NIE edytuj (należą do innych agentów):
```
src/components/MyWork/          ← Harvard 2
src/components/Interview/       ← Harvard 3
src/components/Initiatives/     ← Harvard 3
src/components/Notebook/        ← Harvard 4
src/components/Execution/       ← Harvard 4
src/components/Outputs/         ← Harvard 5
server/src/routes/my-work.routes.ts
server/src/routes/table-platform.routes.ts
public/locales/*/               ← ZAKAZANE (inny agent)
```

---

## PROTOKÓŁ GIT

```bash
git add src/components/Chat/SomeFile.tsx
git add server/src/routes/chat.routes.ts
# Nowe pliki testów w /tests/:
git add -f tests/integration/chat/some.test.ts
git commit -m "fix(M01/L-xx): opis naprawy"
```

Nigdy `git add -A`. Zawsze `git fetch origin Londyn` przed commitem.

---

## DEFINICJA DONE

- [ ] Wszystkie luki M01 ze statusem ZAMKNIĘTA lub FALSE POSITIVE (z uzasadnieniem)
- [ ] Wszystkie luki M02 ze statusem ZAMKNIĘTA lub FALSE POSITIVE
- [ ] Teczki zaktualizowane z datami i SHA commitów
- [ ] Brak nowych błędów TypeScript (`tsc --noEmit --isolatedModules` na zmienionych plikach)
- [ ] Co najmniej 1 test per zamknięta luka (unit lub integration)
