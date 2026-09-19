# D-18 — decision slide PPTX proof (2026-09-19)

Base: `4732a6032dbf78229f08ecbbff590f653edadf6f`.

The proof calls the production `BoardDeckExportService.exportPresentationDeck` adapter with a decision card whose table contains one real option-shaped row. It writes `decision-option-after.pptx`. LibreOffice headless opens that PPTX and exports page 2 to PDF; Poppler renders page 2 as `decision-option-after-slide2.png` (1921×1080). The PNG was inspected at original resolution: the option occupies the main slide body and the recommendation remains a separate band.

Commands:

```sh
node --import tsx /tmp/b18-generate.ts
soffice -env:UserInstallation=file:///tmp/soffice-b18-profile-0714 --headless --convert-to pdf --outdir /tmp/b18-render-0713 decision-option-after.pptx
pdftoppm -f 2 -singlefile -png -r 144 /tmp/b18-render-0713/decision-option-after.pdf decision-option-after-slide2
```

Readback from `ppt/slides/slide2.xml`: exactly one each of `OPTION A`, `Data foundation first`, `£410k`, `Sequence MES and the shared data layer before automation.`, `RECOMMENDED`, and `Approve the controlled option and keep the automation envelope unchanged.`

SHA-256:

- PPTX: `2879f7ba16f2fb45886a54a6e3e7ef073b0ff6cf705719a567305f2fb6497b0b`
- PNG: `702861e14542aea767257c1c69c82e741dd43178c2808fd373aa36449018df4d`

Mutation: replacing `options: decisionOptionsFromTable(table)` with `options: []` makes `BoardDeckExportService.test.ts` RED because slide 4 no longer contains `OPTION A` (1 failed, 5 passed); restored result is 6/6 GREEN with `--retry=0`.
