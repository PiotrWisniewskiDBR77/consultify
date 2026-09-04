# 15. Ustawienia — audyt stanu na 2026-09-05 rano

Staging: `b852ade6` (wdrożony 04.09 23:33, 30 przełączników włączonych). Lokalnie: `http://localhost:3000` (ten sam kod, ten sam backend stagingu).

## Diagnoza w trzech zdaniach

11 ekranów, 3 bez decyzji. Zamknięte koło MFA naprawione 02.09. Ustawienia powiadomień V2 usunięte Twoją decyzją A5. Breadcrumb i „powrót do czatu” wyłączone zmienną na stagingu — nie wiem, kto i kiedy to ustawił.

## Przełączniki, które decydują o tym, co widzisz

| Co | Zmienna | Stan na stagingu |
|---|---|---|
| Ustawienia powiadomień V2 (Obserwowane) | `—` | USUNIĘTE decyzją A5 (DEC-351), 8 plików; WatchingTab był nierenderowany |
| Breadcrumb i „powrót do czatu” | `VITE_WORKSPACE_BREADCRUMB, VITE_BACK_TO_CHAT_*` | false na stagingu (ustawione wcześniej, nie ruszałem) — w kodzie domyślnie ON |

## A. Zatwierdzone obrazy — 11 ekranów (Twoje decyzje z 30.08–02.09)

Ocena: A = do odbioru, B = do odbioru z wyjątkami, C = nie pokazujemy, D = odłożone. Decyzja: Twoje kliknięcie. Uwaga: Twoje słowa, dosłownie.

| Ekran | Nazwa | Ocena | Decyzja | Twoja uwaga | Obraz |
|---|---|---|---|---|---|
| `ustawienia-personalne` | Ustawienia — Personalne (profil) | A | ok |  | `evidence/grafika/195-przelot-B/ustawienia-personalne__PO__light.png` |
| `ustawienia-wyglad` | Ustawienia — Wygląd (motyw) | A | ok |  | `evidence/grafika/196-naprawy-11-18/ustawienia-wyglad__PRZED__light.png` |
| `ustawienia-zaawansowane` | Ustawienia — Zaawansowane (import/eksport) | A | ok |  | `evidence/grafika/195-przelot-B/ustawienia-zaawansowane__PO__light.png` |
| `ustawienia-ai-automatyzacja` | Ustawienia — AI i automatyzacja (zachowanie AI) | B | ok |  | `evidence/grafika/195-przelot-B/ustawienia-ai-automatyzacja__PO__light.png` |
| `ustawienia-dane-prywatnosc` | Ustawienia — Dane i prywatność (kontrola danych) | B | ok |  | `evidence/grafika/217-trzy-rodziny/ustawienia-dane-prywatnosc__PO__light.png` |
| `ustawienia-integracje` | Ustawienia — Integracje (połączone aplikacje) | B | ok |  | `evidence/grafika/216-poprawione-dzis/mini-ustawienia-integracje__PO__light.png` |
| `ustawienia-powiadomienia` | Ustawienia — Powiadomienia (przegląd) | B | ok |  | `evidence/grafika/usun-notificationsettingsv2-20260903/ustawienia-powiadomienia__PO__pl__1440__light.png` |
| `ustawienia-workflow` | Ustawienia — Workflow (preferencje pracy) | B | ok |  | `evidence/grafika/196-naprawy-11-18/ustawienia-workflow__PRZED__light.png` |
| `ustawienia-bezpieczenstwo` | Ustawienia — Bezpieczeństwo (przegląd) | C | — |  | `evidence/grafika/150-ustawienia-organizacja/ustawienia-bezpieczenstwo__PO__light.png` |
| `ustawienia-billing` | Ustawienia — Płatności (subskrypcja) | C | — |  | `evidence/grafika/150-ustawienia-organizacja/ustawienia-billing__PO__light.png` |
| `settings-full-module-closed-final-20260825` | Ustawienia — komplet 9 grup × 2 motywy | D | — |  | — |

Bez Twojej decyzji (3): `settings-full-module-closed-final-20260825`, `ustawienia-bezpieczenstwo`, `ustawienia-billing`.

## B. Gdzie układ na stagingu może NIE być tym, co zatwierdziłeś — i dlaczego

### B3. Znane wyjątki zapisane przy ekranach (status.json)

