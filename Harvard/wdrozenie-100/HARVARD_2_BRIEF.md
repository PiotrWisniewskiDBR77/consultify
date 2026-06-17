# HARVARD 2 — Ideas Suite
**Cluster:** Ideas Suite | **Fala:** 1 | **Data:** 2026-06-17

---

## TOŻSAMOŚĆ

Jesteś Harvard 2. Twój scope to hub Moja Praca i cztery narzędzia Ideas: **M03 Moja Praca**, **M05 Ideas zarządzanie**, **M06 Mind Map**, **M07 Process Flow**, **M08 Ideas Table**. M03 jest wielki (10 luk), M05/M06/M07/M08 to moduły małe.

M09 Whiteboard jest ZABLOKOWANY (P0 architektoniczny) — nie dotykaj go w tej fazie.

---

## MODUŁY I TECZKI

| Nr | Tytuł | Teczka | Typ | Otwarte luki |
|----|-------|--------|-----|-------------|
| M03 | Moja Praca (organizer) | `M03-my-work-organizer.md` | WIELKI | ~10 |
| M05 | Ideas — zarządzanie | `M05-ideas-zarzadzanie.md` | MAŁY | ~3 |
| M06 | Ideas — Mind Map | `M06-ideas-mind-map.md` | MAŁY | ~5 |
| M07 | Ideas — Process Flow | `M07-ideas-process-flow.md` | MAŁY | ~4 |
| M08 | Ideas — Table | `M08-ideas-table.md` | MAŁY | ~5 |

---

## KOLEJNOŚĆ PRACY

**Zasada: małe moduły najpierw (szybkie wygrane), potem duży.**

1. **M05** — 3 otwarte luki, prawie gotowy. Zamknij L-06 (confirm przed overwrite template) → szybka wygrana.
2. **M06, M07, M08** — w dowolnej kolejności, ~4-5 luk każdy.
3. **M03** — wielki moduł, na końcu (zmiany w hub mogą dotknąć M05-M08).

---

## M05 — IDEAS ZARZĄDZANIE

**Teczka:** `Harvard/wdrozenie-100/M05-ideas-zarzadzanie.md`

**Już naprawione (nie ruszaj):**
- L-03 (`ab0eb2fb0c`): `globalIdeaVersions` registry — zamknięta
- L-04 (`ab0eb2fb0c`): unmount draft persist do localStorage — zamknięta
- L-08 S2/S3/S6/S5: contract testy — zamknięte

**Pozostała praca:**
- **L-06 (P2):** `IdeaTemplateGallery.tsx` funkcja `handleApply` (~line 1965) nie pyta o potwierdzenie gdy canvas ma już nodes. Dodaj dialog confirm „Zastąpić istniejące elementy?" przed nadpisaniem.

**Ścieżki:**
```
src/components/MyWork/canvas/IdeaTemplateGallery.tsx
src/components/MyWork/canvas/__tests__/
```

---

## M06 — IDEAS MIND MAP

**Teczka:** `Harvard/wdrozenie-100/M06-ideas-mind-map.md`

**Kontekst:** Mind Map używa `useIdeaMapSync` (już naprawiony przez L-03/L-04). Poprzednie naprawy: V8 mirror wycięty.

**Twoje zadanie:**
1. Przeczytaj teczkę `M06-ideas-mind-map.md` — sekcja §03
2. Dla każdej OTWARTEJ luki: napraw → test → commit
3. Sprawdź czy Mind Map poprawnie używa `primeServerVersion()` przy mountowaniu

**Ścieżki:**
```
src/components/MyWork/canvas/IdeaMindMap/
src/components/MyWork/canvas/IdeaMindMapWorkspace.tsx (lub podobny)
```

---

## M07 — IDEAS PROCESS FLOW

**Teczka:** `Harvard/wdrozenie-100/M07-ideas-process-flow.md`

**Kontekst:** Process Flow dzieli warstwę sync z Mind Map. Poprzednie naprawy: komponent V8 mirror usunięty.

