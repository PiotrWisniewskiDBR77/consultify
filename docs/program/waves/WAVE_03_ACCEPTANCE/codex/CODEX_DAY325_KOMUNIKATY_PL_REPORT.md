# CODEX DAY 325 — komunikaty biznesowe po polsku

Stan bazowy: marker `1c3d3da844ae03c87985a8f5dc74846a073c0220`, gałąź robocza
`codex/day325-komunikaty-pl-20260904`.

## R1 — jedno źródło prawdy komunikatu

Werdykt: **serwer jest jedynym źródłem prawdy tekstu komunikatu biznesowego**.

Uzasadnienie na markerze:

- `AppError.isOperational` jest ustawiane bezwarunkowo na `true`; zmierzono 203 wywołania
  `new AppError(` poza testami. `OPERATIONAL_MESSAGES` ma 4 kody, więc serwer musi centralnie
  rozliczać komunikaty operacyjne zamiast pozostawiać surowy angielski tekst w 203 miejscach.
- przeglądarka nie pozwala wiarygodnie ustawić `Accept-Language`, lecz front już wysyła
  `X-App-Language`, a CORS go dopuszcza. Serwer może więc wybrać język, czytając najpierw
  `X-App-Language`, a potem `Accept-Language`.
- `readAppErrorCode` zna 7 kodów i nieznany kod sprowadza do `INTERNAL`. Dlatego front nie może
  wybierać tekstu `INTERNAL`, gdy koperta zawiera konkretny komunikat serwera.

**W związku z tym po drugiej stronie PRZESTAJEMY zastępować komunikat dostarczony przez serwer
tekstem katalogowym `INTERNAL`; front zachowuje tylko angielski fallback na przypadek, gdy serwer
nie dostarczył żadnego komunikatu.** Nie tworzymy drugiego słownika tych samych komunikatów we
froncie.

### Pomiar wejściowy

```text
1c3d3da844ae03c87985a8f5dc74846a073c0220
status --short: pusty
MARKER OK
mapAppErrorResponse(: 378
mapAppErrorResponse(..., undefined: 106
MESSAGES / OPERATIONAL_MESSAGES: 7 / 4
new AppError( poza __tests__: 203
handleResponse(res, w src/services/api.ts: 1003
```

Tip `github-backup/grafika/m03-20260902` uciekł do przodu wyłącznie o pakiet instrukcji
dyżurów 324–333; zgodnie z `DEC-2026-08-26-95` praca pozostaje na markerze.

## Korekty wobec instrukcji

- `§0.2b(2)` wymaga dowodów przed pierwszym przebiegiem zapisującym, ale dowód z tabeli
  `settings` jest wykonalny dopiero po migracjach, a `§0.2c(A)` nakazuje migracje przed pomiarem.
  Wybrano bezpieczniejszą interpretację: nie ustawiono konfiguracji poczty, uruchomiono wyłącznie
  migracje, a natychmiast po nich potwierdzono brak zmiennych pocztowych, 0 rekordów `smtp%` i brak
  drenów w `Gateway`.
- Dokument odwołuje się do struktury `§R.2`, lecz w odczytanym pliku (1019 linii) nie ma sekcji
  definiującej tę strukturę. Raport zachowuje wszystkie jawnie wymienione obowiązkowe elementy R6.

## TWIERDZENIA NIEZWERYFIKOWANE

- R2–R6 nie są jeszcze zweryfikowane na etapie commitu R1.
