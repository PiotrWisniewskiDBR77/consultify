---
doc_id: funkcje-dowod-trzy-pliki
status: canonical
owner: piotr
truth_type: runtime
established: 2026-09-01
---

# Trzy realne pliki — pierwszy uczciwy pomiar największej obawy właściciela

Obawa właściciela brzmi: *nigdy nie powstał ani jeden naprawdę dobry dokument z szablonu.*
Do dziś mieliśmy o tym **twierdzenia**, nie pliki. Teraz mamy trzy pliki i przeczytaną treść.

Ścieżka: realny Postgres od zera, realny `Gateway`, realna rejestracja organizacji,
podpisany token, realne trasy produkcyjne. **Nie test — przebieg.**

## ★★ Przyczyna źródłowa: NIE MA KLUCZA DO MODELU JĘZYKOWEGO

To jest odkrycie tego pomiaru i **unieważnia część naszych dotychczasowych wniosków**
o „słabych generatorach". W tym środowisku nie ma żadnego klucza do modelu. Logi pokazują
**realne, nieudane wywołania**: brak klucza → pięć błędów → bezpiecznik się otwiera →
„brak dostępnego modelu".

**To jest jednocześnie dowód, że rozmawialiśmy z prawdziwym kodem, a nie z atrapą** —
kod poprawnie próbował i poprawnie się wysypał. Gdyby to była atrapa, „zadziałałoby".

**Wniosek: dwa z trzech generatorów nie były oceniane. Były oceniane ich awaryjne
zastępniki.** Dopóki nie powtórzymy tego z kluczem, **żadna ocena jakości dokumentu
i prezentacji nie jest wiążąca** — ani ta zła, ani przyszła dobra.

## 1. ARKUSZ (XLSX) — **DZIAŁA. Pierwszy artefakt tej klasy w programie**

Wycena metodą zdyskontowanych przepływów. Silnik **deterministyczny, bez modelu językowego** —
dlatego brak klucza mu nie zaszkodził.

- **Formuły są realnymi formułami**, nie wklejonymi liczbami — sprawdzone komórka po komórce.
- **Plik przeliczony w niezależnym programie biurowym**: wartość kapitału ≈ 53,7 mln,
  ≈ 107,47 na akcję — **zgodne z ręcznym przeliczeniem**.
- Własna kontrola jakości: 100 na 100, zero uwag.

**Werdykt: konsultant mógłby to pokazać klientowi jako model roboczy.**

To jest ważniejsze, niż wygląda: **dowodzi, że produkt POTRAFI wyprodukować dobry artefakt**,
kiedy nie zależy od modelu językowego. Problem nie leży w składaniu plików.

## 2. DOKUMENT (DOCX) — słaby, ale **bezpiecznik zadziałał**

- **432 słowa** · **zdań z konkretem: 0** · **wypełniaczy: 18**.
- Zaszczepione realne fakty klienta trafiły do pliku **wyłącznie jako dosłowny zrzut
  materiału źródłowego**, ze składnią znaczników włącznie — nie jako synteza.
- Fragmenty w treści dla klienta: *„This section is awaiting content…"* (cztery razy),
  *„Risk 1 | Średnie | Wysokie | TBD | Mitigation plan TBD"*, oraz **wyciek nawiasu
  systemowego** *„[Założenie — wymaga źródła]"* do tekstu klienckiego.
- **Angielskie etykiety w dokumencie, który ma być polski.**

**★ Dobra wiadomość: normalny eksport ZOSTAŁ ZABLOKOWANY.** Bramka jakości wykryła
niezgodność języka i za małą gęstość treści i **odmówiła wydania pliku**. Plik powstał
dopiero po **świadomym, audytowanym obejściu** bramki.

**Czyli produkt sam rozpoznał, że to jest zły dokument, i nie chciał go oddać.**
To jest dokładnie to zachowanie, którego oczekujemy.

**Werdykt: nie pokazałbym tego klientowi — i produkt też nie chciał.**

## 3. PREZENTACJA (PPTX) — najgorsza, i **bez bezpiecznika**

- 12 slajdów, **533 słowa**.
- **Ani jeden zaszczepiony fakt** nie trafił na slajd — żadna liczba, nazwa, budżet, data.
- Slajd 10 twierdzi: **„Diagnoza objęła portfel 0 inicjatyw i 0 ryzyk"** — dosłowne zero,
  przy dwóch dostarczonych źródłach z realnymi inicjatywami.
  Przyczyna: `deckConclusionSlide.ts:179-180` liczy wyłącznie ze **strukturalnych tablic**,
  a źródło tekstowe jest dla tej syntezy **niewidoczne**.
- **Własna kontrola dała 99 na 100 i przepuściła eksport.**

**★★ To jest najgroźniejsze znalezisko całego pomiaru: dokument z treścią zastępczą
został ZABLOKOWANY, a prezentacja z jawnie fałszywym zdaniem — PRZEPUSZCZONA z oceną 99/100.**
Bramki jakości **nie są spójne między formatami**. Gorszy artefakt dostał wyższą ocenę.

**Werdykt: nie pokazałbym klientowi. Gorsza od dokumentu, bo nie ma nawet surowych faktów —
i przeszła kontrolę.**

## Cztery defekty zgłoszone, świadomie NIE naprawione
1. `deckConclusionSlide.ts:179-180,266,281-282,321-330` — synteza ignoruje źródła tekstowe,
   produkując fałszywe „0 inicjatyw i 0 ryzyk".
2. `materialExportReceiptService.ts:109` — eksport po pierwszym niepowodzeniu **trwale**
   blokuje ten sam artefakt; trzeba stworzyć nowy, żeby w ogóle dostać plik.
3. `document-studio.routes.ts:832` — realna kolizja klucza unikalnego przy rejestracji
   artefaktu; ponowienie **maskuje** to w logu, ale pierwsza próba pada.
4. **Niespójność bramek jakości między formatami** — patrz wyżej. Do rozstrzygnięcia
   jako dług architektoniczny.

## Co robimy dalej — kolejność wynika z pomiaru
1. **Powtórzyć ten sam przebieg z realnym kluczem do modelu.** Bez tego oceniamy zastępniki.
2. **Wyrównać bramki jakości** — prezentacja musi mieć bramkę tej samej mocy co dokument.
3. **Naprawić syntezę slajdu podsumowania**, żeby widziała źródła tekstowe.
4. Dopiero potem oceniać jakość szablonów rubryką.
