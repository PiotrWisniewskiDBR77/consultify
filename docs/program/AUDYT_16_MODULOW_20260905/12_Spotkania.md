# 12. Spotkania — audyt stanu na 2026-09-05 rano

Staging: `b852ade6` (wdrożony 04.09 23:33, 30 przełączników włączonych). Lokalnie: `http://localhost:3000` (ten sam kod, ten sam backend stagingu).

## Diagnoza w trzech zdaniach

3 ekrany A, 1 realny defekt. Nazwy integracji spolszczone 02.09. Moduł bez flag.

## Przełączniki, które decydują o tym, co widzisz

| Co | Zmienna | Stan na stagingu |
|---|---|---|
| — | `—` | moduł bez flag; nazwy integracji spolszczone 02.09 (poprawki 164–165) |

## A. Zatwierdzone obrazy — 3 ekranów (Twoje decyzje z 30.08–02.09)

Ocena: A = do odbioru, B = do odbioru z wyjątkami, C = nie pokazujemy, D = odłożone. Decyzja: Twoje kliknięcie. Uwaga: Twoje słowa, dosłownie.

| Ekran | Nazwa | Ocena | Decyzja | Twoja uwaga | Obraz |
|---|---|---|---|---|---|
| `calendar-sync-settings` | Synchronizacja kalendarza | A | ok | Dodaj tutaj Outlooka i zmień to jabłuszko na jakieś normalne, a nie takie jabłko. | `evidence/grafika/grafika-14-ekranow/calendar-sync-settings__PRZED__light.png` |
| `meetings-module` | Spotkania | A | ok |  | `evidence/grafika/grafika-14-ekranow/meetings-module__PRZED__light.png` |
| `public-booking-widget` | Publiczna rezerwacja spotkania | A | ok |  | `evidence/grafika/grafika-14-ekranow/public-booking-widget__PRZED__light.png` |

## B. Gdzie układ na stagingu może NIE być tym, co zatwierdziłeś — i dlaczego

### B2. Przyrząd pokazał kompozycję, której w produkcie nie ma (audyt przyrządu 01.09)

| Ekran | Kategoria | Co dokładał / zmieniał przyrząd | Ocena, którą dałeś |
|---|---|---|---|
| `calendar-sync-settings` | Kategoria 4 | **przepisany markup** `CalendarSyncSettings` — zero `useTranslation`, teksty na sztywno po polsku | **A** |

## C. Funkcje i przejścia, które nie działają albo nie były sprawdzone

### C1. Twoje uwagi z korpusu 103 — 1 w tym module (1 realnych defektów)

| Ekran | Twoje słowa | Data | Klasa | Co zrobiono (poprawki po Twojej uwadze) |
|---|---|---|---|---|
| `calendar-sync-settings` | „Dodaj tutaj Outlooka i zmień to jabłuszko na jakieś normalne, a nie takie jabłko." | 2026-08-30 | DO_NAPRAWY | Ikony providerow ujednolicone — zniknelo jabluszko i emoji, wszystkie trzy maja te sama neutralna ikone kalendarza. Outlook byl na liscie od // Nazwy funkcji integracji są po polsku: „Synchronizacja e-maili", „Import kontaktów", „Synchronizacja spotkań" zamiast angielskich odpowiedni |

### C3. Bramki odbioru modułu, które NIE są PASS (MODULE_ACCEPTANCE)

```
G15 |`NOT_MEASURED / RED_LEGACY_1_CONFIRMED`| Odbiór adwersaryjny 03.09 (`ODBIOR_DYZUROW_286_290_291_20260903.md` §1.5, koryguje raport dyżuru 286 — baza `f65c4ff6a0` miała nierozstrzygnięty marker konfliktu w `PreviewAIHintStrip.tsx:110`, więc pliki testowe dotykaj�
   G16 |`TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING`| 2026-09-03 (nadzorca, marker `117bc9f743`): pakiet przed/po tego modułu = `evidence/grafika/a11y-fix-08_MEETINGS-20260903.md`, `evidence/grafika/i18n-pl-en-20260903.md`, `evidence/grafika/przewody-odbioru-20260903.md`, `evidence
   G19 |`IZOLACJA_UDOWODNIONA / MIANOWNIK_OTWARTY`| data=2026-09-04, sha=2a7273e087, mianownik pokryty=1 z 49 wg `G19_INWENTARZ_OBOWIAZKOW_20260903.md` sekcja R2, przypadek „Day 360 G19 08 Meetings cross-org record isolation through ApiGateway denies a foreign organization while
   G20 |`ENTRY_GATE_MEASURED / BLOCKED_BY_G19_AND_11_P0P1`| Oceniono 7/7 warunków na bazie `2a7273e087`; 0/7 formalnie odhaczone; G19 = `IZOLACJA_UDOWODNIONA / MIANOWNIK_OTWARTY` (podniesione dyzurem 360 po scaleniu); P0/P1 = 11 `BLOKUJE` przy mianowniku 121; dowód `evidence/g20/day359/
```

## D. Jutro — kolejność przejścia i czego nie zgłaszać (pakiet przelotu)

**Kroki**: otwórz Spotkania → otwórz realne, zaplanowane spotkanie z listy → sprawdź kartę
spotkania → z kebaba wybierz jedną akcję.

**Co się zmieniło od 22–23.08**: dostępność doprowadzona do zera błędów (moduł ma tylko 2
zatwierdzone ekrany, więc zakres tej naprawy jest mały).

**Czego NIE zgłaszaj**: —

**Pytania (TAK/NIE)**:
- Karta spotkania otwiera się i pokazuje realne dane?

---

## Źródła

`docs/program/grafika/status.json`, `ODBIOR_DECYZJE.json`, `odbior.sqlite` (poprawki), `KORPUS_UWAG_20260902.md`, `AUDYT_PRZYRZADU_20260901.md`, `waves/WAVE_03_ACCEPTANCE/AUDYT_PRZEWODOW_ODBIORU_20260903.md`, `modules/08_MEETINGS/MODULE_ACCEPTANCE.md`, `PRZELOT_WLASCICIELA_STAGING_20260904.md`, `FALA_2_PO_STAGINGU.md`, pomiar pakietu stagingu 04.09 23:35.
