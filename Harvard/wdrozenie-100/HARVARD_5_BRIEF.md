# HARVARD 5 — Platform & Outputs
**Cluster:** Platform & Outputs | **Fala:** 1 | **Data:** 2026-06-17

---

## TOŻSAMOŚĆ

Jesteś Harvard 5. Twój scope to warstwa outputs i content creation: **M17 Outputs Library**, **M18 Dokumenty Studio**, **M19 Prezentacje**, **M20 Tabele Studio**, **M21 Meeting**. Masz największą liczbę otwartych luk w Fali 1 (~37), ale M19/M20/M21 to moduły małe — zacznij od nich.

---

## MODUŁY I TECZKI

| Nr | Tytuł | Teczka | Typ | Otwarte luki |
|----|-------|--------|-----|-------------|
| M17 | Outputs Library | `M17-outputs.md` | WIELKI | ~10 |
| M18 | Dokumenty Studio | `M18-dokumenty.md` | WIELKI | ~10 |
| M19 | Prezentacje | `M19-prezentacje.md` | MAŁY | ~6 |
| M20 | Tabele Studio | `M20-tabele-studio.md` | MAŁY | ~5 |
| M21 | Meeting | `M21-meeting.md` | MAŁY | ~6 |

---

## KOLEJNOŚĆ PRACY

**Zasada: małe najpierw, wielkie na końcu.**

1. **M20** — 5 luk, wiele już zrobionych (IDOR, webhook). Sprawdź co realnie zostało.
2. **M21** — 6 luk. Uwaga: handoff wspólny z M04 (Harvard 4) — koordynuj żeby nie rozjechać.
3. **M19** — 6 luk. L-02 (beta-lock route) i L-11 już naprawione.
4. **M18** — 10 luk, ale L-01 (6/8 warstw trwałych) już naprawiona (`953955bc2b`). Cold-start proof na staging to następny krok.
5. **M17** — 10 luk, na końcu (zależny od M18 jako baza deliverables).

---

## M20 — TABELE STUDIO

**Teczka:** `Harvard/wdrozenie-100/M20-tabele-studio.md`

**Już naprawione:** IDOR (`a8f0e5dd0f`), webhook, share_password weryfikacja (była false positive). `TabeleView` 503/404 degradation banners.

**Pozostałe:**
- L-07 (P0-test): realny test `tp_records` endpoint — wymaga caboose (staging DB). Jeśli caboose niedostępny, napisz mock-based contract test
- L-03 (minor): share_password plaintext storage — decyzja Piotra czy bcrypt. Opisz w teczce, czekaj na odpowiedź

**Ścieżki:**
```
src/components/TablePlatform/
server/src/routes/table-platform.routes.ts   ← WYŁĄCZNIE Harvard 5
server/src/services/tablePlatform*/
```

---

## M21 — MEETING

**Teczka:** `Harvard/wdrozenie-100/M21-meeting.md`

**Uwaga:** Handoff Meeting jest wspólny z M04 Notatnik (Harvard 4). Sprawdź co Harvard 4 naprawił w M04 dotyczącym handoff (`notebookHandoffService.ts`) zanim zaczniesz M21 — nie rozjechaj tych napraw.

**Twoje zadanie:**
1. Przeczytaj teczkę `M21-meeting.md` — sekcja §03
2. Sprawdź git log `notebookHandoffService.ts` — co zrobił Harvard 4
3. Zamknij pozostałe 6 luk

**Ścieżki:**
```
src/components/Meeting/
server/src/routes/meeting.routes.ts
server/src/services/meeting*/
```

---

## M19 — PREZENTACJE

**Teczka:** `Harvard/wdrozenie-100/M19-prezentacje.md`

**Już naprawione:**
- L-02 (beta-lock route): `<BetaGate moduleId="MODULE_PRESENTATIONS">` owija `/presentations` w `AppRoutes.tsx:1989` — zamknięta `2026-06-17`
- L-11 (public viewer over-disclosure): naprawiona `1b67579d7a`

**Kluczowe konteksty:**
- `ENABLE_V8_GLOBAL` OFF→404 — moduł nie żyje bez tej flagi (sprawdź wartość na staging/prod)
- Krok 1 (bramka aprobaty) WYMAGA trwałego publish M18 → kolejność MASTER §5
- 25 stale testów middleware = dług decyzyjny (D-01)
- `ENABLE_DELIVERABLES_LIGHT`+`VITE_` dla Teresa→Outputs

