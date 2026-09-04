# Dyżur 335 — R4, klasyfikacja czerwieni

## Day277: przestarzały payload

Kontrakt `server/src/validators/decision.validators.ts:210-220` wymaga pola `escalation`, które jest nullable, ale nieopcjonalne. Instrukcja błędnie wskazywała nieistniejący katalog `server/src/schemas/`; realny kontrakt leży w `server/src/validators/decision.validators.ts`.

Do payloadu testu dodano `escalation: null`; nie zmieniono schematu ani asercji.

- po korekcie: 2/2 GREEN, `day277-fixed-green.json`, SHA-256 `79be780e8b54b28e2e2b5a034fc51d0afcb5eb9fc93099e9daf3fa6743743fb6`;
- mutacja przez usunięcie pola: 0/2, pełne nazwy obu czerwonych przypadków: `Day 277 decision enhancements through ApiGateway and PostgreSQL owner writes all five fields, SQL sees them, and detail reads them back` oraz `Day 277 decision enhancements through ApiGateway and PostgreSQL foreign tenant cannot see or overwrite the decision enhancements`; walidator zwrócił `escalation: expected record, received undefined`; SHA-256 `dbfc5c945bbf3a1b07a86c3754d66f46e65b27099ce3eb194bea472d8a2b0fe0`;
- przywrócono poprawiony payload przez `cp`.

Pułapki §0.2e: test używa realnego ApiGateway/JWT/PG, pełnego env, `--retry=0`; osobny klient SQL i odczyt GET bronią przed atrapą zapisu. Mutacja walidatora daje RED przed handlerem zgodnie z celem tego kontraktu.

## Cztery czerwienie Bloku 1

W tym dyżurze nie zmieniono żadnego pliku UI. Każdy z trzech zawierających je plików testowych przeszedł niezależny bundle `esbuild`, więc `Transform failed` nie maskuje wyniku. Klasa `ZASTANA_WZGLĘDEM_DYŻURU_335` oznacza wyłącznie, że czerwienie wystąpiły przed jakąkolwiek zmianą UI tego dyżuru; nie dowodzi ich wieku względem historycznej kotwicy produktu.

| Pełna nazwa | Plik | Kompilacja | Klasa |
| --- | --- | --- | --- |
| `R04-2A · interakcja wiersza Shift+F10 na wierszu otwiera ten sam kontekst co kebab` | `src/components/shared/__tests__/filterableTable.r04-2a.test.tsx` | esbuild OK | `ZASTANA_WZGLĘDEM_DYŻURU_335` |
| `R03-1 · Relations jest blokiem obowiązkowym renderuje empty state, gdy ekran NIE poda propa relations` | `src/components/shared/__tests__/standardPreview.r03.test.tsx` | esbuild OK | `ZASTANA_WZGLĘDEM_DYŻURU_335` |
| `R03-1 · Relations jest blokiem obowiązkowym respektuje własną etykietę pustego stanu` | `src/components/shared/__tests__/standardPreview.r03.test.tsx` | esbuild OK | `ZASTANA_WZGLĘDEM_DYŻURU_335` |
| `R03-2 · zamykanie i focus return gdy element otwierający zniknął, focus wraca na kontener — skróty żyją dalej` | `src/components/shared/__tests__/tablePreviewGeometry.r03-2.test.tsx` | esbuild OK | `ZASTANA_WZGLĘDEM_DYŻURU_335` |

## Niestabilność pierwszego Bloku 3

Pierwszy poprawnie skonfigurowany przebieg na świeżej bazie dał 12/18: poza day277 czerwieniły się day274, day275 i dwa przypadki workbook day276. Po korekcie wyłącznie payloadu day277 ponowiono pełny blok bez zmian w pozostałych plikach: 18/18 GREEN (`blok3-po.json`, SHA-256 `0df629f348ff0def401a70125a57b59518ce1967096723d822a43bb0d078f0d2`). Nie nazywam czterech pozostałych przypadków naprawionymi; wynik pokazuje zależność od kolejności/stanu lub niestabilność, która wymaga osobnej reprodukcji.
