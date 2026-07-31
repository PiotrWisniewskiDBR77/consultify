---
doc_id: MAT-002
truth_type: operations
status: ACCEPTED
owner: codex
product_owner: piotr
priority: P0
depends_on: CORE-ART-006
last_reviewed: 2026-07-31
---

# MAT-002 — Document Library: governed share handoff

## Problem

Akcja `Share` na liście dokumentów tworzyła URL z `action=share`, ale Document Studio
nie konsumowało tej intencji. Użytkownik trafiał do właściwego dokumentu, jednak musiał
ponownie odszukać narzędzie udostępniania. Sam parametr sugerował działanie, którego
runtime faktycznie nie wykonywał.

## Rezultat

Document Studio przejmuje jednorazową, dozwoloną akcję `share` dopiero po poprawnym
odczycie dokumentu i otwiera istniejący panel zarządzania realnymi share linkami.
Po udanym handoff URL jest normalizowany do kanonicznej ścieżki artefaktu, więc refresh
nie uruchamia akcji ponownie. Nie powstał nowy endpoint ani alternatywny stan udziałów.

## Granice bezpieczeństwa

- akceptowana jest wyłącznie jawna wartość `share`; inne parametry są ignorowane;
- panel otwiera się dopiero dla pomyślnie odczytanego, tenant-scoped artefaktu;
- tworzenie linku nadal przechodzi przez istniejące API i pokazuje sukces dopiero po receipt;
- błąd odczytu dokumentu pozostaje blokujący i nie otwiera pustego edytora;
- pakiet nie zmienia Deck, Sheets, Templates ani semantyki backendu.

## Zmienione pliki

- `src/components/DocumentStudio/DocumentStudioView.tsx`;
- `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx`;
- `src/components/DocumentStudio/__tests__/DocumentStudioDocumentPanel.test.tsx`.

## Odbiór 2026-07-31

Decyzja: **GO**.

- test handoffu do realnego panelu share: `1/1 PASS`;
- frontend `npm run type-check`: PASS;
- parametr akcji jest usuwany przez canonical replace po udanym read-back;
- brak zmian w API, bazie i migracjach.

## Pozostałe luki Materials

Ten pakiet nie certyfikuje całego Document golden flow. Nadal osobnych paczek wymagają:
UI snapshot/rollback, revoke/rotate w panelu, pełny create→edit→reopen→version→export→share
E2E, Sheets archive/share oraz workbook versioning i concurrency.
