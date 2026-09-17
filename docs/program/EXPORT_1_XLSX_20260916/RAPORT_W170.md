# EXPORT-1 XLSX — poprawka po W170

Data: 2026-09-16
Tor: B
Właściciel: Codex-2

## Wynik

Zamknięto trzy P1 z W170:

1. Table Studio formatuje `multiSelect`, `linkedRecord` i `attachment` przez
   `formatFieldValue`; szerokość kolumny bierze pod uwagę treść.
2. Wszystkie wejścia Materials używają pełnoschematowego adaptera kanonicznego.
   Pobranie zachowuje CF, data validation, scalenia, Info i named ranges.
3. Style różnicowe scorecard zapisują solid fill jako `bgColor`; realny render
   LibreOffice pokazuje czerwone i zielone trendy.

Domknięto również wskazane P2: jawny profil, `Supplier scorecard`, brak cichej
podmiany E/H/I/J w Table Studio, Arial jako portable fallback, escapowanie `&`
w nagłówkach oraz miarodajny automat parytetu z kontrolą OOXML i CF. Test HTTP
Table Studio działa na Node 24 przez wbudowany SQLite, bez martwego natywnego
bindingu.

## Dowody

- 50/50 focused unit/route PASS, w tym 4/4 HTTP Table Studio artifact/export.
- 7/7 kontrakt workflow E2E PASS i wołacz działa w jobie `aggregate`.
- TypeScript server PASS.
- Parytet 13/13 PASS.
- LibreOffice: 2 strony wyrenderowane; `data.png` obejrzany, Trend ma poprawne
  czerwone i zielone kolory, brak ucięć i nakładania.
- Artefakt i PNG mają odświeżone SHA-256 w `evidence/artifact-sha256.txt`.

## Granica

Nie wykonano integracji z chronioną linią. Paczka wymaga niezależnego odbioru.
