# Odbiór na żywo — pakiet 19-logowanie (ekrany przed zalogowaniem)

Zgodne: 5 / Różnią się: 0 / Nie dotarłem: 0 (razem 5)

## Różnice
Brak.

## Nie dotarłem
Brak — wszystkie 5 ekranów osiągnięte i zgodne.

## Czas i trudności
- Użyto własnego skryptu Playwright BEZ storageState (świeży kontekst, colorScheme light, viewport 1440x900) zgodnie z instrukcją — brak logowania nie był potrzebny.
- `/reset-password` bez parametru `token` poprawnie pokazuje błąd "Nieprawidłowy lub brakujący token resetu" (czerwień zasadna, bo to prawdziwy błąd) — żeby zobaczyć właściwy formularz "Ustaw nowe hasło" (jak w obrazie zatwierdzonym), trzeba było dodać dowolny niepusty `?token=...` do URL — kod strony sprawdza tylko OBECNOŚĆ parametru przed renderem formularza, realną poprawność tokenu waliduje dopiero backend przy wysyłce, której nie wykonano. To nie jest obejście zabezpieczenia — sama strona resetu nigdy nie waliduje tokenu po stronie klienta.
- Zajęło około 15 minut, bez większych przeszkód.