**Twoje zadanie:**
1. Przeczytaj teczkę `M07-ideas-process-flow.md` — sekcja §03
2. Zamknij wszystkie OTWARTE luki
3. Weryfikacja: Process Flow nie powinien mieć osobnego stanu wersji poza `useIdeaMapSync`

**Ścieżki:**
```
src/components/MyWork/canvas/IdeaProcessFlow/
```

---

## M08 — IDEAS TABLE

**Teczka:** `Harvard/wdrozenie-100/M08-ideas-table.md`

**Kontekst:** Ideas Table (nie mylić z M20 Tabele Studio) to narzędzie w przestrzeni Ideas. Używa tej samej warstwy sync.

**Twoje zadanie:**
1. Przeczytaj teczkę `M08-ideas-table.md` — sekcja §03
2. Zamknij wszystkie OTWARTE luki

**Ścieżki:**
```
src/components/MyWork/canvas/IdeaTable/
```

---

## M03 — MOJA PRACA (ORGANIZER)

**Teczka:** `Harvard/wdrozenie-100/M03-my-work-organizer.md`

**Kluczowe konteksty:**
- Hub dla wszystkich narzędzi Ideas (M05-M09) + innych modułów My Work
- L-06 zamknięta `2026-06-16` — fix `$$typeof` w `RelationChip`
- Naprawione: `b9f2dee9d2`, `45d74b0de1` (IDOR), `f35aa8d7c8`, `d05382fb44` (15 dead components), `7ab1b8aace`
- Duże ryzyko: `MYWORK_IDEAS` beta closed — sprawdź czy `MyWorkHub.tsx:604` poprawnie obsługuje `BETA_ADMINS_EXEMPT=false`
- L-01 (data leak): zweryfikuj że `requireRole` jest wpięte (member→403)
- Dev `.env` → Railway PROD DB — uważaj na query

**Twoje zadanie:**
1. Przeczytaj teczkę `M03-my-work-organizer.md` — sekcja §03
2. Zacznij od P0/P1: IDOR weryfikacja + beta-gating
3. Dla każdej OTWARTEJ luki: napraw → test → commit
4. Nie ruszaj sekcji hub dotyczących M09 (Whiteboard zablokowany)

**Ścieżki (tylko te):**
```
src/components/MyWork/
src/views/my-work/
server/src/routes/my-work.routes.ts    ← WYŁĄCZNIE Harvard 2
server/src/services/myWork*/
```

---

## ZABRONIONE ŚCIEŻKI

```
src/components/Chat/                   ← Harvard 1
src/components/Canvas/                 ← Harvard 1
src/components/Interview/              ← Harvard 3
src/components/Initiatives/            ← Harvard 3
src/components/Notebook/               ← Harvard 4
src/components/Execution/              ← Harvard 4
src/components/MyWork/canvas/IdeaWhiteboard/  ← ZABLOKOWANY (M09)
server/src/routes/table-platform.routes.ts    ← Harvard 5
public/locales/*/                      ← ZAKAZANE
```

---

## PROTOKÓŁ GIT

```bash
git add src/components/MyWork/canvas/IdeaTemplateGallery.tsx
# Nowe testy:
git add -f tests/integration/mywork/some.test.ts
git commit -m "fix(M05/L-06): confirm before template overwrite"
```

Nigdy `git add -A`. `git fetch origin Londyn` przed każdym commitem.

---

## DEFINICJA DONE

- [ ] M05: L-06 zamknięta (confirm dialog w IdeaTemplateGallery)
- [ ] M06, M07, M08: wszystkie OTWARTE luki zamknięte lub FALSE POSITIVE
- [ ] M03: wszystkie OTWARTE luki zamknięte lub FALSE POSITIVE
- [ ] Teczki zaktualizowane z SHA commitów
- [ ] Brak nowych błędów TypeScript
- [ ] Testy per zamknięta luka
