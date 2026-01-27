# Instrukcje tłumaczenia dokumentacji Help System

## 📋 Przegląd

Dokumentacja Help System musi być dostępna we wszystkich językach aplikacji dla wszystkich modułów.

### Wymagania językowe:

- **SuperAdmin**: Tylko **Polski (pl)** i **Angielski (en)**
- **Wszystkie inne moduły**: Wszystkie **6 języków**:
  - 🇬🇧 Angielski (en)
  - 🇵🇱 Polski (pl)
  - 🇩🇪 Niemiecki (de)
  - 🇪🇸 Hiszpański (es)
  - 🇸🇦 Arabski (ar)
  - 🇯🇵 Japoński (ja)

---

## 📁 Struktura plików

Wszystkie tłumaczenia znajdują się w:
```
public/locales/{lang}/translation.json
```

Gdzie `{lang}` to kod języka: `en`, `pl`, `de`, `es`, `ar`, `ja`

---

## 🎯 Moduły do przetłumaczenia

### Moduły wymagające tłumaczeń w 6 językach:

1. **dashboard** - Dashboard / Pulpit
2. **assessment** - Assessment Hub / Ocena
3. **initiatives** - Initiatives / Inicjatywy
4. **roadmap** - Roadmap / Mapa Drogowa
5. **implementation** - Implementation / Wdrożenie
6. **reports** - Reports / Raporty
7. **mywork** - My Work / Moja Praca
8. **organization** - Organization / Organizacja
9. **settings** - Settings / Ustawienia
10. **admin** - Admin Panel / Panel Admina
11. **playbookTemplates** - Playbook Templates / Szablony Playbook
12. **ai-tools** - AI Tools / Narzędzia AI
13. **knowledge** - Knowledge Base / Baza Wiedzy
14. **onboarding** - Onboarding / Wprowadzenie
15. **consultant** - Consultant Portal / Portal Konsultanta
16. **ecosystem** - Ecosystem / Ekosystem

### Moduł wymagający tłumaczeń tylko w 2 językach:

17. **superadmin** - Super Admin / Super Admin (tylko **pl** i **en**)

---

## 📝 Struktura tłumaczeń dla każdego modułu

Każdy moduł musi mieć następującą strukturę w sekcji `help.sidePanel.modules.{moduleId}`:

```json
{
  "help": {
    "sidePanel": {
      "modules": {
        "{moduleId}": {
          "name": "Nazwa modułu",
          "description": "Opis modułu - 1-2 zdania wyjaśniające główny cel",
          "purpose": "Cel modułu - krótkie wyjaśnienie dlaczego moduł istnieje",
          "keyFeatures": [
            "Funkcja 1",
            "Funkcja 2",
            "Funkcja 3"
          ],
          "workflow": [
            "Krok 1",
            "Krok 2",
            "Krok 3"
          ],
          "tips": [
            "Wskazówka 1",
            "Wskazówka 2",
            "Wskazówka 3"
          ]
        }
      }
    }
  }
}
```

---

## 📚 Źródło tłumaczeń (Angielski)

Pełne tłumaczenia angielskie znajdują się w:
```
public/locales/en/translation.json
```

Sekcja: `help.sidePanel.modules.{moduleId}`

**Wszystkie moduły są już w pełni udokumentowane po angielsku!**

---

## 🔧 Instrukcje wykonania

### Krok 1: Przygotowanie

1. Otwórz plik źródłowy z tłumaczeniami angielskimi:
   ```
   public/locales/en/translation.json
   ```

2. Znajdź sekcję `help.sidePanel.modules.{moduleId}` dla każdego modułu

3. Skopiuj strukturę JSON dla każdego modułu

### Krok 2: Tłumaczenie

Dla każdego modułu (oprócz superadmin):

1. **Dla języka Polskiego (pl)**:
   - Otwórz `public/locales/pl/translation.json`
   - Znajdź sekcję `help.sidePanel.modules.{moduleId}`
   - Zastąp angielskie teksty polskimi tłumaczeniami
   - Zachowaj strukturę JSON

