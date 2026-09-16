# TEMPLATE-1 — trzy systemowe bazy

**Tor:** B  
**Właściciel wykonania:** `[B] Codex-2`  
**Decyzje:** KANAL.md W108, W113, W118  
**Baza:** `cbad80887ce5969f37a38f9ce79e67c6f33844fd`  
**Zakres:** `DOC-BASE`, `DECK-BASE`, `SHEET-BASE`; obie warstwy danych; bez czystki 96 i bez plików toru A.

## Wynik

Migracja `server/migrations/20262271_template_base_family.sql` tworzy jedną rodzinę layoutu dla trzech formatów:

- `DOC-BASE` aktualizuje istniejący kanon `doc-template-system-en-client_final_report`;
- `DECK-BASE` aktualizuje istniejący kanon `dbr77-deck-board`;
- `SHEET-BASE` tworzy nowy rekord systemowy `2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1`; nie promuje rekordu Northwind #95;
- dla każdej z 29 organizacji istnieje dokładnie jedna aktywna migawka każdej rodziny oraz dokładnie jeden origin link;
- źródła i migawki są `approved`, EN, system/read-only i zawierają provenance W108/W113/W118;
- generator podmienia treść/dane, a nie layout; co-branding mapuje `client_logo` z `organizations.logo_url`.

Migracja nie dotyka #93–96. Dump 11.09 nie zawiera ich rekordów kanonicznych, więc przebudowa tych pozycji pozostaje fail-closed do osobnej czystki 96 na aktualnych danych.

## RealPG i idempotencja

Test wykonano na prywatnym kontenerze PostgreSQL 18 z dumpem `staging-thomas-przed-wdrozeniem-linii-20260911-2036.dump`.

- przed: 29 organizacji, 0 kart oznaczonych rodziną bazową, 7 istniejących linków do DOC/DECK kanonu;
- po: 87 aktywnych migawek = 29 × 3 i 87 linków = 29 × 3;
- dwa zastane linki miały `artifact_id` należący do innej organizacji; migracja wybiera istniejący artefakt wyłącznie po zgodności `artifact_id + organization_id`, a następnie naprawia link;
- readback nie wykazał żadnego linku przekraczającego scope organizacji;
- pełne hashe obu źródeł, nowego SHEET-BASE, 87 migawek i 87 linków są identyczne po ponownym przebiegu;
- kontrolne hashe czterech artifact IDs #93–96: `NONE` przed i po; migracja ich nie utworzyła.

Dowody: `evidence/realpg-before.txt`, `evidence/realpg-second-run.txt`, `evidence/idempotency-state-{1,2}.txt`.

## Kontrakt plików

### DOCX

`artifacts/client-final-report-template-1.docx` zachowuje zaakceptowaną makietę i osiem sekcji. Pomiar OOXML potwierdza:

- major/minor theme = Aptos Display / Aptos;
- `docDefaults` używa `minorHAnsi`;
- `fontTable.xml` zapisuje `altName=Arial` dla Aptos i Aptos Display;
- 330 deklaracji runów jest theme-driven, brak literalnych nazw fontu;
- render sześciu stron jest czytelny, bez ucięcia i nakładania treści.

### PPTX

`artifacts/deck-board-template-1.pptx` jest wynikiem zaakceptowanego EXPORT-1 PPTX. Pomiar OOXML potwierdza osiem slajdów, osiem ról, jeden master/layout, natywną tabelę i wykres, Aptos theme, brak literalnych fontów i zero crimson.

### XLSX

`artifacts/supplier-scorecard-template-1.xlsx` zachowuje zaakceptowaną makietę. Pomiar i recalculation potwierdzają:

- dwa arkusze, 28 formuł, zero błędów formuł;
- freeze `xSplit=2`, `ySplit=6`, autofilter i trzy zakresy conditional formatting;
- ważoną stopę NC w wierszu sumy, a nie średnią ze średnich;
- major/minor theme = Aptos Display / Aptos i brak literalnych nazw fontu.

Host nie zawiera Aptos; `fc-match` podstawia Verdana. Render jest dowodem zachowania przy substytucji, nie dowodem obecności Aptos na maszynie. Wymagany fallback DOCX jest zapisany w `fontTable.xml`; PPTX/XLSX pozostają theme-driven zgodnie z W118.

## Walidacja

- RealPG pierwsze zastosowanie: PASS;
- RealPG drugie zastosowanie i identyczność stanu: PASS;
- readback źródła + migawki + origin link: PASS;
- OOXML DOCX/XLSX: PASS;
- OOXML PPTX: PASS;
- render DOCX wszystkich 6 stron: PASS;
- render XLSX obu arkuszy i formula error scan: PASS;
- `git diff --check`: PASS;
- backend/server TypeScript: 0 błędów;
- root/frontend TypeScript: 170 zastanych błędów, delta 0; paczka nie zmienia plików TS/TSX/JS/JSX.

Artefakty i zrzuty są w `artifacts/` i `evidence/`. Nie wykonywano zapisu na staging ani deployu.
