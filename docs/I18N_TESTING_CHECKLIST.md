# I18N Testing Checklist

Manual testing checklist for verifying internationalization (i18n) across all supported languages.

## Supported Languages

| Code | Language | Direction | Flag |
|------|----------|-----------|------|
| en | English | LTR | 🇬🇧 |
| pl | Polski | LTR | 🇵🇱 |
| de | Deutsch | LTR | 🇩🇪 |
| es | Español | LTR | 🇪🇸 |
| ar | العربية | RTL | 🇸🇦 |
| ja | 日本語 | LTR | 🇯🇵 |

---

## Pre-Test Setup

- [ ] Clear browser cache and localStorage
- [ ] Start with a fresh browser session
- [ ] Have test accounts ready for each language
- [ ] Document browser and OS version being tested

---

## 1. Language Switching

### 1.1 Settings Page
For each language:
- [ ] Navigate to Settings > Language
- [ ] Click on the language option
- [ ] Verify UI updates immediately
- [ ] Verify localStorage contains `i18nextLng` with correct value
- [ ] Refresh page - language should persist

### 1.2 Language Persistence
- [ ] Change language to non-English
- [ ] Log out and log back in
- [ ] Verify language preference is maintained
- [ ] Close browser completely and reopen
- [ ] Verify language preference is maintained

---

## 2. Navigation Elements

### 2.1 Sidebar Navigation
For each language, verify:
- [ ] Dashboard link displays correct translation
- [ ] Assessment link displays correct translation
- [ ] Initiatives link displays correct translation
- [ ] Roadmap link displays correct translation
- [ ] Settings link displays correct translation
- [ ] Help link displays correct translation
- [ ] No truncated text (check hover for full text if needed)

### 2.2 Top Navigation Bar
- [ ] User menu items translated
- [ ] Notification dropdown translated
- [ ] Search placeholder translated
- [ ] Breadcrumbs show translated module names

---

## 3. Common UI Elements

### 3.1 Buttons
Verify in multiple locations:
- [ ] Save / Zapisz / Speichern / Guardar / حفظ / 保存
- [ ] Cancel / Anuluj / Abbrechen / Cancelar / إلغاء / キャンセル
- [ ] Delete / Usuń / Löschen / Eliminar / حذف / 削除
- [ ] Edit / Edytuj / Bearbeiten / Editar / تحرير / 編集
- [ ] Close / Zamknij / Schließen / Cerrar / إغلاق / 閉じる
- [ ] Add / Dodaj / Hinzufügen / Añadir / إضافة / 追加

### 3.2 Form Labels
- [ ] Input field labels translated
- [ ] Placeholder text translated
- [ ] Required field indicators present
- [ ] Help text / tooltips translated

### 3.3 Status Indicators
- [ ] Loading states translated
- [ ] Empty states translated
- [ ] Error messages translated
- [ ] Success messages translated

---

## 4. Specific Modules

### 4.1 Dashboard
- [ ] Welcome message translated
- [ ] Widget titles translated
- [ ] Metric labels translated
- [ ] Date formats localized
- [ ] Number formats localized

### 4.2 Assessment Module
- [ ] Question text translated
- [ ] Answer options translated
- [ ] Progress indicators translated
- [ ] Results summary translated
- [ ] Export options translated

### 4.3 Initiatives
- [ ] Status labels (Active, Completed, Pending) translated
- [ ] Priority labels (High, Medium, Low) translated
- [ ] Action buttons translated
- [ ] Filter options translated

### 4.4 Settings
- [ ] All section headers translated
- [ ] Form field labels translated
- [ ] Help text translated
- [ ] Confirmation messages translated

### 4.5 Help Panel
- [ ] Tab names: Overview, FAQ, Knowledge Base
- [ ] Help content translated
- [ ] FAQ questions and answers translated
- [ ] "Notify Me" CTA translated

---

## 5. Forms and Validation

### 5.1 Login/Register Forms
- [ ] Field labels translated
- [ ] Placeholder text translated
- [ ] Validation error messages translated
- [ ] Success messages translated
- [ ] Forgot password flow translated

### 5.2 Input Validation
- [ ] "Field is required" message
- [ ] "Invalid email format" message
- [ ] "Password too short" message
- [ ] Custom validation messages

### 5.3 Date/Time Inputs
- [ ] Date picker labels translated
- [ ] Month names translated
- [ ] Day names translated
- [ ] Time format matches locale

---

## 6. Modals and Dialogs

### 6.1 Confirmation Dialogs
- [ ] Title translated
- [ ] Message body translated
- [ ] Confirm button translated
- [ ] Cancel button translated

### 6.2 Error Dialogs
- [ ] Error title translated
- [ ] Error message translated
- [ ] Action buttons translated

