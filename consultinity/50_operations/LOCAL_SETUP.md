# 🚀 Przewodnik Uruchomienia Lokalnego - Consultinity

Ten dokument zawiera szczegółowe instrukcje dotyczące uruchomienia aplikacji Consultinity w środowisku lokalnym.

## 📋 Wymagania Wstępne

### Oprogramowanie
- **Node.js** >= 18.x (zalecane 20.x)
- **npm** >= 9.x
- **Git**

### Opcjonalne (dla pełnej funkcjonalności)
- **PostgreSQL** >= 15 (jeśli nie używasz SQLite)
- **Redis** >= 7 (dla rate limiting i cache)
- **Docker** i **Docker Compose** (dla łatwego uruchomienia zależności)

## 🔧 Instalacja i Konfiguracja

### Krok 1: Automatyczna Instalacja (Zalecane)

Użyj skryptu pomocniczego, który automatycznie skonfiguruje środowisko:

```bash
# Jeśli jeszcze nie sklonowałeś repozytorium
git clone <repository-url>
cd consultify

# Uruchom skrypt setup
chmod +x scripts/setup-local.sh
./scripts/setup-local.sh
```

Skrypt automatycznie:
- Sprawdzi wymagania wstępne
- Utworzy plik `.env.local` z domyślną konfiguracją
- Zainstaluje wszystkie zależności
- Sprawdzi konfigurację

### Krok 1 (Alternatywa): Ręczna Instalacja

```bash
# Jeśli jeszcze nie sklonowałeś repozytorium
git clone <repository-url>
cd consultify

# Instalacja zależności głównych
npm install

# Instalacja zależności backendu (jeśli istnieje osobny package.json)
cd server
npm install
cd ..
```

### Krok 2: Konfiguracja Zmiennych Środowiskowych

Utwórz plik `.env.local` w głównym katalogu projektu na podstawie poniższego szablonu:

```bash
# CONSULTITY - Environment Variables

# Server Configuration
NODE_ENV=development
PORT=3005
FRONTEND_URL=http://localhost:3000

# Database Configuration
# Dla lokalnego rozwoju zalecane jest SQLite (prostsze)
DB_TYPE=sqlite
SQLITE_PATH=./server/consultinity.db

# Lub PostgreSQL (jeśli preferujesz):
# DB_TYPE=postgres
# DATABASE_URL=postgresql://user:password@localhost:5432/consultify
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=consultify
# DB_USER=consultify
# DB_PASSWORD=securepassword123

# Redis Configuration (opcjonalne, ale zalecane)
REDIS_URL=redis://localhost:6379
MOCK_REDIS=false

# JWT & Security
JWT_SECRET=supersecretkey_change_this_in_production
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d

# LLM Provider - WYMAGANE (przynajmniej jeden)
# Google Gemini (zalecane dla lokalnego rozwoju)
GEMINI_API_KEY=your_gemini_api_key_here

# OpenAI (opcjonalne)
# OPENAI_API_KEY=sk-your_openai_api_key_here

# Anthropic Claude (opcjonalne)
# ANTHROPIC_API_KEY=sk-ant-your_anthropic_api_key_here

# OAuth (opcjonalne)
# GOOGLE_CLIENT_ID=your_google_client_id
# GOOGLE_CLIENT_SECRET=your_google_client_secret
# GOOGLE_CALLBACK_URL=http://localhost:3005/api/auth/google/callback

# Email (opcjonalne)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your_email@gmail.com
# SMTP_PASS=your_app_password
# SMTP_FROM="Consultify System" <system@consultify.com>

# Stripe (opcjonalne - tylko dla funkcji billing)
# STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
# STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
```

**Ważne:** 
- Plik `.env.local` jest ignorowany przez git (bezpieczeństwo)
- Dla produkcji użyj `.env.production`
- Zmień `JWT_SECRET` na bezpieczny klucz w produkcji!

### Krok 3: Uruchomienie Zależności (Opcjonalne)

#### Opcja A: Użycie Docker Compose (Zalecane)

```bash
# Uruchom PostgreSQL i Redis
docker-compose up -d postgres redis

# Sprawdź status
docker-compose ps
```

#### Opcja B: Lokalna Instalacja

**PostgreSQL:**
```bash
# macOS (Homebrew)
brew install postgresql@15
brew services start postgresql@15

# Linux (Ubuntu/Debian)
sudo apt-get install postgresql-15
sudo systemctl start postgresql

# Utworzenie bazy danych
createdb consultify
```

**Redis:**
```bash
# macOS (Homebrew)
brew install redis
brew services start redis

# Linux (Ubuntu/Debian)
sudo apt-get install redis-server
sudo systemctl start redis
```

### Krok 4: Inicjalizacja Bazy Danych

Baza danych SQLite jest automatycznie inicjalizowana przy pierwszym uruchomieniu serwera. 

Jeśli używasz PostgreSQL, możesz uruchomić migrację:

