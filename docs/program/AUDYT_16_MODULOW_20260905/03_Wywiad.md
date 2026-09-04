# 03. Wywiad — audyt stanu na 2026-09-05 rano

Staging: `b852ade6` (wdrożony 04.09 23:33, 30 przełączników włączonych). Lokalnie: `http://localhost:3000` (ten sam kod, ten sam backend stagingu).

## Diagnoza w trzech zdaniach

6 ekranów, wszystkie A. Kreator wywiadu włączony od 03.09, stepper i zakładka „do przeglądu” od dziś. Dwie Twoje uwagi to realne defekty do naprawy.

## Przełączniki, które decydują o tym, co widzisz

| Co | Zmienna | Stan na stagingu |
|---|---|---|
| Kreator wywiadu (A4) | `—` | ON od 03.09 (DEC-350) |
| Stepper etapów wywiadu | `VITE_INTERVIEW_PIPELINE_STEPPER` | ON od dziś |
| Zakładka „do przeglądu” | `VITE_INTERVIEW_PENDING_REVIEW_TAB` | ON od dziś |
| Kontrakt menu akcji kart wywiadu | `—` | w kodzie 924ebd3c7a, na stagingu TAK |

## A. Zatwierdzone obrazy — 6 ekranów (Twoje decyzje z 30.08–02.09)

Ocena: A = do odbioru, B = do odbioru z wyjątkami, C = nie pokazujemy, D = odłożone. Decyzja: Twoje kliknięcie. Uwaga: Twoje słowa, dosłownie.

| Ekran | Nazwa | Ocena | Decyzja | Twoja uwaga | Obraz |
|---|---|---|---|---|---|
| `drd-http-workspace` | Wywiad DRD | A | ok |  | `evidence/grafika/132-noc-wywiad-ocena/drd-http-workspace__PRZED__light.png` |
| `interview-creator-shell` | Kreator wywiadu | A | ok | To jest do poprawy wielkość ścianek, też już to zgłaszałem. Wilka z czcionek, obrazków – to nie wygląda jak sekcja tech, nie? Wszystkie elementy są w porządku, jest to w miarę czytelne, ale nie wygląda ładnie. | `evidence/grafika/grafika-14-ekranow/interview-creator-shell__PRZED__light.png` |
| `interview-preview-canon` | Podgląd sesji wywiadu | A | ok | Nie umiem ocenić, czy szerokość tego jest wystarczająca, ale pamiętaj, że mamy opisane, jak ma to wyglądać. Wszystkie przewidywania muszą być opisane zgodnie ze standardem. To jest komponent. | `evidence/grafika/grafika-14-ekranow/interview-preview-canon__PRZED__light.png` |
| `interview-sessions-status` | Sesje wywiadow | A | ok |  | `evidence/grafika/grafika-14-ekranow/interview-sessions-status__PRZED__light.png` |
| `karta-interview` | Karta wywiadu | A | ok |  | `evidence/grafika/132-noc-wywiad-ocena/karta-interview__PRZED__light.png` |
| `unified-create-launcher` | Nowy — wybór rodzaju | A | ok |  | `evidence/grafika/grafika-14-ekranow/unified-create-launcher__PRZED__light.png` |

## B. Gdzie układ na stagingu może NIE być tym, co zatwierdziłeś — i dlaczego

### B3. Znane wyjątki zapisane przy ekranach (status.json)

- `unified-create-launcher`: PUSTKA ZAMIERZONA: Modal wyboru rodzaju.
- `karta-interview`: Brak sekcji Akcje, Zrodla i zalozenia, Komentarze. Przy innych kartach z brakami stoi w kodzie komentarz z decyzja wlasciciela — tu go nie ma. Wymaga decyzji, nie naprawy.

## C. Funkcje i przejścia, które nie działają albo nie były sprawdzone

### C1. Twoje uwagi z korpusu 103 — 2 w tym module (2 realnych defektów)