### 6.3 Info Dialogs
- [ ] Title translated
- [ ] Content translated
- [ ] Close button translated

---

## 7. Toast Notifications

- [ ] Success messages translated
- [ ] Error messages translated
- [ ] Warning messages translated
- [ ] Info messages translated
- [ ] Action buttons in toasts translated

---

## 8. Tables and Data Grids

- [ ] Column headers translated
- [ ] Empty state message translated
- [ ] Pagination controls translated
- [ ] Sort options translated
- [ ] Filter labels translated
- [ ] Export options translated

---

## 9. RTL Specific (Arabic)

### 9.1 Layout
- [ ] Sidebar on right side
- [ ] Text aligned to right
- [ ] Icons mirrored appropriately
- [ ] Scrollbar on left side

### 9.2 Forms
- [ ] Labels on right side of inputs
- [ ] Input text flows RTL
- [ ] Form buttons on left side

### 9.3 Navigation
- [ ] Breadcrumb order reversed
- [ ] Dropdown arrows on left
- [ ] Progress bars fill from right

### 9.4 Typography
- [ ] Arabic text renders correctly
- [ ] Numbers display correctly
- [ ] Mixed LTR/RTL content handled

---

## 10. CJK Specific (Japanese)

### 10.1 Typography
- [ ] Japanese characters display correctly
- [ ] Kanji, Hiragana, Katakana all visible
- [ ] Line breaks occur at appropriate positions
- [ ] Font renders clearly at all sizes

### 10.2 Input
- [ ] Japanese IME works correctly
- [ ] Text input accepts Japanese characters
- [ ] Search works with Japanese text

---

## 11. Date/Time/Number Formatting

### 11.1 Dates
| Locale | Expected Format | Verified |
|--------|-----------------|----------|
| en | MM/DD/YYYY | [ ] |
| pl | DD.MM.YYYY | [ ] |
| de | DD.MM.YYYY | [ ] |
| es | DD/MM/YYYY | [ ] |
| ar | DD/MM/YYYY | [ ] |
| ja | YYYY/MM/DD | [ ] |

### 11.2 Numbers
- [ ] Decimal separator correct
- [ ] Thousands separator correct
- [ ] Currency symbol positioned correctly
- [ ] Percentages formatted correctly

### 11.3 Times
- [ ] 12h/24h format matches locale
- [ ] AM/PM translated (if applicable)
- [ ] Timezone displayed correctly

---

## 12. Error Scenarios

### 12.1 Network Errors
- [ ] Offline message translated
- [ ] Retry button translated
- [ ] Connection error message translated

### 12.2 Permission Errors
- [ ] Access denied message translated
- [ ] Upgrade prompts translated

### 12.3 Validation Errors
- [ ] Form validation errors translated
- [ ] API error messages translated

---

## 13. Email Templates (if applicable)

- [ ] Subject lines translated
- [ ] Body content translated
- [ ] CTA buttons translated
- [ ] Footer translated

---

## 14. PDF/Export (if applicable)

- [ ] Exported documents in correct language
- [ ] Headers/footers translated
- [ ] Date formats correct in exports
- [ ] File naming includes locale

---

## Testing Results

### Summary Table

| Language | Navigation | Forms | Buttons | Modals | RTL | Overall |
|----------|------------|-------|---------|--------|-----|---------|
| EN | ✅/⚠️/❌ | | | | N/A | |
| PL | | | | | N/A | |
| DE | | | | | N/A | |
| ES | | | | | N/A | |
| AR | | | | | | |
| JA | | | | | N/A | |

### Legend
- ✅ Pass - All items verified
- ⚠️ Warning - Minor issues found
- ❌ Fail - Critical issues found
- N/A - Not applicable

---

## Issues Found

### Critical (Blocking)
| ID | Language | Location | Description | Screenshot |
|----|----------|----------|-------------|------------|
| | | | | |

### Major (Should Fix)
| ID | Language | Location | Description | Screenshot |
|----|----------|----------|-------------|------------|
| | | | | |

### Minor (Nice to Have)
| ID | Language | Location | Description | Screenshot |
|----|----------|----------|-------------|------------|
| | | | | |

---

## Sign-off

| Tester | Date | Languages Tested | Result |
|--------|------|------------------|--------|
| | | | |

---

## Automated Test Commands

```bash
# Run translation validation script
npx ts-node --esm scripts/i18n/validate-translations.ts --all --report

# Run unit tests for translations
npx vitest run tests/unit/i18n/

# Run E2E language tests
npx playwright test tests/e2e/i18n/

# Run RTL specific tests
npx playwright test tests/e2e/i18n/rtl-arabic.spec.ts
```
