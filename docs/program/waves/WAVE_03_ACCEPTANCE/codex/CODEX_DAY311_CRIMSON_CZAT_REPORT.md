# CODEX DAY 311 — crimson w Czacie

Stan roboczy: R1 wykonane; raport będzie uzupełniany po każdej pozycji.

## §0 — baza i marker

```text
120bb2db81 Merge agent/287-naprawa-20260903 = Codex 287 + naprawa: pierscien fokusu c-focus (174 -> 28 wystapien), VIOLATION_RE przywrocony, baseline zregenerowany 64/45, 6 konfliktow rozwiazanych, test 2/2
24a5739648 instrukcje: paczka nocna czesc 3 (308-311)
...
416432abaf docs: prognoza w czasie AI — G15/G19 04.09, G16 04.09 po poludniu, G20 05.09 (sprostowanie wlasciciela)
MARKER OK
```

```text
416432abafe31a390a909cf7e460a4bad7bef191
status --short: pusty
```

Tip uciekł do przodu; zgodnie z instrukcją praca zaczęła się dokładnie z markera. Pełny log i lista różnic zostaną dołączone w sekcji końcowej.

## R1 — mianownik i stan wejściowy

Pomiar potwierdził 62 pliki i 262 dosłowne wystąpienia `primary-` w `src/components/AIChat` oraz 2550 w całym `src`. Szersze 5325/609/69 liczy trzy aliasy (`primary`, `crimson`, `brand`), dlatego nie jest sprzeczne ze ścisłym mianownikiem dyżuru. Pierścień `focus…primary-`: 289 w całym `src`; sześć plików AIChat pokrywa się z dyżurem 287.

PRZED: focus OK 104/208; artefakt ratchet OK 9/9; list ratchet OK 368/368 na pełnym skanie 157 plików.

## Z30 — dowód przed operacjami zapisującymi

- środowisko: `BRAK ZMIENNYCH POCZTY`;
- tabela `settings`: 0 wierszy `smtp%`;
- `Gateway.ts`: 0 trafień drenaży outboxu.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Korekty wobec instrukcji

- Teza `~296` wystąpień fokusu: pomiar na markerze daje 289.
- Osiem ekranów: jako ósmy wybrano `chat-blad-ai`, bo jawny stan błędu pozwala sprawdzić, czy poprawna semantycznie czerwień pozostała czerwona.

## R2 — klasyfikacja

W tym samym mianowniku co R1 sklasyfikowano 262 dopasowane linie: 6 jako semantyka krytyczna, 244 jako CTA lub stan aktywny i 12 jako pierścień fokusu/pokrycie z dyżurem 287. Pełna tabela plik · linia · PRZED · PO znajduje się w `REJESTR_CRIMSON_CZAT_20260903.md`. Wpisy fokusu pozostają poza zmianami R3.

## R3–R6

Do uzupełnienia.

## Twierdzenia niezweryfikowane

- Zrzuty PRZED/PO, zamiany, esbuildy i bramki PO nie są jeszcze wykonane.
- Gałąź NIE jest scalona i czeka na akcept właściciela na zrzutach.
