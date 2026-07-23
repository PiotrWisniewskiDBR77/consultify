---
id: ART-020
tytul: Insight — edytowalne pole treści per sekcja + Rezultaty w prawym panelu
typ: zadanie
waga: wysoka
obszar: ART
narzedzie: Insight
stan: do-odbioru
wlasciciel: wykonawca
blokuje: []
zablokowane_przez: []
zrodlo: "Piotr 2026-07-23 — dwie decyzje właściciela (pole ręcznej edycji per sekcja; kafle Rezultatów do panelu, pozycja 5)"
utworzone: 2026-07-23
ekran: karta-insight
wysokosc: 900
klik: "Przełącz Edycja/Podgląd. W Edycji: pisz w polu nad treścią sekcji, przeciągnij uchwyt, kliknij fioletowe AI. W panelu rozwiń REZULTATY."
---

## 1. CO SIĘ ZMIENIŁO

**Decyzja 1 — pole do ręcznej edycji w każdej sekcji.** Do dziś treść Insightu była
wyłącznie generowana przez AI i tylko-do-odczytu; przycisk „Edytuj" w pasku karty
otwierał CZAT, czyli prośbę do modelu, a nie edycję. Teraz nad treścią każdej
sekcji stoi realne pole: automatyczne dopasowanie wysokości, ręczny uchwyt z
pamięcią wysokości i powrotem do auto, fioletowy przycisk AI (propozycja przed
zapisem — nigdy ciche nadpisanie), tryb Podgląd bez uchwytu, AI i ramek. Tekst
zapisuje się na wniosku OSOBNO od treści z AI, więc regeneracja go nie kasuje.
„Edytuj" w pasku karty stawia teraz kursor w tym polu; czat został w nagłówku i
toolbarze.

**Decyzja 2 — Rezultaty w prawym panelu.** Kafle „Rozpocznij decyzję" /
„Konwertuj na inicjatywę" / raport / prezentacja / tabela / idea / notatka
zjechały z centrum do sekcji **Rezultaty w prawym panelu, na pozycję 5**
(Akcje · Właściwości · Powiązania · Źródła i założenia · **Rezultaty** ·
Komentarze · Historia). Z centrum ZNIKNĘŁY — bez dublowania. Pod kaflami został
rejestr „Już powstało".

Przy okazji, znalezione renderem: kafel „Rozpocznij decyzję" pokazywał SUROWY
klucz tłumaczenia (brak wpisu w pl i en) — naprawione; sekcja panelu pokazywała
angielskie „RESULTS" — naprawione.

## 2. NA CO PATRZEĆ

1. **Edycja** — nad treścią sekcji jest pole z nazwą sekcji i podpowiedzią; da się
   pisać, przeciągnąć uchwyt w prawym dolnym rogu, wrócić do auto-dopasowania.
2. **Fioletowy AI przy polu** — proponuje treść, nie wstawia jej po cichu.
3. **Podgląd** — pole bez ramki, bez uchwytu, bez AI; pusta sekcja nie pokazuje
   pustego okienka.
4. **Prawy panel** — kolejność sekcji i to, że REZULTATY są piąte, a kafle są
   TAM, a nie w centrum. Lewa nawigacja nie ma już pozycji „Rezultaty".
5. **Analizuj z AI** — sprawdź, że otwiera panel „Analiza AI / aktywna karta"
   (Braki · Ryzyka · Sugestie · Proponowane zmiany), a NIE czat.
6. Ciemny i jasny motyw.

## 3. RYZYKO / DO DECYZJI

- ★ **Migracja bazy NIEURUCHOMIONA.** Zapis ręcznej treści potrzebuje nowej,
  dodatkowej kolumny `interview_insights.section_overrides`. Plik migracji
  `server/migrations/931_interview_insight_section_overrides.sql` jest gotowy,
  ale NIE został uruchomiony na żadnej bazie. Kod ma zabezpieczenie, które
  dokłada kolumnę sam przy pierwszym zapisie — decyzja, czy zostawiamy to
  zabezpieczenie, czy najpierw ręcznie puszczamy migrację, należy do nadzorcy.
- **„Konwertuj na inicjatywę" jest teraz w dwóch miejscach**: jako główny
  przycisk w nagłówku (kreator inicjatywy) i jako kafel w Rezultatach
  (natychmiastowe utworzenie). To dwie różne ścieżki o tym samym celu. Standard
  mówi „w Rezultatach, jeśli nie zostaje w nagłówku". Nie usunąłem kafla sam,
  bo to odebranie działającej zdolności — **do rozstrzygnięcia przez Piotra**.
- **Czy ręczna treść ma WYPIERAĆ blok wygenerowany przez AI** w Podglądzie,
  eksporcie i PDF? Dziś leży NAD nim, nie zamiast niego. Decyzja produktowa —
  nie domyślałem jej kodem.
- Gałąź `feat/insight-edytowalne-pola` (baza `origin/demo`), **nie wypchnięta**,
  nic nie poszło na demo.
