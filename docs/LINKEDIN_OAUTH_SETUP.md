# 🔗 Przewodnik konfiguracji LinkedIn OAuth - Krok po kroku

Ten przewodnik przeprowadzi Cię przez cały proces konfiguracji logowania przez LinkedIn w aplikacji Consultify.

---

## 📋 Krok 1: Utworzenie aplikacji LinkedIn

### 1.1. Przejdź do LinkedIn Developers
1. Otwórz przeglądarkę i przejdź na: **https://www.linkedin.com/developers/apps**
2. Zaloguj się swoim kontem LinkedIn (jeśli nie jesteś zalogowany)

### 1.2. Utwórz nową aplikację
1. Kliknij przycisk **"Create app"** (lub **"Utwórz aplikację"**)
2. Wypełnij formularz:
   - **App name** (Nazwa aplikacji): `Consultify`
   - **LinkedIn Page** (Strona LinkedIn): 
     - Jeśli masz stronę firmową, wybierz ją z listy
     - Jeśli nie masz, możesz utworzyć nową lub wybrać swoją osobistą stronę
   - **App logo** (Logo aplikacji): 
     - Prześlij logo (minimalny rozmiar: 100x100 pikseli)
     - Możesz użyć prostego logo lub ikony
   - **Legal agreement** (Zgoda prawna): 
     - Zaznacz checkbox potwierdzający, że przeczytałeś i akceptujesz warunki
3. Kliknij **"Create app"** (Utwórz aplikację)

---

## 🔐 Krok 2: Konfiguracja OAuth

### 2.1. Przejdź do zakładki Auth
1. Po utworzeniu aplikacji, przejdź do zakładki **"Auth"** (Autoryzacja)
2. Znajdź sekcję **"OAuth 2.0 settings"** (Ustawienia OAuth 2.0)

### 2.2. Dodaj Redirect URLs
1. W sekcji **"Redirect URLs"** kliknij **"Add redirect URL"** (Dodaj URL przekierowania)
2. Dodaj następujący URL:
   ```
   http://localhost:3005/api/auth/linkedin/callback
   ```
3. Kliknij **"Update"** (Aktualizuj)

> 💡 **Uwaga:** Jeśli planujesz wdrożyć aplikację na produkcję, dodaj również URL produkcyjny:
> ```
> https://twoja-domena.com/api/auth/linkedin/callback
> ```

---

## 🔑 Krok 3: Żądanie dostępu do API

### 3.1. Przejdź do zakładki Products
1. Kliknij zakładkę **"Products"** (Produkty) w menu aplikacji
2. Znajdź produkt: **"Sign In with LinkedIn using OpenID Connect"**
3. Kliknij przycisk **"Request access"** (Zażądaj dostępu)

### 3.2. Czekaj na zatwierdzenie
- Dla aplikacji deweloperskich zatwierdzenie zwykle następuje natychmiast
- Jeśli nie zostaniesz zatwierdzony od razu, LinkedIn wyśle Ci e-mail z informacją

---

## 📝 Krok 4: Pobranie danych dostępowych (Client ID i Client Secret)

### 4.1. Wróć do zakładki Auth
1. Wróć do zakładki **"Auth"**
2. W sekcji **"OAuth 2.0 settings"** znajdziesz:
   - **Client ID** (ID klienta) - widoczne od razu
   - **Client Secret** (Tajny klucz klienta) - kliknij **"Show"** (Pokaż), aby go zobaczyć

### 4.2. Skopiuj wartości
1. **Skopiuj Client ID** - będzie wyglądał mniej więcej tak: `86abc123def456`
2. **Skopiuj Client Secret** - będzie wyglądał mniej więcej tak: `ABC123xyz789`
3. **Zapisz je w bezpiecznym miejscu** - będziesz ich potrzebował w następnym kroku

> ⚠️ **WAŻNE:** Client Secret jest widoczny tylko raz! Jeśli go nie zapiszesz, będziesz musiał wygenerować nowy.

---

## ⚙️ Krok 5: Konfiguracja zmiennych środowiskowych

### 5.1. Otwórz plik .env
1. W głównym katalogu projektu znajdź plik `.env`
2. Otwórz go w edytorze tekstu

### 5.2. Dodaj konfigurację LinkedIn
Dodaj następujące linie na końcu pliku `.env`:

```bash
# OAuth: LinkedIn
LINKEDIN_CLIENT_ID=twoj_client_id_tutaj
LINKEDIN_CLIENT_SECRET=twoj_client_secret_tutaj
LINKEDIN_CALLBACK_URL=http://localhost:3005/api/auth/linkedin/callback
```

