| Moduł | Ekranów | Kadrów | Ekrany z realnym a11y | Kadry z a11y | Reguły | Realny błąd konsoli | Konsola pochodna braku backendu | Zły status | PL=EN | Zła para jasny/ciemny | Bez tekstu | Niepełne |
| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 01_ORGANIZATION | 21 | 168 | **1** | 8 | heading-order×8 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| 02_INTERVIEW | 6 | 48 | **1** | 8 | button-name×8, color-contrast×8 | 0 | 1 | 0 | 2 | 0 | 0 | — |
| 03_TOOLS | 7 | 56 | **2** | 4 | color-contrast×4 | 1 | 1 | 0 | 1 | 1 | 0 | — |
| 04_ASSESSMENT | 17 | 136 | **2** | 10 | scrollable-region-focusable×10, color-contrast×4 | 1 | 5 | 0 | 6 | 0 | 0 | — |
| 05_INITIATIVES | 6 | 48 | **2** | 16 | nested-interactive×16 | 0 | 0 | 0 | 2 | 0 | 0 | — |
| 06_EXECUTION | 8 | 64 | **3** | 16 | color-contrast×16 | 0 | 6 | 0 | 4 | 0 | 0 | — |
| 07_MY_WORK_AGENT | 40 | 320 | **30** | 232 | landmark-main-is-top-level×64, color-contrast×61, empty-table-header×48, nested-interactive×47, aria-required-parent×40, button-name×23, heading-order×16, landmark-unique×8, scrollable-region-focusable×8, aria-prohibited-attr×8, aria-required-children×8 | 0 | 1 | 0 | 1 | 0 | 1 | — |
| 08_MEETINGS | 2 | 16 | **0** | 0 | — | 0 | 1 | 0 | 1 | 0 | 0 | — |
| 09_RESULTS | 19 | 152 | **0** | 0 | — | 0 | 3 | 0 | 2 | 0 | 1 | — |
| 10_FINANCE | 13 | 104 | **1** | 4 | color-contrast×4 | 0 | 2 | 0 | 11 | 0 | 0 | — |
| 11_MATERIALS | 35 | 280 | **5** | 31 | color-contrast×19, select-name×16, label×8 | 0 | 3 | 0 | 11 | 0 | 0 | — |
| 12_AUDITS | 4 | 32 | **1** | 2 | color-contrast×2 | 0 | 3 | 0 | 0 | 0 | 0 | — |
| 13_CHAT | 7 | 56 | **5** | 40 | aria-input-field-name×32, aria-prohibited-attr×8, landmark-main-is-top-level×8 | 0 | 1 | 0 | 0 | 0 | 0 | — |
| 14_ADMIN | 42 | 336 | **10** | 72 | label×40, color-contrast×24, select-name×16 | 0 | 0 | 0 | 1 | 0 | 0 | — |
| 15_SETTINGS | 9 | 72 | **8** | 64 | heading-order×48, color-contrast×20, label×16, button-name×16, select-name×8 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| 16_PARTNER | 12 | 96 | **12** | 96 | landmark-unique×96, color-contrast×48, button-name×48, heading-order×32, label×24, aria-allowed-role×8 | 0 | 0 | 0 | 0 | 0 | 0 | — |

### 01_ORGANIZATION — ekrany z długiem
- `org-identity-operating`: a11y 8/8 kadrów (heading-order×8)

### 02_INTERVIEW — ekrany z długiem
- `drd-http-workspace`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `interview-preview-canon`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `karta-insight`: a11y 8/8 kadrów (button-name×8, color-contrast×8)

### 03_TOOLS — ekrany z długiem
- `tools-sesja-wyjscie`: a11y 2/8 kadrów (color-contrast×2)
- `tools-swot-library-detail`: a11y 2/8 kadrów (color-contrast×2); inne błędy: %o

%s

%s
 TypeError: t(...).map is not a function
    at http://127.0.0.1:3020/@fs/private/tmp/m03/src/components/DiscoveryTools/KnownToolDetailView.tsx:885:1; ★ para jasny/ciemny: pl-1440: rozne wymiary obrazow · pl-1024: rozne wymiary obrazow
- `tools-swot-report`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)

### 04_ASSESSMENT — ekrany z długiem
- `assessment-manage-panel`: a11y 8/8 kadrów (color-contrast×4, scrollable-region-focusable×8); inne błędy: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause chi
- `assessment-output-report`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `assessment-presentation-view`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `assessment-quality-review-panel`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `assessment-report-contract`: a11y 2/8 kadrów (scrollable-region-focusable×2)
- `drd-macierz-oceny`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `method-workspace`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `siri-workspace`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)

### 05_INITIATIVES — ekrany z długiem
- `capacity-advisor-a3`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `ev-football-field`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `exe-002-004-ui-audit`: a11y 8/8 kadrów (nested-interactive×8)
- `initiative-record`: a11y 8/8 kadrów (nested-interactive×8)