```bash
# Upewnij się, że DATABASE_URL jest ustawione w .env.local
node server/scripts/migrate-to-postgres.js
```

### Krok 5: Uruchomienie Aplikacji

#### Metoda 1: Użycie skryptu startowego

```bash
chmod +x start.sh
./start.sh
```

#### Metoda 2: Ręczne uruchomienie

```bash
# Uruchomienie frontendu i backendu jednocześnie
npm run dev

# Lub osobno:
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend
npm run dev:frontend
```

Aplikacja będzie dostępna pod adresami:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3005
- **Health Check:** http://localhost:3005/api/health

## 🧪 Weryfikacja Instalacji

### Sprawdzenie Health Check

```bash
curl http://localhost:3005/api/health
```

Oczekiwana odpowiedź:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "latency": 5,
  "database": "connected"
}
```

### Sprawdzenie Logów

Backend loguje informacje do konsoli. Sprawdź:
- Połączenie z bazą danych
- Połączenie z Redis (jeśli włączone)
- Inicjalizację serwisów

## 🔍 Rozwiązywanie Problemów

### Problem: Baza danych nie łączy się

**SQLite:**
- Sprawdź czy katalog `server/` istnieje i ma uprawnienia do zapisu
- Sprawdź ścieżkę w `SQLITE_PATH`

**PostgreSQL:**
- Sprawdź czy PostgreSQL działa: `pg_isready`
- Zweryfikuj dane dostępowe w `.env.local`
- Sprawdź czy baza danych istnieje: `psql -l | grep consultify`

### Problem: Redis nie łączy się

- Jeśli Redis nie jest dostępny, ustaw `MOCK_REDIS=true` w `.env.local`
- Sprawdź czy Redis działa: `redis-cli ping` (powinno zwrócić `PONG`)
- Sprawdź `REDIS_URL` w `.env.local`

### Problem: LLM API nie działa

- Sprawdź czy klucz API jest poprawnie ustawiony w `.env.local`
- Dla Gemini: uzyskaj klucz z https://makersuite.google.com/app/apikey
- Sprawdź logi backendu pod kątem błędów autoryzacji

### Problem: Port już zajęty

- Zmień `PORT` w `.env.local` (domyślnie 3005)
- Zmień port frontendu w `vite.config.ts` (domyślnie 3000)
- Sprawdź zajęte porty: `lsof -i :3005` (macOS/Linux)

### Problem: Zależności nie instalują się

```bash
# Wyczyść cache npm
npm cache clean --force

# Usuń node_modules i package-lock.json
rm -rf node_modules package-lock.json
rm -rf server/node_modules server/package-lock.json

# Zainstaluj ponownie
npm install
cd server && npm install && cd ..
```

## 📝 Struktura Projektu

```
consultify/
├── server/              # Backend (Express.js)
│   ├── index.js        # Główny plik serwera
│   ├── database.js     # Konfiguracja bazy danych
│   ├── routes/         # Endpointy API
│   ├── services/       # Logika biznesowa
│   ├── migrations/     # Migracje bazy danych
│   └── seed/           # Dane testowe
├── components/          # Komponenty React
├── views/              # Widoki/pages
├── store/              # Zustand store
├── vite.config.ts      # Konfiguracja Vite
├── package.json        # Zależności główne
└── .env.local          # Zmienne środowiskowe (utwórz samodzielnie)
```

## 🎯 Następne Kroki

Po udanym uruchomieniu:

1. **Utworzenie konta użytkownika:** Zarejestruj się przez interfejs webowy
2. **Konfiguracja LLM:** Upewnij się, że klucz API jest poprawny
3. **Przegląd dokumentacji:** Zobacz `docs/` dla szczegółów funkcjonalności
4. **Uruchomienie testów:** `npm run test:all`

## 🐳 Alternatywa: Docker Compose

Dla pełnego środowiska z wszystkimi zależnościami:

```bash
# Uruchom wszystko (app + postgres + redis)
docker-compose up

# Lub w tle
docker-compose up -d

# Zatrzymanie
docker-compose down
```

**Uwaga:** Docker Compose używa `.env.production` - upewnij się, że jest skonfigurowany.

## 📚 Dodatkowe Zasoby

- [Dokumentacja API](docs/API_REFERENCE.md)
- [Architektura](docs/02-architecture.md)
- [Przewodnik rozwoju](docs/04-development.md)
- [LLM Connection Guide](LLM/README.md)

## 💡 Wskazówki

- **Development:** Użyj SQLite + MOCK_REDIS=true dla szybkiego startu
- **Production-like:** Użyj PostgreSQL + Redis dla pełnej funkcjonalności
- **Debugging:** Ustaw `DB_LOG_QUERIES=true` w `.env.local` aby logować zapytania SQL
- **Testing:** Ustaw `NODE_ENV=test` aby wyłączyć scheduler i inne background jobs

---

**Masz problemy?** Sprawdź logi w konsoli lub utwórz issue w repozytorium.

