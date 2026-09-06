# Zaimportowany raport (`imported-report`) — kontrakt karty N

> Partia P10-B4, pozycja **#27** inwentarza. Pomiar 06.09.2026 (kod + lista na żywo);
> zrzut listy `evidence/p10b4/10-raporty-lista.png`. **Karta niemierzona na żywo —
> zero rekordów tego typu w bazie stanowiska; przepis w §0.1.**

## §0. Tożsamość

| pole | wartość |
|---|---|
| nazwa PL | Zaimportowany raport (PDF) |
| moduł | 04_ASSESSMENT |
| archetyp | **B — Dokument** |
| trasa | brak własnej — zakładka dynamiczna huba (`/assessment?tab=reports`) |
| jak otworzyć | Ocena → „Raporty" → wiersz o `type='report'` i `subType='imported'` (`AssessmentHub.tsx:2357-2366`) |
| komponent | `src/components/assessment/ImportedReportDetailView.tsx:132` (622 linie) |
| powłoka dziś | **brak** — własny układ kart; jedyne, co zostaje z kanonu, to pasek modułu huba (karta renderuje się W hubie, nie zamiast niego) |

### §0.1 STOP: brak rekordu do pomiaru

Lista „Raporty" ma dziś 4 pozycje i **żadna nie jest importem** (`10-raporty-lista.png`:
SIRI, ADMA, 2× DRD — wszystkie `subType` inny niż `imported`, wszystkie prowadzą do
Report Buildera przez `navigate('/reports/builder/…')`, `AssessmentHub.tsx:2368-2371`).
Przepis na pomiar: Ocena → „Raporty" → przycisk **„Wgraj PDF"** (widoczny na zrzucie)
→ wgrać PDF raportu dojrzałości → wiersz z `subType='imported'` → klik.
Po pomiarze uzupełnić §6 o kolumnę „zrzut". **Nie zgaduję wyglądu — poniższy kontrakt
opisuje, co jest w kodzie, i co ma być docelowo.**

## §1. Sekcje

| sekcja | po co użytkownikowi | źródło danych (API pole → writer) | reguła pustki | kolej. | S/L |
|---|---|---|---|---|---|
| Nagłówek pliku (nazwa, format, data wgrania) | tożsamość źródła | `sourceFileName`, `sourceFormat` → import PDF | zawsze | 1 | L |
| Pokrycie (%) | ile z raportu udało się odczytać | `coveragePercent` | zawsze | 2 | L |
| Rozpoznana metodyka + pewność | czy system trafił | `detectedFramework`, `detectionConfidence` | zawsze | 3 | L |
| Rozpoznane pola / brakujące | co trzeba uzupełnić ręcznie | `extractedData.scores` | brak → „nic nie rozpoznano" | 4 | L |
| Znalezione inicjatywy | co da się przenieść do Inicjatyw | `extractedData.initiatives` | pusta lista → sekcja znika | 5 | L |
| Automatyczne streszczenie | szybki wgląd bez otwierania PDF | `autoSummary` | brak → CTA „Pracuj z AI" | 6 | L |
| Akcje na imporcie (Utwórz ocenę, Utwórz inicjatywy, Pobierz PDF, Odśwież) | co dalej | `POST` importu → `targetId`/`initiativesCreated` | zawsze | 7 | L |
| Błąd przetwarzania | uczciwość | `processingError` | brak błędu → znika ✓ (`:441`) | 8 | L |

**Writerów serwerowych nie zweryfikowałem po plik:linia** — import PDF nie ma wołacza
na tym stanowisku (§0.1). Do domknięcia przy pomiarze: wskazać trasę importu i writer
kolumn `coveragePercent` / `autoSummary` / `extractedData`.

## §2. Prawy panel

**Zero paneli.** Docelowo:

