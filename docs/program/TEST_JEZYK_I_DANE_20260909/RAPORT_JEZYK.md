# Raport „język" (część A) — 09.09.2026

Wykonawca: robotnik paczki TEST-JEZYK (nadzorca: Fable). Zakres: część A kryteriów
`KRYTERIA.md` (A1–A7), **żywy staging** `https://staging.consultify.ai` (kod `0d79170f2a`),
konto `james.whitfield@northwind.example` (OWNER, Northwind Manufacturing Ltd.), tylko
nawigacja/odczyt. Część B (dane) — poza zakresem tej paczki, osobny wykonawca.

Spis ekranów PRZED pomiarem: [`evidence/test-jezyk-dane-0909/jezyk/SPIS_EKRANOW.md`](../../../evidence/test-jezyk-dane-0909/jezyk/SPIS_EKRANOW.md).
Surowe dane: `evidence/test-jezyk-dane-0909/jezyk/{en,pl}/<modul>/*.png` + `*.txt`,
`captures-manifest.json`, `analiza-A1-A7.json`, `konsola-siec.json`.

## Metoda pomiaru (i jej ograniczenia)

- A1/A5: `scripts/i18n/pomiar-jezyka.mjs` (`wykryjPolski`/`wykryjAngielski`) +
  `scripts/i18n/polski-bez-ogonkow.mjs` na `innerText` każdego ekranu, plus **odsianie
  fałszywych trafień okiem** (obowiązkowe wg instrukcji).
- A2: regex surowego klucza i18n (`^[a-z]+(\.[a-zA-Z0-9_-]+){2,}$` jako fragment tekstu) +
  `undefined|null|[object`.
- A3: regexy dat/miesięcy/kwot PL w EN i miesięcy EN w PL.
- A4: regex `[A-Z]{3,}_[A-Z_]+` i `[a-z]+_[a-z]+`.
- A6: porównanie liczby linii `innerText` tego samego ekranu EN vs PL (proxy identyczności
  układu) — każdy rozjazd > 15% zweryfikowany OKIEM na zrzucie, nie tylko liczbą.
- Skrypty: `scripts/dev/test-jezyk-master-zrzuty.mjs` (przebieg główny) +
  `scripts/dev/test-jezyk-pl-retry.mjs`…`retry4.mjs` (dogrywki — patrz niżej) +
  `scripts/dev/test-jezyk-en-fix-mywork.mjs` (naprawa 2 błędnie podpisanych zrzutów EN) +
  `scripts/dev/test-jezyk-analiza.mjs` (analiza końcowa).

