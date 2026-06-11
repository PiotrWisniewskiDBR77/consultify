# AUDYT HARVARD — dokończenie aplikacji Consultify

**Projekt:** systematyczny audyt wszystkich 27 modułów + wdrożenie planów dokończenia. Cel: **aplikacja dokończona w 3 dni robocze**.
**Nazwa:** zespół pracuje z Harvardu (2026-06-11) — stąd „Audyt Harvard".
**Tryb pracy:** ten katalog jest SAMODZIELNY i przenośny przez GitHuba — drugi komputer po `git pull` + wklejeniu `BOOTSTRAP_PROMPT.md` do Claude'a ma 100% kontekstu. Pamięć lokalna Claude'a NIE podróżuje przez git — jej snapshot jest w `KONTEKST.md`.

## Mapa katalogu

```
Harvard/
├── README.md            ← ta instrukcja
├── SEKWENCJA.md         ← GŁÓWNY PLAN: 8 kroków z bramkami (decyzja właścicielska) — czytaj PRZED pracą
├── BOOTSTRAP_PROMPT.md  ← prompt startowy dla Claude'a na nowym komputerze
├── KONTEKST.md          ← snapshot pamięci projektowej (findingi, naprawione, pułapki infra)
├── PLAN_3_DNI.md        ← mapowanie sekwencji na dni
├── INTEGRACJE.md        ← mapa połączeń międzymodułowych (szkielet — wypełniany w Kroku 6)
├── _TRACKER.md          ← SSOT statusu 27 modułów (aktualizować po KAŻDYM audycie i wdrożeniu)
├── protokol/
│   ├── MODULE_AUDIT_PROTOCOL_V1.md      ← protokół audytu: 8 faz, rubryka /100, hard caps, DoD
│   └── MODULE_AUDIT_CARD_TEMPLATE.md    ← szablon karty (kopie już rozłożone w modules/)
├── podzial/
│   ├── _MODULE_MAP_V2.md                ← podział na 27 modułów + charakterystyki
│   ├── inventory/INV_A…G.md             ← inwentarze funkcjonalności (~250 pozycji ze statusami)
│   └── ideas/                           ← 5 gotowych kart Ideas (M05–M09, fazy 0–2)
└── modules/
    ├── M01-czat/
    │   ├── KARTA_AUDYTU.md   ← prefabrykat wg szablonu Protokołu V1 (wypełnić)
    │   ├── WDROZENIE_LOG.md  ← log realizacji planu dokończenia (commit po commicie)
    │   └── evidence/         ← screenshoty, logi testów, wyniki curl
    ├── M02-canvas/ … M27-superadmin/, A1-affiliate/   (identyczna struktura ×28)
```

## Dokumenty źródłowe

| Co | Gdzie |
|---|---|
| **Protokół audytu (8 faz, rubryka /100, hard caps, DoD)** | `Harvard/protokol/MODULE_AUDIT_PROTOCOL_V1.md` |
| Szablon karty (już skopiowany do każdego modułu) | `Harvard/protokol/MODULE_AUDIT_CARD_TEMPLATE.md` |
| Podział na moduły + charakterystyki | `Harvard/podzial/_MODULE_MAP_V2.md` |
| Inwentarze funkcjonalności (INV_A…G) | `Harvard/podzial/inventory/` |
| Karty Ideas (M05–M09, fazy 0–2 zrobione) | `Harvard/podzial/ideas/` |
| Kanon tabel (§27 checklist A–S) | `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md` |
| Formuła kart treści | `docs/standards/CARD_CONTENT_FORMULA.md` |
| Formuła inicjatyw | `docs/initiatives/INITIATIVE_FORMULA.md` |

## Kolejność prac: SEKWENCJA 8 KROKÓW (SSOT: `SEKWENCJA.md`)

Pracujemy KROKAMI z bramkami, nie przeplatamy audytów z naprawami: **(4) najpierw WSZYSTKIE audyty** (pełna widoczność) → **(5) wszystkie plany dokończenia** → **(6) przegląd połączeń międzymodułowych** (INTEGRACJE.md) → **(7) budowa moduł po module + zatwierdzenia** → **(8) system testów całości**. Jedyny wyjątek w kroku 4: quick-fix ≤5 linijek bez ryzyka (z wpisem do logu). Szczegóły i bramki: `SEKWENCJA.md`.

## Instrukcja działania — JEDEN MODUŁ w Kroku 4 (pętla powtarzana ×28)

1. **Otwórz** `modules/<Mxx>/KARTA_AUDYTU.md` + wpis modułu w `_MODULE_MAP_V2.md` + jego inwentarz INV_*.
2. **FAZA 0 (Claude):** wypełnij sekcję 0 karty — checklist pozycji + 3–7 scenariuszy krytycznych + obowiązujące kanony.
3. **FAZY 1, 2, 5+6 (3 subagenty RÓWNOLEGLE):** KOD → sekcje 1a–1f; TESTY → sekcja 2 (testy URUCHOMIONE, nie cytowane); KANON+SEC → sekcje 5–6. Prompty agentów: przekaż im fragment protokołu z opisem ich fazy + wpis modułu + inwentarz.
4. **FAZA 3 (Claude):** Railway — commit/migracje/flagi/smoke/logi → sekcja 3. Dowody do `evidence/f3_*`.
5. **FAZA 4 (Claude OSOBIŚCIE, przeglądarka):** skrypt z protokołu — happy path E2E z reloadem, wszystkie przyciski, stany, i18n, role, konsola/sieć. Screenshoty `evidence/f4_*`. **Bez Fazy 4 ocena max 70 + status NIEPEŁNY.**
6. **FAZA 7 (Claude):** rubryka /100 + hard caps → nagłówek karty. Pamiętaj o sekcji **1g (połączenia międzymodułowe)** — to paliwo Kroku 6.
7. **Aktualizuj `_TRACKER.md`** (status, ocena, tier, data) + commit/push → następny moduł.
8. **FAZA 8 (plan dokończenia)** robiona jest ZBIORCZO w Kroku 5 sekwencji (po komplecie audytów), uzupełniana w Kroku 6 o `[INTEGRACJA]`.
9. **WDROŻENIE = Krok 7 sekwencji:** realizuj plan falami; każdy commit do `WDROZENIE_LOG.md`; po komplecie DoD → re-audyt Faz 2–6 → nowa ocena w karcie i trackerze.

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
