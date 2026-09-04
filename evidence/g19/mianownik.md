# G19 — mianownik dyżuru 290

Pomiar wykonany na markerze `67d235cfa0` względem bazy `316bce9dd9`.

## Wynik

- `src/components/{standard,shared,ui}`: 24 zmienione pliki, w tym 23 komponenty produktu i 1 plik testowy.
- `server/src/middleware`: 3 zmienione pliki produktu.
- `server/src/routes`: 18 zmienionych plików, w tym 12 tras produktu i 6 plików testowych.
- Pełny zadeklarowany zbiór wraz z `src/index.css`, `tailwind.config.js` i `public/locales`: 49 plików.

## Front — 24 pliki

```text
src/components/shared/ExecutiveModuleShell/RightRail.tsx
src/components/shared/ExecutiveModuleShell/TopBar.tsx
src/components/shared/ModuleHub/FilterableTable.tsx
src/components/shared/ModuleHub/__tests__/FilterableTable.cellWordBreak.test.tsx
src/components/shared/NModeLayout/AIConsultantPanel.tsx
src/components/shared/NModeLayout/NModeLeftNav.tsx
src/components/shared/NModeSections/AttachmentsLinksCanvas.tsx
src/components/shared/NModeSections/CommentsCanvas.tsx
src/components/shared/PreviewPane/PreviewAIHintStrip.tsx
src/components/shared/PreviewPane/PreviewActionBar.tsx
src/components/shared/PreviewPane/PreviewActivityStrip.tsx
src/components/shared/PreviewPane/PreviewDetailsSection.tsx
src/components/shared/PreviewPane/PreviewMetaCard.tsx
src/components/shared/PreviewPane/PreviewRelations.tsx
src/components/shared/PreviewPane/PreviewWhatsNextCard.tsx
src/components/shared/TableWithPreviewLayout.tsx
src/components/shared/WizardModal/WizardStepper.tsx
src/components/shared/states/EmptyState.tsx
src/components/standard/ArtifactRightPanel.tsx
src/components/standard/EvidencePanelSection.tsx
src/components/standard/StandardPreview.tsx
src/components/ui/ResizableTable/ColumnResizer.tsx
src/components/ui/ResizableTable/PreviewPaneShell.tsx
src/components/ui/primitives/cells/ProgressCell.tsx
```

## Middleware — 3 pliki produktu

```text
server/src/middleware/auth.middleware.ts
server/src/middleware/mfaEnrollmentToken.middleware.ts
server/src/middleware/requireAudit.middleware.ts
```

## Trasy — 12 plików produktu

```text
server/src/routes/adminP32.routes.ts
server/src/routes/ai.routes.ts
server/src/routes/auth.routes.ts
server/src/routes/help.routes.ts
server/src/routes/meeting.routes.ts
server/src/routes/mfa.routes.ts
server/src/routes/pmo/decisions.routes.ts
server/src/routes/pmo/initiativesExecutionRuntime.routes.ts
server/src/routes/security.routes.ts
server/src/routes/v8/chat.routes.ts
server/src/routes/v8/index.ts
server/src/routes/v8/teresa.routes.ts
```

## Zmienione testy tras — 6 plików

```text
server/src/routes/__tests__/ai.agentHubRateLimitRouting.test.ts
server/src/routes/__tests__/day274-ocena-dociera-do-listy.pg.test.ts
server/src/routes/__tests__/day275-method-outputs-kontrakt.pg.test.ts
server/src/routes/__tests__/day276-deck-autosave-persist.pg.test.ts
server/src/routes/__tests__/day276-workbook-cell-persist.pg.test.ts
server/src/routes/__tests__/day277-decyzje-zapis.pg.test.ts
```

## Pozostałe elementy pełnego mianownika

```text
public/locales/en/translation.json
public/locales/pl/translation.json
src/index.css
tailwind.config.js
```

## Komendy pomiarowe

```bash
git diff --name-only 316bce9dd9 67d235cfa0 -- src/components/standard src/components/shared src/components/ui
git diff --name-only 316bce9dd9 67d235cfa0 -- server/src/middleware
git diff --name-only 316bce9dd9 67d235cfa0 -- server/src/routes
git diff --name-only 316bce9dd9 67d235cfa0 -- src/components/standard src/components/shared src/components/ui src/index.css tailwind.config.js public/locales server/src/middleware server/src/routes
```
