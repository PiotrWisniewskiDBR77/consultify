# R3 — kontrola wsteczna i mutacja

## Kontrola wsteczna

Jedyny diff werdyktów względem wejścia:

```diff
- EXE-OWN-005 | BLOKUJE
+ EXE-OWN-005 | NAPRAWIONE
- INI-OWN-001 | BLOKUJE
+ INI-OWN-001 | NAPRAWIONE
```

Żadna inna pozycja nie zmieniła kubełka. Mianownik: 121 przed i po.

## Mutacja wieku SHA

- Cel: `EXE-OWN-005`.
- GREEN: `aa0cefc347` → `SHA_OK`, `NAPRAWIONE`.
- Mutacja: `7b7ec198aa` (starszy niż zgłoszenie 2026-08-23) → `SHA_STARSZY_NIZ_ZGLOSZENIE`, `BLOKUJE`, licznik exit 1.
- Przywrócenie przez kopię poza repo → `aa0cefc347`, `SHA_OK`, `NAPRAWIONE`.
- Po przywróceniu diff w `scripts/dev/p0p1-licznik-e1.mjs` był pusty.

Surowe logi robocze: `/private/tmp/cx-day359-g20-zamkniecie-artefakty/r3-mutacja-stary-sha.out`, `r3-mutacja-przywrocona.out`, `r3-kontrola-wsteczna.diff`.

## Nazwy testów

Przed i po: 21 pełnych nazw, diff pusty; test licznika exit 0 w obu przebiegach.
