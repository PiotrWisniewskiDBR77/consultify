# EXPORT-1 XLSX v2 — RECEIPT W198

Data: 2026-09-17
Tor: B / Codex-2
Baza: `9847032a375a65c64178cdc18b161f9c2e50220a`

## Wynik

READY FOR CTO REVIEW. P1 z W173 jest zamknięty: kolumna Trend renderuje
warunkowe czerwone i zielone tła w LibreOffice, a profil
`consultify-supplier-scorecard` jest osiągalny z Table Studio przez pochodzenie
SHEET-BASE lub jawny, walidowany parametr. Zwykła tabela zachowuje profil
generyczny i własne wartości.

## Dowody

- Exact-lock `@types/node 22.19.3`; server TypeScript RC=0.
- Focused Vitest: 5 plików / 58 PASS; kontrakt E2E aggregate: 10/10 PASS.
- Parytet z zaakceptowaną makietą: 16/16 PASS; LibreOffice zmierzył 6798
  czerwonych i 6756 zielonych pikseli Trend.
- Mutacja `drop-trend-cf`: RC=1 i 4 kontrole RED; render spada do 112/102
  pikseli, poniżej progu 500.
- Front tą samą metodą i na tych samych zależnościach: linia 150 = kandydat
  150; logi byte-identical (`sha256 a0b221476113...`), delta własnych plików 0.
- Nowe pliki produkcyjne ESLint: 0 błędów; wspólne pliki zachowują ratchet
  błędów 35 → 34; `git diff --check`: PASS.
- Oba arkusze wyrenderowane w `docs/program/EXPORT_1_XLSX_20260916/artifacts/`
  zostały obejrzane: brak ucięć i nakładania, kolory Trend są widoczne.

## Granica

Nie wykonano deployu ani zmian środowiska. Paczka nie dotyka plików toru A.