2. **Dla języka Niemieckiego (de)**:
   - Otwórz `public/locales/de/translation.json`
   - Znajdź sekcję `help.sidePanel.modules.{moduleId}`
   - Zastąp angielskie teksty niemieckimi tłumaczeniami
   - Zachowaj strukturę JSON

3. **Dla języka Hiszpańskiego (es)**:
   - Otwórz `public/locales/es/translation.json`
   - Znajdź sekcję `help.sidePanel.modules.{moduleId}`
   - Zastąp angielskie teksty hiszpańskimi tłumaczeniami
   - Zachowaj strukturę JSON

4. **Dla języka Arabskiego (ar)**:
   - Otwórz `public/locales/ar/translation.json`
   - Znajdź sekcję `help.sidePanel.modules.{moduleId}`
   - Zastąp angielskie teksty arabskimi tłumaczeniami
   - **UWAGA**: Arabski używa RTL (right-to-left), ale struktura JSON pozostaje taka sama
   - Zachowaj strukturę JSON

5. **Dla języka Japońskiego (ja)**:
   - Otwórz `public/locales/ja/translation.json`
   - Znajdź sekcję `help.sidePanel.modules.{moduleId}`
   - Zastąp angielskie teksty japońskimi tłumaczeniami
   - Zachowaj strukturę JSON

### Krok 3: SuperAdmin (tylko pl i en)

1. **Dla języka Polskiego (pl)**:
   - Otwórz `public/locales/pl/translation.json`
   - Znajdź sekcję `help.sidePanel.modules.superadmin`
   - Zastąp angielskie teksty polskimi tłumaczeniami

2. **Angielski (en)** - już jest gotowy

3. **Pozostałe języki (de, es, ar, ja)**:
   - **NIE TŁUMACZYĆ** - moduł superadmin nie powinien być dostępny w tych językach
   - Jeśli sekcja istnieje, można ją pozostawić jako angielską lub usunąć

---

## ✅ Checklist weryfikacji

Po zakończeniu tłumaczeń, sprawdź:

- [ ] Wszystkie 16 modułów (oprócz superadmin) mają tłumaczenia w 6 językach
- [ ] Moduł superadmin ma tłumaczenia tylko w pl i en
- [ ] Struktura JSON jest poprawna (sprawdź składnię)
- [ ] Wszystkie pola są wypełnione (name, description, purpose, keyFeatures, workflow, tips)
- [ ] Tłumaczenia są spójne terminologicznie
- [ ] Nie ma błędów składniowych JSON

---

## 📖 Przykłady tłumaczeń

### Przykład 1: Dashboard

**Angielski (en)** - źródło:
```json
"dashboard": {
  "name": "Dashboard",
  "description": "Your central command center for monitoring digital transformation progress...",
  "purpose": "Quickly understand the current state of your transformation journey...",
  "keyFeatures": [
    "Real-time transformation maturity score",
    "Initiative progress tracking"
  ],
  "workflow": [
    "Review your overall maturity score",
    "Check for any pending assessments or tasks"
  ],
  "tips": [
    "Customize widgets to show metrics most relevant to your role"
  ]
}
```

**Polski (pl)** - tłumaczenie:
```json
"dashboard": {
  "name": "Pulpit",
  "description": "Twoje centralne centrum dowodzenia do monitorowania postępu transformacji cyfrowej...",
  "purpose": "Szybko zrozum aktualny stan swojej podróży transformacyjnej...",
  "keyFeatures": [
    "Wskaźnik dojrzałości transformacji w czasie rzeczywistym",
    "Śledzenie postępu inicjatyw"
  ],
  "workflow": [
    "Przejrzyj ogólny wskaźnik dojrzałości",
    "Sprawdź oczekujące oceny lub zadania"
  ],
  "tips": [
    "Dostosuj widżety, aby pokazywać metryki najbardziej istotne dla Twojej roli"
  ]
}
```