**Przykład:**
```bash
# OAuth: LinkedIn
LINKEDIN_CLIENT_ID=86abc123def456
LINKEDIN_CLIENT_SECRET=ABC123xyz789
LINKEDIN_CALLBACK_URL=http://localhost:3005/api/auth/linkedin/callback
```

### 5.3. Zapisz plik
- Zapisz plik `.env`
- **Upewnij się, że nie ma spacji wokół znaku `=`**

---

## ✅ Krok 6: Weryfikacja konfiguracji

### 6.1. Uruchom ponownie serwer
1. Zatrzymaj serwer (jeśli działa) - naciśnij `Ctrl+C` w terminalu
2. Uruchom ponownie:
   ```bash
   npm run dev
   ```
   lub
   ```bash
   ./start.sh
   ```

### 6.2. Sprawdź logi serwera
W logach serwera powinieneś zobaczyć:
```
✅ [OAuth] LinkedIn OAuth strategy configured
```

Jeśli widzisz:
```
⚠️ [OAuth] LinkedIn OAuth not configured (missing LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET)
```
- Sprawdź, czy poprawnie skopiowałeś wartości do pliku `.env`
- Upewnij się, że nie ma spacji wokół znaku `=`
- Upewnij się, że plik `.env` jest w głównym katalogu projektu

### 6.3. Sprawdź status OAuth przez API
Otwórz nowy terminal i wykonaj:
```bash
curl http://localhost:3005/api/auth/oauth/status
```

Powinieneś zobaczyć:
```json
{
  "google": {
    "configured": false,
    "loginUrl": "/api/auth/google"
  },
  "linkedin": {
    "configured": true,
    "loginUrl": "/api/auth/linkedin"
  }
}
```

---

## 🧪 Krok 7: Testowanie logowania

### 7.1. Otwórz aplikację
1. Otwórz przeglądarkę i przejdź na: `http://localhost:3000`
2. Kliknij przycisk **"Log In"** (Zaloguj się)

### 7.2. Przetestuj logowanie przez LinkedIn
1. W formularzu logowania znajdź przycisk **"LinkedIn"** (obok przycisku Google)
2. Kliknij przycisk **"LinkedIn"**
3. Zostaniesz przekierowany na stronę LinkedIn
4. Zaloguj się swoim kontem LinkedIn
5. Zatwierdź uprawnienia dla aplikacji
6. Zostaniesz przekierowany z powrotem do aplikacji i automatycznie zalogowany ✅

---

## 🐛 Rozwiązywanie problemów

### Problem: "LinkedIn OAuth not configured"
**Rozwiązanie:**
- Sprawdź, czy wartości w pliku `.env` są poprawne
- Upewnij się, że nie ma spacji wokół znaku `=`
- Uruchom ponownie serwer

### Problem: "Redirect URI mismatch"
**Rozwiązanie:**
- Sprawdź, czy URL w LinkedIn Developers dokładnie odpowiada URL w `.env`
- URL musi być identyczny (bez spacji, bez końcowego ukośnika)
- Upewnij się, że używasz `http://` (nie `https://`) dla lokalnego środowiska

### Problem: "invalid_scope"
**Rozwiązanie:**
- Upewnij się, że zażądałeś dostępu do produktu "Sign In with LinkedIn using OpenID Connect"
- Sprawdź, czy LinkedIn zatwierdził Twoją aplikację

### Problem: "Access blocked"
**Rozwiązanie:**
- Sprawdź, czy Twoja aplikacja LinkedIn jest zatwierdzona
- W trybie deweloperskim możesz testować tylko na własnym koncie
- Dla produkcji musisz przesłać aplikację do weryfikacji LinkedIn

---

## 📚 Dodatkowe informacje

### Dla środowiska produkcyjnego:
1. W LinkedIn Developers dodaj URL produkcyjny:
   ```
   https://twoja-domena.com/api/auth/linkedin/callback
   ```
2. Zaktualizuj plik `.env.production`:
   ```bash
   LINKEDIN_CALLBACK_URL=https://twoja-domena.com/api/auth/linkedin/callback
   FRONTEND_URL=https://twoja-domena.com
   ```

### Bezpieczeństwo:
- ⚠️ **NIGDY** nie commituj pliku `.env` do Git
- Plik `.env` jest już w `.gitignore`, więc jest bezpieczny
- W produkcji używaj bezpiecznego przechowywania sekretów (np. zmienne środowiskowe serwera)

---

## 🎉 Gotowe!

Jeśli wszystko poszło dobrze, powinieneś móc logować się przez LinkedIn! 

Jeśli masz problemy, sprawdź:
1. Logi serwera w terminalu
2. Konsolę przeglądarki (F12 → Console)
3. Czy wszystkie kroki zostały wykonane poprawnie

Powodzenia! 🚀

