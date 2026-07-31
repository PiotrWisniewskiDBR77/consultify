---
doc_id: ssot-data-security-operations
truth_type: operations
status: canonical
owner: engineering-security-operations
last_reviewed: 2026-07-30
---

# Dane, bezpieczeństwo i operacje

## Prawda danych

1. schemat właściwego środowiska;
2. wykonane migracje `server/migrations/`;
3. kod warstwy danych;
4. testy integralności;
5. dokumentacja jako mapa, nie substytut schematu.

Każda encja powinna mieć organizację, właściciela, status, lifecycle, retencję,
audyt i API. Rozbieżność między dokumentem a migracją jest blokadą do
wyjaśnienia, nie powodem do zgadywania.

## Tenancy i dostęp

Każda operacja domenowa powinna przejść:

`authentication → organization context → membership/capability → validation →
owner-lane service → audit`

Widoczność w interfejsie nie jest zabezpieczeniem. Ochrona musi istnieć po
stronie backendu.

## Sekrety

- lokalne `.env`, poświadczenia i sekrety są ignorowane przez Git;
- repo może zawierać tylko szablony bez prawdziwych wartości;
- poświadczenia integracji powinny być szyfrowane i maskowane po zapisie;
- potencjalny wyciek wymaga rotacji, nie tylko usunięcia pliku.

Audyt nazw plików z 2026-07-30 nie wykazał śledzonych lokalnych `.env` ani
pliku `vts-wave2-credentials.csv`. Nie jest to pełny skan treści sekretów.

## Środowiska i wdrożenia

Obowiązują odseparowane staging i production, z osobnymi bazami, sekretami,
domenami i monitoringiem. Kanoniczny model operacyjny:
`docs/operations/STAGING_PRODUCTION_OPERATING_MODEL.md`.

Przed wdrożeniem trzeba potwierdzić rzeczywiste branch protection, workflow
CI/CD i konfigurację Railway. Dokument nie jest dowodem aktualnego ustawienia
zewnętrznej usługi.

## Backup i odzyskanie

Operacja destrukcyjna wymaga:

- jednoznacznego targetu;
- backupu lub mechanizmu odzyskania;
- dry-run, jeśli dostępny;
- walidacji po operacji;
- instrukcji rollback;
- zapisu operatora, czasu i zakresu.

Dokumentacja runbooka nie dowodzi, że ostatni backup jest świeży i odtwarzalny.
Wymagany jest okresowy test restore.

## Retencja i audyt

Soft delete, okres ochronny, purge, eksport użytkownika i retencja evidence
muszą być określone per obiekt. Brak jawnej polityki oznacza lukę wymagającą
decyzji produktu i bezpieczeństwa.