**Niemiecki (de)** - tłumaczenie:
```json
"dashboard": {
  "name": "Dashboard",
  "description": "Ihr zentrales Kommandozentrum zur Überwachung des Fortschritts der digitalen Transformation...",
  "purpose": "Verstehen Sie schnell den aktuellen Stand Ihrer Transformationsreise...",
  "keyFeatures": [
    "Echtzeit-Transformationsreifegrad-Score",
    "Initiative Fortschrittsverfolgung"
  ],
  "workflow": [
    "Überprüfen Sie Ihren Gesamtreifegrad-Score",
    "Prüfen Sie auf ausstehende Bewertungen oder Aufgaben"
  ],
  "tips": [
    "Passen Sie Widgets an, um Metriken anzuzeigen, die für Ihre Rolle am relevantesten sind"
  ]
}
```

### Przykład 2: SuperAdmin (tylko pl i en)

**Angielski (en)** - źródło:
```json
"superadmin": {
  "name": "Super Admin",
  "description": "Platform-wide administration for managing multiple organizations...",
  "purpose": "Manage the entire platform infrastructure...",
  "keyFeatures": [
    "Multi-tenant management",
    "System health monitoring"
  ],
  "workflow": [
    "Monitor system health",
    "Manage organizations"
  ],
  "tips": [
    "Monitor system metrics regularly"
  ]
}
```

**Polski (pl)** - tłumaczenie:
```json
"superadmin": {
  "name": "Super Admin",
  "description": "Administracja całej platformy do zarządzania wieloma organizacjami...",
  "purpose": "Zarządzaj całą infrastrukturą platformy...",
  "keyFeatures": [
    "Zarządzanie wieloma najemcami",
    "Monitorowanie zdrowia systemu"
  ],
  "workflow": [
    "Monitoruj zdrowie systemu",
    "Zarządzaj organizacjami"
  ],
  "tips": [
    "Regularnie monitoruj metryki systemu"
  ]
}
```

---

## 🎨 Wytyczne tłumaczenia

### Terminologia

- **Zachowaj spójność**: Używaj tych samych terminów w całej aplikacji
- **Kontekst biznesowy**: Tłumaczenia powinny być profesjonalne i odpowiednie dla środowiska biznesowego
- **Techniczne terminy**: Niektóre terminy mogą pozostać po angielsku (np. "Dashboard", "ROI") jeśli są powszechnie używane

### Jakość tłumaczeń

- **Naturalność**: Tłumaczenia powinny brzmieć naturalnie w języku docelowym
- **Dokładność**: Zachowaj znaczenie oryginalnego tekstu
- **Zwięzłość**: Zachowaj podobną długość tekstów (nie za długie, nie za krótkie)

### Formatowanie

- **JSON**: Zachowaj poprawną składnię JSON
- **Cudzysłowy**: Używaj podwójnych cudzysłowów `"`
- **Przecinki**: Pamiętaj o przecinkach między elementami (ale nie po ostatnim)
- **Wcięcia**: Zachowaj spójne wcięcia (2 spacje)

---

## 🚀 Automatyzacja (opcjonalna)

Jeśli masz dostęp do narzędzi tłumaczeniowych:

1. **Google Translate API** - dla szybkich tłumaczeń podstawowych
2. **DeepL API** - dla lepszej jakości tłumaczeń
3. **ChatGPT/Claude** - dla tłumaczeń kontekstowych

**UWAGA**: Wszystkie automatyczne tłumaczenia wymagają **ręcznej weryfikacji** przez native speakera!

---

## 📞 Wsparcie

W razie pytań lub problemów:
- Sprawdź istniejące tłumaczenia w `public/locales/pl/translation.json` jako referencję
- Użyj narzędzi do walidacji JSON przed commitowaniem
- Testuj tłumaczenia w aplikacji po dodaniu

---

## 📅 Harmonogram (sugerowany)

1. **Tydzień 1**: Moduły podstawowe (dashboard, assessment, initiatives, roadmap)
2. **Tydzień 2**: Moduły zarządzania (reports, mywork, organization, settings, admin)
3. **Tydzień 3**: Moduły zaawansowane (playbookTemplates, ai-tools, knowledge, onboarding, consultant, ecosystem)
4. **Tydzień 4**: SuperAdmin (pl) + weryfikacja i poprawki

---

**Data utworzenia**: 2026-01-09
**Wersja**: 1.0
**Status**: Do wykonania
