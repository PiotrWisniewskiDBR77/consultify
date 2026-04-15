# Cursor Bug Response Template

To jest standardowy format, w jakim bede Ci zamykal temat po triage, analizie albo fixie.

## Standard odpowiedzi
```text
Status:
- potwierdzone / w analizie / naprawione / czeka na retest

Root cause:
- 1-3 zdania o przyczynie albo najbardziej prawdopodobnej hipotezie

Zakres:
- frontend / backend / env / dane / superadmin

Fix:
- co zmienilem albo co trzeba zmienic

Test:
- co sprawdzilem
- jakie testy odpalilem albo czego nie dalo sie uruchomic

Retest:
- co ma sprawdzic Tomek albo inna osoba

Ryzyka:
- co jeszcze moze wymagac sprawdzenia
```

## Skrocona wersja
```text
Status: ...
Root cause: ...
Fix: ...
Test: ...
Retest: ...
```

## Wersja po samym triage
```text
Status: potwierdzone / niepotwierdzone jeszcze
Ocena: bug / env / dane / brak odtworzenia
Hipoteza: ...
Nastepny krok: ...
```

## Wersja po wdrozeniu
```text
Status: naprawione na staging
Root cause: ...
Fix: ...
Test: ...
Retest: ...
```

## Wersja wiadomosci do retestu
```text
Czesc, wrzucilem poprawke na staging. Mozesz prosze sprawdzic:
- ...
- ...
- ...

Jak cos nadal nie dziala, daj znac z jakiego konta i na jakim kroku.
```
