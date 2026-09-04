# CODEX DAY 365 — podgląd, domknięcie

Stan po R4: `PARTIAL`; R1 i R2 wykonane, R3 wykonane pomiarem i briefami dla
brakujących wejść. Raport końcowy uzupełnia R5.

## R0 — cztery zasady

Przeczytałem, że przyrząd jest przed produktem i wykonałem R1 przed R2.
Przeczytałem, że pytanie o pustą kartę pozostaje otwarte i naprawiłem wyłącznie
dublet 2 → 1. Przeczytałem, że para bajtowo identyczna jest zerem dowodu i
zapisałem trzy takie przypadki jako falsyfikację założenia. Przeczytałem, że
brakującą funkcję wolno dodać tylko do narzędzia jako opt-in; nie dodałem
czwartej zmiany ani własnego skryptu zrzutowego.

## R4 — pytanie o pustą kartę

SSOT zawiera wzajemnie wykluczające się wymagania:

- `docs/ui-standards/TRIADA_KANON.md:70`: „5. **Relations:** klikalne pigułki albo „No relations".”
- `docs/ui-standards/TRIADA_KANON.md:132`: „- [ ] 29. Relations albo „No relations"”
- `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md:337`: „2. **Relations** (blok 5 TRIADY, jeśli są): **2 wiersze stałej wysokości** (`min-h-[4.5rem]`), pills klikalne (kolor typu w tekście, nie tło), „+N more".”

Pierwsze dwa zapisy wymagają bloku także bez danych; trzeci ogranicza go do
przypadku, gdy relacje istnieją. Nie zmieniłem żadnego z tych dokumentów.

Pytanie rozstrzygalne: **czy pojedyncza karta „Brak powiązań” ma pozostać na
każdym ekranie, który nie przekazuje żadnych relacji — TAK czy NIE?**

Zmierzony koszt odpowiedzi:

- `TAK`: w 15 kontekstach mających wynik PO karta występuje 15/15 razy i zajmuje
  po 107 px; to 1605 px zsumowanej pionowej powierzchni na jeden motyw. Nie
  usuwa treści z DOM, ale odbiera miejsce w widocznym panelu i zwiększa
  przewijanie. Szesnasty kontekst (`audyt-findings`) nie ma poprawnego PO, więc
  jego koszt pozostaje `NIEZMIERZONY`.
- `NIE`: na zmierzonych ekranach bez danych odzyskujemy 107 px na podglądzie;
  tracimy jednak jawny komunikat, że relacji nie ma. Dokładnej liczby wszystkich
  ekranów produktu bez relacji nie wyprowadzam z 15 kadrów — pozostaje
  `NIEZWERYFIKOWANA`.
- Trzecia możliwość do decyzji: pokazywać blok tylko wtedy, gdy moduł deklaruje,
  że relacje są semantycznie właściwe dla tej encji, nawet jeśli lista jest
  pusta. Koszt implementacyjny wymaga nowego kontraktu propsów i osobnego
  inwentarza modułów; nie został zmierzony i niczego takiego nie wdrożyłem.

## Git po pozycjach

- R1: `725b13d963` — deklaracja trzech zmian narzędzia.
- R2: `3988cd683a` — dublet Finansów 2 → 1 wraz z dowodami.
- R3: `49051930ac` — ponowny pomiar trzech kontekstów i briefy brakujących wejść.
