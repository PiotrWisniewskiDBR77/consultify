# Notification Detail View - UI Standard

> **Status:** OBOWIĄZUJĄCY od 2026-01-29  
> **Ostatnia aktualizacja:** 2026-01-29  
> **Plik źródłowy:** `src/components/MyWork/NotificationDetailView.tsx`

---

## Główne zasady

### 1. Header (pasek tytułu)

- **Wyróżniony wizualnie** — delikatny gradient fioletowy + fioletowa ramka + cień
- **Zawiera tylko 2 przyciski akcji:**
  - **Mark Read** (niebieski) — oznacza notyfikację jako przeczytaną
  - **Chat** (fioletowy) — otwiera panel czatu z kontekstem notyfikacji
- **Severity indicator** — kolorowa kropka (blue/amber/red) obok tytułu

### 2. Layout dwukolumnowy

- **Lewa kolumna (2/3)** — treść merytoryczna, rozwijane sekcje
- **Prawa kolumna (1/3)** — Control Panel, metadane, sticky przy scrollowaniu

### 3. Sekcje w lewej kolumnie

| Sekcja | Ikona | Kolor | Opis |
|--------|-------|-------|------|
| What's Happening | Info | blue | Co się dzieje, dlaczego ważne, co blokowane |
| AI Analysis | Bot | purple | Priorytet, wpływ, rekomendacja AI |
| Expected Action | CheckSquare | emerald | Oczekiwana akcja + interaktywna checklista |
| Related Items | Link2 | indigo | Powiązane elementy (task/decision/project) |
| Comments | MessageCircle | amber | Komentarze (przygotowane do rozbudowy) |
| Activity Log | History | slate | Historia aktywności |

### 4. Sekcje w prawej kolumnie

| Sekcja | Ikona | Kolor | Opis |
|--------|-------|-------|------|
| Control | Flag | purple | Typ, severity, kategoria, daty, akcje |
| Stakeholders | Users | cyan | Interesariusze (przygotowane) |
| Why You Got It | Info | amber | Wyjaśnienie dlaczego otrzymano |

### 5. Przyciski Mark Read i Chat

| Przycisk | Kolor ramki | Kolor tekstu | Rozmiar |
|----------|-------------|--------------|---------|
| Mark Read | `border-blue-500/40` | `text-blue-700` | `px-4 py-2 text-sm` |
| Chat | `border-purple-500/40` | `text-purple-700` | `px-4 py-2 text-sm` |

### 6. AI Analysis Section

Nowa sekcja z analizą AI:
- **Priorytet** — badge z poziomem (CRITICAL/HIGH/MEDIUM/LOW)
- **Analiza wpływu** — opis konsekwencji
- **Rekomendacja** — podświetlony box z sugestią
- **Przycisk "Zapytaj AI"** — otwiera chat z kontekstem

### 7. Action Checklist

Interaktywna checklista generowana automatycznie na podstawie typu notyfikacji:
- Checkbox dla każdego kroku
- Licznik postępu w nagłówku sekcji
- Różne checklisty dla różnych typów (TASK/DECISION/AI)

---

## Klasy CSS headera (reference)

```tsx
className="lg:col-span-3 bg-gradient-to-r from-white/80 via-purple-50/30 to-white/80 
           dark:from-navy-900/80 dark:via-purple-900/20 dark:to-navy-900/80 
           backdrop-blur-xl rounded-2xl 
           border border-purple-200/40 dark:border-purple-500/20 
           shadow-lg shadow-purple-500/10 dark:shadow-purple-500/20 
           overflow-hidden ring-1 ring-purple-500/10 dark:ring-purple-400/10"
```

---

## Klasy CSS sekcji rozwijalnych

```tsx
// Karta sekcji
className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl 
           border border-slate-200/60 dark:border-navy-700/60 
           shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"

// Nagłówek sekcji
className="w-full flex items-center justify-between px-5 py-4 
           hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors"

// Ikona w nagłówku
className="p-2 rounded-xl bg-gradient-to-br from-[color]-500/10 to-[color2]-500/10 
           dark:from-[color]-500/20 dark:to-[color2]-500/20"
```

---

## Severity Colors

| Severity | Kolor kropki | Kolor tła badge | Kolor tekstu |
|----------|--------------|-----------------|--------------|
| INFO | bg-blue-500 | bg-blue-500/10 | text-blue-500 |
| WARNING | bg-amber-500 | bg-amber-500/10 | text-amber-500 |
| CRITICAL | bg-red-500 | bg-red-500/10 | text-red-500 |

---

## Integracja z AI Chat

- Przycisk **Chat** wywołuje `updateWorkspaceFromView(AppView.MY_WORK, notificationId, {...notificationData})`
- Kontekst notyfikacji trafia do `workspaceContext` w `useConversationStore`
- AI w czacie ma dostęp do: typu, severity, tytułu, wiadomości, powiązanej encji, projektu

---

## Historia zmian

| Data | Zmiana |
|------|--------|
| 2026-01-29 | Utworzono standard Notification Detail View |
| 2026-01-29 | Dodano sekcję AI Analysis |
| 2026-01-29 | Dodano interaktywną checklistę akcji |
| 2026-01-29 | Dodano sekcje: Related Items, Comments, Activity Log |
| 2026-01-29 | Ujednolicono z Task Detail View Golden Standard |

---

## Uwagi

Ten standard obowiązuje do czasu oficjalnej decyzji o zmianie. Wszelkie modyfikacje wymagają aktualizacji tego dokumentu.
