#!/usr/bin/env node
/**
 * Fix [PL] placeholders in Polish translation file
 * Translates English text marked with [PL] prefix to proper Polish
 */

const fs = require('fs');
const path = require('path');

const PL_FILE = path.join(__dirname, '../../public/locales/pl/translation.json');

// Translation dictionary for common phrases
const TRANSLATIONS = {
  // Common UI elements
  'Save': 'Zapisz',
  'Cancel': 'Anuluj',
  'Delete': 'Usuń',
  'Edit': 'Edytuj',
  'View': 'Podgląd',
  'Add': 'Dodaj',
  'Remove': 'Usuń',
  'Close': 'Zamknij',
  'Open': 'Otwórz',
  'Submit': 'Wyślij',
  'Confirm': 'Potwierdź',
  'Back': 'Wstecz',
  'Next': 'Dalej',
  'Previous': 'Poprzedni',
  'Loading...': 'Ładowanie...',
  'Saving...': 'Zapisywanie...',
  'Processing...': 'Przetwarzanie...',
  'Error': 'Błąd',
  'Success': 'Sukces',
  'Warning': 'Ostrzeżenie',
  'Info': 'Informacja',
  'Yes': 'Tak',
  'No': 'Nie',
  'OK': 'OK',
  'None': 'Brak',
  'All': 'Wszystko',
  'Select': 'Wybierz',
  'Search': 'Szukaj',
  'Filter': 'Filtruj',
  'Sort': 'Sortuj',
  'Export': 'Eksportuj',
  'Import': 'Importuj',
  'Download': 'Pobierz',
  'Upload': 'Prześlij',
  'Copy': 'Kopiuj',
  'Paste': 'Wklej',
  'Cut': 'Wytnij',
  'Undo': 'Cofnij',
  'Redo': 'Ponów',
  'Refresh': 'Odśwież',
  'Reset': 'Resetuj',
  'Clear': 'Wyczyść',
  'Apply': 'Zastosuj',
  'Update': 'Aktualizuj',
  'Create': 'Utwórz',
  'New': 'Nowy',
  'Name': 'Nazwa',
  'Description': 'Opis',
  'Title': 'Tytuł',
  'Status': 'Status',
  'Type': 'Typ',
  'Date': 'Data',
  'Time': 'Czas',
  'User': 'Użytkownik',
  'Users': 'Użytkownicy',
  'Role': 'Rola',
  'Roles': 'Role',
  'Permission': 'Uprawnienie',
  'Permissions': 'Uprawnienia',
  'Settings': 'Ustawienia',
  'Options': 'Opcje',
  'Configuration': 'Konfiguracja',
  'Profile': 'Profil',
  'Account': 'Konto',
  'Password': 'Hasło',
  'Email': 'Email',
  'Phone': 'Telefon',
  'Address': 'Adres',
  'Company': 'Firma',
  'Organization': 'Organizacja',
  'Team': 'Zespół',
  'Project': 'Projekt',
  'Projects': 'Projekty',
  'Task': 'Zadanie',
  'Tasks': 'Zadania',
  'Dashboard': 'Pulpit',
  'Overview': 'Przegląd',
  'Details': 'Szczegóły',
  'Summary': 'Podsumowanie',
  'Report': 'Raport',
  'Reports': 'Raporty',
  'Analytics': 'Analityka',
  'Metrics': 'Metryki',
  'Statistics': 'Statystyki',
  'Chart': 'Wykres',
  'Graph': 'Graf',
  'Table': 'Tabela',
  'List': 'Lista',
  'Grid': 'Siatka',
  'Card': 'Karta',
  'Cards': 'Karty',
  'Item': 'Element',
  'Items': 'Elementy',
  'Category': 'Kategoria',
  'Categories': 'Kategorie',
  'Tag': 'Tag',
  'Tags': 'Tagi',
  'Label': 'Etykieta',
  'Labels': 'Etykiety',
  'Note': 'Notatka',
  'Notes': 'Notatki',
  'Comment': 'Komentarz',
  'Comments': 'Komentarze',
  'Message': 'Wiadomość',
  'Messages': 'Wiadomości',
  'Notification': 'Powiadomienie',
  'Notifications': 'Powiadomienia',
  'Alert': 'Alert',
  'Alerts': 'Alerty',
  'Help': 'Pomoc',
  'Support': 'Wsparcie',
  'Documentation': 'Dokumentacja',
  'Guide': 'Przewodnik',
  'Tutorial': 'Samouczek',
  'FAQ': 'FAQ',
  'Contact': 'Kontakt',
  'Feedback': 'Opinia',
  'About': 'O nas',
  'Home': 'Strona główna',
  'Menu': 'Menu',
  'Navigation': 'Nawigacja',
  'Header': 'Nagłówek',
  'Footer': 'Stopka',
  'Sidebar': 'Panel boczny',
  'Content': 'Treść',
  'Body': 'Treść',
  'Page': 'Strona',
  'Section': 'Sekcja',
  'Panel': 'Panel',
  'Modal': 'Okno modalne',
  'Dialog': 'Dialog',
  'Popup': 'Popup',
  'Tooltip': 'Podpowiedź',
  'Placeholder': 'Placeholder',
  'Required': 'Wymagane',
  'Optional': 'Opcjonalne',
  'Enabled': 'Włączone',
  'Disabled': 'Wyłączone',
  'Active': 'Aktywny',
  'Inactive': 'Nieaktywny',
  'Online': 'Online',
  'Offline': 'Offline',
  'Available': 'Dostępny',
  'Unavailable': 'Niedostępny',
  'Pending': 'Oczekujący',
  'Completed': 'Ukończony',
  'In Progress': 'W trakcie',
  'Failed': 'Nieudane',
  'Approved': 'Zatwierdzony',
  'Rejected': 'Odrzucony',
  'Draft': 'Szkic',
  'Published': 'Opublikowany',
  'Archived': 'Zarchiwizowany',
  'Deleted': 'Usunięty',
  'High': 'Wysoki',
  'Medium': 'Średni',
  'Low': 'Niski',
  'Critical': 'Krytyczny',
  'Normal': 'Normalny',
  'Priority': 'Priorytet',
  'Due Date': 'Termin',
  'Start Date': 'Data rozpoczęcia',
  'End Date': 'Data zakończenia',
  'Created': 'Utworzony',
  'Updated': 'Zaktualizowany',
  'Modified': 'Zmodyfikowany',
  'Version': 'Wersja',
  'Revision': 'Rewizja',
  'History': 'Historia',
  'Log': 'Log',
  'Logs': 'Logi',
  'Audit': 'Audyt',
  'Activity': 'Aktywność',
  'Event': 'Zdarzenie',
  'Events': 'Zdarzenia',
  'Action': 'Akcja',
  'Actions': 'Akcje',
  'Workflow': 'Przepływ pracy',
  'Process': 'Proces',
  'Automation': 'Automatyzacja',
  'Integration': 'Integracja',
  'Integrations': 'Integracje',
  'API': 'API',
  'Webhook': 'Webhook',
  'Webhooks': 'Webhooki',
  'Key': 'Klucz',
  'Keys': 'Klucze',
  'Token': 'Token',
  'Tokens': 'Tokeny',
  'Secret': 'Sekret',
  'Secrets': 'Sekrety',
  'Credential': 'Poświadczenie',
  'Credentials': 'Poświadczenia',
  'Authentication': 'Uwierzytelnianie',
  'Authorization': 'Autoryzacja',
  'Login': 'Logowanie',
  'Logout': 'Wyloguj',
  'Sign In': 'Zaloguj się',
  'Sign Out': 'Wyloguj się',
  'Sign Up': 'Zarejestruj się',
  'Register': 'Rejestracja',
  'Forgot Password': 'Zapomniałem hasła',
  'Reset Password': 'Resetuj hasło',
  'Change Password': 'Zmień hasło',
  'Two-Factor Authentication': 'Uwierzytelnianie dwuskładnikowe',
  '2FA': '2FA',
  'MFA': 'MFA',
  'Security': 'Bezpieczeństwo',
  'Privacy': 'Prywatność',
  'Terms': 'Warunki',
  'Policy': 'Polityka',
  'Consent': 'Zgoda',
  'Agreement': 'Umowa',
  'License': 'Licencja',
  'Subscription': 'Subskrypcja',
  'Plan': 'Plan',
  'Pricing': 'Cennik',
  'Billing': 'Płatności',
  'Invoice': 'Faktura',
  'Payment': 'Płatność',
  'Checkout': 'Kasa',
  'Cart': 'Koszyk',
  'Order': 'Zamówienie',
  'Purchase': 'Zakup',
  'Discount': 'Rabat',
  'Coupon': 'Kupon',
  'Promotion': 'Promocja',
  'Trial': 'Okres próbny',
  'Free': 'Bezpłatny',
  'Premium': 'Premium',
  'Enterprise': 'Enterprise',
  'Custom': 'Własny',
  'Basic': 'Podstawowy',
  'Standard': 'Standardowy',
  'Advanced': 'Zaawansowany',
  'Professional': 'Profesjonalny',
  'Feature': 'Funkcja',
  'Features': 'Funkcje',
  'Capability': 'Możliwość',
  'Capabilities': 'Możliwości',
  'Module': 'Moduł',
  'Modules': 'Moduły',
  'Component': 'Komponent',
  'Components': 'Komponenty',
  'Widget': 'Widget',
  'Widgets': 'Widgety',
  'Plugin': 'Wtyczka',
  'Plugins': 'Wtyczki',
  'Extension': 'Rozszerzenie',
  'Extensions': 'Rozszerzenia',
  'Add-on': 'Dodatek',
  'Add-ons': 'Dodatki',
  'Theme': 'Motyw',
  'Themes': 'Motywy',
  'Template': 'Szablon',
  'Templates': 'Szablony',
  'Layout': 'Układ',
  'Layouts': 'Układy',
  'Style': 'Styl',
  'Styles': 'Style',
  'Design': 'Projekt',
  'Appearance': 'Wygląd',
  'Display': 'Wyświetlanie',
  'Format': 'Format',
  'Language': 'Język',
  'Region': 'Region',
  'Timezone': 'Strefa czasowa',
  'Currency': 'Waluta',
  'Unit': 'Jednostka',
  'Units': 'Jednostki',
  'Measurement': 'Pomiar',
  'Value': 'Wartość',
  'Values': 'Wartości',
  'Amount': 'Kwota',
  'Quantity': 'Ilość',
  'Total': 'Suma',
  'Subtotal': 'Suma częściowa',
  'Tax': 'Podatek',
  'Fee': 'Opłata',
  'Fees': 'Opłaty',
  'Cost': 'Koszt',
  'Costs': 'Koszty',
  'Price': 'Cena',
  'Budget': 'Budżet',
  'Revenue': 'Przychód',
  'Profit': 'Zysk',
  'Loss': 'Strata',
  'Balance': 'Saldo',
  'Credit': 'Kredyt',
  'Debit': 'Debet',
  'Transaction': 'Transakcja',
  'Transactions': 'Transakcje',
  'Transfer': 'Przelew',
  'Deposit': 'Wpłata',
  'Withdrawal': 'Wypłata',
  'Refund': 'Zwrot',
  'Limit': 'Limit',
  'Quota': 'Przydział',
  'Usage': 'Użycie',
  'Storage': 'Przechowywanie',
  'Memory': 'Pamięć',
  'Bandwidth': 'Przepustowość',
  'Traffic': 'Ruch',
  'Performance': 'Wydajność',
  'Speed': 'Szybkość',
  'Load': 'Obciążenie',
  'Capacity': 'Pojemność',
  'Availability': 'Dostępność',
  'Uptime': 'Czas działania',
  'Downtime': 'Przestój',
  'Maintenance': 'Konserwacja',
  'Backup': 'Kopia zapasowa',
  'Restore': 'Przywróć',
  'Recovery': 'Odzyskiwanie',
  'Sync': 'Synchronizacja',
  'Update': 'Aktualizacja',
  'Upgrade': 'Uaktualnienie',
  'Downgrade': 'Obniżenie wersji',
  'Install': 'Instalacja',
  'Uninstall': 'Odinstaluj',
  'Configure': 'Konfiguruj',
  'Setup': 'Konfiguracja',
  'Initialize': 'Inicjalizacja',
  'Start': 'Start',
  'Stop': 'Stop',
  'Restart': 'Restart',
  'Pause': 'Pauza',
  'Resume': 'Wznów',
  'Continue': 'Kontynuuj',
  'Skip': 'Pomiń',
  'Finish': 'Zakończ',
  'Complete': 'Ukończ',
  'Done': 'Gotowe',
  'Ready': 'Gotowy',
  'Waiting': 'Oczekiwanie',
  'Running': 'Uruchomiony',
  'Stopped': 'Zatrzymany',
  'Paused': 'Wstrzymany',
  'Scheduled': 'Zaplanowany',
  'Queued': 'W kolejce',
  'Processing': 'Przetwarzanie',
  'Uploading': 'Przesyłanie',
  'Downloading': 'Pobieranie',
  'Syncing': 'Synchronizacja',
  'Connecting': 'Łączenie',
  'Connected': 'Połączony',
  'Disconnected': 'Rozłączony',
  'Reconnecting': 'Ponowne łączenie',
  'Timeout': 'Przekroczenie czasu',
  'Error occurred': 'Wystąpił błąd',
  'Something went wrong': 'Coś poszło nie tak',
  'Please try again': 'Spróbuj ponownie',
  'Operation failed': 'Operacja nie powiodła się',
  'Operation successful': 'Operacja zakończona pomyślnie',
  'Changes saved': 'Zmiany zapisane',
  'Changes discarded': 'Zmiany odrzucone',
  'No changes': 'Brak zmian',
  'Unsaved changes': 'Niezapisane zmiany',
  'Are you sure?': 'Czy na pewno?',
  'This action cannot be undone': 'Tej akcji nie można cofnąć',
  'Confirm deletion': 'Potwierdź usunięcie',
  'Confirm action': 'Potwierdź akcję',
  'Enter your password': 'Wprowadź hasło',
  'Invalid credentials': 'Nieprawidłowe dane logowania',
  'Access denied': 'Odmowa dostępu',
  'Not authorized': 'Brak autoryzacji',
  'Not found': 'Nie znaleziono',
  'Page not found': 'Strona nie znaleziona',
  'Resource not found': 'Zasób nie znaleziony',
  'No results found': 'Nie znaleziono wyników',
  'No data available': 'Brak dostępnych danych',
  'No items': 'Brak elementów',
  'Empty': 'Pusty',
  'Nothing to show': 'Nic do pokazania',
  'Coming soon': 'Wkrótce',
  'Under construction': 'W budowie',
  'Beta': 'Beta',
  'Preview': 'Podgląd',
  'Experimental': 'Eksperymentalny',
  'Deprecated': 'Przestarzały',
  'Legacy': 'Starsza wersja',
  'New': 'Nowy',
  'Updated': 'Zaktualizowany',
  'Improved': 'Ulepszony',
  'Fixed': 'Naprawiony',
  'Moved': 'Przeniesiony',
  'Renamed': 'Przemianowany',
  'Merged': 'Połączony',
  'Split': 'Podzielony',
  'Cloned': 'Sklonowany',
  'Copied': 'Skopiowany',
  'Duplicated': 'Zduplikowany',
  'Linked': 'Połączony',
  'Unlinked': 'Odłączony',
  'Attached': 'Załączony',
  'Detached': 'Odłączony',
  'Assigned': 'Przypisany',
  'Unassigned': 'Nieprzypisany',
  'Shared': 'Udostępniony',
  'Private': 'Prywatny',
  'Public': 'Publiczny',
  'Internal': 'Wewnętrzny',
  'External': 'Zewnętrzny',
  'Restricted': 'Ograniczony',
  'Hidden': 'Ukryty',
  'Visible': 'Widoczny',
  'Shown': 'Pokazany',
  'Collapsed': 'Zwinięty',
  'Expanded': 'Rozwinięty',
  'Minimized': 'Zminimalizowany',
  'Maximized': 'Zmaksymalizowany',
  'Fullscreen': 'Pełny ekran',
  'Windowed': 'Okienkowy',
  'Docked': 'Zadokowany',
  'Floating': 'Pływający',
  'Pinned': 'Przypięty',
  'Unpinned': 'Odpięty',
  'Locked': 'Zablokowany',
  'Unlocked': 'Odblokowany',
  'Frozen': 'Zamrożony',
  'Unfrozen': 'Odmrożony',
  'Read-only': 'Tylko do odczytu',
  'Editable': 'Edytowalny',
  'Writable': 'Zapisywalny',
  'Executable': 'Wykonywalny'
};

