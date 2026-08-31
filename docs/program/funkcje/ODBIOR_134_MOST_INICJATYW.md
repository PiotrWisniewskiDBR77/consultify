---
doc_id: funkcje-odbior-134
status: evidence
truth_type: work-status
established: 2026-08-30
---

# Odbiór adwersaryjny — dyżur 134 (most inicjatyw)

**Werdykt: `B` — działa z nazwanymi ograniczeniami. SCALONY** (merge `c92fd914cf`).
**★ WARUNEK WIĄŻĄCY: flagi `VITE_INITIATIVE_BRIDGE` NIE WOLNO włączyć** przed
wykonaniem pozycji opisanej w sekcji „Dług, który powstał”.

## Co potwierdził nadzorca własnymi rękami

| Bramka | Wynik pomiaru nadzorcy |
| --- | --- |
| licencja plikowa | **4 pliki, wszystkie z tabeli**; zero zmian w trasie mostu, domenie, migracjach, `.env*` |
| `B1` mutacja | cofnięcie **samego** `InitiativesHub.tsx` → **1 czerwony / 11 zielonych**, przypadek `confirms and calls the accepted-classic bridge when its flag is on`. Po zmianie **12/12**. Zgadza się z raportem co do liczby i nazwy |
| `B2` test behawioralny | `grep readFileSync` → **0**; test montuje komponent i sprawdza kształt żądania |
| `B4` flaga OFF | osobny przypadek `keeps the accepted-classic bridge absent when its flag is off`, zielony |
| `B6` flaga | `initiativeBridgeFlag.ts` — kolejność `query ?? localStorage ?? env ?? false`, `catch` → `false`. **Fail-closed, default OFF** — przeczytane w kodzie |
| `B7` zero zmian produktu poza powłoką | potwierdzone `git diff --name-only` |
| regresja różnicowa | `InitiativesHub.previewDetails` + `newModalA11y` → **123/123 zielone**; `AuditsHub` → **10/10**. **Zero regresji** |

## ★★ Najważniejsze ustalenie — most nie rozwiązuje problemu 170 kontra 34

Przeczytałem warunki mostu w SQL-u
(`postgresMaterialCommandUnitOfWork.ts`, zapytanie w `adoptAcceptedClassicInitiative`).
Most adoptuje **wyłącznie** rekord, który ma komplet:

```sql
FROM initiative_candidates c
JOIN swot_candidate_handoffs h ON ...
JOIN tool_outputs o ON ...
WHERE c.status='accepted' AND o.status='approved' AND o.version=h.tool_output_version
```

Czyli: **zaakceptowany kandydat SWOT + pokwitowanie przekazania + zatwierdzony
wynik narzędzia**. Zwykły, starszy rekord w tabeli `initiatives` **nie przejdzie
przez ten most i nie ma dziś żadnej drogi do rejestru kanonicznego**.

**Konsekwencja, którą trzeba powiedzieć wprost:** podpięcie mostu **nie sprawia**,
że 170 niewidocznych inicjatyw staje się widoczne. Framing mojej własnej instrukcji
(„doradca, który utworzył inicjatywę starszą drogą, po prostu jej nie widzi”)
sugerował, że most to naprawia. **Nie naprawia.** Wykonawca zgłosił to samodzielnie
jako korektę nr 4 i miał rację.

Plan funkcji mówił to poprawnie już wcześniej („most obsługuje tylko kandydatów
jednego narzędzia”) — to ja zgubiłem to zdanie, składając instrukcję.

## Ograniczenia nazwane — powód oceny `B`

1. **Dowód mutacyjny na bazie jest na poziomie domeny, nie HTTP.** Wykonawca wywołał
   funkcję domenową i pokazał `SELECT` z obu tabel przed i po (rekord startowo tylko
   w `initiatives`, po operacji także w `ie_aggregate_state`). **Pełny przebieg przez
   `ApiGateway` z podpisanym `JWT` nie został zmierzony** — oznaczone uczciwie jako
   `EVIDENCE_MISSING`. Dwie połowy dowodu — interfejs i baza — **nie zostały złączone**.
2. **Interfejs stoi na surowych oknach przeglądarki.** Operacja pyta o dwa
   identyfikatory przez `window.prompt` i potwierdza przez `window.confirm`.
   Przycisk owszem, używa klas standardu (`MENU_3_ACTION_NEUTRAL`), ale sama
   interakcja **nie jest powierzchnią produktu**.
3. **Operacja wymaga ręcznego wpisania dwóch identyfikatorów** — inicjatywy
   klasycznej i zaakceptowanego kandydata. To narzędzie operatora, nie funkcja doradcy.

## Dług, który powstał — warunek włączenia flagi

Zanim `VITE_INITIATIVE_BRIDGE` zostanie gdziekolwiek włączona:

- **tor grafiki** zastępuje `window.prompt`/`window.confirm` powierzchnią produktu
  (wybór rekordu z listy zamiast wpisywania identyfikatora) — zgłoszone do
  `KOORDYNACJA.md`;
- powstaje dowód **pełnego łańcucha HTTP** przez `ApiGateway` z `JWT`;
- rozstrzygamy, **co robimy z rekordami bez kandydata SWOT** — most ich nie obsłuży,
  a to jest większość z tych 170.

**Reguła 7 z `CLAUDE.md`:** właściciel nigdy nie jest pierwszym testerem wizualnym.
Włączenie tej flagi dziś pokazałoby mu surowe okno przeglądarki.

## Błąd autorski nadzorcy — czwarty w tym programie

Instrukcja była **wewnętrznie sprzeczna**: `Z10` deklarował „brak — ten dyżur NIE
wprowadza ani jednej nowej flagi”, a pozycja `R1` i tabela licencji **nakazywały
utworzyć flagę**. Wykonawca wybrał interpretację bezpieczniejszą (utworzył wyłącznie
flagę imiennie licencjonowaną, default OFF) i zgłosił sprzeczność w „Korektach”.
Zachował się dokładnie tak, jak przewiduje procedura.

**Do poprawy w metodzie:** pole `POZYCJE_Z_FLAGAMI` w generatorze musi być wypełniane
z tabeli licencji, a nie niezależnie od niej. Trzy z czterech dotychczasowych błędów
autorskich to sprzeczność między częścią wspólną a treścią merytoryczną.
