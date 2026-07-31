# Cykl życia dokumentów normatywnych

## Cel

Ten kontrakt zapobiega powstawaniu wielu równoległych plików `FINAL`,
`MASTER`, `V2`, `V8` i `SSOT`, z których każdy uważa się za najważniejszy.

## Minimalne metadane

Nowy dokument normatywny powinien zaczynać się blokiem:

```yaml
---
doc_id: stabilny-identyfikator
truth_type: product-target
scope: krótki i jednoznaczny zakres
status: working
owner: product
last_reviewed: YYYY-MM-DD
canonical_entry: docs/SOURCE_OF_TRUTH.md
supersedes: []
superseded_by: null
runtime_evidence: []
---
```

Dozwolone `truth_type`:

- `runtime-current`
- `product-target`
- `ui-standard`
- `data-contract`
- `operations`
- `security-compliance`
- `strategy`
- `delivery-status`
- `evidence-history`

Dozwolone statusy:

- `canonical`
- `supporting`
- `working`
- `evidence`
- `historical`
- `superseded`
- `disputed`

## Promocja do kanonu

Dokument może otrzymać status `canonical`, gdy:

1. ma unikalny zakres, właściciela i datę przeglądu,
2. nie konkuruje z innym kanonem albo jawnie go zastępuje,
3. jest podłączony do `docs/ssot/registry.json` bezpośrednio lub przez
   kanoniczny rejestr domeny,
4. rozdziela stan obecny od stanu docelowego,
5. wskazuje dowody runtime, jeśli deklaruje wdrożenie.

## Zastępowanie

Nie twórz `NAZWA_FINAL_V2.md`.

Preferowana kolejność:

1. zaktualizuj istniejący kanon i jego changelog,
2. jeśli zmienia się zakres lub model — utwórz nowy dokument,
3. w starym ustaw `status: superseded`,
4. wpisz `superseded_by`,
5. zarejestruj zmianę w odpowiednim indeksie.

Dokument zastąpiony pozostaje dostępny jako historia, ale nie jest używany do
nowych implementacji.

## Raporty, audyty i handoffy

Raport lub audyt opisuje prawdę **na datę wykonania**. Powinien mieć status
`evidence` albo `historical`, nawet jeśli w nazwie ma `FINAL`.

Handoff jest nośnikiem kontekstu, nie prawem produktu. Ustalenie z handoffu
staje się obowiązujące dopiero po wpisaniu do kanonu domenowego.

## Kopie iCloud/Finder

Pliki z końcówkami ` 2`, ` 3`, ` 4` są kopiami technicznymi, a nie nowymi
wersjami merytorycznymi. Nie wolno ich rejestrować jako kanoniczne.

## Przegląd

- dokument zmieniany często: przegląd przy każdej zmianie zachowania,
- operacje i bezpieczeństwo: co najmniej kwartalnie,
- strategia: przy każdej zmianie kierunku,
- evidence i historia: nie wymagają odświeżania; wymagają poprawnej daty.
