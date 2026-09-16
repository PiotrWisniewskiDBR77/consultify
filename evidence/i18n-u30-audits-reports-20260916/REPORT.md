# i18n U-30 — Audits Reports

**Werdykt: READY FOR CTO REVIEW.** Widok opublikowanego raportu audytu w locale EN renderuje angielski chrom, angielskie tytuły 27 kanonicznych sekcji nawet dla starszego payloadu z tytułami PL, oraz nie pokazuje martwych akcji Approve/Publish ani mylących komunikatów o wymaganym statusie.

## Zakres

- usunięto stałe `isPolish = true`; chrom czyta aktywny locale UI,
- dodano komplet kluczy `audit.report.viewer` w EN i PL,
- znane identyfikatory sekcji są tłumaczone przez i18n z angielskim fallbackiem; nieznane sekcje zachowują zapisany tytuł,
- dla `published` sekcja Actions zawiera tylko realne eksporty DOCX/PDF,
- bez migracji, nowych flag, zmian backendu, stagingu i deployu,
- viewer DOC-0/RAPORT-DOK pozostaje poza tą paczką.

## Dowody

- unit/render/ratchet: 3 pliki, 17/17 testów, `--retry=0`,
- pełny front TSC: baza `85541745e8` = 152 błędy / RC 2; kandydat = 152 błędy / RC 2; delta 0; brak błędów w zmienionych plikach,
- pełny server TSC: 0 błędów / RC 0,
- realny `AuditReportDocumentView` przez dev-render, locale EN, status Published, legacy PL titles w fixture:
  - `u30-en-light.png` — 341 KB,
  - `u30-en-dark.png` — 399 KB,
  - automatyczny ratchet tekstu: wymagane EN obecne; `Audyty`, `Raporty`, `Opublikowany`, `Pobierz DOCX`, `Wnioski systemowe`, `Plan weryfikacji`, `Wymagany status` nieobecne.

## Ograniczenia

TSC całego frontu pozostaje czerwony przez 152 zastane błędy obecne identycznie na bazie. Pakiet nie zmienia tej liczby.