**Pułapka przyrządu złapana w trakcie i naprawiona (opisana szczerze, bo tak każe zasada
„weryfikuj realny runtime"):** pierwszy przebieg PL szukał zakładek Menu 2 po ANGIELSKIEJ
nazwie (skrypt pisany przed przełączeniem języka) — po przełączeniu konta na PL 49 z 51
ekranów PL wyszło jako fałszywe „N/A: Timeout". Naprawa: klik po POZYCJI zakładki w pasku
(DOM order), niezależnej od języka, zamiast po tekście — cztery dogrywki (retry 1–4)
domknęły wszystkie 51 ekranów. Dodatkowo namierzono i naprawiono 2 zrzuty EN z pierwszego
przebiegu, gdzie `getByRole('button', {name: 'Inbox'})` / `{name: 'Tasks'}` w My Work trafił
w globalną ikonę nagłówka zamiast w zakładkę modułu (ten sam tekst istnieje w dwóch
miejscach DOM) — złapane przez sygnał A6 (rozjazd liczby linii EN/PL), potwierdzone okiem,
naprawione `test-jezyk-en-fix-mywork.mjs`. Bez tej korekty raport fałszywie pokazywałby
„Notebook"/„Calendar" jako zawartość zakładek „Inbox"/„Tasks".

## A. Wynik per moduł (A1–A7)

PASS = zmierzone, 0 realnych trafień (fałszywe trafienia odsiane, wypisane osobno).
N/A = ekran nieosiągalny/nieistniejący — to jest znalezisko, nie ukryty PASS.

| # | Moduł | A1 (PL w EN) | A2 (surowy klucz) | A3 (data/liczby) | A4 (surowy enum) | A5 (EN w PL) | A6 (ten sam układ) | A7 (przełączenie) |
|---|---|---|---|---|---|---|---|---|
| 01 | Chat | PASS | PASS | N/A (brak dat na ekranie) | PASS | PASS | PASS | PASS *(globalne, patrz niżej)* |
| 02 | My Work | PASS | PASS | PASS | PASS | PASS¹ | PASS | PASS |
| 03 | Interview | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 04 | Tools | PASS | PASS | PASS | PASS | PASS¹ | PASS | PASS |
| 05 | Assessment | **FAIL** (2) | PASS | PASS | PASS | PASS¹ | PASS | PASS |
| 06 | Initiatives | PASS² | PASS | PASS | PASS | PASS¹ | PASS | PASS |
| 07 | Execution | PASS³ | PASS | PASS | PASS | PASS¹ | PASS | PASS |
| 08 | Results | PASS | PASS | **FAIL** (1) | PASS | PASS | PASS | PASS |
| 09 | Finance | PASS | PASS | PASS | PASS | PASS¹ | PASS | PASS |
| 10 | Materials | **FAIL** (74, blokujący) | PASS | PASS | **FAIL** (3) | **FAIL** (mistranslation) | PASS | PASS |
| 11 | Audits | PASS | PASS | PASS | PASS | PASS¹ | PASS | PASS |
| 12 | Meeting | N/A | N/A | N/A | N/A | N/A | N/A | N/A — **moduł nie zaimplementowany** |
| 13 | Organization | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 14 | Admin Panel | PASS (próbka) | PASS | PASS | PASS | PASS | PASS | PASS |
| 15 | Settings | PASS (próbka) | PASS | PASS | PASS | PASS | PASS | PASS |
| 16 | Partner Portal | PASS (1 ekran) | PASS | N/A | PASS | PASS | N/A | N/A (rola OWNER, Menu2 disabled) |

¹ Automatyczne trafienia to w 100% fałszywe alarmy po odsianiu okiem: „Status"/„Import" są
poprawnymi polskimi zapożyczeniami (identyczna pisownia), „Report"/„Close" to NAZWY
rekordów Northwind (dane, nie chrome) — patrz sekcja „Fałszywe trafienia".
² 2 trafienia to pole DANYCH „Portfolio/version" = „Portfel roboczy — zatwierdzone
inicjatywy…" — poza ścisłym zakresem A1 (chrome), ale widoczne na głównym ekranie; patrz
„Obserwacje danych" — cross-reference do części B.
³ 1 trafienie to fałszywy alarm słownika („terminals" zawiera rdzeń „termin").

**A7 (globalne, jeden mechanizm dla całej aplikacji): PASS.** Zmierzone: Ustawienia →
Appearance → Language → Polski → odśwież → CAŁY interfejs (menu 1, zakładki Menu 2, nagłówki
tabel, przyciski, boczna nawigacja Ustawień i Admina) w Polsce, potwierdzone na
`evidence/.../pl/10-materials/02-tab-template-library.png` (menu „Materiały", „Ustawienia",
„Biblioteka wzorców" — pełne PL) oraz na dziesiątkach innych zrzutów PL. Powrót do EN
potwierdzony `evidence/.../en/00-przywrocenie/06-po-dogrywce4-en-FINALNE.png`.

## Defekty (uszeregowane)

### BLOKUJĄCY

**D1 — Materials / Biblioteka wzorców: polski tekst na ekranie EN (74 trafień), plus surowe
nazwy techniczne pól w opisach.**
- Ekran: `Materials → Template Library` (`/presentations?tab=templates`), EN.
- Co widać: karty szablonów pokazują `9 sekcji`, `9 slajdów`, `Raport operacyjny PMO`,
  `Streszczenie wykonawcze (Executive Summary)`, `Cotygodniowy status PMO` — polskie
  liczebniki i część nazw/opisów szablonów, mimo że reszta interfejsu (nagłówki, zakładki,
  przyciski „New template") jest po angielsku.
- Dowód: `evidence/test-jezyk-dane-0909/jezyk/en/10-materials/02-tab-template-library.png` +
  `.txt`.
- Gdzie w kodzie: `src/components/ReportsAndPresentations/TemplatesGalleryView.tsx:63-76` —
  funkcja `pluralPl(n, one, few, many)` („Polish plural helper (bloki: sekcje/slajdy)")
  wywoływana BEZ WARUNKU na `i18n.language` dla `sectionCount`/`slideCount` (linie 73, 76) —
  zawsze zwraca polską odmianę liczebnika, niezależnie od języka konta. Same nazwy/opisy
  części szablonów („Raport operacyjny PMO", „Cotygodniowy status PMO (PMO Weekly Status)")
  wyglądają na katalog wzorców z mieszanym źródłem PL/EN — nie znaleziono w czasie tej
  paczki jednego wspólnego pliku źródłowego (poza zakresem: wymaga dalszego `grep` po treści
  konkretnych opisów, np. „PMO Weekly Status" w `server/` lub tabeli szablonów w bazie).
- A4 (powiązane, ten sam ekran): surowe `risk_register`, `scope_change_log`, `value_ledger`
  wewnątrz opisów szablonów (żargon deweloperski w tekście dla użytkownika) —
  `evidence/.../en/10-materials/02-tab-template-library.txt:144,319`.

**D2 — Materials / Biblioteka wzorców: błędne tłumaczenie „Application" → „System" w PL.**
- Ekran: `Materials → Template Library`, PL. Filtr źródła i etykieta na każdej karcie mówi
  „System" zamiast „Aplikacja" — myli się z prawdziwą kategorią „System" (dla źródła
  systemowego), bo oba pokazują teraz to samo słowo w innym kontekście filtra.
- Dowód: `evidence/test-jezyk-dane-0909/jezyk/pl/10-materials/02-tab-template-library.png`
  (pasek filtrów: „Wszystkie źródła 90 · Osobisty 0 · **System** 90 · Organizacja 0 ·
  Nieznany 0" — porównaj z EN: „All sources 90 · Personal 0 · **Application** 90 ·
  Organization 0 · Unknown 0").
- Gdzie w kodzie: `public/locales/pl/translation.json:16008`, klucz `reports.application`
  (w gałęzi obok `reports.personal`/`reports.organization`) = `"System"`. Ten sam klucz w
  trzech innych miejscach pliku (linie 6485, 8092, 10071) poprawnie ma wartość
  `"Aplikacja"`/`"Aplikacji"` — jedno konkretne wystąpienie klucza ma złą wartość. Wołacz:
  `src/components/ReportsAndPresentations/TemplatesGalleryView.tsx:125`
  (`t('reports.application')`).

### WIDOCZNY

**D3 — Results / OKR: angielski zakres dat na ekranie PL.**
- Ekran: `Results → OKR` (`/results/okr`), PL.
- Co widać: `FY2026 Q3 — Jul to Sep` — miesiące i spójnik „to" po angielsku zamiast
  `lip–wrz` / „do".
- Dowód: `evidence/test-jezyk-dane-0909/jezyk/pl/08-results/02-tab-okr.txt:39`.
- Gdzie w kodzie: nie zlokalizowano precyzyjnie w tej paczce (wymaga `grep` po wzorcu
  `"to"` w formatowaniu okresu OKR, prawdopodobnie `src/components/Results` lub
  `src/utils/date*`) — zostawione jako znalezisko do doprecyzowania.

**D4 — Finance: brak pozycji w Menu 1 (sidebar).**
- Moduł jest w pełnym zakresie MVP (`docs/FUNCTIONAL_DOCUMENTATION.md` #9) i realnie
  działa pod `/finance` (realne dane: 1 sprawozdanie Northwind, zakładki
  Statements/Analysis/Models/Prediction/Enterprise valuation), ale nie ma ikony w bocznym
  menu — osiągalny WYŁĄCZNIE wpisaniem adresu wprost. Zwykły użytkownik nie trafi tam przez
  nawigację.
- Dowód: `evidence/test-jezyk-dane-0909/jezyk/en/09-finance/01-menu1.png` (ekran działa) vs
  spis pozycji sidebara zmierzony live 09.09 (Chat/My Work/Interview/Tools/Assessment/
  Audits/Initiatives/Execution/Results/Materials + Organization/Admin/Settings/Partners —
  BEZ Finance i BEZ Meeting).
- To jest znalezisko nawigacyjne, nie ściśle językowe — zgłaszane tu, bo złapane w trakcie
  budowania spisu ekranów (SPIS_EKRANOW.md).

**D5 — Meeting: moduł nie zaimplementowany (placeholder „Wave 2").**
- Ekran `/meetings` (i cała reszta modułu) pokazuje: „Meetings — planned for Wave 2. This
  module isn't part of the MVP yet. We'll come back to it in the next wave." — poprawnie po
  angielsku, treść placeholdera bez błędów językowych, ale CAŁY moduł jest N/A dla A1–A7.
- Dowód: `evidence/test-jezyk-dane-0909/jezyk/en/12-meeting/01-menu1.txt`.
- Zgodne z `docs/FUNCTIONAL_DOCUMENTATION.md` #12 („1.09: 2 z 3 bramek otwarte — menu
  odmawia, adres wpuszcza") — potwierdzone żywym pomiarem 09.09, nie tylko dokumentacją.

### KOSMETYCZNY / DO POTWIERDZENIA

**D6 — Initiatives: pole „Portfolio / version" po polsku na ekranie EN.**
- „Portfel roboczy — zatwierdzone inicjatywy, stan z 2026-09-08 · v2" — widoczne w tabeli
  i w panelu podglądu `Initiatives → Plan`, EN.
- Dowód: `evidence/test-jezyk-dane-0909/jezyk/en/06-initiatives/02-tab-plan.png`.
- To pole DANYCH (etykieta wersji portfela), nie chrome interfejsu — prawdopodobnie dane
  demo/seed wygenerowane po polsku dla organizacji Northwind. **Cross-reference do części
  B (dane)**: sprawdzić generator danych demo pod kątem języka pól tekstowych.

**D7 — Initiatives: „Module Initiative" pod „POWIĄZANIA" w podglądzie PL — niepotwierdzone
wzrokiem.**
- W `innerText` (`evidence/.../pl/06-initiatives/90-podglad-rekordu.txt:363`) widnieje
  surowy napis „Module Initiative" (angielski) w sekcji „POWIĄZANIA" panelu podglądu. Reszta
  panelu jest bez zarzutu przetłumaczona (Status, Następna brama, Gotowość, Właściciel,
  Kontekst inicjatywy, Kopiuj link — wszystko PL, `evidence/.../pl/06-initiatives/90-podglad-rekordu.png`).
  Fragment „POWIĄZANIA" jest poza kadrem zrzutu (wymaga scrolla panelu) — nie potwierdzone
  okiem w tej paczce, zgłaszane jako do zweryfikowania, nie jako pewny defekt.

**D8 — Audits: klik pierwszego wiersza biblioteki nie otworzył panelu podglądu.**
- Próba generyczna (klik pierwszego wiersza tabeli) na `Audits → Library` zostawiła ekran
  bez zmian (wciąż lista, bez panelu StandardPreview) — inaczej niż w pozostałych modułach
  listowych, gdzie ten sam klik otwierał panel.
- Dowód: `evidence/test-jezyk-dane-0909/jezyk/en/11-audits/90-podglad-rekordu.png`.
- Niepewne, czy to defekt produktu czy artefakt czasu wykonania próby — nie badane dalej w
  tej paczce (poza zakresem językowym), zgłaszane jako obserwacja.

## Fałszywe trafienia (odsiane okiem, NIE liczone jako defekty)

| Ekran | Trafienie | Powód odsiania |
|---|---|---|
| 07-execution/02-tab-work (EN) | „terminals" → dowód `termin(reczny)` | „terminals" to angielskie słowo (shop-floor terminals), słownik złapał polski rdzeń „termin" jako podciąg |
| 06-initiatives (PL, wiele ekranów) | „Marża" → wzorzec miesiąca `Mar` | `\bMar\b` łapie „Mar" na granicy słowa przed polską literą „ż" (JS `\b` nie traktuje `ż` jako znaku słowa) — „Marża" ≠ marzec |
| 02/04/06/09/10/11 (PL, ~20 ekranów) | „Status" jako „angielskie słowo chrome" | Status to POPRAWNE polskie zapożyczenie (identyczna pisownia w obu językach) — lista słów z KRYTERIA.md go zawiera, ale w PL nie jest błędem |
| 09-finance/91-tworzenie (PL) | „Import" | jak wyżej — poprawne polskie zapożyczenie („Import sprawozdania finansowego") |
| 04/05/10 (PL) | „Report" w nazwach typu „OEE Baseline Report Q2 2026" | to NAZWY rekordów (dane Northwind), nie chrome interfejsu — dane są po angielsku z założenia |
| 07-execution/02-tab-work (PL) | „Close" w „Close the pilot aisle housekeeping actions" | nazwa zadania (dane), nie przycisk chrome |

## Konsola / sieć (B1 dla stagingu — pełne dane w `konsola-siec.json`)

Razem 9 wpisów na 170 zmierzonych ekranach (93 EN + 77 PL):
- 5× `console.error`, 4× `HTTP 404`.
- 1× jednorazowy `Failed to fetch notifications` przy starcie sesji (mogło być
  przejściowe, nie powtórzyło się).
- **4× powtarzalny 404** na `GET /api/vnext/results/kpi/scorecards/9e2b5b6a-.../review-snapshots/published`
  — występuje na KAŻDYM wejściu w `Results` (menu1 i zakładkę Management reports), w OBU
  językach (EN i PL) — realny, powtarzalny błąd backendu dla tego konkretnego scorecardu,
  nie fluktuacja. Nie badane dalej (poza zakresem A/część B), zgłaszane do rozliczenia w
  raporcie danych.

## Werdykt

**Językowo poprawni w EN: NIE.** Blokujący defekt D1 (Materials/Template Library, 74
trafień, kod zlokalizowany) + widoczny D3 (Results/OKR). 14 z 16 modułów czyste w EN.

**Językowo poprawni w PL: NIE.** Blokujący defekt D2 (mistranslation „Application"→„System",
kod zlokalizowany, jedna literówka w słowniku, łatwa naprawa) + ten sam D1 (badge sekcji/
slajdów wygląda poprawnie w PL, bo funkcja jest zahardkodowana na polski — czyli PL "przechodzi
przypadkiem"). 15 z 16 modułów czyste w PL.

**Co blokuje pełne testowanie pod kątem języka:** naprawić `pluralPl()` w
`TemplatesGalleryView.tsx` (podłączyć pod `i18n.language`, dodać warianty EN/inne), naprawić
literówkę słownika PL (`reports.application` = "System" → "Aplikacja"), doprecyzować format
daty OKR (D3). Reszta (D4 Finance w menu, D5 Meeting nieaktywny) to nawigacja/zakres
produktu, nie i18n — do rozliczenia przez właściwego właściciela modułu, nie blokuje
testowania JĘZYKA per se (moduły są mierzalne pod adresem bezpośrednim / N/A jest
udokumentowane).
