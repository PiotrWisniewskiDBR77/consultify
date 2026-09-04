# 11. Audyty — audyt stanu na 2026-09-05 rano

Staging: `b852ade6` (wdrożony 04.09 23:33, 30 przełączników włączonych). Lokalnie: `http://localhost:3000` (ten sam kod, ten sam backend stagingu).

## Diagnoza w trzech zdaniach

4 ekrany A. Raport DRD włączony od dziś (trasa do dziś przekierowywała na listę). Ekran „audyty-drd-report” oceniałeś na komponencie, który produkt wycofał — do sprawdzenia na żywo, co realnie rysuje moduł.

## Przełączniki, które decydują o tym, co widzisz

| Co | Zmienna | Stan na stagingu |
|---|---|---|
| Raport DRD w Audytach (trasa /audit-programs/drd-report/:id) | `VITE_DRD_REPORT_ENABLED` | ON od dziś — do dziś przekierowywała na listę |
| Widok ustaleń i raportu, skala i polerowanie | `—` | ON od 27.08 |

## A. Zatwierdzone obrazy — 4 ekranów (Twoje decyzje z 30.08–02.09)

Ocena: A = do odbioru, B = do odbioru z wyjątkami, C = nie pokazujemy, D = odłożone. Decyzja: Twoje kliknięcie. Uwaga: Twoje słowa, dosłownie.

| Ekran | Nazwa | Ocena | Decyzja | Twoja uwaga | Obraz |
|---|---|---|---|---|---|
| `audyty-drd-report` | Raporty DRD wedlug programu | A | ok | Znowu nie wiem, gdzie to jest, ale to nie wygląda jak pełna tabela. To muszą być raporty, które są po prostu pełną tabelą na pełną szerokość. | `evidence/grafika/20-tabele-szerokosc/audyty-drd-report__PRZED__light.png` |
| `audyty-piec-powierzchni` | Biblioteka audytow | A | ok |  | `evidence/grafika/133-noc-narzedzia-audyty-kanon/audyty-piec-powierzchni__PRZED__light.png` |
| `audyty-raport-dokument` | Raport z audytu | A | ok |  | `evidence/grafika/133-noc-narzedzia-audyty-kanon/audyty-raport-dokument__PRZED__light.png` |
| `audyty-warsztat-kryterium` | Warsztat kryterium (wzorzec) | A | ok |  | `evidence/grafika/133-noc-narzedzia-audyty-kanon/audyty-warsztat-kryterium__PRZED__light.png` |

## B. Gdzie układ na stagingu może NIE być tym, co zatwierdziłeś — i dlaczego

### B1. Zatwierdzony komponent ≠ komponent realnego użytkownika (audyt przewodów 03.09)

| Ekran | Werdykt | Co jest inaczej | Stan dziś |
|---|---|---|---|
| `audyty-drd-report` | ROZJAZD | Komentarz w kodzie, AuditsMethodHub.tsx:10: „Dawny równoległy `AuditsHub` nad `/api/audit` nie jest już mounted; jego write endpoints pozostają wycofane po stronie serwera.” | do sprawdzenia na żywo jutro |

### B3. Znane wyjątki zapisane przy ekranach (status.json)

