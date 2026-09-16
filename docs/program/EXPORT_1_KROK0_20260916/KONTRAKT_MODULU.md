# EXPORT-1 — propozycja jednego modułu eksportu

**Werdykt:** istniejący `server/src/services/export/UnifiedExportService.ts` jest rozszerzanym rdzeniem (711 linii, pięciu żywych wołaczy), a nie modułem do dublowania. Następny krok dodaje do niego publiczny kontrakt treści i renderery formatowe, bez przenoszenia logiki domenowej do rendererów. Systemowy szablon z TEMPLATE-1 jest obowiązkowym wejściem, nie ozdobą wybieraną po renderze.

## Docelowa granica

```text
adapter domeny (DRD / Report Builder / Deck / Sheet / Audit)
        │
        ▼
ExportContentContract + ApprovedSystemTemplate + ExportContext
        │
        ▼
server/src/services/export/ (rozszerzenie istniejącego UnifiedExportService)
  contracts.ts
  templateResolver.ts
  quality/structureComparator.ts
  docx/index.ts
  pptx/index.ts
  xlsx/index.ts
        │
        ▼
ExportResult { bytes, mime, filename, structureReceipt, warnings, templateRef }
```

### Kontrakt wspólny

```ts
type ExportFormat = 'docx' | 'pptx' | 'xlsx';

type ExportContext = {
  organizationId: string;
  organizationName: string;
  clientLogo?: { bytes: Buffer; mime: 'image/png' | 'image/svg+xml' };
  language: 'en' | 'pl';
  confidentiality: 'public' | 'internal' | 'confidential';
  generatedAt: string;
  sourceRefs: Array<{ type: string; id: string; version?: string }>;
};

type ApprovedSystemTemplate = {
  artifactId: string;
  version: string;
  format: ExportFormat;
  provenanceStatus: 'approved';
  language: 'en' | 'pl';
  family: 'consultify-client-deliverable-v1';
  theme: {
    primaryFont: 'Aptos';
    fallbackFont: 'Arial';
    palette: { navy: string; blue: string; text: string; muted: string };
    logoPolicy: 'consultify-dbr77-cover-client-footer';
  };
};
```

### Kontrakt treści per format

- **PPTX:** `slides[]` z `role` należącą do ośmiu layoutów TEMPLATE-1: `cover | agenda | section | content-one | content-two | table | chart | decision`. Każdy slajd ma `title`, `keyMessage`, `blocks`, `sourceRefs`; dane domenowe nie określają współrzędnych.
- **DOCX:** `sections[]` z ośmiu ról: `executive-summary | context-scope | methodology | findings | maturity-matrix | recommendations | roadmap | appendix`; bloki: proza, tabela, wykres-slot, key-message. Adapter dostarcza sens i źródła, szablon dostarcza style, marginesy, nagłówki, stopki i TOC.
- **XLSX:** `worksheets[]` z kolumnami, wierszami, formułami i regułami progów. Formuły oraz formatowanie warunkowe są częścią kontraktu, nie wklejonym wynikiem. Pierwszy arkusz ma metrykę źródła i co-branding.

## Twarde inwarianty renderera

1. Tylko szablon `provenance_status='approved'` i dokładna wersja.
2. DOCX zapisuje theme Aptos, `docDefaults minorHAnsi` i `altName=Arial` w `fontTable.xml`. PPTX/XLSX zapisują theme Aptos i zero literalnych nazw fontów w runach; fallback Arial jest dowodem z renderera na maszynie bez Aptos, bez osadzania subsetu w MVP.
3. Consultify/DBR77 na okładce, logo klienta w stopce, z uczciwym brakiem gdy org nie ma logo.
4. Zero brand crimson `85182F` i tokenów `primary-*` w chrome; `B42318` jest dozwolone wyłącznie jako krytyczna semantyka danych (Critical/RISK/Worsening), a automat raportuje miejsce użycia.
5. Każdy wynik niesie `templateRef`, `sourceRefs`, hash treści i `structureReceipt`.
6. Bramka jakości działa przed wydaniem pliku; engine probe nie może być oznaczony jako eksport użytkownika.
7. Adaptery nie omijają obecnych bramek approval/legal hold/quality i receiptów materiałów.

## Automatyczny test parytetu

`compare-structure.mjs` jest krok-0 prototypem. Implementacja powinna przenieść go do `server/src/services/export/quality/structureComparator.ts` i dla trzech zamrożonych obiektów wykonywać:

1. wywołanie realnej trasy HTTP na odtworzonym dumpie;
2. odczyt OOXML/PDF z wygenerowanego pliku i pliku wzorcowego;
3. porównanie liczby slajdów/sekcji/arkuszy, tabel, wykresów, formuł, freeze panes, conditional formatting, autofilter;
4. sprawdzenie fontów użytych w runach (z pominięciem tablicy skryptowej theme), co-brandingu i crimson tylko w semantycznych elementach; sprawdzenie fallbacku zgodnie z regułą per format;
5. render przez LibreOffice/Poppler i zapis pierwszej strony/slajdu/arkusza;
6. wynik `PASS | FAIL | EVIDENCE_MISSING`, nigdy automatyczne `PASS` dla brakującego obiektu.

Obiekty bramkowe:

| Obiekt | Oczekiwany plik | Stan kroku 0 |
|---|---|---|
| frozen DRD `b2de5832…` | DOCX client final report | plik jest, parytet struktury **FAIL** |
| steering deck `56ba0108…` | PPTX board deck | realna trasa **BLOCKED_P1**; engine probe strukturalnie **FAIL** wobec 8 layoutów |
| Supplier Quality Scorecard | XLSX scorecard | **EVIDENCE_MISSING** w dumpie; nie zastępować Scrap Cost Model jako dowodu semantycznego |

## Etapy po akceptacji kroku 0

1. **PPTX:** rozszerzyć `UnifiedExportService` o osiem layoutów `deck-board`, a następnie migrować wołaczy partiami: najpierw prosty `work-canvas` (już woła usługę), potem `partnerToolkitResources`; Deck Builder (`PptxPipelineService`) i DRD (`assessmentDeckPptxRenderer`) dostają adapter kontraktu bez omijania ich bramek jakości. Pozostałe wejścia z pełnego inwentarza migrują po dowodzie parytetu. Dowód: osiem ról layoutu, liczba i typy slajdów, style/theme, stopka co-branding oraz zrzut jednego slajdu. Steering HTTP 200 jest możliwe dopiero po osobnej naprawie treści P1.
2. **DOCX:** podłączyć DRD, Report Builder i Audits do jednego renderera `DocumentSchema → approved template`; usunąć prywatny `writeReportBuilderDocx` po parytecie. Dowód: frozen DRD i realny Audit report.
3. **XLSX:** podłączyć Workbook/Sheets do rodziny supplier-scorecard; ExcelJS jako jedyny kanoniczny writer, SheetJS tylko import lub jawny fallback z ostrzeżeniem. Dowód: realny Supplier Scorecard z formułami i CF.
4. **PDF:** po XLSX podłączyć DRD i Audits przez istniejący `documentStudio/documentPdfRenderer`; nie zastępować go uproszczonym `UnifiedExportService.renderPdf`, dopóki nie ma dowodu parytetu DocumentSchema.

Każdy etap kończy się osobnym freeze i odbiorem. Nie ma implementacji w tym commicie.