### 06_EXECUTION — ekrany z długiem
- `exec-summary-onelook`: a11y 4/8 kadrów (color-contrast×4); ★ PL=EN (tekst identyczny w obu językach)
- `execution-report-day11`: a11y 8/8 kadrów (color-contrast×8)
- `execution-tab-control`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `execution-tab-list`: a11y 4/8 kadrów (color-contrast×4)
- `execution-tab-resources`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `execution-tab-work`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)

### 07_MY_WORK_AGENT — ekrany z długiem
- `agent-hub`: a11y 8/8 kadrów (heading-order×8)
- `agent-plan-canvas`: a11y 8/8 kadrów (color-contrast×8, landmark-unique×8, scrollable-region-focusable×8)
- `agent-warsztat`: a11y 8/8 kadrów (color-contrast×8)
- `b2-template-gallery`: a11y 8/8 kadrów (landmark-main-is-top-level×8)
- `decision-record`: a11y 8/8 kadrów (button-name×7, nested-interactive×7, color-contrast×1)
- `idea-confidentiality-control`: a11y 4/8 kadrów (color-contrast×4)
- `idea-financial-case-persistence`: a11y 8/8 kadrów (empty-table-header×8)
- `idea-table`: a11y 8/8 kadrów (aria-prohibited-attr×8)
- `idea-table-record-templates`: a11y 8/8 kadrów (button-name×8)
- `idea-table-timeline-stuck`: a11y 8/8 kadrów (landmark-main-is-top-level×8, color-contrast×4)
- `idea-table-tool-empty-filter`: a11y 8/8 kadrów (aria-required-parent×8, empty-table-header×8)
- `idea-table-tool-grouping`: a11y 8/8 kadrów (aria-required-parent×8, empty-table-header×8)
- `idea-table-tool-kebab`: a11y 8/8 kadrów (aria-required-parent×8, empty-table-header×8)
- `idea-table-tool-paste`: a11y 8/8 kadrów (aria-required-parent×8, empty-table-header×8)
- `idea-table-tool-sortfilter`: a11y 8/8 kadrów (aria-required-parent×8, empty-table-header×8)
- `idea-templates-catalog`: a11y 8/8 kadrów (button-name×8, color-contrast×4)
- `ideas-preview-overlay`: a11y 8/8 kadrów (heading-order×8)
- `karta-decision`: a11y 8/8 kadrów (nested-interactive×8)
- `karta-notification`: a11y 8/8 kadrów (color-contrast×4, nested-interactive×8)
- `karta-task`: a11y 8/8 kadrów (nested-interactive×8)
- `melscanvas-workspace`: a11y 8/8 kadrów (landmark-main-is-top-level×8)
- `mindmap-canvas`: a11y 8/8 kadrów (landmark-main-is-top-level×8, nested-interactive×8)
- `mw-007-calendar-narrow-viewport`: a11y 8/8 kadrów (color-contrast×8)
- `mywork-calendar`: a11y 8/8 kadrów (color-contrast×8)
- `mywork-idea-topbar`: a11y 8/8 kadrów (aria-required-children×8, landmark-main-is-top-level×8, nested-interactive×8)
- `mywork-inbox`: a11y 4/8 kadrów (color-contrast×4)
- `notatnik-centrum-mysli`: a11y 8/8 kadrów (color-contrast×8)
- `notebook-quick-capture`: a11y 0/8 kadrów; ★ BEZ TEKSTU (<40 znaków)
- `processflow-canvas`: a11y 8/8 kadrów (landmark-main-is-top-level×8)
- `vault-folder-block-proof`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `whiteboard-canvas`: a11y 8/8 kadrów (landmark-main-is-top-level×8)
- `whiteboard-workshop`: a11y 8/8 kadrów (landmark-main-is-top-level×8)

### 08_MEETINGS — ekrany z długiem
- `public-booking-widget`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)

### 09_RESULTS — ekrany z długiem
- `results-vnext-attention`: a11y 0/8 kadrów; ★ BEZ TEKSTU (<40 znaków)
- `results-vnext-teresa-okr-reflection`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `results-zestawienia`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)

### 10_FINANCE — ekrany z długiem
- `finance-analysis-workspace`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `finance-baseline-workspace`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `finance-comments-panel`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `finance-compare-panel`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `finance-export-import-panel`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `finance-lineage-navigator`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `finance-prediction-workspace`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `finance-saved-views-panel`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `finance-statement-pack-workspace-v2`: a11y 4/8 kadrów (color-contrast×4); ★ PL=EN (tekst identyczny w obu językach)
- `finance-valuation-workspace`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `finance-workspace-bar`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)