- `audyty-piec-powierzchni`: OCENA A DOTYCZY WYLACZNIE ZAKLADKI „BIBLIOTEKA" — zakladka „Sesje" (AuditProcessesTab, ?tab=processes) NIGDY nie byla sfotografowana ani obejrzana przez wlasciciela w zadnej turze odbioru udokumentowanej w evidence/grafika/ do 2026-09-01. Defekty (patrz „naprawione") zostaly zmierzone i naprawione 2
- `audyty-piec-powierzchni`: ZDIAGNOZOWANE, NIE NAPRAWIONE (celowo, poza zakresem tego dyżuru): pasek chipów etapu lifecycle (Menu 3, zakładka „Sesje") jest realnie przewijalny w poziomie (`ModuleNavBar.tsx:307`, zmierzone JS: scrollWidth 1702 > clientWidth 1408 na 1440px), ale bez ŻADNEGO widocznego sygnału — klasa `no-scrollb

## C. Funkcje i przejścia, które nie działają albo nie były sprawdzone

### C1. Twoje uwagi z korpusu 103 — 1 w tym module (0 realnych defektów)

| Ekran | Twoje słowa | Data | Klasa | Co zrobiono (poprawki po Twojej uwadze) |
|---|---|---|---|---|
| `audyty-drd-report` | „Znowu nie wiem, gdzie to jest, ale to nie wygląda jak pełna tabela. To muszą być raporty, które są po prostu pełną tabelą na pełną szerokość." | 2026-08-30 | ZROBIONE | Raporty DRD na pelna szerokosc, calosc po polsku. Waska ramka byla wina stanowiska pomiarowego. |

### C3. Bramki odbioru modułu, które NIE są PASS (MODULE_ACCEPTANCE)

```
G15 |`PARTIAL_PASS / SERVER_NOT_MEASURED`| Odbiór adwersaryjny 03.09 (`ODBIOR_DYZUROW_286_290_291_20260903.md` §1.5, koryguje raport dyżuru 286 — baza `f65c4ff6a0` miała nierozstrzygnięty marker konfliktu w `PreviewAIHintStrip.tsx:110`, więc pliki testowe dotykaj�
   G16 |`TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING`| 2026-09-03 (nadzorca, marker `117bc9f743`): pakiet przed/po tego modułu = `evidence/grafika/a11y-fix-12_AUDITS-20260903-reszta.md`, `evidence/grafika/i18n-pl-en-20260903.md`, `evidence/grafika/przewody-odbioru-20260903.md`, `evi
   G19 |`NOT_PROVEN / OWNER_RETEST_PENDING`| Pomiar na markerze zamrożonym `fee24bddb0` (odbiór dyżuru 290 potwierdził niezależnie na własnej bazie — `ODBIOR_DYZUROW_286_290_291_20260903.md` §2). Kotwica: SHA odbioru modułu z wiersza `G18` = `08775ced65` (02.09 17
   G20 |`ENTRY_GATE_MEASURED / BLOCKED_BY_G19_AND_11_P0P1`| Oceniono 7/7 warunków na bazie `2a7273e087`; 0/7 formalnie odhaczone; G19 = `NOT_PROVEN / OWNER_RETEST_PENDING`; P0/P1 = 11 `BLOKUJE` przy mianowniku 121; dowód `evidence/g20/day359/r4-12_AUDITS.md`.
```

## D. Jutro — kolejność przejścia i czego nie zgłaszać (pakiet przelotu)

**Kroki**: otwórz Audyty → kliknij realny program audytowy z listy → otwórz zakładkę Raportów
DRD → otwórz jeden raport.

**Co się zmieniło od 22–23.08**: zakładka „Raporty DRD” pokazywała wycofany, martwy komponent —
teraz pokazuje realny moduł Audytów, ten sam, który zaakceptowałeś; dostępność doprowadzona do
zera błędów.

**Czego NIE zgłaszaj**: —

**Pytania (TAK/NIE)**:
- Zakładka Raportów DRD pokazuje treść zgodną z tym, co widziałeś na zrzutach akceptu?

---

## Źródła

`docs/program/grafika/status.json`, `ODBIOR_DECYZJE.json`, `odbior.sqlite` (poprawki), `KORPUS_UWAG_20260902.md`, `AUDYT_PRZYRZADU_20260901.md`, `waves/WAVE_03_ACCEPTANCE/AUDYT_PRZEWODOW_ODBIORU_20260903.md`, `modules/12_AUDITS/MODULE_ACCEPTANCE.md`, `PRZELOT_WLASCICIELA_STAGING_20260904.md`, `FALA_2_PO_STAGINGU.md`, pomiar pakietu stagingu 04.09 23:35.