// Longer phrases translations
const PHRASE_TRANSLATIONS = {
  'Dashboard': 'Pulpit',
  'Metrics': 'Metryki',
  'Signals': 'Sygnały',
  'Partners': 'Partnerzy',
  'This device': 'To urządzenie',
  'Device removed': 'Urządzenie usunięte',
  'Failed to remove device': 'Nie udało się usunąć urządzenia',
  'Select a project...': 'Wybierz projekt...',
  'Mentions only': 'Tylko wzmianki',
  'Muted': 'Wyciszone',
  'All priorities': 'Wszystkie priorytety',
  'High & Medium only': 'Tylko Wysoki i Średni',
  'High priority only': 'Tylko Wysoki priorytet',
  'Notification rules saved': 'Reguły powiadomień zapisane',
  'Failed to save rules': 'Nie udało się zapisać reguł',
  'System Health': 'Stan Systemu',
  'Organizations': 'Organizacje',
  'Active Users': 'Aktywni Użytkownicy',
  'AI Calls': 'Wywołania AI',
  'Revenue': 'Przychody',
  'Recent Activity': 'Ostatnia Aktywność',
  'View All': 'Zobacz Wszystko',
  'View Details': 'Zobacz Szczegóły',
  'Show More': 'Pokaż Więcej',
  'Show Less': 'Pokaż Mniej',
  'Load More': 'Załaduj Więcej',
  'See All': 'Zobacz Wszystko',
  'Learn More': 'Dowiedz się więcej',
  'Get Started': 'Rozpocznij',
  'Try Now': 'Wypróbuj teraz',
  'Sign up free': 'Zarejestruj się za darmo',
  'Contact us': 'Skontaktuj się z nami',
  'Request demo': 'Poproś o demo',
  'Book a call': 'Umów rozmowę',
  'Join now': 'Dołącz teraz',
  'Download now': 'Pobierz teraz',
  'Install now': 'Zainstaluj teraz',
  'Upgrade now': 'Uaktualnij teraz',
  'Buy now': 'Kup teraz',
  'Order now': 'Zamów teraz',
  'Subscribe now': 'Subskrybuj teraz',
  'Start free trial': 'Rozpocznij bezpłatny okres próbny',
  'Cancel anytime': 'Anuluj w dowolnym momencie',
  'No credit card required': 'Nie wymaga karty kredytowej',
  'Money-back guarantee': 'Gwarancja zwrotu pieniędzy',
  'Satisfaction guaranteed': 'Satysfakcja gwarantowana',
  'Limited time offer': 'Oferta ograniczona czasowo',
  'Exclusive offer': 'Oferta ekskluzywna',
  'Best value': 'Najlepsza wartość',
  'Most popular': 'Najpopularniejszy',
  'Recommended': 'Polecany',
  'Featured': 'Wyróżniony',
  'Verified': 'Zweryfikowany',
  'Certified': 'Certyfikowany',
  'Trusted': 'Zaufany',
  'Official': 'Oficjalny',
  'Platform health': 'Stan platformy',
  'System status': 'Status systemu',
  'All systems operational': 'Wszystkie systemy działają',
  'Some issues detected': 'Wykryto problemy',
  'Major outage': 'Poważna awaria',
  'Partial outage': 'Częściowa awaria',
  'Under maintenance': 'W trakcie konserwacji',
  'Scheduled maintenance': 'Zaplanowana konserwacja',
  'Unscheduled maintenance': 'Niezaplanowana konserwacja',
  'Emergency maintenance': 'Konserwacja awaryjna',
  'Service degradation': 'Degradacja usługi',
  'Service restored': 'Usługa przywrócona',
  'Incident resolved': 'Incydent rozwiązany',
  'Investigation ongoing': 'Trwa dochodzenie',
  'Root cause identified': 'Zidentyfikowano przyczynę',
  'Fix deployed': 'Poprawka wdrożona',
  'Monitoring situation': 'Monitorowanie sytuacji'
};