### 11_MATERIALS — ekrany z długiem
- `deck-artifact`: a11y 7/8 kadrów (color-contrast×7)
- `document-artifact`: a11y 4/8 kadrów (color-contrast×4)
- `excele-engine-reveal`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `excele-jeden-widok-pusty`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `excele-jeden-widok-recent`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `excele-reopen-verify`: a11y 4/8 kadrów (color-contrast×4)
- `gen-deck-content-hints`: a11y 8/8 kadrów (label×8, select-name×8)
- `materialy-launcher`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `prezentacje-template-states`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `report-artifact`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `report-builder-library-template`: a11y 8/8 kadrów (color-contrast×4, select-name×8)
- `template-builder-deck`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `template-builder-doc`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `template-builder-table`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `template-create-wizard`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)
- `template-library-new-entry`: a11y 0/8 kadrów; ★ PL=EN (tekst identyczny w obu językach)

### 12_AUDITS — ekrany z długiem
- `audyty-warsztat-kryterium`: a11y 2/8 kadrów (color-contrast×2)

### 13_CHAT — ekrany z długiem
- `canvas-kebab-restructure`: a11y 8/8 kadrów (aria-input-field-name×8)
- `canvas-new-doc`: a11y 8/8 kadrów (aria-input-field-name×8)
- `canvas-toolbar-md-history`: a11y 8/8 kadrów (aria-input-field-name×8)
- `chat-signals-feed`: a11y 8/8 kadrów (aria-prohibited-attr×8)
- `chat-split-teresa-right`: a11y 8/8 kadrów (aria-input-field-name×8, landmark-main-is-top-level×8)

### 14_ADMIN — ekrany z długiem
- `admin-command-agent-trace`: a11y 8/8 kadrów (label×8)
- `admin-command-ai-policy`: a11y 8/8 kadrów (label×8, select-name×8)
- `admin-command-audit`: a11y 8/8 kadrów (label×8)
- `admin-command-dlp`: a11y 8/8 kadrów (select-name×8)
- `admin-command-residency`: a11y 8/8 kadrów (label×8)
- `admin-command-retention`: a11y 8/8 kadrów (label×8)
- `admin-team-ownership`: a11y 8/8 kadrów (color-contrast×8)
- `model-catalog-table`: a11y 8/8 kadrów (color-contrast×8)
- `partner-settlements-view`: a11y 4/8 kadrów (color-contrast×4)
- `prompt-registry-tab`: a11y 4/8 kadrów (color-contrast×4); ★ PL=EN (tekst identyczny w obu językach)

### 15_SETTINGS — ekrany z długiem
- `calendar-sync-settings`: a11y 8/8 kadrów (color-contrast×4, heading-order×8, label×8)
- `ustawienia-ai-automatyzacja`: a11y 8/8 kadrów (heading-order×8, select-name×8)
- `ustawienia-dane-prywatnosc`: a11y 8/8 kadrów (heading-order×8)
- `ustawienia-integracje`: a11y 8/8 kadrów (color-contrast×8, heading-order×8)
- `ustawienia-powiadomienia`: a11y 8/8 kadrów (button-name×8, color-contrast×4, heading-order×8)
- `ustawienia-workflow`: a11y 8/8 kadrów (button-name×8)
- `ustawienia-wyglad`: a11y 8/8 kadrów (heading-order×8, color-contrast×4)
- `ustawienia-zaawansowane`: a11y 8/8 kadrów (label×8)

### 16_PARTNER — ekrany z długiem
- `partner-academy-filled`: a11y 8/8 kadrów (color-contrast×8, heading-order×8, landmark-unique×8)
- `partner-dashboard`: a11y 8/8 kadrów (aria-allowed-role×8, color-contrast×8, heading-order×8, landmark-unique×8)
- `partner-earnings-filled`: a11y 8/8 kadrów (color-contrast×8, heading-order×8, landmark-unique×8)
- `partner-organizations-empty`: a11y 8/8 kadrów (button-name×8, landmark-unique×8, color-contrast×4)
- `partner-organizations-filled`: a11y 8/8 kadrów (button-name×8, landmark-unique×8, color-contrast×4)
- `partner-profile-filled`: a11y 8/8 kadrów (button-name×8, label×8, landmark-unique×8, color-contrast×4)
- `partner-referral-tools-empty`: a11y 8/8 kadrów (button-name×8, label×8, landmark-unique×8, color-contrast×4)
- `partner-referral-tools-filled`: a11y 8/8 kadrów (button-name×8, label×8, landmark-unique×8, color-contrast×4)
- `partner-resources-filled`: a11y 8/8 kadrów (button-name×8, heading-order×8, landmark-unique×8, color-contrast×4)
- `partner-start-active`: a11y 8/8 kadrów (landmark-unique×8)
- `partner-start-error`: a11y 8/8 kadrów (landmark-unique×8)
- `partner-start-unconnected`: a11y 8/8 kadrów (landmark-unique×8)

