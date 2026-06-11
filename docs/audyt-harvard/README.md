# AUDYT HARVARD — dokończenie aplikacji Consultify

**Projekt:** systematyczny audyt wszystkich 27 modułów + wdrożenie planów dokończenia. Cel: **aplikacja dokończona w 3 dni robocze**.
**Nazwa:** zespół pracuje z Harvardu (2026-06-11) — stąd „Audyt Harvard".
**Tryb pracy:** ten katalog jest SAMODZIELNY i przenośny przez GitHuba — drugi komputer po `git pull` + wklejeniu `BOOTSTRAP_PROMPT.md` do Claude'a ma 100% kontekstu. Pamięć lokalna Claude'a NIE podróżuje przez git — jej snapshot jest w `KONTEKST.md`.

## Mapa katalogu

```
docs/audyt-harvard/
├── README.md            ← ta instrukcja
├── BOOTSTRAP_PROMPT.md  ← prompt startowy dla Claude'a na nowym komputerze
├── KONTEKST.md          ← snapshot pamięci projektowej (findingi, naprawione, pułapki infra)
├── PLAN_3_DNI.md        ← harmonogram dokończenia
├── _TRACKER.md          ← SSOT statusu 27 modułów (aktualizować po KAŻDYM audycie i wdrożeniu)
└── modules/
    ├── M01-czat/
    │   ├── KARTA_AUDYTU.md   ← prefabrykat wg szablonu Protokołu V1 (wypełnić)
    │   ├── WDROZENIE_LOG.md  ← log realizacji planu dokończenia (commit po commicie)
    │   └── evidence/         ← screenshoty, logi testów, wyniki curl
    ├── M02-canvas/ … M27-superadmin/, A1-affiliate/   (identyczna struktura ×28)
```

## Dokumenty źródłowe (w tym samym repo — NIE duplikować, linkować)

| Co | Gdzie |
|---|---|
| **Protokół audytu (8 faz, rubryka /100, hard caps, DoD)** | `docs/audit/MODULE_AUDIT_PROTOCOL_V1.md` |
| Szablon karty (już skopiowany do każdego modułu) | `docs/audit/templates/MODULE_AUDIT_CARD_TEMPLATE.md` |
| Podział na moduły + charakterystyki | `docs/audit/2026-06-11/_MODULE_MAP_V2.md` |
| Inwentarze funkcjonalności (INV_A…G) | `docs/audit/2026-06-11/inventory/` |
| Karty Ideas (M05–M09, fazy 0–2 zrobione) | `docs/audit/2026-06-11/ideas/` |
| Kanon tabel (§27 checklist A–S) | `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md` |
| Formuła kart treści | `docs/standards/CARD_CONTENT_FORMULA.md` |
| Formuła inicjatyw | `docs/initiatives/INITIATIVE_FORMULA.md` |

## Instrukcja działania — JEDEN MODUŁ (pętla powtarzana ×27)

1. **Otwórz** `modules/<Mxx>/KARTA_AUDYTU.md` + wpis modułu w `_MODULE_MAP_V2.md` + jego inwentarz INV_*.
2. **FAZA 0 (Claude):** wypełnij sekcję 0 karty — checklist pozycji + 3–7 scenariuszy krytycznych + obowiązujące kanony.
3. **FAZY 1, 2, 5+6 (3 subagenty RÓWNOLEGLE):** KOD → sekcje 1a–1f; TESTY → sekcja 2 (testy URUCHOMIONE, nie cytowane); KANON+SEC → sekcje 5–6. Prompty agentów: przekaż im fragment protokołu z opisem ich fazy + wpis modułu + inwentarz.
4. **FAZA 3 (Claude):** Railway — commit/migracje/flagi/smoke/logi → sekcja 3. Dowody do `evidence/f3_*`.
5. **FAZA 4 (Claude OSOBIŚCIE, przeglądarka):** skrypt z protokołu — happy path E2E z reloadem, wszystkie przyciski, stany, i18n, role, konsola/sieć. Screenshoty `evidence/f4_*`. **Bez Fazy 4 ocena max 70 + status NIEPEŁNY.**
6. **FAZA 7 (Claude):** rubryka /100 + hard caps → nagłówek karty.
7. **FAZA 8 (Claude):** plan dokończenia (3 fale, każda pozycja: co/dlaczego/jak zweryfikować) + DoD → sekcja 7 karty.
8. **Aktualizuj `_TRACKER.md`** (status, ocena, tier, data).
9. **WDROŻENIE:** realizuj plan falami; każdy commit wpisuj do `WDROZENIE_LOG.md`; po Fali odhaczaj DoD w karcie; po komplecie DoD → re-audyt Faz 2–6 → nowa ocena w karcie i trackerze.

## Twarde zasady (z Protokołu — skrót)

- **Prawda kodu, nie dokumentacji** — każde twierdzenie z dowodem `plik:linia`.
- **Verify before claiming** (reguła właścicielska) — „działa" = uruchomiony test LUB screenshot z żywej aplikacji. `tsc` to nie dowód.
- **Nie powielać naprawionych findingów** — lista w `KONTEKST.md` §3.
- **Dowody składowane** w `evidence/` — karta linkuje, nie opowiada.
- **Commity wdrożeniowe** per moduł, małe, z prefiksem `fix(Mxx)/feat(Mxx)`; docs audytowe commitować na bieżąco (drugi komputer/właściciel widzi postęp przez GitHuba).
- **Ostrożność z DB:** dev backend bywa wpięty w PROD DB (`DATABASE_URL`) — przed jakimkolwiek zapisem sprawdź, na którą bazę patrzysz.

## Definition of Done modułu (komplet = moduł „dokończony")

1. ✅ Testy auto FE+BE scenariuszy krytycznych — zielone, w CI
2. ✅ Żywa weryfikacja Claude'a (pełny skrypt Fazy 4) z dowodami
3. ✅ Railway: migracje zastosowane, flagi ustawione, smoke 200, czyste logi
4. ✅ Kanony graficzne bez odstępstw P0/P1
5. ✅ Zero WIDOCZNE-ALE-ZEPSUTE
6. ✅ Zero cichych degradacji bez komunikatu