function translatePlaceholder(text) {
  // Remove [PL] prefix
  let cleanText = text.replace(/^\[PL\]\s*/, '');
  
  // Check if we have a direct translation
  if (TRANSLATIONS[cleanText]) {
    return TRANSLATIONS[cleanText];
  }
  
  // Check phrase translations
  for (const [eng, pol] of Object.entries(PHRASE_TRANSLATIONS)) {
    if (cleanText === eng) {
      return pol;
    }
  }
  
  // Try partial matches for longer texts
  let translated = cleanText;
  for (const [eng, pol] of Object.entries(TRANSLATIONS)) {
    // Only replace whole words
    const regex = new RegExp(`\\b${eng}\\b`, 'g');
    translated = translated.replace(regex, pol);
  }
  
  // If significant translation happened, return it
  if (translated !== cleanText && translated.length > 0) {
    // Mark partially translated strings
    if (translated.match(/[a-zA-Z]{4,}/)) {
      return `[TODO] ${translated}`;
    }
    return translated;
  }
  
  // Return with TODO marker for manual translation
  return `[TODO] ${cleanText}`;
}

function processFile() {
  console.log('Loading Polish translation file...');
  const content = fs.readFileSync(PL_FILE, 'utf-8');
  let data;
  
  try {
    data = JSON.parse(content);
  } catch (e) {
    console.error('Failed to parse JSON:', e.message);
    process.exit(1);
  }
  
  let placeholderCount = 0;
  let translatedCount = 0;
  let todoCount = 0;
  
  function processObject(obj) {
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      
      if (typeof value === 'string') {
        if (value.startsWith('[PL]')) {
          placeholderCount++;
          const translated = translatePlaceholder(value);
          obj[key] = translated;
          
          if (translated.startsWith('[TODO]')) {
            todoCount++;
          } else {
            translatedCount++;
          }
        }
      } else if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          if (typeof value[i] === 'string' && value[i].startsWith('[PL]')) {
            placeholderCount++;
            const translated = translatePlaceholder(value[i]);
            value[i] = translated;
            
            if (translated.startsWith('[TODO]')) {
              todoCount++;
            } else {
              translatedCount++;
            }
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        processObject(value);
      }
    }
  }
  
  processObject(data);
  
  console.log(`\nProcessed ${placeholderCount} [PL] placeholders:`);
  console.log(`  - Translated: ${translatedCount}`);
  console.log(`  - Needs manual review [TODO]: ${todoCount}`);
  
  // Save the updated file
  fs.writeFileSync(PL_FILE, JSON.stringify(data, null, 2));
  console.log('\nFile saved successfully!');
  
  if (todoCount > 0) {
    console.log(`\nNote: ${todoCount} strings marked with [TODO] need manual translation.`);
    console.log('Search for "[TODO]" in the file to find them.');
  }
}

processFile();
