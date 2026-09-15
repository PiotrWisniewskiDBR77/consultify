# K4 v2 — K8sen W73: propagation sinks and PDF locale

**Werdykt E1: READY FOR INDEPENDENT REVIEW.** HOLD `80d46c61c211fe1a808ce83237a5b63530b03e8f` został naprawiony bez ponownego zerowania miernika: K8sen ma uczciwy residual `1581`, a wszystkie pozycje mają klasę i działającą granicę zachowania.

## Mianownik i klasyfikacja

- Globalne pomijanie `throw new Error(...)` usunięto. Miernik widzi wszystkie 1581 pozostałych wyjątków.
- `runtime:false` nie jest uznawane za lokalizację. Dziewięć takich wpisów nie może zdejmować źródła z mianownika.
- 1581/1581 wyjątków sklasyfikowano: `a:internal-background=2`, `b:http-error-boundary=1579`, `unknown=0`.
- Klasa `(b)` ma zachowanie fail-closed: skatalogowane komunikaty zachowują precyzyjne tłumaczenie i interpolacje, a nieskatalogowana angielska proza w polu HTTP `message/error` staje się polskim bezpiecznym komunikatem. `status` i `code` pozostają bez zmian.
- AIPipeline nie opiera się na granicy HTTP: zarówno `process()` jak i `processStream()` lokalizują `AIError.message` z `request.options.language`. Regresja wykonuje oba publiczne wywołania i sprawdza polski payload/callback.

Pełna lista 1581 pozycji z `path`, `line`, tekstem, klasą, ujściem i uzasadnieniem jest w `K4_K8SEN_W73_CLASSIFICATION.json`.

## Principal i locale

Produkcyjny `verifyToken` czyta kanoniczną preferencję `user_preferences(user_id, key='language')` i umieszcza `language` na `AuthenticatedUser`. Resolver otrzymuje więc realny principal, a kolejność pozostaje: profil użytkownika, `Accept-Language`, EN. Test prowadzi prawdziwy eksportowany middleware `verifyToken`, zamiast konstruować sztuczny request.

## PDF

Detektor obejmuje `.text(...)` tylko w plikach naprawdę używających `pdfkit`/`PDFDocument`; 19 metod `.text()` spoza PDF usunięto jako udowodnione false positives. Uczciwy mianownik PDF wynosił 36. Wszystkie 36 literałów otrzymały locale, remaining `0`:

- Management Reports: język trafia także do `writePdfReport`, z kompletem nagłówków, fallbacków i summary labels;
- Initiative Work Report: język profilu/raportu trafia do pobrania i wysyłki PDF;
- Document Studio: `schema.language` steruje etykietami, założeniami i placeholderami;
- Status Report i Unified Export: kontrakty wejściowe niosą locale;
- Partner Toolkit: jawny parametr `language` steruje etykietą i formatem daty;
- Invoice: `organization_profiles.preferred_language` steruje etykietami i formatem dat.

## Pomiar i dowody

| Miernik | Uczciwy przed | Po | Wyjaśnienie |
|---|---:|---:|---|
| K8sen | 1619 | 1581 | 36 PDF + 2 AIPipeline skatalogowane; 1581 wyjątków pozostaje jawnie widocznych |
| PDF `doc.text` EN | 36 | 0 | pełne locale wszystkich wykrytych PDF sinks |
| throw bez klasy | 1581 | 0 | pełny manifest `(a)/(b)` |

- focused tests: 34/34 PASS, `--retry=0`;
- `check:jezyk:ci`: PASS z K8sen `1581`, bez sztucznego zera;
- `runtime:false` coverage: wyłączone w loaderze miernika;
- migracji i deployu brak.

Pozostałe bramki i SHA treści są zapisane w freeze manifest po wykonaniu końcowego zestawu kontroli.