- `settings-full-module-closed-final-20260825`: WIERSZ-DUCH: zmigrowany z historycznego odbioru (CLOSED_FINAL, DEC-2026-08-25-16, tag final-02-settings) BEZ ŻADNEGO zrzutu w tym drzewie roboczym — potwierdzone przeszukaniem evidence/. Odbiór historyczny nie jest dowodem wizualnym w tej gałęzi.
- `settings-full-module-closed-final-20260825`: ZASTĄPIONY realnymi ekranami z rundy 150-ustawienia-organizacja (2026-08-31) — 10 grup faktycznie zweryfikowanych w kodzie SettingsSidebar.tsx, każda z własnym zrzutem i oceną: patrz np. ustawienia-personalne, ustawienia-wyglad, ustawienia-bezpieczenstwo.
- `settings-full-module-closed-final-20260825`: Ten wiersz pozostaje w rejestrze jako ślad historii (nie kasujemy), ale ocena D wyklucza go z tego, co widzi właściciel (strona pokazuje tylko A/B).
- `ustawienia-workflow`: ZNANE ZGŁOSZENIE potwierdzone na zrzucie: w motywie ciemnym 4 przełączniki widżetów pulpitu są nieczytelne — brak wyraźnego kontrastu ON/OFF, gałka ledwo widoczna na ciemnoniebieskim tle (w motywie jasnym te same przełączniki są czytelne).
- `ustawienia-ai-automatyzacja`: ZNANE ZGŁOSZENIE: crimson dekoracyjny — tło ikon w nagłówkach sekcji (dymek czatu, iskierka tonu) różowo-crimsonowe mimo braku stanu krytycznego.
- `ustawienia-powiadomienia`: ZNANE ZGŁOSZENIE: crimson dekoracyjny — tło ikony dzwonka w nagłówku różowo-crimsonowe, nie stan krytyczny.
- `ustawienia-bezpieczenstwo`: ZNANE ZGŁOSZENIE potwierdzone na zrzucie: w motywie JASNYM wiersze 'Ostatnia aktywność' ('Chrome · macOS', 'Safari · iPhone') renderują się bladym/białym tekstem na jasnym tle — praktycznie nieczytelne; w motywie ciemnym ten sam tekst jest w pełni czytelny.
- `ustawienia-bezpieczenstwo`: ZNANE ZGŁOSZENIE potwierdzone: znacznik czasu w formacie amerykańskim '8/31/2026, 9:18:49 AM' (M/D/RRRR + AM/PM) zamiast polskiego DD.MM.RRRR.
- `ustawienia-bezpieczenstwo`: Crimson dekoracyjny w wielu miejscach ekranu (ikona tarczy, ikona klucza, link 'Zobacz pełną historię' w kolorze czerwonym) — nie stan krytyczny.
- `ustawienia-integracje`: Opisy kart integracji i tagi funkcji (np. 'Sync emails, contacts and labels from your Gmail account', 'Email sync', 'Contact import') renderują się po angielsku mimo polskich nagłówków sekcji — dev-render (connected-apps) wskazuje surowy window.fetch z pominięciem warstwy Api/i18n dla treści kart.
- `ustawienia-dane-prywatnosc`: Wyjątek nazwany PRZED spojrzeniem: została JEDNA czerwień — kwadratowa ikonka bazy danych w lewym górnym rogu karty „Kontrola danych". Ta sama ikonka stoi w nagłówku KAŻDEJ karty ustawień (23 ekrany), więc jej zdjęcie zmieni cały moduł naraz. Pytanie do Ciebie: zostawić czy zdjąć?
- `ustawienia-billing`: Nie jest to błąd harnessu — potwierdzone w kodzie realnego komponentu SettingsView.tsx.

## C. Funkcje i przejścia, które nie działają albo nie były sprawdzone

### C1. Twoje uwagi z korpusu 103 — 0 w tym module (0 realnych defektów)

Brak uwag w korpusie dla tego modułu.

### C3. Bramki odbioru modułu, które NIE są PASS (MODULE_ACCEPTANCE)

```
G15 |`PARTIAL_PASS / SERVER_NOT_MEASURED`| Odbiór adwersaryjny 03.09 (`ODBIOR_DYZUROW_286_290_291_20260903.md` §1.5, koryguje raport dyżuru 286 — baza `f65c4ff6a0` miała nierozstrzygnięty marker konfliktu w `PreviewAIHintStrip.tsx:110`, więc pliki testowe dotykaj�
   G16 |`TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING`| 2026-09-03 (nadzorca, marker `117bc9f743`): pakiet przed/po tego modułu = `evidence/grafika/a11y-fix-15_SETTINGS-20260903.md`, `evidence/grafika/i18n-pl-en-20260903.md`, `evidence/grafika/przewody-odbioru-20260903.md`, `evidence
   G19 |`NOT_PROVEN / OWNER_RETEST_PENDING`| Pomiar na markerze zamrożonym `fee24bddb0` (odbiór dyżuru 290 potwierdził niezależnie na własnej bazie — `ODBIOR_DYZUROW_286_290_291_20260903.md` §2). Kotwica: SHA odbioru modułu z wiersza `G18` = `08775ced65` (02.09 17
   G20 |`ENTRY_GATE_MEASURED / BLOCKED_BY_G19_AND_11_P0P1`| Oceniono 7/7 warunków na bazie `2a7273e087`; 0/7 formalnie odhaczone; G19 = `NOT_PROVEN / OWNER_RETEST_PENDING`; P0/P1 = 11 `BLOKUJE` przy mianowniku 121; dowód `evidence/g20/day359/r4-15_SETTINGS.md`.
```

## D. Jutro — kolejność przejścia i czego nie zgłaszać (pakiet przelotu)

**Kroki**: otwórz Ustawienia → przejdź przez 2–3 realne sekcje (np. Profil, Bezpieczeństwo) →
zmień jedno ustawienie i sprawdź czy się zapisało → wróć.

**Co się zmieniło od 22–23.08**: dostępność doprowadzona do zera błędów.

**Czego NIE zgłaszaj**: zakładka „Obserwowane” — jeśli jej nie widzisz albo wygląda na
niedokończoną, to zamierzone; leżący za nią kod idzie do usunięcia, nie do naprawy teraz.

**Pytania (TAK/NIE)**:
- Zmiana ustawienia zapisała się i została po powrocie na ekran?

---

## Źródła

`docs/program/grafika/status.json`, `ODBIOR_DECYZJE.json`, `odbior.sqlite` (poprawki), `KORPUS_UWAG_20260902.md`, `AUDYT_PRZYRZADU_20260901.md`, `waves/WAVE_03_ACCEPTANCE/AUDYT_PRZEWODOW_ODBIORU_20260903.md`, `modules/15_SETTINGS/MODULE_ACCEPTANCE.md`, `PRZELOT_WLASCICIELA_STAGING_20260904.md`, `FALA_2_PO_STAGINGU.md`, pomiar pakietu stagingu 04.09 23:35.
