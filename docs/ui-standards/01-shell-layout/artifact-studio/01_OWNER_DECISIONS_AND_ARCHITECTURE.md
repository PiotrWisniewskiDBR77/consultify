# Decyzje właścicielskie i architektura Artifact Studio

## 1. Zamknięte decyzje

1. Budujemy teraz otwarte dokumenty, prezentacje i skoroszyty. Szablony wrócą
   jako osobny program.
2. Nie budujemy kopii Office. Budujemy zarządzany workspace Consultify z
   profesjonalnym minimum ręcznej edycji i nawykami Office.
3. Menu 1 jest globalnym shellem Consultify i nie otrzymuje żadnej funkcji
   artefaktu.
4. Menu 2 jest jednoliniowym nagłówkiem całego artefaktu.
5. Menu 3 jest jedynym dynamicznym paskiem pracy. Zależy od zaznaczenia.
6. Nie istnieje stały przycisk Teresy ani lokalny AI Editor w Menu 3.
7. Prawa strona jest wyłącznie globalną Teresą, identyczną jak w pozostałej
   aplikacji. Rozmowa trwa między ekranami.
8. Standardowy skrót Teresy w bottom barze zostaje. W PPT zostają również
   Notatki.
9. Istnieje jeden przełączalny panel po lewej. Jego tryby zastępują rozproszone
   narzędzia dokumentu.
10. Menu prawego przycisku jest kontekstowe, Office-like i korzysta z tego
    samego rejestru komend co Menu 3.
11. `Przekaż Teresie` jest kontekstowym przekazaniem jawnego zaznaczenia do
    globalnej rozmowy; nie wykonuje automatycznej mutacji.
12. Jedna funkcja ma jedno miejsce kanoniczne. Skrót, kebab i context menu są
    aliasami tej samej komendy.
13. Nie pokazujemy niedziałających ikon ani placeholderów „wkrótce”.
14. Dokument lub arkusz zaczyna się bezpośrednio pod paskami pracy; techniczne
    karty i powtórzone tytuły nie odsuwają canvasu.
15. Publiczny link jest możliwy wyłącznie dla klasyfikacji `Public`.
16. Eksport roboczy jest dozwolony i jawnie oznaczony jako szkic. Eksport
    finalny podlega QA i aktualnemu approval.
17. Autor nie może samodzielnie zatwierdzić własnej wersji.
18. Restore tworzy nową wersję i nigdy nie kasuje późniejszej historii.
19. PPT ma jedno `Prezentuj` z opcjami: od bieżącego, od początku i Widok
    prezentera.
20. XLSX eksportuje w P0 do XLSX. PDF jest P1.

## 2. Anatomia ekranu

```text
Menu 1 — globalny shell Consultify, bez zmian
Menu 2 — artefakt: powrót, nazwa, zapis, klasyfikacja, lifecycle, share, primary, więcej
Menu 3 — dynamiczne komendy aktualnego zaznaczenia
──────────────────────────────────────────────────────────────────────────────
Lewy panel          Canvas domenowy                         Globalna Teresa
DOC: struktura      DOC: dokument                           jedna rozmowa
PPT: slajdy         PPT: slajd                              screen context
XLSX: arkusze       XLSX: siatka + formula bar              selection chip
──────────────────────────────────────────────────────────────────────────────
Bottom bar — pozycja, widok, zoom, Teresa; PPT także Notatki
```

Stałe ograniczenia:

- maksymalnie trzy stałe poziome warstwy menu;
- maksymalnie jeden panel po lewej;
- prawa strona nie hostuje właściwości, QA, historii ani drugiego czatu;
- narzędzia zarządzania artefaktem otwierają tryb lewego panelu lub kontrolowany
  drawer/flow, nigdy równoległy rail ściskający canvas;
- Menu 2 nie zawija się do drugiego wiersza;
- Menu 3 nie tworzy ribbonu ani czwartego toolbara.

## 3. Menu 2

Stała kolejność:

`Powrót | typ/breadcrumb | nazwa | zapis | klasyfikacja | lifecycle | obecność | Udostępnij | primary | Więcej`

Primary:

- DOC: `Eksportuj`;
- PPT: `Prezentuj`;
- XLSX: `Eksportuj`.

Do `Więcej` trafiają: komentarze, źródła i założenia, QA i review, historia,
właściwości oraz formatowe funkcje rzadkie. Nie trafiają tam duplikaty Share,
Export ani Teresa.

## 4. Lewy panel

Panel jest jednym kontenerem z wymiennymi trybami:

| Tryb | DOC | PPT | XLSX |
|---|---|---|---|
| Struktura | sekcje | slajdy | arkusze |
| Źródła i założenia | P0 | P0 | P0 |
| Komentarze | P0 | P0 | P0 |
| QA i review | P0 | P0 | P0 |
| Historia/wersje | P0 | P0 | P0 |
| Właściwości | P1 | P1 | P0 |

Jednocześnie otwarty jest jeden tryb. Akcje elementu są w kebabie i menu
kontekstowym, nie w stale widocznym rzędzie przy każdym elemencie.

## 5. Teresa

Globalna Teresa otrzymuje automatyczny kontekst ekranu, ale jawne zaznaczenie
jest przekazywane jako usuwalny chip zawierający co najmniej:

- artifactId i type;
- immutable/current versionId;
- classification i lifecycle;
- selection type i stabilne ID/zakres;
- tylko źródła, do których użytkownik ma dostęp.

Zmiana AI przebiega zawsze:

`propozycja → podgląd/diff → Akceptuj/Odrzuć → zapis nowej rewizji → undo/historia`

AI nie nadpisuje zablokowanych slajdów lub obiektów. Nie wysyła zaznaczenia bez
jawnej czynności użytkownika.

## 6. Responsive i arbitraż przestrzeni

- `>=1600`: lewy panel i Teresa mogą współistnieć, jeśli canvas zachowuje
  minimum domenowe.
- `1280–1599`: otwarcie Teresy może automatycznie zwinąć lewy panel.
- `<1280`: tylko jeden panel boczny naraz; panel działa jako overlay/drawer.
- minimum canvasu: DOC 680 px, PPT 760 px; XLSX nie może utracić czytelnej siatki
  i dopuszcza poziomy scroll.
- zamknięcie panelu nie zmienia zaznaczenia, zoomu ani rozmowy.

## 7. Lifecycle, klasyfikacja i eksport

Lifecycle: `Szkic → Do przeglądu → Zatwierdzony → Finalny`.

Klasyfikacja: `Public | Internal | Confidential`; domyślnie `Internal`.
Obniżenie klasyfikacji wymaga uprawnienia, potwierdzenia, uzasadnienia i audytu.

Eksport:

- `Draft`: dozwolony dla uprawnionego użytkownika, z watermarkiem/metadanymi;
- `Final`: blokowany przez krytyczne QA lub brak aktualnego approval;
- override: wyłącznie uprawniona rola, obowiązkowe uzasadnienie i audyt;
- override nie może ominąć klasyfikacji dla publicznego kanału;
- eksport wskazuje immutable versionId i manifest wyniku.

## 8. Zasada wspólności

Współdzielimy shell, semantykę komend, governance, uprawnienia, audyt, Teresę,
QA envelope, komentarze, wersje i eksport. Nie współdzielimy domenowych store'ów,
rendererów, selection models ani mutation payloads TipTap, deck/cards i workbook.
