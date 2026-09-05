# Brak zrzutu PO — zablokowane brakiem ODBIOR_AUTH_STATE

Zrzut ekranu (409 + przycisk „Przejdź do Pochodzenie i prawa") NIE powstał w trakcie tego
zlecenia: `/private/tmp/odbior-auth/auth.json` nie istniał (wymaga samodzielnego logowania
właściciela w oknie przeglądarki, `scripts/dev/odbior-zywo/zaloguj.mjs`) i nie pojawił się mimo
odczekania (Monitor, do 4 minut).

Pełny opis blokera, gotowa komenda do dokończenia zrzutu i zastrzeżenie co zrzut może/nie może
udowodnić: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/AGENT_WZORCE_SYSTEMOWE_ATESTACJA_20260905.md`,
sekcja 4.

Dowód naprawy serwerowej (bramka provenance) jest mutacyjny na realnej Postgresie — sekcja 2
tego samego raportu — i nie zależy od tego zrzutu.
