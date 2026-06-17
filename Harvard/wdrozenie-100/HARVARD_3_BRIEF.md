# HARVARD 3 — Research Chain
**Cluster:** Research Chain | **Fala:** 1 | **Data:** 2026-06-17

---

## TOŻSAMOŚĆ

Jesteś Harvard 3. Twój scope to trójca modułów badawczych: **M10 Wywiad (Interview)**, **M12 Audyty**, **M13 Inicjatywy**. To jest naturalna sekwencja produktu: wywiad → wnioski → inicjatywy.

M10 jest CZĘŚCIOWO ZABLOKOWANY (PROD P0: STT key czeka na Piotra) — pracujesz nad pozostałymi 6 lukami, PROD P0 pomijasz.

---

## MODUŁY I TECZKI

| Nr | Tytuł | Teczka | Typ | Otwarte luki |
|----|-------|--------|-----|-------------|
| M10 | Wywiad (Interview) | `M10-wywiad.md` | WIELKI | ~7 (1 PROD P0 blocked) |
| M12 | Audyty | `M12-audyty.md` | MAŁY | ~6 |
| M13 | Inicjatywy | `M13-inicjatywy.md` | WIELKI | ~9 |

---

## KOLEJNOŚĆ PRACY

1. **M12** najpierw — najmniejszy, niezależny, szybka wygrana (6 luk)
2. **M13** — 9 otwartych luk; L-01/L-02/L-05/L-06/L-08 już zamknięte/naprawione, sprawdź L-03/L-04/L-07/L-09+
3. **M10** — na końcu, pomiń PROD P0 (STT key), zamknij pozostałe luki

---

## M12 — AUDYTY

**Teczka:** `Harvard/wdrozenie-100/M12-audyty.md`

**Kontekst:** Poprzednie naprawy: §27 (per-table audit checklist) + L-09 zamknięte. Pozostałe ~6 luk.

**Twoje zadanie:**
1. Przeczytaj teczkę `M12-audyty.md` — sekcja §03 Rejestr luk
2. Dla każdej OTWARTEJ: napraw → test → commit → zaktualizuj teczkę
3. Sprawdź czy `AuditOrchestratorWizard` 4-step poprawnie przechodzi przez wszystkie kroki

**Ścieżki:**
```
src/components/Audit/
server/src/routes/audits.routes.ts
server/src/services/audit*/
tests/components/Audit/            ← sprawdź co już jest
src/components/Audit/__tests__/
```

---

## M13 — INICJATYWY

**Teczka:** `Harvard/wdrozenie-100/M13-inicjatywy.md`

**Kluczowe konteksty:**
- Już zamknięte: L-01 (locked CTA, `2026-06-16`), L-02 (bulk stub OFF), L-05 (V8 baner), L-06 (server write guard), L-08 (CTA Otwórz `18ed3e44f7`)
- Pozostałe luki: sprawdź §03 teczki — powinny być L-03, L-04, L-07, L-09 i dalsze
- **SSOT statusów** (~15 dokumentów) może być rozjechany z `stageGateService.ts` → **najpierw porównaj docs↔kod** przed naprawą L dotyczących statusów
- Governance IDOR (`b9f2dee9d2`) wymaga testu cross-org — napisz test
- Dev `.env` → Railway PROD DB — ostrożność z testami mutacyjnymi

**Twoje zadanie:**
1. Przeczytaj teczkę `M13-inicjatywy.md` — sekcja §03
2. Pogódź SSOT statusów (`stageGateService.ts`) z dokumentacją
3. Zamknij pozostałe OTWARTE luki
4. Test cross-org dla IDOR guard

**Ścieżki:**
```
src/components/Initiatives/
server/src/routes/initiatives.routes.ts
server/src/services/stageGateService.ts
server/src/services/initiative*/
```

---

## M10 — WYWIAD (INTERVIEW)

**Teczka:** `Harvard/wdrozenie-100/M10-wywiad.md`

**UWAGA: PROD P0 ZABLOKOWANY**

Luka STT (Voice Answer nie zapisuje się na PROD) wymaga `OPENAI_API_KEY` na Railway centerbeam. **NIE dotykaj tej luki** — czeka na osobną zgodę Piotra.

**Naprawione wcześniej:** FE interim-flush fix dla STT (na Londyn); `InsightViewer` guard dla `material_quality_json`.

**Twoje zadanie (pozostałe ~6 luk):**
1. Przeczytaj teczkę `M10-wywiad.md` — sekcja §03
2. Zamknij wszystkie OTWARTE luki **OPRÓCZ** PROD P0 (STT key)
3. Dla PROD P0: zostaw status OTWARTA z notatką „czeka na OPENAI_API_KEY Railway prod — zgoda Piotra wymagana"
4. Zweryfikuj `InsightViewer` guard w kodzie i zamknij jeśli naprawiony

**Ścieżki:**
```
src/components/Interview/
server/src/routes/interview.routes.ts
server/src/services/interview*/
```

---

## ZABRONIONE ŚCIEŻKI

```
src/components/Chat/               ← Harvard 1
src/components/Canvas/             ← Harvard 1
src/components/MyWork/             ← Harvard 2
server/src/routes/my-work.routes.ts ← Harvard 2
src/components/Notebook/           ← Harvard 4
src/components/Execution/          ← Harvard 4
src/components/Outputs/            ← Harvard 5
server/src/routes/table-platform.routes.ts ← Harvard 5
public/locales/*/                  ← ZAKAZANE
server/src/middleware/             ← WSPÓLNE (nie edytuj)
```

---

## PROTOKÓŁ GIT

```bash
git add src/components/Audit/SomeFile.tsx
git add server/src/routes/audits.routes.ts
git add -f tests/integration/audit/some.test.ts
git commit -m "fix(M12/L-xx): opis naprawy"
```

Nigdy `git add -A`. `git fetch origin Londyn` przed każdym commitem.

---

## DEFINICJA DONE

- [ ] M12: wszystkie OTWARTE luki zamknięte lub FALSE POSITIVE
- [ ] M13: SSOT statusów pogodzony z kodem; wszystkie OTWARTE luki zamknięte
- [ ] M10: luki bez PROD P0 zamknięte; PROD P0 pozostaje OTWARTA z adnotacją
- [ ] Teczki zaktualizowane z SHA commitów
- [ ] Brak nowych błędów TypeScript
- [ ] Testy cross-org dla IDOR w M13
