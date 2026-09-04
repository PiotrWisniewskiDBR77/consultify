# 16. Portal partnerski — audyt stanu na 2026-09-05 rano

Staging: `b852ade6` (wdrożony 04.09 23:33, 30 przełączników włączonych). Lokalnie: `http://localhost:3000` (ten sam kod, ten sam backend stagingu).

## Diagnoza w trzech zdaniach

12 ekranów przyjętych na MVP 02.09 z jednym warunkiem: czerwone tła. Zrzuty PO poprawie kolorów są w evidence/grafika/16-partner-kolory — do Twojego potwierdzenia jutro. Sześć znalezisk poza warunkiem w backlogu (brak podglądu w wierszach, € obok PLN, angielskie napisy).

## Przełączniki, które decydują o tym, co widzisz

| Co | Zmienna | Stan na stagingu |
|---|---|---|
| — | `—` | portal bez flag, bramkowany tylko logowaniem (/partner/*) |

## A. Zatwierdzone obrazy — 12 ekranów portalu (odbiór w rozmowie 02.09, poza rejestrem status.json)

Ocena: A = do odbioru, B = do odbioru z wyjątkami, C = nie pokazujemy, D = odłożone. Decyzja: Twoje kliknięcie. Uwaga: Twoje słowa, dosłownie.

| Ekran | Nazwa | Ocena | Decyzja | Twoja uwaga | Obraz |
|---|---|---|---|---|---|
| 12 ekranów portalu | Pulpit, Moje linki i kody, Zarobki, Kampanie, Klienci, Dokumentacja i inne | — | przyjęte na MVP z warunkiem (rozmowa 02.09) | „Poza tym czerwonym tłem w jasnym tle to nie mam jakoś wiele uwag.” | `evidence/grafika/16-partner/` (PRZED), `evidence/grafika/16-partner-kolory/` (PO) |

## B. Gdzie układ na stagingu może NIE być tym, co zatwierdziłeś — i dlaczego

Brak zapisanych rozjazdów dla tego modułu w audycie przewodów i audycie przyrządu. Porównanie z obrazem zrobimy jutro na żywo.

## C. Funkcje i przejścia, które nie działają albo nie były sprawdzone

### C1. Twoje uwagi z korpusu 103 — 0 w tym module (0 realnych defektów)

Brak uwag w korpusie dla tego modułu.

### C3. Bramki odbioru modułu, które NIE są PASS (MODULE_ACCEPTANCE)

```
G15 |`NOT_MEASURED / RED_LEGACY_2_CONFIRMED`| Odbiór adwersaryjny 03.09 (`ODBIOR_DYZUROW_286_290_291_20260903.md` §1.5, koryguje raport dyżuru 286 — baza `f65c4ff6a0` miała nierozstrzygnięty marker konfliktu w `PreviewAIHintStrip.tsx:110`, więc pliki testowe dotykaj�
   G16 |`TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING`| 2026-09-03 (nadzorca, marker `117bc9f743`): pakiet przed/po tego modułu = `evidence/grafika/a11y-fix-16_PARTNER-20260903.md`, `evidence/grafika/i18n-pl-en-20260903.md`, `evidence/grafika/przewody-odbioru-20260903.md`, `evidence/
   G19 |`NOT_PROVEN / OWNER_RETEST_PENDING`| Pomiar na markerze zamrożonym `fee24bddb0` (odbiór dyżuru 290 potwierdził niezależnie na własnej bazie — `ODBIOR_DYZUROW_286_290_291_20260903.md` §2). Kotwica: SHA odbioru modułu z wiersza `G18` = `075735c395` (02.09 19
   G20 |`ENTRY_GATE_MEASURED / BLOCKED_BY_G19_AND_11_P0P1`| Oceniono 7/7 warunków na bazie `2a7273e087`; 0/7 formalnie odhaczone; G19 = `NOT_PROVEN / OWNER_RETEST_PENDING`; P0/P1 = 11 `BLOKUJE` przy mianowniku 121; dowód `evidence/g20/day359/r4-16_PARTNER.md`.
```

## D. Jutro — kolejność przejścia i czego nie zgłaszać (pakiet przelotu)

**Kroki**: otwórz Portal partnerski → otwórz realnego partnera/umowę z listy → sprawdź podgląd →
z kebaba wybierz jedną akcję.

**Co się zmieniło od 22–23.08**: dostępność doprowadzona do zera błędów (12/12 na jednym z
kryteriów); ten moduł przyjąłeś już w całości 02.09 wraz z warunkiem kolorystycznym — dzisiejszy
przelot to potwierdzenie na żywym stagingu.

**Czego NIE zgłaszaj**: —

**Pytania (TAK/NIE)**:
- Podgląd realnego partnera/umowy otwiera się poprawnie?

---

## Źródła

`docs/program/grafika/status.json`, `ODBIOR_DECYZJE.json`, `odbior.sqlite` (poprawki), `KORPUS_UWAG_20260902.md`, `AUDYT_PRZYRZADU_20260901.md`, `waves/WAVE_03_ACCEPTANCE/AUDYT_PRZEWODOW_ODBIORU_20260903.md`, `modules/16_PARTNER/MODULE_ACCEPTANCE.md`, `PRZELOT_WLASCICIELA_STAGING_20260904.md`, `FALA_2_PO_STAGINGU.md`, pomiar pakietu stagingu 04.09 23:35.
