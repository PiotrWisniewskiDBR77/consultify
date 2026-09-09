# D-15 — ręczna ścieżka tworzenia inicjatywy

## Pomiar 1: formularz ISTNIEJE i nikt go nie wołał
`InitiativesHub.tsx` ma pełne okno „Create new initiative" (~235 linii:
walidacja tytułu, ostrzeżenie o duplikacie, wybór poziomu, osi, podsumowania,
zapis przez `createInitiativeWriteTruth`, dopisanie do portfela z odsłonięciem
nowego wiersza). Sterowane stanem `showNewModal` (linia 363).

`grep -n "setShowNewModal"` przed naprawą: **cztery trafienia i ani jednego
`setShowNewModal(true)`** — same zamknięcia. Kształt „zbudowane, ale
niepodłączone": brakowało JEDNEGO przewodu, nie funkcji.

## Naprawa: podłączony przewód (kanon, nie obejście)
CTA „New initiative" dostał kanoniczny wariant z menu
(`StandardPrimaryCta.menu`, TRIADA §A2/§C4 — ten sam, którego używa „Dodaj
raport" w Realizacji): „Fill in the form" i „AI initiative wizard".

Drugi brak, znaleziony dopiero przy klikaniu na żywo: formularz podawał
`projectId: currentProjectId || ''`, a `createInitiativeWriteTruth` odrzuca
pusty projekt („Canonical initiative creation requires projectId and
initiativeOwnerId"). Na koncie Northwind zmierzyłem w magazynie przeglądarki
`currentProjectId: null`, `projects: 0`, więc zapis NIE MIAŁ PRAWA przejść —
niezależnie od podłączenia. Formularz dostał więc ten sam wspólny komponent,
którego od dawna używa kreator AI: `RequiredProjectPicker` (lista z
`GET /api/projects`, dla tej organizacji dwie realne pozycje).

## ★ STOP — po podłączeniu zapis DALEJ nie przechodzi (defekt serwera)
Przeklikane na żywo: okno otwiera się, projekt wybrany, „Create" wciśnięte →
`POST /api/initiatives/runtime-v1/source-proposals` **500**
`INITIATIVES_EXECUTION_RUNTIME_FAILED`, bez słowa o przyczynie. Odtworzone
także z `curl` na pełnym, poprawnym kształcie żądania (walidacja przechodzi,
dopiero runtime pada). W bazie kopii nie powstaje żaden wiersz.

Co JUŻ sprawdziłem, żeby nie szukać drugi raz:
- wszystkie siedem tabel runtime (`ie_aggregate_state`, `ie_command_receipts`,
  `ie_aggregate_relations`, `ie_audit_events`, `ie_initiative_card_catalog`,
  `ie_initiative_card_selection`, `ie_initiative_card_versions`) **istnieje**
  w bazie — to nie brak migracji;
- błąd jest połykany: `postgresMaterialCommandUnitOfWork.ts` mapuje tylko
  `23505` na regułę domenową, każdy inny wyjątek leci dalej i wychodzi jako
  gołe 500 bez przyczyny (ten plik sam to opisuje w komentarzu przy linii 691);
- ta sama trasa obsługuje ZAPIS KREATORA AI (`InitiativeWizardModal` woła
  `createInitiativeWriteTruth`), więc **defekt blokuje OBIE ścieżki**, nie
  tylko ręczną.

SPROSTOWANIE RAPORTU: „API działa" dotyczyło ZASTANEJ trasy
`POST /api/initiatives`. Interfejs jej nie używa — pisze przez kanoniczną
`runtime-v1`, a ta zwraca 500. Czyli: z interfejsu nie da się dziś utworzyć
inicjatywy ŻADNĄ drogą, nie tylko „brakuje ręcznej".

Osobny dyżur: (1) wyprowadzić przyczynę 500 na zewnątrz zamiast połykać ją
w `INITIATIVES_EXECUTION_RUNTIME_FAILED`, (2) naprawić samą przyczynę.

## Do decyzji właściciela
Zmiana jest widoczna: jedno kliknięcie „New initiative" otwiera teraz
rozwijane menu zamiast od razu kreatora. Do akceptu na zrzutach
(`po/jasny.png`, `po/ciemny.png`, `po/*-formularz.png`) przed pokazem.