**Twoje zadanie:**
1. Przeczytaj teczkę `M19-prezentacje.md` — sekcja §03
2. Zamknij pozostałe ~6 luk
3. Sprawdź `ENABLE_V8_GLOBAL` na staging — jeśli OFF, udokumentuj bloker

**Ścieżki:**
```
src/components/Presentations/
server/src/routes/presentations.routes.ts
```

---

## M18 — DOKUMENTY STUDIO

**Teczka:** `Harvard/wdrozenie-100/M18-dokumenty.md`

**Kluczowe konteksty:**
- L-01 NAPRAWIONA (`953955bc2b`+`8d2b5d8cf4` `2026-06-13`): 6/8 warstw in-memory → Postgres (10 tabel przez mig.780+781)
- **Cold-start proof na staging = następny krok** — bez tego L-01 nie jest oficjalnie zamknięta (R6)
- L-06 CZĘŚCIOWO: beta-lock naprawiony (`<BetaGate moduleId="MODULE_DOCUMENT_STUDIO">` `AppRoutes.tsx:2105` `2026-06-17`); brak rate-limit/revoke + over-disclosure `organizationId` = sub-luki do zamknięcia
- 889 zielonych testów MASKUJE problem — mockują DAO, nie wykryją in-memory
- Duplikat mig.776 (D-03) — sprawdź i rozstrzygnij
- Dev `.env` → Railway PROD DB — ostrożność z migrациями

**Twoje zadanie:**
1. Przeczytaj teczkę `M18-dokumenty.md` — sekcja §03
2. **Priorytet #1:** cold-start proof na staging — uruchom deploy i sprawdź trwałość 6/8 warstw po restarcie
3. Zamknij L-06 sub-luki (rate-limit share, over-disclosure)
4. Rozstrzygnij D-03 (duplikat mig.776)
5. Zamknij pozostałe OTWARTE luki

**Ścieżki:**
```
src/components/Documents/
server/src/routes/documents.routes.ts
server/src/services/documentStudio*/
server/src/db/migrations/          ← ostrożnie (tylko własne migracje)
```

---

## M17 — OUTPUTS LIBRARY

**Teczka:** `Harvard/wdrozenie-100/M17-outputs.md`

**Kontekst:** Hub deliverables. Zależy od M18 (dokumenty) i M19 (prezentacje) jako dostawców treści. Zrób M18/M19 przed M17.

**Twoje zadanie:**
1. Przeczytaj teczkę `M17-outputs.md` — sekcja §03
2. Sprawdź zależności od M18/M19 (czy są naprawione)
3. Zamknij wszystkie OTWARTE luki

**Ścieżki:**
```
src/components/Outputs/
server/src/routes/outputs.routes.ts
server/src/services/outputs*/
```

---

## ZABRONIONE ŚCIEŻKI

```
src/components/Chat/               ← Harvard 1
src/components/Canvas/             ← Harvard 1
src/components/MyWork/             ← Harvard 2
server/src/routes/my-work.routes.ts ← Harvard 2
src/components/Interview/          ← Harvard 3
src/components/Initiatives/        ← Harvard 3
src/components/Notebook/           ← Harvard 4
src/components/Execution/          ← Harvard 4
public/locales/*/                  ← ZAKAZANE
server/src/middleware/             ← WSPÓLNE (nie edytuj)
```

---

## PROTOKÓŁ GIT

```bash
git add src/components/TablePlatform/SomeFile.tsx
git add server/src/routes/table-platform.routes.ts
git add -f tests/integration/table-platform/some.test.ts
git commit -m "fix(M20/L-xx): opis naprawy"
```

Nigdy `git add -A`. `git fetch origin Londyn` przed każdym commitem.

---

## DEFINICJA DONE

- [ ] M20: L-07 (test tp_records) zamknięta; L-03 udokumentowana (decyzja Piotra)
- [ ] M21: wszystkie OTWARTE luki zamknięte lub FALSE POSITIVE
- [ ] M19: wszystkie OTWARTE luki zamknięte; ENABLE_V8_GLOBAL status znany
- [ ] M18: cold-start proof na staging; L-06 sub-luki zamknięte; D-03 rozstrzygnięty
- [ ] M17: wszystkie OTWARTE luki zamknięte lub FALSE POSITIVE
- [ ] Teczki zaktualizowane z SHA commitów
- [ ] Brak nowych błędów TypeScript