| sekcja | status | co ma nieść |
|---|---|---|
| Akcje | obowiązkowa | Utwórz ocenę · Utwórz inicjatywy · Pobierz PDF · Odśwież (dziś rozsypane po nagłówku i kaflu „Actions", `:301-420`) |
| Właściwości (tabela) | obowiązkowa | Status importu → Właściciel → Metodyka rozpoznana → Pokrycie → Źródło (nazwa pliku) → Wgrano → Zaktualizowano |
| Powiązania | obowiązkowa | ocena utworzona z importu (`targetId`) · inicjatywy (`initiativesTargetIds`) |
| Źródła i założenia | **obowiązkowa** — treść pisze automat | które strony PDF dały które pola; pewność rozpoznania |
| Komentarze | warunkowa — pominięta z powodem | import jest materiałem wejściowym, nie dokumentem do dyskusji |
| Historia | obowiązkowa | ponowne przetworzenia i zmiany statusu |

## §3. Menu 5 i nawigacja

* Dziś: brak Menu 4 i Menu 5; powrót przez własny przycisk „wstecz" (`onBack`).
  Pasek modułu ✓ zostaje (karta żyje w zakładce huba) — jedyna karta tej partii, która
  nie gubi Menu 2.
* Docelowo: Menu 4 (tytuł = nazwa pliku, status importu, kebab) + Menu 5
  (Sekcje ▾ · Edycja/Podgląd · Pracuj z AI ▾).
* Edycja/Podgląd wg prawa: import jest **tylko do odczytu** (plik klienta) — edycji
  podlega wyłącznie streszczenie i mapowanie pól; bez prawa zapisu przełącznik znika.
* Klasa **L**. K26: podgląd z listy → „Otwórz" — **do sprawdzenia przy pomiarze**.

## §4. AI

| sekcja | Analizuj | Uzupełnij tę sekcję | Uzupełnij cały dokument | tylko do odczytu |
|---|---|---|---|---|
| Automatyczne streszczenie | ocena, czy streszczenie pokrywa treść PDF | propozycja streszczenia z tekstu PDF | ✓ | — |
| Rozpoznane pola (braki) | wskazuje pola bez wartości i strony PDF, gdzie mogą być | propozycja mapowania dla brakującego pola | ✓ | — |
| Znalezione inicjatywy | ocena jakości wyciągniętych pozycji | propozycja opisu/uzasadnienia inicjatywy | ✓ | — |
| Pokrycie, pewność, plik źródłowy, błąd przetwarzania | czyta | ✗ | ✗ | ✓ pomiar automatu, nie treść |

Zawsze propozycja → „Zatwierdź". Teresa wyłącznie z Menu 1. Wiersz `imported-report`
w tabeli K24 SSOT **nie istnieje** — karty nie ma ani w `REJESTR_KART_N`, ani wśród
9 jawnych wyjątków (`registry.kompletnosc.test.ts:30-40`).

## §5. Czytelność — najgorsza karta partii

* **`primary-[0-9]` = 3 → K17 ZŁAMANE** (jedyne trafienia w całym module Ocena):
  `ImportedReportDetailView.tsx:347` (`text-primary-400`), `:401-402`
  (`bg-primary-500/15 text-primary-400 border-primary-500/20 hover:bg-primary-500/25`).
  W Tailwindzie `primary-*` = crimson `#85182F` — czerwień zarezerwowana dla semantyki
  krytycznej, a tu maluje nazwę metodyki i przycisk „Create Assessment".
* **Angielskie literały w polskim UI (K25), do usunięcia z plik:linia:**
  `:201` `toast.loading('Downloading...')`, `:210` `'Download complete'`,
  `:234` `'Report not found'`, `:283` `Uploaded`, `:305` `title="Refresh"`,
  `:330` `Coverage`, `:346` `Framework`, `:355` `Fields Recognized`,
  `:369` `Initiatives Found`, `:379` `Actions`, `:395` `Create Assessment (…)`.
* Kolory zaszyte poza tokenami: `text-navy-900`, `text-slate-500/400`, `text-emerald-400`,
  `text-blue-400`, `text-amber-400`, `text-danger-400`, `bg-white dark:bg-navy-900` —
  cała karta stoi na palecie sprzed kanonu `c-*`.
* Fokus: brak jakiegokolwiek `focus-visible:ring-*` w pliku → K18 nierozstrzygnięte
  (nie ma naruszenia, ale nie ma też fokusu).

## §6. Stan zastany vs kontrakt

✓: brak potwierdzonych (K19 pasek modułu jest, ale bez pigułki otwartej karty).
✗ (z kodu, bez zrzutu): K1, K2, K5, K6, K7, K8, K9, K10, K11, K12, K13, K14, K15, K16,
**K17**, K21, K22, K23, K24, **K25** (**20**).
~: K3 (pola mają źródła w modelu importu, writerów nie zweryfikowano), K4 (2 sekcje
znikają poprawnie), K19 (**3**).
Niemierzone na żywo: K20, K26, K28, K29, K30 — **brak rekordu, §0.1**.

## §7. Luki → naprawa

| # | luka | rozmiar | decyzja właściciela? |
|---|---|---|---|
| L1 | 3 × `primary-*` → tokeny `c-*` (K17 — jedyne naruszenie czerwieni w module) | **S** | nie |
| L2 | 11 angielskich literałów → `t()` z kluczami pl+en (K25) | S | nie |
| L3 | paleta `navy/slate/emerald/blue/amber` → tokeny `c-*` | M | nie |
| L4 | powłoka: Menu 4 + Menu 5 + prawy panel wg §2 | L | nie |
| L5 | katalog sekcji sterujący renderem (K1+K2) | M | nie |
| L6 | „Pracuj z AI" ×3 na streszczeniu i mapowaniu pól | M | nie |
| L7 | wejście do `REJESTR_KART_N` + wiersz K24 | S | nie |
| L8 | **pomiar na żywo wg §0.1** przed odbiorem czegokolwiek | S | nie |
| L9 | czy import PDF zostaje w MVP | S | **TAK — jedyne pytanie** |

**Pytanie do właściciela (1):** import raportu z PDF nie ma dziś ani jednego rekordu
i jest najbardziej odległą od kanonu kartą modułu (3 × crimson, 11 angielskich napisów,
paleta sprzed `c-*`). Czy zostaje w MVP jako droga wejścia dla klientów z gotowym
raportem (wtedy L1+L2 są obowiązkowe przed demo — rekomendacja CTO), czy chowamy
przycisk „Wgraj PDF" do Fali 2 i nie polerujemy tej karty teraz?

## §8. Aliasy

Brak. Pozostałe wiersze zakładki „Raporty" (`subType` ≠ `imported`) prowadzą do Report
Buildera (`/reports/builder/:id`) — to karta modułu Materiały (partia B3), nie ta.
