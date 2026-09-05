# Odbiór na żywo — pakiet 12-spotkania (moduł Spotkania)

Zgodne: 3 / Różnią się: 0 / Nie dotarłem: 0 (razem 3)

## Różnice
Brak.

## Nie dotarłem
Brak — wszystkie 3 ekrany osiągnięte i zgodne.

## Czas i trudności
- Obraz zatwierdzony dla `calendar-sync-settings` wskazany w pakiecie jako `__PRZED__light.png` jest uszkodzony/źle przechwycony (2880×11474px, 5,5MB — zrzut nieistniejącej listy tras deweloperskich, nie ekranu ustawień). Do porównania użyto obrazu `__PO__light.png` z tego samego katalogu (ten sam ekran, też oznaczony jako zaakceptowany).
- `public-booking-widget` wymagał znalezienia realnego identyfikatora konsultanta (`slug` organizacji) — namierzono go przez bezpośrednie odpytanie publicznego API (`/api/public/booking/{slug}/availability`), próbując `dbr77` (nazwa organizacji widoczna w ustawieniach profilu).
- Sesja logowania automatu wygasła w trakcie prac nad wcześniejszym pakietem (03-wywiad) i odświeżyła się samoczynnie — tutaj nie wystąpił już ten problem.
- Zajęło około 25 minut.
