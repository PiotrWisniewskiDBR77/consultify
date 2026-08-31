---
doc_id: funkcje-vault-scope-suite
status: canonical
owner: piotr
truth_type: status
established: 2026-08-31
---

# Czerwony pakiet izolacji sejfów — PRZYRZĄD, i to NASZA regresja z dzisiaj

Pytanie nadrzędne brzmiało: **kłamie przyrząd czy przecieka produkt?**
Odpowiedź, zmierzona sondą dla wszystkich jedenastu czerwieni: **przyrząd.**

## Przyczyna — jedna, wspólna, zmierzona nie z rozumowania

```
warn: [executeKBSearch] Policy gateway error (fail-closed):
      Cannot read properties of undefined (reading 'allowedScopes')
PROBE_RAW={"results":[],"note":"Blocked by policy gateway"}
```

`toolDefinitions.ts:899` czyta `policyResult.decision.scopeResolution.allowedScopes`.
Atrapa w teście zwracała obiekt **bez** `scopeResolution` ⇒ wyjątek ⇒ `catch`
fail-closed (`:910`) ⇒ **funkcja wygaszona we wszystkich 18 przypadkach**.

**Produkt nie przeciekał.** Diff naprawy to wyłącznie plik testowy — zero zmian
w kodzie produkcyjnym, zero usuniętych asercji.

## ★ Winowajcą jest NASZ commit z dzisiaj

`ae70377533` — *fix(day206) pkt 2/5/6: privateMode do pętli i egzekucja w KB*,
**31.08 o 10:55**. Dodał odczyt `scopeResolution.allowedScopes`, nie aktualizując
atrapy. Bisekt **empiryczny**, nie z rozumowania:
- `ae70377533^` ⇒ `Tests 18 passed (18)`
- `ae70377533` i HEAD ⇒ `Tests 11 failed | 7 passed (18)`

Podejrzenia nadzorcy (FIX-213, kontrakt parametru) **obalone** — nie dotykają tej ścieżki.

## ★★ Siedem „zielonych" było FAŁSZYWIE zielonych

Podział nie był przypadkowy:
- **wszystkie 11 czerwonych** to asercje „**właściciel WIDZI**";
- **wszystkie 7 zielonych** to asercje „**obcy NIE widzi**" — świeciły, bo **nikt nie
  widział niczego**.

Pakiet meldował „izolacja OK" dokładnie wtedy, gdy cała funkcja była martwa. To jest
kształt **„zamknięte przez wygaszenie"** w najczystszej postaci — czwarty raz tego
samego dnia, tym razem w samym przyrządzie pomiarowym.

## Naprawa: atrapa USUNIĘTA, nie podrasowana

Zmierzono, że realny `chatPolicyGateway` działa w tym środowisku bez bazy. Test
używa więc **realnego gateway'a** — nie może się już rozjechać z kontraktem.
To ważniejsze niż sama zieleń: usunięto źródło przyszłych rozjazdów.

## Trzy zabezpieczenia okazały się NIEUDOWODNIONE — domknięte

Przebieg dziewięciu mutacji pokazał, że sama poprawiona atrapa nie wystarcza:
**M4 (autorytet folderu) i M9 (`projectIds` z FIX-213) PRZEŻYŁY** — testy zostały
zielone przy skasowanym zabezpieczeniu.

1. **Autorytet folderu** — oba istniejące przypadki kończyły się wcześniej, na checku
   widoczności (`:1067`), i nigdy nie dochodziły do linii autorytetu (`:1077-1078`).
   Wektor realny: dokument projektu A złożony w folderze projektu B jest widoczny dla
   kogoś, kto nie jest członkiem A — schemat nie wymusza zgodności projektu folderu
   i dokumentu.
2. **`projectIds`** (naprawa z FIX-213) nie miała w tym pakiecie żadnej bramki.
3. **Dwa przypadki fail-closed** przechodziły po usunięciu checku widoczności — pusty
   wynik wychodził z drugiej warstwy. Dodano asercje na `note`, odróżniające
   „odmówiono, bo nie twój" od „wpuszczono, ale akurat pusto".

Wszystko domknięte **dodaniem** przypadków. Stan: **21/21 zielone, i każdy z 21
przypadków czerwienieje pod co najmniej jedną z dziesięciu mutacji.**

## Regresja
5 plików / 19 testów zielone na realnym Postgresie (migracje strict od pustej bazy),
z ominięciem obu pułapek: cichej atrapy bazy (`Database.ts:79-85`) i `DB_TYPE`
przybitego do sqlite (`vitest.config.ts:210`). Że to realna baza, dowiedziono
mutacyjnie na łańcuchu produkcyjnym.

## Pozycja otwarta
Ten sam wektor mógł trafić inne pakiety commita `ae70377533`. Sprawdzono sąsiadów
(`day206.toolLoopBehaviour`, `sideEffectTools` — zielone), nie cały zbiór.
**Pewność co do całego commita wymaga osobnego pomiaru.**