| Ekran | Twoje słowa | Data | Klasa | Co zrobiono (poprawki po Twojej uwadze) |
|---|---|---|---|---|
| `interview-creator-shell` | „To jest do poprawy wielkość ścianek, też już to zgłaszałem. Wilka z czcionek, obrazków – to nie wygląda jak sekcja tech, nie? Wszystkie elementy są w porządku, jest to w miarę czytelne, ale nie wygląda ładnie." | 2026-08-30 | DO_NAPRAWY | Znaleziona konkretna przyczyna, nie wrazenie: funkcja kolorow JAWNIE IGNOROWALA przypisany kolor — dwanascie typow analizy renderowalo sie i |
| `interview-preview-canon` | „Nie umiem ocenić, czy szerokość tego jest wystarczająca, ale pamiętaj, że mamy opisane, jak ma to wyglądać. Wszystkie przewidywania muszą być opisane zgodnie ze standardem. To jest komponent." | 2026-08-30 | DO_NAPRAWY | Podglad na wspolnym komponencie, pelny tytul zamiast uciętego. Twoja watpliwosc o szerokosc: mierzyles ograniczenie MOJEGO stanowiska pomiar // PROSTUJE WLASNY MELDUNEK. Napisalem Ci 'pelny tytul zamiast uciętego' — to NIEPRAWDA. Tytul jest nadal uciety i przy dzisiejszym ukladzie na |

### C3. Bramki odbioru modułu, które NIE są PASS (MODULE_ACCEPTANCE)

```
G15 |`PARTIAL_PASS / RED_LEGACY_7`| Odbiór adwersaryjny 03.09 (`ODBIOR_DYZUROW_286_290_291_20260903.md` §1.5, koryguje raport dyżuru 286 — baza `f65c4ff6a0` miała nierozstrzygnięty marker konfliktu w `PreviewAIHintStrip.tsx:110`, więc pliki testowe dotykaj�
   G16 |`TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING`| 2026-09-03 (nadzorca, marker `117bc9f743`): pakiet przed/po tego modułu = `evidence/grafika/a11y-fix-02_INTERVIEW-20260903-reszta.md`, `evidence/grafika/i18n-pl-en-20260903.md`, `evidence/grafika/przewody-odbioru-20260903.md`, `
   G19 |`NOT_PROVEN / OWNER_RETEST_PENDING`| Pomiar na markerze zamrożonym `fee24bddb0` (odbiór dyżuru 290 potwierdził niezależnie na własnej bazie — `ODBIOR_DYZUROW_286_290_291_20260903.md` §2). Kotwica: SHA odbioru modułu z wiersza `G18` = `08775ced65` (02.09 17
   G20 |`ENTRY_GATE_MEASURED / BLOCKED_BY_G19_AND_11_P0P1`| Oceniono 7/7 warunków na bazie `2a7273e087`; 0/7 formalnie odhaczone; G19 = `NOT_PROVEN / OWNER_RETEST_PENDING`; P0/P1 = 11 `BLOKUJE` przy mianowniku 121; dowód `evidence/g20/day359/r4-02_INTERVIEW.md`.
```

## D. Jutro — kolejność przejścia i czego nie zgłaszać (pakiet przelotu)

**Kroki**: otwórz Wywiad → wejdź na realny, wcześniej zaczęty wywiad z listy → sprawdź kreator
wywiadu (nowo włączony na Twoje słowo) → rozwiń jedną oś pytań → wróć do listy.

**Co się zmieniło od 22–23.08**: kreator wywiadu włączony domyślnie na Twoją decyzję z 03.09
wieczór — to jest właśnie ekran, który masz dziś ocenić na żywym stagingu; dostępność
klawiaturowa i kontrast doprowadzone do zera błędów. Nawigacja osi pytań (jedna oś rozwinięta na
raz) jest zamierzonym zachowaniem drzewa, nie usterką.

Menu akcji kart Wywiadu i Wniosku ma teraz jawny kontrakt dostępnych działań. Widoczne, jeżeli
staging został zredeployowany po `924ebd3c7a`. (zdezaktualizowane przez `924ebd3c7a` — scalenie
menu akcji Wywiadu).

**Czego NIE zgłaszaj**: —

**Pytania (TAK/NIE)**:
- Kreator wywiadu widoczny i otwiera się bez błędu?
- Osie pytań rozwijają się i pokazują treść?

---

## Źródła

`docs/program/grafika/status.json`, `ODBIOR_DECYZJE.json`, `odbior.sqlite` (poprawki), `KORPUS_UWAG_20260902.md`, `AUDYT_PRZYRZADU_20260901.md`, `waves/WAVE_03_ACCEPTANCE/AUDYT_PRZEWODOW_ODBIORU_20260903.md`, `modules/02_INTERVIEW/MODULE_ACCEPTANCE.md`, `PRZELOT_WLASCICIELA_STAGING_20260904.md`, `FALA_2_PO_STAGINGU.md`, pomiar pakietu stagingu 04.09 23:35.
