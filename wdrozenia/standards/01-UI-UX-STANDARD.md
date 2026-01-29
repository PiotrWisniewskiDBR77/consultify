# 🎨 UI/UX Standard (kanoniczny)

## Cel

Zapewnić spójny UI/UX we wszystkich modułach (ModuleHub pattern + wspólne stany + brak mock fallbacków).

## Źródła prawdy

- Golden Standard: `wdrozenia/UI_UX_GOLDEN_STANDARD.md`
- (Legacy) `wdrozenia/standards/UI-UX-STANDARD 2.md` – **nie jest kanoniczny**

## Wymagania MUST (minimum)

- **ModuleHub** dla modułów listowych (tabs, search, view-modes, primary CTA).
- **Stany**: loading / error / empty (z retry) – zamiast „udawania danych".
- **Spójny StatusBadge** i mapowanie kolorów.
- **Wspólne wzorce**: drawer 50% + „open wider" tam gdzie to ma sens.
- **Standard tabel** - zaokrąglone rogi, kontrast z tłem (patrz sekcja poniżej).

## UI stany (kanon)

- **Loading**: skeleton/spinner, blokada akcji zależnych od danych.
- **Error**: czytelny komunikat + przycisk retry (bez fallback danych).
- **Empty**: komunikat + CTA „Create / New …".

---

## 🧭 Layout “chat-compatible” (KANON)

W widokach, które współpracują z czatem (np. **My Work**, detail views Task/Decision/Notification), obowiązuje zasada:

- **Lewa strona = merytoryka**: treści, kontekst, opisy, wnioski, grafiki.
- **Prawa strona = sterowanie + metryki**: status, owner/assignee, terminy, aging, blokady, RACI, eskalacje, akcje (CTA).

Cel: utrzymać ergonomię pracy z czatem (AI) i mieć stabilny, przewidywalny układ w całym systemie.

Wymóg:

- Primary CTA (np. Save/Delegate/Decide) zawsze jest po prawej, blisko “Control”.
- “Dlaczego / co robimy / efekt” zawsze jest po lewej, na górze.

---

## 📊 Standard Tabel (Table UI Standard)

Wszystkie tabele w aplikacji MUSZĄ stosować jednolity wzorzec wizualny zapewniający:

- Zaokrąglone rogi kontenera
- Kontrast z tłem aplikacji
- Jasne tło pól/wierszy względem głównego tła

### Wzorzec implementacji

```tsx
// ✅ PRAWIDŁOWO - Standard tabeli
<div className="overflow-x-auto p-4">
  <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
    <table className="w-full">
      <thead className="bg-slate-50 dark:bg-navy-900/50 sticky top-0">
        {/* nagłówki */}
      </thead>
      <tbody className="divide-y divide-slate-200 dark:divide-navy-700/50">
        {/* wiersze */}
      </tbody>
    </table>
  </div>
</div>

// ❌ ŹLE - Tabela bez kontenera
<div className="overflow-x-auto">
  <table className="w-full">
    {/* ... */}
  </table>
</div>
```

### Klasy CSS kontenera tabeli

| Element           | Light Mode                  | Dark Mode                     |
| ----------------- | --------------------------- | ----------------------------- |
| Kontener          | `bg-white border-slate-200` | `bg-navy-900 border-navy-700` |
| Zaokrąglenie      | `rounded-xl`                | `rounded-xl`                  |
| Overflow          | `overflow-hidden`           | `overflow-hidden`             |
| Nagłówek          | `bg-slate-50`               | `bg-navy-900/50`              |
| Separator wierszy | `divide-slate-200`          | `divide-navy-700/50`          |

### Padding zewnętrzny

Kontener tabeli powinien mieć padding od rodzica:

- `p-4` - standardowy padding wokół tabeli
- `px-4 pb-4` - gdy tabela jest w grupie z nagłówkiem grupy

### Komponenty używające tego standardu

Wzorzec zaimplementowany w:

- `InterviewHub.tsx` - Sessions, Templates, Insights, Assignments
- `MyTasksListContent.tsx` - Tasks table
- `DecisionsPanelContent.tsx` - Decisions table
- `NotificationsContent.tsx` - Notifications table
- `AssessmentTable.tsx` - Assessments list
- `ReportsTable.tsx` - Reports list
- `InitiativesTable.tsx` - Initiatives list

### Hover i interakcje

```tsx
// Wiersz tabeli z hover
<tr className="group hover:bg-slate-50 dark:hover:bg-navy-800/50 cursor-pointer transition-colors border-b border-slate-200 dark:border-navy-700/50 last:border-0">
  {/* ... */}
</tr>
```

---

## i18n (jeśli włączone w danym obszarze)

Nie hardcodujemy tekstów w komponentach. Teksty idą przez warstwę tłumaczeń.

## Historia zmian

- 2026-01-26: dodano Standard Tabel (Table UI Standard)
- 2026-01-26: utworzono kanoniczny plik, wskazano źródła i minimum MUST
