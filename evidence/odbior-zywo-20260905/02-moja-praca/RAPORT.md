# Odbiór na żywo 05.09 — pakiet 02 „Moja praca” (31 ekranów)

## Liczby
- ZGODNY: **15**
- ROZNI_SIE: **10**
- NIE_DOTARLEM: **6**

Wyniki per ekran: `evidence/odbior-zywo-20260905/02-moja-praca/wyniki.json`
Zrzuty: ten sam katalog, nazwa pliku = id ekranu (jasny motyw, 1440 px).

## Różnice (10) — po jednym zdaniu
1. **idea-templates-catalog** — zatwierdzony katalog 40 szablonów w 7 nazwanych kategoriach zastąpiony modalem „Galeria szablonów” z chipami-filtrami i 10 kartami (policzone) dla narzędzia Mapa myśli.
2. **idea-table** — sama tabela pomysłów się zgadza, ale po prawej otwiera się panel PODGLĄDU (SZCZEGÓŁY / AI / POWIĄZANIA / CO DALEJ), a nie zatwierdzony akordeon artefaktu (AKCJE / WŁAŚCIWOŚCI / POWIĄZANIA / ŹRÓDŁA / KOMENTARZE / HISTORIA).
3. **idea-table-tool-empty-filter** — filtr bez trafień w tabeli z 6 wierszami pokazuje stan „Tabela jest jeszcze pusta”, czyli komunikat „brak rekordów w ogóle” zamiast „brak wyników filtra”.
4. **idea-table-tool-grouping** — grupowanie działa (CENTER/BRANCH), ale siatka nie ma wiersza filtrów per kolumna ani kontrolki „Gęstość wierszy” z obrazu.
5. **idea-table-tool-sortfilter** — sortowanie i jedno globalne pole filtra są, brak filtrów per kolumna i gęstości wierszy.
6. **idea-table-record-templates** — „Szablony” w menu „Więcej narzędzi” otwiera galerię szablonów TABEL, a rozwinięcie przy „Wiersz” — listę typów wiersza; menedżera „Szablony rekordów” z „+ Nowa” nie udało się otworzyć.
7. **idea-confidentiality-control** — selektora poufności nie ma; cały prawy panel idei z obrazu (PROBLEM / STATUS / MODEL DOJRZAŁOŚCI / ISKRA) zastąpiła powłoka MELS z szyną sześciu paneli po lewej.
8. **mywork-notebook-rail-speca** — szkielet akordeonu ten sam, ale blok AKCJE to lista tekstowa zamiast przycisku podstawowego + obwiedzionego, nagłówek pokazuje tytuł notatki, a WŁAŚCIWOŚCI są dużo bogatsze niż na obrazie.
9. **karta-decision** — układ identyczny, ale GET /api/decisions/&lt;id&gt;/history zwraca 404 (2×), więc sekcja HISTORIA nie ma danych; doszedł przycisk „Wyślij do przeglądu”.
10. **decision-record** — ten sam komponent i ten sam błąd 404 na historii decyzji.

## Nie dotarłem (6) — z powodem
1. **notatnik-centrum-mysli** — obraz zatwierdzony jest bitowym DUPLIKATEM obrazu `mywork-notebook-rail-speca` (md5 `93144187fc956bcb4640786c66c1409f`); nie ma z czym porównywać.
2. **mywork-idea-inspector-lekki** — obraz zatwierdzony jest bitowym DUPLIKATEM obrazu `ideas-teresa-panel` (md5 `bb9f9ada46cf8023cf3b34ddc5c45863`); realny lekki inspektor istnieje i zgadza się z opisem, ale nie z obrazem.
3. **ideas-teresa-panel** — ten sam duplikat co wyżej; obraz nie pokazuje żadnej sekcji Teresy.
4. **idea-table-tool-kebab** — obraz to strona dev-render bez widocznego menu, a w aplikacji tabela działa na innym silniku (klik w wiersz otwiera edytor komórki, nie kebab).
5. **idea-table-tool-paste** — test wklejania zapisałby dane do realnej tabeli właściciela; instrukcja zabrania tworzenia/edycji rekordów.
6. **exec-summary-onelook** — brak wejścia: Menu 1 Realizacji ma pięć zakładek bez „Kokpitu”, a `/execution?tab=summary&ff_summaryOneLook=1` przekierowuje na `tab=list`.

## Znaleziska poboczne (poza porównaniem obraz↔ekran)
- **Tabela sejfów**: po otwarciu podglądu tekst kolumny NAZWA nachodzi na wartość kolumny ZAKRES (nakładające się napisy).
- **Case finansowy** jest w kodzie i wygląda 1:1 jak obraz, ale w menu pojawia się dopiero po ręcznym `?ff_ideaFinancialCase=1` — właściciel bez tego zobaczy „brak funkcji”.
- **Kalendarz**: 1× HTTP 501 na `/api/integrations`; Google Calendar i Outlook są niepodłączone (checkbox + „Connect in Integrations”), więc karty źródeł wyglądają inaczej niż na obrazie.
- **Tabela pomysłu**: sporadycznie (1 na ~4 wejścia) renderuje się przez >10 s pusta powłoka „0 rekordów” zanim wczyta wiersze.
- **Konsola**: stałe 2× HTTP 404 na `/api/my-work/my-ideas/<id>/map/candidate` na każdym wejściu w kanwę idei oraz 1× HTTP 409 na `/map/sync` przy przełączeniu na Tabelę.

## Ile czasu i co było trudne
Około 2,5 godziny. Trudności:
1. **Obrazy odniesienia to w większości zrzuty harnessu dev-render, nie ekrany aplikacji** — trzeba było za każdym razem rozstrzygać, czy różnica jest w produkcie, czy tylko w przyrządzie (powłoka, Menu 2, breadcrumb).
2. **Dwa obrazy zatwierdzone okazały się duplikatami innych** (sprawdzone md5) — cztery ekrany straciły odniesienie.
3. **Wygasła sesja automatu** pod koniec pracy (401 na `/api/auth/refresh`, przekierowanie na `/login`) — pakiet 02 zdążył się domknąć, ale odnowienie wymaga ręcznego logowania właściciela.
4. **Katalog skryptów `/private/tmp/odbior-zywo-skrypty/` jest współdzielony** z innym odbiorcą i moje skrypty zostały z niego usunięte w trakcie pracy; przeniosłem je do podkatalogu `02-moja-praca/`.
